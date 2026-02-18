import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { provideMarkdown } from 'ngx-markdown';
import { MessageBubbleComponent } from './message-bubble.component';
import { ChatMessage } from '../../chat.types';

describe('MessageBubbleComponent', () => {
  let component: MessageBubbleComponent;
  let componentRef: ComponentRef<MessageBubbleComponent>;
  let fixture: ComponentFixture<MessageBubbleComponent>;

  const userMessage: ChatMessage = {
    role: 'user',
    content: 'How does flanking work?',
  };

  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: '**Flanking** gives a +2 circumstance bonus.',
    sources: [
      { title: 'Flanking', category: 'condition', source: 'Core Rulebook', similarity: 0.9 },
      { title: 'Flat-Footed', category: 'condition', source: 'Core Rulebook', similarity: 0.85 },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageBubbleComponent],
      providers: [provideMarkdown()],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageBubbleComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('should create with a user message', () => {
    componentRef.setInput('message', userMessage);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('user messages', () => {
    beforeEach(() => {
      componentRef.setInput('message', userMessage);
      fixture.detectChanges();
    });

    it('should apply the user CSS class', () => {
      const bubble = fixture.nativeElement.querySelector('.bubble');
      expect(bubble.classList.contains('user')).toBeTrue();
      expect(bubble.classList.contains('assistant')).toBeFalse();
    });

    it('should render plain text content', () => {
      const content = fixture.nativeElement.querySelector('.content');
      expect(content.textContent.trim()).toBe('How does flanking work?');
    });

    it('should not render markdown component', () => {
      const markdown = fixture.nativeElement.querySelector('markdown');
      expect(markdown).toBeNull();
    });

    it('should not display sources section', () => {
      const sources = fixture.nativeElement.querySelector('.sources');
      expect(sources).toBeNull();
    });
  });

  describe('assistant messages', () => {
    beforeEach(() => {
      componentRef.setInput('message', assistantMessage);
      fixture.detectChanges();
    });

    it('should apply the assistant CSS class', () => {
      const bubble = fixture.nativeElement.querySelector('.bubble');
      expect(bubble.classList.contains('assistant')).toBeTrue();
      expect(bubble.classList.contains('user')).toBeFalse();
    });

    it('should render markdown component', () => {
      const markdown = fixture.nativeElement.querySelector('markdown');
      expect(markdown).toBeTruthy();
    });

    it('should display source chips', () => {
      const chips = fixture.nativeElement.querySelectorAll('.source-chip');
      expect(chips.length).toBe(2);
      expect(chips[0].textContent).toBe('Flanking');
      expect(chips[1].textContent).toBe('Flat-Footed');
    });

    it('should display sources label', () => {
      const label = fixture.nativeElement.querySelector('.sources-label');
      expect(label.textContent).toBe('Sources:');
    });
  });

  describe('assistant message without sources', () => {
    it('should not display sources section', () => {
      const messageNoSources: ChatMessage = {
        role: 'assistant',
        content: 'I am not sure about that.',
      };
      componentRef.setInput('message', messageNoSources);
      fixture.detectChanges();

      const sources = fixture.nativeElement.querySelector('.sources');
      expect(sources).toBeNull();
    });
  });
});
