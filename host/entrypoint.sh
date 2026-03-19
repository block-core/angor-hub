#!/bin/sh
# Generate config.js from environment variables at container startup.
# This lets Docker deployments set hub mode and admin keys without rebuilding.

CONFIG_FILE="dist/browser/config.js"

# Only generate if at least one hub config var is set
if [ -n "$HUB_MODE" ] || [ -n "$ADMIN_PUBKEYS" ]; then
  echo "window.__ANGOR_HUB_CONFIG__ = {" > "$CONFIG_FILE"

  if [ -n "$HUB_MODE" ]; then
    echo "  hubMode: '$HUB_MODE'," >> "$CONFIG_FILE"
  fi

  if [ -n "$ADMIN_PUBKEYS" ]; then
    # ADMIN_PUBKEYS is a comma-separated list of npubs
    # Convert "npub1abc,npub1def" → ['npub1abc','npub1def']
    FORMATTED=$(echo "$ADMIN_PUBKEYS" | sed "s/[[:space:]]//g; s/,/','/g; s/.*/'&'/")
    echo "  adminPubkeys: [$FORMATTED]," >> "$CONFIG_FILE"
  fi

  echo "};" >> "$CONFIG_FILE"
  echo "[entrypoint] Generated $CONFIG_FILE (hubMode=${HUB_MODE:-default}, adminPubkeys=${ADMIN_PUBKEYS:+set})"
else
  echo "[entrypoint] No hub config env vars set, using built-in defaults"
fi

# Hand off to the main process
exec node index.js
