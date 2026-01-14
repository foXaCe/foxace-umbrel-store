FROM node:20-slim

LABEL maintainer="foXaCe"
LABEL description="MCP Server pour Umbrel - Expose filesystem, shell et docker via SSE"

# Installation des dépendances système
RUN apt-get update && apt-get install -y \
    curl \
    git \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Création du répertoire de travail
WORKDIR /app

# Installation des serveurs MCP et supergateway
RUN npm install -g \
    @anthropic-ai/sdk \
    @modelcontextprotocol/sdk \
    @modelcontextprotocol/server-filesystem \
    supergateway

# Création d'un serveur MCP shell personnalisé
RUN mkdir -p /app/servers

# Serveur MCP Shell personnalisé
COPY shell-server.js /app/servers/shell-server.js

# Script de démarrage
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Ports exposés
# 3100: Filesystem MCP (SSE)
# 3101: Shell MCP (SSE)
EXPOSE 3100 3101

# Variables d'environnement par défaut
ENV MCP_FILESYSTEM_PORT=3100
ENV MCP_SHELL_PORT=3101
ENV ALLOWED_PATHS=/data,/umbrel,/host

ENTRYPOINT ["/app/entrypoint.sh"]
