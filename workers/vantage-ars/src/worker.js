import { WorkflowEntrypoint } from "cloudflare:workers";

class AgentTaskWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const taskId = String(event.payload?.taskId || event.payload?.task_id || "");
    if (!taskId) throw new Error("taskId is required");
    return await step.do("execute governed task", { retries: { limit: 3, delay: "5 seconds", backoff: "exponential" } }, async () => {
      return await opRunTask(this.env, taskId);
    });
  }
}
const vantage_secure_worker={...worker_default,async fetch(request,env,ctx){const response=await worker_default.fetch(request,env,ctx);const h=new Headers(response.headers);h.set("x-content-type-options","nosniff");h.set("referrer-policy","strict-origin-when-cross-origin");h.set("x-frame-options","SAMEORIGIN");h.set("permissions-policy","camera=(), microphone=(), geolocation=()");return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h})}};

export { AgentTaskWorkflow };
