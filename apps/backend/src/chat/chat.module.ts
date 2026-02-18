import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './services/chat.service';
import { EmbeddingService } from './services/embedding.service';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  controllers: [ChatController],
  providers: [EmbeddingService, VectorSearchService, ChatService],
})
export class ChatModule {}
