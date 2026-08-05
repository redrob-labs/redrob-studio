import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import {
  assertSafeRunId,
  listRunImages,
  loadSuite,
  readRatings,
  readRunMeta,
  runDir,
  saveRunImage,
  writeRatings,
} from '@/lib/eval/fs';

export const runtime = 'nodejs';

function mediaContentType(ext) {
  const normalized = String(ext || '').toLowerCase().replace(/^\./, '');
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'png') return 'image/png';
  if (normalized === 'mp4') return 'video/mp4';
  if (normalized === 'webm') return 'video/webm';
  if (normalized === 'mp3') return 'audio/mpeg';
  if (normalized === 'wav') return 'audio/wav';
  if (normalized === 'flac') return 'audio/flac';
  if (normalized === 'ogg') return 'audio/ogg';
  if (normalized === 'txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

async function readRunFile(runId, relative) {
  if (!relative || relative.includes('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid path');
  }
  const segments = relative.split(/[/\\]/).filter(Boolean);
  if (segments.length !== 2) {
    throw new Error('Expected workflow/filename');
  }
  const filePath = path.join(runDir(runId), ...segments);
  const bytes = await fs.readFile(filePath);
  return { bytes, ext: path.extname(filePath).toLowerCase() };
}

export async function GET(request, context) {
  try {
    const { runId } = await context.params;
    assertSafeRunId(runId);

    const filePath = request.nextUrl.searchParams.get('file');
    if (filePath) {
      const { bytes, ext } = await readRunFile(runId, filePath);
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': mediaContentType(ext),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    const meta = await readRunMeta(runId);
    const [ratings, images, suite] = await Promise.all([
      readRatings(runId),
      listRunImages(runId),
      meta?.suite ? loadSuite(meta.suite) : Promise.resolve(null),
    ]);
    return NextResponse.json({ runId, meta, ratings, images, suite });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load run';
    const status = message.includes('Invalid') || message.includes('ENOENT') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Persist generated media as base64 JSON (avoids Next multipart → Server Action 404). */
export async function POST(request, context) {
  try {
    const { runId } = await context.params;
    assertSafeRunId(runId);

    const body = await request.json();
    const workflow = String(body?.workflow ?? '');
    const promptId = String(body?.promptId ?? '');
    const seed = String(body?.seed ?? '');
    const ext = String(body?.ext ?? 'png').replace(/^\./, '');
    const dataBase64 = String(body?.dataBase64 ?? '');

    if (!workflow || !promptId || !seed || !dataBase64) {
      return NextResponse.json(
        { error: 'workflow, promptId, seed, and dataBase64 are required' },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(dataBase64, 'base64');
    const saved = await saveRunImage({
      runId,
      workflow,
      promptId,
      seed,
      bytes,
      ext,
    });

    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save media' },
      { status: 500 },
    );
  }
}

export async function PUT(request, context) {
  try {
    const { runId } = await context.params;
    assertSafeRunId(runId);
    const body = await request.json();
    const ratings = body?.ratings;
    if (!Array.isArray(ratings)) {
      return NextResponse.json({ error: 'ratings must be an array' }, { status: 400 });
    }
    await writeRatings(runId, ratings);
    return NextResponse.json({ ok: true, count: ratings.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save ratings' },
      { status: 500 },
    );
  }
}
