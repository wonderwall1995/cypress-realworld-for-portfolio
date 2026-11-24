import React from "react";
import { List } from "@mui/material";

import CommentListItem from "./CommentListItem";
import { CommentResponseItem } from "@rwa/shared";

export interface CommentsListProps {
  comments: CommentResponseItem[];
}

const CommentsList: React.FC<CommentsListProps> = ({ comments }) => {
  return (
    <List data-testid="comments-list">
      {comments &&
        comments.map((comment) => <CommentListItem key={comment.id} comment={comment} />)}
    </List>
  );
};

export default CommentsList;
