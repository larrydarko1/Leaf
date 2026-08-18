import a11y from 'eslint-plugin-vuejs-accessibility';

export default [
    {
        files: ['src/renderer/**/*.vue'],
        plugins: { a11y },
        rules: {
            'vue/enforce-style-attribute': ['error', { allow: ['scoped'] }],
            'a11y/alt-text': 'error',
            'a11y/anchor-has-content': 'error',
            'a11y/heading-has-content': 'error',
            'a11y/form-control-has-label': 'error',
            'a11y/iframe-has-title': 'error',
            'a11y/label-has-for': ['error', { required: { some: ['nesting', 'id'] } }],
            'a11y/aria-props': 'error',
            'a11y/aria-role': 'error',
            'a11y/role-has-required-aria-props': 'error',
            'a11y/aria-unsupported-elements': 'error',
            'a11y/no-redundant-roles': 'error',
            'a11y/no-aria-hidden-on-focusable': 'error',
            'a11y/click-events-have-key-events': 'error',
            'a11y/mouse-events-have-key-events': 'error',
            'a11y/no-static-element-interactions': 'error',
            'a11y/interactive-supports-focus': 'error',
            'a11y/tabindex-no-positive': 'error',
            'a11y/no-access-key': 'error',
            'a11y/no-autofocus': 'error',
            'a11y/no-distracting-elements': 'error',
            'a11y/media-has-caption': 'error',
        },
    },
    {
        // App.vue hosts the global stylesheet — scoping it would scope the whole app.
        files: ['src/renderer/App.vue'],
        rules: { 'vue/enforce-style-attribute': ['error', { allow: ['scoped', 'plain'] }] },
    },
];
