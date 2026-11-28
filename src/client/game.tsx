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
import { MAX_OIL, rankFor } from '../shared/api.ts';
import { shareText } from '../shared/share.ts';
import { SETS, figure } from '../shared/figures.ts';
import { PUSAKA, pusaka } from '../shared/pusaka.ts';
import { decodeMask, equal, matchRatio } from '../shared/grid.ts';
import {
  LEVELS,
  WEEKDAYS,
  shadowOf,
  shapesOf,
  type PuzzlePublic,
  type Slot,
} from '../shared/puzzle.ts';
import {
  DEFAULT_POSE,
  placedByLamp,
  puppetMask,
  type Pose,
} from '../shared/shadow.ts';
import { api } from './api.ts';
import { isMuted, setMuted, solvedPhrase, tick, wrongPhrase } from './audio.ts';
import { Kelir } from './board.tsx';
import { Book, PusakaView } from './book.tsx';
import { Builder } from './builder.tsx';
import { Finale } from './finale.tsx';
import { Reveal } from './reveal.tsx';
import {
  applyTool,
  closeness,
  showsMeter,
  showsOverflow,
  toolsFor,
  type Side,
  type Tool,
} from './stage.ts';
import {
  Icon,
  KAWUNG,
  Modal,
  PuppetArt,
  PusakaArt,
  type IconName,
} from './ui.tsx';

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
      'twolamps',
      'Two lamps tonight: every puppet casts two shadows. The closer it stands to the lamps, the further apart they fall. Where both shadows meet, the screen is darkest.',
      puzzle.lamps === 2,
    ],
    [
      'nometer',
      'From Thursday there is no match meter. The outline lights up only when the shadow is exact.',
      !showsMeter(puzzle.weekday),
    ],
    [
      'nooverflow',
      'At the weekend the screen no longer marks shadow that spills outside the outline in red.',
      !showsOverflow(puzzle.weekday),
    ],
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
      `Par is ${puzzle.par}, the fewest taps for this scene. Match it at par without hints and the pusaka is gold.`,
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
  /** which arm Shoulder and Elbow work */
  const [side, setSide] = useState<Side>('front');
  /** earlier scenes, for Undo */
  const [history, setHistory] = useState<Slot[][]>([]);
  const [moves, setMoves] = useState(0);
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [glow, setGlow] = useState(0);
  /** solved, now showing the dalang's side before the result */
  const [reveal, setReveal] = useState<SolveResponse | null>(null);
  const [replay, setReplay] = useState(false);
  const [make, setMake] = useState(false);
  /** how close each move came, for the share card */
  const trail = useRef<number[]>([]);
  const [sentTrail, setSentTrail] = useState<number[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [album, setAlbum] = useState(false);
  /** a pusaka opened from the book or the result */
  const [card, setCard] = useState<string | null>(null);
  /** a wayang opened from the book */
  const [wayang, setWayang] = useState<string | null>(null);
  const [book, setBook] = useState<{
    met: Record<string, true>;
    read: string[];
  }>({
    met: {},
    read: [],
  });
  const [finale, setFinale] = useState(false);
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
        setBook({ met: d.profile.met ?? {}, read: d.profile.read ?? [] });
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
            tale: d.tale,
            met: d.profile.met ?? {},
            read: d.profile.read ?? [],
            oil: d.profile.oil,
            oilUsed: 0,
            board: d.board,
            myRank: d.myRank,
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
    () => (puzzle ? shadowOf(puzzle.offered, slots, puzzle.lamps) : null),
    [puzzle, slots]
  );
  const shapes = useMemo(
    () => (puzzle ? shapesOf(puzzle.offered, slots, puzzle.lamps) : []),
    [puzzle, slots]
  );
  const solvedNow = !!(shadow && target && equal(shadow, target));
  const match = shadow && target ? matchRatio(shadow, target) : 0;

  // solved: glow, gamelan, tell the server
  useEffect(() => {
    if (!solvedNow || !puzzle || result || reveal || sending.current) return;
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
      .solve({ puzzleId: puzzle.id, slots, moves, trail: trail.current })
      .then((r) => {
        if (!r.ok) {
          wrongPhrase();
          say(r.message ?? 'Not quite');
          return;
        }
        setCards(r.cards);
        setBook({ met: r.met, read: r.read });
        setSentTrail([...trail.current]);
        setTimeout(() => {
          if (mode === 'warmup') markSeen('warmup');
          setReveal(r);
        }, 1100);
      })
      .catch(() => say('Could not reach Reddit. Your shadow is still here.'))
      .finally(() => {
        sending.current = false;
      });
    return () => cancelAnimationFrame(raf);
  }, [solvedNow, puzzle, result, reveal, slots, moves, mode, say]);

  const act = (fn: (s: Slot[]) => Slot[] | null) => {
    if (result || solvedNow) return;
    const next = fn(slots);
    if (!next) return;
    if (puzzle && target)
      trail.current.push(
        closeness(
          matchRatio(shadowOf(puzzle.offered, next, puzzle.lamps), target)
        )
      );
    tick();
    setHistory((h) => [...h.slice(-60), slots]);
    setSlots(next);
    setMoves((m) => m + 1);
    setTip(null);
  };

  /** step back one move; it still counts as a move */
  const undo = () => {
    if (result || solvedNow || !puzzle || !target) return;
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    trail.current.push(
      closeness(
        matchRatio(shadowOf(puzzle.offered, prev, puzzle.lamps), target)
      )
    );
    tick();
    setSlots(prev);
    setMoves((m) => m + 1);
  };

  const runTool = (t: Tool) =>
    act((s) => {
      if (sel === null || !s[sel]) return null;
      const p = applyTool(s[sel]!, t, side);
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
    setHistory((h) => [...h, slots]);
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
    trail.current = [];
    setHistory([]);
    setSide('front');
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
      mask: puppetMask(puzzle.offered[p.index]!, p.slot, puzzle.lamps),
    }));
  const selShape =
    sel !== null && selSlot
      ? placedByLamp(figure(puzzle.offered[sel]!), selSlot, puzzle.lamps)
      : null;
  const coach =
    mode === 'warmup' ? warmupCoach(sel, slots[0] ?? null, solvedNow) : tip;
  const disabled = sel === null || !selSlot || solvedNow || !!result;
  const owned = Object.keys(cards).length;
  const meter = mode === 'warmup' || showsMeter(puzzle.weekday);

  return (
    <div className="screen" style={{ backgroundImage: KAWUNG }}>
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={() => setAlbum(true)}
          aria-label="Your book, Serat Dalang"
        >
          <Icon name="book" />
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
        overflow={mode === 'warmup' || showsOverflow(puzzle.weekday)}
        lamps={puzzle.lamps}
        pickable={pickable}
        onPick={(k) => setSel(k)}
        label={
          meter
            ? `Shadow screen, ${Math.round(match * 100)} percent match`
            : 'Shadow screen'
        }
      />

      {meter ? (
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
      ) : (
        <div className="status">
          <span className="no-meter">
            {LEVELS[puzzle.weekday]} · no meter
            {showsOverflow(puzzle.weekday) ? '' : ', no red'}
          </span>
          <span className={`pct ${solvedNow ? 'done' : ''}`}>
            {solvedNow ? '100% match' : '?'}
          </span>
        </div>
      )}

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
          {toolsFor(mode === 'warmup' ? 0 : puzzle.joints).map((t) => (
            <button
              key={t.tool}
              onClick={() => runTool(t.tool)}
              disabled={disabled}
            >
              <Icon name={t.icon as IconName} />
              <span>
                {(t.tool === 'shoulder' || t.tool === 'elbow') &&
                puzzle.joints >= 2 &&
                mode !== 'warmup'
                  ? `${side === 'front' ? 'Front' : 'Back'} ${t.label.toLowerCase()}`
                  : t.label}
              </span>
            </button>
          ))}
          {mode !== 'warmup' && puzzle.joints >= 2 && (
            <button
              className={`side-switch ${side}`}
              onClick={() => setSide(side === 'front' ? 'back' : 'front')}
              disabled={disabled}
              aria-pressed={side === 'back'}
              aria-label={`Working the ${side} arm. Switch arm`}
            >
              <Icon name="swap" />
              <span>{side === 'front' ? 'Front arm' : 'Back arm'}</span>
            </button>
          )}
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
        <button
          className="chip reset"
          onClick={undo}
          aria-label="Undo the last move"
          disabled={history.length === 0 || !!result || solvedNow}
        >
          <Icon name="undo" />
          <span>Undo</span>
        </button>
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
                A hint costs you the gold pusaka, never the solve.
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

      {(reveal ?? replay) && (
        <Reveal
          offered={puzzle.offered}
          slots={slots}
          lamps={puzzle.lamps}
          onDone={() => {
            if (reveal) setResult(reveal);
            setReveal(null);
            setReplay(false);
          }}
        />
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

      {result && !replay && mode === 'daily' && (
        <ResultCard
          data={data}
          puzzle={puzzle}
          result={result}
          onShare={() => void share()}
          onAlbum={() => setAlbum(true)}
          onClose={() => setResult(null)}
          onCard={setCard}
          onBehind={() => setReplay(true)}
          hints={hints.length}
          trail={sentTrail}
          canMake={!!data.username && Object.keys(book.met).length >= 2}
          onFinale={
            puzzle.weekday === 6 && !data.author ? () => setFinale(true) : null
          }
          onMake={() => setMake(true)}
          onCopy={(text) => {
            void navigator.clipboard
              ?.writeText(text)
              .then(() => say('Result copied'))
              .catch(() => say('Copy blocked by the browser'));
          }}
        />
      )}

      {make && (
        <Builder met={book.met} onClose={() => setMake(false)} say={say} />
      )}

      {album && (
        <Book
          cards={cards}
          met={book.met}
          read={book.read}
          onClose={() => setAlbum(false)}
          onPusaka={setCard}
          onWayang={setWayang}
          onMake={
            data.username && Object.keys(book.met).length >= 2
              ? () => {
                  setAlbum(false);
                  setMake(true);
                }
              : null
          }
        />
      )}
      {card && (
        <PusakaView
          id={card}
          grade={cards[card]}
          onClose={() => setCard(null)}
        />
      )}
      {wayang && <CardView id={wayang} onClose={() => setWayang(null)} />}
      {finale && result && (
        <Finale
          offered={puzzle.offered}
          slots={slots}
          lamps={puzzle.lamps}
          lakon={puzzle.lakon}
          onDone={() => setFinale(false)}
        />
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
  onBehind: () => void;
  hints: number;
  trail: number[];
  canMake: boolean;
  onMake: () => void;
  onCopy: (text: string) => void;
  onFinale: (() => void) | null;
}) => {
  const { data, puzzle, result } = props;
  const copyText = shareText(
    puzzle,
    data.day,
    {
      moves: result.moves,
      par: result.par,
      gold: result.gold,
      slots: [],
      trail: data.solved?.trail ?? props.trail,
      hints: data.solved?.hints ?? props.hints,
    },
    result.streak
  ).replace(/\*\*/g, '');
  const pct =
    result.players > 0
      ? Math.round((result.solvers / result.players) * 100)
      : 100;
  const earned = result.sceneCards.filter((id) => result.cards[id]);
  return (
    <Modal onClose={props.onClose} className="result">
      <p className="eyebrow">
        {data.author
          ? `Player shadow by u/${data.author}`
          : `${data.dateLabel} · ${puzzle.lakon}`}
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
              <PusakaArt
                id={id}
                grade={result.cards[id]}
                className="mini-art"
              />
              <span>{pusaka(id).name}</span>
            </button>
          ))}
        </div>
      )}
      {result.tale && (
        <div className="tale">
          <p className="eyebrow">The story so far</p>
          <p>{result.tale}</p>
        </div>
      )}
      {result.board.length > 0 && (
        <ol className="board" aria-label="Today's best dalang">
          {result.board.map((r, n) => (
            <li key={r.name} className={r.name === data.username ? 'me' : ''}>
              <span className="place">{n + 1}</span>
              <span className="who">u/{r.name}</span>
              <span className="mv">
                {r.moves}
                {r.gold ? ' ★' : ''}
              </span>
            </li>
          ))}
          {result.myRank !== null && result.myRank > result.board.length && (
            <li className="me">
              <span className="place">{result.myRank}</span>
              <span className="who">you</span>
              <span className="mv">{result.moves}</span>
            </li>
          )}
        </ol>
      )}
      <p className="oil" aria-label={`Lamp oil ${result.oil} of ${MAX_OIL}`}>
        <span className="oil-drops">
          {Array.from({ length: MAX_OIL }, (_, n) => (
            <span key={n} className={n < result.oil ? 'full' : ''} />
          ))}
        </span>
        {result.oilUsed > 0
          ? `Your lamp burned ${result.oilUsed} oil through the nights you missed. Streak kept.`
          : 'Lamp oil: each gold solve adds one. It keeps your streak if you miss a day.'}
      </p>
      {!data.author && (
        <div className="tomorrow">
          <PuppetArt
            id={data.tomorrow.figure}
            style="locked"
            className="tomorrow-art"
          />
          <div>
            <p className="eyebrow">Tomorrow · {data.tomorrow.level}</p>
            <p>
              Who steps onto the screen next? New shadow at 07:00 WIB (00:00
              UTC).
            </p>
          </div>
        </div>
      )}
      <p className="muted small">
        {result.rank}
        {result.gold ? '' : ' · match at par with no hints for gold'}
      </p>
      <div className="row">
        <button className="btn" onClick={props.onShare}>
          Comment
        </button>
        <button className="btn ghost" onClick={() => props.onCopy(copyText)}>
          Copy
        </button>
        <button className="btn ghost" onClick={props.onAlbum}>
          Book
        </button>
      </div>
      {props.onFinale && (
        <button className="btn wide" onClick={props.onFinale}>
          Watch the week's finale
        </button>
      )}
      {props.canMake && (
        <button className="btn ghost wide" onClick={props.onMake}>
          Make a shadow for others
        </button>
      )}
      <button className="link-btn behind" onClick={props.onBehind}>
        See the dalang's side
      </button>
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

const CardView = (props: { id: string; onClose: () => void }) => {
  const f = figure(props.id);
  const owned = PUSAKA.filter((q) => q.owner === f.id);
  return (
    <Modal onClose={props.onClose} className="card-view">
      <PuppetArt id={f.id} arm={2} className="card-art" />
      <p className="eyebrow">
        {SETS.find((s) => s.id === f.set)?.name} · {f.role}
      </p>
      <h2 className="display">{f.name}</h2>
      <p>{f.story}</p>
      {owned.length > 0 && (
        <p className="muted small">
          Carries: {owned.map((q) => q.name).join(', ')}
        </p>
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
