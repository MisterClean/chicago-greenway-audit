/** Assign stable component IDs using explicit city-row anchors where configured. */
export function componentRouteIds(components, routePrefix, bindings = []) {
  const fail = message => { throw new Error(`Component route IDs: ${message}`); };
  const nonempty = value => typeof value === 'string' && value.trim().length > 0;
  if (!nonempty(routePrefix)) fail('routePrefix required');
  if (!Array.isArray(components) || !Array.isArray(bindings)) fail('components and bindings must be arrays');
  const cityComponents = new Map();
  components.forEach((component, index) => {
    if (!Array.isArray(component?.ids) || !component.ids.length || component.ids.some(id => !nonempty(id)) || new Set(component.ids).size !== component.ids.length) fail('component IDs must be unique nonempty strings');
    for (const id of component.ids) {
      if (cityComponents.has(id)) fail(`source ${id} appears in multiple components`);
      cityComponents.set(id, index);
    }
  });
  const ids = components.map((_, index) => `${routePrefix}-${index + 1}`);
  const assigned = new Set();
  const anchors = new Set();
  for (const binding of bindings) {
    if (!nonempty(binding?.source_id) || !nonempty(binding?.route_id)) fail('binding requires source_id and route_id');
    if (anchors.has(binding.source_id)) fail(`duplicate anchor ${binding.source_id}`);
    anchors.add(binding.source_id);
    const index = cityComponents.get(binding.source_id);
    if (index === undefined) fail(`anchor ${binding.source_id} is absent`);
    if (assigned.has(index)) fail('component has multiple bindings');
    const prefix = `${routePrefix}-`;
    const suffix = binding.route_id.startsWith(prefix) ? binding.route_id.slice(prefix.length) : '';
    if (!/^[1-9][0-9]*$/.test(suffix) || !Number.isSafeInteger(Number(suffix))) fail(`invalid route_id ${binding.route_id}`);
    ids[index] = binding.route_id;
    assigned.add(index);
  }
  if (new Set(ids).size !== ids.length) fail('resolved route IDs collide');
  return ids;
}
