import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/core/config";
import { sessionAwareStorage } from "@/data/sessionPersistence";

let client: SupabaseClient | null = null;

/** Cliente único (Singleton) de Supabase, creado bajo demanda. */
export function getSupabase(): SupabaseClient {
  client ??= createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce",
      storage: sessionAwareStorage,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}

type Row = Record<string, unknown>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

/** Convierte la respuesta {data, error} de Supabase en valor o excepción. */
export async function unwrap<T = unknown>(query: PromiseLike<QueryResult>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message, { cause: error });
  return data as T;
}

export type { Row };
