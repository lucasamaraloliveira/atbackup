
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { dest, letter } = await request.json();
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const downloadUrl = `${protocol}://${host}/api/agent/download`;
        const drive = (letter || 'M').toUpperCase();

        const creds = dest.credentials || {};
        const bucket = dest.pathOrBucket;
        const provider = dest.type === 'WASABI' ? 'Wasabi' : 'AWS';
        const endpoint = creds.endpoint || (dest.type === 'WASABI' ? 's3.wasabisys.com' : '');
        const region = creds.region || 'us-east-1';

        // Build the Ultra-Safe Batch Script content
        const batContent = `@echo off
echo [INFO] Iniciando CloudGuard Agent... Verificando integridade do arquivo.
pause
TITLE CloudGuard Agent - Ativador (${drive}:)
echo ======================================================
echo           CLOUDGUARD AGENT - VERSION 3.7
echo ======================================================
echo.

echo [SYSTEM] Verificando requisitos de sistema...
reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WinFsp" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] WinFSP nao detectado. Baixando driver do GitHub...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/winfsp/winfsp/releases/download/v2.0/winfsp-2.0.23075.msi' -OutFile 'winfsp_installer.msi'"
    echo [SYSTEM] Instalando WinFSP... Por favor, siga as instrucoes na tela.
    start /wait winfsp_installer.msi
    del winfsp_installer.msi
)

if not exist "CloudGuardAgent_Setup.exe" (
    echo [SYSTEM] Baixando motor de tecnologia CloudGuard...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${downloadUrl}' -OutFile 'CloudGuardAgent_Setup.exe'"
    attrib +h "CloudGuardAgent_Setup.exe"
)

echo [STEP 1] Varredura e Limpeza de Unidades...
taskkill /F /IM CloudGuardAgent_Setup.exe /IM rclone.exe /T 2>nul
net use G: /delete /y 2>nul
net use M: /delete /y 2>nul
net use S: /delete /y 2>nul
net use W: /delete /y 2>nul
net use Z: /delete /y 2>nul

echo [STEP 2] Montando Disco Virtual na Unidade ${drive}:...
echo Mantenha esta janela aberta para manter o disco montado.

".\\CloudGuardAgent_Setup.exe" mount ":s3:${bucket}" "${drive}:" --s3-provider "${provider}" --s3-access-key-id "${creds.accessKeyId || ''}" --s3-secret-access-key "${creds.secretAccessKey || ''}" --s3-region "${region}" --s3-endpoint "${endpoint}" --vfs-cache-mode full --dir-cache-time 15s --volname "CloudGuard_${dest.name}" --links

if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao realizar a montagem.
    pause
)
`;

        return new NextResponse(batContent, {
            headers: {
                'Content-Type': 'application/x-bat',
                'Content-Disposition': `attachment; filename=Ativar_Disco_CloudGuard_${dest.name.replace(/\s+/g, '_')}_${drive}.bat`,
            },
        });
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Erro ao gerar script' }, { status: 500 });
    }
}
