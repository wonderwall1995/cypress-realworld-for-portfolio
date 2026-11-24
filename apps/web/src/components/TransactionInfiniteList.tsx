import React, { useEffect, useRef, useState } from "react";
import { styled } from "@mui/material/styles";
import { get } from "lodash/fp";
import { useTheme, useMediaQuery, Divider } from "@mui/material";
import { CellMeasurer, CellMeasurerCache, InfiniteLoader, List, Index } from "react-virtualized";
import "react-virtualized/styles.css"; // only needs to be imported once

import TransactionItem from "./TransactionItem";
import { TransactionResponseItem, TransactionPagination } from "@rwa/shared";

const PREFIX = "TransactionInfiniteList";

const classes = {
  transactionList: `${PREFIX}-transactionList`,
};

const StyledInfiniteLoader = styled(InfiniteLoader)(({ theme }) => ({
  [`& .${classes.transactionList}`]: {
    width: "100%",
    minHeight: "80vh",
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
}));

const removePx = (str: string) => +str.slice(0, str.length - 2);

export interface TransactionListProps {
  transactions: TransactionResponseItem[];
  loadNextPage: Function;
  pagination: TransactionPagination;
}

const TransactionInfiniteList: React.FC<TransactionListProps> = ({
  transactions,
  loadNextPage,
  pagination,
}) => {
  const theme = useTheme();
  const isXsBreakpoint = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [mobileListWidth, setMobileListWidth] = useState(304);
  useEffect(() => {
    const container = listContainerRef.current;
    if (!isXsBreakpoint || !container) return;
    const observer = new ResizeObserver(() => setMobileListWidth(container.clientWidth));
    observer.observe(container);
    return () => observer.disconnect();
  }, [isXsBreakpoint]);

  // Every row is measured: a long name takes more lines, and a fixed height would let the next row cover them.
  // A measured height belongs to the transaction, not to the place in the list (a filter changes the places).
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;
  const rowHeights = useRef(
    new CellMeasurerCache({
      fixedWidth: true,
      defaultHeight: removePx(theme.spacing(24)),
      keyMapper: (index: number) => transactionsRef.current[index]?.id ?? `row-${index}`,
    })
  ).current;
  const listRef = useRef<List | null>(null);
  useEffect(() => {
    listRef.current?.recomputeRowHeights();
  }, [transactions]);
  useEffect(() => {
    rowHeights.clearAll(); // the width of the list changes with the screen
    listRef.current?.recomputeRowHeights();
  }, [isXsBreakpoint, isMobile, mobileListWidth, rowHeights]);

  const itemCount = pagination.hasNextPages ? transactions.length + 1 : transactions.length;

  const loadMoreItems = () => {
    return new Promise((resolve) => {
      return resolve(pagination.hasNextPages && loadNextPage(pagination.page + 1));
    });
  };

  const isRowLoaded = (params: Index) =>
    !pagination.hasNextPages || params.index < transactions.length;

  // @ts-ignore
  function rowRenderer({ key, index, style, parent }) {
    const transaction = get(index, transactions);

    if (index < transactions.length) {
      return (
        <CellMeasurer key={key} cache={rowHeights} parent={parent} rowIndex={index} columnIndex={0}>
          <div style={style}>
            <TransactionItem transaction={transaction} />
            <Divider variant={isMobile ? "fullWidth" : "inset"} />
          </div>
        </CellMeasurer>
      );
    }
  }

  return (
    <StyledInfiniteLoader
      isRowLoaded={isRowLoaded}
      loadMoreRows={loadMoreItems}
      rowCount={itemCount}
      threshold={2}
    >
      {({ onRowsRendered, registerChild }) => (
        <div
          ref={listContainerRef}
          data-testid="transaction-list"
          className={classes.transactionList}
        >
          <List
            rowCount={itemCount}
            ref={(list) => {
              listRef.current = list;
              registerChild(list);
            }}
            deferredMeasurementCache={rowHeights}
            onRowsRendered={onRowsRendered}
            height={isXsBreakpoint ? removePx(theme.spacing(74)) : removePx(theme.spacing(88))}
            width={isXsBreakpoint ? mobileListWidth : removePx(theme.spacing(90))}
            rowHeight={rowHeights.rowHeight}
            rowRenderer={rowRenderer}
          />
        </div>
      )}
    </StyledInfiniteLoader>
  );
};

export default TransactionInfiniteList;
