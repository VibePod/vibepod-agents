#!/bin/sh
# Entrypoint script for Cursor CLI container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}

export HOME
export SHELL=/bin/bash

mkdir -p "$HOME" "$HOME/.cursor" "$HOME/.config/cursor" "$HOME/.agents/skills" /workspace

# Pin the release channel to "static", upstream's only switch that turns off
# the background self-update. Updates would otherwise download a full ~550MB
# package into ~/.local/share/cursor-agent on the persisted mount on every new
# release, while the image keeps running its baked-in /opt/cursor-agent.
# A config file that does not parse is left untouched rather than replaced.
# Runs as the mapped user (see below), never as root, because the file lives on
# the user-writable persisted mount.
PIN_CHANNEL_SCRIPT='
const fs = require("fs");
const file = process.argv[1];
let config = {};
try {
  config = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") process.exit(0);
}
if (config.channel !== "static") {
  config.channel = "static";
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
}
'

pin_channel() {
    "$@" /opt/cursor-agent/node -e "$PIN_CHANNEL_SCRIPT" "$HOME/.cursor/cli-config.json" \
        || echo "vibepod: warning: could not pin Cursor CLI to the static channel; self-update stays enabled" >&2
}

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

if [ "$USER_UID" -eq 0 ]; then
    pin_channel
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" cursor 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "cursor" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="cursor"
    fi
fi

GROUP_NAME=${GROUP_NAME:-cursor}

# The account's home must be the persisted mount: Cursor derives ~/.cursor and
# ~/.config/cursor/auth.json from the home directory, and gosu clears HOME and
# re-sets it from this passwd entry.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -u "$USER_UID" -g "$GROUP_NAME" -d "$HOME" -s /bin/sh cursor 2>/dev/null || true
    USER_NAME="cursor"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

own_paths "$HOME" "$HOME/.cursor" "$HOME/.cursor/cli-config.json"
own_paths "$HOME/.config" "$HOME/.config/cursor"
own_paths "$HOME/.agents" "$HOME/.agents/skills"
set_mode 755 "$HOME" "$HOME/.agents" "$HOME/.agents/skills"
# auth.json (access/refresh tokens) lives here; keep the directory private.
set_mode 700 "$HOME/.config/cursor"
# Chats, projects and CLI config live here; keep them private too.
set_mode 700 "$HOME/.cursor"

if [ -d /workspace ]; then
    chown "$USER_UID:$USER_GID" /workspace 2>/dev/null || true
    chmod 755 /workspace 2>/dev/null || true
fi

export USER="$USER_NAME"
export LOGNAME="$USER_NAME"

pin_channel gosu "$USER_UID:$USER_GID" env HOME="$HOME"

# gosu unsets HOME and re-derives it from the passwd entry, which is wrong when
# the uid already existed in the base image. Re-assert it explicitly; `env` does
# not re-parse the forwarded argv, so quoted prompts and --flags stay intact.
exec gosu "$USER_UID:$USER_GID" env HOME="$HOME" "$@"
