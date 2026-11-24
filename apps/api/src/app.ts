import "./load-env";
import express from "express";
import { join } from "path";
import logger from "morgan";
import passport from "passport";
import session from "express-session";
import bodyParser from "body-parser";
import cors from "cors";
import paginate from "express-paginate";
import { createHandler as graphqlHandler } from "graphql-http/lib/use/express";
import { loadSchemaSync } from "@graphql-tools/load";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import { addResolversToSchema } from "@graphql-tools/schema";

import auth from "./auth";
import userRoutes from "./user-routes";
import bankAccountRoutes from "./bankaccount-routes";
import gqlPlaygroundRoutes from "./gql-playground-routes";
import transactionRoutes from "./transaction-routes";
import likeRoutes from "./like-routes";
import commentRoutes from "./comment-routes";
import notificationRoutes from "./notification-routes";
import bankTransferRoutes from "./banktransfer-routes";
import { Prisma } from "@prisma/client";
import { HttpError } from "./http-error";
import { closeAllStreams } from "./notification-stream";
import testDataRoutes from "./testdata-routes";
import snapshotRoutes from "./snapshot-routes";
import demoRoutes from "./demo-routes";
import { checkAuth0Jwt, verifyOktaToken, checkCognitoJwt, checkGoogleJwt } from "./helpers";
import resolvers from "./graphql/resolvers";
import { frontendPort, getBackendPort } from "./port-utils";
import { getSessionSecret } from "./session-secret";

const corsOption = {
  origin: `http://localhost:${frontendPort}`,
  credentials: true,
};

const schema = loadSchemaSync(join(__dirname, "./graphql/schema.graphql"), {
  loaders: [new GraphQLFileLoader()],
});

const schemaWithResolvers = addResolversToSchema({
  schema,
  resolvers,
});

const app = express();
app.set("trust proxy", 1); // Nginx in front tells whether the visitor came over HTTPS

app.use(cors(corsOption));
app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(
  session({
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    unset: "destroy",
    // "auto": the cookie is Secure when the visitor came over HTTPS (and still works over HTTP on a developer's PC)
    cookie: { httpOnly: true, sameSite: "lax", secure: "auto" },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use(paginate.middleware(+process.env.PAGINATION_PAGE_SIZE!));

// every API route lives under /api so the frontend (same origin, behind a proxy) never
// collides with its own page routes such as /notifications or /bankaccounts
const api = express.Router();

/* istanbul ignore next */
if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
  // can wipe or dump the whole database: never in production
  api.use("/testData", testDataRoutes);
}

// the DB tab of the demo reads the snapshot here (read-only, every NODE_ENV)
api.use("/demoSnapshot", snapshotRoutes);

// Run numbers and fixtures for the test runners (every NODE_ENV; writes need TEST_RUN_SECRET).
// Loaded only when the Prisma client of this server knows the testschema tables: an older client
// (a container that has not run "prisma generate" yet) would stop the whole server.
if (Prisma.dmmf.datamodel.models.some((model) => model.name === "TestFixturePerson")) {
  api.use("/testRuns", require("./test-run-routes").default);
} else {
  console.warn("[testRuns] closed: run prisma generate to open the test-run routes");
}

// What visitors do with the demo. Guarded in the same way.
if (Prisma.dmmf.datamodel.models.some((model) => model.name === "DemoRun")) {
  api.use("/demoRuns", require("./demo-run-routes").default);
  const { closeLostDemos } = require("./demo-run-db");
  setInterval(() => closeLostDemos().catch(console.error), 60_000).unref();
} else {
  console.warn("[demoRuns] closed: run prisma generate to open the demo-run routes");
}

api.use(auth);

/* istanbul ignore if */
if (process.env.VITE_AUTH0) {
  api.use(checkAuth0Jwt);
}

/* istanbul ignore if */
if (process.env.VITE_OKTA) {
  api.use(verifyOktaToken);
}

/* istanbul ignore if */
if (process.env.VITE_AWS_COGNITO) {
  api.use(checkCognitoJwt);
}

/* istanbul ignore if */
if (process.env.VITE_GOOGLE) {
  api.use(checkGoogleJwt);
}

api.get("/", (req, res) => {
  res.send("Cypress Realworld App - backend");
});
api.use("/graphql", gqlPlaygroundRoutes);
api.use(
  "/graphql",
  graphqlHandler({
    schema: schemaWithResolvers,
    context: async (req, _args) => {
      return { user: req.raw.user };
    },
  })
);
api.use("/users", userRoutes);
api.use("/bankAccounts", bankAccountRoutes);
api.use("/transactions", transactionRoutes);
api.use("/likes", likeRoutes);
api.use("/comments", commentRoutes);
api.use("/notifications", notificationRoutes);
api.use("/bankTransfers", bankTransferRoutes);
// what the demo needs, safe in production too: login needed, only the own data of the user
api.use("/demo", demoRoutes);

app.use("/api", api);

// errors that carry an HTTP status (HttpError) are answered as JSON
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (res.headersSent) return next(err);
  // an error that a library marked as the sender's fault (for example broken JSON) keeps its status;
  // anything else is ours: it goes to the log, never to the sender
  const theirs = err?.status >= 400 && err?.status < 500;
  if (!theirs) console.error(err);
  return theirs
    ? res.status(err.status).json({ error: err.message })
    : res.status(500).json({ error: "internal server error" });
});

getBackendPort().then((port) => {
  const server = app.listen(port);

  // Open notification streams never end by themselves: close them first, or the shutdown would wait for them.
  const shutdown = () => {
    closeAllStreams();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});
