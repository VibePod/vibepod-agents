FROM node:22-slim

RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @openai/codex

RUN mkdir -p /codex /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["codex"]
