import React from "react";
import { Box, Button, Typography } from "@mui/material";

interface SnapshotTable {
  name: string;
  columns: string[];
  rowCount: number;
  rows: Array<Record<string, unknown>>;
}

interface Snapshot {
  takenAt: string;
  rowLimit: number;
  tables: SnapshotTable[];
}

const PAGE_SIZE = 30; // rows shown at a time

const showValue = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const CELL_SX = {
  maxWidth: 220,
  px: 1,
  py: 0.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #e8e8e8",
  textAlign: "left",
} as const;

/**
 * The DB tab: a snapshot of the database. The screen does not connect to the database.
 * It asks the server for a snapshot (GET /api/demoSnapshot), which is a read-only copy of the rows
 * taken at this moment, and shows it like a small database tool:
 *
 *   | DB columns (header of the grid)
 *   DB tables (pick one)  | DB rows (30 at a time)
 */
export default function DbSnapshot() {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<string | undefined>();
  const [page, setPage] = React.useState(0);

  const take = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/demoSnapshot", { credentials: "same-origin" });
      if (!response.ok) throw new Error(`서버가 ${response.status}로 답했습니다`);
      setSnapshot(await response.json());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  // a new snapshot every time the DB tab opens
  React.useEffect(() => {
    void take();
  }, [take]);

  // the chosen table stays chosen after a new snapshot; the first table is the start
  const table = snapshot?.tables.find((item) => item.name === selected) ?? snapshot?.tables[0];
  const pageCount = table ? Math.max(1, Math.ceil(table.rows.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const rows = table ? table.rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) : [];
  const from = rows.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = safePage * PAGE_SIZE + rows.length;

  return (
    <Box
      data-testid="demo-db-area"
      sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderBottom: "1px solid #ddd" }}>
        <Typography variant="caption" color="text.secondary" data-testid="demo-db-time" sx={{ flex: 1 }}>
          {snapshot ? `찍은 시각 ${new Date(snapshot.takenAt).toLocaleTimeString()}` : "스냅샷을 찍는 중…"}
        </Typography>
        <Button size="small" variant="outlined" onClick={take} disabled={loading} data-testid="demo-db-refresh">
          새로 찍기
        </Button>
      </Box>

      {error && (
        <Typography variant="body2" color="error" data-testid="demo-db-error" sx={{ p: 1.5 }}>
          스냅샷을 가져오지 못했습니다: {error}
        </Typography>
      )}

      {snapshot && table && (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
          {/* left: the tables (pick one) */}
          <Box
            data-testid="demo-db-tablelist"
            sx={{ width: 150, flexShrink: 0, overflow: "auto", borderRight: "1px solid #ddd", background: "#fafafa" }}
          >
            {snapshot.tables.map((item) => {
              const active = item.name === table.name;
              return (
                <Box
                  key={item.name}
                  component="button"
                  type="button"
                  data-testid="demo-db-table-item"
                  data-table={item.name}
                  data-active={active}
                  onClick={() => {
                    setSelected(item.name);
                    setPage(0);
                  }}
                  sx={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: 0,
                    // a line between the tables; each row keeps only 2px of space above and below
                    borderBottom: "1px solid #c8c8c8",
                    borderLeft: "3px solid",
                    borderLeftColor: active ? "#1976d2" : "transparent",
                    background: active ? "#e3f2fd" : "transparent",
                    px: 1.25,
                    py: "2px",
                    cursor: "pointer",
                    fontFamily: "monospace",
                    fontSize: 12.5,
                    color: "#1d1d1d",
                    "&:hover": { background: active ? "#e3f2fd" : "#f0f0f0" },
                  }}
                >
                  <div style={{ fontWeight: active ? 700 : 400 }}>{item.name}</div>
                  <div style={{ color: "#757575", fontSize: 11 }}>{item.rowCount}행</div>
                </Box>
              );
            })}
          </Box>

          {/* right: the columns (header) and the rows of the picked table, 30 at a time */}
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Box data-testid="demo-db-grid" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              {table.rows.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 1.5 }}>
                  {table.name} 테이블은 비어 있습니다
                </Typography>
              ) : (
                <Box component="table" sx={{ borderCollapse: "collapse", fontFamily: "monospace", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {table.columns.map((column) => (
                        <Box
                          component="th"
                          key={column}
                          sx={{ ...CELL_SX, background: "#f5f5f5", fontWeight: 600, position: "sticky", top: 0, zIndex: 1 }}
                        >
                          {column}
                        </Box>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={safePage * PAGE_SIZE + index} data-testid="demo-db-row">
                        {table.columns.map((column) => {
                          const text = showValue(row[column]);
                          return (
                            <Box
                              component="td"
                              key={column}
                              title={text}
                              sx={{ ...CELL_SX, ...(row[column] === null ? { color: "#9e9e9e" } : {}) }}
                            >
                              {text}
                            </Box>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </Box>
              )}
            </Box>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.5, borderTop: "1px solid #ddd" }}
            >
              <Typography variant="caption" color="text.secondary" data-testid="demo-db-page-info" sx={{ flex: 1 }}>
                {table.name} · {from}–{to} / {table.rowCount}행
                {table.rows.length < table.rowCount ? ` (최신 ${table.rows.length}행 중)` : ""}
              </Typography>
              <Button
                size="small"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 0}
                data-testid="demo-db-page-prev"
              >
                이전
              </Button>
              <Typography variant="caption" data-testid="demo-db-page-number">
                {safePage + 1} / {pageCount}
              </Typography>
              <Button
                size="small"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount - 1}
                data-testid="demo-db-page-next"
              >
                다음
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
