#!/bin/sh
# Entrypoint script for Cline CLI container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}

export HOME
export SHELL=/bin/bash

mkdir -p "$HOME" "$HOME/.cline" "$HOME/.agents/skills" /workspace

# If a proxy CA cert is mounted, append it to the system CA bundle so git,
# curl and Cline (whose launcher harvests the OS trust store) trust traffic
# through the proxy. The bundle is not writable under rootless podman keep-id
# (USER_UID=0 but the process is unprivileged); skip silently there, clients
# still trust the proxy via SSL_CERT_FILE and NODE_EXTRA_CA_CERTS.
setup_proxy_ca() {
    if [ -n "${SSL_CERT_FILE:-}" ] && [ -f "$SSL_CERT_FILE" ] && [ -w /etc/ssl/certs/ca-certificates.crt ]; then
        if ! grep -qF "$(sed -n '2p' "$SSL_CERT_FILE")" /etc/ssl/certs/ca-certificates.crt 2>/dev/null; then
            cat "$SSL_CERT_FILE" >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true
        fi
    fi
}

setup_git_config() {
    git config --system url."https://github.com/".insteadOf "git@github.com:" 2>/dev/null || true
}

setup_proxy_ca
setup_git_config

if [ "$USER_UID" -eq 0 ]; then
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" cline 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "cline" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="cline"
    fi
fi

GROUP_NAME=${GROUP_NAME:-cline}

# The account's home must be the persisted mount: Cline resolves ~/.cline from
# the process home, and gosu re-derives HOME from the passwd entry.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -u "$USER_UID" -g "$GROUP_NAME" -d "$HOME" -s /bin/sh cline 2>/dev/null || true
    USER_NAME="cline"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

chown "$USER_UID:$USER_GID" "$HOME" 2>/dev/null || true
chown "$USER_UID:$USER_GID" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
chmod 755 "$HOME" "$HOME/.agents" "$HOME/.agents/skills" 2>/dev/null || true
# Cline scans both ~/.cline/skills and ~/.agents/skills, so skills mounted at
# ~/.agents/skills need no symlink (one would list every skill twice).
# Cline stores provider API keys and OAuth tokens under ~/.cline; keep it private.
chown "$USER_UID:$USER_GID" "$HOME/.cline" 2>/dev/null || true
chmod 700 "$HOME/.cline" 2>/dev/null || true

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
