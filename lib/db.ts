import path from 'path';
import fs from 'fs';

// Default Fallback Data Structure
export const FALLBACK_DATA: any = {
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

// Helper to get DB path
export function getDBPath() {
  return path.join(process.cwd(), 'data', 'db.json');
}

// Read Data from JSON File
export function readData() {
  const dbPath = getDBPath();
  if (!fs.existsSync(dbPath)) {
    return FALLBACK_DATA;
  }
  try {
    const fileContent = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading DB file:', error);
    return FALLBACK_DATA;
  }
}

// Write Data to JSON File
export function writeData(data: any) {
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
