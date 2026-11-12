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
import { HttpError } from "./http-error";
import { closeAllStreams } from "./notification-stream";
import testDataRoutes from "./testdata-routes";
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
  api.use("/testData", testDataRoutes);
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

app.use("/api", api);

// errors that carry an HTTP status (HttpError) are answered as JSON
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  return next(err);
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
