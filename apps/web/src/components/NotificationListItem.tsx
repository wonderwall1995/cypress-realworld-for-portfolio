import React from "react";

import { styled } from "@mui/material/styles";

import {
  Check as CheckIcon,
  ThumbUpAltOutlined as LikeIcon,
  CommentRounded as CommentIcon,
  MonetizationOn as MonetizationOnIcon,
} from "@mui/icons-material";
import {
  Box,
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

// Use the notification's creation time, in the viewer's local time zone.
const formatCreatedAt = (value: Date | string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const two = (number: number) => String(number).padStart(2, "0");
  const yearMonth = `${date.getFullYear()}/${two(date.getMonth() + 1)}`;
  const dayTime = `${two(date.getDate())}/${two(date.getHours())}/${two(date.getMinutes())}`;
  return { yearMonth, dayTime, iso: date.toISOString() };
};

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
  const createdAt = formatCreatedAt(notification.createdAt);

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
      <ListItemText
        primaryTypographyProps={{ sx: { position: "relative" } }}
        primary={
          createdAt ? (
            <>
              {/* Preserve the original text's footprint, including long-name wrapping.
                The visible text and time share that space without resizing the row. */}
              <span aria-hidden="true" style={{ visibility: "hidden" }}>
                {listItemText}
              </span>
              <Box
                component="span"
                title={listItemText}
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 64,
                  top: "50%",
                  transform: "translateY(-50%)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {listItemText}
              </Box>
              <Box
                component="time"
                dateTime={createdAt.iso}
                data-testid={`notification-time-${notification.id}`}
                title={`${createdAt.yearMonth}/${createdAt.dayTime}`}
                aria-label={`알림 발생 시간 ${createdAt.yearMonth}/${createdAt.dayTime}`}
                sx={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 56,
                  fontFamily: "monospace",
                  fontSize: 11,
                  lineHeight: "12px",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  color: "text.secondary",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {createdAt.yearMonth}
                <br />
                {createdAt.dayTime}
              </Box>
            </>
          ) : (
            listItemText
          )
        }
      />
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
