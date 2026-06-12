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
import type * as assets from "../assets.js";
import type * as audit from "../audit.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as backups from "../backups.js";
import type * as branches from "../branches.js";
import type * as calendar from "../calendar.js";
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as demoAuth from "../demoAuth.js";
import type * as deskBookings from "../deskBookings.js";
import type * as devSeed from "../devSeed.js";
import type * as escalations from "../escalations.js";
import type * as guestBookings from "../guestBookings.js";
import type * as guestRequests from "../guestRequests.js";
import type * as guests from "../guests.js";
import type * as health from "../health.js";
import type * as housekeeping from "../housekeeping.js";
import type * as http from "../http.js";
import type * as identity from "../identity.js";
import type * as inventory from "../inventory.js";
import type * as invoices from "../invoices.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bookingDomain from "../lib/bookingDomain.js";
import type * as lib_demoPhone from "../lib/demoPhone.js";
import type * as lib_escalate from "../lib/escalate.js";
import type * as lib_ledger from "../lib/ledger.js";
import type * as lib_mpesa from "../lib/mpesa.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_stock from "../lib/stock.js";
import type * as maintenance from "../maintenance.js";
import type * as mpesa from "../mpesa.js";
import type * as notifications from "../notifications.js";
import type * as notificationsEngine from "../notificationsEngine.js";
import type * as notificationsFeed from "../notificationsFeed.js";
import type * as opsDashboard from "../opsDashboard.js";
import type * as paymentMethods from "../paymentMethods.js";
import type * as payments from "../payments.js";
import type * as property from "../property.js";
import type * as rates from "../rates.js";
import type * as rbac from "../rbac.js";
import type * as reports from "../reports.js";
import type * as restaurant from "../restaurant.js";
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
  assets: typeof assets;
  audit: typeof audit;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  backups: typeof backups;
  branches: typeof branches;
  calendar: typeof calendar;
  catalog: typeof catalog;
  crons: typeof crons;
  demoAuth: typeof demoAuth;
  deskBookings: typeof deskBookings;
  devSeed: typeof devSeed;
  escalations: typeof escalations;
  guestBookings: typeof guestBookings;
  guestRequests: typeof guestRequests;
  guests: typeof guests;
  health: typeof health;
  housekeeping: typeof housekeeping;
  http: typeof http;
  identity: typeof identity;
  inventory: typeof inventory;
  invoices: typeof invoices;
  "lib/auth": typeof lib_auth;
  "lib/bookingDomain": typeof lib_bookingDomain;
  "lib/demoPhone": typeof lib_demoPhone;
  "lib/escalate": typeof lib_escalate;
  "lib/ledger": typeof lib_ledger;
  "lib/mpesa": typeof lib_mpesa;
  "lib/permissions": typeof lib_permissions;
  "lib/stock": typeof lib_stock;
  maintenance: typeof maintenance;
  mpesa: typeof mpesa;
  notifications: typeof notifications;
  notificationsEngine: typeof notificationsEngine;
  notificationsFeed: typeof notificationsFeed;
  opsDashboard: typeof opsDashboard;
  paymentMethods: typeof paymentMethods;
  payments: typeof payments;
  property: typeof property;
  rates: typeof rates;
  rbac: typeof rbac;
  reports: typeof reports;
  restaurant: typeof restaurant;
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
