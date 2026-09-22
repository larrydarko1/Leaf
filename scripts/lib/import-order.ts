import { createImportOrder } from '@larrydarko/lint-config/gates/import-order';

// No workspace scope: Leaf is a single package, so there are three groups, not four.
// `@test-utils` is a tsconfig path into this repo, not an npm package, so it sorts as local.
const { IMPORT_GROUPS, checkImportsInFile, fixImportsInFile } = createImportOrder({
    localAliases: ['@test-utils'],
});

export { IMPORT_GROUPS, checkImportsInFile, fixImportsInFile };
