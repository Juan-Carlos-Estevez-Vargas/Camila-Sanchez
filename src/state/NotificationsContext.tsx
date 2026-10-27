import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toUserMessage } from "@/core/errors";
import { safeNextPath } from "@/core/safeRedirect";
import type { AppNotification } from "@/domain/types";
import { showLocalNotification, syncPushSubscription } from "@/services/notifications/browserNotifications";
import { useAuth } from "./AuthContext";
import { useBackend } from "./BackendContext";
import { useToast } from "./ToastContext";

interface NotificationsState {
  items: AppNotification[];
  unread: number;
  unreadByKind: Record<AppNotification["kind"], number>;
  markRead(id: string): Promise<void>;
  markAllRead(kind?: AppNotification["kind"]): Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);

  const reload = useCallback(async () => {
    if (!user) return setItems([]);
    try {
      setItems(await backend.messaging.listNotifications(40));
    } catch (error) {
      console.warn("[notificaciones]", toUserMessage(error));
    }
  }, [backend, user]);

  // Si este dispositivo ya dio permiso, renueva su suscripción push a nombre
  // de quien entró (por si cambió la clave o la cuenta).
  useEffect(() => {
    if (!user) return;
    syncPushSubscription(backend.push).catch((error) => console.warn("[push]", toUserMessage(error)));
  }, [backend, user]);

  useEffect(() => {
    void reload();
    if (!user) return;
    return backend.realtime.subscribe(["notifications"], (change) => {
      const record = change.record as {
        user_id?: string; userId?: string; title?: string; body?: string; link?: string | null;
        read_at?: string | null; readAt?: string | null; created_at?: string; createdAt?: string;
      } | null;
      const ownerId = record?.user_id ?? record?.userId;
      // Un aviso de chat sin leer se actualiza con cada mensaje nuevo.
      const createdAt = record?.created_at ?? record?.createdAt;
      const refreshed = change.type === "UPDATE" && !(record?.read_at ?? record?.readAt)
        && !!createdAt && Date.now() - new Date(createdAt).getTime() < 15_000;
      if ((change.type === "INSERT" || refreshed) && record && ownerId === user.id) {
        const title = String(record.title ?? "Tienes algo nuevo");
        const body = String(record.body ?? "");
        const link = record.link ? safeNextPath(record.link) : null;
        // En el chat o en la lista que ya se está viendo, el cambio se ve solo.
        const alreadyHere = (link === "/chat" || !!link?.startsWith("/listas/")) && link === window.location.pathname;
        if (!alreadyHere) {
          toast.show({ title, body, action: link ? { label: "Ver", onClick: () => navigate(link) } : undefined });
          void showLocalNotification(title, body, link);
        }
      }
      void reload();
    });
  }, [backend, user, reload, toast, navigate]);

  const value = useMemo<NotificationsState>(() => {
    const unreadByKind = { note: 0, chat: 0, system: 0, list: 0 };
    for (const n of items) if (!n.readAt && n.kind in unreadByKind) unreadByKind[n.kind]++;
    return {
      items,
      unread: items.filter((n) => !n.readAt).length,
      unreadByKind,
      markRead: async (id) => {
        await backend.messaging.markNotificationRead(id);
        await reload();
      },
      markAllRead: async (kind) => {
        if (!items.some((n) => !n.readAt && (!kind || n.kind === kind))) return;
        await backend.messaging.markAllNotificationsRead(kind);
        await reload();
      },
    };
  }, [backend, items, reload]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de <NotificationsProvider>");
  return ctx;
}
