import { useEffect, useState, type FormEvent } from "react";
import type { TwoStepEnrollment } from "@/data/ports";
import { groupSecret, isValidCode } from "@/domain/totp";
import { useSaver } from "@/features/admin/useSaver";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Spinner } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { useT } from "@/i18n";
import { CodeInput } from "./CodeInput";

/** QR del enlace otpauth:// (la librería se carga sólo al activar). */
function useQr(uri: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!uri) return;
    let alive = true;
    void import("qrcode")
      .then(({ toDataURL }) => toDataURL(uri, { width: 480, margin: 2, errorCorrectionLevel: "M" }))
      .then((dataUrl) => alive && setSrc(dataUrl));
    return () => {
      alive = false;
      setSrc(null);
    };
  }, [uri]);
  return src;
}

/**
 * Mi cuenta → Verificación en dos pasos. Cada persona decide si la usa:
 * activarla pide escanear un QR y escribir el primer código; desactivarla
 * pide un código de la app.
 */
export function TwoStepCard() {
  const backend = useBackend();
  const { twoStepEnabled, refresh } = useAuth();
  const { run, busy } = useSaver();
  const [enrollment, setEnrollment] = useState<TwoStepEnrollment | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qr = useQr(enrollment?.uri ?? null);
  const t = useT().auth.twoStep;

  const reset = () => {
    setEnrollment(null);
    setDisabling(false);
    setCode("");
    setError(null);
  };

  const start = async () => {
    reset();
    const started = await run(() => backend.auth.startTwoStep());
    if (started) setEnrollment(started);
  };

  const cancel = async () => {
    if (enrollment) await backend.auth.cancelTwoStep(enrollment.factorId).catch(() => undefined);
    reset();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidCode(code)) return setError(t.invalidCode);
    setError(null);
    const ok = enrollment
      ? await run(() => backend.auth.confirmTwoStep(enrollment.factorId, code).then(() => true), t.enabled)
      : await run(() => backend.auth.disableTwoStep(code).then(() => true), t.disabled);
    if (!ok) return setCode("");
    reset();
    await refresh();
  };

  const status = (
    <span className={`badge${twoStepEnabled ? " badge--success" : ""}`}>{twoStepEnabled ? t.on : t.off}</span>
  );

  return (
    <section className="card stack" style={{ marginTop: 16 }} data-tour="account-two-step">
      <div className="row-between">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.title}</h2>
        {status}
      </div>
      <p className="muted" style={{ margin: 0 }}>{twoStepEnabled ? t.enabledHint : t.hint}</p>

      {!enrollment && !disabling && (
        <div className="row">
          {twoStepEnabled
            ? <button className="btn btn--soft" onClick={() => setDisabling(true)}>{t.disable}</button>
            : <button className="btn" disabled={busy} onClick={() => void start()}>{t.enable}</button>}
        </div>
      )}

      {(enrollment || disabling) && (
        <form className="stack" onSubmit={submit} noValidate>
          {enrollment ? (
            <ol className="two-step-steps">
              <li>{t.step1}</li>
              <li>
                {t.step2}
                <div className="two-step-qr">
                  {qr ? <img src={qr} alt={t.qrAlt} width={200} height={200} /> : <Spinner label={t.generating} />}
                </div>
                <a className="btn btn--sm btn--ghost two-step-open" href={enrollment.uri}>{t.openInApp}</a>
                <p className="field__hint" style={{ margin: 0 }}>{t.manual}</p>
                <code className="two-step-secret">{groupSecret(enrollment.secret)}</code>
              </li>
              <li>{t.step3}</li>
            </ol>
          ) : (
            <p style={{ margin: 0 }}>{t.disableIntro}</p>
          )}
          <Field label={t.code} error={error}>
            {(id) => <CodeInput id={id} value={code} onChange={setCode} autoFocus={disabling} />}
          </Field>
          <div className="row">
            <button className={`btn${disabling ? " btn--danger" : ""}`} disabled={busy}>
              {enrollment ? t.confirm : t.confirmDisable}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => void cancel()}>{t.cancel}</button>
          </div>
        </form>
      )}
    </section>
  );
}
