#!/bin/sh
# Entrypoint script for Copilot container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}

if [ "$USER_UID" -eq 0 ]; then
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" copilot 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "copilot" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="copilot"
    fi
fi

GROUP_NAME=${GROUP_NAME:-copilot}

if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -m -u "$USER_UID" -g "$GROUP_NAME" -d /home/copilot -s /bin/sh copilot 2>/dev/null || true
    USER_NAME="copilot"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

if [ -d /copilot ]; then
    chown "$USER_UID:$USER_GID" /copilot 2>/dev/null || true
    chmod 755 /copilot 2>/dev/null || true
fi

if [ -d /workspace ]; then
    chmod 755 /workspace 2>/dev/null || true
fi

export SHELL=/bin/bash
exec su -s /bin/sh "${USER_NAME}" -c "$*"
