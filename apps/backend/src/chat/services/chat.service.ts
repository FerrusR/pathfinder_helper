import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureChatOpenAI } from '@langchain/openai';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { Observable } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService } from './vector-search.service';
import { RuleChunkResult } from './vector-search.service';
import { ChatSseEvent, RuleSource } from '../types/chat.types';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  private llm!: AzureChatOpenAI;
  private systemPrompt!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorSearchService: VectorSearchService,
  ) {}

  onModuleInit() {
    this.llm = new AzureChatOpenAI({
      azureOpenAIApiKey: this.configService.getOrThrow<string>('AZURE_OPENAI_API_KEY'),
      azureOpenAIEndpoint: this.configService.getOrThrow<string>('AZURE_OPENAI_ENDPOINT'),
      azureOpenAIApiDeploymentName: this.configService.getOrThrow<string>(
        'AZURE_OPENAI_DEPLOYMENT_NAME',
      ),
      azureOpenAIApiInstanceName: this.configService.getOrThrow<string>('AZURE_OPENAI_API_INSTANCE_NAME'),
      azureOpenAIApiVersion: '2025-01-01-preview',
      streaming: true,
    });

    const promptPath = path.join(process.cwd(), 'docs', 'prompts', 'chat-system-prompt.md');
    this.systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    this.logger.log('System prompt loaded from docs/prompts/chat-system-prompt.md');
  }

  chat(message: string, conversationHistory: ConversationMessage[] = []): Observable<ChatSseEvent> {
    return new Observable((subscriber) => {
      this.processChat(message, conversationHistory, subscriber);
    });
  }

  private async processChat(
    message: string,
    conversationHistory: ConversationMessage[],
    subscriber: {
      next: (value: ChatSseEvent) => void;
      complete: () => void;
      error: (err: unknown) => void;
    },
  ) {
    try {
      this.logger.log(`Processing chat - message length: ${message.length}, history size: ${conversationHistory.length}`);
      this.logger.debug(`User message: "${message}"`);

      this.logger.log('Generating embedding for user query...');
      const embedding = await this.embeddingService.embedQuery(message);
      this.logger.log(`Embedding generated - dimensions: ${embedding.length}`);

      this.logger.log('Searching for relevant rule chunks...');
      const chunks = await this.vectorSearchService.searchRuleChunks(embedding);
      this.logger.log(`Retrieved ${chunks.length} rule chunks`);
      if (chunks.length > 0) {
        this.logger.debug(
          `Top chunks: ${chunks.map((c) => `"${c.title}" (${c.category}, similarity: ${c.similarity.toFixed(4)})`).join(', ')}`,
        );
      } else {
        this.logger.warn('No relevant chunks found for query');
      }

      const sources: RuleSource[] = chunks.map((chunk) => ({
        title: chunk.title,
        category: chunk.category,
        source: chunk.source,
        similarity: chunk.similarity,
      }));

      subscriber.next({ type: 'sources', data: sources });

      const context = this.formatContext(chunks);
      const messages = this.buildMessages(context, conversationHistory, message);
      this.logger.log(`Built ${messages.length} messages for LLM (1 system + ${conversationHistory.length} history + 1 user)`);
      this.logger.debug(`Context length: ${context.length} characters`);

      this.logger.log('Starting LLM stream...');
      const stream = await this.llm.stream(messages);

      let tokenCount = 0;
      for await (const chunk of stream) {
        const token = chunk.content;
        if (typeof token === 'string' && token.length > 0) {
          tokenCount++;
          subscriber.next({ type: 'token', data: token });
        }
      }

      this.logger.log(`LLM stream completed - ${tokenCount} tokens emitted`);
      subscriber.next({ type: 'done' });
      subscriber.complete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      this.logger.error(`Chat processing failed: ${errorMessage}`, err instanceof Error ? err.stack : undefined);
      subscriber.next({ type: 'error', data: errorMessage });
      subscriber.complete();
    }
  }

  private formatContext(chunks: RuleChunkResult[]): string {
    return chunks
      .map(
        (chunk) =>
          `[Official] Title: ${chunk.title}\nCategory: ${chunk.category}\nSource: ${chunk.source}\nContent: ${chunk.content}`,
      )
      .join('\n\n');
  }

  private buildMessages(
    context: string,
    conversationHistory: ConversationMessage[],
    userMessage: string,
  ) {
    const messages: BaseMessage[] = [
      new SystemMessage(`${this.systemPrompt}\n\n## Retrieved Context\n\n${context}`),
    ];

    for (const msg of conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else {
        messages.push(new AIMessage(msg.content));
      }
    }

    messages.push(new HumanMessage(userMessage));

    return messages;
  }
}
