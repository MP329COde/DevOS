import { HAProxyClient } from './haproxy.js';

export function buildClientFromEnv(env: NodeJS.ProcessEnv = process.env): HAProxyClient {
  const baseUrl = env.HAPROXY_DATA_PLANE_URL;
  const username = env.HAPROXY_USERNAME;
  const password = env.HAPROXY_PASSWORD;
  if (!baseUrl || !username || !password) {
    throw new Error('HAPROXY_DATA_PLANE_URL, HAPROXY_USERNAME and HAPROXY_PASSWORD must be set (never hardcode them)');
  }
  return new HAProxyClient({ baseUrl, credentials: { username, password } });
}

export async function runHAProxyCli(argv: string[], client: HAProxyClient, log: (message: string) => void = console.log): Promise<void> {
  const [command, ...args] = argv;
  switch (command) {
    case 'list-backends':
      log(JSON.stringify(await client.listBackends(), null, 2));
      return;
    case 'list-frontends':
      log(JSON.stringify(await client.listFrontends(), null, 2));
      return;
    case 'list-servers': {
      const [backend] = args;
      if (!backend) throw new Error('Usage: list-servers <backend>');
      log(JSON.stringify(await client.listServers(backend), null, 2));
      return;
    }
    case 'add-server': {
      const [backend, name, address, port] = args;
      if (!backend || !name || !address || !port) throw new Error('Usage: add-server <backend> <name> <address> <port>');
      await client.addServer(backend, { name, address, port: Number(port) });
      log(`Server ${name} added to backend ${backend}.`);
      return;
    }
    case 'delete-server': {
      const [backend, name] = args;
      if (!backend || !name) throw new Error('Usage: delete-server <backend> <name>');
      await client.deleteServer(backend, name);
      log(`Server ${name} removed from backend ${backend}.`);
      return;
    }
    case 'reload':
      await client.reload();
      log('Reload triggered.');
      return;
    default:
      throw new Error(`Unknown command: ${command ?? '(none)'}. Use list-backends, list-frontends, list-servers, add-server, delete-server or reload.`);
  }
}

if (require.main === module) {
  Promise.resolve()
    .then(() => runHAProxyCli(process.argv.slice(2), buildClientFromEnv()))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
