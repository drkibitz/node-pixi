// --------------------------------------------
// THIS MODULE IS COPIED TO THE BUILD DIRECTORY
// --------------------------------------------
// Which is where the 'pixi' package should
// have also been installed.

// These globals are shims to mimic the Pixi API.
// They are only available when using the bundles
// made with this module.

var platform = require('pixi/platform');
platform.global.PIXI = require('pixi');
platform.global.requestAnimFrame = require('pixi/utils/raf');
