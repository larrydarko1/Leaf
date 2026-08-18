/**
 * Environment configuration — the only module that reads process.env.
 *
 * Every variable is declared in the schema below and reaches the rest of the
 * app as a typed value, so a missing or malformed one fails here rather than
 * halfway through a window load.
 */

import { z } from 'zod';

const envSchema = z.object({
    // electron-vite sets this in dev mode only; empty in a packaged build.
    ELECTRON_RENDERER_URL: z.string().default(''),
});

const parsed = envSchema.parse(process.env);

export const config = {
    rendererUrl: parsed.ELECTRON_RENDERER_URL,
} as const;
