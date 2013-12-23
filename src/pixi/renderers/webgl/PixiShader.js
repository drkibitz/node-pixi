/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 * @author Richard Davey http://www.photonstorm.com @photonstorm
 */
'use strict';

var compile = require('./compile');
var globals = require('../../core/globals');

/**
 * @constructor
 */
function PixiShader()
{
    /**
    * @property {any} program - The WebGL program.
    */
    this.program = null;

    /**
    * @property {array} fragmentSrc - The fragment shader.
    */
    this.fragmentSrc = [
        'precision lowp float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform sampler2D uSampler;',
        'void main(void) {',
        '   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor;',
        '}'
    ];

    /**
    * @property {number} textureCount - A local texture counter for multi-texture shaders.
    */
    this.textureCount = 0;
}

var proto = PixiShader.prototype;

proto.init = function init()
{
    var gl = globals.gl;
    var program = compile.program(gl, this.vertexSrc || PixiShader.defaultVertexSrc, this.fragmentSrc);

    gl.useProgram(program);

    // get and store the uniforms for the shader
    this.uSampler = gl.getUniformLocation(program, 'uSampler');
    this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
    this.offsetVector = gl.getUniformLocation(program, 'offsetVector');
    this.dimensions = gl.getUniformLocation(program, 'dimensions');

    // get and store the attributes
    this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    this.colorAttribute = gl.getAttribLocation(program, 'aColor');
    this.aTextureCoord = gl.getAttribLocation(program, 'aTextureCoord');

    // add those custom shaders!
    for (var key in this.uniforms)
    {
        // get the uniform locations..
        this.uniforms[key].uniformLocation = gl.getUniformLocation(program, key);
    }

    this.initUniforms();

    this.program = program;
};

/**
 * Initialises the shader uniform values.
 * Uniforms are specified in the GLSL_ES Specification: http://www.khronos.org/registry/webgl/specs/latest/1.0/
 * http://www.khronos.org/registry/gles/specs/2.0/GLSL_ES_Specification_1.0.17.pdf
 */
proto.initUniforms = function initUniforms()
{
    this.textureCount = 1;

    var uniform;

    for (var key in this.uniforms)
    {
        uniform = this.uniforms[key];

        var type = uniform.type;

        if (type === 'sampler2D')
        {
            uniform._init = false;

            if (uniform.value !== null)
            {
                this.initSampler2D(uniform);
            }
        }
        else if (type === 'mat2' || type === 'mat3' || type === 'mat4')
        {
            //  These require special handling
            uniform.glMatrix = true;
            uniform.glValueLength = 1;

            if (type === 'mat2')
            {
                uniform.glFunc = globals.gl.uniformMatrix2fv;
            }
            else if (type === 'mat3')
            {
                uniform.glFunc = globals.gl.uniformMatrix3fv;
            }
            else if (type === 'mat4')
            {
                uniform.glFunc = globals.gl.uniformMatrix4fv;
            }
        }
        else
        {
            //  GL function reference
            uniform.glFunc = globals.gl['uniform' + type];

            if (type === '2f' || type === '2i')
            {
                uniform.glValueLength = 2;
            }
            else if (type === '3f' || type === '3i')
            {
                uniform.glValueLength = 3;
            }
            else if (type === '4f' || type === '4i')
            {
                uniform.glValueLength = 4;
            }
            else
            {
                uniform.glValueLength = 1;
            }
        }
    }

};

/**
 * Initialises a Sampler2D uniform
 * (which may only be available later on after initUniforms once the texture is has loaded)
 */
proto.initSampler2D = function initSampler2D(uniform)
{
    if (!uniform.value || !uniform.value.baseTexture || !uniform.value.baseTexture.hasLoaded)
    {
        return;
    }

    globals.gl.activeTexture(globals.gl['TEXTURE' + this.textureCount]);
    globals.gl.bindTexture(globals.gl.TEXTURE_2D, uniform.value.baseTexture._glTexture);

    //  Extended texture data
    if (uniform.textureData)
    {
        var data = uniform.textureData;

        // GLTexture = mag linear, min linear_mipmap_linear, wrap repeat + gl.generateMipmap(gl.TEXTURE_2D);
        // GLTextureLinear = mag/min linear, wrap clamp
        // GLTextureNearestRepeat = mag/min NEAREST, wrap repeat
        // GLTextureNearest = mag/min nearest, wrap clamp
        // AudioTexture = whatever + luminance + width 512, height 2, border 0
        // KeyTexture = whatever + luminance + width 256, height 2, border 0

        //  magFilter can be: gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR or gl.NEAREST
        //  wrapS/T can be: gl.CLAMP_TO_EDGE or gl.REPEAT

        var magFilter = (data.magFilter) ? data.magFilter : globals.gl.LINEAR;
        var minFilter = (data.minFilter) ? data.minFilter : globals.gl.LINEAR;
        var wrapS = (data.wrapS) ? data.wrapS : globals.gl.CLAMP_TO_EDGE;
        var wrapT = (data.wrapT) ? data.wrapT : globals.gl.CLAMP_TO_EDGE;
        var format = (data.luminance) ? globals.gl.LUMINANCE : globals.gl.RGBA;

        if (data.repeat)
        {
            wrapS = globals.gl.REPEAT;
            wrapT = globals.gl.REPEAT;
        }

        globals.gl.pixelStorei(globals.gl.UNPACK_FLIP_Y_WEBGL, false);

        if (data.width)
        {
            var width = (data.width) ? data.width : 512;
            var height = (data.height) ? data.height : 2;
            var border = (data.border) ? data.border : 0;

            // void texImage2D(GLenum target, GLint level, GLenum internalformat, GLsizei width, GLsizei height, GLint border, GLenum format, GLenum type, ArrayBufferView? pixels);
            globals.gl.texImage2D(globals.gl.TEXTURE_2D, 0, format, width, height, border, format, globals.gl.UNSIGNED_BYTE, null);
        }
        else
        {
            //  void texImage2D(GLenum target, GLint level, GLenum internalformat, GLenum format, GLenum type, ImageData? pixels);
            globals.gl.texImage2D(globals.gl.TEXTURE_2D, 0, format, globals.gl.RGBA, globals.gl.UNSIGNED_BYTE, uniform.value.baseTexture.source);
        }

        globals.gl.texParameteri(globals.gl.TEXTURE_2D, globals.gl.TEXTURE_MAG_FILTER, magFilter);
        globals.gl.texParameteri(globals.gl.TEXTURE_2D, globals.gl.TEXTURE_MIN_FILTER, minFilter);
        globals.gl.texParameteri(globals.gl.TEXTURE_2D, globals.gl.TEXTURE_WRAP_S, wrapS);
        globals.gl.texParameteri(globals.gl.TEXTURE_2D, globals.gl.TEXTURE_WRAP_T, wrapT);
    }

    globals.gl.uniform1i(uniform.uniformLocation, this.textureCount);

    uniform._init = true;

    this.textureCount++;

};

/**
 * Updates the shader uniform values.
 */
proto.syncUniforms = function syncUniforms()
{
    this.textureCount = 1;
    var uniform;

    //  This would probably be faster in an array and it would guarantee key order
    for (var key in this.uniforms)
    {

        uniform = this.uniforms[key];

        if (uniform.glValueLength === 1)
        {
            if (uniform.glMatrix === true)
            {
                uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.transpose, uniform.value);
            }
            else
            {
                uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.value);
            }
        }
        else if (uniform.glValueLength === 2)
        {
            uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.value.x, uniform.value.y);
        }
        else if (uniform.glValueLength === 3)
        {
            uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.value.x, uniform.value.y, uniform.value.z);
        }
        else if (uniform.glValueLength === 4)
        {
            uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.value.x, uniform.value.y, uniform.value.z, uniform.value.w);
        }
        else if (uniform.type === 'sampler2D')
        {
            if (uniform._init)
            {
                globals.gl.activeTexture(globals.gl['TEXTURE' + this.textureCount]);
                globals.gl.bindTexture(globals.gl.TEXTURE_2D, uniform.value.baseTexture._glTexture);
                globals.gl.uniform1i(uniform.uniformLocation, this.textureCount);
                this.textureCount++;
            }
            else
            {
                this.initSampler2D(uniform);
            }
        }
    }

};

PixiShader.defaultVertexSrc = [
    'attribute vec2 aVertexPosition;',
    'attribute vec2 aTextureCoord;',
    'attribute float aColor;',

    'uniform vec2 projectionVector;',
    'uniform vec2 offsetVector;',
    'varying vec2 vTextureCoord;',

    'varying float vColor;',

    'const vec2 center = vec2(-1.0, 1.0);',

    'void main(void) {',
    '   gl_Position = vec4( ((aVertexPosition + offsetVector) / projectionVector) + center , 0.0, 1.0);',
    '   vTextureCoord = aTextureCoord;',
    '   vColor = aColor;',
    '}'
];

module.exports = PixiShader;
