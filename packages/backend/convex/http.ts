import { httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * HTTP routes. Convex Auth mounts its sign-in / token endpoints here
 * (`auth.addHttpRoutes`); the web client + Next middleware talk to them.
 */
const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
