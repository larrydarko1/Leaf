import { StrokeStyleSchema, type DefaultStyle, type StyleKey } from '@/schemas/drawing';

/** The style change `value` makes to `prop`, or null when the value is the wrong kind for it. */
export function toStylePatch(prop: StyleKey, value: string | number): Partial<DefaultStyle> | null {
    switch (prop) {
        case 'strokeColor':
            return typeof value === 'string' ? { strokeColor: value } : null;
        case 'fillColor':
            return typeof value === 'string' ? { fillColor: value } : null;
        case 'strokeWidth':
            return typeof value === 'number' ? { strokeWidth: value } : null;
        case 'borderRadius':
            return typeof value === 'number' ? { borderRadius: value } : null;
        case 'fontSize':
            return typeof value === 'number' ? { fontSize: value } : null;
        case 'strokeStyle': {
            const parsed = StrokeStyleSchema.safeParse(value);
            return parsed.success ? { strokeStyle: parsed.data } : null;
        }
    }
}
