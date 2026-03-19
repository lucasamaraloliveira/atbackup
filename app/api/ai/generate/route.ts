
import { NextRequest, NextResponse } from 'next/server';
import { generateBackupScript } from '@/services/geminiService';
import { BackupJob, Destination, Language } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const { job, destinations, lang }: { job: BackupJob; destinations: Destination[]; lang: Language } = await request.json();
        
        if (!job || !destinations || !lang) {
            return NextResponse.json({ success: false, message: 'Dados insuficientes' }, { status: 400 });
        }

        const script = await generateBackupScript(job, destinations, lang);
        return NextResponse.json({ success: true, script });
    } catch (error: any) {
        console.error('AI API Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
