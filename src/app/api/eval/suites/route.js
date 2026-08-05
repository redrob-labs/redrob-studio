import { NextResponse } from 'next/server';

import { loadAllSuites } from '@/lib/eval/fs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const suites = await loadAllSuites();
    return NextResponse.json({ suites });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load suites' },
      { status: 500 },
    );
  }
}
