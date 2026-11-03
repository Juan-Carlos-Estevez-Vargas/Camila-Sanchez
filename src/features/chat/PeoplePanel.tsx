import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ChatPerson } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Avatar } from "@/ui/Avatar";
import { useConfirm } from "@/ui/useConfirm";
import { useChat } from "./ChatStore";

const SEARCH_DEBOUNCE_MS = 250;

const RELATION_LABEL: Record<ChatPerson["relation"], string> = {
  none: "",
  outgoing: "Solicitud enviada",
  incoming: "Te pidió chatear",
  contact: "Contacto",
  blocked: "Bloqueado",
};

/** Buscar personas, mandarles una solicitud o abrir el chat con un contacto. */
export function PeoplePanel() {
  const backend = useBackend();
  const toast = useToast();
  const chat = useChat();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatPerson[] | null>(null);
  const [version, setVersion] = useState(0);
  const statusId = useId();

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
        <label htmlFor="buscar-personas" className="visually-hidden">Buscar personas por nombre</label>
        <input
          id="buscar-personas" className="input" type="search" placeholder="Buscar personas por nombre" value={query} autoFocus
          onChange={(e) => setQuery(e.target.value)} autoComplete="off" aria-describedby={statusId}
        />
      </div>
      <p id={statusId} className="people__status muted" role="status">
        {results === null ? "Buscando…" : results.length === 0
          ? (query ? `Nadie se llama «${query}».` : "Todavía no hay más personas en la app.")
          : query ? `${results.length} ${results.length === 1 ? "persona" : "personas"}` : "Personas en la app"}
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
  const name = person.displayName || "Alguien";

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
  }, "Solicitud enviada 💌");

  const open = () => run(async () => {
    const id = await backend.messaging.openDirectChat(person.id);
    await chat.reload();
    navigate(`/chat/${id}`);
  });

  const accept = () => run(async () => {
    const id = await backend.messaging.respondContact(person.contactId!, true);
    await chat.reload();
    if (id) navigate(`/chat/${id}`);
  }, `Ahora puedes chatear con ${name} 🎉`);

  const decline = () => run(() => backend.messaging.respondContact(person.contactId!, false), "Solicitud rechazada");

  const cancel = async () => {
    if (await confirm({ title: "¿Cancelar la solicitud?", body: `${name} ya no la verá.`, confirmLabel: "Cancelar solicitud", danger: true })) {
      await run(() => backend.messaging.removeContact(person.id), "Solicitud cancelada");
    }
  };

  const unblock = () => run(() => backend.messaging.unblockUser(person.id), `Desbloqueaste a ${name}`);

  const block = async () => {
    if (await confirm({
      title: `¿Bloquear a ${name}?`,
      body: "No podrá escribirte, mandarte solicitudes ni encontrarte en la búsqueda.",
      confirmLabel: "Bloquear", danger: true,
    })) {
      await run(() => backend.messaging.blockUser(person.id), `Bloqueaste a ${name}`);
    }
  };

  return (
    <li className="person">
      <Avatar person={person} size={44} />
      <div className="person__info">
        <span className="person__name">{name}</span>
        <span className="person__meta muted">
          {note ?? (RELATION_LABEL[person.relation] || person.bio || " ")}
        </span>
      </div>
      <div className="person__actions">
        {person.relation === "none" && !composing && (
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setComposing(true)} aria-label={`Enviar solicitud a ${name}`}>
            Solicitar
          </button>
        )}
        {person.relation === "outgoing" && (
          <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void cancel()} aria-label={`Cancelar la solicitud a ${name}`}>
            Cancelar
          </button>
        )}
        {person.relation === "incoming" && person.contactId && (
          <>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void accept()} aria-label={`Aceptar a ${name}`}>Aceptar</button>
            <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void decline()} aria-label={`Rechazar a ${name}`}>Rechazar</button>
            <button type="button" className="btn btn--sm btn--icon btn--ghost" disabled={busy} onClick={() => void block()} aria-label={`Bloquear a ${name}`} title="Bloquear">
              <span aria-hidden>⛔</span>
            </button>
          </>
        )}
        {person.relation === "contact" && (
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void open()} aria-label={`Escribirle a ${name}`}>Escribir</button>
        )}
        {person.relation === "blocked" && (
          <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void unblock()} aria-label={`Desbloquear a ${name}`}>Desbloquear</button>
        )}
      </div>
      {composing && (
        <form className="person__compose" onSubmit={(e) => { e.preventDefault(); void request(); }}>
          <label htmlFor={`msg-${person.id}`} className="visually-hidden">Mensaje para {name} (opcional)</label>
          <input
            id={`msg-${person.id}`} className="input" maxLength={200} value={message} autoFocus
            placeholder={`Hola ${name}, ¿chateamos? (opcional)`} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setComposing(false);
            }}
          />
          <button className="btn btn--sm" disabled={busy}>Enviar</button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setComposing(false)}>Cancelar</button>
        </form>
      )}
      {confirmDialog}
    </li>
  );
}
