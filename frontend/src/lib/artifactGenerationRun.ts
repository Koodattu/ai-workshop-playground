import type { GenerateResponse, GenerationUsageSummary, StreamCallbacks } from "@/types";

export interface ArtifactGenerationView {
  revision: number;
  progress: string;
  message?: string;
  artifact?: {
    code: string;
    state: "streaming" | "complete";
  };
}

export type ArtifactGenerationOutcome =
  | {
      status: "completed";
      result: GenerateResponse & { remaining?: number; usage?: GenerationUsageSummary | null };
    }
  | {
      status: "failed";
      error: { message: string; remainingUses?: number; errorCode?: string; details?: string[] };
    }
  | { status: "cancelled" };

export interface ArtifactGenerationRun {
  display: AsyncIterable<ArtifactGenerationView>;
  outcome: Promise<ArtifactGenerationOutcome>;
  cancel: () => void;
}

class AsyncViewQueue implements AsyncIterable<ArtifactGenerationView> {
  private values: ArtifactGenerationView[] = [];
  private waiters: Array<(result: IteratorResult<ArtifactGenerationView>) => void> = [];
  private closed = false;

  push(value: ArtifactGenerationView) {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value, done: false });
    else this.values.push(value);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.waiters.splice(0).forEach((waiter) => waiter({ value: undefined, done: true }));
  }

  [Symbol.asyncIterator](): AsyncIterator<ArtifactGenerationView> {
    return {
      next: () => {
        const value = this.values.shift();
        if (value) return Promise.resolve({ value, done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

export function createArtifactGenerationRun(start: (callbacks: StreamCallbacks) => Promise<() => void>): ArtifactGenerationRun {
  const display = new AsyncViewQueue();
  let revision = 0;
  let progress = "";
  let message: string | undefined;
  let artifact: ArtifactGenerationView["artifact"];
  let abort: (() => void) | undefined;
  let settled = false;
  let settleOutcome: (outcome: ArtifactGenerationOutcome) => void = () => {};

  const outcome = new Promise<ArtifactGenerationOutcome>((resolve) => {
    settleOutcome = resolve;
  });

  const publish = () => {
    revision += 1;
    display.push({
      revision,
      progress,
      message,
      artifact: artifact ? { ...artifact } : undefined,
    });
  };

  const finish = (nextOutcome: ArtifactGenerationOutcome) => {
    if (settled) return;
    settled = true;
    display.close();
    settleOutcome(nextOutcome);
  };

  void start({
    onProgress(delta) {
      progress += delta;
      publish();
    },
    onCodeStart() {
      artifact = { code: "", state: "streaming" };
      publish();
    },
    onCodeChunk(chunk) {
      artifact = { code: `${artifact?.code || ""}${chunk}`, state: "streaming" };
      publish();
    },
    onCodeUpdate(code) {
      artifact = { code, state: "streaming" };
      publish();
    },
    onCodeComplete() {
      artifact = { code: artifact?.code || "", state: "complete" };
      publish();
    },
    onMessageUpdate(nextMessage) {
      message = nextMessage;
      publish();
    },
    onMessageComplete(nextMessage) {
      message = nextMessage;
      publish();
    },
    onDone(result) {
      finish({ status: "completed", result });
    },
    onError(errorMessage, remainingUses, errorCode, details) {
      finish({ status: "failed", error: { message: errorMessage, remainingUses, errorCode, details } });
    },
  })
    .then((cancelTransport) => {
      abort = cancelTransport;
      if (settled) cancelTransport();
    })
    .catch((error) => {
      finish({ status: "failed", error: { message: error instanceof Error ? error.message : "NETWORK_ERROR" } });
    });

  return {
    display,
    outcome,
    cancel() {
      if (settled) return;
      abort?.();
      finish({ status: "cancelled" });
    },
  };
}
