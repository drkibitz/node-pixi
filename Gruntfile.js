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
            source   : '<%= dir.source %>/bundle-src.js',
            debug    : '<%= dir.build %>/pixi-debug.js',
            release  : '<%= dir.build %>/pixi.js'
        },
        dir: {
            build     : 'build',
            coverage  : '<%= dir.build %>/coverage',
            dist      : 'dist',
            buildpkg   : '<%= dir.build %>/node_modules/<%= pkg.name %>',
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
                '<%= bundle.debug %>',
                '<%= bundle.release %>'
            ],
            coverage: ['<%= dir.coverage %>'],
            dist: ['<%= dir.dist %>'],
            buildpkg: '<%= dir.buildpkg %>',
            docs: '<%= dir.docs %>',
            reports: '<%= dir.reports %>'
        },
        // grunt-contrib-copy
        copy: {
            buildpkg: {
                files: [{
                    cwd: '<%= dir.sourcepkg %>',
                    expand: true,
                    src: '**',
                    dest: '<%= dir.buildpkg %>/'
                }, {
                    src: [
                        'LICENSE',
                        'LICENSE-Pixi',
                        'README.md'
                    ],
                    dest: '<%= dir.buildpkg %>/'
                }, {
                    // Copy all these first before bundling.
                    // This is because we can test that bundling works
                    // with a test version of the distributed package.
                    '<%= bundle.debug %>': '<%= dir.source %>/bundle-build.js',
                    '<%= bundle.release %>': '<%= dir.source %>/bundle-build.js'
                }]
            },
            // Copy package.js processing the content
            buildpkgjson: {
                files: {
                    '<%= dir.buildpkg %>/': 'package.json'
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
                ignoreLeaks: false,
                require: [
                    '<%= dir.source %>/bundle-node.js',
                    'node-pixi-pixitest'
                ]
            },
            source: {
                options: {
                    reporter: 'spec'
                },
                src: [
                    '<%= dir.test %>/unit/**/*.js'
                    //'<%= dir.test %>/functional/**/*.js'
                ]
            }
        },
        // ./tasks/pixi.js
        karma: {
            options: {
                configFile: '<%= dir.test %>/karma.conf.js',
                // WARNING: Do not set these in the config file!
                basePath: process.cwd(),
                frameworks: ['mocha'],
                reporters: ['spec'],
                port: 9876,
                runnerPort: 9100,
                files: [
                    {pattern: '<%= dir.test %>/**/*.png', watched: false, included: false, served: true},
                    'node_modules/node-pixi-pixitest/pixitest.js',
                    '<%= dir.test %>/unit/**/*.js'
                    //'<%= dir.test %>/functional/**/*.js'
                ],
                browsers: [process.env.TRAVIS ? 'Firefox' : 'Chrome'],
                singleRun: true,
                plugins: [
                    'karma-mocha',
                    'karma-spec-reporter',
                    process.env.TRAVIS ? 'karma-firefox-launcher' : 'karma-chrome-launcher'
                ]
            },
            // test with source
            source: {
                preprocessors: {
                    '<%= dir.sourcepkg %>/**/*.js': ['commonjs'],
                    '<%= bundle.source %>': ['commonjs'],
                    '<%= dir.test %>/unit/**/*.js': ['commonjs']
                },
                append: {
                    frameworks: ['commonjs'],
                    plugins: ['karma-commonjs']
                },
                prepend: {
                    files: [
                        '<%= dir.sourcepkg %>/**/*.js',
                        '<%= bundle.source %>'
                    ]
                }
            },
            // test with instrumented source
            coverage: {
                port: 9877, // different port to run on same process if need be
                preprocessors: {
                    '<%= dir.sourcepkg %>/**/*.js': ['commonjs', 'coverage'],
                    '<%= bundle.source %>': ['commonjs'],
                    '<%= dir.test %>/unit/**/*.js': ['commonjs']
                },
                coverageReporter: {
                    type: 'lcov',
                    dir: '<%= dir.coverage %>/'
                },
                append: {
                    frameworks: ['commonjs'],
                    reporters: ['coverage'],
                    plugins: [
                        'karma-commonjs',
                        'karma-coverage'
                    ]
                },
                prepend: {
                    files: [
                        '<%= dir.sourcepkg %>/**/*.js',
                        '<%= bundle.source %>'
                    ]
                }
            },
            // test with debug bundle
            debug: {
                port: 9878, // different port to run on same process if need be
                reporters: ['dots'],
                prepend: {
                    files: ['<%= bundle.debug %>']
                }
            },
            // test with release bundle
            release: {
                port: 9879, // different port to run on same process if need be
                reporters: ['dots'],
                prepend: {
                    files: ['<%= bundle.release %>']
                }
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
            buildpkg: {
                cwd: '<%= dir.buildpkg %>',
                expand: true,
                src: '**/*.js',
                dest: '<%= dir.buildpkg %>/'
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

    // Generate coverage
    grunt.registerTask('coverage', ['clean:coverage', 'karma:coverage']);

    // Generate documenation
    grunt.registerTask('docs', ['clean:docs', 'yuidoc:docs']);

    // Copy files that make up the final npm module
    grunt.registerTask('buildpkg', [
        'revision',
        'clean:buildpkg',
        'copy:buildpkg',
        'copy:buildpkgjson'
    ]);

    // Bundle for debug with sourceMapping, then test it
    // Bundle and uglify for release, then test it
    // After tests, copy bundles to dist
    grunt.registerTask('build', [
        // copy package
        'buildpkg',
        // debug
        'browserify:debug',
        'karma:debug', // test bundle in browser
        // release
        'uglify:buildpkg',
        'browserify:release',
        'uglify:release',
        'karma:release', // test bundle in browser
        // Copy bundles to dist
        'clean:dist',
        'copy:dist'
    ]);

    // npm test (List and test source)
    grunt.registerTask('test', [
        'jshint:source',
        'jshint:test',
        'coverage', // Use karma:source to test without coverage
        'mochaTest:source'
    ]);

    // grunt
    grunt.registerTask('default', [
        'test',         // Lint and test source
        'build'         // Build and test package and bundles
    ]);
};
