import { navigateTo } from '@devvit/web/client';
import { useMemo, useState } from 'react';
import { FIGURES, figure } from '../shared/figures.ts';
import { LEVELS, shapesOf, type Slot } from '../shared/puzzle.ts';
import {
  DEFAULT_POSE,
  placedPolys,
  puppetMask,
  type Pose,
} from '../shared/shadow.ts';
import {
  MAX_CAST,
  MAX_OFFERED,
  checkShadow,
  type CreateCheck,
} from '../shared/ugc.ts';
import { api } from './api.ts';
import { Kelir } from './board.tsx';
import { applyTool, toolsFor, type Side, type Tool } from './stage.ts';
import { Icon, KAWUNG, PuppetArt, type IconName } from './ui.tsx';

/**
 * Make a shadow for other players: pick wayang you have met, pose some of
 * them, keep at least one as a decoy, and Semar (the solver) checks there is
 * exactly one answer before it can be posted.
 */
export const Builder = (props: {
  /** wayang met in solved scenes: the builder's chest */
  met: Record<string, true>;
  onClose: () => void;
  say: (text: string) => void;
}) => {
  const owned = FIGURES.filter((f) => props.met[f.id]).map((f) => f.id);
  const [chest, setChest] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [side, setSide] = useState<Side>('front');
  const [title, setTitle] = useState('');
  const [check, setCheck] = useState<CreateCheck | 'checking' | null>(null);
  const [posting, setPosting] = useState(false);

  const shapes = useMemo(() => shapesOf(chest, slots), [chest, slots]);
  const changed = () => setCheck(null);

  const toggle = (id: string) => {
    changed();
    const k = chest.indexOf(id);
    if (k >= 0) {
      setChest(chest.filter((_, n) => n !== k));
      setSlots(slots.filter((_, n) => n !== k));
      setSel(null);
    } else if (chest.length < MAX_OFFERED) {
      setChest([...chest, id]);
      setSlots([...slots, null]);
    } else props.say(`Up to ${MAX_OFFERED} puppets in the chest.`);
  };

  const tapChip = (k: number) => {
    setSel(k);
    if (!slots[k]) {
      if (slots.filter(Boolean).length >= MAX_CAST) {
        props.say(
          `Up to ${MAX_CAST} puppets on the screen; the rest are decoys.`
        );
        return;
      }
      changed();
      setSlots(slots.map((s, n) => (n === k ? { ...DEFAULT_POSE } : s)));
    }
  };

  const run = (t: Tool) => {
    if (sel === null || !slots[sel]) return;
    const p = applyTool(slots[sel]!, t, side);
    if (!p) return;
    changed();
    setSlots(slots.map((s, n) => (n === sel ? p : s)));
  };

  const toChest = () => {
    if (sel === null) return;
    changed();
    setSlots(slots.map((s, n) => (n === sel ? null : s)));
  };

  const req = { title, offered: chest, slots };
  const runCheck = () => {
    setCheck('checking');
    // let the "checking" line paint before the solver runs
    setTimeout(() => setCheck(checkShadow(req, owned)), 30);
  };

  const postIt = async () => {
    setPosting(true);
    try {
      const r = await api.create(req);
      props.say(r.message);
      if (r.ok && r.url) {
        if (import.meta.env.VITE_LOCAL === '1') window.location.assign(r.url);
        else navigateTo(r.url);
      }
    } catch {
      props.say('Could not post your shadow.');
    } finally {
      setPosting(false);
    }
  };

  const selSlot = sel !== null ? (slots[sel] ?? null) : null;
  const pickable = chest
    .map((id, index) => ({ id, index, slot: slots[index] }))
    .filter((p): p is { id: string; index: number; slot: Pose } => !!p.slot)
    .map((p) => ({ index: p.index, mask: puppetMask(p.id, p.slot) }));
  const selShape =
    sel !== null && selSlot ? placedPolys(figure(chest[sel]!), selSlot) : null;

  return (
    <div className="album builder" style={{ backgroundImage: KAWUNG }}>
      <header className="topbar">
        <button className="icon-btn" onClick={props.onClose} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="title-block">
          <div className="brand">Make a shadow</div>
          <div className="sub">
            Posted for everyone · the best of the week plays on Sunday
          </div>
        </div>
      </header>

      <p className="coach">
        {chest.length === 0
          ? `Pick 2 to ${MAX_OFFERED} wayang you have met for the chest.`
          : slots.every((s) => !s)
            ? 'Tap a puppet below to stand it on the screen.'
            : 'Pose them. Leave at least one in the chest as a decoy.'}
      </p>

      <div className="builder-pick" aria-label="Your album">
        {owned.map((id) => (
          <button
            key={id}
            className={`chip small ${chest.includes(id) ? 'sel' : ''}`}
            onClick={() => toggle(id)}
            aria-pressed={chest.includes(id)}
          >
            <PuppetArt id={id} className="chip-art" />
            <span>{figure(id).name}</span>
          </button>
        ))}
      </div>

      <Kelir
        shadow={shapes}
        target={null}
        selected={selShape}
        pickable={pickable}
        onPick={(k) => setSel(k)}
        label="Your shadow"
      />

      <div className="controls">
        <div className="sel-line">
          {sel !== null && chest[sel] ? (
            <>
              <strong>{figure(chest[sel]!).name}</strong>
              {selSlot ? (
                <button className="link-btn" onClick={toChest}>
                  <Icon name="chest" size={16} /> Back to chest (decoy)
                </button>
              ) : (
                <span className="muted">decoy, in the chest</span>
              )}
            </>
          ) : (
            <span className="muted">Tap a puppet to hold it</span>
          )}
        </div>
        <div className="pad">
          <button
            className={`side-switch ${side}`}
            onClick={() => setSide(side === 'front' ? 'back' : 'front')}
            disabled={!selSlot}
            aria-pressed={side === 'back'}
          >
            <Icon name="swap" />
            <span>{side === 'front' ? 'Front arm' : 'Back arm'}</span>
          </button>
          {toolsFor(3).map(({ tool, label, icon }) => (
            <button key={tool} onClick={() => run(tool)} disabled={!selSlot}>
              <Icon name={icon as IconName} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="chest">
        {chest.map((id, k) => (
          <button
            key={id}
            className={`chip ${sel === k ? 'sel' : ''} ${slots[k] ? 'on' : ''}`}
            onClick={() => tapChip(k)}
          >
            <PuppetArt id={id} className="chip-art" arm={slots[k]?.arm ?? 0} />
            <span>{figure(id).name}</span>
          </button>
        ))}
      </div>

      <div className="builder-post">
        <input
          className="title-input"
          value={title}
          maxLength={60}
          placeholder="Name your scene, e.g. Semar teases Bagong"
          onChange={(e) => {
            setTitle(e.target.value);
            changed();
          }}
        />
        {check === 'checking' ? (
          <p className="muted">Semar is trying every pose…</p>
        ) : check && !check.ok ? (
          <p className="warn-text">{check.message}</p>
        ) : check && check.ok ? (
          <p>
            One answer only. Par {check.par} · {LEVELS[check.level]}.
          </p>
        ) : null}
        <div className="row">
          {check && check !== 'checking' && check.ok ? (
            <button
              className="btn"
              onClick={() => void postIt()}
              disabled={posting}
            >
              {posting ? 'Posting…' : 'Post it to the subreddit'}
            </button>
          ) : (
            <button
              className="btn"
              onClick={runCheck}
              disabled={chest.length < 2 || check === 'checking'}
            >
              Check with Semar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
