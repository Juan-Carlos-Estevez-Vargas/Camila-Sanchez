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
import { useT } from "@/i18n";

type DateMode = "capture" | "fixed";

interface Failure {
  file: File;
  reason: string;
}

interface Summary {
  uploaded: number;
  duplicates: number;
  saved: number;
  lowRes: number;
  failures: Failure[];
}

function SummaryCard({ summary, onRetry, onClose }: { summary: Summary; onRetry(): void; onClose(): void }) {
  const t = useT().admin.upload;
  return (
    <div className={styles.summary} role="status">
      <div className="row-between">
        <strong>{t.summary}</strong>
        <button className="btn btn--icon btn--ghost btn--sm" aria-label={t.closeSummary} onClick={onClose}>×</button>
      </div>
      <div className={styles.stats}>
        {summary.uploaded > 0
          ? <span className="badge badge--success">💖 {t.newPhotos(summary.uploaded)}</span>
          : !summary.failures.length && <span className="badge">{t.allKnown}</span>}
        {summary.lowRes > 0 && <span className="badge badge--warning">⚠️ {t.lowRes(summary.lowRes)}</span>}
        {summary.duplicates > 0 && <span className="badge badge--muted">{t.skipped(summary.duplicates)}</span>}
        {summary.saved > 0 && <span className="badge badge--muted">{t.saved(formatBytes(summary.saved))}</span>}
        {summary.failures.length > 0 && <span className="badge badge--danger">{t.failed(summary.failures.length)}</span>}
      </div>
      {summary.failures.length > 0 && (
        <>
          <ul className={styles.failures}>
            {summary.failures.slice(0, 20).map((f, i) => (
              <li key={i}><span className={styles.fileName}>{f.file.name}</span><span className="muted">{f.reason}</span></li>
            ))}
            {summary.failures.length > 20 && <li className="muted">{t.more(summary.failures.length - 20)}</li>}
          </ul>
          <button className="btn btn--sm" style={{ justifySelf: "start" }} onClick={onRetry}>{t.retry}</button>
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
  const i18n = useT();
  const t = i18n.admin.upload;

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
      toast.show({ title: t.noPhotos, body: t.noPhotosBody, tone: "error" });
      return;
    }
    const { unique, repeated } = dedupeByIdentity(images);
    const batch = unique.slice(0, MAX_BATCH);
    if (unique.length > MAX_BATCH) {
      toast.show({ title: t.firstOnly(MAX_BATCH), body: t.firstOnlyBody, tone: "info" });
    }

    setSummary(null);
    setRunning(true);
    const results = await uploader.enqueue(
      batch.map((file) => ({ file, caption: caption.trim() || undefined, takenOn: dateMode === "fixed" ? date : undefined })),
      { basePosition: (content?.photos.length ?? 0) + 1, knownHashes, skipDuplicates },
    );

    const next: Summary = { uploaded: 0, duplicates: repeated.length, saved: 0, lowRes: 0, failures: [] };
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const cancelled = r.reason instanceof DOMException && r.reason.name === "AbortError";
        next.failures.push({ file: batch[i]!, reason: cancelled ? t.cancelled : toUserMessage(r.reason) });
      } else if (r.value.kind === "duplicate") next.duplicates++;
      else {
        next.uploaded++;
        if (r.value.lowResolution) next.lowRes++;
        next.saved += Math.max(0, r.value.originalBytes - r.value.finalBytes);
      }
    });

    // Deja ver el 100% un instante antes de cerrar.
    await new Promise((r) => setTimeout(r, 900));
    setRunning(false);
    uploader.clearFinished();
    onUploaded();
    if (next.uploaded) toast.success(t.stored(next.uploaded));
    if (results.length > 1 || next.failures.length || next.duplicates || next.lowRes) setSummary(next);
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
      toast.error(error, t.cantReadFolder);
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
        <strong role="status">{preparing ? t.searching : t.drop}</strong>
        <span className="muted">{t.limit(MAX_BATCH)}</span>
        <div className={`row ${styles.pickers}`} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn--sm" onClick={() => filesInput.current?.click()}>{t.pickFiles}</button>
          <button type="button" className="btn btn--sm btn--soft" onClick={() => folderInput.current?.click()}>{t.pickFolder}</button>
        </div>
        <input ref={filesInput} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => void start([...(e.target.files ?? [])])} />
        <input ref={folderInput} type="file" multiple hidden onChange={(e) => void start([...(e.target.files ?? [])])} />
      </div>
      <div className="form-grid">
        <Field label={t.dateLabel}>
          {(id) => (
            <select id={id} className="select" value={dateMode} onChange={(e) => setDateMode(e.target.value as DateMode)}>
              <option value="capture">{t.dateCapture}</option>
              <option value="fixed">{t.dateFixed}</option>
            </select>
          )}
        </Field>
        {dateMode === "fixed" && (
          <Field label={t.when}>
            {(id) => <input id={id} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
        <Field label={i18n.admin.messageOptional} hint={t.captionHint}>
          {(id) => <input id={id} className="input" maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} />}
        </Field>
      </div>
      <Switch checked={skipDuplicates} onChange={setSkipDuplicates} label={t.skipDuplicates} />
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
