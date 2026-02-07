import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { initialAppState } from '@/lib/data';

// Force dynamic to ensure we always fetch fresh data
export const dynamic = 'force-dynamic';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

function getDBPath() {
  return DB_PATH;
}

function readData() {
  const dbPath = getDBPath();
  if (!fs.existsSync(dbPath)) {
    return initialAppState;
  }
  try {
    const fileContent = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading DB file:', error);
    return initialAppState;
  }
}

function writeData(data: any) {
  try {
    const dbPath = getDBPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing DB file:', error);
    return false;
  }
}

export async function GET() {
  const data = readData();
  
  const payload = {
    timestamp: Date.now(),
    data: data
  };

  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newData = body.data || body;

    // Save the data to JSON file
    const currentData = readData();
    
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

    writeData(updatedData);

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
  }
}
