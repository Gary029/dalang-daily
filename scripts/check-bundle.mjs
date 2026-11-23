// Fails if the built post (dist/client) contains puzzle answers, or is missing an entry.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = 'dist/client';
const walk = (d) =>
  readdirSync(d).flatMap((f) =>
    statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]
  );
const problems = [];
for (const entry of ['splash.html', 'game.html'])
  if (!existsSync(join(root, entry))) problems.push(`missing ${entry}`);
if (!existsSync('dist/server/index.cjs'))
  problems.push('missing dist/server/index.cjs');
// A solution is an array of poses or nulls: "solution":[{"x":... or
// solution:[null,... The word boundary keeps three.js's `resolution:[` out.
const SOLUTION = /\bsolution["']?\s*:\s*\[\s*(\{|null)/;
for (const f of walk(root).filter((f) => /\.(js|html)$/.test(f))) {
  if (SOLUTION.test(readFileSync(f, 'utf8')))
    problems.push(`${f} contains puzzle solutions`);
}
const size = walk(root).reduce((n, f) => n + statSync(f).size, 0);
console.log(`dist/client: ${(size / 1024).toFixed(0)} KB`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('bundle ok: no answers in the post');
