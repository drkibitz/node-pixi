'use strict';

module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.loadNpmTasks('grunt-browserify');
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
        dirs: {
            build    : 'bin',
            docs     : 'docs',
            examples : 'examples',
            src      : 'src',
            test     : 'test'
        },
        files: {
            build    : '<%= dirs.build %>/pixi.js',
            buildMin : '<%= dirs.build %>/pixi.min.js'
        },

        // Configure tasks
        browserify: {
            dist: {
                files: {
                    '<%= files.build %>': ['<%= dirs.src %>/pixi.js'],
                }
            }
        },
        jshint: {
            beforeconcat: {
                src: '<%= dirs.src %>/**/*.js',
                options: {
                    jshintrc: '.jshintrc',
                    ignores: [
                        '<%= dirs.src %>/pixi/filters/MaskFilter.js'
                    ]
                }
            },
            afterconcat: {
                src: '<%= files.build %>',
                options: {
                    jshintrc: '.jshintrc',
                }
            },
            test: {
                src: ['<%= dirs.test %>/{functional,lib/pixi,unit}/**/*.js'],
                options: {
                    expr: true
                }
            }
        },
        uglify: {
            options: {
                banner: banner
            },
            dist: {
                src: '<%= files.build %>',
                dest: '<%= files.buildMin %>'
            }
        },
        distribute: {
            examples: [
                'examples/example 1 - Basics',
                'examples/example 2 - SpriteSheet',
                'examples/example 3 - MovieClip',
                'examples/example 4 - Balls',
                'examples/example 5 - Morph',
                'examples/example 6 - Interactivity',
                'examples/example 7 - Transparent Background',
                'examples/example 8 - Dragging',
                'examples/example 9 - Tiling Texture',
                'examples/example 10 - Text',
                'examples/example 11 - RenderTexture',
                'examples/example 12 - Spine',
                'examples/example 13 - Graphics',
                'examples/example 14 - Masking'
            ]
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
            compile: {
                name: '<%= package.name %>',
                description: '<%= package.description %>',
                version: '<%= package.version %>',
                url: '<%= package.homepage %>',
                options: {
                    paths: '<%= dirs.src %>',
                    outdir: '<%= dirs.docs %>'
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

    grunt.registerTask('lintconcat', ['jshint:beforeconcat', 'browserify:dist', 'jshint:afterconcat']);
    grunt.registerTask('build', ['lintconcat', 'uglify', 'distribute']);
    grunt.registerTask('test', ['lintconcat', 'jshint:test', 'karma']);
    grunt.registerTask('docs', ['yuidoc']);
    grunt.registerTask('default', ['test', 'uglify', 'distribute']);
    // Travis CI task.
    grunt.registerTask('travis', ['test']);
};
