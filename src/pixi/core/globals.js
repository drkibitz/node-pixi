/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

module.exports = {
    // autoDetected: false,

    gl: null,
    shaderProgram: null,
    primitiveProgram: null,
    stripShaderProgram: null,

    texturesToUpdate: [],
    texturesToDestroy: [],
    visibleCount: 0
};
