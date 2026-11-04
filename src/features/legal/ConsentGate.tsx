import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { toUserMessage } from "@/core/errors";
import { LEGAL_PATH, LEGAL_VERSION, hasCurrentConsent, legalPath, takePendingConsent } from "@/domain/legal";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useFocusTrap } from "@/ui/useFocusTrap";
import { useT } from "@/i18n";

type GateState = "idle" | "checking" | "needed" | "ok";

/**
 * Pide aceptar los términos y la política de privacidad a quien entra y aún
 * no aceptó la versión vigente (cuentas creadas antes de que existieran, o
 * cuando cambian). Si la persona marcó la casilla al crear su cuenta, se
 * registra sola sin volver a preguntar.
 *
 * No se cuela en las páginas legales: así se pueden leer antes de aceptar.
 */
export function ConsentGate() {
  const backend = useBackend();
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [state, setState] = useState<GateState>("idle");

  useEffect(() => {
    if (!user) {
      setState("idle");
      return;
    }
    let active = true;
    setState("checking");
    (async () => {
      const consents = await backend.legal.myConsents();
      if (hasCurrentConsent(consents)) return "ok" as const;
      if (takePendingConsent(user.email)) {
        await backend.legal.accept(LEGAL_VERSION);
        return "ok" as const;
      }
      return "needed" as const;
    })()
      .then((next) => active && setState(next))
      // Si no se pudo consultar (sin conexión) no bloqueamos: se pregunta en la próxima visita.
      .catch(() => active && setState("ok"));
    return () => {
      active = false;
    };
  }, [backend, user]);

  if (state !== "needed" || pathname === LEGAL_PATH || pathname.startsWith(`${LEGAL_PATH}/`)) return null;
  return <ConsentDialog onAccept={() => backend.legal.accept(LEGAL_VERSION).then(() => setState("ok"))} onSignOut={() => void signOut()} />;
}

function ConsentDialog({ onAccept, onSignOut }: { onAccept(): Promise<void>; onSignOut(): void }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const i18n = useT();
  const t = i18n.legal.consent;
  useFocusTrap(ref);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const accept = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onAccept();
    } catch (err) {
      setError(toUserMessage(err));
      setBusy(false);
    }
  }, [onAccept]);

  return createPortal(
    <div className="modal-backdrop">
      <div ref={ref} className="modal consent-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">{t.title}</h2>
        </div>
        <p>{t.intro}</p>
        <ul className="consent-dialog__list">
          <li><Link to={legalPath("terminos")}>{i18n.legal.docs.terminos.title}</Link></li>
          <li><Link to={legalPath("privacidad")}>{i18n.legal.docs.privacidad.title}</Link></li>
        </ul>
        <label className="consent-dialog__check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t.checkbox}</span>
        </label>
        {error && <p className="field__error" role="alert">{error}</p>}
        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onSignOut} disabled={busy}>{t.signOut}</button>
          <button type="button" className="btn" onClick={() => void accept()} disabled={!checked || busy}>
            {busy ? i18n.common.saving : t.accept}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
