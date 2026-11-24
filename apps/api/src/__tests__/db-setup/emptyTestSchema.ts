import prisma from "../../prisma";
import { assertTestDatabase } from "./testDb";

/** Empty every table of testschema (all of them belong to a run number, except the versions). Test database only. */
export const emptyTestSchema = async () => {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE testschema.test_fixture, testschema.test_version RESTART IDENTITY CASCADE"
  );
};
