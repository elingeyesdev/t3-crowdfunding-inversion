import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { AiCampaignService, CampaignContext } from './ai-campaign.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiCampaignChatDto {
  messages: ChatMessage[];
  campaignContext?: CampaignContext;
}

@ApiTags('ai-campaign')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-campaign')
export class AiCampaignController {
  constructor(private readonly aiCampaignService: AiCampaignService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: AiCampaignChatDto): Promise<{ reply: string }> {
    const reply = await this.aiCampaignService.chat(
      body.messages ?? [],
      body.campaignContext,
    );
    return { reply };
  }
}
