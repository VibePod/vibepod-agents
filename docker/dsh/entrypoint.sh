#!/bin/sh
# Entrypoint script for DeepSeek Harness (dsh) container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}

export HOME
export SHELL=/bin/bash

mkdir -p "$HOME" "$HOME/.dsh" "$HOME/.agents/skills" /workspace

# dsh's Web UI binds 127.0.0.1:3080 and intentionally rejects --host 0.0.0.0,
# but Docker port publishing needs a listener on the bridge interface. When
# VibePod sets VIBEPOD_WEB_FORWARD_PORT, bridge that port to the loopback UI.
# The forward port must differ from 3080: TCP-LISTEN binds all interfaces and
# would collide with dsh's own loopback bind if they matched.
if [ -n "$VIBEPOD_WEB_FORWARD_PORT" ]; then
    if command -v socat >/dev/null 2>&1; then
        socat "TCP-LISTEN:${VIBEPOD_WEB_FORWARD_PORT},fork,reuseaddr" \
            TCP:127.0.0.1:3080 &
    else
        echo "warning: VIBEPOD_WEB_FORWARD_PORT set but socat is not installed" >&2
    fi
fi

if [ "$USER_UID" -eq 0 ]; then
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" dsh 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "dsh" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="dsh"
    fi
fi

GROUP_NAME=${GROUP_NAME:-dsh}

# The account's home must be the persisted mount: dsh resolves $DSH_HOME as
# ~/.dsh from the process home, and gosu re-derives HOME from the passwd entry.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -u "$USER_UID" -g "$GROUP_NAME" -d "$HOME" -s /bin/sh dsh 2>/dev/null || true
    USER_NAME="dsh"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

chown "$USER_UID:$USER_GID" "$HOME" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
chmod 755 "$HOME" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
# dsh stores credentials (.credentials.yaml) under ~/.dsh; keep it private.
chown "$USER_UID:$USER_GID" "$HOME/.dsh" 2>/dev/null || true
chmod 700 "$HOME/.dsh" 2>/dev/null || true

if [ -d /workspace ]; then
    chown "$USER_UID:$USER_GID" /workspace 2>/dev/null || true
    chmod 755 /workspace 2>/dev/null || true
fi

export USER="$USER_NAME"
export LOGNAME="$USER_NAME"

# gosu unsets HOME and re-derives it from the passwd entry, which is wrong when
# the uid already existed in the base image (node:22-slim ships uid 1000
# "node"). Re-assert it explicitly; `env` does not re-parse the forwarded argv,
# so quoted prompts and --flags stay intact.
exec gosu "$USER_UID:$USER_GID" env HOME="$HOME" "$@"
