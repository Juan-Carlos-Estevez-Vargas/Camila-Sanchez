import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { toUserMessage } from "@/core/errors";
import { toIsoDate } from "@/domain/dates";
import { collectDroppedImages, dedupeByIdentity, isImageFile, MAX_BATCH } from "@/services/images/bulk";
import { PhotoUploader, type UploadSnapshot } from "@/services/images/PhotoUploader";
import { formatBytes } from "@/services/images/sizing";
import { useBackend } from "@/state/BackendContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { useToast } from "@/state/ToastContext";
import { Field, Switch } from "@/ui/Field";
import { RomanticLoader } from "@/ui/RomanticLoader";
import { useKeepAwake } from "@/ui/useKeepAwake";
import styles from "./BulkUploadPanel.module.scss";

type DateMode = "capture" | "fixed";

interface Failure {
  file: File;
  reason: string;
}

interface Summary {
  uploaded: number;
  duplicates: number;
  saved: number;
  failures: Failure[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function SummaryCard({ summary, onRetry, onClose }: { summary: Summary; onRetry(): void; onClose(): void }) {
  return (
    <div className={styles.summary} role="status">
      <div className="row-between">
        <strong>Resumen de la carga</strong>
        <button className="btn btn--icon btn--ghost btn--sm" aria-label="Cerrar resumen" onClick={onClose}>×</button>
      </div>
      <div className={styles.stats}>
        {summary.uploaded > 0
          ? <span className="badge badge--success">💖 {plural(summary.uploaded, "foto nueva", "fotos nuevas")}</span>
          : !summary.failures.length && <span className="badge">Todas ya estaban en el álbum</span>}
        {summary.duplicates > 0 && <span className="badge badge--muted">{plural(summary.duplicates, "repetida omitida", "repetidas omitidas")}</span>}
        {summary.saved > 0 && <span className="badge badge--muted">{formatBytes(summary.saved)} ahorrados</span>}
        {summary.failures.length > 0 && <span className="badge badge--danger">{plural(summary.failures.length, "no se pudo subir", "no se pudieron subir")}</span>}
      </div>
      {summary.failures.length > 0 && (
        <>
          <ul className={styles.failures}>
            {summary.failures.slice(0, 20).map((f, i) => (
              <li key={i}><span className={styles.fileName}>{f.file.name}</span><span className="muted">{f.reason}</span></li>
            ))}
            {summary.failures.length > 20 && <li className="muted">y {summary.failures.length - 20} más…</li>}
          </ul>
          <button className="btn btn--sm" style={{ justifySelf: "start" }} onClick={onRetry}>Reintentar las que fallaron</button>
        </>
      )}
    </div>
  );
}

/**
 * Carga de fotos de una en una o por cientos: archivos sueltos, una carpeta
 * entera (con subcarpetas) o arrastrando todo a la vez. Cada foto cae sola en
 * el mes en que se tomó y las repetidas se saltan.
 */
export function BulkUploadPanel({ onUploaded }: { onUploaded(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const { content } = useSiteContent();
  const uploader = useMemo(() => new PhotoUploader(backend), [backend]);
  const [tasks, setTasks] = useState<UploadSnapshot[]>([]);
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>("capture");
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [caption, setCaption] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useKeepAwake(running);
  useEffect(() => uploader.subscribe(setTasks), [uploader]);
  useEffect(() => () => uploader.dispose(), [uploader]);
  // React no conoce el atributo no estándar para elegir carpetas.
  useEffect(() => folderInput.current?.setAttribute("webkitdirectory", ""), []);

  const knownHashes = useMemo(
    () => new Set((content?.photos ?? []).map((p) => p.sourceHash).filter((h): h is string => !!h)),
    [content?.photos],
  );

  const start = async (incoming: File[]) => {
    const images = incoming.filter(isImageFile);
    if (!images.length) {
      toast.show({ title: "No encontré fotos", body: "Elige imágenes JPG, PNG, WebP o HEIC, o una carpeta que las tenga.", tone: "error" });
      return;
    }
    const { unique, repeated } = dedupeByIdentity(images);
    const batch = unique.slice(0, MAX_BATCH);
    if (unique.length > MAX_BATCH) {
      toast.show({ title: `Subiré las primeras ${MAX_BATCH} fotos`, body: "Cuando terminen, carga las demás en otra tanda.", tone: "info" });
    }

    setSummary(null);
    setRunning(true);
    const results = await uploader.enqueue(
      batch.map((file) => ({ file, caption: caption.trim() || undefined, takenOn: dateMode === "fixed" ? date : undefined })),
      { basePosition: (content?.photos.length ?? 0) + 1, knownHashes, skipDuplicates },
    );

    const next: Summary = { uploaded: 0, duplicates: repeated.length, saved: 0, failures: [] };
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const cancelled = r.reason instanceof DOMException && r.reason.name === "AbortError";
        next.failures.push({ file: batch[i]!, reason: cancelled ? "Cancelada" : toUserMessage(r.reason) });
      } else if (r.value.kind === "duplicate") next.duplicates++;
      else {
        next.uploaded++;
        next.saved += Math.max(0, r.value.originalBytes - r.value.finalBytes);
      }
    });

    // Deja ver el 100% un instante antes de cerrar.
    await new Promise((r) => setTimeout(r, 900));
    setRunning(false);
    uploader.clearFinished();
    onUploaded();
    if (next.uploaded) toast.success(`${plural(next.uploaded, "foto guardada", "fotos guardadas")} 💖`);
    if (results.length > 1 || next.failures.length || next.duplicates) setSummary(next);
    if (filesInput.current) filesInput.current.value = "";
    if (folderInput.current) folderInput.current.value = "";
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setPreparing(true);
    try {
      const files = await collectDroppedImages(e.dataTransfer);
      setPreparing(false);
      await start(files);
    } catch (error) {
      setPreparing(false);
      toast.error(error, "No pude leer esa carpeta");
    }
  };

  return (
    <div className="card stack">
      <div
        className={`dropzone${dragOver ? " is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void onDrop(e)}
        // Con el mouse toda la zona abre el selector; con teclado o lector
        // de pantalla se usan los dos botones de adentro (sin controles anidados).
        onClick={() => filesInput.current?.click()}
        aria-busy={preparing}
      >
        <div className="dropzone__icon" aria-hidden>{preparing ? "⏳" : "📸"}</div>
        <strong role="status">{preparing ? "Buscando fotos en la carpeta…" : "Arrastra fotos o carpetas enteras aquí"}</strong>
        <span className="muted">Hasta {MAX_BATCH} a la vez. Se ajustan y se aligeran solas, sin perder calidad.</span>
        <div className={`row ${styles.pickers}`} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn--sm" onClick={() => filesInput.current?.click()}>Elegir fotos</button>
          <button type="button" className="btn btn--sm btn--soft" onClick={() => folderInput.current?.click()}>Elegir una carpeta</button>
        </div>
        <input ref={filesInput} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => void start([...(e.target.files ?? [])])} />
        <input ref={folderInput} type="file" multiple hidden onChange={(e) => void start([...(e.target.files ?? [])])} />
      </div>
      <div className="form-grid">
        <Field label="Fecha de las fotos">
          {(id) => (
            <select id={id} className="select" value={dateMode} onChange={(e) => setDateMode(e.target.value as DateMode)}>
              <option value="capture">El día en que se tomó cada una</option>
              <option value="fixed">Una fecha para todas</option>
            </select>
          )}
        </Field>
        {dateMode === "fixed" && (
          <Field label="¿Cuándo fue?">
            {(id) => <input id={id} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
        <Field label="Mensaje (opcional)" hint="Se puede cambiar luego en cada foto">
          {(id) => <input id={id} className="input" maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} />}
        </Field>
      </div>
      <Switch checked={skipDuplicates} onChange={setSkipDuplicates} label="Saltar las fotos que ya están en el álbum" />
      {summary && (
        <SummaryCard
          summary={summary}
          onClose={() => setSummary(null)}
          onRetry={() => void start(summary.failures.map((f) => f.file))}
        />
      )}
      {running && tasks.length > 0 && <RomanticLoader tasks={tasks} onCancel={() => uploader.cancelAll()} />}
    </div>
  );
}
