/**
 * The one list of fixture rules: which values a test needs, and how they are made.
 * This list is the agreement between the Web tests (Playwright) and the App tests (Wdio).
 * Values are random. The PARTITION of a value is not: the run number and the person decide it
 * (see docs/fixture-prisma-guide.md 3.14), so the runs together meet every partition.
 */
import { randomInt } from "crypto";

export type Person = "A" | "B" | "C";
const PEOPLE: Person[] = ["A", "B", "C"];

/** Random whole number, both ends included. */
const between = (min: number, max: number) => randomInt(min, max + 1);
const pick = <T>(items: readonly T[]): T => items[between(0, items.length - 1)];
const repeat = (length: number, make: () => string) => Array.from({ length }, make).join("");

const korean = () => String.fromCharCode(between(0xac00, 0xd7a3));
const letter = () => String.fromCharCode(between(97, 122));
const digit = () => String(between(0, 9));
const digits = (length: number) => repeat(length, digit);

// ---- partitions ----
export const NAME_PARTITIONS = ["one", "usual", "long"] as const;
export const USERNAME_PARTITIONS = ["korean", "english-digits", "mixed"] as const;
export const PHONE_PARTITIONS = ["mobile", "international", "area"] as const;
export const ACCOUNT_LENGTHS = [9, 10, 11, 12] as const;

/** Staggered rotation: every run has all three-way partitions, and A (the one on screen) meets them all soon. */
export const partitionsOf = (runNo: number, person: Person) => {
  const n = runNo - 1;
  const p = PEOPLE.indexOf(person);
  const a = n % 3;
  const b = Math.floor(n / 3) % 3;
  return {
    username: USERNAME_PARTITIONS[(a + p) % 3],
    name: NAME_PARTITIONS[(a + b + p) % 3],
    phone: PHONE_PARTITIONS[(a + 2 * b + p) % 3],
    accountLength: ACCOUNT_LENGTHS[(n + p) % 4],
  };
};

// ---- values ----
const NAME_LENGTH = { one: [1, 1], usual: [2, 6], long: [20, 30] } as const;

const makeName = (partition: (typeof NAME_PARTITIONS)[number]) => {
  const [min, max] = NAME_LENGTH[partition];
  return repeat(between(min, max), pick([korean, letter]));
};

// Digits (the code, the run number) follow the base, so the base never ends with a digit ("ab1" + 17 would look like "ab" + 117).
const makeUsernameBase = (partition: (typeof USERNAME_PARTITIONS)[number]) => {
  switch (partition) {
    case "korean":
      return repeat(4, korean);
    case "english-digits":
      return letter() + digits(2) + repeat(4, letter);
    case "mixed":
      return repeat(2, korean) + digits(1) + repeat(3, letter);
  }
};

const makePhoneNumber = (partition: (typeof PHONE_PARTITIONS)[number]) => {
  switch (partition) {
    case "mobile":
      return `010-${digits(4)}-${digits(4)}`;
    case "international":
      return `+82 10-${digits(4)}-${digits(4)}`;
    case "area":
      return `(02) ${digits(3)}-${digits(4)}`;
  }
};

// Made-up banks: real names, slightly changed
const BANK_NAMES = [
  "KP국민은행",
  "신환은행",
  "우리들은행",
  "하라은행",
  "카카우뱅크",
  "토수뱅크",
  "JPMorgan Chess",
  "Bank of North America",
  "Wells Cargo",
  "Standard Chartreuse",
] as const;

// ---- the values of one test (columns of test_fixture) ----
/** Column -> how its value is made. A new value needs its line here and a column in test_fixture (a migration). */
export const makeFixtureValues = () => ({
  transferCycleDollars: between(1, 500),
  detailDollars: between(1, 500),
  detailComment: repeat(8, korean),
  filterSentSmallDollars: between(10, 90),
  filterSentBigDollars: between(250, 390),
  filterGotSmallDollars: between(10, 90),
  filterGotBigDollars: between(250, 390),
});

export type FixtureValues = ReturnType<typeof makeFixtureValues>;

// ---- which test needs what ----
interface TestCaseRule {
  /**
   * Keeps the usernames of the tests apart (every test signs up its own A): base + code + run number + platform.
   * Always two digits, never changed and never used twice. Only "transfer" has none, like the numbers before this
   * rule, so that its people of older numbers are still found.
   */
  code: string;
  people: Person[];
  /** The name a test asks for -> the column of test_fixture */
  values?: Record<string, keyof FixtureValues>;
}

/** The label of a test -> what it needs. A new test adds its line here (no DB change when it needs only people). */
export const FIXTURE_RULES: Record<string, TestCaseRule> = {
  auth: { code: "00", people: ["A"] },
  "bank-account": { code: "01", people: ["A"] },
  deposit: { code: "02", people: ["A"] },
  transfer: {
    code: "",
    people: ["A", "B", "C"],
    values: { cycleDollars: "transferCycleDollars" },
  },
  "transaction-detail": {
    code: "04",
    people: ["A", "B"],
    values: { dollars: "detailDollars", comment: "detailComment" },
  },
  "transaction-filter": {
    code: "05",
    people: ["A", "B", "C"],
    values: {
      sentSmallDollars: "filterSentSmallDollars",
      sentBigDollars: "filterSentBigDollars",
      gotSmallDollars: "filterGotSmallDollars",
      gotBigDollars: "filterGotBigDollars",
    },
  },
  "user-settings": { code: "06", people: ["A", "B"] },
  "transaction-visibility": { code: "07", people: ["A", "B", "C"] },
  notifications: { code: "08", people: ["A", "B", "C"] },
  "login-logout": { code: "09", people: ["A", "B"] },
};

const PLATFORM_MARK = { web: "w", app: "a" } as const;

/**
 * The username of a person in one test of one number. The code stands before the number, not at the end: the search
 * of the app finds a part of a username, and "x6w" must not find "x046w" (the same person in another test).
 */
export const usernameOf = (
  base: string,
  testCase: string,
  runNo: number,
  platform: keyof typeof PLATFORM_MARK
): string => `${base}${FIXTURE_RULES[testCase].code}${runNo}${PLATFORM_MARK[platform]}`;

/** The three people of a run number, as rows of test_fixture_person. Passwords are not values (see test-run-secret.ts). */
export const makeFixturePeople = (runNo: number) => {
  const usedBases = new Set<string>();
  return PEOPLE.map((person) => {
    const partitions = partitionsOf(runNo, person);
    let usernameBase = makeUsernameBase(partitions.username);
    while (usedBases.has(usernameBase)) usernameBase = makeUsernameBase(partitions.username);
    usedBases.add(usernameBase);

    return {
      runNo,
      person,
      usernameBase,
      firstName: makeName(partitions.name),
      lastName: makeName(partitions.name),
      phoneNumber: makePhoneNumber(partitions.phone),
      bankName: pick<string>(BANK_NAMES),
      accountNumber: digits(partitions.accountLength),
      partitionUsername: partitions.username as string,
      partitionName: partitions.name as string,
      partitionPhone: partitions.phone as string,
      partitionAccountLength: partitions.accountLength as number,
    };
  });
};
