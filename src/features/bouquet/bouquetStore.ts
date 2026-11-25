/**
 * Si el ramo de flores está abierto ahora mismo, para toda la app: lo abre el
 * propio ramo (al entrar o con el botón 💐), lo mira la actividad (para
 * registrar la apertura como la página «/ramo/…») y lo miran las otras
 * ventanas (cumpleaños, novedades) para esperar a que se cierre.
 */
import { useSyncExternalStore } from "react";
import type { BouquetTrigger } from "@/domain/bouquets";
import type { SpecialDayId } from "@/domain/specialDays";

export interface OpenBouquet {
  dayId: SpecialDayId;
  trigger: BouquetTrigger;
  /** Vista previa desde Apariencia: no cuenta en la actividad. */
  preview: boolean;
}

let current: OpenBouquet | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function openBouquet(open: OpenBouquet): void {
  current = open;
  emit();
}

export function closeBouquet(): void {
  if (!current) return;
  current = null;
  emit();
}

export function useOpenBouquet(): OpenBouquet | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}
