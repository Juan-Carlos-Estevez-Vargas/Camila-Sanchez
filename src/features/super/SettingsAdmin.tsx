import { useState } from "react";
import { isSafeUrl } from "@/core/validation";
import { validRelationshipEnd } from "@/domain/relationship";
import { TRANSLATABLE, translatableSource } from "@/domain/contentTranslations";
import type { SiteSettings } from "@/domain/types";
import { AdminPage } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { useBackend } from "@/state/BackendContext";
import { useContentStore, useSiteContent } from "@/state/SiteContentStore";
import { PageLoader } from "@/ui/Feedback";
import { Field, Switch } from "@/ui/Field";
import { useT } from "@/i18n";
import { ContentLanguageTabs, TranslationFields, type EditLanguage } from "@/features/admin/ContentLanguage";

type Draft = Pick<SiteSettings, "siteTitle" | "siteSubtitle" | "relationshipStart" | "relationshipEnd" | "isPublic" | "musicUrl" | "translations">;

export default function SettingsAdmin() {
  const backend = useBackend();
  const store = useContentStore();
  const { content } = useSiteContent();
  const { run, busy } = useSaver();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lang, setLang] = useState<EditLanguage>("es");
  const i18n = useT();
  const t = i18n.superAdmin.settings;

  if (!content) return <PageLoader />;
  const s = content.settings;
  const d: Draft = draft ?? {
    siteTitle: s.siteTitle, siteSubtitle: s.siteSubtitle, relationshipStart: s.relationshipStart, relationshipEnd: s.relationshipEnd,
    isPublic: s.isPublic, musicUrl: s.musicUrl, translations: s.translations ?? {},
  };
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });
  const endError = validRelationshipEnd(d) ? null : t.endBeforeStart;
  const musicError = d.musicUrl && !(isSafeUrl(d.musicUrl) && d.musicUrl.startsWith("https://")) ? t.httpsOnly : null;

  const save = async () => {
    const ok = await run(() => backend.content.updateSettings({ ...d, musicUrl: d.musicUrl || null }), t.saved);
    if (ok) {
      setDraft(null);
      store.refresh("settings");
    }
  };

  return (
    <AdminPage title={t.title} description={t.description}
      actions={<button className="btn" disabled={!draft || busy || !!musicError || !!endError || !d.siteTitle.trim()} onClick={save}>{i18n.admin.save}</button>}>
      <div className="card stack">
        <ContentLanguageTabs value={lang} onChange={setLang} source={translatableSource(d, TRANSLATABLE.settings)} translations={d.translations} />
        {lang !== "es" ? (
          <TranslationFields locale={lang} source={translatableSource(d, TRANSLATABLE.settings)} translations={d.translations}
            onChange={(translations) => set({ translations })} />
        ) : (<>
        <div className="form-grid">
          <Field label={t.siteTitle}>{(id) => <input id={id} className="input" maxLength={120} value={d.siteTitle} onChange={(e) => set({ siteTitle: e.target.value })} />}</Field>
          <Field label={t.start} hint={t.startHint}>
            {(id) => <input id={id} type="date" className="input" value={d.relationshipStart ?? ""} onChange={(e) => set({ relationshipStart: e.target.value || null })} />}
          </Field>
          <Field label={t.end} hint={t.endHint} error={endError}>
            {(id) => <input id={id} type="date" className="input" min={d.relationshipStart ?? undefined} value={d.relationshipEnd ?? ""} onChange={(e) => set({ relationshipEnd: e.target.value || null })} />}
          </Field>
        </div>
        <Field label={t.subtitle}>{(id) => <textarea id={id} className="textarea" maxLength={300} value={d.siteSubtitle} onChange={(e) => set({ siteSubtitle: e.target.value })} />}</Field>
        <Field label={t.music} hint={t.musicHint} error={musicError}>
          {(id) => <input id={id} className="input" type="url" placeholder="https://…" value={d.musicUrl ?? ""} onChange={(e) => set({ musicUrl: e.target.value || null })} />}
        </Field>
        </>)}
      </div>
      <div className="card stack">
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{t.privacy}</h2>
        <Switch label={t.public} checked={d.isPublic} onChange={(isPublic) => set({ isPublic })} />
        <p className="muted" style={{ margin: 0 }}>
          {d.isPublic
            ? t.publicOn
            : t.publicOff}
        </p>
      </div>
    </AdminPage>
  );
}
