/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../../core/globals');

/*
 * the default suoer fast shader!
 */

var shaderFragmentSrc = [
    "precision mediump float;",
    "varying vec2 vTextureCoord;",
    "varying float vColor;",
    "uniform sampler2D uSampler;",
    "void main(void) {",
        "gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y));",
        "gl_FragColor = gl_FragColor * vColor;",
    "}"
].join("\n");

var shaderVertexSrc = [
    "attribute vec2 aVertexPosition;",
    "attribute vec2 aTextureCoord;",
    "attribute float aColor;",
    //"uniform mat4 uMVMatrix;",

    "uniform vec2 projectionVector;",
    "varying vec2 vTextureCoord;",
    "varying float vColor;",
    "void main(void) {",
        // "gl_Position = uMVMatrix * vec4(aVertexPosition, 1.0, 1.0);",
        "gl_Position = vec4( aVertexPosition.x / projectionVector.x -1.0, aVertexPosition.y / -projectionVector.y + 1.0 , 0.0, 1.0);",
        "vTextureCoord = aTextureCoord;",
        "vColor = aColor;",
    "}"
].join("\n");

/*
 * the triangle strip shader..
 */

var stripShaderFragmentSrc = [
    "precision mediump float;",
    "varying vec2 vTextureCoord;",
    "varying float vColor;",
    "uniform float alpha;",
    "uniform sampler2D uSampler;",
    "void main(void) {",
        "gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y));",
        "gl_FragColor = gl_FragColor * alpha;",
    "}"
].join("\n");


var stripShaderVertexSrc = [
    "attribute vec2 aVertexPosition;",
    "attribute vec2 aTextureCoord;",
    "attribute float aColor;",
    "uniform mat3 translationMatrix;",
    "uniform vec2 projectionVector;",
    "varying vec2 vTextureCoord;",
    "varying float vColor;",
    "void main(void) {",
    "vec3 v = translationMatrix * vec3(aVertexPosition, 1.0);",
        "gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);",
        "vTextureCoord = aTextureCoord;",
        "vColor = aColor;",
    "}"
].join("\n");


/*
 * primitive shader..
 */

var primitiveShaderFragmentSrc = [
    "precision mediump float;",
    "varying vec4 vColor;",
    "void main(void) {",
        "gl_FragColor = vColor;",
    "}"
].join("\n");

var primitiveShaderVertexSrc = [
    "attribute vec2 aVertexPosition;",
    "attribute vec4 aColor;",
    "uniform mat3 translationMatrix;",
    "uniform vec2 projectionVector;",
    "uniform float alpha;",
    "varying vec4 vColor;",
    "void main(void) {",
        "vec3 v = translationMatrix * vec3(aVertexPosition, 1.0);",
        "gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);",
        "vColor = aColor  * alpha;",
    "}"
].join("\n");

function compileShader(gl, shaderSrc, shaderType)
{
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSrc);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function compileProgram(vertexSrc, fragmentSrc)
{
    var gl = globals.gl;
    var fragmentShader = compileShader(gl, fragmentSrc, gl.FRAGMENT_SHADER);
    var vertexShader = compileShader(gl, vertexSrc, gl.VERTEX_SHADER);

    var shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Could not initialise shaders");
    }

    return shaderProgram;
}

exports.initDefaultShader = function initDefaultShader()
{
    var gl = globals.gl;
    var shaderProgram = compileProgram(shaderVertexSrc, shaderFragmentSrc)

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    shaderProgram.projectionVector = gl.getUniformLocation(shaderProgram, "projectionVector");
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    shaderProgram.colorAttribute = gl.getAttribLocation(shaderProgram, "aColor");

    // shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");

    globals.shaderProgram = shaderProgram;
};

exports.initPrimitiveShader = function initPrimitiveShader()
{
    var gl = globals.gl;

    var shaderProgram = compileProgram(primitiveShaderVertexSrc, primitiveShaderFragmentSrc)

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    shaderProgram.colorAttribute = gl.getAttribLocation(shaderProgram, "aColor");

    shaderProgram.projectionVector = gl.getUniformLocation(shaderProgram, "projectionVector");
    shaderProgram.translationMatrix = gl.getUniformLocation(shaderProgram, "translationMatrix");

    shaderProgram.alpha = gl.getUniformLocation(shaderProgram, "alpha");

    globals.primitiveProgram = shaderProgram;
};

exports.initDefaultStripShader = function initDefaultStripShader()
{
    var gl = globals.gl;
    var shaderProgram = compileProgram(stripShaderVertexSrc, stripShaderFragmentSrc)

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    shaderProgram.projectionVector = gl.getUniformLocation(shaderProgram, "projectionVector");
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    shaderProgram.translationMatrix = gl.getUniformLocation(shaderProgram, "translationMatrix");
    shaderProgram.alpha = gl.getUniformLocation(shaderProgram, "alpha");

    shaderProgram.colorAttribute = gl.getAttribLocation(shaderProgram, "aColor");

    shaderProgram.projectionVector = gl.getUniformLocation(shaderProgram, "projectionVector");

    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");

    globals.stripShaderProgram = shaderProgram;
};

exports.activateDefaultShader = function activateDefaultShader()
{
    var gl = globals.gl;
    var shaderProgram = globals.shaderProgram;

    gl.useProgram(shaderProgram);

    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
    gl.enableVertexAttribArray(shaderProgram.colorAttribute);
};

exports.activatePrimitiveShader = function activatePrimitiveShader()
{
    var gl = globals.gl;

    gl.disableVertexAttribArray(globals.shaderProgram.textureCoordAttribute);
    gl.disableVertexAttribArray(globals.shaderProgram.colorAttribute);

    gl.useProgram(globals.primitiveProgram);

    gl.enableVertexAttribArray(globals.primitiveProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(globals.primitiveProgram.colorAttribute);
};
