/* jshint esnext: false, moz: false, browser: false, node: true */
'use strict';

module.exports = function createGruntConfig(grunt) {
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'xpi/components/tombfix.js',
        'xpi/chrome/content/overlay/overlay.js',
        'xpi/chrome/content/library/component.js',
        'xpi/chrome/content/library/expand.js',
        // 'xpi/chrome/content/library/utility.js',
        // 'xpi/chrome/content/library/tabWatcher.js',
        'xpi/chrome/content/library/repository.js',
        // 'xpi/chrome/content/library/models.js',
        // 'xpi/chrome/content/library/Tombfix.Service.js',
        'xpi/chrome/content/library/actions.js',
        // 'xpi/chrome/content/library/extractors.js',
        // 'xpi/chrome/content/library/ui.js',
        // 'xpi/chrome/content/quickPostForm.js',
        'xpi/chrome/content/options/options.js',
        'xpi/chrome/content/changeAccount/changeAccount.js',
        'xpi/defaults/preferences/prefs.js'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    jscs: {
      node: {
        files: {
          src: 'Gruntfile.js'
        },
        options: {
          config: '.jscsrc',
          esnext: null
        }
      },
      main: {
        files: {
          src: [
            'xpi/components/tombfix.js',
            'xpi/chrome/content/overlay/overlay.js',
            // 'xpi/chrome/content/library/component.js',
            'xpi/chrome/content/library/expand.js',
            // 'xpi/chrome/content/library/utility.js',
            // 'xpi/chrome/content/library/tabWatcher.js',
            'xpi/chrome/content/library/repository.js',
            // 'xpi/chrome/content/library/models.js',
            // 'xpi/chrome/content/library/Tombfix.Service.js',
            'xpi/chrome/content/library/actions.js',
            // 'xpi/chrome/content/library/extractors.js',
            // 'xpi/chrome/content/library/ui.js',
            // 'xpi/chrome/content/quickPostForm.js',
            // 'xpi/chrome/content/options/options.js',
            'xpi/chrome/content/changeAccount/changeAccount.js'
          ]
        },
        options: {
          config: '.jscsrc',
          disallowNestedTernaries: null
        }
      },
      old: {
        files: {
          src: [
            'xpi/chrome/content/library/component.js',
            'xpi/chrome/content/library/utility.js',
            'xpi/chrome/content/library/tabWatcher.js',
            'xpi/chrome/content/library/models.js',
            'xpi/chrome/content/library/Tombfix.Service.js',
            'xpi/chrome/content/library/extractors.js',
            'xpi/chrome/content/library/ui.js',
            'xpi/chrome/content/quickPostForm.js',
            'xpi/chrome/content/options/options.js'
          ]
        },
        options: {
          esnext: true,
          validateIndentation: 2,
          maximumLineLength: {
            value: 300,
            allowUrlComments: true
          },
          maximumNumberOfLines: 5000,
          disallowKeywords: ['debugger', 'with'],
          disallowImplicitTypeConversion: ['numeric', 'binary'],
          disallowKeywordsOnNewLine: ['while', 'catch', 'finally'],
          requireCommaBeforeLineBreak: true,
          disallowMixedSpacesAndTabs: true,
          disallowPaddingNewlinesBeforeKeywords: ['else', 'catch', 'finally'],
          disallowSpacesInCallExpression: true,
          disallowSpacesInFunctionDeclaration: {
            beforeOpeningRoundBrace: true
          },
          disallowSpacesInNamedFunctionExpression: {
            beforeOpeningRoundBrace: true
          },
          disallowSpacesInsideArrayBrackets: true,
          disallowTrailingWhitespace: true,
          requireCapitalizedConstructors: true,
          requireCurlyBraces: [
            'else', 'do', 'switch', 'try', 'catch', 'finally'
          ],
          requireKeywordsOnNewLine: [
            'for', 'do', 'switch', 'case', 'default', 'try', 'throw'
          ],
          requireOperatorBeforeLineBreak: [
            '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=',
            '^=', '+', '-', '*', '/', '%', '<<', '>>', '>>>', '&', '|', '^',
            '&&', '||', '==', '===', '>=', '<=', '<', '>', '!=', '!==', '?'
          ],
          requirePaddingNewLinesAfterUseStrict: true,
          requirePaddingNewlinesBeforeKeywords: ['do'],
          requireParenthesesAroundIIFE: true,
          requireSpaceAfterKeywords: [
            'case', 'return', 'throw', 'new', 'instanceof', 'in', 'of', 'yield'
          ],
          requireSpaceAfterLineComment: true,
          requireSpaceBeforeKeywords: ['finally', 'instanceof', 'in', 'of'],
          requireSpaceBetweenArguments: true,
          requireSpacesInForStatement: true,
          validateAlignedFunctionParameters: true
        }
      },
      prefs: {
        files: {
          src: 'xpi/defaults/preferences/prefs.js'
        },
        options: {
          config: '.jscsrc',
          maximumLineLength: null
        }
      }
    },
    eslint: {
      node: {
        files: {
          src: 'Gruntfile.js'
        },
        options: {
          envs: ['node'],
          rules: {
            strict: [2, 'global']
          }
        }
      },
      tombfix: {
        files: {
          src: 'xpi/components/tombfix.js'
        },
        options: {
          rules: {
            'no-unused-vars': 0,
            complexity: [2, 5],
            'new-cap': 0,
            'one-var': 0,
            indent: 0,
            'no-shadow': 0,
            'object-shorthand': 0
          }
        }
      },
      main: {
        files: {
          src: [
            'xpi/chrome/content/overlay/overlay.js',
            // 'xpi/chrome/content/library/component.js',
            'xpi/chrome/content/library/expand.js',
            // 'xpi/chrome/content/library/utility.js',
            // 'xpi/chrome/content/library/tabWatcher.js',
            'xpi/chrome/content/library/repository.js',
            // 'xpi/chrome/content/library/models.js',
            // 'xpi/chrome/content/library/Tombfix.Service.js',
            'xpi/chrome/content/library/actions.js',
            // 'xpi/chrome/content/library/extractors.js',
            // 'xpi/chrome/content/library/ui.js',
            // 'xpi/chrome/content/quickPostForm.js',
            // 'xpi/chrome/content/options/options.js',
            'xpi/chrome/content/changeAccount/changeAccount.js'
          ]
        },
        options: {
          rules: {
            'no-alert': 0,
            complexity: [2, 5],
            'new-cap': [2, {
              capIsNewExceptions: ['ConvertToUnicode', 'ConvertFromUnicode']
            }],
            'one-var': 0,
            indent: 0
          }
        }
      },
      old: {
        files: {
          src: [
            'xpi/chrome/content/library/component.js',
            'xpi/chrome/content/library/utility.js',
            'xpi/chrome/content/library/tabWatcher.js',
            'xpi/chrome/content/library/models.js',
            'xpi/chrome/content/library/Tombfix.Service.js',
            'xpi/chrome/content/library/extractors.js',
            'xpi/chrome/content/library/ui.js',
            'xpi/chrome/content/quickPostForm.js',
            'xpi/chrome/content/options/options.js'
          ]
        },
        options: {
          rules: {
            'comma-dangle': 0,
            'no-cond-assign': 0,
            'no-console': 0,
            'no-constant-condition': 0,
            'no-empty': 0,
            'no-extra-parens': 0,
            'no-extra-semi': 0,
            'no-func-assign': 0,
            'no-inner-declarations': 0,
            'valid-typeof': 0,

            complexity: 0,
            'consistent-return': 0,
            curly: 0,
            'default-case': 0,
            'dot-notation': 0,
            'dot-location': 0,
            eqeqeq: 0,
            'guard-for-in': 0,
            'no-alert': 0,
            'no-div-regex': 0,
            'no-else-return': 0,
            'no-eval': 0,
            'no-fallthrough': 0,
            'no-implicit-coercion': 0,
            'no-loop-func': 0,
            'no-multi-spaces': 0,
            'no-multi-str': 0,
            'no-restricted-syntax': [
              2, 'DebuggerStatement', 'LabeledStatement', 'WithStatement'
            ],
            'no-new-wrappers': 0,
            'no-new': 0,
            'no-octal': 0,
            'no-param-reassign': 0,
            'no-redeclare': 0,
            'no-return-assign': 0,
            'no-unused-expressions': 0,
            'no-useless-call': 0,
            'no-void': 0,
            'no-warning-comments': 0,
            radix: 0,
            'wrap-iife': 0,
            yoda: 0,

            strict: 0,

            'no-catch-shadow': 0,
            'no-shadow': 0,
            'no-undef': 0,
            'no-undefined': 0,
            'no-unused-vars': 0,
            'no-use-before-define': 0,

            'brace-style': 0,
            camelcase: 0,
            'comma-spacing': 0,
            'consistent-this': 0,
            'func-names': 0,
            'id-length': 0,
            indent: 0,
            'key-spacing': 0,
            'max-nested-callbacks': 0,
            'new-cap': 0,
            'newline-after-var': 0,
            'no-continue': 0,
            'no-inline-comments': 0,
            'no-lonely-if': 0,
            'no-multiple-empty-lines': 0,
            'no-nested-ternary': 0,
            'no-negated-condition': 0,
            'no-underscore-dangle': 0,
            'object-curly-spacing': 0,
            'one-var': 0,
            'padded-blocks': 0,
            'quote-props': 0,
            quotes: 0,
            'id-match': 0,
            'semi-spacing': 0,
            semi: 0,
            'space-after-keywords': 0,
            'space-before-keywords': 0,
            'space-before-blocks': 0,
            'space-before-function-paren': 0,
            'space-in-parens': 0,
            'space-infix-ops': 0,
            'space-unary-ops': 0,

            'no-var': 0,
            'object-shorthand': 0,
            'prefer-arrow-callback': 0,
            'prefer-spread': 0,
            'prefer-template': 0,

            'max-depth': 0,
            'max-len': 0,
            'max-params': 0,
            'max-statements': 0,
            'no-bitwise': 0,
            'no-plusplus': 0
          }
        }
      },
      prefs: {
        files: {
          src: 'xpi/defaults/preferences/prefs.js'
        },
        options: {
          rules: {
            'max-len': 0
          }
        }
      }
    },
    compress: {
      main: {
        options: {
          archive: 'tombfix.xpi',
          mode: 'zip',
          // approximately equal to the level of Windows 7's menu zip archiver?
          level: 6
        },
        expand: true,
        cwd: 'xpi/',
        src: '**/*'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jscs');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.registerTask('default', ['jshint', 'jscs', 'eslint']);
  grunt.registerTask('xpi', 'compress');
};
