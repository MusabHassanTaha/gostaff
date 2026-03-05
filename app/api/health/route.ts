import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const payload = { ok: true, timestamp: Date.now() };
    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    const err = { ok: false, message: e?.message || String(e) || 'Unknown error' };
    return NextResponse.json(err, { status: 500 });
  }
}
