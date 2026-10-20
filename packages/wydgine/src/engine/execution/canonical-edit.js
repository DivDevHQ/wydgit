// Server Page adapter over the portable mutation factory. No application API.
import {createEdit} from '../object-model/mutation.js';
import {hydrate,dehydrate} from '../object-model/index.js';
import {copyEnvelope} from '../object-model/schema.js';

export function createPageEdit(runtime, context, registry) {
  // Only dehydrate outputs accepted by this session can take the copy path.
  // Candidates and caller inputs never become accepted until full hydration.
  let accepted;
  const copyToken = Object.freeze({});
  const validate = (input, definitions, options) => {
    if (input === accepted && options.revision === runtime.revision) return copyToken;
    return hydrate(input, definitions, {
      ...options, rootPrototype: runtime.get(runtime.rootId).prototype
    });
  };
  const snapshot = (state, options) => {
    // The factory's pre-operation hydrate/dehydrate pair needs only an isolated
    // copy of its private validated envelope. Never send this token to callers,
    // cache a mutable candidate, or replace post-operation/commit validation.
    if (state === copyToken) return copyEnvelope(accepted);
    const raw = dehydrate(state, options);
    accepted = raw;
    return raw;
  };
  return createEdit(runtime, context, registry, validate, snapshot);
}
