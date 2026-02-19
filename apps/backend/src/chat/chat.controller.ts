import { Body, Controller, Post, Sse, MessageEvent  } from '@nestjs/common';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatService } from './services/chat.service';
import { map, Observable } from 'rxjs';
import { CurrentUser } from '@/common/decorators';
import { RequestUser } from '@/common/types/request-user.type';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @Sse()
  chat(@Body() dto: ChatRequestDto, @CurrentUser() user: RequestUser): Observable<MessageEvent>  {
    return this.chatService.chat(dto.message, user, dto.conversationHistory).pipe(
      map((event) => ({
        data: event,
      })),
    );
  }
}
