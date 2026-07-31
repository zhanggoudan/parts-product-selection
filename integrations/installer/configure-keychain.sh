#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Keychain setup is supported on macOS only." >&2
  exit 1
fi

store_secret() {
  local label="$1" service="$2" account="$3" value
  printf '%s (leave blank to skip): ' "${label}"
  IFS= read -r -s value
  printf '\n'
  if [[ -z "${value}" ]]; then
    echo "Skipped ${label}."
    return 0
  fi
  if [[ "${service}" == "codex.southeastrippa.wordpress" ]]; then
    value="${value//[[:space:]]/}"
  fi
  security add-generic-password -U -s "${service}" -a "${account}" -w "${value}" >/dev/null
  unset value
  echo "Stored ${label} in macOS Keychain (${service}/${account})."
}

echo "Credentials are written only to this Mac's Keychain; values are not saved in Git."
echo
store_secret "Meta long-lived access token" "codex.meta.ads" "access-token"
store_secret "WordPress Application Password for codex_mcp" "codex.southeastrippa.wordpress" "codex_mcp"
echo
echo "Google Ads credentials are optional until Basic Access and OAuth are complete."
store_secret "Google Ads developer token" "codex-google-ads" "developer-token"
store_secret "Google OAuth client ID" "codex-google-ads" "oauth-client-id"
store_secret "Google OAuth client secret" "codex-google-ads" "oauth-client-secret"
store_secret "Google OAuth refresh token" "codex-google-ads" "refresh-token"

echo
echo "Keychain setup finished. Run doctor.sh to verify presence without revealing values."
