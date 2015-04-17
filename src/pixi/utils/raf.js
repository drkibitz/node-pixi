// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
// MIT license
'use strict';

var platformGlobal = require('../platform').global;

/**
 * A polyfill for requestAnimationFrame
 *
 * @method requestAnimationFrame
 */
/**
 * A polyfill for cancelAnimationFrame
 *
 * @method cancelAnimationFrame
 */
var lastTime = 0;
var vendors = ['ms', 'moz', 'webkit', 'o'];
for(var i = 0; i < vendors.length && !platformGlobal.requestAnimationFrame; ++i) {
    platformGlobal.requestAnimationFrame = platformGlobal[vendors[i] + 'RequestAnimationFrame'];
    platformGlobal.cancelAnimationFrame = platformGlobal[vendors[i] + 'CancelAnimationFrame'] ||
        platformGlobal[vendors[i] + 'CancelRequestAnimationFrame'];
}

if (!platformGlobal.requestAnimationFrame) {
    platformGlobal.requestAnimationFrame = function(callback) {
        var currTime = new Date().getTime();
        var timeToCall = Math.max(0, 16 - (currTime - lastTime));
        var id = platformGlobal.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
        lastTime = currTime + timeToCall;
        return id;
    };
}

if (!platformGlobal.cancelAnimationFrame) {
    platformGlobal.cancelAnimationFrame = function(id) {
        platformGlobal.clearTimeout(id);
    };
}

module.exports = platformGlobal.requestAnimationFrame;
