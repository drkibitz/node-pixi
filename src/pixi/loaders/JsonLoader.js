/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AssetLoader = require('./AssetLoader');
var ImageLoader = require('./ImageLoader');
var EventTarget = require('../events/EventTarget');
var Texture = require('../textures/Texture');
var Spine = require('../extras/Spine');
var SkeletonJson = require('../utils/spine').SkeletonJson;

/**
 * A wrapper for ajax requests to be handled cross browser
 *
 * @private
 */
function createRequest()
{
    /*global ActiveXObject*/
    var activexmodes = ["Msxml2.XMLHTTP.6.0", "Msxml2.XMLHTTP.3.0", "Microsoft.XMLHTTP"] //activeX versions to check for in IE

    if (window.ActiveXObject)
    { //Test for support for ActiveXObject in IE first (as XMLHttpRequest in IE7 is broken)
        for (var i=0; i<activexmodes.length; i++)
        {
            try{
                return new ActiveXObject(activexmodes[i])
            }
            catch(e){
                //suppress error
            }
        }
    }
    else if (window.XMLHttpRequest) // if Mozilla, Safari etc
    {
        return new XMLHttpRequest()
    }
    else
    {
        return false;
    }
}

/**
 * The json file loader is used to load in JSON data and parsing it
 * When loaded this class will dispatch a "loaded" event
 * If load failed this class will dispatch a "error" event
 *
 * @class JsonLoader
 * @uses EventTarget
 * @constructor
 * @param url {String} The url of the JSON file
 * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
 */
function JsonLoader(url, crossorigin) {
    EventTarget.call(this);

    /**
     * The url of the bitmap font data
     *
     * @property url
     * @type String
     */
    this.url = url;

    /**
     * Whether the requests should be treated as cross origin
     *
     * @property crossorigin
     * @type Boolean
     */
    this.crossorigin = crossorigin;

    /**
     * [read-only] The base url of the bitmap font data
     *
     * @property baseUrl
     * @type String
     * @readOnly
     */
    this.baseUrl = url.replace(/[^\/]*$/, "");

    /**
     * [read-only] Whether the data has loaded yet
     *
     * @property loaded
     * @type Boolean
     * @readOnly
     */
    this.loaded = false;
}

var proto = JsonLoader.prototype;

/**
 * Loads the JSON data
 *
 * @method load
 */
proto.load = function load()
{
    this.request = createRequest();
    var scope = this;
    this.request.onreadystatechange = function () {
        scope.onJSONLoaded();
    };

    this.request.open("GET", this.url, true);
    if (this.request.overrideMimeType) this.request.overrideMimeType("application/json");
    this.request.send(null);
};

/**
 * Invoke when JSON file is loaded
 *
 * @method onJSONLoaded
 * @private
 */
proto.onJSONLoaded = function onJSONLoaded()
{
    if (this.request.readyState == 4) {
        if (this.request.status == 200 || window.location.href.indexOf("http") == -1) {
            this.json = JSON.parse(this.request.responseText);

            if(this.json.frames)
            {
                // sprite sheet
                var scope = this;
                var textureUrl = this.baseUrl + this.json.meta.image;
                var image = new ImageLoader(textureUrl, this.crossorigin);
                var frameData = this.json.frames;

                this.texture = image.texture.baseTexture;
                image.addEventListener("loaded", function (event) {
                    scope.onLoaded();
                });

                for (var i in frameData) {
                    var rect = frameData[i].frame;
                    if (rect) {
                        Texture.cache[i] = new Texture(this.texture, {
                            x: rect.x,
                            y: rect.y,
                            width: rect.w,
                            height: rect.h
                        });
                        if (frameData[i].trimmed) {
                            //var realSize = frameData[i].spriteSourceSize;
                            Texture.cache[i].realSize = frameData[i].spriteSourceSize;
                            Texture.cache[i].trim.x = 0; // (realSize.x / rect.w)
                            // calculate the offset!
                        }
                    }
                }

                image.load();

            }
            else if(this.json.bones)
            {
                // spine animation
                var spineJsonParser = new SkeletonJson();
                var skeletonData = spineJsonParser.readSkeletonData(this.json);
                Spine.animCache[this.url] = skeletonData;
                this.onLoaded();
            }
            else
            {
                this.onLoaded();
            }
        }
        else
        {
            this.onError();
        }
    }
};

/**
 * Invoke when json file loaded
 *
 * @method onLoaded
 * @private
 */
proto.onLoaded = function onLoaded()
{
    this.loaded = true;
    this.dispatchEvent({
        type: "loaded",
        content: this
    });
};

/**
 * Invoke when error occured
 *
 * @method onError
 * @private
 */
proto.onError = function onError()
{
    this.dispatchEvent({
        type: "error",
        content: this
    });
};

AssetLoader.registerLoaderType('json', JsonLoader);

module.exports = JsonLoader;
