// Trusted Page-owned service completion. No control object enters canonical data.
export function createCompletion(check) {
  const pending=new Set(),effects=[];let closed=false;
  return Object.freeze({
    async run(work) {
      check();if(closed)throw new Error('Execution closed');
      const effect={state:'none'};effects.push(effect);
      const operation=Object.freeze({
        check,
        begin(){check();effect.state='indeterminate';},
        cancelled(){if(effect.state==='indeterminate')effect.state='none';},
        committed(){effect.state='committed';}
      });
      const task=Promise.resolve().then(()=>work(operation));pending.add(task);
      try{return await task;}finally{pending.delete(task);}
    },
    async settle(){closed=true;await Promise.allSettled([...pending]);},
    outcome(failed=false){return effects.some(e=>e.state==='indeterminate')||failed&&effects.some(e=>e.state==='committed')?'indeterminate':effects.some(e=>e.state==='committed')?'committed':'not-committed';}
  });
}
