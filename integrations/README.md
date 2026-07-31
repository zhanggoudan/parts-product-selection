# Southeast Rippa MCP configuration templates

This directory contains portable, non-secret configuration templates for the
Southeast Rippa integrations. It is safe to commit these templates to Git.

## Included integrations

- **Meta Ads + Instagram** use the same local `meta-ads` MCP. The template
  contains the account identifiers and Keychain lookup names, but never an
  access token.
- **WordPress/WooCommerce** uses the dedicated `southeastrippa-wordpress`
  MCP. Product creation, updates, and reads work for existing and future
  WooCommerce products by product ID. The Application Password stays in
  Keychain.
- **Google Ads** currently has API application/design metadata only. A local
  Google Ads MCP is not yet registered; Basic Access is pending and an OAuth
  refresh token has not been generated.

## New-computer setup

1. Copy the templates and replace `/PATH/TO/...` placeholders with paths on
   the new computer.
2. Install the Meta MCP source and the Node runtime.
3. Re-authorize Meta/Instagram, then store the long-lived token in the macOS
   Keychain as service `codex.meta.ads`, account `access-token`.
4. Create a new WordPress Application Password for `codex_mcp`, then store it
   in Keychain as service `codex.southeastrippa.wordpress`, account `codex_mcp`.
5. Complete Google OAuth on the new computer. Store Google Ads OAuth and
   developer credentials in Keychain service `codex-google-ads`.

Never replace the Keychain references with real secrets in these files. Do not
commit `.env` files, OAuth client-secret JSON files, access tokens, refresh
tokens, or WordPress Application Passwords.
