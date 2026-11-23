import type { TodaySolve } from './api.ts';
import { dateLabel } from './puzzle.ts';

const TRAIL = ['⬛', '🟫', '🟧', '🟨'];

/** A spoiler-free result: how it went, never where the puppets stood. */
export const shareText = (
  def: { title: string },
  day: number,
  s: TodaySolve,
  streak: number
): string => {
  const trail = (s.trail ?? []).map((v) => TRAIL[v] ?? TRAIL[0]).join('');
  const extras = [
    s.gold ? '🥇 gold' : '',
    s.hints ? `💡${s.hints}` : '',
    streak > 1 ? `🔥${streak}` : '',
  ].filter(Boolean);
  const lines = [
    `**Dalang #${day + 1} · ${dateLabel(day)} · ${def.title}**`,
    '',
    [`🪔 100% in ${s.moves} moves (par ${s.par})`, ...extras].join(' · '),
  ];
  if (trail) lines.push('', `${trail}✨`);
  return lines.join('\n');
};
