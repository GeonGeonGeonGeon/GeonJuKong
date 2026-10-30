import { createClient } from 'npm:@supabase/supabase-js@2';
import { seal, unseal, refreshGoogle, verifyGoogle } from './service.mjs';

// Explicit origins include the deployed HTTPS app and configured Capacitor origins.
const origins = (Deno.env.get('GOOGLE_AUTH_ORIGINS') || Deno.env.get('APP_ORIGIN') || '').split(',').map(value => value.trim()).filter(Boolean);
Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const headers = { 'Access-Control-Allow-Origin': origins.includes(origin) ? origin : '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!origins.includes(origin)) return reply({ error: 'Origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: request.headers.get('authorization') || '' } }, auth: { persistSession: false } });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user?.email) return reply({ error: 'Unauthorized' }, 401);
    const { data: member } = await userClient.from('members').select('slot').eq('email', user.email.toLowerCase()).maybeSingle();
    if (!member || user.app_metadata.provider !== 'google') return reply({ error: 'Forbidden' }, 403);
    const body = await request.json();
    if (!['store', 'token', 'disconnect'].includes(body.action)) return reply({ error: 'Invalid action' }, 400);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    if (body.action === 'disconnect') {
      const { error } = await admin.from('google_credentials').delete().eq('user_id', user.id);
      if (error) throw error;
      return reply({ disconnected: true });
    }
    const secret = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY')!;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    if (!secret || !clientId || !clientSecret) return reply({ error: 'Google 지속 연결 서버 설정이 필요합니다.' }, 503);
    let refreshToken;
    if (body.action === 'store') {
      if (typeof body.refresh_token !== 'string' || !body.refresh_token || body.refresh_token.length > 10000) return reply({ error: 'Invalid credential' }, 400);
      refreshToken = body.refresh_token;
    } else {
      const { data, error } = await admin.from('google_credentials').select('encrypted_refresh_token').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data) return reply({ error: 'Google 지속 연결이 없습니다. Google을 한 번 다시 연결해 주세요.' }, 409);
      refreshToken = await unseal(data.encrypted_refresh_token, secret, user.id);
    }
    let token;
    try { token = await refreshGoogle(refreshToken, clientId, clientSecret); }
    catch (error) {
      if (error.invalidGrant) {
        if (body.action === 'token') await admin.from('google_credentials').delete().eq('user_id', user.id);
        return reply({ error: error.message }, 409);
      }
      return reply({ error: 'Google 연결 갱신에 실패했습니다. 잠시 후 재시도해 주세요.' }, 502);
    }
    await verifyGoogle(token.access_token, user.email);
    if (body.action === 'store' || token.refresh_token) {
      const { error } = await admin.from('google_credentials').upsert({ user_id: user.id, encrypted_refresh_token: await seal(token.refresh_token || refreshToken, secret, user.id), updated_at: new Date().toISOString() });
      if (error) throw error;
    }
    return reply({ access_token: token.access_token, expires_in: token.expires_in });
  } catch { return reply({ error: 'Google 지속 연결 서버를 확인한 뒤 재시도해 주세요.' }, 500); }
});
