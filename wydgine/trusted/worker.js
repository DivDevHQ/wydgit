// Historical import compatibility; one canonical engine module.
export * from '../../packages/wydgine/src/engine/trusted/worker.js';
// Preserve the historical repository-default embedding entry.
export {createHostApp} from '../../app.js';
