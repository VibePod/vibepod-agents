FROM node:22-slim

ARG TZ
ENV TZ="${TZ:-UTC}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    gosu \
    jq \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

ARG CLINE_VERSION=3.0.61

RUN npm install -g "cline@${CLINE_VERSION}" \
    && cline --version

ENV HOME=/config
ENV TERM=xterm-256color

RUN mkdir -p /config/.cline /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["cline"]
