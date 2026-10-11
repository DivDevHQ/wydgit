// Installer-side validation only; no package JavaScript is executed by Wydgits.
export const validQueryParameter=name=>typeof name==='string'&&/^[a-z][a-z0-9_-]{0,31}$/.test(name)&&!['constructor','prototype','offset'].includes(name);
