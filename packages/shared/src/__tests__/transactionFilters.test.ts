import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT_DOLLARS,
  centsToDollarText,
  buildDateRange,
  dateIsoToBox,
  getMoneyDirection,
  hasDirectionAmountFilter,
  matchesDirectionAmountFilter,
  parseDollarRange,
} from "../index";

const local = (iso: string) => {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  ];
};

const box = (year: string, month: string, day: string) => ({ year, month, day });
const NONE = box("", "", "");

describe("date range typed in two boxes (year / month / day)", () => {
  it("start box + end box: from the first moment of the first day to the last moment of the last day", () => {
    const r = buildDateRange(box("2026", "11", "01"), box("2026", "11", "09"));
    expect(r.ok).toBe(true);
    if (!r.ok || r.empty) return;
    expect(local(r.dateRangeStart!)).toEqual([2026, 11, 1, 0, 0, 0, 0]);
    expect(local(r.dateRangeEnd!)).toEqual([2026, 11, 9, 23, 59, 59, 999]);
  });

  it("edge case: the same day in both boxes is allowed and means exactly that day (00:00 to 23:59:59.999)", () => {
    const r = buildDateRange(box("2026", "11", "09"), box("2026", "11", "09"));
    expect(r.ok).toBe(true);
    if (!r.ok || r.empty) return;
    expect(local(r.dateRangeStart!)).toEqual([2026, 11, 9, 0, 0, 0, 0]);
    expect(local(r.dateRangeEnd!)).toEqual([2026, 11, 9, 23, 59, 59, 999]);
    expect(
      new Date(r.dateRangeEnd!).getTime() - new Date(r.dateRangeStart!).getTime()
    ).toBeGreaterThan(0);
  });

  it("edge case: a start day after the end day is refused, and both boxes are marked", () => {
    expect(buildDateRange(box("2026", "11", "09"), box("2026", "11", "01"))).toEqual({
      ok: false,
      error: "order",
      boxes: ["start", "end"],
    });
    expect(buildDateRange(box("2027", "01", "01"), box("2026", "12", "31"))).toMatchObject({
      ok: false,
      error: "order",
    });
  });

  it("only a start means from that day on, only an end means up to that day", () => {
    const from = buildDateRange(box("2026", "11", "01"), NONE);
    expect(from.ok && !from.empty && from.dateRangeStart && !from.dateRangeEnd).toBeTruthy();
    const upTo = buildDateRange(NONE, box("2026", "11", "09"));
    expect(upTo.ok && !upTo.empty && !upTo.dateRangeStart && upTo.dateRangeEnd).toBeTruthy();
  });

  it("both boxes empty means no filter", () => {
    expect(buildDateRange(NONE, NONE)).toEqual({ ok: true, empty: true });
    expect(buildDateRange(box(" ", "", ""), box("", " ", ""))).toEqual({ ok: true, empty: true });
  });

  it("accepts one-digit months and days", () => {
    expect(buildDateRange(box("2026", "1", "5"), box("2026", "1", "7")).ok).toBe(true);
  });

  it("a box that is only partly filled is refused and that box is marked", () => {
    expect(buildDateRange(box("2026", "11", ""), NONE)).toEqual({
      ok: false,
      error: "incomplete",
      boxes: ["start"],
    });
    expect(buildDateRange(NONE, box("", "11", "09"))).toEqual({
      ok: false,
      error: "incomplete",
      boxes: ["end"],
    });
  });

  it("refuses a year that is not 4 digits and months or days that are not numbers", () => {
    const bad: [ReturnType<typeof box>, string][] = [
      [box("26", "11", "01"), "year too short"],
      [box("20266", "11", "01"), "year too long"],
      [box("2026", "ab", "01"), "month letters"],
      [box("2026", "11", "-1"), "day negative"],
      [box("2026", "111", "01"), "month too long"],
    ];
    for (const [b, label] of bad) {
      expect(buildDateRange(b, NONE), label).toMatchObject({ ok: false, error: "format" });
    }
  });

  it("refuses days that do not exist", () => {
    const bad = [
      box("2026", "02", "30"),
      box("2026", "13", "01"),
      box("2026", "00", "10"),
      box("2025", "02", "29"),
      box("2026", "04", "31"),
    ];
    for (const b of bad) {
      expect(buildDateRange(b, NONE), JSON.stringify(b)).toMatchObject({
        ok: false,
        error: "invalid-date",
        boxes: ["start"],
      });
    }
    expect(buildDateRange(box("2024", "02", "29"), NONE).ok).toBe(true); // leap year
  });

  it("marks both boxes when both are wrong", () => {
    expect(buildDateRange(box("2026", "02", "30"), box("2026", "13", "01"))).toMatchObject({
      ok: false,
      boxes: ["start", "end"],
    });
  });
});

describe("dollar range typed as two boxes", () => {
  it("empty minimum means 0 and empty maximum means no upper limit", () => {
    expect(parseDollarRange("", "500")).toEqual({
      ok: true,
      empty: false,
      minCents: 0,
      maxCents: 50000,
    });
    expect(parseDollarRange("100", "")).toEqual({
      ok: true,
      empty: false,
      minCents: 10000,
      maxCents: undefined,
    });
    expect(parseDollarRange("0", "0")).toEqual({
      ok: true,
      empty: false,
      minCents: 0,
      maxCents: 0,
    });
  });

  it("both boxes empty means no filter", () => {
    expect(parseDollarRange("", "")).toEqual({ ok: true, empty: true });
    expect(parseDollarRange("  ", " ")).toEqual({ ok: true, empty: true });
  });

  it("edge case: 100 ~ 100 is allowed and means exactly $100", () => {
    expect(parseDollarRange("100", "100")).toEqual({
      ok: true,
      empty: false,
      minCents: 10000,
      maxCents: 10000,
    });
  });

  it("edge case: 1000 ~ 100 (minimum above maximum) is refused", () => {
    expect(parseDollarRange("1000", "100")).toEqual({ ok: false, error: "order" });
    expect(parseDollarRange("101", "100")).toEqual({ ok: false, error: "order" });
  });

  it("refuses anything that is not whole dollars", () => {
    const bad = [
      ["1.5", "10"],
      ["-5", "10"],
      ["a", "10"],
      ["1", "1e3"],
      ["", "$10"],
      ["10 0", "200"],
    ];
    for (const [lo, hi] of bad) {
      expect(parseDollarRange(lo, hi), `${lo} ~ ${hi}`).toEqual({ ok: false, error: "format" });
    }
  });

  it("refuses amounts above the largest allowed dollar amount, accepts the largest", () => {
    expect(parseDollarRange("0", String(MAX_AMOUNT_DOLLARS + 1))).toEqual({
      ok: false,
      error: "too-large",
    });
    expect(parseDollarRange(String(MAX_AMOUNT_DOLLARS + 1), "")).toEqual({
      ok: false,
      error: "too-large",
    });
    expect(parseDollarRange("", String(MAX_AMOUNT_DOLLARS)).ok).toBe(true);
  });

  it("accepts a thousands comma", () => {
    expect(parseDollarRange("1,000", "2,500")).toEqual({
      ok: true,
      empty: false,
      minCents: 100000,
      maxCents: 250000,
    });
  });
});

describe("deposit / withdrawal seen from one user", () => {
  const ME = "me";
  const payment = (sender: string, receiver: string, dollars: number, status = "complete") =>
    ({
      senderId: sender,
      receiverId: receiver,
      status,
      amount: dollars * 100,
    }) as any;
  it("a payment is a deposit for the receiver and a withdrawal for the sender", () => {
    expect(getMoneyDirection(payment("other", ME, 10), ME)).toBe("in");
    expect(getMoneyDirection(payment(ME, "other", 10), ME)).toBe("out");
    expect(getMoneyDirection(payment("a", "b", 10), ME)).toBeNull();
    expect(getMoneyDirection(payment(ME, ME, 10), ME)).toBeNull();
  });

  it("no filter: everything passes", () => {
    expect(hasDirectionAmountFilter({})).toBe(false);
    expect(matchesDirectionAmountFilter(payment("a", "b", 10), ME, {})).toBe(true);
    expect(matchesDirectionAmountFilter(payment("a", "b", 10), ME, undefined)).toBe(true);
  });

  it("only the deposit box: only money received, inside the range, both ends included", () => {
    const f = { depositMin: 10000, depositMax: 20000 };
    expect(matchesDirectionAmountFilter(payment("o", ME, 100), ME, f)).toBe(true); // the minimum itself
    expect(matchesDirectionAmountFilter(payment("o", ME, 200), ME, f)).toBe(true); // the maximum itself
    expect(matchesDirectionAmountFilter(payment("o", ME, 99), ME, f)).toBe(false);
    expect(matchesDirectionAmountFilter(payment("o", ME, 201), ME, f)).toBe(false);
    expect(matchesDirectionAmountFilter(payment(ME, "o", 150), ME, f)).toBe(false); // money paid is hidden
  });

  it("edge case: 100 ~ 100 finds only the $100 transactions", () => {
    const f = { withdrawalMin: 10000, withdrawalMax: 10000 };
    expect(matchesDirectionAmountFilter(payment(ME, "o", 100), ME, f)).toBe(true);
    expect(matchesDirectionAmountFilter(payment(ME, "o", 99), ME, f)).toBe(false);
    expect(matchesDirectionAmountFilter(payment(ME, "o", 101), ME, f)).toBe(false);
  });

  it("only the withdrawal box: only money paid", () => {
    const f = { withdrawalMin: 0, withdrawalMax: 5000 };
    expect(matchesDirectionAmountFilter(payment(ME, "o", 30), ME, f)).toBe(true);
    expect(matchesDirectionAmountFilter(payment("o", ME, 30), ME, f)).toBe(false);
  });

  it("both boxes: either one matches", () => {
    const f = { depositMin: 10000, depositMax: 10000, withdrawalMin: 500, withdrawalMax: 500 };
    expect(matchesDirectionAmountFilter(payment("o", ME, 100), ME, f)).toBe(true);
    expect(matchesDirectionAmountFilter(payment(ME, "o", 5), ME, f)).toBe(true);
    expect(matchesDirectionAmountFilter(payment("o", ME, 5), ME, f)).toBe(false);
    expect(matchesDirectionAmountFilter(payment(ME, "o", 100), ME, f)).toBe(false);
  });

  it("empty maximum means no upper limit", () => {
    expect(matchesDirectionAmountFilter(payment("o", ME, 999999), ME, { depositMin: 100 })).toBe(
      true
    );
  });

  it("transactions between other people and ones whose money did not move never pass once a filter is set", () => {
    const f = { depositMin: 0, withdrawalMin: 0 };
    expect(matchesDirectionAmountFilter(payment("a", "b", 10), ME, f)).toBe(false);
    expect(matchesDirectionAmountFilter(payment(ME, "o", 10, "pending"), ME, f)).toBe(false);
    expect(matchesDirectionAmountFilter(payment("o", ME, 10, "pending"), ME, f)).toBe(false);
    expect(matchesDirectionAmountFilter(payment(ME, "o", 10, "complete"), ME, f)).toBe(true);
  });
});

describe("filling the boxes again from an applied filter", () => {
  it("date range: an applied day goes back into the three fields of its box", () => {
    const r = buildDateRange(box("2026", "03", "09"), box("2026", "03", "10"));
    expect(r.ok).toBe(true);
    if (!r.ok || r.empty) return;
    expect(dateIsoToBox(r.dateRangeStart)).toEqual({ year: "2026", month: "03", day: "09" });
    expect(dateIsoToBox(r.dateRangeEnd)).toEqual({ year: "2026", month: "03", day: "10" });
    expect(dateIsoToBox(undefined)).toEqual({ year: "", month: "", day: "" });
  });

  it("dollars: cents become whole-dollar text, an empty minimum stays empty", () => {
    expect(centsToDollarText(10000)).toBe("100");
    expect(centsToDollarText(undefined)).toBe("");
    expect(centsToDollarText(0, true)).toBe("");
    expect(centsToDollarText(0)).toBe("0");
  });
});
