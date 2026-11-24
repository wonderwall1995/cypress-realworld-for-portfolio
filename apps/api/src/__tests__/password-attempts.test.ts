// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "../prisma";
import { checkPasswordAgain, MAX_WRONG, WINDOW_MS } from "../password-attempts";
import { createUser } from "../user-db";
import { resetDatabase } from "./db-setup/reset";

const PASSWORD = "s3cret";
const START = 1_000_000;

describe("the password that is typed again before money moves", () => {
  let id = "";
  beforeEach(async () => {
    await resetDatabase(prisma);
    id = (
      await createUser({ firstName: "F", lastName: "L", username: "member", password: PASSWORD })
    ).id;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const wrong = (times: number, at = START) =>
    Promise.allSettled(Array.from({ length: times }, () => checkPasswordAgain(id, "wrong", at)));

  it("the right one passes, a wrong one is 403", async () => {
    await checkPasswordAgain(id, PASSWORD, START);
    await expect(checkPasswordAgain(id, "wrong", START)).rejects.toMatchObject({ status: 403 });
    await expect(checkPasswordAgain(id, undefined, START)).rejects.toMatchObject({ status: 403 });
  });

  it(`after ${MAX_WRONG} wrong ones even the right one is 429, until the time has passed`, async () => {
    await wrong(MAX_WRONG);
    await expect(checkPasswordAgain(id, PASSWORD, START)).rejects.toMatchObject({ status: 429 });
    await expect(checkPasswordAgain(id, PASSWORD, START + WINDOW_MS - 1)).rejects.toMatchObject({
      status: 429,
    });
    await checkPasswordAgain(id, PASSWORD, START + WINDOW_MS);
  });

  it("the right one in time starts the count again", async () => {
    await wrong(MAX_WRONG - 1);
    await checkPasswordAgain(id, PASSWORD, START);
    await wrong(MAX_WRONG - 1);
    await checkPasswordAgain(id, PASSWORD, START);
  });

  it("many wrong ones at the same moment cannot pass together", async () => {
    const results = await wrong(MAX_WRONG + 5);
    const statuses = results.map((result) => (result as PromiseRejectedResult).reason.status);
    expect(statuses.filter((status) => status === 403)).toHaveLength(MAX_WRONG);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
  });

  it("one member's wrong ones do not block another", async () => {
    const other = await createUser({
      firstName: "F",
      lastName: "L",
      username: "other",
      password: PASSWORD,
    });
    await wrong(MAX_WRONG);
    await checkPasswordAgain(other.id, PASSWORD, START);
  });
});
