FROM node:22-alpine

# Install Git for version control support and su-exec for user switching
RUN apk add --no-cache git su-exec

# Install the Gemini CLI
RUN npm install -g @google/gemini-cli

# Set up workspace and home directory
RUN mkdir -p /workspace /home/gemini

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /workspace

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["gemini"]
