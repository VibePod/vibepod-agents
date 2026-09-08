#!/bin/sh
# Entrypoint script for Cline container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}

export HOME
export SHELL=/bin/bash

mkdir -p "$HOME" "$HOME/.cline" "$HOME/.agents/skills" /workspace

setup_proxy_ca() {
    if [ -n "${SSL_CERT_FILE:-}" ] && [ -f "$SSL_CERT_FILE" ]; then
        if ! grep -qF "$(sed -n '2p' "$SSL_CERT_FILE")" /etc/ssl/certs/ca-certificates.crt 2>/dev/null; then
            cat "$SSL_CERT_FILE" >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
        fi
    fi
}

setup_git_config() {
    git config --system url."https://github.com/".insteadOf "git@github.com:" 2>/dev/null || true
}

setup_proxy_ca
setup_git_config

if [ "$USER_UID" -eq 0 ]; then
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" cline 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "cline" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="cline"
    fi
fi

GROUP_NAME=${GROUP_NAME:-cline}

if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -u "$USER_UID" -g "$GROUP_NAME" -d "$HOME" -s /bin/sh cline 2>/dev/null || true
    USER_NAME="cline"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

chown "$USER_UID:$USER_GID" "$HOME" "$HOME/.cline" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
chmod 755 "$HOME" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
# Symlink ~/.cline/skills -> ~/.agents/skills so skills mounted at either path resolve
if [ ! -e "$HOME/.cline/skills" ]; then
    ln -sf "$HOME/.agents/skills" "$HOME/.cline/skills"
fi
chown -h "$USER_UID:$USER_GID" "$HOME/.cline/skills" 2>/dev/null || true
# Cline stores settings, API keys, and sessions under ~/.cline; keep it private.
chmod 700 "$HOME/.cline" 2>/dev/null || true


if [ -d /workspace ]; then
    chown "$USER_UID:$USER_GID" /workspace 2>/dev/null || true
    chmod 755 /workspace 2>/dev/null || true
fi

export USER="$USER_NAME"
export LOGNAME="$USER_NAME"

exec gosu "$USER_UID:$USER_GID" env HOME="$HOME" "$@"
