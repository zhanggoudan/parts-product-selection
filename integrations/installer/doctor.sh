#!/usr/bin/env bash
set -euo pipefail

CODEX_ROOT="${CODEX_ROOT:-${HOME}/.codex}"
INSTALL_ROOT="${CODEX_ROOT}/parts-product-selection-integrations"
PASS=0
WARN=0

pass() { PASS=$((PASS + 1)); echo "[OK] $*"; }
warn() { WARN=$((WARN + 1)); echo "[WARN] $*"; }

if [[ "$(uname -s)" == "Darwin" ]]; then pass "macOS detected"; else warn "This bundle targets macOS"; fi

if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node -p 'process.versions.node')"
  pass "Node.js ${NODE_VERSION} available"
elif [[ -x "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node" ]]; then
  pass "ChatGPT bundled Node.js available"
else
  warn "Node.js not found"
fi

[[ -f "${INSTALL_ROOT}/meta-ads-mcp/scripts/meta-ads-mcp.mjs" ]] && pass "Meta MCP installed" || warn "Meta MCP is not installed"
[[ -f "${INSTALL_ROOT}/wordpress/server.mjs" ]] && pass "WordPress MCP installed" || warn "WordPress MCP is not installed"
[[ -f "${INSTALL_ROOT}/config/mcp.toml" ]] && pass "Machine-specific MCP config generated" || warn "Generated MCP config missing"

keychain_has() {
  security find-generic-password -s "$1" -a "$2" >/dev/null 2>&1
}

if keychain_has codex.meta.ads access-token; then pass "Meta token present in Keychain"; else warn "Meta token missing from Keychain"; fi
if keychain_has codex.southeastrippa.wordpress codex_mcp; then pass "WordPress Application Password present"; else warn "WordPress Application Password missing"; fi

for account in developer-token oauth-client-id oauth-client-secret refresh-token; do
  if keychain_has codex-google-ads "${account}"; then
    pass "Google Ads ${account} present"
  else
    warn "Google Ads ${account} missing"
  fi
done

echo
echo "Result: ${PASS} checks passed, ${WARN} warnings."
if [[ "${WARN}" -gt 0 ]]; then
  echo "Warnings do not expose credentials; they indicate setup still needed."
fi
