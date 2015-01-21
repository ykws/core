/* jshint esnext: false, moz: false, node: true */
'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'xpi/components/tombfix.js',
        'xpi/chrome/content/overlay/overlay.js',
        'xpi/chrome/content/library/component.js',
        'xpi/chrome/content/library/prototype.js',
        // 'xpi/chrome/content/library/utility.js',
        // 'xpi/chrome/content/library/database.js',
        // 'xpi/chrome/content/library/tabWatcher.js',
        // 'xpi/chrome/content/library/Tombfix.js',
        // 'xpi/chrome/content/library/repository.js',
        // 'xpi/chrome/content/library/models.js',
        // 'xpi/chrome/content/library/Tombfix.Service.js',
        'xpi/chrome/content/library/actions.js',
        // 'xpi/chrome/content/library/extractors.js',
        // 'xpi/chrome/content/library/ui.js',
        // 'xpi/chrome/content/quickPostForm.js',
        'xpi/chrome/content/changeAccount/changeAccount.js'
        // 'xpi/chrome/content/wsh.js',
        // 'xpi/defaults/preferences/prefs.js'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    jscs: {
      all: {
        files: {
          src: [
            'Gruntfile.js'
          ]
        },
        options: {
          config: '.jscsrc'
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
  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-jscs');

  grunt.registerTask('default', ['jshint', 'jscs']);
  grunt.registerTask('xpi', 'compress');
};
