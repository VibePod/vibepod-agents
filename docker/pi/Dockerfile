FROM node:22-slim

RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    bash \
    gosu \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

ENV HOME=/config
ENV PI_SKIP_VERSION_CHECK=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV TERM=xterm-256color

RUN mkdir -p /config/.pi/agent /config/.agents/skills /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["pi"]
