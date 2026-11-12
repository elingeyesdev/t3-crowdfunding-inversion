import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AiSupportService } from './ai-support.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatDto {
  messages: ChatMessage[];
}

@Controller('ai-support')
export class AiSupportController {
  constructor(private readonly aiSupportService: AiSupportService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: ChatDto): Promise<{ reply: string }> {
    const reply = await this.aiSupportService.chat(body.messages ?? []);
    return { reply };
  }
}
