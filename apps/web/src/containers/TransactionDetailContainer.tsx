import React, { useEffect } from "react";
import { useMachine, useActor } from "@xstate/react";
import { useParams } from "react-router-dom";
import { Alert } from "@mui/material";
import TransactionDetail from "../components/TransactionDetail";
import { Transaction } from "@rwa/shared";
import { transactionDetailMachine } from "../machines/transactionDetailMachine";
import { first } from "lodash/fp";
import { Interpreter } from "xstate";
import { AuthMachineContext, AuthMachineEvents } from "../machines/authMachine";

export interface Props {
  authService: Interpreter<AuthMachineContext, any, AuthMachineEvents, any>;
}
interface Params {
  transactionId: string;
}

const TransactionDetailsContainer: React.FC<Props> = ({ authService }) => {
  const { transactionId }: Params = useParams();
  const [authState] = useActor(authService);
  const [transactionDetailState, sendTransactionDetail] = useMachine(transactionDetailMachine);
  useEffect(() => {
    sendTransactionDetail("FETCH", { transactionId });
  }, [sendTransactionDetail, transactionId]);

  const transactionLike = (transactionId: Transaction["id"]) =>
    sendTransactionDetail("CREATE", { entity: "LIKE", transactionId });

  const transactionComment = (payload: any) =>
    sendTransactionDetail("CREATE", { entity: "COMMENT", ...payload });

  const transaction = first(transactionDetailState.context?.results);
  const currentUser = authState?.context?.user;

  return (
    <>
      {transactionDetailState.matches("idle") && (
        <div>
          불러오는 중...
          <br />
        </div>
      )}
      {transactionDetailState.matches("failure") && (
        <Alert severity="info" data-testid="transaction-detail-failure">
          {transaction
            ? "요청을 처리하지 못했습니다. 새로고침해 주세요."
            : "거래를 볼 수 없습니다. 없는 거래이거나 볼 권한이 없는 거래입니다."}
        </Alert>
      )}
      {currentUser && transactionDetailState.matches("success") && (
        <TransactionDetail
          transaction={transaction}
          transactionLike={transactionLike}
          transactionComment={transactionComment}
          currentUser={currentUser}
        />
      )}
    </>
  );
};

export default TransactionDetailsContainer;
