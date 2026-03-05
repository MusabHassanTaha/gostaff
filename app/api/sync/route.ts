import { NextResponse } from 'next/server';
// Avoid importing large initial data here to prevent serverless import issues
const FALLBACK_DATA: any = {
  workers: [],
  sites: [],
  availableWorkerIds: [],
  skills: [],
  drivers: [],
  users: [],
  vehicles: [],
  attendanceHistory: [],
  notifications: [],
  salaryData: {},
  activityLogs: [],
  documents: [],
  documentCategories: []
};

// Force dynamic to ensure we always fetch fresh data
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for fs/path access
export const runtime = 'nodejs';

async function getDBPath() {
  const path = await import('node:path');
  return path.join(process.cwd(), 'data', 'db.json');
}

async function readData() {
  const fs = await import('node:fs');
  const dbPath = await getDBPath();
  if (!fs.existsSync(dbPath as any)) {
    return FALLBACK_DATA;
  }
  try {
    const fileContent = fs.readFileSync(dbPath as any, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading DB file:', error);
    return FALLBACK_DATA;
  }
}

async function writeData(data: any) {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dbPath = await getDBPath();
    const dir = path.dirname(dbPath as any);
    if (!fs.existsSync(dir as any)) {
      fs.mkdirSync(dir as any, { recursive: true });
    }
    fs.writeFileSync(dbPath as any, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing DB file:', error);
    return false;
  }
}

export async function GET() {
  try {
    const data = await readData();
  
    const payload = {
      timestamp: Date.now(),
      data: data
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error('Sync GET error:', e);
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newData = body.data || body;

    // Save the data to JSON file
    const currentData = await readData();
    
    // Simple merge strategy
    const updatedData = {
      ...currentData,
      ...newData
    };
    
    // Ensure arrays are updated if provided
    if (newData.workers) updatedData.workers = newData.workers;
    if (newData.sites) updatedData.sites = newData.sites;
    if (newData.vehicles) updatedData.vehicles = newData.vehicles;
    if (newData.users) updatedData.users = newData.users;
    if (newData.activityLogs) updatedData.activityLogs = newData.activityLogs;
    if (newData.documents) updatedData.documents = newData.documents;
    if (newData.documentCategories) updatedData.documentCategories = newData.documentCategories;

    await writeData(updatedData);

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
  }
}
