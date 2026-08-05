import { NextResponse } from 'next/server';

import { ensureRunsDir, listRuns, makeRunId, writeRatings, writeRunMeta } from '@/lib/eval/fs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const runs = await listRuns();
    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list runs' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const suite = body?.suite;
    const suiteId = typeof suite === 'string' ? suite : suite?.suite;
    if (!suiteId) {
      return NextResponse.json({ error: 'suite is required' }, { status: 400 });
    }

    const seed = Number(body?.seed ?? 42);
    if (!Number.isFinite(seed)) {
      return NextResponse.json({ error: 'seed must be a number' }, { status: 400 });
    }

    const workflows = Array.isArray(body?.workflows) ? body.workflows.map(String) : [];
    if (workflows.length === 0) {
      return NextResponse.json({ error: 'workflows are required' }, { status: 400 });
    }

    await ensureRunsDir();
    const runId = makeRunId(suiteId);
    const meta = {
      suite: suiteId,
      seed,
      workflows,
      includeControl: Boolean(body?.includeControl),
          controlWorkflows: Array.isArray(body?.controlWorkflows)
        ? body.controlWorkflows.map(String)
        : [],
      moderation: Boolean(body?.moderation),
      createdAt: new Date().toISOString(),
      description: typeof suite === 'object' ? suite?.description ?? null : null,
      rating: typeof suite === 'object' ? suite?.rating ?? null : null,
    };

    await writeRunMeta(runId, meta);
    await writeRatings(runId, []);

    return NextResponse.json({ runId, meta });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create run' },
      { status: 500 },
    );
  }
}
