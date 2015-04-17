/*global global,self,window*/
/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
(function(global) {
'use strict';

module.exports = {

    global:    global,

    console:   global.console,
    document:  global.document,
    location:  global.location,
    navigator: global.navigator,
    window:    global.window,

    createCanvas: function createCanvas() {
        return global.document.createElement('canvas');
    },

    createImage: function createImage() {
        return new global.Image();
    },

    createRequest: function createRequest() {
        return new global.XMLHttpRequest();
    }
};

}(typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : {}));
