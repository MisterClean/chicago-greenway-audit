import { booleanIntersects, booleanPointInPolygon, lineString, lineSplit, feature } from '@turf/turf';
import geodesic from 'geographiclib-geodesic';

export function lengthMm(coordinates) {
 let metres=0;
 for(let i=1;i<coordinates.length;i++) { const [a,b]=[coordinates[i-1],coordinates[i]]; metres+=geodesic.Geodesic.WGS84.Inverse(a[1],a[0],b[1],b[0]).s12; }
 return Math.round(metres*1000);
}
// Split overlaps at source vertices in a local equirectangular plane. 1 mm tolerance
// only reconciles floating-point arithmetic; it does not snap parallel streets.
export function uniqueIntervals(parts) {
 const cos=Math.cos(41.95*Math.PI/180), scale=111_320;
 const project=p=>[p[0]*cos*scale,p[1]*scale];
 const pieces=[];
 for(const part of parts) for(let i=1;i<part.coordinates.length;i++) pieces.push({a:part.coordinates[i-1],b:part.coordinates[i],source:part.source});
 const vertices=pieces.flatMap(p=>[p.a,p.b]);
 const unique=new Map();
 for(const piece of pieces) {
  const a=project(piece.a), b=project(piece.b); const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
  if(len2<0.000001) continue;
  const cuts=[0,1];
  for(const point of vertices) {const p=project(point);const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2;
   if(t>1e-9 && t<1-1e-9 && Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/Math.sqrt(len2)<0.001) cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++) {
   if(cuts[i]-cuts[i-1]<1e-9) continue;
   const coords=[cuts[i-1],cuts[i]].map(t=>[piece.a[0]+t*(piece.b[0]-piece.a[0]),piece.a[1]+t*(piece.b[1]-piece.a[1])]);
   const keys=coords.map(p=>p.map(v=>v.toFixed(9)).join(',')); const key=keys.sort().join('|');
   if(!unique.has(key)) unique.set(key,{coordinates:coords,sources:[]});
   const interval=unique.get(key); if(!interval.sources.some(s=>s[':id']===piece.source[':id'])) interval.sources.push(piece.source);
  }
 }
 return [...unique.values()].sort((a,b)=>JSON.stringify(a.coordinates).localeCompare(JSON.stringify(b.coordinates)));
}
export function prepareInventory(rows, ward = null) {
 const parts=[];
 for(const source of rows) {
  if(ward && !booleanIntersects(feature(source.the_geom),ward)) continue;
  for(const coords of source.the_geom.coordinates) {
   const line=lineString(coords); const split=ward?lineSplit(line,ward):{features:[]};
   for(const candidate of split.features.length ? split.features : [line]) {
    const c=candidate.geometry.coordinates;
    // Membership per short interval prevents a border-crossing line from counting outside mileage.
    for(let i=1;i<c.length;i++) {
     const midpoint=[(c[i-1][0]+c[i][0])/2,(c[i-1][1]+c[i][1])/2];
     if(!ward || booleanPointInPolygon(midpoint,ward)) parts.push({coordinates:[c[i-1],c[i]],source});
    }
   }
  }
 }
 return uniqueIntervals(parts).map((part,i)=>({sid:i+1,coordinates:part.coordinates,sources:part.sources,gw_mm:lengthMm(part.coordinates)})).filter(r=>r.gw_mm>0);
}
