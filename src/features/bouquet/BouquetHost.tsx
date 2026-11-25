/**
 * El ramo de flores de la fecha especial de hoy: decide a quién le sale, lo
 * abre solo la primera vez que ella entra ese día (en ese navegador) y deja
 * todo el día el botón 💐 para volver a abrirlo.
 *
 * Mientras está abierto, la actividad lo cuenta como la página
 * «/ramo/<fecha>/<auto|boton>» (ver ActivityHeartbeat), así en Auditoría →
 * Actividad se ve cuándo lo abrió, cómo y cuánto tiempo lo miró.
 *
 * Vista previa (Apariencia → «Ver el ramo»): `/?tema=birthday&ramo=1` lo
 * abre para quien puede editar la Apariencia, sin contar en la actividad.
 */
import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { BOUQUETS, bouquetDayKey, isBouquetRecipient } from "@/domain/bouquets";
import { LETTER_PATHS } from "@/domain/forYou";
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
  const canManageTheme = policy.can(PERMISSIONS.themeManage);
  const eligible = !!day && !!config && !!user && !twoStepPending && (preview
    ? canManageTheme
    : isBouquetRecipient(config, { userId: user.id, canManageTheme }));
  const dayId = eligible ? day.id : null;
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
    const key = bouquetDayKey(dayId);
    if (seenToday(key)) return;
    markSeen(key);
    openBouquet({ dayId, trigger: "auto", preview: false });
  }, [dayId, preview, onLetter, search]);

  // A medianoche (o si deja de tocarle) se cierra solo.
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
          <BouquetReveal dayId={dayId} note={note} name={name} signature={config.signature} onClose={closeBouquet} />
        </Suspense>
      )}
    </>
  );
}
