/**
 * Everything the app asks of its api, by area — one file per family of routes, and the transport
 * they all go through in `call.ts`. This is the only door: a screen imports from `@/api` and gets
 * a named call, never a path and never `fetch`.
 *
 * The api's own types are duplicated here rather than shared as a package: the two repositories
 * move apart, and a wrong field is a typecheck away either way (README, «Общий пакет типов»).
 *
 * `request` stays inside the folder on purpose — it is re-exported by nothing below, so nothing
 * outside can invent a route.
 */

export * from './account';
export { API_URL, ApiError, apiReason, errorMessage, onSessionRefused } from './call';
export * from './contacts';
export * from './journal';
export * from './labels';
export * from './media';
export * from './members';
export * from './memories';
export * from './montage';
export * from './music';
export * from './push';
