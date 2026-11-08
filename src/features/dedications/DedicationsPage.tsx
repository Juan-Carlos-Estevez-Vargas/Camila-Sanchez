/**
 * /dedicatorias: las dedicatorias que veo (todas, recibidas o enviadas) y,
 * en /dedicatorias/playlist, todas sus canciones juntas.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { filterDedications, sortDedications, type DedicationFilter } from "@/domain/dedications";
import { formatLongDate } from "@/domain/dates";
import { buildPlaylist } from "@/domain/songs";
import type { DedicationWithMedia } from "@/domain/types";
import { useT } from "@/i18n";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { useAsync } from "@/ui/useAsync";
import { toPlayerTracks, usePlayer } from "@/features/player/PlayerContext";
import { NewDedicationModal } from "./DedicationForm";
import { PlaylistPanel } from "./PlaylistPanel";
import { useDedicationMedia, usePeopleNames, useRecipients } from "./parts";
import "./styles/dedications.scss";

export const DEDICATION_TABLES = ["dedications", "dedication_photos", "dedication_songs"] as const;

const FILTERS: DedicationFilter[] = ["all", "received", "sent"];

function DedicationCard({ item, fromTo, cover }: { item: DedicationWithMedia; fromTo: string; cover?: string }) {
  const t = useT().dedications;
  const player = usePlayer();
  const { dedication, photos, songs } = item;
  const counts = t.counts(photos.length, songs.length);
  return (
    <article className="dedication-card card">
      <Link to={`/dedicatorias/${dedication.id}`} className="dedication-card__link">
        <span className={`dedication-card__cover${cover ? " has-photo" : ""}`} aria-hidden>
          {cover ? <img src={cover} alt="" loading="lazy" /> : <span>{dedication.emoji}</span>}
        </span>
        <span className="dedication-card__body">
          <strong className="dedication-card__title">{dedication.emoji} {dedication.title}</strong>
          <span className="muted dedication-card__meta">{fromTo}</span>
          <span className="muted dedication-card__meta">{formatLongDate(dedication.dedicatedOn)}{counts && ` · ${counts}`}</span>
          {dedication.message && <span className="dedication-card__excerpt">{dedication.message}</span>}
        </span>
      </Link>
      {songs.length > 0 && (
        <button type="button" className="btn btn--sm btn--soft dedication-card__play" aria-label={t.playTheseLabel(dedication.title)}
          onClick={() => player.play(toPlayerTracks(buildPlaylist([item])), 0, { shuffle: false })}>
          {t.playThese}
        </button>
      )}
    </article>
  );
}

export default function DedicationsPage({ tab = "dedications" }: { tab?: "dedications" | "playlist" }) {
  const backend = useBackend();
  const { user } = useAuth();
  const i18n = useT();
  const t = i18n.dedications;
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<DedicationFilter>("all");
  const { data, loading, reload } = useAsync(
    () => Promise.all([backend.dedications.list(), backend.users.listProfiles(), backend.users.listRolePermissions()]),
    [backend],
  );
  const [items = [], profiles = [], rolePermissions = []] = data ?? [];
  const people = useRecipients(profiles, rolePermissions);
  const { fromTo } = usePeopleNames(profiles);
  const sorted = useMemo(() => sortDedications(items), [items]);
  const shown = useMemo(() => filterDedications(sorted, filter, user?.id ?? null), [sorted, filter, user?.id]);
  const songCount = items.reduce((n, i) => n + i.songs.length, 0);
  const covers = useDedicationMedia(shown.flatMap((i) => (i.photos[0] ? [i.photos[0].thumbPath] : [])));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = backend.realtime.subscribe([...DEDICATION_TABLES], () => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 250);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [backend, reload]);

  return (
    <main id="contenido-principal" className="container dedications">
      <header className="dedications__header row-between">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
        <button className="btn" data-tour="dedications-new" onClick={() => setCreating(true)}>{t.newButton}</button>
      </header>

      <nav className="tabs dedications__tabs" aria-label={t.tabs.label} data-tour="dedications-tabs">
        <NavLink to="/dedicatorias" end className="tab">{t.tabs.dedications}</NavLink>
        <NavLink to="/dedicatorias/playlist" className="tab">{t.tabs.playlist(songCount)}</NavLink>
      </nav>

      {loading && !data ? <PageLoader /> : tab === "playlist" ? (
        <PlaylistPanel items={items} people={people} onChanged={() => void reload()} />
      ) : items.length === 0 ? (
        <EmptyState icon="💌" title={t.empty}>
          <p className="muted">{t.emptyHint}</p>
          <button className="btn btn--soft" onClick={() => setCreating(true)}>{t.createFirst}</button>
        </EmptyState>
      ) : (
        <>
          <div className="tabs" role="radiogroup" aria-label={t.filters.label} onKeyDown={onRovingKeyDown}>
            {FILTERS.map((f) => (
              <button key={f} type="button" role="radio" className="tab" aria-checked={filter === f} tabIndex={rovingTabIndex(filter === f)}
                onClick={() => setFilter(f)}>{t.filters[f]}</button>
            ))}
          </div>
          {shown.length === 0 ? <p className="muted">{t.emptyFiltered}</p> : (
            <div className="dedication-grid">
              {shown.map((item) => (
                <DedicationCard key={item.dedication.id} item={item} fromTo={fromTo(item.dedication)}
                  cover={item.photos[0] ? covers.get(item.photos[0].thumbPath) : undefined} />
              ))}
            </div>
          )}
        </>
      )}
      {creating && <NewDedicationModal people={people} onClose={() => setCreating(false)} />}
    </main>
  );
}
