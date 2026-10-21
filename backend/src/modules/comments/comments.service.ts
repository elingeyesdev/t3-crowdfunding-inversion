import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CommentsRepository } from './comments.repository';

@Injectable()
export class CommentsService {
  constructor(private readonly repo: CommentsRepository) {}

  async getComments(campaignId: string, userId?: string) {
    return this.repo.findByCampaign(campaignId, userId);
  }

  async createComment(campaignId: string, authorId: string, content: string) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('El comentario no puede estar vacío.');
    }
    if (content.trim().length > 2000) {
      throw new BadRequestException('El comentario no puede superar los 2000 caracteres.');
    }
    return this.repo.create(campaignId, authorId, content);
  }

  async toggleLike(commentId: string, userId: string) {
    if (!commentId) throw new NotFoundException('Comentario no encontrado.');
    return this.repo.toggleLike(commentId, userId);
  }
}
