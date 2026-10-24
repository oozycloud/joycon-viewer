import { createClient } from '@supabase/supabase-js';
// Add the real GitHub Pages origin through VIEWER_ALLOWED_ORIGINS or this public list.
const localOrigins = ['http://127.0.0.1:8765', 'http://localhost:8765', 'https://oozycloud.github.io'];
const configured = (Deno.env.get('VIEWER_ALLOWED_ORIGINS') || '').split(',').map(v => v.trim()).filter(Boolean);
const allowed = new Set([...localOrigins, ...configured]);
const attempts = new Map<string, { count: number; until: number }>();
Deno.serve(async (request: Request) => {
 const origin = request.headers.get('origin') || '';
 const cors = { 'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'null', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
 const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
 if (origin && !allowed.has(origin)) return reply(403, { error: 'This site is not enabled for username sign-in.' });
 if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
 if (request.method !== 'POST') return reply(405, { error: 'POST required.' });
 try {
  const text = await request.text();
  if (text.length > 4096) return reply(400, { error: 'Invalid sign-in request.' });
  const { username, password } = JSON.parse(text);
  if (typeof username !== 'string' || !/^[a-z0-9_]{3,24}$/.test(username) || typeof password !== 'string' || password.length > 1024) return reply(400, { error: 'Invalid username or password.' });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const key = ip + ':' + username, now = Date.now();
  const prior = attempts.get(key);
  if (prior && prior.until > now && prior.count >= 10) return reply(429, { error: 'Too many attempts. Try again in a few minutes.' });
  attempts.set(key, { count: prior && prior.until > now ? prior.count + 1 : 1, until: prior && prior.until > now ? prior.until : now + 300000 });
  if (attempts.size > 1000) for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  const url = Deno.env.get('SUPABASE_URL')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  if (!url || !service || !publicKey) return reply(503, { error: 'Username sign-in is not configured.' });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const lookup = await admin.from('profiles').select('user_id').eq('username', username).maybeSingle();
  if (lookup.error || !lookup.data) { await new Promise(r => setTimeout(r, 250)); return reply(400, { error: 'Invalid username or password.' }); }
  const owner = await admin.auth.admin.getUserById(lookup.data.user_id);
  if (!owner.data.user?.email) return reply(400, { error: 'Invalid username or password.' });
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await auth.auth.signInWithPassword({ email: owner.data.user.email, password });
  if (result.error || !result.data.session) return reply(400, { error: 'Invalid username or password.' });
  attempts.delete(key);
  return reply(200, { access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token });
 } catch { return reply(400, { error: 'Invalid username or password.' }); }
});
