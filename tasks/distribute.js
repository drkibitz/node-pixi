module.exports = function (grunt) {
    'use strict';

    grunt.registerMultiTask('distribute', 'Copy built file to examples', function(){
        var file = grunt.config.get('files.buildMin');
        var src = grunt.file.read(file);
        var dirs = this.data;

        grunt.log.writeln('File ' + file.cyan);
        dirs.forEach(function(dir){
            grunt.file.write(dir + '/pixi.js', src);
            grunt.log.writeln('Copied to ' + dir.cyan);
        });
    });
};
