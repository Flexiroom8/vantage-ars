import { EventEmitter } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { eventStore, DomainEvent } from './event-store.js';
import { transact, snapshot, id } from '../store.js';
import { setting } from '../runtime-config.js';

export type CommandResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  events: DomainEvent[];
};

export type QueryResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface Command<T = unknown> {
  commandId: string;
  commandType: string;
  payload: T;
  metadata: {
    correlationId: string;
    causationId: string | null;
    userId: string | null;
    timestamp: string;
  };
}

export interface Query<T = unknown> {
  queryId: string;
  queryType: string;
  payload: T;
  metadata: {
    userId: string | null;
    timestamp: string;
  };
}

export interface CommandHandler<T = unknown> {
  commandType: string;
  execute(command: Command<T>): Promise<CommandResult>;
  validate(command: Command<T>): Promise<ValidationResult>;
}

export interface QueryHandler<T = unknown> {
  queryType: string;
  execute(query: Query<T>): Promise<QueryResult>;
}

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

class CommandBus extends EventEmitter {
  private handlers: Map<string, CommandHandler> = new Map();
  private middleware: CommandMiddleware[] = [];

  register(handler: CommandHandler): void {
    this.handlers.set(handler.commandType, handler);
  }

  use(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }

  async dispatch<T>(command: Command<T>): Promise<CommandResult> {
    const handler = this.handlers.get(command.commandType);
    if (!handler) {
      return { success: false, error: `No handler for command: ${command.commandType}`, events: [] };
    }

    const validation = await handler.validate(command);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('; '), events: [] };
    }

    let result: CommandResult;
    const context = { command, next: async () => await handler.execute(command) };

    for (const mw of this.middleware) {
      const mwResult = await mw(context);
      if (mwResult) return mwResult;
    }

    result = await handler.execute(command);

    if (result.success && result.events.length > 0) {
      for (const event of result.events) {
        await eventStore.append(event);
      }
    }

    this.emit('command:dispatched', { command, result });
    return result;
  }
}

class QueryBus {
  private handlers: Map<string, QueryHandler> = new Map();

  register(handler: QueryHandler): void {
    this.handlers.set(handler.queryType, handler);
  }

  async dispatch<T>(query: Query<T>): Promise<QueryResult> {
    const handler = this.handlers.get(query.queryType);
    if (!handler) {
      return { success: false, error: `No handler for query: ${query.queryType}` };
    }
    return handler.execute(query);
  }
}

export type CommandMiddleware = (context: {
  command: Command;
  next: () => Promise<CommandResult>;
}) => Promise<CommandResult | void>;

export const commandBus = new CommandBus();
export const queryBus = new QueryBus();

export function createCommand<T>(
  commandType: string,
  payload: T,
  metadata: Partial<Command['metadata']> = {}
): Command<T> {
  return {
    commandId: id('cmd'),
    commandType,
    payload,
    metadata: {
      correlationId: metadata.correlationId || id('corr'),
      causationId: metadata.causationId || null,
      userId: metadata.userId || null,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createQuery<T>(
  queryType: string,
  payload: T,
  metadata: Partial<Query['metadata']> = {}
): Query<T> {
  return {
    queryId: id('qry'),
    queryType,
    payload,
    metadata: {
      userId: metadata.userId || null,
      timestamp: new Date().toISOString(),
    },
  };
}

commandBus.use(async ({ command, next }) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;
  console.debug(`[CQRS] ${command.commandType} completed in ${duration}ms`, { success: result.success });
  return result;
});

commandBus.use(async ({ command, next }) => {
  const state = snapshot();
  const correlationEvents = state.audit.filter(
    e => e.payload.correlationId === command.metadata.correlationId
  );
  if (correlationEvents.length > 100) {
    return { success: false, error: 'Correlation ID event limit exceeded', events: [] };
  }
  return next();
});

export async function initializeCQRS(): Promise<void> {
  commandBus.register(new LeadCommandsHandler());
  commandBus.register(new TaskCommandsHandler());
  commandBus.register(new ApprovalCommandsHandler());
  commandBus.register(new ServiceCommandsHandler());
  commandBus.register(new MessageCommandsHandler());
  commandBus.register(new AgentCommandsHandler());
  commandBus.register(new BusinessCommandsHandler());
  commandBus.register(new GovernanceCommandsHandler());

  queryBus.register(new LeadQueriesHandler());
  queryBus.register(new TaskQueriesHandler());
  queryBus.register(new ApprovalQueriesHandler());
  queryBus.register(new ServiceQueriesHandler());
  queryBus.register(new MessageQueriesHandler());
  queryBus.register(new DashboardQueriesHandler());
  queryBus.register(new AuditQueriesHandler());
}

abstract class BaseCommandHandler<T> implements CommandHandler<T> {
  abstract commandType: string;
  abstract execute(command: Command<T>): Promise<CommandResult>;

  async validate(command: Command<T>): Promise<ValidationResult> {
    return { valid: true, errors: [] };
  }

  protected async emitEvent(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    payload: Record<string, unknown>,
    metadata: Partial<DomainEvent['metadata']> = {}
  ): Promise<DomainEvent> {
    return eventStore.append({
      eventType,
      aggregateId,
      aggregateType,
      payload,
      metadata: {
        correlationId: metadata.correlationId || id('corr'),
        causationId: metadata.causationId || null,
        userId: metadata.userId || null,
        timestamp: new Date().toISOString(),
        version: metadata.version || 1,
      },
    });
  }
}

abstract class BaseQueryHandler<T> implements QueryHandler<T> {
  abstract queryType: string;
  abstract execute(query: Query<T>): Promise<QueryResult>;
}

class LeadCommandsHandler extends BaseCommandHandler<{
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  source?: string;
  details: string;
}> {
  commandType = 'lead.create';

  async validate(command: Command): Promise<ValidationResult> {
    const errors: string[] = [];
    const { name, email, phone, details } = command.payload;
    if (!name || name.length < 2) errors.push('Name must be at least 2 characters');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
    if (phone && phone.replace(/\D/g, '').length < 5) errors.push('Phone must contain at least 5 digits');
    if (!email && !phone) errors.push('Email or phone is required');
    if (!details || details.length < 5) errors.push('Details must be at least 5 characters');
    return { valid: errors.length === 0, errors };
  }

  async execute(command: Command): Promise<CommandResult> {
    const { name, email, phone, organization, source, details } = command.payload;
    const leadId = id('lead');
    const event = await this.emitEvent(
      'lead.created',
      leadId,
      'Lead',
      { leadId, name, email, phone, organization, source: source || 'manual', details, stage: 'enquiry' },
      { correlationId: command.metadata.correlationId, userId: command.metadata.userId }
    );
    return { success: true, data: { leadId }, events: [event] };
  }
}

class TaskCommandsHandler extends BaseCommandHandler<{
  department: string;
  title: string;
  description?: string;
  dueDate?: string;
}> {
  commandType = 'task.create';

  async execute(command: Command): Promise<CommandResult> {
    const { department, title, description, dueDate } = command.payload;
    const taskId = id('task');
    const event = await this.emitEvent(
      'task.created',
      taskId,
      'Task',
      { taskId, department, title, description: description || '', dueDate, status: 'open' },
      { correlationId: command.metadata.correlationId, userId: command.metadata.userId }
    );
    return { success: true, data: { taskId }, events: [event] };
  }
}

class ApprovalCommandsHandler extends BaseCommandHandler<{
  kind: string;
  summary: string;
  rationale: string;
  leadId?: string;
  amountCents?: number;
  proposedOutcome?: string;
}> {
  commandType = 'approval.request';

  async validate(command: Command): Promise<ValidationResult> {
    const errors: string[] = [];
    const { kind, summary, rationale, amountCents } = command.payload;
    if (!kind) errors.push('Approval kind is required');
    if (!summary || summary.length < 5) errors.push('Summary must be at least 5 characters');
    if (!rationale || rationale.length < 5) errors.push('Rationale must be at least 5 characters');
    if (kind === 'spend' && (!amountCents || amountCents < 1)) errors.push('Positive amount required for spend approval');
    return { valid: errors.length === 0, errors };
  }

  async execute(command: Command): Promise<CommandResult> {
    const { kind, summary, rationale, leadId, amountCents, proposedOutcome } = command.payload;
    const approvalId = id('approval');
    const event = await this.emitEvent(
      'approval.requested',
      approvalId,
      'Approval',
      { approvalId, kind, summary, rationale, leadId, amountCents, proposedOutcome, status: 'pending' },
      { correlationId: command.metadata.correlationId, userId: command.metadata.userId }
    );
    return { success: true, data: { approvalId }, events: [event] };
  }
}

class ServiceCommandsHandler extends BaseCommandHandler<{
  title: string;
  description?: string;
  priceCents?: number;
  status?: string;
}> {
  commandType = 'service.create';

  async execute(command: Command): Promise<CommandResult> {
    const { title, description, priceCents, status } = command.payload;
    const serviceId = id('service');
    const event = await this.emitEvent(
      'service.created',
      serviceId,
      'Service',
      { serviceId, title, description: description || '', priceCents: priceCents || null, status: status || 'draft' },
      { correlationId: command.metadata.correlationId, userId: command.metadata.userId }
    );
    return { success: true, data: { serviceId }, events: [event] };
  }
}

class MessageCommandsHandler extends BaseCommandHandler<{
  leadId: string;
  channel: string;
  subject?: string;
  body: string;
  requestedRole: string;
}> {
  commandType = 'message.draft';

  async validate(command: Command): Promise<ValidationResult> {
    const errors: string[] = [];
    const { leadId, channel, body } = command.payload;
    if (!leadId) errors.push('Lead ID is required');
    if (!['email', 'sms', 'whatsapp', 'manual'].includes(channel)) errors.push('Invalid channel');
    if (!body || body.length < 1) errors.push('Message body is required');
    return { valid: errors.length === 0, errors };
  }

  async execute(command: Command): Promise<CommandResult> {
    const { leadId, channel, subject, body, requestedRole } = command.payload;
    const draftId = id('draft');
    const event = await this.emitEvent(
      'message.draft_created',
      draftId,
      'MessageDraft',
      { draftId, leadId, channel, subject: subject || '', body, requestedRole, status: 'pending_review' },
      { correlationId: command.metadata.correlationId, userId: command.metadata.userId }
    );
    return { success: true, data: { draftId }, events: [event] };
  }
}

class AgentCommandsHandler extends BaseCommandHandler<{
  role: string;
}> {
  commandType = 'agent.credential.mint';

  async execute(command: Command): Promise<CommandResult> {
    const { role } = command.payload;
    const keyId = id('key');
    const secret = `vrs_${role}_${randomBytes(32).toString('base64url')}`;
    const tokenHash = createHash('sha256').update(secret).digest('hex');
    const event = await this.emitEvent(
      'agent.credential.created',
      keyId,
      'AgentKey',
      { keyId, role, tokenHash, secret, createdAt: new Date().toISOString() },
      { correlationId: command.metadata.correlationId, userId: command.metadata.userId }
    );
    return { success: true, data: { keyId, secret }, events: [event] };
  }
}

class BusinessCommandsHandler extends BaseCommandHandler<{
  name?: string;
  domain?: string;
  offering?: string;
  targetCustomers?: string;
  serviceArea?: string;
}> {
  commandType = 'business.update';

  async execute(command: Command): Promise<CommandResult> {
    const { name, domain, offering, targetCustomers, serviceArea } = command.payload;
    const event = await this.emitEvent(
      'business.profile_updated',
      'business-profile',
      'BusinessProfile',
      { name, domain, offering, targetCustomers, serviceArea, updatedAt: new Date().toISOString() },
      { correlationId: command.metadata.correlationId, userId: command.metadata.userId }
    );
    return { success: true, data: { updated: true }, events: [event] };
  }
}

class GovernanceCommandsHandler extends BaseCommandHandler<{
  title: string;
  rationale: string;
  proposedChange: string;
}> {
  commandType = 'constitution.propose';

  async execute(command: Command): Promise<CommandResult> {
    const { title, rationale, proposedChange } = command.payload;
    const proposalId = id('prop');
    const event = await this.emitEvent(
      'constitution.proposal',
      proposalId,
      'Proposal',
      { proposalId, title, rationale, proposedChange, status: 'pending_multisig', requestedBy: command.metadata.userId },
      { correlationId: command.metadata.correlationId, userId: command.metadata.userId }
    );
    return { success: true, data: { proposalId }, events: [event] };
  }
}

class LeadQueriesHandler extends BaseQueryHandler<{ stage?: string; limit?: number }> {
  queryType = 'leads.list';

  async execute(query: Query): Promise<QueryResult> {
    const { stage, limit = 100 } = query.payload;
    const state = snapshot();
    let leads = state.leads;
    if (stage) leads = leads.filter(l => l.stage === stage);
    return { success: true, data: leads.slice(0, limit) };
  }
}

class TaskQueriesHandler extends BaseQueryHandler<{ department?: string; status?: string }> {
  queryType = 'tasks.list';

  async execute(query: Query): Promise<QueryResult> {
    const { department, status } = query.payload;
    const state = snapshot();
    let tasks = state.tasks;
    if (department) tasks = tasks.filter(t => t.department === department);
    if (status) tasks = tasks.filter(t => t.status === status);
    return { success: true, data: tasks };
  }
}

class ApprovalQueriesHandler extends BaseQueryHandler<{ status?: string; kind?: string }> {
  queryType = 'approvals.list';

  async execute(query: Query): Promise<QueryResult> {
    const { status, kind } = query.payload;
    const state = snapshot();
    let approvals = state.approvals;
    if (status) approvals = approvals.filter(a => a.status === status);
    if (kind) approvals = approvals.filter(a => a.kind === kind);
    return { success: true, data: approvals };
  }
}

class ServiceQueriesHandler extends BaseQueryHandler<{ status?: string }> {
  queryType = 'services.list';

  async execute(query: Query): Promise<QueryResult> {
    const { status } = query.payload;
    const state = snapshot();
    let services = state.services;
    if (status) services = services.filter(s => s.status === status);
    return { success: true, data: services };
  }
}

class MessageQueriesHandler extends BaseQueryHandler<{ leadId?: string; status?: string }> {
  queryType = 'messages.list';

  async execute(query: Query): Promise<QueryResult> {
    const { leadId, status } = query.payload;
    const state = snapshot();
    let drafts = state.messageDrafts;
    if (leadId) drafts = drafts.filter(d => d.lead_id === leadId);
    if (status) drafts = drafts.filter(d => d.status === status);
    return { success: true, data: drafts };
  }
}

class DashboardQueriesHandler extends BaseQueryHandler<{}> {
  queryType = 'dashboard.overview';

  async execute(query: Query): Promise<QueryResult> {
    const state = snapshot();
    const { verifyAudit } = await import('../store.js');
    const integrity = verifyAudit();
    return {
      success: true,
      data: {
        metrics: {
          enquiries: state.leads.filter(l => !['customer', 'closed_lost'].includes(l.stage)).length,
          salesQueue: state.leads.filter(l => ['sales_queue', 'sales_working'].includes(l.stage)).length,
          customers: state.leads.filter(l => l.stage === 'customer').length,
          pendingApprovals: state.approvals.filter(a => a.status === 'pending').length,
          openTasks: state.tasks.filter(t => t.status !== 'done').length,
          auditEntries: state.audit.length,
          auditIntegrity: integrity.valid,
        },
        owner: state.owner ? { id: state.owner.id, name: state.owner.name, email: state.owner.email } : null,
        services: { total: state.services.length, available: state.services.filter(s => s.status === 'available').length },
      },
    };
  }
}

class AuditQueriesHandler extends BaseQueryHandler<{ limit?: number }> {
  queryType = 'audit.list';

  async execute(query: Query): Promise<QueryResult> {
    const { limit = 100 } = query.payload;
    const state = snapshot();
    const { verifyAudit } = await import('../store.js');
    return {
      success: true,
      data: {
        entries: state.audit.slice(-limit).reverse(),
        verification: verifyAudit(),
      },
    };
  }
}