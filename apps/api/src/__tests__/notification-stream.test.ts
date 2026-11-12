// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach, afterAll, beforeAll } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { DefaultPrivacyLevel, PaymentNotificationStatus } from "@rwa/shared";
import prisma from "../prisma";
import { createUser } from "../user-db";
import { createPaymentNotification } from "../notification-db";
import { createLikes, createComments } from "../social-db";
import notificationRoutes from "../notification-routes";
import {
  closeAllStreams,
  closeStreamsOfSession,
  MAX_STREAMS_PER_USER,
  openStreamCount,
} from "../notification-stream";
import { resetDatabase } from "./db-setup/reset";
import { createTx, fundUser } from "./db-setup/accounts";

// A tiny server with only the notification routes. "x-user" is the signed-in member,
// "x-session" the login session (the real login is not what is tested here).
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const user = req.header("x-user");
  (req as any).isAuthenticated = () => Boolean(user);
  if (user) (req as any).user = { id: user };
  (req as any).sessionID = req.header("x-session");
  next();
});
app.use("/api/notifications", notificationRoutes);

let server: http.Server;
let port = 0;
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  port = (server.address() as AddressInfo).port;
});
afterAll(async () => {
  closeAllStreams();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

interface Connection {
  res: http.IncomingMessage;
  text: () => string;
  events: () => { event?: string; data?: any }[];
  ended: () => boolean;
  stop: () => void;
}

const connect = (userId: string, session?: string): Promise<Connection> =>
  new Promise((resolve, reject) => {
    let received = "";
    let ended = false;
    const req = http.get(
      {
        port,
        path: "/api/notifications/stream",
        headers: { "x-user": userId, ...(session ? { "x-session": session } : {}) },
      },
      (res) => {
        res.setEncoding("utf8");
        res.on("data", (chunk) => (received += chunk));
        res.on("end", () => (ended = true));
        res.on("close", () => (ended = true));
        resolve({
          res,
          text: () => received,
          ended: () => ended,
          stop: () => req.destroy(),
          events: () =>
            received
              .split("\n\n")
              .map((block) => block.trim())
              .filter((block) => block.startsWith("event:"))
              .map((block) => {
                const event = /^event: (.*)$/m.exec(block)?.[1];
                const data = /^data: (.*)$/m.exec(block)?.[1];
                return { event, data: data ? JSON.parse(data) : undefined };
              }),
        });
      }
    );
    req.on("error", (e) => {
      if (!(e as any).code || (e as any).code !== "ECONNRESET") reject(e);
    });
  });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await pause(20);
};

const makeUser = async (name: string, cents = 0) => {
  const user = await createUser({
    firstName: name,
    lastName: "Test",
    username: name.toLowerCase(),
    password: "s3cret",
    defaultPrivacyLevel: DefaultPrivacyLevel.public,
  });
  await fundUser(user.id, cents);
  return user;
};

const details = (receiverId: string, dollars: number) => ({
  receiverId,
  description: "t",
  amount: dollars,
  privacyLevel: "public",
});

describe("live notifications (SSE)", () => {
  const open: Connection[] = [];
  const track = async (userId: string, session?: string) => {
    const c = await connect(userId, session);
    open.push(c);
    return c;
  };

  beforeEach(async () => {
    await resetDatabase(prisma);
  });
  afterEach(() => {
    open.splice(0).forEach((c) => c.stop());
    closeAllStreams();
    delete process.env.NOTIFICATION_STREAM_HEARTBEAT_MS;
  });

  it("answers 401 JSON when nobody is signed in", async () => {
    const result = await new Promise<{ status?: number; type?: string; body: string }>(
      (resolve) => {
        http.get({ port, path: "/api/notifications/stream" }, (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () =>
            resolve({ status: res.statusCode, type: res.headers["content-type"], body })
          );
        });
      }
    );
    expect(result.status).toBe(401);
    expect(result.type).toMatch(/json/);
    expect(JSON.parse(result.body)).toHaveProperty("error");
  });

  it("opens at once with the stream headers and 'retry: 5000'", async () => {
    const a = await makeUser("A");
    const c = await track(a.id);

    await waitFor(() => c.text().includes("retry:"));
    expect(c.res.statusCode).toBe(200);
    expect(c.res.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect(c.res.headers["cache-control"]).toBe("no-cache, no-transform");
    expect(c.res.headers["connection"]).toBe("keep-alive");
    expect(c.res.headers["x-accel-buffering"]).toBe("no");
    expect(c.text()).toContain("retry: 5000\n\n");
    expect(openStreamCount(a.id)).toBe(1);
  });

  it("a transfer sends ONE 'notification' event to the receiver only, naming the sender", async () => {
    const a = await makeUser("A", 100000);
    const b = await makeUser("B");
    const c = await makeUser("C");
    const sB = await track(b.id);
    const sC = await track(c.id);
    const sA = await track(a.id);

    const tx = await createTx(a.id, "payment", details(b.id, 20));

    await waitFor(() => sB.events().length > 0);
    await pause(300);
    expect(sB.events()).toHaveLength(1);
    const [event] = sB.events();
    expect(event.event).toBe("notification");
    expect(event.data).toMatchObject({
      userId: b.id,
      transactionId: tx.id,
      status: "received",
      isRead: false,
      userFullName: "Test A", // who SENT it: "성 이름"
    });
    expect(sC.events()).toHaveLength(0);
    expect(sA.events()).toHaveLength(0); // the sender gets no notification
  });

  it("the event is the same JSON as one item of GET /notifications", async () => {
    const a = await makeUser("A", 100000);
    const b = await makeUser("B");
    const sB = await track(b.id);

    await createTx(a.id, "payment", details(b.id, 5));
    await waitFor(() => sB.events().length > 0);

    const list = await new Promise<any>((resolve) => {
      http.get({ port, path: "/api/notifications", headers: { "x-user": b.id } }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(JSON.parse(body)));
      });
    });
    expect(list.results).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(list.results[0]))).toEqual(sB.events()[0].data);
  });

  it("likes and comments go to the members they are for, and to nobody else", async () => {
    const a = await makeUser("A", 100000);
    const b = await makeUser("B");
    const c = await makeUser("C");
    const tx = await createTx(a.id, "payment", details(b.id, 5));
    const sA = await track(a.id);
    const sB = await track(b.id);
    const sC = await track(c.id);
    await pause(100);

    await createLikes(c.id, tx.id); // C likes A's payment to B: both A and B are notified
    await createComments(c.id, tx.id, "hi");
    await waitFor(() => sA.events().length >= 2 && sB.events().length >= 2);
    await pause(200);

    for (const stream of [sA, sB]) {
      const events = stream.events();
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.event === "notification")).toBe(true);
      expect(
        events
          .map((e) => ("likeId" in e.data ? "like" : "commentId" in e.data ? "comment" : "?"))
          .sort()
      ).toEqual(["comment", "like"]);
      expect(events.every((e) => e.data.userFullName === "Test C")).toBe(true); // the one who liked or commented
    }
    expect(sC.events()).toHaveLength(0);
  });

  it("a transfer that is refused (rolled back) sends nothing", async () => {
    const a = await makeUser("A", 100); // $1
    const b = await makeUser("B");
    const sB = await track(b.id);
    await pause(100);

    await expect(createTx(a.id, "payment", details(b.id, 50))).rejects.toMatchObject({
      status: 400,
    });

    await pause(300);
    expect(sB.events()).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("a notification written inside a transaction that is then rolled back is never sent", async () => {
    const b = await makeUser("B");
    const sB = await track(b.id);
    await pause(100);

    let seenInside = -1;
    await expect(
      prisma.$transaction(async (tx) => {
        await createPaymentNotification(
          b.id,
          "some-transaction",
          PaymentNotificationStatus.received,
          tx
        );
        await pause(200);
        seenInside = sB.events().length; // written but NOT committed yet: nothing has gone out
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");

    await pause(200);
    expect(seenInside).toBe(0);
    expect(sB.events()).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("sends ': ping' while nothing happens, and the stream is forgotten when the client leaves", async () => {
    process.env.NOTIFICATION_STREAM_HEARTBEAT_MS = "80";
    const a = await makeUser("A");
    const s = await track(a.id);

    await waitFor(() => (s.text().match(/: ping\n\n/g) ?? []).length >= 2);
    expect((s.text().match(/: ping\n\n/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(openStreamCount(a.id)).toBe(1);

    s.stop();
    await waitFor(() => openStreamCount(a.id) === 0);
    expect(openStreamCount(a.id)).toBe(0);
  });

  it(`keeps ${MAX_STREAMS_PER_USER} streams per member: the 4th closes the oldest`, async () => {
    const a = await makeUser("A");
    const first = await track(a.id);
    await track(a.id);
    await track(a.id);
    expect(openStreamCount(a.id)).toBe(3);

    const fourth = await track(a.id);
    await waitFor(() => first.ended());

    expect(first.ended()).toBe(true);
    expect(fourth.ended()).toBe(false);
    expect(openStreamCount(a.id)).toBe(3);
  });

  it("logout closes only the streams of that login session", async () => {
    const a = await makeUser("A");
    const mine = await track(a.id, "session-1");
    const other = await track(a.id, "session-2");

    closeStreamsOfSession("session-1");
    await waitFor(() => mine.ended());

    expect(mine.ended()).toBe(true);
    expect(other.ended()).toBe(false);
    expect(openStreamCount(a.id)).toBe(1);
  });

  it("a server with open streams can shut down quickly once the streams are closed", async () => {
    const a = await makeUser("A");
    const second = http.createServer(app);
    await new Promise<void>((resolve) => second.listen(0, () => resolve()));
    const secondPort = (second.address() as AddressInfo).port;
    await new Promise<void>((resolve) => {
      const req = http.get(
        { port: secondPort, path: "/api/notifications/stream", headers: { "x-user": a.id } },
        (res) => {
          res.on("data", () => resolve());
          res.on("error", () => undefined);
        }
      );
      req.on("error", () => undefined);
    });

    const started = Date.now();
    closeAllStreams(); // what the SIGINT / SIGTERM handler does first
    await new Promise((resolve) => second.close(resolve));

    expect(Date.now() - started).toBeLessThan(1500);
  });

  it("server shutdown closes every stream", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const s1 = await track(a.id);
    const s2 = await track(b.id);

    closeAllStreams();
    await waitFor(() => s1.ended() && s2.ended());

    expect(s1.ended() && s2.ended()).toBe(true);
    expect(openStreamCount()).toBe(0);
  });
});
