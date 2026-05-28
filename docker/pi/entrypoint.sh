#!/bin/sh
# Entrypoint script for Pi container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}

export HOME
export SHELL=/bin/bash

mkdir -p "$HOME" "$HOME/.pi/agent" "$HOME/.agents/skills" /workspace

if [ "$USER_UID" -eq 0 ]; then
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" pi 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "pi" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="pi"
    fi
fi

GROUP_NAME=${GROUP_NAME:-pi}

if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -m -u "$USER_UID" -g "$GROUP_NAME" -d /home/pi -s /bin/sh pi 2>/dev/null || true
    USER_NAME="pi"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

chown "$USER_UID:$USER_GID" "$HOME" "$HOME/.pi" "$HOME/.pi/agent" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
chmod 755 "$HOME" "$HOME/.pi" "$HOME/.pi/agent" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true

if [ -d /workspace ]; then
    chmod 755 /workspace 2>/dev/null || true
fi

export USER="$USER_NAME"
export LOGNAME="$USER_NAME"

exec gosu "$USER_UID:$USER_GID" "$@"
