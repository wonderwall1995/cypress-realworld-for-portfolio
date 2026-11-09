import express from "express";
import expressPlayground from "graphql-playground-middleware-express";

const router = express.Router();
router.get("/", expressPlayground({ endpoint: "/api/graphql" }));
export default router;
