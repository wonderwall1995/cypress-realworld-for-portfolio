/**
 * Live notifications (Server-Sent Events): GET /api/notifications/stream
 *
 * A client opens the stream once. When a notification row has been written AND its database
 * transaction has been committed, the server sends that one notification to the person it is
 * for, and to nobody else. There is no polling of the database: nothing happens until a
 * notification is made.
 *
 *   event: notification
 *   data: <one item of GET /api/notifications, same JSON>
 *
 * Rules:
 *  - at most MAX_STREAMS_PER_USER open streams per member; the oldest one is closed for a new one
 *  - a comment line ": ping" every 25 seconds keeps proxies and mobile networks from closing an idle stream
 *  - nothing is replayed. A client reads GET /api/notifications after every (re)connect to catch up
 *  - logout closes the streams of that login session; server shutdown closes all of them
 *  - one process only: the open streams live in this process's memory
 */
import type { Request, Response } from "express";
import type { NotificationType } from "@rwa/shared";
import { formatNotificationsForApiResponse } from "./notification-api";

export const MAX_STREAMS_PER_USER = 3;
export const DEFAULT_HEARTBEAT_MS = 25_000;
export const RETRY_MS = 5_000;

interface Stream {
  userId: string;
  sessionId?: string;
  res: Response;
  timer: NodeJS.Timeout;
}

// userId -> open streams, oldest first (a Set keeps insertion order)
const streams = new Map<string, Set<Stream>>();

// read when a stream opens, so a test can use a short time
const heartbeatMs = () =>
  Number(process.env.NOTIFICATION_STREAM_HEARTBEAT_MS) || DEFAULT_HEARTBEAT_MS;

const forget = (stream: Stream) => {
  clearInterval(stream.timer);
  const set = streams.get(stream.userId);
  if (!set) return;
  set.delete(stream);
  if (set.size === 0) streams.delete(stream.userId);
};

const close = (stream: Stream) => {
  forget(stream);
  if (!stream.res.writableEnded) stream.res.end();
};

/** Open the stream for the signed-in member (the caller has already checked the login). */
export const openNotificationStream = (req: Request, res: Response): void => {
  const userId = req.user?.id as string;

  // a stream lives as long as the client wants: no socket time limit, small messages sent at once
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // a reverse proxy must not hold the messages back
  res.flushHeaders();
  res.write(`retry: ${RETRY_MS}\n\n`);

  const stream: Stream = {
    userId,
    sessionId: req.sessionID,
    res,
    timer: setInterval(() => {
      if (!res.writableEnded) res.write(": ping\n\n");
    }, heartbeatMs()),
  };
  stream.timer.unref(); // an open stream alone must not keep the process alive

  const set = streams.get(userId) ?? new Set<Stream>();
  streams.set(userId, set);
  set.add(stream);
  while (set.size > MAX_STREAMS_PER_USER) close(set.values().next().value as Stream);

  req.on("close", () => forget(stream));
};

/**
 * Send notifications that are ALREADY COMMITTED to the members they are for.
 * Call this after the database transaction has finished, never inside it:
 * a rolled-back notification must not go out.
 */
export const publishNotifications = async (notifications: NotificationType[]): Promise<void> => {
  // members with no open stream cost nothing: no name lookups, no writes
  const open = notifications.filter((n) => streams.has(n.userId));
  if (open.length === 0) return;
  try {
    const items = await formatNotificationsForApiResponse(open);
    for (const item of items) {
      for (const stream of streams.get(item.userId) ?? []) {
        if (!stream.res.writableEnded) {
          stream.res.write(`event: notification\ndata: ${JSON.stringify(item)}\n\n`);
        }
      }
    }
  } catch (error) {
    // the notification is saved; a failed push only means the client reads it with its next GET
    console.error("notification push failed", error);
  }
};

/** Logout: close the streams opened by this login session. */
export const closeStreamsOfSession = (sessionId: string | undefined): void => {
  if (!sessionId) return;
  for (const set of [...streams.values()]) {
    for (const stream of [...set]) if (stream.sessionId === sessionId) close(stream);
  }
};

/** Server shutdown: close every open stream so the shutdown is not held up by them. */
export const closeAllStreams = (): void => {
  for (const set of [...streams.values()]) for (const stream of [...set]) close(stream);
};

/** For tests and for the server's own information. */
export const openStreamCount = (userId?: string): number =>
  userId
    ? (streams.get(userId)?.size ?? 0)
    : [...streams.values()].reduce((sum, set) => sum + set.size, 0);
