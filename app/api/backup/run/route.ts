
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { BackupJob, Destination, DestinationType, SourceType, BackupResult } from '@/types';
import { TaskService } from '@/lib/tasks';
import { existsSync } from 'fs';

// Helper to find rclone binary
const getRcloneBinary = () => {
    const wingetPath = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe\\rclone-v1.73.2-windows-amd64\\rclone.exe`;
    if (existsSync(wingetPath)) return wingetPath;
    
    if (existsSync('C:\\Program Files\\rclone\\rclone.exe')) return 'C:\\Program Files\\rclone\\rclone.exe';
    
    return 'rclone'; // Use PATH as last resort
};

// Background execution "engine"
// Background execution "engine"
async function runBackupTask(taskId: string, job: BackupJob, destinations: Destination[]) {
    const results: BackupResult[] = [];
    let overallSuccess = true;

    // Em vez de um loop 'for' sequencial, disparamos todos em paralelo
    const backupPromises = destinations.map(async (dest) => {
        try {
            let source = job.sourcePath.trim().replace(/\//g, '\\');
            if (source.endsWith('\\') && source.length > 3) source = source.slice(0, -1);
            
            const sanitizedJobName = job.name.replace(/[<>:"/\\|?*]/g, '_');
            
            // Determine if it's a file or directory for local tools
            let sourceDir = source;
            let fileMatch = '/E';

            if (job.sourceType === SourceType.FILE) {
                const lastBackslash = source.lastIndexOf('\\');
                if (lastBackslash !== -1) {
                    sourceDir = source.substring(0, lastBackslash);
                    fileMatch = source.substring(lastBackslash + 1);
                }
            }

            if (dest.type === DestinationType.LOCAL || dest.type === DestinationType.NETWORK) {
                const destBase = dest.pathOrBucket.trim().replace(/\//g, '\\');
                const finalDest = `${destBase}\\${sanitizedJobName}`;

                // Ensure destination exists
                const mkdir = spawn('powershell', ['-Command', `if (!(Test-Path -Path '${finalDest}')) { New-Item -ItemType Directory -Path '${finalDest}' -Force }`]);
                await new Promise(r => mkdir.on('close', r));

                const args = [
                    sourceDir,
                    finalDest,
                    fileMatch,
                    '/Z', '/R:5', '/W:5', '/MT:32', '/V', '/NP', '/TS', '/FP',
                    '/FFT' // Fix for timestamp precision issues
                ];

                if (job.backupType === 'Incremental') {
                     args.push('/XO'); 
                } else if (job.backupType === 'Differential') {
                     args.push('/A'); 
                } else if (job.backupType === 'Full') {
                     args.push('/IS'); 
                }

                const robocopy = spawn('robocopy', args);
                TaskService.registerProcess(taskId, robocopy);

                const currentProcessed: string[] = [];
                let stdout = '';

                robocopy.stdout.on('data', (data) => {
                    const chunk = data.toString();
                    stdout += chunk;
                    
                    // Live parsing for real-time visibility
                    const lines = chunk.split('\r\n');
                    for (const line of lines) {
                        const l = line.trim();
                        if (l.includes('\t') && !l.includes('*SAME*') && !l.includes('Skipped') && !l.includes('Extra File')) {
                            const fileName = l.split('\t').pop()?.trim();
                            if (fileName && fileName.length > 3 && !currentProcessed.includes(fileName)) {
                                currentProcessed.push(fileName);
                                // Update Task in real-time
                                TaskService.updateTask(taskId, { processedFiles: [...currentProcessed].slice(-10) });
                            }
                        }
                    }
                });

                const exitCode = await new Promise<number>((resolve) => {
                    robocopy.on('close', (code) => resolve(code || 0));
                });

                const isSuccess = exitCode < 8;
                const finalProcessed = stdout.split('\r\n')
                    .filter(line => {
                        const l = line.trim();
                        return l.includes('\t') && !l.includes('*SAME*') && !l.includes('Skipped') && !l.includes('Extra File');
                    })
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                
                results.push({
                    destination: dest.name,
                    status: isSuccess ? 'SUCCESS' : 'ERROR',
                    fileCount: finalProcessed.length,
                    integrity: isSuccess,
                    processedFiles: finalProcessed.slice(0, 500)
                });

                if (!isSuccess) overallSuccess = false;

            } else {
                // Cloud / Modern Dest (Using rclone as engine)
                const bucket = dest.pathOrBucket;
                const creds = dest.credentials || {};
                
                // Using flags instead of colon-syntax for better reliability on Windows
                const args = [
                    'copy', 
                    source, 
                    `:s3:${bucket}/${sanitizedJobName}`,
                    '--progress',
                    '--stats', '1s',
                    '-v' // Verbose
                ];

                const isS3Compatible = [
                    DestinationType.WASABI, 
                    DestinationType.AWS, 
                    DestinationType.DIGITALOCEAN, 
                    DestinationType.BACKBLAZE, 
                    DestinationType.GOOGLE
                ].includes(dest.type);

                if (isS3Compatible) {
                    let provider = 'AWS';
                    if (dest.type === DestinationType.WASABI) provider = 'Wasabi';
                    if (dest.type === DestinationType.DIGITALOCEAN) provider = 'DigitalOcean';
                    if (dest.type === DestinationType.BACKBLAZE) provider = 'Backblaze';
                    if (dest.type === DestinationType.GOOGLE) provider = 'GoogleCloudStorage';
                    
                    args.push('--s3-provider', provider);
                    if (creds.accessKeyId) args.push('--s3-access-key-id', creds.accessKeyId);
                    if (creds.secretAccessKey) args.push('--s3-secret-access-key', creds.secretAccessKey);
                    if (creds.region) args.push('--s3-region', creds.region || 'us-east-1');
                    
                    const endpoint = creds.endpoint || (dest.type === DestinationType.WASABI ? 's3.wasabisys.com' : '');
                    if (endpoint) args.push('--s3-endpoint', endpoint);
                }

                if (job.backupType === 'Incremental') args.push('--update');
                
                const rclone = spawn(getRcloneBinary(), args);
                TaskService.registerProcess(taskId, rclone);

                let stderr = '';
                const currentProcessed: string[] = [];

                // Helper to add file and update UI
                const addProcessedFile = (fileName: string) => {
                    if (fileName && !currentProcessed.includes(fileName)) {
                        currentProcessed.push(fileName);
                        TaskService.updateTask(taskId, { processedFiles: [...currentProcessed].slice(-10) });
                    }
                };

                rclone.stderr.on('data', (data) => { 
                    const chunk = data.toString();
                    stderr += chunk; 
                    
                    // rclone often sends INFO messages to stderr
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        const l = line.trim();
                        // Parse "INFO  : file.txt: Copied (new)" or similar
                        if (l.includes('INFO') && l.includes(':') && (l.includes('Copied') || l.includes('Succeeded'))) {
                            const parts = l.split('INFO')[1].split(':');
                            if (parts.length >= 2) {
                                const fileName = parts[1].trim();
                                addProcessedFile(fileName);
                            }
                        }
                    }
                });

                rclone.stdout.on('data', (data) => {
                    const chunk = data.toString();
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        const l = line.trim();
                        // Progress line: "* test.txt: 0%"
                        if (l.startsWith('*') && l.includes(':')) {
                            const fileName = l.split(':')[0].substring(1).trim();
                            addProcessedFile(fileName);
                        }
                    }
                });

                const exitCode = await new Promise<number>((resolve) => {
                    rclone.on('close', (code) => resolve(code || 0));
                });

                const isSuccess = exitCode === 0;
                results.push({ 
                    destination: dest.name, 
                    status: isSuccess ? 'SUCCESS' : 'ERROR', 
                    message: isSuccess ? 'Sincronizado via rclone' : `Erro rclone: ${stderr.slice(0, 100)}`,
                    fileCount: currentProcessed.length,
                    processedFiles: currentProcessed
                });

                if (!isSuccess) overallSuccess = false;
            }

        } catch (err: any) {
            results.push({ destination: dest.name, status: 'ERROR', message: err.message });
            overallSuccess = false;
        }
    });

    // Aguardar todas as conclusões em paralelo
    await Promise.all(backupPromises);

    TaskService.updateTask(taskId, {
        status: overallSuccess ? 'SUCCESS' : 'ERROR',
        results,
        endTime: Date.now()
    });
}

export async function POST(request: NextRequest) {
    try {
        const { job, destinations }: { job: BackupJob; destinations: Destination[] } = await request.json();

        if (!job || !destinations || destinations.length === 0) {
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
        }

        const task = TaskService.createTask(job.id);

        // Run in background
        runBackupTask(task.id, job, destinations);

        return NextResponse.json({ 
            success: true, 
            taskId: task.id,
            message: 'Backup iniciado em segundo plano.'
        });

    } catch (error) {
        console.error('Backup API Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
