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
            direct   : '<%= dir.source %>/bundle-direct.js',
            distpkg  : '<%= dir.source %>/bundle-distpkg.js',
            testnode : '<%= dir.source %>/bundle-testnode.js',
            debug    : '<%= dir.build %>/pixi-debug.js',
            release  : '<%= dir.build %>/pixi.js'
        },
        dir: {
            build     : 'build',
            coverage  : '<%= dir.build %>/coverage',
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
                '<%= bundle.debug %>',
                '<%= bundle.release %>'
            ],
            coverage: ['<%= dir.coverage %>'],
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
                    '<%= bundle.debug %>': '<%= bundle.distpkg %>',
                    '<%= bundle.release %>': '<%= bundle.distpkg %>'
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
        // grunt-coveralls
        coveralls: {
            travis: {
                files: {
                    src: '<%= dir.coverage %>/**/lcov.info'
                }
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
                    '<%= bundle.testnode %>',
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
                    '<%= bundle.direct %>': ['commonjs'],
                    '<%= dir.test %>/unit/**/*.js': ['commonjs']
                },
                append: {
                    frameworks: ['commonjs'],
                    plugins: ['karma-commonjs']
                },
                prepend: {
                    files: [
                        '<%= dir.sourcepkg %>/**/*.js',
                        '<%= bundle.direct %>'
                    ]
                }
            },
            // test with instrumented source
            coverage: {
                port: 9877, // different port to run on same process if need be
                preprocessors: {
                    '<%= dir.sourcepkg %>/**/*.js': ['commonjs', 'coverage'],
                    '<%= bundle.direct %>': ['commonjs'],
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
                        '<%= bundle.direct %>'
                    ]
                }
            },
            // test with debug bundle
            debug: {
                port: 9878, // different port to run on same process if need be
                reporters: ['progress'],
                prepend: {
                    files: ['<%= bundle.debug %>']
                }
            },
            // test with release bundle
            release: {
                port: 9879, // different port to run on same process if need be
                reporters: ['progress'],
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
    grunt.loadNpmTasks('grunt-coveralls');
    grunt.loadNpmTasks('grunt-git-revision');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-plato');
    grunt.loadTasks('tasks');

    // Generate coverage
    grunt.registerTask('coverage', ['clean:coverage', 'karma:coverage']);
    // Generate documenation
    grunt.registerTask('docs', ['clean:docs', 'yuidoc:docs']);
    // Copy files that make up the final npm module
    grunt.registerTask('distpkg', [
        'revision',
        'clean:distpkg',
        'copy:distpkg',
        'copy:distpkgjson'
    ]);
    // Copy package
    // Bundle for debug with sourceMapping
    grunt.registerTask('debug', [
        'distpkg',
        'browserify:debug'
    ]);
    // Copy and uglify package
    // Bundle and uglify for release
    grunt.registerTask('release', [
        'distpkg',
        'uglify:distpkg',
        'browserify:release',
        'uglify:release'
    ]);
    // Bundle for debug with sourceMapping, then test it
    // Bundle and uglify for release, then test it
    // After tests, copy bundles to dist
    grunt.registerTask('build', [
        // copy package
        'distpkg',
        // bundle debug
        'browserify:debug',
        'karma:debug',
        // uglify package
        'uglify:distpkg',
        // bundle release
        'browserify:release',
        'uglify:release',
        'karma:release',
        // Copy bundles to dist
        'clean:dist',
        'copy:dist'
    ]);
    // JSHint and test source in node and browser
    grunt.registerTask('test', [
        'jshint:source', // check source before anything
        'jshint:test', // then tests
        'coverage', // Use karma:source test without coverage
        'mochaTest:source'
    ]);
    // npm test (Travis CI task)
    // Test source, build debug and test, build release and test again
    grunt.registerTask('travis', [
        'test',
        'coveralls',
        'build'
    ]);
    // grunt
    grunt.registerTask('default', [
        'test',
        'plato:source',
        'build'
    ]);
};
