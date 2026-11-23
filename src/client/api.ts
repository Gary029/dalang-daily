import type {
  HintResponse,
  ShareResponse,
  SolveRequest,
  SolveResponse,
  TodayResponse,
} from '../shared/api.ts';

/**
 * Talks to the Devvit server. `npm run local` builds with VITE_LOCAL=1 and
 * the same calls go to an in-browser copy of the server logic instead, so the
 * game can be tried and screenshotted without Reddit.
 */
const LOCAL = import.meta.env.VITE_LOCAL === '1';

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
};

export const api = {
  /** peek: the feed card looks without counting you as a player */
  today: async (peek = false): Promise<TodayResponse> => {
    if (LOCAL) return (await import('./local.ts')).local.today();
    const res = await fetch(peek ? '/api/today?peek=1' : '/api/today');
    if (!res.ok) throw new Error(`today: HTTP ${res.status}`);
    return (await res.json()) as TodayResponse;
  },
  hint: async (): Promise<HintResponse> =>
    LOCAL ? (await import('./local.ts')).local.hint() : post('/api/hint', {}),
  solve: async (req: SolveRequest): Promise<SolveResponse> =>
    LOCAL
      ? (await import('./local.ts')).local.solve(req)
      : post('/api/solve', req),
  share: async (): Promise<ShareResponse> =>
    LOCAL ? (await import('./local.ts')).local.share() : post('/api/share', {}),
};
