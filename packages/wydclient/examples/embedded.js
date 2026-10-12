// Trusted host integration, not portable Wydgit execution or a profile builder.
for (const id of ['profile-alex', 'profile-sam']) {
  const root = document.getElementById(id);
  const profile = WydClient.mount({ root });
  profile.ready().then(result => {
    root.querySelector('[data-profile-diagnostics]').textContent = JSON.stringify(result, null, 2);
  });
}
