import { check } from './validation.js';
import { effective, permission } from './authorization.js';

// Private implementation contract. Identity facts are lookup keys, never grants.
// A decision is valid for this admission only; callers never receive a token.
export function requireSitePolicy(data, caller, app, idle, required, enabled) {
  check(enabled && caller.runat === 'Server' && caller.app === app &&
    required.contexts.includes(caller.context) && permission(required.permission), 'GATE.DENIED');
  const identity = caller.identity, now = Date.now();
  check(identity?.authenticated === true && identity.app === app, 'GATE.DENIED');
  const session = data.sessions.find(s => s.id === identity.sessionId && s.userId === identity.userId);
  check(session && !session.revoked && session.createdAt === identity.createdAt &&
    session.expiresAt === identity.expiresAt && session.createdAt <= now && session.expiresAt > now &&
    (session.lastSeenAt ?? session.createdAt) <= now &&
    now - (session.lastSeenAt ?? session.createdAt) < idle &&
    data.users.some(u => u.id === session.userId && u.active), 'GATE.SESSION_INVALID');
  check(data.membership?.app === app, 'GATE.DENIED');
  const member = data.membership.members.find(m => m.accountId === session.userId && m.app === app);
  check(member && member.id === identity.membershipId && member.status === 'active', 'GATE.DENIED');
  check(effective(data, session.userId).permissions.includes(required.permission), 'GATE.DENIED');
  return true;
}

// Existing operation/capability vocabulary also names the independent Gate
// permission. Matching strings do not equate the two independent approvals.
const administrative = {
  'create-user':'gate.users.create', 'get-user':'gate.users.read', 'find-user':'gate.users.read',
  'update-user':'gate.users.update', 'change-password':'gate.credentials.manage',
  'revoke-session':'gate.sessions.manage', 'assign-user':'gate.roles.manage',
  'get-authorization':'gate.users.read', 'get-profile':'gate.users.read', 'update-profile':'gate.users.update',
  'list-members':'gate.members.manage', 'manage-member':'gate.members.manage', 'invite-member':'gate.members.manage',
  ...Object.fromEntries(['create','get','update','delete'].flatMap(action => [
    [`${action}-role`, 'gate.roles.manage'], [`${action}-group`, 'gate.groups.manage']
  ]))
};
export function administrativePolicy(operation, caller) {
  // Uninstalled native operator contexts retain explicit provisioning access.
  // Ordinary package executions always have a trusted installation identity.
  return caller.installation !== null && administrative[operation]
    ? {contexts:['BackOffice'], permission:administrative[operation]} : null;
}
