import { Pool, neonConfig } from '@neondatabase/serverless';
// WebSocket TLS supports transactions and works where outbound PostgreSQL TCP is blocked.
neonConfig.webSocketConstructor = WebSocket;
export const createPool = (connectionString, options = {}) => new Pool({ connectionString, max: 3, connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000, ...options });
