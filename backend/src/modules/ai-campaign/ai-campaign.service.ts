import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `Eres CampaignAI, el asistente experto en crowdfunding de UniFundMe — la plataforma boliviana de financiamiento colectivo.

Tu misión es ayudar a emprendedores bolivianos a crear campañas exitosas y analizar su rendimiento.

## Puedes ayudar con:

### Creación de campañas
- Redactar títulos atractivos y descripciones persuasivas
- Definir metas de financiamiento realistas según el tipo de proyecto
- Elegir el tipo de campaña correcto: donación (causas sociales), recompensa (productos/servicios) o equity (participación empresarial)
- Estructurar el pitch y propuesta de valor

### Niveles de recompensa
- Diseñar tiers de recompensas atractivos y bien valorados
- Sugerir beneficios escalonados (básico / estándar / premium / VIP)
- Calcular precios competitivos

### Análisis de campañas
- Identificar puntos débiles en descripción, meta, o propuesta
- Sugerir mejoras concretas para aumentar la tasa de conversión
- Analizar si la meta de financiamiento es realista
- Revisar la estrategia de recompensas

### Marketing y difusión
- Estrategias de difusión en redes sociales bolivianas
- Mensajes para WhatsApp, Facebook, Instagram, TikTok
- Cómo usar DonaTok (videos cortos estilo TikTok) para viralizar la campaña
- Plan de lanzamiento y primeras 48 horas

### Pitch de video (DonaTok)
- Script para video de 60 segundos
- Estructura: gancho (0-5s) → problema (5-15s) → solución (15-35s) → llamada a la acción (35-60s)

## Contexto de la plataforma UniFundMe
- Plataforma boliviana de crowdfunding con 3 tipos: donación, recompensa, equity
- Proceso KYC obligatorio para emprendedores
- DonaTok: sección de videos cortos para promocionar campañas
- Inversores verificados con capital disponible
- Comisión de plataforma del 5% sobre fondos recaudados
- Moneda principal: BOB (bolivianos, Bs.)

## Reglas de respuesta
- Siempre en español, tono profesional pero cercano y motivador
- Respuestas estructuradas con títulos, listas y negritas cuando sea útil
- Ejemplos concretos adaptados al contexto boliviano
- Si el usuario comparte datos de una campaña, analizarlos en detalle
- Máximo 400 palabras por respuesta salvo que el usuario pida algo extenso
- Si generas texto para una campaña, hazlo listo para copiar y usar directamente`;

export interface CampaignContext {
  title?: string;
  description?: string;
  goalAmount?: number;
  currentAmount?: number;
  campaignType?: string;
  categoryName?: string;
  investorCount?: number;
  daysRemaining?: number;
}

@Injectable()
export class AiCampaignService {
  private readonly client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key',
    baseURL: 'https://api.deepseek.com',
  });

  async chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    campaignContext?: CampaignContext,
  ): Promise<string> {
    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'tu_api_key_aqui') {
      return 'El asistente de IA para campañas no está configurado en este entorno. Puedes configurar DEEPSEEK_API_KEY en el archivo .env para activarlo.';
    }
    let systemPrompt = SYSTEM_PROMPT;

    if (campaignContext) {
      const progress = campaignContext.goalAmount
        ? Math.round((campaignContext.currentAmount ?? 0) / campaignContext.goalAmount * 100)
        : 0;

      systemPrompt += `\n\n## Campaña actual del emprendedor (contexto)\n` +
        `- Título: ${campaignContext.title ?? 'Sin título'}\n` +
        `- Tipo: ${campaignContext.campaignType ?? 'N/A'}\n` +
        `- Categoría: ${campaignContext.categoryName ?? 'N/A'}\n` +
        `- Meta: Bs. ${campaignContext.goalAmount?.toLocaleString('es-BO') ?? 0}\n` +
        `- Recaudado: Bs. ${campaignContext.currentAmount?.toLocaleString('es-BO') ?? 0} (${progress}%)\n` +
        `- Inversores: ${campaignContext.investorCount ?? 0}\n` +
        `- Días restantes: ${campaignContext.daysRemaining ?? 'N/A'}\n` +
        `- Descripción actual:\n${campaignContext.description ?? 'Sin descripción'}\n\n` +
        `Usa estos datos para dar análisis y sugerencias específicas sobre esta campaña.`;
    }

    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1200,
    });

    return response.choices[0]?.message?.content
      ?? 'Lo siento, no pude generar una respuesta. Intenta de nuevo.';
  }
}
