/**
 * Function contract gate. Deliberately not checked: `record*`/`save*`/`update*`/`delete*`
 * (the standard allows any receipt shape), `is*`/`has*`/`can*` doing synchronous I/O
 * (only `await` is visible from here), and whether a name is *accurate* — that is review's job.
 */

/** Prefixes whose next character must be uppercase, so `getter` and `island` are not `get`/`is`. */
const PREFIX = /^(get|find|list|is|has|can|assert|require|ensure|build|format|to)(?=[A-Z])/;

const isNull = (t) => t.type === 'TSNullKeyword';
const isUndefined = (t) => t.type === 'TSUndefinedKeyword';
const isVoid = (t) => t.type === 'TSVoidKeyword';
const isNever = (t) => t.type === 'TSNeverKeyword';
const isUnknownOrAny = (t) => t.type === 'TSUnknownKeyword' || t.type === 'TSAnyKeyword';

/** A type predicate (`x is T`) or an assertion signature (`asserts x is T`). */
const isPredicate = (t) => t.type === 'TSTypePredicate';

function isBooleanType(type) {
    if (type.type === 'TSBooleanKeyword') return true;
    // `true | false`, and the literal-typed booleans a narrowed helper returns.
    if (type.type === 'TSLiteralType')
        return type.literal.type === 'Literal' && typeof type.literal.value === 'boolean';
    if (type.type === 'TSUnionType') return type.types.every(isBooleanType);
    return false;
}

function isArrayType(type) {
    if (type.type === 'TSArrayType') return true;
    // `readonly T[]`
    if (type.type === 'TSTypeOperator' && type.operator === 'readonly') {
        return type.typeAnnotation !== undefined && isArrayType(type.typeAnnotation);
    }
    if (type.type === 'TSTypeReference' && type.typeName.type === 'Identifier') {
        return ['Array', 'ReadonlyArray'].includes(type.typeName.name);
    }
    return false;
}

/** Type arguments moved from `typeParameters` to `typeArguments` in typescript-eslint v6. */
const typeArgs = (node) => node.typeArguments ?? node.typeParameters;

/** `Promise<T>` → `T`; anything else unchanged. */
function unwrapPromise(type) {
    if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') return type;
    if (type.typeName.name !== 'Promise') return type;
    const args = typeArgs(type);
    return args?.params?.[0] ?? type;
}

const unionMembers = (type) => (type.type === 'TSUnionType' ? type.types : [type]);

function functionName(node) {
    if (node.id != null && node.id.type === 'Identifier') return node.id.name;
    const parent = node.parent;
    if (parent == null) return null;
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
    const keyed = ['Property', 'MethodDefinition', 'PropertyDefinition', 'TSAbstractMethodDefinition'];
    if (keyed.includes(parent.type) && parent.key.type === 'Identifier') return parent.key.name;
    return null;
}

/**
 * Rule 1. The prefix tells the caller what happens on failure; this checks the
 * signature actually says the same thing.
 */
const nameContract = {
    meta: {
        type: 'problem',
        docs: { description: 'A function name prefix must match what its return type promises (Rule 1).' },
        schema: [],
        messages: {
            getNullable:
                '`{{name}}` starts with `get`, which promises the thing or a throw — but its return type includes `{{found}}`. Absence is normal here, so name it `find{{rest}}` and let the caller handle `null`; or keep the name and throw an AppError when it is missing.',
            findNotNullable:
                '`{{name}}` starts with `find`, which promises `T | null` — absence is a normal answer. Its return type never admits `null`, so either add `| null`, or rename it `get{{rest}}` because it always produces a value or throws.',
            listNotArray:
                '`{{name}}` starts with `list`, which promises an array and never `null` — an empty list is a correct answer, not a failure. Its return type is not an array type.',
            listNullable:
                '`{{name}}` starts with `list`, which must return `[]` rather than `{{found}}`. A caller that has to null-check a list gets the null check wrong exactly once.',
            predicateNotBoolean:
                '`{{name}}` starts with `{{prefix}}`, which promises a boolean and nothing else. Its return type is neither `boolean` nor a type predicate (`x is T`).',
            predicateAsync:
                '`{{name}}` starts with `{{prefix}}`, which promises a pure synchronous answer — no I/O, no writes. This one is async or awaits. Split it: fetch in the caller, then pass the value to a pure predicate.',
            assertNotVoid:
                '`{{name}}` starts with `{{prefix}}`, whose only job is to throw or return nothing. Its return type is neither `void` nor an assertion signature — if it produces a value, it is doing a second job and wants a different name.',
            pureAsync:
                '`{{name}}` starts with `{{prefix}}`, which promises a pure transform — no I/O. This one is async or awaits. Fetch outside and pass the data in, so the transform stays testable without mocks.',
            andInName:
                '`{{name}}` joins two jobs with "And". Split it into two functions — the name is telling you the seam.',
        },
    },
    create(context) {
        const stack = [];

        function check(node) {
            const frame = stack.pop();
            const name = functionName(node);
            if (name === null) return;

            if (/[a-z0-9]And[A-Z]/.test(name)) {
                context.report({ node: node.id ?? node, messageId: 'andInName', data: { name } });
            }

            const prefix = PREFIX.exec(name)?.[1];
            if (prefix === undefined) return;
            if (node.returnType == null) return;

            const rest = name.slice(prefix.length);
            const declared = node.returnType.typeAnnotation;
            const isAsync = node.async === true || frame?.hasAwait === true;

            // A predicate or assertion signature is checked before unwrapping —
            // `asserts x is T` is not a value type and has no Promise to unwrap.
            if (isPredicate(declared)) {
                if (['is', 'has', 'can'].includes(prefix) && declared.asserts !== true) return;
                if (['assert', 'require', 'ensure'].includes(prefix)) return;
            }

            const returned = unwrapPromise(declared);
            const members = unionMembers(returned);
            const nullMember = members.find(isNull);
            const undefinedMember = members.find(isUndefined);

            // `unknown`/`any`/`never` carry no promise to contradict.
            if (members.some(isUnknownOrAny) || members.every(isNever)) return;

            switch (prefix) {
                case 'get': {
                    const found =
                        nullMember !== undefined ? 'null' : undefinedMember !== undefined ? 'undefined' : null;
                    if (found !== null) {
                        context.report({
                            node: node.returnType,
                            messageId: 'getNullable',
                            data: { name, found, rest },
                        });
                    }
                    break;
                }
                case 'find':
                    if (nullMember === undefined) {
                        context.report({ node: node.returnType, messageId: 'findNotNullable', data: { name, rest } });
                    }
                    break;
                case 'list':
                    if (nullMember !== undefined || undefinedMember !== undefined) {
                        const found = nullMember !== undefined ? 'null' : 'undefined';
                        context.report({ node: node.returnType, messageId: 'listNullable', data: { name, found } });
                    } else if (!members.every(isArrayType)) {
                        context.report({ node: node.returnType, messageId: 'listNotArray', data: { name } });
                    }
                    break;
                case 'is':
                case 'has':
                case 'can':
                    if (!isBooleanType(returned)) {
                        context.report({
                            node: node.returnType,
                            messageId: 'predicateNotBoolean',
                            data: { name, prefix },
                        });
                    }
                    if (isAsync) {
                        context.report({ node: node.id ?? node, messageId: 'predicateAsync', data: { name, prefix } });
                    }
                    break;
                case 'assert':
                case 'require':
                case 'ensure':
                    if (!isVoid(returned) && !isPredicate(declared)) {
                        context.report({ node: node.returnType, messageId: 'assertNotVoid', data: { name, prefix } });
                    }
                    break;
                case 'build':
                case 'format':
                case 'to':
                    if (isAsync) {
                        context.report({ node: node.id ?? node, messageId: 'pureAsync', data: { name, prefix } });
                    }
                    break;
            }
        }

        return {
            ':function'(node) {
                stack.push({ node, hasAwait: false });
            },
            'AwaitExpression'() {
                if (stack.length > 0) stack[stack.length - 1].hasAwait = true;
            },
            ':function:exit': check,
        };
    },
};

/**
 * Rule 2. One failure channel. `T | null | undefined` is two channels for the
 * same answer, and every call site has to guess which one it is getting.
 */
const oneFailureChannel = {
    meta: {
        type: 'problem',
        docs: { description: 'A return type must not use both `null` and `undefined` (Rule 2).' },
        schema: [],
        messages: {
            bothNullAndUndefined:
                '`{{name}}` returns both `null` and `undefined`. Pick one: `null` means "looked, not there", `undefined` means "not set / not asked for" — never both for the same answer, or every caller writes a different check.',
        },
    },
    create(context) {
        function check(node) {
            if (node.returnType == null) return;
            const members = unionMembers(unwrapPromise(node.returnType.typeAnnotation));
            if (members.some(isNull) && members.some(isUndefined)) {
                const name = functionName(node) ?? 'this function';
                context.report({ node: node.returnType, messageId: 'bothNullAndUndefined', data: { name } });
            }
        }
        return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
    },
};

/**
 * Rule 5. Two optionals in a row is the shape that forces `f(a, undefined, c)`
 * at the call site — the exact drift that put six positional arguments on
 * AppError. One options object instead, and every optional is named where it
 * is passed.
 */
const noUndefinedHole = {
    meta: {
        type: 'problem',
        docs: { description: 'Two or more optional parameters force `undefined` holes at call sites (Rule 5).' },
        schema: [],
        messages: {
            undefinedHole:
                '`{{name}}` has {{count}} optional parameters. To reach the last one a caller must pass `undefined` for the ones it skips, and the call site becomes a comma-counting exercise. Collapse them into one trailing options object.',
        },
    },
    create(context) {
        function check(node) {
            const optional = node.params.filter(
                (param) => param.optional === true || param.type === 'AssignmentPattern',
            );
            if (optional.length < 2) return;
            const name = functionName(node) ?? 'this function';
            context.report({
                node: optional[1],
                messageId: 'undefinedHole',
                data: { name, count: optional.length },
            });
        }
        return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
    },
};

/**
 * Rule 5. `archive(id, true)` is unreadable at the call site. A lone boolean
 * parameter is a setter and fine (`setMuted(muted: boolean)`); a boolean
 * *alongside other arguments* is a mode switch wearing a value's clothes.
 */
const noBooleanFlag = {
    meta: {
        type: 'problem',
        docs: { description: 'No boolean flag parameters alongside other arguments (Rule 5).' },
        schema: [],
        messages: {
            booleanFlag:
                '`{{name}}` takes a boolean flag `{{param}}` alongside other arguments — `{{name}}(…, true)` says nothing at the call site. Write two named functions, or move it into an options object where it is named.',
        },
    },
    create(context) {
        function check(node) {
            if (node.params.length < 2) return;
            for (const param of node.params) {
                const target = param.type === 'AssignmentPattern' ? param.left : param;
                if (target.type !== 'Identifier') continue;
                const annotation = target.typeAnnotation?.typeAnnotation;
                if (annotation === undefined || !isBooleanType(annotation)) continue;
                context.report({
                    node: param,
                    messageId: 'booleanFlag',
                    data: { name: functionName(node) ?? 'this function', param: target.name },
                });
            }
        }
        return { FunctionDeclaration: check, FunctionExpression: check, ArrowFunctionExpression: check };
    },
};

export const functionContractsPlugin = {
    rules: {
        'name-contract': nameContract,
        'one-failure-channel': oneFailureChannel,
        'no-undefined-hole': noUndefinedHole,
        'no-boolean-flag': noBooleanFlag,
    },
};
