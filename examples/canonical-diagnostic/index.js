// Trusted non-production fixture. Install as a host-approved runtime library,
// never as an ordinary Wydgit package. No configuration is returned to callers.
export const manifest = {
  schema:'wydgit.library/0.1', id:'wyddiagnostic', version:'1.0.0', apiVersion:'1.0.0',
  publisher:'wydgit.core', trust:'canonical', platform:'^0.3.0-alpha.1', targets:['server'],
  capabilities:['diagnostic.status.read'],
  services:[{name:'ping',capability:'diagnostic.status.read'}]
};
export function register({service,options}) {
  service('ping', () => ({status:'ok'}), {
    authorize: (_,caller) => caller.app === options.site && caller.principal === options.principal &&
      caller.installation === options.installation,
    validate: input => input !== null && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 0
  });
}
