import React from "react";

import { Grid, Typography, Button, ListItem } from "@mui/material";
import { BankAccount } from "@rwa/shared";

export interface BankAccountListItemProps {
  bankAccount: BankAccount;
  deleteBankAccount: Function;
}

const BankAccountListItem: React.FC<BankAccountListItemProps> = ({
  bankAccount,
  deleteBankAccount,
}) => {
  return (
    <ListItem data-testid={`bankaccount-list-item-${bankAccount.id}`}>
      <Grid container direction="row" justifyContent="space-between" alignItems="flex-start">
        <Grid item>
          <Typography variant="body1" color="primary" gutterBottom>
            {bankAccount.bankName}
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            data-testid={`bankaccount-account-number-${bankAccount.id}`}
          >
            계좌 번호: {bankAccount.accountNumber}
          </Typography>
        </Grid>
        {bankAccount.visible && (
          <Grid item>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              data-testid="bankaccount-delete"
              onClick={() => {
                deleteBankAccount({ id: bankAccount.id });
              }}
            >
              삭제
            </Button>
          </Grid>
        )}
      </Grid>
    </ListItem>
  );
};

export default BankAccountListItem;
