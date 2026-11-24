import React from "react";

import { styled } from "@mui/material/styles";

import {
  Check as CheckIcon,
  ThumbUpAltOutlined as LikeIcon,
  CommentRounded as CommentIcon,
  MonetizationOn as MonetizationOnIcon,
} from "@mui/icons-material";
import {
  Button,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  ListItem,
  IconButton,
} from "@mui/material";
import {
  isCommentNotification,
  isLikeNotification,
  isPaymentNotification,
  isPaymentReceivedNotification,
} from "@rwa/shared";
import { NotificationResponseItem } from "@rwa/shared";

export interface NotificationListItemProps {
  notification: NotificationResponseItem;
  updateNotification: Function;
}

const READ_OPACITY = 0.65; // paler than an unread one, but the text can still be read

const PREFIX = "NotificationListItem";

const classes = {
  card: `${PREFIX}-card`,
  title: `${PREFIX}-title`,
  green: `${PREFIX}-green`,
  blue: `${PREFIX}-blue`,
};

const StyledListItem = styled(ListItem)({
  [`& .${classes.card}`]: {
    minWidth: "100%",
  },
  [`& .${classes.title}`]: {
    fontSize: 18,
  },
  [`& .${classes.green}`]: {
    color: "#4CAF50",
  },
  [`& .${classes.blue}`]: {
    color: "blue",
  },
});

const NotificationListItem: React.FC<NotificationListItemProps> = ({
  notification,
  updateNotification,
}) => {
  const theme = useTheme();
  let listItemText = undefined;
  let listItemIcon = undefined;
  const xsBreakpoint = useMediaQuery(theme.breakpoints.only("xs"));

  if (isCommentNotification(notification)) {
    listItemIcon = <CommentIcon />;
    listItemText = `${notification.userFullName}님이 거래에 댓글을 남겼습니다.`;
  }

  if (isLikeNotification(notification)) {
    listItemIcon = <LikeIcon />;
    listItemText = `${notification.userFullName}님이 거래에 좋아요를 눌렀습니다.`;
  }

  if (isPaymentNotification(notification)) {
    if (isPaymentReceivedNotification(notification)) {
      listItemIcon = <MonetizationOnIcon className={classes.green} />;
      listItemText = `${notification.userFullName}님이 이체했습니다.`;
    }
  }

  return (
    <StyledListItem
      data-testid={`notification-list-item-${notification.id}`}
      sx={{ opacity: notification.isRead ? READ_OPACITY : 1 }}
    >
      <ListItemIcon>{listItemIcon!}</ListItemIcon>
      <ListItemText primary={listItemText} />
      {!notification.isRead && xsBreakpoint && (
        <IconButton
          aria-label="읽음으로 표시"
          color="primary"
          onClick={() => updateNotification({ id: notification.id, isRead: true })}
          data-testid={`notification-mark-read-${notification.id}`}
          size="large"
        >
          <CheckIcon />
        </IconButton>
      )}
      {!notification.isRead && !xsBreakpoint && (
        <Button
          color="primary"
          size="small"
          onClick={() => updateNotification({ id: notification.id, isRead: true })}
          data-testid={`notification-mark-read-${notification.id}`}
        >
          확인
        </Button>
      )}
    </StyledListItem>
  );
};

export default NotificationListItem;
