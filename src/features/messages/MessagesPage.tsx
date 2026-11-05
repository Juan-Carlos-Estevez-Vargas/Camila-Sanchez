import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatRelative } from "@/domain/dates";
import { NOTE_KINDS, type Interruption, type Note, type NoteKind, type Profile, type Uuid } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useNotifications } from "@/state/NotificationsContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { Modal } from "@/ui/Modal";
import { useAsync } from "@/ui/useAsync";
import { useConfirm } from "@/ui/useConfirm";
import { burst } from "@/features/site/effects/FloatingEffects";
import { EnableNotifications } from "./EnableNotifications";
import "./styles/messages.scss";
import { msg, useT } from "@/i18n";

const NOTE_KIND_ICONS: Record<NoteKind, string> = { love: "💌", apology: "🥺", note: "✉️", surprise: "🎁", reminder: "⏰" };

/** Icono, nombre y texto de ayuda de cada tipo de notita, en el idioma activo. */
function noteKindMeta(kind: NoteKind): { icon: string; label: string; placeholder: string } {
  return { icon: NOTE_KIND_ICONS[kind], ...msg().notes.kinds[kind] };
}

type Tab = "inbox" | "sent" | "write";

/** Lo que sale en la cajita: una notita o una sorpresa recibida. */
type Letter = Note & { surprise?: boolean };

/**
 * Una sorpresa recibida se pinta como un sobre más (🎁). Cuenta como leída
 * cuando ya se vio, aquí o al salir en la página.
 */
function surpriseAsLetter(i: Interruption, me: Uuid, seen: ReadonlySet<Uuid>): Letter {
  return {
    id: i.id,
    senderId: i.createdBy ?? "",
    recipientId: me,
    kind: "surprise",
    title: i.title,
    body: i.body,
    readAt: seen.has(i.id) ? i.startsAt : null,
    createdAt: i.startsAt,
    surprise: true,
  };
}

const TAB_IDS: Tab[] = ["inbox", "sent", "write"];

function Compose({ people, onSent }: { people: Profile[]; onSent(): void }) {
  const backend = useBackend();
  const toast = useToast();
  const [recipientId, setRecipientId] = useState(people[0]?.id ?? "");
  const [kind, setKind] = useState<NoteKind>("love");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT().notes;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !recipientId) return;
    setBusy(true);
    try {
      await backend.messaging.sendNote({ recipientId, kind, title: title.trim(), body: body.trim() });
      burst([noteKindMeta(kind).icon, "💖", "✨"], 24);
      toast.success(t.sent, t.sentBody);
      setTitle("");
      setBody("");
      onSent();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  if (!people.length) return <EmptyState icon="🫂" title={t.noPeople}>{t.noPeopleHint}</EmptyState>;

  return (
    <form className="card stack" onSubmit={send}>
      <div className="kind-picker" role="radiogroup" aria-label={t.kindGroup} onKeyDown={onRovingKeyDown}>
        {NOTE_KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} tabIndex={rovingTabIndex(kind === k)} className={`kind-chip${kind === k ? " is-active" : ""}`} onClick={() => setKind(k)}>
            <span aria-hidden>{noteKindMeta(k).icon}</span> {noteKindMeta(k).label}
          </button>
        ))}
      </div>
      <div className="form-grid">
        {people.length > 1 && (
          <Field label={t.to}>
            {(id) => (
              <select id={id} className="select" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label={t.titleOptional}>{(id) => <input id={id} className="input" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      </div>
      <Field label={people.length === 1 ? t.toPerson(people[0]!.displayName) : t.message} hint={`${body.length}/4000`}>
        {(id) => <textarea id={id} className="textarea" rows={6} maxLength={4000} required placeholder={noteKindMeta(kind).placeholder} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <button className="btn" disabled={busy || !body.trim()}>{busy ? t.sending : t.send(noteKindMeta(kind).icon)}</button>
    </form>
  );
}

function Envelope({ note, from, mine, onOpen, onDelete }: { note: Letter; from: string; mine: boolean; onOpen(): void; onDelete?(): void }) {
  const meta = noteKindMeta(note.kind);
  const unread = !mine && !note.readAt;
  const t = useT().notes;
  return (
    <article className={`envelope card card--interactive${unread ? " is-unread" : ""}`}>
      <button className="envelope__open" onClick={onOpen} aria-label={t.openLabel(unread, mine, from, note.title || meta.label)}>
        <span className="envelope__icon" aria-hidden>{unread ? "💌" : meta.icon}</span>
        <span className="envelope__text">
          <strong>{note.title || meta.label}</strong>
          <span className="muted envelope__meta">{mine ? t.toWho(from) : t.fromWho(from)} · {formatRelative(note.createdAt)}{mine && note.readAt ? t.read : ""}</span>
          {!unread && <span className="envelope__preview">{note.body}</span>}
        </span>
        {unread && <span className="badge">{t.newBadge}</span>}
      </button>
      {onDelete && <button className="btn btn--icon btn--ghost btn--sm envelope__delete" aria-label={t.deleteLabel(note.title || meta.label)} onClick={onDelete}><span aria-hidden>🗑</span></button>}
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
  const [open, setOpen] = useState<Letter | null>(null);
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([
      backend.messaging.listNotes(),
      // Sin los nombres o sin las sorpresas la cajita igual se muestra.
      backend.users.listProfiles().catch(() => [] as Profile[]),
      backend.content.listInterruptions("received").catch(() => [] as Interruption[]),
      backend.content.listSeenInterruptions().catch(() => [] as Uuid[]),
    ]),
    [backend],
  );
  const [notes = [], profiles = [], surprises = [], seenIds = []] = data ?? [];
  const i18n = useT();
  const t = i18n.notes;
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.displayName ?? i18n.common.someone;
  const people = useMemo(() => profiles.filter((p) => p.id !== user?.id && p.isActive), [profiles, user?.id]);
  const inbox = useMemo<Letter[]>(() => {
    if (!user) return [];
    const seen = new Set(seenIds);
    return [...notes.filter((n) => n.recipientId === user.id), ...surprises.map((i) => surpriseAsLetter(i, user.id, seen))]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notes, surprises, seenIds, user]);
  const sent = notes.filter((n) => n.senderId === user?.id);
  const unread = inbox.filter((n) => !n.readAt).length;

  useEffect(() => backend.realtime.subscribe(["notes", "interruptions"], () => void reload()), [backend, reload]);
  // Estando aquí, los avisos de notitas se dan por vistos.
  useEffect(() => void markAllRead("note"), [markAllRead]);

  const openNote = async (note: Letter) => {
    setOpen(note);
    if (note.recipientId === user?.id && !note.readAt) {
      burst([noteKindMeta(note.kind).icon, "💖"], 20);
      // Una sorpresa vista aquí ya no vuelve a salir al abrir la página.
      await (note.surprise ? backend.content.markInterruptionSeen(note.id) : backend.messaging.markNoteRead(note.id))
        .catch(() => undefined);
      void reload();
    }
  };

  const remove = async (note: Letter) => {
    if (!(await confirm({ title: t.confirmDelete, body: t.confirmDeleteBody, confirmLabel: t.deleteButton, danger: true }))) return;
    try {
      await backend.messaging.deleteNote(note.id);
      await reload();
    } catch (error) {
      toast.error(error);
    }
  };

  const list: Letter[] = tab === "inbox" ? inbox : sent;

  return (
    <main id="contenido-principal" className="container messages">
      <header className="messages__header">
        <h1>{t.title}</h1>
        <p className="muted">{t.intro}</p>
      </header>
      <EnableNotifications />
      <div className="tabs" role="tablist" aria-label={t.tablist} data-tour="notes-tabs" onKeyDown={onRovingKeyDown}>
        {TAB_IDS.map((id) => ({ id, label: t.tabs[id] })).map(({ id, label }) => (
          <button key={id} id={`notas-tab-${id}`} role="tab" className="tab" aria-selected={tab === id} aria-controls="notas-panel"
            tabIndex={rovingTabIndex(tab === id)} onClick={() => setTab(id)}>
            {label}
            {id === "inbox" && unread > 0 && <><span className="counter-dot" aria-hidden>{unread}</span><span className="visually-hidden">{t.unread(unread)}</span></>}
          </button>
        ))}
      </div>
      <div id="notas-panel" role="tabpanel" aria-labelledby={`notas-tab-${tab}`}>
      {loading && !data ? <PageLoader /> : !data && error && tab !== "write" ? (
        // Si no se pudo cargar, se dice: una cajita "vacía" haría creer que se perdió todo.
        <EmptyState icon="🥀" title={t.loadError}>
          <button className="btn btn--soft" onClick={() => void reload()}>{t.retry}</button>
        </EmptyState>
      ) : tab === "write" ? (
        <Compose people={people} onSent={() => { void reload(); setTab("sent"); }} />
      ) : list.length === 0 ? (
        <EmptyState icon={tab === "inbox" ? "📭" : "📮"} title={tab === "inbox" ? t.emptyInbox : t.emptySent}>
          <button className="btn btn--soft" onClick={() => setTab("write")}>{t.writeOne}</button>
        </EmptyState>
      ) : (
        <div className="envelopes">
          {list.map((n) => (
            <Envelope key={n.id} note={n} mine={tab === "sent"} from={nameOf(tab === "sent" ? n.recipientId : n.senderId)}
              onOpen={() => void openNote(n)} onDelete={n.surprise ? undefined : () => void remove(n)} />
          ))}
        </div>
      )}
      </div>
      {open && (
        <Modal title={<>{noteKindMeta(open.kind).icon} {open.title || noteKindMeta(open.kind).label}</>} onClose={() => setOpen(null)}>
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
