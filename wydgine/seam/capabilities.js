export const isCapability = value => typeof value === 'string' && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(value);
