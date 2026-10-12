// Trusted host-page diagnostics. This is not portable Wydgit code.
WydClient.ready().then(result => {
  document.getElementById('diagnostics').textContent = JSON.stringify({ version: WydClient.version, protocol: WydClient.protocol, ...result }, null, 2);
});
