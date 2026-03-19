@echo off
setlocal
cd /d "%~dp0"
echo --- CloudGuard: Configurando Rclone no seu computador ---

if exist "bin\rclone\rclone.exe" (
    echo [INFO] Rclone detectado na pasta bin do projeto.
    echo [INFO] Verificando se o rclone_path.txt está atualizado...
    echo %cd%\bin\rclone\rclone.exe > rclone_path.txt
    echo [SUCESSO] Rclone já está pronto para uso!
    goto :end
)

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-rclone.ps1"
:end
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao configurar rclone automagicamente.
) else (
    echo [SUCESSO] Rclone configurado e pronto para uso pelo app!
)
pause
