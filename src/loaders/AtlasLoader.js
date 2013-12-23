/**
 * @author Martin Kelm http://mkelm.github.com
 */
'use strict';

var EventTarget = require('../events/EventTarget');
var ImageLoader = require('./ImageLoader');
var platform = require('../platform');
var Texture = require('../textures/Texture');

/**
 * The atlas file loader is used to load in Atlas data and parsing it
 * When loaded this class will dispatch a 'loaded' event
 * If load failed this class will dispatch a 'error' event
 * @class AtlasLoader
 * @extends EventTarget
 * @constructor
 * @param {String} url the url of the JSON file
 * @param {Boolean} crossorigin
 */
function AtlasLoader(url, crossorigin) {
    EventTarget.call(this);
    this.url = url;
    this.baseUrl = url.replace(/[^\/]*$/, '');
    this.crossorigin = crossorigin;
    this.loaded = false;
}

var proto = AtlasLoader.prototype;

proto.handleEvent = function handleEvent(event)
{
    switch (event.type) {
    case 'load':
        this.onAtlasLoaded();
        break;
    default:
        this.onError();
        break;
    }
};

/**
 * This will begin loading the JSON file
 */
proto.load = function () {
    this.request = platform.createRequest();
    this.request.addEventListener('load', this);
    this.request.addEventListener('error', this);

    this.request.open('GET', this.url, true);
    if (this.request.overrideMimeType) this.request.overrideMimeType('application/json');
    this.request.send(null);
};

/**
 * Invoke when JSON file is loaded
 * @private
 */
proto.onAtlasLoaded = function () {
    this.atlas = {
        meta : {
            image : []
        },
        frames : []
    };
    var result = this.ajaxRequest.responseText.split(/\r?\n/);
    var lineCount = -3;

    var currentImageId = 0;
    var currentFrame = null;
    var nameInNextLine = false;

    var i = 0,
        j = 0,
        selfOnLoaded = this.onLoaded.bind(this);

    // parser without rotation support yet!
    for (i = 0; i < result.length; i++) {
        result[i] = result[i].replace(/^\s+|\s+$/g, '');
        if (result[i] === '') {
            nameInNextLine = i+1;
        }
        if (result[i].length > 0) {
            if (nameInNextLine === i) {
                this.atlas.meta.image.push(result[i]);
                currentImageId = this.atlas.meta.image.length - 1;
                this.atlas.frames.push({});
                lineCount = -3;
            } else if (lineCount > 0) {
                if (lineCount % 7 === 1) { // frame name
                    if (currentFrame != null) { //jshint ignore:line
                        this.atlas.frames[currentImageId][currentFrame.name] = currentFrame;
                    }
                    currentFrame = { name: result[i], frame : {} };
                } else {
                    var text = result[i].split(' ');
                    if (lineCount % 7 === 3) { // position
                        currentFrame.frame.x = Number(text[1].replace(',', ''));
                        currentFrame.frame.y = Number(text[2]);
                    } else if (lineCount % 7 === 4) { // size
                        currentFrame.frame.w = Number(text[1].replace(',', ''));
                        currentFrame.frame.h = Number(text[2]);
                    } else if (lineCount % 7 === 5) { // real size
                        var realSize = {
                            x : 0,
                            y : 0,
                            w : Number(text[1].replace(',', '')),
                            h : Number(text[2])
                        };

                        if (realSize.w > currentFrame.frame.w || realSize.h > currentFrame.frame.h) {
                            currentFrame.trimmed = true;
                            currentFrame.realSize = realSize;
                        } else {
                            currentFrame.trimmed = false;
                        }
                    }
                }
            }
            lineCount++;
        }
    }

    if (currentFrame != null) { //jshint ignore:line
        this.atlas.frames[currentImageId][currentFrame.name] = currentFrame;
    }

    if (this.atlas.meta.image.length > 0) {
        this.images = [];
        for (j = 0; j < this.atlas.meta.image.length; j++) {
            // sprite sheet
            var textureUrl = this.baseUrl + this.atlas.meta.image[j];
            var frameData = this.atlas.frames[j];
            this.images.push(new ImageLoader(textureUrl, this.crossorigin));

            for (i in frameData) {
                var rect = frameData[i].frame;
                if (rect) {
                    Texture.cache[i] = new Texture(this.images[j].texture.baseTexture, {
                        x: rect.x,
                        y: rect.y,
                        width: rect.w,
                        height: rect.h
                    });
                    if (frameData[i].trimmed) {
                        Texture.cache[i].realSize = frameData[i].realSize;
                        // trim in pixi not supported yet, todo update trim properties if it is done ...
                        Texture.cache[i].trim.x = 0;
                        Texture.cache[i].trim.y = 0;
                    }
                }
            }
        }

        this.currentImageId = 0;
        for (j = 0; j < this.images.length; j++) {
            this.images[j].addEventListener('loaded', selfOnLoaded);
        }
        this.images[this.currentImageId].load();

    } else {
        this.onLoaded();
    }
};

/**
 * Invoke when json file loaded
 * @private
 */
proto.onLoaded = function () {
    if (this.images.length - 1 > this.currentImageId) {
        this.currentImageId++;
        this.images[this.currentImageId].load();
    } else {
        this.loaded = true;
        this.dispatchEvent({
            type: 'loaded',
            content: this
        });
    }
};

/**
 * Invoke when error occured
 * @private
 */
proto.onError = function () {
    this.dispatchEvent({
        type: 'error',
        content: this
    });
};

module.exports = AtlasLoader;
