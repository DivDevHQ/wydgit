// Fixture only. No import-time registration, infrastructure, or policy access.
export const manifest = {
  schema: 'wydgit.library/0.1',
  id: 'wydtest',
  version: '1.0.0',
  publisher: 'wydgit.core',
  trust: 'canonical',
  platform: '^0.2.0-alpha.3',
  targets: ['server'],
  capabilities: ['test.echo.read'],
  services: [{ name: 'echo', capability: 'test.echo.read' }]
};
export function register({ service }) {
  service('echo', value => value);
}
