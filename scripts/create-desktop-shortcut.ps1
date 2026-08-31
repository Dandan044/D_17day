# 在当前用户桌面创建「七日之前」快捷方式。
$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Desktop = [Environment]::GetFolderPath('Desktop')
if (-not $Desktop) {
    throw '找不到桌面目录。'
}

$bat = Join-Path $Root 'start.bat'
if (-not (Test-Path $bat)) {
    throw "找不到启动脚本：$bat"
}

$shortcutPath = Join-Path $Desktop '七日之前.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $bat
$shortcut.WorkingDirectory = "$Root"
$shortcut.WindowStyle = 1
$shortcut.Description = '一键启动 七日之前 / SEVEN DAYS BEFORE'
$iconCandidate = Join-Path $env:SystemRoot 'System32\imageres.dll'
if (Test-Path $iconCandidate) {
    $shortcut.IconLocation = "$iconCandidate,102"
}
$shortcut.Save()

Write-Host "已创建桌面快捷方式：$shortcutPath"
