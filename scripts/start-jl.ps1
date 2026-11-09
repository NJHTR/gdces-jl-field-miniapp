# 现场助手一键启动：后端 + 手机热点转发 + 微信预览二维码
$ErrorActionPreference = "Continue"
$root = "C:\Users\NJHTR\WeChatProjects\jl"
$sshHost = "rokid-r640"
$devtools = "C:\Program Files (x86)\Tencent\微信web开发者工具"
$healthUrl = "http://192.168.137.1:8081/healthz"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }

Write-Step "1/4 检查后端"
$backend = ssh -o BatchMode=yes -o ConnectTimeout=15 $sshHost "curl -s -m 5 http://127.0.0.1:8081/healthz" 2>$null
if ($backend -match '"ok"\s*:\s*true') {
  Write-Ok "后端已在运行"
} else {
  Write-Warn "后端没响应，正在启动..."
  ssh -o BatchMode=yes -o ConnectTimeout=20 $sshHost "cd /home/baize/jl-service && bash scripts/start-bff.sh" 2>$null
  Start-Sleep -Seconds 3
  $backend = ssh -o BatchMode=yes -o ConnectTimeout=15 $sshHost "curl -s -m 5 http://127.0.0.1:8081/healthz" 2>$null
  if ($backend -match '"ok"\s*:\s*true') { Write-Ok "后端启动成功" }
  else { Write-Warn "后端启动失败，请把这条消息发给助手" }
}

Write-Step "2/4 检查手机热点转发"
$listen = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
$pcHealth = $null
try { $pcHealth = (Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 5).Content } catch {}
if ($listen -and $pcHealth -match '"ok"\s*:\s*true') {
  Write-Ok "热点转发已通"
} else {
  Write-Warn "转发没通，正在重启 SSH 转发..."
  if ($listen) {
    foreach ($c in $listen) {
      try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
    Start-Sleep -Seconds 1
  }
  $sshArgs = @("-N","-g","-o","ExitOnForwardFailure=yes","-o","ServerAliveInterval=30",
               "-L","0.0.0.0:8081:127.0.0.1:8081",$sshHost)
  Start-Process -FilePath ssh -ArgumentList $sshArgs -WindowStyle Hidden
  Start-Sleep -Seconds 4
  try { $pcHealth = (Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 8).Content } catch {}
  if ($pcHealth -match '"ok"\s*:\s*true') { Write-Ok "热点转发已恢复" }
  else { Write-Warn "转发仍然不通；检查电脑热点是否开启（192.168.137.1）" }
}

Write-Step "3/4 检查微信开发者工具"
$wx = Get-Process -Name "微信开发者工具" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $wx) {
  Write-Warn "开发者工具没开，正在启动..."
  Start-Process -FilePath "$devtools\微信开发者工具.exe"
  Start-Sleep -Seconds 10
}
if (Get-Process -Name "微信开发者工具" -ErrorAction SilentlyContinue) {
  Write-Ok "开发者工具已就绪"
} else {
  Write-Warn "开发者工具启动失败，请手动打开"
}

Write-Step "4/4 生成手机预览二维码"
$qr = Join-Path $root "preview-latest.png"
if (Test-Path $qr) { Remove-Item $qr -Force -ErrorAction SilentlyContinue }
& "$devtools\wechatide.cmd" -c project-action create_preview_qrcode --project $root --qr-format image --qr-output $qr 2>$null | Out-Null
if (Test-Path $qr) {
  Write-Ok "二维码已生成：$qr"
  Start-Process $qr
} else {
  Write-Warn "二维码没生成，可能需要先在开发者工具里打开项目"
}

Write-Host "`n完成。手机连电脑热点，扫刚打开的二维码即可。" -ForegroundColor Green
Write-Host "如果手机提示网络连接不上：确认手机 Wi-Fi 是 192.168.137.x，再重跑本脚本。"
