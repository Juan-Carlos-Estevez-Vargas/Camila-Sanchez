export function parseNpmImports(source: string): Array<{ name: string; version: string }>;
export function collectEdgeDeps(files: Array<{ file: string; source: string }>): {
  deps: Record<string, string>;
  problems: string[];
};
