import { useSyncExternalStore } from "react";
import { demoQueue, DemoState, e2eSnapshot } from "./queue";
import {
  ApiRequestInfo,
  ApiResponseInfo,
  ExpectationInfo,
  clearHighlight,
  createFixtures,
  RegisteredTest,
  setRunnerHooks,
  takeRegisteredTests,
} from "./runner/playwright";
import { StepLocation } from "./runner/location";
import { authService } from "../machines/authMachine";
import { history } from "../utils/historyUtils";

const STEP_DELAY = 600; // ms to stay on every step, so the viewer can follow
const API_HOLD_DELAY = 1400; // ms to keep the answer of an API request on screen, so the viewer can read it
const FILE_SWITCH_DELAY = 1400; // ms to stay when the run moves to another code file (the viewer reads the new file)

// A loop repeats the same few lines many times (for example, 56 API requests). The viewer understands it
// after a few rounds, so the run speeds up: a line that ran FAST_REPEATS times among the last FAST_WINDOW steps
// is a loop, and the steps of a loop wait only a short time.
const FAST_WINDOW = 12;
const FAST_REPEATS = 3;
const FAST_STEP_DELAY = 50; // ms
const FAST_API_HOLD_DELAY = 100; // ms

class StopSignal extends Error {}

/** A judgement of a value in an API tool (an expect line): the expected value, the real value, and the result. */
export interface ApiExpectation {
  /** the expect line of the code, for example expect(response.ok()).toBeTruthy(); */
  code: string;
  expected: string;
  actual: string;
  passed: boolean;
}

/** An API request that a step sends: the request first, the answer when it has come, then the judgements. */
export interface ApiExchange extends Partial<ApiResponseInfo>, ApiRequestInfo {
  /** a new id for every request */
  id: number;
  /** true until the answer has come */
  pending: boolean;
  /** the API code file and line that sent it */
  path?: string;
  line?: number;
  /** the expect lines that judged this request */
  expectations: ApiExpectation[];
}

export interface DemoSnapshot {
  state: DemoState;
  /** index in the queue of the test that runs (or ran last) */
  index: number;
  /** the file and line of the test code that runs now */
  activeFile?: string;
  activeLine?: number;
  /** why the demo stopped, when a step failed */
  error?: string;
  /** a short message for the toast, for example "signup.ts 코드를 실행합니다". A new id means a new message. */
  notice?: { id: number; text: string };
  /** the API request that is on its way now (the accordion opens its panel); empty when the current step sends none */
  api?: ApiExchange;
  /** every API request of this run, in the order they were sent (the panel can show them again later) */
  apis?: ApiExchange[];
}

const IDLE: DemoSnapshot = { state: "idle", index: 0 };
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const RESET_WAIT_LIMIT = 10_000; // ms: the longest wait for a login or logout that is on its way to end

// The states of the login machine that end by themselves (a request is on its way). LOGOUT is sent after they end.
const BUSY_AUTH_STATES = ["loading", "signup", "updating", "logout"];

/**
 * Makes the page like a NEW browser before every test: nobody is logged in and the screen is the sign-in page.
 * The real Playwright opens a new browser (no login) for every test and closes it at the end.
 * The demo cannot close its own window (the viewer is watching it), so it logs out in the same window instead:
 * like pressing the logout button. No reload: the footer and the code panel stay on screen.
 */
async function resetLikeNewBrowser(): Promise<void> {
  const until = Date.now() + RESET_WAIT_LIMIT;
  const busy = () => BUSY_AUTH_STATES.some((state) => authService.state.matches(state));
  while (busy() && Date.now() < until) await sleep(100);
  if (!authService.state.matches("unauthorized")) {
    authService.send("LOGOUT");
    while (!authService.state.matches("unauthorized") && Date.now() < until) await sleep(100);
    if (!authService.state.matches("unauthorized")) {
      throw new Error("시연 준비 실패: 테스트 시작 전에 로그아웃하지 못했습니다");
    }
  }
  if (history.location.pathname !== "/signin") history.push("/signin");
  await sleep(150);
}

/**
 * The controller of the test demo. It lives outside React and above every screen (sign in, main...),
 * so a page change does not stop it. The footer bar, the accordion and the runner all use it.
 */
class DemoController {
  private snapshot: DemoSnapshot = IDLE;
  private listeners = new Set<() => void>();
  private runId = 0; // a new run (or a stop) makes the older run stop at its next step
  private noticeId = 0;
  private apiId = 0;
  private resumeWaiters: Array<() => void> = [];
  private loaded = new Map<string, RegisteredTest[]>();
  private recent: string[] = []; // the last steps (file:line), to find a loop
  private fast = false; // true while the run is in a loop

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(patch: Partial<DemoSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  // "<file name> 코드를 실행합니다" toast, shown when the run enters a code file
  private noticeFor(path: string) {
    const name = path.split("/").pop() ?? path;
    this.noticeId += 1;
    return { id: this.noticeId, text: `${name} 코드를 실행합니다` };
  }

  private releaseWaiters() {
    this.resumeWaiters.splice(0).forEach((resume) => resume());
  }

  private check(id: number) {
    if (id !== this.runId) throw new StopSignal();
  }

  private async pausePoint(id: number) {
    while (this.snapshot.state === "paused") {
      await new Promise<void>((resume) => this.resumeWaiters.push(resume));
      this.check(id);
    }
  }

  // called by the runner when an API request is sent: the request panel opens
  private apiStart(id: number, info: ApiRequestInfo) {
    this.check(id);
    this.apiId += 1;
    const exchange: ApiExchange = {
      ...info,
      id: this.apiId,
      pending: true,
      path: this.snapshot.activeFile,
      line: this.snapshot.activeLine,
      expectations: [],
    };
    this.set({ api: exchange, apis: [...(this.snapshot.apis ?? []), exchange] });
  }

  // change one request of the run (also the live one) without touching the others
  private updateExchange(exchangeId: number, change: (exchange: ApiExchange) => ApiExchange) {
    const apis = (this.snapshot.apis ?? []).map((item) => (item.id === exchangeId ? change(item) : item));
    const live = this.snapshot.api?.id === exchangeId ? change(this.snapshot.api) : this.snapshot.api;
    this.set({ apis, api: live });
  }

  // called by the runner when the answer has come: the panel shows it and the run waits a moment
  private async apiDone(id: number, info: ApiResponseInfo) {
    this.check(id);
    const live = this.snapshot.api;
    if (live) this.updateExchange(live.id, (item) => ({ ...item, ...info, pending: false }));
    await this.pausePoint(id);
    await sleep(this.fast ? FAST_API_HOLD_DELAY : API_HOLD_DELAY);
    await this.pausePoint(id);
    this.check(id);
  }

  // called by the runner when a value is judged: if an API code file judged it, the judgement belongs to its last request
  private async expectation(id: number, info: ExpectationInfo) {
    const where = await info.where;
    if (id !== this.runId || !where) return;
    const exchange = [...(this.snapshot.apis ?? [])].reverse().find((item) => item.path === where.path);
    if (!exchange) return;
    const source = e2eSnapshot.find((file) => file.path === where.path);
    const code = source?.code.split(/\r?\n/)[where.line - 1]?.trim() ?? info.matcher;
    this.updateExchange(exchange.id, (item) => ({
      ...item,
      expectations: [...item.expectations, { code, expected: info.expected, actual: info.actual, passed: info.passed }],
    }));
  }

  // called by the runner before every step
  private async step(id: number, location: StepLocation | null) {
    this.check(id);
    // a new step closes the request panel of the step before
    if (this.snapshot.api) this.set({ api: undefined });
    const switchesFile =
      !!location && !!this.snapshot.activeFile && location.path !== this.snapshot.activeFile;
    if (location) {
      // the same line three times among the last twelve steps: a loop, so the run speeds up
      const key = `${location.path}:${location.line}`;
      this.recent.push(key);
      if (this.recent.length > FAST_WINDOW) this.recent.shift();
      this.fast = this.recent.filter((item) => item === key).length >= FAST_REPEATS;
      this.set({
        activeFile: location.path,
        activeLine: location.line,
        ...(switchesFile ? { notice: this.noticeFor(location.path) } : {}),
      });
    }
    await this.pausePoint(id);
    await sleep(this.fast ? FAST_STEP_DELAY : switchesFile ? FILE_SWITCH_DELAY : STEP_DELAY);
    await this.pausePoint(id);
    this.check(id);
  }

  private async run(index: number) {
    const id = ++this.runId;
    const test = demoQueue[index];
    this.recent = [];
    this.fast = false;
    this.set({
      state: "running",
      index,
      activeFile: test.path,
      activeLine: undefined,
      error: undefined,
      api: undefined,
      apis: [],
      notice: this.noticeFor(test.path),
    });
    setRunnerHooks({
      step: (location) => this.step(id, location),
      apiStart: (info) => this.apiStart(id, info),
      apiDone: (info) => this.apiDone(id, info),
      expectation: (info) => void this.expectation(id, info),
    });
    try {
      let tests = this.loaded.get(test.path);
      if (!tests) {
        await test.load(); // the file runs once and its test(...) calls register the tests
        tests = takeRegisteredTests();
        this.loaded.set(test.path, tests);
      }
      for (const registered of tests) {
        // every test starts like the real Playwright: a new browser with no login (see resetLikeNewBrowser)
        await resetLikeNewBrowser();
        this.check(id);
        await registered.fn(createFixtures());
      }
      this.check(id);
      clearHighlight();
      if (index + 1 < demoQueue.length) {
        await this.run(index + 1); // the next test starts by itself
      } else {
        this.set({ state: "finished", activeLine: undefined, api: undefined });
      }
    } catch (error) {
      if (error instanceof StopSignal || id !== this.runId) return;
      clearHighlight();
      this.set({
        state: "finished",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  start = () => {
    // a demo that has ended can start again from the first test, without pressing stop first
    const canStart = this.snapshot.state === "idle" || this.snapshot.state === "finished";
    if (!canStart || demoQueue.length === 0) return;
    this.releaseWaiters();
    clearHighlight();
    void this.run(0);
  };

  togglePause = () => {
    if (this.snapshot.state === "running") {
      this.set({ state: "paused" });
    } else if (this.snapshot.state === "paused") {
      this.set({ state: "running" });
      this.releaseWaiters();
    }
  };

  stop = () => {
    this.runId += 1;
    this.releaseWaiters();
    clearHighlight();
    this.snapshot = IDLE;
    this.listeners.forEach((listener) => listener());
  };

  goTo = (index: number) => {
    if (this.snapshot.state === "idle" || index < 0 || index >= demoQueue.length) return;
    this.runId += 1;
    this.releaseWaiters();
    clearHighlight();
    void this.run(index);
  };

  prev = () => this.goTo(this.snapshot.index - 1);
  next = () => this.goTo(this.snapshot.index + 1);
}

export const demoController = new DemoController();

export const useDemo = (): DemoSnapshot =>
  useSyncExternalStore(demoController.subscribe, demoController.getSnapshot);
