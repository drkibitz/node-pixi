// --------------------------------------------
// THIS MODULE IS USED FOR TESTING AND COVERAGE
// --------------------------------------------
// karma-commonjs does not resolve node_modules
// so this file is used to explicity require paths.

// If karma-browserify is fixed to work with coverage,
// this file can be removed, and the coverage pass
// integrated with the browserify pass.

// These globals are shims to mimic the Pixi API.
// They are defined here so the same tests may
// be used in coverage as the other test passes.

global.PIXI = require('./pixi/index');
global.requestAnimFrame = require('./pixi/utils/raf');
