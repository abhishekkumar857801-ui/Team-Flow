import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { UPLOAD_DIR } from './middleware/upload.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigins.includes('*') ? true : env.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
  app.use('/api', apiRoutes);

  // In production the server can also serve the built React app (client/dist).
  const webDist = path.resolve(__dirname, '..', 'client', 'dist');
  if (env.nodeEnv === 'production' && fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
