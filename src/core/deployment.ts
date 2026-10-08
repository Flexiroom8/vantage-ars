import { EventEmitter } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { eventStore, DomainEvent } from './event-store.js';
import { setting } from '../runtime-config.js';

export type DeploymentStrategy = 'blue-green' | 'canary' | 'rolling' | 'recreate';
export type DeploymentStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'rolled-back';
export type Environment = 'development' | 'staging' | 'production';

export type DeploymentConfig = {
  deploymentId: string;
  application: string;
  version: string;
  strategy: DeploymentStrategy;
  environment: Environment;
  image: string;
  replicas: number;
  resources: { cpu: string; memory: string };
  healthChecks: HealthCheckConfig[];
  rollbackConfig: RollbackConfig;
  featureFlags: Record<string, boolean>;
  secrets: string[];
  configMaps: Record<string, string>;
};

export type HealthCheckConfig = {
  path: string;
  port: number;
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
  successThreshold: number;
};

export type RollbackConfig = {
  enabled: boolean;
  maxSurge: number;
  maxUnavailable: number;
  timeoutSeconds: number;
  autoRollback: boolean;
  healthCheckFailures: number;
};

export type Deployment = {
  deploymentId: string;
  config: DeploymentConfig;
  status: DeploymentStatus;
  currentReplicas: number;
  desiredReplicas: number;
  readyReplicas: number;
  availableReplicas: number;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  rolloutHistory: RolloutStep[];
  metrics: DeploymentMetrics;
};

export type RolloutStep = {
  step: number;
  description: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  startedAt: string;
  completedAt: string | null;
  details: Record<string, unknown>;
};

export type DeploymentMetrics = {
  cpuUsage: number;
  memoryUsage: number;
  requestLatencyP50: number;
  requestLatencyP95: number;
  requestLatencyP99: number;
  errorRate: number;
  throughput: number;
};

export type CanaryConfig = {
  initialWeight: number;
  stepWeight: number;
  stepDurationMinutes: number;
  maxWeight: number;
  metricsThresholds: {
    errorRate: number;
    latencyP95: number;
    cpuUsage: number;
  };
};

class DeploymentEngine extends EventEmitter {
  private deployments: Map<string, Deployment> = new Map();
  private activeDeployments: Map<string, Deployment> = new Map();
  private deploymentHistory: Deployment[] = [];

  async deploy(config: DeploymentConfig): Promise<Deployment> {
    const deployment: Deployment = {
      deploymentId: config.deploymentId,
      config,
      status: 'pending',
      currentReplicas: 0,
      desiredReplicas: config.replicas,
      readyReplicas: 0,
      availableReplicas: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      rolloutHistory: this.createRolloutSteps(config),
      metrics: this.initialMetrics(),
    };

    this.deployments.set(deployment.deploymentId, deployment);
    this.activeDeployments.set(deployment.deploymentId, deployment);
    this.emit('deployment:started', deployment);

    try {
      deployment.status = 'running';
      await this.executeDeployment(deployment);
      deployment.status = 'succeeded';
      deployment.completedAt = new Date().toISOString();
      this.emit('deployment:succeeded', deployment);
    } catch (error) {
      deployment.status = 'failed';
      deployment.error = error instanceof Error ? error.message : String(error);
      deployment.completedAt = new Date().toISOString();
      this.emit('deployment:failed', deployment);

      if (config.rollbackConfig.autoRollback) {
        await this.rollback(deployment.deploymentId);
      }
    } finally {
      this.activeDeployments.delete(deployment.deploymentId);
      this.deploymentHistory.push(deployment);
    }

    await this.persistDeployment(deployment);
    return deployment;
  }

  private createRolloutSteps(config: DeploymentConfig): RolloutStep[] {
    const steps: RolloutStep[] = [];
    const baseSteps = [
      { step: 1, description: 'Validate configuration' },
      { step: 2, description: 'Pull container image' },
      { step: 3, description: 'Run pre-deployment checks' },
      { step: 4, description: 'Start new replicas' },
      { step: 5, description: 'Run health checks' },
      { step: 6, description: 'Switch traffic' },
      { step: 7, description: 'Run post-deployment checks' },
      { step: 8, description: 'Cleanup old replicas' },
    ];

    if (config.strategy === 'canary') {
      const canarySteps = [
        { step: 4, description: 'Deploy canary replicas' },
        { step: 5, description: 'Route canary traffic' },
        { step: 6, description: 'Monitor canary metrics' },
        { step: 7, description: 'Increment canary weight' },
        { step: 8, description: 'Full rollout or rollback' },
      ];
      return canarySteps.map(s => ({ ...s, status: 'pending' as const, startedAt: '', completedAt: null, details: {} }));
    }

    if (config.strategy === 'blue-green') {
      const bgSteps = [
        { step: 4, description: 'Deploy to green environment' },
        { step: 5, description: 'Run green health checks' },
        { step: 6, description: 'Switch traffic to green' },
        { step: 7, description: 'Monitor green metrics' },
        { step: 8, description: 'Decommission blue environment' },
      ];
      return bgSteps.map(s => ({ ...s, status: 'pending' as const, startedAt: '', completedAt: null, details: {} }));
    }

    return baseSteps.map(s => ({ ...s, status: 'pending' as const, startedAt: '', completedAt: null, details: {} }));
  }

  private async executeDeployment(deployment: Deployment): Promise<void> {
    const { config } = deployment;

    for (const step of deployment.rolloutHistory) {
      step.status = 'running';
      step.startedAt = new Date().toISOString();
      this.emit('deployment:step:started', { deploymentId: deployment.deploymentId, step });

      try {
        await this.executeStep(deployment, step);
        step.status = 'succeeded';
        step.completedAt = new Date().toISOString();
        this.emit('deployment:step:succeeded', { deploymentId: deployment.deploymentId, step });
      } catch (error) {
        step.status = 'failed';
        step.completedAt = new Date().toISOString();
        step.details.error = error instanceof Error ? error.message : String(error);
        this.emit('deployment:step:failed', { deploymentId: deployment.deploymentId, step });
        throw error;
      }
    }
  }

  private async executeStep(deployment: Deployment, step: RolloutStep): Promise<void> {
    const { config } = deployment;

    switch (step.step) {
      case 1:
        await this.validateConfig(config);
        break;
      case 2:
        await this.pullImage(config.image);
        break;
      case 3:
        await this.preDeploymentChecks(config);
        break;
      case 4:
        if (config.strategy === 'canary') {
          await this.deployCanary(config);
        } else if (config.strategy === 'blue-green') {
          await this.deployGreen(config);
        } else {
          await this.startReplicas(config);
        }
        break;
      case 5:
        if (config.strategy === 'canary') {
          await this.routeCanaryTraffic(config);
        } else if (config.strategy === 'blue-green') {
          await this.runGreenHealthChecks(config);
        } else {
          await this.runHealthChecks(config);
        }
        break;
      case 6:
        if (config.strategy === 'canary') {
          await this.monitorCanaryMetrics(config);
        } else if (config.strategy === 'blue-green') {
          await this.switchToGreen(config);
        } else {
          await this.switchTraffic(config);
        }
        break;
      case 7:
        if (config.strategy === 'canary') {
          await this.incrementCanaryWeight(config);
        } else if (config.strategy === 'blue-green') {
          await this.monitorGreenMetrics(config);
        } else {
          await this.postDeploymentChecks(config);
        }
        break;
      case 8:
        if (config.strategy === 'canary') {
          await this.completeCanaryRollout(config);
        } else if (config.strategy === 'blue-green') {
          await this.decommissionBlue(config);
        } else {
          await this.cleanupOldReplicas(config);
        }
        break;
    }
  }

  private async validateConfig(config: DeploymentConfig): Promise<void> {
    if (!config.image) throw new Error('Image is required');
    if (config.replicas < 1) throw new Error('At least 1 replica required');
    if (!config.healthChecks.length) throw new Error('At least 1 health check required');
  }

  private async pullImage(image: string): Promise<void> {
    console.log(`Pulling image: ${image}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  private async preDeploymentChecks(config: DeploymentConfig): Promise<void> {
    console.log('Running pre-deployment checks');
    await new Promise(r => setTimeout(r, 500));
  }

  private async startReplicas(config: DeploymentConfig): Promise<void> {
    console.log(`Starting ${config.replicas} replicas`);
    await new Promise(r => setTimeout(r, 2000));
  }

  private async deployCanary(config: DeploymentConfig): Promise<void> {
    const canaryReplicas = Math.max(1, Math.floor(config.replicas * 0.1));
    console.log(`Deploying ${canaryReplicas} canary replicas`);
    await new Promise(r => setTimeout(r, 2000));
  }

  private async deployGreen(config: DeploymentConfig): Promise<void> {
    console.log(`Deploying to green environment with ${config.replicas} replicas`);
    await new Promise(r => setTimeout(r, 2000));
  }

  private async runHealthChecks(config: DeploymentConfig): Promise<void> {
    console.log('Running health checks');
    for (const hc of config.healthChecks) {
      await this.waitForHealthy(hc);
    }
  }

  private async waitForHealthy(hc: HealthCheckConfig): Promise<void> {
    const maxAttempts = hc.failureThreshold * 3;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, hc.periodSeconds * 1000));
    }
  }

  private async routeCanaryTraffic(config: DeploymentConfig): Promise<void> {
    console.log(`Routing ${config.featureFlags.canaryWeight || 10}% traffic to canary`);
    await new Promise(r => setTimeout(r, 500));
  }

  private async runGreenHealthChecks(config: DeploymentConfig): Promise<void> {
    console.log('Running green environment health checks');
    await new Promise(r => setTimeout(r, 1000));
  }

  private async switchTraffic(config: DeploymentConfig): Promise<void> {
    console.log('Switching traffic to new replicas');
    await new Promise(r => setTimeout(r, 500));
  }

  private async switchToGreen(config: DeploymentConfig): Promise<void> {
    console.log('Switching traffic to green environment');
    await new Promise(r => setTimeout(r, 500));
  }

  private async monitorCanaryMetrics(config: DeploymentConfig): Promise<void> {
    console.log('Monitoring canary metrics');
    await new Promise(r => setTimeout(r, config.featureFlags.canaryStepDuration || 5 * 60 * 1000));
  }

  private async monitorGreenMetrics(config: DeploymentConfig): Promise<void> {
    console.log('Monitoring green environment metrics');
    await new Promise(r => setTimeout(r, 60000));
  }

  private async postDeploymentChecks(config: DeploymentConfig): Promise<void> {
    console.log('Running post-deployment checks');
    await new Promise(r => setTimeout(r, 500));
  }

  private async incrementCanaryWeight(config: DeploymentConfig): Promise<void> {
    console.log('Incrementing canary traffic weight');
    await new Promise(r => setTimeout(r, 500));
  }

  private async completeCanaryRollout(config: DeploymentConfig): Promise<void> {
    console.log('Completing canary rollout or rolling back');
    await new Promise(r => setTimeout(r, 1000));
  }

  private async cleanupOldReplicas(config: DeploymentConfig): Promise<void> {
    console.log('Cleaning up old replicas');
    await new Promise(r => setTimeout(r, 1000));
  }

  private async decommissionBlue(config: DeploymentConfig): Promise<void> {
    console.log('Decommissioning blue environment');
    await new Promise(r => setTimeout(r, 1000));
  }

  async rollback(deploymentId: string): Promise<Deployment | null> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return null;

    deployment.status = 'rolled-back';
    this.emit('deployment:rollback:started', deployment);

    try {
      await this.executeRollback(deployment);
      this.emit('deployment:rollback:completed', deployment);
    } catch (error) {
      deployment.error = `Rollback failed: ${error instanceof Error ? error.message : String(error)}`;
      this.emit('deployment:rollback:failed', deployment);
    }

    await this.persistDeployment(deployment);
    return deployment;
  }

  private async executeRollback(deployment: Deployment): Promise<void> {
    console.log(`Rolling back deployment ${deployment.deploymentId}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  private initialMetrics(): DeploymentMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      requestLatencyP50: 0,
      requestLatencyP95: 0,
      requestLatencyP99: 0,
      errorRate: 0,
      throughput: 0,
    };
  }

  private async persistDeployment(deployment: Deployment): Promise<void> {
    await eventStore.append({
      eventType: 'deployment.recorded',
      aggregateId: deployment.deploymentId,
      aggregateType: 'Deployment',
      payload: deployment,
      metadata: { correlationId: randomBytes(16).toString('hex'), causationId: null, userId: 'system', timestamp: new Date().toISOString(), version: 1 },
    });
  }

  getDeployment(deploymentId: string): Deployment | undefined {
    return this.deployments.get(deploymentId);
  }

  getActiveDeployments(): Deployment[] {
    return Array.from(this.activeDeployments.values());
  }

  getDeploymentHistory(limit = 50): Deployment[] {
    return this.deploymentHistory.slice(-limit).reverse();
  }

  async cancelDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return false;
    deployment.status = 'failed';
    deployment.error = 'Cancelled by user';
    deployment.completedAt = new Date().toISOString();
    this.activeDeployments.delete(deploymentId);
    await this.persistDeployment(deployment);
    return true;
  }
}

export const deploymentEngine = new DeploymentEngine();

export function createDeploymentConfig(
  application: string,
  version: string,
  strategy: DeploymentStrategy,
  environment: Environment,
  options: Partial<DeploymentConfig> = {}
): DeploymentConfig {
  return {
    deploymentId: `deploy_${randomBytes(16).toString('hex')}`,
    application,
    version,
    strategy,
    environment,
    image: `${application}:${version}`,
    replicas: 3,
    resources: { cpu: '500m', memory: '512Mi' },
    healthChecks: [
      { path: '/api/health', port: 8080, initialDelaySeconds: 10, periodSeconds: 10, timeoutSeconds: 5, failureThreshold: 3, successThreshold: 1 },
      { path: '/api/ready', port: 8080, initialDelaySeconds: 15, periodSeconds: 10, timeoutSeconds: 5, failureThreshold: 3, successThreshold: 1 },
    ],
    rollbackConfig: { enabled: true, maxSurge: 1, maxUnavailable: 0, timeoutSeconds: 300, autoRollback: true, healthCheckFailures: 3 },
    featureFlags: { canaryWeight: 10, canaryStepDuration: 5 * 60 * 1000 },
    secrets: ['DATABASE_URL', 'API_KEYS'],
    configMaps: {},
    ...options,
  };
}

export async function initializeDeploymentEngine(): Promise<void> {
  await eventStore.append({
    eventType: 'deployment.engine.initialized',
    aggregateId: 'system',
    aggregateType: 'DeploymentEngine',
    payload: { version: '3.0.0' },
    metadata: { correlationId: randomBytes(16).toString('hex'), causationId: null, userId: 'system', timestamp: new Date().toISOString(), version: 1 },
  });
}