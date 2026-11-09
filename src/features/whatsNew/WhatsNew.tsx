/**
 * Novedades después de una actualización: muestra lo que la persona no ha
 * visto de las funciones que puede usar y, con «Ver cómo funciona», la lleva
 * a la página de la función con su tutorial. También se abre a mano desde el
 * pie de página con toda la historia.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { config } from "@/core/config";
import { formatLongDate } from "@/domain/dates";
import { latestRelease, pendingReleases, RELEASES, visibleRelease, type Novelty, type Release } from "@/domain/whatsNew";
import { useT } from "@/i18n";
import { useAuth } from "@/state/AuthContext";
import { Modal } from "@/ui/Modal";
import { requestTour } from "@/features/tour/tourRequest";
import { hasPageTour } from "@/features/tour/tourSteps";
import { closeWhatsNew, markReleaseSeen, readSeenRelease, useWhatsNewOpen } from "./whatsNewStore";
import "./whatsNew.scss";

interface ReleaseText {
  news: Record<string, { title: string; body: string } | undefined>;
  changes: string[];
}

export function WhatsNew() {
  const { user, profile, policy } = useAuth();
  const navigate = useNavigate();
  const t = useT().whatsNew;
  const texts = t.releases as Record<string, ReleaseText | undefined>;
  const manual = useWhatsNewOpen();
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const userId = user?.id;

  const visible = useMemo(
    () => RELEASES.map((r) => visibleRelease(r, (p) => policy.can(p))).filter((r) => r.news.length > 0),
    [policy],
  );

  const createdAt = profile?.createdAt;
  const unseen = useMemo(
    () => (userId && createdAt ? pendingReleases(RELEASES, { lastSeen: readSeenRelease(userId), accountCreatedAt: createdAt }) : []),
    [userId, createdAt],
  );
  const pending = useMemo(() => {
    const ids = new Set(unseen.map((r) => r.id));
    return visible.filter((r) => ids.has(r.id));
  }, [unseen, visible]);

  useEffect(() => {
    setDismissed(false);
    setShowAll(false);
    // Cuenta nueva: ya conoció la app así; las novedades cuentan desde aquí.
    if (userId && createdAt && unseen.length === 0 && !readSeenRelease(userId)) markReleaseSeen(userId, latestRelease());
  }, [userId, createdAt, unseen]);

  const auto = !dismissed && pending.length > 0;
  if (!userId || (!auto && !manual)) return null;
  const history = manual || showAll;
  const list = history ? visible : pending;

  const close = () => {
    markReleaseSeen(userId, latestRelease());
    setDismissed(true);
    setShowAll(false);
    closeWhatsNew();
  };

  const tour = (novelty: Novelty, text: { title: string; body: string }) => {
    close();
    requestTour({ path: novelty.tour!, intro: text });
    navigate(novelty.tour!);
  };

  const canTour = (novelty: Novelty) =>
    Boolean(novelty.tour) && hasPageTour({ pathname: novelty.tour!, loggedIn: true, policy });

  const version = config.appVersion === "dev" ? null : config.appVersion;
  const footer = (
    <>
      {!history && visible.length > pending.length && (
        <button type="button" className="btn btn--ghost" onClick={() => setShowAll(true)}>{t.showHistory}</button>
      )}
      <button type="button" className="btn" onClick={close}>{t.close}</button>
    </>
  );

  return (
    <Modal title={t.title} onClose={close} footer={footer} wide>
      <div className="whats-new stack">
        <p className="muted whats-new__intro">
          {version && <span className="whats-new__version">{t.version(version)}</span>}
          {history ? t.historyIntro : t.intro}
        </p>
        {list.map((release: Release) => {
          const text = texts[release.id];
          return (
            <section key={release.id} className="whats-new__release stack" aria-labelledby={`release-${release.id}`}>
              <h3 id={`release-${release.id}`} className="whats-new__date">{formatLongDate(release.id)}</h3>
              <ul className="whats-new__news">
                {release.news.map((novelty) => {
                  const item = text?.news[novelty.id];
                  if (!item) return null;
                  return (
                    <li key={novelty.id} className="whats-new__item card">
                      <span className="whats-new__icon" aria-hidden>{novelty.icon}</span>
                      <div className="whats-new__body">
                        <h4>{item.title}</h4>
                        <p>{item.body}</p>
                        {canTour(novelty) && (
                          <button type="button" className="btn btn--sm btn--soft" onClick={() => tour(novelty, item)}>
                            {t.showTour} →
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {text && text.changes.length > 0 && (
                <div className="whats-new__changes">
                  <h4>{t.also}</h4>
                  <ul>{text.changes.map((change) => <li key={change}>{change}</li>)}</ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
