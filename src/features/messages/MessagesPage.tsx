import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatRelative } from "@/domain/dates";
import { NOTE_KINDS, type Note, type NoteKind, type Profile } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { useConfirm } from "@/ui/useConfirm";
import { burst } from "@/features/site/effects/FloatingEffects";
import { EnableNotifications } from "./EnableNotifications";
import "@/styles/messages.css";

export const NOTE_KIND_META: Record<NoteKind, { icon: string; label: string; placeholder: string }> = {
  love: { icon: "💌", label: "Te amo", placeholder: "Hoy te quiero decir que…" },
  apology: { icon: "🥺", label: "Perdón", placeholder: "Quiero pedirte perdón por…" },
  note: { icon: "✉️", label: "Notita", placeholder: "Solo pasaba a decirte…" },
  surprise: { icon: "🎁", label: "Sorpresa", placeholder: "Tengo algo para ti…" },
  reminder: { icon: "⏰", label: "Recordatorio", placeholder: "No olvides que…" },
};

type Tab = "inbox" | "sent" | "write";

function Compose({ people, onSent }: { people: Profile[]; onSent(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const [recipientId, setRecipientId] = useState(people[0]?.id ?? "");
  const [kind, setKind] = useState<NoteKind>("love");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !recipientId) return;
    setBusy(true);
    try {
      await backend.messaging.sendNote({ recipientId, kind, title: title.trim(), body: body.trim() });
      burst([NOTE_KIND_META[kind].icon, "💖", "✨"], 24);
      toast.success("Notita enviada 💌", "Le llegará un aviso al instante.");
      setTitle("");
      setBody("");
      onSent();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  if (!people.length) return <EmptyState icon="🫂" title="Aún no hay a quién escribirle">El administrador debe crear otra cuenta.</EmptyState>;

  return (
    <form className="card stack" onSubmit={send}>
      <div className="kind-picker" role="radiogroup" aria-label="Tipo de notita">
        {NOTE_KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={`kind-chip${kind === k ? " is-active" : ""}`} onClick={() => setKind(k)}>
            <span aria-hidden>{NOTE_KIND_META[k].icon}</span> {NOTE_KIND_META[k].label}
          </button>
        ))}
      </div>
      <div className="form-grid">
        {people.length > 1 && (
          <Field label="Para">
            {(id) => (
              <select id={id} className="select" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label="Título (opcional)">{(id) => <input id={id} className="input" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      </div>
      <Field label={people.length === 1 ? `Para ${people[0]!.displayName}` : "Mensaje"} hint={`${body.length}/4000`}>
        {(id) => <textarea id={id} className="textarea" rows={6} maxLength={4000} required placeholder={NOTE_KIND_META[kind].placeholder} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <button className="btn" disabled={busy || !body.trim()}>{busy ? "Enviando…" : `Enviar ${NOTE_KIND_META[kind].icon}`}</button>
    </form>
  );
}

function Envelope({ note, from, mine, onOpen, onDelete }: { note: Note; from: string; mine: boolean; onOpen(): void; onDelete(): void }) {
  const meta = NOTE_KIND_META[note.kind];
  const unread = !mine && !note.readAt;
  return (
    <article className={`envelope card card--interactive${unread ? " is-unread" : ""}`}>
      <button className="envelope__open" onClick={onOpen} aria-label={`Abrir notita de ${from}`}>
        <span className="envelope__icon" aria-hidden>{unread ? "💌" : meta.icon}</span>
        <span className="grow">
          <strong>{note.title || meta.label}</strong>
          <span className="muted envelope__meta">{mine ? `Para ${from}` : `De ${from}`} · {formatRelative(note.createdAt)}{mine && note.readAt ? " · leída ✓" : ""}</span>
          {!unread && <span className="envelope__preview">{note.body}</span>}
        </span>
        {unread && <span className="badge">Nueva</span>}
      </button>
      <button className="btn btn--icon btn--ghost btn--sm" aria-label="Borrar notita" onClick={onDelete}>🗑</button>
    </article>
  );
}

export default function MessagesPage() {
  const backend = useBackend();
  const { user } = useAuth();
  const { markAllRead } = useNotifications();
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();
  const [tab, setTab] = useState<Tab>("inbox");
  const [open, setOpen] = useState<Note | null>(null);
  const { data, loading, reload } = useAsync(
    () => Promise.all([backend.messaging.listNotes(), backend.users.listProfiles()]),
    [backend],
  );
  const [notes = [], profiles = []] = data ?? [];
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.displayName ?? "Alguien";
  const people = useMemo(() => profiles.filter((p) => p.id !== user?.id && p.isActive), [profiles, user?.id]);
  const inbox = notes.filter((n) => n.recipientId === user?.id);
  const sent = notes.filter((n) => n.senderId === user?.id);
  const unread = inbox.filter((n) => !n.readAt).length;

  useEffect(() => backend.realtime.subscribe(["notes"], () => void reload()), [backend, reload]);
  // Estando aquí, los avisos de notitas se dan por vistos.
  useEffect(() => void markAllRead("note"), [markAllRead]);

  const openNote = async (note: Note) => {
    setOpen(note);
    if (note.recipientId === user?.id && !note.readAt) {
      burst([NOTE_KIND_META[note.kind].icon, "💖"], 20);
      await backend.messaging.markNoteRead(note.id).catch(() => undefined);
      void reload();
    }
  };

  const remove = async (note: Note) => {
    if (!(await confirm({ title: "¿Borrar esta notita?", body: "Se borra para los dos.", confirmLabel: "Borrar", danger: true }))) return;
    try {
      await backend.messaging.deleteNote(note.id);
      await reload();
    } catch (error) {
      toast.error(error);
    }
  };

  const list = tab === "inbox" ? inbox : sent;

  return (
    <main id="contenido-principal" className="container messages">
      <header className="messages__header">
        <h1>Cajita de mensajes</h1>
        <p className="muted">Notitas, perdones, “te amo” y sorpresas. Les llega un aviso al instante.</p>
      </header>
      <EnableNotifications />
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={tab === "inbox"} onClick={() => setTab("inbox")}>Recibidas {unread > 0 && <span className="counter-dot">{unread}</span>}</button>
        <button role="tab" className="tab" aria-selected={tab === "sent"} onClick={() => setTab("sent")}>Enviadas</button>
        <button role="tab" className="tab" aria-selected={tab === "write"} onClick={() => setTab("write")}>✍️ Escribir</button>
      </div>
      {loading && !data ? <PageLoader /> : tab === "write" ? (
        <Compose people={people} onSent={() => { void reload(); setTab("sent"); }} />
      ) : list.length === 0 ? (
        <EmptyState icon={tab === "inbox" ? "📭" : "📮"} title={tab === "inbox" ? "Tu cajita está vacía por ahora" : "Aún no has enviado notitas"}>
          <button className="btn btn--soft" onClick={() => setTab("write")}>Escribir una</button>
        </EmptyState>
      ) : (
        <div className="list">
          {list.map((n) => (
            <Envelope key={n.id} note={n} mine={tab === "sent"} from={nameOf(tab === "sent" ? n.recipientId : n.senderId)}
              onOpen={() => void openNote(n)} onDelete={() => void remove(n)} />
          ))}
        </div>
      )}
      {open && (
        <Modal title={<>{NOTE_KIND_META[open.kind].icon} {open.title || NOTE_KIND_META[open.kind].label}</>} onClose={() => setOpen(null)}>
          <div className="letter-paper">
            {open.body.split("\n").map((line, i) => <p key={i}>{line}</p>)}
            <p className="letter-paper__from">— {nameOf(open.senderId)}, {formatRelative(open.createdAt)}</p>
          </div>
        </Modal>
      )}
      {confirmElement}
    </main>
  );
}
