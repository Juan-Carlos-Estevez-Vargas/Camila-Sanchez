/**
 * Ventana del cumpleaños: al abrir la página ese día sale una vez (por día y
 * por navegador) con el saludo y el mensaje de Apariencia («Te amo
 * demasiado… ¡Feliz cumpleaños, mi reina!»). Su botón es también el primer
 * toque que deja sonar la música (ver SpecialDayMusic).
 */
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { musicDayKey } from "@/domain/specialMusic";
import { useT } from "@/i18n";
import { useSiteContent } from "@/state/SiteContentStore";
import { useSpecialDay } from "@/state/SpecialDayContext";
import { Modal } from "@/ui/Modal";

const KEY = "special-popup";

function seen(key: string): boolean {
  try {
    return localStorage.getItem(KEY) === key;
  } catch {
    return false;
  }
}

function BirthdayPopup({ dayKey, name, message }: { dayKey: string; name: string; message: string }) {
  const t = useT().special;
  const [open, setOpen] = useState(() => !seen(dayKey));
  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, dayKey);
    } catch {
      // Sin almacenamiento vuelve a salir en la próxima visita.
    }
    setOpen(false);
  };
  return (
    <Modal title={t.greetings.birthday({ name, years: null })} onClose={close}
      footer={<button type="button" className="btn" onClick={close}>{t.popup.open}</button>}>
      <div className="special-popup">
        <p className="special-popup__icons" aria-hidden>👑🎂💖</p>
        <p className="special-popup__message">{message || t.popup.message}</p>
      </div>
    </Modal>
  );
}

export function SpecialDayPopup() {
  const { day, preview } = useSpecialDay();
  const { content } = useSiteContent();
  const { pathname } = useLocation();
  const config = content?.settings.effects.specialDays;
  if (day?.id !== "birthday" || !config) return null;
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return null;
  const dayKey = musicDayKey(day.id, new Date(), preview);
  return <BirthdayPopup key={dayKey} dayKey={dayKey} name={config.birthdayName.trim()} message={config.birthdayMessage.trim()} />;
}
