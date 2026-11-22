-- The folder tests/e2e/util was renamed to tests/e2e/fixture: the code kind follows it.
-- RENAME VALUE keeps every row that already uses the value (there are none yet).
ALTER TYPE "testschema"."CodeKind" RENAME VALUE 'util' TO 'fixture';
