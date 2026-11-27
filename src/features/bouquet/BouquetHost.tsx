/**
 * El ramo de flores de la fecha especial: decide a quién le sale, lo abre
 * solo la primera vez que ella entra (una vez por fecha, en ese navegador) y
 * deja el botón 💐 para volver a abrirlo. Se puede ver desde la víspera a la
 * hora elegida en Apariencia (9 p. m.) hasta las 11:59 p. m. del día; el tema
 * de la página, en cambio, sólo cambia el día mismo.
 *
 * Mientras está abierto, la actividad lo cuenta como la página
 * «/ramo/<fecha>/<auto|boton>» (ver ActivityHeartbeat), así en Auditoría →
 * Actividad se ve cuándo lo abrió, cómo y cuánto tiempo lo miró.
 *
 * Vista previa (Apariencia → «Ver el ramo»): `/?tema=birthday&ramo=1` lo
 * abre para quien puede editar la Apariencia, sin contar en la actividad.
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { BOUQUETS, bouquetDayKey, isBouquetRecipient } from "@/domain/bouquets";
import { LETTER_PATHS } from "@/domain/forYou";
import { anniversaryStart } from "@/domain/relationship";
import { bouquetWindowAt, msUntilBouquetChange, type BouquetWindow } from "@/domain/specialDays";
import type { SiteSettings } from "@/domain/types";
import { PERMISSIONS } from "@/domain/permissions";
import { useT } from "@/i18n";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { useSpecialDay } from "@/state/SpecialDayContext";
import { useAsync } from "@/ui/useAsync";
import { closeBouquet, openBouquet, useOpenBouquet } from "./bouquetStore";
import { SingleFlower } from "./FlowerArt";
import styles from "./Bouquet.module.scss";

const BouquetReveal = lazy(() => import("./BouquetReveal"));

const SEEN_KEY = "bouquet-opened";

function seenToday(key: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === key;
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(SEEN_KEY, key);
  } catch {
    // Sin almacenamiento vuelve a abrirse solo en la próxima visita.
  }
}

/** El ramo que toca ahora; vuelve a mirar a la hora de la víspera y a la medianoche. */
function useBouquetWindow(settings: SiteSettings | undefined): BouquetWindow | null {
  const [now, setNow] = useState(() => new Date());
  const config = settings?.effects.specialDays;
  useEffect(() => {
    if (!config) return;
    const timer = setTimeout(() => setNow(new Date()), msUntilBouquetChange(config, now) + 1000);
    return () => clearTimeout(timer);
  }, [config, now]);
  return useMemo(
    () => (settings && config ? bouquetWindowAt(config, anniversaryStart(settings), now) : null),
    [settings, config, now],
  );
}

const isChat = (path: string) => path === "/chat" || path.startsWith("/chat/");

export function BouquetHost() {
  const backend = useBackend();
  const { user, profile, policy, twoStepPending } = useAuth();
  const { day, preview } = useSpecialDay();
  const { content } = useSiteContent();
  const { pathname, search } = useLocation();
  const open = useOpenBouquet();
  const t = useT().bouquet;

  const specialDays = content?.settings.effects.specialDays;
  const config = specialDays?.bouquet;
  const live = useBouquetWindow(content?.settings);
  // En la vista previa, la fecha que se está mirando; si no, la del reloj (con víspera).
  const current = preview ? (day ? { day, eve: false, date: new Date() } : null) : live;
  const canManageTheme = policy.can(PERMISSIONS.themeManage);
  const eligible = !!current && !!config && !!user && !twoStepPending && (preview
    ? canManageTheme
    : isBouquetRecipient(config, { userId: user.id, canManageTheme }));
  const dayId = eligible ? current.day.id : null;
  const eve = eligible && current.eve;
  const seenKey = dayId && !preview && live ? bouquetDayKey(dayId, live.date) : null;
  const onLetter = LETTER_PATHS.includes(pathname);

  // La nota (lugar, hora, mensaje) sólo se pide si de verdad le toca el ramo.
  const { data: notes } = useAsync(
    () => (dayId ? backend.content.listBouquetNotes() : Promise.resolve([])),
    [backend, dayId, user?.id],
  );

  // Al entrar: se abre solo una vez por día y por navegador. useLayoutEffect
  // para que la ventana del cumpleaños no alcance a asomarse antes.
  useLayoutEffect(() => {
    if (!dayId || onLetter) return;
    if (preview) {
      if (new URLSearchParams(search).get("ramo") === "1") openBouquet({ dayId, trigger: "boton", preview: true });
      return;
    }
    if (!seenKey || seenToday(seenKey)) return;
    markSeen(seenKey);
    openBouquet({ dayId, trigger: "auto", preview: false });
  }, [dayId, seenKey, preview, onLetter, search]);

  // Al terminar el día (o si deja de tocarle) se cierra solo.
  useEffect(() => {
    if (open && open.dayId !== dayId) closeBouquet();
  }, [open, dayId]);

  if (!dayId || !specialDays || !config) return null;
  const style = BOUQUETS[dayId];
  const flowers = t.flowers[dayId].name;
  const note = notes?.find((n) => n.dayId === dayId) ?? null;
  const name = specialDays.birthdayName.trim() || profile?.displayName.trim() || "";

  return (
    <>
      {!open && !isChat(pathname) && !onLetter && (
        <button type="button" className={styles.button} aria-label={t.buttonLabel(flowers)}
          onClick={() => openBouquet({ dayId, trigger: "boton", preview })}>
          <span className={styles.buttonFlower} aria-hidden><SingleFlower style={style} size={30} /></span>
          <span aria-hidden>{t.button}</span>
        </button>
      )}
      {open && (
        <Suspense fallback={null}>
          <BouquetReveal dayId={dayId} eve={eve} note={note} name={name} signature={config.signature} onClose={closeBouquet} />
        </Suspense>
      )}
    </>
  );
}
