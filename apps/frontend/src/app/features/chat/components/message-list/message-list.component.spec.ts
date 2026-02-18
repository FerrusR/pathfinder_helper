import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { provideMarkdown } from 'ngx-markdown';
import { MessageListComponent } from './message-list.component';
import { ChatMessage } from '../../chat.types';

describe('MessageListComponent', () => {
  let component: MessageListComponent;
  let componentRef: ComponentRef<MessageListComponent>;
  let fixture: ComponentFixture<MessageListComponent>;

  const mockMessages: ChatMessage[] = [
    { role: 'user', content: 'How does flanking work?' },
    { role: 'assistant', content: 'Flanking gives a +2 circumstance bonus.' },
    { role: 'user', content: 'And flat-footed?' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageListComponent],
      providers: [provideMarkdown()],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageListComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create', () => {
    componentRef.setInput('messages', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('empty state', () => {
    it('should display empty state when no messages', () => {
      componentRef.setInput('messages', []);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should display empty state text', () => {
      componentRef.setInput('messages', []);
      fixture.detectChanges();

      const emptyText = fixture.nativeElement.querySelector('.empty-text');
      expect(emptyText.textContent).toContain('Ask a question about Pathfinder 2e rules');
    });
  });

  describe('with messages', () => {
    beforeEach(() => {
      componentRef.setInput('messages', mockMessages);
      fixture.detectChanges();
    });

    it('should render a message bubble for each message', () => {
      const bubbles = fixture.nativeElement.querySelectorAll('app-message-bubble');
      expect(bubbles.length).toBe(3);
    });

    it('should not display empty state', () => {
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeNull();
    });
  });

  describe('auto-scroll', () => {
    it('should scroll to bottom when messages change', async () => {
      componentRef.setInput('messages', []);
      fixture.detectChanges();

      const scrollContainer = fixture.nativeElement.querySelector('.message-list');
      spyOn(scrollContainer, 'scrollTo');

      componentRef.setInput('messages', mockMessages);
      fixture.detectChanges();

      // The effect uses setTimeout, so we need to wait for it
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(scrollContainer.scrollTo).toHaveBeenCalled();
    });
  });
});
