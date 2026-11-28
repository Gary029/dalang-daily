import { useState } from 'react';
import type { CardGrade } from '../shared/api.ts';
import { RANKS, rankFor } from '../shared/api.ts';
import { FIGURES, SETS, figure } from '../shared/figures.ts';
import { PUSAKA, pusaka } from '../shared/pusaka.ts';
import tales from '../shared/tales.json';
import { Icon, KAWUNG, PuppetArt, PusakaArt } from './ui.tsx';

/**
 * Serat Dalang: the player's book. Pusaka found (silhouettes until then),
 * the wayang met, and the story chapters unlocked, readable in order.
 */

type Tale = {
  id: string;
  lakon: string;
  title: string;
  weekday: number;
  tale: string;
  pusaka: string;
};
const TALES = tales as Tale[];
const LAKONS = [
  ...new Set(TALES.filter((t) => t.id !== 'warmup').map((t) => t.lakon)),
];

type Tab = 'pusaka' | 'wayang' | 'lakon';

export const Book = (props: {
  cards: Record<string, CardGrade>;
  met: Record<string, true>;
  read: string[];
  onClose: () => void;
  onPusaka: (id: string) => void;
  onWayang: (id: string) => void;
  onMake: (() => void) | null;
}) => {
  const [tab, setTab] = useState<Tab>('pusaka');
  const owned = Object.keys(props.cards).length;
  const next = RANKS.find((r) => r.min > owned);
  const metCount = FIGURES.filter((f) => props.met[f.id]).length;
  const lakonDone = (l: string) =>
    TALES.filter((t) => t.lakon === l).every((t) => props.cards[t.pusaka]);

  return (
    <div className="album book" style={{ backgroundImage: KAWUNG }}>
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={props.onClose}
          aria-label="Close the book"
        >
          <Icon name="back" />
        </button>
        <div className="title-block">
          <div className="brand">Serat Dalang</div>
          <div className="sub">
            {rankFor(owned)} · {owned} of {PUSAKA.length} pusaka
            {next ? ` · ${next.name} at ${next.min}` : ''}
          </div>
        </div>
      </header>

      <div className="book-tabs" role="tablist">
        {(
          [
            ['pusaka', `Pusaka ${owned}/${PUSAKA.length}`],
            ['wayang', `Wayang ${metCount}/${FIGURES.length}`],
            [
              'lakon',
              `Lakon ${props.read.filter((id) => id !== 'warmup').length}/${TALES.length - 1}`,
            ],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'on' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {props.onMake && (
        <button className="btn ghost wide album-make" onClick={props.onMake}>
          Make a shadow for others
        </button>
      )}

      {tab === 'pusaka' && (
        <div className="sets">
          {[
            { lakon: 'The dalang', ids: ['blencong'] },
            ...LAKONS.map((l) => ({
              lakon: l,
              ids: TALES.filter((t) => t.lakon === l).map((t) => t.pusaka),
            })),
          ].map((group) => (
            <section key={group.lakon} className="set">
              <h3>
                {group.lakon}
                {group.lakon !== 'The dalang' && lakonDone(group.lakon) && (
                  <span
                    className="gunungan"
                    title="Every pusaka of this lakon: the gunungan is yours"
                  >
                    Gunungan
                  </span>
                )}
              </h3>
              <div className="cards">
                {group.ids.map((id) => {
                  const g = props.cards[id];
                  return (
                    <button
                      key={id}
                      className={`mini-card ${g === 'gold' ? 'gold' : ''} ${g ? '' : 'locked'}`}
                      onClick={() => g && props.onPusaka(id)}
                      aria-label={g ? pusaka(id).name : 'Not yet found'}
                    >
                      <PusakaArt id={id} grade={g} className="mini-art" />
                      <span>{g ? pusaka(id).name : '?'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'wayang' && (
        <div className="sets">
          {SETS.map((s) => (
            <section key={s.id} className="set">
              <h3>
                {s.name} <span className="muted">{s.blurb}</span>
              </h3>
              <div className="cards">
                {FIGURES.filter((f) => f.set === s.id).map((f) => {
                  const met = !!props.met[f.id];
                  return (
                    <button
                      key={f.id}
                      className={`mini-card ${met ? '' : 'locked'}`}
                      onClick={() => met && props.onWayang(f.id)}
                      aria-label={met ? f.name : 'Not yet met'}
                    >
                      <PuppetArt
                        id={f.id}
                        style={met ? 'painted' : 'locked'}
                        className="mini-art"
                      />
                      <span>{met ? f.name : '?'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'lakon' && (
        <div className="sets lakon">
          {LAKONS.map((l) => (
            <section key={l} className="set">
              <h3>{l}</h3>
              <ol className="chapters">
                {TALES.filter((t) => t.lakon === l).map((t, n) =>
                  props.read.includes(t.id) ? (
                    <li key={t.id}>
                      <p className="eyebrow">
                        Chapter {n + 1} · {t.title}
                      </p>
                      <p className="chapter">{t.tale}</p>
                    </li>
                  ) : (
                    <li key={t.id} className="untold">
                      <p className="eyebrow">Chapter {n + 1}</p>
                      <p className="muted">
                        Not yet told. Solve this scene to read it.
                      </p>
                    </li>
                  )
                )}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

/** one pusaka, large, with its story and who carried it */
export const PusakaView = (props: {
  id: string;
  grade: CardGrade | undefined;
  onClose: () => void;
}) => {
  const p = pusaka(props.id);
  const owner = p.owner ? figure(p.owner) : null;
  return (
    <div className={`modal-back`} onClick={props.onClose}>
      <div
        className={`modal card-view ${props.grade === 'gold' ? 'gold' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={p.name}
      >
        <PusakaArt id={p.id} grade={props.grade} className="card-art" />
        <p className="eyebrow">
          {owner ? `Pusaka of ${owner.name}` : "The dalang's own"}
        </p>
        <h2 className="display">{p.name}</h2>
        <p>{p.story}</p>
        {p.source && <p className="muted small source">Source: {p.source}</p>}
        {props.grade === 'gold' && (
          <p className="muted small">Gold prada: found at par with no hints.</p>
        )}
        <button className="btn" onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>
  );
};
