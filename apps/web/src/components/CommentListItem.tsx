import React from "react";
import { Box, ListItem, ListItemText } from "@mui/material";

import { CommentResponseItem } from "@rwa/shared";

export interface CommentListItemProps {
  comment: CommentResponseItem;
}

const NAME_WIDTH_TEXT = "jwfdoiabcdefghijk"; // the name has exactly the width of this text

// YYYY/MM/DD HH:MM in the viewer's local time
const formatWhen = (value: Date | string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${two(d.getMonth() + 1)}/${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** The comment, and below it who wrote it and when. A long name is cut with "..." so the times stand in one line. */
const CommentListItem: React.FC<CommentListItemProps> = ({ comment }) => {
  return (
    <ListItem data-testid={`comment-list-item-${comment.id}`}>
      <ListItemText
        primary={comment.content}
        primaryTypographyProps={{
          sx: {
            fontSize: (theme) => `calc(${theme.typography.body1.fontSize} + 2px)`,
            overflowWrap: "anywhere",
          },
        }}
        secondaryTypographyProps={{ component: "div" }}
        secondary={
          <Box sx={{ display: "flex", gap: 2 }}>
            <Box
              data-testid={`comment-author-${comment.id}`}
              title={comment.userFullName}
              sx={{
                display: "grid",
                // an invisible text of the fixed width gives the box its size
                "&::after": {
                  content: `"${NAME_WIDTH_TEXT}"`,
                  height: 0,
                  overflow: "hidden",
                  visibility: "hidden",
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 0,
                  minWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {comment.userFullName}
              </Box>
            </Box>
            <span data-testid={`comment-time-${comment.id}`}>{formatWhen(comment.createdAt)}</span>
          </Box>
        }
      />
    </ListItem>
  );
};

export default CommentListItem;
