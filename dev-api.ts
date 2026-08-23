import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const DATA_DIR = resolve(process.cwd(), '.suunto-desktop');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');
const AUTH_PATH = resolve(DATA_DIR, 'auth.json');
const BASE_URL = 'http://127.0.0.1:1420';

interface Config {
  stravaClientId?: string;
  stravaClientSecret?: string;
  suuntoClientId?: string;
  suuntoClientSecret?: string;
  suuntoSubscriptionKey?: string;
}

interface TokenRecord {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  athleteId?: number;
}

interface AuthState {
  strava?: TokenRecord;
  suunto?: TokenRecord;
}

let oauthState: { strava?: string; suunto?: string } = {};

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(path: string, value: unknown) {
  ensureDataDir();
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}

function getConfig(): Config {
  return readJsonFile<Config>(CONFIG_PATH, {});
}

function getAuth(): AuthState {
  return readJsonFile<AuthState>(AUTH_PATH, {});
}

function saveAuth(auth: AuthState) {
  writeJsonFile(AUTH_PATH, auth);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function sendHtml(res: ServerResponse, title: string, message: string) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui;background:#0d1014;color:#f4f6f8;padding:48px"><h2>${title}</h2><p>${message}</p><p>You can close this window and return to suunto-desktop.</p><script>setTimeout(()=>window.close(),1500)</script></body></html>`);
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonBody(req: IncomingMessage) {
  const text = await readBody(req);
  return text ? JSON.parse(text) : {};
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function refreshStravaToken(config: Config, auth: AuthState) {
  const token = auth.strava;
  if (!token) throw new Error('Strava is not connected.');
  const now = Math.floor(Date.now() / 1000);
  if (!token.expiresAt || token.expiresAt > now + 60) return token;
  if (!config.stravaClientId || !config.stravaClientSecret || !token.refreshToken) {
    throw new Error('Strava token expired and refresh credentials are missing.');
  }
  const body = new URLSearchParams({
    client_id: config.stravaClientId,
    client_secret: config.stravaClientSecret,
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
  });
  const data = await fetchJson('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  auth.strava = {
    ...token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
  saveAuth(auth);
  return auth.strava;
}

async function listStravaRoutes(config: Config, auth: AuthState) {
  const token = await refreshStravaToken(config, auth);
  let athleteId = token.athleteId;
  if (!athleteId) {
    const athlete = await fetchJson('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    athleteId = athlete.id;
    token.athleteId = athleteId;
    auth.strava = token;
    saveAuth(auth);
  }
  const all: any[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const rows = await fetchJson(`https://www.strava.com/api/v3/athletes/${athleteId}/routes?page=${page}&per_page=200`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    all.push(...rows);
    if (rows.length < 200) break;
  }
  return all.map((route) => ({
    source: 'strava',
    sourceId: String(route.id),
    name: route.name || `Strava route ${route.id}`,
    distanceM: route.distance || 0,
    elevationGainM: route.elevation_gain || 0,
    updatedAt: route.updated_at,
    private: route.private,
    summaryPolyline: route.map?.summary_polyline || null,
  }));
}

async function listSuuntoRoutes(config: Config, auth: AuthState) {
  if (!auth.suunto?.accessToken) throw new Error('Suunto is not connected.');
  if (!config.suuntoSubscriptionKey) throw new Error('Suunto subscription key is missing.');
  const headers = {
    Authorization: `Bearer ${auth.suunto.accessToken}`,
    'Ocp-Apim-Subscription-Key': config.suuntoSubscriptionKey,
  };
  const rows = await fetchJson('https://cloudapi.suunto.com/v2/route', { headers });
  const results: any[] = [];
  const concurrency = 5;
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const expanded = await Promise.all(batch.map(async (route: any) => {
      let gpx: string | null = null;
      try {
        const response = await fetch(`https://cloudapi.suunto.com/v2/route/${encodeURIComponent(route.id)}/export`, {
          headers: { ...headers, Accept: 'application/gpx+xml' },
        });
        if (response.ok) gpx = await response.text();
      } catch {
        // Metadata is still useful if GPX export fails for one route.
      }
      return {
        source: 'suunto',
        sourceId: String(route.id),
        name: route.description || `Suunto route ${route.id}`,
        distanceM: route.totalDistance || 0,
        updatedAt: route.modified,
        watchEnabled: Boolean(route.watchEnabled),
        startPoint: route.startPoint,
        centerPoint: route.centerPoint,
        endPoint: route.endPoint,
        gpx,
      };
    }));
    results.push(...expanded);
  }
  return results;
}

function connectionStatus() {
  const config = getConfig();
  const auth = getAuth();
  return {
    strava: {
      configured: Boolean(config.stravaClientId && config.stravaClientSecret),
      connected: Boolean(auth.strava?.accessToken),
    },
    suunto: {
      configured: Boolean(config.suuntoClientId && config.suuntoClientSecret && config.suuntoSubscriptionKey),
      connected: Boolean(auth.suunto?.accessToken),
    },
  };
}

export function localProviderApi(): Plugin {
  return {
    name: 'suunto-desktop-local-provider-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url || '/', BASE_URL);
          if (!url.pathname.startsWith('/api/')) return next();

          if (url.pathname === '/api/connections' && req.method === 'GET') {
            return sendJson(res, 200, connectionStatus());
          }

          if (url.pathname === '/api/config' && req.method === 'POST') {
            const patch = await readJsonBody(req) as Config;
            const config = { ...getConfig(), ...patch };
            writeJsonFile(CONFIG_PATH, config);
            return sendJson(res, 200, connectionStatus());
          }

          if (url.pathname === '/api/strava/login' && req.method === 'GET') {
            const config = getConfig();
            if (!config.stravaClientId || !config.stravaClientSecret) {
              return sendHtml(res, 'Strava not configured', 'Enter your Strava Client ID and Client Secret in suunto-desktop first.');
            }
            const state = randomBytes(16).toString('hex');
            oauthState.strava = state;
            const redirectUri = `${BASE_URL}/api/strava/callback`;
            const authorize = new URL('https://www.strava.com/oauth/authorize');
            authorize.searchParams.set('client_id', config.stravaClientId);
            authorize.searchParams.set('response_type', 'code');
            authorize.searchParams.set('redirect_uri', redirectUri);
            authorize.searchParams.set('approval_prompt', 'auto');
            authorize.searchParams.set('scope', 'read,read_all');
            authorize.searchParams.set('state', state);
            res.statusCode = 302;
            res.setHeader('Location', authorize.toString());
            return res.end();
          }

          if (url.pathname === '/api/strava/callback' && req.method === 'GET') {
            const config = getConfig();
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            if (!code || !state || state !== oauthState.strava) return sendHtml(res, 'Strava connection failed', 'Invalid OAuth callback.');
            const body = new URLSearchParams({
              client_id: config.stravaClientId || '',
              client_secret: config.stravaClientSecret || '',
              code,
              grant_type: 'authorization_code',
            });
            const data = await fetchJson('https://www.strava.com/oauth/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body,
            });
            const auth = getAuth();
            auth.strava = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: data.expires_at,
              athleteId: data.athlete?.id,
            };
            saveAuth(auth);
            oauthState.strava = undefined;
            return sendHtml(res, 'Strava connected', 'Your Strava route library is ready to synchronize.');
          }

          if (url.pathname === '/api/suunto/login' && req.method === 'GET') {
            const config = getConfig();
            if (!config.suuntoClientId || !config.suuntoClientSecret || !config.suuntoSubscriptionKey) {
              return sendHtml(res, 'Suunto not configured', 'Enter your Suunto Partner Client ID, Client Secret and Subscription Key first.');
            }
            const state = randomBytes(16).toString('hex');
            oauthState.suunto = state;
            const redirectUri = `${BASE_URL}/api/suunto/callback`;
            const authorize = new URL('https://cloudapi-oauth.suunto.com/oauth/authorize');
            authorize.searchParams.set('response_type', 'code');
            authorize.searchParams.set('client_id', config.suuntoClientId);
            authorize.searchParams.set('redirect_uri', redirectUri);
            authorize.searchParams.set('state', state);
            res.statusCode = 302;
            res.setHeader('Location', authorize.toString());
            return res.end();
          }

          if (url.pathname === '/api/suunto/callback' && req.method === 'GET') {
            const config = getConfig();
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            if (!code || !state || state !== oauthState.suunto) return sendHtml(res, 'Suunto connection failed', 'Invalid OAuth callback.');
            const redirectUri = `${BASE_URL}/api/suunto/callback`;
            const basic = Buffer.from(`${config.suuntoClientId}:${config.suuntoClientSecret}`).toString('base64');
            const body = new URLSearchParams({ grant_type: 'authorization_code', redirect_uri: redirectUri, code });
            const data = await fetchJson('https://cloudapi-oauth.suunto.com/oauth/token', {
              method: 'POST',
              headers: {
                Authorization: `Basic ${basic}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body,
            });
            const auth = getAuth();
            auth.suunto = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in || 86400),
            };
            saveAuth(auth);
            oauthState.suunto = undefined;
            return sendHtml(res, 'Suunto connected', 'Your Suunto Cloud route library is ready to synchronize.');
          }

          if (url.pathname === '/api/sync-all' && req.method === 'GET') {
            const config = getConfig();
            const auth = getAuth();
            const status = connectionStatus();
            const result: Record<string, unknown> = { status, strava: [], suunto: [], errors: [] };
            if (status.strava.connected) {
              try { result.strava = await listStravaRoutes(config, auth); }
              catch (error) { (result.errors as string[]).push(`Strava: ${error instanceof Error ? error.message : String(error)}`); }
            }
            if (status.suunto.connected) {
              try { result.suunto = await listSuuntoRoutes(config, getAuth()); }
              catch (error) { (result.errors as string[]).push(`Suunto: ${error instanceof Error ? error.message : String(error)}`); }
            }
            return sendJson(res, 200, result);
          }

          return sendJson(res, 404, { error: 'Unknown local API endpoint.' });
        } catch (error) {
          console.error('[suunto-desktop local API]', error);
          return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}
