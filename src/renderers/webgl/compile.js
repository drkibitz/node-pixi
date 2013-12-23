/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

var platform = require('../../platform');

exports.shader = function compileShader(gl, shaderSrc, shaderType)
{
    var src = shaderSrc.join('\n');
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        if (platform.console) platform.console.error(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
};

exports.program = function compileProgram(gl, vertexSrc, fragmentSrc)
{
    var fragmentShader = exports.shader(gl, fragmentSrc, gl.FRAGMENT_SHADER);
    var vertexShader = exports.shader(gl, vertexSrc, gl.VERTEX_SHADER);

    var shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        if (platform.console) platform.console.error('Could not initialise shaders');
        return null;
    }

    return shaderProgram;
};
