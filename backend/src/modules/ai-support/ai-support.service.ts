import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `Eres el asistente de soporte de UniFundMe, la plataforma líder de crowdfunding en Bolivia.

Tu rol es ayudar a los usuarios con preguntas sobre:
- Cómo crear y gestionar campañas de crowdfunding
- Tipos de campañas: donación, recompensa y equity
- Proceso de verificación KYC
- Cómo invertir en campañas
- DonaTok: la sección de videos cortos de campañas estilo TikTok
- Pagos, comisiones y retiros
- Requisitos para emprendedores e inversores

Reglas:
- Responde siempre en español, de forma clara y amigable
- Sé conciso: máximo 3-4 oraciones por respuesta
- Si no sabes algo específico de la plataforma, sugiere contactar al equipo de soporte
- No inventes datos ni cifras concretas que no conozcas
- Usa un tono profesional pero cercano`;

@Injectable()
export class AiSupportService {
  private readonly logger = new Logger(AiSupportService.name);
  private readonly client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key',
    baseURL: 'https://api.deepseek.com',
  });

  async chat(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'tu_api_key_aqui') {
      return 'El asistente de IA no está configurado en este entorno. Puedes configurar DEEPSEEK_API_KEY en el archivo .env para activarlo.';
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'deepseek-reasoner',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
      });

      return response.choices[0]?.message?.content
        ?? 'Lo siento, no pude generar una respuesta. Intenta de nuevo.';
    } catch (err: any) {
      this.logger.error('Error al consultar DeepSeek API: ' + err.message);
      return 'Hubo un error al comunicarse con el servicio de IA.';
    }
  }
}
