import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { membershipFixture } from '../test-support/membership.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createGate } from '@wydgit/gate/client';

const plain = value => JSON.parse(JSON.stringify(value));
const denied = (work, code = 'GATE.DENIED') => assert.rejects(work, {code});
for (const provider of ['json','sqlite']) {
  test(`GAT-01/02 ADM-01 ${provider}: direct installed Gate administration intersects current permission, context and SEAM`, async t => {
    const f = await membershipFixture(t, provider);
    const user = await f.gate.register({username:'alice', password:f.password});
    await f.gate.manageMember({id:user.membership.id, role:'administrator'});
    const login = await f.gate.login('alice',f.password), identity = await f.gate.resolveSession(login.token);
    const context = (extra={}) => new ExecutionContext({context:'BackOffice',publisher:'divdev',package:'divdev/admin',
      installation:'admin-install',self:'admin',app:'boilerplate',identity,
      capabilities:['gate.members.manage','gate.roles.manage'],scopes:{wydgate:['boilerplate']},...extra});
    const gate = extra => createGate(f.libraries.bind(context(extra)));
    await denied(() => gate().listMembers()); // Administrator label alone.
    const role = await f.gate.createRole({name:'Administrator',permissions:['gate.members.manage']});
    await f.gate.assignUser({userId:user.account.id,roles:[role.id],permissions:[]});
    assert.equal((await gate().listMembers()).total,1);
    await denied(() => gate({capabilities:[]}).listMembers(),'SEAM.DENIED');
    await denied(() => gate({context:'FrontEnd'}).listMembers());
    await denied(() => gate({identity:null}).listMembers());
    await denied(() => gate({app:'foreign',identity:null}).listMembers());
    for (const patch of [{sessionId:`s_${randomUUID()}`},{userId:`u_${randomUUID()}`},{membershipId:`m_${randomUUID()}`},
      {createdAt:identity.createdAt+1},{expiresAt:identity.expiresAt+1}])
      await assert.rejects(() => gate({identity:{...identity,...patch}}).listMembers());
    await denied(() => gate().createRole({name:'Self elevation',permissions:['gate.roles.manage']}));
    const cached = gate();
    await f.gate.updateRole({id:role.id,permissions:[]});
    await denied(() => cached.listMembers());
    await f.gate.assignUser({userId:user.account.id,roles:[],permissions:['gate.members.manage']});
    assert.equal((await cached.listMembers()).total,1); // Uses live policy, not frozen facts.
    const now = t.mock.method(Date,'now',()=>login.session.expiresAt);
    await denied(() => cached.listMembers(),'GATE.SESSION_INVALID');now.mock.restore();
    await f.gate.logout(login.token);
    await denied(() => cached.listMembers(),'GATE.SESSION_INVALID');
  });

  test(`GAT-03 ${provider}: suspended, departed and disabled subjects cannot reuse Gate authority`, async t => {
    const f = await membershipFixture(t,provider);
    const user = await f.gate.register({username:'alice',password:f.password});
    await f.gate.manageMember({id:user.membership.id,role:'administrator'});
    await f.gate.assignUser({userId:user.account.id,roles:[],permissions:['gate.members.manage']});
    const login = await f.gate.login('alice',f.password), identity = await f.gate.resolveSession(login.token);
    const caller = new ExecutionContext({context:'BackOffice',publisher:'divdev',package:'divdev/admin',installation:'install',
      self:'admin',app:'boilerplate',identity,capabilities:['gate.members.manage'],scopes:{wydgate:['boilerplate']}});
    const gate = createGate(f.libraries.bind(caller));
    for (const status of ['suspended','left']) {
      await f.gate.manageMember({id:user.membership.id,status});
      await assert.rejects(() => gate.listMembers());
      await f.gate.manageMember({id:user.membership.id,status:'active'});
    }
    await f.gate.updateUser({id:user.account.id,active:false});
    await denied(() => gate.listMembers(),'GATE.SESSION_INVALID');
    assert.doesNotMatch(JSON.stringify(plain(caller.identity)), /passwordHash|digest|token/);
  });
}
