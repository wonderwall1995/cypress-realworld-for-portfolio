export interface BankAccount {
  id: string;
  uuid: string;
  userId: string;
  bankName: string;
  accountNumber: string;
  visible: boolean;
  balance: number; // cents
  createdAt: Date;
  modifiedAt: Date;
}

export type BankAccountPayload = Pick<BankAccount, "userId" | "bankName" | "accountNumber">;
