import { useCallback, useState } from "react";
import { useToast } from "@/state/ToastContext";

/**
 * Envuelve una operación de guardado: estado "ocupado", aviso de éxito y
 * mensaje amable si falla. Evita repetir try/catch en cada formulario.
 */
export function useSaver() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(action: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      const result = await action();
      if (success) toast.success(success);
      return result;
    } catch (error) {
      toast.error(error);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return { busy, run };
}
