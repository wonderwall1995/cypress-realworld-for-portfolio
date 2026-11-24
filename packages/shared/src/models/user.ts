export enum DefaultPrivacyLevel {
  public = "public",
  private = "private",
  contacts = "contacts",
}

export interface User {
  id: string;
  uuid: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  email: string;
  phoneNumber: string;
  balance: number;
  avatar: string;
  defaultPrivacyLevel: DefaultPrivacyLevel;
  createdAt: Date;
  modifiedAt: Date;
}

/** Another member, as the user list and the search give them. */
export type OtherUser = Omit<User, "password" | "balance"> & {
  /** Money can be sent to this member: there is at least one bank account that is not deleted. */
  hasBankAccount: boolean;
};

export type UserSettingsPayload = Pick<
  User,
  "firstName" | "lastName" | "email" | "phoneNumber" | "defaultPrivacyLevel"
>;

export type SignInPayload = Pick<User, "username" | "password"> & {
  remember?: Boolean;
};

export type SignUpPayload = Pick<
  User,
  "username" | "password" | "firstName" | "lastName" | "phoneNumber"
>;
