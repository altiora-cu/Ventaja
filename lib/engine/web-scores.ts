import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { REVISION_MODEL } from './revision-prompt';
import { webSearchToolFor } from './web-analysis-prompt';
import { parseWebScore, playedNearKickoff, WEB_SCORES_MAX_TOKENS, WEB_SCORES_SEARCH_MAX_USES, WEB_SCORES_SYSTEM, WEB_SCORES_TEMPERATURE, webScoresUserMessage, type WebScore, type WebScoreFacts } from './web-scores-prompt';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ maxRetries: 1, timeout: 90_000 });
  return client;
}

export function webScoresEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.VENTAJA_WEB_SCORES !== 'false';
}

/** Busca en la web el marcador final de un partido. Devuelve null si no lo confirma con confianza alta. */
export async function buscarMarcadorWeb(facts: WebScoreFacts): Promise<WebScore | null> {
  const anthropic = getClient();
  if (!anthropic || !webScoresEnabled()) return null;
  const tool = { ...webSearchToolFor(REVISION_MODEL), max_uses: WEB_SCORES_SEARCH_MAX_USES };
  try {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: webScoresUserMessage(facts) }];
    const call = () => anthropic.messages.create({ model: REVISION_MODEL, max_tokens: WEB_SCORES_MAX_TOKENS, temperature: WEB_SCORES_TEMPERATURE, system: WEB_SCORES_SYSTEM, tools: [tool], messages });
    let res = await call();
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content });
      res = await call();
    }
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = parseWebScore(text);
    if (!parsed || !playedNearKickoff(parsed, facts.kickoffIso)) return null;
    return parsed;
  } catch (err) {
    console.error('[web-scores] fallo', (err as Error).message);
    return null;
  }
}
