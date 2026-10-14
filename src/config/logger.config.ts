import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';

const logsDir = path.resolve('logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const day = new Date().toISOString().slice(0, 10);
const fileStream = fs.createWriteStream(path.join(logsDir, `app-${day}.log`), { flags: 'a' });

export const logger = pino(
  { level: process.env['LOG_LEVEL'] ?? 'info' },
  pino.multistream([{ stream: process.stdout }, { stream: fileStream }]),
);
