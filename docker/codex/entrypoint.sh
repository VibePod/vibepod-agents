#!/bin/sh
# Entrypoint script for Codex container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}

# Codex's OAuth login server binds 127.0.0.1:1455 (loopback only, not
# configurable), which a published Docker port can't reach. When `vp run codex
# login` sets VIBEPOD_OAUTH_FORWARD_PORT, bridge that published port to Codex's
# loopback so the host browser's callback gets through. Uses a port other than
# 1455 so it never collides with Codex's own bind. Started before the user
# mapping so it runs regardless of UID (including the root early-exec path).
if [ -n "$VIBEPOD_OAUTH_FORWARD_PORT" ]; then
    if command -v socat >/dev/null 2>&1; then
        socat "TCP-LISTEN:${VIBEPOD_OAUTH_FORWARD_PORT},fork,reuseaddr" \
            TCP:127.0.0.1:1455 &
    else
        echo "warning: VIBEPOD_OAUTH_FORWARD_PORT set but socat is not installed" >&2
    fi
fi

if [ "$USER_UID" -eq 0 ]; then
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" codex 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "codex" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="codex"
    fi
fi

GROUP_NAME=${GROUP_NAME:-codex}

if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -m -u "$USER_UID" -g "$GROUP_NAME" -d /home/codex -s /bin/sh codex 2>/dev/null || true
    USER_NAME="codex"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

if [ -d /codex ]; then
    chown "$USER_UID:$USER_GID" /codex 2>/dev/null || true
    chmod 755 /codex 2>/dev/null || true
fi

if [ -d /workspace ]; then
    chmod 755 /workspace 2>/dev/null || true
fi

if [ -n "$HOME" ]; then
    mkdir -p "$HOME" 2>/dev/null || true
    chown "$USER_UID:$USER_GID" "$HOME" 2>/dev/null || true
fi

export SHELL=/bin/bash
exec su -m -s /bin/sh "${USER_NAME}" -c "$*"
