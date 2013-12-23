/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../core/globals');
var mat3 = require('../geom/matrix').mat3;
var hex2rgb = require('../utils/color').hex2rgb;

var DisplayObjectContainer = require('./DisplayObjectContainer');
var InteractionManager = require('../InteractionManager');
var Rectangle = require('../geom/Rectangle');

/**
 * A Stage represents the root of the display tree. Everything connected to the stage is rendered
 *
 * @class Stage
 * @extends DisplayObjectContainer
 * @constructor
 * @param backgroundColor {Number} the background color of the stage, easiest way to pass this in is in hex format
 *      like: 0xFFFFFF for white
 */
function Stage(backgroundColor)
{
    DisplayObjectContainer.call(this);

    /**
     * [read-only] Current transform of the object based on world (parent) factors
     *
     * @property worldTransform
     * @type Mat3
     * @readOnly
     * @private
     */
    this.worldTransform = mat3.create();

    /**
     * Whether or not the stage is interactive
     *
     * @property interactive
     * @type Boolean
     */
    this.interactive = true;

    /**
     * The interaction manage for this stage, manages all interactive activity on the stage
     *
     * @property interactive
     * @type InteractionManager
     */
    this.interactionManager = new InteractionManager(this);

    /**
     * Whether the stage is dirty and needs to have interactions updated
     *
     * @property dirty
     * @type Boolean
     * @private
     */
    this.dirty = true;

    this.__childrenAdded = [];
    this.__childrenRemoved = [];

    //the stage is it's own stage
    this.stage = this;

    //optimize hit detection a bit
    this.stage.hitArea = new Rectangle(0,0,100000, 100000);

    this.setBackgroundColor(backgroundColor);
    this.worldVisible = true;
}

var proto = Stage.prototype = Object.create(DisplayObjectContainer.prototype, {
    constructor: {value: Stage}
});

/**
 * Sets another DOM element which can receive mouse/touch interactions instead of the default Canvas element.
 * This is useful for when you have other DOM elements ontop of the Canvas element.
 *
 * @method setInteractionDelegate
 * @param domElement {DOMElement} This new domElement which will receive mouse/touch events
 */
proto.setInteractionDelegate = function setInteractionDelegate(domElement)
{
    this.interactionManager.setTargetDomElement( domElement );
};

/*
 * Updates the object transform for rendering
 *
 * @method updateTransform
 * @private
 */
proto.updateTransform = function updateTransform()
{
    this.worldAlpha = 1;
    this.vcount = globals.visibleCount;

    for(var i=0,j=this.children.length; i<j; i++)
    {
        this.children[i].updateTransform();
    }

    if(this.dirty)
    {
        this.dirty = false;
        // update interactive!
        this.interactionManager.dirty = true;
    }


    if(this.interactive)this.interactionManager.update();
};

/**
 * Sets the background color for the stage
 *
 * @method setBackgroundColor
 * @param backgroundColor {Number} the color of the background, easiest way to pass this in is in hex format
 *      like: 0xFFFFFF for white
 */
proto.setBackgroundColor = function setBackgroundColor(backgroundColor)
{
    this.backgroundColor = backgroundColor || 0x000000;
    this.backgroundColorSplit = hex2rgb(this.backgroundColor);
    var hex = this.backgroundColor.toString(16);
    hex = '000000'.substr(0, 6 - hex.length) + hex;
    this.backgroundColorString = '#' + hex;
};

/**
 * This will return the point containing global coords of the mouse.
 *
 * @method getMousePosition
 * @return {Point} The point containing the coords of the global InteractionData position.
 */
proto.getMousePosition = function getMousePosition()
{
    return this.interactionManager.mouse.global;
};

module.exports = Stage;
