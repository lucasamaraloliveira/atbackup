import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Destination, DestinationType } from '@/types';
import { existsSync } from 'fs';

// Helper to find rclone binary
const getRcloneBinary = () => {
    const wingetPath = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe\\rclone-v1.73.2-windows-amd64\\rclone.exe`;
    if (existsSync(wingetPath)) return wingetPath;
    
    if (existsSync('C:\\Program Files\\rclone\\rclone.exe')) return 'C:\\Program Files\\rclone\\rclone.exe';
    
    return 'rclone'; // Use PATH as last resort
};

export async function POST(request: NextRequest) {
    try {
        const dest: Destination = await request.json();

        if (!dest) {
            return NextResponse.json({ success: false, message: 'Dados inválidos' }, { status: 400 });
        }

        if (dest.type === DestinationType.LOCAL || dest.type === DestinationType.NETWORK) {
            // Test local/network path via PowerShell
            const path = dest.pathOrBucket.trim().replace(/\//g, '\\');
            const check = spawn('powershell', ['-Command', `Test-Path -Path '${path}'`]);
            
            let output = '';
            check.stdout.on('data', (data) => { output += data.toString(); });

            const exitCode = await new Promise<number>((resolve) => {
                check.on('close', (code) => resolve(code || 0));
            });

            const exists = output.trim().toLowerCase() === 'true';
            
            if (exists) {
                return NextResponse.json({ success: true, message: 'Caminho acessível com sucesso.' });
            } else {
                return NextResponse.json({ success: false, message: 'Caminho não encontrado ou sem permissão.' });
            }
        } else {
            // Test Cloud via rclone
            const bucket = dest.pathOrBucket;
            const creds = dest.credentials || {};

            const args = ['lsd', `:s3:${bucket}`, '--max-depth', '1'];
            
            if (dest.type === DestinationType.WASABI || dest.type === DestinationType.AWS || dest.type === DestinationType.DIGITALOCEAN) {
                const provider = dest.type === DestinationType.WASABI ? 'Wasabi' : 
                               dest.type === DestinationType.DIGITALOCEAN ? 'DigitalOcean' : 'AWS';
                
                args.push('--s3-provider', provider);
                if (creds.accessKeyId) args.push('--s3-access-key-id', creds.accessKeyId);
                if (creds.secretAccessKey) args.push('--s3-secret-access-key', creds.secretAccessKey);
                if (creds.region) args.push('--s3-region', creds.region || 'us-east-1');
                
                const endpoint = creds.endpoint || (dest.type === DestinationType.WASABI ? 's3.wasabisys.com' : '');
                if (endpoint) args.push('--s3-endpoint', endpoint);
            }

            // Try to list the bucket (limit to 1 item for speed)
            const check = spawn(getRcloneBinary(), args);
            
            let stderr = '';
            check.stderr.on('data', (data) => { stderr += data.toString(); });

            const exitCode = await new Promise<number>((resolve) => {
                check.on('close', (code) => resolve(code || 0));
            });

            if (exitCode === 0) {
                return NextResponse.json({ success: true, message: 'Conexão com o Bucket estabelecida com sucesso.' });
            } else {
                return NextResponse.json({ 
                    success: false, 
                    message: `Falha na conexão: ${stderr.includes('not found') ? 'Bucket não encontrado' : 'Erro de autenticação ou configuração rclone'}` 
                });
            }
        }

    } catch (error: any) {
        console.error('Test Connection Error:', error);
        return NextResponse.json({ success: false, message: `Erro interno: ${error.message}` }, { status: 500 });
    }
}
