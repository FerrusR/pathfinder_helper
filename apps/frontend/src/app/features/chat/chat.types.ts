export type MessageRole = 'user' | 'assistant';

export interface ConversationMessage {
  role: MessageRole;
  content: string;
}

export interface RuleSource {
  title: string;
  category: string;
  source: string;
  similarity: number;
}

export interface TokenEvent {
  type: 'token';
  data: string;
}

export interface SourcesEvent {
  type: 'sources';
  data: RuleSource[];
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  data: string;
}

export type ChatEvent = TokenEvent | SourcesEvent | DoneEvent | ErrorEvent;

export interface ChatMessage {
  role: MessageRole;
  content: string;
  sources?: RuleSource[];
}
