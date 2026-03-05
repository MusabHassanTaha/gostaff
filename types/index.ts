export type Skill = string;

export interface SkillDefinition {
  id: string;
  name: string; // Internal name (e.g., 'Builder')
  label: string; // Display name (e.g., 'بناء')
  color: string; // Tailwind color class or hex
  description?: string; // Optional description
}

export interface Worker {
  id: string;
  code?: string; // Unique worker code (e.g., EM0001)
  name: string;
  englishName?: string;
  skill: Skill;
  avatar?: string;
  isEngineer?: boolean;
  iqamaNumber: string;
  iqamaImage?: string; // URL to the iqama image
  phone: string;
  nationality?: string;
  religion?: string;
  hireDate?: string; // ISO date (YYYY-MM-DD)
  iqamaExpiry: string; // ISO date (YYYY-MM-DD)
  insuranceExpiry: string; // ISO date (YYYY-MM-DD)
  assignedSiteId?: string;
  availabilityStatus?: 'available' | 'absent' | 'rest' | 'waiting';
  waitingSince?: string; // ISO date string for when they entered waiting status
  absentSince?: string; // ISO date string for when they entered absent status
  status?: 'active' | 'pending'; // For approval system
  bankName?: string;
  bankAccount?: string;
  driverCarPlate?: string;
  driverCarType?: string;
  driverCapacity?: number;
  driverLicenseImage?: string; // URL to the driver license image/pdf
  
  // New Status Management Fields
  absenceHistory?: Array<{
    date: string; // ISO date string
    reason?: string;
    recordedBy?: string;
  }>;
  leaveHistory?: Array<{
    startDate: string; // ISO date string
    endDate: string; // ISO date string
    type: 'annual' | 'sick' | 'emergency' | 'other';
    notes?: string;
  }>;
  annualLeaveTotal?: number; // Total annual leave days allowed (default 30)

  salaryData?: Record<string, SalaryRecord>;
}

export interface SalaryRecord {
  month?: string; // YYYY-MM
  baseSalary?: number; // Deprecated: use basicSalary
  basicSalary?: number; // Used in SalaryReport
  deductions?: number;
  bonuses?: number;
  notes?: string;
  isPaid?: boolean;
  paymentDate?: string;
  daysWorked?: number;
  overtimeHours?: number;
  
  // Fields used in SalaryReport
  advance?: number;
  advanceRepayment?: number;
  absenceDays?: number;
  absenceValue?: number;
  violationValue?: number;
  violationRepayment?: number;
  incentives?: number;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  carPlate: string;
  carType: string;
  capacity: number;
}

export interface Site {
  id: string;
  code?: string; // Project code
  name: string;
  location: string;
  requiredSkills: Record<string, number>;
  assignedWorkerIds: string[];
  engineerId?: string;
  foremanId?: string;
  driverId?: string;
  driverTransportCount?: number;
  assignedDrivers?: { driverId: string; count: number }[];
  status?: 'active' | 'completed' | 'stopped' | 'archived';
  statusNote?: string;
}

export interface AuthUserRecord {
  username: string;
  password: string;
  email?: string;
  status?: 'active' | 'pending';
  role?: 'admin' | 'engineer' | 'supervisor' | 'viewer' | 'accountant'; // User role
  assignedProjectIds?: string[];
}

export interface Notification {
  id: string;
  type: 'new_worker' | 'absence_report';
  targetId: string;
  message: string;
  isRead: boolean;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  route: string;
  timestamp: number;
}

export type DocumentCategory = string;

export type DocumentType = 'pdf' | 'image' | 'other';

export interface CompanyDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  type: DocumentType;
  url: string;
  uploadedAt: string;
  originalName?: string;
}

export interface AppState {
  workers: Worker[];
  sites: Site[];
  availableWorkerIds: string[];
  skills: SkillDefinition[];
  drivers?: Driver[];
  users?: AuthUserRecord[];
  vehicles?: Vehicle[];
  attendanceHistory?: DailyAttendance[];
  notifications: Notification[];
  salaryData?: Record<string, SalaryRecord>;
  activityLogs?: ActivityLog[];
  lastWorkerCode?: number;
  documents?: CompanyDocument[];
  documentCategories?: string[];
}

export interface DailyAttendance {
  date: string; // YYYY-MM-DD
  totalWorkers: number;
  assignedCount: number;
  absentCount: number;
  absentWorkerIds: string[];
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: 'oil_change' | 'repair' | 'other';
  cost: number;
  notes?: string;
  // Oil change specific
  withFilter?: boolean;
}

export interface ViolationRecord {
  id: string;
  violationNumber?: string;
  date: string;
  time: string;
  type: string;
  description?: string;
  city: string;
  cost: number;
  driverId?: string; // Link to worker/driver
  driverName?: string; // Snapshot name
}

export interface Vehicle {
  id: string;
  code?: string; // Vehicle code
  plateNumber: string;
  type: string; // e.g., Sedan, Bus
  model?: string;
  year?: string;
  registrationImage?: string; // URL to the registration image
  insuranceImage?: string; // URL to the insurance image/pdf
  registrationExpiry?: string; // ISO date (YYYY-MM-DD)
  periodicInspectionExpiry?: string; // ISO date (YYYY-MM-DD)
  insuranceExpiry?: string; // ISO date (YYYY-MM-DD)
  oilChangeCurrentDate?: string; // ISO date (YYYY-MM-DD)
  oilChangeNextDate?: string; // ISO date (YYYY-MM-DD)
  maintenanceHistory: MaintenanceRecord[];
  violations: ViolationRecord[];
}
