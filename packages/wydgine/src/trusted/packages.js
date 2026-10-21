// Native host infrastructure only. Never register this module as a SEAM provider.
export {createBackOfficeActions} from '../engine/packages/backoffice.js';
export {
  inspectPackagePolicy, planPackagePolicy, approvePackagePolicy, applyPackagePolicy, cancelPackagePolicy,
  planExecutionPlacement, executionPlacement, acquirePackageExecution,
  planPackageOperation, applyPackageOperation, packageOperation,
  planManualReplacement, manualReplacement, inspectManualReplacement,
  inspectPackageOperation, recoverPackageOperation,
  inspectPackageEffects, recoverPackageEffects, rollbackPackageEffects
} from '../engine/packages/index.js';
// Native inspection remains non-authoritative. Adoption uses the reviewed policy
// exports above; these validators never publish approval or activate runtime entry.
export {inspectBackOfficeMigration} from '../engine/packages/backoffice-preflight.js';
export {validateBackOfficePageEntry,validateBackOfficeActionScope} from '../engine/packages/backoffice-preflight-contract.js';
