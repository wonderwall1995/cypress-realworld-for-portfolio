import React, { useContext } from "react";
import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";
import { TransactionResponseItem } from "@rwa/shared";
import { bankLabel, formatAmount, getMoneyDirection, isMoneySettled } from "@rwa/shared";
import { CurrentUserIdContext } from "../utils/currentUserContext";

const PREFIX = "TransactionAmount";

const classes = {
  amountPositive: `${PREFIX}-amountPositive`,
  amountNegative: `${PREFIX}-amountNegative`,
  amountNeutral: `${PREFIX}-amountNeutral`,
};

const StyledTypography = styled(Typography)(({ theme }) => ({
  [`&.${classes.amountPositive}`]: {
    fontSize: 24,
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.body1.fontSize,
    },
    color: "#4CAF50",
  },

  [`&.${classes.amountNegative}`]: {
    fontSize: 24,
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.body1.fontSize,
    },
    color: "red",
  },

  // not mine, or money did not move yet (a pending request)
  [`&.${classes.amountNeutral}`]: {
    fontSize: 24,
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.body1.fontSize,
    },
    color: "rgba(0, 0, 0, 0.54)",
  },
})) as typeof Typography;

/**
 * The amount as the signed-in user sees it:
 *   money I received  -> green  +$30   (deposit)
 *   money I paid      -> red    -$30   (withdrawal)
 *   a pending request -> grey, with the sign it will have once it is accepted
 *   someone else's transaction -> grey, no sign
 */
const TransactionAmount: React.FC<{
  transaction: TransactionResponseItem;
}> = ({ transaction }) => {
  const userId = useContext(CurrentUserIdContext);
  const direction = userId ? getMoneyDirection(transaction, userId) : null;
  const settled = isMoneySettled(transaction);

  const className =
    direction && settled
      ? direction === "in"
        ? classes.amountPositive
        : classes.amountNegative
      : classes.amountNeutral;
  const sign = direction === "in" ? "+" : direction === "out" ? "-" : "";

  return (
    <Box sx={{ textAlign: "right" }}>
      <StyledTypography
        data-testid={`transaction-amount-${transaction.id}`}
        data-direction={direction ?? "none"}
        className={className}
        display="inline"
        component="span"
        color="primary"
      >
        {sign}
        {transaction.amount && formatAmount(transaction.amount)}
      </StyledTypography>
      {/* what is left in MY bank account after this transaction (never the other side's) */}
      {transaction.myAccount && transaction.myAccount.balanceAfter !== undefined && (
        <Typography
          variant="caption"
          color="textSecondary"
          component="div"
          data-testid={`transaction-balance-${transaction.id}`}
          sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5, whiteSpace: "nowrap" }}
        >
          <Box
            component="span"
            data-testid={`transaction-balance-bank-${transaction.id}`}
            sx={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "8em" }}
          >
            {bankLabel(transaction.myAccount.bankName)}
          </Box>
          <span>남은 잔액 {formatAmount(transaction.myAccount.balanceAfter)}</span>
        </Typography>
      )}
    </Box>
  );
};

export default TransactionAmount;
