const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DB_PATH = path.join(__dirname, '..', 'data', 'sync_state.json');

async function main() {
  console.log('🚀 Starting migration from JSON to SQLite...');

  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ JSON database file not found at:', DB_PATH);
    process.exit(1);
  }

  const content = fs.readFileSync(DB_PATH, 'utf-8');
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.error('❌ Failed to parse JSON:', e.message);
    process.exit(1);
  }

  const data = json.data || {};
  
  // 1. Migrate Sites
  if (data.sites && Array.isArray(data.sites)) {
    console.log(`\n📦 Migrating ${data.sites.length} sites...`);
    for (const site of data.sites) {
      try {
        await prisma.site.upsert({
          where: { id: site.id },
          update: {
            name: site.name,
            code: site.code,
            location: site.location,
            manager: site.manager,
            status: site.status || 'active',
          },
          create: {
            id: site.id,
            name: site.name,
            code: site.code,
            location: site.location,
            manager: site.manager,
            status: site.status || 'active',
          },
        });
      } catch (e) {
        console.error(`Failed to migrate site ${site.name}:`, e.message);
      }
    }
  }

  // 2. Migrate Vehicles
  if (data.vehicles && Array.isArray(data.vehicles)) {
    console.log(`\n📦 Migrating ${data.vehicles.length} vehicles...`);
    for (const vehicle of data.vehicles) {
      try {
        await prisma.vehicle.upsert({
          where: { id: vehicle.id },
          update: {
            name: vehicle.name || vehicle.plate || 'Unknown Vehicle',
            plate: vehicle.plate,
            type: vehicle.type,
            status: vehicle.status || 'active',
          },
          create: {
            id: vehicle.id,
            name: vehicle.name || vehicle.plate || 'Unknown Vehicle',
            plate: vehicle.plate,
            type: vehicle.type,
            status: vehicle.status || 'active',
          },
        });
      } catch (e) {
        console.error(`Failed to migrate vehicle ${vehicle.name}:`, e.message);
      }
    }
  }

  // 3. Migrate Workers
  if (data.workers && Array.isArray(data.workers)) {
    console.log(`\n📦 Migrating ${data.workers.length} workers...`);
    for (const worker of data.workers) {
      try {
        // Ensure site exists if assigned
        let siteId = worker.assignedSiteId;
        if (siteId) {
            const siteExists = await prisma.site.findUnique({ where: { id: siteId } });
            if (!siteExists) {
                console.warn(`Worker ${worker.name} assigned to non-existent site ${siteId}. Clearing assignment.`);
                siteId = null;
            }
        }

        await prisma.worker.upsert({
          where: { id: worker.id },
          update: {
            code: worker.code,
            name: worker.name,
            englishName: worker.englishName,
            skill: worker.skill,
            iqamaNumber: worker.iqamaNumber,
            iqamaImage: worker.iqamaImage,
            nationality: worker.nationality,
            religion: worker.religion,
            phone: worker.phone,
            hireDate: worker.hireDate,
            iqamaExpiry: worker.iqamaExpiry,
            insuranceExpiry: worker.insuranceExpiry,
            bankName: worker.bankName,
            bankAccount: worker.bankAccount,
            status: worker.status || 'active',
            availabilityStatus: worker.availabilityStatus || 'available',
            absentSince: worker.absentSince,
            waitingSince: worker.waitingSince,
            driverCarPlate: worker.driverCarPlate,
            driverCarType: worker.driverCarType,
            assignedSiteId: siteId,
            absenceHistory: worker.absenceHistory ? JSON.stringify(worker.absenceHistory) : null,
          },
          create: {
            id: worker.id,
            code: worker.code,
            name: worker.name,
            englishName: worker.englishName,
            skill: worker.skill,
            iqamaNumber: worker.iqamaNumber,
            iqamaImage: worker.iqamaImage,
            nationality: worker.nationality,
            religion: worker.religion,
            phone: worker.phone,
            hireDate: worker.hireDate,
            iqamaExpiry: worker.iqamaExpiry,
            insuranceExpiry: worker.insuranceExpiry,
            bankName: worker.bankName,
            bankAccount: worker.bankAccount,
            status: worker.status || 'active',
            availabilityStatus: worker.availabilityStatus || 'available',
            absentSince: worker.absentSince,
            waitingSince: worker.waitingSince,
            driverCarPlate: worker.driverCarPlate,
            driverCarType: worker.driverCarType,
            assignedSiteId: siteId,
            absenceHistory: worker.absenceHistory ? JSON.stringify(worker.absenceHistory) : null,
          },
        });
      } catch (e) {
        console.error(`Failed to migrate worker ${worker.name}:`, e.message);
      }
    }
  }

  // 4. Migrate Users
  if (data.users && Array.isArray(data.users)) {
    console.log(`\n📦 Migrating ${data.users.length} users...`);
    for (const user of data.users) {
      if (!user.username) continue;
      try {
        await prisma.user.upsert({
          where: { username: user.username },
          update: {
            password: user.password,
            role: user.role || 'viewer',
            assignedProjectIds: user.assignedProjectIds ? JSON.stringify(user.assignedProjectIds) : null,
            status: user.status || 'active',
          },
          create: {
            username: user.username,
            password: user.password,
            role: user.role || 'viewer',
            assignedProjectIds: user.assignedProjectIds ? JSON.stringify(user.assignedProjectIds) : null,
            status: user.status || 'active',
          },
        });
      } catch (e) {
        console.error(`Failed to migrate user ${user.username}:`, e.message);
      }
    }
  }

  console.log('\n✅ Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
