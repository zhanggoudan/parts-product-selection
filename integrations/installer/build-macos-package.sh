#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
PACKAGE_NAME="parts-product-selection-mcp-macos-$(date +%Y%m%d)"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "${STAGE_DIR}"' EXIT

mkdir -p "${STAGE_DIR}/${PACKAGE_NAME}/integrations"
cp -R "${ROOT_DIR}/integrations/installer" "${STAGE_DIR}/${PACKAGE_NAME}/integrations/"
cp -R "${ROOT_DIR}/integrations/servers" "${STAGE_DIR}/${PACKAGE_NAME}/integrations/"
cp "${ROOT_DIR}/integrations/README.md" "${STAGE_DIR}/${PACKAGE_NAME}/integrations/"
cp "${ROOT_DIR}/integrations/manifest.json" "${STAGE_DIR}/${PACKAGE_NAME}/integrations/"
cp "${ROOT_DIR}/integrations/"*.example.* "${STAGE_DIR}/${PACKAGE_NAME}/integrations/"
chmod 755 "${STAGE_DIR}/${PACKAGE_NAME}/integrations/installer/"*.sh

cat > "${STAGE_DIR}/${PACKAGE_NAME}/README.txt" <<'EOF'
Southeast Rippa MCP installer

1. Open Terminal in this folder.
2. Run: ./integrations/installer/install.sh --apply-config
3. Run: ./integrations/installer/configure-keychain.sh
4. Run: ./integrations/installer/doctor.sh

Never send or commit Keychain values. Google Ads remains unavailable until
Basic Access and OAuth refresh-token setup are complete.
EOF

mkdir -p "${DIST_DIR}"
ditto -c -k --sequesterRsrc --keepParent "${STAGE_DIR}/${PACKAGE_NAME}" "${DIST_DIR}/${PACKAGE_NAME}.zip"
echo "Created ${DIST_DIR}/${PACKAGE_NAME}.zip"
