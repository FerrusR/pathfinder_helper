import { Body, Controller, Post, Sse, MessageEvent } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatService } from './services/chat.service';
import { map, Observable } from 'rxjs';
import { CurrentUser } from '@/common/decorators';
import { RequestUser } from '@/common/types/request-user.type';

@ApiTags('chat')
@ApiBearerAuth('jwt')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @Sse()
  @ApiOperation({
    summary: 'Send a chat message (SSE streaming)',
    description:
      'Accepts a question and optional conversation history. Performs RAG retrieval ' +
      'against the rule_chunks vector store and streams the response as Server-Sent Events ' +
      '(Content-Type: text/event-stream). Each event carries a JSON data payload. ' +
      'The stream terminates with a [DONE] sentinel event.',
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: 200,
    description: 'SSE stream of chat response chunks',
    schema: {
      type: 'string',
      example:
        'data: {"type":"chunk","content":"Flanking requires two allies..."}\n\n' +
        'data: {"type":"citation","source":"Core Rulebook p.476"}\n\n' +
        'data: [DONE]\n\n',
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — JWT required' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  chat(@Body() dto: ChatRequestDto, @CurrentUser() user: RequestUser): Observable<MessageEvent> {
    return this.chatService.chat(dto.message, user, dto.conversationHistory).pipe(
      map((event) => ({
        data: event,
      })),
    );
  }
}
