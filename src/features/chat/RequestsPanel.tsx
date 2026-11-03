import { Link } from "react-router-dom";
import { formatRelative } from "@/domain/dates";
import type { ChatContact, ChatPerson, Uuid } from "@/domain/types";
import { useChat } from "./ChatStore";
import { PersonRow } from "./PeoplePanel";

/** Solicitudes recibidas (aceptar o rechazar), enviadas (cancelar) y bloqueos. */
export function RequestsPanel() {
  const chat = useChat();

  const personFor = (userId: Uuid, contact: ChatContact | null, relation: ChatPerson["relation"]): ChatPerson => {
    const p = chat.profiles.get(userId);
    return {
      id: userId, displayName: p?.displayName ?? "Alguien", avatarPath: p?.avatarPath ?? null, avatarEmoji: p?.avatarEmoji ?? null,
      bio: p?.bio ?? "", relation, contactId: contact?.id ?? null,
    };
  };

  const nothing = chat.incoming.length === 0 && chat.outgoing.length === 0 && chat.blocked.length === 0;

  return (
    <div className="requests">
      {nothing && (
        <div className="chat-list__empty">
          <p><strong>No tienes solicitudes</strong></p>
          <p className="muted">Cuando alguien quiera chatear contigo aparecerá aquí, y también te llegará un aviso.</p>
          <Link to="/chat/personas" className="btn btn--sm">Buscar personas</Link>
        </div>
      )}
      {chat.incoming.length > 0 && (
        <section aria-labelledby="sol-recibidas">
          <h2 id="sol-recibidas" className="requests__heading">Recibidas</h2>
          <ul className="people__list">
            {chat.incoming.map((c) => (
              <PersonRow
                key={c.id}
                person={personFor(c.requesterId, c, "incoming")}
                note={c.message ? `“${c.message}”` : `Te escribió ${formatRelative(c.createdAt)}`}
                onChange={() => undefined}
              />
            ))}
          </ul>
        </section>
      )}
      {chat.outgoing.length > 0 && (
        <section aria-labelledby="sol-enviadas">
          <h2 id="sol-enviadas" className="requests__heading">Enviadas</h2>
          <ul className="people__list">
            {chat.outgoing.map((c) => (
              <PersonRow
                key={c.id}
                person={personFor(c.addresseeId, c, "outgoing")}
                note={`Esperando respuesta · ${formatRelative(c.createdAt)}`}
                onChange={() => undefined}
              />
            ))}
          </ul>
        </section>
      )}
      {chat.blocked.length > 0 && (
        <section aria-labelledby="sol-bloqueados">
          <h2 id="sol-bloqueados" className="requests__heading">Bloqueados</h2>
          <ul className="people__list">
            {chat.blocked.map((id) => (
              <PersonRow key={id} person={personFor(id, null, "blocked")} note="No puede escribirte ni encontrarte" onChange={() => undefined} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
