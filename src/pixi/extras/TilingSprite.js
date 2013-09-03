/**
 * @author Mat Groves http://matgroves.com/
 */
'use strict';

var blendModes = require('../display/blendModes');
var DisplayObjectContainer = require('../display/DisplayObjectContainer');
var Point = require('../geom/Point');

/**
 * A tiling sprite is a fast way of rendering a tiling image
 *
 * @class TilingSprite
 * @extends DisplayObjectContainer
 * @constructor
 * @param texture {Texture} the texture of the tiling sprite
 * @param width {Number}  the width of the tiling sprite
 * @param height {Number} the height of the tiling sprite
 */
function TilingSprite(texture, width, height)
{
    DisplayObjectContainer.call( this );

    /**
     * The texture that the sprite is using
     *
     * @property texture
     * @type Texture
     */
    this.texture = texture;

    /**
     * The width of the tiling sprite
     *
     * @property width
     * @type Number
     */
    this.width = width;

    /**
     * The height of the tiling sprite
     *
     * @property height
     * @type Number
     */
    this.height = height;

    /**
     * The scaling of the image that is being tiled
     *
     * @property tileScale
     * @type Point
     */
    this.tileScale = new Point(1,1);

    /**
     * The offset position of the image that is being tiled
     *
     * @property tilePosition
     * @type Point
     */
    this.tilePosition = new Point(0,0);

    this.renderable = true;

    this.blendMode = blendModes.NORMAL;
}

var proto = TilingSprite.prototype = Object.create(DisplayObjectContainer.prototype, {
    constructor: {value: TilingSprite}
});

/**
 * Sets the texture of the tiling sprite
 *
 * @method setTexture
 * @param texture {Texture} The texture that is displayed by the sprite
 */
proto.setTexture = function setTexture(texture)
{
    //TODO SET THE TEXTURES
    //TODO VISIBILITY

    // stop current texture
    this.texture = texture;
    this.updateFrame = true;
};

/**
 * When the texture is updated, this event will fire to update the frame
 *
 * @method onTextureUpdate
 * @param event
 * @private
 */
proto.onTextureUpdate = function onTextureUpdate(event)
{
    this.updateFrame = true;
};

module.exports = TilingSprite;
