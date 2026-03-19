import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
    try {
        const filePath = join(process.cwd(), 'public', 'agent', 'CloudGuardAgent_Setup.exe');
        const fileContent = readFileSync(filePath);
        
        return new NextResponse(fileContent, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename=CloudGuardAgent_Setup.exe',
            },
        });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Arquivo não encontrado no servidor.' }, { status: 404 });
    }
}
