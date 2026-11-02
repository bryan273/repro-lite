export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  elapsed_ms: number;
  timedOut?: boolean;
}

export const RUN_TIMEOUT_MS = 60_000;
const INIT_TIMEOUT_MS = 240_000;
const MAX_OUTPUT = 6000;

function clip(s: string): string {
  return s.length > MAX_OUTPUT ? `${s.slice(0, MAX_OUTPUT)}\n...[truncated]` : s;
}

/** A Python session backed by a dedicated Web Worker running Pyodide. */
export class PySession {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private seq = 0;

  private spawn(): Promise<void> {
    const worker = new Worker(import.meta.env.BASE_URL + 'pyodide-worker.js');
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Python runtime load timed out')), INIT_TIMEOUT_MS);
      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === 'ready') {
          clearTimeout(timer);
          worker.removeEventListener('message', onMsg);
          resolve();
        } else if (e.data?.type === 'init_error') {
          clearTimeout(timer);
          worker.removeEventListener('message', onMsg);
          reject(new Error(e.data.error));
        }
      };
      worker.addEventListener('message', onMsg);
      worker.onerror = (ev) => {
        clearTimeout(timer);
        reject(new Error(ev.message || 'Worker failed to start'));
      };
      worker.postMessage({ type: 'init' });
    });
    return this.ready;
  }

  /** Loads Pyodide and packages (not counted against the run time limit). */
  async init(): Promise<void> {
    if (!this.ready) await this.spawn();
    else await this.ready;
  }

  async run(code: string, timeoutMs = RUN_TIMEOUT_MS): Promise<RunResult> {
    await this.init();
    const worker = this.worker as Worker;
    const id = ++this.seq;
    return new Promise<RunResult>((resolve) => {
      const timer = setTimeout(() => {
        worker.removeEventListener('message', onMsg);
        this.terminate();
        resolve({
          ok: false,
          stdout: '',
          stderr: `TimeoutError: code run exceeded ${timeoutMs / 1000} s and was stopped. The Python state was reset.`,
          elapsed_ms: timeoutMs,
          timedOut: true,
        });
      }, timeoutMs);
      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === 'result' && e.data.id === id) {
          clearTimeout(timer);
          worker.removeEventListener('message', onMsg);
          resolve({
            ok: e.data.ok,
            stdout: clip(e.data.stdout || ''),
            stderr: clip(e.data.stderr || ''),
            elapsed_ms: e.data.elapsed_ms,
          });
        }
      };
      worker.addEventListener('message', onMsg);
      worker.postMessage({ type: 'run', id, code });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}
