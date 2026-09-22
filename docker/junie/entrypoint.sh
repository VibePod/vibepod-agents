#!/bin/sh
# Entrypoint script for Junie CLI container
# Handles dynamic UID/GID mapping to match host user

set -e

USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}
HOME=${HOME:-/config}
JUNIE_HOME=${JUNIE_HOME:-$HOME/.junie}

export HOME
export JUNIE_HOME
export SHELL=/bin/bash

mkdir -p "$HOME" "$JUNIE_HOME" "$JUNIE_HOME/skills" /workspace

# Junie runs on its bundled JetBrains Runtime, which trusts only its own
# cacerts and ignores SSL_CERT_FILE. When a TLS-intercepting proxy CA is
# provided (VibePod's proxy sets SSL_CERT_FILE), import it so HTTPS calls do
# not fail with "PKIX path building failed". The container layer is
# per-container, so delete-then-import keeps restarts idempotent.
JUNIE_RUNTIME=/opt/junie/junie-app/lib/runtime
if [ -n "${SSL_CERT_FILE:-}" ] && [ -r "$SSL_CERT_FILE" ] && [ "$(id -u)" -eq 0 ]; then
    "$JUNIE_RUNTIME/bin/keytool" -delete -cacerts -storepass changeit \
        -alias vibepod-proxy-ca >/dev/null 2>&1 || true
    "$JUNIE_RUNTIME/bin/keytool" -importcert -noprompt -cacerts -storepass changeit \
        -alias vibepod-proxy-ca -file "$SSL_CERT_FILE" >/dev/null 2>&1 \
        || echo "junie entrypoint: could not import $SSL_CERT_FILE into the Java trust store" >&2
fi

if [ "$USER_UID" -eq 0 ]; then
    exec "$@"
fi

if ! getent group "$USER_GID" >/dev/null 2>&1; then
    groupadd -g "$USER_GID" junie 2>/dev/null || true
else
    EXISTING_GROUP=$(getent group "$USER_GID" | cut -d: -f1)
    if [ -n "$EXISTING_GROUP" ] && [ "$EXISTING_GROUP" != "junie" ]; then
        GROUP_NAME="$EXISTING_GROUP"
    else
        GROUP_NAME="junie"
    fi
fi

GROUP_NAME=${GROUP_NAME:-junie}

# The account's home must be the persisted mount: gosu clears HOME and
# re-sets it from this passwd entry, and Junie falls back to ~/.junie when
# JUNIE_HOME is unset.
if ! getent passwd "$USER_UID" >/dev/null 2>&1; then
    useradd -u "$USER_UID" -g "$GROUP_NAME" -d "$HOME" -s /bin/sh junie 2>/dev/null || true
    USER_NAME="junie"
else
    USER_NAME=$(getent passwd "$USER_UID" | cut -d: -f1)
fi

chown "$USER_UID:$USER_GID" "$HOME" "$JUNIE_HOME" "$JUNIE_HOME/skills" 2>/dev/null || true
chmod 755 "$HOME" "$JUNIE_HOME/skills" 2>/dev/null || true
# Junie stores API keys and OAuth tokens in $JUNIE_HOME/secure_credentials.json
# when no Secret Service is reachable (always, in this image); keep it private.
chmod 700 "$JUNIE_HOME" 2>/dev/null || true

if [ -d /workspace ]; then
    chown "$USER_UID:$USER_GID" /workspace 2>/dev/null || true
    chmod 755 /workspace 2>/dev/null || true
fi

export USER="$USER_NAME"
export LOGNAME="$USER_NAME"

# gosu unsets HOME and re-derives it from the passwd entry, which is wrong when
# the uid already existed in the base image. Re-assert it explicitly; `env` does
# not re-parse the forwarded argv, so quoted prompts and --flags stay intact.
exec gosu "$USER_UID:$USER_GID" env HOME="$HOME" JUNIE_HOME="$JUNIE_HOME" "$@"
