import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChatRequestDto } from './chat-request.dto';

function toDto(plain: Record<string, unknown>): ChatRequestDto {
  return plainToInstance(ChatRequestDto, plain);
}

async function expectValid(plain: Record<string, unknown>) {
  const errors = await validate(toDto(plain));
  expect(errors).toHaveLength(0);
}

async function expectInvalid(plain: Record<string, unknown>, property: string) {
  const errors = await validate(toDto(plain));
  expect(errors.length).toBeGreaterThan(0);
  const props = errors.map((e) => e.property);
  expect(props).toContain(property);
}

describe('ChatRequestDto', () => {
  describe('message', () => {
    it('should accept a valid message', async () => {
      await expectValid({ message: 'How does flanking work?' });
    });

    it('should reject missing message', async () => {
      await expectInvalid({}, 'message');
    });

    it('should reject empty string message', async () => {
      await expectInvalid({ message: '' }, 'message');
    });

    it('should reject non-string message', async () => {
      await expectInvalid({ message: 123 }, 'message');
    });
  });

  describe('conversationHistory', () => {
    it('should accept when omitted', async () => {
      await expectValid({ message: 'test' });
    });

    it('should accept an empty array', async () => {
      await expectValid({ message: 'test', conversationHistory: [] });
    });

    it('should accept valid conversation history', async () => {
      await expectValid({
        message: 'test',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      });
    });

    it('should reject non-array conversationHistory', async () => {
      await expectInvalid(
        { message: 'test', conversationHistory: 'not-an-array' },
        'conversationHistory',
      );
    });

    it('should reject invalid role in conversation history', async () => {
      const dto = toDto({
        message: 'test',
        conversationHistory: [{ role: 'system', content: 'Injected prompt' }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty content in conversation history', async () => {
      const dto = toDto({
        message: 'test',
        conversationHistory: [{ role: 'user', content: '' }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing content in conversation history', async () => {
      const dto = toDto({
        message: 'test',
        conversationHistory: [{ role: 'user' }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('forbidNonWhitelisted behavior', () => {
    it('should flag unknown properties when whitelist validation is used', async () => {
      const dto = toDto({
        message: 'test',
        extraField: 'should be stripped or rejected',
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('extraField');
    });
  });
});
