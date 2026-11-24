/**
 * Tells the server what happens with the demo: it started, it goes on, it ended, or the visitor stopped it.
 * It uses fetch (not httpClient), so the mocks of the demo never touch it and the demo does not show it.
 * The demo never waits for it and never fails because of it: without a server that knows it, nothing is recorded.
 */
const URL_BASE = "/api/demoRuns";
const SIGNAL_MS = 15_000;

export type DemoTestStatus = "passed" | "failed" | "skipped";

interface PlayingTest {
  testCase: string;
  file: string;
  startedAt: number;
}

// 003-transfer.spec.ts -> transfer
const labelOf = (file: string) => file.replace(/^\d+-/, "").replace(/\.spec\.ts$/, "");

class DemoRecorder {
  private run?: { id: number; token: string };
  private active = false;
  private paused = false;
  private playing?: PlayingTest;
  private timer?: number;
  private queue: Promise<unknown> = Promise.resolve(); // one message after the other, in their order

  constructor() {
    window.addEventListener("pagehide", () => this.leave());
    // the page came back from the browser's memory: the demo goes on where it was
    window.addEventListener("pageshow", (event) => event.persisted && this.signal());
  }

  private send(path: string, message: object) {
    this.queue = this.queue
      .then(async () => {
        if (!this.run) return;
        await this.post(`/${this.run.id}${path}`, { token: this.run.token, ...message });
      })
      .catch(() => undefined);
  }

  private post(path: string, message: object) {
    return fetch(`${URL_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      keepalive: true, // it is sent also when the page is left at this moment
    });
  }

  private signal() {
    if (this.active) this.send("/signal", { status: this.paused ? "paused" : "running" });
  }

  private overTest(status: DemoTestStatus, errorMessage?: string) {
    const test = this.playing;
    this.playing = undefined;
    return (
      test && {
        testCase: test.testCase,
        file: test.file,
        status,
        startedAt: new Date(test.startedAt).toISOString(),
        durationMs: Math.max(0, Date.now() - test.startedAt),
        errorMessage: errorMessage?.slice(0, 1000),
      }
    );
  }

  begin(mode: "all" | "partial") {
    this.active = true;
    this.paused = false;
    this.playing = undefined;
    this.queue = this.queue
      .then(async () => {
        this.run = undefined;
        const response = await this.post("", { mode });
        if (response.status === 201) this.run = await response.json();
      })
      .catch(() => undefined);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.signal(), SIGNAL_MS);
  }

  testStart(file: string) {
    this.playing = { testCase: labelOf(file), file, startedAt: Date.now() };
  }

  testEnd(status: DemoTestStatus, errorMessage?: string) {
    const test = this.overTest(status, errorMessage);
    if (this.active && test) this.send("/tests", test);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.signal();
  }

  /** The demo is over. A test that was playing is recorded as skipped: nobody knows how it would have ended. */
  end(status: "finished" | "failed" | "stopped") {
    if (!this.active) return;
    this.active = false;
    window.clearInterval(this.timer);
    this.send("/end", {
      status,
      ...(status === "stopped" ? { reason: "button" } : {}),
      test: this.overTest("skipped", "방문자가 시연을 중지했습니다"),
    });
  }

  /** The page is closed or left: the last chance to say it. A page that comes back goes on (see pageshow). */
  private leave() {
    if (!this.active || !this.run) return;
    const test = this.playing;
    const message = {
      token: this.run.token,
      status: "stopped",
      reason: "closed",
      test: this.overTest("skipped", "방문자가 화면을 닫았습니다"),
    };
    this.playing = test; // if the page comes back, the test is still playing
    const body = new Blob([JSON.stringify(message)], { type: "application/json" });
    navigator.sendBeacon?.(`${URL_BASE}/${this.run.id}/end`, body);
  }
}

export const demoRecorder = new DemoRecorder();
