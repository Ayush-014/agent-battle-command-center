#!/usr/bin/env pwsh
# Trivy Security Scanner - ISO Compliant Vulnerability Report
# Usage: ./scripts/security-scan.ps1 [-Format html|json|sarif|table]

param(
    [ValidateSet("html", "json", "sarif", "table")]
    [string]$Format = "table",
    [switch]$ExitOnVuln
)

$ReportDir = "security-reports"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Create reports directory
if (!(Test-Path $ReportDir)) {
    New-Item -ItemType Directory -Path $ReportDir | Out-Null
}

# Check if Trivy is installed
if (!(Get-Command trivy -ErrorAction SilentlyContinue)) {
    Write-Host "Trivy not found. Installing via winget..." -ForegroundColor Yellow
    winget install AquaSecurity.Trivy
    Write-Host "Please restart your terminal and run again." -ForegroundColor Green
    exit 1
}

Write-Host "`n🔍 Running Trivy Security Scan..." -ForegroundColor Cyan
Write-Host "Scanning: npm, Docker, and filesystem vulnerabilities`n"

$ExitCode = 0

switch ($Format) {
    "html" {
        $ReportFile = "$ReportDir/vulnerability-report-$Timestamp.html"
        trivy fs . --format template --template "@contrib/html.tpl" --output $ReportFile
        Write-Host "`n📄 HTML Report: $ReportFile" -ForegroundColor Green
    }
    "json" {
        $ReportFile = "$ReportDir/vulnerability-report-$Timestamp.json"
        trivy fs . --format json --output $ReportFile
        Write-Host "`n📄 JSON Report: $ReportFile" -ForegroundColor Green
    }
    "sarif" {
        $ReportFile = "$ReportDir/vulnerability-report-$Timestamp.sarif"
        trivy fs . --format sarif --output $ReportFile
        Write-Host "`n📄 SARIF Report: $ReportFile" -ForegroundColor Green
    }
    "table" {
        trivy fs . --format table
        if ($ExitOnVuln) {
            trivy fs . --exit-code 1 --severity HIGH,CRITICAL 2>$null
            $ExitCode = $LASTEXITCODE
        }
    }
}

# Summary
Write-Host "`n📊 Scan Complete" -ForegroundColor Cyan
Write-Host "For ISO compliance reports, use: ./scripts/security-scan.ps1 -Format html"
Write-Host "For CI/CD integration, use: ./scripts/security-scan.ps1 -Format sarif"

exit $ExitCode
