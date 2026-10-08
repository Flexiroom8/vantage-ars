import { EventEmitter } from 'node:events';
import { randomBytes, createHash, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual } from 'node:crypto';
import { eventStore, DomainEvent } from './event-store.js';
import { setting } from '../runtime-config.js';

export type TimeWindow = {
  start: string; // HH:mm format
  end: string; // HH:mm format
  timezone?: string;
};

export type IpWhitelist = string[];

export type PolicyCondition =
  | { type: 'departmentMatch'; department: string }
  | { type: 'ipWhitelist'; whitelist: IpWhitelist }
  | { type: 'timeWindow'; start: string; end: string; timezone?: string };

export type Permission = string;
export type Role = string;

export type PolicyRule = {
  id: string;
  effect: 'allow' | 'deny';
  principals: string[];
  actions: string[];
  resources: string[];
  conditions?: PolicyCondition[] | Record<string, unknown>;
};

export type AccessContext = {
  userId: string;
  roles: Role[];
  permissions: Permission[];
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  metadata: Record<string, unknown>;
};

export type AuditEvent = {
  eventId: string;
  timestamp: string;
  actor: { userId: string; roles: Role[] };
  action: string;
  resource: { type: string; id: string };
  result: 'allowed' | 'denied';
  reason: string;
  context: AccessContext;
  hash: string;
};

export type EncryptedData = {
  algorithm: string;
  iv: string;
  ciphertext: string;
  tag: string;
  keyId: string;
};

export type KeyRotationPolicy = {
  intervalDays: number;
  gracePeriodDays: number;
  autoRotate: boolean;
};

class AdvancedRBAC extends EventEmitter {
  private policies: Map<string, PolicyRule> = new Map();
  private roleHierarchy: Map<Role, Set<Role>> = new Map();
  private userRoles: Map<string, Set<Role>> = new Map();
  private rolePermissions: Map<Role, Set<Permission>> = new Map();
  private resourcePolicies: Map<string, PolicyRule[]> = new Map();
  private defaultDeny = true;

  constructor() {
    super();
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    const defaultRoles: Record<Role, Permission[]> = {
      owner: ['*'],
      admin: ['read:*', 'write:*', 'manage:users', 'manage:roles'],
      reception: ['read:leads', 'write:leads', 'read:messages', 'write:messages'],
      marketing: ['read:leads', 'write:leads', 'read:services', 'write:tasks', 'write:approvals:handoff'],
      sales: ['read:leads:approved', 'write:leads:approved', 'read:services', 'write:tasks', 'write:approvals:offer', 'write:approvals:commitment', 'write:approvals:outcome'],
      finance: ['read:approvals:spend', 'write:approvals:spend', 'read:ledger', 'write:ledger'],
      technical: ['read:approvals:production', 'write:approvals:production', 'read:tickets', 'write:tickets'],
      operations: ['read:tasks', 'write:tasks', 'read:approvals'],
      administration: ['read:tasks', 'write:tasks', 'read:documents'],
      compliance: ['read:*', 'write:audit', 'manage:policies'],
    };

    for (const [role, perms] of Object.entries(defaultRoles)) {
      this.rolePermissions.set(role, new Set(perms));
    }

    this.addPolicy({
      id: 'owner-full-access',
      effect: 'allow',
      principals: ['owner'],
      actions: ['*'],
      resources: ['*'],
    });

    this.addPolicy({
      id: 'admin-manage-users',
      effect: 'allow',
      principals: ['admin'],
      actions: ['manage:users', 'manage:roles'],
      resources: ['users', 'roles'],
    });

    this.addPolicy({
      id: 'department-read-own',
      effect: 'allow',
      principals: ['reception', 'marketing', 'sales', 'finance', 'technical', 'operations', 'administration'],
      actions: ['read:*'],
      resources: ['own-department'],
      conditions: { departmentMatch: true },
    });
  }

  addPolicy(rule: PolicyRule): void {
    this.policies.set(rule.id, rule);
    for (const resource of rule.resources) {
      if (!this.resourcePolicies.has(resource)) this.resourcePolicies.set(resource, []);
      this.resourcePolicies.get(resource)!.push(rule);
    }
    this.emit('policy:added', rule);
  }

  removePolicy(policyId: string): boolean {
    const rule = this.policies.get(policyId);
    if (!rule) return false;
    this.policies.delete(policyId);
    for (const resource of rule.resources) {
      const rules = this.resourcePolicies.get(resource);
      if (rules) {
        const idx = rules.findIndex(r => r.id === policyId);
        if (idx >= 0) rules.splice(idx, 1);
      }
    }
    this.emit('policy:removed', rule);
    return true;
  }

  assignRole(userId: string, role: Role): void {
    if (!this.userRoles.has(userId)) this.userRoles.set(userId, new Set());
    this.userRoles.get(userId)!.add(role);
    this.emit('role:assigned', { userId, role });
  }

  revokeRole(userId: string, role: Role): boolean {
    const roles = this.userRoles.get(userId);
    if (!roles) return false;
    const result = roles.delete(role);
    if (roles.size === 0) this.userRoles.delete(userId);
    this.emit('role:revoked', { userId, role });
    return result;
  }

  getUserRoles(userId: string): Role[] {
    return Array.from(this.userRoles.get(userId) || []);
  }

  addRolePermission(role: Role, permission: Permission): void {
    if (!this.rolePermissions.has(role)) this.rolePermissions.set(role, new Set());
    this.rolePermissions.get(role)!.add(permission);
    this.emit('permission:added', { role, permission });
  }

  removeRolePermission(role: Role, permission: Permission): boolean {
    const perms = this.rolePermissions.get(role);
    if (!perms) return false;
    return perms.delete(permission);
  }

  getRolePermissions(role: Role): Permission[] {
    return Array.from(this.rolePermissions.get(role) || []);
  }

  setRoleHierarchy(parent: Role, children: Role[]): void {
    if (!this.roleHierarchy.has(parent)) this.roleHierarchy.set(parent, new Set());
    for (const child of children) {
      this.roleHierarchy.get(parent)!.add(child);
    }
  }

  checkPermission(context: AccessContext, action: string, resource: string): { allowed: boolean; reason: string; matchedPolicies: PolicyRule[] } {
    const matchedPolicies: PolicyRule[] = [];
    let explicitAllow = false;
    let explicitDeny = false;

    const userRoles = new Set(context.roles);
    for (const role of context.roles) {
      const children = this.getRoleChildren(role);
      for (const child of children) userRoles.add(child);
    }

    const resourceRules = this.resourcePolicies.get(resource) || this.resourcePolicies.get('*') || [];

    for (const rule of resourceRules) {
      const principalMatch = rule.principals.some(p =>
        p === '*' || userRoles.has(p) || context.permissions.includes(p)
      );
      if (!principalMatch) continue;

      const actionMatch = rule.actions.some(a => a === '*' || this.matchAction(a, action));
      if (!actionMatch) continue;

      const resourceMatch = rule.resources.some(r => r === '*' || r === resource);
      if (!resourceMatch) continue;

      const conditionMatch = this.evaluateConditions(rule.conditions, context);
      if (!conditionMatch) continue;

      matchedPolicies.push(rule);

      if (rule.effect === 'allow') explicitAllow = true;
      if (rule.effect === 'deny') explicitDeny = true;
    }

    if (explicitDeny) {
      return { allowed: false, reason: 'Explicit deny policy matched', matchedPolicies };
    }
    if (explicitAllow) {
      return { allowed: true, reason: 'Explicit allow policy matched', matchedPolicies };
    }

    return { allowed: !this.defaultDeny, reason: this.defaultDeny ? 'Default deny' : 'Default allow', matchedPolicies };
  }

  private getRoleChildren(role: Role): Role[] {
    const children = new Set<Role>();
    const queue = [role];
    while (queue.length > 0) {
      const current = queue.pop()!;
      const directChildren = this.roleHierarchy.get(current) || new Set();
      for (const child of directChildren) {
        if (!children.has(child)) {
          children.add(child);
          queue.push(child);
        }
      }
    }
    return Array.from(children);
  }

  private matchAction(pattern: string, action: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) return action.startsWith(pattern.slice(0, -1));
    return pattern === action;
  }

  private evaluateConditions(conditions: Record<string, unknown> | undefined, context: AccessContext): boolean {
    if (!conditions) return true;
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'departmentMatch':
          if (value === true && !context.metadata.department) return false;
          break;
        case 'ipWhitelist':
          if (Array.isArray(value) && context.ip && !value.includes(context.ip)) return false;
          break;
        case 'timeWindow':
          if (value && typeof value === 'object') {
            const { start, end, timezone } = value as { start: string; end: string; timezone?: string };
            const now = new Date();
            const current = now.getHours() * 60 + now.getMinutes();
            const [startH, startM] = start.split(':').map(Number);
            const [endH, endM] = end.split(':').map(Number);
            const startMin = startH * 60 + startM;
            const endMin = endH * 60 + endM;
            if (current < startMin || current > endMin) return false;
          }
          break;
      }
    }
    return true;
  }
}

class EncryptionService extends EventEmitter {
  private keys: Map<string, Buffer> = new Map();
  private currentKeyId: string;
  private algorithm = 'aes-256-gcm';
  private keyRotationPolicy: KeyRotationPolicy = { intervalDays: 90, gracePeriodDays: 7, autoRotate: true };
  private rotationInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.currentKeyId = this.generateKeyId();
    this.keys.set(this.currentKeyId, randomBytes(32));
    this.startKeyRotation();
  }

  private generateKeyId(): string {
    return `key_${randomBytes(16).toString('hex')}`;
  }

  private startKeyRotation(): void {
    if (!this.keyRotationPolicy.autoRotate) return;
    this.rotationInterval = setInterval(() => this.rotateKey(), this.keyRotationPolicy.intervalDays * 24 * 60 * 60 * 1000);
  }

  async rotateKey(): Promise<string> {
    const newKeyId = this.generateKeyId();
    const newKey = randomBytes(32);
    this.keys.set(newKeyId, newKey);
    this.currentKeyId = newKeyId;
    this.emit('key:rotated', { keyId: newKeyId });
    await this.cleanupOldKeys();
    return newKeyId;
  }

  private async cleanupOldKeys(): Promise<void> {
    const cutoff = Date.now() - (this.keyRotationPolicy.intervalDays + this.keyRotationPolicy.gracePeriodDays) * 24 * 60 * 60 * 1000;
    for (const [keyId, key] of this.keys) {
      const created = parseInt(keyId.split('_')[1], 16);
      if (created < cutoff && keyId !== this.currentKeyId) {
        this.keys.delete(keyId);
        this.emit('key:expired', { keyId });
      }
    }
  }

  encrypt(plaintext: string | Buffer, keyId?: string): EncryptedData {
    const key = this.keys.get(keyId || this.currentKeyId);
    if (!key) throw new Error(`Key not found: ${keyId || this.currentKeyId}`);

    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, key, iv);
    const plaintextBuffer = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      algorithm: this.algorithm,
      iv: iv.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      tag: tag.toString('base64'),
      keyId: keyId || this.currentKeyId,
    };
  }

  decrypt(data: EncryptedData): string {
    const key = this.keys.get(data.keyId);
    if (!key) throw new Error(`Key not found: ${data.keyId}`);

    const decipher = createDecipheriv(data.algorithm, key, Buffer.from(data.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(data.tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(data.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }

  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  getKeyIds(): string[] {
    return Array.from(this.keys.keys());
  }

  setKeyRotationPolicy(policy: Partial<KeyRotationPolicy>): void {
    this.keyRotationPolicy = { ...this.keyRotationPolicy, ...policy };
    if (this.rotationInterval) clearInterval(this.rotationInterval);
    this.startKeyRotation();
  }

  shutdown(): void {
    if (this.rotationInterval) clearInterval(this.rotationInterval);
  }
}

class AuditLogger extends EventEmitter {
  private buffer: AuditEvent[] = [];
  private maxBufferSize = 1000;
  private flushInterval: NodeJS.Timeout | null = null;
  private encryptionService: EncryptionService;

  constructor(encryptionService: EncryptionService) {
    super();
    this.encryptionService = encryptionService;
    this.flushInterval = setInterval(() => this.flush(), 10000);
  }

  async log(event: Omit<AuditEvent, 'eventId' | 'timestamp' | 'hash'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = randomBytes(16).toString('hex');
    const payload = { ...event, eventId, timestamp };

    const hash = this.computeHash(payload);
    const auditEvent: AuditEvent = { ...payload, hash };

    this.buffer.push(auditEvent);
    if (this.buffer.length >= this.maxBufferSize) await this.flush();
  }

  private computeHash(event: Omit<AuditEvent, 'hash'>): string {
    return createHash('sha256').update(JSON.stringify(event)).digest('hex');
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const events = this.buffer.splice(0, this.buffer.length);
    for (const event of events) {
      await eventStore.append({
        eventType: 'audit.log',
        aggregateId: event.resource.id,
        aggregateType: event.resource.type,
        payload: event,
        metadata: {
          correlationId: randomBytes(16).toString('hex'),
          causationId: null,
          userId: event.actor.userId,
          timestamp: event.timestamp,
          version: 1,
        },
      });
    }
    this.emit('flushed', events.length);
  }

  async verifyIntegrity(eventId: string): Promise<boolean> {
    const events = await eventStore.getEvents('audit');
    const event = events.find(e => e.payload.eventId === eventId);
    if (!event) return false;
    const computedHash = this.computeHash(event.payload);
    return computedHash === event.payload.hash;
  }

  shutdown(): void {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flush();
  }
}

class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionData> = new Map();
  private maxSessionsPerUser = 5;
  private sessionTimeout = 12 * 60 * 60 * 1000;
  private idleTimeout = 90 * 60 * 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  createSession(userId: string, roles: Role[], metadata: Record<string, unknown> = {}): SessionData {
    const existingSessions = Array.from(this.sessions.values()).filter(s => s.userId === userId);
    if (existingSessions.length >= this.maxSessionsPerUser) {
      const oldest = existingSessions.sort((a, b) => a.createdAt - b.createdAt)[0];
      this.revokeSession(oldest.sessionId);
    }

    const sessionId = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const now = Date.now();

    const session: SessionData = {
      sessionId,
      userId,
      roles,
      csrfToken,
      createdAt: now,
      lastSeen: now,
      expiresAt: now + this.sessionTimeout,
      metadata,
      revoked: false,
    };

    this.sessions.set(sessionId, session);
    this.emit('session:created', { sessionId, userId });
    return session;
  }

  validateSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.revoked) return null;

    const now = Date.now();
    if (session.expiresAt <= now || session.lastSeen + this.idleTimeout <= now) {
      this.revokeSession(sessionId);
      return null;
    }

    session.lastSeen = now;
    return session;
  }

  revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.revoked = true;
    this.sessions.delete(sessionId);
    this.emit('session:revoked', { sessionId, userId: session.userId });
    return true;
  }

  revokeAllUserSessions(userId: string): number {
    let count = 0;
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) {
        this.revokeSession(sessionId);
        count++;
      }
    }
    return count;
  }

  validateCsrf(sessionId: string, token: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.csrfToken === token && !session.revoked;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now || session.lastSeen + this.idleTimeout <= now) {
        this.revokeSession(sessionId);
      }
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}

type SessionData = {
  sessionId: string;
  userId: string;
  roles: Role[];
  csrfToken: string;
  createdAt: number;
  lastSeen: number;
  expiresAt: number;
  metadata: Record<string, unknown>;
  revoked: boolean;
};

export const rbac = new AdvancedRBAC();
export const encryption = new EncryptionService();
export const auditLogger = new AuditLogger(encryption);
export const sessionManager = new SessionManager();

export async function initializeSecurity(): Promise<void> {
  await eventStore.append({
    eventType: 'security.initialized',
    aggregateId: 'system',
    aggregateType: 'Security',
    payload: { version: '3.0.0' },
    metadata: { correlationId: randomBytes(16).toString('hex'), causationId: null, userId: 'system', timestamp: new Date().toISOString(), version: 1 },
  });
}