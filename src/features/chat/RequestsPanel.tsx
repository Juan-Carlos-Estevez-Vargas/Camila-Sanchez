import { Link } from "react-router-dom";
import { formatRelative } from "@/domain/dates";
import type { ChatContact, ChatPerson, Uuid } from "@/domain/types";
import { useChat } from "./ChatStore";
import { PersonRow } from "./PeoplePanel";
import { useT } from "@/i18n";

/** Solicitudes recibidas (aceptar o rechazar), enviadas (cancelar) y bloqueos. */
export function RequestsPanel() {
  const chat = useChat();
  const i18n = useT();
  const t = i18n.chat.requests;

  const personFor = (userId: Uuid, contact: ChatContact | null, relation: ChatPerson["relation"]): ChatPerson => {
    const p = chat.profiles.get(userId);
    return {
      id: userId, displayName: p?.displayName ?? i18n.common.someone, avatarPath: p?.avatarPath ?? null, avatarEmoji: p?.avatarEmoji ?? null,
      bio: p?.bio ?? "", relation, contactId: contact?.id ?? null,
    };
  };

  const nothing = chat.incoming.length === 0 && chat.outgoing.length === 0 && chat.blocked.length === 0;

  return (
    <div className="requests">
      {nothing && (
        <div className="chat-list__empty">
          <p><strong>{t.none}</strong></p>
          <p className="muted">{t.noneHint}</p>
          <Link to="/chat/personas" className="btn btn--sm">{i18n.chat.app.findPeople}</Link>
        </div>
      )}
      {chat.incoming.length > 0 && (
        <section aria-labelledby="sol-recibidas">
          <h2 id="sol-recibidas" className="requests__heading">{t.received}</h2>
          <ul className="people__list">
            {chat.incoming.map((c) => (
              <PersonRow
                key={c.id}
                person={personFor(c.requesterId, c, "incoming")}
                note={c.message ? `“${c.message}”` : t.wroteYou(formatRelative(c.createdAt))}
                onChange={() => undefined}
              />
            ))}
          </ul>
        </section>
      )}
      {chat.outgoing.length > 0 && (
        <section aria-labelledby="sol-enviadas">
          <h2 id="sol-enviadas" className="requests__heading">{t.sent}</h2>
          <ul className="people__list">
            {chat.outgoing.map((c) => (
              <PersonRow
                key={c.id}
                person={personFor(c.addresseeId, c, "outgoing")}
                note={t.waiting(formatRelative(c.createdAt))}
                onChange={() => undefined}
              />
            ))}
          </ul>
        </section>
      )}
      {chat.blocked.length > 0 && (
        <section aria-labelledby="sol-bloqueados">
          <h2 id="sol-bloqueados" className="requests__heading">{t.blocked}</h2>
          <ul className="people__list">
            {chat.blocked.map((id) => (
              <PersonRow key={id} person={personFor(id, null, "blocked")} note={t.blockedNote} onChange={() => undefined} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
