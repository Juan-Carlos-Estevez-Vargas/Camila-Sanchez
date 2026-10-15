/// <reference lib="webworker" />
import { offscreenFactory, optimizeImage } from "./optimize";
import type { ImageOptions } from "./sizing";

export interface WorkerRequest {
  id: number;
  file: Blob;
  options: ImageOptions;
}

export type WorkerResponse =
  | { id: number; ok: true; result: Awaited<ReturnType<typeof optimizeImage>> }
  | { id: number; ok: false; error: string };

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, file, options } = event.data;
  try {
    const result = await optimizeImage(file, options, offscreenFactory);
    self.postMessage({ id, ok: true, result } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) } satisfies WorkerResponse);
  }
};
