import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatController } from './chat.controller';
import { ChatService } from './services/chat.service';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  imports: [CommonModule, PrismaModule],
  controllers: [ChatController],
  providers: [VectorSearchService, ChatService],
})
export class ChatModule {}
