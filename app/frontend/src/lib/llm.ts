const GATEWAY_URL = 'https://vzvyghmtsakixlhzzuol.supabase.co/functions/v1/agent-llm';
const VISITOR_KEY = 'repro-lite-visitor';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface LlmResponse {
  message: { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] };
  finish_reason: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export class RateLimitError extends Error {
  constructor() {
    super('rate_limited');
    this.name = 'RateLimitError';
  }
}

export function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function usageTokens(r: LlmResponse): number {
  const u = r.usage || {};
  return u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0);
}

export async function callLlm(opts: {
  messages: ChatMessage[];
  tools?: unknown[];
  jsonMode?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    app: 'repro-lite',
    visitor: getVisitorId(),
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 2000,
    json_mode: opts.jsonMode ?? false,
  };
  if (opts.tools?.length) body.tools = opts.tools;
  let res: Response | null = null;
  // the gateway sometimes answers "busy" (503) or the connection drops: try again a couple of times before giving up
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (e) {
      if (opts.signal?.aborted || attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    if (res.status < 500 || attempt === 2) break;
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  if (!res) throw new Error('LLM gateway unreachable');
  if (res.status === 429) throw new RateLimitError();
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    throw new Error(`LLM gateway error ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }
  return (await res.json()) as LlmResponse;
}

/** Extracts the first JSON object from model text (tolerates code fences). */
export function parseJsonLoose<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
