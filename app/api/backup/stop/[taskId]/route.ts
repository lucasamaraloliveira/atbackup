
import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/lib/tasks';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    const task = TaskService.getTask(taskId);

    if (!task) {
        return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    if (task.status === 'RUNNING') {
        TaskService.stopProcess(taskId);
        return NextResponse.json({ success: true, message: 'Processo interrompido com sucesso.' });
    }

    return NextResponse.json({ error: 'Tarefa não está em execução' }, { status: 400 });
}
