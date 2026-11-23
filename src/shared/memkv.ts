import type { KV } from './game.ts';

/** In-memory KV with the same behaviour as the Redis calls the game uses. */
export const memoryKV = (): KV & { dump(): Map<string, unknown> } => {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const hash = (key: string) => {
    let h = hashes.get(key);
    if (!h) hashes.set(key, (h = new Map()));
    return h;
  };
  return {
    get: async (key) => strings.get(key) ?? null,
    set: async (key, value) => void strings.set(key, value),
    hGet: async (key, field) => hashes.get(key)?.get(field) ?? null,
    hSet: async (key, fields) => {
      const h = hash(key);
      for (const [f, v] of Object.entries(fields)) h.set(f, v);
      return Object.keys(fields).length;
    },
    hLen: async (key) => hashes.get(key)?.size ?? 0,
    dump: () => new Map<string, unknown>([...strings, ...hashes]),
  };
};
