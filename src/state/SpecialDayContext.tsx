/**
 * La fecha especial de hoy, para toda la app. Mira el reloj del teléfono y
 * vuelve a mirar justo a la medianoche, así el tema empieza y termina a la
 * hora exacta aunque la página quede abierta.
 *
 * Vista previa: `/?tema=halloween` muestra ese tema en esta pestaña (lo
 * recuerda mientras siga abierta) y `/?tema=normal` la quita. La usan los
 * botones «Ver cómo se ve» de Apariencia.
 */
import { anniversaryStart } from "@/domain/relationship";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  msUntilMidnight, parseSpecialDayId, previewSpecialDay, specialDayOn,
  type ActiveSpecialDay, type SpecialDayId,
} from "@/domain/specialDays";
import { useSiteContent } from "./SiteContentStore";

export interface SpecialDayState {
  day: ActiveSpecialDay | null;
  /** true si es una vista previa y no la fecha de verdad. */
  preview: boolean;
}

const PREVIEW_KEY = "special-day-preview";
const SpecialDayContext = createContext<SpecialDayState>({ day: null, preview: false });

function readPreview(): SpecialDayId | null {
  try {
    return parseSpecialDayId(sessionStorage.getItem(PREVIEW_KEY));
  } catch {
    return null;
  }
}

function writePreview(id: SpecialDayId | null) {
  try {
    if (id) sessionStorage.setItem(PREVIEW_KEY, id);
    else sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    // Sin almacenamiento la vista previa dura sólo mientras siga en la URL.
  }
}

/** Fecha de hoy que se actualiza sola a la medianoche. */
function useToday(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), msUntilMidnight(now) + 1000);
    return () => clearTimeout(timer);
  }, [now]);
  return now;
}

export function SpecialDayProvider({ children }: { children: ReactNode }) {
  const { content } = useSiteContent();
  const { search } = useLocation();
  const today = useToday();
  const [previewId, setPreviewId] = useState<SpecialDayId | null>(readPreview);

  useEffect(() => {
    const param = new URLSearchParams(search).get("tema");
    if (param === null) return;
    const id = parseSpecialDayId(param);
    writePreview(id);
    setPreviewId(id);
  }, [search]);

  const settings = content?.settings;
  const value = useMemo<SpecialDayState>(() => {
    if (!settings) return { day: null, preview: false };
    if (previewId) return { day: previewSpecialDay(previewId, settings.relationshipStart, today), preview: true };
    return { day: specialDayOn(settings.effects.specialDays, anniversaryStart(settings), today), preview: false };
  }, [settings, previewId, today]);

  useEffect(() => {
    const root = document.documentElement;
    if (value.day) root.dataset.special = value.day.id;
    else delete root.dataset.special;
  }, [value.day]);

  return <SpecialDayContext.Provider value={value}>{children}</SpecialDayContext.Provider>;
}

export const useSpecialDay = (): SpecialDayState => useContext(SpecialDayContext);

