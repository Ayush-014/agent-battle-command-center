#!/bin/bash
# Trivy Security Scanner - ISO Compliant Vulnerability Report
# Usage: ./scripts/security-scan.sh [html|json|sarif|table]

set -e

FORMAT=${1:-table}
REPORT_DIR="security-reports"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

mkdir -p "$REPORT_DIR"

# Check if Trivy is installed
if ! command -v trivy &> /dev/null; then
    echo "Trivy not found. Installing..."
    curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
fi

echo ""
echo "🔍 Running Trivy Security Scan..."
echo "Scanning: npm, Docker, and filesystem vulnerabilities"
echo ""

case $FORMAT in
    html)
        REPORT_FILE="$REPORT_DIR/vulnerability-report-$TIMESTAMP.html"
        trivy fs . --format template --template "@contrib/html.tpl" --output "$REPORT_FILE"
        echo ""
        echo "📄 HTML Report: $REPORT_FILE"
        ;;
    json)
        REPORT_FILE="$REPORT_DIR/vulnerability-report-$TIMESTAMP.json"
        trivy fs . --format json --output "$REPORT_FILE"
        echo ""
        echo "📄 JSON Report: $REPORT_FILE"
        ;;
    sarif)
        REPORT_FILE="$REPORT_DIR/vulnerability-report-$TIMESTAMP.sarif"
        trivy fs . --format sarif --output "$REPORT_FILE"
        echo ""
        echo "📄 SARIF Report: $REPORT_FILE"
        ;;
    table|*)
        trivy fs . --format table
        ;;
esac

echo ""
echo "📊 Scan Complete"
