import { createBankAccountForUser, removeBankAccountById } from "../../bankaccount-db";

const Mutation = {
  createBankAccount: (obj: any, args: any, ctx: any) => {
    return createBankAccountForUser(ctx.user.id, args);
  },
  deleteBankAccount: async (obj: any, args: any, ctx: any) => {
    // false when the account does not exist or belongs to someone else
    return removeBankAccountById(ctx.user.id, args.id);
  },
};

export default Mutation;
