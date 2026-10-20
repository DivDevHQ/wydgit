// Trusted installation guard only. Both operands come from fresh lstatSync calls
// with bigint:true, in the same fixed file order. This compares exactly the old
// dev:ino:size:mtimeNs:ctimeNs representation, without decimal string conversion.
// It does not establish integrity, authorize work, cache a result or skip I/O.
const fields=['dev','ino','size','mtimeNs','ctimeNs'];
export function sameInstallationStamp(left,right){
  return left.length===right.length&&left.every((stat,index)=>{
    const next=right[index];
    return stat===undefined?next===undefined:next!==undefined&&fields.every(field=>stat[field]===next[field]);
  });
}
