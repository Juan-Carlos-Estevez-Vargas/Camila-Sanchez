import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useSiteContent } from "@/state/SiteContentStore";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { FloatingEffects } from "./effects/FloatingEffects";
import { Reveal } from "./effects/Reveal";
import { InterruptionHost } from "./InterruptionHost";
import { MusicToggle } from "./MusicToggle";
import { renderSection } from "./sections/registry";

export default function SitePage() {
  const { status, content, photoUrls } = useSiteContent();
  const { user, policy } = useAuth();

  if (status === "loading" || !content) return <PageLoader />;
  if (status === "error") {
    return <EmptyState icon="🥀" title="No pude cargar nuestros recuerdos">Revisa tu conexión y recarga la página.</EmptyState>;
  }

  const sections = content.sections.filter((s) => s.isVisible);
  const isPrivate = !content.settings.isPublic && !policy.can("site.view");

  if (isPrivate) {
    return (
      <main className="gate">
        <div className="gate__card card">
          <div className="gate__heart" aria-hidden>💌</div>
          <h1>{content.settings.siteTitle}</h1>
          <p className="muted">Este rincón es privado. Entra con tu cuenta para ver lo que te preparé.</p>
          {user ? (
            <p className="muted">Tu cuenta todavía no tiene acceso. Pídele permiso al administrador.</p>
          ) : (
            <Link className="btn" to="/entrar">Entrar</Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
      <FloatingEffects effects={content.settings.effects} />
      <InterruptionHost items={content.interruptions} />
      <main id="contenido-principal" className="site">
        {sections.length === 0 && <EmptyState title="Aún no hay secciones">Agrégalas desde el panel de administración.</EmptyState>}
        {sections.map((section, index) => (
          <Reveal
            key={section.id}
            animation={section.animation}
            id={index === 1 ? "contenido" : undefined}
            className={`site-section site-section--${section.kind}`}
          >
            {renderSection(section, content, photoUrls)}
          </Reveal>
        ))}
      </main>
      <footer className="site-footer">
        <p>Hecho con 💖 para ti</p>
      </footer>
      {content.settings.musicUrl && <MusicToggle url={content.settings.musicUrl} />}
    </>
  );
}
