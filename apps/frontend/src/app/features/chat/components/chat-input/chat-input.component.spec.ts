import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ChatInputComponent } from './chat-input.component';
import { ComponentRef } from '@angular/core';

describe('ChatInputComponent', () => {
  let component: ChatInputComponent;
  let componentRef: ComponentRef<ChatInputComponent>;
  let fixture: ComponentFixture<ChatInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatInputComponent],
      providers: [provideAnimationsAsync()],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatInputComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('submit', () => {
    it('should emit messageSubmitted with trimmed value', () => {
      const emitted: string[] = [];
      component.messageSubmitted.subscribe((val: string) => emitted.push(val));

      component.value = '  How does flanking work?  ';
      component.submit();

      expect(emitted).toEqual(['How does flanking work?']);
    });

    it('should clear the input after submit', () => {
      component.value = 'test question';
      component.submit();

      expect(component.value).toBe('');
    });

    it('should not emit when input is empty', () => {
      const emitted: string[] = [];
      component.messageSubmitted.subscribe((val: string) => emitted.push(val));

      component.value = '';
      component.submit();

      expect(emitted).toEqual([]);
    });

    it('should not emit when input is only whitespace', () => {
      const emitted: string[] = [];
      component.messageSubmitted.subscribe((val: string) => emitted.push(val));

      component.value = '   ';
      component.submit();

      expect(emitted).toEqual([]);
    });

    it('should not emit when disabled', () => {
      const emitted: string[] = [];
      component.messageSubmitted.subscribe((val: string) => emitted.push(val));

      componentRef.setInput('disabled', true);
      component.value = 'test question';
      component.submit();

      expect(emitted).toEqual([]);
    });
  });

  describe('template', () => {
    it('should trigger submit on Enter key', () => {
      const emitted: string[] = [];
      component.messageSubmitted.subscribe((val: string) => emitted.push(val));

      component.value = 'flanking rules';
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector('input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(emitted).toEqual(['flanking rules']);
    });

    it('should disable send button when input is empty', () => {
      component.value = '';
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.disabled).toBeTrue();
    });

    it('should disable send button when component is disabled', () => {
      componentRef.setInput('disabled', true);
      component.value = 'some text';
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.disabled).toBeTrue();
    });

    it('should enable send button when input has text and not disabled', () => {
      component.value = 'question';
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button');
      expect(button.disabled).toBeFalse();
    });
  });
});
