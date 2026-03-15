import { describe, it, expect, beforeEach } from 'vitest';
import { type Ref, ref, nextTick } from 'vue';
import { useMarkdownToolbar } from '../../src/renderer/composables/editor/useMarkdownToolbar';

describe('useMarkdownToolbar', () => {
    let content: Ref<string>;
    let textareaRef: Ref<HTMLTextAreaElement | null>;
    let changeCount: number;
    let mdFormatText: (format: string) => void;
    let mdInsertHeading: (event: Event) => void;
    let onTextareaKeydown: (event: KeyboardEvent) => void;

    beforeEach(() => {
        content = ref('');
        changeCount = 0;
        // Create a real textarea in the jsdom
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textareaRef = ref<HTMLTextAreaElement | null>(textarea);

        const toolbar = useMarkdownToolbar(
            () => true,
            content,
            textareaRef,
            () => { changeCount++; }
        );
        mdFormatText = toolbar.mdFormatText;
        mdInsertHeading = toolbar.mdInsertHeading;
        onTextareaKeydown = toolbar.onTextareaKeydown;
    });

    function setSelection(text: string, start: number, end: number) {
        content.value = text;
        const textarea = textareaRef.value!;
        textarea.value = text;
        textarea.selectionStart = start;
        textarea.selectionEnd = end;
    }

    describe('mdFormatText', () => {
        describe('with no selection (inserts placeholder)', () => {
            it('bold inserts **bold text**', () => {
                setSelection('hello', 5, 5);
                mdFormatText('bold');
                expect(content.value).toBe('hello**bold text**');
                expect(changeCount).toBe(1);
            });

            it('italic inserts *italic text*', () => {
                setSelection('', 0, 0);
                mdFormatText('italic');
                expect(content.value).toBe('*italic text*');
            });

            it('strikethrough inserts ~~strikethrough text~~', () => {
                setSelection('', 0, 0);
                mdFormatText('strikethrough');
                expect(content.value).toBe('~~strikethrough text~~');
            });

            it('highlight inserts ==highlighted text==', () => {
                setSelection('', 0, 0);
                mdFormatText('highlight');
                expect(content.value).toBe('==highlighted text==');
            });

            it('code inserts `code`', () => {
                setSelection('', 0, 0);
                mdFormatText('code');
                expect(content.value).toBe('`code`');
            });

            it('ul inserts "- "', () => {
                setSelection('', 0, 0);
                mdFormatText('ul');
                expect(content.value).toBe('- ');
            });

            it('ol inserts "1. "', () => {
                setSelection('', 0, 0);
                mdFormatText('ol');
                expect(content.value).toBe('1. ');
            });

            it('checkbox inserts "- [ ] "', () => {
                setSelection('', 0, 0);
                mdFormatText('checkbox');
                expect(content.value).toBe('- [ ] ');
            });

            it('quote inserts "> "', () => {
                setSelection('', 0, 0);
                mdFormatText('quote');
                expect(content.value).toBe('> ');
            });

            it('link inserts [link text](url)', () => {
                setSelection('', 0, 0);
                mdFormatText('link');
                expect(content.value).toBe('[link text](url)');
            });

            it('hr inserts horizontal rule', () => {
                setSelection('', 0, 0);
                mdFormatText('hr');
                expect(content.value).toBe('\n---\n');
            });
        });

        describe('with selection', () => {
            it('bold wraps selection in **', () => {
                setSelection('hello world', 6, 11); // "world" selected
                mdFormatText('bold');
                expect(content.value).toBe('hello **world**');
            });

            it('italic wraps selection in *', () => {
                setSelection('hello world', 0, 5); // "hello" selected
                mdFormatText('italic');
                expect(content.value).toBe('*hello* world');
            });

            it('strikethrough wraps selection in ~~', () => {
                setSelection('delete this', 7, 11); // "this" selected
                mdFormatText('strikethrough');
                expect(content.value).toBe('delete ~~this~~');
            });

            it('highlight wraps selection in ==', () => {
                setSelection('important', 0, 9);
                mdFormatText('highlight');
                expect(content.value).toBe('==important==');
            });

            it('code wraps single-line selection in backticks', () => {
                setSelection('const x = 1', 0, 11);
                mdFormatText('code');
                expect(content.value).toBe('`const x = 1`');
            });

            it('code wraps multi-line selection in code block', () => {
                setSelection('line1\nline2', 0, 11);
                mdFormatText('code');
                expect(content.value).toBe('```\nline1\nline2\n```');
            });

            it('ul prefixes each selected line with "- "', () => {
                setSelection('apple\nbanana\ncherry', 0, 19);
                mdFormatText('ul');
                expect(content.value).toBe('- apple\n- banana\n- cherry');
            });

            it('ol numbers each selected line', () => {
                setSelection('first\nsecond\nthird', 0, 18);
                mdFormatText('ol');
                expect(content.value).toBe('1. first\n2. second\n3. third');
            });

            it('checkbox prefixes each line with "- [ ] "', () => {
                setSelection('task1\ntask2', 0, 11);
                mdFormatText('checkbox');
                expect(content.value).toBe('- [ ] task1\n- [ ] task2');
            });

            it('quote prefixes each line with "> "', () => {
                setSelection('line1\nline2', 0, 11);
                mdFormatText('quote');
                expect(content.value).toBe('> line1\n> line2');
            });

            it('link wraps selection as link text', () => {
                setSelection('click here', 0, 10);
                mdFormatText('link');
                expect(content.value).toBe('[click here](url)');
            });
        });

        it('unknown format does nothing', () => {
            setSelection('hello', 0, 5);
            mdFormatText('unknown_format');
            expect(content.value).toBe('hello');
            expect(changeCount).toBe(0);
        });

        it('always calls onContentChange for valid formats', () => {
            setSelection('', 0, 0);
            mdFormatText('bold');
            expect(changeCount).toBe(1);
            mdFormatText('italic');
            expect(changeCount).toBe(2);
        });

        it('inserts formatting mid-text', () => {
            setSelection('hello world', 5, 5); // cursor between "hello" and " world"
            mdFormatText('bold');
            expect(content.value).toBe('hello**bold text** world');
        });
    });

    describe('mdInsertHeading', () => {
        it('inserts H1 heading prefix', () => {
            setSelection('My Title', 0, 0);
            const event = { target: { value: '1' } } as unknown as Event;
            mdInsertHeading(event);
            expect(content.value).toBe('# My Title');
            expect(changeCount).toBe(1);
        });

        it('inserts H3 heading prefix', () => {
            setSelection('Sub Section', 0, 0);
            const event = { target: { value: '3' } } as unknown as Event;
            mdInsertHeading(event);
            expect(content.value).toBe('### Sub Section');
        });

        it('replaces existing heading level', () => {
            setSelection('## Old Heading', 3, 3);
            const event = { target: { value: '4' } } as unknown as Event;
            mdInsertHeading(event);
            expect(content.value).toBe('#### Old Heading');
        });

        it('handles heading on a line that is not the first', () => {
            setSelection('line1\nheading here\nline3', 10, 10); // cursor in "heading here"
            const event = { target: { value: '2' } } as unknown as Event;
            mdInsertHeading(event);
            expect(content.value).toBe('line1\n## heading here\nline3');
        });

        it('ignores NaN value', () => {
            setSelection('text', 0, 0);
            const event = { target: { value: '' } } as unknown as Event;
            mdInsertHeading(event);
            expect(content.value).toBe('text');
            expect(changeCount).toBe(0);
        });
    });

    describe('onTextareaKeydown — list continuation', () => {
        function pressEnter() {
            const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true,
            });
            onTextareaKeydown(event);
            return event;
        }

        it('continues unordered list on Enter', async () => {
            setSelection('- item 1', 8, 8); // end of "- item 1"
            pressEnter();
            await nextTick();
            expect(content.value).toBe('- item 1\n- ');
            expect(changeCount).toBe(1);
        });

        it('continues ordered list on Enter', async () => {
            setSelection('1. first', 8, 8);
            pressEnter();
            await nextTick();
            expect(content.value).toBe('1. first\n2. ');
        });

        it('continues checkbox list on Enter', async () => {
            setSelection('- [ ] task', 10, 10);
            pressEnter();
            await nextTick();
            expect(content.value).toBe('- [ ] task\n- [ ] ');
        });

        it('removes empty bullet marker on Enter', async () => {
            setSelection('- item\n- ', 9, 9); // cursor at end of empty "- "
            pressEnter();
            await nextTick();
            expect(content.value).toBe('- item\n\n');
        });

        it('removes empty ordered list marker on Enter', async () => {
            setSelection('1. item\n2. ', 11, 11);
            pressEnter();
            await nextTick();
            expect(content.value).toBe('1. item\n\n');
        });

        it('removes empty checkbox marker on Enter', async () => {
            setSelection('- [ ] task\n- [ ] ', 17, 17);
            pressEnter();
            await nextTick();
            expect(content.value).toBe('- [ ] task\n\n');
        });

        it('preserves indentation on list continuation', async () => {
            setSelection('  - nested item', 15, 15);
            pressEnter();
            await nextTick();
            expect(content.value).toBe('  - nested item\n  - ');
        });
    });

    describe('onTextareaKeydown — keyboard shortcuts', () => {
        function pressCmd(key: string, shift = false) {
            const event = new KeyboardEvent('keydown', {
                key,
                metaKey: true,
                shiftKey: shift,
                bubbles: true,
                cancelable: true,
            });
            onTextareaKeydown(event);
            return event;
        }

        it('Cmd+B applies bold', () => {
            setSelection('text', 0, 4);
            pressCmd('b');
            expect(content.value).toBe('**text**');
        });

        it('Cmd+I applies italic', () => {
            setSelection('text', 0, 4);
            pressCmd('i');
            expect(content.value).toBe('*text*');
        });

        it('Cmd+K applies link', () => {
            setSelection('text', 0, 4);
            pressCmd('k');
            expect(content.value).toBe('[text](url)');
        });

        it('Cmd+Shift+H applies highlight', () => {
            setSelection('text', 0, 4);
            pressCmd('h', true);
            expect(content.value).toBe('==text==');
        });
    });

    describe('onTextareaKeydown — disabled for non-markdown', () => {
        it('does nothing when isMarkdownFile returns false', () => {
            const nonMdContent = ref('- item');
            const ta = document.createElement('textarea');
            document.body.appendChild(ta);
            const taRef = ref<HTMLTextAreaElement | null>(ta);

            const { onTextareaKeydown: handler } = useMarkdownToolbar(
                () => false,
                nonMdContent,
                taRef,
                () => { }
            );

            ta.value = '- item';
            ta.selectionStart = 6;
            ta.selectionEnd = 6;

            const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
            handler(event);
            expect(nonMdContent.value).toBe('- item');
        });
    });
});
