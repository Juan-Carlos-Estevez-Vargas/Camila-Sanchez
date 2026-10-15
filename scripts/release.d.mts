export interface Commit {
  sha: string;
  subject: string;
  body?: string;
}

export interface ParsedCommit {
  sha: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  description: string;
}

export function parseVersion(version: string): [number, number, number];
export function parseCommit(commit: Commit): ParsedCommit;
export function isMerge(commit: Pick<Commit, "subject">): boolean;
export function nextVersion(input: { lastTag: string | null; packageVersion: string; commits: Commit[] }): string | null;
export function buildReleaseNotes(input: {
  version: string;
  previousTag: string | null;
  commits: Commit[];
  repoUrl: string;
  siteUrl?: string;
  runUrl?: string;
  date?: string;
}): string;
