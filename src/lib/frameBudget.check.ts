import assert from 'node:assert/strict';
import { frameBudget } from './frameBudget.js';

const run = (frames: number[]) => {
  const sample = frameBudget();
  return frames.some((d) => sample(d));
};
const repeat = (d: number, n: number) => Array.from({ length: n }, () => d);

assert.equal(run(repeat(16.7, 2000)), false, 'a steady 60fps scroll must not trip');
assert.equal(run([...repeat(33, 90), ...repeat(16.7, 900)]), false, 'one slow window is a hiccup, not a device');
assert.equal(run(repeat(33, 180)), true, 'sustained 30fps must trip on the second window');
assert.equal(run(repeat(600, 500)), false, 'long stalls (hero build, chunk parse) are ignored');
console.log('frameBudget: ok');
