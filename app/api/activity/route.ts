import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getDBPath() {
  const path = await import('node:path');
  return path.join(process.cwd(), 'data', 'db.json');
}

async function readData() {
  const fs = await import('node:fs');
  const dbPath = await getDBPath();
  if (!fs.existsSync(dbPath as any)) return {};
  try {
    const content = fs.readFileSync(dbPath as any, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeData(data: any) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dbPath = await getDBPath();
  const dir = path.dirname(dbPath as any);
  if (!fs.existsSync(dir as any)) fs.mkdirSync(dir as any, { recursive: true });
  fs.writeFileSync(dbPath as any, JSON.stringify(data, null, 2), 'utf-8');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body.userId || '';
    const action = body.action || '';
    const route = body.route || '';
    const timestamp = body.timestamp || Date.now();
    const id = `act-${timestamp}-${Math.floor(Math.random() * 1e6)}`;
    const db = await readData();
    const list = Array.isArray(db.activityLogs) ? db.activityLogs : [];
    list.unshift({ id, userId, action, route, timestamp });
    db.activityLogs = list.slice(0, 5000);
    await writeData(db);
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = await readData();
    const list = Array.isArray(db.activityLogs) ? db.activityLogs : [];
    return NextResponse.json({ items: list.slice(0, 100) });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
