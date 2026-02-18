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

export type ChatSseEvent = TokenEvent | SourcesEvent | DoneEvent | ErrorEvent;
