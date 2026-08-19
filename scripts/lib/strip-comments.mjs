/**
 * Remove comments from TS/JS/Vue source before scanning it for structure.
 * Gates that look for a shape — a function declaration, an `ipcMain.handle`
 * call — must not find it inside a comment. A commented-out handler or an
 * example in a JSDoc block reads identically to the real thing under a regex,
 * and the false positive is the kind that gets a gate switched off.
 * String and template literals are preserved: a `'//'` inside a URL is not a
 * comment, and dropping it would corrupt the very lines a gate is reading.
 */
export function stripComments(source) {
    let out = '';
    let i = 0;
    const n = source.length;

    while (i < n) {
        const ch = source[i];
        const next = source[i + 1];

        // Line comment — keep the newline so line numbers survive.
        if (ch === '/' && next === '/') {
            while (i < n && source[i] !== '\n') i++;
            continue;
        }

        // Block comment — replace with newlines so line numbers survive.
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
                if (source[i] === '\n') out += '\n';
                i++;
            }
            i += 2;
            continue;
        }

        // String or template literal — copy verbatim, honouring escapes.
        if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch;
            out += ch;
            i++;
            while (i < n) {
                if (source[i] === '\\') {
                    out += source[i] + (source[i + 1] ?? '');
                    i += 2;
                    continue;
                }
                out += source[i];
                if (source[i] === quote) {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }

        out += ch;
        i++;
    }

    return out;
}
