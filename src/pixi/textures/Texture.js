/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var BaseTexture = require('./BaseTexture');
var Point = require('../geom/Point');
var Rectangle = require('../geom/Rectangle');
var EventTarget = require('../events/EventTarget');

/**
 * A texture stores the information that represents an image or part of an image. It cannot be added
 * to the display list directly. To do this use Sprite. If no frame is provided then the whole image is used
 *
 * @class Texture
 * @uses EventTarget
 * @constructor
 * @param baseTexture {BaseTexture} The base texture source to create the texture from
 * @param frmae {Rectangle} The rectangle frame of the texture to show
 */
function Texture(baseTexture, frame)
{
    EventTarget.call( this );

    if(!frame)
    {
        this.noFrame = true;
        frame = new Rectangle(0,0,1,1);
    }

    if(baseTexture instanceof Texture)
        baseTexture = baseTexture.baseTexture;

    /**
     * The base texture of this texture
     *
     * @property baseTexture
     * @type BaseTexture
     */
    this.baseTexture = baseTexture;

    /**
     * The frame specifies the region of the base texture that this texture uses
     *
     * @property frame
     * @type Rectangle
     */
    this.frame = frame;

    /**
     * The trim point
     *
     * @property trim
     * @type Point
     */
    this.trim = new Point();

    this.scope = this;

    if(baseTexture.hasLoaded)
    {
        if(this.noFrame)frame = new Rectangle(0,0, baseTexture.width, baseTexture.height);
        //console.log(frame)

        this.setFrame(frame);
    }
    else
    {
        var scope = this;
        baseTexture.addEventListener( 'loaded', function(){ scope.onBaseTextureLoaded()} );
    }
}

var proto = Texture.prototype;

/**
 * Called when the base texture is loaded
 *
 * @method onBaseTextureLoaded
 * @param event
 * @private
 */
proto.onBaseTextureLoaded = function onBaseTextureLoaded(event)
{
    var baseTexture = this.baseTexture;
    baseTexture.removeEventListener( 'loaded', this.onLoaded );

    if(this.noFrame)this.frame = new Rectangle(0,0, baseTexture.width, baseTexture.height);
    this.noFrame = false;
    this.width = this.frame.width;
    this.height = this.frame.height;

    this.scope.dispatchEvent( { type: 'update', content: this } );
};

/**
 * Destroys this texture
 *
 * @method destroy
 * @param destroyBase {Boolean} Whether to destroy the base texture as well
 */
proto.destroy = function destroy(destroyBase)
{
    if(destroyBase)this.baseTexture.destroy();
};

/**
 * Specifies the rectangle region of the baseTexture
 *
 * @method setFrame
 * @param frame {Rectangle} The frame of the texture to set it to
 */
proto.setFrame = function setFrame(frame)
{
    this.frame = frame;
    this.width = frame.width;
    this.height = frame.height;

    if(frame.x + frame.width > this.baseTexture.width || frame.y + frame.height > this.baseTexture.height)
    {
        throw new Error("Texture Error: frame does not fit inside the base Texture dimensions " + this);
    }

    this.updateFrame = true;

    Texture.frameUpdates.push(this);
    //this.dispatchEvent( { type: 'update', content: this } );
};

/**
 * Helper function that returns a texture based on an image url
 * If the image is not in the texture cache it will be  created and loaded
 *
 * @static
 * @method fromImage
 * @param imageUrl {String} The image url of the texture
 * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
 * @return Texture
 */
Texture.fromImage = function fromImage(imageUrl, crossorigin)
{
    var texture = Texture.cache[imageUrl];

    if(!texture)
    {
        texture = new Texture(BaseTexture.fromImage(imageUrl, crossorigin));
        Texture.cache[imageUrl] = texture;
    }

    return texture;
};

/**
 * Helper function that returns a texture based on a frame id
 * If the frame id is not in the texture cache an error will be thrown
 *
 * @static
 * @method fromFrame
 * @param frameId {String} The frame id of the texture
 * @return Texture
 */
Texture.fromFrame = function fromFrame(frameId)
{
    var texture = Texture.cache[frameId];
    if(!texture)throw new Error("The frameId '"+ frameId +"' does not exist in the texture cache " + this);
    return texture;
};

/**
 * Helper function that returns a texture based on a canvas element
 * If the canvas is not in the texture cache it will be  created and loaded
 *
 * @static
 * @method fromCanvas
 * @param canvas {Canvas} The canvas element source of the texture
 * @return Texture
 */
Texture.fromCanvas = function fromCanvas(canvas)
{
    var baseTexture = new BaseTexture(canvas);
    return new Texture(baseTexture);
};


/**
 * Adds a texture to the textureCache.
 *
 * @static
 * @method addTextureToCache
 * @param texture {Texture}
 * @param id {String} the id that the texture will be stored against.
 */
Texture.addTextureToCache = function addTextureToCache(texture, id)
{
    Texture.cache[id] = texture;
};

/**
 * Remove a texture from the textureCache.
 *
 * @static
 * @method removeTextureFromCache
 * @param id {String} the id of the texture to be removed
 * @return {Texture} the texture that was removed
 */
Texture.removeTextureFromCache = function removeTextureFromCache(id)
{
    var texture = Texture.cache[id]
    Texture.cache[id] = null;
    return texture;
};

Texture.cache = {};
// this is more for webGL.. it contains updated frames..
Texture.frameUpdates = [];

module.exports = Texture;
