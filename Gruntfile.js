/*global process*/
module.exports = function(grunt) {
    'use strict';

    var banner = [
        '/**',
        ' * <%= pkg.name %> <%= releaseVersion %> (<%= meta.revision %>)',
        ' * <%= pkg.homepage %>',
        ' * Copyright (c) 2013-' + new Date().getFullYear() + ' Dr. Kibitz, http://drkibitz.com',
        ' * <%= pkg.description %>',
        ' * built: ' + new Date(),
        ' *',
        ' * Pixi.js - v1.3.0',
        ' * Copyright (c) 2012, Mat Groves',
        ' */',
        ''
    ].join('\n');

    grunt.initConfig({
        // Configure values
        bundle: {
            source    : '<%= dir.source %>/bundle.js',
            test      : '<%= dir.build %>/bundle.js',
            debug     : '<%= dir.build %>/pixi-debug.js',
            release   : '<%= dir.build %>/pixi.js'
        },
        dir: {
            build     : 'build',
            dist      : 'dist',
            distpkg   : '<%= dir.build %>/node_modules/<%= pkg.name %>',
            docs      : '<%= dir.build %>/docs',
            reports   : '<%= dir.build %>/reports',
            source    : 'src',
            sourcepkg : '<%= dir.source %>/<%= pkg.name %>',
            test      : 'test'
        },
        pkg: grunt.file.readJSON('package.json'),
        // Release version is without '-dev' from package version
        releaseVersion: '<%= pkg.version.substr(0, pkg.version.indexOf(\'-\')) %>',

        // Configure tasks

        // grunt-browserify
        browserify: {
            debug: {
                options: {
                    debug: true
                },
                files: {
                    // Should have already been copied with
                    // a test installation of the package.
                    '<%= bundle.debug %>': ['<%= bundle.debug %>']
                }
            },
            release: {
                files: {
                    // Should have already been copied with
                    // a test installation of the package.
                    '<%= bundle.release %>': ['<%= bundle.release %>']
                }
            }
        },
        // grunt-contrib-clean
        clean: {
            bundles: [
                '<%= bundle.test %>',
                '<%= bundle.debug %>',
                '<%= bundle.release %>'
            ],
            dist: ['<%= dir.dist %>'],
            distpkg: '<%= dir.distpkg %>',
            docs: '<%= dir.docs %>',
            reports: '<%= dir.reports %>'
        },
        // grunt-contrib-copy
        copy: {
            distpkg: {
                files: [{
                    cwd: '<%= dir.sourcepkg %>',
                    expand: true,
                    src: '**',
                    dest: '<%= dir.distpkg %>/'
                }, {
                    src: [
                        'LICENSE',
                        'LICENSE-Pixi',
                        'README.md'
                    ],
                    dest: '<%= dir.distpkg %>/'
                }, {
                    // Copy all these first before bundling.
                    // This is because we can test that bundling works
                    // with a test version of the distributed package.
                    '<%= bundle.test %>': '<%= bundle.source %>',
                    '<%= bundle.debug %>': '<%= bundle.source %>',
                    '<%= bundle.release %>': '<%= bundle.source %>'
                }]
            },
            // Copy package.js processing the content
            distpkgjson: {
                files: {
                    '<%= dir.distpkg %>/': 'package.json'
                },
                options: {
                    process: function (contents) {
                        var json = JSON.parse(contents);
                        // Remove devDependencies because they are
                        // not valid when using the distributed module.
                        delete json.devDependencies;
                        // Set package version to release version
                        json.version = grunt.config.get('releaseVersion');
                        return JSON.stringify(json, null, '  ');
                    }
                }
            },
            dist: {
                cwd: '<%= dir.build %>',
                expand: true,
                src: 'pixi*.js',
                dest: '<%= dir.dist %>/'
            }
        },
        // grunt-contrib-jshint
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            source: {
                src: [
                    'Gruntfile.js',
                    'tasks/**/*.js',
                    '<%= dir.source %>/**/*.js'
                ],
                options: {
                    ignores: ['<%= dir.sourcepkg %>/utils/spine.js']
                }
            },
            test: {
                src: [
                    '<%= dir.test %>/**/*.js'
                ]
            }
        },
        // grunt-mocha-test
        mochaTest: {
            options: {
                globals: ['expect', 'resemble', 'pixitest', 'PIXI'],
                timeout: 3000,
                ignoreLeaks: false
            },
            distpkg: {
                options: {
                    require: ['<%= bundle.test %>', 'node-pixi-pixitest']
                },
                src: [
                    //'<%= dir.test %>/unit/**/*.js'
                    //'<%= dir.test %>/functional/**/*.js'
                ]
            }
        },
        // ./tasks/pixi.js
        karma: {
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
            source: {
                options : {
                    jshint : false
                },
                files: {
                    '<%= dir.reports %>': ['<%= dir.sourcepkg %>/**/*.js'],
                }
            }
        },
        // grunt-contrib-uglify
        uglify: {
            options: {
                banner: banner
            },
            distpkg: {
                cwd: '<%= dir.distpkg %>',
                expand: true,
                src: '**/*.js',
                dest: '<%= dir.distpkg %>/'
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
                name: '<%= pkg.name %>',
                description: '<%= pkg.description %>',
                version: '<%= releaseVersion %>',
                url: '<%= pkg.homepage %>',
                options: {
                    paths: '<%= dir.sourcepkg %>',
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
    grunt.loadNpmTasks('grunt-git-revision');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-plato');
    grunt.loadTasks('tasks');

    // Generate documenation
    grunt.registerTask('docs', ['clean:docs', 'yuidoc:docs']);
    // Run tests
    grunt.registerTask('test', ['karma:release', 'mochaTest']);

    // Copy files that make up the final npm module
    grunt.registerTask('distpkg', [
        'revision',
        'clean:distpkg',
        'copy:distpkg',
        'copy:distpkgjson'
    ]);
    // Copy module, bundle for debug with sourceMapping
    grunt.registerTask('debug', [
        'distpkg',
        'browserify:debug'
    ]);
    // Copy and uglify module, bundle, and uglify for release
    grunt.registerTask('release', [
        'distpkg',
        'uglify:distpkg',
        'browserify:release',
        'uglify:release'
    ]);

    // npm test (Travis CI task)
    // Build debug, test, build release, and test again
    grunt.registerTask('travis', [
        'jshint:source', // check source before anything
        'jshint:test', // then tests
        // debug
        'distpkg',
        'mochaTest', // node test
        'browserify:debug',
        'karma:debug', // browser test
        // release
        'uglify:distpkg',
        'mochaTest', // node test
        'browserify:release',
        'uglify:release',
        'karma:release' // browser test
    ]);

    // grunt
    grunt.registerTask('default', [
        'travis',
        'plato:source',
        'clean:dist',
        'copy:dist'
    ]);
};
