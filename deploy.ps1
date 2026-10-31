# 回信 · 一键部署到 Cloudflare（Windows）
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot

function Step($t) { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }

Step "1/4 检查 Node.js"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "没找到 Node.js。请先到 https://nodejs.org 下载安装 LTS 版本，装好后重新双击 deploy.bat。" -ForegroundColor Red
  Read-Host "按回车关闭"; exit 1
}
# 找到 node.exe 真实所在的文件夹，放到 PATH 最前面 —— 不然 npm 调用的子程序会找不到 node
$nodeExe = (node -p "process.execPath").Trim()
$nodeDir = Split-Path -Parent $nodeExe
$env:Path = "$nodeDir;$env:Path"
Write-Host "Node $(node -v) · $nodeExe"

Step "2/4 安装部署工具（第一次会慢一点）"
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue }
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
  Write-Host "官方源装不上，换国内镜像再试一次…" -ForegroundColor Yellow
  if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue }
  npm install --no-audit --no-fund --registry=https://registry.npmmirror.com
}
if (-not (Test-Path "node_modules\.bin\wrangler.cmd")) {
  Write-Host "部署工具没装上，把上面的报错截图发给 Claude。" -ForegroundColor Red
  Read-Host "按回车关闭"; exit 1
}

Step "3/4 登录 Cloudflare"
$tokenFile = Join-Path $PSScriptRoot ".cf-token"
if (Test-Path $tokenFile) { $env:CLOUDFLARE_API_TOKEN = (Get-Content $tokenFile -Raw).Trim() }
if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Host "有 Cloudflare API 令牌就粘贴进来按回车；没有的话直接按回车，用浏览器授权。"
  $tk = Read-Host "API 令牌"
  if ($tk.Trim()) {
    $env:CLOUDFLARE_API_TOKEN = $tk.Trim()
    Set-Content -Path $tokenFile -Value $tk.Trim() -NoNewline
  }
}
if (-not $env:CLOUDFLARE_API_TOKEN) {
  $who = npx wrangler whoami 2>&1 | Out-String
  if ($who -notmatch "associated with the email") { npx wrangler login }
}
npx wrangler whoami

Step "4/4 上传网站"
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { Write-Host "上传失败，把上面的报错截图发给 Claude。" -ForegroundColor Red; Read-Host "按回车关闭"; exit 1 }

$keyFile = Join-Path $PSScriptRoot ".ai-key"
if (Test-Path $keyFile) {
  $key = (Get-Content $keyFile -Raw).Trim()
  Write-Host "读取到 .ai-key，设置 AI 的 Key…"
} else {
  Write-Host ""
  Write-Host "AI 回信需要模型的 Key（就是 Life OS 云函数里那个 TOKENHUB_API_KEY，sk- 开头）。" -ForegroundColor Cyan
  Write-Host "已经设置过、或者想以后再设置，直接按回车跳过。"
  $key = Read-Host "粘贴 Key 后按回车"
}
if ($key -and $key.Trim()) {
  $key.Trim() | npx wrangler secret put AI_API_KEY
  if (Test-Path $keyFile) { Remove-Item $keyFile -Force }   # 设置好就删掉，Key 不留在电脑上
}

Write-Host ""
Write-Host "完成！上面 https://huixin.xxx.workers.dev 那行就是网址，回到 Claude 告诉它一声。" -ForegroundColor Green
Read-Host "按回车关闭"
