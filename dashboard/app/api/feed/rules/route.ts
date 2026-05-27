import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SELECT = 'id,name,type,scope,channel,conditions,actions,priority,active,created_at';
const ALLOWED_UPDATE = ['name','type','scope','channel','conditions','actions','priority','active'] as const;

export async function GET() {
  const { data, error } = await supabase
    .from('feed_rules')
    .select(SELECT)
    .order('scope')      // master before partner
    .order('priority');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Duplicate rule
  if (action === 'duplicate') {
    const body = await request.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });
    const { data: src } = await supabase.from('feed_rules').select(SELECT).eq('id', body.id).single();
    if (!src) return NextResponse.json({ error: 'Regel niet gevonden' }, { status: 404 });
    const { data, error } = await supabase.from('feed_rules').insert({
      name:       src.name + ' (kopie)',
      type:       src.type,
      scope:      body.scope ?? src.scope,
      channel:    body.channel !== undefined ? body.channel : src.channel,
      conditions: src.conditions,
      actions:    src.actions,
      priority:   src.priority + 1,
      active:     false,
    }).select(SELECT).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rule: data }, { status: 201 });
  }

  // Copy all master rules to a partner channel
  if (action === 'copy_all_to_partner') {
    const body = await request.json().catch(() => null);
    const channel = body?.channel;
    if (!channel) return NextResponse.json({ error: 'channel is verplicht' }, { status: 400 });
    const { data: masters } = await supabase.from('feed_rules').select(SELECT).eq('scope', 'master').eq('active', true);
    if (!masters?.length) return NextResponse.json({ copied: 0 });
    const inserts = masters.map(r => ({ name: r.name, type: r.type, scope: 'partner', channel, conditions: r.conditions, actions: r.actions, priority: r.priority, active: false }));
    const { data, error } = await supabase.from('feed_rules').insert(inserts).select(SELECT);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ copied: data?.length ?? 0, rules: data });
  }

  // Create new rule
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.type) {
    return NextResponse.json({ error: 'name en type zijn verplicht' }, { status: 400 });
  }
  if (!['filter', 'transform'].includes(body.type)) {
    return NextResponse.json({ error: 'type moet filter of transform zijn' }, { status: 400 });
  }

  const scope   = body.scope === 'partner' ? 'partner' : 'master';
  const channel = scope === 'partner' ? (body.channel ?? null) : null;

  const { data, error } = await supabase
    .from('feed_rules')
    .insert({
      name:       body.name,
      type:       body.type,
      scope,
      channel,
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      actions:    body.actions && typeof body.actions === 'object' ? body.actions : {},
      priority:   typeof body.priority === 'number' ? body.priority : 10,
      active:     body.active !== false,
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  // Reorder: move priority up or down relative to siblings
  if (body.action === 'move_up' || body.action === 'move_down') {
    const { data: rule } = await supabase.from('feed_rules').select('priority,scope,channel').eq('id', body.id).single();
    if (!rule) return NextResponse.json({ error: 'Regel niet gevonden' }, { status: 404 });

    let q = supabase.from('feed_rules').select('id,priority').eq('scope', rule.scope);
    if (rule.scope === 'partner') q = (q as any).eq('channel', rule.channel ?? '');
    const { data: siblings } = await q.order('priority');

    const idx = (siblings ?? []).findIndex(r => r.id === body.id);
    const swapIdx = body.action === 'move_up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= (siblings ?? []).length) return NextResponse.json({ ok: true });

    const sibling = siblings![swapIdx];
    await Promise.all([
      supabase.from('feed_rules').update({ priority: sibling.priority }).eq('id', body.id),
      supabase.from('feed_rules').update({ priority: rule.priority }).eq('id', sibling.id),
    ]);
    return NextResponse.json({ ok: true });
  }

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED_UPDATE) {
    if (key in body) patch[key] = body[key];
  }
  // Auto-clear channel when scope changes to master
  if (patch.scope === 'master') patch.channel = null;

  const { data, error } = await supabase
    .from('feed_rules').update(patch).eq('id', body.id).select(SELECT).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });
  const { error } = await supabase.from('feed_rules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
