import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FIGURES } from '../shared/figures.ts';
import { shapesOf } from '../shared/puzzle.ts';
import { Kelir } from './board.tsx';
import { PuppetArt } from './ui.tsx';

/** Dev page (npm run local, /gallery.html): every figure painted and as a shadow. */
const Gallery = () => (
  <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
    {FIGURES.map((f) => (
      <div
        key={f.id}
        style={{
          width: 440,
          background: '#241a30',
          borderRadius: 12,
          padding: 6,
        }}
      >
        <div style={{ display: 'flex', height: 300 }}>
          <PuppetArt id={f.id} arm={0} className="puppet-art" />
          <PuppetArt id={f.id} arm={2} className="puppet-art" />
        </div>
        <div style={{ height: 260 }}>
          <Kelir
            shadow={shapesOf(
              [f.id],
              [{ x: 3, d: 4, a: 0, arm: 1, flip: false }]
            )}
            target={null}
            selected={null}
          />
        </div>
        <div style={{ textAlign: 'center', fontSize: 13 }}>{f.name}</div>
      </div>
    ))}
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>
);
