/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AssetLoader = require('./AssetLoader');
var EventTarget = require('../events/EventTarget');
var Texture = require('../textures/Texture');

/**
 * The image loader class is responsible for loading images file formats ("jpeg", "jpg", "png" and "gif")
 * Once the image has been loaded it is stored in the texture cache and can be accessed though Texture.fromFrameId() and Sprite.fromFromeId()
 * When loaded this class will dispatch a 'loaded' event
 *
 * @class ImageLoader
 * @uses EventTarget
 * @constructor
 * @param url {String} The url of the image
 * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
 */
function ImageLoader(url, crossorigin)
{
    EventTarget.call(this);

    /**
     * The texture being loaded
     *
     * @property texture
     * @type Texture
     */
    this.texture = Texture.fromImage(url, crossorigin);

    /**
     * if the image is loaded with loadFramedSpriteSheet
     * frames will contain the sprite sheet frames
     *
     */
    this.frames = [];
}

var proto = ImageLoader.prototype;

/**
 * Loads image or takes it from cache
 *
 * @method load
 */
proto.load = function load()
{
    if(!this.texture.baseTexture.hasLoaded)
    {
        var scope = this;
        this.texture.baseTexture.addEventListener("loaded", function()
        {
            scope.onLoaded();
        });
    }
    else
    {
        this.onLoaded();
    }
};

/**
 * Invoked when image file is loaded or it is already cached and ready to use
 *
 * @method onLoaded
 * @private
 */
proto.onLoaded = function onLoaded()
{
    this.dispatchEvent({type: "loaded", content: this});
};

/**
 * Loads image and split it to uniform sized frames
 *
 *
 * @method loadFramedSpriteSheet
 * @param frameWidth {Number} with of each frame
 * @param frameHeight {Number} height of each frame
 * @param textureName {String} if given, the frames will be cached in <textureName>-<ord> format
 */
proto.loadFramedSpriteSheet = function(frameWidth, frameHeight, textureName)
{
    this.frames = [];
    var cols = Math.floor(this.texture.width / frameWidth);
    var rows = Math.floor(this.texture.height / frameHeight);

    var i=0;
    for (var y=0; y<rows; y++)
    {
        for (var x=0; x<cols; x++,i++)
        {
            var texture = new Texture(this.texture, {
                x: x*frameWidth,
                y: y*frameHeight,
                width: frameWidth,
                height: frameHeight
            });

            this.frames.push(texture);
            if (textureName) Texture.cache[textureName+'-'+i] = texture;
        }
    }

    if(!this.texture.baseTexture.hasLoaded)
    {
        var scope = this;
        this.texture.baseTexture.addEventListener("loaded", function() {
            scope.onLoaded();
        });
    }
    else
    {
        this.onLoaded();
    }
};

AssetLoader.registerLoaderType('jpg', ImageLoader);
AssetLoader.registerLoaderType('jpeg', ImageLoader);
AssetLoader.registerLoaderType('png', ImageLoader);
AssetLoader.registerLoaderType('gif', ImageLoader);

module.exports = ImageLoader;
