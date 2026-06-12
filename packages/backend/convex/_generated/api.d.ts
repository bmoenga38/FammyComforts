/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as amenities from "../amenities.js";
import type * as audit from "../audit.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as backups from "../backups.js";
import type * as branches from "../branches.js";
import type * as calendar from "../calendar.js";
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as deskBookings from "../deskBookings.js";
import type * as devSeed from "../devSeed.js";
import type * as guestBookings from "../guestBookings.js";
import type * as guestRequests from "../guestRequests.js";
import type * as guests from "../guests.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as identity from "../identity.js";
import type * as invoices from "../invoices.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bookingDomain from "../lib/bookingDomain.js";
import type * as lib_ledger from "../lib/ledger.js";
import type * as lib_mpesa from "../lib/mpesa.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as mpesa from "../mpesa.js";
import type * as notifications from "../notifications.js";
import type * as paymentMethods from "../paymentMethods.js";
import type * as payments from "../payments.js";
import type * as property from "../property.js";
import type * as rates from "../rates.js";
import type * as rbac from "../rbac.js";
import type * as roles from "../roles.js";
import type * as roomTypes from "../roomTypes.js";
import type * as rooms from "../rooms.js";
import type * as sso from "../sso.js";
import type * as staff from "../staff.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  amenities: typeof amenities;
  audit: typeof audit;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  backups: typeof backups;
  branches: typeof branches;
  calendar: typeof calendar;
  catalog: typeof catalog;
  crons: typeof crons;
  deskBookings: typeof deskBookings;
  devSeed: typeof devSeed;
  guestBookings: typeof guestBookings;
  guestRequests: typeof guestRequests;
  guests: typeof guests;
  health: typeof health;
  http: typeof http;
  identity: typeof identity;
  invoices: typeof invoices;
  "lib/auth": typeof lib_auth;
  "lib/bookingDomain": typeof lib_bookingDomain;
  "lib/ledger": typeof lib_ledger;
  "lib/mpesa": typeof lib_mpesa;
  "lib/permissions": typeof lib_permissions;
  mpesa: typeof mpesa;
  notifications: typeof notifications;
  paymentMethods: typeof paymentMethods;
  payments: typeof payments;
  property: typeof property;
  rates: typeof rates;
  rbac: typeof rbac;
  roles: typeof roles;
  roomTypes: typeof roomTypes;
  rooms: typeof rooms;
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
