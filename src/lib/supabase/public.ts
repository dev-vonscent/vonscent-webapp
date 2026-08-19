import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Cookie-less anon Supabase client for public catalog/content reads. Unlike
 * the request-bound client in server.ts it never calls cookies(), so pages
 * that only read public data stay statically cacheable (ISR). RLS still
 * applies with the anon role — use it only for data everyone may see; anything
 * user-specific keeps going through server.ts / browser.ts.
 */
export function createPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  client ??= createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
