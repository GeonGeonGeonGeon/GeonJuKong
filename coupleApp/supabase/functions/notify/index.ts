import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const origin = Deno.env.get('APP_ORIGIN') || '';
const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json' };
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async request => {
  if (!origin || request.headers.get('origin') !== origin) return reply({ error: 'Origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const authorization = request.headers.get('authorization') || '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return reply({ error: 'Unauthorized' }, 401);
    const { data: member } = await userClient.from('members').select('slot').eq('email', user.email!.toLowerCase()).maybeSingle();
    if (!member) return reply({ error: 'Forbidden' }, 403);
    const { recordId } = await request.json();
    const { data: record } = await userClient.from('records').select('id,author_id,created_at').eq('id', recordId).eq('kind', 'message').single();
    if (!record || record.author_id !== user.id || Date.now() - Date.parse(record.created_at) > 300000) return reply({ error: 'Invalid message' }, 403);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error: duplicate } = await admin.from('push_deliveries').insert({ record_id: record.id });
    if (duplicate?.code === '23505') return reply({ sent: 0, duplicate: true });
    if (duplicate) throw new Error('Cannot record delivery');
    const { data: members, error: membersError } = await admin.from('members').select('email');
    if (membersError) throw membersError;
    const { data: subscriptions, error: subscriptionsError } = await admin.from('push_subscriptions').select('endpoint,user_id,subscription').neq('user_id', user.id);
    if (subscriptionsError) throw subscriptionsError;
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
    let sent = 0;
    for (const item of subscriptions || []) {
      // 유출된 service role을 클라이언트에 전달하지 않고 구독 소유자를 재검증합니다.
      const { data: target } = await admin.auth.admin.getUserById(item.user_id);
      if (!target.user || !members?.some(member => member.email === target.user!.email?.toLowerCase())) continue;
      const endpoint = new URL(item.endpoint);
      // 사용자 제공 endpoint를 통한 내부망 요청을 차단합니다.
      if (endpoint.protocol !== 'https:' || item.subscription?.endpoint !== item.endpoint || !item.subscription?.keys?.auth || !item.subscription?.keys?.p256dh || !(endpoint.hostname === 'fcm.googleapis.com' || endpoint.hostname === 'updates.push.services.mozilla.com' || endpoint.hostname === 'web.push.apple.com' || endpoint.hostname.endsWith('.notify.windows.com'))) continue;
      try { await webpush.sendNotification(item.subscription, JSON.stringify({ type: 'message' }), { TTL: 3600 }); sent++; }
      catch (error) { if (error.statusCode === 404 || error.statusCode === 410) await admin.from('push_subscriptions').delete().eq('endpoint', item.endpoint); }
    }
    return reply({ sent });
  } catch { return reply({ error: 'Notification delivery failed' }, 500); }
});
