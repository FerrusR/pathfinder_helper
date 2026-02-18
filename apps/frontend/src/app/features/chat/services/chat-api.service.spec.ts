import { TestBed } from '@angular/core/testing';
import { ChatApiService } from './chat-api.service';
import { ChatEvent } from '../chat.types';

describe('ChatApiService', () => {
  let service: ChatApiService;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChatApiService);
    fetchSpy = spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.and.callThrough();
  });

  function createMockResponse(lines: string[], ok = true, status = 200, statusText = 'OK'): Response {
    const body = lines.join('\n') + '\n';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });

    return {
      ok,
      status,
      statusText,
      body: stream,
    } as unknown as Response;
  }

  function collectEvents(service: ChatApiService, message: string): Promise<ChatEvent[]> {
    return new Promise((resolve) => {
      const events: ChatEvent[] = [];
      service.sendMessage(message, []).subscribe({
        next: (event) => events.push(event),
        complete: () => resolve(events),
      });
    });
  }

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should call fetch with correct parameters', () => {
    const mockResponse = createMockResponse(['data:{"type":"done"}']);
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    service.sendMessage('test', [{ role: 'user', content: 'prev' }]).subscribe();

    expect(fetchSpy).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/api\/chat$/),
      jasmine.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test',
          conversationHistory: [{ role: 'user', content: 'prev' }],
        }),
      }),
    );
  });

  it('should emit token events from SSE stream', async () => {
    const mockResponse = createMockResponse([
      'data:{"type":"token","data":"Hello"}',
      'data:{"type":"token","data":" world"}',
      'data:{"type":"done"}',
    ]);
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    const events = await collectEvents(service, 'test');
    const tokens = events.filter((e) => e.type === 'token');

    expect(tokens.length).toBe(2);
    expect(tokens[0]).toEqual({ type: 'token', data: 'Hello' });
    expect(tokens[1]).toEqual({ type: 'token', data: ' world' });
  });

  it('should emit sources event from SSE stream', async () => {
    const sources = [{ title: 'Flanking', category: 'condition', source: 'CRB', similarity: 0.9 }];
    const mockResponse = createMockResponse([
      `data:${JSON.stringify({ type: 'sources', data: sources })}`,
      'data:{"type":"done"}',
    ]);
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    const events = await collectEvents(service, 'test');
    const sourcesEvent = events.find((e) => e.type === 'sources');

    expect(sourcesEvent).toEqual({ type: 'sources', data: sources });
  });

  it('should emit done event from SSE stream', async () => {
    const mockResponse = createMockResponse(['data:{"type":"done"}']);
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    const events = await collectEvents(service, 'test');
    const doneEvent = events.find((e) => e.type === 'done');

    expect(doneEvent).toEqual({ type: 'done' });
  });

  it('should emit error event on network failure', async () => {
    fetchSpy.and.returnValue(Promise.reject(new Error('Network error')));

    const events = await collectEvents(service, 'test');

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ type: 'error', data: 'Network error: unable to reach the server.' });
  });

  it('should emit error event on non-OK HTTP response', async () => {
    const mockResponse = createMockResponse([], false, 500, 'Internal Server Error');
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    const events = await collectEvents(service, 'test');

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ type: 'error', data: 'Server error: 500 Internal Server Error' });
  });

  it('should emit error event when response body is null', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      body: null,
    } as unknown as Response;
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    const events = await collectEvents(service, 'test');

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({ type: 'error', data: 'Streaming not supported by the browser.' });
  });

  it('should skip malformed JSON lines', async () => {
    const mockResponse = createMockResponse([
      'data:{"type":"token","data":"Hello"}',
      'data:not-valid-json',
      'data:{"type":"done"}',
    ]);
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    const events = await collectEvents(service, 'test');

    expect(events.length).toBe(2);
    expect(events[0].type).toBe('token');
    expect(events[1].type).toBe('done');
  });

  it('should skip lines that do not start with data:', async () => {
    const mockResponse = createMockResponse([
      'event:message',
      'data:{"type":"token","data":"Hello"}',
      '',
      'data:{"type":"done"}',
    ]);
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    const events = await collectEvents(service, 'test');

    expect(events.length).toBe(2);
    expect(events[0].type).toBe('token');
    expect(events[1].type).toBe('done');
  });

  it('should abort fetch when unsubscribed', () => {
    const mockResponse = createMockResponse(['data:{"type":"done"}']);
    fetchSpy.and.returnValue(Promise.resolve(mockResponse));

    const subscription = service.sendMessage('test', []).subscribe();
    subscription.unsubscribe();

    // Verify the AbortController signal was passed to fetch
    const fetchCall = fetchSpy.calls.mostRecent();
    const signal = fetchCall.args[1].signal as AbortSignal;
    expect(signal.aborted).toBeTrue();
  });
});
