import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Summary, classify, readThreshold, thresholdLabel, toMm } from './threshold.js';

test('equality fails, unknown never passes, canonical URL round trips', () => {
  assert.equal(classify(100, 1, 100), 'fail');
  assert.equal(classify(100, 0, 101), 'unknown');
  assert.equal(classify(100, 1, 101), 'pass');
  for (const x of [0.01, 0.125, 0.123456, 0.5, 3.145, 20]) assert.equal(readThreshold(`?x_mm=${toMm(x)}`), toMm(x));
  for (const x of [0, -1, NaN, Infinity, 20.1]) assert.throws(() => toMm(x));
});

test('Rust binary summary agrees with unique records around every score', () => {
  const b = readFileSync('data/fixtures/output/summary.bin');
  const summary = new Summary(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const records = readFileSync('data/fixtures/output/scores.ndjson', 'utf8').trim().split('\n').map(x => JSON.parse(x));
  const thresholds = [...new Set([1,...records.flatMap(r => [Math.max(1,r.lb_mm-1),Math.max(1,r.lb_mm),r.lb_mm+1])])].sort((a,b)=>a-b);
  let previous=0;
  for (const x of thresholds) {
    const totals={pass:0,fail:0,unknown:0};
    for(const r of records) totals[classify(r.lb_mm,r.exact,x)] += r.gw_mm;
    const result=summary.at(x);
    assert.deepEqual([result.passing,result.failing,result.unknown],[totals.pass,totals.fail,totals.unknown]);
    assert.equal(result.passing+result.failing+result.unknown,result.total);
    assert.ok(result.passing>=previous); previous=result.passing;
  }
  assert.throws(()=>new Summary(new ArrayBuffer(2)));
});

test("display preserves integer millimetres",()=>{for(let mm=toMm(.01);mm<toMm(20);mm+=7919)assert.equal(toMm(Number(thresholdLabel(mm))),mm);});
