/*
 * The one place the app decides where its data comes from.
 *
 * Default is the real backend. Sample data is opt-in through
 * VITE_DATA_SOURCE=sample, so a production build cannot ship it by accident —
 * a missing env var gives you the HTTP adapter, not made-up figures.
 *
 * When the backend lands: drop `sample.ts`, drop this branch, export `httpApi`.
 */
import { httpApi } from "./http"
import { sampleApi } from "./sample"
import type { TwzApi } from "./contracts"

const source = import.meta.env.VITE_DATA_SOURCE ?? "http"

export const api: TwzApi = source === "sample" ? sampleApi : httpApi

export const usingSampleData = source === "sample"

export { ApiError } from "./client"
export type { DayRange, Session, TwzApi } from "./contracts"
export type * from "./types"
