#!/bin/sh
# Entrypoint script for jcode container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}

export HOME
export SHELL=/bin/bash

mkdir -p "$HOME" "$HOME/.jcode" "$HOME/.agents/skills" /workspace

if [ "$USER_UID" -eq 0 ]; then
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" jcode 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "jcode" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="jcode"
    fi
fi

GROUP_NAME=${GROUP_NAME:-jcode}

# The account's home must be the persisted mount: jcode derives ~/.jcode
# (auth.json, config.toml, mcp.json, sessions/) from the home directory, and
# gosu clears HOME and re-sets it from this passwd entry.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -u "$USER_UID" -g "$GROUP_NAME" -d "$HOME" -s /bin/sh jcode 2>/dev/null || true
    USER_NAME="jcode"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

chown "$USER_UID:$USER_GID" "$HOME" "$HOME/.jcode" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
chmod 755 "$HOME" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
# jcode stores auth.json (provider credentials) here; keep the directory private.
chmod 700 "$HOME/.jcode" 2>/dev/null || true

if [ -d /workspace ]; then
    chown "$USER_UID:$USER_GID" /workspace 2>/dev/null || true
    chmod 755 /workspace 2>/dev/null || true
fi

export USER="$USER_NAME"
export LOGNAME="$USER_NAME"

# gosu unsets HOME and re-derives it from the passwd entry, which is wrong when
# the uid already existed in the base image. Re-assert it explicitly; `env` does
# not re-parse the forwarded argv, so quoted prompts and --flags stay intact.
exec gosu "$USER_UID:$USER_GID" env HOME="$HOME" "$@"
