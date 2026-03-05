import { NextResponse } from 'next/server';
import { readData, writeData } from '@/lib/db';

// Force dynamic to ensure we always fetch fresh data
export const dynamic = 'force-dynamic';
// Ensure Node.js runtime for fs/path access
export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = readData();
  
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
    if (newData.activityLogs) updatedData.activityLogs = newData.activityLogs;
    if (newData.documents) updatedData.documents = newData.documents;
    if (newData.documentCategories) updatedData.documentCategories = newData.documentCategories;

    writeData(updatedData);

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (e) {
    console.error('Sync POST error:', e);
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
  }
}
