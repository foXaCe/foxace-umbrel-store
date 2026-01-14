#!/usr/bin/env node

/**
 * MCP Shell Server - Permet l'exécution de commandes shell via MCP
 * ATTENTION: Ce serveur donne un accès shell complet. À utiliser avec précaution.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const server = new Server(
  {
    name: 'mcp-shell-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Liste des outils disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'execute_command',
        description: 'Exécute une commande shell et retourne le résultat. Accès complet au système.',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'La commande à exécuter',
            },
            cwd: {
              type: 'string',
              description: 'Répertoire de travail (optionnel)',
            },
            timeout: {
              type: 'number',
              description: 'Timeout en millisecondes (défaut: 30000)',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'read_file',
        description: 'Lit le contenu d\'un fichier',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Chemin du fichier à lire',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Écrit du contenu dans un fichier',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Chemin du fichier',
            },
            content: {
              type: 'string',
              description: 'Contenu à écrire',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_directory',
        description: 'Liste le contenu d\'un répertoire',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Chemin du répertoire',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'docker_ps',
        description: 'Liste les conteneurs Docker en cours d\'exécution',
        inputSchema: {
          type: 'object',
          properties: {
            all: {
              type: 'boolean',
              description: 'Afficher tous les conteneurs (incluant arrêtés)',
            },
          },
        },
      },
      {
        name: 'docker_logs',
        description: 'Récupère les logs d\'un conteneur Docker',
        inputSchema: {
          type: 'object',
          properties: {
            container: {
              type: 'string',
              description: 'Nom ou ID du conteneur',
            },
            tail: {
              type: 'number',
              description: 'Nombre de lignes à récupérer (défaut: 100)',
            },
          },
          required: ['container'],
        },
      },
      {
        name: 'docker_exec',
        description: 'Exécute une commande dans un conteneur Docker',
        inputSchema: {
          type: 'object',
          properties: {
            container: {
              type: 'string',
              description: 'Nom ou ID du conteneur',
            },
            command: {
              type: 'string',
              description: 'Commande à exécuter',
            },
          },
          required: ['container', 'command'],
        },
      },
      {
        name: 'system_info',
        description: 'Récupère les informations système (CPU, RAM, disque)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Gestionnaire d'appel des outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'execute_command': {
        const { command, cwd, timeout = 30000 } = args;
        const { stdout, stderr } = await execAsync(command, {
          cwd: cwd || '/data',
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        return {
          content: [
            {
              type: 'text',
              text: `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`,
            },
          ],
        };
      }

      case 'read_file': {
        const content = await fs.readFile(args.path, 'utf-8');
        return {
          content: [{ type: 'text', text: content }],
        };
      }

      case 'write_file': {
        await fs.mkdir(path.dirname(args.path), { recursive: true });
        await fs.writeFile(args.path, args.content, 'utf-8');
        return {
          content: [{ type: 'text', text: `Fichier écrit: ${args.path}` }],
        };
      }

      case 'list_directory': {
        const entries = await fs.readdir(args.path, { withFileTypes: true });
        const list = entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
        };
      }

      case 'docker_ps': {
        const cmd = args.all ? 'docker ps -a --format json' : 'docker ps --format json';
        const { stdout } = await execAsync(cmd);
        return {
          content: [{ type: 'text', text: stdout || 'Aucun conteneur' }],
        };
      }

      case 'docker_logs': {
        const tail = args.tail || 100;
        const { stdout } = await execAsync(`docker logs --tail ${tail} ${args.container}`);
        return {
          content: [{ type: 'text', text: stdout }],
        };
      }

      case 'docker_exec': {
        const { stdout, stderr } = await execAsync(
          `docker exec ${args.container} ${args.command}`
        );
        return {
          content: [{ type: 'text', text: `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}` }],
        };
      }

      case 'system_info': {
        const [cpu, mem, disk] = await Promise.all([
          execAsync("cat /proc/loadavg"),
          execAsync("free -h"),
          execAsync("df -h /data /umbrel 2>/dev/null || df -h /"),
        ]);
        return {
          content: [
            {
              type: 'text',
              text: `=== CPU Load ===\n${cpu.stdout}\n\n=== Memory ===\n${mem.stdout}\n\n=== Disk ===\n${disk.stdout}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Outil inconnu: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Démarrage du serveur
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Shell Server démarré');
}

main().catch(console.error);
