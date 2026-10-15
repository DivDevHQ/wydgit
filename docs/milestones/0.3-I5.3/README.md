# I5.3 — Provider registry and safe setup plans

Wydgine executes Apps. WydHosting operates hosting infrastructure. This milestone
implements provider placement approval and registry-only setup operations in a private
**local fixture adapter**. It does not start Apps, copy data or certify OS isolation.
Platform and private development adapters remain **0.3.0-alpha.12**; WydClient remains
**0.1.0-alpha.8**. No public runtime contract or published package changes justify a
platform/client bump. Independent packaging is the next gate, I5.4.

## Modules

| File under `packages/wydhosting` | Responsibility |
| --- | --- |
| `package.json` | Private workspace/bin; exact development dependency on Wydgine |
| `src/contracts.js` | Closed provider records, identities, entitlements and relationships |
| `src/adapter.js` | Trusted fixture confinement, snapshot fingerprints, global namespace checks and canonical inventory compilation |
| `src/planning.js` | Typed requests, deterministic proposals and integrity verification |
| `src/registry.js` | Private state envelope, embedded operation journal, writer exclusion, authorization, apply and reconciliation |
| `src/index.js` | Small trusted Node facade, no portable capability registration |
| `bin/wydhosting.js` | Strict local inspect/validate/plan/apply/reconcile CLI |
| `test/provider.test.js` | Policy, hostile inputs, real canonical Apps, crash/replay and CLI evidence |

The dependency points toward the existing Wydgine inventory, routing, governance,
JSON and identity contracts. The engine never imports WydHosting. No second App
validator, controller, SEAM authority registry, endpoint or arbitrary execution hook
is introduced. The direct repository imports are deliberate development adapters;
the package has no independent dependency closure yet.

Read [registry contract](registry-contract.md), [planning and recovery](planning-recovery.md)
and [verification](verification.md).

## Disposable fixture and CLI

Use this checkout with its existing dependencies. No npx download or npm publication
is needed. Create an empty private state directory separately from the approved fixture
root. Bootstrap is an explicit trusted Node operation, not a missing-file fallback:

```sh
mkdir -m 700 /tmp/my-provider-state /tmp/my-provider-fixture
node --input-type=module <<'JS'
import {createRegistry} from './packages/wydhosting/src/index.js';
const registry = createRegistry({
  directory: '/tmp/my-provider-state',
  fixtureRoot: '/tmp/my-provider-fixture',
  // This example is an already-authorized local fixture operator.
  // Real trusted frontends must perform their own exact-operation authorization.
  authorize: () => 'fixture-operator'
});
await registry.initialize('my-provider');
JS
npm run wydhosting -- inspect --directory /tmp/my-provider-state --fixture-root /tmp/my-provider-fixture
npm run wydhosting -- validate --directory /tmp/my-provider-state --fixture-root /tmp/my-provider-fixture
```

Initialization requests `wydhosting.initialize/1`, operation `initialize`, expected
revision `null` (file must be absent). Reinitialization refuses an existing file.
The operator must own the private directory; filesystem ancestry must not contain links.
All source/home/pool path declarations must be strict descendants of the separately
supplied trusted fixture root. The root is never taken from registry or publisher data.
Do not use a shared writable fixture root. Production `/home` mappings and staging
remain future adapter work.

Prepare a closed request file, for example to register a pinned free entitlement:

```json
{
  "schema": "wydhosting.request/1",
  "operationId": "add-free-policy",
  "expectedRevision": 0,
  "expiresAt": 0,
  "actions": [{
    "kind": "registerPlan",
    "record": {
      "planId": "free", "revision": 1, "tier": "free",
      "maxApps": 1, "maxPools": 1, "allowPerApp": false,
      "resources": {"maxPending": 4, "httpConcurrent": 2, "directConcurrent": 2, "payloadBytes": 1048576},
      "limits": {"sewnSteps": 100}
    }
  }]
}
```

Replace `expiresAt:0` with an epoch millisecond time in the next hour; the literal
example is intentionally expired. Then use the direct bin when capturing JSON, since
npm's script banner is not JSON:

```sh
node packages/wydhosting/bin/wydhosting.js plan --directory /tmp/my-provider-state --fixture-root /tmp/my-provider-fixture --input /tmp/request.json > /tmp/reviewed-plan.json
# Review the complete proposed state, required operations, warnings and digest.
node packages/wydhosting/bin/wydhosting.js apply --directory /tmp/my-provider-state --fixture-root /tmp/my-provider-fixture --input /tmp/reviewed-plan.json --plan add-free-policy --approve <reviewed-digest>
npm run wydhosting -- reconcile --directory /tmp/my-provider-state --fixture-root /tmp/my-provider-fixture
```

Shell redirection saves the plan at the operator's request; planning itself never
persists plans or locks. `--plan` selects the exact operation ID inside `--input`;
there is no hidden plan database. `reconcile --input <plan-file>` distinguishes an
unapplied proposal from a recorded result. Unknown/duplicate flags and extra inputs
fail. `inspect` reports counts/revision without sensitive paths; plan output necessarily
shows paths for operator review. Errors use fixed sanitized codes and no raw exceptions.

`--approve <digest>` is explicit consent by an already trusted local OS operator.
It is not remote authentication or a customer credential. Programmatic apply has no
default authorization: the trusted constructor's `authorize(frozenPlan)` must return
an opaque actor ID for the exact proposal. Booleans and `{isAdmin:true}` are rejected.
Never install an unconditional authorizer in a customer-facing process.

## Scope and next phases

I4's schema was a proposal. The implemented closed subset deliberately stores one
placement per canonical App rather than redundant placement/registration tables;
subscriptions are pinned customer fields. `hostId` is only `local`. Linux records
say `intended`, never `provisioned`. Generation is a desired pool counter, not a live
worker observation. Domains record operator evidence references, not DNS verification.
Gate associations and billing are absent. All protected roots remain reserved after
retirement; garbage collection and identity reuse require a future reviewed protocol.

I5.4 should first expose existing trusted engine validation/helpers through the packed
engine, move one coherent engine/metadata/assets closure, preserve compatibility imports
and module brands, then replace provider repository imports. Verify real isolated
consumer installs (service-free and all five libraries), optional implementation/native
resolution and exact prerelease dependency closure with WydHosting absent. Pack dry
runs here do not meet that gate. I5.5 owns processes/IPC/supervision; I5.6 owns race-safe
staging, accounts, kernel isolation/private ingress and Linux qualification; I5.7 owns
stopped migration and real cutover recovery; I5.8 owns integrated release decisions.
No tagging, publication, public administration, commercial billing, DNS/certificate
automation, live migration, firewall/proxy/systemd changes or OS implementation is added.
