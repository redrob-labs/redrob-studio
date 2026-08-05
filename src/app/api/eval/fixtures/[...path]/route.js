import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { fixturePath } from '@/lib/eval/fs';

export const runtime = 'nodejs';

function contentTypeForExt(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
  if (normalized === '.webp') return 'image/webp';
  if (normalized === '.png') return 'image/png';
  if (normalized === '.mp3' || normalized === '.m4a') return 'audio/mpeg';
  if (normalized === '.wav') return 'audio/wav';
  if (normalized === '.flac') return 'audio/flac';
  if (normalized === '.ogg' || normalized === '.opus') return 'audio/ogg';
  if (normalized === '.mp4' || normalized === '.mov' || normalized === '.mkv') {
    return 'video/mp4';
  }
  if (normalized === '.webm') return 'video/webm';
  return 'application/octet-stream';
}

export async function GET(_request, context) {
  try {
    const parts = (await context.params)?.path;
    const relative = Array.isArray(parts) ? parts.join('/') : String(parts ?? '');
    const filePath = fixturePath(relative);
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentTypeForExt(ext),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    const status = error?.code === 'ENOENT' ? 404 : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load fixture' },
      { status },
    );
  }
}
