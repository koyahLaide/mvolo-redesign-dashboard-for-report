import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_UPDATE = ['name', 'type', 'conditions', 'actions', 'priority', 'active'] as const;

export async function GET() {
  const { data, error } = await supabase
    .from('feed_rules')
    .select('id,name,type,conditions,actions,priority,active,created_at')
    .order('priority');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.type) {
    return NextResponse.json({ error: 'name en type zijn verplicht' }, { status: 400 });
  }
  if (!['filter', 'transform'].includes(body.type)) {
    return NextResponse.json({ error: 'type moet filter of transform zijn' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('feed_rules')
    .insert({
      name:       body.name,
      type:       body.type,
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      actions:    body.actions && typeof body.actions === 'object' ? body.actions : {},
      priority:   typeof body.priority === 'number' ? body.priority : 10,
      active:     body.active !== false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_UPDATE) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await supabase
    .from('feed_rules').update(patch).eq('id', body.id).select().single();

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
