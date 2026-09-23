#!/usr/bin/env node
/**
 * Code style gate. The conventions ESLint has no opinion about: what a file is
 * called, how long it is, which order its parts come in, and which comment form
 * belongs in which block. None of it changes behaviour and all of it is invisible in
 * a diff — you read the import line, not the convention it broke — which is why it
 * needs a gate rather than a review. The rules live in
 * @larrydarko/lint-config/gates/code-style.
 *
 * What stays here is this repo's answers.
 *
 * `casing` — an SFC filename is PascalCase because it IS the component name: the tag
 * you write in a template, and the label devtools shows. Everything else under src/
 * is camelCase, with one exemption: the `cm-*.ts` modules under
 * composables/editor/codemirror are CodeMirror extensions, named after upstream's
 * convention rather than ours. The exemption is matched on the path, so a `cm-`
 * file anywhere else is still wrong.
 *
 * `headers` — first match wins, so the order is the specificity. A main-process
 * module under lib/ or services/ owes a JSDoc block, because it owns an external
 * concern — the filesystem, a model handle, a config file — and which one is not
 * derivable from its exports. A composable owes at least a `//` line saying what
 * state it owns. An SFC owes NOTHING: defineProps and defineEmits are the contract,
 * and a prose header above them is the one part nothing checks, so it is the part
 * that goes stale.
 *
 * `baseline` is in the shared gate's unit: non-blank lines, and an SFC's `<style>`
 * block does not count. This repo used to count what `wc -l` counts, which was
 * drift — the code style standard says "files over ~400 lines (template and script
 * only, style can be ignored)" and the SCSS standard says no gate counts stylesheet
 * lines. Every number below was re-measured in the new unit in one pass, and eight
 * entries left the list because their script and template were never over the cap;
 * only their stylesheets were. Three more had simply shrunk back under it.
 */
import { checkCodeStyle } from '@larrydarko/lint-config/gates/code-style';

/** CodeMirror extension modules, named by upstream's convention rather than ours. */
const CODEMIRROR = /^src\/renderer\/composables\/editor\/codemirror\/cm-[a-z0-9-]+\.ts$/;

/**
 * Files over the 400-line softcap when the ratchet was set, at the size they were.
 * A file may shrink freely; growing past its entry, or a new file crossing the cap,
 * fails. Lower a number when you refactor, never raise it — and when one drops back
 * under the cap the gate says so, because an entry left behind is a licence to
 * regrow to the old number.
 */
const LENGTH_BASELINE: Record<string, number> = {
    'src/main/services/fs.ts': 755,
    'src/renderer/composables/drawing/useDrawingInteraction.ts': 750,
    'src/renderer/App.vue': 656,
    'src/renderer/composables/drawing/useCanvasRenderer.ts': 628,
    'src/renderer/components/explorer/FolderNode.vue': 513,
    'src/renderer/components/ai/AiMessageList.vue': 490,
    'src/renderer/components/NoteEditor.vue': 467,
    'src/renderer/composables/ai/useAIChat.ts': 452,
    'src/renderer/composables/editor/codemirror/cm-theme.ts': 421,
    'src/main/services/ai.ts': 415,
    'src/renderer/components/drawing/DrawingToolbar.vue': 406,
};

checkCodeStyle({
    scan: ['src'],
    baseline: LENGTH_BASELINE,
    casing: [
        { files: /\.vue$/, style: 'pascal' },
        { files: /\.ts$/, style: 'camel', exempt: CODEMIRROR },
    ],
    headers: [
        { files: /^src\/main\/(lib|services)\/.*\.ts$/, require: 'jsdoc' },
        { files: /^src\/renderer\/composables\/.*\.ts$/, require: 'comment' },
        { files: /\.vue$/, require: 'none' },
    ],
});
