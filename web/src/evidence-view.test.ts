import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evidenceForDisplay, type EvidenceRecord } from './route-model';

test('optional evidence metadata cannot leave stale route details after selection', () => {
  const record: EvidenceRecord = {id:'new-observation',location:null,review_needed:'',sources:[{url:'https://example.com/plan',status:null}]};
  const before=structuredClone(record), display=evidenceForDisplay(record);
  assert.equal(display.location,'Location unrecorded');
  assert.equal(display.source_inference,'No observation recorded.');
  assert.equal(display.review_needed,'Review requirements not recorded.');
  assert.equal(display.sources[0].status,'Status unrecorded');
  assert.equal(display.sources[0].scope,'Scope unrecorded');
  assert.deepEqual(record,before);
});

test('all saved evidence records provide strings to the HTML renderer', () => {
  const {records}=JSON.parse(readFileSync('data/routes/review-evidence.json','utf8')) as {records:EvidenceRecord[]};
  assert.ok(records.length>0);
  for (const record of records) {
    const display=evidenceForDisplay(record);
    const text=[display.location,display.source_inference,display.review_needed,...display.sources.flatMap(source=>[source.status,source.scope])];
    assert.ok(text.every(value=>typeof value==='string' && value.length>0),record.id);
    if(record.location)assert.equal(display.location,record.location);
    if(record.review_needed)assert.equal(display.review_needed,record.review_needed);
  }
});
