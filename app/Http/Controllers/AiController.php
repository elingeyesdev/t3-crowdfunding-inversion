<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiController extends Controller
{
    public function chat(Request $r)
    {
        $data = $r->validate(['messages' => 'required|array|min:1|max:30', 'messages.*.role' => 'required|in:user,assistant', 'messages.*.content' => 'required|string|max:8000', 'campaignContext' => 'nullable|array']);
        $key = config('services.deepseek.key');
        if (! $key || $key === 'tu_api_key_aqui') {
            return response()->json(['reply' => 'El asistente de IA no está configurado en este entorno. Configura DEEPSEEK_API_KEY para activarlo.']);
        }
        $campaign = str_contains($r->path(), 'ai-campaign');
        $system = $campaign ? 'Eres CampaignAI, asistente de crowdfunding de UniFundMe en Bolivia. Ayuda a redactar campañas, estructurar recompensas por porcentajes y analizar recaudación. Responde en español con ejemplos concretos, máximo 400 palabras.' : 'Eres el asistente de soporte de UniFundMe, plataforma de crowdfunding de Bolivia. Responde en español en 3 o 4 oraciones sobre campañas, KYC, aportes y DonaTok. No inventes datos; sugiere contactar soporte cuando no sepas.';
        if ($campaign && ! empty($data['campaignContext'])) {
            $system .= "\nDatos de campaña proporcionados por el usuario: ".json_encode($data['campaignContext'], JSON_UNESCAPED_UNICODE);
        }
        try {
            $response = Http::withToken($key)->timeout(90)->post('https://api.deepseek.com/chat/completions', ['model' => $campaign ? 'deepseek-chat' : 'deepseek-reasoner', 'messages' => [['role' => 'system', 'content' => $system], ...$data['messages']], 'max_tokens' => 1200])->throw();

            return response()->json(['reply' => $response->json('choices.0.message.content') ?? 'No se pudo generar una respuesta.']);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['reply' => 'Hubo un error al comunicarse con el servicio de IA. Intenta nuevamente.'], 502);
        }
    }
}
