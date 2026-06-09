/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as backups from "../backups.js";
import type * as crons from "../crons.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as identity from "../identity.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as rbac from "../rbac.js";
import type * as roles from "../roles.js";
import type * as sso from "../sso.js";
import type * as staff from "../staff.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  backups: typeof backups;
  crons: typeof crons;
  health: typeof health;
  http: typeof http;
  identity: typeof identity;
  "lib/auth": typeof lib_auth;
  "lib/permissions": typeof lib_permissions;
  rbac: typeof rbac;
  roles: typeof roles;
  sso: typeof sso;
  staff: typeof staff;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
