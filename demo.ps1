# 回信 · 一键准备演示账号（Windows）
# 第一次：在线上建好演示账号；以后每次演示前再双击：按今天的日期重铺演示数据
# 只动演示账号，你自己的账号不受影响。账号密码在 .demo-account 里。
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot

function Step($t) { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }
function Fail($t) { Write-Host $t -ForegroundColor Red; Read-Host "按回车关闭"; exit 1 }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "没找到 Node.js，请先双击 deploy.bat 装好部署工具。" }
$nodeDir = Split-Path -Parent ((node -p "process.execPath").Trim())
$env:Path = "$nodeDir;$env:Path"
if (-not (Test-Path "node_modules\wrangler\bin\wrangler.js")) { Fail "部署工具还没装，请先双击 deploy.bat。" }
$wrangler = "node_modules\wrangler\bin\wrangler.js"

$tokenFile = Join-Path $PSScriptRoot ".cf-token"
if (Test-Path $tokenFile) { $env:CLOUDFLARE_API_TOKEN = (Get-Content $tokenFile -Raw).Trim() }

if (-not (Test-Path ".demo-account")) { Fail "没找到 .demo-account（演示账号的账号密码文件）。" }
$info = Get-Content ".demo-account" -Encoding UTF8
$user = (($info | Where-Object { $_ -like '账号：*' }) -replace '^账号：', '').Trim()
$name = (($info | Where-Object { $_ -like '称呼：*' }) -replace '^称呼：', '').Trim()

Step "1/2 建演示账号（已经建过会自动跳过）"
if (Test-Path ".demo-user.sql") {
  node $wrangler d1 execute huixin --remote --file .demo-user.sql
  if ($LASTEXITCODE -ne 0) { Fail "建账号失败，把上面的报错截图发给 Claude。" }
}

Step "2/2 按今天的日期铺演示数据"
$sql = Join-Path $PSScriptRoot ".wrangler\demo.sql"
New-Item -ItemType Directory -Force (Split-Path $sql) | Out-Null
$env:DEMO_OUT = $sql
node scripts/demo-reset.mjs $user $name
Remove-Item Env:DEMO_OUT
node $wrangler d1 execute huixin --remote --file $sql
if ($LASTEXITCODE -ne 0) { Fail "铺数据失败，把上面的报错截图发给 Claude。" }

Write-Host ""
Write-Host "完成！用 .demo-account 里的账号密码登录就能演示。" -ForegroundColor Green
Get-Content ".demo-account" -Encoding UTF8 | Write-Host
Read-Host "按回车关闭"
