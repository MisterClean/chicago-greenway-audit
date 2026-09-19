export const MM_PER_MILE = 1_609_344;
export type Status = 'pass' | 'fail' | 'unknown';
export function toMm(miles: number): number {
  if (!Number.isFinite(miles) || miles < 0.01 || miles > 20) throw new Error('Enter a distance from 0.01 to 20 miles.');
  return Math.round(miles * MM_PER_MILE);
}
export function classify(lb: number, exact: number | boolean, x: number): Status {
  return lb >= x ? 'fail' : exact ? 'pass' : 'unknown';
}
export function lowerBound(values: Uint32Array, x: number): number {
  let lo = 0, hi = values.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (values[mid] < x) lo = mid + 1; else hi = mid; }
  return lo;
}
type Distribution = { scores: Uint32Array; cumulative: Float64Array };
export class Summary {
  readonly exact: Distribution;
  readonly all: Distribution;
  readonly total: number;
  constructor(bytes: ArrayBuffer) {
    if (bytes.byteLength < 32) throw new Error('Summary header is truncated.');
    const view = new DataView(bytes);
    if (new TextDecoder().decode(bytes.slice(0, 8)) !== 'GWAYIDX1' || view.getUint32(8, true) !== 1) throw new Error('Unsupported summary format.');
    this.total = view.getFloat64(24, true);
    if (!Number.isSafeInteger(this.total) || this.total < 0) throw new Error('Invalid total.');
    let offset = 32;
    const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    if (!littleEndian) throw new Error('This summary reader requires a little-endian device.');
    const read = (count: number): Distribution => {
      const scoreStart = offset;
      const sumStart = Math.ceil((offset + count * 4) / 8) * 8;
      offset = sumStart + count * 8;
      if (offset > bytes.byteLength) throw new Error('Summary is truncated.');
      const scores = new Uint32Array(bytes, scoreStart, count);
      const cumulative = new Float64Array(bytes, sumStart, count);
      for (let i = 0; i < count; i++) {
        if ((i && scores[i] <= scores[i - 1]) || !Number.isSafeInteger(cumulative[i]) || cumulative[i] < 0 || cumulative[i] > this.total || (i && cumulative[i] < cumulative[i - 1])) throw new Error('Invalid summary distribution.');
      }
      return { scores, cumulative };
    };
    this.exact = read(view.getUint32(12, true));
    this.all = read(view.getUint32(16, true));
    if (offset !== bytes.byteLength || (this.all.cumulative.at(-1) ?? 0) !== this.total) throw new Error('Summary totals or size do not match.');
  }
  at(x: number) {
    if (!Number.isSafeInteger(x) || x <= 0) throw new Error('Threshold must be a positive integer.');
    const prefix = (d: Distribution) => d.cumulative[lowerBound(d.scores, x) - 1] ?? 0;
    const passing = prefix(this.exact);
    const failing = this.total - prefix(this.all);
    const unknown = this.total - passing - failing;
    if (unknown < 0) throw new Error('Inconsistent summary distributions.');
    return { passing, failing, unknown, total: this.total, share: this.total ? passing / this.total : 0 };
  }
}
export function readThreshold(search: string): number {
  const params = new URLSearchParams(search);
  const mm = Number(params.get('x_mm'));
  if (params.has('x_mm') && Number.isSafeInteger(mm) && mm >= toMm(0.01) && mm <= toMm(20)) return mm;
  return toMm(0.5);
}
export function thresholdLabel(mm: number): string {
  const value=mm/MM_PER_MILE;
  for(let digits=0;digits<=7;digits++){const label=value.toFixed(digits);if(Math.round(Number(label)*MM_PER_MILE)===mm)return String(Number(label));}
  return String(value);
}
