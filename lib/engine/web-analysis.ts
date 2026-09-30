import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { REVISION_MODEL } from './revision-prompt';
import { parseWebAnalysis, WEB_ANALYSIS_MAX_TOKENS, WEB_ANALYSIS_SYSTEM, WEB_ANALYSIS_TEMPERATURE, webAnalysisKey, webAnalysisUserMessage, webSearchToolFor, type AiWebAnalysis, type WebAnalysisFacts } from './web-analysis-prompt';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ maxRetries: 1, timeout: 90_000 });
  return client;
}

export function webAnalysisEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.VENTAJA_AI_WEB !== 'false';
}

/**
 * Análisis IA con búsqueda web (servidor de Anthropic ejecuta las búsquedas; máximo 3 por partido).
 * Devuelve null si no hay clave, si la respuesta no es válida o si falla la llamada.
 */
export async function analizarConWeb(facts: WebAnalysisFacts, dayKey: string): Promise<AiWebAnalysis | null> {
  const anthropic = getClient();
  if (!anthropic || !webAnalysisEnabled()) return null;
  try {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: webAnalysisUserMessage(facts) }];
    let res = await anthropic.messages.create({
      model: REVISION_MODEL,
      max_tokens: WEB_ANALYSIS_MAX_TOKENS,
      temperature: WEB_ANALYSIS_TEMPERATURE,
      system: WEB_ANALYSIS_SYSTEM,
      tools: [webSearchToolFor(REVISION_MODEL)],
      messages,
    });
    // Búsquedas largas: el servidor puede pausar el turno; se continúa una vez.
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content });
      res = await anthropic.messages.create({
        model: REVISION_MODEL,
        max_tokens: WEB_ANALYSIS_MAX_TOKENS,
        temperature: WEB_ANALYSIS_TEMPERATURE,
        system: WEB_ANALYSIS_SYSTEM,
        tools: [webSearchToolFor(REVISION_MODEL)],
        messages,
      });
    }
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = parseWebAnalysis(text);
    if (!parsed) return null;
    return { ...parsed, model: REVISION_MODEL, key: webAnalysisKey(facts, dayKey), at: new Date().toISOString() };
  } catch (err) {
    console.error('[web-analysis] fallo', (err as Error).message);
    return null;
  }
}
