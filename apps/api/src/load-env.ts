// Loads environment variables. Import this file first, before anything that reads process.env.
//
// The repository keeps ONE .env file at its root, shared by the web app and the API.
// The API can be started from its own folder (pnpm --filter), so the root file is loaded by path.
// dotenv never overwrites a variable that is already set, so a real environment variable
// (for example one set by docker compose) always wins over the files.
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config(); // .env in the current folder (optional, local override)
dotenv.config({ path: resolve(__dirname, "../../../.env") }); // .env at the repository root
