# Acme canonical Page prototype package

This is a working signed demonstration fixture, not an authenticated real-world
publisher enrollment. Its disposable private key was discarded; only the public
key and signatures are distributed. Do not use this demo key for production trust.

Prototype: `acme/home-page`, derived from `wydgit.core/page`.
Package: `acme/pages`, exact version `1.0.0`.

Integrity: `sha256-yMVC0Eyv/3bXd7k+DpQUVFyLUSOmGSdI1rzfcoxUpyU=`.
Algorithm: Ed25519. Signing-key identifier: `demo-2026`.
Signature (standard padded base64): `p2R0jlBCL6/dkqoLzJO8+kVqwY/hbgE4UiiPV5N8Oa7JyrShJPCScY0Xi9yFGjIIa+jrOE/DBR+A3Qam0wfLBA==`.

Host owners must independently verify the publisher and public key out of band,
then install this binding **before** loading WydClient. A key delivered inside a
package or manifest is never accepted as trust. The included `trust.js` is only
a demonstration of that host decision. Production sites should author their own
local policy, not load a publisher-controlled policy script.

```javascript
globalThis.WydClientConfig = {
  "trustedKeys": [
    {
      "publisher": "acme",
      "keyId": "demo-2026",
      "publicKey": "scm2Zz+y0NJnpQ83atPI7duB2jnYnmmyDfAG3ITh3/Y=",
      "status": "active"
    }
  ]
};
```

Complete ready-to-copy manifest (URLs resolve against the HTML page URL, not the
manifest URL; adjust the URL for your deployment):

```json
{
  "schema": "wydgit.registry/0.1",
  "protocol": "0.1",
  "prototypes": [],
  "packages": [
    {
      "id": "acme/pages",
      "publisher": "acme",
      "version": "1.0.0",
      "url": "publisher/prototypes-1.0.0.json",
      "integrity": "sha256-yMVC0Eyv/3bXd7k+DpQUVFyLUSOmGSdI1rzfcoxUpyU=",
      "algorithm": "Ed25519",
      "keyId": "demo-2026",
      "signature": "p2R0jlBCL6/dkqoLzJO8+kVqwY/hbgE4UiiPV5N8Oa7JyrShJPCScY0Xi9yFGjIIa+jrOE/DBR+A3Qam0wfLBA=="
    }
  ]
}
```

Use one inline `script[type="application/json"]#wydgit-manifest` or one external
`link[rel="wydgit-manifest"]`, then select
`<html data-wydgit-page="acme/home-page">`. Serve the definition file as JSON,
with exactly the published bytes. Reformatting changes its digest. Cross-origin
URLs need explicit host `allowedOrigins` plus the publisher server's CORS headers.

The signed payload is UTF-8 encoding of compact JSON.stringify applied to this
fixed-order array:

```json
["wydgit.prototype-signature/0.1","acme","acme/pages","1.0.0","sha256-yMVC0Eyv/3bXd7k+DpQUVFyLUSOmGSdI1rzfcoxUpyU=","Ed25519","demo-2026"]
```

SHA-256 covers the exact definition response bytes after HTTP content decoding.
To publish your own package, produce the JSON envelope shown in
`prototypes-1.0.0.json`, compute a padded-base64 SHA-256 digest, set identity,
exact version, algorithm and key ID, then sign this fixed-order payload using a
standard Ed25519 implementation. For example, Node's trusted publishing tooling
can call `sign(null, payloadBytes, privateKey).toString('base64')`. Keep private
keys offline/outside websites; distribute the raw 32-byte public key as padded
base64 through an independently authenticated channel.

Rotation: add a newly verified key ID alongside the old binding, then publish a
new pinned version signed by the new key. Revocation: change the old binding to
`status: "revoked"` or remove it and reload the page. H1 has no automatic
revocation service, expiry, anti-rollback policy or live invalidation. Multiple
active IDs are accepted, duplicate bindings are rejected. The host controls key
updates and package pins. Verified origin grants no execution capabilities; H1
executes no package behavior. See [WydClient documentation](../../README.md).
