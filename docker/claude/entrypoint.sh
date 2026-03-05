#!/bin/sh
#
# Entrypoint script for Claude Code container
# Handles dynamic UID/GID mapping to match host user
#

set -eu

USER_UID="${USER_UID:-1000}"
USER_GID="${USER_GID:-1000}"

# If running as root (UID 0), stay as root.
if [ "$USER_UID" -eq 0 ]; then
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

# Ensure config directory is accessible without recursively changing credentials.
if [ -d /claude ]; then
    chown "$USER_UID:$USER_GID" /claude 2>/dev/null || true
    chmod 755 /claude 2>/dev/null || true
fi

# Keep workspace accessible; file ownership is handled by runtime uid:gid.
if [ -d /workspace ]; then
    chmod 755 /workspace 2>/dev/null || true
fi

export SHELL=/bin/bash
export HOME="$USER_HOME"
export USER="$USER_NAME"

exec gosu "$USER_UID:$USER_GID" "$@"
