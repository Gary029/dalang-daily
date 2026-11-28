import { useEffect, useMemo, useState } from 'react';
import { shapesOf, type Slot } from '../shared/puzzle.ts';
import tales from '../shared/tales.json';
import { bonang, gong, kendang, saron } from './audio.ts';
import { Kelir } from './board.tsx';

/**
 * Sunday's finale: the puppets you posed perform the week's story on the
 * kelir, arms and heads moving to the gamelan, while the chapter titles go by.
 */

type Tale = { id: string; lakon: string; title: string };
const BEAT = 450;
/** the scene balungan from Dalang VR, one gongan */
const MELODY = [2, 3, 5, 3, 2, 1, 2, 0];

export const Finale = (props: {
  offered: readonly string[];
  slots: readonly Slot[];
  lamps: number;
  lakon: string;
  onDone: () => void;
}) => {
  const chapters = useMemo(
    () => (tales as Tale[]).filter((t) => t.lakon === props.lakon),
    [props.lakon]
  );
  const beats = chapters.length * 4;
  const [step, setStep] = useState(0);
  const done = step >= beats;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      const k = step % MELODY.length;
      saron(MELODY[k]!);
      if (k % 2 === 1) bonang(MELODY[k]!);
      if (k === 2 || k === 6) kendang(false);
      if (step + 1 >= beats) gong();
      setStep(step + 1);
    }, BEAT);
    return () => clearTimeout(t);
  }, [step, beats, done]);

  // each puppet dances its own figure: arms, elbows and head on the beat
  const posed: Slot[] = props.slots.map((s, n) =>
    s && !done
      ? {
          ...s,
          arm: (s.arm + Math.floor((step + n) / 2)) % 3,
          elbow: (s.elbow + step + n) % 3,
          back: (s.back + Math.floor((step + n + 1) / 2)) % 3,
          head: [s.head, 1, s.head, 2][(step + n) % 4]!,
        }
      : s
  );
  const shapes = shapesOf(props.offered, posed, props.lamps);
  const chapter = chapters[Math.min(chapters.length - 1, Math.floor(step / 4))];

  return (
    <div className="reveal finale" role="dialog" aria-label="The week's finale">
      <div className="finale-stage">
        <Kelir
          shadow={shapes}
          target={null}
          selected={null}
          glow={done ? 1 : 0.4}
          lamps={props.lamps}
          label="The puppets perform the week's story"
        />
      </div>
      <div className="reveal-caption finale-caption">
        <p className="eyebrow">{props.lakon} · the finale</p>
        <h2 className="display">{done ? 'Tancep kayon' : chapter?.title}</h2>
        <p>
          {done
            ? 'The dalang plants the gunungan in the banana trunk: the story is over until next week.'
            : `Chapter ${Math.floor(step / 4) + 1} of ${chapters.length}`}
        </p>
        <button className="btn" onClick={props.onDone}>
          {done ? 'Close' : 'Skip'}
        </button>
      </div>
    </div>
  );
};
