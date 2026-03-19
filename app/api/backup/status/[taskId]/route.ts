
import { NextRequest, NextResponse } from 'next/server';
import { TaskService } from '@/lib/tasks';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    const task = TaskService.getTask(taskId);

    if (!task) {
        return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    return NextResponse.json(task);
}
