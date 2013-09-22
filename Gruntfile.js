/* jshint esnext:false, moz:false, node:true, globalstrict:true */
'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        // 'xpi/components/tombfix.js',
        // 'xpi/chrome/content/library/third_party/MochiKit.js',
        // 'xpi/chrome/content/library/component.js',
        'xpi/chrome/content/library/prototype.js'
        // 'xpi/chrome/content/library/utility.js',
        // 'xpi/chrome/content/library/database.js',
        // 'xpi/chrome/content/library/progress.js',
        // 'xpi/chrome/content/library/tabWatcher.js',
        // 'xpi/chrome/content/library/Tombfix.js',
        // 'xpi/chrome/content/library/repository.js',
        // 'xpi/chrome/content/library/models.js',
        // 'xpi/chrome/content/library/Tombfix.Service.js',
        // 'xpi/chrome/content/library/Tombfix.Service.actions.js',
        // 'xpi/chrome/content/library/extractors.js',
        // 'xpi/chrome/content/library/ui.js',
        // 'xpi/chrome/content/quickPostForm.js',
        // 'xpi/chrome/content/wsh.js',
        // 'xpi/defaults/preferences/prefs.js'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    }
  });

  // load tasks
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // alias
  grunt.registerTask('lint', 'jshint');
  grunt.registerTask('travis', 'jshint');
  grunt.registerTask('default', 'lint');
};
