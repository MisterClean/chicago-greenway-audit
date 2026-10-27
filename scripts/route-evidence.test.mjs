import test from 'node:test';
import assert from 'node:assert/strict';
import { gapReviewContext } from './route-evidence.mjs';

test('a gate report annotates only its scoped gap, without authorizing passage', () => {
  const report = {id:'gate',source_record_ids:['city-a'],gap_scope:{route_id:'route-a',bounds:[[-88,41],[-87,42]]},gap_note:'Schedule unknown'};
  const points = [[-87.5,41.5],[-87.5,41.6]];
  assert.deepEqual(gapReviewContext([report],'route-a',['city-a'],points),[report]);
  assert.deepEqual(gapReviewContext([report],'route-b',['city-a'],points),[]);
  assert.deepEqual(gapReviewContext([report],'route-a',['city-b'],points),[]);
  assert.deepEqual(gapReviewContext([report],'route-a',['city-a'],[...points,[-87.5,42.1]]),[]);
  assert.deepEqual(gapReviewContext([report],'route-a',['city-a'],[]),[]);
});
