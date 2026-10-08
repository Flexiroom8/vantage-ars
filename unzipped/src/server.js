import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { setting } from './runtime-config.js';
import { snapshot, transact, auditEntries, verifyAudit, restoreWorkspaceBackup, id } from './store.js';
import { constitution, evaluate, execute } from './engine.js';
import { roles, leadStages, taskStatuses, approvalKinds, agentCanRequest } from './roles.js';
import {
  hashPassword, verifyPassword, issueSession, sessionFor, requireCsrf,
  setSessionCookie, clearSessionCookie, destroySession, saveOwner,
  ownerSummary, checkAgentKey, mintAgentKey, revokeAgentKey
} from './security.js';
import { logger, createRequestLogger, logRequest, logError, logAuth, logAudit } from './logger.js';

const publicDir = path.resolve('public');
const maxBodyBytes = 64 * 1024;
const loginAttempts = new Map();
const publicLeadAttempts = new Map();
const ownerApiAttempts = new Map();
const agentApiAttempts = new Map();
const publicApiAttempts = new Map();
const OWNER_API_LIMIT = 120;
const OWNER_API_WINDOW = 60 * 1000;
const AGENT_API_LIMIT = 60;
const AGENT_API_WINDOW = 60 * 1000;
const PUBLIC_API_LIMIT = 30;
const PUBLIC_API_WINDOW = 60 * 1000;

/**
 * Checks and enforces the owner API rate limit.
 * Owner requests are limited to 120 per 15 minutes.
 * @param {string} ip - The client IP address
 * @returns {boolean} True if rate limit is exceeded, false otherwise
 */
function checkOwnerApiRateLimit(ip) {
  const now = Date.now();
  const current = ownerApiAttempts.get(ip) || { count: 0, windowStart: now };
  if (now - current.windowStart > OWNER_API_WINDOW) {
    current.count = 0;
    current.windowStart = now;
  }
  if (current.count >= OWNER_API_LIMIT) return false;
  current.count++;
  ownerApiAttempts.set(ip, current);
  return true;
}

/**
 * Checks and enforces the agent API rate limit.
 * Agent requests are limited to 60 per 15 minutes.
 * @param {string} ip - The client IP address
 * @returns {boolean} True if rate limit is exceeded, false otherwise
 */
function checkAgentApiRateLimit(ip) {
  const now = Date.now();
  const current = agentApiAttempts.get(ip) || { count: 0, windowStart: now };
  if (now - current.windowStart > AGENT_API_WINDOW) {
    current.count = 0;
    current.windowStart = now;
  }
  if (current.count >= AGENT_API_LIMIT) return false;
  current.count++;
  agentApiAttempts.set(ip, current);
  return true;
}

/**
 * Checks and enforces the public API rate limit.
 * Public requests are limited to 30 per 15 minutes.
 * @param {string} ip - The client IP address
 * @returns {boolean} True if rate limit is exceeded, false otherwise
 */
function checkPublicApiRateLimit(ip) {
  const now = Date.now();
  const current = publicApiAttempts.get(ip) || { count: 0, windowStart: now };
  if (now - current.windowStart > PUBLIC_API_WINDOW) {
    current.count = 0;
    current.windowStart = now;
  }
  if (current.count >= PUBLIC_API_LIMIT) return false;
  current.count++;
  publicApiAttempts.set(ip, current);
  return true;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
/**
 * Send a JSON response.
 * @param {import("http").ServerResponse} res - HTTP response object
 * @param {number} status - HTTP status code
 * @param {*} value - Value to serialize as JSON
 * @returns {void}
 */
function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function readBody(req, bodyLimit = maxBodyBytes) {
  const pieces = [];
  let size = 0;
  for await (const piece of req) {
    size += piece.length;
    if (size > bodyLimit) {
      const limitLabel = bodyLimit < 1024 * 1024 ? `${Math.floor(bodyLimit / 1024)} KB` : `${Math.floor(bodyLimit / (1024 * 1024))} MB`;
      throw new HttpError(413, `Request body exceeds ${limitLabel}`);
    }
    pieces.push(piece);
  }
  if (!pieces.length) return {};
  try {
    const value = JSON.parse(Buffer.concat(pieces).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
    return value;
  } catch { throw new HttpError(400, 'Request body must be a JSON object'); }
}
async function readFormBody(req) {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') throw new HttpError(415, 'Enquiry form must use URL-encoded form data');
  const pieces = [];
  let size = 0;
  for await (const piece of req) {
    size += piece.length;
    if (size > maxBodyBytes) throw new HttpError(413, 'Enquiry form exceeds 64 KB');
    pieces.push(piece);
  }
  const params = new URLSearchParams(Buffer.concat(pieces).toString('utf8'));
  const value = {};
  for (const [key, entry] of params) {
    if (Object.hasOwn(value, key)) throw new HttpError(400, 'Duplicate form field');
    value[key] = entry;
  }
  return value;
}
const text = (value, label, min = 1, max = 1000) => {
  if (typeof value !== 'string') throw new HttpError(400, `${label} is required`);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new HttpError(400, `${label} must be between ${min} and ${max} characters`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw new HttpError(400, `${label} contains unsupported control characters`);
  return result;
};
const emailAddress = value => {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
};
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function clientAddress(req) {
  if (setting('TRUST_PROXY') === 'true') {
    const cloudflareIp = typeof req.headers['cf-connecting-ip'] === 'string' ? req.headers['cf-connecting-ip'].trim() : '';
    if (net.isIP(cloudflareIp)) return cloudflareIp;
  }
  return req.socket.remoteAddress || 'unknown';
}
function requireOwner(req, mutation = false, allowAuditFailure = false) {
  const session = sessionFor(req);
  if (!session) throw new HttpError(401, 'Sign in to access this workspace');
  if (mutation && (!sameOrigin(req) || !requireCsrf(req))) throw new HttpError(403, 'The session check failed. Refresh the page and try again.');
  if (mutation && !allowAuditFailure && !verifyAudit().valid) throw new HttpError(503, 'Workspace changes are paused because the audit chain failed verification');
  return session.owner;
}
function requireAgent(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const identity = match ? checkAgentKey(match[1]) : null;
  if (!identity) throw new HttpError(401, 'A valid role credential is required');
  return identity;
}
function secureHeaders(res, pathname = '') {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  const dashboardPolicy = "default-src 'self'; script-src 'self' 'sha256-HlsC6U586bjxDsHd6uGG1h2ZLTlx6gqtf9yhGYVrRdc='; style-src 'self' 'sha256-0/CWAZ1ia+1j6CYGRI7mhDcv4FtFXRQnuQPb88LNPsM='; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
  const defaultPolicy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
  res.setHeader('content-security-policy', pathname === '/autonomous-office.html' ? dashboardPolicy : defaultPolicy);
  if (setting('NODE_ENV') === 'production') res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
}
function makeLead(input, actor) {
  const name = text(input.name, 'Contact name', 2, 160);
  const email = input.email ? emailAddress(input.email) : null;
  const phone = input.phone ? text(input.phone, 'Phone', 3, 40) : null;
  if (input.email && !email) throw new HttpError(400, 'Enter a valid email address');
  if (phone && !/^[+()0-9 .-]+$/.test(phone)) throw new HttpError(400, 'Phone may contain only digits, spaces, +, -, parentheses, and periods');
  if (phone && phone.replace(/\D/g, '').length < 5) throw new HttpError(400, 'Phone must contain at least five digits');
  if (!email && !phone) throw new HttpError(400, 'Add an email address or phone number');
  const organization = input.organization ? text(input.organization, 'Organization', 1, 160) : '';
  const source = input.source ? text(input.source, 'Source', 1, 120) : '';
  const detailsInput = input.details || input.message || '';
  const details = detailsInput ? text(detailsInput, 'Enquiry details', 1, 3000) : '';
  const phoneDigits = phone?.replace(/\D/g, '');
  const duplicate = snapshot().leads.find(lead => (email && lead.email === email) || (phoneDigits && lead.phone?.replace(/\D/g, '') === phoneDigits));
  if (duplicate) throw new HttpError(409, `A lead with these contact details already exists (${duplicate.id})`);
  return { id: id('lead'), created_at: new Date().toISOString(), created_by: actor, name, email, phone, organization, source, details, stage: 'enquiry' };
}
function publicLeadAllowed(req) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      const isWebsite = ['vantage-ars.co.za', 'www.vantage-ars.co.za'].includes(parsed.hostname) && parsed.protocol === 'https:';
      if (!isWebsite && !sameOrigin(req)) return false;
    } catch { return false; }
  }
  const ip = clientAddress(req);
  const now = Date.now();
  for (const [key, value] of publicLeadAttempts) if (value.until <= now) publicLeadAttempts.delete(key);
  if (publicLeadAttempts.size > 10000 && !publicLeadAttempts.has(ip)) return false;
  const current = publicLeadAttempts.get(ip) || { count: 0, until: now + 60 * 60 * 1000 };
  if (current.until <= now) { current.count = 0; current.until = now + 60 * 60 * 1000; }
  if (current.count >= 5) return false;
  current.count++;
  publicLeadAttempts.set(ip, current);
  return true;
}
function publicLeadResponse(res, status, title, message) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'" });
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · VANTAGE ARS</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:1rem"><h1>${title}</h1><p>${message}</p><p><a href="https://vantage-ars.co.za/">Return to VANTAGE ARS</a></p></body></html>`);
}
async function publicLeadRoute(req, res) {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  if (!publicLeadAllowed(req)) return publicLeadResponse(res, 429, 'Please try again later', 'The enquiry could not be accepted right now. Please try again later.');
  const input = await readFormBody(req);
  if (typeof input.website === 'string' && input.website.trim()) return publicLeadResponse(res, 200, 'Thank you', 'Your enquiry has been received.');
  if (!input.message) throw new HttpError(400, 'Tell us briefly what you need help with');
  if (!verifyAudit().valid) throw new HttpError(503, 'The enquiry system is temporarily unavailable');
  const suppliedEmail = emailAddress(input.email);
  if (suppliedEmail && snapshot().leads.some(item => item.email === suppliedEmail)) return publicLeadResponse(res, 200, 'Thank you', 'Your enquiry has been received.');
  const lowerMessage = (input.message || '').toLowerCase();
  const spamPatterns = ['bitcoin', 'crypto', 'bit coin', 'buy now', 'click here', 'work from home', 'make money', 'earn extra', 'guaranteed', 'risk free', 'limited time', 'act now'];
  if (spamPatterns.some(p => lowerMessage.includes(p))) return publicLeadResponse(res, 200, 'Thank you', 'Your enquiry has been received.');
  const lead = makeLead({ ...input, source: 'website' }, 'website');
  recordLead(lead);
  return publicLeadResponse(res, 201, 'Thank you', 'Your enquiry has been received. The VANTAGE ARS team will review it.');
}
function makeTask(input, actor, forcedDepartment) {
  const department = forcedDepartment || input.department;
  if (!roles[department]) throw new HttpError(400, 'Choose a valid department');
  let dueDate = null;
  if (input.due_date) {
    if (typeof input.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) throw new HttpError(400, 'Due date must be a valid calendar date');
    const parsedDate = new Date(`${input.due_date}T00:00:00Z`);
    if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== input.due_date) throw new HttpError(400, 'Due date must be a valid calendar date');
    dueDate = input.due_date;
  }
  return {
    id: id('task'), created_at: new Date().toISOString(), created_by: actor,
    department, title: text(input.title, 'Task title', 3, 160),
    description: input.description ? text(input.description, 'Task details', 1, 2000) : '',
    status: 'open', due_date: dueDate
  };
}
function makeService(input, existing = null) {
  const title = text(input.title, 'Service name', 3, 160);
  const description = input.description ? text(input.description, 'Service details', 1, 2000) : '';
  let priceCents = existing?.price_cents ?? null;
  if (Object.hasOwn(input, 'price_cents')) {
    if (input.price_cents === '' || input.price_cents === null) priceCents = null;
    else if (!Number.isSafeInteger(input.price_cents) || input.price_cents < 0) throw new HttpError(400, 'Price must be a non-negative whole amount in ZAR cents');
    else priceCents = input.price_cents;
  }
  const status = input.status || existing?.status || 'draft';
  if (!['draft', 'available', 'paused'].includes(status)) throw new HttpError(400, 'Choose draft, available, or paused');
  return { title, description, price_cents: priceCents, currency: 'ZAR', status };
}
function makeMessageDraft(input, actor, role) {
  const leadId = text(input.lead_id, 'Enquiry', 5, 100);
  const lead = snapshot().leads.find(item => item.id === leadId);
  if (!lead) throw new HttpError(404, 'Enquiry not found');
  const allowedStages = role === 'owner' ? leadStages : role === 'reception' ? ['enquiry'] : role === 'marketing' ? ['enquiry', 'marketing_review'] : ['sales_queue', 'sales_working'];
  if (!allowedStages.includes(lead.stage)) throw new HttpError(403, 'This role cannot prepare a message for this enquiry');
  const channel = input.channel;
  if (!['email', 'sms', 'whatsapp', 'manual'].includes(channel)) throw new HttpError(400, 'Choose email, SMS, WhatsApp, or manual');
  if (channel === 'email' && !lead.email) throw new HttpError(409, 'This enquiry has no email address');
  if (['sms', 'whatsapp'].includes(channel) && !lead.phone) throw new HttpError(409, 'This enquiry has no phone number');
  return {
    id: id('draft'), created_at: new Date().toISOString(), created_by: actor, requested_role: role,
    lead_id: leadId, channel, subject: input.subject ? text(input.subject, 'Subject', 1, 200) : '',
    body: text(input.body, 'Message draft', 1, 5000), status: 'pending_review',
    review: null, delivery: { enabled: false, sent_at: null, attempts: 0, last_attempt: null, status: 'pending' }
  };
}
function makeBusinessProfile(input) {
  const current = snapshot().businessProfile;
  const value = { ...current };
  if (Object.hasOwn(input, 'name')) value.name = text(input.name, 'Business name', 2, 160);
  if (Object.hasOwn(input, 'domain')) {
    const domain = text(input.domain, 'Domain', 1, 253).toLowerCase();
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw new HttpError(400, 'Enter a valid domain name without a URL path');
    value.domain = domain;
  }
  for (const [key, label, max] of [['offering', 'What the business sells', 2000], ['target_customers', 'Target customers', 1000], ['service_area', 'Service area', 500]]) {
    if (!Object.hasOwn(input, key)) continue;
    if (typeof input[key] !== 'string' || input[key].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input[key])) throw new HttpError(400, `${label} must be at most ${max} characters and contain no control characters`);
    value[key] = input[key].trim();
  }
  value.currency = 'ZAR';
  value.updated_at = new Date().toISOString();
  return value;
}
function makeApproval(input, actor, role) {
  if (!Object.hasOwn(approvalKinds, input.kind) || (role !== 'owner' && !agentCanRequest(role, input.kind))) throw new HttpError(403, 'This role cannot request that approval');
  const summary = text(input.summary, 'Request summary', 5, 240);
  const rationale = text(input.rationale, 'Reason', 5, 2000);
  let leadId = null;
  if (['sales_handoff', 'customer_offer', 'customer_commitment', 'customer_outcome', 'customer_risk'].includes(input.kind)) {
    leadId = text(input.lead_id, 'Lead', 5, 100);
    const lead = snapshot().leads.find(item => item.id === leadId);
    if (!lead) throw new HttpError(404, 'Lead not found');
    if (input.kind === 'sales_handoff' && lead.stage !== 'marketing_review') throw new HttpError(409, 'Move this enquiry into marketing review before requesting a sales handoff');
    if (['customer_offer', 'customer_commitment', 'customer_outcome'].includes(input.kind) && lead.stage !== 'sales_working') throw new HttpError(409, 'Sales can request this approval only for a lead in the sales queue');
    if (input.kind === 'customer_risk' && lead.stage !== 'customer') throw new HttpError(409, 'At-risk customer actions require an existing customer record');
    const duplicate = snapshot().approvals.some(item => item.status === 'pending' && item.kind === input.kind && item.lead_id === leadId);
    if (duplicate) throw new HttpError(409, 'There is already a pending request of this type for this lead');
  }
  let amountCents = null;
  if (input.kind === 'spend') {
    if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents < 1) throw new HttpError(400, 'A positive proposed amount in ZAR cents is required');
    amountCents = input.amount_cents;
  }
  let proposedOutcome = null;
  if (input.kind === 'customer_outcome') {
    if (!['customer', 'closed_lost'].includes(input.proposed_outcome)) throw new HttpError(400, 'Choose customer or closed_lost as the proposed outcome');
    proposedOutcome = input.proposed_outcome;
  }
  return {
    id: id('approval'), created_at: new Date().toISOString(), requested_by: actor,
    requested_role: role, kind: input.kind, summary, rationale, lead_id: leadId,
    amount_cents: amountCents, currency: amountCents === null ? null : 'ZAR',
    proposed_outcome: proposedOutcome, status: 'pending', decision: null
  };
}
const aiStaffRoles = new Set(Object.keys(roles));
function lastStaffRun() {
  const entry = auditEntries(500).find(item => item.type === 'staff.run_completed');
  return entry ? { at: entry.timestamp ?? entry.created_at ?? null, ...entry.payload } : null;
}

class OfficeManager {
  constructor() {
    this.running = false;
    this.taskQueue = [];
    this.pendingApprovals = [];
    this.lastAction = null;
    this.actionHistory = [];
    this.lastRun = null;
    this.monitorInterval = null;
    this.managerDecisions = {};
  }

  // Check if manager decision takes priority over agent action
  checkChainOfCommand(approvalId) {
    if (!approvalId || !this.managerDecisions[approvalId]) {
      return { canProceed: true, reason: 'No manager decision override' };
    }
    const managerDecision = this.managerDecisions[approvalId];
    return {
      canProceed: false,
      reason: 'Manager decision overrides: ' + managerDecision.decision + ' (at ' + managerDecision.at + ')',
      managerDecision: managerDecision
    };
  }

  // Validate task assignment with chain of command
  validateTaskAssignment(task, approvalId) {
    const chainCheck = this.checkChainOfCommand(approvalId);
    if (!chainCheck.canProceed) {
      return { allowed: false, reason: chainCheck.reason };
    }
    const s = snapshot();
    const departmentMap = {
      'reception': 'reception',
      'marketing': 'marketing',
      'sales': 'sales',
      'finance': 'reception',
      'technical': 'reception',
      'operations': 'reception',
      'administration': 'reception'
    };
    const agentRole = departmentMap[task.department] || 'reception';
    const agentKey = s.agentKeys.find(k => k.role === agentRole && !k.revoked_at);
    if (!agentKey) {
      return { allowed: false, reason: 'No active agent for department: ' + task.department };
    }
    return { allowed: true };
  }

  assignTask(task, approvalId) {
    const validation = this.validateTaskAssignment(task, approvalId);
    if (!validation.allowed) {
      this.lastAction = { type: 'task_assignment_blocked', reason: validation.reason };
      this.actionHistory.push(this.lastAction);
      return null;
    }
    const s = snapshot();
    const departmentMap = {
      'reception': 'reception',
      'marketing': 'marketing',
      'sales': 'sales',
      'finance': 'reception',
      'technical': 'reception',
      'operations': 'reception',
      'administration': 'reception'
    };
    const agentRole = departmentMap[task.department] || 'reception';
    const agentKey = s.agentKeys.find(k => k.role === agentRole && !k.revoked_at);
    
    if (agentKey) {
      const taskRecord = {
        id: task.id || 'task_' + Date.now(),
        department: task.department,
        title: task.title || 'Unnamed task',
        description: task.description || '',
        status: 'assigned',
        assignedTo: agentRole,
        assignedAt: new Date().toISOString(),
        priority: task.priority || 'medium'
      };
      this.taskQueue.push(taskRecord);
      this.lastAction = { type: 'task_assigned', task: taskRecord };
      this.actionHistory.push(this.lastAction);
      return taskRecord;
    }
    return null;
  }

  // Follow up on pending work with chain of command respect
  followUpWork() {
    const s = snapshot();
    const updates = [];
    
    const tooOldLeads = s.leads.filter(l => l.stage === 'enquiry' && new Date() - new Date(l.created_at) > 24 * 60 * 60 * 1000);
    if (tooOldLeads.length > 0) {
      updates.push(...tooOldLeads.map(l => ({
        type: 'old_lead_followup',
        leadId: l.id,
        message: 'Lead ' + l.name + ' has been in enquiry stage for over 24 hours'
      })));
    }
    
    const staleApprovals = s.approvals.filter(a => a.status === 'pending' && new Date() - new Date(a.created_at) > 24 * 60 * 60 * 1000);
    if (staleApprovals.length > 0) {
      updates.push(...staleApprovals.map(a => ({
        type: 'stale_approval_followup',
        approvalId: a.id,
        message: 'Approval ' + a.id + ' has been pending for over 24 hours'
      })));
    }
    
    const staleTasks = s.tasks.filter(t => t.status !== 'done' && new Date() - new Date(t.updated_at || t.created_at) > 48 * 60 * 60 * 1000);
    if (staleTasks.length > 0) {
      updates.push(...staleTasks.map(t => ({
        type: 'stale_task_followup',
        taskId: t.id,
        department: t.department,
        message: 'Task ' + t.id + ' in ' + t.department + ' has been ' + t.status + ' for over 48 hours'
      })));
    }
    
    this.lastAction = { type: 'work_followup', updates: updates };
    this.actionHistory.push(this.lastAction);
    return updates;
  }

  // Make a management decision - takes priority over agent actions
  makeManagementDecision(requestId, decision, rationale) {
    // Store the manager decision in the chain of command
    this.managerDecisions[requestId] = {
      decision: decision,
      rationale: rationale,
      at: new Date().toISOString()
    };
    
    const s = snapshot();
    const approval = s.approvals.find(a => a.id === requestId);
    
    if (!approval) {
      delete this.managerDecisions[requestId];
      return { success: false, message: 'Approval not found' };
    }
    
    const canDecide = approval.kind !== 'spend' || approval.status === 'pending';
    if (!canDecide) {
      delete this.managerDecisions[requestId];
      return { success: false, message: 'Cannot decide on this approval type' };
    }
    
    const updatedApproval = {
      ...approval,
      status: decision === 'approved' ? 'approved' : 'rejected',
      managerDecision: rationale,
      managerDecisionAt: new Date().toISOString()
    };
    
    const idx = s.approvals.indexOf(approval);
    if (idx !== -1) s.approvals[idx] = updatedApproval;
    
    if (decision === 'approved' && approval.kind === 'sales_handoff') {
      const lead = s.leads.find(l => l.id === approval.lead_id);
      if (lead) {
        lead.stage = 'sales_queue';
        lead.updated_at = new Date().toISOString();
        lead.updated_by = 'office_manager';
      }
    }
    
    this.lastAction = { type: 'management_decision', approvalId: requestId, decision: decision, rationale: rationale };
    this.actionHistory.push(this.lastAction);
    
    return {
      success: true,
      approvalId: requestId,
      newStatus: decision === 'approved' ? 'approved' : 'rejected',
      leadMovedToSales: approval.kind === 'sales_handoff',
      chainOfCommand: 'manager_decision_overridden'
    };
  }

  startMonitoring(intervalMs) {
    if (this.running) return;
    this.running = true;
    this.monitorInterval = setInterval(() => {
      try {
        this.checkAgentState();
        this.followUpWork();
      } catch (e) { console.error('Office manager error:', e); }
    }, intervalMs);
    console.log('Office manager started automatic monitoring');
  }

  stopMonitoring() {
    if (this.monitorInterval) { clearInterval(this.monitorInterval); this.monitorInterval = null; }
    this.running = false;
    console.log('Office manager stopped');
  }
}
