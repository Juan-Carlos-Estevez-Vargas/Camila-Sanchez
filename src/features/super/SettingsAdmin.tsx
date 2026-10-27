import { useState } from "react";
import { isSafeUrl } from "@/core/validation";
import type { SiteSettings } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { PageLoader } from "@/ui/Feedback";
import { Field, Switch } from "@/ui/Field";

type Draft = Pick<SiteSettings, "siteTitle" | "siteSubtitle" | "relationshipStart" | "isPublic" | "musicUrl">;

export default function SettingsAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [draft, setDraft] = useState<Draft | null>(null);

  if (!content) return <PageLoader />;
  const s = content.settings;
  const d: Draft = draft ?? {
    siteTitle: s.siteTitle, siteSubtitle: s.siteSubtitle, relationshipStart: s.relationshipStart,
    isPublic: s.isPublic, musicUrl: s.musicUrl,
  };
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });
  const musicError = d.musicUrl && !(isSafeUrl(d.musicUrl) && d.musicUrl.startsWith("https://")) ? "Debe ser un enlace https://" : null;

  const save = async () => {
    const ok = await run(() => backend.content.updateSettings({ ...d, musicUrl: d.musicUrl || null }), "Ajustes guardados");
    if (ok) {
      setDraft(null);
      store.refresh("settings");
    }
  };

  return (
    <AdminPage title="Ajustes del sitio" description="Datos generales y privacidad."
      actions={<button className="btn" disabled={!draft || busy || !!musicError || !d.siteTitle.trim()} onClick={save}>Guardar</button>}>
      <div className="card stack">
        <div className="form-grid">
          <Field label="Título del sitio">{(id) => <input id={id} className="input" maxLength={120} value={d.siteTitle} onChange={(e) => set({ siteTitle: e.target.value })} />}</Field>
          <Field label="Fecha en que empezó todo" hint="La usa el contador de “tiempo juntos”">
            {(id) => <input id={id} type="date" className="input" value={d.relationshipStart ?? ""} onChange={(e) => set({ relationshipStart: e.target.value || null })} />}
          </Field>
        </div>
        <Field label="Subtítulo">{(id) => <textarea id={id} className="textarea" maxLength={300} value={d.siteSubtitle} onChange={(e) => set({ siteSubtitle: e.target.value })} />}</Field>
        <Field label="Música de fondo (opcional)" hint="Enlace https a un archivo .mp3. Sólo suena si se activa con el botón ♪." error={musicError}>
          {(id) => <input id={id} className="input" type="url" placeholder="https://…" value={d.musicUrl ?? ""} onChange={(e) => set({ musicUrl: e.target.value || null })} />}
        </Field>
      </div>
      <div className="card stack">
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Privacidad</h2>
        <Switch label="Cualquiera con el enlace puede ver la página" checked={d.isPublic} onChange={(isPublic) => set({ isPublic })} />
        <p className="muted" style={{ margin: 0 }}>
          {d.isPublic
            ? "La página y las fotos se ven sin iniciar sesión. Los mensajes y el chat siempre son privados."
            : "Sólo las cuentas con el permiso “Ver el sitio” pueden ver la página y las fotos (recomendado)."}
        </p>
      </div>
    </AdminPage>
  );
}
