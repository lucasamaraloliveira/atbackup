
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

import { isRcloneInstalled } from '@/lib/rclone-utils';

export async function POST(request: NextRequest) {
    try {
        // First check if already installed to avoid redundant downloads
        const alreadyInstalled = await isRcloneInstalled();
        if (alreadyInstalled) {
            return NextResponse.json({ success: true, alreadyInstalled: true, message: 'Rclone já está configurado e pronto para uso!' });
        }

        const projectRoot = process.cwd();
        const scriptPath = path.join(projectRoot, 'scripts', 'setup-rclone.ps1');

        const ps = spawn('powershell', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath
        ]);

        let stdout = '';
        let stderr = '';

        ps.stdout.on('data', (data) => { stdout += data.toString(); });
        ps.stderr.on('data', (data) => { stderr += data.toString(); });

        const exitCode = await new Promise<number>((resolve) => {
            ps.on('close', (code) => resolve(code || 0));
        });

        if (exitCode === 0) {
            return NextResponse.json({ success: true, message: 'Rclone configurado via script automágico!' });
        } else {
            console.error('[SETUP ERROR] PowerShell exited with code', exitCode, stderr);
            return NextResponse.json({ success: false, message: `Erro ao configurar: ${stderr.slice(0, 100)}` }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[SETUP EXCEPTION]', error);
        return NextResponse.json({ success: false, message: `Erro interno: ${error.message}` }, { status: 500 });
    }
}
