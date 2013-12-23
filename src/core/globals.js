/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

module.exports = {
    // autoDetected: false,

    gl: null,
    primitiveShader: null,
    stripShader: null,
    defaultShader: null,

    offset: null,
    projection:null,

    texturesToUpdate: [],
    texturesToDestroy: [],
    visibleCount: 0
};
