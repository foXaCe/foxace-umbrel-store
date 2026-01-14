#!/bin/bash
set -e

echo "=== MCP Server pour Umbrel ==="
echo "Démarrage des serveurs MCP..."

# Répertoires autorisés pour le filesystem (séparés par virgules)
ALLOWED_PATHS=${ALLOWED_PATHS:-/data,/umbrel,/host}

# Conversion en arguments pour le serveur filesystem
IFS=',' read -ra PATHS <<< "$ALLOWED_PATHS"
FS_ARGS=""
for p in "${PATHS[@]}"; do
    FS_ARGS="$FS_ARGS $p"
done

echo "Chemins autorisés: $ALLOWED_PATHS"
echo "Port Filesystem MCP: $MCP_FILESYSTEM_PORT"
echo "Port Shell MCP: $MCP_SHELL_PORT"

# Démarrage du serveur Filesystem MCP via supergateway
echo "Démarrage du serveur Filesystem MCP sur le port $MCP_FILESYSTEM_PORT..."
npx -y supergateway \
    --sse \
    --port $MCP_FILESYSTEM_PORT \
    --host 0.0.0.0 \
    --cors \
    -- npx -y @modelcontextprotocol/server-filesystem $FS_ARGS &

PID_FS=$!

# Attente que le premier serveur soit prêt
sleep 2

# Démarrage du serveur Shell MCP via supergateway
echo "Démarrage du serveur Shell MCP sur le port $MCP_SHELL_PORT..."
npx -y supergateway \
    --sse \
    --port $MCP_SHELL_PORT \
    --host 0.0.0.0 \
    --cors \
    -- node /app/servers/shell-server.js &

PID_SHELL=$!

echo ""
echo "=== Serveurs MCP démarrés ==="
echo "Filesystem MCP: http://0.0.0.0:$MCP_FILESYSTEM_PORT/sse"
echo "Shell MCP:      http://0.0.0.0:$MCP_SHELL_PORT/sse"
echo ""
echo "Configuration Claude Code (settings.json):"
echo '{'
echo '  "mcpServers": {'
echo '    "umbrel-filesystem": {'
echo '      "url": "http://192.168.1.60:3100/sse"'
echo '    },'
echo '    "umbrel-shell": {'
echo '      "url": "http://192.168.1.60:3101/sse"'
echo '    }'
echo '  }'
echo '}'
echo ""

# Fonction pour gérer l'arrêt propre
cleanup() {
    echo "Arrêt des serveurs MCP..."
    kill $PID_FS $PID_SHELL 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Attente des processus
wait $PID_FS $PID_SHELL
