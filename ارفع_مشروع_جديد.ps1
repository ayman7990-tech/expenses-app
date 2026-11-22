# ============================================================
# ارفع مشروع جديد على GitHub بسهولة
# الاستخدام:
#   .\ارفع_مشروع_جديد.ps1 -RepoName "اسم-المشروع" -Source "C:\path\to\project"
# ============================================================
param(
    [Parameter(Mandatory=$true)][string]$RepoName,
    [Parameter(Mandatory=$true)][string]$Source,
    [switch]$Public
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# فك التوكن من النسخة المشفّرة (مرتبط بحساب ويندوز الحالي)
$backup = Join-Path $PSScriptRoot ".git_token_backup"
if (-not (Test-Path $backup)) { throw "ملف التوكن المشفّر مش موجود" }
$token = [Net.NetworkCredential]::new('', (ConvertTo-SecureString -String ([IO.File]::ReadAllText($backup, [Text.Encoding]::UTF8)))).Password

$h = @{ Authorization = "Bearer $token"; 'User-Agent' = 'Perch-Upload'; Accept = 'application/vnd.github+json' }
$u = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $h -Method Get
Write-Output "مسجّل كـ: $($u.login)"

# اعمل الـ repo
$body = @{ name=$RepoName; private=(-not $Public); auto_init=$false } | ConvertTo-Json
try {
    $r = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Headers $h -Method Post -Body $body -ContentType 'application/json'
    Write-Output "اتعمل repo: $($r.html_url)"
} catch {
    if ($_.ErrorDetails.Message -match "already exists") { Write-Output "الـ repo موجود، هيتم استخدامه" }
    else { throw $_.Exception.Message }
}

# جهّز مجلد مؤقت ونظيف
$tmp = Join-Path $env:TEMP ("ghpush_" + $RepoName)
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item "$Source\*" $tmp -Recurse -Force
if (Test-Path "$tmp\.git") { Remove-Item "$tmp\.git" -Recurse -Force }

cd $tmp
git init -b main | Out-Null
git add -A
git commit -m "Initial commit: $RepoName" | Out-Null
$url = "https://x-access-token:$token@github.com/$($u.login)/$RepoName.git"
git push -u $url main 2>&1 | Out-Null
git remote set-url origin "https://github.com/$($u.login)/$RepoName.git"

Write-Output "تم الرفع: https://github.com/$($u.login)/$RepoName"
Write-Output "تحذير: متشاركش ملف .git_token_backup مع أي حد."
