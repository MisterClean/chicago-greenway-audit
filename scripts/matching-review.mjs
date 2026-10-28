/** Resolve a reviewed unresolved component only when its complete city-row set matches. */
export function resolveMatchingReview({ bindings, componentIds, evidenceRecords }) {
  const ids = (value, label) => {
    if (!Array.isArray(value) || value.length === 0 || value.some(id => typeof id !== 'string' || !id.trim())) {
      throw new Error(`${label} must contain nonempty IDs`);
    }
    if (new Set(value).size !== value.length) throw new Error(`${label} has duplicate IDs`);
    return new Set(value);
  };
  const component = ids(componentIds, 'componentIds');
  if (!Array.isArray(bindings) || !Array.isArray(evidenceRecords)) throw new Error('bindings and evidenceRecords must be arrays');
  const records = new Map();
  for (const record of evidenceRecords) {
    if (typeof record?.id !== 'string' || !record.id.trim() || records.has(record.id)) throw new Error('evidenceRecords have invalid or duplicate IDs');
    records.set(record.id, record);
  }
  let match = null;
  for (const binding of bindings) {
    const sourceIds = ids(binding?.source_ids, 'binding source_ids');
    if (typeof binding.evidence_id !== 'string' || !binding.evidence_id.trim()) throw new Error('binding requires evidence_id');
    const record = records.get(binding.evidence_id);
    if (!record) throw new Error(`missing evidence record ${binding.evidence_id}`);
    const covered = ids(record.source_record_ids, 'evidence source_record_ids');
    if (![...sourceIds].every(id => covered.has(id))) throw new Error('evidence does not cover binding source IDs');
    if (typeof record.matching_review !== 'string' || !record.matching_review.trim()) throw new Error('evidence requires matching_review reason');
    if (!Array.isArray(record.sources) || !record.sources.some(source => typeof source?.url === 'string' && source.url.trim())) throw new Error('evidence requires a source URL');
    const overlap = [...sourceIds].filter(id => component.has(id)).length;
    if (overlap && (overlap !== sourceIds.size || overlap !== component.size)) throw new Error('partial matching review overlap');
    if (overlap) {
      if (match) throw new Error('duplicate matching review bindings');
      match = { evidence_id: binding.evidence_id, source_ids: [...binding.source_ids], reason: record.matching_review };
    }
  }
  return match;
}
