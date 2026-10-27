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
  const deferred=[];
  const addSegment=(way,i)=>{const aId=way.nodes[i-1],bId=way.nodes[i],edge={way,index:i-1,length:metres(way.coordinates[i-1],way.coordinates[i])};add(aId,{...edge,from:aId,to:bId,reversed:false});add(bId,{...edge,from:bId,to:aId,reversed:true});};
  for(const way of ways) for(let i=1;i<way.nodes.length;i++) {
    const a=way.coordinates[i-1],b=way.coordinates[i];if(!a||!b)continue;
    const la=locate(a,line),lb=locate(b,line),mid=locate([(a[0]+b[0])/2,(a[1]+b[1])/2],line);
    const av=xy(a),bv=xy(b),dx=bv[0]-av[0],dy=bv[1]-av[1],len=Math.hypot(dx,dy); if(!len||Math.max(la.distance,lb.distance,mid.distance)>maxDistance)continue;
    const heading=Math.abs((dx*mid.heading[0]+dy*mid.heading[1])/len);
    if(heading<0.65 || Math.abs(lb.position-la.position)<len*0.3){deferred.push({way,i,length:len});continue;}
    addSegment(way,i);
  }
  // A short diagonal can represent a city record's right-angle jog. Require both
  // endpoints to have already matched, rather than extending the graph outward.
  for(const e of deferred) if(!['circular','roundabout'].includes(e.way.tags?.junction) && e.length<=25 && graph.has(e.way.nodes[e.i-1]) && graph.has(e.way.nodes[e.i])) addSegment(e.way,e.i);
  // OSM often splits a small circular junction across multiple ways. Admit the
  // complete closed ring only when all of it is within the source corridor and
  // at least two ring nodes attach to the previously aligned network.
  const circular=ways.filter(w=>['circular','roundabout'].includes(w.tags?.junction));
  const remaining=new Set(circular);
  while(remaining.size){
    const group=[],queue=[remaining.values().next().value];remaining.delete(queue[0]);
    while(queue.length){const w=queue.pop();group.push(w);for(const other of remaining) if(other.nodes.some(n=>w.nodes.includes(n))){remaining.delete(other);queue.push(other);}}
    const degree=new Map();let length=0,near=true;
    for(const w of group) for(let i=1;i<w.nodes.length;i++){const a=w.coordinates[i-1],b=w.coordinates[i];if(!a||!b){near=false;continue;}length+=metres(a,b);near&&=Math.max(locate(a,line).distance,locate(b,line).distance,locate([(a[0]+b[0])/2,(a[1]+b[1])/2],line).distance)<=maxDistance;degree.set(w.nodes[i-1],(degree.get(w.nodes[i-1])??0)+1);degree.set(w.nodes[i],(degree.get(w.nodes[i])??0)+1);}
    if(!near||length>150||[...degree.values()].some(n=>n!==2)||[...degree.keys()].filter(n=>(graph.get(n)??[]).some(e=>!['circular','roundabout'].includes(e.way.tags?.junction))).length<2)continue;
    for(const w of group) for(let i=1;i<w.nodes.length;i++) if(!graph.get(w.nodes[i-1])?.some(e=>e.way===w&&e.index===i-1)) addSegment(w,i);
  }
  return graph;
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
    // locate() subtracts projected coordinates; this loop scales coordinate
    // differences. Permit sub-millimetre roundoff at the final endpoint.
    if (travelled + len + 1e-6 >= location.position || i === coords.length - 1) {
      const t = len ? Math.max(0,Math.min(1,(location.position-travelled)/len)) : 0;
      const point = [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
      clipped = side === 'start' ? [point,...coords.slice(i)] : [...coords.slice(0,i),point];
      break;
    }
    travelled += len;
  }
  if (!clipped || lineLength(clipped) < 0.01) return {coords,resolved:false};
  return {coords:clipped,resolved:true};
}
