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

// The run number follows the base, so the base never ends with a digit ("ab1" + 17 would look like "ab" + 117).
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

// ---- which test needs what ----
type MakeValue = () => string | number;

interface TestCaseRule {
  people: Person[];
  values?: Record<string, MakeValue>;
}

/** The label of a test -> what it needs. A new test adds its line here. */
export const FIXTURE_RULES: Record<string, TestCaseRule> = {
  auth: { people: ["A"] },
  "bank-account": { people: ["A"] },
  deposit: { people: ["A"] },
  transfer: { people: ["A", "B", "C"], values: { cycleDollars: () => between(1, 500) } },
  "transaction-detail": {
    people: ["A", "B"],
    values: { dollars: () => between(1, 500), comment: () => repeat(8, korean) },
  },
  "transaction-filter": {
    people: ["A", "B", "C"],
    values: {
      sentSmallDollars: () => between(10, 90),
      sentBigDollars: () => between(250, 390),
      gotSmallDollars: () => between(10, 90),
      gotBigDollars: () => between(250, 390),
    },
  },
  "user-settings": { people: ["A", "B"] },
  "transaction-visibility": { people: ["A", "B", "C"] },
  notifications: { people: ["A", "B", "C"] },
  "login-logout": { people: ["A", "B"] },
};

export interface FixtureRow {
  runNo: number;
  testCase: string;
  item: string;
  value: string;
}

/** Every value of a run number, as rows of test_fixture. Passwords are not values (see test-run-secret.ts). */
export const makeFixtureRows = (runNo: number): FixtureRow[] => {
  const rows: FixtureRow[] = [];
  const usedBases = new Set<string>();

  for (const [testCase, rule] of Object.entries(FIXTURE_RULES)) {
    const add = (item: string, value: string | number) =>
      rows.push({ runNo, testCase, item, value: String(value) });

    for (const person of rule.people) {
      const partitions = partitionsOf(runNo, person);
      let base = makeUsernameBase(partitions.username);
      while (usedBases.has(base)) base = makeUsernameBase(partitions.username);
      usedBases.add(base);

      add(`${person}.usernameBase`, base);
      add(`${person}.firstName`, makeName(partitions.name));
      add(`${person}.lastName`, makeName(partitions.name));
      add(`${person}.phoneNumber`, makePhoneNumber(partitions.phone));
      add(`${person}.bankName`, pick(BANK_NAMES));
      add(`${person}.accountNumber`, digits(partitions.accountLength));
      for (const [name, partition] of Object.entries(partitions)) {
        add(`${person}.partition.${name}`, partition);
      }
    }
    for (const [item, make] of Object.entries(rule.values ?? {})) add(item, make());
  }
  return rows;
};
