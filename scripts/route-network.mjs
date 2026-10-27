import geodesic from 'geographiclib-geodesic';

export const metres = (a,b) => geodesic.Geodesic.WGS84.Inverse(a[1],a[0],b[1],b[0]).s12;
export const lineLength = points => points.slice(1).reduce((n,p,i)=>n+metres(points[i],p),0);
const xy = p => [p[0]*83100,p[1]*111100];
export function locate(point,line) {
  const p=xy(point); let best={distance:Infinity,position:0,heading:[0,0]}, offset=0;
  for(let i=1;i<line.length;i++) {const a=xy(line[i-1]), b=xy(line[i]); const dx=b[0]-a[0],dy=b[1]-a[1], len=Math.hypot(dx,dy); if(!len)continue;
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(len*len)));const d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
    if(d<best.distance)best={distance:d,position:offset+t*len,heading:[dx/len,dy/len]};offset+=len;
  } return best;
}
// Merge only exact adjoining city record endpoints. Do not infer a connection across gaps.
export function assemble(records,axis) {
  let parts=records.flatMap(r=>r.the_geom.coordinates.map(c=>({coords:c,ids:[r[':id']]})));
  while(true) {let joined=false; outer:for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++) {
    for(const reverseA of [false,true])for(const reverseB of [false,true]) {let a=reverseA?[...parts[i].coords].reverse():parts[i].coords,b=reverseB?[...parts[j].coords].reverse():parts[j].coords;
      if(metres(a.at(-1),b[0])<1) {parts[i]={coords:[...a,...b.slice(1)],ids:[...parts[i].ids,...parts[j].ids]};parts.splice(j,1);joined=true;break outer;}
    }
  } if(!joined)break; }
  for(const p of parts) {let k=axis==='north'?1:0;if(p.coords[0][k]>p.coords.at(-1)[k])p.coords.reverse();}
  return parts.sort((a,b)=>a.coords[0][axis==='north'?1:0]-b.coords[0][axis==='north'?1:0]);
}
// Segment candidates must remain near the full designation and follow its heading.
// Traversal uses real node identity, so crossings at different grades cannot connect.
export function alignedGraph(line,ways,maxDistance=18) {
  const graph=new Map(); const add=(id,e)=>{if(!graph.has(id))graph.set(id,[]);graph.get(id).push(e)};
  for(const way of ways) for(let i=1;i<way.nodes.length;i++) {
    const a=way.coordinates[i-1],b=way.coordinates[i];if(!a||!b)continue;
    const la=locate(a,line),lb=locate(b,line),mid=locate([(a[0]+b[0])/2,(a[1]+b[1])/2],line);
    const av=xy(a),bv=xy(b),dx=bv[0]-av[0],dy=bv[1]-av[1],len=Math.hypot(dx,dy); if(!len||Math.max(la.distance,lb.distance,mid.distance)>maxDistance)continue;
    const heading=Math.abs((dx*mid.heading[0]+dy*mid.heading[1])/len);
    if(heading<0.65 || Math.abs(lb.position-la.position)<len*0.3)continue;
    const aId=way.nodes[i-1],bId=way.nodes[i];const edge={way,index:i-1,length:metres(a,b)};
    add(aId,{...edge,from:aId,to:bId,reversed:false});add(bId,{...edge,from:bId,to:aId,reversed:true});
  }return graph;
}
export function shortestPath(graph,start,end) {
  const dist=new Map([[start,0]]),prev=new Map(),queue=[[0,start]];
  while(queue.length){queue.sort((a,b)=>a[0]-b[0]);const [d,n]=queue.shift();if(d!==dist.get(n))continue;if(n===end)break;
    for(const e of graph.get(n)??[]){const nd=d+e.length;if(nd<(dist.get(e.to)??Infinity)){dist.set(e.to,nd);prev.set(e.to,e);queue.push([nd,e.to]);}}
  } if(!dist.has(end))return null;const path=[];for(let n=end;n!==start;){const e=prev.get(n);if(!e)return null;path.push(e);n=e.from;}return path.reverse();
}

/** Compare the city's cardinal one-way assertion to oriented OSM decisions. */
export function compareCityOneWay(access, direction, axis) {
  if (!['N','S','E','W'].includes(direction)) return access;
  if ((axis === 'north' && !['N','S'].includes(direction)) || (axis === 'east' && !['E','W'].includes(direction))) return access;
  const restricted = (axis === 'north' ? direction === 'S' : direction === 'W') ? 'forward' : 'reverse';
  const permitted = restricted === 'forward' ? 'reverse' : 'forward';
  if (access[restricted].status !== 'allowed') return access;
  const result = structuredClone(access);
  const conflict = {status:'unknown',kind:'unknown',reason:`City designation says oneway_dir=${direction}, while OSM permits the opposite direction; source disagreement needs review.`,evidence_status:'conflicting'};
  result[restricted] = conflict;
  // An explicit contrary OSM oneway also conflicts with the city's permitted direction.
  if (access[permitted].status === 'blocked' && access[permitted].kind === 'direction' && /oneway/i.test(access[permitted].reason)) result[permitted] = {...conflict};
  return result;
}

/** Trim a terminal edge at the nearest point to the mapped designation endpoint. */
export function clipTerminal(coords, endpoint, side, tolerance = 18) {
  const location = locate(endpoint, coords);
  if (location.distance > tolerance) return {coords, resolved:false};
  let travelled = 0, clipped = null;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i-1], b = coords[i];
    const len = Math.hypot((b[0]-a[0])*83100, (b[1]-a[1])*111100);
    if (travelled + len >= location.position) {
      const t = len ? (location.position-travelled)/len : 0;
      const point = [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
      clipped = side === 'start' ? [point,...coords.slice(i)] : [...coords.slice(0,i),point];
      break;
    }
    travelled += len;
  }
  if (!clipped || lineLength(clipped) < 0.01) return {coords,resolved:false};
  return {coords:clipped,resolved:true};
}
