import http from 'node:http';
import { ensureTaskNumbers } from './services/serials.js';
import os from 'node:os';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initRealtime } from './services/realtime.js';

export async function start(mongoUri = env.mongoUri) {
  await connectDB(mongoUri);
  const numbered = await ensureTaskNumbers();
  if (numbered) console.log(`[db] gave serial numbers to ${numbered} existing task(s)`);
  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server, env.corsOrigins);

  await new Promise((resolve) => server.listen(env.port, '0.0.0.0', resolve));
  console.log(`[api] TeamFlow API on http://localhost:${env.port}/api`);
  // Phones on the same Wi-Fi reach the API through the laptop's LAN IP.
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`[api] LAN (use in mobile app): http://${a.address}:${env.port}/api`);
    }
  }
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((err) => {
    console.error('[api] failed to start:', err.message);
    process.exit(1);
  });
}
