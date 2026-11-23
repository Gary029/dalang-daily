import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);

test('devvit.json matches the Devvit config schema', () => {
  // the schema is JSON Schema 2020-12
  type Validator = ((d: unknown) => boolean) & { errors?: unknown };
  type AjvLike = {
    compile(s: object): Validator;
    addSchema(s: object): unknown;
    addFormat(n: string, f: boolean): unknown;
  };
  const Ajv = require('ajv/dist/2020') as new (o: object) => AjvLike;
  const load = (f: string) =>
    JSON.parse(
      readFileSync(require.resolve(`@devvit/shared-types/schemas/${f}`), 'utf8')
    ) as object;
  const config = JSON.parse(readFileSync('devvit.json', 'utf8')) as Record<
    string,
    unknown
  >;
  const ajv = new Ajv({ strict: false, allErrors: true });
  ajv.addFormat('https-url', true);
  ajv.addSchema(load('products.json'));
  const validate = ajv.compile(load('config-file.v1.json'));
  assert.ok(validate(config), JSON.stringify(validate.errors, null, 1));
});

test('every endpoint in devvit.json has a route', () => {
  const config = readFileSync('devvit.json', 'utf8');
  const server = ['menu', 'scheduler', 'triggers']
    .map((r) => readFileSync(`src/server/routes/${r}.ts`, 'utf8'))
    .join('\n');
  for (const [, path] of config.matchAll(/"(\/internal\/[^"]+)"/g)) {
    const last = path!.split('/').pop()!;
    assert.ok(server.includes(`'/${last}'`), `no route for ${path}`);
  }
});
