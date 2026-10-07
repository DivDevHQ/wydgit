// Skins contain validated design tokens, never executable CSS or external assets.
const validId = value => typeof value === 'string' && /^[a-zA-Z][\w-]*$/.test(value);
export function resolveSkin(id, model) {
  if (!validId(id)) throw new Error('Invalid skin reference');
  const raw = model.skins?.get(id);
  const skin = raw && { ...raw };
  if (!skin || skin.id !== id || skin.prototype !== 'skin') throw new Error(`Unknown or invalid skin: ${id}`);
  const definition = model.prototypes.get('skin');
  if (!definition) throw new Error('Missing skin prototype');
  for (const [name, rule] of Object.entries(definition.properties)) {
    if (skin[name] === undefined && Object.hasOwn(rule, 'default')) skin[name] = structuredClone(rule.default);
    if (skin[name] === undefined && !rule.required) continue;
    if (skin[name] === null || Array.isArray(skin[name]) || typeof skin[name] !== rule.type) throw new Error(`Invalid skin.${name}: ${id}`);
  }
  for (const [key, value] of Object.entries(skin.tokens)) {
    const rule = definition.tokens[key];
    const valid = rule && (
      (rule.type === 'color' && typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) ||
      (rule.type === 'length' && typeof value === 'string' && /^(?:\d+(?:\.\d+)?)(?:px|rem|em|ch)$/.test(value) && parseFloat(value) > 0 && parseFloat(value) <= 2000) ||
      (rule.type === 'choice' && rule.enum.includes(value)) ||
      (rule.type === 'number' && Number.isFinite(value) && (rule.enum ? rule.enum.includes(value) : value >= rule.min && value <= rule.max))
    );
    if (!valid || !/^[a-z][a-z-]*$/.test(key)) throw new Error(`Invalid skin token ${id}.${key}`);
  }
  return skin;
}
export function skinAttribute(node, model) {
  if (node.skin === undefined) return '';
  const skin = resolveSkin(node.skin, model);
  return ` data-skin="${skin.id}"`;
}
export function renderSkinCss(model) {
  const rules = [];
  for (const id of (model.skins || new Map()).keys()) {
    try {
      const skin = resolveSkin(id, model);
      rules.push(`[data-skin="${id}"]{${Object.entries(skin.tokens).map(([key,value]) => `--${key}:${value}`).join(';')}}`);
    } catch {
      // Invalid referenced skins produce renderer diagnostics at their owning node.
      // They must never contribute unsafe CSS or break unrelated skins.
    }
  }
  return rules.join('\n');
}
