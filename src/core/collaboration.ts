import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { eventStore, DomainEvent } from './event-store.js';
import { commandBus, createCommand } from './cqrs.js';
import { snapshot, transact, id } from '../store.js';
import { setting } from '../runtime-config.js';

export type CollaborationMessage = {
  type: 'join' | 'leave' | 'cursor' | 'selection' | 'edit' | 'sync' | 'ack' | 'error' | 'presence';
  payload: Record<string, unknown>;
  metadata: {
    messageId: string;
    userId: string;
    sessionId: string;
    timestamp: string;
    version: number;
  };
};

export type UserPresence = {
  userId: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  currentView: string;
  lastActive: string;
};

export type CollaborationSession = {
  sessionId: string;
  resourceType: string;
  resourceId: string;
  participants: Map<string, UserPresence>;
  documentState: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type WebSocketConnection = {
  ws: WebSocket;
  userId: string;
  sessionId: string;
  subscriptions: Set<string>;
  lastPing: number;
};

class CollaborationServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private sessions: Map<string, CollaborationSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private server: ReturnType<typeof createServer> | null = null;

  constructor(private port: number = 8081) {
    super();
  }

  async start(): Promise<void> {
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (error) => this.emit('error', error));

    this.pingInterval = setInterval(() => this.pingConnections(), 30000);

    return new Promise((resolve) => {
      this.server!.listen(this.port, () => {
        console.log(`Collaboration server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.pingInterval) clearInterval(this.pingInterval);
    for (const conn of this.connections.values()) {
      conn.ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();
    this.sessions.clear();
    if (this.wss) await new Promise<void>(resolve => this.wss!.close(() => resolve()));
    if (this.server) await new Promise<void>(resolve => this.server!.close(() => resolve()));
  }

  private handleConnection(ws: WebSocket, req: unknown): void {
    const connectionId = randomBytes(16).toString('hex');
    const userId = this.extractUserId(req) || `anonymous_${randomBytes(8).toString('hex')}`;

    const connection: WebSocketConnection = {
      ws,
      userId,
      sessionId: '',
      subscriptions: new Set(),
      lastPing: Date.now(),
    };

    this.connections.set(connectionId, connection);

    ws.on('message', (data) => this.handleMessage(connectionId, data));
    ws.on('close', () => this.handleDisconnect(connectionId));
    ws.on('error', (error) => this.emit('connection:error', { connectionId, error }));

    this.send(connectionId, {
      type: 'welcome',
      payload: { connectionId, userId },
      metadata: { messageId: id('msg'), userId, sessionId: '', timestamp: new Date().toISOString(), version: 1 },
    });
  }

  private extractUserId(req: unknown): string | null {
    return null;
  }

  private handleMessage(connectionId: string, data: Buffer): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message: CollaborationMessage = JSON.parse(data.toString());
      this.routeMessage(connectionId, message);
    } catch (error) {
      this.sendError(connectionId, 'Invalid message format');
    }
  }

  private routeMessage(connectionId: string, message: CollaborationMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    switch (message.type) {
      case 'join':
        this.handleJoin(connectionId, message);
        break;
      case 'leave':
        this.handleLeave(connectionId, message);
        break;
      case 'cursor':
      case 'selection':
        this.broadcastToSession(connection.sessionId, message, connectionId);
        break;
      case 'edit':
        this.handleEdit(connectionId, message);
        break;
      case 'sync':
        this.handleSync(connectionId, message);
        break;
      case 'presence':
        this.handlePresence(connectionId, message);
        break;
    }
  }

  private handleJoin(connectionId: string, message: CollaborationMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { resourceType, resourceId, userName, userColor } = message.payload as {
      resourceType: string;
      resourceId: string;
      userName: string;
      userColor: string;
    };

    const sessionId = `${resourceType}:${resourceId}`;
    connection.sessionId = sessionId;

    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        resourceType,
        resourceId,
        participants: new Map(),
        documentState: {},
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.sessions.set(sessionId, session);
    }

    const presence: UserPresence = {
      userId: connection.userId,
      name: userName || connection.userId,
      color: userColor || this.generateColor(connection.userId),
      currentView: message.payload.currentView as string || 'overview',
      lastActive: new Date().toISOString(),
    };

    session.participants.set(connection.userId, presence);
    session.updatedAt = new Date().toISOString();

    if (!this.userSessions.has(connection.userId)) {
      this.userSessions.set(connection.userId, new Set());
    }
    this.userSessions.get(connection.userId)!.add(sessionId);

    this.send(connectionId, {
      type: 'joined',
      payload: {
        sessionId,
        participants: Array.from(session.participants.values()),
        documentState: session.documentState,
        version: session.version,
      },
      metadata: { messageId: id('msg'), userId: connection.userId, sessionId, timestamp: new Date().toISOString(), version: 1 },
    });

    this.broadcastToSession(sessionId, {
      type: 'presence',
      payload: { user: presence, action: 'join' },
      metadata: { messageId: id('msg'), userId: connection.userId, sessionId, timestamp: new Date().toISOString(), version: 1 },
    }, connectionId);

    this.emit('user:joined', { sessionId, userId: connection.userId, presence });
  }

  private handleLeave(connectionId: string, message: CollaborationMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.sessionId) return;

    const session = this.sessions.get(connection.sessionId);
    if (!session) return;

    session.participants.delete(connection.userId);
    session.updatedAt = new Date().toISOString();

    this.broadcastToSession(connection.sessionId, {
      type: 'presence',
      payload: { userId: connection.userId, action: 'leave' },
      metadata: { messageId: id('msg'), userId: connection.userId, sessionId: connection.sessionId, timestamp: new Date().toISOString(), version: 1 },
    }, connectionId);

    const userSessions = this.userSessions.get(connection.userId);
    if (userSessions) {
      userSessions.delete(connection.sessionId);
      if (userSessions.size === 0) this.userSessions.delete(connection.userId);
    }

    if (session.participants.size === 0) {
      this.sessions.delete(connection.sessionId);
    }

    connection.sessionId = '';
    this.emit('user:left', { sessionId: connection.sessionId, userId: connection.userId });
  }

  private handleEdit(connectionId: string, message: CollaborationMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.sessionId) return;

    const session = this.sessions.get(connection.sessionId);
    if (!session) return;

    const { operations, baseVersion } = message.payload as { operations: unknown[]; baseVersion: number };

    if (baseVersion !== session.version) {
      this.send(connectionId, {
        type: 'error',
        payload: { code: 'VERSION_CONFLICT', message: 'Document version mismatch', serverVersion: session.version },
        metadata: { messageId: id('msg'), userId: connection.userId, sessionId: connection.sessionId, timestamp: new Date().toISOString(), version: 1 },
      });
      return;
    }

    session.version++;
    session.documentState = this.applyOperations(session.documentState, operations);
    session.updatedAt = new Date().toISOString();

    this.broadcastToSession(connection.sessionId, {
      type: 'edit',
      payload: { operations, version: session.version, authorId: connection.userId },
      metadata: { messageId: id('msg'), userId: connection.userId, sessionId: connection.sessionId, timestamp: new Date().toISOString(), version: 1 },
    }, connectionId);

    this.emit('document:edited', { sessionId: connection.sessionId, operations, version: session.version, authorId: connection.userId });
  }

  private handleSync(connectionId: string, message: CollaborationMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.sessionId) return;

    const session = this.sessions.get(connection.sessionId);
    if (!session) return;

    this.send(connectionId, {
      type: 'sync',
      payload: { documentState: session.documentState, version: session.version },
      metadata: { messageId: id('msg'), userId: connection.userId, sessionId: connection.sessionId, timestamp: new Date().toISOString(), version: 1 },
    });
  }

  private handlePresence(connectionId: string, message: CollaborationMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.sessionId) return;

    const session = this.sessions.get(connection.sessionId);
    if (!session) return;

    const participant = session.participants.get(connection.userId);
    if (participant) {
      const { cursor, selection, currentView } = message.payload as { cursor?: { x: number; y: number }; selection?: { start: number; end: number }; currentView?: string };
      if (cursor) participant.cursor = cursor;
      if (selection) participant.selection = selection;
      if (currentView) participant.currentView = currentView;
      participant.lastActive = new Date().toISOString();

      this.broadcastToSession(connection.sessionId, {
        type: 'presence',
        payload: { user: participant, action: 'update' },
        metadata: { messageId: id('msg'), userId: connection.userId, sessionId: connection.sessionId, timestamp: new Date().toISOString(), version: 1 },
      }, connectionId);
    }
  }

  private handleDisconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (connection.sessionId) {
      this.handleLeave(connectionId, {
        type: 'leave',
        payload: {},
        metadata: { messageId: id('msg'), userId: connection.userId, sessionId: connection.sessionId, timestamp: new Date().toISOString(), version: 1 },
      });
    }

    this.connections.delete(connectionId);
  }

  private broadcastToSession(sessionId: string, message: CollaborationMessage, excludeConnectionId?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const [userId, presence] of session.participants) {
      const connection = Array.from(this.connections.values()).find(c => c.userId === userId && c.sessionId === sessionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN && connectionId !== excludeConnectionId) {
        this.send(connectionId!, message);
      }
    }
  }

  private send(connectionId: string, message: CollaborationMessage): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  private sendError(connectionId: string, error: string): void {
    this.send(connectionId, {
      type: 'error',
      payload: { message: error },
      metadata: { messageId: id('msg'), userId: '', sessionId: '', timestamp: new Date().toISOString(), version: 1 },
    });
  }

  private pingConnections(): void {
    const now = Date.now();
    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastPing > 60000) {
        connection.ws.close(1008, 'Ping timeout');
        continue;
      }
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.ping();
      }
    }
  }

  private applyOperations(state: Record<string, unknown>, operations: unknown[]): Record<string, unknown> {
    return state;
  }

  private generateColor(userId: string): string {
    const hash = createHash('md5').update(userId).digest('hex');
    const hue = parseInt(hash.slice(0, 8), 16) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values());
  }
}

export const collaborationServer = new CollaborationServer();

export async function initializeCollaboration(): Promise<void> {
  await collaborationServer.start();
}

export function createCollaborationClient(url: string): CollaborationClient {
  return new CollaborationClient(url);
}

class CollaborationClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private messageId = 0;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();

  constructor(url: string) {
    super();
    this.url = url;
  }

  connect(userId: string, userName: string, userColor: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.send({ type: 'join', payload: { resourceType: 'workspace', resourceId: 'default', userName, userColor } });
        resolve();
      };
      this.ws.onmessage = (event) => this.handleMessage(event.data);
      this.ws.onclose = () => this.handleClose();
      this.ws.onerror = (error) => reject(error);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  joinSession(resourceType: string, resourceId: string, userName: string, userColor: string): void {
    this.send({ type: 'join', payload: { resourceType, resourceId, userName, userColor } });
  }

  leaveSession(): void {
    this.send({ type: 'leave', payload: {} });
  }

  updateCursor(x: number, y: number): void {
    this.send({ type: 'cursor', payload: { x, y } });
  }

  updateSelection(start: number, end: number): void {
    this.send({ type: 'selection', payload: { start, end } });
  }

  sendEdit(operations: unknown[], baseVersion: number): void {
    this.send({ type: 'edit', payload: { operations, baseVersion } });
  }

  requestSync(): void {
    this.send({ type: 'sync', payload: {} });
  }

  updatePresence(currentView: string): void {
    this.send({ type: 'presence', payload: { currentView } });
  }

  private send(message: Omit<CollaborationMessage, 'metadata'>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const fullMessage: CollaborationMessage = {
      ...message,
      metadata: {
        messageId: `msg_${++this.messageId}`,
        userId: '',
        sessionId: '',
        timestamp: new Date().toISOString(),
        version: 1,
      },
    };
    this.ws.send(JSON.stringify(fullMessage));
  }

  private handleMessage(data: Buffer): void {
    try {
      const message: CollaborationMessage = JSON.parse(data.toString());
      this.emit('message', message);

      if (message.type === 'ack' || message.type === 'error') {
        const pending = this.pendingRequests.get(message.metadata.messageId);
        if (pending) {
          if (message.type === 'ack') pending.resolve(message.payload);
          else pending.reject(new Error(message.payload.message as string));
          this.pendingRequests.delete(message.metadata.messageId);
        }
      }
    } catch (error) {
      console.error('Failed to parse collaboration message:', error);
    }
  }

  private handleClose(): void {
    this.emit('disconnected');
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect('', '', '').catch(() => {});
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
    }
  }
}