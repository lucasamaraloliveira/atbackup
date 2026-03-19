
import { BackupResult } from '@/types';
import { ChildProcess } from 'child_process';

export interface BackupTask {
  id: string;
  jobId: string;
  status: 'RUNNING' | 'SUCCESS' | 'ERROR';
  progress: number;
  totalFiles: number;
  processedFiles: string[];
  results: BackupResult[];
  startTime: number;
  endTime?: number;
  error?: string;
  log: string[];
}

// Ensure Singleton pattern in development to prevent state loss on reloads
// and crossing module boundaries in Next.js.
declare global {
  var _tasksStore: Map<string, BackupTask>;
  var _processStore: Map<string, ChildProcess>;
}

const globalTasks = globalThis._tasksStore || new Map<string, BackupTask>();
const activeProcesses = globalThis._processStore || new Map<string, ChildProcess>();

if (process.env.NODE_ENV !== 'production') {
  globalThis._tasksStore = globalTasks;
  globalThis._processStore = activeProcesses;
}

export const TaskService = {
  createTask: (jobId: string): BackupTask => {
    const task: BackupTask = {
      id: crypto.randomUUID(),
      jobId,
      status: 'RUNNING',
      progress: 0,
      totalFiles: 0,
      processedFiles: [],
      results: [],
      startTime: Date.now(),
      log: []
    };
    globalTasks.set(task.id, task);
    return task;
  },

  registerProcess: (taskId: string, process: ChildProcess) => {
    activeProcesses.set(taskId, process);
  },

  stopProcess: (taskId: string) => {
    const cp = activeProcesses.get(taskId);
    if (cp) {
      // Robocopy might have children or be in powershell wrapper
      // Killing the main process should suffice in most cases
      cp.kill('SIGINT');
      activeProcesses.delete(taskId);
      
      const task = globalTasks.get(taskId);
      if (task) {
        globalTasks.set(taskId, { 
            ...task, 
            status: 'ERROR', 
            error: 'Interrompido pelo usuário',
            endTime: Date.now() 
        });
      }
    }
  },

  updateTask: (taskId: string, update: Partial<BackupTask>) => {
    const task = globalTasks.get(taskId);
    if (task) {
      const merged = { ...task, ...update };
      if (merged.log.length > 500) merged.log = merged.log.slice(-500);
      globalTasks.set(taskId, merged);
    }
  },

  getTask: (taskId: string): BackupTask | undefined => {
    return globalTasks.get(taskId);
  },

  deleteTask: (taskId: string) => {
    globalTasks.delete(taskId);
    activeProcesses.delete(taskId);
  }
};
