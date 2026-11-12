import {
  Controller, Get, Post, Param, Body,
  UseGuards, Request, HttpCode, Query, Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Campaign Comments')
@Controller('campaigns/:campaignId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /** GET /campaigns/:campaignId/comments — público, no requiere auth */
  @Get()
  @ApiOperation({ summary: 'Get all comments for a campaign (public)' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  async getComments(
    @Param('campaignId') campaignId: string,
    @Query('userId') userId?: string,
  ) {
    const comments = await this.commentsService.getComments(campaignId, userId);
    return { statusCode: 200, data: comments };
  }

  /** POST /campaigns/:campaignId/comments — requiere auth (investor o entrepreneur) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('investor', 'entrepreneur')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a comment on a campaign (investor/entrepreneur only)' })
  @ApiBody({ schema: { properties: { content: { type: 'string' } } } })
  async createComment(
    @Param('campaignId') campaignId: string,
    @Body('content') content: string,
    @Request() req: any,
  ) {
    const comment = await this.commentsService.createComment(campaignId, req.user.id, content);
    return { statusCode: 201, data: comment };
  }

  /** POST /campaigns/:campaignId/comments/:commentId/like — requiere auth (investor o entrepreneur) */
  @Post(':commentId/like')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('investor', 'entrepreneur')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle like on a comment (investor/entrepreneur only)' })
  @ApiParam({ name: 'commentId', description: 'Comment UUID' })
  async toggleLike(
    @Param('commentId') commentId: string,
    @Request() req: any,
  ) {
    const result = await this.commentsService.toggleLike(commentId, req.user.id);
    return { statusCode: 200, data: result };
  }
}
