#!/bin/sh
#
# Entrypoint script for Claude Code container
# Handles dynamic UID/GID mapping to match host user
#

set -eu

USER_UID="${USER_UID:-1000}"
USER_GID="${USER_GID:-1000}"
CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/claude}"

ensure_default_marketplace() {
    local SETTINGS_FILE="${CLAUDE_CONFIG_DIR%/}/settings.json"

    if ! mkdir -p "$CLAUDE_CONFIG_DIR" 2>/dev/null; then
        return 0
    fi

    if [ -s "$SETTINGS_FILE" ]; then
        return 0
    fi

    if ! cat >"$SETTINGS_FILE" <<'EOF'
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "extraKnownMarketplaces": {
    "claude-plugins-official": {
      "source": {
        "source": "github",
        "repo": "anthropics/claude-plugins-official"
      }
    }
  }
}
EOF
    then
        printf 'warning: could not initialize Claude marketplace defaults at %s\n' "$SETTINGS_FILE" >&2
        return 0
    fi

    if [ "$USER_UID" -ne 0 ]; then
        chown "$USER_UID:$USER_GID" "$SETTINGS_FILE" 2>/dev/null || true
    fi
}

# If a proxy CA cert is mounted, append it to the system CA bundle so all
# HTTPS clients (git, curl, node, etc.) trust traffic through the proxy.
# Note: path is Debian-specific; update if the base image changes.
setup_proxy_ca() {
    if [ -n "${SSL_CERT_FILE:-}" ] && [ -f "$SSL_CERT_FILE" ]; then
        if ! grep -qF "$(sed -n '2p' "$SSL_CERT_FILE")" /etc/ssl/certs/ca-certificates.crt 2>/dev/null; then
            cat "$SSL_CERT_FILE" >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
        fi
    fi
}

# Use HTTPS instead of SSH for GitHub clones (no SSH key needed for public repos).
setup_git_config() {
    git config --system url."https://github.com/".insteadOf "git@github.com:" 2>/dev/null || true
}

# If running as root (UID 0), stay as root.
if [ "$USER_UID" -eq 0 ]; then
    ensure_default_marketplace
    setup_proxy_ca
    setup_git_config
    exec "$@"
fi

# Ensure group exists for the requested GID.
if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd --gid "$USER_GID" claude 2>/dev/null || true
fi

# Ensure user exists for the requested UID.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd \
        --uid "$USER_UID" \
        --gid "$USER_GID" \
        --home-dir /home/claude \
        --create-home \
        --shell /bin/bash \
        claude 2>/dev/null || true
fi

USER_ENTRY="$(getent passwd "$USER_UID" || true)"
USER_NAME="$(printf '%s' "$USER_ENTRY" | cut -d: -f1)"
USER_HOME="$(printf '%s' "$USER_ENTRY" | cut -d: -f6)"

if [ -z "$USER_NAME" ]; then
    USER_NAME="claude"
fi
if [ -z "$USER_HOME" ]; then
    USER_HOME="/home/claude"
fi

mkdir -p "$USER_HOME"
chown "$USER_UID:$USER_GID" "$USER_HOME" 2>/dev/null || true

# Initialize default marketplace settings after user/group setup.
ensure_default_marketplace

# Ensure config directory is accessible without recursively changing credentials.
if [ -d "$CLAUDE_CONFIG_DIR" ]; then
    chown "$USER_UID:$USER_GID" "$CLAUDE_CONFIG_DIR" 2>/dev/null || true
    chmod 755 "$CLAUDE_CONFIG_DIR" 2>/dev/null || true
fi

# Keep workspace accessible; file ownership is handled by runtime uid:gid.
if [ -d /workspace ]; then
    chmod 755 /workspace 2>/dev/null || true
fi

setup_proxy_ca
setup_git_config

# Set up ~/.local/bin for the user so the native install is on PATH and
# `claude doctor` does not warn about it being missing.
CLAUDE_BIN=/root/.local/bin/claude
USER_LOCAL_BIN="${USER_HOME}/.local/bin"
mkdir -p "$USER_LOCAL_BIN" 2>/dev/null || true
if [ ! -e "${USER_LOCAL_BIN}/claude" ] && [ -x "$CLAUDE_BIN" ]; then
    ln -sf "$CLAUDE_BIN" "${USER_LOCAL_BIN}/claude" 2>/dev/null || true
fi
chown -R "$USER_UID:$USER_GID" "${USER_HOME}/.local" 2>/dev/null || true

# Ensure ~/.local/bin is on PATH in ~/.bashrc for interactive shells.
BASHRC="${USER_HOME}/.bashrc"
if ! grep -qF '.local/bin' "$BASHRC" 2>/dev/null; then
    printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$BASHRC" 2>/dev/null || true
    chown "$USER_UID:$USER_GID" "$BASHRC" 2>/dev/null || true
fi

# Write ~/.claude.json with installMethod so `claude doctor` reports the
# correct config install method instead of "unknown".
CLAUDE_JSON="${USER_HOME}/.claude.json"
if [ ! -f "$CLAUDE_JSON" ]; then
    printf '{"installMethod":"native"}\n' > "$CLAUDE_JSON" 2>/dev/null || true
    chown "$USER_UID:$USER_GID" "$CLAUDE_JSON" 2>/dev/null || true
fi

export SHELL=/bin/bash
export HOME="$USER_HOME"
export USER="$USER_NAME"
export PATH="${USER_LOCAL_BIN}:${PATH}"

exec gosu "$USER_UID:$USER_GID" "$@"
