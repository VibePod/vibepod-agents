#!/bin/sh
#
# Entrypoint script for Antigravity CLI (agy) container
# Handles dynamic UID/GID mapping to match host user for bind mounts
#

set -eu

USER_UID="${USER_UID:-1000}"
USER_GID="${USER_GID:-1000}"

# If a proxy CA cert is mounted, append it to the system CA bundle so all
# HTTPS clients (git, curl, etc.) trust traffic through the proxy.
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
    setup_proxy_ca
    setup_git_config
    exec "$@"
fi

# Ensure group exists for the requested GID.
if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd --gid "$USER_GID" agy 2>/dev/null || true
fi

# Ensure user exists for the requested UID.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd \
        --uid "$USER_UID" \
        --gid "$USER_GID" \
        --home-dir /home/agy \
        --create-home \
        --shell /bin/bash \
        agy 2>/dev/null || true
fi

USER_ENTRY="$(getent passwd "$USER_UID" || true)"
USER_NAME="$(printf '%s' "$USER_ENTRY" | cut -d: -f1)"
USER_HOME="$(printf '%s' "$USER_ENTRY" | cut -d: -f6)"

if [ -z "$USER_NAME" ]; then
    USER_NAME="agy"
fi
if [ -z "$USER_HOME" ]; then
    USER_HOME="/home/agy"
fi

mkdir -p "$USER_HOME"
chown "$USER_UID:$USER_GID" "$USER_HOME" 2>/dev/null || true

# Keep workspace accessible; file ownership is handled by runtime uid:gid.
if [ -d /workspace ]; then
    chmod 755 /workspace 2>/dev/null || true
fi

# Ensure config directory is accessible.
if [ -d /agy ]; then
    chown "$USER_UID:$USER_GID" /agy 2>/dev/null || true
    chmod 755 /agy 2>/dev/null || true
fi

setup_proxy_ca
setup_git_config

# Set up ~/.local/bin for the user so the native install is on PATH.
AGY_BIN=/root/.local/bin/agy
USER_LOCAL_BIN="${USER_HOME}/.local/bin"
mkdir -p "$USER_LOCAL_BIN" 2>/dev/null || true
if [ ! -e "${USER_LOCAL_BIN}/agy" ] && [ -x "$AGY_BIN" ]; then
    ln -sf "$AGY_BIN" "${USER_LOCAL_BIN}/agy" 2>/dev/null || true
fi
chown -R "$USER_UID:$USER_GID" "${USER_HOME}/.local" 2>/dev/null || true

export SHELL=/bin/bash
export HOME="$USER_HOME"
export USER="$USER_NAME"
export PATH="${USER_LOCAL_BIN}:${PATH}"

exec gosu "$USER_UID:$USER_GID" "$@"
