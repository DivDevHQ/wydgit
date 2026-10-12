// Demo host policy: configure only after independently verifying the publisher key.
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
