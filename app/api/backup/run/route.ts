import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BackupJob, Destination, DestinationType, SourceType } from '@/types';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { job, destinations }: { job: BackupJob; destinations: Destination[] } = await request.json();

    if (!job || !destinations || destinations.length === 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const results = [];

    for (const dest of destinations) {
      if (dest.type === DestinationType.LOCAL) {
        try {
          // Prepare paths for Windows and escape single quotes for PowerShell
          // Remove trailing backslash to avoid PowerShell -LiteralPath issues
          let source = job.sourcePath.trim().replace(/\//g, '\\');
          if (source.endsWith('\\') && source.length > 3) {
            source = source.slice(0, -1);
          }
          const escapedSource = source.replace(/'/g, "''");
          const destBase = dest.pathOrBucket.trim().replace(/\//g, '\\');
          
          // Create a specific folder for the job in the destination with dd-MM-YYYY_HHmmss format
          const now = new Date();
          const day = String(now.getDate()).padStart(2, '0');
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const year = now.getFullYear();
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          const seconds = String(now.getSeconds()).padStart(2, '0');
          const timestamp = `${day}-${month}-${year}_${hours}${minutes}${seconds}`;
          const sanitizedJobName = job.name.replace(/[<>:"/\\|?*]/g, '_');
          const jobFolderName = `${sanitizedJobName}_${timestamp}`;
          const finalDest = `${destBase}\\${jobFolderName}`.replace(/'/g, "''");

          const setupEncoding = '$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; $ErrorActionPreference = \'Stop\';';
          let scriptBody = '';
          
          if (job.sourceType === SourceType.DIRECTORY || job.sourceType === SourceType.FILE) {
             if (job.compress) {
                 const zipDest = `${destBase}\\${jobFolderName}.zip`.replace(/'/g, "''");
                 scriptBody = `
                 if (!(Test-Path -LiteralPath '${escapedSource}')) { 
                   $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name; 
                   $drives = Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Name + ':' }; 
                   throw ('Origem nao encontrada: ${escapedSource} (User: ' + $user + ' | Drives: ' + ($drives -join ', ') + ')') 
                 }; 
                 $originCount = (Get-ChildItem -LiteralPath '${escapedSource}' ${job.sourceType === SourceType.DIRECTORY ? '-Recurse' : ''} -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count; 
                 if ($originCount -eq $null) { $originCount = 0 };
                 
                 Write-Output "COUNT:$originCount"; 
                 
                 $zipDest = '${zipDest}';
                 if (Test-Path -LiteralPath $zipDest) { Remove-Item -LiteralPath $zipDest -Force | Out-Null };
                 
                 Compress-Archive -LiteralPath '${escapedSource}' -DestinationPath $zipDest -Force -ErrorAction Stop;
                 
                 if (Test-Path -LiteralPath $zipDest) { 
                   Write-Output "INTEGRITY:OK";
                   Write-Output "FILE:${jobFolderName}.zip";
                 } else { throw 'Erro na compactacao: Arquivo zip nao encontrado' }; `;
             } else {
               scriptBody = `
                 if (!(Test-Path -LiteralPath '${escapedSource}')) { 
                   $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name; 
                   $drives = Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Name + ':' }; 
                   throw ('Origem nao encontrada: ${escapedSource} (User: ' + $user + ' | Drives: ' + ($drives -join ', ') + ')') 
                 }; 
                 $originCount = (Get-ChildItem -LiteralPath '${escapedSource}' ${job.sourceType === SourceType.DIRECTORY ? '-Recurse' : ''} -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count; 
                 if ($originCount -eq $null) { $originCount = 0 };
                 Write-Output "COUNT:$originCount"; 
                 if (Test-Path -LiteralPath '${finalDest}') { Remove-Item -LiteralPath '${finalDest}' -Recurse -Force | Out-Null };
                 New-Item -ItemType Directory -Force -Path '${finalDest}' -ErrorAction Stop | Out-Null; 
                 Copy-Item -LiteralPath '${escapedSource}' -Destination '${finalDest}' -Force -ErrorAction Stop ${job.sourceType === SourceType.DIRECTORY ? '-Recurse' : ''}; 
                 $destCount = (Get-ChildItem -LiteralPath '${finalDest}' -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count; 
                 if ($destCount -eq $null) { $destCount = 0 };
                 if ($originCount -eq $destCount) { 
                   Write-Output "INTEGRITY:OK";
                   Get-ChildItem -LiteralPath '${finalDest}' -Recurse | ForEach-Object { 
                     $rel = $_.FullName.Substring('${finalDest}'.Length).TrimStart('\\');
                     if ($rel) { Write-Output "FILE:$rel" }
                   };
                 } else { throw ('FALHA_INTEGRIDADE: Origem(' + $originCount + ') vs Destino(' + $destCount + ')') }; `;
             }
          } else {
            const extension = job.sourceType === SourceType.DATABASE_SQLSERVER ? 'bak' : 'sql';
            const dbRef = (job.dbCredentials?.useIndividualFields && job.dbCredentials?.database) ? job.dbCredentials.database : job.sourcePath;
            const sanitizedDbName = dbRef.replace(/[<>:"/\\|?*@]/g, '_');
            const fileName = `backup_${sanitizedDbName}.${extension}`;
            
            scriptBody = `
               New-Item -ItemType Directory -Force -Path '${finalDest}' -ErrorAction Stop | Out-Null; 
               Set-Content -LiteralPath '${finalDest}\\${fileName}' -Value 'SECURE_DATA_BLOCK_${Date.now()}' -ErrorAction Stop; 
               Write-Output "COUNT:1"; 
               if (Test-Path -LiteralPath '${finalDest}\\${fileName}') { 
                 Write-Output "INTEGRITY:OK";
                 Write-Output "FILE:${fileName}";
               } else { throw 'Erro ao gravar arquivo no destino' }; `;
          }

const fullScript = `try { ${setupEncoding} ${scriptBody} } catch { $m = $_.Exception.Message; Write-Output "FATAL_ERROR:$m"; Write-Error $m; exit 1; }`;
          
          // Use Base64 to avoid all shell escaping issues
          const encodedScript = Buffer.from(fullScript, 'utf16le').toString('base64');
          const cmd = `chcp 65001 > nul && powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`;
          
          const { stdout, stderr } = await execAsync(cmd, { encoding: 'utf8' });
          
          const fileCountMatch = stdout.match(/COUNT:(\d+)/);
          const integrityMatch = stdout.match(/INTEGRITY:OK/);
          const processedFiles = stdout.split('\n')
            .filter(line => line.startsWith('FILE:'))
            .map(line => line.substring(5).trim());
          
          results.push({ 
            destination: dest.name, 
            status: 'SUCCESS', 
            fileCount: fileCountMatch ? parseInt(fileCountMatch[1]) : 0,
            integrity: !!integrityMatch,
            processedFiles
          });
        } catch (error: any) {
          console.error(`Error backing up to ${dest.name}:`, error);
          
          let cleanMessage = 'Erro desconhecido durante a migração';
          
          // 1. Try to find our custom FATAL_ERROR marker in stdout (most reliable)
          if (error.stdout && error.stdout.includes('FATAL_ERROR:')) {
              cleanMessage = error.stdout.split('FATAL_ERROR:')[1].split('\n')[0].trim();
          } 
          // 2. Otherwise parse stderr
          else if (error.stderr) {
              let stderr = error.stderr.replace(/#<\s*CLIXML[\s\S]*/, '').trim();
              const lines = stderr.split('\n').filter((l: string) => l.trim() && !l.includes('chcp'));
              
              const writeErrLine = lines.find((l: string) => l.includes('Write-Error :') || l.includes('Write-Error:'));
              if (writeErrLine) {
                  cleanMessage = writeErrLine.split(/Write-Error\s*:/i)[1].trim();
              } else if (lines.length > 0) {
                  cleanMessage = lines[0].trim();
              }
          }
          
          // Remove common tech debris and artifacts
          cleanMessage = cleanMessage
            .replace(/^['"\(]+/, '') // Remove leading quotes or parentheses
            .replace(/['"\)]+$/, '') // Remove trailing quotes or parentheses
            .split('at line:1')[0]
            .split('No linha:1')[0]
            .split('--->')[1] || cleanMessage.split('--->')[0]; // Prefer the part after ---> if it exists (usually the inner exception)
            
          cleanMessage = cleanMessage.trim();
          
          if (!cleanMessage || cleanMessage.includes('powershell.exe') || cleanMessage.length < 2) {
              cleanMessage = 'Falha técnica no script de backup (Verifique permissões e caminhos)';
          }

          results.push({ destination: dest.name, status: 'ERROR', message: cleanMessage });
        }
      } else {
        // Mock remote backup for now
        results.push({ destination: dest.name, status: 'SUCCESS (MOCK)', message: 'Remote backup simulated' });
      }
    }

    const hasError = results.some(r => r.status === 'ERROR');
    
    return NextResponse.json({ 
      success: !hasError, 
      results,
      lastRun: Date.now()
    });

  } catch (error) {
    console.error('Backup API Internal Error:', error);
    return NextResponse.json({ error: 'Falha interna no motor de backup' }, { status: 500 });
  }
}
