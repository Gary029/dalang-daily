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
  const zsets = new Map<string, Map<string, number>>();
  const zset = (key: string) => {
    let z = zsets.get(key);
    if (!z) zsets.set(key, (z = new Map()));
    return z;
  };
  const sorted = (key: string) =>
    [...(zsets.get(key) ?? new Map<string, number>())]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : 1));
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
    zAdd: async (key, ...members) => {
      const z = zset(key);
      for (const m of members) z.set(m.member, m.score);
      return members.length;
    },
    zRange: async (key, start, stop) =>
      sorted(key).slice(start, stop < 0 ? undefined : stop + 1),
    zRank: async (key, member) => {
      const i = sorted(key).findIndex((m) => m.member === member);
      return i < 0 ? undefined : i;
    },
    dump: () => new Map<string, unknown>([...strings, ...hashes]),
  };
};
