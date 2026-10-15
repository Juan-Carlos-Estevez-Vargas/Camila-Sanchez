import type { PhotoUrls, SectionKind, SectionOf, SiteContent, Uuid } from "@/domain/types";

export interface SectionProps<K extends SectionKind> {
  section: SectionOf<K>;
  content: SiteContent;
  photoUrls: Map<Uuid, PhotoUrls>;
}
