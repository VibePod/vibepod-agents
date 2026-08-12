#!/bin/sh
# Entrypoint script for Qwen Code container
# Handles dynamic UID/GID mapping to match host user
#
# Qwen Code stores its settings, auth tokens, and session data under
# ~/.qwen/. To persist these across container restarts, we symlink that
# path to /qwen, which VibePod mounts as a durable volume.

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
QWEN_CONFIG_DIR="${QWEN_CONFIG_DIR:-/qwen}"

mkdir -p "$QWEN_CONFIG_DIR" 2>/dev/null || true

if [ "$USER_UID" -eq 0 ]; then
    # Symlink config dir for root
    mkdir -p /root 2>/dev/null || true
    if [ ! -e /root/.qwen ]; then
        ln -sf "$QWEN_CONFIG_DIR" /root/.qwen
    fi
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" qwen 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "qwen" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="qwen"
    fi
fi

GROUP_NAME=${GROUP_NAME:-qwen}

if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -m -u "$USER_UID" -g "$GROUP_NAME" -d /home/qwen -s /bin/sh qwen 2>/dev/null || true
    USER_NAME="qwen"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

USER_HOME=$(getent passwd "$USER_UID" | cut -d: -f6)
USER_HOME="${USER_HOME:-/home/qwen}"

mkdir -p "$USER_HOME" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$USER_HOME" 2>/dev/null || true

# Symlink ~/.qwen -> /qwen so auth tokens, settings, and session data land
# on the persistent volume.
if [ ! -e "$USER_HOME/.qwen" ]; then
    ln -sf "$QWEN_CONFIG_DIR" "$USER_HOME/.qwen"
fi
chown -h "$USER_UID:$USER_GID" "$USER_HOME/.qwen" 2>/dev/null || true

# Ensure the persistent config directory is accessible.
if [ -d "$QWEN_CONFIG_DIR" ]; then
    chown "$USER_UID:$USER_GID" "$QWEN_CONFIG_DIR" 2>/dev/null || true
    chmod 755 "$QWEN_CONFIG_DIR" 2>/dev/null || true
fi

if [ -d /workspace ]; then
    chmod 755 /workspace 2>/dev/null || true
fi

export HOME="$USER_HOME"
export SHELL=/bin/bash
exec su -s /bin/sh "${USER_NAME}" -c 'exec "$@"' sh "$@"
