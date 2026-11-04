import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ChatPerson } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Avatar } from "@/ui/Avatar";
import { useConfirm } from "@/ui/useConfirm";
import { useChat } from "./ChatStore";
import { useT } from "@/i18n";

const SEARCH_DEBOUNCE_MS = 250;


/** Buscar personas, mandarles una solicitud o abrir el chat con un contacto. */
export function PeoplePanel() {
  const backend = useBackend();
  const toast = useToast();
  const chat = useChat();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatPerson[] | null>(null);
  const [version, setVersion] = useState(0);
  const statusId = useId();
  const t = useT().chat.people;

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      backend.messaging.searchPeople(query)
        .then((people) => active && setResults(people))
        .catch((error) => active && toast.error(error));
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // Las solicitudes y contactos cambian la relación: se vuelve a buscar.
  }, [backend, toast, query, version, chat.contacts, chat.blocked]);

  return (
    <div className="people">
      <div className="chat-side__search">
        <label htmlFor="buscar-personas" className="visually-hidden">{t.searchLabel}</label>
        <input
          id="buscar-personas" className="input" type="search" placeholder={t.searchLabel} value={query} autoFocus
          onChange={(e) => setQuery(e.target.value)} autoComplete="off" aria-describedby={statusId}
        />
      </div>
      <p id={statusId} className="people__status muted" role="status">
        {results === null ? t.searching : results.length === 0
          ? (query ? t.nobody(query) : t.noOne)
          : query ? t.count(results.length) : t.inApp}
      </p>
      {results && results.length > 0 && (
        <ul className="people__list">
          {results.map((p) => <PersonRow key={p.id} person={p} onChange={() => setVersion((v) => v + 1)} />)}
        </ul>
      )}
    </div>
  );
}

export function PersonRow({ person, onChange, note }: { person: ChatPerson; onChange(): void; note?: string }) {
  const backend = useBackend();
  const toast = useToast();
  const chat = useChat();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const i18n = useT();
  const t = i18n.chat.people;
  const name = person.displayName || i18n.common.someone;

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await action();
      if (done) toast.show({ title: done, tone: "success" });
      await chat.reload();
      onChange();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  const request = () => run(async () => {
    const status = await backend.messaging.requestContact(person.id, message);
    setComposing(false);
    setMessage("");
    if (status === "accepted") {
      const id = await backend.messaging.openDirectChat(person.id);
      await chat.reload();
      navigate(`/chat/${id}`);
    }
  }, t.requestSent);

  const open = () => run(async () => {
    const id = await backend.messaging.openDirectChat(person.id);
    await chat.reload();
    navigate(`/chat/${id}`);
  });

  const accept = () => run(async () => {
    const id = await backend.messaging.respondContact(person.contactId!, true);
    await chat.reload();
    if (id) navigate(`/chat/${id}`);
  }, t.nowCanChat(name));

  const decline = () => run(() => backend.messaging.respondContact(person.contactId!, false), t.declined);

  const cancel = async () => {
    if (await confirm({ title: t.cancelTitle, body: t.cancelBody(name), confirmLabel: t.cancelLabel, danger: true })) {
      await run(() => backend.messaging.removeContact(person.id), t.cancelled);
    }
  };

  const unblock = () => run(() => backend.messaging.unblockUser(person.id), t.unblocked(name));

  const block = async () => {
    if (await confirm({
      title: t.blockTitle(name),
      body: t.blockBody,
      confirmLabel: t.block, danger: true,
    })) {
      await run(() => backend.messaging.blockUser(person.id), t.blocked(name));
    }
  };

  return (
    <li className="person">
      <Avatar person={person} size={44} />
      <div className="person__info">
        <span className="person__name">{name}</span>
        <span className="person__meta muted">
          {note ?? (t.relation[person.relation] || person.bio || " ")}
        </span>
      </div>
      <div className="person__actions">
        {person.relation === "none" && !composing && (
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setComposing(true)} aria-label={t.requestTo(name)}>
            {t.request}
          </button>
        )}
        {person.relation === "outgoing" && (
          <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void cancel()} aria-label={t.cancelTo(name)}>
            {t.cancel}
          </button>
        )}
        {person.relation === "incoming" && person.contactId && (
          <>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void accept()} aria-label={t.acceptTo(name)}>{t.accept}</button>
            <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void decline()} aria-label={t.declineTo(name)}>{t.decline}</button>
            <button type="button" className="btn btn--sm btn--icon btn--ghost" disabled={busy} onClick={() => void block()} aria-label={t.blockTo(name)} title={t.block}>
              <span aria-hidden>⛔</span>
            </button>
          </>
        )}
        {person.relation === "contact" && (
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void open()} aria-label={t.writeTo(name)}>{t.write}</button>
        )}
        {person.relation === "blocked" && (
          <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void unblock()} aria-label={t.unblockTo(name)}>{t.unblock}</button>
        )}
      </div>
      {composing && (
        <form className="person__compose" onSubmit={(e) => { e.preventDefault(); void request(); }}>
          <label htmlFor={`msg-${person.id}`} className="visually-hidden">{t.messageFor(name)}</label>
          <input
            id={`msg-${person.id}`} className="input" maxLength={200} value={message} autoFocus
            placeholder={t.messagePlaceholder(name)} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setComposing(false);
            }}
          />
          <button className="btn btn--sm" disabled={busy}>{t.send}</button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setComposing(false)}>{t.cancel}</button>
        </form>
      )}
      {confirmDialog}
    </li>
  );
}
