import { createContext, useContext, type ReactNode } from "react";
import type { Backend } from "@/data/ports";

const BackendContext = createContext<Backend | null>(null);

/** Inyección de dependencias: los componentes piden el backend por contexto. */
export function BackendProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  const backend = useContext(BackendContext);
  if (!backend) throw new Error("useBackend debe usarse dentro de <BackendProvider>");
  return backend;
}
