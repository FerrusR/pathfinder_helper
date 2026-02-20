import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export class ConversationMessageDto {
  @ApiProperty({
    description: 'Role of the message author',
    enum: MessageRole,
    example: MessageRole.USER,
  })
  @IsEnum(MessageRole)
  role!: MessageRole;

  @ApiProperty({
    description: 'Message content text',
    example: 'How does the flanking rule work?',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class ChatRequestDto {
  @ApiProperty({
    description: 'The user question to send to the RAG chatbot',
    example: 'Can a fighter use Power Attack while flanking?',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({
    description: 'Prior conversation turns for multi-turn context',
    type: [ConversationMessageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  conversationHistory?: ConversationMessageDto[];
}
