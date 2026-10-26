import type { ProxyOptions } from 'vite';

/** Explicit local opt-in; never accepts a hostname, URL, or production target. */
export function localApiProxy(rawPort: string | undefined, frontendPort: number): Record<string, ProxyOptions> | undefined {
  if (rawPort === undefined) return undefined;
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535 || port === frontendPort) {
    throw new Error('COLLI_LOCAL_API_PORT must be a valid port different from the frontend port.');
  }
  return {
    '^/api(?:/|\\?|$)': {
      target: `http://127.0.0.1:${port}`,
      proxyTimeout: 5000,
      configure(proxy) {
        proxy.on('error', (_error, _request, response) => {
          if ('writeHead' in response && !response.headersSent && !response.writableEnded) {
            response.writeHead(503, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            });
            response.end(JSON.stringify({ error: 'Local API unavailable. Please try again.' }));
          }
        });
      },
    },
  };
}
