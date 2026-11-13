#!/bin/sh
# Entrypoint script for Warp Agent CLI container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}

export HOME
export SHELL=/bin/bash

STATE_DIRS="$HOME/.config/warp-terminal $HOME/.local/state/warp-terminal $HOME/.local/share/keyrings"

# shellcheck disable=SC2086 # STATE_DIRS is a space-separated list by design.
mkdir -p "$HOME" $STATE_DIRS "$HOME/.agents/skills" /workspace

# The persisted mount is writable by the runtime user, so a planted symlink
# could redirect root-owned chown/chmod onto files outside it (for example this
# entrypoint). Refuse any path that is, or passes through, a symlink below $HOME.
passes_through_symlink() {
    _path=$1
    while :; do
        if [ -L "$_path" ]; then
            return 0
        fi
        case "$_path" in
            "$HOME" | / | .) return 1 ;;
        esac
        _path=$(dirname "$_path")
    done
}

own_paths() {
    for p in "$@"; do
        if passes_through_symlink "$p"; then
            echo "vibepod: warning: not changing ownership of symlinked path $p" >&2
            continue
        fi
        chown -h "$USER_UID:$USER_GID" "$p" 2>/dev/null || true
    done
}

set_mode() {
    mode=$1
    shift
    for p in "$@"; do
        if passes_through_symlink "$p"; then
            echo "vibepod: warning: not changing permissions of symlinked path $p" >&2
            continue
        fi
        chmod "$mode" "$p" 2>/dev/null || true
    done
}

# keyring-session.sh gives Warp the Secret Service provider it stores its
# login in, then execs the command. It must run as the runtime user: the
# session bus only accepts connections from the UID that started it.
if [ "$USER_UID" -eq 0 ]; then
    exec /usr/local/bin/keyring-session.sh "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" warp 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "warp" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="warp"
    fi
fi

GROUP_NAME=${GROUP_NAME:-warp}

# The account's home must be the persisted mount: Warp derives its settings,
# conversation database and keyring from the home directory, and gosu clears
# HOME and re-sets it from this passwd entry.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -u "$USER_UID" -g "$GROUP_NAME" -d "$HOME" -s /bin/sh warp 2>/dev/null || true
    USER_NAME="warp"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

own_paths "$HOME" "$HOME/.config" "$HOME/.local" "$HOME/.local/state" "$HOME/.local/share"
# shellcheck disable=SC2086
own_paths $STATE_DIRS
own_paths "$HOME/.agents" "$HOME/.agents/skills"
set_mode 755 "$HOME" "$HOME/.agents" "$HOME/.agents/skills"
# Settings, the conversation database and the keyring holding the login live
# here; keep them private.
# shellcheck disable=SC2086
set_mode 700 $STATE_DIRS

if [ -d /workspace ]; then
    chown "$USER_UID:$USER_GID" /workspace 2>/dev/null || true
    chmod 755 /workspace 2>/dev/null || true
fi

export USER="$USER_NAME"
export LOGNAME="$USER_NAME"

# gosu unsets HOME and re-derives it from the passwd entry, which is wrong when
# the uid already existed in the base image. Re-assert it explicitly; `env` does
# not re-parse the forwarded argv, so quoted prompts and --flags stay intact.
exec gosu "$USER_UID:$USER_GID" env HOME="$HOME" /usr/local/bin/keyring-session.sh "$@"
