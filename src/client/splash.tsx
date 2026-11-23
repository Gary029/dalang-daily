import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { TodayResponse } from '../shared/api.ts';
import { LEVELS, shapesOf } from '../shared/puzzle.ts';
import { api } from './api.ts';
import { Kelir } from './board.tsx';
import { KAWUNG } from './ui.tsx';

const LOCAL = import.meta.env.VITE_LOCAL === '1';

/** The card in the feed: name, date, today's outline, stats, Play. */
const Splash = () => {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api
      .today(true)
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  const shadow = useMemo(
    () =>
      data?.solved ? shapesOf(data.puzzle.offered, data.solved.slots) : [],
    [data]
  );

  const play = (e: MouseEvent) => {
    if (LOCAL) {
      location.href = `game.html${location.search}`;
      return;
    }
    requestExpandedMode(e.nativeEvent, 'game');
  };

  const p = data?.puzzle;
  const solved = data?.solved;
  return (
    <div className="splash" style={{ backgroundImage: KAWUNG }}>
      <div className="splash-head">
        <h1 className="brand big">Dalang</h1>
        <p className="tagline">One shadow a day. One right answer.</p>
      </div>
      {p ? (
        <>
          <p className="eyebrow">
            {data.dateLabel} · {LEVELS[p.weekday]} · {p.lakon}
          </p>
          <div className="splash-kelir">
            <Kelir
              shadow={shadow}
              target={p.targetShapes}
              selected={null}
              glow={solved ? 1 : 0}
              label={`Today's outline: ${p.title}`}
            />
          </div>
          <h2 className="scene-title">{p.title}</h2>
          <p className="splash-stats">
            Par {p.par} · {p.offered.length} puppets in the chest ·{' '}
            {data.solvers} solved
            {data.profile.streak > 0
              ? ` · your streak ${data.profile.streak}`
              : ''}
          </p>
          <button className="btn play" onClick={play}>
            {solved
              ? `Solved in ${solved.moves} · see result`
              : data.profile.warmupDone
                ? "Play today's shadow"
                : 'Play · 30-second warm-up first'}
          </button>
        </>
      ) : (
        <div className="splash-kelir">
          {failed ? (
            <p className="lead">Could not light the lamp. Pull to refresh.</p>
          ) : (
            <div className="loading-lamp" />
          )}
        </div>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
