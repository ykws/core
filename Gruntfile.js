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
        // 'xpi/chrome/content/wsh.js',
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
      tombfix: {
        files: {
          src: 'xpi/components/tombfix.js'
        },
        options: {
          config: '.jscsrc',
          disallowDanglingUnderscores: null,
          requireCamelCaseOrUpperCaseIdentifiers: null
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
            // 'xpi/chrome/content/wsh.js'
          ]
        },
        options: {
          config: '.jscsrc',
          disallowKeywords: ['var', 'continue', 'debugger', 'with']
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
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.registerTask('default', ['jshint', 'jscs']);
  grunt.registerTask('xpi', 'compress');
};
