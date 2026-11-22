/**
 * A small Playwright-compatible runner that works inside the browser page.
 *
 * Vite replaces the import "@playwright/test" with this file (see vite.config.ts), so the test files
 * in tests/e2e are the SAME files that CI runs with the real Playwright. This file does not copy any
 * Playwright code: it is written for this project and supports only the syntax listed below.
 *
 * Supported syntax:
 *   test(title, async ({ page, request }) => { ... })
 *   test.step(title, async () => { ... })     (runs the body and gives back its value; the demo shows no step name yet)
 *   page.goto(path)                       (moves inside the app, it does not reload the page)
 *   page.reload()                         (the screen and the login read the server again; the window is not reloaded)
 *   page.url()                            (the address of the page now)
 *   page.getByTestId(id), page.getByRole("heading" | "button" | "link", { name }), page.locator(css)
 *   locator.locator(css), locator.fill(text), locator.click()
 *   request.get(url), request.post(url, { data }), request.delete(url)   -> response.status(), response.ok(), response.json()
 *   page.request                          (the same API tool, it has the login of the page)
 *   await expect(locator).toBeVisible(), await expect(locator).toBeHidden()
 *   await expect(locator).toContainText("text"), await expect(locator).toBeDisabled(), await expect(locator).toBeEnabled()
 *   await expect(locator).toHaveCount(n), await expect(locator).toHaveText("text")   (the whole text, spaces squeezed)
 *   await expect(page).toHaveURL("/signin")     (a text is resolved against the address of the app; a RegExp is also fine)
 *   expect(value).toBe(expected), expect(value).toEqual(expected), expect(value).toBeTruthy()
 * Anything else stops the demo with a clear message: add it here first, then use it in a test.
 */
import { history } from "../../utils/historyUtils";
import { authService } from "../../machines/authMachine";
import { captureCaller, StepLocation } from "./location";

const WAIT_LIMIT = 5000; // like Playwright, a step waits up to 5 seconds for its element
const TYPING_DELAY = 25; // one character at a time, so the viewer can see the typing

/** What an API request sent (the demo shows it like a request tool: the request, then the response). */
export interface ApiRequestInfo {
  method: string;
  url: string;
  requestBody?: string;
}
export interface ApiResponseInfo {
  status: number;
  statusText: string;
  /** milliseconds from sending to the answer */
  ms: number;
  contentType?: string;
  responseBody: string;
}

export interface RunnerHooks {
  /** Called before every step with the line of the test code. It shows the line, waits for a pause or the pacing delay, and throws to stop the run. */
  step(location: StepLocation | null): Promise<void>;
  /** Called when an API request is sent. */
  apiStart?(info: ApiRequestInfo): void;
  /** Called when the answer has come. The run waits here, so the viewer can read the answer. */
  apiDone?(info: ApiResponseInfo): Promise<void>;
  /** Called when expect(value).toBe(...) or .toBeTruthy() judges a value (the API panel shows it as the expected value). */
  expectation?(info: ExpectationInfo): void;
}

/** One judgement of a value: what was expected, what came, and whether it passed. */
export interface ExpectationInfo {
  matcher: string;
  /** the expected value as text, for example 201 or truthy */
  expected: string;
  /** the real value as text */
  actual: string;
  passed: boolean;
  /** the line of the test code that judged it */
  where: Promise<StepLocation | null>;
}

let hooks: RunnerHooks | null = null;
export const setRunnerHooks = (next: RunnerHooks | null) => {
  hooks = next;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const beforeStep = async (where: Promise<StepLocation | null>) => {
  await hooks?.step(await where);
};

// ---- the blue frame around the element that the current step works on ----
let frame: HTMLDivElement | null = null;
const highlight = (element: Element | null) => {
  if (!element) {
    frame?.remove();
    frame = null;
    return;
  }
  const rect = element.getBoundingClientRect();
  if (!frame) {
    frame = document.createElement("div");
    frame.setAttribute("data-testid", "demo-highlight");
    Object.assign(frame.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "2000",
      border: "3px solid #1976d2",
      borderRadius: "6px",
      boxShadow: "0 0 0 4px rgba(25,118,210,0.25)",
    });
    document.body.appendChild(frame);
  }
  Object.assign(frame.style, {
    left: `${rect.left - 4}px`,
    top: `${rect.top - 4}px`,
    width: `${rect.width + 8}px`,
    height: `${rect.height + 8}px`,
  });
};
export const clearHighlight = () => highlight(null);

// ---- elements ----
const isVisible = (element: Element) => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};
const isDisabled = (element: Element) =>
  (element as HTMLButtonElement).disabled === true || element.getAttribute("aria-disabled") === "true";

const ROLE_SELECTORS: Record<string, string> = {
  heading: "h1,h2,h3,h4,h5,h6,[role=heading]",
  button: "button,[role=button]",
  link: "a[href]",
};
const accessibleName = (element: Element) =>
  (element.getAttribute("aria-label") ?? element.textContent ?? "").trim();

const unsupported = (what: string) =>
  new Error(`호환 실행기가 아직 지원하지 않는 문법입니다: ${what} (apps/web/src/demo/runner/playwright.ts에 먼저 추가해야 합니다)`);

// a class instance that stops with a clear message when a test uses a method we do not have
const guarded = <T extends object>(target: T, label: string): T =>
  new Proxy(target, {
    get(object, property, receiver) {
      if (typeof property === "string" && property !== "then" && !(property in object)) {
        throw unsupported(`${label}.${property}`);
      }
      return Reflect.get(object, property, receiver);
    },
  });

export class Locator {
  constructor(readonly find: () => Element[], private description: string) {}

  locator(css: string): Locator {
    return guarded(
      new Locator(
        () => this.find().flatMap((element) => Array.from(element.querySelectorAll(css))),
        `${this.description}.locator("${css}")`
      ),
      "locator"
    );
  }

  /** @internal waits until the element is there and the check passes */
  async until(check: (element: Element) => boolean, state: string): Promise<Element> {
    const deadline = Date.now() + WAIT_LIMIT;
    for (;;) {
      const element = this.find()[0];
      if (element && check(element)) return element;
      if (Date.now() > deadline) {
        throw new Error(`시간 초과: ${this.description} 이(가) ${WAIT_LIMIT / 1000}초 안에 ${state} 상태가 되지 않았습니다`);
      }
      await sleep(50);
    }
  }

  async fill(text: string): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    const input = (await this.until((e) => isVisible(e) && !isDisabled(e), "입력 가능한")) as HTMLInputElement;
    highlight(input);
    input.focus();
    // React listens to the "input" event: set the value the way the browser does, then tell React
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    if (text === "") {
      setValue.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    for (let count = 1; count <= text.length; count += 1) {
      setValue.call(input, text.slice(0, count));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(TYPING_DELAY);
    }
  }

  async click(): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    const element = await this.until((e) => isVisible(e) && !isDisabled(e), "누를 수 있는");
    highlight(element);
    // a real click presses the mouse button first: some controls (the select of the app) open on that press
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
    (element as HTMLElement).click();
  }
}

class LocatorExpectation {
  constructor(private locator: Locator) {}

  /** Passes when exactly this many elements match (it waits, like the real Playwright). */
  async toHaveCount(expected: number): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    highlight(null); // a count has no single element to frame
    const deadline = Date.now() + WAIT_LIMIT;
    for (;;) {
      const count = this.locator.find().length;
      if (count === expected) return;
      if (Date.now() > deadline) {
        throw new Error(`시간 초과: ${WAIT_LIMIT / 1000}초 안에 요소가 ${expected}개가 되지 않았습니다 (지금 ${count}개)`);
      }
      await sleep(50);
    }
  }

  /** Passes when the element is there and disabled (a button that cannot be pressed). */
  async toBeDisabled(): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    const element = await this.locator.until((e) => isVisible(e) && isDisabled(e), "꺼진(비활성)");
    highlight(element);
  }

  /** Passes when the element is there and enabled (a button that can be pressed). */
  async toBeEnabled(): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    const element = await this.locator.until((e) => isVisible(e) && !isDisabled(e), "켜진(활성)");
    highlight(element);
  }

  /** Passes when the text of the element has the given text inside (it waits, like the real Playwright). */
  async toContainText(expected: string): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    const element = await this.locator.until(isVisible, "보이는");
    highlight(element);
    const deadline = Date.now() + WAIT_LIMIT;
    while (!(element.textContent ?? "").includes(expected)) {
      if (Date.now() > deadline) {
        throw new Error(
          `시간 초과: ${WAIT_LIMIT / 1000}초 안에 글자에 "${expected}" 이(가) 들어가지 않았습니다 (지금 글자: "${(element.textContent ?? "").trim()}")`
        );
      }
      await sleep(50);
    }
  }

  /** Passes when the whole text of the element is the given text (spaces squeezed, like the real Playwright). */
  async toHaveText(expected: string): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    const element = await this.locator.until(isVisible, "보이는");
    highlight(element);
    const squeeze = (text: string) => text.replace(/s+/g, " ").trim();
    const deadline = Date.now() + WAIT_LIMIT;
    while (squeeze(element.textContent ?? "") !== squeeze(expected)) {
      if (Date.now() > deadline) {
        throw new Error(
          `시간 초과: ${WAIT_LIMIT / 1000}초 안에 글자가 "${expected}" 이(가) 되지 않았습니다 (지금 글자: "${squeeze(element.textContent ?? "")}")`
        );
      }
      await sleep(50);
    }
  }

  /** Passes when the element is not there or not visible (a dialog that has closed). */
  async toBeHidden(): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    highlight(null);
    const deadline = Date.now() + WAIT_LIMIT;
    for (;;) {
      const element = this.locator.find()[0];
      if (!element || !isVisible(element)) return;
      if (Date.now() > deadline) {
        throw new Error(`시간 초과: ${WAIT_LIMIT / 1000}초 안에 요소가 사라지지 않았습니다`);
      }
      await sleep(50);
    }
  }

  async toBeVisible(): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    const element = await this.locator.until(isVisible, "보이는");
    highlight(element);
  }
}

class PageExpectation {
  /**
   * The address of the page. A text is an address like "/signin": it is resolved against the address of
   * the app (like the real Playwright does with baseURL). A regular expression is tested against the full address.
   */
  async toHaveURL(expected: string | RegExp): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    highlight(null); // an address has no element to frame
    const matches = () =>
      typeof expected === "string"
        ? new URL(expected, window.location.origin).href === window.location.href
        : expected.test(window.location.href);
    const deadline = Date.now() + WAIT_LIMIT;
    while (!matches()) {
      if (Date.now() > deadline) {
        throw new Error(
          `시간 초과: 주소가 ${WAIT_LIMIT / 1000}초 안에 ${String(expected)} 이(가) 되지 않았습니다 (지금 주소: ${window.location.pathname})`
        );
      }
      await sleep(50);
    }
  }
}

const show = (value: unknown) => (value === undefined ? "undefined" : JSON.stringify(value));

// the same value, also inside objects and arrays (like toEqual of the real Playwright: keys with undefined are ignored)
const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = (value: object) =>
    Object.keys(value).filter((key) => (value as Record<string, unknown>)[key] !== undefined);
  const keysA = keys(a);
  const keysB = keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
};

class ValueExpectation {
  constructor(private actual: unknown) {}
  toBe(expected: unknown) {
    const passed = Object.is(this.actual, expected);
    // tell the demo about the judgement before it can throw: the API panel shows it
    hooks?.expectation?.({ matcher: "toBe", expected: show(expected), actual: show(this.actual), passed, where: captureCaller() });
    if (!passed) {
      throw new Error(`expect(${show(this.actual)}).toBe(${show(expected)}) 실패`);
    }
  }
  toEqual(expected: unknown) {
    const passed = deepEqual(this.actual, expected);
    hooks?.expectation?.({
      matcher: "toEqual",
      expected: show(expected),
      actual: show(this.actual),
      passed,
      where: captureCaller(),
    });
    if (!passed) {
      throw new Error(`expect(${show(this.actual)}).toEqual(${show(expected)}) 실패`);
    }
  }
  toBeTruthy() {
    const passed = !!this.actual;
    hooks?.expectation?.({ matcher: "toBeTruthy", expected: "truthy", actual: show(this.actual), passed, where: captureCaller() });
    if (!passed) throw new Error(`expect(${show(this.actual)}).toBeTruthy() 실패`);
  }
}

export function expect(actual: unknown): any {
  return guarded(
    actual instanceof Locator
      ? new LocatorExpectation(actual)
      : actual instanceof Page
        ? new PageExpectation()
        : new ValueExpectation(actual),
    "expect(...)"
  );
}

export class Page {
  /** The API tool of the page: the same login (cookie) as the page. */
  request = guarded(new ApiRequest(), "request");

  /** The address of the page now (like page.url() of the real Playwright). It is not a step: it only reads. */
  url(): string {
    return window.location.href;
  }

  async goto(url: string): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    // the real Playwright loads the address; inside the app we move to it without a reload,
    // so the demo (which lives in this page) keeps running
    if (history.location.pathname !== url) {
      history.push(url);
    } else {
      // the real Playwright loads the address again, so the screen shows fresh data (for example, a list that
      // the API changed). Inside the app we leave the screen for a moment and come back: it loads again
      history.push(url === "/" ? "/bankaccounts" : "/");
      await sleep(100);
      history.push(url);
    }
    await sleep(150);
  }

  /**
   * Like a reload of the real Playwright: the screen shows fresh data from the server.
   * The demo lives in this window, so the window is NOT reloaded. Instead it does what a reload makes the app do:
   * 1) when someone is logged in, the app asks the server again who is logged in (GET /checkAuth, as on a page load),
   *    so the user data (for example the balance) is fresh;
   * 2) the screen of the address is left for a moment and opened again, so it loads its lists again.
   */
  async reload(): Promise<void> {
    const where = captureCaller();
    await beforeStep(where);
    if (authService.state.matches("authorized")) {
      authService.send("REFRESH");
      const deadline = Date.now() + WAIT_LIMIT;
      while (!authService.state.matches("authorized")) {
        if (Date.now() > deadline) {
          throw new Error(`시간 초과: 새로고침 뒤 ${WAIT_LIMIT / 1000}초 안에 로그인 정보를 다시 읽지 못했습니다`);
        }
        await sleep(50);
      }
    }
    const { pathname, search, hash } = history.location;
    history.push(pathname === "/" ? "/bankaccounts" : "/");
    await sleep(100);
    history.push(`${pathname}${search}${hash}`);
    await sleep(150);
  }

  getByTestId(id: string): Locator {
    return guarded(
      new Locator(() => Array.from(document.querySelectorAll(`[data-testid="${id}"]`)), `getByTestId("${id}")`),
      "locator"
    );
  }

  getByRole(role: string, options: { name?: string } = {}): Locator {
    const selector = ROLE_SELECTORS[role];
    if (!selector) throw unsupported(`getByRole("${role}")`);
    return guarded(
      new Locator(
        () =>
          Array.from(document.querySelectorAll(selector)).filter(
            (element) =>
              options.name === undefined ||
              accessibleName(element).toLowerCase().includes(options.name.toLowerCase())
          ),
        `getByRole("${role}", { name: "${options.name ?? ""}" })`
      ),
      "locator"
    );
  }

  locator(css: string): Locator {
    return guarded(
      new Locator(() => Array.from(document.querySelectorAll(css)), `locator("${css}")`),
      "locator"
    );
  }
}

class ApiResponse {
  constructor(private response: Response) {}
  status() {
    return this.response.status;
  }
  ok() {
    return this.response.ok;
  }
  json() {
    return this.response.json();
  }
}

export class ApiRequest {
  async get(url: string): Promise<ApiResponse> {
    return this.send("GET", url, captureCaller());
  }

  async delete(url: string): Promise<ApiResponse> {
    return this.send("DELETE", url, captureCaller());
  }

  async post(url: string, options: { data?: unknown } = {}): Promise<ApiResponse> {
    return this.send("POST", url, captureCaller(), JSON.stringify(options.data ?? {}));
  }

  private async send(method: string, url: string, where: Promise<StepLocation | null>, body?: string): Promise<ApiResponse> {
    await beforeStep(where);
    hooks?.apiStart?.({ method, url, requestBody: body });
    const startedAt = performance.now();
    const response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body,
      credentials: "same-origin",
    });
    const responseBody = await response.clone().text();
    await hooks?.apiDone?.({
      status: response.status,
      statusText: response.statusText,
      ms: Math.round(performance.now() - startedAt),
      contentType: response.headers.get("content-type") ?? undefined,
      responseBody,
    });
    return new ApiResponse(response);
  }
}

// the name the real Playwright uses for the `request` fixture (tests use it as a type)
export type APIRequestContext = ApiRequest;

// ---- test() collects the tests of a file while the file loads ----
export interface RegisteredTest {
  title: string;
  fn: (fixtures: { page: Page; request: ApiRequest }) => Promise<void> | void;
}
const registry: RegisteredTest[] = [];

export function test(title: string, fn: RegisteredTest["fn"]) {
  registry.push({ title, fn });
}

/**
 * Like test.step of the real Playwright: runs the body and gives back what it returns; an error goes up unchanged.
 * The tools of tests/e2e wrap their body in a step ("[kind] tool name") so a reporter can record each tool.
 * The demo does not show the step name yet: the lines inside the step are shown as before.
 */
test.step = async <T>(_title: string, body: () => T | Promise<T>): Promise<T> => body();

/** the tests that were registered since the last call */
export const takeRegisteredTests = () => registry.splice(0);

export const createFixtures = () => ({
  page: guarded(new Page(), "page"),
  request: guarded(new ApiRequest(), "request"),
});
