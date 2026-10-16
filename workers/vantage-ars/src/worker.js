export class AgentTaskWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const taskId = event?.payload?.taskId ?? event?.payload?.task_id;

    if (!taskId) {
      throw new Error("taskId is required");
    }

    return await step.do(
      "execute governed task",
      {
        retries: {
          limit: 3,
          delay: "5 seconds",
          backoff: "exponential"
        }
      },
      async () => {
        return await opRunTask(this.env, taskId);
      }
    );
  }
}
