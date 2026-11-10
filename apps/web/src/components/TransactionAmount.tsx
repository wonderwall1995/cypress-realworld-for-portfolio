import React from "react";
import { styled } from "@mui/material/styles";
import { Typography } from "@mui/material";
import { TransactionResponseItem } from "@rwa/shared";
import { isRequestTransaction, formatAmount } from "@rwa/shared";

const PREFIX = "TransactionAmount";

const classes = {
  amountPositive: `${PREFIX}-amountPositive`,
  amountNegative: `${PREFIX}-amountNegative`,
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
})) as typeof Typography;

const TransactionAmount: React.FC<{
  transaction: TransactionResponseItem;
}> = ({ transaction }) => {
  return (
    <StyledTypography
      data-testid={`transaction-amount-${transaction.id}`}
      className={
        isRequestTransaction(transaction) ? classes.amountPositive : classes.amountNegative
      }
      display="inline"
      component="span"
      color="primary"
    >
      {isRequestTransaction(transaction) ? "+" : "-"}
      {transaction.amount && formatAmount(transaction.amount)}
    </StyledTypography>
  );
};

export default TransactionAmount;
