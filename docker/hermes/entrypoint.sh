#!/bin/sh
# Entrypoint script for Hermes Agent container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}
HERMES_HOME=${HERMES_HOME:-$HOME/.hermes}

export HOME
export HERMES_HOME
export SHELL=/bin/bash

mkdir -p "$HOME" "$HERMES_HOME" "$HOME/.agents/skills" /workspace

# The interpreter from uv's isolated tool environment; it is the only one with
# hermes_cli importable. UV_TOOL_DIR is pinned to /opt/uv/tools in the image.
HERMES_PYTHON=/opt/uv/tools/hermes-agent/bin/python
SEED_SKILLS=/usr/local/lib/vibepod/seed_skills_dir.py

# Hermes reads ~/.agents/skills only via the skills.external_dirs key in its own
# config.yaml and has no env-var override, so the key is seeded here. Never
# fatal: a failure costs skill discovery, not the session.
seed_skills_dir() {
    if [ -x "$HERMES_PYTHON" ] && [ -f "$SEED_SKILLS" ]; then
        "$@" "$HERMES_PYTHON" "$SEED_SKILLS" \
            || echo "warning: could not seed skills.external_dirs in config.yaml" >&2
    fi
}

if [ "$USER_UID" -eq 0 ]; then
    seed_skills_dir env
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" hermes 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "hermes" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="hermes"
    fi
fi

GROUP_NAME=${GROUP_NAME:-hermes}

# The account's home must be the persisted mount: Hermes resolves $HERMES_HOME
# from the process environment but falls back to Path.home()/.hermes, and gosu
# clears HOME and re-sets it from this passwd entry.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -u "$USER_UID" -g "$GROUP_NAME" -d "$HOME" -s /bin/sh hermes 2>/dev/null || true
    USER_NAME="hermes"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

chown "$USER_UID:$USER_GID" "$HOME" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
chmod 755 "$HOME" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
# Hermes stores .env, provider credentials and state.db under $HERMES_HOME;
# keep the directory private.
chown "$USER_UID:$USER_GID" "$HERMES_HOME" 2>/dev/null || true
chmod 700 "$HERMES_HOME" 2>/dev/null || true

if [ -d /workspace ]; then
    chown "$USER_UID:$USER_GID" /workspace 2>/dev/null || true
    chmod 755 /workspace 2>/dev/null || true
fi

export USER="$USER_NAME"
export LOGNAME="$USER_NAME"

# Seed as the mapped user so every file written lands with the right owner.
seed_skills_dir gosu "$USER_UID:$USER_GID" env HOME="$HOME" HERMES_HOME="$HERMES_HOME"

# gosu unsets HOME and re-derives it from the passwd entry, which is wrong when
# the uid already existed in the base image. Re-assert it explicitly; `env` does
# not re-parse the forwarded argv, so quoted prompts and --flags stay intact.
exec gosu "$USER_UID:$USER_GID" env HOME="$HOME" HERMES_HOME="$HERMES_HOME" "$@"
