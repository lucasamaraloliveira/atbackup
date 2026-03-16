import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'directory'; // 'file' or 'directory'

  try {
    let script = '';
    
    if (type === 'file') {
      script = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Title = 'Selecione o arquivo para o backup'; $f.Filter = 'Todos os arquivos (*.*)|*.*'; if($f.ShowDialog() -eq 'OK') { Write-Output $f.FileName }`;
    } else {
      script = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Selecione a pasta para o backup'; if($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }`;
    }

    const setupEncoding = '$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8;';
    const cmd = `chcp 65001 > nul && powershell -NoProfile -ExecutionPolicy Bypass -Command "& { ${setupEncoding} ${script} }"`;
    const { stdout, stderr } = await execAsync(cmd, { encoding: 'utf8' });

    if (stderr) {
      console.error('PowerShell Error:', stderr);
      return NextResponse.json({ error: 'Erro ao abrir seletor' }, { status: 500 });
    }

    const selectedPath = stdout.trim();
    return NextResponse.json({ path: selectedPath });
  } catch (error) {
    console.error('Internal Error:', error);
    return NextResponse.json({ error: 'Falha interna' }, { status: 500 });
  }
}
