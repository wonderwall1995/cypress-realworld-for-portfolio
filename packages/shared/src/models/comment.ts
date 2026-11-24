export interface Comment {
  id: string;
  uuid: string;
  content: string;
  userId: string;
  transactionId: string;
  createdAt: Date;
  modifiedAt: Date;
}

/** A comment as the API gives it: with the name of the person who wrote it (last name, first name). */
export interface CommentResponseItem extends Comment {
  userFullName: string;
}
