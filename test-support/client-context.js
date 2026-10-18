import {ExecutionContext} from '../wydgine/seam/context.js';
export const clientContext = context => new ExecutionContext({...context,runat:'Client',context:'SUB'});
