import { EventEmitter } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { eventStore, DomainEvent } from './event-store.js';
import { commandBus, createCommand } from './cqrs.js';
import { snapshot, transact, id } from '../store.js';
import { setting } from '../runtime-config.js';

export type ModelProvider = 'cloudflare' | 'openai' | 'anthropic' | 'local' | 'ollama';

export type ModelConfig = {
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
};

export type AgentCapability = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export type AgentConfig = {
  id: string;
  name: string;
  role: string;
  department: string;
  autonomyLevel: 'A0' | 'A1' | 'A2' | 'A3';
  model: ModelConfig;
  capabilities: AgentCapability[];
  systemPrompt: string;
  allowedActions: string[];
  maxConcurrentTasks: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    retryableErrors: string[];
  };
};

export type TaskContext = {
  taskId: string;
  agentId: string;
  input: Record<string, unknown>;
  correlationId: string;
  metadata: Record<string, unknown>;
};

export type AgentResult = {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  events: DomainEvent[];
  tokensUsed?: { input: number; output: number };
  durationMs: number;
};

export type WorkflowStep = {
  stepId: string;
  agentId: string;
  capability: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  condition?: (context: Record<string, unknown>) => boolean;
};

export type WorkflowDefinition = {
  workflowId: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  compensationSteps?: WorkflowStep[];
};

class ModelClient {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async complete(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<{
    content: string;
    tokens: { input: number; output: number };
  }> {
    switch (this.config.provider) {
      case 'cloudflare':
        return this.cloudflareComplete(prompt, options);
      case 'openai':
        return this.openaiComplete(prompt, options);
      case 'anthropic':
        return this.anthropicComplete(prompt, options);
      case 'ollama':
        return this.ollamaComplete(prompt, options);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async cloudflareComplete(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<{ content: string; tokens: { input: number; output: number } }> {
    const ai = setting('AI');
    if (!ai) throw new Error('Cloudflare AI binding not available');
    const output = await ai.run(this.config.model, {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || this.config.maxTokens,
      temperature: options?.temperature ?? this.config.temperature,
    });
    return {
      content: output.response || '',
      tokens: { input: 0, output: 0 },
    };
  }

  private async openaiComplete(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<{ content: string; tokens: { input: number; output: number } }> {
    const response = await fetch(`${this.config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature ?? this.config.temperature,
      }),
    });
    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      tokens: { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 },
    };
  }

  private async anthropicComplete(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<{ content: string; tokens: { input: number; output: number } }> {
    const response = await fetch(`${this.config.baseUrl || 'https://api.anthropic.com/v1'}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature ?? this.config.temperature,
      }),
    });
    const data = await response.json();
    return {
      content: data.content[0]?.text || '',
      tokens: { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 },
    };
  }

  private async ollamaComplete(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<{ content: string; tokens: { input: number; output: number } }> {
    const response = await fetch(`${this.config.baseUrl || 'http://localhost:11434'}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        options: {
          num_predict: options?.maxTokens || this.config.maxTokens,
          temperature: options?.temperature ?? this.config.temperature,
        },
        stream: false,
      }),
    });
    const data = await response.json();
    return {
      content: data.response || '',
      tokens: { input: 0, output: 0 },
    };
  }
}

class Agent extends EventEmitter {
  config: AgentConfig;
  private modelClient: ModelClient;
  private activeTasks: Map<string, TaskContext> = new Map();
  private taskQueue: TaskContext[] = [];
  private running = false;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.modelClient = new ModelClient(config.model);
  }

  async executeCapability(capabilityName: string, input: Record<string, unknown>): Promise<AgentResult> {
    const start = Date.now();
    const capability = this.config.capabilities.find(c => c.name === capabilityName);
    if (!capability) {
      return { success: false, error: `Capability not found: ${capabilityName}`, events: [], durationMs: Date.now() - start };
    }

    try {
      const result = await this.executeWithRetry(() => capability.handler(input));
      const event = await this.emitEvent('agent.capability.executed', {
        agentId: this.config.id,
        capability: capabilityName,
        input,
        output: result,
        success: true,
      });
      return { success: true, output: result, events: [event], durationMs: Date.now() - start };
    } catch (error) {
      const event = await this.emitEvent('agent.capability.failed', {
        agentId: this.config.id,
        capability: capabilityName,
        input,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: error instanceof Error ? error.message : String(error), events: [event], durationMs: Date.now() - start };
    }
  }

  async processTask(task: TaskContext): Promise<AgentResult> {
    this.activeTasks.set(task.taskId, task);
    this.emit('task:started', { agentId: this.config.id, taskId: task.taskId });

    try {
      const prompt = this.buildPrompt(task);
      const { content, tokens } = await this.modelClient.complete(prompt);
      const parsed = this.parseResponse(content);

      const event = await this.emitEvent('agent.task.completed', {
        agentId: this.config.id,
        taskId: task.taskId,
        input: task.input,
        output: parsed,
        tokens,
      });

      this.activeTasks.delete(task.taskId);
      this.emit('task:completed', { agentId: this.config.id, taskId: task.taskId, result: parsed });
      return { success: true, output: parsed, events: [event], tokensUsed: tokens, durationMs: Date.now() - task.metadata.startTime as number };
    } catch (error) {
      const event = await this.emitEvent('agent.task.failed', {
        agentId: this.config.id,
        taskId: task.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.activeTasks.delete(task.taskId);
      this.emit('task:failed', { agentId: this.config.id, taskId: task.taskId, error });
      return { success: false, error: error instanceof Error ? error.message : String(error), events: [event], durationMs: Date.now() - task.metadata.startTime as number };
    }
  }

  private buildPrompt(task: TaskContext): string {
    return `${this.config.systemPrompt}

TASK: ${JSON.stringify(task.input, null, 2)}

Respond with JSON only.`;
  }

  private parseResponse(content: string): Record<string, unknown> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return { raw: content };
    } catch {
      return { raw: content };
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let i = 0; i <= this.config.retryPolicy.maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!this.config.retryPolicy.retryableErrors.some(e => lastError!.message.includes(e))) throw lastError;
        if (i < this.config.retryPolicy.maxRetries) {
          await new Promise(r => setTimeout(r, this.config.retryPolicy.backoffMs * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }

  private async emitEvent(eventType: string, payload: Record<string, unknown>): Promise<DomainEvent> {
    return eventStore.append({
      eventType,
      aggregateId: this.config.id,
      aggregateType: 'Agent',
      payload,
      metadata: {
        correlationId: id('corr'),
        causationId: null,
        userId: this.config.id,
        timestamp: new Date().toISOString(),
        version: 1,
      },
    });
  }

  getStatus(): { id: string; name: string; activeTasks: number; queuedTasks: number } {
    return {
      id: this.config.id,
      name: this.config.name,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
    };
  }
}

class WorkflowEngine extends EventEmitter {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private runningWorkflows: Map<string, WorkflowExecution> = new Map();

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.workflowId, workflow);
  }

  async executeWorkflow(workflowId: string, initialInput: Record<string, unknown>): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

    const execution: WorkflowExecution = {
      executionId: id('wfex'),
      workflowId,
      status: 'running',
      stepResults: new Map(),
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    };

    this.runningWorkflows.set(execution.executionId, execution);
    this.emit('workflow:started', execution);

    try {
      await this.runWorkflowSteps(execution, workflow, initialInput);
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      this.emit('workflow:completed', execution);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date().toISOString();
      await this.compensate(execution, workflow);
      this.emit('workflow:failed', execution);
    }

    return execution;
  }

  private async runWorkflowSteps(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition,
    initialInput: Record<string, unknown>
  ): Promise<void> {
    const completedSteps = new Set<string>();
    const context = { ...initialInput };

    while (completedSteps.size < workflow.steps.length) {
      const readySteps = workflow.steps.filter(step =>
        !completedSteps.has(step.stepId) &&
        step.dependsOn.every(dep => completedSteps.has(dep)) &&
        (!step.condition || step.condition(context))
      );

      if (readySteps.length === 0) {
        if (completedSteps.size < workflow.steps.length) {
          throw new Error('Workflow deadlock: no ready steps but not all completed');
        }
        break;
      }

      for (const step of readySteps) {
        const agent = agentOrchestrator.getAgent(step.agentId);
        if (!agent) throw new Error(`Agent not found: ${step.agentId}`);

        const mergedInput = { ...step.input, ...context };
        const result = await agent.executeCapability(step.capability, mergedInput);

        execution.stepResults.set(step.stepId, result);
        if (result.success && result.output) {
          Object.assign(context, result.output);
        } else {
          throw new Error(`Step ${step.stepId} failed: ${result.error}`);
        }
        completedSteps.add(step.stepId);
      }
    }
  }

  private async compensate(execution: WorkflowExecution, workflow: WorkflowDefinition): Promise<void> {
    if (!workflow.compensationSteps) return;
    for (const step of workflow.compensationSteps.reverse()) {
      const agent = agentOrchestrator.getAgent(step.agentId);
      if (agent) {
        try {
          await agent.executeCapability(step.capability, { compensation: true, originalResult: execution.stepResults.get(step.stepId) });
        } catch (error) {
          console.error(`Compensation failed for step ${step.stepId}:`, error);
        }
      }
    }
  }
}

type WorkflowExecution = {
  executionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'compensating';
  stepResults: Map<string, AgentResult>;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
};

class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private workflowEngine = new WorkflowEngine();
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();

  registerAgent(config: AgentConfig): Agent {
    const agent = new Agent(config);
    this.agents.set(config.id, agent);
    agent.on('task:completed', ({ taskId, result }) => this.emit('agent:task:completed', { agentId: config.id, taskId, result }));
    agent.on('task:failed', ({ taskId, error }) => this.emit('agent:task:failed', { agentId: config.id, taskId, error }));
    return agent;
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;
  }

  async scheduleRecurringTask(
    taskId: string,
    agentId: string,
    capability: string,
    input: Record<string, unknown>,
    intervalMs: number
  ): Promise<void> {
    if (this.scheduledTasks.has(taskId)) {
      clearInterval(this.scheduledTasks.get(taskId)!);
    }

    const interval = setInterval(async () => {
      const agent = this.getAgent(agentId);
      if (agent) {
        await agent.executeCapability(capability, input);
      }
    }, intervalMs);

    this.scheduledTasks.set(taskId, interval);
  }

  cancelScheduledTask(taskId: string): boolean {
    const interval = this.scheduledTasks.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.scheduledTasks.delete(taskId);
      return true;
    }
    return false;
  }

  async shutdown(): Promise<void> {
    for (const interval of this.scheduledTasks.values()) {
      clearInterval(interval);
    }
    this.scheduledTasks.clear();
    this.agents.clear();
  }
}

export const agentOrchestrator = new AgentOrchestrator();

export function createDefaultAgents(): void {
  const modelConfig: ModelConfig = {
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    maxTokens: 2048,
    temperature: 0.2,
    timeout: 30000,
  };

  const receptionCapabilities: AgentCapability[] = [
    {
      name: 'classify_enquiry',
      description: 'Classify incoming enquiry and determine routing',
      inputSchema: { type: 'object', properties: { details: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { category: { type: 'string' }, priority: { type: 'string' } } },
      handler: async (input) => ({ category: 'general', priority: 'normal' }),
    },
    {
      name: 'draft_acknowledgement',
      description: 'Draft acknowledgement message for new enquiry',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, details: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } } },
      handler: async (input) => ({ subject: 'Your enquiry received', body: `Thank you ${input.name}, we received your enquiry.` }),
    },
  ];

  const marketingCapabilities: AgentCapability[] = [
    {
      name: 'qualify_lead',
      description: 'Qualify lead against service catalogue',
      inputSchema: { type: 'object', properties: { details: { type: 'string' }, services: { type: 'array' } } },
      outputSchema: { type: 'object', properties: { fit: { type: 'string' }, matchedServices: { type: 'array' }, rationale: { type: 'string' } } },
      handler: async (input) => ({ fit: 'good', matchedServices: [], rationale: 'Qualified' }),
    },
  ];

  const salesCapabilities: AgentCapability[] = [
    {
      name: 'prepare_next_step',
      description: 'Prepare next step for sales lead',
      inputSchema: { type: 'object', properties: { lead: { type: 'object' }, marketingNotes: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { summary: { type: 'string' }, nextStep: { type: 'string' }, offerServices: { type: 'array' } } },
      handler: async (input) => ({ summary: 'Prepared', nextStep: 'Follow up', offerServices: [] }),
    },
  ];

  agentOrchestrator.registerAgent({
    id: 'reception',
    name: 'Reception Agent',
    role: 'reception',
    department: 'reception',
    autonomyLevel: 'A2',
    model: modelConfig,
    capabilities: receptionCapabilities,
    systemPrompt: 'You are the Reception agent at Vantage-ARS. Classify and route enquiries.',
    allowedActions: ['route_inbound', 'draft_reply', 'create_lead'],
    maxConcurrentTasks: 10,
    retryPolicy: { maxRetries: 3, backoffMs: 1000, retryableErrors: ['timeout', 'network'] },
  });

  agentOrchestrator.registerAgent({
    id: 'marketing',
    name: 'Marketing Agent',
    role: 'marketing',
    department: 'marketing',
    autonomyLevel: 'A2',
    model: modelConfig,
    capabilities: marketingCapabilities,
    systemPrompt: 'You are the Marketing agent at Vantage-ARS. Qualify leads and prepare handoffs.',
    allowedActions: ['create_lead', 'update_lead', 'handoff_to_sales'],
    maxConcurrentTasks: 5,
    retryPolicy: { maxRetries: 3, backoffMs: 1000, retryableErrors: ['timeout', 'network'] },
  });

  agentOrchestrator.registerAgent({
    id: 'sales',
    name: 'Sales Agent',
    role: 'sales',
    department: 'sales',
    autonomyLevel: 'A2',
    model: modelConfig,
    capabilities: salesCapabilities,
    systemPrompt: 'You are the Sales agent at Vantage-ARS. Work approved leads and prepare offers.',
    allowedActions: ['open_opportunity', 'advance_opportunity', 'issue_quote'],
    maxConcurrentTasks: 5,
    retryPolicy: { maxRetries: 3, backoffMs: 1000, retryableErrors: ['timeout', 'network'] },
  });
}

export async function initializeAgentOrchestrator(): Promise<void> {
  createDefaultAgents();

  agentOrchestrator.workflowEngine.registerWorkflow({
    workflowId: 'lead-to-customer',
    name: 'Lead to Customer Pipeline',
    description: 'Process a lead from enquiry to customer',
    steps: [
      { stepId: 'classify', agentId: 'reception', capability: 'classify_enquiry', input: {}, dependsOn: [] },
      { stepId: 'acknowledge', agentId: 'reception', capability: 'draft_acknowledgement', input: {}, dependsOn: ['classify'] },
      { stepId: 'qualify', agentId: 'marketing', capability: 'qualify_lead', input: {}, dependsOn: ['acknowledge'] },
      { stepId: 'handoff', agentId: 'marketing', capability: 'qualify_lead', input: {}, dependsOn: ['qualify'] },
      { stepId: 'sales_prepare', agentId: 'sales', capability: 'prepare_next_step', input: {}, dependsOn: ['handoff'] },
    ],
  });
}