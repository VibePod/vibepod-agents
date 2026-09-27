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
/opt/cursor-agent/node -e '
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
' "$HOME/.cursor/cli-config.json" \
    || echo "vibepod: warning: could not pin Cursor CLI to the static channel; self-update stays enabled" >&2

if [ "$USER_UID" -eq 0 ]; then
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

chown "$USER_UID:$USER_GID" "$HOME" "$HOME/.cursor" "$HOME/.cursor/cli-config.json" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$HOME/.config" "$HOME/.config/cursor" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
chmod 755 "$HOME" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
# auth.json (access/refresh tokens) lives here; keep the directory private.
chmod 700 "$HOME/.config/cursor" 2>/dev/null || true

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
