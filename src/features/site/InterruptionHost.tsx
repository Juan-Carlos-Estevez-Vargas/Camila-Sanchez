import { useEffect, useMemo, useState } from "react";
import type { Interruption } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Modal } from "@/ui/Modal";
import { burst } from "./effects/FloatingEffects";

const LOCAL_KEY = "love-seen-interruptions";

function readLocalSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeLocalSeen(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids.slice(-100)));
  } catch {
    /* almacenamiento no disponible: se volverá a mostrar */
  }
}

const EFFECTS: Record<Interruption["style"], string[] | null> = {
  modal: null,
  banner: null,
  confetti: ["🎉", "🎊", "✨", "💖", "🥳"],
  hearts: ["💖", "💗", "💕", "❤️", "💘"],
};

/**
 * "Interrupciones": sorpresas programadas que aparecen al abrir la página
 * (p. ej. "¡Feliz mesiversario!"). Se muestran de una en una y, si son de
 * una sola vez, se recuerda que ya se vieron (en el servidor si hay sesión).
 */
export function InterruptionHost({ items }: { items: Interruption[] }) {
  const backend = useBackend();
  const { user } = useAuth();
  const [seen, setSeen] = useState<string[] | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const local = readLocalSeen();
    backend.content.listSeenInterruptions()
      .then((server) => active && setSeen([...new Set([...local, ...server])]))
      .catch(() => active && setSeen(local));
    return () => {
      active = false;
    };
  }, [backend, user?.id]);

  const current = useMemo(
    () => (seen ? items.find((i) => !dismissed.includes(i.id) && !(i.showOnce && seen.includes(i.id))) : undefined),
    [items, seen, dismissed],
  );

  useEffect(() => {
    const effect = current && EFFECTS[current.style];
    if (effect) burst(effect, 48);
  }, [current]);

  if (!current) return null;

  const close = () => {
    setDismissed((d) => [...d, current.id]);
    if (current.showOnce) {
      writeLocalSeen([...readLocalSeen(), current.id]);
      void backend.content.markInterruptionSeen(current.id).catch(() => undefined);
    }
  };

  if (current.style === "banner") {
    return (
      <div className="banner" role="status">
        <div className="container row-between">
          <div><strong>{current.title}</strong> {current.body && <span>{current.body}</span>}</div>
          <button className="btn btn--sm btn--ghost" onClick={close}>Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <Modal title={current.title} onClose={close} footer={<button className="btn" onClick={close}>💖 Gracias</button>}>
      {current.body.split("\n").map((line, i) => <p key={i} className="surprise-text">{line}</p>)}
    </Modal>
  );
}
