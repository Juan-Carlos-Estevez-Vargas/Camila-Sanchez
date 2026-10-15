/**
 * Registro de secciones (patrón Registry / Factory): cada tipo de sección de
 * la base de datos se asocia a su componente. Para crear un tipo nuevo basta
 * con añadirlo aquí y en SectionContentMap.
 */
import type { ComponentType } from "react";
import type { PhotoUrls, Section, SectionKind, SiteContent, Uuid } from "@/domain/types";
import { Countdowns } from "./Countdowns";
import { Gallery } from "./Gallery";
import { Hero } from "./Hero";
import { LoveNotes } from "./LoveNotes";
import { Milestones } from "./Milestones";
import { Letter, Quote, TextSection } from "./SimpleSections";
import { TogetherCounter } from "./TogetherCounter";
import type { SectionProps } from "./types";

type Registry = { [K in SectionKind]: ComponentType<SectionProps<K>> };

const REGISTRY: Registry = {
  hero: Hero,
  together_counter: TogetherCounter,
  countdowns: Countdowns,
  love_notes: LoveNotes,
  milestones: Milestones,
  gallery: Gallery,
  letter: Letter,
  text: TextSection,
  quote: Quote,
};

export function renderSection(section: Section, content: SiteContent, photoUrls: Map<Uuid, PhotoUrls>) {
  const Component = REGISTRY[section.kind] as ComponentType<SectionProps<SectionKind>>;
  return <Component section={section as never} content={content} photoUrls={photoUrls} />;
}
