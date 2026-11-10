import { createBankAccountForUser, removeBankAccountById } from "../../bankaccount-db";

const Mutation = {
  createBankAccount: (obj: any, args: any, ctx: any) => {
    return createBankAccountForUser(ctx.user.id, args);
  },
  deleteBankAccount: async (obj: any, args: any, ctx: any) => {
    await removeBankAccountById(args.id);
    return true;
  },
};

export default Mutation;
