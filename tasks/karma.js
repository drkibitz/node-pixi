module.exports = function (grunt) {
    'use strict';

    var path = require('path');
    var server = require('karma').server;

    grunt.registerMultiTask('karma', 'Run with karma runner.', function () {
        var done = this.async();
        var options = this.options({
            background: false
        });
        var data = this.data;
        data = grunt.util._.merge(options, data);

        if (data.configFile) {
            data.configFile = path.resolve(data.configFile);
            data.configFile = grunt.template.process(data.configFile);
        }
        if (data.appendFiles) {
            data.files = data.files.concat(data.appendFiles);
            delete data.appendFiles;
        }
        if (data.prependFiles) {
            data.files = data.prependFiles.concat(data.files);
            delete data.prependFiles;
        }

        server.start(
            data,
            function(code) {
                done(!code);
            });
    });
};
