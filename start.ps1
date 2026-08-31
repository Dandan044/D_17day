# 七日之前 — 一键启动
# 双击 start.bat，或使用桌面快捷方式。

$ErrorActionPreference = 'Stop'
try {
    chcp 65001 | Out-Null
} catch {}
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$Host.UI.RawUI.WindowTitle = '七日之前'
$Url = 'http://localhost:5180'
$Port = 5180

function Test-ListenPort([int]$Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect('127.0.0.1', $Port)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Open-WhenReady {
    $waiter = @"
for (`$i = 0; `$i -lt 90; `$i++) {
    try {
        `$c = New-Object System.Net.Sockets.TcpClient
        `$c.Connect('127.0.0.1', $Port)
        `$c.Close()
        Start-Process '$Url'
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
"@
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $waiter
    ) | Out-Null
}

Write-Host ''
Write-Host '  ========================================' -ForegroundColor DarkYellow
Write-Host '    七日之前 / SEVEN DAYS BEFORE' -ForegroundColor Yellow
Write-Host '  ========================================' -ForegroundColor DarkYellow
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '  [错误] 未检测到 Node.js。' -ForegroundColor Red
    Write-Host '  请先安装：https://nodejs.org/' -ForegroundColor Red
    Write-Host ''
    Read-Host '按回车退出'
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host '  [错误] 未检测到 npm，请重新安装 Node.js。' -ForegroundColor Red
    Write-Host ''
    Read-Host '按回车退出'
    exit 1
}

if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Write-Host '  [1/2] 首次启动，正在安装依赖（只需这一次）...' -ForegroundColor Cyan
    Write-Host ''
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host '  [错误] 依赖安装失败。' -ForegroundColor Red
        Read-Host '按回车退出'
        exit 1
    }
    Write-Host ''
} else {
    Write-Host '  [1/2] 依赖已就绪。' -ForegroundColor Green
}

if (Test-ListenPort $Port) {
    Write-Host "  开发服务器已在运行，正在打开浏览器..." -ForegroundColor Green
    Write-Host "  $Url"
    Start-Process $Url
    Start-Sleep -Seconds 2
    exit 0
}

Write-Host '  [2/2] 正在启动开发服务器...' -ForegroundColor Cyan
Write-Host ''
Write-Host "    游戏地址: $Url" -ForegroundColor White
Write-Host '    关闭本窗口即可停止游戏。' -ForegroundColor DarkGray
Write-Host ''

Open-WhenReady

& npm run dev
$code = $LASTEXITCODE
if ($null -ne $code -and $code -ne 0) {
    Write-Host ''
    Write-Host '  [错误] 启动失败。' -ForegroundColor Red
    Read-Host '按回车退出'
    exit $code
}
