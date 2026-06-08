export default {
  extends: ['stylelint-config-standard-scss'],
  plugins: ['stylelint-scss'],
  rules: {
    // === UNITS ===
    'declaration-property-unit-allowed-list': {
      'font-size': ['rem'],
      'line-height': [],
      'margin': ['em'],
      'margin-top': ['em'],
      'margin-bottom': ['em'],
      'margin-left': ['em'],
      'margin-right': ['em'],
      'padding': ['em'],
      'padding-top': ['em'],
      'padding-bottom': ['em'],
      'padding-left': ['em'],
      'padding-right': ['em'],
      'gap': ['em'],
      'row-gap': ['em'],
      'column-gap': ['em'],
      'border-radius': ['em'],
      'min-width': ['px'],
      'max-width': ['px'],
      'min-height': ['px'],
      'max-height': ['px'],
      'width': ['rem', '%', 'auto', 'vh', 'vw'],
      'height': ['rem', '%', 'auto', 'vh', 'vw']
    },
    'unit-disallowed-list': [
      'px',
      {
        'ignoreProperties': {
          'px': ['/^border/', 'box-shadow', '/^outline/', '/^min-/', '/^max-/']
        }
      }
    ],

    // === NO VENDOR PREFIXES ===
    'property-no-vendor-prefix': true,
    'value-no-vendor-prefix': true,
    'selector-no-vendor-prefix': true,
    'at-rule-no-vendor-prefix': true,

    // === SCSS VARIABLES ===
    'scss/dollar-variable-pattern': '^[a-z][a-z0-9-]*$',
    'scss/dollar-variable-empty-line-before': [
      'always',
      {
        'except': ['first-nested', 'after-comment']
      }
    ],

    // === LAYOUT ===
    'property-no-unknown': [
      true,
      {
        'ignoreProperties': ['/^composes/']
      }
    ],

    // === LINE HEIGHT ===
    'scss/declaration-nested-properties': 'never',

    // === SCOPED STYLES ===
    'selector-max-specificity': ['0,2,0'],
    'selector-max-id': 0,

    // === GENERAL BEST PRACTICES ===
    'color-no-invalid-hex': true,
    'declaration-no-important': true,
    'declaration-block-no-duplicate-properties': true,
    'no-descending-specificity': null,
    'selector-pseudo-element-no-unknown': true,
    'media-feature-name-no-unknown': true,
    'at-rule-no-unknown': [
      true,
      {
        'ignoreAtRules': ['mixin', 'include', 'extend', 'if', 'else', 'for', 'each', 'while', 'function', 'return']
      }
    ],

    // === IGNORE SCOPED STYLES SPECIFICITY FOR VUE ===
    'selector-pseudo-class-no-unknown': [
      true,
      {
        'ignorePseudoClasses': ['deep', 'global', 'v-deep', 'v-global']
      }
    ]
  },
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html'
    }
  ]
}
