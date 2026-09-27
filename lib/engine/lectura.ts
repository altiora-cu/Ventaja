import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { LECTURA_MAX_TOKENS, LECTURA_MODEL, LECTURA_SYSTEM_EN, LECTURA_SYSTEM_ES, LECTURA_TEMPERATURE, lecturaFallback, lecturaUserMessage, type LecturaFacts } from './lectura-prompt';

const BANNED = /garantizad|segura|fija|guaranteed|\bsafe\b|\bsure\b|\block\b/i;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 20_000 });
  return client;
}

/**
 * Genera la Lectura con Claude (Haiku, max_tokens 220, temperatura 0.4).
 * Si no hay API key o falla, devuelve una lectura determinista con las mismas reglas.
 * La llamada se cachea por fixture en fixture_analysis; regenerar solo si cambia el Sello.
 */
export async function generarLectura(facts: LecturaFacts, locale: 'es' | 'en' = 'es'): Promise<{ text: string; source: 'claude' | 'fallback' }> {
  const anthropic = getClient();
  if (!anthropic) return { text: lecturaFallback(facts, locale), source: 'fallback' };
  try {
    const res = await anthropic.messages.create({
      model: LECTURA_MODEL,
      max_tokens: LECTURA_MAX_TOKENS,
      temperature: LECTURA_TEMPERATURE,
      system: locale === 'es' ? LECTURA_SYSTEM_ES : LECTURA_SYSTEM_EN,
      messages: [{ role: 'user', content: lecturaUserMessage(facts, locale) }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    if (!text || BANNED.test(text) || text.split(/[.!?]\s/).length > 6) {
      return { text: lecturaFallback(facts, locale), source: 'fallback' };
    }
    return { text, source: 'claude' };
  } catch (err) {
    console.error('[lectura] fallo Claude, usando fallback', err);
    return { text: lecturaFallback(facts, locale), source: 'fallback' };
  }
}
