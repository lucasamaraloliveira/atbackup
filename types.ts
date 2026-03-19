
export enum UserRole {
  ROOT = 'ROOT',
  USER = 'USER'
}

export enum LicenseType {
  TRIAL = 'TRIAL',
  PRO = 'PRO',
  EXPIRED = 'EXPIRED'
}

export type Language = 'en' | 'pt';

export interface User {
  id: string;
  username: string;
  email?: string;
  password?: string; // Added password field
  role: UserRole;
  createdAt: number; // Timestamp
  licenseKey?: string;
  licenseType: LicenseType;
  licenseActivatedAt?: number; // When the PRO key was applied
  notificationThresholdDays?: number; // Custom setting for expiry warning (default 15)
  licenseDuration?: number; // Duration in days (overrides default)
  parentId?: string; // ID of the parent user if this is a sub-account (child)
  allowedMenus?: string[]; // Array of allowed menu keys, e.g., ['dashboard', 'jobs', 'destinations']
  cpfCnpj?: string; // Tax ID for Parent accounts
}

export enum DestinationType {
  LOCAL = 'Local Disk',
  FTP = 'FTP/SFTP',
  AWS = 'AWS S3',
  AZURE = 'Azure Blob Storage',
  GOOGLE = 'Google Cloud Storage',
  GOOGLE_DRIVE = 'Google Drive', // New
  WASABI = 'Wasabi Hot Cloud Storage',
  BACKBLAZE = 'Backblaze B2',
  DROPBOX = 'Dropbox',
  DIGITALOCEAN = 'DigitalOcean Spaces',
  NETWORK = 'Network Shared Folder'
}

export interface Destination {
  id: string;
  name: string;
  type: DestinationType;
  pathOrBucket: string;
  credentials?: Record<string, string>; // Mock storage for access keys
  userId?: string;
}

export enum BackupType {
  FULL = 'Full',
  INCREMENTAL = 'Incremental',
  DIFFERENTIAL = 'Differential'
}

export enum SourceType {
  FILE = 'File',
  DIRECTORY = 'Directory',
  DATABASE_MYSQL = 'MySQL Database',
  DATABASE_POSTGRES = 'PostgreSQL Database',
  DATABASE_MONGO = 'MongoDB',
  DATABASE_SQLSERVER = 'SQL Server Database'
}

export interface BackupJob {
  id: string;
  name: string;
  sourceType: SourceType;
  sourcePath: string; // Connection string or path
  dbCredentials?: {
    host?: string;
    port?: string;
    user?: string;
    password?: string;
    database?: string;
    useIndividualFields?: boolean;
  };
  destinationIds: string[];
  backupType: BackupType;
  scheduleCron: string; // Simplified for UI, e.g., "0 0 * * *"
  compress: boolean;
  notifyOnSuccess: boolean;
  notifyOnWarning: boolean;
  notifyOnError: boolean;
  notifyEmail: string;
  lastRun?: number;
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'ERROR';
  userId?: string;
}

export interface LicenseKey {
  key: string;
  generatedBy: string;
  createdAt: number;
  redeemedBy?: string;
  redeemedAt?: number; // When the key was actually activated
  durationDays?: number; // Specific duration for this key
}

export interface FileSystemNode {
  name: string;
  type: 'file' | 'dir';
  path: string;
  children?: FileSystemNode[];
}

export interface BackupHistory {
  id: string;
  jobId: string;
  jobName: string;
  timestamp: number;
  status: 'SUCCESS' | 'ERROR';
  fileCount: number;
  integrity: boolean;
  details: string;
  userId?: string;
}

export interface BackupResult {
  destination: string;
  status: 'SUCCESS' | 'ERROR' | 'SUCCESS (MOCK)';
  message?: string;
  fileCount?: number;
  integrity?: boolean;
  processedFiles?: string[];
}