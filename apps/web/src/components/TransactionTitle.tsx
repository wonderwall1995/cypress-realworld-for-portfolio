import React, { useContext } from "react";
import { styled } from "@mui/material/styles";
import { Typography } from "@mui/material";
import { TransactionResponseItem } from "@rwa/shared";
import { isExternalDeposit, isMoneySettled, getMoneyDirection, bankLabel } from "@rwa/shared";
import { CurrentUserIdContext } from "../utils/currentUserContext";

const PREFIX = "TransactionTitle";

const classes = {
  title: `${PREFIX}-title`,
  titleAction: `${PREFIX}-titleAction`,
  titleName: `${PREFIX}-titleName`,
};

const StyledTypography = styled(Typography)(({ theme }) => ({
  [`&.${classes.title}`]: {
    fontSize: 18,
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.fontSize,
    },
  },

  [`& .${classes.titleAction}`]: {
    fontSize: 18,
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.fontSize,
    },
  },

  [`& .${classes.titleName}`]: {
    fontSize: 18,
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.fontSize,
    },
    color: "#1A202C",
  },
})) as typeof Typography;

// the bank name may be long: cut it with "..." (generously, about 18 characters fit)
const BankName: React.FC<{ name: string; testId: string }> = ({ name, testId }) => (
  <Typography
    component="span"
    data-testid={testId}
    title={bankLabel(name)}
    sx={{
      display: "inline-block",
      maxWidth: "14em",
      minWidth: 0,
      flexShrink: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      verticalAlign: "bottom",
      fontSize: "inherit",
      color: "#1A202C",
    }}
  >
    {bankLabel(name)}
  </Typography>
);

const TransactionTitle: React.FC<{
  transaction: TransactionResponseItem;
}> = ({ transaction }) => {
  const userId = useContext(CurrentUserIdContext);
  const external = isExternalDeposit(transaction);
  const direction = userId ? getMoneyDirection(transaction, userId) : null;
  const bank = transaction.myAccount?.bankName;
  // "XXX 은행 계좌로 입금 되었습니다" / "XXX 은행 계좌에서 출금 되었습니다": only once the money has moved
  const moved = Boolean(bank) && isMoneySettled(transaction) && direction !== null;

  return (
    <StyledTypography color="textSecondary" className={classes.title} gutterBottom component="div">
      <div>
        <Typography
          data-testid={`transaction-sender-${transaction.id}`}
          className={classes.titleName}
          display="inline"
          component="span"
        >
          {transaction.senderName}
        </Typography>
        {external ? null : "님이 "}
        {!external && (
          <Typography
            data-testid={`transaction-receiver-${transaction.id}`}
            className={classes.titleName}
            display="inline"
            component="span"
          >
            {transaction.receiverName}
          </Typography>
        )}
        {!external && (
          <Typography
            data-testid={`transaction-action-${transaction.id}`}
            display="inline"
            className={classes.titleAction}
            component="span"
          >
            님에게 이체했습니다
          </Typography>
        )}
      </div>
      {moved && (
        <div
          data-testid={`transaction-bank-line-${transaction.id}`}
          style={{ display: "flex", whiteSpace: "nowrap", minWidth: 0 }}
        >
          <BankName name={bank!} testId={`transaction-bank-name-${transaction.id}`} />
          <span style={{ flexShrink: 0 }}>
            &nbsp;{direction === "in" ? "계좌로" : "계좌에서"}&nbsp;
          </span>
          <Typography
            component="span"
            data-testid={`transaction-move-word-${transaction.id}`}
            sx={{
              flexShrink: 0,
              fontSize: "inherit",
              fontWeight: 700,
              color: direction === "in" ? "success.main" : "error.main",
            }}
          >
            {direction === "in" ? "입금" : "출금"}
          </Typography>
          <span style={{ flexShrink: 0 }}>&nbsp;되었습니다</span>
        </div>
      )}
    </StyledTypography>
  );
};

export default TransactionTitle;
