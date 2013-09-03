// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel

// MIT license
module.exports = (function () {
    'use strict';

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

    for(var i = 0; i < vendors.length && !global.requestAnimationFrame; i++) {
        global.requestAnimationFrame = global[vendors[i]+'RequestAnimationFrame'];
        global.cancelAnimationFrame = global[vendors[i]+'CancelAnimationFrame'] ||
            global[vendors[i]+'CancelRequestAnimationFrame'];
    }

    if (!global.requestAnimationFrame)
        global.requestAnimationFrame = function(callback, element) {
            var currTime = Date.now();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!global.cancelAnimationFrame)
        global.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };

    return global.requestAnimationFrame;

}());
