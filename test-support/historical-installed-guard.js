// Historical experiments pin the execution guard, independently of subsequent
// native lifecycle features elsewhere in the containing package module.
export function installedGuardSource(text){
  const start=text.indexOf('function guardInstalledExecution('),end=text.indexOf('\nexport async function planExecutionPlacement(',start);
  if(start<0||end<=start)throw Error('Historical installed guard anchors changed');
  return text.slice(start,end);
}
