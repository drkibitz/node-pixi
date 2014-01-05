/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var DisplayObject = require('../display/DisplayObject');

/**
 * This object is one that will allow you to specify custom rendering functions based on render type
 *
 * @class CustomRenderable
 * @extends DisplayObject
 * @constructor
 */
function CustomRenderable()
{
    DisplayObject.call(this);

    this.renderable = true;
}

var proto = CustomRenderable.prototype = Object.create(DisplayObject.prototype, {
    constructor: {value: CustomRenderable}
});

/**
 * If this object is being rendered by a CanvasRenderer it will call this callback
 *
 * @method renderCanvas
 * @param renderer {CanvasRenderer} The renderer instance
 */
proto.renderCanvas = function renderCanvas()
{
    // override!
};

/**
 * If this object is being rendered by a WebGLRenderer it will call this callback to initialize
 *
 * @method initWebGL
 * @param renderer {WebGLRenderer} The renderer instance
 */
proto.initWebGL = function initWebGL()
{
    // override!
};

/**
 * If this object is being rendered by a WebGLRenderer it will call this callback
 *
 * @method renderWebGL
 * @param renderGroup {WebGLRenderGroup} The renderer group instance
 * @param projectionMatrix {Matrix} The object's projection matrix
 */
proto.renderWebGL = function renderWebGL()
{
    // not sure if both needed? but ya have for now!
    // override!
};

module.exports = CustomRenderable;
