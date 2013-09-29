module.exports = function(grunt) {
    'use strict';

    var banner = [
    '/**',
    ' * <%= package.name %> <%= package.version %>',
    ' * <%= package.homepage %>',
    ' * Copyright (c) 2013 Dr. Kibitz, http://drkibitz.com',
    ' * <%= package.description %>',
    ' * built: ' + new Date(),
    ' *',
    ' * Pixi.js - v1.3.0',
    ' * Copyright (c) 2012, Mat Groves',
    ' */',
    ''].join("\n");

    grunt.initConfig({
        // Configure values
        bundle: {
            dev        : 'bundle.js',
            debug      : '<%= dir.build %>/pixi-<%= package.version %>-debug.js',
            release    : '<%= dir.build %>/pixi-<%= package.version %>-release.js'
        },
        dir: {
            bin        : 'bin',
            build      : 'build',
            distmodule : '<%= dir.build %>/node_modules/<%= package.name %>',
            docs       : '<%= dir.build %>/docs',
            example    : '<%= dir.build %>/example',
            reports    : '<%= dir.build %>/reports',
            src        : 'src',
            test       : 'test'
        },
        package : grunt.file.readJSON('package.json'),

        // Configure tasks

        // grunt-browserify
        browserify: {
            debug: {
                options: {
                    debug: true
                },
                files: {
                    '<%= bundle.debug %>': ['<%= bundle.debug %>']
                }
            },
            release: {
                files: {
                    '<%= bundle.release %>': ['<%= bundle.release %>']
                }
            }
        },
        // grunt-contrib-clean
        clean: {
            bin: '<%= dir.bin %>',
            bundles: ['<%= bundle.debug %>', '<%= bundle.release %>'],
            distmodule: '<%= dir.distmodule %>',
            docs: '<%= dir.docs %>',
            example: '<%= dir.example %>',
            reports: '<%= dir.reports %>'
        },
        // grunt-contrib-copy
        copy: {
            distmodule: {
                files: [{
                    cwd: '<%= dir.src %>',
                    expand: true,
                    src: '**',
                    dest: '<%= dir.distmodule %>/'
                }, {
                    src: [
                        'LICENSE',
                        'LICENSE-Pixi',
                        'README.md'
                    ],
                    dest: '<%= dir.distmodule %>/'
                }, {
                    '<%= dir.build %>/': '<%= bundle.dev %>',
                    '<%= bundle.debug %>': '<%= bundle.dev %>',
                    '<%= bundle.release %>': '<%= bundle.dev %>'
                }]
            },
            // Copy package removing devDependencies because they are
            // not valid when using the distributed module.
            distmodule_package: {
                files: {
                    '<%= dir.distmodule %>/': 'package.json'
                },
                options: {
                    processContent: function (contents, srcpath) {
                        var json = JSON.parse(contents);
                        delete json.devDependencies;
                        return JSON.stringify(json, null, "  ");
                    }
                }
            },
            example: {
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
                        src: '<%= bundle.release %>',
                        dest: '<%= dir.example %>/' + name + '/pixi.js'
                    };
                })
            },
            bin: {
                cwd: '<%= dir.build %>',
                expand: true,
                src: 'pixi-*-*.js',
                dest: '<%= dir.bin %>/'
            }
        },
        // grunt-contrib-jshint
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            src: {
                src: [
                    'Gruntfile.js',
                    'tasks/**/*.js',
                    '<%= dir.src %>/**/*.js',
                    '<%= dir.test %>/**/*.js'
                ],
                options: {
                    ignores: ['<%= dir.src %>/pixi/filters/MaskFilter.js']
                }
            },
            debug: {
                src: '<%= bundle.debug %>'
            }
        },
        // grunt-mocha-test
        mochaTest: {
            options: {
                globals: ['expect', 'resemble', 'pixitest', 'PIXI'],
                timeout: 3000,
                ignoreLeaks: false
            },
            distmodule: {
                options: {
                    require: ['<%= dir.build %>/<%= bundle.dev %>', 'node-pixi-pixitest']
                },
                src: [
                    //'<%= dir.test %>/unit/**/*.js'
                    //'<%= dir.test %>/functional/**/*.js'
                ]
            }
        },
        // ./tasks/pixi.js
        pixi_karma: {
            options: {
                basePath: process.cwd(),
                configFile: '<%= dir.test %>/karma.conf.js',
                files: [
                    {pattern: '<%= dir.test %>/**/*.png', watched: false, included: false, served: true},
                    'node_modules/node-pixi-pixitest/pixitest.js',
                    '<%= dir.test %>/unit/**/*.js',
                    //'<%= dir.test %>/functional/**/*.js'
                ]
            },
            debug: {
                prependFiles: ['<%= bundle.debug %>']
            },
            release: {
                port : 9877, // different port to run on same process if need be
                prependFiles: ['<%= bundle.release %>']
            }
        },
        // grunt-plato
        plato: {
            src: {
                options : {
                    jshint : false
                },
                files: {
                    '<%= dir.reports %>': ['<%= dir.src %>/**/*.js'],
                }
            }
        },
        // grunt-contrib-uglify
        uglify: {
            options: {
                banner: banner
            },
            distmodule: {
                cwd: '<%= dir.distmodule %>',
                expand: true,
                src: '**/*.js',
                dest: '<%= dir.distmodule %>/'
            },
            release: {
                options: {
                    wrap: true,
                    // This is slow, just do it on CI
                    report: process.env.TRAVIS ? 'gzip' : 'min'
                },
                files: {
                    '<%= bundle.release %>': '<%= bundle.release %>'
                }
            }
        },
        // grunt-contrib-yuidoc
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
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-plato');
    grunt.loadTasks('tasks');

    // Lint source, then copy files that make up the final npm module
    grunt.registerTask('distmodule', [
        'clean:distmodule',
        'copy:distmodule',
        'copy:distmodule_package'
    ]);
    // Copy module, bundle for debug with sourceMapping
    grunt.registerTask('debug', [
        'distmodule',
        'browserify:debug'
    ]);
    // Copy and uglify module, bundle, and uglify for release
    grunt.registerTask('release', [
        'distmodule',
        'uglify:distmodule',
        'browserify:release',
        'uglify:release'
    ]);

    // npm test (Travis CI task)
    // Build debug, test, build release, and test again
    grunt.registerTask('travis', [
        'jshint:src', // check source before anything
        // debug
        'distmodule',
        'mochaTest', // node test
        'browserify:debug',
        'jshint:debug',
        'pixi_karma:debug', // browser test
        // release
        'uglify:distmodule',
        'mochaTest', // node test
        'browserify:release',
        'uglify:release',
        'pixi_karma:release' // browser test
    ]);

    grunt.registerTask('docs', ['clean:docs', 'yuidoc:docs']);
    grunt.registerTask('test', ['pixi_karma:release', 'mochaTest']);

    // grunt
    grunt.registerTask('default', [
        'travis',
        'plato:src',
        'clean:bin',
        'copy:bin',
        'clean:example',
        'copy:example'
    ]);
};
