// --------------------------------------------
// THIS MODULE IS USED FOR NON-BROWSER TESTING
// --------------------------------------------
// The following are platform mocks which
// should remain pixi specific and only be
// enough to allow the tests to pass.

var platform = require('./pixi/platform');

/**
 * Minimal Image Element mock
 *
 * This does not implement anything
 * further than what pixi uses.
 */
function ImageMock() {

	var _complete = true;
	var _width = 0;
	var _height = 0;
	var _src = '';
	var _onLoad = null;
	var _loadTimeoutId;

	Object.defineProperties(this, {
		complete: {
			get: function getComplete() {
				return _complete;
			},
			enumerable: true
		},
		onload: {
			get: function getOnload() {
				return _onLoad;
			},
			set: function setOnload(callback) {
				_onLoad = callback;
			},
			enumerable: true
		},
		width: {
			get: function getWidth() {
				return _width;
			},
			enumerable: true
		},
		height: {
			get: function getHeight() {
				return _height;
			},
			enumerable: true
		},
		src: {
			get: function getSrc() {
				return _src;
			},
			set: function setSrc(src) {
				_complete = false;
				global.clearTimeout(_loadTimeoutId);
				if (src) {
					_loadTimeoutId = global.setTimeout(function () {
						_width = 10;
						_height = 10;
						_complete = true;
						if (this.onload) this.onload(/*no event used*/);
					}.bind(this), 200);
					_src = src;
				} else {
					_width = 0;
					_height = 0;
					_src = '';
				}
			},
			enumerable: true
		}
	});
}

/**
 * FIXME: So far don't have any tests for this
 */
platform.createCanvas = function createCanvasMock() {
	return {};
};

platform.createImage = function createImageMock() {
	return new ImageMock();
};

/**
 * FIXME: So far don't have any tests for this
 */
platform.createRequest = function createRequestMock() {
	return {};
};

// These globals are shims to mimic the Pixi API.
// They are only available when using the bundles
// made with this module.

global.PIXI = require('./pixi/index');
global.requestAnimFrame = require('./pixi/utils/raf');
