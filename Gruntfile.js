/* jshint esnext:false, moz:false, node:true, globalstrict:true */
'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'xpi/components/tombfix.js',
        'xpi/chrome/content/library/component.js',
        'xpi/chrome/content/library/prototype.js',
        // 'xpi/chrome/content/library/utility.js',
        // 'xpi/chrome/content/library/database.js',
        // 'xpi/chrome/content/library/progress.js',
        // 'xpi/chrome/content/library/tabWatcher.js',
        // 'xpi/chrome/content/library/Tombfix.js',
        // 'xpi/chrome/content/library/repository.js',
        // 'xpi/chrome/content/library/models.js',
        // 'xpi/chrome/content/library/Tombfix.Service.js',
        'xpi/chrome/content/library/actions.js'
        // 'xpi/chrome/content/library/extractors.js',
        // 'xpi/chrome/content/library/ui.js',
        // 'xpi/chrome/content/quickPostForm.js',
        // 'xpi/chrome/content/wsh.js',
        // 'xpi/defaults/preferences/prefs.js'
      ],
      options: {
        jshintrc: '.jshintrc'
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

  // load tasks
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-compress');

  // alias
  grunt.registerTask('lint', 'jshint');
  grunt.registerTask('travis', 'jshint');
  grunt.registerTask('default', 'lint');
  grunt.registerTask('xpi', 'compress');
};
