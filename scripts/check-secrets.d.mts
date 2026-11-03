export function findSecrets(text: string): Array<{ line: number; kind: string }>;
export function isForbiddenFile(path: string): boolean;
export function assertPublicEnv(env: Record<string, string | undefined>): void;
