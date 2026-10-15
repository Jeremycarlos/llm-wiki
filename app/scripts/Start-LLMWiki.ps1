[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$WikiPath,
  [ValidateRange(1, 65535)][int]$Port = 3738
)

$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$cliPath = Join-Path $sourceRoot 'apps\web\bin\llm-wiki.mjs'
$buildPath = Join-Path $sourceRoot 'apps\web\.next\BUILD_ID'
if (-not (Test-Path -LiteralPath $WikiPath -PathType Container)) { throw "知识库目录不存在：$WikiPath" }
if (-not (Test-Path -LiteralPath $buildPath)) { throw '请先在源码目录运行 pnpm build:local。' }
$node = (Get-Command node -ErrorAction Stop).Source

# 从用户环境读取已保存的密钥，仅放入当前进程内存；不打印、不落盘。
foreach ($name in 'DASHSCOPE_API_KEY', 'DASHSCOPE_BASE_URL') {
  if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
    $value = [Environment]::GetEnvironmentVariable($name, 'User')
    if ($value) { [Environment]::SetEnvironmentVariable($name, $value, 'Process') }
  }
}
$uri = "http://127.0.0.1:$Port"
try {
  $health = Invoke-RestMethod -Uri "$uri/api/config" -TimeoutSec 3
  if ($null -ne $health.bailian) {
    $running = Invoke-RestMethod -Uri "$uri/api/settings" -TimeoutSec 3
    if ([IO.Path]::GetFullPath($running.wikiPath) -eq [IO.Path]::GetFullPath($WikiPath)) {
      Write-Output "百炼源码版已运行：$uri"
      return
    }
  }
} catch {}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  throw "端口 $Port 已被其他服务使用，请指定其他端口。"
}
$arguments = '"' + $cliPath + '" start "' + ([IO.Path]::GetFullPath($WikiPath)) + '" --no-open --port ' + $Port
$server = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $sourceRoot -WindowStyle Hidden -PassThru
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 1
  if ($server.HasExited) { throw '源码服务启动失败。请在源码目录运行 node apps/web/bin/llm-wiki.mjs start <知识库路径> --no-open --port 3738 查看错误。' }
  try {
    $health = Invoke-RestMethod -Uri "$uri/api/config" -TimeoutSec 2
    if ($null -ne $health.bailian) {
      Write-Output "百炼源码版已启动：$uri"
      return
    }
  } catch {}
}
throw "服务未能在 30 秒内就绪：$uri"
