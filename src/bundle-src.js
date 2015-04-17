// --------------------------------------------
// THIS MODULE IS USED FOR TESTING AND COVERAGE
// --------------------------------------------
// These globals are shims to mimic the Pixi API.
// They are defined here so the same tests may
// be used in coverage as the other test passes.

var platform = require('./pixi/platform');
platform.global.PIXI = require('./pixi/index');
platform.global.requestAnimFrame = require('./pixi/utils/raf');
