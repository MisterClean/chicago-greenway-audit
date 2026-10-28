import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMatchingReview } from './matching-review.mjs';

const fixture = () => ({
  bindings: [{ source_ids: ['a', 'b'], evidence_id: 'review' }],
  componentIds: ['b', 'a'],
  evidenceRecords: [{ id: 'review', source_record_ids: ['a', 'b', 'c'], matching_review: 'Ambiguous carriageway', sources: [{ url: 'https://example.com/plan' }] }],
});

test('matches the exact component set regardless of order', () => {
  assert.deepEqual(resolveMatchingReview(fixture()), { evidence_id: 'review', source_ids: ['a', 'b'], reason: 'Ambiguous carriageway' });
});
test('returns null for a disjoint component', () => {
  const input = fixture(); input.componentIds = ['c'];
  assert.equal(resolveMatchingReview(input), null);
});
test('rejects partial overlap in either direction', () => {
  for (const componentIds of [['a'], ['a', 'b', 'c']]) {
    assert.throws(() => resolveMatchingReview({ ...fixture(), componentIds }), /partial/);
  }
});
test('rejects missing or insufficient evidence', () => {
  const input = fixture(); input.evidenceRecords = [];
  assert.throws(() => resolveMatchingReview(input), /missing evidence/);
  const incomplete = fixture(); incomplete.evidenceRecords[0].source_record_ids = ['a'];
  assert.throws(() => resolveMatchingReview(incomplete), /does not cover/);
  const noReason = fixture(); noReason.evidenceRecords[0].matching_review = ' ';
  assert.throws(() => resolveMatchingReview(noReason), /matching_review/);
  const noSource = fixture(); noSource.evidenceRecords[0].sources = [];
  assert.throws(() => resolveMatchingReview(noSource), /source URL/);
});
test('rejects duplicate and empty IDs', () => {
  const component = fixture(); component.componentIds = ['a', 'a'];
  assert.throws(() => resolveMatchingReview(component), /duplicate/);
  const binding = fixture(); binding.bindings[0].source_ids = ['a', 'a'];
  assert.throws(() => resolveMatchingReview(binding), /duplicate/);
  const blank = fixture(); blank.componentIds = [''];
  assert.throws(() => resolveMatchingReview(blank), /nonempty/);
});
