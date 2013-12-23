/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * The ColorMatrixFilter class lets you apply a 4x4 matrix transformation on the RGBA
 * color and alpha values of every pixel on your displayObject to produce a result
 * with a new set of RGBA color and alpha values. Its pretty powerful!
 * @class ColorMatrixFilter
 * @contructor
 */
function ColorMatrixFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        matrix: {type: 'mat4', value: [1,0,0,0,
                                       0,1,0,0,
                                       0,0,1,0,
                                       0,0,0,1]},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform float invert;',
        'uniform mat4 matrix;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '   gl_FragColor = texture2D(uSampler, vTextureCoord) * matrix;',
        '   gl_FragColor = gl_FragColor * vColor;',
        '}'
    ];
}

var proto = ColorMatrixFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: ColorMatrixFilter}
});

/**
 * Sets the matrix of the color matrix filter
 *
 * @property matrix
 * @type Array and array of 26 numbers
 * @default [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
 */
Object.defineProperty(proto, 'matrix', {
    get: function() {
        return this.uniforms.matrix.value;
    },
    set: function(value) {
        this.uniforms.matrix.value = value;
    }
});

module.exports = ColorMatrixFilter;
