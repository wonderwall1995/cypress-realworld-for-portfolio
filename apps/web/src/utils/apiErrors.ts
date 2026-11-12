/**
 * Turns what the server said into a short Korean sentence for the screen.
 * Works for a failed HTTP call ({ error: "..." }), a GraphQL error (message) and a lost connection.
 */
const KNOWN: [RegExp, string][] = [
  [/not enough balance/i, "선택한 계좌의 잔액이 부족합니다"],
  [
    /receiving bank account balance would be too large/i,
    "받는 계좌의 잔액 한도를 넘어서 이체할 수 없습니다",
  ],
  [/balance would be too large/i, "계좌 잔액 한도를 넘어서 입금할 수 없습니다"],
  [/password is not correct/i, "비밀번호가 맞지 않습니다"],
  [/cannot be deleted/i, "잔액이 있는 계좌는 삭제할 수 없습니다"],
  [/accountNumber must be/i, "계좌 번호는 숫자 9~12자리여야 합니다"],
  [/bankName is required/i, "은행 이름을 입력하세요"],
  [/bank account not found/i, "은행 계좌를 찾을 수 없습니다"],
  [/not (my|the receiver's|your) bank account/i, "선택한 계좌를 사용할 수 없습니다"],
  [/was deleted/i, "삭제된 계좌입니다"],
  [/two different bank accounts/i, "서로 다른 계좌를 선택해 주세요"],
  [/amount must be/i, "금액이 올바르지 않습니다"],
  [/choose (my|the receiver's) bank account/i, "은행 계좌를 선택해 주세요"],
];

export const DEFAULT_ERROR = "서버에서 처리하지 못했습니다. 잠시 뒤 다시 시도하세요";

export const apiErrorText = (error: any, fallback: string = DEFAULT_ERROR): string => {
  const raw: unknown = error?.response?.data?.error ?? error?.message;
  if (typeof raw !== "string" || raw === "") return fallback;
  const known = KNOWN.find(([pattern]) => pattern.test(raw));
  if (known) return known[1];
  // a refused request that has no sentence of its own: show the server's reason after the fallback
  return error?.response ? `${fallback} (${raw})` : fallback;
};
