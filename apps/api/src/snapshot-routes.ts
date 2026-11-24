import express from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { asyncHandler } from "./async-handler";

const router = express.Router();

/** The most rows that one table of the snapshot carries (the newest ones). */
const ROW_LIMIT = 200;

/**
 * The security place of the snapshot.
 *
 * The demo screen never talks to the database. It asks for a snapshot (a read-only copy of the rows
 * taken at this moment), and everything that leaves the server goes through this list first.
 * Right now it is empty: every column is shown. To hide a column later, add it here, for example
 *   { users: ["password", "email", "phoneNumber"] }
 * The key is the table name (the name in the database), the value is the list of column names.
 */
const HIDDEN_COLUMNS: Record<string, string[]> = {};

interface SnapshotTable {
  /** the table name in the database, for example users */
  name: string;
  /** the columns that are shown (hidden columns are removed) */
  columns: string[];
  /** the number of rows in the table now */
  rowCount: number;
  /** the newest rows, at most ROW_LIMIT */
  rows: Array<Record<string, unknown>>;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

// GET /demoSnapshot - a read-only copy of every table. It only reads (count, findMany).
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const tables: SnapshotTable[] = [];

    for (const model of Prisma.dmmf.datamodel.models) {
      const name = model.dbName ?? model.name;
      const hidden = HIDDEN_COLUMNS[name] ?? [];
      const columns = model.fields
        .filter((field) => field.kind === "scalar" || field.kind === "enum")
        .map((field) => field.name)
        .filter((column) => !hidden.includes(column));

      const delegate = (prisma as any)[lowerFirst(model.name)];
      const hasCreatedAt = model.fields.some((field) => field.name === "createdAt");
      const [rowCount, rows] = await Promise.all([
        delegate.count(),
        delegate.findMany({
          take: ROW_LIMIT,
          ...(hasCreatedAt ? { orderBy: { createdAt: "desc" } } : {}),
        }),
      ]);

      tables.push({
        name,
        columns,
        rowCount,
        rows: (rows as Array<Record<string, unknown>>).map((row) =>
          Object.fromEntries(columns.map((column) => [column, row[column]]))
        ),
      });
    }

    res.json({ takenAt: new Date().toISOString(), rowLimit: ROW_LIMIT, tables });
  })
);

export default router;
