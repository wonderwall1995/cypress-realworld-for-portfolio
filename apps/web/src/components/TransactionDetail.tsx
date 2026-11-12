import React from "react";
import { styled } from "@mui/material/styles";
import { Typography, Grid, Avatar, Paper, IconButton } from "@mui/material";
import { AvatarGroup } from "@mui/material";
import { ThumbUpAltOutlined as LikeIcon, CommentRounded as CommentIcon } from "@mui/icons-material";
import { TransactionResponseItem, User } from "@rwa/shared";
import CommentForm from "./CommentForm";
import { currentUserLikesTransaction } from "@rwa/shared";
import CommentsList from "./CommentList";
import TransactionTitle from "./TransactionTitle";
import TransactionAmount from "./TransactionAmount";

const PREFIX = "TransactionDetail";

const classes = {
  paper: `${PREFIX}-paper`,
  paperComments: `${PREFIX}-paperComments`,
  avatar: `${PREFIX}-avatar`,
  headline: `${PREFIX}-headline`,
  avatarLarge: `${PREFIX}-avatarLarge`,
  avatarGroup: `${PREFIX}-avatarGroup`,
};

const StyledPaper = styled(Paper)(({ theme }) => ({
  [`&.${classes.paper}`]: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },

  [`& .${classes.paperComments}`]: {
    marginTop: theme.spacing(6),
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },

  [`& .${classes.avatar}`]: {
    width: theme.spacing(2),
  },

  [`& .${classes.headline}`]: {
    marginTop: theme.spacing(4),
  },

  [`& .${classes.avatarLarge}`]: {
    width: theme.spacing(7),
    height: theme.spacing(7),
  },

  [`& .${classes.avatarGroup}`]: {
    margin: 10,
  },
}));

type TransactionProps = {
  transaction: TransactionResponseItem;
  transactionLike: Function;
  transactionComment: Function;
  currentUser: User;
};

const TransactionDetail: React.FC<TransactionProps> = ({
  transaction,
  transactionLike,
  transactionComment,
  currentUser,
}) => {
  return (
    <StyledPaper className={classes.paper}>
      <Typography
        component="h2"
        variant="h6"
        color="primary"
        gutterBottom
        data-testid="transaction-detail-header"
      >
        거래 상세
      </Typography>
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        data-testid={`transaction-item-${transaction.id}`}
      >
        <Grid item className={classes.headline}>
          <Grid container direction="row">
            <AvatarGroup className={classes.avatarGroup} max={2}>
              <Avatar
                data-testid="transaction-sender-avatar"
                className={classes.avatarLarge}
                src={transaction.senderAvatar}
              />
              <Avatar
                data-testid="transaction-receiver-avatar"
                className={classes.avatarLarge}
                src={transaction.receiverAvatar}
              />
            </AvatarGroup>
            {/* eat up space to right of AvatarGroup: */}
            <Grid item sx={{ width: "100%" }} />
          </Grid>
          <Grid container direction="column" justifyContent="flex-start" alignItems="flex-start">
            <Grid item></Grid>
            <Grid item>
              <TransactionTitle transaction={transaction} />
            </Grid>
            <Grid item>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
                data-testid="transaction-description"
              >
                {transaction.description}
              </Typography>
            </Grid>
          </Grid>
        </Grid>
        <Grid item>
          <TransactionAmount transaction={transaction} />
        </Grid>
      </Grid>
      <Grid container direction="row" justifyContent="flex-start" alignItems="center" spacing={2}>
        <Grid item>
          <Grid
            container
            direction="row"
            justifyContent="flex-start"
            alignItems="center"
            spacing={2}
          >
            <Grid item data-testid={`transaction-like-count-${transaction.id}`}>
              {transaction.likes ? transaction.likes.length : 0}{" "}
            </Grid>
            <Grid item>
              <IconButton
                color="primary"
                disabled={currentUserLikesTransaction(currentUser, transaction)}
                onClick={() => transactionLike(transaction.id)}
                data-testid={`transaction-like-button-${transaction.id}`}
                size="large"
              >
                <LikeIcon />
              </IconButton>
            </Grid>
            <Grid item></Grid>
          </Grid>
          <Grid item>
            <CommentForm
              transactionId={transaction.id}
              transactionComment={(payload) => transactionComment(payload)}
            />
          </Grid>
        </Grid>
      </Grid>
      {transaction.comments.length > 0 && (
        <Paper className={classes.paperComments}>
          <Typography component="h2" variant="h6" color="primary" gutterBottom>
            <CommentIcon /> 댓글
          </Typography>
          <CommentsList comments={transaction.comments} />
        </Paper>
      )}
    </StyledPaper>
  );
};

export default TransactionDetail;
