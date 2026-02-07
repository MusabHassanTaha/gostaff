const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'sync_state.json');

function main() {
  console.log('Checking database at:', DB_PATH);

  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ Database file not found.');
    console.log('The app will create it automatically on first run, or you can create it now.');
    return;
  }

  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    const json = JSON.parse(content);

    console.log('✅ Database is valid JSON.');
    console.log('Timestamp:', new Date(json.timestamp).toLocaleString());

    const data = json.data || {};
    const workers = data.workers || [];
    const sites = data.sites || [];
    const vehicles = data.vehicles || [];

    console.log('\n--- Database Stats ---');
    console.log(`👷 Workers: ${workers.length}`);
    console.log(`🏗️  Sites:   ${sites.length}`);
    console.log(`🚗 Vehicles: ${vehicles.length}`);
    
    // Check for potential issues
    const workersWithoutId = workers.filter(w => !w.id);
    if (workersWithoutId.length > 0) {
      console.warn(`⚠️  Warning: ${workersWithoutId.length} workers are missing IDs.`);
    }

    console.log('\nDatabase is ready and healthy.');

  } catch (error) {
    console.error('❌ Error reading database:', error.message);
  }
}

main();
