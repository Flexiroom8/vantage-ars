import { EventEmitter } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import { snapshot, transact, id } from '../store.js';
import { setting } from '../runtime-config.js';

export type DomainEvent = {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  metadata: {
    correlationId: string;
    causationId: string | null;
    userId: string | null;
    timestamp: string;
    version: number;
  };
};

export type AggregateSnapshot = {
  aggregateId: string;
  aggregateType: string;
  state: Record<string, unknown>;
  version: number;
  timestamp: string;
};

export type EventStoreConfig = {
  snapshotInterval: number;
  maxEventsPerAggregate: number;
  enableProjections: boolean;
};

class EventStore extends EventEmitter {
  private config: EventStoreConfig;
  private projections: Map<string, Projection> = new Map();
  private subscribers: Map<string, Set<EventHandler>> = new Map();

  constructor(config: Partial<EventStoreConfig> = {}) {
    super();
    this.config = {
      snapshotInterval: 100,
      maxEventsPerAggregate: 10000,
      enableProjections: true,
      ...config,
    };
  }

  async append(event: Omit<DomainEvent, 'eventId' | 'metadata'>): Promise<DomainEvent> {
    const eventId = id('evt');
    const fullEvent: DomainEvent = {
      ...event,
      eventId,
      metadata: {
        correlationId: event.metadata?.correlationId || id('corr'),
        causationId: event.metadata?.causationId || null,
        userId: event.metadata?.userId || null,
        timestamp: new Date().toISOString(),
        version: event.metadata?.version || 1,
      },
    };

    await this.persistEvent(fullEvent);
    await this.updateProjections(fullEvent);
    this.notifySubscribers(fullEvent);
    this.emit('event:appended', fullEvent);

    return fullEvent;
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<DomainEvent[]> {
    const state = snapshot();
    return state.audit
      .filter(e => e.payload.aggregateId === aggregateId && e.metadata.version > fromVersion)
      .map(e => this.auditToEvent(e));
  }

  async getSnapshot(aggregateId: string): Promise<AggregateSnapshot | null> {
    const state = snapshot();
    const events = state.audit.filter(e => e.payload.aggregateId === aggregateId);
    if (events.length === 0) return null;

    const latest = events[events.length - 1];
    return {
      aggregateId,
      aggregateType: latest.payload.aggregateType,
      state: latest.payload.state || {},
      version: latest.metadata.version,
      timestamp: latest.timestamp,
    };
  }

  async replay(aggregateId: string, handler: (event: DomainEvent) => void): Promise<void> {
    const events = await this.getEvents(aggregateId);
    for (const event of events) {
      handler(event);
    }
  }

  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
    return () => this.subscribers.get(eventType)?.delete(handler);
  }

  registerProjection(name: string, projection: Projection): void {
    this.projections.set(name, projection);
  }

  private async persistEvent(event: DomainEvent): Promise<void> {
    await transact('event.appended', event, draft => {
      const auditEntry = {
        id: event.eventId,
        timestamp: event.metadata.timestamp,
        type: event.eventType,
        payload: event.payload,
        previous_hash: draft.audit.at(-1)?.hash ?? null,
        hash: '',
      };
      auditEntry.hash = createHash('sha256').update(JSON.stringify({ ...auditEntry, hash: '' })).digest('hex');
      draft.audit.push(auditEntry);
    });
  }

  private async updateProjections(event: DomainEvent): Promise<void> {
    if (!this.config.enableProjections) return;
    for (const projection of this.projections.values()) {
      try {
        await projection.handle(event);
      } catch (error) {
        console.error(`Projection ${projection.constructor.name} failed:`, error);
      }
    }
  }

  private notifySubscribers(event: DomainEvent): void {
    const handlers = this.subscribers.get(event.eventType) || this.subscribers.get('*');
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      }
    }
  }

  private auditToEvent(audit: Record<string, unknown>): DomainEvent {
    return {
      eventId: audit.id as string,
      eventType: audit.type as string,
      aggregateId: (audit.payload as Record<string, unknown>).aggregateId as string,
      aggregateType: (audit.payload as Record<string, unknown>).aggregateType as string,
      payload: (audit.payload as Record<string, unknown>).payload as Record<string, unknown>,
      metadata: {
        correlationId: (audit.payload as Record<string, unknown>).correlationId as string,
        causationId: (audit.payload as Record<string, unknown>).causationId as string,
        userId: (audit.payload as Record<string, unknown>).userId as string,
        timestamp: audit.timestamp as string,
        version: (audit.payload as Record<string, unknown>).version as number,
      },
    };
  }
}

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

export interface Projection {
  name: string;
  handle(event: DomainEvent): Promise<void>;
  rebuild(): Promise<void>;
}

export const eventStore = new EventStore();

export async function initializeEventStore(): Promise<void> {
  eventStore.registerProjection('leadMetrics', new LeadMetricsProjection());
  eventStore.registerProjection('approvalMetrics', new ApprovalMetricsProjection());
  eventStore.registerProjection('auditTrail', new AuditTrailProjection());
}

class LeadMetricsProjection implements Projection {
  name = 'leadMetrics';
  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType.startsWith('lead.')) {
      console.debug(`[LeadMetrics] Processing ${event.eventType} for ${event.aggregateId}`);
    }
  }
  async rebuild(): Promise<void> {
    const state = snapshot();
    for (const entry of state.audit) {
      if (entry.type.startsWith('lead.')) {
        await this.handle(this.eventStore?.auditToEvent(entry));
      }
    }
  }
  private eventStore: EventStore | null = null;
  setEventStore(es: EventStore): void { this.eventStore = es; }
}

class ApprovalMetricsProjection implements Projection {
  name = 'approvalMetrics';
  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType.startsWith('approval.')) {
      console.debug(`[ApprovalMetrics] Processing ${event.eventType} for ${event.aggregateId}`);
    }
  }
  async rebuild(): Promise<void> {}
}

class AuditTrailProjection implements Projection {
  name = 'auditTrail';
  async handle(event: DomainEvent): Promise<void> {}
  async rebuild(): Promise<void> {}
}