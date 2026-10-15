[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$git = Get-Command git -ErrorAction Stop

$patterns = [ordered]@{
    'OpenAI API Key'     = '\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}'
    'Anthropic API Key'  = '\bsk-ant-[A-Za-z0-9_-]{16,}'
    'Google API Key'     = '\bAIza[0-9A-Za-z_-]{20,}'
    'GitHub Token'       = '\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}'
    'Hugging Face Token' = '\bhf_[A-Za-z0-9]{20,}'
    'AWS Access Key'     = '\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'
    'Slack Token'        = '\bxox[baprs]-[A-Za-z0-9-]{10,}'
    'Private Key'        = '-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'
    'Bearer Token'       = '(?i)\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}'
    'Credential URL'     = '(?i)\bhttps?://[^\s/:]+:[^\s/@]+@[^\s/]+'
    'Email Address'      = '\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b'
    'China Mobile'       = '(?<!\d)1[3-9]\d{9}(?!\d)'
    'Private IPv4'       = '\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})\b'
    'Windows User Path'  = '(?i)\bC:\\Users\\[^\\\s]+'
}

$allowlistPath = Join-Path $repoRoot 'publish-allowlist.txt'
$allowed = Get-Content -LiteralPath $allowlistPath -Encoding UTF8 |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and -not $_.StartsWith('#') }

$publishFiles = & $git.Source -C $repoRoot ls-files --cached --others --exclude-standard
$unexpected = @($publishFiles | Where-Object { $_ -notin $allowed })
$findings = [System.Collections.Generic.List[object]]::new()

foreach ($relativePath in $publishFiles) {
    $path = Join-Path $repoRoot $relativePath
    if ([IO.Path]::GetExtension($relativePath) -in @('.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico')) {
        continue # Screenshots require visual review; do not interpret binary bytes as text.
    }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }

    try {
        $lines = Get-Content -LiteralPath $path -Encoding UTF8 -ErrorAction Stop
    }
    catch {
        continue
    }

    for ($lineIndex = 0; $lineIndex -lt $lines.Count; $lineIndex++) {
        foreach ($entry in $patterns.GetEnumerator()) {
            # These exact synthetic strings exercise key masking/storage in tests.
            $scanLine = $lines[$lineIndex] -replace 'sk-bailian-safe-test|sk-unit-private-value|Bearer test-bailian-only|https://user:password@dashscope.aliyuncs.com/compatible-mode/v1|i@izs.me', '[public-test-or-upstream-metadata]'
            if ($scanLine -match $entry.Value) {
                $findings.Add([pscustomobject]@{
                    Type = $entry.Key
                    File = $relativePath
                    Line = $lineIndex + 1
                })
            }
        }
    }
}

$historyText = ((& $git.Source -C $repoRoot log --all -p --format= --no-ext-diff --no-textconv) -join "`n") -replace 'sk-bailian-safe-test|sk-unit-private-value|Bearer test-bailian-only|https://user:password@dashscope.aliyuncs.com/compatible-mode/v1|i@izs.me', '[public-test-or-upstream-metadata]'
foreach ($entry in $patterns.GetEnumerator()) {
    if ($historyText -match $entry.Value) {
        $findings.Add([pscustomobject]@{
            Type = $entry.Key
            File = '[Git history]'
            Line = '-'
        })
    }
}

$authorEmails = @(& $git.Source -C $repoRoot log --all --format='%ae%n%ce' | Sort-Object -Unique)
foreach ($email in $authorEmails) {
    if ($email -and $email -notmatch '@users\.noreply\.github\.com$') {
        $findings.Add([pscustomobject]@{
            Type = 'Commit Author Email'
            File = '[Git metadata]'
            Line = '-'
        })
    }
}

if ($unexpected.Count -gt 0) {
    Write-Error "Files outside publish allowlist: $($unexpected -join ', ')"
}

if ($findings.Count -gt 0) {
    $findings | Sort-Object File, Line, Type | Format-Table -AutoSize
    Write-Error 'Sensitive-data scan failed. Only finding types and locations are shown.'
}

Write-Host "Scan passed: $($publishFiles.Count) publishable files are allowlisted and no sensitive pattern matched."
