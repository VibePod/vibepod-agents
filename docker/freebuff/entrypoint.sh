#!/bin/sh
# Entrypoint script for Freebuff container
# Handles dynamic UID/GID mapping to match host user
#
# Freebuff stores its native binary, metadata, and auth tokens under
# ~/.config/manicode/. To persist these across container restarts, we
# symlink that path to /freebuff, which VibePod mounts as a durable volume.

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
FREEBUFF_CONFIG_DIR="${FREEBUFF_CONFIG_DIR:-/freebuff}"

mkdir -p "$FREEBUFF_CONFIG_DIR" 2>/dev/null || true
# Keep the persistent config private (auth tokens, native binary, session data).
chmod 700 "$FREEBUFF_CONFIG_DIR" 2>/dev/null || true

if [ "$USER_UID" -eq 0 ]; then
    # Symlink config dir for root
    mkdir -p /root/.config 2>/dev/null || true
    if [ ! -e /root/.config/manicode ]; then
        ln -sf "$FREEBUFF_CONFIG_DIR" /root/.config/manicode
    fi
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" freebuff 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "freebuff" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="freebuff"
    fi
fi

GROUP_NAME=${GROUP_NAME:-freebuff}

if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -m -u "$USER_UID" -g "$GROUP_NAME" -d /home/freebuff -s /bin/sh freebuff 2>/dev/null || true
    USER_NAME="freebuff"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

USER_HOME=$(getent passwd "$USER_UID" | cut -d: -f6)
USER_HOME="${USER_HOME:-/home/freebuff}"

mkdir -p "$USER_HOME" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$USER_HOME" 2>/dev/null || true

# Symlink ~/.config/manicode -> /freebuff so auth tokens, the downloaded
# native binary, and session data land on the persistent volume.
mkdir -p "$USER_HOME/.config" 2>/dev/null || true
if [ ! -e "$USER_HOME/.config/manicode" ]; then
    ln -sf "$FREEBUFF_CONFIG_DIR" "$USER_HOME/.config/manicode"
fi
chown -h "$USER_UID:$USER_GID" "$USER_HOME/.config" "$USER_HOME/.config/manicode" 2>/dev/null || true

# Ensure the persistent config directory is accessible.
if [ -d "$FREEBUFF_CONFIG_DIR" ]; then
    chown "$USER_UID:$USER_GID" "$FREEBUFF_CONFIG_DIR" 2>/dev/null || true
    chmod 700 "$FREEBUFF_CONFIG_DIR" 2>/dev/null || true
fi

if [ -d /workspace ]; then
    # Give the runtime user write access to the workspace.
    chown "$USER_UID:$USER_GID" /workspace 2>/dev/null || true
    chmod 755 /workspace 2>/dev/null || true
fi

export HOME="$USER_HOME"
export USER="$USER_NAME"
export SHELL=/bin/bash
exec gosu "$USER_UID:$USER_GID" "$@"
