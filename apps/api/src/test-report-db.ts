/**
 * The records and the report of one platform. The Web and the App have tables of their own, of the same shape.
 * A report is written once, when the platform's run of a number ends (finished or blocked).
 */
import { CodeKind, ReportResult, TestPlatform } from "@prisma/client";
import { DbClient } from "./prisma";

// The two record tables (and the two report tables) have the same columns, so the rest of the code sees one type.
export const recordsOf = (tx: DbClient, platform: TestPlatform) =>
  platform === "web" ? tx.webTestRecord : (tx.appTestRecord as unknown as typeof tx.webTestRecord);
export const reportsOf = (tx: DbClient, platform: TestPlatform) =>
  platform === "web" ? tx.webTestReport : (tx.appTestReport as unknown as typeof tx.webTestReport);

/** true: all code of that kind passed. false: something failed. null: none ran. A retried test counts by its last try. */
const readVerdicts = async (tx: DbClient, runNo: number, platform: TestPlatform) => {
  const records = await recordsOf(tx, platform).findMany({
    where: { runNo },
    orderBy: [{ attempt: "asc" }, { startedAt: "asc" }, { id: "asc" }],
  });
  const lastTry = new Map<string, number>(); // test -> the id of its spec row
  for (const { kind, testCase, name, id } of records) {
    if (kind === "spec") lastTry.set(`${testCase}/${name}`, id);
  }
  const counted = new Set(lastTry.values());

  const allPassed = (kind: CodeKind): boolean | null => {
    const ran = records.filter(
      (row) => row.kind === kind && row.status !== "skipped" && counted.has(row.parentId ?? row.id)
    );
    return ran.length === 0 ? null : ran.every((row) => row.status === "passed");
  };
  return { specOk: allPassed("spec"), commonOk: allPassed("common"), apiOk: allPassed("api") };
};

export const writeReport = async (
  tx: DbClient,
  runNo: number,
  platform: TestPlatform,
  status: "finished" | "blocked",
  now: Date
) => {
  // a blocked run has no verdicts: it is left out of statistics (what ran before it stopped is in the records)
  const verdicts =
    status === "finished"
      ? await readVerdicts(tx, runNo, platform)
      : { specOk: null, commonOk: null, apiOk: null };
  const passed =
    verdicts.specOk === true && verdicts.commonOk !== false && verdicts.apiOk !== false;
  const result: ReportResult = status === "blocked" ? "blocked" : passed ? "passed" : "failed";
  await reportsOf(tx, platform).create({ data: { runNo, ...verdicts, result, reportedAt: now } });
};

/** The final result of a number, from the view that Grafana reads too: pending, passed, failed or blocked. */
export const finalResultOf = async (tx: DbClient, runNo: number): Promise<string> => {
  const rows = await tx.$queryRaw<{ final_result: string }[]>`
    SELECT final_result FROM testschema.final_test_report WHERE run_no = ${runNo}`;
  return rows[0].final_result;
};
