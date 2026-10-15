import { useState } from "react";
import { SECTION_KIND_LABELS } from "@/domain/defaults";
import type { Section } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { Modal } from "@/ui/Modal";
import { AdminPage } from "./AdminLayout";
import { ANIMATION_LABELS, SectionEditor } from "./SectionEditor";
import { useSaver } from "./useSaver";

/** Panel de Camila: editar textos, tarjetas, carta y animaciones. */
export default function TextsAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [editing, setEditing] = useState<Section | null>(null);

  return (
    <AdminPage title="Textos y animaciones" description="Cambia lo que dice cada parte de la página y cómo aparece.">
      <div className="list">
        {content?.sections.map((section) => {
          const meta = SECTION_KIND_LABELS[section.kind];
          return (
            <button key={section.id} className="list__item card card--interactive" onClick={() => setEditing(section)}>
              <span className="list__icon" aria-hidden>{meta.icon}</span>
              <span className="grow" style={{ textAlign: "left" }}>
                <strong>{section.title || meta.label}</strong>
                <span className="muted list__sub">{meta.label} · {ANIMATION_LABELS[section.animation]}{section.isVisible ? "" : " · oculta"}</span>
              </span>
              <span aria-hidden>✎</span>
            </button>
          );
        })}
      </div>
      {editing && (
        <Modal wide title="Editar sección" onClose={() => setEditing(null)}>
          <SectionEditor
            section={editing}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={async (draft) => {
              const saved = await run(() => backend.content.saveSection(draft), "Sección guardada 💖");
              if (saved) {
                setEditing(null);
                store.refresh("sections");
              }
            }}
          />
        </Modal>
      )}
    </AdminPage>
  );
}
