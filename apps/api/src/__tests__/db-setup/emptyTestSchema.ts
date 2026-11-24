import prisma from "../../prisma";
import { assertTestDatabase } from "./testDb";

/** Empty every table of testschema (everything there belongs to a run number). Test database only. */
export const emptyTestSchema = async () => {
  assertTestDatabase();
  await prisma.$executeRawUnsafe("TRUNCATE TABLE testschema.test_fixture RESTART IDENTITY CASCADE");
};
