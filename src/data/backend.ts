import { isDemoMode } from "@/core/config";
import type { Backend } from "./ports";

/**
 * Fábrica del backend (patrón Factory + Strategy). Se importa de forma
 * diferida para que el SDK de Supabase no se descargue en modo demo y el
 * código demo no viaje a producción.
 */
export async function createBackend(): Promise<Backend> {
  if (isDemoMode) {
    const { demoBackend } = await import("./demo/demoBackend");
    return demoBackend;
  }
  const { supabaseBackend } = await import("./supabase/supabaseBackend");
  return supabaseBackend;
}
