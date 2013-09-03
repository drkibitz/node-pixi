'use strict';

/**
 * Converts a hex color number to an [R, G, B] array
 *
 * @param hex {Number}
 */
exports.hex2rgb = function hex2rgb(hex)
{
    return [(hex >> 16 & 0xFF) / 255, ( hex >> 8 & 0xFF) / 255, (hex & 0xFF)/ 255];
};
