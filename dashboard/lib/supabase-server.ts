import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — instantiated on first request, not at module load (build-safe)
let _client: SupabaseClient<any> | null = null;

export function getSupabase(): SupabaseClient<any> {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _client!;
}
