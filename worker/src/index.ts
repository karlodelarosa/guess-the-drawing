import { GameCoordinator } from './GameCoordinator';

export { GameCoordinator };

export interface Env {
  GAME_COORDINATOR: DurableObjectNamespace<GameCoordinator>;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket and API routes go to the singleton game coordinator
    if (url.pathname === '/ws' || url.pathname === '/api/health') {
      const id = env.GAME_COORDINATOR.idFromName('global');
      const stub = env.GAME_COORDINATOR.get(id);
      return stub.fetch(request);
    }

    // Serve static assets (public/)
    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
    }

    // SPA fallback — serve index.html for room URLs
    if (env.ASSETS) {
      const indexRequest = new Request(new URL('/index.html', request.url), request);
      return env.ASSETS.fetch(indexRequest);
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
