// Runs before every test file: make sure Prisma only ever sees the test database.
import { useTestDatabase } from "./testDb";

useTestDatabase();
