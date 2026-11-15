# Validation script for Entretempo deployment (Netlify)
$ErrorActionPreference = 'Stop'

# Set URL via environment variable or use default placeholder
if ([string]::IsNullOrEmpty($env:DEPLOY_URL)) {
    $baseUrl = "https://entretempo-prod.netlify.app"
} else {
    $baseUrl = $env:DEPLOY_URL
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Entretempo Deployment Validator" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [array]$ExpectedKeys,
        [int]$TimeoutSec = 15
    )
    Write-Host "Testing: $Name" -NoNewline
    
    try {
        $response = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSec -Method Get
        $jsonStr = $response | ConvertTo-Json -Depth 10
        
        if ($ExpectedKeys) {
            $hasAll = $true
            foreach ($key in $ExpectedKeys) {
                $pattern = '"' + $key + '"'
                if (-not ($jsonStr -match $pattern)) {
                    Write-Host ""
                    Write-Host "  MISSING key: '$key'" -ForegroundColor Red
                    $hasAll = $false
                    break
                }
            }
            if ($hasAll) {
                Write-Host " OK" -ForegroundColor Green
                $script:passed++
            } else {
                $script:failed++
            }
        } else {
            Write-Host " OK (OK)" -ForegroundColor Green
            $script:passed++
        }
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor DarkRed
        $script:failed++
    }
}

Write-Host ""
Write-Host "--- Health Check ---" -ForegroundColor Yellow
Test-Endpoint -Name "GET /api/health" -Url "$baseUrl/api/health" -ExpectedKeys @('ok')

Write-Host ""
Write-Host "--- Movie Search & Details ---" -ForegroundColor Yellow
Test-Endpoint -Name "GET /api/search?type=movie&q=inception" -Url "$baseUrl/api/search?type=movie&q=inception" -ExpectedKeys @('results', 'id', 'title')
Test-Endpoint -Name "GET /api/details?type=movie&id=tt1375666" -Url "$baseUrl/api/details?type=movie&id=tt1375666" -ExpectedKeys @('details', 'id', 'title', 'year', 'runtime')

Write-Host ""
Write-Host "--- Series Search & Details ---" -ForegroundColor Yellow
Test-Endpoint -Name "GET /api/search?type=series&q=breaking+bad" -Url "$baseUrl/api/search?type=series&q=breaking+bad" -ExpectedKeys @('results', 'id', 'title')
Test-Endpoint -Name "GET /api/details?type=series&id=tt9054364" -Url "$baseUrl/api/details?type=series&id=tt9054364" -ExpectedKeys @('details', 'id', 'title', 'seasons')

Write-Host ""
Write-Host "--- Game Search (empty - HLTB blocked) ---" -ForegroundColor Yellow
Test-Endpoint -Name "GET /api/search?type=game&q=cyberpunk+2077" -Url "$baseUrl/api/search?type=game&q=cyberpunk+2077" -ExpectedKeys @('results')

Write-Host ""
Write-Host "--- Frontend SPA ---" -ForegroundColor Yellow
try {
    Write-Host "Testing: GET / (frontend)" -NoNewline
    $resp = Invoke-WebRequest -Uri $baseUrl -TimeoutSec 15 -UseBasicParsing
    if ($resp.StatusCode -eq 200) {
        Write-Host " OK" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " FAILED (status: $($resp.StatusCode))" -ForegroundColor Red
        $script:failed++
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor DarkRed
    $script:failed++
}

$total = $passed + $failed
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "  Results: $passed/$total passed, $failed failed" -ForegroundColor Green
} else {
    Write-Host "  Results: $passed/$total passed, $failed failed" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

exit $(if ($failed -gt 0) { 1 } else { 0 })
