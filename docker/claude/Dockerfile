# Use Debian (glibc). Claude native binaries currently fail on musl/Alpine.
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    libgcc-s1 \
    libstdc++6 \
    passwd \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

ARG CLAUDE_CODE_CHANNEL=latest

# Install Claude Code using the native installer (npm install is deprecated).
RUN curl -fsSL https://claude.ai/install.sh | bash -s "${CLAUDE_CODE_CHANNEL}" \
    && test -x /root/.local/bin/claude \
    && ln -sf /root/.local/bin/claude /usr/local/bin/claude \
    && chmod 755 /root \
    && chmod -R a+rX /root/.local

# Create directories
RUN mkdir -p /claude /workspace

# Use system ripgrep in the container.
ENV USE_BUILTIN_RIPGREP=0

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /workspace

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["claude"]
