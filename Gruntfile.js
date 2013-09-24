'use strict';

module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.loadTasks('tasks');

    var root = 'src/pixi/',
        debug = 'bin/pixi.dev.js',
        srcFiles = [
            '<%= dirs.src %>/Intro.js',
            '<%= dirs.src %>/Pixi.js',
            '<%= dirs.src %>/core/Point.js',
            '<%= dirs.src %>/core/Rectangle.js',
            '<%= dirs.src %>/core/Polygon.js',
            '<%= dirs.src %>/core/Circle.js',
            '<%= dirs.src %>/core/Ellipse.js',
            '<%= dirs.src %>/core/Matrix.js',
            '<%= dirs.src %>/display/DisplayObject.js',
            '<%= dirs.src %>/display/DisplayObjectContainer.js',
            '<%= dirs.src %>/display/Sprite.js',
            '<%= dirs.src %>/display/MovieClip.js',
            '<%= dirs.src %>/filters/FilterBlock.js',
            '<%= dirs.src %>/text/Text.js',
            '<%= dirs.src %>/text/BitmapText.js',
            '<%= dirs.src %>/InteractionManager.js',
            '<%= dirs.src %>/display/Stage.js',
            '<%= dirs.src %>/utils/Utils.js',
            '<%= dirs.src %>/utils/EventTarget.js',
            '<%= dirs.src %>/utils/Detector.js',
            '<%= dirs.src %>/utils/Polyk.js',
            '<%= dirs.src %>/renderers/webgl/WebGLShaders.js',
            '<%= dirs.src %>/renderers/webgl/WebGLGraphics.js',
            '<%= dirs.src %>/renderers/webgl/WebGLRenderer.js',
            '<%= dirs.src %>/renderers/webgl/WebGLBatch.js',
            '<%= dirs.src %>/renderers/webgl/WebGLRenderGroup.js',
            '<%= dirs.src %>/renderers/canvas/CanvasRenderer.js',
            '<%= dirs.src %>/renderers/canvas/CanvasGraphics.js',
            '<%= dirs.src %>/primitives/Graphics.js',
            '<%= dirs.src %>/extras/Strip.js',
            '<%= dirs.src %>/extras/Rope.js',
            '<%= dirs.src %>/extras/TilingSprite.js',
            '<%= dirs.src %>/extras/Spine.js',
            '<%= dirs.src %>/extras/CustomRenderable.js',
            '<%= dirs.src %>/textures/BaseTexture.js',
            '<%= dirs.src %>/textures/Texture.js',
            '<%= dirs.src %>/textures/RenderTexture.js',
            '<%= dirs.src %>/loaders/AssetLoader.js',
            '<%= dirs.src %>/loaders/JsonLoader.js',
            '<%= dirs.src %>/loaders/SpriteSheetLoader.js',
            '<%= dirs.src %>/loaders/ImageLoader.js',
            '<%= dirs.src %>/loaders/BitmapFontLoader.js',
            '<%= dirs.src %>/loaders/SpineLoader.js',
            '<%= dirs.src %>/Outro.js'
        ], banner = [
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
        ].join('\n');

    grunt.initConfig({
        pkg : grunt.file.readJSON('package.json'),
        dirs: {
            build: 'bin',
            docs: 'docs',
            examples: 'examples',
            src: 'src/pixi',
            test: 'test'
        },
        files: {
            srcBlob: '<%= dirs.src %>/**/*.js',
            testBlob: '<%= dirs.test %>/{functional,lib/pixi,unit}/**/*.js',
            build: '<%= dirs.build %>/pixi.dev.js',
            buildMin: '<%= dirs.build %>/pixi.js'
        },
        concat: {
            options: {
                banner: banner
            },
            dist: {
                src: srcFiles,
                dest: '<%= files.build %>'
            }
        },
        jshint: {
            beforeconcat: {
                src: srcFiles,
                options: {
                    jshintrc: '.jshintrc',
                    ignores: ['<%= dirs.src %>/{Intro,Outro}.js']
                }
            },
            afterconcat: {
                src: '<%= files.build %>',
                options: {
                    jshintrc: '.jshintrc',
                }
            },
            test: {
                src: ['<%= files.testBlob %>'],
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
            var pixi = grunt.file.read( debug );

            var dests = this.data;

            dests.forEach(function(filepath){

                grunt.file.write(filepath + '/pixi.js', pixi);

            });

            grunt.log.writeln('Pixi copied to examples.');
        }
    )

    grunt.registerTask('lintconcat', ['jshint:beforeconcat', 'concat', 'jshint:afterconcat']);
    grunt.registerTask('build', ['lintconcat', 'uglify', 'distribute']);
    grunt.registerTask('test', ['lintconcat', 'jshint:test', 'karma']);
    grunt.registerTask('docs', ['yuidoc']);
    grunt.registerTask('default', ['test', 'uglify', 'distribute']);
    // Travis CI task.
    grunt.registerTask('travis', ['test']);
};
