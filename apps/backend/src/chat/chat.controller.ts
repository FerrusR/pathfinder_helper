import { Body, Controller, Post, Res, Sse, MessageEvent  } from '@nestjs/common';
import { Response } from 'express';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatService } from './services/chat.service';
import { interval, map, Observable, tap } from 'rxjs';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  chat(@Body() dto: ChatRequestDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const observable = this.chatService.chat(dto.message, dto.conversationHistory);

    const subscription = observable.subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      complete: () => {
        res.end();
      },
      error: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', data: String(err) })}\n\n`);
        res.end();
      },
    });

    res.on('close', () => {
      subscription.unsubscribe();
    });
  }

  
  @Sse('events')
  sendEvents(): Observable<MessageEvent> {
    console.log('Client connected to SSE endpoint');
    return interval(3000).pipe(
      tap(() => console.log('Emitting event to client')),
      map((count) => ({
        data: `Update #${count}`,
    })),
    tap(() => console.log('Event emitted')),
    );
  }
}
