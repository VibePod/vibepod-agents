#!/bin/sh
# Second stage of the Warp entrypoint. Runs as the runtime user, gives the
# command a Secret Service provider, then replaces itself with the command.
#
# Warp stores its login, provider API keys and MCP credentials through the
# Secret Service D-Bus API and has no file fallback. A container has neither a
# session bus nor a keyring, so this starts both, private to the container:
#   - dbus-daemon as a session bus on a socket under a fresh runtime directory
#   - gnome-keyring-daemon with only its secrets component, unlocked up front
#     so nothing ever needs the graphical unlock prompt
# The keyring files land in ~/.local/share/keyrings on the persisted mount, so
# the login survives the container. The keyring password is a fixed value: the
# keyring is protected by the permissions of that directory, the same as the
# plain credential files other agents keep on their config mount.

warn() {
    echo "vibepod: warning: $1; Warp will not remember the login (set WARP_API_KEY instead)" >&2
}

start_keyring() {
    command -v dbus-daemon >/dev/null 2>&1 || return 1
    command -v gnome-keyring-daemon >/dev/null 2>&1 || return 1

    # Sockets and the keyring control directory go here instead of ~/.cache on
    # the persisted mount, where every launch would leave a stale directory.
    XDG_RUNTIME_DIR=$(mktemp -d /tmp/vibepod-runtime.XXXXXX) || return 1
    export XDG_RUNTIME_DIR

    DBUS_SESSION_BUS_ADDRESS=$(
        dbus-daemon --session --fork --print-address=1 \
            --address="unix:path=$XDG_RUNTIME_DIR/bus" 2>/dev/null
    ) || return 1
    [ -n "$DBUS_SESSION_BUS_ADDRESS" ] || return 1
    export DBUS_SESSION_BUS_ADDRESS

    # --unlock reads the password from stdin, creates the login keyring on the
    # first run, and forks into the background once the daemon owns its name.
    printf '\n' | gnome-keyring-daemon --unlock --components=secrets >/dev/null 2>&1 || return 1
}

# A bus handed in from outside wins; VP_WARP_KEYRING=0 opts out entirely.
if [ "${VP_WARP_KEYRING:-1}" != "0" ] && [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
    mkdir -p "$HOME/.local/share/keyrings" 2>/dev/null || true
    start_keyring || warn "could not start the container keyring"
fi

exec "$@"
