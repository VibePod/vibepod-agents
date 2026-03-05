#!/bin/sh
#
# Entrypoint script for Gemini CLI container
# Runs as specified UID/GID to match host user for bind mounts
#

set -e

# Default to user 1000:1000 if not specified
USER_UID=${USER_UID:-1000}
USER_GID=${USER_GID:-1000}

# Ensure home directory exists with correct ownership
# The gemini CLI needs this for logs and config
mkdir -p /home/gemini
chown "$USER_UID:$USER_GID" /home/gemini

# Set HOME environment variable so gemini CLI knows where to write
export HOME=/home/gemini
export SHELL=/bin/sh

# Run command as the specified UID:GID
exec su-exec "$USER_UID:$USER_GID" "$@"
