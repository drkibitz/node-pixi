'use strict';

module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadTasks('tasks');

    grunt.initConfig({
        // Configure values
        pkg : grunt.file.readJSON('package.json'),
        dirs: {
            build    : 'bin',
            docs     : 'docs',
            examples : 'examples',
            src      : 'src',
            test     : 'test'
        },
        files: {
            build    : '<%= dirs.build %>/pixi.dev.js',
            buildMin : '<%= dirs.build %>/pixi.js'
        },
        strings: {
            banner: [
                '/**',
                ' * @license',
                ' * <%= pkg.name %> - v<%= pkg.version %>',
                ' * Copyright (c) 2012, Mat Groves',
                ' * <%= pkg.homepage %>',
                ' *',
                ' * Compiled: <%= grunt.template.today("yyyy-mm-dd") %>',
                ' *',
                ' * <%= pkg.name %> is licensed under the <%= pkg.license %> License.',
                ' * <%= pkg.licenseUrl %>',
                ' */',
                ''
            ].join('\n')
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
                banner: '<%= strings.banner %>'
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
                name: '<%= pkg.name %>',
                description: '<%= pkg.description %>',
                version: '<%= pkg.version %>',
                url: '<%= pkg.homepage %>',
                logo: '<%= pkg.logo %>',
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

    grunt.registerMultiTask(
        'distribute',
        'Copy built file to examples',
        function(){
            var pixi = grunt.file.read( grunt.config.get('files.build') );

            var dests = this.data;

            dests.forEach(function(filepath){

                grunt.file.write(filepath + '/pixi.js', pixi);

            });

            grunt.log.writeln('Pixi copied to examples.');
        }
    );

    grunt.registerTask('lintconcat', ['jshint:beforeconcat', 'browserify:dist', 'jshint:afterconcat']);
    grunt.registerTask('build', ['lintconcat', 'uglify', 'distribute']);
    grunt.registerTask('test', ['lintconcat', 'jshint:test', 'karma']);
    grunt.registerTask('docs', ['yuidoc']);
    grunt.registerTask('default', ['test', 'uglify', 'distribute']);
    // Travis CI task.
    grunt.registerTask('travis', ['test']);
};
