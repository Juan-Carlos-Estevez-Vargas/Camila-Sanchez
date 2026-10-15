import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { estimateRemainingMs, formatRemaining } from "@/services/images/bulk";
import { formatBytes } from "@/services/images/sizing";
import type { UploadSnapshot } from "@/services/images/PhotoUploader";

const PHRASES = [
  "Guardando este recuerdo con todo mi amor…",
  "Puliendo cada detalle de tu sonrisa…",
  "Haciendo espacio en nuestro álbum…",
  "Envolviendo este momento para siempre…",
  "Cuidando que se vea tan bonita como tú…",
  "Ajustando la luz de nuestros días felices…",
  "Un segundito, que lo bonito toma su tiempo…",
];

const SPARKLES = ["💗", "✨", "💕", "🌸", "💖", "⭐"];

/** Con tandas grandes sólo listamos lo que está en curso y lo que falló. */
const MAX_VISIBLE_FILES = 6;

interface Props {
  tasks: UploadSnapshot[];
  onCancel?(): void;
}

/**
 * Pantalla de espera mientras se optimizan y suben fotos: corazón que late,
 * anillo de progreso, contador "3 de 7" y frases que van cambiando.
 */
export function RomanticLoader({ tasks, onCancel }: Props) {
  const [phrase, setPhrase] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhrase((p) => (p + 1) % PHRASES.length);
      setNow(Date.now());
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    let done = 0, failed = 0, duplicates = 0, finished = 0, progress = 0, saved = 0;
    for (const t of tasks) {
      if (t.status === "done") {
        done++;
        if (t.result?.kind === "duplicate") duplicates++;
        if (t.result?.kind === "uploaded") saved += t.result.originalBytes - t.result.finalBytes;
      }
      if (t.status === "error") failed++;
      if (t.status !== "queued" && t.status !== "running") finished++;
      progress += t.status === "queued" || t.status === "running" ? t.progress : 1;
    }
    return { total, done, failed, duplicates, finished, progress: total ? progress / total : 0, saved };
  }, [tasks]);

  const remaining = formatRemaining(estimateRemainingMs(stats.finished, stats.total, now - startedAt));
  const visible = useMemo(
    () => tasks.filter((t) => t.status === "running" || t.status === "error").slice(0, MAX_VISIBLE_FILES),
    [tasks],
  );

  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(stats.progress * 100);

  const sparkles = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      delay: `${(i * 0.45) % 3.5}s`,
      emoji: SPARKLES[i % SPARKLES.length],
    })),
    [],
  );

  return createPortal(
    <div className="love-loader" role="alertdialog" aria-live="polite" aria-label="Guardando fotos">
      <div className="love-loader__sparkles" aria-hidden>
        {sparkles.map((s, i) => (
          <span key={i} style={{ left: s.left, bottom: 0, animationDelay: s.delay }}>{s.emoji}</span>
        ))}
      </div>
      <div className="love-loader__inner">
        <div className="love-loader__ring">
          <svg viewBox="0 0 168 168" aria-hidden>
            <defs>
              <linearGradient id="love-gradient" x1="0" x2="1">
                <stop offset="0%" stopColor="#ff8fb1" />
                <stop offset="100%" stopColor="#ffd29a" />
              </linearGradient>
            </defs>
            <circle className="love-loader__track" cx="84" cy="84" r={radius} fill="none" strokeWidth="10" />
            <circle
              className="love-loader__bar" cx="84" cy="84" r={radius} fill="none" strokeWidth="10"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - stats.progress)}
            />
          </svg>
          <div className="love-loader__heart" aria-hidden>💖</div>
        </div>
        <div className="love-loader__percent">{percent}%</div>
        <p key={phrase} className="love-loader__phrase">{PHRASES[phrase]}</p>
        <div className="love-loader__meta">
          {stats.done} de {stats.total} {stats.total === 1 ? "foto" : "fotos"} lista{stats.total === 1 ? "" : "s"}
          {stats.duplicates > 0 && ` · ${stats.duplicates} ya estaban`}
          {stats.saved > 0 && ` · ${formatBytes(stats.saved)} más livianas`}
          {stats.failed > 0 && ` · ${stats.failed} con problemas`}
          {remaining && <><br />Falta {remaining}</>}
        </div>
        {tasks.length > 1 && visible.length > 0 && (
          <div className="love-loader__files">
            {visible.map((t) => (
              <div key={t.id} className="love-loader__file">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                <span>{t.stage}</span>
                <div className="love-loader__file-bar"><span style={{ width: `${Math.round((t.status === "done" ? 1 : t.progress) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        )}
        {onCancel && (
          <button className="btn btn--ghost btn--sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
