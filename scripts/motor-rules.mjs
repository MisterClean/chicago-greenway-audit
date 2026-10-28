// OSM passenger-car rules are source inferences, not field verification.
const decision = (status, reason, kind, sourceIds) => ({
  status, reason, kind, evidence_status: 'source-inferred',
  ...(sourceIds?.length ? { source_ids: sourceIds } : {}),
});
const open = reason => decision('allowed', reason, 'open');
const unknown = reason => decision('unknown', reason, 'unknown');
const modes = ['motorcar', 'motor_vehicle', 'vehicle', 'access'];
const allowedValues = new Set(['yes', 'permissive', 'designated', 'official']);
const blockedValues = new Set(['no', 'private', 'destination', 'delivery', 'customers', 'agricultural', 'forestry', 'permit']);
const carRoads = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service']);
const nonCarRoads = new Set(['cycleway', 'footway', 'path', 'pedestrian', 'steps', 'bridleway', 'corridor']);
const same = (a, b) => a != null && b != null && String(a) === String(b);

function accessRule(tags, direction, fallback = true) {
  // Conditions are deliberately not evaluated without a time/profile. Any applicable
  // conditional can change the result, including a conditional exception to a ban.
  for (const mode of modes) {
    for (const key of [`${mode}:${direction}:conditional`, `${mode}:conditional:${direction}`, `${mode}:conditional`]) {
      if (tags[key] != null) return unknown(`Conditional ${key}=${tags[key]} requires a time/profile`);
    }
  }
  for (const mode of modes) {
    const key = tags[`${mode}:${direction}`] != null ? `${mode}:${direction}` : mode;
    if (tags[key] == null) continue;
    const value = String(tags[key]).trim().toLowerCase();
    if (allowedValues.has(value)) return open(`${key}=${value}`);
    if (blockedValues.has(value)) return decision('blocked', `${key}=${value} excludes general through-car access`, 'access');
    return unknown(`Uninterpreted ${key}=${value}`);
  }
  if (!fallback) return null;
  if (nonCarRoads.has(tags.highway)) return decision('blocked', `highway=${tags.highway} has no general car access by default`, 'access');
  if (carRoads.has(tags.highway)) return open(`highway=${tags.highway} permits cars by default`);
  return unknown(`Car access default is unresolved for highway=${tags.highway ?? '(missing)'}`);
}

function directionRule(tags, direction) {
  for (const key of ['oneway:motorcar:conditional', 'oneway:motor_vehicle:conditional', 'oneway:vehicle:conditional', 'oneway:conditional']) {
    if (tags[key] != null) return unknown(`Conditional ${key}=${tags[key]} requires a time/profile`);
  }
  const key = ['oneway:motorcar', 'oneway:motor_vehicle', 'oneway:vehicle', 'oneway'].find(k => tags[k] != null);
  let value = key ? String(tags[key]).toLowerCase() : undefined;
  if (!key && (tags.junction === 'roundabout' || tags.highway === 'motorway' || tags.highway === 'motorway_link')) value = 'yes';
  if (!key && tags.junction === 'circular') return unknown('junction=circular does not establish a car direction');
  if (value == null || ['no', '0', 'false'].includes(value)) return open('No car one-way restriction inferred');
  if (['yes', '1', 'true'].includes(value)) return direction === 'forward' ? open(`${key ?? 'implied oneway'}=${value}`) : decision('blocked', `${key ?? 'implied oneway'}=${value} prohibits reverse travel`, 'direction');
  if (value === '-1') return direction === 'reverse' ? open(`${key}=-1`) : decision('blocked', `${key}=-1 prohibits forward travel`, 'direction');
  return unknown(`Uninterpreted ${key}=${value}`);
}

function nodeRule(node, direction) {
  const tags = node?.tags ?? node ?? {};
  const ids = node?.id == null ? undefined : [`node/${node.id}`];
  const access = accessRule(tags, direction, false);
  const barrier = tags.barrier;
  if (barrier && ['bollard', 'block', 'jersey_barrier', 'bus_trap', 'cycle_barrier', 'sump_buster'].includes(barrier)) {
    if (access?.status === 'allowed') return decision('unknown', `barrier=${barrier} conflicts with explicit car permission`, 'unknown', ids);
    return decision('blocked', `barrier=${barrier} physically obstructs ordinary cars`, 'physical', ids);
  }
  if (access && access.status !== 'allowed') return { ...access, ...(ids ? { source_ids: ids } : {}) };
  if (barrier && !['no', 'entrance', 'kerb', 'cattle_grid'].includes(barrier)) {
    return decision('unknown', `barrier=${barrier} needs car passage review`, 'unknown', ids);
  }
  return open('No blocking node restriction inferred');
}

function combine(rules) {
  return rules.find(rule => rule.status === 'blocked') ?? rules.find(rule => rule.status === 'unknown') ?? rules[0];
}

// nodeTags contains only interior nodes; shared endpoint nodes belong to movementAccess.
export function edgeAccess(tags, { reversed = false, nodeTags = [] } = {}) {
  function evaluate(routeDirection) {
    const direction = reversed ? (routeDirection === 'forward' ? 'reverse' : 'forward') : routeDirection;
    return combine([accessRule(tags, direction), directionRule(tags, direction), ...nodeTags.map(node => nodeRule(node, direction))]);
  }
  return { forward: evaluate('forward'), reverse: evaluate('reverse') };
}

export function movementAccess({ fromWayId, toWayId, viaNodeId, relations = [], isUTurn, viaNodeTags } = {}) {
  const results = [];
  if (viaNodeTags != null) {
    const node = viaNodeTags.tags ? viaNodeTags : { id: viaNodeId, tags: viaNodeTags };
    const forward = nodeRule(node, 'forward');
    const reverse = nodeRule(node, 'reverse');
    if (forward.status === reverse.status) results.push(forward);
    else results.push(decision('unknown', 'Directional node access needs an oriented movement', 'unknown', viaNodeId == null ? undefined : [`node/${viaNodeId}`]));
  }
  for (const relation of relations) {
    const tags = relation.tags ?? {};
    if (tags.type !== 'restriction' && !String(tags.type ?? '').startsWith('restriction:')) continue;
    const members = relation.members ?? [];
    const from = members.filter(m => m.role === 'from' && m.type === 'way');
    const to = members.filter(m => m.role === 'to' && m.type === 'way');
    const via = members.filter(m => m.role === 'via');
    const except = String(tags.except ?? '').toLowerCase().split(/[;,]/).map(s => s.trim());
    if (except.some(mode => ['motorcar', 'motor_vehicle', 'vehicle'].includes(mode))) continue;
    const key = ['restriction:motorcar', 'restriction:motor_vehicle', 'restriction:vehicle', 'restriction'].find(k => tags[k] != null);
    const conditionalKey = ['restriction:motorcar:conditional', 'restriction:motor_vehicle:conditional', 'restriction:vehicle:conditional', 'restriction:conditional'].find(k => tags[k] != null);
    if (!key && !conditionalKey) continue; // e.g. bicycle-only restrictions
    const ids = relation.id == null ? undefined : [`relation/${relation.id}`];
    const viaWays = via.filter(m => m.type === 'way');
    if (viaWays.length) {
      const implicated = from.some(m => same(m.ref, fromWayId)) || viaWays.some(m => same(m.ref, fromWayId) || same(m.ref, toWayId));
      if (implicated) results.push(decision('unknown', 'Via-way restriction requires path-history evaluation', 'unknown', ids));
      continue;
    }
    if (!from.some(m => same(m.ref, fromWayId)) || !via.some(m => m.type === 'node' && same(m.ref, viaNodeId))) continue;
    if (to.length === 0) {
      results.push(decision('unknown', 'Restriction has no supported to-way member', 'unknown', ids));
      continue;
    }
    const target = to.some(m => same(m.ref, toWayId));
    const value = String(tags[key] ?? tags[conditionalKey] ?? '').toLowerCase();
    const isOnly = value.startsWith('only_');
    const isNo = value.startsWith('no_');
    const affected = (isNo && target) || (isOnly && !target);
    if (!isNo && !isOnly) {
      results.push(decision('unknown', `Uninterpreted turn restriction ${value}`, 'unknown', ids));
    } else if (same(fromWayId, toWayId) && value.includes('u_turn')) {
      if (typeof isUTurn !== 'boolean') {
        results.push(decision('unknown', 'Same-way U-turn restriction requires movement orientation', 'unknown', ids));
      } else if (conditionalKey) {
        results.push(decision('unknown', `Conditional ${conditionalKey}=${tags[conditionalKey]} requires a time/profile`, 'unknown', ids));
      } else if ((isNo && isUTurn) || (isOnly && !isUTurn)) {
        results.push(decision('blocked', `${key}=${value} prohibits this movement`, 'direction', ids));
      }
    } else if (conditionalKey) {
      // A different conditional restriction may affect other departures too.
      results.push(decision('unknown', `Conditional ${conditionalKey}=${tags[conditionalKey]} requires a time/profile`, 'unknown', ids));
    } else if (affected) {
      results.push(decision('blocked', `${key}=${value} prohibits this movement`, 'direction', ids));
    }
  }
  return results.length ? combine(results) : open('No applicable car turn restriction found for the connected movement');
}
