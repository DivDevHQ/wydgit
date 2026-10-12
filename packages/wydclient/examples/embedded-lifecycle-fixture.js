// Real-browser test fixture only. No portable instance creation or rendering.
(async () => {
  const makeRoot = parent => { const root = document.createElement('section'); root.setAttribute('data-wydgit-root', ''); parent.append(root); return root; };
  const directRegions = root => [...root.children].filter(e => e.hasAttribute('data-wydclient-region')).length;
  const outer = makeRoot(document.body), inner = makeRoot(outer), peer = makeRoot(document.body);
  const a = WydClient.mount({ root: outer }), b = WydClient.mount({ root: inner }), c = WydClient.mount({ root: peer });
  const results = await Promise.all([a.ready(), b.ready(), c.ready()]);
  const repeated = WydClient.mount({ root: outer }) === a;
  a.unmount();
  const independent = b.state === 'ready' && c.state === 'ready' && directRegions(inner) === 2;
  const replacement = WydClient.mount({ root: outer }); const remounted = await replacement.ready();
  b.unmount();
  const nested = replacement.state === 'ready' && directRegions(outer) === 2 && directRegions(inner) === 0;
  const pendingRoot = makeRoot(document.body), link = document.createElement('link'); link.rel = 'wydgit-manifest'; link.href = '/examples/manifest.json'; pendingRoot.append(link);
  const pending = WydClient.mount({ root: pendingRoot }), ready = pending.ready(); pending.unmount();
  const canceled = (await ready).state === 'disposed' && directRegions(pendingRoot) === 0;
  // A failed root cannot read its sibling's registry or the document's trusted keys.
  const bad = makeRoot(document.body); bad.setAttribute('data-wydgit-page', 'acme/home-page');
  const rejected = await WydClient.mount({ root: bad }).ready();
  const signedRoot = makeRoot(document.body), untrustedRoot = makeRoot(document.body);
  const manifest = await (await fetch('/examples/signed-manifest.json')).json();
  manifest.packages[0].url = '/examples/publisher/prototypes-1.0.0.json';
  const key = await (await fetch('/examples/publisher/trusted-key.json')).json(); // Test-only independently selected fixture key.
  for (const root of [signedRoot, untrustedRoot]) { const script = document.createElement('script'); script.type = 'application/json'; script.setAttribute('data-wydgit-manifest', ''); script.textContent = JSON.stringify(manifest); root.append(script); root.setAttribute('data-wydgit-page', 'acme/home-page'); }
  const [signed, untrusted] = await Promise.all([WydClient.mount({ root: signedRoot, policy: { trustedKeys: [key] } }).ready(), WydClient.mount({ root: untrustedRoot }).ready()]);
  const host = await WydClient.ready();
  document.getElementById('embedded-results').textContent = JSON.stringify({ repeated, independent, nested, canceled,
    unique: new Set([...results, remounted, host].map(r => r.page.id)).size === 5,
    isolated: rejected.diagnostics[0]?.code === 'PAGE.PROTOTYPE' && signed.ok && untrusted.diagnostics[0]?.code === 'PACKAGE.UNTRUSTED_KEY',
    okay: results.every(r => r.ok) && host.ok });
})();
