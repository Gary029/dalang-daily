import data from './bank.json' with { type: 'json' };
import type { PuzzleDef } from './puzzle.ts';
import { bankIndexForDay } from './puzzle.ts';

type Bank = { warmup: PuzzleDef; puzzles: PuzzleDef[] };

export const BANK: Bank = data as Bank;

export const WARMUP = BANK.warmup;

export const puzzleForDay = (day: number): PuzzleDef =>
  BANK.puzzles[bankIndexForDay(day, BANK.puzzles.length)]!;

export const puzzleById = (id: string): PuzzleDef | undefined =>
  id === WARMUP.id ? WARMUP : BANK.puzzles.find((p) => p.id === id);
