
import { User, UserRole, LicenseType, LicenseKey, BackupJob, Destination, FileSystemNode } from '../types';

const USERS_KEY = 'cloudguard_users';
const CURRENT_USER_KEY = 'cloudguard_current_user';
const JOBS_KEY = 'cloudguard_jobs';
const DESTINATIONS_KEY = 'cloudguard_dests';
const LICENSE_KEYS_KEY = 'cloudguard_licenses';
const HISTORY_KEY = 'cloudguard_history';

// Initialize Root if not exists
const init = () => {
  if (typeof window === 'undefined') return;
  const usersStr = localStorage.getItem(USERS_KEY);
  if (!usersStr) {
    const rootUser: User = {
      id: 'root-id',
      username: 'root',
      password: 'root', // Default root password
      role: UserRole.ROOT,
      createdAt: Date.now(),
      licenseType: LicenseType.PRO,
      notificationThresholdDays: 5
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([rootUser]));
  }
};

if (typeof window !== 'undefined') {
  init();
}

export const AuthService = {
  login: (username: string, password?: string): User | null => {
    if (typeof window === 'undefined') return null;
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find(u => u.username === username);
    
    if (user) {
      // Check password (simple check for mock)
      // If user has no password (legacy data), allow login or force update. 
      // For this implementation, we require password if it exists on the record.
      if (user.password && user.password !== password) {
          throw new Error('Invalid credentials');
      }

      // Recalculate license status on login
      const updatedUser = AuthService.updateLicenseStatus(user);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
      return updatedUser;
    }
    return null;
  },

  register: (username: string, password?: string, email?: string, cpfCnpj?: string): User => {
    if (typeof window === 'undefined') throw new Error('Cannot register on server');
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (users.find(u => u.username === username)) {
      throw new Error('User already exists');
    }
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      email,
      cpfCnpj,
      password: password || '123456', // Default fallback
      role: UserRole.USER,
      createdAt: Date.now(),
      licenseType: LicenseType.TRIAL,
      notificationThresholdDays: 15
    };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return newUser;
  },
  
  // Create client with specific license and default pattern password
  createClientWithLicense: (username: string, durationDays: number, cpfCnpj?: string): User => {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      if (users.find(u => u.username === username)) {
          throw new Error('User already exists');
      }

      // Default Password Pattern: mudarsenha@{YEAR}
      const currentYear = new Date().getFullYear();
      const defaultPassword = `mudarsenha@${currentYear}`;

      // 1. Generate Key
      const key = DataService.generateLicense(durationDays);
      
      // 2. Create User
      const newUser: User = {
          id: crypto.randomUUID(),
          username,
          password: defaultPassword,
          role: UserRole.USER,
          createdAt: Date.now(),
          licenseType: LicenseType.PRO,
          licenseKey: key,
          licenseActivatedAt: Date.now(),
          licenseDuration: durationDays,
          cpfCnpj,
          notificationThresholdDays: 15
      };
      
      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      // 3. Redeem Key immediately
      const licenses: LicenseKey[] = JSON.parse(localStorage.getItem(LICENSE_KEYS_KEY) || '[]');
      const licIdx = licenses.findIndex(l => l.key === key);
      if (licIdx !== -1) {
          licenses[licIdx].redeemedBy = username;
          licenses[licIdx].redeemedAt = Date.now();
          localStorage.setItem(LICENSE_KEYS_KEY, JSON.stringify(licenses));
      }

      return newUser;
  },

  createSubUser: (parentId: string, username: string, password?: string, allowedMenus?: string[]): User => {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      if (users.find(u => u.username === username)) {
          throw new Error('User already exists');
      }

      // Find Parent to inherit license status logically, though we'll keep them somewhat independent
      const parent = users.find(u => u.id === parentId);
      if (!parent) throw new Error('Parent not found');
      
      const childrenCount = users.filter(u => u.parentId === parentId).length;
      if (childrenCount >= 2) {
          throw new Error('Max limits of sub-accounts reached');
      }

      const newUser: User = {
          id: crypto.randomUUID(),
          username,
          password: password || '123456',
          role: UserRole.USER, // Technically a basic user
          createdAt: Date.now(),
          licenseType: parent.licenseType, // Inherit visual status (they share the same data context via parentId during fetch anyway)
          parentId: parent.id,
          allowedMenus: allowedMenus || ['dashboard', 'history']
      };
      
      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      return newUser;
  },

  updateSubUser: (userId: string, allowedMenus: string[], password?: string): User | null => {
      if (typeof window === 'undefined') return null;
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const index = users.findIndex(u => u.id === userId);
      if (index !== -1) {
          users[index].allowedMenus = allowedMenus;
          if (password) users[index].password = password;
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
          return users[index];
      }
      return null;
  },

  changePassword: (userId: string, newPassword: string) => {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
          users[idx].password = newPassword;
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
          
          // Update session if it's current user
          const currentUserStr = localStorage.getItem(CURRENT_USER_KEY);
          if (currentUserStr) {
              const current = JSON.parse(currentUserStr);
              if (current.id === userId) {
                  current.password = newPassword;
                  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(current));
              }
          }
      }
  },
  
  deleteUser: (userId: string) => {
      let users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const user = users.find(u => u.id === userId);
      
      if (user && user.role !== UserRole.ROOT) {
          // If user has a license, free it up (remove redemption)
          if (user.licenseKey) {
             const licenses: LicenseKey[] = JSON.parse(localStorage.getItem(LICENSE_KEYS_KEY) || '[]');
             const licIdx = licenses.findIndex(l => l.key === user.licenseKey);
             if (licIdx !== -1) {
                 licenses[licIdx].redeemedBy = undefined;
                 licenses[licIdx].redeemedAt = undefined;
                 localStorage.setItem(LICENSE_KEYS_KEY, JSON.stringify(licenses));
             }
          }

          // Remove User
          users = users.filter(u => u.id !== userId);
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
  },

  restoreUser: (user: User) => {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      if (!users.find(u => u.id === user.id)) {
          users.push(user);
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const uStr = localStorage.getItem(CURRENT_USER_KEY);
    if (!uStr) return null;
    const user = JSON.parse(uStr);
    return AuthService.updateLicenseStatus(user);
  },

  getAllUsers: (): User[] => {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return users.map(u => AuthService.updateLicenseStatus(u));
  },
  
  getSubUsers: (parentId: string): User[] => {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return users.filter(u => u.parentId === parentId);
  },

  updateUserConfig: (userId: string, config: Partial<User>) => {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
          users[idx] = { ...users[idx], ...config };
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
          
          // Update current user if it matches
          const currentUserStr = localStorage.getItem(CURRENT_USER_KEY);
          if (currentUserStr) {
              const current = JSON.parse(currentUserStr);
              if (current.id === userId) {
                  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(users[idx]));
              }
          }
      }
  },

  updateLicenseStatus: (user: User): User => {
    if (user.role === UserRole.ROOT) return user;
    
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    if (user.licenseKey) {
        // Check expiry for PRO users too based on duration
        const duration = user.licenseDuration || 365; // Default 365 for legacy pro
        const activation = user.licenseActivatedAt || user.createdAt;
        const daysSinceActivation = (Date.now() - activation) / ONE_DAY;
        
        if (daysSinceActivation > duration) {
            user.licenseType = LicenseType.EXPIRED;
        } else {
             user.licenseType = LicenseType.PRO;
        }
    } else {
        // Trial Logic
        const daysSinceCreation = (Date.now() - user.createdAt) / ONE_DAY;
        let newType = LicenseType.TRIAL;
        if (daysSinceCreation > 15) {
            newType = LicenseType.EXPIRED;
        }
        user.licenseType = newType;
    }
    
    return user;
  },

  // Root action to manually renew/extend a user
  renewUserLicense: (userId: string, durationDays: number) => {
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const idx = users.findIndex(u => u.id === userId);
      
      if (idx !== -1) {
          // If already has key, just update dates and duration
          // If trial, generate new internal key
          if (!users[idx].licenseKey) {
             users[idx].licenseKey = 'MANUAL-RENEW-' + Date.now();
          }
          
          users[idx].licenseType = LicenseType.PRO;
          users[idx].licenseActivatedAt = Date.now(); // Reset start date to now
          users[idx].licenseDuration = durationDays;
          
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
  },

  redeemKey: (username: string, key: string): boolean => {
      const licenses: LicenseKey[] = JSON.parse(localStorage.getItem(LICENSE_KEYS_KEY) || '[]');
      const license = licenses.find(l => l.key === key && !l.redeemedBy);
      
      if (!license) return false;

      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const userIdx = users.findIndex(u => u.username === username);
      
      if (userIdx === -1) return false;

      // Update License
      license.redeemedBy = username;
      license.redeemedAt = Date.now();
      localStorage.setItem(LICENSE_KEYS_KEY, JSON.stringify(licenses));

      // Update User
      users[userIdx].licenseKey = key;
      users[userIdx].licenseType = LicenseType.PRO;
      users[userIdx].licenseActivatedAt = Date.now();
      users[userIdx].licenseDuration = license.durationDays || 365; // Inherit duration from key
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      // Update Session
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(users[userIdx]));

      return true;
  }
};

export const DataService = {
  // Jobs
  getJobs: (): BackupJob[] => {
    const user = AuthService.getCurrentUser();
    const all = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
    if (!user) return [];
    const scopeId = user.parentId || user.id;
    return all.filter((j: any) => (j.userId || 'root-id') === scopeId);
  },
  saveJob: (job: BackupJob) => {
    const user = AuthService.getCurrentUser();
    if (!user) return;
    const all: BackupJob[] = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
    const scopeId = user.parentId || user.id;
    if (!job.userId) job.userId = scopeId;
    const idx = all.findIndex(j => j.id === job.id);
    if (idx >= 0) all[idx] = job;
    else all.push(job);
    localStorage.setItem(JOBS_KEY, JSON.stringify(all));
  },
  deleteJob: (id: string) => {
    const all: BackupJob[] = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
    const filtered = all.filter(j => j.id !== id);
    localStorage.setItem(JOBS_KEY, JSON.stringify(filtered));
  },

  // Destinations
  getDestinations: (): Destination[] => {
    const user = AuthService.getCurrentUser();
    const all = JSON.parse(localStorage.getItem(DESTINATIONS_KEY) || '[]');
    if (!user) return [];
    const scopeId = user.parentId || user.id;
    return all.filter((d: any) => (d.userId || 'root-id') === scopeId);
  },
  saveDestination: (dest: Destination) => {
    const user = AuthService.getCurrentUser();
    if (!user) return;
    const all: Destination[] = JSON.parse(localStorage.getItem(DESTINATIONS_KEY) || '[]');
    const scopeId = user.parentId || user.id;
    if (!dest.userId) dest.userId = scopeId;
    const idx = all.findIndex(d => d.id === dest.id);
    if (idx >= 0) all[idx] = dest;
    else all.push(dest);
    localStorage.setItem(DESTINATIONS_KEY, JSON.stringify(all));
  },
  deleteDestination: (id: string) => {
    const all: Destination[] = JSON.parse(localStorage.getItem(DESTINATIONS_KEY) || '[]');
    const filtered = all.filter(d => d.id !== id);
    localStorage.setItem(DESTINATIONS_KEY, JSON.stringify(filtered));
  },

  // History
  getHistory: () => {
    if (typeof window === 'undefined') return [];
    const user = AuthService.getCurrentUser();
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!user) return [];
    const scopeId = user.parentId || user.id;
    return all.filter((h: any) => (h.userId || 'root-id') === scopeId);
  },
  saveHistoryEntry: (entry: any) => {
    if (typeof window === 'undefined') return;
    const user = AuthService.getCurrentUser();
    if (!user) return;
    const scopeId = user.parentId || user.id;
    if (!entry.userId) entry.userId = scopeId;

    // Use global history to prepend and slice
    const all: any[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    all.unshift(entry); // Newest first
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all.slice(0, 500))); // Keep more historically
  },

  // Admin Only
  generateLicense: (durationDays: number = 365): string => {
      const key = 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString().substring(8);
      const licenses: LicenseKey[] = JSON.parse(localStorage.getItem(LICENSE_KEYS_KEY) || '[]');
      licenses.push({
          key,
          generatedBy: 'root',
          createdAt: Date.now(),
          durationDays
      });
      localStorage.setItem(LICENSE_KEYS_KEY, JSON.stringify(licenses));
      return key;
  },
  getAllLicenses: (): LicenseKey[] => {
      return JSON.parse(localStorage.getItem(LICENSE_KEYS_KEY) || '[]');
  },
  deleteLicense: (key: string) => {
      let licenses: LicenseKey[] = JSON.parse(localStorage.getItem(LICENSE_KEYS_KEY) || '[]');
      licenses = licenses.filter(l => l.key !== key);
      localStorage.setItem(LICENSE_KEYS_KEY, JSON.stringify(licenses));

      // Also remove reference from any user holding this key
      const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      let updated = false;
      const updatedUsers = users.map(u => {
          if (u.licenseKey === key) {
              updated = true;
              return { ...u, licenseKey: undefined, licenseType: LicenseType.TRIAL }; // Revert to trial or expired based on date
          }
          return u;
      });
      
      if (updated) {
          localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
      }
  },

  restoreLicense: (license: LicenseKey) => {
      const licenses: LicenseKey[] = JSON.parse(localStorage.getItem(LICENSE_KEYS_KEY) || '[]');
      if (!licenses.find(l => l.key === license.key)) {
          licenses.push(license);
          localStorage.setItem(LICENSE_KEYS_KEY, JSON.stringify(licenses));
      }
  },
  
  // Mock File System
  mockBrowse: async (path: string): Promise<FileSystemNode[]> => {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 600));
      
      const root: FileSystemNode[] = [
          { name: 'C:', type: 'dir', path: 'C:', children: [
              { name: 'Users', type: 'dir', path: 'C:/Users', children: [
                  { name: 'Administrator', type: 'dir', path: 'C:/Users/Administrator', children: [
                      { name: 'Documents', type: 'dir', path: 'C:/Users/Administrator/Documents', children: [
                           { name: 'Project_Alpha', type: 'dir', path: 'C:/Users/Administrator/Documents/Project_Alpha' },
                           { name: 'Financials.xls', type: 'file', path: 'C:/Users/Administrator/Documents/Financials.xls' }
                      ]},
                      { name: 'Pictures', type: 'dir', path: 'C:/Users/Administrator/Pictures' }
                  ]}
              ]},
              { name: 'Windows', type: 'dir', path: 'C:/Windows' },
              { name: 'Program Files', type: 'dir', path: 'C:/Program Files' },
          ]},
          { name: 'D:', type: 'dir', path: 'D:', children: [
              { name: 'Backups', type: 'dir', path: 'D:/Backups' }
          ]}
      ];

      // Simple mocked traversal logic
      if (!path || path === '/') return root;
      
      // Helper to find node
      const findNode = (nodes: FileSystemNode[], targetPath: string): FileSystemNode[] | null => {
         for (const node of nodes) {
             if (node.path === targetPath) {
                 return node.children || [];
             }
             if (node.children) {
                 const found = findNode(node.children, targetPath);
                 if (found) return found;
             }
         }
         return null;
      }
      
      const result = findNode(root, path);
      return result || [];
  },

  mockScanIntegrity: async (path: string): Promise<{corrupted: string[]}> => {
      await new Promise(r => setTimeout(r, 1500)); // Simulate scanning time
      
      // Demo logic: If path contains "Windows", simulate corrupted files
      if (path.includes('Windows') || path.includes('Alpha')) {
          return {
              corrupted: [
                  `${path}/system_dump.log (CRC Error)`,
                  `${path}/temp_cache.tmp (Locked)`
              ]
          };
      }
      
      return { corrupted: [] };
  }
};
