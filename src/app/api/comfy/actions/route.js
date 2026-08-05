import { freeMemory, preloadModelOnServer } from '@/lib/comfyui';
import { assertNoClientGraph, resolveAllowlistedWorkflow } from '@/lib/workflow-allowlist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-only Comfy actions that would otherwise POST /prompt from the browser.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body?.action;
  try {
    if (action === 'free') {
      await freeMemory();
      return Response.json({ ok: true });
    }

    if (action === 'preload') {
      assertNoClientGraph(body?.baseWorkflow, 'baseWorkflow');
      assertNoClientGraph(body?.prompt, 'prompt');
      const workflowId = body?.workflowId;
      const option = resolveAllowlistedWorkflow(workflowId);
      const {
        action: _action,
        workflowId: _workflowId,
        baseWorkflow: _graph,
        ...rest
      } = body;
      await preloadModelOnServer({
        ...rest,
        baseWorkflow: option.workflow,
        warmupWorkflow: option.warmupWorkflow ?? option.workflow,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 },
    );
  }
}
