/**
 * Typed access to the backend contract.
 *
 * `api.gen.ts` is auto-generated from the fa-web-api OpenAPI schema (see
 * `npm run gen:api-types`). This module is the hand-written, stable surface
 * over it: import `Schema<"...">` here instead of reaching into the generated
 * file directly, so call sites stay readable and the generated file can be
 * regenerated freely.
 *
 * Because these aliases resolve to the *real* backend response shapes, a
 * backend field rename or removal makes `tsc` fail on the stale frontend usage
 * — which is the whole point (see issue #99). CI regenerates `api.gen.ts` from
 * the served schema and fails on drift.
 */
import type { components, operations } from "./api.gen";

/** Every named backend model (the `components.schemas` map). */
export type Schemas = components["schemas"];

/** A single named backend model, e.g. `Schema<"ProfileRead">`. */
export type Schema<K extends keyof Schemas> = Schemas[K];

/**
 * The 200 JSON response body of an operation, for endpoints whose response is
 * an inline schema rather than a named model. Use `Schema<...>` when a named
 * model exists; reach for this only for inline-typed endpoints.
 *
 * NOTE: the geography endpoints currently return untyped dicts in the backend
 * (no `response_model`), so this resolves to `Record<string, unknown>` for
 * them — they are not yet protected by the contract guard. Tracked as a
 * backend follow-up (add response models to the geography routes).
 */
export type OperationResponse<K extends keyof operations> =
  operations[K]["responses"] extends {
    200: { content: { "application/json": infer R } };
  }
    ? R
    : never;
