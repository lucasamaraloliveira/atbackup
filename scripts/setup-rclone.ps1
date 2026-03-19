
# Rclone Setup Script for CloudGuard Backup
# This script downloads and extracts rclone into the project's bin folder

$RcloneVersion = "1.73.2"
$Architecture = "windows-amd64"
$DownloadUrl = "https://downloads.rclone.org/v$RcloneVersion/rclone-v$RcloneVersion-$Architecture.zip"
$ProjectRoot = Get-Location
$BinFolder = Join-Path $ProjectRoot "bin"
$RcloneZip = Join-Path $BinFolder "rclone.zip"
$RcloneExtractPath = Join-Path $BinFolder "rclone-temp"
$FinalRclonePath = Join-Path $BinFolder "rclone"
$OverrideFile = Join-Path $ProjectRoot "rclone_path.txt"

Write-Host "--- CloudGuard Rclone Setup ---" -ForegroundColor Blue

if (Test-Path $ExePath) {
    Write-Host "[INFO] Rclone já está instalado em $FinalRclonePath" -ForegroundColor Green
    $ExePath | Out-File -FilePath $OverrideFile -Encoding utf8 -Force
    exit 0
}

# 1. Create bin folder if it doesn't exist
if (!(Test-Path $BinFolder)) {
    New-Item -ItemType Directory -Path $BinFolder | Out-Null
}

# 2. Download Rclone
Write-Host "[1/4] Baixando Rclone v$RcloneVersion..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $DownloadUrl -OutFile $RcloneZip

# 3. Extract Rclone
Write-Host "[2/4] Extraindo arquivos..." -ForegroundColor Cyan
if (Test-Path $RcloneExtractPath) { Remove-Item $RcloneExtractPath -Recurse -Force }
Expand-Archive -Path $RcloneZip -DestinationPath $RcloneExtractPath

# 4. Move to final location
Write-Host "[3/4] Configurando binários..." -ForegroundColor Cyan
if (Test-Path $FinalRclonePath) { Remove-Item $FinalRclonePath -Recurse -Force }
$ExtractedSubfolder = Get-ChildItem -Path $RcloneExtractPath | Select-Object -First 1
Move-Item -Path $ExtractedSubfolder.FullName -Destination $FinalRclonePath

# 5. Create path override
Write-Host "[4/4] Atualizando rclone_path.txt..." -ForegroundColor Cyan
$ExePath = Join-Path $FinalRclonePath "rclone.exe"
$ExePath | Out-File -FilePath $OverrideFile -Encoding utf8

# Cleanup
Remove-Item $RcloneZip -Force
Remove-Item $RcloneExtractPath -Recurse -Force

Write-Host "--- Setup concluído com sucesso! ---" -ForegroundColor Green
Write-Host "Caminho configurado: $ExePath"
