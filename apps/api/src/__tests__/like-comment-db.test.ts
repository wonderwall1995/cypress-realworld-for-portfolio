// @vitest-environment node
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import prisma from "../prisma";
import { createLike, getAllLikes, getLikeById, getLikesByTransactionId } from "../like-db";
import {
  createComment,
  getAllComments,
  getCommentById,
  getCommentsByTransactionId,
} from "../comment-db";
import { resetDatabase } from "./db-setup/reset";

describe("Likes and comments (PostgreSQL)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("likes", () => {
    it("creates a like and finds it by id", async () => {
      const like = await createLike("u1", "t1");

      expect(like.userId).toBe("u1");
      expect(like.transactionId).toBe("t1");
      expect(like.createdAt).toBeInstanceOf(Date);
      expect((await getLikeById(like.id))!.uuid).toBe(like.uuid);
      expect(await getLikeById("none")).toBeUndefined();
    });

    it("lists the likes of one transaction", async () => {
      await createLike("u1", "t1");
      await createLike("u2", "t1");
      await createLike("u1", "t2");

      expect(await getLikesByTransactionId("t1")).toHaveLength(2);
      expect(await getLikesByTransactionId("none")).toEqual([]);
      expect(await getAllLikes()).toHaveLength(3);
    });
  });

  describe("comments", () => {
    it("creates a comment with its content and finds it by id", async () => {
      const comment = await createComment("u1", "t1", "nice one");

      expect(comment.content).toBe("nice one");
      expect(comment.userId).toBe("u1");
      expect((await getCommentById(comment.id))!.content).toBe("nice one");
      expect(await getCommentById("none")).toBeUndefined();
    });

    it("lists the comments of one transaction in the order they were written", async () => {
      await createComment("u1", "t1", "first");
      await new Promise((r) => setTimeout(r, 5));
      await createComment("u2", "t1", "second");
      await createComment("u1", "t2", "other");

      const comments = await getCommentsByTransactionId("t1");

      expect(comments.map((c) => c.content)).toEqual(["first", "second"]);
      expect(await getAllComments()).toHaveLength(3);
    });
  });
});
