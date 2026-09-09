import { PrismaClient, Prisma } from '@prisma/client';
import { getRequestId } from './request-context';

declare global {
  var prismaClient: PrismaClient | undefined;
}

if (process.env.DATABASE_URL) {
  const redactedDbUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log('DATABASE_URL:', redactedDbUrl);
}

interface ActiveQuery {
  requestId: string;
  model?: string;
  timestamp: number;
}

const activeQueries: ActiveQuery[] = [];

function findRequestIdForQuery(table: string): string | undefined {
  const now = Date.now();
  // Clean up stale entries older than 10 seconds
  for (let i = activeQueries.length - 1; i >= 0; i--) {
    if (now - activeQueries[i].timestamp > 10000) {
      activeQueries.splice(i, 1);
    }
  }

  if (activeQueries.length === 0) {
    return undefined;
  }

  // 1. Look for matching model (case insensitive)
  if (table && table !== 'unknown') {
    const match = activeQueries.find(
      (q) => q.model && q.model.toLowerCase() === table.toLowerCase()
    );
    if (match) {
      return match.requestId;
    }
  }

  // 2. Fallback: peek at latest active request ID without consuming/removing active query entries
  return activeQueries[activeQueries.length - 1]?.requestId;
}

function parseDbInfo() {
  const urlStr = process.env.DATABASE_URL;
  let system = 'postgresql';
  let name = 'zodiac_game';

  if (urlStr) {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol) {
        system = parsed.protocol.replace(':', '');
        if (system === 'postgres') system = 'postgresql';
      }
      if (parsed.pathname && parsed.pathname.length > 1) {
        name = parsed.pathname.slice(1);
      }
    } catch {
      // fallback to defaults if URL parsing fails
    }
  }

  return { system, name };
}

function parseQueryDetails(query: string) {
  const trimmed = query.trim();
  const matchOp = trimmed.match(/^([A-Za-z]+)/);
  const operation = matchOp ? matchOp[1].toUpperCase() : 'UNKNOWN';

  let schema = 'public';
  let table = 'unknown';

  const fromMatch = trimmed.match(/(?:FROM|INTO|UPDATE|JOIN)\s+(?:"([^"]+)"\.)?"?([^"\s;\(]+)"?/i);
  if (fromMatch) {
    if (fromMatch[1]) schema = fromMatch[1];
    if (fromMatch[2]) table = fromMatch[2];
  } else {
    const schemaTableMatch = trimmed.match(/"([^"]+)"\."([^"]+)"/);
    if (schemaTableMatch) {
      schema = schemaTableMatch[1];
      table = schemaTableMatch[2];
    }
  }

  return { operation, schema, table };
}

const { system: dbSystem, name: dbName } = parseDbInfo();

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' }
    ]
  });

  client.$use(async (params, next) => {
    const requestId = getRequestId();
    let entry: ActiveQuery | undefined;

    if (requestId) {
      entry = { requestId, model: params.model, timestamp: Date.now() };
      activeQueries.push(entry);
    }

    try {
      return await next(params);
    } finally {
      if (entry) {
        const idx = activeQueries.indexOf(entry);
        if (idx !== -1) {
          activeQueries.splice(idx, 1);
        }
      }
    }
  });

  client.$on('query', (e: Prisma.QueryEvent) => {
    const { operation, schema, table } = parseQueryDetails(e.query);
    const requestId = getRequestId() ?? findRequestIdForQuery(table);

    console.log(
      JSON.stringify({
        '@timestamp': e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
        ...(requestId ? { 'request.id': requestId } : {}),
        'db.system': dbSystem,
        'db.name': dbName,
        'db.schema': schema,
        'db.table': table,
        'db.operation': operation,
        'db.statement': e.query,
        'db.params': '[REDACTED]'
      })
    );
  });

  return client;
};

export const prisma = global.prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prismaClient = prisma;
}
