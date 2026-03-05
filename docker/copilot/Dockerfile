FROM node:22-slim

RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @github/copilot

RUN mkdir -p /copilot /workspace

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["copilot"]
