import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Destination, DestinationType } from '@/types';
import { existsSync } from 'fs';

import { getRcloneBinary } from '@/lib/rclone-utils';

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
                check.on('error', () => resolve(-1));
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

            // Try to list the bucket (limit to 1 item for speed)
            const rcloneBin = getRcloneBinary();
            const { isRcloneInstalled } = require('@/lib/rclone-utils');
            await isRcloneInstalled(); // This will trigger the logs
            const check = spawn(rcloneBin, args);
            
            // CRITICAL: Handle spawn errors to prevent app-wide crash
            check.on('error', (err: any) => {
                console.error('[SPAWN ERROR] rclone (test):', err);
            });
            
            let stderr = '';
            check.stderr.on('data', (data) => { stderr += data.toString(); });

            const exitCode = await new Promise<number>((resolve) => {
                check.on('error', () => resolve(-1));
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
