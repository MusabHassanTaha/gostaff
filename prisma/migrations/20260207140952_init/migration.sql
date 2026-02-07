-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "englishName" TEXT,
    "skill" TEXT,
    "iqamaNumber" TEXT,
    "iqamaImage" TEXT,
    "nationality" TEXT,
    "religion" TEXT,
    "phone" TEXT,
    "hireDate" TEXT,
    "iqamaExpiry" TEXT,
    "insuranceExpiry" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
    "absentSince" TEXT,
    "waitingSince" TEXT,
    "driverCarPlate" TEXT,
    "driverCarType" TEXT,
    "assignedSiteId" TEXT,
    "absenceHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Worker_assignedSiteId_fkey" FOREIGN KEY ("assignedSiteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "location" TEXT,
    "manager" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plate" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "username" TEXT NOT NULL PRIMARY KEY,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "assignedProjectIds" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
