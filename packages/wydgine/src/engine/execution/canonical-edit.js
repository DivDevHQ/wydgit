// Server Page adapter over the portable mutation factory. No application API.
import {createEdit} from '../object-model/mutation.js';
import {hydrate,dehydrate} from '../object-model/index.js';
import {copyEnvelope} from '../object-model/schema.js';

export function createPageEdit(runtime, context, registry) {
  // Only dehydrate outputs accepted by this session can take the copy path.
  // Candidates and caller inputs never become accepted until full hydration.
  let accepted, acceptedRuntime;
  const baseRevision = runtime.revision;
  const copyToken = Object.freeze({});
  const validate = (input, definitions, options) => {
    if (input === accepted) {
      if (options.revision === baseRevision) return copyToken;
      // The factory checks live context, conflict and exhaustion before this call.
      // This pair is private to one session: accepted is an isolated dehydrate
      // output and acceptedRuntime is its fully validated, deeply frozen graph.
      if (options.revision === baseRevision + 1 && acceptedRuntime.revision === options.revision) return acceptedRuntime;
    }
    return hydrate(input, definitions, {
      ...options,
      // Operation validation exposes no runtime/revision. Build the immutable
      // commit snapshot now; exhaustion must still be reported only at commit.
      revision: options.revision === baseRevision && baseRevision < Number.MAX_SAFE_INTEGER
        ? baseRevision + 1 : options.revision,
      rootPrototype: runtime.get(runtime.rootId).prototype
    });
  };
  const snapshot = (state, options) => {
    // Never expose the token, mutable accepted envelope or precommit runtime.
    // Failed candidate hydration cannot replace the accepted pair.
    if (state === copyToken) return copyEnvelope(accepted);
    const raw = dehydrate(state, options);
    accepted = raw;
    acceptedRuntime = state;
    return raw;
  };
  return createEdit(runtime, context, registry, validate, snapshot);
}
