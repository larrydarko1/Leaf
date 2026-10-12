import { z } from 'zod';

/** Any JSON object, keys unchecked: the first step in reading a file someone may have edited by hand. */
export const JsonObjectSchema = z.record(z.string(), z.unknown());

/** A locale file: strings, nested to any depth, with arrays where a message lists options. */
export type LocaleMessages = { [key: string]: string | string[] | LocaleMessages | LocaleMessages[] };

export const LocaleMessagesSchema: z.ZodType<LocaleMessages> = z.lazy(() =>
    z.record(
        z.string(),
        z.union([z.string(), z.array(z.string()), LocaleMessagesSchema, z.array(LocaleMessagesSchema)]),
    ),
);
