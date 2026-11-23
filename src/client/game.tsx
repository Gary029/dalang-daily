import './index.css';

import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { CardGrade, SolveResponse, TodayResponse } from '../shared/api.ts';
import { RANKS, rankFor } from '../shared/api.ts';
import { FIGURES, SETS, figure } from '../shared/figures.ts';
import { decodeMask, equal, matchRatio } from '../shared/grid.ts';
import {
  WEEKDAYS,
  shadowOf,
  shapesOf,
  type PuzzlePublic,
  type Slot,
} from '../shared/puzzle.ts';
import {
  ANGLES,
  ARMS,
  DEFAULT_POSE,
  DEPTHS,
  SLOTS,
  placedPolys,
  puppetMask,
  type Pose,
} from '../shared/shadow.ts';
import { api } from './api.ts';
import { isMuted, setMuted, solvedPhrase, tick, wrongPhrase } from './audio.ts';
import { Kelir } from './board.tsx';
import { Icon, KAWUNG, Modal, PuppetArt } from './ui.tsx';

type Tool =
  'left' | 'right' | 'far' | 'near' | 'tiltL' | 'tiltR' | 'arm' | 'flip';

const applyTool = (p: Pose, t: Tool): Pose | null => {
  switch (t) {
    case 'left':
      return p.x > 0 ? { ...p, x: p.x - 1 } : null;
    case 'right':
      return p.x < SLOTS - 1 ? { ...p, x: p.x + 1 } : null;
    case 'far':
      return p.d > 0 ? { ...p, d: p.d - 1 } : null;
    case 'near':
      return p.d < DEPTHS - 1 ? { ...p, d: p.d + 1 } : null;
    case 'tiltL':
      return { ...p, a: (p.a + 1) % ANGLES };
    case 'tiltR':
      return { ...p, a: (p.a + ANGLES - 1) % ANGLES };
    case 'arm':
      return { ...p, arm: (p.arm + 1) % ARMS };
    case 'flip':
      return { ...p, flip: !p.flip };
  }
};

// --- Semar's tips: shown once each, when the tool first matters ---------------

const seen = (key: string): boolean => {
  try {
    return localStorage.getItem(`dalang-tip-${key}`) === '1';
  } catch {
    return false;
  }
};
const markSeen = (key: string) => {
  try {
    localStorage.setItem(`dalang-tip-${key}`, '1');
  } catch {
    /* blocked */
  }
};

const warmupCoach = (
  sel: number | null,
  slot: Slot,
  solved: boolean
): string => {
  if (solved) return 'That is the shadow. Every puzzle works like this.';
  if (sel === null) return 'Tap Semar, on the screen or in the chest below.';
  if (!slot) return 'Tap his card to stand him back on the screen.';
  if (slot.d < 3) return 'Closer to the lamp, bigger shadow. Tap Closer.';
  if (slot.d > 3) return 'Too big now. Tap Farther once.';
  if (slot.arm !== 2) return 'Now his arm: tap Arm until it points up.';
  if (slot.a !== 0 || slot.flip || slot.x !== 3)
    return 'Stand him upright in the middle, facing right.';
  return 'Nearly there.';
};

/** the first daily tip this player has not seen yet */
const firstTip = (puzzle: PuzzlePublic): string | null => {
  const tips: [string, string, boolean][] = [
    [
      'decoy',
      'Not every puppet in the chest belongs in the scene. Send decoys back.',
      puzzle.offered.length > 1,
    ],
    [
      'holes',
      'Light shines through the carved holes. The target shows whose holes they are.',
      true,
    ],
    [
      'par',
      `Par is the fewest taps that solve it: ${puzzle.par}. Match at par with no hints for a gold card.`,
      true,
    ],
    [
      'fresh',
      'A puppet put back on the screen from the chest always starts upright in the middle. Sometimes that is the short way.',
      true,
    ],
  ];
  const next = tips.find(([k, , on]) => on && !seen(k));
  if (!next) return null;
  markSeen(next[0]);
  return next[1];
};

type Toast = { text: string; id: number };

const App = () => {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'warmup' | 'daily'>('daily');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [glow, setGlow] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [album, setAlbum] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const [muted, setMute] = useState(isMuted());
  const [toast, setToast] = useState<Toast | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, CardGrade>>({});
  const sending = useRef(false);

  const say = useCallback((text: string) => {
    const id = Date.now();
    setToast({ text, id });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2600);
  }, []);

  useEffect(() => {
    api
      .today()
      .then((d) => {
        setData(d);
        setCards(d.profile.cards);
        setHints(d.hints);
        if (d.solved) {
          setMode('daily');
          setSlots(d.solved.slots);
          setMoves(d.solved.moves);
          setGlow(1);
          setResult({
            type: 'solve',
            ok: true,
            moves: d.solved.moves,
            par: d.solved.par,
            gold: d.solved.gold,
            streak: d.profile.streak,
            newCards: [],
            sceneCards: d.sceneCards,
            cards: d.profile.cards,
            players: d.players,
            solvers: d.solvers,
            rank: rankFor(Object.keys(d.profile.cards).length),
          });
        } else if (!d.profile.warmupDone && !seen('warmup')) {
          setMode('warmup');
          setSlots(d.warmup.start);
        } else {
          setSlots(d.puzzle.start);
          setTip(firstTip(d.puzzle));
        }
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      );
  }, []);

  const puzzle: PuzzlePublic | null = data
    ? mode === 'warmup'
      ? data.warmup
      : data.puzzle
    : null;
  const target = useMemo(
    () => (puzzle ? decodeMask(puzzle.target) : null),
    [puzzle]
  );
  const shadow = useMemo(
    () => (puzzle ? shadowOf(puzzle.offered, slots) : null),
    [puzzle, slots]
  );
  const shapes = useMemo(
    () => (puzzle ? shapesOf(puzzle.offered, slots) : []),
    [puzzle, slots]
  );
  const solvedNow = !!(shadow && target && equal(shadow, target));
  const match = shadow && target ? matchRatio(shadow, target) : 0;

  // solved: glow, gamelan, tell the server
  useEffect(() => {
    if (!solvedNow || !puzzle || result || sending.current) return;
    sending.current = true;
    solvedPhrase();
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 900);
      setGlow(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    api
      .solve({ puzzleId: puzzle.id, slots, moves })
      .then((r) => {
        if (!r.ok) {
          wrongPhrase();
          say(r.message ?? 'Not quite');
          return;
        }
        setCards(r.cards);
        setTimeout(() => {
          if (mode === 'warmup') markSeen('warmup');
          setResult(r);
        }, 1100);
      })
      .catch(() => say('Could not reach Reddit. Your shadow is still here.'))
      .finally(() => {
        sending.current = false;
      });
    return () => cancelAnimationFrame(raf);
  }, [solvedNow, puzzle, result, slots, moves, mode, say]);

  const act = (fn: (s: Slot[]) => Slot[] | null) => {
    if (result || solvedNow) return;
    const next = fn(slots);
    if (!next) return;
    tick();
    setSlots(next);
    setMoves((m) => m + 1);
    setTip(null);
  };

  const runTool = (t: Tool) =>
    act((s) => {
      if (sel === null || !s[sel]) return null;
      const p = applyTool(s[sel]!, t);
      if (!p) return null;
      const out = [...s];
      out[sel] = p;
      return out;
    });

  const toChest = () =>
    act((s) => {
      if (sel === null || !s[sel]) return null;
      const out = [...s];
      out[sel] = null;
      return out;
    });

  const tapChestCard = (k: number) => {
    setSel(k);
    if (!slots[k]) {
      act((s) => {
        const out = [...s];
        out[k] = { ...DEFAULT_POSE };
        return out;
      });
    }
  };

  const reset = () => {
    if (!puzzle || result) return;
    setSlots(puzzle.start);
    setSel(null);
    say('Back to the opening scene. Your move count stays.');
  };

  const askHint = async () => {
    if (mode === 'warmup') return;
    setShowHints(true);
    if (hints.length >= 3) return;
    try {
      const r = await api.hint();
      setHints(r.hints);
    } catch {
      say('Semar is quiet right now.');
    }
  };

  const share = async () => {
    try {
      const r = await api.share();
      if (!r.ok && r.text) {
        try {
          await navigator.clipboard.writeText(r.text);
        } catch {
          /* clipboard blocked */
        }
      }
      say(r.message);
    } catch {
      say('Could not post the comment.');
    }
  };

  const startDaily = () => {
    if (!data) return;
    setMode('daily');
    setResult(null);
    setGlow(0);
    setMoves(0);
    setSel(null);
    if (data.solved) {
      setSlots(data.solved.slots);
      setMoves(data.solved.moves);
      setGlow(1);
    } else {
      setSlots(data.puzzle.start);
      setTip(firstTip(data.puzzle));
    }
  };

  if (error) {
    return (
      <div className="screen center">
        <p className="lead">The lamp went out: {error}</p>
      </div>
    );
  }
  if (!data || !puzzle || !shadow || !target) {
    return (
      <div className="screen center">
        <div className="loading-lamp" />
      </div>
    );
  }

  const selSlot = sel !== null ? (slots[sel] ?? null) : null;
  const pickable = puzzle.offered
    .map((_, index) => ({ index, slot: slots[index] }))
    .filter((p): p is { index: number; slot: Pose } => !!p.slot)
    .map((p) => ({
      index: p.index,
      mask: puppetMask(puzzle.offered[p.index]!, p.slot),
    }));
  const selShape =
    sel !== null && selSlot
      ? placedPolys(figure(puzzle.offered[sel]!), selSlot)
      : null;
  const coach =
    mode === 'warmup' ? warmupCoach(sel, slots[0] ?? null, solvedNow) : tip;
  const disabled = sel === null || !selSlot || solvedNow || !!result;
  const owned = Object.keys(cards).length;

  return (
    <div className="screen" style={{ backgroundImage: KAWUNG }}>
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={() => setAlbum(true)}
          aria-label="Your wayang album"
        >
          <Icon name="album" />
          <span className="badge">{owned}</span>
        </button>
        <div className="title-block">
          <div className="brand">Dalang</div>
          <div className="sub">
            {mode === 'warmup'
              ? 'Warm-up'
              : `${data.dateLabel} · ${puzzle.title}`}
          </div>
        </div>
        <div className="moves" aria-label={`${moves} moves, par ${puzzle.par}`}>
          <span className={moves > puzzle.par ? 'over' : ''}>{moves}</span>
          <small>par {puzzle.par}</small>
        </div>
        {mode === 'daily' && (
          <button
            className="icon-btn"
            onClick={() => void askHint()}
            aria-label="Ask Semar for a hint"
          >
            <Icon name="hint" />
            {hints.length > 0 && (
              <span className="badge warn">{hints.length}</span>
            )}
          </button>
        )}
        <button
          className="icon-btn"
          onClick={() => {
            setMuted(!muted);
            setMute(!muted);
          }}
          aria-label={muted ? 'Sound on' : 'Sound off'}
        >
          <Icon name={muted ? 'mute' : 'sound'} />
        </button>
      </header>

      <Kelir
        shadow={shapes}
        target={puzzle.targetShapes}
        selected={result ? null : selShape}
        glow={glow}
        pickable={pickable}
        onPick={(k) => setSel(k)}
        label={`Shadow screen, ${Math.round(match * 100)} percent match`}
      />

      <div className="status">
        <div className="meter" aria-hidden="true">
          <div
            className="meter-fill"
            style={{ width: `${Math.round(match * 100)}%` }}
          />
        </div>
        <span className={`pct ${solvedNow ? 'done' : ''}`}>
          {solvedNow ? '100% match' : `${Math.floor(match * 100)}%`}
        </span>
      </div>

      <p className="coach" aria-live="polite">
        {coach ?? (mode === 'daily' ? puzzle.scene : '')}
      </p>

      <div className="controls" aria-label="Move the selected puppet">
        <div className="sel-line">
          {sel !== null ? (
            <>
              <strong>{figure(puzzle.offered[sel]!).name}</strong>
              {selSlot ? (
                <button
                  className="link-btn"
                  onClick={toChest}
                  disabled={disabled}
                >
                  <Icon name="chest" size={16} /> Back to chest
                </button>
              ) : (
                <span className="muted">in the chest</span>
              )}
            </>
          ) : (
            <span className="muted">Tap a shadow or a puppet to hold it</span>
          )}
        </div>
        <div className="pad">
          <button onClick={() => runTool('left')} disabled={disabled}>
            <Icon name="left" />
            <span>Left</span>
          </button>
          <button onClick={() => runTool('right')} disabled={disabled}>
            <Icon name="right" />
            <span>Right</span>
          </button>
          <button onClick={() => runTool('far')} disabled={disabled}>
            <Icon name="far" />
            <span>Farther</span>
          </button>
          <button onClick={() => runTool('near')} disabled={disabled}>
            <Icon name="near" />
            <span>Closer</span>
          </button>
          <button onClick={() => runTool('tiltL')} disabled={disabled}>
            <Icon name="tiltL" />
            <span>Tilt</span>
          </button>
          <button onClick={() => runTool('tiltR')} disabled={disabled}>
            <Icon name="tiltR" />
            <span>Tilt</span>
          </button>
          <button onClick={() => runTool('arm')} disabled={disabled}>
            <Icon name="arm" />
            <span>Arm</span>
          </button>
          <button onClick={() => runTool('flip')} disabled={disabled}>
            <Icon name="flip" />
            <span>Flip</span>
          </button>
        </div>
      </div>

      <div className="chest" aria-label="The puppet chest">
        {puzzle.offered.map((id, k) => (
          <button
            key={id}
            className={`chip ${sel === k ? 'sel' : ''} ${slots[k] ? 'on' : ''}`}
            onClick={() => tapChestCard(k)}
            aria-label={`${figure(id).name}${slots[k] ? ', on the screen' : ', in the chest'}`}
          >
            <PuppetArt id={id} className="chip-art" arm={slots[k]?.arm ?? 0} />
            <span>{figure(id).name}</span>
          </button>
        ))}
        {mode === 'daily' && (
          <button
            className="chip reset"
            onClick={reset}
            aria-label="Reset the scene"
          >
            <Icon name="reset" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {showHints && (
        <Modal onClose={() => setShowHints(false)}>
          <div className="semar-head">
            <PuppetArt id="semar" className="semar-art" />
            <div>
              <h2>Semar says</h2>
              <p className="muted">
                Each hint costs the gold card, not the solve.
              </p>
            </div>
          </div>
          <ol className="hints">
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
          <div className="row">
            {hints.length < 3 && (
              <button className="btn ghost" onClick={() => void askHint()}>
                Another hint
              </button>
            )}
            <button className="btn" onClick={() => setShowHints(false)}>
              Back to the screen
            </button>
          </div>
        </Modal>
      )}

      {result && mode === 'warmup' && (
        <Modal>
          <h2 className="display">Well cast.</h2>
          <p>
            You are the dalang now. Today's scene is{' '}
            <strong>{data.puzzle.title}</strong>:{' '}
            {WEEKDAYS[data.puzzle.weekday]}'s puzzle, par {data.puzzle.par}.
            Some puppets in the chest will not belong.
          </p>
          <div className="row">
            <button className="btn" onClick={startDaily}>
              Play today's shadow
            </button>
          </div>
        </Modal>
      )}

      {result && mode === 'daily' && (
        <ResultCard
          data={data}
          puzzle={puzzle}
          result={result}
          onShare={() => void share()}
          onAlbum={() => setAlbum(true)}
          onClose={() => setResult(null)}
          onCard={setCard}
        />
      )}

      {album && (
        <Album cards={cards} onClose={() => setAlbum(false)} onCard={setCard} />
      )}
      {card && (
        <CardView id={card} grade={cards[card]} onClose={() => setCard(null)} />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
};

const ResultCard = (props: {
  data: TodayResponse;
  puzzle: PuzzlePublic;
  result: SolveResponse;
  onShare: () => void;
  onAlbum: () => void;
  onClose: () => void;
  onCard: (id: string) => void;
}) => {
  const { data, puzzle, result } = props;
  const pct =
    result.players > 0
      ? Math.round((result.solvers / result.players) * 100)
      : 100;
  const earned = result.sceneCards.filter((id) => result.cards[id]);
  return (
    <Modal onClose={props.onClose} className="result">
      <p className="eyebrow">
        {data.dateLabel} · {puzzle.lakon}
      </p>
      <h2 className="display">
        {result.gold ? 'Gold at par' : 'The shadow is true'}
      </h2>
      <div className="stats">
        <div>
          <b>100%</b>
          <span>match</span>
        </div>
        <div>
          <b className={result.moves <= result.par ? 'good' : ''}>
            {result.moves}
          </b>
          <span>moves, par {result.par}</span>
        </div>
        <div>
          <b>{result.streak}</b>
          <span>day streak</span>
        </div>
        <div>
          <b>{pct}%</b>
          <span>solved today</span>
        </div>
      </div>
      {earned.length > 0 && (
        <div className="earned">
          {earned.map((id) => (
            <button
              key={id}
              className={`mini-card ${result.cards[id] === 'gold' ? 'gold' : ''}`}
              onClick={() => props.onCard(id)}
            >
              <PuppetArt
                id={id}
                style={result.cards[id] === 'gold' ? 'gold' : 'painted'}
                className="mini-art"
              />
              <span>{figure(id).name}</span>
            </button>
          ))}
        </div>
      )}
      <p className="muted small">
        {result.rank} · next shadow at 07:00 WIB (00:00 UTC).{' '}
        {result.gold ? '' : 'Match at par with no hints for gold.'}
      </p>
      <div className="row">
        <button className="btn" onClick={props.onShare}>
          Share in the comments
        </button>
        <button className="btn ghost" onClick={props.onAlbum}>
          Album
        </button>
      </div>
      <button
        className="close-x"
        onClick={props.onClose}
        aria-label="Close and look at the screen"
      >
        <Icon name="close" />
      </button>
    </Modal>
  );
};

const Album = (props: {
  cards: Record<string, CardGrade>;
  onClose: () => void;
  onCard: (id: string) => void;
}) => {
  const owned = Object.keys(props.cards).length;
  const rank = rankFor(owned);
  const next = RANKS.find((r) => r.min > owned);
  return (
    <div className="album" style={{ backgroundImage: KAWUNG }}>
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={props.onClose}
          aria-label="Back to the screen"
        >
          <Icon name="back" />
        </button>
        <div className="title-block">
          <div className="brand">Your wayang</div>
          <div className="sub">
            {rank} · {owned} of {FIGURES.length}
            {next ? ` · ${next.name} at ${next.min}` : ''}
          </div>
        </div>
      </header>
      <div className="sets">
        {SETS.map((s) => {
          const members = FIGURES.filter((f) => f.set === s.id);
          const done = members.every((f) => props.cards[f.id]);
          return (
            <section key={s.id} className="set">
              <h3>
                {s.name} <span className="muted">{s.blurb}</span>
                {done && (
                  <span
                    className="gunungan"
                    title="Set complete: the gunungan is yours"
                  >
                    Gunungan
                  </span>
                )}
              </h3>
              <div className="cards">
                {members.map((f) => {
                  const g = props.cards[f.id];
                  return (
                    <button
                      key={f.id}
                      className={`mini-card ${g === 'gold' ? 'gold' : ''} ${g ? '' : 'locked'}`}
                      onClick={() => g && props.onCard(f.id)}
                      aria-label={g ? f.name : 'Not yet found'}
                    >
                      <PuppetArt
                        id={f.id}
                        style={g === 'gold' ? 'gold' : g ? 'painted' : 'locked'}
                        className="mini-art"
                      />
                      <span>{g ? f.name : '?'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

const CardView = (props: {
  id: string;
  grade: CardGrade | undefined;
  onClose: () => void;
}) => {
  const f = figure(props.id);
  return (
    <Modal
      onClose={props.onClose}
      className={`card-view ${props.grade === 'gold' ? 'gold' : ''}`}
    >
      <PuppetArt
        id={f.id}
        style={props.grade === 'gold' ? 'gold' : 'painted'}
        arm={2}
        className="card-art"
      />
      <p className="eyebrow">
        {SETS.find((s) => s.id === f.set)?.name} · {f.role}
      </p>
      <h2 className="display">{f.name}</h2>
      <p>{f.story}</p>
      {props.grade === 'gold' && (
        <p className="muted small">Gold prada: solved at par with no hints.</p>
      )}
      <button className="btn" onClick={props.onClose}>
        Close
      </button>
    </Modal>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
