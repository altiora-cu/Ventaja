import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { parseRevision, REVISION_MAX_TOKENS, REVISION_MODEL, REVISION_SYSTEM, REVISION_TEMPERATURE, revisionKey, revisionUserMessage, selloFinal, type AiReview, type RevisionFacts } from './revision-prompt';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 25_000 });
  return client;
}

export function revisionEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.VENTAJA_AI_REVIEW !== 'false';
}

/**
 * Revisión IA del pick principal. Devuelve null si no hay clave, si el modelo responde algo
 * inválido o si falla la llamada: en ese caso la app muestra el sello del modelo sin cambios.
 */
export async function revisarPick(facts: RevisionFacts): Promise<AiReview | null> {
  const anthropic = getClient();
  if (!anthropic || !revisionEnabled()) return null;
  try {
    const res = await anthropic.messages.create({
      model: REVISION_MODEL,
      max_tokens: REVISION_MAX_TOKENS,
      temperature: REVISION_TEMPERATURE,
      system: REVISION_SYSTEM,
      messages: [{ role: 'user', content: revisionUserMessage(facts) }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = parseRevision(text);
    if (!parsed) return null;
    return {
      ...parsed,
      sello_modelo: facts.selloModelo,
      sello_final: selloFinal(facts.selloModelo, parsed.verdict),
      model: REVISION_MODEL,
      key: revisionKey(facts),
      at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[revision] fallo Claude', err);
    return null;
  }
}
