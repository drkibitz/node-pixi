/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../../core/globals');
var PrimitiveShader = require('./PrimitiveShader');
var StripShader = require('./StripShader');
var PixiShader = require('./PixiShader');

exports.initDefaultShaders = function initDefaultShaders()
{
    globals.primitiveShader = new PrimitiveShader();
    globals.primitiveShader.init();

    globals.stripShader = new StripShader();
    globals.stripShader.init();

    globals.defaultShader = new PixiShader();
    globals.defaultShader.init();

    var gl = globals.gl;
    var shaderProgram = globals.defaultShader.program;

    gl.useProgram(shaderProgram);

    gl.enableVertexAttribArray(globals.defaultShader.aVertexPosition);
    gl.enableVertexAttribArray(globals.defaultShader.colorAttribute);
    gl.enableVertexAttribArray(globals.defaultShader.aTextureCoord);
};

exports.activatePrimitiveShader = function activatePrimitiveShader()
{
    var gl = globals.gl;

    gl.useProgram(globals.primitiveShader.program);

    gl.disableVertexAttribArray(globals.defaultShader.aVertexPosition);
    gl.disableVertexAttribArray(globals.defaultShader.colorAttribute);
    gl.disableVertexAttribArray(globals.defaultShader.aTextureCoord);

    gl.enableVertexAttribArray(globals.primitiveShader.aVertexPosition);
    gl.enableVertexAttribArray(globals.primitiveShader.colorAttribute);
};

exports.deactivatePrimitiveShader = function deactivatePrimitiveShader()
{
    var gl = globals.gl;

    gl.useProgram(globals.defaultShader.program);

    gl.disableVertexAttribArray(globals.primitiveShader.aVertexPosition);
    gl.disableVertexAttribArray(globals.primitiveShader.colorAttribute);

    gl.enableVertexAttribArray(globals.defaultShader.aVertexPosition);
    gl.enableVertexAttribArray(globals.defaultShader.colorAttribute);
    gl.enableVertexAttribArray(globals.defaultShader.aTextureCoord);
};

exports.activateStripShader = function activateStripShader()
{
    var gl = globals.gl;

    gl.useProgram(globals.stripShader.program);
 // gl.disableVertexAttribArray(globals.defaultShader.aTextureCoord);
};

exports.deactivateStripShader = function deactivateStripShader()
{
    var gl = globals.gl;

    gl.useProgram(globals.defaultShader.program);
    //gl.enableVertexAttribArray(globals.defaultShader.aTextureCoord);
};
