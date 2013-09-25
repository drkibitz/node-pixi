module.exports = function(grunt) {
    'use strict';

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.loadTasks('tasks');

    var banner = [
    '/**',
    ' * <%= package.name %> <%= package.version %>',
    ' * <%= package.homepage %>',
    ' * Copyright (c) 2013 Dr. Kibitz, http://drkibitz.com',
    ' * <%= package.description %>',
    ' * built: ' + new Date(),
    ' *',
    ' * @license',
    ' * Pixi.js - v1.3.0',
    ' * Copyright (c) 2012, Mat Groves',
    ' */',
    ''].join("\n");

    grunt.initConfig({
        // Configure values
        package : grunt.file.readJSON('package.json'),
        dir: {
            build    : 'bin',
            docs     : 'docs',
            example  : 'example',
            src      : 'src',
            test     : 'test'
        },
        file: {
            build    : '<%= dir.build %>/pixi.js',
            buildMin : '<%= dir.build %>/pixi.min.js'
        },

        // Configure tasks
        browserify: {
            bin: {
                files: {
                    '<%= file.build %>': ['<%= dir.src %>/pixi.js'],
                }
            }
        },
        jshint: {
            beforeconcat: {
                src: [
                    'Gruntfile.js',
                    'tasks/**/*.js',
                    '<%= dir.src %>/**/*.js'
                ],
                options: {
                    jshintrc: '.jshintrc',
                    ignores: [
                        '<%= dir.src %>/pixi/filters/MaskFilter.js'
                    ]
                }
            },
            afterconcat: {
                src: '<%= file.build %>',
                options: {
                    jshintrc: '.jshintrc',
                }
            },
            test: {
                src: [
                    '<%= dir.test %>/lib/pixi/**/*.js',
                    '<%= dir.test %>/unit/**/*.js',
                    '<%= dir.test %>/functional/**/*.js'
                ],
                options: {
                    expr: true
                }
            }
        },
        uglify: {
            options: {
                banner: banner
            },
            bin: {
                src: '<%= file.build %>',
                dest: '<%= file.buildMin %>'
            }
        },
        copy: {
            examples: {
                files: [
                    '1-basics',
                    '2-sprite-sheet',
                    '3-movie-clip',
                    '4-balls',
                    '5-morph',
                    '6-interactivity',
                    '7-transparent-background',
                    '8-dragging',
                    '9-tiling-texture',
                    '10-text',
                    '11-render-texture',
                    '12-spine',
                    '13-graphics',
                    '14-masking'
                ].map(function (name) {
                    return {
                        src: '<%= file.buildMin %>',
                        dest: '<%= dir.example %>/' + name + '/pixi.js'
                    };
                })
            }
        },
        connect: {
            test: {
                options: {
                    port: grunt.option('port-test') || 9002,
                    base: './',
                    keepalive: true
                }
            }
        },
        yuidoc: {
            docs: {
                name: '<%= package.name %>',
                description: '<%= package.description %>',
                version: '<%= package.version %>',
                url: '<%= package.homepage %>',
                options: {
                    paths: '<%= dir.src %>',
                    outdir: '<%= dir.docs %>'
                }
            }
        },
        karma: {
            unit: {
                configFile: 'test/karma.conf.js',
                // browsers: ['Chrome'],
                singleRun: true
            }
        }
    });

    grunt.registerTask('lintconcat', ['jshint:beforeconcat', 'browserify:bin', 'jshint:afterconcat']);
    grunt.registerTask('build', ['lintconcat', 'uglify:bin', 'copy:examples']);
    grunt.registerTask('test', ['lintconcat', 'jshint:test', 'karma:unit']);
    grunt.registerTask('docs', ['yuidoc:docs']);
    grunt.registerTask('default', ['test', 'uglify:bin', 'copy:examples']);
    // Travis CI task.
    grunt.registerTask('travis', ['test']);
};
