/**
 * Dedicatorias del modo demo, con las mismas reglas que la migración 022 de
 * Supabase: quién ve qué, sólo quien la escribió la cambia, avisos a quien va
 * dirigida y fotos y audios guardados en IndexedDB.
 */
import { del as idbDel, set as idbSet } from "idb-keyval";
import { AppError } from "@/core/errors";
import { canSeeDedication, MAX_DEDICATION_PHOTOS, MAX_DEDICATION_SONGS } from "@/domain/dedications";
import { AUDIO_TYPES, bySongPosition, MAX_AUDIO_BYTES, parseSongLink, type AudioExtension } from "@/domain/songs";
import { toIsoDate } from "@/domain/dates";
import type { AppNotification, Dedication, DedicationPhoto, DedicationSong, DedicationView, DedicationWithMedia, Uuid } from "@/domain/types";
import type { DedicationInput, DedicationsRepository, RealtimeChange } from "@/data/ports";

export interface DemoDedicationsState {
  dedications: Dedication[];
  dedicationPhotos: DedicationPhoto[];
  dedicationSongs: DedicationSong[];
  dedicationViews: DedicationView[];
}

export interface DemoDedicationsDeps {
  state(): DemoDedicationsState;
  commit(change: Omit<RealtimeChange, "old"> & { old?: RealtimeChange["old"] }): void;
  /** Quien tiene la sesión, si puede usar dedicatorias (si no, lanza). */
  me(): { id: Uuid; displayName: string };
  canUse(userId: Uuid): boolean;
  /** Personas activas (para avisar a todos en las «para todos»). */
  people(): Uuid[];
  notify(userId: Uuid, kind: AppNotification["kind"], title: string, body: string, link: string): void;
  mediaUrls(paths: string[]): Promise<Map<string, string>>;
  forgetMedia(paths: string[]): void;
}

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);

export function createDemoDedications(deps: DemoDedicationsDeps): DedicationsRepository {
  const withMedia = (dedication: Dedication): DedicationWithMedia => {
    const state = deps.state();
    const me = deps.me().id;
    return clone({
      // Como la política de la base: todas para quien la escribió, si no sólo la mía.
      views: state.dedicationViews
        .filter((v) => v.dedicationId === dedication.id && (dedication.authorId === me || v.userId === me))
        .sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt)),
      dedication,
      photos: state.dedicationPhotos.filter((p) => p.dedicationId === dedication.id).sort((a, b) => a.position - b.position),
      songs: state.dedicationSongs.filter((s) => s.dedicationId === dedication.id).sort(bySongPosition),
    });
  };

  const visible = (id: Uuid) => {
    const me = deps.me();
    const dedication = deps.state().dedications.find((d) => d.id === id);
    if (!dedication || !canSeeDedication(dedication, me.id)) throw new AppError("Esta dedicatoria no existe o no es para ti.");
    return { me, dedication };
  };

  const own = (id: Uuid) => {
    const { me, dedication } = visible(id);
    if (dedication.authorId !== me.id) throw new AppError("Sólo quien escribió la dedicatoria puede cambiarla.");
    return { me, dedication };
  };

  const checkRecipient = (authorId: Uuid, recipientId: Uuid | null) => {
    if (recipientId === null) return;
    if (recipientId === authorId) throw new AppError("Elige a otra persona (o «Para todos»).");
    if (!deps.canUse(recipientId)) throw new AppError("Esa persona no puede recibir dedicatorias.");
  };

  const notifyRecipients = (author: { id: Uuid; displayName: string }, dedication: Dedication, onlyNamed = false) => {
    const targets = dedication.recipientId ? [dedication.recipientId] : onlyNamed ? [] : deps.people();
    for (const userId of targets) {
      if (userId === author.id || !deps.canUse(userId)) continue;
      deps.notify(userId, "dedication", `${author.displayName} te dedicó algo ${dedication.emoji}`.slice(0, 160),
        dedication.title, `/dedicatorias/${dedication.id}`);
    }
  };

  const text = (value: string, max: number, what: string) => {
    const clean = value.trim();
    if (!clean) throw new AppError(`Escribe ${what}.`);
    return clean.slice(0, max);
  };

  const songRoom = (dedicationId: Uuid) => {
    if (deps.state().dedicationSongs.filter((s) => s.dedicationId === dedicationId).length >= MAX_DEDICATION_SONGS) {
      throw new AppError(`Máximo ${MAX_DEDICATION_SONGS} canciones por dedicatoria.`);
    }
  };

  const pushSong = (song: DedicationSong) => {
    deps.state().dedicationSongs.push(song);
    deps.commit({ table: "dedication_songs", type: "INSERT", record: song as never });
    return clone(song);
  };

  return {
    async list() {
      const me = deps.me();
      return deps.state().dedications.filter((d) => canSeeDedication(d, me.id)).map(withMedia);
    },
    async get(id) {
      const me = deps.me();
      const dedication = deps.state().dedications.find((d) => d.id === id);
      return dedication && canSeeDedication(dedication, me.id) ? withMedia(dedication) : null;
    },
    async create(input: DedicationInput) {
      const me = deps.me();
      checkRecipient(me.id, input.recipientId);
      const created = nowIso();
      const dedication: Dedication = {
        id: uuid(), authorId: me.id, recipientId: input.recipientId,
        title: text(input.title, 120, "un título"), message: input.message.slice(0, 8000),
        emoji: input.emoji || "💌", dedicatedOn: input.dedicatedOn || toIsoDate(new Date()), createdAt: created, updatedAt: created,
      };
      deps.state().dedications.push(dedication);
      deps.commit({ table: "dedications", type: "INSERT", record: dedication as never });
      notifyRecipients(me, dedication);
      return clone(dedication);
    },
    async update(id, patch) {
      const { me, dedication } = own(id);
      const before = dedication.recipientId;
      if (patch.recipientId !== undefined && patch.recipientId !== before) checkRecipient(me.id, patch.recipientId);
      if (patch.title !== undefined) dedication.title = text(patch.title, 120, "un título");
      if (patch.message !== undefined) dedication.message = patch.message.slice(0, 8000);
      if (patch.emoji !== undefined) dedication.emoji = patch.emoji || "💌";
      if (patch.dedicatedOn !== undefined) dedication.dedicatedOn = patch.dedicatedOn || dedication.dedicatedOn;
      if (patch.recipientId !== undefined) dedication.recipientId = patch.recipientId;
      dedication.updatedAt = nowIso();
      deps.commit({ table: "dedications", type: "UPDATE", record: dedication as never });
      if (dedication.recipientId !== before) notifyRecipients(me, dedication, true);
      return clone(dedication);
    },
    async remove(id) {
      own(id);
      const state = deps.state();
      const photos = state.dedicationPhotos.filter((p) => p.dedicationId === id);
      const songs = state.dedicationSongs.filter((s) => s.dedicationId === id);
      deps.forgetMedia([...photos.flatMap((p) => [p.path, p.thumbPath]), ...songs.flatMap((s) => (s.audioPath ? [s.audioPath] : []))]);
      state.dedicationPhotos = state.dedicationPhotos.filter((p) => p.dedicationId !== id);
      state.dedicationSongs = state.dedicationSongs.filter((s) => s.dedicationId !== id);
      state.dedicationViews = state.dedicationViews.filter((v) => v.dedicationId !== id);
      state.dedications = state.dedications.filter((d) => d.id !== id);
      deps.commit({ table: "dedications", type: "DELETE", record: null, old: { id } });
    },

    async addPhoto(dedicationId, image) {
      own(dedicationId);
      if (deps.state().dedicationPhotos.filter((p) => p.dedicationId === dedicationId).length >= MAX_DEDICATION_PHOTOS) {
        throw new AppError(`Máximo ${MAX_DEDICATION_PHOTOS} fotos por dedicatoria.`);
      }
      const id = uuid();
      const path = `dedications/${dedicationId}/${id}.${image.extension}`;
      const thumbPath = `dedications/${dedicationId}/${id}.thumb.${image.extension}`;
      await idbSet(path, image.full);
      await idbSet(thumbPath, image.thumb);
      const photo: DedicationPhoto = {
        id, dedicationId, path, thumbPath, width: image.width, height: image.height, position: Date.now() / 1000, createdAt: nowIso(),
      };
      // Tras las esperas se releen los datos por si otra pestaña escribió.
      deps.state().dedicationPhotos.push(photo);
      deps.commit({ table: "dedication_photos", type: "INSERT", record: photo as never });
      return clone(photo);
    },
    async replacePhoto(photo, image) {
      own(photo.dedicationId);
      const id = uuid();
      const path = `dedications/${photo.dedicationId}/${id}.${image.extension}`;
      const thumbPath = `dedications/${photo.dedicationId}/${id}.thumb.${image.extension}`;
      await idbSet(path, image.full);
      await idbSet(thumbPath, image.thumb);
      const current = deps.state().dedicationPhotos.find((p) => p.id === photo.id);
      if (!current) throw new AppError("Esa foto ya no existe.");
      deps.forgetMedia([current.path, current.thumbPath]);
      Object.assign(current, { path, thumbPath, width: image.width, height: image.height });
      deps.commit({ table: "dedication_photos", type: "UPDATE", record: current as never });
      return clone(current);
    },
    async deletePhoto(photo) {
      own(photo.dedicationId);
      const state = deps.state();
      deps.forgetMedia([photo.path, photo.thumbPath]);
      state.dedicationPhotos = state.dedicationPhotos.filter((p) => p.id !== photo.id);
      deps.commit({ table: "dedication_photos", type: "DELETE", record: null, old: { id: photo.id } });
    },

    async addSong(input) {
      own(input.dedicationId);
      songRoom(input.dedicationId);
      const link = parseSongLink(input.url);
      if (!link) throw new AppError("Ese enlace no es de una canción que se pueda agregar.");
      return pushSong({
        id: uuid(), dedicationId: input.dedicationId, title: text(input.title, 200, "el nombre de la canción"),
        artist: input.artist.trim().slice(0, 200), note: input.note.trim().slice(0, 500), source: link.source, url: link.url,
        audioPath: null, position: Date.now() / 1000 + Math.random() / 1000, createdAt: nowIso(),
      });
    },
    async addAudioSong(input) {
      own(input.dedicationId);
      songRoom(input.dedicationId);
      if (!(input.extension in AUDIO_TYPES)) throw new AppError("Ese archivo no es de audio (usa MP3, M4A, OGG, WAV, WEBM o FLAC).");
      if (input.file.size > MAX_AUDIO_BYTES) throw new AppError("El audio pesa demasiado: máximo 20 MB.");
      const audioPath = `dedications/${input.dedicationId}/${uuid()}.${input.extension}`;
      const typed = new Blob([input.file], { type: AUDIO_TYPES[input.extension as AudioExtension] });
      await idbSet(audioPath, typed);
      return pushSong({
        id: uuid(), dedicationId: input.dedicationId, title: text(input.title, 200, "el nombre de la canción"),
        artist: input.artist.trim().slice(0, 200), note: input.note.trim().slice(0, 500), source: "audio", url: null,
        audioPath, position: Date.now() / 1000, createdAt: nowIso(),
      });
    },
    async updateSong(id, patch) {
      const song = deps.state().dedicationSongs.find((s) => s.id === id);
      if (!song) throw new AppError("Esta dedicatoria no existe o no es para ti.");
      own(song.dedicationId);
      if (patch.title !== undefined) song.title = text(patch.title, 200, "el nombre de la canción");
      if (patch.artist !== undefined) song.artist = patch.artist.trim().slice(0, 200);
      if (patch.note !== undefined) song.note = patch.note.trim().slice(0, 500);
      if (patch.url !== undefined && patch.url !== null && song.source !== "audio") {
        const link = parseSongLink(patch.url);
        if (!link || link.source !== song.source) throw new AppError("Ese enlace no es de una canción que se pueda agregar.");
        song.url = link.url;
      }
      deps.commit({ table: "dedication_songs", type: "UPDATE", record: song as never });
      return clone(song);
    },
    async deleteSong(song) {
      own(song.dedicationId);
      const state = deps.state();
      if (song.audioPath) deps.forgetMedia([song.audioPath]);
      state.dedicationSongs = state.dedicationSongs.filter((s) => s.id !== song.id);
      deps.commit({ table: "dedication_songs", type: "DELETE", record: null, old: { id: song.id } });
    },
    async reorderSongs(dedicationId, orderedIds) {
      own(dedicationId);
      const songs = deps.state().dedicationSongs;
      orderedIds.forEach((id, index) => {
        const song = songs.find((s) => s.id === id && s.dedicationId === dedicationId);
        if (song) song.position = index + 1;
      });
      deps.commit({ table: "dedication_songs", type: "UPDATE", record: null });
    },
    async markSeen(dedicationId) {
      const { me, dedication } = visible(dedicationId);
      if (dedication.authorId === me.id) return;
      const state = deps.state();
      const now = nowIso();
      const current = state.dedicationViews.find((v) => v.dedicationId === dedicationId && v.userId === me.id);
      const view = current ?? { dedicationId, userId: me.id, firstSeenAt: now, lastSeenAt: now };
      view.lastSeenAt = now;
      if (!current) state.dedicationViews.push(view);
      deps.commit({ table: "dedication_views", type: current ? "UPDATE" : "INSERT", record: view as never });
    },

    async resolveMedia(paths) {
      deps.me();
      return deps.mediaUrls(paths);
    },
  };
}

/** Borra de IndexedDB los archivos de una dedicatoria. */
export function dropDemoMedia(paths: string[], objectUrls: Map<string, string>): void {
  for (const path of paths) {
    void idbDel(path);
    const url = objectUrls.get(path);
    if (url) URL.revokeObjectURL(url);
    objectUrls.delete(path);
  }
}
