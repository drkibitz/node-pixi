(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('./core/globals');
var Point = require('./geom/Point');
var Sprite = require('./display/Sprite');
var platform = require('./platform');

/**
 * Holds all information related to an Interaction event
 *
 * @class InteractionData
 * @constructor
 */
function InteractionData()
{
    /**
     * This point stores the world coords of where the touch/mouse event happened
     *
     * @property global
     * @type Point
     */
    this.global = new Point();

    // this is here for legacy... but will remove
    this.local = new Point();

    /**
     * The target Sprite that was interacted with
     *
     * @property target
     * @type Sprite
     */
    this.target = null;

    /**
     * When passed to an event handler, this will be the original DOM Event that was captured
     *
     * @property originalEvent
     * @type Event
     */
    this.originalEvent = null;
}

/**
 * This will return the local coords of the specified displayObject for this InteractionData
 *
 * @method getLocalPosition
 * @param displayObject {DisplayObject} The DisplayObject that you would like the local coords off
 * @return {Point} A point containing the coords of the InteractionData position relative to the DisplayObject
 */
InteractionData.prototype.getLocalPosition = function getLocalPosition(displayObject)
{
    var worldTransform = displayObject.worldTransform;
    var world = this.global;

    // do a cheeky transform to get the mouse coords;
    var a00 = worldTransform[0], a01 = worldTransform[1], a02 = worldTransform[2],
        a10 = worldTransform[3], a11 = worldTransform[4], a12 = worldTransform[5],
        id = 1 / (a00 * a11 + a01 * -a10);
    // set the mouse coords...
    return new Point(a11 * id * world.x + -a01 * id * world.y + (a12 * a01 - a02 * a11) * id,
                               a00 * id * world.y + -a10 * id * world.x + (-a12 * a00 + a02 * a10) * id)
};

/**
 * The interaction manager deals with mouse and touch events. Any DisplayObject can be interactive
 * This manager also supports multitouch.
 *
 * @class InteractionManager
 * @constructor
 * @param stage {Stage} The stage to handle interactions
 */
function InteractionManager(stage)
{
    /**
     * a refference to the stage
     *
     * @property stage
     * @type Stage
     */
    this.stage = stage;

    /**
     * the mouse data
     *
     * @property mouse
     * @type InteractionData
     */
    this.mouse = new InteractionData();

    /**
     * an object that stores current touches (InteractionData) by id reference
     *
     * @property touchs
     * @type Object
     */
    this.touchs = {};

    // helpers
    this.tempPoint = new Point();
    //this.tempMatrix =  mat3.create();

    this.mouseoverEnabled = true;

    //tiny little interactiveData pool!
    this.pool = [];

    this.interactiveItems = [];
    this.interactionDOMElement = null;

    this.last = 0;
}

var proto = InteractionManager.prototype;

/**
 * EventListener interface
 */
proto.handleEvent = function handleEvent(event)
{
    switch (event.type) {
    case 'mousedown' : this.onMouseDown(event); break;
    case 'mousemove' : this.onMouseMove(event); break;
    case 'mouseup'   : this.onMouseUp(event);   break;
    case 'mouseout'  : this.onMouseOut(event);  break;

    case 'touchstart' : this.onTouchStart(event); break;
    case 'touchmove'  : this.onTouchMove(event);  break;
    case 'touchend'   : this.onTouchEnd(event);   break;
    }
};

/**
 * Collects an interactive sprite recursively to have their interactions managed
 *
 * @method collectInteractiveSprite
 * @param displayObject {DisplayObject} the displayObject to collect
 * @param iParent {DisplayObject}
 * @private
 */
proto.collectInteractiveSprite = function collectInteractiveSprite(displayObject, iParent)
{
    var children = displayObject.children;

    /// make an interaction tree... {item.__interactiveParent}
    for (var i = children.length - 1; i >= 0; i--)
    {
        var child = children[i];

//      if(child.visible) {
            // push all interactive bits
            if(child.interactive)
            {
                iParent.interactiveChildren = true;
                //child.__iParent = iParent;
                this.interactiveItems.push(child);

                if(child.children.length > 0)
                {
                    this.collectInteractiveSprite(child, child);
                }
            }
            else
            {
                child.__iParent = null;

                if(child.children.length > 0)
                {
                    this.collectInteractiveSprite(child, iParent);
                }
            }
//      }
    }
};

/**
 * Sets the target for event delegation
 *
 * @method setTarget
 * @param target {WebGLRenderer|CanvasRenderer} the renderer to bind events to
 * @private
 */
proto.setTarget = function setTarget(target)
{
    if (!target) {
        if (this.target !== null) platform.window.removeEventListener('mouseup', this, true);
    } else if (this.interactionDOMElement === null) {
        this.setTargetDomElement( target.view );
    }

    platform.window.addEventListener('mouseup', this, true);
    this.target = target;
};

/**
 * Sets the dom element which will receive mouse/touch events. This is useful for when you have other DOM
 * elements ontop of the renderers Canvas element. With this you'll be able to delegate another dom element
 * to receive those events
 *
 * @method setTargetDomElement
 * @param domElement {DOMElement} the dom element which will receive mouse and touch events
 * @private
 */
proto.setTargetDomElement = function setTargetDomElement(domElement)
{
    //remove previouse listeners
    if (this.interactionDOMElement !== null) {
        this.interactionDOMElement.style['-ms-content-zooming'] = '';
        this.interactionDOMElement.style['-ms-touch-action'] = '';

        this.interactionDOMElement.removeEventListener('mousemove', this, true);
        this.interactionDOMElement.removeEventListener('mousedown', this, true);
        this.interactionDOMElement.removeEventListener('mouseout', this, true);
        // aint no multi touch just yet!
        this.interactionDOMElement.removeEventListener('touchstart', this, true);
        this.interactionDOMElement.removeEventListener('touchend', this, true);
        this.interactionDOMElement.removeEventListener('touchmove', this, true);
    }

    var navigator = platform.navigator;
    if (navigator && navigator.msPointerEnabled) {
        // time to remove some of that zoom in ja..
        domElement.style['-ms-content-zooming'] = 'none';
        domElement.style['-ms-touch-action'] = 'none';
        // DO some window specific touch!
    }

    domElement.addEventListener('mousemove', this, true);
    domElement.addEventListener('mousedown', this, true);
    domElement.addEventListener('mouseout', this, true);
    // aint no multi touch just yet!
    domElement.addEventListener('touchstart', this, true);
    domElement.addEventListener('touchend', this, true);
    domElement.addEventListener('touchmove', this, true);

    this.interactionDOMElement = domElement;
};


/**
 * updates the state of interactive objects
 *
 * @method update
 * @private
 */
proto.update = function update()
{
    if(!this.target)return;

    // frequency of 30fps??
    var now = Date.now();
    var diff = now - this.last;
    diff = (diff * 30) / 1000;
    if (diff < 1) return;
    this.last = now;
    //

    var i, l;

    // ok.. so mouse events??
    // yes for now :)
    // OPTIMSE - how often to check??
    if(this.dirty)
    {
        this.dirty = false;

        for (i = 0, l = this.interactiveItems.length; i < l; i++) {
            this.interactiveItems[i].interactiveChildren = false;
        }

        this.interactiveItems = [];

        if (this.stage.interactive) this.interactiveItems.push(this.stage);
        // go through and collect all the objects that are interactive..
        this.collectInteractiveSprite(this.stage, this.stage);
    }

    // loop through interactive objects!
    var length = this.interactiveItems.length;

    this.interactionDOMElement.style.cursor = "default";


    // loop through interactive objects!
    for (i = 0, l = this.interactiveItems.length; i < l; i++)
    {
        var item = this.interactiveItems[i];


        //if(!item.visible)continue;

        // OPTIMISATION - only calculate every time if the mousemove function exists..
        // OK so.. does the object have any other interactive functions?
        // hit-test the clip!


        if(item.mouseover || item.mouseout || item.buttonMode)
        {
            // ok so there are some functions so lets hit test it..
            item.__hit = this.hitTest(item, this.mouse);
            this.mouse.target = item;
            // ok so deal with interactions..
            // loks like there was a hit!
            if(item.__hit)
            {
                if(item.buttonMode) this.interactionDOMElement.style.cursor = "pointer";

                if(!item.__isOver)
                {

                    if(item.mouseover)item.mouseover(this.mouse);
                    item.__isOver = true;
                }
            }
            else
            {
                if(item.__isOver)
                {
                    // roll out!
                    if(item.mouseout)item.mouseout(this.mouse);
                    item.__isOver = false;
                }
            }
        }

        // --->
    }
};

/**
 * Is called when the mouse moves accross the renderer element
 *
 * @method onMouseMove
 * @param event {Event} The DOM event of the mouse moving
 * @private
 */
proto.onMouseMove = function onMouseMove(event)
{
    this.mouse.originalEvent = event;
    // TODO optimize by not check EVERY TIME! maybe half as often? //
    var rect = this.interactionDOMElement.getBoundingClientRect();

    this.mouse.global.x = (event.clientX - rect.left) * (this.target.width / rect.width);
    this.mouse.global.y = (event.clientY - rect.top) * ( this.target.height / rect.height);

    for (var i = 0, l = this.interactiveItems.length; i < l; i++)
    {
        var item = this.interactiveItems[i];
        if (item.mousemove) {
            //call the function!
            item.mousemove(this.mouse);
        }
    }
};

/**
 * Is called when the mouse button is pressed down on the renderer element
 *
 * @method onMouseDown
 * @param event {Event} The DOM event of a mouse button being pressed down
 * @private
 */
proto.onMouseDown = function onMouseDown(event)
{
    this.mouse.originalEvent = event;

    // loop through inteaction tree...
    // hit test each item! ->
    // get interactive items under point??
    //stage.__i
    var index = 0;
    var parent = this.stage;
    var hit = false;

    // while
    // hit test
    for (var i = 0, l = this.interactiveItems.length; i < l; i++)
    {
        var item = this.interactiveItems[i];

        if(item.mousedown || item.click)
        {
            item.__mouseIsDown = true;
            hit = item.__hit = this.hitTest(item, this.mouse);

            if(item.__hit)
            {
                //call the function!
                if(item.mousedown)item.mousedown(this.mouse);
                item.__isDown = true;

                // just the one!
                if(!item.interactiveChildren)break;
            }
        }
    }
};

proto.onMouseOut = function onMouseOut(event)
{
    var length = this.interactiveItems.length;

    this.interactionDOMElement.style.cursor = "default";

    for (var i = 0, l = this.interactiveItems.length; i < l; i++)
    {
        var item = this.interactiveItems[i];

        if(item.__isOver)
        {
            this.mouse.target = item;
            if(item.mouseout)item.mouseout(this.mouse);
            item.__isOver = false;
        }
    }
};

/**
 * Is called when the mouse button is released on the renderer element
 *
 * @method onMouseUp
 * @param event {Event} The DOM event of a mouse button being released
 * @private
 */
proto.onMouseUp = function onMouseUp(event)
{
    this.mouse.originalEvent = event;

    var up = false;

    for (var i = 0, l = this.interactiveItems.length; i < l; i++)
    {
        var item = this.interactiveItems[i];

        if(item.mouseup || item.mouseupoutside || item.click)
        {
            item.__hit = this.hitTest(item, this.mouse);

            if(item.__hit && !up)
            {
                //call the function!
                if(item.mouseup)
                {
                    item.mouseup(this.mouse);
                }
                if(item.__isDown)
                {
                    if(item.click)item.click(this.mouse);
                }

                if (!item.interactiveChildren) up = true;
            }
            else
            {
                if(item.__isDown)
                {
                    if(item.mouseupoutside)item.mouseupoutside(this.mouse);
                }
            }

            item.__isDown = false;
        }
    }
};

/**
 * Tests if the current mouse coords hit a sprite
 *
 * @method hitTest
 * @param item {DisplayObject} The displayObject to test for a hit
 * @param interactionData {InteractionData} The interactiondata object to update in the case of a hit
 * @private
 */
proto.hitTest = function hitTest(item, interactionData)
{
    var world = interactionData.global;

    if(item.vcount !== globals.visibleCount)return false;

    var isSprite = (item instanceof Sprite),
        worldTransform = item.worldTransform,
        a00 = worldTransform[0], a01 = worldTransform[1], a02 = worldTransform[2],
        a10 = worldTransform[3], a11 = worldTransform[4], a12 = worldTransform[5],
        id = 1 / (a00 * a11 + a01 * -a10),
        x = a11 * id * world.x + -a01 * id * world.y + (a12 * a01 - a02 * a11) * id,
        y = a00 * id * world.y + -a10 * id * world.x + (-a12 * a00 + a02 * a10) * id;

    interactionData.target = item;

    //a sprite or display object with a hit area defined
    if(item.hitArea && item.hitArea.contains) {
        if(item.hitArea.contains(x, y)) {
            //if(isSprite)
            interactionData.target = item;

            return true;
        }

        return false;
    }
    // a sprite with no hitarea defined
    else if(isSprite)
    {
        var width = item.texture.frame.width,
            height = item.texture.frame.height,
            x1 = -width * item.anchor.x,
            y1;

        if(x > x1 && x < x1 + width)
        {
            y1 = -height * item.anchor.y;

            if(y > y1 && y < y1 + height)
            {
                // set the target property if a hit is true!
                interactionData.target = item
                return true;
            }
        }
    }

    for (var i = 0, l = item.children.length; i < l; i++)
    {
        var tempItem = item.children[i];
        var hit = this.hitTest(tempItem, interactionData);
        if(hit)
        {
            // hmm.. TODO SET CORRECT TARGET?
            interactionData.target = item
            return true;
        }
    }

    return false;
};

/**
 * Is called when a touch is moved accross the renderer element
 *
 * @method onTouchMove
 * @param event {Event} The DOM event of a touch moving accross the renderer view
 * @private
 */
proto.onTouchMove = function onTouchMove(event)
{
    var rect = this.interactionDOMElement.getBoundingClientRect(),
        changedTouches = event.changedTouches,
        i, l, touchEvent, touchData, ii, ll, item;

    for (i = 0, l = changedTouches.length; i < l; i++)
    {
        touchEvent = changedTouches[i];
        touchData = this.touchs[touchEvent.identifier];
        touchData.originalEvent = event;

        // update the touch position
        touchData.global.x = (touchEvent.clientX - rect.left) * (this.target.width / rect.width);
        touchData.global.y = (touchEvent.clientY - rect.top)  * (this.target.height / rect.height);

        for (ii = 0, ll = this.interactiveItems.length; ii < ll; ii++)
        {
            item = this.interactiveItems[i];
            if (item.touchmove) item.touchmove(touchData);
        }
    }
};

/**
 * Is called when a touch is started on the renderer element
 *
 * @method onTouchStart
 * @param event {Event} The DOM event of a touch starting on the renderer view
 * @private
 */
proto.onTouchStart = function onTouchStart(event)
{
    var rect = this.interactionDOMElement.getBoundingClientRect(),
        changedTouches = event.changedTouches;

    for (var i = 0, l = changedTouches.length; i < l; i++)
    {
        var touchEvent = changedTouches[i];

        var touchData = this.pool.pop();
        if (!touchData) touchData = new InteractionData();

        touchData.originalEvent = event;

        this.touchs[touchEvent.identifier] = touchData;
        touchData.global.x = (touchEvent.clientX - rect.left) * (this.target.width / rect.width);
        touchData.global.y = (touchEvent.clientY - rect.top)  * (this.target.height / rect.height);

        for (var ii = 0, ll = this.interactiveItems.length; ii < ll; ii++)
        {
            var item = this.interactiveItems[ii];

            if (item.touchstart || item.tap)
            {
                item.__hit = this.hitTest(item, touchData);

                if (item.__hit)
                {
                    //call the function!
                    if (item.touchstart) item.touchstart(touchData);
                    item.__isDown = true;
                    item.__touchData = touchData;

                    if(!item.interactiveChildren)break;
                }
            }
        }
    }
};

/**
 * Is called when a touch is ended on the renderer element
 *
 * @method onTouchEnd
 * @param event {Event} The DOM event of a touch ending on the renderer view
 * @private
 */
proto.onTouchEnd = function onTouchEnd(event)
{
    //this.mouse.originalEvent = event;
    var rect = this.interactionDOMElement.getBoundingClientRect(),
        changedTouches = event.changedTouches;

    for (var i = 0, l = changedTouches.length; i < l; i++)
    {
        var touchEvent = changedTouches[i];
        var touchData = this.touchs[touchEvent.identifier];
        var up = false;
        touchData.global.x = (touchEvent.clientX - rect.left) * (this.target.width / rect.width);
        touchData.global.y = (touchEvent.clientY - rect.top)  * (this.target.height / rect.height);

        for (var ii = 0, ll = this.interactiveItems.length; ii < ll; ii++)
        {
            var item = this.interactiveItems[ii];
            var itemTouchData = item.__touchData; // <-- Here!
            item.__hit = this.hitTest(item, touchData);

            if(itemTouchData == touchData)
            {
                // so this one WAS down...
                touchData.originalEvent = event;
                // hitTest??

                if(item.touchend || item.tap)
                {
                    if(item.__hit && !up)
                    {
                        if(item.touchend)item.touchend(touchData);
                        if(item.__isDown)
                        {
                            if(item.tap)item.tap(touchData);
                        }

                        if(!item.interactiveChildren)up = true;
                    }
                    else
                    {
                        if(item.__isDown)
                        {
                            if(item.touchendoutside)item.touchendoutside(touchData);
                        }
                    }

                    item.__isDown = false;
                }

                item.__touchData = null;
            }
        }
        // remove the touch..
        this.pool.push(touchData);
        this.touchs[touchEvent.identifier] = null;
    }
};

module.exports = InteractionManager;

},{"./core/globals":2,"./display/Sprite":6,"./geom/Point":18,"./platform":29}],2:[function(require,module,exports){
/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

module.exports = {
    // autoDetected: false,

    gl: null,
    shaderProgram: null,
    primitiveProgram: null,
    stripShaderProgram: null,

    texturesToUpdate: [],
    texturesToDestroy: [],
    visibleCount: 0
};

},{}],3:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */

var globals = require('../core/globals');
var mat3 = require('../geom/matrix').mat3;

var FilterBlock = require('../filters/FilterBlock');
var Point = require('../geom/Point');

/**
 * The base class for all objects that are rendered on the screen.
 *
 * @class DisplayObject
 * @constructor
 */
function DisplayObject()
{
    this.last = this;
    this.first = this;

    /**
     * The coordinate of the object relative to the local coordinates of the parent.
     *
     * @property position
     * @type Point
     */
    this.position = new Point();

    /**
     * The scale factor of the object.
     *
     * @property scale
     * @type Point
     */
    this.scale = new Point(1,1);//{x:1, y:1};

    /**
     * The pivot point of the displayObject that it rotates around
     *
     * @property pivot
     * @type Point
     */
    this.pivot = new Point(0,0);

    /**
     * The rotation of the object in radians.
     *
     * @property rotation
     * @type Number
     */
    this.rotation = 0;

    /**
     * The opacity of the object.
     *
     * @property alpha
     * @type Number
     */
    this.alpha = 1;

    /**
     * The visibility of the object.
     *
     * @property visible
     * @type Boolean
     */
    this.visible = true;

    /**
     * This is the defined area that will pick up mouse / touch events. It is null by default.
     * Setting it is a neat way of optimising the hitTest function that the interactionManager will use (as it will not need to hit test all the children)
     *
     * @property hitArea
     * @type Rectangle|Circle|Ellipse|Polygon
     */
    this.hitArea = null;

    /**
     * This is used to indicate if the displayObject should display a mouse hand cursor on rollover
     *
     * @property buttonMode
     * @type Boolean
     */
    this.buttonMode = false;

    /**
     * Can this object be rendered
     *
     * @property renderable
     * @type Boolean
     */
    this.renderable = false;

    /**
     * [read-only] The display object container that contains this display object.
     *
     * @property parent
     * @type DisplayObjectContainer
     * @readOnly
     */
    this.parent = null;

    /**
     * [read-only] The stage the display object is connected to, or undefined if it is not connected to the stage.
     *
     * @property stage
     * @type Stage
     * @readOnly
     */
    this.stage = null;

    /**
     * [read-only] The multiplied alpha of the displayobject
     *
     * @property worldAlpha
     * @type Number
     * @readOnly
     */
    this.worldAlpha = 1;

    /**
     * [read-only] Whether or not the object is interactive, do not toggle directly! use the `interactive` property
     *
     * @property _interactive
     * @type Boolean
     * @readOnly
     * @private
     */
    this._interactive = false;

    /**
     * [read-only] Current transform of the object based on world (parent) factors
     *
     * @property worldTransform
     * @type Mat3
     * @readOnly
     * @private
     */
    this.worldTransform = mat3.create()//mat3.identity();

    /**
     * [read-only] Current transform of the object locally
     *
     * @property localTransform
     * @type Mat3
     * @readOnly
     * @private
     */
    this.localTransform = mat3.create()//mat3.identity();

    /**
     * [NYI] Unkown
     *
     * @property color
     * @type Array<>
     * @private
     */
    this.color = [];

    /**
     * [NYI] Holds whether or not this object is dynamic, for rendering optimization
     *
     * @property dynamic
     * @type Boolean
     * @private
     */
    this.dynamic = true;

    // chach that puppy!
    this._sr = 0;
    this._cr = 1;

    /*
     * MOUSE Callbacks
     */

    /**
     * A callback that is used when the users clicks on the displayObject with their mouse
     * @method click
     * @param interactionData {InteractionData}
     */

    /**
     * A callback that is used when the user clicks the mouse down over the sprite
     * @method mousedown
     * @param interactionData {InteractionData}
     */

    /**
     * A callback that is used when the user releases the mouse that was over the displayObject
     * for this callback to be fired the mouse must have been pressed down over the displayObject
     * @method mouseup
     * @param interactionData {InteractionData}
     */

    /**
     * A callback that is used when the user releases the mouse that was over the displayObject but is no longer over the displayObject
     * for this callback to be fired, The touch must have started over the displayObject
     * @method mouseupoutside
     * @param interactionData {InteractionData}
     */

    /**
     * A callback that is used when the users mouse rolls over the displayObject
     * @method mouseover
     * @param interactionData {InteractionData}
     */

    /**
     * A callback that is used when the users mouse leaves the displayObject
     * @method mouseout
     * @param interactionData {InteractionData}
     */


    /*
     * TOUCH Callbacks
     */

    /**
     * A callback that is used when the users taps on the sprite with their finger
     * basically a touch version of click
     * @method tap
     * @param interactionData {InteractionData}
     */

    /**
     * A callback that is used when the user touch's over the displayObject
     * @method touchstart
     * @param interactionData {InteractionData}
     */

    /**
     * A callback that is used when the user releases a touch over the displayObject
     * @method touchend
     * @param interactionData {InteractionData}
     */

    /**
     * A callback that is used when the user releases the touch that was over the displayObject
     * for this callback to be fired, The touch must have started over the sprite
     * @method touchendoutside
     * @param interactionData {InteractionData}
     */
}
var proto = DisplayObject.prototype;

/**
 * Indicates if the sprite will have touch and mouse interactivity. It is false by default
 *
 * @property interactive
 * @type Boolean
 * @default false
 */
Object.defineProperty(proto, 'interactive', {
    get: function() {
        return this._interactive;
    },
    set: function(value) {
        this._interactive = value;

        // TODO more to be done here..
        // need to sort out a re-crawl!
        if(this.stage)this.stage.dirty = true;
    }
});

/**
 * Sets a mask for the displayObject. A mask is an object that limits the visibility of an object to the shape of the mask applied to it.
 * In Pixi a regular mask must be a Graphics object. This allows for much faster masking in canvas as it utilises shape clipping.
 * To remove a mask, set this property to null.
 *
 * @property mask
 * @type Graphics
 */
Object.defineProperty(proto, 'mask', {
    get: function() {
        return this._mask;
    },
    set: function(value) {

        this._mask = value;

        if(value)
        {
            this.addFilter(value)
        }
        else
        {
             this.removeFilter();
        }
    }
});

/**
 * [Deprecated] Indicates if the sprite will have touch and mouse interactivity. It is false by default
 * Instead of using this function you can now simply set the interactive property to true or false
 *
 * @deprecated
 * @method setInteractive
 * @param interactive {Boolean}
 * @deprecated Simply set the `interactive` property directly
 */
proto.setInteractive = function setInteractive(interactive)
{
    this.interactive = interactive;
};

/*
 * Adds a filter to this displayObject
 *
 * @method addFilter
 * @param mask {Graphics} the graphics object to use as a filter
 * @private
 */
proto.addFilter = function addFilter(mask)
{
    if(this.filter)return;
    this.filter = true;

    // insert a filter block..
    var start = new FilterBlock();
    var end = new FilterBlock();

    start.mask = mask;
    end.mask = mask;

    start.first = start.last =  this;
    end.first = end.last = this;

    start.open = true;

    /*
     * insert start
     */

    var childFirst, childLast,
        nextObject, previousObject;

    childFirst = childLast = start;
    previousObject = this.first._iPrev;

    if(previousObject)
    {
        nextObject = previousObject._iNext;
        childFirst._iPrev = previousObject;
        previousObject._iNext = childFirst;
    }
    else
    {
        nextObject = this;
    }

    if(nextObject)
    {
        nextObject._iPrev = childLast;
        childLast._iNext = nextObject;
    }


    // now insert the end filter block..

    /*
     * insert end filter
     */
    childFirst = end;
    childLast = end;
    nextObject = null;
    previousObject = null;

    previousObject = this.last;
    nextObject = previousObject._iNext;

    if(nextObject)
    {
        nextObject._iPrev = childLast;
        childLast._iNext = nextObject;
    }

    childFirst._iPrev = previousObject;
    previousObject._iNext = childFirst;

    var updateLast = this;

    var prevLast = this.last;
    while(updateLast)
    {
        if(updateLast.last == prevLast)
        {
            updateLast.last = end;
        }
        updateLast = updateLast.parent;
    }

    this.first = start;

    // if webGL...
    if(this.__renderGroup)
    {
        this.__renderGroup.addFilterBlocks(start, end);
    }

    mask.renderable = false;
};

/*
 * Removes the filter to this displayObject
 *
 * @method removeFilter
 * @private
 */
proto.removeFilter = function removeFilter()
{
    if(!this.filter)return;
    this.filter = false;

    // modify the list..
    var startBlock = this.first;

    var nextObject = startBlock._iNext;
    var previousObject = startBlock._iPrev;

    if(nextObject)nextObject._iPrev = previousObject;
    if(previousObject)previousObject._iNext = nextObject;

    this.first = startBlock._iNext;


    // remove the end filter
    var lastBlock = this.last;

    nextObject = lastBlock._iNext;
    previousObject = lastBlock._iPrev;

    if(nextObject)nextObject._iPrev = previousObject;
    previousObject._iNext = nextObject;

    // this is always true too!
    var tempLast =  lastBlock._iPrev;
    // need to make sure the parents last is updated too
    var updateLast = this;
    while(updateLast.last == lastBlock)
    {
        updateLast.last = tempLast;
        updateLast = updateLast.parent;
        if(!updateLast)break;
    }

    var mask = startBlock.mask
    mask.renderable = true;

    // if webGL...
    if(this.__renderGroup)
    {
        this.__renderGroup.removeFilterBlocks(startBlock, lastBlock);
    }
};

/*
 * Updates the object transform for rendering
 *
 * @method updateTransform
 * @private
 */
proto.updateTransform = function updateTransform()
{
    // TODO OPTIMIZE THIS!! with dirty
    if(this.rotation !== this.rotationCache)
    {
        this.rotationCache = this.rotation;
        this._sr =  Math.sin(this.rotation);
        this._cr =  Math.cos(this.rotation);
    }

    var localTransform = this.localTransform;
    var parentTransform = this.parent.worldTransform;
    var worldTransform = this.worldTransform;
    //console.log(localTransform)
    localTransform[0] = this._cr * this.scale.x;
    localTransform[1] = -this._sr * this.scale.y
    localTransform[3] = this._sr * this.scale.x;
    localTransform[4] = this._cr * this.scale.y;

    // TODO --> do we even need a local matrix???

    var px = this.pivot.x;
    var py = this.pivot.y;

    // Cache the matrix values (makes for huge speed increases!)
    var a00 = localTransform[0], a01 = localTransform[1], a02 = this.position.x - localTransform[0] * px - py * localTransform[1],
        a10 = localTransform[3], a11 = localTransform[4], a12 = this.position.y - localTransform[4] * py - px * localTransform[3],

        b00 = parentTransform[0], b01 = parentTransform[1], b02 = parentTransform[2],
        b10 = parentTransform[3], b11 = parentTransform[4], b12 = parentTransform[5];

    localTransform[2] = a02
    localTransform[5] = a12

    worldTransform[0] = b00 * a00 + b01 * a10;
    worldTransform[1] = b00 * a01 + b01 * a11;
    worldTransform[2] = b00 * a02 + b01 * a12 + b02;

    worldTransform[3] = b10 * a00 + b11 * a10;
    worldTransform[4] = b10 * a01 + b11 * a11;
    worldTransform[5] = b10 * a02 + b11 * a12 + b12;

    // because we are using affine transformation, we can optimise the matrix concatenation process.. wooo!
    // mat3.multiply(this.localTransform, this.parent.worldTransform, this.worldTransform);
    this.worldAlpha = this.alpha * this.parent.worldAlpha;

    this.vcount = globals.visibleCount;
};

module.exports = DisplayObject;

},{"../core/globals":2,"../filters/FilterBlock":15,"../geom/Point":18,"../geom/matrix":21}],4:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var DisplayObject = require('./DisplayObject');

/**
 * A DisplayObjectContainer represents a collection of display objects.
 * It is the base class of all display objects that act as a container for other objects.
 *
 * @class DisplayObjectContainer
 * @extends DisplayObject
 * @constructor
 */
function DisplayObjectContainer()
{
    DisplayObject.call(this);

    /**
     * [read-only] The of children of this container.
     *
     * @property children
     * @type Array<DisplayObject>
     * @readOnly
     */
    this.children = [];
}

var proto = DisplayObjectContainer.prototype = Object.create(DisplayObject.prototype, {
    constructor: {value: DisplayObjectContainer}
});

//TODO make visible a getter setter
/*
Object.defineProperty(proto, 'visible', {
    get: function() {
        return this._visible;
    },
    set: function(value) {
        this._visible = value;

    }
});*/

/**
 * Adds a child to the container.
 *
 * @method addChild
 * @param child {DisplayObject} The DisplayObject to add to the container
 */
proto.addChild = function addChild(child)
{
    if (child.parent) {
        //// COULD BE THIS???
        child.parent.removeChild(child);
    //  return;
    }
    child.parent = this;

    this.children.push(child);

    // update the stage refference..

    if(this.stage)
    {
        var tmpChild = child;
        do
        {
            if(tmpChild.interactive)this.stage.dirty = true;
            tmpChild.stage = this.stage;
            tmpChild = tmpChild._iNext;
        }
        while(tmpChild)
    }

    // LINKED LIST //

    // modify the list..
    var childFirst = child.first
    var childLast = child.last;
    var nextObject;
    var previousObject;

    // this could be wrong if there is a filter??
    if(this.filter)
    {
        previousObject =  this.last._iPrev;
    }
    else
    {
        previousObject = this.last;
    }

    nextObject = previousObject._iNext;

    // always true in this case
    // need to make sure the parents last is updated too
    var updateLast = this;
    var prevLast = previousObject;

    while(updateLast)
    {
        if(updateLast.last == prevLast)
        {
            updateLast.last = child.last;
        }
        updateLast = updateLast.parent;
    }

    if(nextObject)
    {
        nextObject._iPrev = childLast;
        childLast._iNext = nextObject;
    }

    childFirst._iPrev = previousObject;
    previousObject._iNext = childFirst;

    // need to remove any render groups..
    if(this.__renderGroup)
    {
        // being used by a renderTexture.. if it exists then it must be from a render texture;
        if(child.__renderGroup)child.__renderGroup.removeDisplayObjectAndChildren(child);
        // add them to the new render group..
        this.__renderGroup.addDisplayObjectAndChildren(child);
    }
};

/**
 * Adds a child to the container at a specified index. If the index is out of bounds an error will be thrown
 *
 * @method addChildAt
 * @param child {DisplayObject} The child to add
 * @param index {Number} The index to place the child in
 */
proto.addChildAt = function addChildAt(child, index)
{
    if(index >= 0 && index <= this.children.length)
    {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;

        if(this.stage)
        {
            var tmpChild = child;
            do
            {
                if(tmpChild.interactive)this.stage.dirty = true;
                tmpChild.stage = this.stage;
                tmpChild = tmpChild._iNext;
            }
            while(tmpChild)
        }

        // modify the list..
        var childFirst = child.first;
        var childLast = child.last;
        var nextObject;
        var previousObject;

        if(index === this.children.length)
        {
            previousObject = this.last;
            var updateLast = this;
            var prevLast = this.last;
            while(updateLast)
            {
                if(updateLast.last == prevLast)
                {
                    updateLast.last = child.last;
                }
                updateLast = updateLast.parent;
            }
        }
        else if(!index)
        {
            previousObject = this;
        }
        else
        {
            previousObject = this.children[index-1].last;
        }

        nextObject = previousObject._iNext;

        // always true in this case
        if(nextObject)
        {
            nextObject._iPrev = childLast;
            childLast._iNext = nextObject;
        }

        childFirst._iPrev = previousObject;
        previousObject._iNext = childFirst;

        this.children.splice(index, 0, child);
        // need to remove any render groups..
        if(this.__renderGroup)
        {
            // being used by a renderTexture.. if it exists then it must be from a render texture;
            if(child.__renderGroup)child.__renderGroup.removeDisplayObjectAndChildren(child);
            // add them to the new render group..
            this.__renderGroup.addDisplayObjectAndChildren(child);
        }

    }
    else
    {
        throw new Error(child + " The index "+ index +" supplied is out of bounds " + this.children.length);
    }
};

/**
 * [NYI] Swaps the depth of 2 displayObjects
 *
 * @method swapChildren
 * @param child {DisplayObject}
 * @param child2 {DisplayObject}
 * @private
 */
proto.swapChildren = function swapChildren(child, child2)
{
    /*
     * this funtion needs to be recoded..
     * can be done a lot faster..
     */
    return;

    // need to fix this function :/
    /*
    // TODO I already know this??
    var index = this.children.indexOf( child );
    var index2 = this.children.indexOf( child2 );

    if ( index !== -1 && index2 !== -1 )
    {
        // cool

        /*
        if(this.stage)
        {
            // this is to satisfy the webGL batching..
            // TODO sure there is a nicer way to achieve this!
            this.stage.__removeChild(child);
            this.stage.__removeChild(child2);

            this.stage.__addChild(child);
            this.stage.__addChild(child2);
        }

        // swap the positions..
        this.children[index] = child2;
        this.children[index2] = child;

    }
    else
    {
        throw new Error(child + " Both the supplied DisplayObjects must be a child of the caller " + this);
    }*/
};

/**
 * Returns the Child at the specified index
 *
 * @method getChildAt
 * @param index {Number} The index to get the child from
 */
proto.getChildAt = function getChildAt(index)
{
    if(index >= 0 && index < this.children.length)
    {
        return this.children[index];
    }
    else
    {
        throw new RangeError("The supplied index is out of bounds");
    }
};

/**
 * Removes a child from the container.
 *
 * @method removeChild
 * @param child {DisplayObject} The DisplayObject to remove
 */
proto.removeChild = function removeChild(child)
{
    var index = this.children.indexOf( child );
    if ( index !== -1 )
    {
        // unlink //
        // modify the list..
        var childFirst = child.first;
        var childLast = child.last;

        var nextObject = childLast._iNext;
        var previousObject = childFirst._iPrev;

        if(nextObject)nextObject._iPrev = previousObject;
        previousObject._iNext = nextObject;

        if(this.last == childLast)
        {
            var tempLast =  childFirst._iPrev;
            // need to make sure the parents last is updated too
            var updateLast = this;
            while(updateLast.last == childLast.last)
            {
                updateLast.last = tempLast;
                updateLast = updateLast.parent;
                if(!updateLast)break;
            }
        }

        childLast._iNext = null;
        childFirst._iPrev = null;

        // update the stage reference..
        if(this.stage)
        {
            var tmpChild = child;
            do
            {
                if(tmpChild.interactive)this.stage.dirty = true;
                tmpChild.stage = null;
                tmpChild = tmpChild._iNext;
            }
            while(tmpChild)
        }

        // webGL trim
        if(child.__renderGroup)
        {
            child.__renderGroup.removeDisplayObjectAndChildren(child);
        }

        child.parent = undefined;
        this.children.splice( index, 1 );
    }
    else
    {
        throw new Error(child + " The supplied DisplayObject must be a child of the caller " + this);
    }
};

/*
 * Updates the container's children's transform for rendering
 *
 * @method updateTransform
 * @private
 */
proto.updateTransform = function updateTransform()
{
    if(!this.visible)return;

    DisplayObject.prototype.updateTransform.call( this );

    for(var i=0,j=this.children.length; i<j; i++)
    {
        this.children[i].updateTransform();
    }
};

module.exports = DisplayObjectContainer;

},{"./DisplayObject":3}],5:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var Sprite = require('./Sprite');

/**
 * A MovieClip is a simple way to display an animation depicted by a list of textures.
 *
 * @class MovieClip
 * @extends Sprite
 * @constructor
 * @param textures {Array<Texture>} an array of {Texture} objects that make up the animation
 */
function MovieClip(textures)
{
    Sprite.call(this, textures[0]);

    /**
     * The array of textures that make up the animation
     *
     * @property textures
     * @type Array
     */
    this.textures = textures;

    /**
     * The speed that the MovieClip will play at. Higher is faster, lower is slower
     *
     * @property animationSpeed
     * @type Number
     * @default 1
     */
    this.animationSpeed = 1;

    /**
     * Whether or not the movie clip repeats after playing.
     *
     * @property loop
     * @type Boolean
     * @default true
     */
    this.loop = true;

    /**
     * Function to call when a MovieClip finishes playing
     *
     * @property onComplete
     * @type Function
     */
    this.onComplete = null;

    /**
     * [read-only] The index MovieClips current frame (this may not have to be a whole number)
     *
     * @property currentFrame
     * @type Number
     * @default 0
     * @readOnly
     */
    this.currentFrame = 0;

    /**
     * [read-only] Indicates if the MovieClip is currently playing
     *
     * @property playing
     * @type Boolean
     * @readOnly
     */
    this.playing = false;
}

var proto = MovieClip.prototype = Object.create(Sprite.prototype, {
    constructor: {value: MovieClip}
});

/**
* [read-only] totalFrames is the total number of frames in the MovieClip. This is the same as number of textures
* assigned to the MovieClip.
*
* @property totalFrames
* @type Number
* @default 0
* @readOnly
*/
Object.defineProperty(proto, 'totalFrames', {
    get: function() {
        return this.textures.length;
    }
});


/**
 * Stops the MovieClip
 *
 * @method stop
 */
proto.stop = function()
{
    this.playing = false;
}

/**
 * Plays the MovieClip
 *
 * @method play
 */
proto.play = function()
{
    this.playing = true;
}

/**
 * Stops the MovieClip and goes to a specific frame
 *
 * @method gotoAndStop
 * @param frameNumber {Number} frame index to stop at
 */
proto.gotoAndStop = function(frameNumber)
{
    this.playing = false;
    this.currentFrame = frameNumber;
    var round = (this.currentFrame + 0.5) | 0;
    this.setTexture(this.textures[round % this.textures.length]);
}

/**
 * Goes to a specific frame and begins playing the MovieClip
 *
 * @method gotoAndPlay
 * @param frameNumber {Number} frame index to start at
 */
proto.gotoAndPlay = function gotoAndPlay(frameNumber)
{
    this.currentFrame = frameNumber;
    this.playing = true;
};

/*
 * Updates the object transform for rendering
 *
 * @method updateTransform
 * @private
 */
proto.updateTransform = function updateTransform()
{
    Sprite.prototype.updateTransform.call(this);

    if(!this.playing)return;

    this.currentFrame += this.animationSpeed;

    var round = (this.currentFrame + 0.5) | 0;

    if(this.loop || round < this.textures.length)
    {
        this.setTexture(this.textures[round % this.textures.length]);
    }
    else if(round >= this.textures.length)
    {
        this.gotoAndStop(this.textures.length - 1);
        if(this.onComplete)
        {
            this.onComplete();
        }
    }
};

module.exports = MovieClip;

},{"./Sprite":6}],6:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var blendModes = require('./blendModes');
var DisplayObjectContainer = require('./DisplayObjectContainer');
var Point = require('../geom/Point');
var Texture = require('../textures/Texture');

/**
 * The SPrite object is the base for all textured objects that are rendered to the screen
 *
 * @class Sprite
 * @extends DisplayObjectContainer
 * @constructor
 * @param texture {Texture} The texture for this sprite
 * @type String
 */
function Sprite(texture)
{
    DisplayObjectContainer.call(this);

    /**
     * The anchor sets the origin point of the texture.
     * The default is 0,0 this means the textures origin is the top left
     * Setting than anchor to 0.5,0.5 means the textures origin is centered
     * Setting the anchor to 1,1 would mean the textures origin points will be the bottom right
     *
     * @property anchor
     * @type Point
     */
    this.anchor = new Point();

    /**
     * The texture that the sprite is using
     *
     * @property texture
     * @type Texture
     */
    this.texture = texture;

    /**
     * The blend mode of sprite.
     * currently supports blendModes.NORMAL and blendModes.SCREEN
     *
     * @property blendMode
     * @type Number
     */
    this.blendMode = blendModes.NORMAL;

    /**
     * The width of the sprite (this is initially set by the texture)
     *
     * @property _width
     * @type Number
     * @private
     */
    this._width = 0;

    /**
     * The height of the sprite (this is initially set by the texture)
     *
     * @property _height
     * @type Number
     * @private
     */
    this._height = 0;

    if(texture.baseTexture.hasLoaded)
    {
        this.updateFrame = true;
    }
    else
    {
        var that = this;
        this.texture.addEventListener( 'update', function () {
            that.onTextureUpdate();
        });
    }

    this.renderable = true;
}

var proto = Sprite.prototype = Object.create(DisplayObjectContainer.prototype, {
    constructor: {value: Sprite}
});

/**
 * The width of the sprite, setting this will actually modify the scale to acheive the value set
 *
 * @property width
 * @type Number
 */
Object.defineProperty(proto, 'width', {
    get: function() {
        return this.scale.x * this.texture.frame.width;
    },
    set: function(value) {
        this.scale.x = value / this.texture.frame.width
        this._width = value;
    }
});

/**
 * The height of the sprite, setting this will actually modify the scale to acheive the value set
 *
 * @property height
 * @type Number
 */
Object.defineProperty(proto, 'height', {
    get: function() {
        return  this.scale.y * this.texture.frame.height;
    },
    set: function(value) {
        this.scale.y = value / this.texture.frame.height
        this._height = value;
    }
});

/**
 * Sets the texture of the sprite
 *
 * @method setTexture
 * @param texture {Texture} The texture that is displayed by the sprite
 */
proto.setTexture = function setTexture(texture)
{
    // stop current texture;
    if(this.texture.baseTexture != texture.baseTexture)
    {
        this.textureChange = true;
        this.texture = texture;

        if(this.__renderGroup)
        {
            this.__renderGroup.updateTexture(this);
        }
    }
    else
    {
        this.texture = texture;
    }

    this.updateFrame = true;
};

/**
 * When the texture is updated, this event will fire to update the scale and frame
 *
 * @method onTextureUpdate
 * @param event
 * @private
 */
proto.onTextureUpdate = function onTextureUpdate(event)
{
    // so if _width is 0 then width was not set..
    if(this._width)this.scale.x = this._width / this.texture.frame.width;
    if(this._height)this.scale.y = this._height / this.texture.frame.height;

    this.updateFrame = true;
};

// some helper functions..

/**
 *
 * Helper function that creates a sprite that will contain a texture based on an image url
 * If the image is not in the texture cache it will be loaded
 *
 * @method fromImage
 * @static
 * @param imageId {String} The image url of the texture
 * @return {Sprite} A new Sprite using a texture from the texture cache matching the image id
 */
Sprite.fromImage = function fromImage(imageId)
{
    var texture = Texture.fromImage(imageId);
    return new Sprite(texture);
};

/**
 *
 * Helper function that creates a sprite that will contain a texture from the TextureCache based on the frameId
 * The frame ids are created when a Texture packer file has been loaded
 *
 * @method fromFrame
 * @static
 * @param frameId {String} The frame Id of the texture in the cache
 * @return {Sprite} A new Sprite using a texture from the texture cache matching the frameId
 */
Sprite.fromFrame = function fromFrame(frameId)
{
    var texture = Texture.cache[frameId];
    if(!texture)throw new Error("The frameId '"+ frameId +"' does not exist in the texture cache" + this);
    return new Sprite(texture);
};

module.exports = Sprite;

},{"../geom/Point":18,"../textures/Texture":42,"./DisplayObjectContainer":4,"./blendModes":8}],7:[function(require,module,exports){
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
    hex = "000000".substr(0, 6 - hex.length) + hex;
    this.backgroundColorString = "#" + hex;
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

},{"../InteractionManager":1,"../core/globals":2,"../geom/Rectangle":20,"../geom/matrix":21,"../utils/color":45,"./DisplayObjectContainer":4}],8:[function(require,module,exports){
/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

module.exports = {
	NORMAL: 0,
	SCREEN: 1
};

},{}],9:[function(require,module,exports){
/**
 * https://github.com/mrdoob/eventtarget.js/
 * THankS mr DOob!
 */
'use strict';

/**
 * Adds event emitter functionality to a class
 *
 * @class EventTarget
 * @example
 *      function MyEmitter() {
 *          EventTarget.call(this); //mixes in event target stuff
 *      }
 *
 *      var em = new MyEmitter();
 *      em.emit({ type: 'eventName', data: 'some data' });
 */
function EventTarget() {

    var listeners = {};

    this.addEventListener = this.on = function ( type, listener ) {


        if ( listeners[ type ] === undefined ) {

            listeners[ type ] = [];

        }

        if ( listeners[ type ].indexOf( listener ) === - 1 ) {

            listeners[ type ].push( listener );
        }

    };

    this.dispatchEvent = this.emit = function ( event ) {

        if ( !listeners[ event.type ] || !listeners[ event.type ].length ) {

            return;

        }

        for(var i = 0, l = listeners[ event.type ].length; i < l; i++) {

            listeners[ event.type ][ i ]( event );

        }

    };

    this.removeEventListener = this.off = function ( type, listener ) {

        var index = listeners[ type ].indexOf( listener );

        if ( index !== - 1 ) {

            listeners[ type ].splice( index, 1 );

        }

    };
}

module.exports = EventTarget;

},{}],10:[function(require,module,exports){
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
proto.renderCanvas = function renderCanvas(renderer)
{
    // override!
};

/**
 * If this object is being rendered by a WebGLRenderer it will call this callback to initialize
 *
 * @method initWebGL
 * @param renderer {WebGLRenderer} The renderer instance
 */
proto.initWebGL = function initWebGL(renderer)
{
    // override!
};

/**
 * If this object is being rendered by a WebGLRenderer it will call this callback
 *
 * @method renderWebGL
 * @param renderer {WebGLRenderer} The renderer instance
 */
proto.renderWebGL = function renderWebGL(renderGroup, projectionMatrix)
{
    // not sure if both needed? but ya have for now!
    // override!
};

module.exports = CustomRenderable;

},{"../display/DisplayObject":3}],11:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/
 */
'use strict';

var Strip = require('./Strip');
var DisplayObjectContainer = require('../display/DisplayObjectContainer');

function Rope(texture, points)
{
    Strip.call(this, texture);
    this.points = points;

    try
    {
        this.verticies = new Float32Array(points.length * 4);
        this.uvs = new Float32Array(points.length * 4);
        this.colors = new Float32Array(points.length * 2);
        this.indices = new Uint16Array(points.length * 2);
    }
    catch(error)
    {
        this.verticies = [];
        this.uvs = [];
        this.colors = [];
        this.indices = [];
    }

    this.refresh();
}

var proto = Rope.prototype = Object.create(Strip.prototype, {
    constructor: {value: Rope}
});

proto.refresh = function refresh()
{
    var points = this.points;
    if(points.length < 1)return;

    var uvs = this.uvs
    var indices = this.indices;
    var colors = this.colors;

    var lastPoint = points[0];
    var nextPoint;
    var perp = {x:0, y:0};

    this.count-=0.2;


    uvs[0] = 0
    uvs[1] = 1
    uvs[2] = 0
    uvs[3] = 1

    colors[0] = 1;
    colors[1] = 1;

    indices[0] = 0;
    indices[1] = 1;

    var total = points.length,
        point, index, amount;

    for (var i = 1; i < total; i++)
    {

        point = points[i];
        index = i * 4;
        // time to do some smart drawing!
        amount = i/(total-1)

        if(i%2)
        {
            uvs[index] = amount;
            uvs[index+1] = 0;

            uvs[index+2] = amount
            uvs[index+3] = 1

        }
        else
        {
            uvs[index] = amount
            uvs[index+1] = 0

            uvs[index+2] = amount
            uvs[index+3] = 1
        }

        index = i * 2;
        colors[index] = 1;
        colors[index+1] = 1;

        index = i * 2;
        indices[index] = index;
        indices[index + 1] = index + 1;

        lastPoint = point;
    }
};

proto.updateTransform = function updateTransform()
{

    var points = this.points;
    if(points.length < 1)return;

    var lastPoint = points[0];
    var nextPoint;
    var perp = {x:0, y:0};

    this.count-=0.2;

    var verticies = this.verticies;
    verticies[0] = lastPoint.x + perp.x
    verticies[1] = lastPoint.y + perp.y //+ 200
    verticies[2] = lastPoint.x - perp.x
    verticies[3] = lastPoint.y - perp.y//+200
    // time to do some smart drawing!

    var total = points.length,
        point, index, ratio, perpLength, num;

    for (var i = 1; i < total; i++)
    {
        point = points[i];
        index = i * 4;

        if(i < points.length-1)
        {
            nextPoint = points[i+1];
        }
        else
        {
            nextPoint = point;
        }

        perp.y = -(nextPoint.x - lastPoint.x);
        perp.x = nextPoint.y - lastPoint.y;

        ratio = (1 - (i / (total-1))) * 10;
                if(ratio > 1)ratio = 1;

        perpLength = Math.sqrt(perp.x * perp.x + perp.y * perp.y);
        num = this.texture.height/2//(20 + Math.abs(Math.sin((i + this.count) * 0.3) * 50) )* ratio;
        perp.x /= perpLength;
        perp.y /= perpLength;

        perp.x *= num;
        perp.y *= num;

        verticies[index] = point.x + perp.x
        verticies[index+1] = point.y + perp.y
        verticies[index+2] = point.x - perp.x
        verticies[index+3] = point.y - perp.y

        lastPoint = point;
    }

    DisplayObjectContainer.prototype.updateTransform.call( this );
};

proto.setTexture = function setTexture(texture)
{
    // stop current texture
    this.texture = texture;
    this.updateFrame = true;
};

module.exports = Rope;

},{"../display/DisplayObjectContainer":4,"./Strip":13}],12:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 * based on pixi impact spine implementation made by Eemeli Kelokorpi (@ekelokorpi) https://github.com/ekelokorpi
 */
'use strict';

var spine = require('../utils/spine');
var DisplayObjectContainer = require('../display/DisplayObjectContainer');
var Sprite = require('../display/Sprite');
var Texture = require('../textures/Texture');

/**
 * A class that enables the you to import and run your spine animations in pixi.
 * Spine animation data needs to be loaded using the AssetLoader or SpineLoader before it can be used by this class
 * See example 12 (http://www.goodboydigital.com/pixijs/examples/12/) to see a working example and check out the source
 *
 * @class Spine
 * @extends DisplayObjectContainer
 * @constructor
 * @param url {String} The url of the spine anim file to be used
 */
function Spine(url) {
    DisplayObjectContainer.call(this);

    this.spineData = Spine.animCache[url];

    if (!this.spineData) {
        throw new Error("Spine data must be preloaded using SpineLoader or AssetLoader: " + url);
    }

    this.skeleton = new spine.Skeleton(this.spineData);
    this.skeleton.updateWorldTransform();

    this.stateData = new spine.AnimationStateData(this.spineData);
    this.state = new spine.AnimationState(this.stateData);

    this.slotContainers = [];

    for (var i = 0, n = this.skeleton.drawOrder.length; i < n; i++) {
        var slot = this.skeleton.drawOrder[i];
        var attachment = slot.attachment;
        var slotContainer = new DisplayObjectContainer();
        this.slotContainers.push(slotContainer);
        this.addChild(slotContainer);
        if (!(attachment instanceof spine.RegionAttachment)) {
            continue;
        }
        var spriteName = attachment.rendererObject.name;
        var sprite = this.createSprite(slot, attachment.rendererObject);
        slot.currentSprite = sprite;
        slot.currentSpriteName = spriteName;
        slotContainer.addChild(sprite);
    }
}

var proto = Spine.prototype = Object.create(DisplayObjectContainer.prototype, {
    constructor: {value: Spine}
});

/*
 * Updates the object transform for rendering
 *
 * @method updateTransform
 * @private
 */
proto.updateTransform = function updateTransform() {
    this.lastTime = this.lastTime || Date.now();
    var timeDelta = (Date.now() - this.lastTime) * 0.001;
    this.lastTime = Date.now();
    this.state.update(timeDelta);
    this.state.apply(this.skeleton);
    this.skeleton.updateWorldTransform();

    var drawOrder = this.skeleton.drawOrder;
    for (var i = 0, n = drawOrder.length; i < n; i++) {
        var slot = drawOrder[i];
        var attachment = slot.attachment;
        var slotContainer = this.slotContainers[i];
        if (!(attachment instanceof spine.RegionAttachment)) {
            slotContainer.visible = false;
            continue;
        }

        if (attachment.rendererObject) {
            if (!slot.currentSpriteName || slot.currentSpriteName != attachment.name) {
                var spriteName = attachment.rendererObject.name;
                if (slot.currentSprite !== undefined) {
                    slot.currentSprite.visible = false;
                }
                slot.sprites = slot.sprites || {};
                if (slot.sprites[spriteName] !== undefined) {
                    slot.sprites[spriteName].visible = true;
                } else {
                    var sprite = this.createSprite(slot, attachment.rendererObject);
                    slotContainer.addChild(sprite);
                }
                slot.currentSprite = slot.sprites[spriteName];
                slot.currentSpriteName = spriteName;
            }
        }
        slotContainer.visible = true;

        var bone = slot.bone;

        slotContainer.position.x = bone.worldX + attachment.x * bone.m00 + attachment.y * bone.m01;
        slotContainer.position.y = bone.worldY + attachment.x * bone.m10 + attachment.y * bone.m11;
        slotContainer.scale.x = bone.worldScaleX;
        slotContainer.scale.y = bone.worldScaleY;

        slotContainer.rotation = -(slot.bone.worldRotation * Math.PI / 180);
    }

    DisplayObjectContainer.prototype.updateTransform.call(this);
};

proto.createSprite = function createSprite(slot, descriptor) {
    var name = Texture.cache[descriptor.name] ? descriptor.name : descriptor.name + ".png";
    var sprite = new Sprite(Texture.fromFrame(name));
    sprite.scale = descriptor.scale;
    sprite.rotation = descriptor.rotation;
    sprite.anchor.x = sprite.anchor.y = 0.5;

    slot.sprites = slot.sprites || {};
    slot.sprites[descriptor.name] = sprite;
    return sprite;
};

Spine.animCache = {};

module.exports = Spine;

},{"../display/DisplayObjectContainer":4,"../display/Sprite":6,"../textures/Texture":42,"../utils/spine":47}],13:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/
 */
'use strict';

var blendModes = require('../display/blendModes');
var DisplayObjectContainer = require('../display/DisplayObjectContainer');

function Strip(texture, width, height)
{
    DisplayObjectContainer.call( this );
    this.texture = texture;
    this.blendMode = blendModes.NORMAL;

    try
    {
        this.uvs = new Float32Array([0, 1,
                1, 1,
                1, 0, 0,1]);

        this.verticies = new Float32Array([0, 0,
                          0,0,
                          0,0, 0,
                          0, 0]);

        this.colors = new Float32Array([1, 1, 1, 1]);

        this.indices = new Uint16Array([0, 1, 2, 3]);
    }
    catch(error)
    {
        this.uvs = [0, 1,
                1, 1,
                1, 0, 0,1];

        this.verticies = [0, 0,
                          0,0,
                          0,0, 0,
                          0, 0];

        this.colors = [1, 1, 1, 1];

        this.indices = [0, 1, 2, 3];
    }


    /*
    this.uvs = new Float32Array()
    this.verticies = new Float32Array()
    this.colors = new Float32Array()
    this.indices = new Uint16Array()
*/
    this.width = width;
    this.height = height;

    // load the texture!
    if(texture.baseTexture.hasLoaded)
    {
        this.width   = this.texture.frame.width;
        this.height  = this.texture.frame.height;
        this.updateFrame = true;
    }
    else
    {
        var that = this;
        this.texture.addEventListener( 'update', function () {
            that.onTextureUpdate();
        });
    }

    this.renderable = true;
}

var proto = Strip.prototype = Object.create(DisplayObjectContainer.prototype, {
    constructor: {value: Strip}
});

proto.setTexture = function setTexture(texture)
{
    //TODO SET THE TEXTURES
    //TODO VISIBILITY

    // stop current texture
    this.texture = texture;
    this.width   = texture.frame.width;
    this.height  = texture.frame.height;
    this.updateFrame = true;
};

proto.onTextureUpdate = function onTextureUpdate(event)
{
    this.updateFrame = true;
};
// some helper functions..

module.exports = Strip;

},{"../display/DisplayObjectContainer":4,"../display/blendModes":8}],14:[function(require,module,exports){
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

},{"../display/DisplayObjectContainer":4,"../display/blendModes":8,"../geom/Point":18}],15:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

function FilterBlock(mask)
{
    this.graphics = mask;
    this.visible = true;
    this.renderable = true;
}

module.exports = FilterBlock;

},{}],16:[function(require,module,exports){
/**
 * @author Chad Engler <chad@pantherdev.com>
 */
'use strict';

/**
 * The Circle object can be used to specify a hit area for displayobjects
 *
 * @class Circle
 * @constructor
 * @param x {Number} The X coord of the upper-left corner of the framing rectangle of this circle
 * @param y {Number} The Y coord of the upper-left corner of the framing rectangle of this circle
 * @param radius {Number} The radius of the circle
 */
function Circle(x, y, radius)
{
    /**
     * @property x
     * @type Number
     * @default 0
     */
    this.x = x || 0;

    /**
     * @property y
     * @type Number
     * @default 0
     */
    this.y = y || 0;

    /**
     * @property radius
     * @type Number
     * @default 0
     */
    this.radius = radius || 0;
}

var proto = Circle.prototype;

/**
 * Creates a clone of this Circle instance
 *
 * @method clone
 * @return {Circle} a copy of the polygon
 */
proto.clone = function clone()
{
    return new Circle(this.x, this.y, this.radius);
};

/**
 * Checks if the x, and y coords passed to this function are contained within this circle
 *
 * @method contains
 * @param x {Number} The X coord of the point to test
 * @param y {Number} The Y coord of the point to test
 * @return {Boolean} if the x/y coords are within this polygon
 */
proto.contains = function contains(x, y)
{
    if(this.radius <= 0)
        return false;

    var dx = (this.x - x),
        dy = (this.y - y),
        r2 = this.radius * this.radius;

    dx *= dx;
    dy *= dy;

    return (dx + dy <= r2);
};

module.exports = Circle;

},{}],17:[function(require,module,exports){
/**
 * @author Chad Engler <chad@pantherdev.com>
 */
'use strict';

var Rectangle = require('./Rectangle');

/**
 * The Ellipse object can be used to specify a hit area for displayobjects
 *
 * @class Ellipse
 * @constructor
 * @param x {Number} The X coord of the upper-left corner of the framing rectangle of this ellipse
 * @param y {Number} The Y coord of the upper-left corner of the framing rectangle of this ellipse
 * @param width {Number} The overall width of this ellipse
 * @param height {Number} The overall height of this ellipse
 */
function Ellipse(x, y, width, height)
{
    /**
     * @property x
     * @type Number
     * @default 0
     */
    this.x = x || 0;

    /**
     * @property y
     * @type Number
     * @default 0
     */
    this.y = y || 0;

    /**
     * @property width
     * @type Number
     * @default 0
     */
    this.width = width || 0;

    /**
     * @property height
     * @type Number
     * @default 0
     */
    this.height = height || 0;
}

var proto = Ellipse.prototype;

/**
 * Creates a clone of this Ellipse instance
 *
 * @method clone
 * @return {Ellipse} a copy of the ellipse
 */
proto.clone = function clone()
{
    return new Ellipse(this.x, this.y, this.width, this.height);
};

/**
 * Checks if the x, and y coords passed to this function are contained within this ellipse
 *
 * @method contains
 * @param x {Number} The X coord of the point to test
 * @param y {Number} The Y coord of the point to test
 * @return {Boolean} if the x/y coords are within this ellipse
 */
proto.contains = function contains(x, y)
{
    if(this.width <= 0 || this.height <= 0)
        return false;

    //normalize the coords to an ellipse with center 0,0
    //and a radius of 0.5
    var normx = ((x - this.x) / this.width) - 0.5,
        normy = ((y - this.y) / this.height) - 0.5;

    normx *= normx;
    normy *= normy;

    return (normx + normy < 0.25);
};

proto.getBounds = function getBounds()
{
    return new Rectangle(this.x, this.y, this.width, this.height);
};

module.exports = Ellipse;

},{"./Rectangle":20}],18:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

/**
 * The Point object represents a location in a two-dimensional coordinate system, where x represents the horizontal axis and y represents the vertical axis.
 *
 * @class Point
 * @constructor
 * @param x {Number} position of the point
 * @param y {Number} position of the point
 */
function Point(x, y)
{
    /**
     * @property x
     * @type Number
     * @default 0
     */
    this.x = x || 0;

    /**
     * @property y
     * @type Number
     * @default 0
     */
    this.y = y || 0;
}

/**
 * Creates a clone of this point
 *
 * @method clone
 * @return {Point} a copy of the point
 */
Point.prototype.clone = function()
{
    return new Point(this.x, this.y);
};

module.exports = Point;

},{}],19:[function(require,module,exports){
/**
 * @author Adrien Brault <adrien.brault@gmail.com>
 */
'use strict';

var Point = require('./Point');

/**
 * @class Polygon
 * @constructor
 * @param points* {Array<Point>|Array<Number>|Point...|Number...} This can be an array of Points that form the polygon,
 *      a flat array of numbers that will be interpreted as [x,y, x,y, ...], or the arugments passed can be
 *      all the points of the polygon e.g. `new Polygon(new Point(), new Point(), ...)`, or the
 *      arguments passed can be flat x,y values e.g. `new Polygon(x,y, x,y, x,y, ...)` where `x` and `y` are
 *      Numbers.
 */
function Polygon(points)
{
    //if points isn't an array, use arguments as the array
    if(!(points instanceof Array))
        points = Array.prototype.slice.call(arguments);

    //if this is a flat array of numbers, convert it to points
    if(typeof points[0] === 'number') {
        var p = [];
        for(var i = 0, il = points.length; i < il; i+=2) {
            p.push(
                new Point(points[i], points[i + 1])
            );
        }

        points = p;
    }

    this.points = points;
}

var proto = Polygon.prototype;

/**
 * Creates a clone of this polygon
 *
 * @method clone
 * @return {Polygon} a copy of the polygon
 */
proto.clone = function()
{
    var points = [];
    for (var i=0; i<this.points.length; i++) {
        points.push(this.points[i].clone());
    }

    return new Polygon(points);
};

/**
 * Checks if the x, and y coords passed to this function are contained within this polygon
 *
 * @method contains
 * @param x {Number} The X coord of the point to test
 * @param y {Number} The Y coord of the point to test
 * @return {Boolean} if the x/y coords are within this polygon
 */
proto.contains = function(x, y)
{
    var inside = false;

    // use some raycasting to test hits
    // https://github.com/substack/point-in-polygon/blob/master/index.js
    for(var i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
        var xi = this.points[i].x, yi = this.points[i].y,
            xj = this.points[j].x, yj = this.points[j].y,
            intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if(intersect) inside = !inside;
    }

    return inside;
};

module.exports = Polygon;

},{"./Point":18}],20:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/
 */
'use strict';

/**
 * the Rectangle object is an area defined by its position, as indicated by its top-left corner point (x, y) and by its width and its height.
 *
 * @class Rectangle
 * @constructor
 * @param x {Number} The X coord of the upper-left corner of the rectangle
 * @param y {Number} The Y coord of the upper-left corner of the rectangle
 * @param width {Number} The overall width of this rectangle
 * @param height {Number} The overall height of this rectangle
 */
function Rectangle(x, y, width, height)
{
    /**
     * @property x
     * @type Number
     * @default 0
     */
    this.x = x || 0;

    /**
     * @property y
     * @type Number
     * @default 0
     */
    this.y = y || 0;

    /**
     * @property width
     * @type Number
     * @default 0
     */
    this.width = width || 0;

    /**
     * @property height
     * @type Number
     * @default 0
     */
    this.height = height || 0;
}
var proto = Rectangle.prototype;

/**
 * Creates a clone of this Rectangle
 *
 * @method clone
 * @return {Rectangle} a copy of the rectangle
 */
proto.clone = function()
{
    return new Rectangle(this.x, this.y, this.width, this.height);
};

/**
 * Checks if the x, and y coords passed to this function are contained within this Rectangle
 *
 * @method contains
 * @param x {Number} The X coord of the point to test
 * @param y {Number} The Y coord of the point to test
 * @return {Boolean} if the x/y coords are within this Rectangle
 */
proto.contains = function(x, y)
{
    if (this.width <= 0 || this.height <= 0)
        return false;

    var x1 = this.x;
    if (x >= x1 && x <= x1 + this.width)
    {
        var y1 = this.y;

        if (y >= y1 && y <= y1 + this.height)
        {
            return true;
        }
    }

    return false;
};

module.exports = Rectangle;

},{}],21:[function(require,module,exports){
'use strict';

/*
 * A lighter version of the rad gl-matrix created by Brandon Jones, Colin MacKenzie IV
 * you both rock!
 */

var Matrix = exports.Matrix = (typeof Float32Array !== 'undefined') ? Float32Array : Array;
var mat3   = exports.mat3 = {};
var mat4   = exports.mat4 = {};

mat3.create = function create()
{
    var matrix = new Matrix(9);

    matrix[0] = 1;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 1;
    matrix[5] = 0;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 1;

    return matrix;
};

mat3.identity = function identity(matrix)
{
    matrix[0] = 1;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 1;
    matrix[5] = 0;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 1;

    return matrix;
};

mat4.create = function create()
{
    var matrix = new Matrix(16);

    matrix[0] = 1;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = 1;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 1;
    matrix[11] = 0;
    matrix[12] = 0;
    matrix[13] = 0;
    matrix[14] = 0;
    matrix[15] = 1;

    return matrix;
};

mat3.multiply = function multiply(mat, mat2, dest)
{
    if (!dest) { dest = mat; }

    // Cache the matrix values (makes for huge speed increases!)
    var a00 = mat[0], a01 = mat[1], a02 = mat[2],
        a10 = mat[3], a11 = mat[4], a12 = mat[5],
        a20 = mat[6], a21 = mat[7], a22 = mat[8],

        b00 = mat2[0], b01 = mat2[1], b02 = mat2[2],
        b10 = mat2[3], b11 = mat2[4], b12 = mat2[5],
        b20 = mat2[6], b21 = mat2[7], b22 = mat2[8];

    dest[0] = b00 * a00 + b01 * a10 + b02 * a20;
    dest[1] = b00 * a01 + b01 * a11 + b02 * a21;
    dest[2] = b00 * a02 + b01 * a12 + b02 * a22;

    dest[3] = b10 * a00 + b11 * a10 + b12 * a20;
    dest[4] = b10 * a01 + b11 * a11 + b12 * a21;
    dest[5] = b10 * a02 + b11 * a12 + b12 * a22;

    dest[6] = b20 * a00 + b21 * a10 + b22 * a20;
    dest[7] = b20 * a01 + b21 * a11 + b22 * a21;
    dest[8] = b20 * a02 + b21 * a12 + b22 * a22;

    return dest;
};

mat3.clone = function clone(mat)
{
    var matrix = new Matrix(9);

    matrix[0] = mat[0];
    matrix[1] = mat[1];
    matrix[2] = mat[2];
    matrix[3] = mat[3];
    matrix[4] = mat[4];
    matrix[5] = mat[5];
    matrix[6] = mat[6];
    matrix[7] = mat[7];
    matrix[8] = mat[8];

    return matrix;
};

mat3.transpose = function transpose(mat, dest)
{
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (!dest || mat === dest) {
        var a01 = mat[1], a02 = mat[2],
            a12 = mat[5];

        mat[1] = mat[3];
        mat[2] = mat[6];
        mat[3] = a01;
        mat[5] = mat[7];
        mat[6] = a02;
        mat[7] = a12;
        return mat;
    }

    dest[0] = mat[0];
    dest[1] = mat[3];
    dest[2] = mat[6];
    dest[3] = mat[1];
    dest[4] = mat[4];
    dest[5] = mat[7];
    dest[6] = mat[2];
    dest[7] = mat[5];
    dest[8] = mat[8];
    return dest;
};

mat3.toMat4 = function toMat4(mat, dest)
{
    if (!dest) { dest = mat4.create(); }

    dest[15] = 1;
    dest[14] = 0;
    dest[13] = 0;
    dest[12] = 0;

    dest[11] = 0;
    dest[10] = mat[8];
    dest[9] = mat[7];
    dest[8] = mat[6];

    dest[7] = 0;
    dest[6] = mat[5];
    dest[5] = mat[4];
    dest[4] = mat[3];

    dest[3] = 0;
    dest[2] = mat[2];
    dest[1] = mat[1];
    dest[0] = mat[0];

    return dest;
};


/////


mat4.create = function create()
{
    var matrix = new Matrix(16);

    matrix[0] = 1;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = 1;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 1;
    matrix[11] = 0;
    matrix[12] = 0;
    matrix[13] = 0;
    matrix[14] = 0;
    matrix[15] = 1;

    return matrix;
};

mat4.transpose = function transpose(mat, dest)
{
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (!dest || mat === dest)
    {
        var a01 = mat[1], a02 = mat[2], a03 = mat[3],
            a12 = mat[6], a13 = mat[7],
            a23 = mat[11];

        mat[1] = mat[4];
        mat[2] = mat[8];
        mat[3] = mat[12];
        mat[4] = a01;
        mat[6] = mat[9];
        mat[7] = mat[13];
        mat[8] = a02;
        mat[9] = a12;
        mat[11] = mat[14];
        mat[12] = a03;
        mat[13] = a13;
        mat[14] = a23;
        return mat;
    }

    dest[0] = mat[0];
    dest[1] = mat[4];
    dest[2] = mat[8];
    dest[3] = mat[12];
    dest[4] = mat[1];
    dest[5] = mat[5];
    dest[6] = mat[9];
    dest[7] = mat[13];
    dest[8] = mat[2];
    dest[9] = mat[6];
    dest[10] = mat[10];
    dest[11] = mat[14];
    dest[12] = mat[3];
    dest[13] = mat[7];
    dest[14] = mat[11];
    dest[15] = mat[15];
    return dest;
}

mat4.multiply = function multiply(mat, mat2, dest)
{
    if (!dest) { dest = mat; }

    // Cache the matrix values (makes for huge speed increases!)
    var a00 = mat[ 0], a01 = mat[ 1], a02 = mat[ 2], a03 = mat[3];
    var a10 = mat[ 4], a11 = mat[ 5], a12 = mat[ 6], a13 = mat[7];
    var a20 = mat[ 8], a21 = mat[ 9], a22 = mat[10], a23 = mat[11];
    var a30 = mat[12], a31 = mat[13], a32 = mat[14], a33 = mat[15];

    // Cache only the current line of the second matrix
    var b0  = mat2[0], b1 = mat2[1], b2 = mat2[2], b3 = mat2[3];
    dest[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    dest[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    dest[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    dest[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = mat2[4];
    b1 = mat2[5];
    b2 = mat2[6];
    b3 = mat2[7];
    dest[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    dest[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    dest[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    dest[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = mat2[8];
    b1 = mat2[9];
    b2 = mat2[10];
    b3 = mat2[11];
    dest[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    dest[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    dest[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    dest[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = mat2[12];
    b1 = mat2[13];
    b2 = mat2[14];
    b3 = mat2[15];
    dest[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    dest[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    dest[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    dest[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    return dest;
};

},{}],22:[function(require,module,exports){
/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

var platform = require('./platform');
var globals = require('./core/globals');
var shaders = require('./renderers/webgl/shaders');
var matrix  = require('./geom/matrix');

var pixi = module.exports = Object.create(globals);

pixi.Point     = require('./geom/Point');
pixi.Rectangle = require('./geom/Rectangle');
pixi.Polygon   = require('./geom/Polygon');
pixi.Circle    = require('./geom/Circle');
pixi.Ellipse   = require('./geom/Ellipse');
pixi.Matrix    = matrix.Matrix;
pixi.mat3      = matrix.mat3;
pixi.mat4      = matrix.mat4;

pixi.blendModes             = require('./display/blendModes');
pixi.DisplayObject          = require('./display/DisplayObject');
pixi.DisplayObjectContainer = require('./display/DisplayObjectContainer');
pixi.Sprite                 = require('./display/Sprite');
pixi.MovieClip              = require('./display/MovieClip');

pixi.FilterBlock = require('./filters/FilterBlock');

pixi.Text       = require('./text/Text');
pixi.BitmapText = require('./text/BitmapText');

pixi.InteractionManager = require('./InteractionManager');
pixi.Stage              = require('./display/Stage');

pixi.EventTarget        = require('./events/EventTarget');

pixi.autoDetectRenderer = require('./utils/autoDetectRenderer');
pixi.PolyK              = require('./utils/Polyk');

pixi.WebGLGraphics    = require('./renderers/webgl/graphics');
pixi.WebGLRenderer    = require('./renderers/webgl/WebGLRenderer');
pixi.WebGLBatch       = require('./renderers/webgl/WebGLBatch');
pixi.WebGLRenderGroup = require('./renderers/webgl/WebGLRenderGroup');
pixi.CanvasRenderer   = require('./renderers/canvas/CanvasRenderer');
pixi.CanvasGraphics   = require('./renderers/canvas/graphics');

pixi.Graphics = require('./primitives/Graphics');

pixi.Strip            = require('./extras/Strip');
pixi.Rope             = require('./extras/Rope');
pixi.TilingSprite     = require('./extras/TilingSprite');
pixi.Spine            = require('./extras/Spine');
pixi.CustomRenderable = require('./extras/CustomRenderable');

pixi.BaseTexture   = require('./textures/BaseTexture');
pixi.Texture       = require('./textures/Texture');
pixi.RenderTexture = require('./textures/RenderTexture');

pixi.AssetLoader       = require('./loaders/AssetLoader');
pixi.JsonLoader        = require('./loaders/JsonLoader');
pixi.SpriteSheetLoader = require('./loaders/SpriteSheetLoader');
pixi.ImageLoader       = require('./loaders/ImageLoader');
pixi.BitmapFontLoader  = require('./loaders/BitmapFontLoader');
pixi.SpineLoader       = require('./loaders/SpineLoader');

pixi.initPrimitiveShader     = shaders.initPrimitiveShader;
pixi.initDefaultShader       = shaders.initDefaultShader;
pixi.initDefaultStripShader  = shaders.initDefaultStripShader;
pixi.activateDefaultShader   = shaders.activateDefaultShader;
pixi.activatePrimitiveShader = shaders.activatePrimitiveShader;

/*
 * DEBUGGING ONLY
 */
pixi.runList = function runList(item)
{
    platform.console.log(">>>>>>>>>")
    platform.console.log("_")
    var safe = 0;
    var tmp = item.first;
    platform.console.log(tmp);

    while(tmp._iNext)
    {
        safe++;
        tmp = tmp._iNext;
        platform.console.log(tmp);

        if(safe > 100)
        {
            platform.console.log("BREAK")
            break
        }
    }
};

},{"./InteractionManager":1,"./core/globals":2,"./display/DisplayObject":3,"./display/DisplayObjectContainer":4,"./display/MovieClip":5,"./display/Sprite":6,"./display/Stage":7,"./display/blendModes":8,"./events/EventTarget":9,"./extras/CustomRenderable":10,"./extras/Rope":11,"./extras/Spine":12,"./extras/Strip":13,"./extras/TilingSprite":14,"./filters/FilterBlock":15,"./geom/Circle":16,"./geom/Ellipse":17,"./geom/Point":18,"./geom/Polygon":19,"./geom/Rectangle":20,"./geom/matrix":21,"./loaders/AssetLoader":23,"./loaders/BitmapFontLoader":24,"./loaders/ImageLoader":25,"./loaders/JsonLoader":26,"./loaders/SpineLoader":27,"./loaders/SpriteSheetLoader":28,"./platform":29,"./primitives/Graphics":30,"./renderers/canvas/CanvasRenderer":31,"./renderers/canvas/graphics":32,"./renderers/webgl/WebGLBatch":33,"./renderers/webgl/WebGLRenderGroup":34,"./renderers/webgl/WebGLRenderer":35,"./renderers/webgl/graphics":36,"./renderers/webgl/shaders":37,"./text/BitmapText":38,"./text/Text":39,"./textures/BaseTexture":40,"./textures/RenderTexture":41,"./textures/Texture":42,"./utils/Polyk":43,"./utils/autoDetectRenderer":44}],23:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var EventTarget = require('../events/EventTarget');

/**
 * Maps file extension to loader types
 *
 * @property loadersByType
 * @type Object
 */
var loadersByType = {};

/**
 * A Class that loads a bunch of images / sprite sheet / bitmap font files. Once the
 * assets have been loaded they are added to the Texture cache and can be accessed
 * easily through Texture.fromImage() and Sprite.fromImage()
 * When all items have been loaded this class will dispatch a "onLoaded" event
 * As each individual item is loaded this class will dispatch a "onProgress" event
 *
 * @class AssetLoader
 * @constructor
 * @uses EventTarget
 * @param {Array<String>} assetURLs an array of image/sprite sheet urls that you would like loaded
 *      supported. Supported image formats include "jpeg", "jpg", "png", "gif". Supported
 *      sprite sheet data formats only include "JSON" at this time. Supported bitmap font
 *      data formats include "xml" and "fnt".
 * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
 */
function AssetLoader(assetURLs, crossorigin)
{
    EventTarget.call(this);

    /**
     * The array of asset URLs that are going to be loaded
     *
     * @property assetURLs
     * @type Array<String>
     */
    this.assetURLs = assetURLs;

    /**
     * Whether the requests should be treated as cross origin
     *
     * @property crossorigin
     * @type Boolean
     */
    this.crossorigin = crossorigin;
}

var proto = AssetLoader.prototype;

/**
 * Fired when an item has loaded
 * @event onProgress
 */

/**
 * Fired when all the assets have loaded
 * @event onComplete
 */

/**
 * Starts loading the assets sequentially
 *
 * @method load
 */
proto.load = function load()
{
    var scope = this;

    function onLoad() {
        scope.onAssetLoaded();
    }

    this.loadCount = this.assetURLs.length;

    for (var i = 0, l = this.assetURLs.length; i < l; i++)
    {
        var fileName = this.assetURLs[i];
        var fileType = fileName.split(".").pop().toLowerCase();

        var Constructor = loadersByType[fileType];
        if(!Constructor)
            throw new Error(fileType + " is an unsupported file type");

        var loader = new Constructor(fileName, this.crossorigin);

        loader.addEventListener("loaded", onLoad);
        loader.load();
    }
};

/**
 * Invoked after each file is loaded
 *
 * @method onAssetLoaded
 * @private
 */
proto.onAssetLoaded = function onAssetLoaded()
{
    this.loadCount--;
    this.dispatchEvent({type: "onProgress", content: this});
    if (this.onProgress) this.onProgress();

    if (!this.loadCount)
    {
        this.dispatchEvent({type: "onComplete", content: this});
        if(this.onComplete) this.onComplete();
    }
};

AssetLoader.registerLoaderType = function registerLoaderType(type, constructor)
{
    loadersByType[type] = constructor;
};

module.exports = AssetLoader;

},{"../events/EventTarget":9}],24:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AssetLoader = require('./AssetLoader');
var ImageLoader = require('./ImageLoader');
var Rectangle = require('../geom/Rectangle');
var EventTarget = require('../events/EventTarget');
var BitmapText = require('../text/BitmapText');
var Texture = require('../textures/Texture');
var platform = require('../platform');

/**
 * The xml loader is used to load in XML bitmap font data ("xml" or "fnt")
 * To generate the data you can use http://www.angelcode.com/products/bmfont/
 * This loader will also load the image file as the data.
 * When loaded this class will dispatch a "loaded" event
 *
 * @class BitmapFontLoader
 * @uses EventTarget
 * @constructor
 * @param url {String} The url of the sprite sheet JSON file
 * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
 */
function BitmapFontLoader(url, crossorigin)
{
    /*
     * i use texture packer to load the assets..
     * http://www.codeandweb.com/texturepacker
     * make sure to set the format as "JSON"
     */
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

    /**
     * [read-only] The texture of the bitmap font
     *
     * @property baseUrl
     * @type String
     */
    this.texture = null;
}

var proto = BitmapFontLoader.prototype;

proto.handleEvent = function handleEvent(event) {
    switch (event.type) {
    case 'load':
        this.onXMLLoaded(); break;
    default:
        this.onError(); break;
    }
};

/**
 * Loads the XML font data
 *
 * @method load
 */
proto.load = function load()
{
    this.request = platform.createRequest();
    this.request.addEventListener('load', this);
    this.request.addEventListener('error', this);

    this.request.open("GET", this.url, true);
    if (this.request.overrideMimeType) this.request.overrideMimeType("application/xml");
    this.request.send(null)
};

/**
 * Invoked when XML file is loaded, parses the data
 *
 * @method onXMLLoaded
 * @private
 */
proto.onXMLLoaded = function onXMLLoaded()
{
    var textureUrl = this.baseUrl + this.request.responseXML.getElementsByTagName("page")[0].attributes.getNamedItem("file").nodeValue;
    var image = new ImageLoader(textureUrl, this.crossorigin);
    this.texture = image.texture.baseTexture;

    var data = {};
    var info = this.request.responseXML.getElementsByTagName("info")[0];
    var common = this.request.responseXML.getElementsByTagName("common")[0];
    data.font = info.attributes.getNamedItem("face").nodeValue;
    data.size = parseInt(info.attributes.getNamedItem("size").nodeValue, 10);
    data.lineHeight = parseInt(common.attributes.getNamedItem("lineHeight").nodeValue, 10);
    data.chars = {};

    //parse letters
    var letters = this.request.responseXML.getElementsByTagName("char");

    for (var i = 0; i < letters.length; i++)
    {
        var charCode = parseInt(letters[i].attributes.getNamedItem("id").nodeValue, 10);

        var textureRect = new Rectangle(
            parseInt(letters[i].attributes.getNamedItem("x").nodeValue, 10),
            parseInt(letters[i].attributes.getNamedItem("y").nodeValue, 10),
            parseInt(letters[i].attributes.getNamedItem("width").nodeValue, 10),
            parseInt(letters[i].attributes.getNamedItem("height").nodeValue, 10)
        );

        data.chars[charCode] = {
            xOffset: parseInt(letters[i].attributes.getNamedItem("xoffset").nodeValue, 10),
            yOffset: parseInt(letters[i].attributes.getNamedItem("yoffset").nodeValue, 10),
            xAdvance: parseInt(letters[i].attributes.getNamedItem("xadvance").nodeValue, 10),
            kerning: {},
            texture: Texture.cache[charCode] = new Texture(this.texture, textureRect)

        };
    }

    //parse kernings
    var kernings = this.request.responseXML.getElementsByTagName("kerning");
    for (i = 0; i < kernings.length; i++)
    {
       var first = parseInt(kernings[i].attributes.getNamedItem("first").nodeValue, 10);
       var second = parseInt(kernings[i].attributes.getNamedItem("second").nodeValue, 10);
       var amount = parseInt(kernings[i].attributes.getNamedItem("amount").nodeValue, 10);

        data.chars[second].kerning[first] = amount;

    }

    BitmapText.fonts[data.font] = data;

    var scope = this;
    image.addEventListener("loaded", function() {
        scope.onLoaded();
    });
    image.load();
};

/**
 * Invoked when all files are loaded (xml/fnt and texture)
 *
 * @method onLoaded
 * @private
 */
proto.onLoaded = function onLoaded()
{
    this.loaded = true;
    this.dispatchEvent({type: "loaded", content: this});
};

/**
 * Invoke when error occured
 *
 * @method onError
 * @private
 */
proto.onError = function onError()
{
    this.dispatchEvent({type: "error", content: this});
};

AssetLoader.registerLoaderType('xml', BitmapFontLoader);
AssetLoader.registerLoaderType('fnt', BitmapFontLoader);

module.exports = BitmapFontLoader;

},{"../events/EventTarget":9,"../geom/Rectangle":20,"../platform":29,"../text/BitmapText":38,"../textures/Texture":42,"./AssetLoader":23,"./ImageLoader":25}],25:[function(require,module,exports){
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

},{"../events/EventTarget":9,"../textures/Texture":42,"./AssetLoader":23}],26:[function(require,module,exports){
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
var platform = require('../platform');

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

proto.handleEvent = function handleEvent(event) {
    switch (event.type) {
    case 'load':
        this.onJSONLoaded(); break;
    default:
        this.onError(); break;
    }
};

/**
 * Loads the JSON data
 *
 * @method load
 */
proto.load = function load()
{
    this.request = platform.createRequest();
    this.request.addEventListener('load', this);
    this.request.addEventListener('error', this);

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
    this.dispatchEvent({type: "loaded", content: this});
};

/**
 * Invoke when error occured
 *
 * @method onError
 * @private
 */
proto.onError = function onError()
{
    this.dispatchEvent({type: "error", content: this});
};

AssetLoader.registerLoaderType('json', JsonLoader);

module.exports = JsonLoader;

},{"../events/EventTarget":9,"../extras/Spine":12,"../platform":29,"../textures/Texture":42,"../utils/spine":47,"./AssetLoader":23,"./ImageLoader":25}],27:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 * based on pixi impact spine implementation made by Eemeli Kelokorpi (@ekelokorpi) https://github.com/ekelokorpi
 *
 * Awesome JS run time provided by EsotericSoftware
 * https://github.com/EsotericSoftware/spine-runtimes
 *
 */
'use strict';

var AssetLoader = require('./AssetLoader');
var JsonLoader = require('./JsonLoader');
var EventTarget = require('../events/EventTarget');
var Spine = require('../extras/Spine');
var SkeletonJson = require('../utils/spine').SkeletonJson;

/**
 * The Spine loader is used to load in JSON spine data
 * To generate the data you need to use http://esotericsoftware.com/ and export the "JSON" format
 * Due to a clash of names  You will need to change the extension of the spine file from *.json to *.anim for it to load
 * See example 12 (http://www.goodboydigital.com/pixijs/examples/12/) to see a working example and check out the source
 * You will need to generate a sprite sheet to accompany the spine data
 * When loaded this class will dispatch a "loaded" event
 *
 * @class Spine
 * @uses EventTarget
 * @constructor
 * @param url {String} The url of the JSON file
 * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
 */
function SpineLoader(url, crossorigin)
{
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
     * [read-only] Whether the data has loaded yet
     *
     * @property loaded
     * @type Boolean
     * @readOnly
     */
    this.loaded = false;
}

var proto = SpineLoader.prototype;

/**
 * Loads the JSON data
 *
 * @method load
 */
proto.load = function load()
{
    var scope = this;
    var jsonLoader = new JsonLoader(this.url, this.crossorigin);
    jsonLoader.addEventListener("loaded", function (event) {
        scope.json = event.content.json;
        scope.onJSONLoaded();
    });
    jsonLoader.load();
};

/**
 * Invoke when JSON file is loaded
 *
 * @method onJSONLoaded
 * @private
 */
proto.onJSONLoaded = function onJSONLoaded(event)
{
    var spineJsonParser = new SkeletonJson();
    var skeletonData = spineJsonParser.readSkeletonData(this.json);

    Spine.animCache[this.url] = skeletonData;

    this.onLoaded();
};

/**
 * Invoke when JSON file is loaded
 *
 * @method onLoaded
 * @private
 */
proto.onLoaded = function onLoaded()
{
    this.loaded = true;
    this.dispatchEvent({type: "loaded", content: this});
};

AssetLoader.registerLoaderType('anim', SpineLoader);

module.exports = SpineLoader;


},{"../events/EventTarget":9,"../extras/Spine":12,"../utils/spine":47,"./AssetLoader":23,"./JsonLoader":26}],28:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var JsonLoader = require('./JsonLoader');
var ImageLoader = require('./ImageLoader');
var EventTarget = require('../events/EventTarget');
var Texture = require('../textures/Texture');

/**
 * The sprite sheet loader is used to load in JSON sprite sheet data
 * To generate the data you can use http://www.codeandweb.com/texturepacker and publish the "JSON" format
 * There is a free version so thats nice, although the paid version is great value for money.
 * It is highly recommended to use Sprite sheets (also know as texture atlas") as it means sprite"s can be batched and drawn together for highly increased rendering speed.
 * Once the data has been loaded the frames are stored in the texture cache and can be accessed though Texture.fromFrameId() and Sprite.fromFromeId()
 * This loader will also load the image file that the Spritesheet points to as well as the data.
 * When loaded this class will dispatch a "loaded" event
 *
 * @class SpriteSheetLoader
 * @uses EventTarget
 * @constructor
 * @param url {String} The url of the sprite sheet JSON file
 * @param crossorigin {Boolean} Whether requests should be treated as crossorigin
 */
function SpriteSheetLoader(url, crossorigin) {
    /*
     * i use texture packer to load the assets..
     * http://www.codeandweb.com/texturepacker
     * make sure to set the format as "JSON"
     */
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
     * The texture being loaded
     *
     * @property texture
     * @type Texture
     */
    this.texture = null;

    /**
     * The frames of the sprite sheet
     *
     * @property frames
     * @type Object
     */
    this.frames = {};
}

var proto = SpriteSheetLoader.prototype;

/**
 * This will begin loading the JSON file
 *
 * @method load
 */
proto.load = function () {
    var scope = this;
    var jsonLoader = new JsonLoader(this.url, this.crossorigin);
    jsonLoader.addEventListener("loaded", function (event) {
        scope.json = event.content.json;
        scope.onJSONLoaded();
    });
    jsonLoader.load();
};

/**
 * Invoke when JSON file is loaded
 *
 * @method onJSONLoaded
 * @private
 */
proto.onJSONLoaded = function onJSONLoaded()
{
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
};
/**
 * Invoke when all files are loaded (json and texture)
 *
 * @method onLoaded
 * @private
 */
proto.onLoaded = function onLoaded()
{
    this.dispatchEvent({
        type: "loaded",
        content: this
    });
};

module.exports = SpriteSheetLoader;

},{"../events/EventTarget":9,"../textures/Texture":42,"./ImageLoader":25,"./JsonLoader":26}],29:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
module.exports = {

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

},{}],30:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var DisplayObjectContainer = require('../display/DisplayObjectContainer');

/**
 * The Graphics class contains a set of methods that you can use to create primitive shapes and lines.
 * It is important to know that with the webGL renderer only simple polys can be filled at this stage
 * Complex polys will not be filled. Heres an example of a complex poly: http://www.goodboydigital.com/wp-content/uploads/2013/06/complexPolygon.png
 *
 * @class Graphics
 * @extends DisplayObjectContainer
 * @constructor
 */
function Graphics()
{
    DisplayObjectContainer.call(this);

    this.renderable = true;

    /**
     * The alpha of the fill of this graphics object
     *
     * @property fillAlpha
     * @type Number
     */
    this.fillAlpha = 1;

    /**
     * The width of any lines drawn
     *
     * @property lineWidth
     * @type Number
     */
    this.lineWidth = 0;

    /**
     * The color of any lines drawn
     *
     * @property lineColor
     * @type String
     */
    this.lineColor = "black";

    /**
     * Graphics data
     *
     * @property graphicsData
     * @type Array
     * @private
     */
    this.graphicsData = [];

    /**
     * Current path
     *
     * @property currentPath
     * @type Object
     * @private
     */
    this.currentPath = {points:[]};
}

var proto = Graphics.prototype = Object.create(DisplayObjectContainer.prototype, {
    constructor: {value: Graphics}
});

/**
 * Specifies a line style used for subsequent calls to Graphics methods such as the lineTo() method or the drawCircle() method.
 *
 * @method lineStyle
 * @param lineWidth {Number} width of the line to draw, will update the object's stored style
 * @param color {Number} color of the line to draw, will update the object's stored style
 * @param alpha {Number} alpha of the line to draw, will update the object's stored style
 */
proto.lineStyle = function lineStyle(lineWidth, color, alpha)
{
    if (!this.currentPath.points.length) this.graphicsData.pop();

    this.lineWidth = lineWidth || 0;
    this.lineColor = color || 0;
    this.lineAlpha = (arguments.length < 3) ? 1 : alpha;

    this.currentPath = {lineWidth:this.lineWidth, lineColor:this.lineColor, lineAlpha:this.lineAlpha,
                        fillColor:this.fillColor, fillAlpha:this.fillAlpha, fill:this.filling, points:[], type: Graphics.POLY};

    this.graphicsData.push(this.currentPath);
};

/**
 * Moves the current drawing position to (x, y).
 *
 * @method moveTo
 * @param x {Number} the X coord to move to
 * @param y {Number} the Y coord to move to
 */
proto.moveTo = function moveTo(x, y)
{
    if (!this.currentPath.points.length) this.graphicsData.pop();

    this.currentPath = this.currentPath = {lineWidth:this.lineWidth, lineColor:this.lineColor, lineAlpha:this.lineAlpha,
                        fillColor:this.fillColor, fillAlpha:this.fillAlpha, fill:this.filling, points:[], type: Graphics.POLY};

    this.currentPath.points.push(x, y);

    this.graphicsData.push(this.currentPath);
};

/**
 * Draws a line using the current line style from the current drawing position to (x, y);
 * the current drawing position is then set to (x, y).
 *
 * @method lineTo
 * @param x {Number} the X coord to draw to
 * @param y {Number} the Y coord to draw to
 */
proto.lineTo = function lineTo(x, y)
{
    this.currentPath.points.push(x, y);
    this.dirty = true;
};

/**
 * Specifies a simple one-color fill that subsequent calls to other Graphics methods
 * (such as lineTo() or drawCircle()) use when drawing.
 *
 * @method beginFill
 * @param color {uint} the color of the fill
 * @param alpha {Number} the alpha
 */
proto.beginFill = function beginFill(color, alpha)
{
    this.filling = true;
    this.fillColor = color || 0;
    this.fillAlpha = (arguments.length < 2) ? 1 : alpha;
};

/**
 * Applies a fill to the lines and shapes that were added since the last call to the beginFill() method.
 *
 * @method endFill
 */
proto.endFill = function endFill()
{
    this.filling = false;
    this.fillColor = null;
    this.fillAlpha = 1;
};

/**
 * @method drawRect
 *
 * @param x {Number} The X coord of the top-left of the rectangle
 * @param y {Number} The Y coord of the top-left of the rectangle
 * @param width {Number} The width of the rectangle
 * @param height {Number} The height of the rectangle
 */
proto.drawRect = function drawRect(x, y, width, height)
{
    if (!this.currentPath.points.length) this.graphicsData.pop();

    this.currentPath = {lineWidth:this.lineWidth, lineColor:this.lineColor, lineAlpha:this.lineAlpha,
                        fillColor:this.fillColor, fillAlpha:this.fillAlpha, fill:this.filling,
                        points:[x, y, width, height], type: Graphics.RECT};

    this.graphicsData.push(this.currentPath);
    this.dirty = true;
};

/**
 * Draws a circle.
 *
 * @method drawCircle
 * @param x {Number} The X coord of the center of the circle
 * @param y {Number} The Y coord of the center of the circle
 * @param radius {Number} The radius of the circle
 */
proto.drawCircle = function drawCircle(x, y, radius)
{
    if (!this.currentPath.points.length) this.graphicsData.pop();

    this.currentPath = {lineWidth:this.lineWidth, lineColor:this.lineColor, lineAlpha:this.lineAlpha,
                        fillColor:this.fillColor, fillAlpha:this.fillAlpha, fill:this.filling,
                        points:[x, y, radius, radius], type: Graphics.CIRC};

    this.graphicsData.push(this.currentPath);
    this.dirty = true;
};

/**
 * Draws an elipse.
 *
 * @method drawElipse
 * @param x {Number}
 * @param y {Number}
 * @param width {Number}
 * @param height {Number}
 */
proto.drawElipse = function drawElipse(x, y, width, height)
{
    if (!this.currentPath.points.length) this.graphicsData.pop();

    this.currentPath = {lineWidth:this.lineWidth, lineColor:this.lineColor, lineAlpha:this.lineAlpha,
                        fillColor:this.fillColor, fillAlpha:this.fillAlpha, fill:this.filling,
                        points:[x, y, width, height], type: Graphics.ELIP};

    this.graphicsData.push(this.currentPath);
    this.dirty = true;
};

/**
 * Clears the graphics that were drawn to this Graphics object, and resets fill and line style settings.
 *
 * @method clear
 */
proto.clear = function clear()
{
    this.lineWidth = 0;
    this.filling = false;

    this.dirty = true;
    this.clearDirty = true;
    this.graphicsData = [];
};

// SOME TYPES:
Graphics.POLY = 0;
Graphics.RECT = 1;
Graphics.CIRC = 2;
Graphics.ELIP = 3;

module.exports = Graphics;

},{"../display/DisplayObjectContainer":4}],31:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var platform = require('../../platform');
var globals = require('../../core/globals');

var canvasGraphics = require('./graphics');
var Texture = require('../../textures/Texture');
var DisplayObject = require('../../display/DisplayObject');

var Sprite = require('../../display/Sprite');
var TilingSprite = require('../../extras/TilingSprite');
var Strip = require('../../extras/Strip');
var CustomRenderable = require('../../extras/CustomRenderable');
var Graphics = require('../../primitives/Graphics');
var FilterBlock = require('../../filters/FilterBlock');

/**
 * the CanvasRenderer draws the stage and all its content onto a 2d canvas. This renderer should be used for browsers that do not support webGL.
 * Dont forget to add the view to your DOM or you will not see anything :)
 *
 * @class CanvasRenderer
 * @constructor
 * @param width=0 {Number} the width of the canvas view
 * @param height=0 {Number} the height of the canvas view
 * @param view {Canvas} the canvas to use as a view, optional
 * @param transparent=false {Boolean} the transparency of the render view, default false
 */
function CanvasRenderer(width, height, view, transparent)
{
    this.transparent = transparent;

    /**
     * The width of the canvas view
     *
     * @property width
     * @type Number
     * @default 800
     */
    this.width = width || 800;

    /**
     * The height of the canvas view
     *
     * @property height
     * @type Number
     * @default 600
     */
    this.height = height || 600;

    /**
     * The canvas element that the everything is drawn to
     *
     * @property view
     * @type Canvas
     */
    this.view = view || platform.createCanvas();

    /**
     * The canvas context that the everything is drawn to
     * @property context
     * @type Canvas 2d Context
     */
    this.context = this.view.getContext("2d");

    this.refresh = true;
    // hack to enable some hardware acceleration!
    //this.view.style["transform"] = "translatez(0)";

    this.view.width = this.width;
    this.view.height = this.height;
    this.count = 0;
}

var proto = CanvasRenderer.prototype;

/**
 * Renders the stage to its canvas view
 *
 * @method render
 * @param stage {Stage} the Stage element to be rendered
 */
proto.render = function render(stage)
{

    //stage.__childrenAdded = [];
    //stage.__childrenRemoved = [];

    // update textures if need be
    globals.texturesToUpdate = [];
    globals.texturesToDestroy = [];

    globals.visibleCount++;
    stage.updateTransform();

    // update the background color
    if(this.view.style.backgroundColor!=stage.backgroundColorString && !this.transparent)this.view.style.backgroundColor = stage.backgroundColorString;

    this.context.setTransform(1,0,0,1,0,0);
    this.context.clearRect(0, 0, this.width, this.height)
    this.renderDisplayObject(stage);
    //as

    // run interaction!
    if(stage.interactive)
    {
        //need to add some events!
        if(!stage._interactiveEventsAdded)
        {
            stage._interactiveEventsAdded = true;
            stage.interactionManager.setTarget(this);
        }
    }

    // remove frame updates..
    if (Texture.frameUpdates.length > 0)
    {
        Texture.frameUpdates = [];
    }
};

/**
 * resizes the canvas view to the specified width and height
 *
 * @method resize
 * @param width {Number} the new width of the canvas view
 * @param height {Number} the new height of the canvas view
 */
proto.resize = function resize(width, height)
{
    this.width = width;
    this.height = height;

    this.view.width = width;
    this.view.height = height;
};

/**
 * Renders a display object
 *
 * @method renderDisplayObject
 * @param displayObject {DisplayObject} The displayObject to render
 * @private
 */
proto.renderDisplayObject = function renderDisplayObject(displayObject)
{
    // no loger recurrsive!
    var transform;
    var context = this.context;

    context.globalCompositeOperation = 'source-over';

    // one the display object hits this. we can break the loop
    var testObject = displayObject.last._iNext;
    displayObject = displayObject.first;

    do
    {
        transform = displayObject.worldTransform;

        if(!displayObject.visible)
        {
            displayObject = displayObject.last._iNext;
            continue;
        }

        if(!displayObject.renderable)
        {
            displayObject = displayObject._iNext;
            continue;
        }

        if(displayObject instanceof Sprite)
        {

            var frame = displayObject.texture.frame;

            if(frame && frame.width && frame.height)
            {
                context.globalAlpha = displayObject.worldAlpha;

                context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5]);

                context.drawImage(displayObject.texture.baseTexture.source,
                                   frame.x,
                                   frame.y,
                                   frame.width,
                                   frame.height,
                                   (displayObject.anchor.x) * -frame.width,
                                   (displayObject.anchor.y) * -frame.height,
                                   frame.width,
                                   frame.height);
            }
        }
        else if(displayObject instanceof Strip)
        {
            context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5])
            this.renderStrip(displayObject);
        }
        else if(displayObject instanceof TilingSprite)
        {
            context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5])
            this.renderTilingSprite(displayObject);
        }
        else if(displayObject instanceof CustomRenderable)
        {
            displayObject.renderCanvas(this);
        }
        else if(displayObject instanceof Graphics)
        {
            context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5])
            canvasGraphics.renderGraphics(displayObject, context);
        }
        else if(displayObject instanceof FilterBlock)
        {
            if(displayObject.open)
            {
                context.save();

                var cacheAlpha = displayObject.mask.alpha;
                var maskTransform = displayObject.mask.worldTransform;

                context.setTransform(maskTransform[0], maskTransform[3], maskTransform[1], maskTransform[4], maskTransform[2], maskTransform[5])

                displayObject.mask.worldAlpha = 0.5;

                context.worldAlpha = 0;

                canvasGraphics.renderGraphicsMask(displayObject.mask, context);
                context.clip();

                displayObject.mask.worldAlpha = cacheAlpha;
            }
            else
            {
                context.restore();
            }
        }
    //  count++
        displayObject = displayObject._iNext;


    }
    while(displayObject != testObject)
};

/**
 * Renders a flat strip
 *
 * @method renderStripFlat
 * @param strip {Strip} The Strip to render
 * @private
 */
proto.renderStripFlat = function renderStripFlat(strip)
{
    var context = this.context;
    var verticies = strip.verticies;
    var uvs = strip.uvs;

    var length = verticies.length/2;
    this.count++;

    context.beginPath();
    for (var i=1; i < length-2; i++)
    {

        // draw some triangles!
        var index = i*2;

         var x0 = verticies[index],   x1 = verticies[index+2], x2 = verticies[index+4];
         var y0 = verticies[index+1], y1 = verticies[index+3], y2 = verticies[index+5];

        context.moveTo(x0, y0);
        context.lineTo(x1, y1);
        context.lineTo(x2, y2);

    }

    context.fillStyle = "#FF0000";
    context.fill();
    context.closePath();
};

/**
 * Renders a tiling sprite
 *
 * @method renderTilingSprite
 * @param sprite {TilingSprite} The tilingsprite to render
 * @private
 */
proto.renderTilingSprite = function renderTilingSprite(sprite)
{
    var context = this.context;

    context.globalAlpha = sprite.worldAlpha;

    if(!sprite.__tilePattern) sprite.__tilePattern = context.createPattern(sprite.texture.baseTexture.source, "repeat");

    context.beginPath();

    var tilePosition = sprite.tilePosition;
    var tileScale = sprite.tileScale;

    // offset
    context.scale(tileScale.x,tileScale.y);
    context.translate(tilePosition.x, tilePosition.y);

    context.fillStyle = sprite.__tilePattern;
    context.fillRect(-tilePosition.x,-tilePosition.y,sprite.width / tileScale.x, sprite.height / tileScale.y);

    context.scale(1/tileScale.x, 1/tileScale.y);
    context.translate(-tilePosition.x, -tilePosition.y);

    context.closePath();
};

/**
 * Renders a strip
 *
 * @method renderStrip
 * @param strip {Strip} The Strip to render
 * @private
 */
proto.renderStrip = function renderStrip(strip)
{
    var context = this.context;

    // draw triangles!!
    var verticies = strip.verticies;
    var uvs = strip.uvs;

    var length = verticies.length/2;
    this.count++;
    for (var i=1; i < length-2; i++)
    {

        // draw some triangles!
        var index = i*2;

         var x0 = verticies[index],   x1 = verticies[index+2], x2 = verticies[index+4];
         var y0 = verticies[index+1], y1 = verticies[index+3], y2 = verticies[index+5];

         var u0 = uvs[index] * strip.texture.width,   u1 = uvs[index+2] * strip.texture.width, u2 = uvs[index+4]* strip.texture.width;
         var v0 = uvs[index+1]* strip.texture.height, v1 = uvs[index+3] * strip.texture.height, v2 = uvs[index+5]* strip.texture.height;


        context.save();
        context.beginPath();
        context.moveTo(x0, y0);
        context.lineTo(x1, y1);
        context.lineTo(x2, y2);
        context.closePath();

        context.clip();


        // Compute matrix transform
        var delta = u0*v1 + v0*u2 + u1*v2 - v1*u2 - v0*u1 - u0*v2;
        var delta_a = x0*v1 + v0*x2 + x1*v2 - v1*x2 - v0*x1 - x0*v2;
        var delta_b = u0*x1 + x0*u2 + u1*x2 - x1*u2 - x0*u1 - u0*x2;
        var delta_c = u0*v1*x2 + v0*x1*u2 + x0*u1*v2 - x0*v1*u2 - v0*u1*x2 - u0*x1*v2;
        var delta_d = y0*v1 + v0*y2 + y1*v2 - v1*y2 - v0*y1 - y0*v2;
        var delta_e = u0*y1 + y0*u2 + u1*y2 - y1*u2 - y0*u1 - u0*y2;
        var delta_f = u0*v1*y2 + v0*y1*u2 + y0*u1*v2 - y0*v1*u2 - v0*u1*y2 - u0*y1*v2;




        context.transform(delta_a/delta, delta_d/delta,
                      delta_b/delta, delta_e/delta,
                      delta_c/delta, delta_f/delta);

        context.drawImage(strip.texture.baseTexture.source, 0, 0);
        context.restore();
    }
};

module.exports = CanvasRenderer;

},{"../../core/globals":2,"../../display/DisplayObject":3,"../../display/Sprite":6,"../../extras/CustomRenderable":10,"../../extras/Strip":13,"../../extras/TilingSprite":14,"../../filters/FilterBlock":15,"../../platform":29,"../../primitives/Graphics":30,"../../textures/Texture":42,"./graphics":32}],32:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var platform = require('../../platform');
var Graphics = require('../../primitives/Graphics');

/**
 * A set of functions used by the canvas renderer to draw the primitive graphics data
 *
 * @module renderers/canvas/graphics
 */

/*
 * Renders the graphics object
 *
 * @static
 * @private
 * @method renderGraphics
 * @param graphics {Graphics}
 * @param context {Context2D}
 */
exports.renderGraphics = function renderGraphics(graphics, context)
{
    var worldAlpha = graphics.worldAlpha,
        data, points, color, ii, ll;

    for (var i = 0, l = graphics.graphicsData.length; i < l; i++)
    {
        data = graphics.graphicsData[i];
        points = data.points;

        color = context.strokeStyle = '#' + ('00000' + ( data.lineColor | 0).toString(16)).substr(-6);

        context.lineWidth = data.lineWidth;

        if(data.type == Graphics.POLY)
        {
            context.beginPath();

            context.moveTo(points[0], points[1]);

            for (ii = 1, ll = points.length / 2; ii < ll; ii++)
            {
                context.lineTo(points[ii * 2], points[ii * 2 + 1]);
            }

            // if the first and last point are the same close the path - much neater :)
            if(points[0] == points[points.length-2] && points[1] == points[points.length-1])
            {
                context.closePath();
            }

            if(data.fill)
            {
                context.globalAlpha = data.fillAlpha * worldAlpha;
                context.fillStyle = color = '#' + ('00000' + ( data.fillColor | 0).toString(16)).substr(-6);
                context.fill();
            }
            if(data.lineWidth)
            {
                context.globalAlpha = data.lineAlpha * worldAlpha;
                context.stroke();
            }
        }
        else if(data.type == Graphics.RECT)
        {

            if(data.fillColor || data.fillColor === 0)
            {
                context.globalAlpha = data.fillAlpha * worldAlpha;
                context.fillStyle = color = '#' + ('00000' + ( data.fillColor | 0).toString(16)).substr(-6);
                context.fillRect(points[0], points[1], points[2], points[3]);

            }
            if(data.lineWidth)
            {
                context.globalAlpha = data.lineAlpha * worldAlpha;
                context.strokeRect(points[0], points[1], points[2], points[3]);
            }

        }
        else if(data.type == Graphics.CIRC)
        {
            // TODO - need to be Undefined!
            context.beginPath();
            context.arc(points[0], points[1], points[2],0,2*Math.PI);
            context.closePath();

            if(data.fill)
            {
                context.globalAlpha = data.fillAlpha * worldAlpha;
                context.fillStyle = color = '#' + ('00000' + ( data.fillColor | 0).toString(16)).substr(-6);
                context.fill();
            }
            if(data.lineWidth)
            {
                context.globalAlpha = data.lineAlpha * worldAlpha;
                context.stroke();
            }
        }
        else if(data.type == Graphics.ELIP)
        {

            // elipse code taken from: http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas

            var elipseData =  data.points;

            var w = elipseData[2] * 2;
            var h = elipseData[3] * 2;

            var x = elipseData[0] - w/2;
            var y = elipseData[1] - h/2;

            context.beginPath();

            var kappa = 0.5522848,
            ox = (w / 2) * kappa, // control point offset horizontal
            oy = (h / 2) * kappa, // control point offset vertical
            xe = x + w,           // x-end
            ye = y + h,           // y-end
            xm = x + w / 2,       // x-middle
            ym = y + h / 2;       // y-middle

            context.moveTo(x, ym);
            context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
            context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
            context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
            context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);

            context.closePath();

            if(data.fill)
            {
                context.globalAlpha = data.fillAlpha * worldAlpha;
                context.fillStyle = color = '#' + ('00000' + ( data.fillColor | 0).toString(16)).substr(-6);
                context.fill();
            }
            if(data.lineWidth)
            {
                context.globalAlpha = data.lineAlpha * worldAlpha;
                context.stroke();
            }
        }
    }
};

/*
 * Renders a graphics mask
 *
 * @static
 * @private
 * @method renderGraphicsMask
 * @param graphics {Graphics}
 * @param context {Context2D}
 */
exports.renderGraphicsMask = function renderGraphicsMask(graphics, context)
{
    var worldAlpha = graphics.worldAlpha;

    var len = graphics.graphicsData.length;
    if(len > 1)
    {
        len = 1;
        platform.console.warn("Pixi.js warning: masks in canvas can only mask using the first path in the graphics object")
    }

    for (var i=0; i < 1; i++)
    {
        var data = graphics.graphicsData[i];
        var points = data.points;

        if(data.type == Graphics.POLY)
        {
            context.beginPath();
            context.moveTo(points[0], points[1]);

            for (var j=1; j < points.length/2; j++)
            {
                context.lineTo(points[j * 2], points[j * 2 + 1]);
            }

            // if the first and last point are the same close the path - much neater :)
            if(points[0] == points[points.length-2] && points[1] == points[points.length-1])
            {
                context.closePath();
            }

        }
        else if(data.type == Graphics.RECT)
        {
            context.beginPath();
            context.rect(points[0], points[1], points[2], points[3]);
            context.closePath();
        }
        else if(data.type == Graphics.CIRC)
        {
            // TODO - need to be Undefined!
            context.beginPath();
            context.arc(points[0], points[1], points[2],0,2*Math.PI);
            context.closePath();
        }
        else if(data.type == Graphics.ELIP)
        {

            // elipse code taken from: http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas
            var elipseData =  data.points;

            var w = elipseData[2] * 2;
            var h = elipseData[3] * 2;

            var x = elipseData[0] - w/2;
            var y = elipseData[1] - h/2;

            context.beginPath();

            var kappa = 0.5522848,
            ox = (w / 2) * kappa, // control point offset horizontal
            oy = (h / 2) * kappa, // control point offset vertical
            xe = x + w,           // x-end
            ye = y + h,           // y-end
            xm = x + w / 2,       // x-middle
            ym = y + h / 2;       // y-middle

            context.moveTo(x, ym);
            context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
            context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
            context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
            context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
            context.closePath();
        }

    }
};

},{"../../platform":29,"../../primitives/Graphics":30}],33:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../../core/globals');
var blendModes = require('../../display/blendModes');

/**
 * A WebGLBatch Enables a group of sprites to be drawn using the same settings.
 * if a group of sprites all have the same baseTexture and blendMode then they can be grouped into a batch.
 * All the sprites in a batch can then be drawn in one go by the GPU which is hugely efficient. ALL sprites
 * in the webGL renderer are added to a batch even if the batch only contains one sprite. Batching is handled
 * automatically by the webGL renderer. A good tip is: the smaller the number of batchs there are, the faster
 * the webGL renderer will run.
 *
 * @class WebGLBatch
 * @constructor
 * @param gl {WebGLContext} an instance of the webGL context
 */
function WebGLBatch(gl)
{
    this.gl = gl;

    this.size = 0;

    this.vertexBuffer =  gl.createBuffer();
    this.indexBuffer =  gl.createBuffer();
    this.uvBuffer =  gl.createBuffer();
    this.colorBuffer =  gl.createBuffer();
    this.blendMode = blendModes.NORMAL;
    this.dynamicSize = 1;
}

var proto = WebGLBatch.prototype;

/**
 * Cleans the batch so that is can be returned to an object pool and reused
 *
 * @method clean
 */
proto.clean = function clean()
{
    this.verticies = [];
    this.uvs = [];
    this.indices = [];
    this.colors = [];
    this.dynamicSize = 1;
    this.texture = null;
    this.size = 0;
    this.head = null;
    this.tail = null;
};

/**
 * Recreates the buffers in the event of a context loss
 *
 * @method restoreLostContext
 * @param gl {WebGLContext}
 */
proto.restoreLostContext = function restoreLostContext(gl)
{
    this.gl = gl;
    this.vertexBuffer =  gl.createBuffer();
    this.indexBuffer =  gl.createBuffer();
    this.uvBuffer =  gl.createBuffer();
    this.colorBuffer =  gl.createBuffer();
};

/**
 * inits the batch's texture and blend mode based if the supplied sprite
 *
 * @method init
 * @param sprite {Sprite} the first sprite to be added to the batch. Only sprites with
 *      the same base texture and blend mode will be allowed to be added to this batch
 */
proto.init = function init(sprite)
{
    sprite.batch = this;
    this.dirty = true;
    this.blendMode = sprite.blendMode;
    this.texture = sprite.texture.baseTexture;
    this.head = sprite;
    this.tail = sprite;
    this.size = 1;

    this.growBatch();
};

/**
 * inserts a sprite before the specified sprite
 *
 * @method insertBefore
 * @param sprite {Sprite} the sprite to be added
 * @param nextSprite {nextSprite} the first sprite will be inserted before this sprite
 */
proto.insertBefore = function insertBefore(sprite, nextSprite)
{
    this.size++;

    sprite.batch = this;
    this.dirty = true;
    var tempPrev = nextSprite.__prev;
    nextSprite.__prev = sprite;
    sprite.__next = nextSprite;

    if(tempPrev)
    {
        sprite.__prev = tempPrev;
        tempPrev.__next = sprite;
    }
    else
    {
        this.head = sprite;
    }
};

/**
 * inserts a sprite after the specified sprite
 *
 * @method insertAfter
 * @param sprite {Sprite} the sprite to be added
 * @param  previousSprite {Sprite} the first sprite will be inserted after this sprite
 */
proto.insertAfter = function insertAfter(sprite, previousSprite)
{
    this.size++;

    sprite.batch = this;
    this.dirty = true;

    var tempNext = previousSprite.__next;
    previousSprite.__next = sprite;
    sprite.__prev = previousSprite;

    if(tempNext)
    {
        sprite.__next = tempNext;
        tempNext.__prev = sprite;
    }
    else
    {
        this.tail = sprite
    }
};

/**
 * removes a sprite from the batch
 *
 * @method remove
 * @param sprite {Sprite} the sprite to be removed
 */
proto.remove = function remove(sprite)
{
    this.size--;

    if (!this.size)
    {
        sprite.batch = null;
        sprite.__prev = null;
        sprite.__next = null;
        return;
    }

    if(sprite.__prev)
    {
        sprite.__prev.__next = sprite.__next;
    }
    else
    {
        this.head = sprite.__next;
        this.head.__prev = null;
    }

    if(sprite.__next)
    {
        sprite.__next.__prev = sprite.__prev;
    }
    else
    {
        this.tail = sprite.__prev;
        this.tail.__next = null
    }

    sprite.batch = null;
    sprite.__next = null;
    sprite.__prev = null;
    this.dirty = true;
};

/**
 * Splits the batch into two with the specified sprite being the start of the new batch.
 *
 * @method split
 * @param sprite {Sprite} the sprite that indicates where the batch should be split
 * @return {WebGLBatch} the new batch
 */
proto.split = function split(sprite)
{
    this.dirty = true;

    var batch = new WebGLBatch(this.gl);
    batch.init(sprite);
    batch.texture = this.texture;
    batch.tail = this.tail;

    this.tail = sprite.__prev;
    this.tail.__next = null;

    sprite.__prev = null;
    // return a splite batch!

    // TODO this size is wrong!
    // need to recalculate :/ problem with a linked list!
    // unless it gets calculated in the "clean"?

    // need to loop through items as there is no way to know the length on a linked list :/
    var tempSize = 0;
    while(sprite)
    {
        tempSize++;
        sprite.batch = batch;
        sprite = sprite.__next;
    }

    batch.size = tempSize;
    this.size -= tempSize;

    return batch;
};

/**
 * Merges two batchs together
 *
 * @method merge
 * @param batch {WebGLBatch} the batch that will be merged
 */
proto.merge = function merge(batch)
{
    this.dirty = true;

    this.tail.__next = batch.head;
    batch.head.__prev = this.tail;

    this.size += batch.size;

    this.tail = batch.tail;

    var sprite = batch.head;
    while(sprite)
    {
        sprite.batch = this;
        sprite = sprite.__next;
    }
};

/**
 * Grows the size of the batch. As the elements in the batch cannot have a dynamic size this
 * function is used to increase the size of the batch. It also creates a little extra room so
 * that the batch does not need to be resized every time a sprite is added
 *
 * @method growBatch
 */
proto.growBatch = function growBatch()
{
    var gl = this.gl;
    if( this.size == 1)
    {
        this.dynamicSize = 1;
    }
    else
    {
        this.dynamicSize = this.size * 1.5
    }
    // grow verts
    this.verticies = new Float32Array(this.dynamicSize * 8);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,this.verticies , gl.DYNAMIC_DRAW);

    this.uvs  = new Float32Array( this.dynamicSize * 8 );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.uvs , gl.DYNAMIC_DRAW);

    this.dirtyUVS = true;

    this.colors  = new Float32Array( this.dynamicSize * 4 );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.colors , gl.DYNAMIC_DRAW);

    this.dirtyColors = true;

    this.indices = new Uint16Array(this.dynamicSize * 6);

    for (var i = 0, l = this.indices.length/6; i < l; i++)
    {
        var index2 = i * 6;
        var index3 = i * 4;
        this.indices[index2 + 0] = index3 + 0;
        this.indices[index2 + 1] = index3 + 1;
        this.indices[index2 + 2] = index3 + 2;
        this.indices[index2 + 3] = index3 + 0;
        this.indices[index2 + 4] = index3 + 2;
        this.indices[index2 + 5] = index3 + 3;
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
};

/**
 * Refresh's all the data in the batch and sync's it with the webGL buffers
 *
 * @method refresh
 */
proto.refresh = function refresh()
{
    var gl = this.gl;

    if (this.dynamicSize < this.size)
    {
        this.growBatch();
    }

    var indexRun = 0;
    var worldTransform, width, height, aX, aY, w0, w1, h0, h1, index;
    var a, b, c, d, tx, ty, colorIndex;

    var displayObject = this.head;

    while(displayObject)
    {
        index = indexRun * 8;

        var texture = displayObject.texture;

        var frame = texture.frame;
        var tw = texture.baseTexture.width;
        var th = texture.baseTexture.height;

        this.uvs[index + 0] = frame.x / tw;
        this.uvs[index +1] = frame.y / th;

        this.uvs[index +2] = (frame.x + frame.width) / tw;
        this.uvs[index +3] = frame.y / th;

        this.uvs[index +4] = (frame.x + frame.width) / tw;
        this.uvs[index +5] = (frame.y + frame.height) / th;

        this.uvs[index +6] = frame.x / tw;
        this.uvs[index +7] = (frame.y + frame.height) / th;

        displayObject.updateFrame = false;

        colorIndex = indexRun * 4;
        this.colors[colorIndex] = this.colors[colorIndex + 1] = this.colors[colorIndex + 2] = this.colors[colorIndex + 3] = displayObject.worldAlpha;

        displayObject = displayObject.__next;

        indexRun ++;
    }

    this.dirtyUVS = true;
    this.dirtyColors = true;
};

/**
 * Updates all the relevant geometry and uploads the data to the GPU
 *
 * @method update
 */
proto.update = function update()
{
    var gl = this.gl;
    var worldTransform, width, height, aX, aY, w0, w1, h0, h1, index, index2, index3

    var a, b, c, d, tx, ty;

    var indexRun = 0;

    var displayObject = this.head;

    while(displayObject)
    {
        if(displayObject.vcount === globals.visibleCount)
        {
            width = displayObject.texture.frame.width;
            height = displayObject.texture.frame.height;

            // TODO trim??
            aX = displayObject.anchor.x;// - displayObject.texture.trim.x
            aY = displayObject.anchor.y; //- displayObject.texture.trim.y
            w0 = width * (1-aX);
            w1 = width * -aX;

            h0 = height * (1-aY);
            h1 = height * -aY;

            index = indexRun * 8;

            worldTransform = displayObject.worldTransform;

            a = worldTransform[0];
            b = worldTransform[3];
            c = worldTransform[1];
            d = worldTransform[4];
            tx = worldTransform[2];
            ty = worldTransform[5];

            this.verticies[index + 0 ] = a * w1 + c * h1 + tx;
            this.verticies[index + 1 ] = d * h1 + b * w1 + ty;

            this.verticies[index + 2 ] = a * w0 + c * h1 + tx;
            this.verticies[index + 3 ] = d * h1 + b * w0 + ty;

            this.verticies[index + 4 ] = a * w0 + c * h0 + tx;
            this.verticies[index + 5 ] = d * h0 + b * w0 + ty;

            this.verticies[index + 6] =  a * w1 + c * h0 + tx;
            this.verticies[index + 7] =  d * h0 + b * w1 + ty;

            if(displayObject.updateFrame || displayObject.texture.updateFrame)
            {
                this.dirtyUVS = true;

                var texture = displayObject.texture;

                var frame = texture.frame;
                var tw = texture.baseTexture.width;
                var th = texture.baseTexture.height;

                this.uvs[index + 0] = frame.x / tw;
                this.uvs[index +1] = frame.y / th;

                this.uvs[index +2] = (frame.x + frame.width) / tw;
                this.uvs[index +3] = frame.y / th;

                this.uvs[index +4] = (frame.x + frame.width) / tw;
                this.uvs[index +5] = (frame.y + frame.height) / th;

                this.uvs[index +6] = frame.x / tw;
                this.uvs[index +7] = (frame.y + frame.height) / th;

                displayObject.updateFrame = false;
            }

            // TODO this probably could do with some optimisation....
            if(displayObject.cacheAlpha != displayObject.worldAlpha)
            {
                displayObject.cacheAlpha = displayObject.worldAlpha;

                var colorIndex = indexRun * 4;
                this.colors[colorIndex] = this.colors[colorIndex + 1] = this.colors[colorIndex + 2] = this.colors[colorIndex + 3] = displayObject.worldAlpha;
                this.dirtyColors = true;
            }
        }
        else
        {
            index = indexRun * 8;

            this.verticies[index + 0 ] = 0;
            this.verticies[index + 1 ] = 0;

            this.verticies[index + 2 ] = 0;
            this.verticies[index + 3 ] = 0;

            this.verticies[index + 4 ] = 0;
            this.verticies[index + 5 ] = 0;

            this.verticies[index + 6] = 0;
            this.verticies[index + 7] = 0;
        }

        indexRun++;
        displayObject = displayObject.__next;
   }
};

/**
 * Draws the batch to the frame buffer
 *
 * @method render
 */
proto.render = function render(start, end)
{
    start = start || 0;

    if (arguments.length < 2) end = this.size;

    if(this.dirty)
    {
        this.refresh();
        this.dirty = false;
    }

    if (!this.size) return;

    this.update();
    var gl = this.gl;

    //TODO optimize this!

    var shaderProgram = globals.shaderProgram;
    gl.useProgram(shaderProgram);

    // update the verts..
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    // ok..
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verticies)
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    // update the uvs
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);

    if(this.dirtyUVS)
    {
        this.dirtyUVS = false;
        gl.bufferSubData(gl.ARRAY_BUFFER,  0, this.uvs);
    }

    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture._glTexture);

    // update color!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);

    if(this.dirtyColors)
    {
        this.dirtyColors = false;
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colors);
    }

    gl.vertexAttribPointer(shaderProgram.colorAttribute, 1, gl.FLOAT, false, 0, 0);

    // dont need to upload!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    var len = end - start;

    // DRAW THAT this!
    gl.drawElements(gl.TRIANGLES, len * 6, gl.UNSIGNED_SHORT, start * 2 * 6 );
};

/**
 * Internal WebGLBatch pool
 *
 * @private
 */
var batches = [];

/**
 * Call when restoring a lost context
 *
 * @static
 * @method restoreBatches
 * @return void
 */
WebGLBatch.restoreBatches = function restoreBatches(gl)
{
    for (var i = 0, l = batches.length; i < l; i++)
    {
        batches[i].restoreLostContext(gl);
    }
};

/**
 * Gets a new WebGLBatch from the pool
 *
 * @static
 * @method getBatch
 * @return {WebGLBatch}
 */
WebGLBatch.getBatch = function getBatch()
{
    if (!batches.length) {
        return new WebGLBatch(globals.gl);
    } else {
        return batches.pop();
    }
};

/**
 * Puts a batch back into the pool
 *
 * @static
 * @method returnBatch
 * @param batch {WebGLBatch} The batch to return
 */
WebGLBatch.returnBatch = function returnBatch(batch)
{
    batch.clean();
    batches.push(batch);
};

module.exports = WebGLBatch;

},{"../../core/globals":2,"../../display/blendModes":8}],34:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../../core/globals');
var webglGraphics = require('./graphics');
var WebGLBatch = require('./WebGLBatch');
var mat3 = require('../../geom/matrix').mat3;

var TilingSprite = require('../../extras/TilingSprite');
var Strip = require('../../extras/Strip');
var Graphics = require('../../primitives/Graphics');
var FilterBlock = require('../../filters/FilterBlock');
var Sprite = require('../../display/Sprite');
var CustomRenderable = require('../../extras/CustomRenderable');

/**
 * A WebGLBatch Enables a group of sprites to be drawn using the same settings.
 * if a group of sprites all have the same baseTexture and blendMode then they can be
 * grouped into a batch. All the sprites in a batch can then be drawn in one go by the
 * GPU which is hugely efficient. ALL sprites in the webGL renderer are added to a batch
 * even if the batch only contains one sprite. Batching is handled automatically by the
 * webGL renderer. A good tip is: the smaller the number of batchs there are, the faster
 * the webGL renderer will run.
 *
 * @class WebGLBatch
 * @contructor
 * @param gl {WebGLContext} An instance of the webGL context
 */
function WebGLRenderGroup(gl)
{
    this.gl = gl;
    this.root = null;
    // this.backgroundColor = null;
    this.batchs = [];
    this.toRemove = [];
}

var proto = WebGLRenderGroup.prototype;

/**
 * Add a display object to the webgl renderer
 *
 * @method setRenderable
 * @param displayObject {DisplayObject}
 * @private
 */
proto.setRenderable = function setRenderable(displayObject)
{
    // has this changed??
    if(this.root)this.removeDisplayObjectAndChildren(this.root);

    displayObject.worldVisible = displayObject.visible;

    // soooooo //
    // to check if any batchs exist already??

    // TODO what if its already has an object? should remove it
    this.root = displayObject;
    this.addDisplayObjectAndChildren(displayObject);
};

/**
 * Renders the stage to its webgl view
 *
 * @method render
 * @param projection {Object}
 */
proto.render = function render(projection)
{
    var gl = this.gl;

    WebGLRenderGroup.updateTextures(gl);

    gl.uniform2f(globals.shaderProgram.projectionVector, projection.x, projection.y);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // will render all the elements in the group
    var renderable;

    for (var i=0; i < this.batchs.length; i++)
    {

        renderable = this.batchs[i];
        if(renderable instanceof WebGLBatch)
        {
            this.batchs[i].render();
            continue;
        }

        // non sprite batch..
        var worldVisible = renderable.vcount === globals.visibleCount;

        if(renderable instanceof TilingSprite)
        {
            if(worldVisible)this.renderTilingSprite(renderable, projection);
        }
        else if(renderable instanceof Strip)
        {
            if(worldVisible)this.renderStrip(renderable, projection);
        }
        else if(renderable instanceof Graphics)
        {
            if(worldVisible && renderable.renderable) webglGraphics.renderGraphics(renderable, projection);//, projectionMatrix);
        }
        else if(renderable instanceof FilterBlock)
        {
            /*
             * for now only masks are supported..
             */
            if(renderable.open)
            {
                gl.enable(gl.STENCIL_TEST);

                gl.colorMask(false, false, false, false);
                gl.stencilFunc(gl.ALWAYS,1,0xff);
                gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);

                webglGraphics.renderGraphics(renderable.mask, projection);

                gl.colorMask(true, true, true, true);
                gl.stencilFunc(gl.NOTEQUAL,0,0xff);
                gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
            }
            else
            {
                gl.disable(gl.STENCIL_TEST);
            }
        }
    }
};

/**
 * Renders the stage to its webgl view
 *
 * @method handleFilter
 * @param filter {FilterBlock}
 * @private
 */
proto.handleFilter = function handleFilter(filter, projection)
{

};

/**
 * Renders a specific displayObject
 *
 * @method renderSpecific
 * @param displayObject {DisplayObject}
 * @param projection {Object}
 * @private
 */
proto.renderSpecific = function renderSpecific(displayObject, projection)
{
    var gl = this.gl;

    WebGLRenderGroup.updateTextures(gl);

    gl.uniform2f(globals.shaderProgram.projectionVector, projection.x, projection.y);

    // to do!
    // render part of the scene...

    var startIndex, startBatchIndex,
        endIndex, endBatchIndex,
        head, next;

    /*
     *  LOOK FOR THE NEXT SPRITE
     *  This part looks for the closest next sprite that can go into a batch
     *  it keeps looking until it finds a sprite or gets to the end of the display
     *  scene graph
     */
    var nextRenderable = displayObject.first;
    while(nextRenderable._iNext)
    {
        nextRenderable = nextRenderable._iNext;
        if(nextRenderable.renderable && nextRenderable.__renderGroup)break;
    }
    var startBatch = nextRenderable.batch;

    if(nextRenderable instanceof Sprite)
    {
        startBatch = nextRenderable.batch;

        head = startBatch.head;
        next = head;

        // ok now we have the batch.. need to find the start index!
        if(head == nextRenderable)
        {
            startIndex = 0;
        }
        else
        {
            startIndex = 1;

            while(head.__next != nextRenderable)
            {
                startIndex++;
                head = head.__next;
            }
        }
    }
    else
    {
        startBatch = nextRenderable;
    }

    // Get the LAST renderable object
    var lastRenderable = displayObject;
    var endBatch;
    var lastItem = displayObject;
    while(lastItem.children.length > 0)
    {
        lastItem = lastItem.children[lastItem.children.length-1];
        if(lastItem.renderable)lastRenderable = lastItem;
    }

    if(lastRenderable instanceof Sprite)
    {
        endBatch = lastRenderable.batch;

        head = endBatch.head;

        if(head == lastRenderable)
        {
            endIndex = 0;
        }
        else
        {
            endIndex = 1;

            while(head.__next != lastRenderable)
            {
                endIndex++;
                head = head.__next;
            }
        }
    }
    else
    {
        endBatch = lastRenderable;
    }

    // TODO - need to fold this up a bit!

    if(startBatch == endBatch)
    {
        if(startBatch instanceof WebGLBatch)
        {
            startBatch.render(startIndex, endIndex+1);
        }
        else
        {
            this.renderSpecial(startBatch, projection);
        }
        return;
    }

    // now we have first and last!
    startBatchIndex = this.batchs.indexOf(startBatch);
    endBatchIndex = this.batchs.indexOf(endBatch);

    // DO the first batch
    if(startBatch instanceof WebGLBatch)
    {
        startBatch.render(startIndex);
    }
    else
    {
        this.renderSpecial(startBatch, projection);
    }

    // DO the middle batchs..
    var renderable;
    for (var i=startBatchIndex+1; i < endBatchIndex; i++)
    {
        renderable = this.batchs[i];

        if(renderable instanceof WebGLBatch)
        {
            this.batchs[i].render();
        }
        else
        {
            this.renderSpecial(renderable, projection);
        }
    }

    // DO the last batch..
    if(endBatch instanceof WebGLBatch)
    {
        endBatch.render(0, endIndex+1);
    }
    else
    {
        this.renderSpecial(endBatch, projection);
    }
};

/**
 * Renders a specific renderable
 *
 * @method renderSpecial
 * @param renderable {DisplayObject}
 * @param projection {Object}
 * @private
 */
proto.renderSpecial = function renderSpecial(renderable, projection)
{
    var worldVisible = renderable.vcount === globals.visibleCount;

    if(renderable instanceof TilingSprite)
    {
        if(worldVisible)this.renderTilingSprite(renderable, projection);
    }
    else if(renderable instanceof Strip)
    {
        if(worldVisible)this.renderStrip(renderable, projection);
    }
    else if(renderable instanceof CustomRenderable)
    {
        if(worldVisible) renderable.renderWebGL(this, projection);
    }
    else if(renderable instanceof Graphics)
    {
        if(worldVisible && renderable.renderable) webglGraphics.renderGraphics(renderable, projection);
    }
    else if(renderable instanceof FilterBlock)
    {
        /*
         * for now only masks are supported..
         */
        var gl = this.gl;

        if(renderable.open)
        {
            gl.enable(gl.STENCIL_TEST);

            gl.colorMask(false, false, false, false);
            gl.stencilFunc(gl.ALWAYS,1,0xff);
            gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);

            webglGraphics.renderGraphics(renderable.mask, projection);

            // we know this is a render texture so enable alpha too..
            gl.colorMask(true, true, true, true);
            gl.stencilFunc(gl.NOTEQUAL,0,0xff);
            gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
        }
        else
        {
            gl.disable(gl.STENCIL_TEST);
        }
    }
};

/**
 * Updates a webgl texture
 *
 * @method updateTexture
 * @param displayObject {DisplayObject}
 * @private
 */
proto.updateTexture = function updateTexture(displayObject)
{

    // TODO definitely can optimse this function..

    this.removeObject(displayObject);

    /*
     *  LOOK FOR THE PREVIOUS RENDERABLE
     *  This part looks for the closest previous sprite that can go into a batch
     *  It keeps going back until it finds a sprite or the stage
     */
    var previousRenderable = displayObject.first;
    while(previousRenderable != this.root)
    {
        previousRenderable = previousRenderable._iPrev;
        if(previousRenderable.renderable && previousRenderable.__renderGroup)break;
    }

    /*
     *  LOOK FOR THE NEXT SPRITE
     *  This part looks for the closest next sprite that can go into a batch
     *  it keeps looking until it finds a sprite or gets to the end of the display
     *  scene graph
     */
    var nextRenderable = displayObject.last;
    while(nextRenderable._iNext)
    {
        nextRenderable = nextRenderable._iNext;
        if(nextRenderable.renderable && nextRenderable.__renderGroup)break;
    }

    this.insertObject(displayObject, previousRenderable, nextRenderable);
};

/**
 * Adds filter blocks
 *
 * @method addFilterBlocks
 * @param start {FilterBlock}
 * @param end {FilterBlock}
 * @private
 */
proto.addFilterBlocks = function addFilterBlocks(start, end)
{
    start.__renderGroup = this;
    end.__renderGroup = this;
    /*
     *  LOOK FOR THE PREVIOUS RENDERABLE
     *  This part looks for the closest previous sprite that can go into a batch
     *  It keeps going back until it finds a sprite or the stage
     */
    var previousRenderable = start;
    while(previousRenderable != this.root)
    {
        previousRenderable = previousRenderable._iPrev;
        if(previousRenderable.renderable && previousRenderable.__renderGroup)break;
    }
    this.insertAfter(start, previousRenderable);

    /*
     *  LOOK FOR THE NEXT SPRITE
     *  This part looks for the closest next sprite that can go into a batch
     *  it keeps looking until it finds a sprite or gets to the end of the display
     *  scene graph
     */
    var previousRenderable2 = end;
    while(previousRenderable2 != this.root)
    {
        previousRenderable2 = previousRenderable2._iPrev;
        if(previousRenderable2.renderable && previousRenderable2.__renderGroup)break;
    }
    this.insertAfter(end, previousRenderable2);
};

/**
 * Remove filter blocks
 *
 * @method removeFilterBlocks
 * @param start {FilterBlock}
 * @param end {FilterBlock}
 * @private
 */
proto.removeFilterBlocks = function removeFilterBlocks(start, end)
{
    this.removeObject(start);
    this.removeObject(end);
};

/**
 * Adds a display object and children to the webgl context
 *
 * @method addDisplayObjectAndChildren
 * @param displayObject {DisplayObject}
 * @private
 */
proto.addDisplayObjectAndChildren = function addDisplayObjectAndChildren(displayObject)
{
    if(displayObject.__renderGroup)displayObject.__renderGroup.removeDisplayObjectAndChildren(displayObject);

    /*
     *  LOOK FOR THE PREVIOUS RENDERABLE
     *  This part looks for the closest previous sprite that can go into a batch
     *  It keeps going back until it finds a sprite or the stage
     */

    var previousRenderable = displayObject.first;
    while(previousRenderable != this.root.first)
    {
        previousRenderable = previousRenderable._iPrev;
        if(previousRenderable.renderable && previousRenderable.__renderGroup)break;
    }

    /*
     *  LOOK FOR THE NEXT SPRITE
     *  This part looks for the closest next sprite that can go into a batch
     *  it keeps looking until it finds a sprite or gets to the end of the display
     *  scene graph
     */
    var nextRenderable = displayObject.last;
    while(nextRenderable._iNext)
    {
        nextRenderable = nextRenderable._iNext;
        if(nextRenderable.renderable && nextRenderable.__renderGroup)break;
    }

    // one the display object hits this. we can break the loop

    var tempObject = displayObject.first;
    var testObject = displayObject.last._iNext;
    do
    {
        tempObject.__renderGroup = this;

        if(tempObject.renderable)
        {

            this.insertObject(tempObject, previousRenderable, nextRenderable);
            previousRenderable = tempObject;
        }

        tempObject = tempObject._iNext;
    }
    while(tempObject != testObject)
};

/**
 * Removes a display object and children to the webgl context
 *
 * @method removeDisplayObjectAndChildren
 * @param displayObject {DisplayObject}
 * @private
 */
proto.removeDisplayObjectAndChildren = function removeDisplayObjectAndChildren(displayObject)
{
    if(displayObject.__renderGroup != this)return;

//  var displayObject = displayObject.first;
    var lastObject = displayObject.last;
    do
    {
        displayObject.__renderGroup = null;
        if(displayObject.renderable)this.removeObject(displayObject);
        displayObject = displayObject._iNext;
    }
    while(displayObject)
};

/**
 * Inserts a displayObject into the linked list
 *
 * @method insertObject
 * @param displayObject {DisplayObject}
 * @param previousObject {DisplayObject}
 * @param nextObject {DisplayObject}
 * @private
 */
proto.insertObject = function insertObject(displayObject, previousObject, nextObject)
{
    // while looping below THE OBJECT MAY NOT HAVE BEEN ADDED
    var previousSprite = previousObject,
        nextSprite = nextObject,
        batch, index;

    /*
     * so now we have the next renderable and the previous renderable
     *
     */
    if(displayObject instanceof Sprite)
    {
        var previousBatch, nextBatch;

        if(previousSprite instanceof Sprite)
        {
            previousBatch = previousSprite.batch;
            if(previousBatch)
            {
                if(previousBatch.texture == displayObject.texture.baseTexture && previousBatch.blendMode == displayObject.blendMode)
                {
                    previousBatch.insertAfter(displayObject, previousSprite);
                    return;
                }
            }
        }
        else
        {
            // TODO reword!
            previousBatch = previousSprite;
        }

        if(nextSprite)
        {
            if(nextSprite instanceof Sprite)
            {
                nextBatch = nextSprite.batch;

                //batch may not exist if item was added to the display list but not to the webGL
                if(nextBatch)
                {
                    if(nextBatch.texture == displayObject.texture.baseTexture && nextBatch.blendMode == displayObject.blendMode)
                    {
                        nextBatch.insertBefore(displayObject, nextSprite);
                        return;
                    }
                    else
                    {
                        if(nextBatch == previousBatch)
                        {
                            // THERE IS A SPLIT IN THIS BATCH! //
                            var splitBatch = previousBatch.split(nextSprite);
                            // COOL!
                            // add it back into the array
                            /*
                             * OOPS!
                             * seems the new sprite is in the middle of a batch
                             * lets split it..
                             */
                            batch = WebGLBatch.getBatch();

                            index = this.batchs.indexOf( previousBatch );
                            batch.init(displayObject);
                            this.batchs.splice(index + 1, 0, batch, splitBatch);

                            return;
                        }
                    }
                }
            }
            else
            {
                // TODO re-word!

                nextBatch = nextSprite;
            }
        }

        /*
         * looks like it does not belong to any batch!
         * but is also not intersecting one..
         * time to create anew one!
         */

        batch = WebGLBatch.getBatch();
        batch.init(displayObject);

        if(previousBatch) // if this is invalid it means
        {
            index = this.batchs.indexOf( previousBatch );
            this.batchs.splice(index + 1, 0, batch);
        }
        else
        {
            this.batchs.push(batch);
        }

        return;
    }
    else if(displayObject instanceof TilingSprite)
    {

        // add to a batch!!
        this.initTilingSprite(displayObject);
    //  this.batchs.push(displayObject);

    }
    else if(displayObject instanceof Strip)
    {
        // add to a batch!!
        this.initStrip(displayObject);
    //  this.batchs.push(displayObject);
    }
    /*else if(displayObject)// instanceof Graphics)
    {
        //displayObject.initWebGL(this);

        // add to a batch!!
        //this.initStrip(displayObject);
        //this.batchs.push(displayObject);
    }*/

    this.insertAfter(displayObject, previousSprite);

    // insert and SPLIT!
};

/**
 * Inserts a displayObject into the linked list
 *
 * @method insertAfter
 * @param item {DisplayObject}
 * @param displayObject {DisplayObject} The object to insert
 * @private
 */
proto.insertAfter = function insertAfter(item, displayObject)
{
    var previousBatch, splitBatch, index;

    if(displayObject instanceof Sprite)
    {
        previousBatch = displayObject.batch;

        if(previousBatch)
        {
            // so this object is in a batch!

            // is it not? need to split the batch
            if(previousBatch.tail == displayObject)
            {
                // is it tail? insert in to batchs
                index = this.batchs.indexOf( previousBatch );
                this.batchs.splice(index+1, 0, item);
            }
            else
            {
                // TODO MODIFY ADD / REMOVE CHILD TO ACCOUNT FOR FILTERS (also get prev and next) //

                // THERE IS A SPLIT IN THIS BATCH! //
                splitBatch = previousBatch.split(displayObject.__next);

                // COOL!
                // add it back into the array
                /*
                 * OOPS!
                 * seems the new sprite is in the middle of a batch
                 * lets split it..
                 */
                index = this.batchs.indexOf( previousBatch );
                this.batchs.splice(index + 1, 0, item, splitBatch);
            }
        }
        else
        {
            this.batchs.push(item);
        }
    }
    else
    {
        index = this.batchs.indexOf( displayObject );
        this.batchs.splice(index + 1, 0, item);
    }
};

/**
 * Removes a displayObject from the linked list
 *
 * @method removeObject
 * @param displayObject {DisplayObject} The object to remove
 * @private
 */
proto.removeObject = function removeObject(displayObject)
{
    // loop through children..
    // display object //

    // add a child from the render group..
    // remove it and all its children!
    //displayObject.cacheVisible = false;//displayObject.visible;

    /*
     * removing is a lot quicker..
     *
     */
    var batchToRemove, index;

    if (displayObject instanceof Sprite)
    {
        // should always have a batch!
        var batch = displayObject.batch;
        if(!batch)return; // this means the display list has been altered befre rendering

        batch.remove(displayObject);

        if (!batch.size)
        {
            batchToRemove = batch;
        }
    }
    else
    {
        batchToRemove = displayObject;
    }

    /*
     * Looks like there is somthing that needs removing!
     */
    if(batchToRemove)
    {
        index = this.batchs.indexOf( batchToRemove );
        if (index === -1) return;// this means it was added then removed before rendered

        // ok so.. check to see if you adjacent batchs should be joined.
        // TODO may optimise?
        if (index === 0 || index === this.batchs.length - 1)
        {
            // wha - eva! just get of the empty batch!
            this.batchs.splice(index, 1);
            if (batchToRemove instanceof WebGLBatch)
                WebGLBatch.returnBatch(batchToRemove);

            return;
        }

        if(this.batchs[index - 1] instanceof WebGLBatch && this.batchs[index + 1] instanceof WebGLBatch)
        {
            if(this.batchs[index - 1].texture == this.batchs[index + 1].texture && this.batchs[index - 1].blendMode == this.batchs[index + 1].blendMode)
            {
                //console.log("MERGE")
                this.batchs[index - 1].merge(this.batchs[index + 1]);

                if (batchToRemove instanceof WebGLBatch)
                    WebGLBatch.returnBatch(batchToRemove);

                WebGLBatch.returnBatch(this.batchs[index + 1]);
                this.batchs.splice(index, 2);
                return;
            }
        }

        this.batchs.splice(index, 1);
        if (batchToRemove instanceof WebGLBatch)
            WebGLBatch.returnBatch(batchToRemove);
    }
};

/**
 * Initializes a tiling sprite
 *
 * @method initTilingSprite
 * @param sprite {TilingSprite} The tiling sprite to initialize
 * @private
 */
proto.initTilingSprite = function initTilingSprite(sprite)
{
    var gl = this.gl;

    // make the texture tilable..

    sprite.verticies = new Float32Array([0, 0,
                                          sprite.width, 0,
                                          sprite.width,  sprite.height,
                                         0,  sprite.height]);

    sprite.uvs = new Float32Array([0, 0,
                                    1, 0,
                                    1, 1,
                                    0, 1]);

    sprite.colors = new Float32Array([1,1,1,1]);

    sprite.indices =  new Uint16Array([0, 1, 3,2])//, 2]);

    sprite._vertexBuffer = gl.createBuffer();
    sprite._indexBuffer = gl.createBuffer();
    sprite._uvBuffer = gl.createBuffer();
    sprite._colorBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, sprite._vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sprite.verticies, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, sprite._uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,  sprite.uvs, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, sprite._colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sprite.colors, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sprite._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sprite.indices, gl.STATIC_DRAW);

//    return ( (x > 0) && ((x & (x - 1)) == 0) );

    if(sprite.texture.baseTexture._glTexture)
    {
        gl.bindTexture(gl.TEXTURE_2D, sprite.texture.baseTexture._glTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        sprite.texture.baseTexture._powerOf2 = true;
    }
    else
    {
        sprite.texture.baseTexture._powerOf2 = true;
    }
};

/**
 * Renders a Strip
 *
 * @method renderStrip
 * @param strip {Strip} The strip to render
 * @param projection {Object}
 * @private
 */
proto.renderStrip = function renderStrip(strip, projection)
{
    var gl = this.gl;
    var shaderProgram = globals.shaderProgram;
//  mat
    //var mat4Real = mat3.toMat4(strip.worldTransform);
    //mat4.transpose(mat4Real);
    //mat4.multiply(projectionMatrix, mat4Real, mat4Real )


    gl.useProgram(globals.stripShaderProgram);

    var m = mat3.clone(strip.worldTransform);

    mat3.transpose(m);

    // set the matrix transform for the
    gl.uniformMatrix3fv(globals.stripShaderProgram.translationMatrix, false, m);
    gl.uniform2f(globals.stripShaderProgram.projectionVector, projection.x, projection.y);
    gl.uniform1f(globals.stripShaderProgram.alpha, strip.worldAlpha);

/*
    if(strip.blendMode == blendModes.NORMAL)
    {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    else
    {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    }
    */


    if(!strip.dirty)
    {

        gl.bindBuffer(gl.ARRAY_BUFFER, strip._vertexBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, strip.verticies)
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);

        // update the uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, strip._uvBuffer);
        gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, strip.texture.baseTexture._glTexture);

        gl.bindBuffer(gl.ARRAY_BUFFER, strip._colorBuffer);
        gl.vertexAttribPointer(shaderProgram.colorAttribute, 1, gl.FLOAT, false, 0, 0);

        // dont need to upload!
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, strip._indexBuffer);
    }
    else
    {
        strip.dirty = false;
        gl.bindBuffer(gl.ARRAY_BUFFER, strip._vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, strip.verticies, gl.STATIC_DRAW)
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);

        // update the uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, strip._uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, strip.uvs, gl.STATIC_DRAW)
        gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, strip.texture.baseTexture._glTexture);

        gl.bindBuffer(gl.ARRAY_BUFFER, strip._colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, strip.colors, gl.STATIC_DRAW)
        gl.vertexAttribPointer(shaderProgram.colorAttribute, 1, gl.FLOAT, false, 0, 0);

        // dont need to upload!
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, strip._indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, strip.indices, gl.STATIC_DRAW);

    }
    //console.log(gl.TRIANGLE_STRIP);

    gl.drawElements(gl.TRIANGLE_STRIP, strip.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.useProgram(globals.shaderProgram);
};

/**
 * Renders a TilingSprite
 *
 * @method renderTilingSprite
 * @param sprite {TilingSprite} The tiling sprite to render
 * @param projectionMatrix {Object}
 * @private
 */
proto.renderTilingSprite = function renderTilingSprite(sprite, projectionMatrix)
{
    var gl = this.gl;
    var shaderProgram = globals.shaderProgram;

    var tilePosition = sprite.tilePosition;
    var tileScale = sprite.tileScale;

    var offsetX =  tilePosition.x/sprite.texture.baseTexture.width;
    var offsetY =  tilePosition.y/sprite.texture.baseTexture.height;

    var scaleX =  (sprite.width / sprite.texture.baseTexture.width)  / tileScale.x;
    var scaleY =  (sprite.height / sprite.texture.baseTexture.height) / tileScale.y;

    sprite.uvs[0] = 0 - offsetX;
    sprite.uvs[1] = 0 - offsetY;

    sprite.uvs[2] = (1 * scaleX)  -offsetX;
    sprite.uvs[3] = 0 - offsetY;

    sprite.uvs[4] = (1 *scaleX) - offsetX;
    sprite.uvs[5] = (1 *scaleY) - offsetY;

    sprite.uvs[6] = 0 - offsetX;
    sprite.uvs[7] = (1 *scaleY) - offsetY;

    gl.bindBuffer(gl.ARRAY_BUFFER, sprite._uvBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprite.uvs)

    this.renderStrip(sprite, projectionMatrix);
};

/**
 * Initializes a strip to be rendered
 *
 * @method initStrip
 * @param strip {Strip} The strip to initialize
 * @private
 */
proto.initStrip = function initStrip(strip)
{
    // build the strip!
    var gl = this.gl;
    var shaderProgram = this.shaderProgram;

    strip._vertexBuffer = gl.createBuffer();
    strip._indexBuffer = gl.createBuffer();
    strip._uvBuffer = gl.createBuffer();
    strip._colorBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, strip._vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, strip.verticies, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, strip._uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,  strip.uvs, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, strip._colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, strip.colors, gl.STATIC_DRAW);


    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, strip._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, strip.indices, gl.STATIC_DRAW);
};

/**
 * Updates a loaded webgl texture
 *
 * @static
 * @method updateTexture
 * @param gl {WebGLContext} An instance of the webGL context
 * @param texture {Texture} The texture to update
 */
WebGLRenderGroup.updateTexture = function updateTexture(gl, texture)
{
    //TODO break this out into a texture manager...
    if(!texture._glTexture)
    {
        texture._glTexture = gl.createTexture();
    }

    if(texture.hasLoaded)
    {
        gl.bindTexture(gl.TEXTURE_2D, texture._glTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        // reguler...

        if(!texture._powerOf2)
        {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        else
        {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
    }
};

/**
 * Destroys a loaded webgl texture
 *
 * @method destroyTexture
 * @param gl {WebGLContext} An instance of the webGL context
 * @param texture {Texture} The texture to update
 */
WebGLRenderGroup.destroyTexture = function destroyTexture(gl, texture)
{
    //TODO break this out into a texture manager...
    if(texture._glTexture)
    {
        texture._glTexture = gl.createTexture();
        gl.deleteTexture(gl.TEXTURE_2D, texture._glTexture);
    }
};

/**
 * Updates the textures loaded into this webgl renderer
 *
 * @static
 * @method updateTextures
 * @param gl {WebGLContext} An instance of the webGL context
 */
WebGLRenderGroup.updateTextures = function updateTextures(gl)
{
    //TODO break this out into a texture manager...
    for (var i = 0, l = globals.texturesToUpdate.length; i < l; i++)
        WebGLRenderGroup.updateTexture(gl, globals.texturesToUpdate[i]);
    for (i = 0, l = globals.texturesToDestroy.length; i < l; i++)
        WebGLRenderGroup.destroyTexture(gl, globals.texturesToDestroy[i]);
    globals.texturesToUpdate = [];
    globals.texturesToDestroy = [];
};

module.exports = WebGLRenderGroup;

},{"../../core/globals":2,"../../display/Sprite":6,"../../extras/CustomRenderable":10,"../../extras/Strip":13,"../../extras/TilingSprite":14,"../../filters/FilterBlock":15,"../../geom/matrix":21,"../../primitives/Graphics":30,"./WebGLBatch":33,"./graphics":36}],35:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var platform = require('../../platform');
var globals = require('../../core/globals');
var shaders = require('./shaders');

var WebGLBatch = require('./WebGLBatch');
var WebGLRenderGroup = require('./WebGLRenderGroup');
var Point = require('../../geom/Point');
var Texture = require('../../textures/Texture');

/**
 * the WebGLRenderer is draws the stage and all its content onto a webGL enabled canvas. This renderer
 * should be used for browsers support webGL. This Render works by automatically managing webGLBatchs.
 * So no need for Sprite Batch's or Sprite Cloud's
 * Dont forget to add the view to your DOM or you will not see anything :)
 *
 * @class WebGLRenderer
 * @constructor
 * @param width=0 {Number} the width of the canvas view
 * @param height=0 {Number} the height of the canvas view
 * @param view {Canvas} the canvas to use as a view, optional
 * @param transparent=false {Boolean} the transparency of the render view, default false
 * @param antialias=false {Boolean} sets antialias (only applicable in chrome at the moment)
 *
 */
function WebGLRenderer(width, height, view, transparent, antialias)
{
    var gl;

    this.transparent = !!transparent;

    this.width = width || 800;
    this.height = height || 600;

    this.view = view || platform.createCanvas();
    this.view.width = this.width;
    this.view.height = this.height;

    // deal with losing context..
    var scope = this;
    this.view.addEventListener('webglcontextlost', function(event) { scope.handleContextLost(event); }, false)
    this.view.addEventListener('webglcontextrestored', function(event) { scope.handleContextRestored(event); }, false)

    this.batchs = [];

    // do a catch.. only 1 webGL renderer..
    try
    {
        gl = globals.gl = this.gl = this.view.getContext("experimental-webgl",  {
             alpha: this.transparent,
             antialias:!!antialias, // SPEED UP??
             premultipliedAlpha:false,
             stencil:true
        });
    }
    catch (e)
    {
        throw new Error(" This browser does not support webGL. Try using the canvas renderer" + this);
    }

    shaders.initPrimitiveShader();
    shaders.initDefaultShader();
    shaders.initDefaultStripShader();

    shaders.activateDefaultShader();

    this.batch = new WebGLBatch(gl);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    gl.enable(gl.BLEND);
    gl.colorMask(true, true, true, this.transparent);

    this.projection = new Point(400, 300);

    this.resize(this.width, this.height);
    this.contextLost = false;

    this.stageRenderGroup = new WebGLRenderGroup(this.gl);
}

var proto = WebGLRenderer.prototype;

/**
 * Renders the stage to its webGL view
 *
 * @method render
 * @param stage {Stage} the Stage element to be rendered
 */
proto.render = function render(stage)
{
    if(this.contextLost)return;


    // if rendering a new stage clear the batchs..
    if(this.__stage !== stage)
    {
        // TODO make this work
        // dont think this is needed any more?
        this.__stage = stage;
        this.stageRenderGroup.setRenderable(stage);
    }

    // TODO not needed now...
    // update children if need be
    // best to remove first!
    /*for (var i=0; i < stage.__childrenRemoved.length; i++)
    {
        var group = stage.__childrenRemoved[i].__renderGroup
        if(group)group.removeDisplayObject(stage.__childrenRemoved[i]);
    }*/

    var gl = this.gl;

    // update any textures
    WebGLRenderGroup.updateTextures(gl);

    // update the scene graph
    globals.visibleCount++;
    stage.updateTransform();

    // -- Does this need to be set every frame? -- //
    gl.colorMask(true, true, true, this.transparent);
    gl.viewport(0, 0, this.width, this.height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.clearColor(stage.backgroundColorSplit[0],stage.backgroundColorSplit[1],stage.backgroundColorSplit[2], !this.transparent);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // HACK TO TEST

    // this.stageRenderGroup.backgroundColor = stage.backgroundColorSplit;
    this.stageRenderGroup.render(this.projection);

    // interaction
    // run interaction!
    if(stage.interactive)
    {
        //need to add some events!
        if(!stage._interactiveEventsAdded)
        {
            stage._interactiveEventsAdded = true;
            stage.interactionManager.setTarget(this);
        }
    }

    // after rendering lets confirm all frames that have been uodated..
    if(Texture.frameUpdates.length > 0)
    {
        for (var i = 0, l = Texture.frameUpdates.length; i < l; i++)
        {
            Texture.frameUpdates[i].updateFrame = false;
        }

        Texture.frameUpdates = [];
    }
};

/**
 * resizes the webGL view to the specified width and height
 *
 * @method resize
 * @param width {Number} the new width of the webGL view
 * @param height {Number} the new height of the webGL view
 */
proto.resize = function resize(width, height)
{
    this.width = width;
    this.height = height;

    this.view.width = width;
    this.view.height = height;

    this.gl.viewport(0, 0, this.width, this.height);

    //var projectionMatrix = this.projectionMatrix;

    this.projection.x = this.width/2;
    this.projection.y = this.height/2;

//  projectionMatrix[0] = 2/this.width;
//  projectionMatrix[5] = -2/this.height;
//  projectionMatrix[12] = -1;
//  projectionMatrix[13] = 1;
};

/**
 * Handles a lost webgl context
 *
 * @method handleContextLost
 * @param event {Event}
 * @private
 */
proto.handleContextLost = function handleContextLost(event)
{
    event.preventDefault();
    this.contextLost = true;
};

/**
 * Handles a restored webgl context
 *
 * @method handleContextRestored
 * @param event {Event}
 * @private
 */
proto.handleContextRestored = function handleContextRestored(event)
{
    var gl = this.gl = this.view.getContext("experimental-webgl",  {
        alpha: true
    });

    this.initShaders();

    for(var key in Texture.cache)
    {
        var texture = Texture.cache[key].baseTexture;
        texture._glTexture = null;
        WebGLRenderGroup.updateTexture(gl, texture);
    }

    for (var i = 0, l = this.batchs.length; i < l; i++)
    {
        this.batchs[i].restoreLostContext(gl)//
        this.batchs[i].dirty = true;
    }

    WebGLBatch.restoreBatches(this.gl);

    this.contextLost = false;
};

module.exports = WebGLRenderer;

},{"../../core/globals":2,"../../geom/Point":18,"../../platform":29,"../../textures/Texture":42,"./WebGLBatch":33,"./WebGLRenderGroup":34,"./shaders":37}],36:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var shaders = require('./shaders');
var globals = require('../../core/globals');
var mat3 = require('../../geom/matrix').mat3;
var hex2rgb = require('../../utils/color').hex2rgb;
var triangulate = require('../../utils/Polyk').triangulate;

var Point = require('../../geom/Point');
var Graphics = require('../../primitives/Graphics');

/**
 * A set of functions used by the webGL renderer to draw the primitive graphics data
 *
 * @module renderers/webgl/graphics
 */

/**
 * Renders the graphics object
 *
 * @static
 * @private
 * @method renderGraphics
 * @param graphics {Graphics}
 * @param projection {Object}
 */
exports.renderGraphics = function renderGraphics(graphics, projection)
{
    var gl = globals.gl;

    if(!graphics._webGL)graphics._webGL = {points:[], indices:[], lastIndex:0,
                                           buffer:gl.createBuffer(),
                                           indexBuffer:gl.createBuffer()};

    if(graphics.dirty)
    {
        graphics.dirty = false;

        if(graphics.clearDirty)
        {
            graphics.clearDirty = false;

            graphics._webGL.lastIndex = 0;
            graphics._webGL.points = [];
            graphics._webGL.indices = [];

        }

        exports.updateGraphics(graphics);
    }


    shaders.activatePrimitiveShader();

    // This  could be speeded up fo sure!
    var m = mat3.clone(graphics.worldTransform);

    mat3.transpose(m);

    // set the matrix transform for the
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniformMatrix3fv(globals.primitiveProgram.translationMatrix, false, m);

    gl.uniform2f(globals.primitiveProgram.projectionVector, projection.x, projection.y);

    gl.uniform1f(globals.primitiveProgram.alpha, graphics.worldAlpha);

    gl.bindBuffer(gl.ARRAY_BUFFER, graphics._webGL.buffer);

    // WHY DOES THIS LINE NEED TO BE THERE???
    gl.vertexAttribPointer(globals.shaderProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 0, 0);
    // its not even used.. but need to be set or it breaks?
    // only on pc though..

    gl.vertexAttribPointer(globals.primitiveProgram.vertexPositionAttribute, 2, gl.FLOAT, false, 4 * 6, 0);
    gl.vertexAttribPointer(globals.primitiveProgram.colorAttribute, 4, gl.FLOAT, false,4 * 6, 2 * 4);

    // set the index buffer!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, graphics._webGL.indexBuffer);

    gl.drawElements(gl.TRIANGLE_STRIP,  graphics._webGL.indices.length, gl.UNSIGNED_SHORT, 0 );

    // return to default shader...
    shaders.activateDefaultShader();
};

/**
 * Updates the graphics object
 *
 * @static
 * @private
 * @method updateGraphics
 * @param graphics {Graphics}
 */
exports.updateGraphics = function updateGraphics(graphics)
{
    for (var i=graphics._webGL.lastIndex; i < graphics.graphicsData.length; i++)
    {
        var data = graphics.graphicsData[i];

        if(data.type == Graphics.POLY)
        {
            if(data.fill)
            {
                if(data.points.length>3)
                exports.buildPoly(data, graphics._webGL);
            }

            if(data.lineWidth > 0)
            {
                exports.buildLine(data, graphics._webGL);
            }
        }
        else if(data.type == Graphics.RECT)
        {
            exports.buildRectangle(data, graphics._webGL);
        }
        else if(data.type == Graphics.CIRC || data.type == Graphics.ELIP)
        {
            exports.buildCircle(data, graphics._webGL);
        }
    }

    graphics._webGL.lastIndex = graphics.graphicsData.length;

    var gl = globals.gl;

    graphics._webGL.glPoints = new Float32Array(graphics._webGL.points);

    gl.bindBuffer(gl.ARRAY_BUFFER, graphics._webGL.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, graphics._webGL.glPoints, gl.STATIC_DRAW);

    graphics._webGL.glIndicies = new Uint16Array(graphics._webGL.indices);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, graphics._webGL.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, graphics._webGL.glIndicies, gl.STATIC_DRAW);
};

/**
 * Builds a rectangle to draw
 *
 * @static
 * @private
 * @method buildRectangle
 * @param graphics {Graphics}
 * @param webGLData {Object}
 */
exports.buildRectangle = function buildRectangle(graphicsData, webGLData)
{
    // --- //
    // need to convert points to a nice regular data
    //
    var rectData = graphicsData.points;
    var x = rectData[0];
    var y = rectData[1];
    var width = rectData[2];
    var height = rectData[3];


    if(graphicsData.fill)
    {
        var color = hex2rgb(graphicsData.fillColor);
        var alpha = graphicsData.fillAlpha;

        var r = color[0] * alpha;
        var g = color[1] * alpha;
        var b = color[2] * alpha;

        var verts = webGLData.points;
        var indices = webGLData.indices;

        var vertPos = verts.length/6;

        // start
        verts.push(x, y);
        verts.push(r, g, b, alpha);

        verts.push(x + width, y);
        verts.push(r, g, b, alpha);

        verts.push(x , y + height);
        verts.push(r, g, b, alpha);

        verts.push(x + width, y + height);
        verts.push(r, g, b, alpha);

        // insert 2 dead triangles..
        indices.push(vertPos, vertPos, vertPos+1, vertPos+2, vertPos+3, vertPos+3)
    }

    if(graphicsData.lineWidth)
    {
        graphicsData.points = [x, y,
                  x + width, y,
                  x + width, y + height,
                  x, y + height,
                  x, y];

        exports.buildLine(graphicsData, webGLData);
    }
};

/**
 * Builds a circle to draw
 *
 * @static
 * @private
 * @method buildCircle
 * @param graphics {Graphics}
 * @param webGLData {Object}
 */
exports.buildCircle = function buildCircle(graphicsData, webGLData)
{
    // --- //
    // need to convert points to a nice regular data
    //
    var rectData = graphicsData.points;
    var x = rectData[0];
    var y = rectData[1];
    var width = rectData[2];
    var height = rectData[3];

    var totalSegs = 40;
    var seg = (Math.PI * 2) / totalSegs ;
    var i;

    if (graphicsData.fill)
    {
        var color = hex2rgb(graphicsData.fillColor);
        var alpha = graphicsData.fillAlpha;

        var r = color[0] * alpha;
        var g = color[1] * alpha;
        var b = color[2] * alpha;

        var verts = webGLData.points;
        var indices = webGLData.indices;

        var vecPos = verts.length/6;

        indices.push(vecPos);

        for (i = 0; i < totalSegs + 1 ; i++)
        {
            verts.push(x,y, r, g, b, alpha);

            verts.push(x + Math.sin(seg * i) * width,
                       y + Math.cos(seg * i) * height,
                       r, g, b, alpha);

            indices.push(vecPos++, vecPos++);
        }

        indices.push(vecPos-1);
    }

    if (graphicsData.lineWidth)
    {
        graphicsData.points = [];

        for (i = 0; i < totalSegs + 1; i++)
        {
            graphicsData.points.push(x + Math.sin(seg * i) * width,
                                     y + Math.cos(seg * i) * height)
        }

        exports.buildLine(graphicsData, webGLData);
    }
};

/**
 * Builds a line to draw
 *
 * @static
 * @private
 * @method buildLine
 * @param graphics {Graphics}
 * @param webGLData {Object}
 */
exports.buildLine = function buildLine(graphicsData, webGLData)
{
    // TODO OPTIMISE!

    var wrap = true;
    var points = graphicsData.points;
    if (points.length === 0) return;

    // get first and last point.. figure out the middle!
    var firstPoint = new Point( points[0], points[1] );
    var lastPoint = new Point( points[points.length - 2], points[points.length - 1] );

    // if the first point is the last point - goona have issues :)
    if (firstPoint.x == lastPoint.x && firstPoint.y == lastPoint.y)
    {
        points.pop();
        points.pop();

        lastPoint = new Point( points[points.length - 2], points[points.length - 1] );

        var midPointX = lastPoint.x + (firstPoint.x - lastPoint.x) *0.5;
        var midPointY = lastPoint.y + (firstPoint.y - lastPoint.y) *0.5;

        points.unshift(midPointX, midPointY);
        points.push(midPointX, midPointY)
    }

    var verts = webGLData.points;
    var indices = webGLData.indices;
    var length = points.length / 2;
    var indexCount = points.length;
    var indexStart = verts.length/6;

    // DRAW the Line
    var width = graphicsData.lineWidth / 2;

    // sort color
    var color = hex2rgb(graphicsData.lineColor);
    var alpha = graphicsData.lineAlpha;
    var r = color[0] * alpha;
    var g = color[1] * alpha;
    var b = color[2] * alpha;

    var p1x, p1y, p2x, p2y, p3x, p3y;
    var perpx, perpy, perp2x, perp2y, perp3x, perp3y;
    var ipx, ipy;
    var a1, b1, c1, a2, b2, c2;
    var denom, pdist, dist;
    var px, py;

    p1x = points[0];
    p1y = points[1];

    p2x = points[2];
    p2y = points[3];

    perpx = -(p1y - p2y);
    perpy =  p1x - p2x;

    dist = Math.sqrt(perpx*perpx + perpy*perpy);

    perpx /= dist;
    perpy /= dist;
    perpx *= width;
    perpy *= width;

    // start
    verts.push(p1x - perpx , p1y - perpy,
                r, g, b, alpha);

    verts.push(p1x + perpx , p1y + perpy,
                r, g, b, alpha);

    for (var i = 1; i < length-1; i++)
    {
        p1x = points[(i-1)*2];
        p1y = points[(i-1)*2 + 1];

        p2x = points[(i)*2]
        p2y = points[(i)*2 + 1]

        p3x = points[(i+1)*2];
        p3y = points[(i+1)*2 + 1];

        perpx = -(p1y - p2y);
        perpy = p1x - p2x;

        dist = Math.sqrt(perpx*perpx + perpy*perpy);
        perpx /= dist;
        perpy /= dist;
        perpx *= width;
        perpy *= width;

        perp2x = -(p2y - p3y);
        perp2y = p2x - p3x;

        dist = Math.sqrt(perp2x*perp2x + perp2y*perp2y);
        perp2x /= dist;
        perp2y /= dist;
        perp2x *= width;
        perp2y *= width;

        a1 = (-perpy + p1y) - (-perpy + p2y);
        b1 = (-perpx + p2x) - (-perpx + p1x);
        c1 = (-perpx + p1x) * (-perpy + p2y) - (-perpx + p2x) * (-perpy + p1y);
        a2 = (-perp2y + p3y) - (-perp2y + p2y);
        b2 = (-perp2x + p2x) - (-perp2x + p3x);
        c2 = (-perp2x + p3x) * (-perp2y + p2y) - (-perp2x + p2x) * (-perp2y + p3y);

        denom = a1*b2 - a2*b1;

        if (denom === 0) {
            denom+=1;
        }

        px = (b1*c2 - b2*c1)/denom;
        py = (a2*c1 - a1*c2)/denom;

        pdist = (px -p2x) * (px -p2x) + (py -p2y) + (py -p2y);

        if(pdist > 140 * 140)
        {
            perp3x = perpx - perp2x;
            perp3y = perpy - perp2y;

            dist = Math.sqrt(perp3x*perp3x + perp3y*perp3y);
            perp3x /= dist;
            perp3y /= dist;
            perp3x *= width;
            perp3y *= width;

            verts.push(p2x - perp3x, p2y -perp3y);
            verts.push(r, g, b, alpha);

            verts.push(p2x + perp3x, p2y +perp3y);
            verts.push(r, g, b, alpha);

            verts.push(p2x - perp3x, p2y -perp3y);
            verts.push(r, g, b, alpha);

            indexCount++;
        }
        else
        {
            verts.push(px , py);
            verts.push(r, g, b, alpha);

            verts.push(p2x - (px-p2x), p2y - (py - p2y));
            verts.push(r, g, b, alpha);
        }
    }

    p1x = points[(length-2)*2]
    p1y = points[(length-2)*2 + 1]

    p2x = points[(length-1)*2]
    p2y = points[(length-1)*2 + 1]

    perpx = -(p1y - p2y)
    perpy = p1x - p2x;

    dist = Math.sqrt(perpx*perpx + perpy*perpy);
    perpx /= dist;
    perpy /= dist;
    perpx *= width;
    perpy *= width;

    verts.push(p2x - perpx , p2y - perpy)
    verts.push(r, g, b, alpha);

    verts.push(p2x + perpx , p2y + perpy)
    verts.push(r, g, b, alpha);

    indices.push(indexStart);

    for (i = 0; i < indexCount; i++)
    {
        indices.push(indexStart++);
    }

    indices.push(indexStart-1);
};

/**
 * Builds a polygon to draw
 *
 * @static
 * @private
 * @method buildPoly
 * @param graphics {Graphics}
 * @param webGLData {Object}
 */
exports.buildPoly = function buildPoly(graphicsData, webGLData)
{
    var points = graphicsData.points;
    if (points.length < 6) return;

    // get first and last point.. figure out the middle!
    var verts = webGLData.points;
    var indices = webGLData.indices;

    var triangles = triangulate(points);
    var vertPos = verts.length / 6;

    for (var i = 0, l = triangles.length; i < l; i+=3)
    {
        indices.push(triangles[i] + vertPos);
        indices.push(triangles[i] + vertPos);
        indices.push(triangles[i+1] + vertPos);
        indices.push(triangles[i+2] +vertPos);
        indices.push(triangles[i+2] + vertPos);
    }

    // sort color
    var color = hex2rgb(graphicsData.fillColor);
    var alpha = graphicsData.fillAlpha;
    var r = color[0] * alpha;
    var g = color[1] * alpha;
    var b = color[2] * alpha;

    for (i = 0, l = points.length / 2; i < l; i++)
    {
        verts.push(points[i * 2], points[i * 2 + 1],
                   r, g, b, alpha);
    }
};

},{"../../core/globals":2,"../../geom/Point":18,"../../geom/matrix":21,"../../primitives/Graphics":30,"../../utils/Polyk":43,"../../utils/color":45,"./shaders":37}],37:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var platform = require('../../platform');
var globals = require('../../core/globals');

/*
 * the default suoer fast shader!
 */

var shaderFragmentSrc = [
    "precision mediump float;",
    "varying vec2 vTextureCoord;",
    "varying float vColor;",
    "uniform sampler2D uSampler;",
    "void main(void) {",
        "gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y));",
        "gl_FragColor = gl_FragColor * vColor;",
    "}"
].join("\n");

var shaderVertexSrc = [
    "attribute vec2 aVertexPosition;",
    "attribute vec2 aTextureCoord;",
    "attribute float aColor;",
    //"uniform mat4 uMVMatrix;",

    "uniform vec2 projectionVector;",
    "varying vec2 vTextureCoord;",
    "varying float vColor;",
    "void main(void) {",
        // "gl_Position = uMVMatrix * vec4(aVertexPosition, 1.0, 1.0);",
        "gl_Position = vec4( aVertexPosition.x / projectionVector.x -1.0, aVertexPosition.y / -projectionVector.y + 1.0 , 0.0, 1.0);",
        "vTextureCoord = aTextureCoord;",
        "vColor = aColor;",
    "}"
].join("\n");

/*
 * the triangle strip shader..
 */

var stripShaderFragmentSrc = [
    "precision mediump float;",
    "varying vec2 vTextureCoord;",
    "varying float vColor;",
    "uniform float alpha;",
    "uniform sampler2D uSampler;",
    "void main(void) {",
        "gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y));",
        "gl_FragColor = gl_FragColor * alpha;",
    "}"
].join("\n");


var stripShaderVertexSrc = [
    "attribute vec2 aVertexPosition;",
    "attribute vec2 aTextureCoord;",
    "attribute float aColor;",
    "uniform mat3 translationMatrix;",
    "uniform vec2 projectionVector;",
    "varying vec2 vTextureCoord;",
    "varying float vColor;",
    "void main(void) {",
    "vec3 v = translationMatrix * vec3(aVertexPosition, 1.0);",
        "gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);",
        "vTextureCoord = aTextureCoord;",
        "vColor = aColor;",
    "}"
].join("\n");


/*
 * primitive shader..
 */

var primitiveShaderFragmentSrc = [
    "precision mediump float;",
    "varying vec4 vColor;",
    "void main(void) {",
        "gl_FragColor = vColor;",
    "}"
].join("\n");

var primitiveShaderVertexSrc = [
    "attribute vec2 aVertexPosition;",
    "attribute vec4 aColor;",
    "uniform mat3 translationMatrix;",
    "uniform vec2 projectionVector;",
    "uniform float alpha;",
    "varying vec4 vColor;",
    "void main(void) {",
        "vec3 v = translationMatrix * vec3(aVertexPosition, 1.0);",
        "gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);",
        "vColor = aColor  * alpha;",
    "}"
].join("\n");

function compileShader(gl, shaderSrc, shaderType)
{
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSrc);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        platform.console.error(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function compileProgram(vertexSrc, fragmentSrc)
{
    var gl = globals.gl;
    var fragmentShader = compileShader(gl, fragmentSrc, gl.FRAGMENT_SHADER);
    var vertexShader = compileShader(gl, vertexSrc, gl.VERTEX_SHADER);

    var shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        platform.console.error("Could not initialise shaders");
    }

    return shaderProgram;
}

exports.initDefaultShader = function initDefaultShader()
{
    var gl = globals.gl;
    var shaderProgram = compileProgram(shaderVertexSrc, shaderFragmentSrc)

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    shaderProgram.projectionVector = gl.getUniformLocation(shaderProgram, "projectionVector");
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    shaderProgram.colorAttribute = gl.getAttribLocation(shaderProgram, "aColor");

    // shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");

    globals.shaderProgram = shaderProgram;
};

exports.initPrimitiveShader = function initPrimitiveShader()
{
    var gl = globals.gl;

    var shaderProgram = compileProgram(primitiveShaderVertexSrc, primitiveShaderFragmentSrc)

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    shaderProgram.colorAttribute = gl.getAttribLocation(shaderProgram, "aColor");

    shaderProgram.projectionVector = gl.getUniformLocation(shaderProgram, "projectionVector");
    shaderProgram.translationMatrix = gl.getUniformLocation(shaderProgram, "translationMatrix");

    shaderProgram.alpha = gl.getUniformLocation(shaderProgram, "alpha");

    globals.primitiveProgram = shaderProgram;
};

exports.initDefaultStripShader = function initDefaultStripShader()
{
    var gl = globals.gl;
    var shaderProgram = compileProgram(stripShaderVertexSrc, stripShaderFragmentSrc)

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    shaderProgram.projectionVector = gl.getUniformLocation(shaderProgram, "projectionVector");
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    shaderProgram.translationMatrix = gl.getUniformLocation(shaderProgram, "translationMatrix");
    shaderProgram.alpha = gl.getUniformLocation(shaderProgram, "alpha");

    shaderProgram.colorAttribute = gl.getAttribLocation(shaderProgram, "aColor");

    shaderProgram.projectionVector = gl.getUniformLocation(shaderProgram, "projectionVector");

    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");

    globals.stripShaderProgram = shaderProgram;
};

exports.activateDefaultShader = function activateDefaultShader()
{
    var gl = globals.gl;
    var shaderProgram = globals.shaderProgram;

    gl.useProgram(shaderProgram);

    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
    gl.enableVertexAttribArray(shaderProgram.colorAttribute);
};

exports.activatePrimitiveShader = function activatePrimitiveShader()
{
    var gl = globals.gl;

    gl.disableVertexAttribArray(globals.shaderProgram.textureCoordAttribute);
    gl.disableVertexAttribArray(globals.shaderProgram.colorAttribute);

    gl.useProgram(globals.primitiveProgram);

    gl.enableVertexAttribArray(globals.primitiveProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(globals.primitiveProgram.colorAttribute);
};

},{"../../core/globals":2,"../../platform":29}],38:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var DisplayObjectContainer = require('../display/DisplayObjectContainer');
var Sprite = require('../display/Sprite');
var Point = require('../geom/Point');

/**
 * A Text Object will create a line(s) of text using bitmap font. To split a line you can use "\n", "\r" or "\r\n"
 * You can generate the fnt files using
 * http://www.angelcode.com/products/bmfont/ for windows or
 * http://www.bmglyph.com/ for mac.
 *
 * @class BitmapText
 * @extends DisplayObjectContainer
 * @constructor
 * @param text {String} The copy that you would like the text to display
 * @param style {Object} The style parameters
 * @param style.font {String} The size (optional) and bitmap font id (required) eq "Arial" or "20px Arial" (must have loaded previously)
 * @param [style.align="left"] {String} An alignment of the multiline text ("left", "center" or "right")
 */
function BitmapText(text, style)
{
    DisplayObjectContainer.call(this);

    this.setText(text);
    this.setStyle(style);
    this.updateText();
    this.dirty = false
}

var proto = BitmapText.prototype = Object.create(DisplayObjectContainer.prototype, {
    constructor: {value: BitmapText}
});

/**
 * Set the copy for the text object
 *
 * @method setText
 * @param text {String} The copy that you would like the text to display
 */
proto.setText = function setText(text)
{
    this.text = text || " ";
    this.dirty = true;
};

/**
 * Set the style of the text
 *
 * @method setStyle
 * @param style {Object} The style parameters
 * @param style.font {String} The size (optional) and bitmap font id (required) eq "Arial" or "20px Arial" (must have loaded previously)
 * @param [style.align="left"] {String} An alignment of the multiline text ("left", "center" or "right")
 */
proto.setStyle = function setStyle(style)
{
    style = style || {};
    style.align = style.align || "left";
    this.style = style;

    var font = style.font.split(" ");
    this.fontName = font[font.length - 1];
    this.fontSize = font.length >= 2 ? parseInt(font[font.length - 2], 10) : BitmapText.fonts[this.fontName].size;

    this.dirty = true;
};

/**
 * Renders text
 *
 * @method updateText
 * @private
 */
proto.updateText = function updateText()
{
    var data = BitmapText.fonts[this.fontName];
    var pos = new Point();
    var prevCharCode = null;
    var chars = [];
    var maxLineWidth = 0;
    var lineWidths = [];
    var line = 0;
    var scale = this.fontSize / data.size;
    for(var i = 0; i < this.text.length; i++)
    {
        var charCode = this.text.charCodeAt(i);
        if(/(?:\r\n|\r|\n)/.test(this.text.charAt(i)))
        {
            lineWidths.push(pos.x);
            maxLineWidth = Math.max(maxLineWidth, pos.x);
            line++;

            pos.x = 0;
            pos.y += data.lineHeight;
            prevCharCode = null;
            continue;
        }

        var charData = data.chars[charCode];
        if(!charData) continue;

        if(prevCharCode && charData[prevCharCode])
        {
           pos.x += charData.kerning[prevCharCode];
        }
        chars.push({texture:charData.texture, line: line, charCode: charCode, position: new Point(pos.x + charData.xOffset, pos.y + charData.yOffset)});
        pos.x += charData.xAdvance;

        prevCharCode = charCode;
    }

    lineWidths.push(pos.x);
    maxLineWidth = Math.max(maxLineWidth, pos.x);

    var lineAlignOffsets = [];
    for(i = 0; i <= line; i++)
    {
        var alignOffset = 0;
        if(this.style.align == "right")
        {
            alignOffset = maxLineWidth - lineWidths[i];
        }
        else if(this.style.align == "center")
        {
            alignOffset = (maxLineWidth - lineWidths[i]) / 2;
        }
        lineAlignOffsets.push(alignOffset);
    }

    for(i = 0; i < chars.length; i++)
    {
        var c = new Sprite(chars[i].texture); //Sprite.fromFrame(chars[i].charCode);
        c.position.x = (chars[i].position.x + lineAlignOffsets[chars[i].line]) * scale;
        c.position.y = chars[i].position.y * scale;
        c.scale.x = c.scale.y = scale;
        this.addChild(c);
    }

    this.width = pos.x * scale;
    this.height = (pos.y + data.lineHeight) * scale;
};

/**
 * Updates the transfor of this object
 *
 * @method updateTransform
 * @private
 */
proto.updateTransform = function updateTransform()
{
    if(this.dirty)
    {
        while(this.children.length > 0)
        {
            this.removeChild(this.getChildAt(0));
        }
        this.updateText();

        this.dirty = false;
    }

    DisplayObjectContainer.prototype.updateTransform.call(this);
};

BitmapText.fonts = {};

module.exports = BitmapText;

},{"../display/DisplayObjectContainer":4,"../display/Sprite":6,"../geom/Point":18}],39:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var platform = require('../platform');
var globals = require('../core/globals');
var Point = require('../geom/Point');
var Sprite = require('../display/Sprite');
var Texture = require('../textures/Texture');

/**
 * A Text Object will create a line(s) of text to split a line you can use "\n"
 *
 * @class Text
 * @extends Sprite
 * @constructor
 * @param text {String} The copy that you would like the text to display
 * @param [style] {Object} The style parameters
 * @param [style.font] {String} default "bold 20pt Arial" The style and size of the font
 * @param [style.fill="black"] {Object} A canvas fillstyle that will be used on the text eg "red", "#00FF00"
 * @param [style.align="left"] {String} An alignment of the multiline text ("left", "center" or "right")
 * @param [style.stroke] {String} A canvas fillstyle that will be used on the text stroke eg "blue", "#FCFF00"
 * @param [style.strokeThickness=0] {Number} A number that represents the thickness of the stroke. Default is 0 (no stroke)
 * @param [style.wordWrap=false] {Boolean} Indicates if word wrap should be used
 * @param [style.wordWrapWidth=100] {Number} The width at which text will wrap
 */
function Text(text, style)
{
    this.canvas = platform.createCanvas();
    this.context = this.canvas.getContext("2d");
    Sprite.call(this, Texture.fromCanvas(this.canvas));

    this.setText(text);
    this.setStyle(style);

    this.updateText();
    this.dirty = false;
}

// constructor
var proto = Text.prototype = Object.create(Sprite.prototype, {
    constructor: {value: Text}
});

/**
 * Set the style of the text
 *
 * @method setStyle
 * @param [style] {Object} The style parameters
 * @param [style.font="bold 20pt Arial"] {String} The style and size of the font
 * @param [style.fill="black"] {Object} A canvas fillstyle that will be used on the text eg "red", "#00FF00"
 * @param [style.align="left"] {String} An alignment of the multiline text ("left", "center" or "right")
 * @param [style.stroke="black"] {String} A canvas fillstyle that will be used on the text stroke eg "blue", "#FCFF00"
 * @param [style.strokeThickness=0] {Number} A number that represents the thickness of the stroke. Default is 0 (no stroke)
 * @param [style.wordWrap=false] {Boolean} Indicates if word wrap should be used
 * @param [style.wordWrapWidth=100] {Number} The width at which text will wrap
 */
proto.setStyle = function setStyle(style)
{
    style = style || {};
    style.font = style.font || "bold 20pt Arial";
    style.fill = style.fill || "black";
    style.align = style.align || "left";
    style.stroke = style.stroke || "black"; //provide a default, see: https://github.com/GoodBoyDigital/pixi.js/issues/136
    style.strokeThickness = style.strokeThickness || 0;
    style.wordWrap = style.wordWrap || false;
    style.wordWrapWidth = style.wordWrapWidth || 100;
    this.style = style;
    this.dirty = true;
};

/**
 * Set the copy for the text object. To split a line you can use "\n"
 *
 * @methos setText
 * @param {String} text The copy that you would like the text to display
 */
proto.setText = function setText(text)
{
    this.text = text.toString() || " ";
    this.dirty = true;
};

/**
 * Renders text
 *
 * @method updateText
 * @private
 */
proto.updateText = function updateText()
{
    this.context.font = this.style.font;

    var outputText = this.text;

    // word wrap
    // preserve original text
    if(this.style.wordWrap)outputText = this.wordWrap(this.text);

    //split text into lines
    var lines = outputText.split(/(?:\r\n|\r|\n)/);

    //calculate text width
    var lineWidths = [];
    var maxLineWidth = 0;
    for (var i = 0; i < lines.length; i++)
    {
        var lineWidth = this.context.measureText(lines[i]).width;
        lineWidths[i] = lineWidth;
        maxLineWidth = Math.max(maxLineWidth, lineWidth);
    }
    this.canvas.width = maxLineWidth + this.style.strokeThickness;

    //calculate text height
    var lineHeight = this.determineFontHeight("font: " + this.style.font  + ";") + this.style.strokeThickness;
    this.canvas.height = lineHeight * lines.length;

    //set canvas text styles
    this.context.fillStyle = this.style.fill;
    this.context.font = this.style.font;

    this.context.strokeStyle = this.style.stroke;
    this.context.lineWidth = this.style.strokeThickness;

    this.context.textBaseline = "top";

    //draw lines line by line
    for (i = 0; i < lines.length; i++)
    {
        var linePosition = new Point(this.style.strokeThickness / 2, this.style.strokeThickness / 2 + i * lineHeight);

        if(this.style.align == "right")
        {
            linePosition.x += maxLineWidth - lineWidths[i];
        }
        else if(this.style.align == "center")
        {
            linePosition.x += (maxLineWidth - lineWidths[i]) / 2;
        }

        if(this.style.stroke && this.style.strokeThickness)
        {
            this.context.strokeText(lines[i], linePosition.x, linePosition.y);
        }

        if(this.style.fill)
        {
            this.context.fillText(lines[i], linePosition.x, linePosition.y);
        }
    }

    this.updateTexture();
};

/**
 * Updates texture size based on canvas size
 *
 * @method updateTexture
 * @private
 */
proto.updateTexture = function updateTexture()
{
    this.texture.baseTexture.width = this.canvas.width;
    this.texture.baseTexture.height = this.canvas.height;
    this.texture.frame.width = this.canvas.width;
    this.texture.frame.height = this.canvas.height;

    this._width = this.canvas.width;
    this._height = this.canvas.height;

    globals.texturesToUpdate.push(this.texture.baseTexture);
};

/**
 * Updates the transfor of this object
 *
 * @method updateTransform
 * @private
 */
proto.updateTransform = function updateTransform()
{
    if(this.dirty)
    {
        this.updateText();
        this.dirty = false;
    }

    Sprite.prototype.updateTransform.call(this);
};

/*
 * http://stackoverflow.com/users/34441/ellisbben
 * great solution to the problem!
 *
 * @method determineFontHeight
 * @param fontStyle {Object}
 * @private
 */
proto.determineFontHeight = function determineFontHeight(fontStyle)
{
    // build a little reference dictionary so if the font style has been used return a
    // cached version...
    var result = Text.heightCache[fontStyle];

    if(!result)
    {
        var body = platform.document.getElementsByTagName("body")[0];
        var dummy = platform.document.createElement("div");
        var dummyText = platform.document.createTextNode("M");
        dummy.appendChild(dummyText);
        dummy.setAttribute("style", fontStyle + ';position:absolute;top:0;left:0');
        body.appendChild(dummy);

        result = dummy.offsetHeight;
        Text.heightCache[fontStyle] = result;

        body.removeChild(dummy);
    }

    return result;
};

/**
 * A Text Object will apply wordwrap
 *
 * @method wordWrap
 * @param text {String}
 * @private
 */
proto.wordWrap = function wordWrap(text)
{
    // search good wrap position
    function searchWrapPos(ctx, text, start, end, wrapWidth)
    {
        var p = Math.floor((end-start) / 2) + start;
        if(p == start) {
            return 1;
        }

        if(ctx.measureText(text.substring(0,p)).width <= wrapWidth)
        {
            if(ctx.measureText(text.substring(0,p+1)).width > wrapWidth)
            {
                return p;
            }
            else
            {
                return searchWrapPos(ctx, text, p, end, wrapWidth);
            }
        }
        else
        {
            return searchWrapPos(ctx, text, start, p, wrapWidth);
        }
    }

    function lineWrap(ctx, text, wrapWidth)
    {
        if(ctx.measureText(text).width <= wrapWidth || text.length < 1)
        {
            return text;
        }
        var pos = searchWrapPos(ctx, text, 0, text.length, wrapWidth);
        return text.substring(0, pos) + "\n" + lineWrap(ctx, text.substring(pos), wrapWidth);
    }

    var result = "";
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++)
    {
        result += lineWrap(this.context, lines[i], this.style.wordWrapWidth) + "\n";
    }

    return result;
};

/**
 * Destroys this text object
 *
 * @method destroy
 * @param destroyTexture {Boolean}
 */
proto.destroy = function destroy(destroyTexture)
{
    if(destroyTexture)
    {
        this.texture.destroy();
    }

};

Text.heightCache = {};

module.exports = Text;

},{"../core/globals":2,"../display/Sprite":6,"../geom/Point":18,"../platform":29,"../textures/Texture":42}],40:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var platform = require('../platform');
var globals = require('../core/globals');
var EventTarget = require('../events/EventTarget');
var baseTextureCache = {};

/**
 * A texture stores the information that represents an image. All textures have a base texture
 *
 * @class BaseTexture
 * @uses EventTarget
 * @constructor
 * @param source {String} the source object (image or canvas)
 */
function BaseTexture(source)
{
    EventTarget.call(this);

    /**
     * [read-only] The width of the base texture set when the image has loaded
     *
     * @property width
     * @type Number
     * @readOnly
     */
    this.width = 100;

    /**
     * [read-only] The height of the base texture set when the image has loaded
     *
     * @property height
     * @type Number
     * @readOnly
     */
    this.height = 100;

    /**
     * [read-only] Describes if the base texture has loaded or not
     *
     * @property hasLoaded
     * @type Boolean
     * @readOnly
     */
    this.hasLoaded = false;

    /**
     * The source that is loaded to create the texture
     *
     * @property source
     * @type Image
     */
    this.source = source;

    if(!source)return;

    if('complete' in this.source)
    {
        if(this.source.complete)
        {
            this.hasLoaded = true;
            this.width = this.source.width;
            this.height = this.source.height;

            globals.texturesToUpdate.push(this);
        }
        else
        {

            var scope = this;
            this.source.onload = function(){

                scope.hasLoaded = true;
                scope.width = scope.source.width;
                scope.height = scope.source.height;

                // add it to somewhere...
                globals.texturesToUpdate.push(scope);
                scope.dispatchEvent( { type: 'loaded', content: scope } );
            }
            //  this.image.src = imageUrl;
        }
    }
    else
    {
        this.hasLoaded = true;
        this.width = this.source.width;
        this.height = this.source.height;

        globals.texturesToUpdate.push(this);
    }

    this._powerOf2 = false;
}

var proto = BaseTexture.prototype;

/**
 * Destroys this base texture
 *
 * @method destroy
 */
proto.destroy = function destroy()
{
    if(this.source.src)
    {
        this.source.src = null;
    }
    this.source = null;
    globals.texturesToDestroy.push(this);
};

/**
 * Helper function that returns a base texture based on an image url
 * If the image is not in the base texture cache it will be  created and loaded
 *
 * @static
 * @method fromImage
 * @param imageUrl {String} The image url of the texture
 * @return BaseTexture
 */
BaseTexture.fromImage = function fromImage(imageUrl, crossorigin)
{
    var baseTexture = baseTextureCache[imageUrl];
    if(!baseTexture)
    {
        var image = new platform.createImage();
        if (crossorigin)
        {
            image.crossOrigin = '';
        }
        image.src = imageUrl;
        baseTexture = new BaseTexture(image);
        baseTextureCache[imageUrl] = baseTexture;
    }

    return baseTexture;
};

module.exports = BaseTexture;

},{"../core/globals":2,"../events/EventTarget":9,"../platform":29}],41:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../core/globals');
var mat3 = require('../geom/matrix').mat3;

var Texture = require('./Texture');
var BaseTexture = require('./BaseTexture');
var Point = require('../geom/Point');
var Rectangle = require('../geom/Rectangle');
var EventTarget = require('../events/EventTarget');
var CanvasRenderer = require('../renderers/canvas/CanvasRenderer');
var WebGLRenderGroup = require('../renderers/webgl/WebGLRenderGroup');

/**
 A RenderTexture is a special texture that allows any pixi displayObject to be rendered to it.

 __Hint__: All DisplayObjects (exmpl. Sprites) that renders on RenderTexture should be preloaded.
 Otherwise black rectangles will be drawn instead.

 RenderTexture takes snapshot of DisplayObject passed to render method. If DisplayObject is passed to render method, position and rotation of it will be ignored. For example:

    var renderTexture = new RenderTexture(800, 600);
    var sprite = Sprite.fromImage("spinObj_01.png");
    sprite.position.x = 800/2;
    sprite.position.y = 600/2;
    sprite.anchor.x = 0.5;
    sprite.anchor.y = 0.5;
    renderTexture.render(sprite);

 Sprite in this case will be rendered to 0,0 position. To render this sprite at center DisplayObjectContainer should be used:

    var doc = new DisplayObjectContainer();
    doc.addChild(sprite);
    renderTexture.render(doc);  // Renders to center of renderTexture

 @class RenderTexture
 @extends Texture
 @constructor
 @param width {Number} The width of the render texture
 @param height {Number} The height of the render texture
 */
function RenderTexture(width, height)
{
    EventTarget.call( this );

    this.width = width || 100;
    this.height = height || 100;

    this.identityMatrix = mat3.create();

    this.frame = new Rectangle(0, 0, this.width, this.height);

    if(globals.gl)
    {
        this.initWebGL();
    }
    else
    {
        this.initCanvas();
    }
}

var proto = RenderTexture.prototype = Object.create(Texture.prototype, {
    constructor: {value: RenderTexture}
});

/**
 * Initializes the webgl data for this texture
 *
 * @method initWebGL
 * @private
 */
proto.initWebGL = function initWebGL()
{
    var gl = globals.gl;
    this.glFramebuffer = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.glFramebuffer );

    this.glFramebuffer.width = this.width;
    this.glFramebuffer.height = this.height;

    this.baseTexture = new BaseTexture();

    this.baseTexture.width = this.width;
    this.baseTexture.height = this.height;

    this.baseTexture._glTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.baseTexture._glTexture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,  this.width,  this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.baseTexture.isRender = true;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.glFramebuffer );
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.baseTexture._glTexture, 0);

    // create a projection matrix..
    this.projection = new Point(this.width/2 , this.height/2);

    // set the correct render function..
    this.render = this.renderWebGL;
};

proto.resize = function resize(width, height)
{

    this.width = width;
    this.height = height;

    if(globals.gl)
    {
        this.projection.x = this.width/2
        this.projection.y = this.height/2;

        var gl = globals.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture._glTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,  this.width,  this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    else
    {

        this.frame.width = this.width
        this.frame.height = this.height;
        this.renderer.resize(this.width, this.height);
    }
};

/**
 * Initializes the canvas data for this texture
 *
 * @method initCanvas
 * @private
 */
proto.initCanvas = function initCanvas()
{
    this.renderer = new CanvasRenderer(this.width, this.height, null, 0);

    this.baseTexture = new BaseTexture(this.renderer.view);
    this.frame = new Rectangle(0, 0, this.width, this.height);

    this.render = this.renderCanvas;
};

/**
 * This function will draw the display object to the texture.
 *
 * @method renderWebGL
 * @param displayObject {DisplayObject} The display object to render this texture on
 * @param clear {Boolean} If true the texture will be cleared before the displayObject is drawn
 * @private
 */
proto.renderWebGL = function renderWebGL(displayObject, position, clear)
{
    var gl = globals.gl;

    // enable the alpha color mask..
    gl.colorMask(true, true, true, true);

    gl.viewport(0, 0, this.width, this.height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.glFramebuffer );

    if(clear)
    {
        gl.clearColor(0,0,0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // THIS WILL MESS WITH HIT TESTING!
    var children = displayObject.children;

    //TODO -? create a new one??? dont think so!
    var originalWorldTransform = displayObject.worldTransform;
    displayObject.worldTransform = mat3.create();//sthis.identityMatrix;
    // modify to flip...
    displayObject.worldTransform[4] = -1;
    displayObject.worldTransform[5] = this.projection.y * 2;


    if(position)
    {
        displayObject.worldTransform[2] = position.x;
        displayObject.worldTransform[5] -= position.y;
    }

    globals.visibleCount++;
    displayObject.vcount = globals.visibleCount;

    for(var i=0,j=children.length; i<j; i++)
    {
        children[i].updateTransform();
    }

    var renderGroup = displayObject.__renderGroup;

    if(renderGroup)
    {
        if(displayObject == renderGroup.root)
        {
            renderGroup.render(this.projection);
        }
        else
        {
            renderGroup.renderSpecific(displayObject, this.projection);
        }
    }
    else
    {
        if(!this.renderGroup)this.renderGroup = new WebGLRenderGroup(gl);
        this.renderGroup.setRenderable(displayObject);
        this.renderGroup.render(this.projection);
    }

    displayObject.worldTransform = originalWorldTransform;
};

/**
 * This function will draw the display object to the texture.
 *
 * @method renderCanvas
 * @param displayObject {DisplayObject} The display object to render this texture on
 * @param clear {Boolean} If true the texture will be cleared before the displayObject is drawn
 * @private
 */
proto.renderCanvas = function renderCanvas(displayObject, position, clear)
{
    var children = displayObject.children;

    displayObject.worldTransform = mat3.create();

    if(position)
    {
        displayObject.worldTransform[2] = position.x;
        displayObject.worldTransform[5] = position.y;
    }


    for(var i=0,j=children.length; i<j; i++)
    {
        children[i].updateTransform();
    }

    if(clear)this.renderer.context.clearRect(0,0, this.width, this.height);

    this.renderer.renderDisplayObject(displayObject);

    this.renderer.context.setTransform(1,0,0,1,0,0);

    //globals.texturesToUpdate.push(this.baseTexture);
};

module.exports = RenderTexture;

},{"../core/globals":2,"../events/EventTarget":9,"../geom/Point":18,"../geom/Rectangle":20,"../geom/matrix":21,"../renderers/canvas/CanvasRenderer":31,"../renderers/webgl/WebGLRenderGroup":34,"./BaseTexture":40,"./Texture":42}],42:[function(require,module,exports){
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
 * @param frame {Rectangle} The rectangle frame of the texture to show
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

},{"../events/EventTarget":9,"../geom/Point":18,"../geom/Rectangle":20,"./BaseTexture":40}],43:[function(require,module,exports){
/*
    PolyK library
    url: http://polyk.ivank.net
    Released under MIT licence.

    Copyright (c) 2012 Ivan Kuckir

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.

    This is an amazing lib!

    slightly modified by mat groves (matgroves.com);
*/
'use strict';

var platform = require('../platform');

/**
 * Checks if a point is within a triangle
 *
 * @private
 */
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy)
{
    var v0x = cx-ax;
    var v0y = cy-ay;
    var v1x = bx-ax;
    var v1y = by-ay;
    var v2x = px-ax;
    var v2y = py-ay;

    var dot00 = v0x*v0x+v0y*v0y;
    var dot01 = v0x*v1x+v0y*v1y;
    var dot02 = v0x*v2x+v0y*v2y;
    var dot11 = v1x*v1x+v1y*v1y;
    var dot12 = v1x*v2x+v1y*v2y;

    var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    // Check if point is in triangle
    return (u >= 0) && (v >= 0) && (u + v < 1);
}

/**
 * Checks if a shape is convex
 *
 * @private
 */
function convex(ax, ay, bx, by, cx, cy, sign)
{
    return ((ay-by)*(cx-bx) + (bx-ax)*(cy-by) >= 0) == sign;
}

/**
 * Triangulates shapes for webGL graphic fills
 *
 * @namespace PolyK
 * @constructor
 */
exports.triangulate = function(p)
{
    var sign = true;

    var n = p.length>>1;
    if(n<3) return [];
    var tgs = [];
    var avl = [];
    for(var i=0; i<n; i++) avl.push(i);

    i = 0;
    var al = n;
    while(al > 3)
    {
        var i0 = avl[(i+0)%al];
        var i1 = avl[(i+1)%al];
        var i2 = avl[(i+2)%al];

        var ax = p[2*i0],  ay = p[2*i0+1];
        var bx = p[2*i1],  by = p[2*i1+1];
        var cx = p[2*i2],  cy = p[2*i2+1];

        var earFound = false;
        if(convex(ax, ay, bx, by, cx, cy, sign))
        {
            earFound = true;
            for(var j=0; j<al; j++)
            {
                var vi = avl[j];
                if(vi==i0 || vi==i1 || vi==i2) continue;
                if(pointInTriangle(p[2*vi], p[2*vi+1], ax, ay, bx, by, cx, cy)) {earFound = false; break;}
            }
        }
        if(earFound)
        {
            tgs.push(i0, i1, i2);
            avl.splice((i+1)%al, 1);
            al--;
            i = 0;
        }
        else if(i++ > 3*al)
        {
            // need to flip flip reverse it!
            // reset!
            if(sign)
            {
                tgs = [];
                avl = [];
                for(i=0; i<n; i++) avl.push(i);

                i = 0;
                al = n;

                sign = false;
            }
            else
            {
                platform.console.warn("PIXI Warning: shape too complex to fill")
                return [];
            }
        }
    }
    tgs.push(avl[0], avl[1], avl[2]);
    return tgs;
}

},{"../platform":29}],44:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var platform = require('../platform');
var CanvasRenderer = require('../renderers/canvas/CanvasRenderer');
var WebGLRenderer = require('../renderers/webgl/WebGLRenderer');

/**
 * This helper function will automatically detect which renderer you should be using.
 * WebGL is the preferred renderer as it is a lot fastest. If webGL is not supported by
 * the browser then this function will return a canvas renderer
 *
 * @method autoDetectRenderer
 * @static
 * @param width {Number} the width of the renderers view
 * @param height {Number} the height of the renderers view
 * @param view {Canvas} the canvas to use as a view, optional
 * @param transparent=false {Boolean} the transparency of the render view, default false
 * @param antialias=false {Boolean} sets antialias (only applicable in webGL chrome at the moment)
 *
 * antialias
 */
module.exports = function autoDetectRenderer(width, height, view, transparent, antialias)
{
    if(!width)width = 800;
    if(!height)height = 600;

    // BORROWED from Mr Doob (mrdoob.com)
    var webgl = (function () {
        try {
            var canvas = platform.createCanvas();
            return !! platform.window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch( e ) {
            return false;
        }
    }());

    //console.log(webgl);
    if( webgl )
    {
        return new WebGLRenderer(width, height, view, transparent, antialias);
    }

    return new CanvasRenderer(width, height, view, transparent);
};

},{"../platform":29,"../renderers/canvas/CanvasRenderer":31,"../renderers/webgl/WebGLRenderer":35}],45:[function(require,module,exports){
'use strict';

/**
 * Converts a hex color number to an [R, G, B] array
 *
 * @param hex {Number}
 */
exports.hex2rgb = function hex2rgb(hex)
{
    return [(hex >> 16 & 0xFF) / 255, ( hex >> 8 & 0xFF) / 255, (hex & 0xFF)/ 255];
};

},{}],46:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
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

},{}],47:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 * based on pixi impact spine implementation made by Eemeli Kelokorpi (@ekelokorpi) https://github.com/ekelokorpi
 *
 * Awesome JS run time provided by EsotericSoftware
 * https://github.com/EsotericSoftware/spine-runtimes
 *
 */
'use strict';

/*
 * Awesome JS run time provided by EsotericSoftware
 *
 * https://github.com/EsotericSoftware/spine-runtimes
 *
 */

var spine = module.exports = {};

spine.BoneData = function (name, parent) {
    this.name = name;
    this.parent = parent;
};
spine.BoneData.prototype = {
    length: 0,
    x: 0, y: 0,
    rotation: 0,
    scaleX: 1, scaleY: 1
};

spine.SlotData = function (name, boneData) {
    this.name = name;
    this.boneData = boneData;
};
spine.SlotData.prototype = {
    r: 1, g: 1, b: 1, a: 1,
    attachmentName: null
};

spine.Bone = function (boneData, parent) {
    this.data = boneData;
    this.parent = parent;
    this.setToSetupPose();
};
spine.Bone.yDown = false;
spine.Bone.prototype = {
    x: 0, y: 0,
    rotation: 0,
    scaleX: 1, scaleY: 1,
    m00: 0, m01: 0, worldX: 0, // a b x
    m10: 0, m11: 0, worldY: 0, // c d y
    worldRotation: 0,
    worldScaleX: 1, worldScaleY: 1,
    updateWorldTransform: function (flipX, flipY) {
        var parent = this.parent;
        if (parent != null) {
            this.worldX = this.x * parent.m00 + this.y * parent.m01 + parent.worldX;
            this.worldY = this.x * parent.m10 + this.y * parent.m11 + parent.worldY;
            this.worldScaleX = parent.worldScaleX * this.scaleX;
            this.worldScaleY = parent.worldScaleY * this.scaleY;
            this.worldRotation = parent.worldRotation + this.rotation;
        } else {
            this.worldX = this.x;
            this.worldY = this.y;
            this.worldScaleX = this.scaleX;
            this.worldScaleY = this.scaleY;
            this.worldRotation = this.rotation;
        }
        var radians = this.worldRotation * Math.PI / 180;
        var cos = Math.cos(radians);
        var sin = Math.sin(radians);
        this.m00 = cos * this.worldScaleX;
        this.m10 = sin * this.worldScaleX;
        this.m01 = -sin * this.worldScaleY;
        this.m11 = cos * this.worldScaleY;
        if (flipX) {
            this.m00 = -this.m00;
            this.m01 = -this.m01;
        }
        if (flipY) {
            this.m10 = -this.m10;
            this.m11 = -this.m11;
        }
        if (spine.Bone.yDown) {
            this.m10 = -this.m10;
            this.m11 = -this.m11;
        }
    },
    setToSetupPose: function () {
        var data = this.data;
        this.x = data.x;
        this.y = data.y;
        this.rotation = data.rotation;
        this.scaleX = data.scaleX;
        this.scaleY = data.scaleY;
    }
};

spine.Slot = function (slotData, skeleton, bone) {
    this.data = slotData;
    this.skeleton = skeleton;
    this.bone = bone;
    this.setToSetupPose();
};
spine.Slot.prototype = {
    r: 1, g: 1, b: 1, a: 1,
    _attachmentTime: 0,
    attachment: null,
    setAttachment: function (attachment) {
        this.attachment = attachment;
        this._attachmentTime = this.skeleton.time;
    },
    setAttachmentTime: function (time) {
        this._attachmentTime = this.skeleton.time - time;
    },
    getAttachmentTime: function () {
        return this.skeleton.time - this._attachmentTime;
    },
    setToSetupPose: function () {
        var data = this.data;
        this.r = data.r;
        this.g = data.g;
        this.b = data.b;
        this.a = data.a;

        var slotDatas = this.skeleton.data.slots;
        for (var i = 0, n = slotDatas.length; i < n; i++) {
            if (slotDatas[i] == data) {
                this.setAttachment(!data.attachmentName ? null : this.skeleton.getAttachmentBySlotIndex(i, data.attachmentName));
                break;
            }
        }
    }
};

spine.Skin = function (name) {
    this.name = name;
    this.attachments = {};
};
spine.Skin.prototype = {
    addAttachment: function (slotIndex, name, attachment) {
        this.attachments[slotIndex + ":" + name] = attachment;
    },
    getAttachment: function (slotIndex, name) {
        return this.attachments[slotIndex + ":" + name];
    },
    _attachAll: function (skeleton, oldSkin) {
        for (var key in oldSkin.attachments) {
            var colon = key.indexOf(":");
            var slotIndex = parseInt(key.substring(0, colon), 10);
            var name = key.substring(colon + 1);
            var slot = skeleton.slots[slotIndex];
            if (slot.attachment && slot.attachment.name == name) {
                var attachment = this.getAttachment(slotIndex, name);
                if (attachment) slot.setAttachment(attachment);
            }
        }
    }
};

spine.Animation = function (name, timelines, duration) {
    this.name = name;
    this.timelines = timelines;
    this.duration = duration;
};
spine.Animation.prototype = {
    apply: function (skeleton, time, loop) {
        if (loop && this.duration) time %= this.duration;
        var timelines = this.timelines;
        for (var i = 0, n = timelines.length; i < n; i++)
            timelines[i].apply(skeleton, time, 1);
    },
    mix: function (skeleton, time, loop, alpha) {
        if (loop && this.duration) time %= this.duration;
        var timelines = this.timelines;
        for (var i = 0, n = timelines.length; i < n; i++)
            timelines[i].apply(skeleton, time, alpha);
    }
};

spine.binarySearch = function (values, target, step) {
    var low = 0;
    var high = Math.floor(values.length / step) - 2;
    if (!high) return step;
    var current = high >>> 1;
    while (true) {
        if (values[(current + 1) * step] <= target)
            low = current + 1;
        else
            high = current;
        if (low == high) return (low + 1) * step;
        current = (low + high) >>> 1;
    }
};
spine.linearSearch = function (values, target, step) {
    for (var i = 0, last = values.length - step; i <= last; i += step)
        if (values[i] > target) return i;
    return -1;
};

spine.Curves = function (frameCount) {
    this.curves = []; // dfx, dfy, ddfx, ddfy, dddfx, dddfy, ...
    this.curves.length = (frameCount - 1) * 6;
};
spine.Curves.prototype = {
    setLinear: function (frameIndex) {
        this.curves[frameIndex * 6] = 0/*LINEAR*/;
    },
    setStepped: function (frameIndex) {
        this.curves[frameIndex * 6] = -1/*STEPPED*/;
    },
    /** Sets the control handle positions for an interpolation bezier curve used to transition from this keyframe to the next.
     * cx1 and cx2 are from 0 to 1, representing the percent of time between the two keyframes. cy1 and cy2 are the percent of
     * the difference between the keyframe's values. */
    setCurve: function (frameIndex, cx1, cy1, cx2, cy2) {
        var subdiv_step = 1 / 10/*BEZIER_SEGMENTS*/;
        var subdiv_step2 = subdiv_step * subdiv_step;
        var subdiv_step3 = subdiv_step2 * subdiv_step;
        var pre1 = 3 * subdiv_step;
        var pre2 = 3 * subdiv_step2;
        var pre4 = 6 * subdiv_step2;
        var pre5 = 6 * subdiv_step3;
        var tmp1x = -cx1 * 2 + cx2;
        var tmp1y = -cy1 * 2 + cy2;
        var tmp2x = (cx1 - cx2) * 3 + 1;
        var tmp2y = (cy1 - cy2) * 3 + 1;
        var i = frameIndex * 6;
        var curves = this.curves;
        curves[i] = cx1 * pre1 + tmp1x * pre2 + tmp2x * subdiv_step3;
        curves[i + 1] = cy1 * pre1 + tmp1y * pre2 + tmp2y * subdiv_step3;
        curves[i + 2] = tmp1x * pre4 + tmp2x * pre5;
        curves[i + 3] = tmp1y * pre4 + tmp2y * pre5;
        curves[i + 4] = tmp2x * pre5;
        curves[i + 5] = tmp2y * pre5;
    },
    getCurvePercent: function (frameIndex, percent) {
        percent = percent < 0 ? 0 : (percent > 1 ? 1 : percent);
        var curveIndex = frameIndex * 6;
        var curves = this.curves;
        var dfx = curves[curveIndex];
        if (!dfx/*LINEAR*/) return percent;
        if (dfx == -1/*STEPPED*/) return 0;
        var dfy = curves[curveIndex + 1];
        var ddfx = curves[curveIndex + 2];
        var ddfy = curves[curveIndex + 3];
        var dddfx = curves[curveIndex + 4];
        var dddfy = curves[curveIndex + 5];
        var x = dfx, y = dfy;
        var i = 10/*BEZIER_SEGMENTS*/ - 2;
        while (true) {
            if (x >= percent) {
                var lastX = x - dfx;
                var lastY = y - dfy;
                return lastY + (y - lastY) * (percent - lastX) / (x - lastX);
            }
            if (!i) break;
            i--;
            dfx += ddfx;
            dfy += ddfy;
            ddfx += dddfx;
            ddfy += dddfy;
            x += dfx;
            y += dfy;
        }
        return y + (1 - y) * (percent - x) / (1 - x); // Last point is 1,1.
    }
};

spine.RotateTimeline = function (frameCount) {
    this.curves = new spine.Curves(frameCount);
    this.frames = []; // time, angle, ...
    this.frames.length = frameCount * 2;
};
spine.RotateTimeline.prototype = {
    boneIndex: 0,
    getFrameCount: function () {
        return this.frames.length / 2;
    },
    setFrame: function (frameIndex, time, angle) {
        frameIndex *= 2;
        this.frames[frameIndex] = time;
        this.frames[frameIndex + 1] = angle;
    },
    apply: function (skeleton, time, alpha) {
        var frames = this.frames,
            amount;

        if (time < frames[0]) return; // Time is before first frame.

        var bone = skeleton.bones[this.boneIndex];

        if (time >= frames[frames.length - 2]) { // Time is after last frame.
            amount = bone.data.rotation + frames[frames.length - 1] - bone.rotation;
            while (amount > 180)
                amount -= 360;
            while (amount < -180)
                amount += 360;
            bone.rotation += amount * alpha;
            return;
        }

        // Interpolate between the last frame and the current frame.
        var frameIndex = spine.binarySearch(frames, time, 2);
        var lastFrameValue = frames[frameIndex - 1];
        var frameTime = frames[frameIndex];
        var percent = 1 - (time - frameTime) / (frames[frameIndex - 2/*LAST_FRAME_TIME*/] - frameTime);
        percent = this.curves.getCurvePercent(frameIndex / 2 - 1, percent);

        amount = frames[frameIndex + 1/*FRAME_VALUE*/] - lastFrameValue;
        while (amount > 180)
            amount -= 360;
        while (amount < -180)
            amount += 360;
        amount = bone.data.rotation + (lastFrameValue + amount * percent) - bone.rotation;
        while (amount > 180)
            amount -= 360;
        while (amount < -180)
            amount += 360;
        bone.rotation += amount * alpha;
    }
};

spine.TranslateTimeline = function (frameCount) {
    this.curves = new spine.Curves(frameCount);
    this.frames = []; // time, x, y, ...
    this.frames.length = frameCount * 3;
};
spine.TranslateTimeline.prototype = {
    boneIndex: 0,
    getFrameCount: function () {
        return this.frames.length / 3;
    },
    setFrame: function (frameIndex, time, x, y) {
        frameIndex *= 3;
        this.frames[frameIndex] = time;
        this.frames[frameIndex + 1] = x;
        this.frames[frameIndex + 2] = y;
    },
    apply: function (skeleton, time, alpha) {
        var frames = this.frames;
        if (time < frames[0]) return; // Time is before first frame.

        var bone = skeleton.bones[this.boneIndex];

        if (time >= frames[frames.length - 3]) { // Time is after last frame.
            bone.x += (bone.data.x + frames[frames.length - 2] - bone.x) * alpha;
            bone.y += (bone.data.y + frames[frames.length - 1] - bone.y) * alpha;
            return;
        }

        // Interpolate between the last frame and the current frame.
        var frameIndex = spine.binarySearch(frames, time, 3);
        var lastFrameX = frames[frameIndex - 2];
        var lastFrameY = frames[frameIndex - 1];
        var frameTime = frames[frameIndex];
        var percent = 1 - (time - frameTime) / (frames[frameIndex + -3/*LAST_FRAME_TIME*/] - frameTime);
        percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

        bone.x += (bone.data.x + lastFrameX + (frames[frameIndex + 1/*FRAME_X*/] - lastFrameX) * percent - bone.x) * alpha;
        bone.y += (bone.data.y + lastFrameY + (frames[frameIndex + 2/*FRAME_Y*/] - lastFrameY) * percent - bone.y) * alpha;
    }
};

spine.ScaleTimeline = function (frameCount) {
    this.curves = new spine.Curves(frameCount);
    this.frames = []; // time, x, y, ...
    this.frames.length = frameCount * 3;
};
spine.ScaleTimeline.prototype = {
    boneIndex: 0,
    getFrameCount: function () {
        return this.frames.length / 3;
    },
    setFrame: function (frameIndex, time, x, y) {
        frameIndex *= 3;
        this.frames[frameIndex] = time;
        this.frames[frameIndex + 1] = x;
        this.frames[frameIndex + 2] = y;
    },
    apply: function (skeleton, time, alpha) {
        var frames = this.frames;
        if (time < frames[0]) return; // Time is before first frame.

        var bone = skeleton.bones[this.boneIndex];

        if (time >= frames[frames.length - 3]) { // Time is after last frame.
            bone.scaleX += (bone.data.scaleX - 1 + frames[frames.length - 2] - bone.scaleX) * alpha;
            bone.scaleY += (bone.data.scaleY - 1 + frames[frames.length - 1] - bone.scaleY) * alpha;
            return;
        }

        // Interpolate between the last frame and the current frame.
        var frameIndex = spine.binarySearch(frames, time, 3);
        var lastFrameX = frames[frameIndex - 2];
        var lastFrameY = frames[frameIndex - 1];
        var frameTime = frames[frameIndex];
        var percent = 1 - (time - frameTime) / (frames[frameIndex + -3/*LAST_FRAME_TIME*/] - frameTime);
        percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

        bone.scaleX += (bone.data.scaleX - 1 + lastFrameX + (frames[frameIndex + 1/*FRAME_X*/] - lastFrameX) * percent - bone.scaleX) * alpha;
        bone.scaleY += (bone.data.scaleY - 1 + lastFrameY + (frames[frameIndex + 2/*FRAME_Y*/] - lastFrameY) * percent - bone.scaleY) * alpha;
    }
};

spine.ColorTimeline = function (frameCount) {
    this.curves = new spine.Curves(frameCount);
    this.frames = []; // time, r, g, b, a, ...
    this.frames.length = frameCount * 5;
};
spine.ColorTimeline.prototype = {
    slotIndex: 0,
    getFrameCount: function () {
        return this.frames.length / 2;
    },
    setFrame: function (frameIndex, time, r, g, b, a) {
        frameIndex *= 5;
        this.frames[frameIndex] = time;
        this.frames[frameIndex + 1] = r;
        this.frames[frameIndex + 2] = g;
        this.frames[frameIndex + 3] = b;
        this.frames[frameIndex + 4] = a;
    },
    apply: function (skeleton, time, alpha) {
        var frames = this.frames;
        if (time < frames[0]) return; // Time is before first frame.

        var slot = skeleton.slots[this.slotIndex];

        if (time >= frames[frames.length - 5]) { // Time is after last frame.
            var i = frames.length - 1;
            slot.r = frames[i - 3];
            slot.g = frames[i - 2];
            slot.b = frames[i - 1];
            slot.a = frames[i];
            return;
        }

        // Interpolate between the last frame and the current frame.
        var frameIndex = spine.binarySearch(frames, time, 5);
        var lastFrameR = frames[frameIndex - 4];
        var lastFrameG = frames[frameIndex - 3];
        var lastFrameB = frames[frameIndex - 2];
        var lastFrameA = frames[frameIndex - 1];
        var frameTime = frames[frameIndex];
        var percent = 1 - (time - frameTime) / (frames[frameIndex - 5/*LAST_FRAME_TIME*/] - frameTime);
        percent = this.curves.getCurvePercent(frameIndex / 5 - 1, percent);

        var r = lastFrameR + (frames[frameIndex + 1/*FRAME_R*/] - lastFrameR) * percent;
        var g = lastFrameG + (frames[frameIndex + 2/*FRAME_G*/] - lastFrameG) * percent;
        var b = lastFrameB + (frames[frameIndex + 3/*FRAME_B*/] - lastFrameB) * percent;
        var a = lastFrameA + (frames[frameIndex + 4/*FRAME_A*/] - lastFrameA) * percent;
        if (alpha < 1) {
            slot.r += (r - slot.r) * alpha;
            slot.g += (g - slot.g) * alpha;
            slot.b += (b - slot.b) * alpha;
            slot.a += (a - slot.a) * alpha;
        } else {
            slot.r = r;
            slot.g = g;
            slot.b = b;
            slot.a = a;
        }
    }
};

spine.AttachmentTimeline = function (frameCount) {
    this.curves = new spine.Curves(frameCount);
    this.frames = []; // time, ...
    this.frames.length = frameCount;
    this.attachmentNames = []; // time, ...
    this.attachmentNames.length = frameCount;
};
spine.AttachmentTimeline.prototype = {
    slotIndex: 0,
    getFrameCount: function () {
            return this.frames.length;
    },
    setFrame: function (frameIndex, time, attachmentName) {
        this.frames[frameIndex] = time;
        this.attachmentNames[frameIndex] = attachmentName;
    },
    apply: function (skeleton, time, alpha) {
        var frames = this.frames;
        if (time < frames[0]) return; // Time is before first frame.

        var frameIndex;
        if (time >= frames[frames.length - 1]) // Time is after last frame.
            frameIndex = frames.length - 1;
        else
            frameIndex = spine.binarySearch(frames, time, 1) - 1;

        var attachmentName = this.attachmentNames[frameIndex];
        skeleton.slots[this.slotIndex].setAttachment(!attachmentName ? null : skeleton.getAttachmentBySlotIndex(this.slotIndex, attachmentName));
    }
};

spine.SkeletonData = function () {
    this.bones = [];
    this.slots = [];
    this.skins = [];
    this.animations = [];
};
spine.SkeletonData.prototype = {
    defaultSkin: null,
    /** @return May be null. */
    findBone: function (boneName) {
        var bones = this.bones;
        for (var i = 0, n = bones.length; i < n; i++)
            if (bones[i].name == boneName) return bones[i];
        return null;
    },
    /** @return -1 if the bone was not found. */
    findBoneIndex: function (boneName) {
        var bones = this.bones;
        for (var i = 0, n = bones.length; i < n; i++)
            if (bones[i].name == boneName) return i;
        return -1;
    },
    /** @return May be null. */
    findSlot: function (slotName) {
        var slots = this.slots;
        for (var i = 0, n = slots.length; i < n; i++) {
            if (slots[i].name == slotName) return slots[i];
        }
        return null;
    },
    /** @return -1 if the bone was not found. */
    findSlotIndex: function (slotName) {
        var slots = this.slots;
        for (var i = 0, n = slots.length; i < n; i++)
            if (slots[i].name == slotName) return i;
        return -1;
    },
    /** @return May be null. */
    findSkin: function (skinName) {
        var skins = this.skins;
        for (var i = 0, n = skins.length; i < n; i++)
            if (skins[i].name == skinName) return skins[i];
        return null;
    },
    /** @return May be null. */
    findAnimation: function (animationName) {
        var animations = this.animations;
        for (var i = 0, n = animations.length; i < n; i++)
            if (animations[i].name == animationName) return animations[i];
        return null;
    }
};

spine.Skeleton = function (skeletonData) {
    this.data = skeletonData;

    this.bones = [];
    for (var i = 0, n = skeletonData.bones.length; i < n; i++) {
        var boneData = skeletonData.bones[i];
        var parent = !boneData.parent ? null : this.bones[skeletonData.bones.indexOf(boneData.parent)];
        this.bones.push(new spine.Bone(boneData, parent));
    }

    this.slots = [];
    this.drawOrder = [];
    for (i = 0, n = skeletonData.slots.length; i < n; i++) {
        var slotData = skeletonData.slots[i];
        var bone = this.bones[skeletonData.bones.indexOf(slotData.boneData)];
        var slot = new spine.Slot(slotData, this, bone);
        this.slots.push(slot);
        this.drawOrder.push(slot);
    }
};
spine.Skeleton.prototype = {
    x: 0, y: 0,
    skin: null,
    r: 1, g: 1, b: 1, a: 1,
    time: 0,
    flipX: false, flipY: false,
    /** Updates the world transform for each bone. */
    updateWorldTransform: function () {
        var flipX = this.flipX;
        var flipY = this.flipY;
        var bones = this.bones;
        for (var i = 0, n = bones.length; i < n; i++)
            bones[i].updateWorldTransform(flipX, flipY);
    },
    /** Sets the bones and slots to their setup pose values. */
    setToSetupPose: function () {
        this.setBonesToSetupPose();
        this.setSlotsToSetupPose();
    },
    setBonesToSetupPose: function () {
        var bones = this.bones;
        for (var i = 0, n = bones.length; i < n; i++)
            bones[i].setToSetupPose();
    },
    setSlotsToSetupPose: function () {
        var slots = this.slots;
        for (var i = 0, n = slots.length; i < n; i++)
            slots[i].setToSetupPose(i);
    },
    /** @return May return null. */
    getRootBone: function () {
        return this.bones.length ? this.bones[0] : null;
    },
    /** @return May be null. */
    findBone: function (boneName) {
        var bones = this.bones;
        for (var i = 0, n = bones.length; i < n; i++)
            if (bones[i].data.name == boneName) return bones[i];
        return null;
    },
    /** @return -1 if the bone was not found. */
    findBoneIndex: function (boneName) {
        var bones = this.bones;
        for (var i = 0, n = bones.length; i < n; i++)
            if (bones[i].data.name == boneName) return i;
        return -1;
    },
    /** @return May be null. */
    findSlot: function (slotName) {
        var slots = this.slots;
        for (var i = 0, n = slots.length; i < n; i++)
            if (slots[i].data.name == slotName) return slots[i];
        return null;
    },
    /** @return -1 if the bone was not found. */
    findSlotIndex: function (slotName) {
        var slots = this.slots;
        for (var i = 0, n = slots.length; i < n; i++)
            if (slots[i].data.name == slotName) return i;
        return -1;
    },
    setSkinByName: function (skinName) {
        var skin = this.data.findSkin(skinName);
        if (!skin) throw "Skin not found: " + skinName;
        this.setSkin(skin);
    },
    /** Sets the skin used to look up attachments not found in the {@link SkeletonData#getDefaultSkin() default skin}. Attachments
     * from the new skin are attached if the corresponding attachment from the old skin was attached.
     * @param newSkin May be null. */
    setSkin: function (newSkin) {
        if (this.skin && newSkin) newSkin._attachAll(this, this.skin);
        this.skin = newSkin;
    },
    /** @return May be null. */
    getAttachmentBySlotName: function (slotName, attachmentName) {
        return this.getAttachmentBySlotIndex(this.data.findSlotIndex(slotName), attachmentName);
    },
    /** @return May be null. */
    getAttachmentBySlotIndex: function (slotIndex, attachmentName) {
        if (this.skin) {
            var attachment = this.skin.getAttachment(slotIndex, attachmentName);
            if (attachment) return attachment;
        }
        if (this.data.defaultSkin) return this.data.defaultSkin.getAttachment(slotIndex, attachmentName);
        return null;
    },
    /** @param attachmentName May be null. */
    setAttachment: function (slotName, attachmentName) {
        var slots = this.slots;
        for (var i = 0, n = slots.size; i < n; i++) {
            var slot = slots[i];
            if (slot.data.name == slotName) {
                var attachment = null;
                if (attachmentName) {
                    attachment = this.getAttachment(i, attachmentName);
                    if (attachment == null) throw "Attachment not found: " + attachmentName + ", for slot: " + slotName;
                }
                slot.setAttachment(attachment);
                return;
            }
        }
        throw "Slot not found: " + slotName;
    },
    update: function (delta) {
        this.time += delta;
    }
};

spine.AttachmentType = {
    region: 0
};

spine.RegionAttachment = function () {
    this.offset = [];
    this.offset.length = 8;
    this.uvs = [];
    this.uvs.length = 8;
};
spine.RegionAttachment.prototype = {
    x: 0, y: 0,
    rotation: 0,
    scaleX: 1, scaleY: 1,
    width: 0, height: 0,
    rendererObject: null,
    regionOffsetX: 0, regionOffsetY: 0,
    regionWidth: 0, regionHeight: 0,
    regionOriginalWidth: 0, regionOriginalHeight: 0,
    setUVs: function (u, v, u2, v2, rotate) {
        var uvs = this.uvs;
        if (rotate) {
            uvs[2/*X2*/] = u;
            uvs[3/*Y2*/] = v2;
            uvs[4/*X3*/] = u;
            uvs[5/*Y3*/] = v;
            uvs[6/*X4*/] = u2;
            uvs[7/*Y4*/] = v;
            uvs[0/*X1*/] = u2;
            uvs[1/*Y1*/] = v2;
        } else {
            uvs[0/*X1*/] = u;
            uvs[1/*Y1*/] = v2;
            uvs[2/*X2*/] = u;
            uvs[3/*Y2*/] = v;
            uvs[4/*X3*/] = u2;
            uvs[5/*Y3*/] = v;
            uvs[6/*X4*/] = u2;
            uvs[7/*Y4*/] = v2;
        }
    },
    updateOffset: function () {
        var regionScaleX = this.width / this.regionOriginalWidth * this.scaleX;
        var regionScaleY = this.height / this.regionOriginalHeight * this.scaleY;
        var localX = -this.width / 2 * this.scaleX + this.regionOffsetX * regionScaleX;
        var localY = -this.height / 2 * this.scaleY + this.regionOffsetY * regionScaleY;
        var localX2 = localX + this.regionWidth * regionScaleX;
        var localY2 = localY + this.regionHeight * regionScaleY;
        var radians = this.rotation * Math.PI / 180;
        var cos = Math.cos(radians);
        var sin = Math.sin(radians);
        var localXCos = localX * cos + this.x;
        var localXSin = localX * sin;
        var localYCos = localY * cos + this.y;
        var localYSin = localY * sin;
        var localX2Cos = localX2 * cos + this.x;
        var localX2Sin = localX2 * sin;
        var localY2Cos = localY2 * cos + this.y;
        var localY2Sin = localY2 * sin;
        var offset = this.offset;
        offset[0/*X1*/] = localXCos - localYSin;
        offset[1/*Y1*/] = localYCos + localXSin;
        offset[2/*X2*/] = localXCos - localY2Sin;
        offset[3/*Y2*/] = localY2Cos + localXSin;
        offset[4/*X3*/] = localX2Cos - localY2Sin;
        offset[5/*Y3*/] = localY2Cos + localX2Sin;
        offset[6/*X4*/] = localX2Cos - localYSin;
        offset[7/*Y4*/] = localYCos + localX2Sin;
    },
    computeVertices: function (x, y, bone, vertices) {
        x += bone.worldX;
        y += bone.worldY;
        var m00 = bone.m00;
        var m01 = bone.m01;
        var m10 = bone.m10;
        var m11 = bone.m11;
        var offset = this.offset;
        vertices[0/*X1*/] = offset[0/*X1*/] * m00 + offset[1/*Y1*/] * m01 + x;
        vertices[1/*Y1*/] = offset[0/*X1*/] * m10 + offset[1/*Y1*/] * m11 + y;
        vertices[2/*X2*/] = offset[2/*X2*/] * m00 + offset[3/*Y2*/] * m01 + x;
        vertices[3/*Y2*/] = offset[2/*X2*/] * m10 + offset[3/*Y2*/] * m11 + y;
        vertices[4/*X3*/] = offset[4/*X3*/] * m00 + offset[5/*X3*/] * m01 + x;
        vertices[5/*X3*/] = offset[4/*X3*/] * m10 + offset[5/*X3*/] * m11 + y;
        vertices[6/*X4*/] = offset[6/*X4*/] * m00 + offset[7/*Y4*/] * m01 + x;
        vertices[7/*Y4*/] = offset[6/*X4*/] * m10 + offset[7/*Y4*/] * m11 + y;
    }
}

spine.AnimationStateData = function (skeletonData) {
    this.skeletonData = skeletonData;
    this.animationToMixTime = {};
};
spine.AnimationStateData.prototype = {
        defaultMix: 0,
    setMixByName: function (fromName, toName, duration) {
        var from = this.skeletonData.findAnimation(fromName);
        if (!from) throw "Animation not found: " + fromName;
        var to = this.skeletonData.findAnimation(toName);
        if (!to) throw "Animation not found: " + toName;
        this.setMix(from, to, duration);
    },
    setMix: function (from, to, duration) {
        this.animationToMixTime[from.name + ":" + to.name] = duration;
    },
    getMix: function (from, to) {
        var time = this.animationToMixTime[from.name + ":" + to.name];
            return time ? time : this.defaultMix;
    }
};

spine.AnimationState = function (stateData) {
    this.data = stateData;
    this.queue = [];
};
spine.AnimationState.prototype = {
    current: null,
    previous: null,
    currentTime: 0,
    previousTime: 0,
    currentLoop: false,
    previousLoop: false,
    mixTime: 0,
    mixDuration: 0,
    update: function (delta) {
        this.currentTime += delta;
        this.previousTime += delta;
        this.mixTime += delta;

        if (this.queue.length > 0) {
            var entry = this.queue[0];
            if (this.currentTime >= entry.delay) {
                this._setAnimation(entry.animation, entry.loop);
                this.queue.shift();
            }
        }
    },
    apply: function (skeleton) {
        if (!this.current) return;
        if (this.previous) {
            this.previous.apply(skeleton, this.previousTime, this.previousLoop);
            var alpha = this.mixTime / this.mixDuration;
            if (alpha >= 1) {
                alpha = 1;
                this.previous = null;
            }
            this.current.mix(skeleton, this.currentTime, this.currentLoop, alpha);
        } else
            this.current.apply(skeleton, this.currentTime, this.currentLoop);
    },
    clearAnimation: function () {
        this.previous = null;
        this.current = null;
        this.queue.length = 0;
    },
    _setAnimation: function (animation, loop) {
        this.previous = null;
        if (animation && this.current) {
            this.mixDuration = this.data.getMix(this.current, animation);
            if (this.mixDuration > 0) {
                this.mixTime = 0;
                this.previous = this.current;
                this.previousTime = this.currentTime;
                this.previousLoop = this.currentLoop;
            }
        }
        this.current = animation;
        this.currentLoop = loop;
        this.currentTime = 0;
    },
    /** @see #setAnimation(Animation, Boolean) */
    setAnimationByName: function (animationName, loop) {
        var animation = this.data.skeletonData.findAnimation(animationName);
        if (!animation) throw "Animation not found: " + animationName;
        this.setAnimation(animation, loop);
    },
    /** Set the current animation. Any queued animations are cleared and the current animation time is set to 0.
     * @param animation May be null. */
    setAnimation: function (animation, loop) {
        this.queue.length = 0;
        this._setAnimation(animation, loop);
    },
    /** @see #addAnimation(Animation, Boolean, Number) */
    addAnimationByName: function (animationName, loop, delay) {
        var animation = this.data.skeletonData.findAnimation(animationName);
        if (!animation) throw "Animation not found: " + animationName;
        this.addAnimation(animation, loop, delay);
    },
    /** Adds an animation to be played delay seconds after the current or last queued animation.
     * @param delay May be <= 0 to use duration of previous animation minus any mix duration plus the negative delay. */
    addAnimation: function (animation, loop, delay) {
        var entry = {};
        entry.animation = animation;
        entry.loop = loop;

        if (!delay || delay <= 0) {
            var previousAnimation = this.queue.length ? this.queue[this.queue.length - 1].animation : this.current;
            if (previousAnimation != null)
                delay = previousAnimation.duration - this.data.getMix(previousAnimation, animation) + (delay || 0);
            else
                delay = 0;
        }
        entry.delay = delay;

        this.queue.push(entry);
    },
    /** Returns true if no animation is set or if the current time is greater than the animation duration, regardless of looping. */
    isComplete: function () {
        return !this.current || this.currentTime >= this.current.duration;
    }
};

spine.SkeletonJson = function (attachmentLoader) {
    this.attachmentLoader = attachmentLoader;
};
spine.SkeletonJson.prototype = {
    scale: 1,
    readSkeletonData: function (root) {
        /*jshint -W069*/
        var skeletonData = new spine.SkeletonData(),
            boneData;

        // Bones.
        var bones = root["bones"];
        for (var i = 0, n = bones.length; i < n; i++) {
            var boneMap = bones[i];
            var parent = null;
            if (boneMap["parent"]) {
                parent = skeletonData.findBone(boneMap["parent"]);
                if (!parent) throw "Parent bone not found: " + boneMap["parent"];
            }
            boneData = new spine.BoneData(boneMap["name"], parent);
            boneData.length = (boneMap["length"] || 0) * this.scale;
            boneData.x = (boneMap["x"] || 0) * this.scale;
            boneData.y = (boneMap["y"] || 0) * this.scale;
            boneData.rotation = (boneMap["rotation"] || 0);
            boneData.scaleX = boneMap["scaleX"] || 1;
            boneData.scaleY = boneMap["scaleY"] || 1;
            skeletonData.bones.push(boneData);
        }

        // Slots.
        var slots = root["slots"];
        for (i = 0, n = slots.length; i < n; i++) {
            var slotMap = slots[i];
            boneData = skeletonData.findBone(slotMap["bone"]);
            if (!boneData) throw "Slot bone not found: " + slotMap["bone"];
            var slotData = new spine.SlotData(slotMap["name"], boneData);

            var color = slotMap["color"];
            if (color) {
                slotData.r = spine.SkeletonJson.toColor(color, 0);
                slotData.g = spine.SkeletonJson.toColor(color, 1);
                slotData.b = spine.SkeletonJson.toColor(color, 2);
                slotData.a = spine.SkeletonJson.toColor(color, 3);
            }

            slotData.attachmentName = slotMap["attachment"];

            skeletonData.slots.push(slotData);
        }

        // Skins.
        var skins = root["skins"];
        for (var skinName in skins) {
            if (!skins.hasOwnProperty(skinName)) continue;
            var skinMap = skins[skinName];
            var skin = new spine.Skin(skinName);
            for (var slotName in skinMap) {
                if (!skinMap.hasOwnProperty(slotName)) continue;
                var slotIndex = skeletonData.findSlotIndex(slotName);
                var slotEntry = skinMap[slotName];
                for (var attachmentName in slotEntry) {
                    if (!slotEntry.hasOwnProperty(attachmentName)) continue;
                    var attachment = this.readAttachment(skin, attachmentName, slotEntry[attachmentName]);
                    if (attachment != null) skin.addAttachment(slotIndex, attachmentName, attachment);
                }
            }
            skeletonData.skins.push(skin);
            if (skin.name == "default") skeletonData.defaultSkin = skin;
        }

        // Animations.
        var animations = root["animations"];
        for (var animationName in animations) {
            if (!animations.hasOwnProperty(animationName)) continue;
            this.readAnimation(animationName, animations[animationName], skeletonData);
        }

        return skeletonData;
    },
    readAttachment: function (skin, name, map) {
        /*jshint -W069*/
        name = map["name"] || name;

        var type = spine.AttachmentType[map["type"] || "region"];

        if (type == spine.AttachmentType.region) {
            var attachment = new spine.RegionAttachment();
            attachment.x = (map["x"] || 0) * this.scale;
            attachment.y = (map["y"] || 0) * this.scale;
            attachment.scaleX = map["scaleX"] || 1;
            attachment.scaleY = map["scaleY"] || 1;
            attachment.rotation = map["rotation"] || 0;
            attachment.width = (map["width"] || 32) * this.scale;
            attachment.height = (map["height"] || 32) * this.scale;
            attachment.updateOffset();

            attachment.rendererObject = {};
            attachment.rendererObject.name = name;
            attachment.rendererObject.scale = {};
            attachment.rendererObject.scale.x = attachment.scaleX;
            attachment.rendererObject.scale.y = attachment.scaleY;
            attachment.rendererObject.rotation = -attachment.rotation * Math.PI / 180;
            return attachment;
        }

            throw "Unknown attachment type: " + type;
    },

    readAnimation: function (name, map, skeletonData) {
        /*jshint -W069*/
        var timelines = [];
        var duration = 0;
        var frameIndex, timeline, timelineName, valueMap, values,
            i, n;

        var bones = map["bones"];
        for (var boneName in bones) {
            if (!bones.hasOwnProperty(boneName)) continue;
            var boneIndex = skeletonData.findBoneIndex(boneName);
            if (boneIndex == -1) throw "Bone not found: " + boneName;
            var boneMap = bones[boneName];

            for (timelineName in boneMap) {
                if (!boneMap.hasOwnProperty(timelineName)) continue;
                values = boneMap[timelineName];
                if (timelineName == "rotate") {
                    timeline = new spine.RotateTimeline(values.length);
                    timeline.boneIndex = boneIndex;

                    frameIndex = 0;
                    for (i = 0, n = values.length; i < n; i++) {
                        valueMap = values[i];
                        timeline.setFrame(frameIndex, valueMap["time"], valueMap["angle"]);
                        spine.SkeletonJson.readCurve(timeline, frameIndex, valueMap);
                        frameIndex++;
                    }
                    timelines.push(timeline);
                    duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2]);

                } else if (timelineName == "translate" || timelineName == "scale") {
                    var timelineScale = 1;
                    if (timelineName == "scale")
                        timeline = new spine.ScaleTimeline(values.length);
                    else {
                        timeline = new spine.TranslateTimeline(values.length);
                        timelineScale = this.scale;
                    }
                    timeline.boneIndex = boneIndex;

                    frameIndex = 0;
                    for (i = 0, n = values.length; i < n; i++) {
                        valueMap = values[i];
                        var x = (valueMap["x"] || 0) * timelineScale;
                        var y = (valueMap["y"] || 0) * timelineScale;
                        timeline.setFrame(frameIndex, valueMap["time"], x, y);
                        spine.SkeletonJson.readCurve(timeline, frameIndex, valueMap);
                        frameIndex++;
                    }
                    timelines.push(timeline);
                    duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 3 - 3]);

                } else
                    throw "Invalid timeline type for a bone: " + timelineName + " (" + boneName + ")";
            }
        }
        var slots = map["slots"];
        for (var slotName in slots) {
            if (!slots.hasOwnProperty(slotName)) continue;
            var slotMap = slots[slotName];
            var slotIndex = skeletonData.findSlotIndex(slotName);

            for (timelineName in slotMap) {
                if (!slotMap.hasOwnProperty(timelineName)) continue;
                values = slotMap[timelineName];
                if (timelineName == "color") {
                    timeline = new spine.ColorTimeline(values.length);
                    timeline.slotIndex = slotIndex;

                    frameIndex = 0;
                    for (i = 0, n = values.length; i < n; i++) {
                        valueMap = values[i];
                        var color = valueMap["color"];
                        var r = spine.SkeletonJson.toColor(color, 0);
                        var g = spine.SkeletonJson.toColor(color, 1);
                        var b = spine.SkeletonJson.toColor(color, 2);
                        var a = spine.SkeletonJson.toColor(color, 3);
                        timeline.setFrame(frameIndex, valueMap["time"], r, g, b, a);
                        spine.SkeletonJson.readCurve(timeline, frameIndex, valueMap);
                        frameIndex++;
                    }
                    timelines.push(timeline);
                    duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 5 - 5]);

                } else if (timelineName == "attachment") {
                    timeline = new spine.AttachmentTimeline(values.length);
                    timeline.slotIndex = slotIndex;

                    frameIndex = 0;
                    for (i = 0, n = values.length; i < n; i++) {
                        valueMap = values[i];
                        timeline.setFrame(frameIndex++, valueMap["time"], valueMap["name"]);
                    }
                    timelines.push(timeline);
                        duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);

                } else
                    throw "Invalid timeline type for a slot: " + timelineName + " (" + slotName + ")";
            }
        }
        skeletonData.animations.push(new spine.Animation(name, timelines, duration));
    }
};
spine.SkeletonJson.readCurve = function (timeline, frameIndex, valueMap) {
    /*jshint -W069*/
    var curve = valueMap["curve"];
    if (!curve) return;
    if (curve == "stepped")
        timeline.curves.setStepped(frameIndex);
    else if (curve instanceof Array)
        timeline.curves.setCurve(frameIndex, curve[0], curve[1], curve[2], curve[3]);
};
spine.SkeletonJson.toColor = function (hexString, colorIndex) {
    if (hexString.length != 8) throw "Color hexidecimal length must be 8, recieved: " + hexString;
    return parseInt(hexString.substring(colorIndex * 2, 2), 16) / 255;
};

spine.Atlas = function (atlasText, textureLoader) {
    this.textureLoader = textureLoader;
    this.pages = [];
    this.regions = [];

    var reader = new spine.AtlasReader(atlasText);
    var tuple = [];
    tuple.length = 4;
    var page = null;
    while (true) {
        var line = reader.readLine();
        if (line == null) break;
        line = reader.trim(line);
        if (!line.length)
            page = null;
        else if (!page) {
            page = new spine.AtlasPage();
            page.name = line;

            page.format = spine.Atlas.Format[reader.readValue()];

            reader.readTuple(tuple);
            page.minFilter = spine.Atlas.TextureFilter[tuple[0]];
            page.magFilter = spine.Atlas.TextureFilter[tuple[1]];

            var direction = reader.readValue();
            page.uWrap = spine.Atlas.TextureWrap.clampToEdge;
            page.vWrap = spine.Atlas.TextureWrap.clampToEdge;
            if (direction == "x")
                page.uWrap = spine.Atlas.TextureWrap.repeat;
            else if (direction == "y")
                page.vWrap = spine.Atlas.TextureWrap.repeat;
            else if (direction == "xy")
                page.uWrap = page.vWrap = spine.Atlas.TextureWrap.repeat;

            textureLoader.load(page, line);

            this.pages.push(page);

        } else {
            var region = new spine.AtlasRegion();
            region.name = line;
            region.page = page;

            region.rotate = reader.readValue() == "true";

            reader.readTuple(tuple);
            var x = parseInt(tuple[0], 10);
            var y = parseInt(tuple[1], 10);

            reader.readTuple(tuple);
            var width = parseInt(tuple[0], 10);
            var height = parseInt(tuple[1], 10);

            region.u = x / page.width;
            region.v = y / page.height;
            if (region.rotate) {
                region.u2 = (x + height) / page.width;
                region.v2 = (y + width) / page.height;
            } else {
                region.u2 = (x + width) / page.width;
                region.v2 = (y + height) / page.height;
            }
            region.x = x;
            region.y = y;
            region.width = Math.abs(width);
            region.height = Math.abs(height);

            if (reader.readTuple(tuple) == 4) { // split is optional
                region.splits = [parseInt(tuple[0], 10), parseInt(tuple[1], 10), parseInt(tuple[2], 10), parseInt(tuple[3], 10)];

                if (reader.readTuple(tuple) == 4) { // pad is optional, but only present with splits
                    region.pads = [parseInt(tuple[0], 10), parseInt(tuple[1], 10), parseInt(tuple[2], 10), parseInt(tuple[3], 10)];

                    reader.readTuple(tuple);
                }
            }

            region.originalWidth = parseInt(tuple[0], 10);
            region.originalHeight = parseInt(tuple[1], 10);

            reader.readTuple(tuple);
            region.offsetX = parseInt(tuple[0], 10);
            region.offsetY = parseInt(tuple[1], 10);

            region.index = parseInt(reader.readValue(), 10);

            this.regions.push(region);
        }
    }
};
spine.Atlas.prototype = {
    findRegion: function (name) {
        var regions = this.regions;
        for (var i = 0, n = regions.length; i < n; i++)
            if (regions[i].name == name) return regions[i];
        return null;
    },
    dispose: function () {
        var pages = this.pages;
        for (var i = 0, n = pages.length; i < n; i++)
            this.textureLoader.unload(pages[i].rendererObject);
    },
    updateUVs: function (page) {
        var regions = this.regions;
        for (var i = 0, n = regions.length; i < n; i++) {
            var region = regions[i];
            if (region.page != page) continue;
            region.u = region.x / page.width;
            region.v = region.y / page.height;
            if (region.rotate) {
                region.u2 = (region.x + region.height) / page.width;
                region.v2 = (region.y + region.width) / page.height;
            } else {
                region.u2 = (region.x + region.width) / page.width;
                region.v2 = (region.y + region.height) / page.height;
            }
        }
    }
};

spine.Atlas.Format = {
    alpha: 0,
    intensity: 1,
    luminanceAlpha: 2,
    rgb565: 3,
    rgba4444: 4,
    rgb888: 5,
    rgba8888: 6
};

spine.Atlas.TextureFilter = {
    nearest: 0,
    linear: 1,
    mipMap: 2,
    mipMapNearestNearest: 3,
    mipMapLinearNearest: 4,
    mipMapNearestLinear: 5,
    mipMapLinearLinear: 6
};

spine.Atlas.TextureWrap = {
    mirroredRepeat: 0,
    clampToEdge: 1,
    repeat: 2
};

spine.AtlasPage = function () {};
spine.AtlasPage.prototype = {
    name: null,
    format: null,
    minFilter: null,
    magFilter: null,
    uWrap: null,
    vWrap: null,
    rendererObject: null,
    width: 0,
    height: 0
};

spine.AtlasRegion = function () {};
spine.AtlasRegion.prototype = {
    page: null,
    name: null,
    x: 0, y: 0,
    width: 0, height: 0,
    u: 0, v: 0, u2: 0, v2: 0,
    offsetX: 0, offsetY: 0,
    originalWidth: 0, originalHeight: 0,
    index: 0,
    rotate: false,
    splits: null,
    pads: null,
};

spine.AtlasReader = function (text) {
    this.lines = text.split(/\r\n|\r|\n/);
};
spine.AtlasReader.prototype = {
    index: 0,
    trim: function (value) {
        return value.replace(/^\s+|\s+$/g, "");
    },
    readLine: function () {
        if (this.index >= this.lines.length) return null;
        return this.lines[this.index++];
    },
    readValue: function () {
        var line = this.readLine();
        var colon = line.indexOf(":");
        if (colon == -1) throw "Invalid line: " + line;
        return this.trim(line.substring(colon + 1));
    },
    /** Returns the number of tuple values read (2 or 4). */
    readTuple: function (tuple) {
        var line = this.readLine();
        var colon = line.indexOf(":");
        if (colon == -1) throw "Invalid line: " + line;
        var i = 0, lastMatch= colon + 1;
        for (; i < 3; i++) {
            var comma = line.indexOf(",", lastMatch);
            if (comma == -1) {
                if (!i) throw "Invalid line: " + line;
                break;
            }
            tuple[i] = this.trim(line.substr(lastMatch, comma - lastMatch));
            lastMatch = comma + 1;
        }
        tuple[i] = this.trim(line.substring(lastMatch));
        return i + 1;
    }
}

spine.AtlasAttachmentLoader = function (atlas) {
    this.atlas = atlas;
}
spine.AtlasAttachmentLoader.prototype = {
    newAttachment: function (skin, type, name) {
        switch (type) {
        case spine.AttachmentType.region:
            var region = this.atlas.findRegion(name);
            if (!region) throw "Region not found in atlas: " + name + " (" + type + ")";
            var attachment = new spine.RegionAttachment(name);
            attachment.rendererObject = region;
            attachment.setUVs(region.u, region.v, region.u2, region.v2, region.rotate);
            attachment.regionOffsetX = region.offsetX;
            attachment.regionOffsetY = region.offsetY;
            attachment.regionWidth = region.width;
            attachment.regionHeight = region.height;
            attachment.regionOriginalWidth = region.originalWidth;
            attachment.regionOriginalHeight = region.originalHeight;
            return attachment;
        }
        throw "Unknown attachment type: " + type;
    }
}

spine.Bone.yDown = true;

},{}],48:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
// This file is copied to the build directory.
// Where the pixi module should have also been copied (so this works as expected).
global.PIXI = require('pixi');
global.requestAnimFrame = require('pixi/utils/raf');

},{"pixi":22,"pixi/utils/raf":46}]},{},[48])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9JbnRlcmFjdGlvbk1hbmFnZXIuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9jb3JlL2dsb2JhbHMuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L0Rpc3BsYXlPYmplY3QuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXIuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L01vdmllQ2xpcC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2Rpc3BsYXkvU3ByaXRlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZGlzcGxheS9TdGFnZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2Rpc3BsYXkvYmxlbmRNb2Rlcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2V2ZW50cy9FdmVudFRhcmdldC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2V4dHJhcy9DdXN0b21SZW5kZXJhYmxlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZXh0cmFzL1JvcGUuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvU3BpbmUuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvU3RyaXAuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvVGlsaW5nU3ByaXRlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9GaWx0ZXJCbG9jay5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vQ2lyY2xlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9FbGxpcHNlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9Qb2ludC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vUG9seWdvbi5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vUmVjdGFuZ2xlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9tYXRyaXguanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9pbmRleC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2xvYWRlcnMvQXNzZXRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9sb2FkZXJzL0JpdG1hcEZvbnRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9sb2FkZXJzL0ltYWdlTG9hZGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvbG9hZGVycy9Kc29uTG9hZGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvbG9hZGVycy9TcGluZUxvYWRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2xvYWRlcnMvU3ByaXRlU2hlZXRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9wbGF0Zm9ybS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3ByaW1pdGl2ZXMvR3JhcGhpY3MuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9yZW5kZXJlcnMvY2FudmFzL0NhbnZhc1JlbmRlcmVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL2NhbnZhcy9ncmFwaGljcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9XZWJHTEJhdGNoLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL3dlYmdsL1dlYkdMUmVuZGVyR3JvdXAuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xSZW5kZXJlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9ncmFwaGljcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9zaGFkZXJzLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dC9CaXRtYXBUZXh0LmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dC9UZXh0LmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dHVyZXMvQmFzZVRleHR1cmUuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS90ZXh0dXJlcy9SZW5kZXJUZXh0dXJlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dHVyZXMvVGV4dHVyZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3V0aWxzL1BvbHlrLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdXRpbHMvYXV0b0RldGVjdFJlbmRlcmVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRG9jdW1lbnRzL0RldmVsb3BtZW50L3NyYy9naXQvZ2l0aHViLmNvbS9kcmtpYml0ei9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdXRpbHMvY29sb3IuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS91dGlscy9yYWYuanMiLCIvVXNlcnMvamlzYWFjcy9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvc3JjL2dpdC9naXRodWIuY29tL2Rya2liaXR6L25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS91dGlscy9zcGluZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RvY3VtZW50cy9EZXZlbG9wbWVudC9zcmMvZ2l0L2dpdGh1Yi5jb20vZHJraWJpdHovbm9kZS1waXhpL2J1aWxkL3BpeGktMC4xLjItZGVidWcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzcUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25nQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGxCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3gwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4vY29yZS9nbG9iYWxzJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuL2dlb20vUG9pbnQnKTtcbnZhciBTcHJpdGUgPSByZXF1aXJlKCcuL2Rpc3BsYXkvU3ByaXRlJyk7XG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuL3BsYXRmb3JtJyk7XG5cbi8qKlxuICogSG9sZHMgYWxsIGluZm9ybWF0aW9uIHJlbGF0ZWQgdG8gYW4gSW50ZXJhY3Rpb24gZXZlbnRcbiAqXG4gKiBAY2xhc3MgSW50ZXJhY3Rpb25EYXRhXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gSW50ZXJhY3Rpb25EYXRhKClcbntcbiAgICAvKipcbiAgICAgKiBUaGlzIHBvaW50IHN0b3JlcyB0aGUgd29ybGQgY29vcmRzIG9mIHdoZXJlIHRoZSB0b3VjaC9tb3VzZSBldmVudCBoYXBwZW5lZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGdsb2JhbFxuICAgICAqIEB0eXBlIFBvaW50XG4gICAgICovXG4gICAgdGhpcy5nbG9iYWwgPSBuZXcgUG9pbnQoKTtcblxuICAgIC8vIHRoaXMgaXMgaGVyZSBmb3IgbGVnYWN5Li4uIGJ1dCB3aWxsIHJlbW92ZVxuICAgIHRoaXMubG9jYWwgPSBuZXcgUG9pbnQoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0YXJnZXQgU3ByaXRlIHRoYXQgd2FzIGludGVyYWN0ZWQgd2l0aFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRhcmdldFxuICAgICAqIEB0eXBlIFNwcml0ZVxuICAgICAqL1xuICAgIHRoaXMudGFyZ2V0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFdoZW4gcGFzc2VkIHRvIGFuIGV2ZW50IGhhbmRsZXIsIHRoaXMgd2lsbCBiZSB0aGUgb3JpZ2luYWwgRE9NIEV2ZW50IHRoYXQgd2FzIGNhcHR1cmVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgb3JpZ2luYWxFdmVudFxuICAgICAqIEB0eXBlIEV2ZW50XG4gICAgICovXG4gICAgdGhpcy5vcmlnaW5hbEV2ZW50ID0gbnVsbDtcbn1cblxuLyoqXG4gKiBUaGlzIHdpbGwgcmV0dXJuIHRoZSBsb2NhbCBjb29yZHMgb2YgdGhlIHNwZWNpZmllZCBkaXNwbGF5T2JqZWN0IGZvciB0aGlzIEludGVyYWN0aW9uRGF0YVxuICpcbiAqIEBtZXRob2QgZ2V0TG9jYWxQb3NpdGlvblxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9IFRoZSBEaXNwbGF5T2JqZWN0IHRoYXQgeW91IHdvdWxkIGxpa2UgdGhlIGxvY2FsIGNvb3JkcyBvZmZcbiAqIEByZXR1cm4ge1BvaW50fSBBIHBvaW50IGNvbnRhaW5pbmcgdGhlIGNvb3JkcyBvZiB0aGUgSW50ZXJhY3Rpb25EYXRhIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHRoZSBEaXNwbGF5T2JqZWN0XG4gKi9cbkludGVyYWN0aW9uRGF0YS5wcm90b3R5cGUuZ2V0TG9jYWxQb3NpdGlvbiA9IGZ1bmN0aW9uIGdldExvY2FsUG9zaXRpb24oZGlzcGxheU9iamVjdClcbntcbiAgICB2YXIgd29ybGRUcmFuc2Zvcm0gPSBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtO1xuICAgIHZhciB3b3JsZCA9IHRoaXMuZ2xvYmFsO1xuXG4gICAgLy8gZG8gYSBjaGVla3kgdHJhbnNmb3JtIHRvIGdldCB0aGUgbW91c2UgY29vcmRzO1xuICAgIHZhciBhMDAgPSB3b3JsZFRyYW5zZm9ybVswXSwgYTAxID0gd29ybGRUcmFuc2Zvcm1bMV0sIGEwMiA9IHdvcmxkVHJhbnNmb3JtWzJdLFxuICAgICAgICBhMTAgPSB3b3JsZFRyYW5zZm9ybVszXSwgYTExID0gd29ybGRUcmFuc2Zvcm1bNF0sIGExMiA9IHdvcmxkVHJhbnNmb3JtWzVdLFxuICAgICAgICBpZCA9IDEgLyAoYTAwICogYTExICsgYTAxICogLWExMCk7XG4gICAgLy8gc2V0IHRoZSBtb3VzZSBjb29yZHMuLi5cbiAgICByZXR1cm4gbmV3IFBvaW50KGExMSAqIGlkICogd29ybGQueCArIC1hMDEgKiBpZCAqIHdvcmxkLnkgKyAoYTEyICogYTAxIC0gYTAyICogYTExKSAqIGlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGEwMCAqIGlkICogd29ybGQueSArIC1hMTAgKiBpZCAqIHdvcmxkLnggKyAoLWExMiAqIGEwMCArIGEwMiAqIGExMCkgKiBpZClcbn07XG5cbi8qKlxuICogVGhlIGludGVyYWN0aW9uIG1hbmFnZXIgZGVhbHMgd2l0aCBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzLiBBbnkgRGlzcGxheU9iamVjdCBjYW4gYmUgaW50ZXJhY3RpdmVcbiAqIFRoaXMgbWFuYWdlciBhbHNvIHN1cHBvcnRzIG11bHRpdG91Y2guXG4gKlxuICogQGNsYXNzIEludGVyYWN0aW9uTWFuYWdlclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gc3RhZ2Uge1N0YWdlfSBUaGUgc3RhZ2UgdG8gaGFuZGxlIGludGVyYWN0aW9uc1xuICovXG5mdW5jdGlvbiBJbnRlcmFjdGlvbk1hbmFnZXIoc3RhZ2UpXG57XG4gICAgLyoqXG4gICAgICogYSByZWZmZXJlbmNlIHRvIHRoZSBzdGFnZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHN0YWdlXG4gICAgICogQHR5cGUgU3RhZ2VcbiAgICAgKi9cbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG5cbiAgICAvKipcbiAgICAgKiB0aGUgbW91c2UgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IG1vdXNlXG4gICAgICogQHR5cGUgSW50ZXJhY3Rpb25EYXRhXG4gICAgICovXG4gICAgdGhpcy5tb3VzZSA9IG5ldyBJbnRlcmFjdGlvbkRhdGEoKTtcblxuICAgIC8qKlxuICAgICAqIGFuIG9iamVjdCB0aGF0IHN0b3JlcyBjdXJyZW50IHRvdWNoZXMgKEludGVyYWN0aW9uRGF0YSkgYnkgaWQgcmVmZXJlbmNlXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdG91Y2hzXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgdGhpcy50b3VjaHMgPSB7fTtcblxuICAgIC8vIGhlbHBlcnNcbiAgICB0aGlzLnRlbXBQb2ludCA9IG5ldyBQb2ludCgpO1xuICAgIC8vdGhpcy50ZW1wTWF0cml4ID0gIG1hdDMuY3JlYXRlKCk7XG5cbiAgICB0aGlzLm1vdXNlb3ZlckVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy90aW55IGxpdHRsZSBpbnRlcmFjdGl2ZURhdGEgcG9vbCFcbiAgICB0aGlzLnBvb2wgPSBbXTtcblxuICAgIHRoaXMuaW50ZXJhY3RpdmVJdGVtcyA9IFtdO1xuICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50ID0gbnVsbDtcblxuICAgIHRoaXMubGFzdCA9IDA7XG59XG5cbnZhciBwcm90byA9IEludGVyYWN0aW9uTWFuYWdlci5wcm90b3R5cGU7XG5cbi8qKlxuICogRXZlbnRMaXN0ZW5lciBpbnRlcmZhY2VcbiAqL1xucHJvdG8uaGFuZGxlRXZlbnQgPSBmdW5jdGlvbiBoYW5kbGVFdmVudChldmVudClcbntcbiAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcbiAgICBjYXNlICdtb3VzZWRvd24nIDogdGhpcy5vbk1vdXNlRG93bihldmVudCk7IGJyZWFrO1xuICAgIGNhc2UgJ21vdXNlbW92ZScgOiB0aGlzLm9uTW91c2VNb3ZlKGV2ZW50KTsgYnJlYWs7XG4gICAgY2FzZSAnbW91c2V1cCcgICA6IHRoaXMub25Nb3VzZVVwKGV2ZW50KTsgICBicmVhaztcbiAgICBjYXNlICdtb3VzZW91dCcgIDogdGhpcy5vbk1vdXNlT3V0KGV2ZW50KTsgIGJyZWFrO1xuXG4gICAgY2FzZSAndG91Y2hzdGFydCcgOiB0aGlzLm9uVG91Y2hTdGFydChldmVudCk7IGJyZWFrO1xuICAgIGNhc2UgJ3RvdWNobW92ZScgIDogdGhpcy5vblRvdWNoTW92ZShldmVudCk7ICBicmVhaztcbiAgICBjYXNlICd0b3VjaGVuZCcgICA6IHRoaXMub25Ub3VjaEVuZChldmVudCk7ICAgYnJlYWs7XG4gICAgfVxufTtcblxuLyoqXG4gKiBDb2xsZWN0cyBhbiBpbnRlcmFjdGl2ZSBzcHJpdGUgcmVjdXJzaXZlbHkgdG8gaGF2ZSB0aGVpciBpbnRlcmFjdGlvbnMgbWFuYWdlZFxuICpcbiAqIEBtZXRob2QgY29sbGVjdEludGVyYWN0aXZlU3ByaXRlXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gdGhlIGRpc3BsYXlPYmplY3QgdG8gY29sbGVjdFxuICogQHBhcmFtIGlQYXJlbnQge0Rpc3BsYXlPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5jb2xsZWN0SW50ZXJhY3RpdmVTcHJpdGUgPSBmdW5jdGlvbiBjb2xsZWN0SW50ZXJhY3RpdmVTcHJpdGUoZGlzcGxheU9iamVjdCwgaVBhcmVudClcbntcbiAgICB2YXIgY2hpbGRyZW4gPSBkaXNwbGF5T2JqZWN0LmNoaWxkcmVuO1xuXG4gICAgLy8vIG1ha2UgYW4gaW50ZXJhY3Rpb24gdHJlZS4uLiB7aXRlbS5fX2ludGVyYWN0aXZlUGFyZW50fVxuICAgIGZvciAodmFyIGkgPSBjaGlsZHJlbi5sZW5ndGggLSAxOyBpID49IDA7IGktLSlcbiAgICB7XG4gICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldO1xuXG4vLyAgICAgIGlmKGNoaWxkLnZpc2libGUpIHtcbiAgICAgICAgICAgIC8vIHB1c2ggYWxsIGludGVyYWN0aXZlIGJpdHNcbiAgICAgICAgICAgIGlmKGNoaWxkLmludGVyYWN0aXZlKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlQYXJlbnQuaW50ZXJhY3RpdmVDaGlsZHJlbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy9jaGlsZC5fX2lQYXJlbnQgPSBpUGFyZW50O1xuICAgICAgICAgICAgICAgIHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5wdXNoKGNoaWxkKTtcblxuICAgICAgICAgICAgICAgIGlmKGNoaWxkLmNoaWxkcmVuLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbGxlY3RJbnRlcmFjdGl2ZVNwcml0ZShjaGlsZCwgY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjaGlsZC5fX2lQYXJlbnQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgaWYoY2hpbGQuY2hpbGRyZW4ubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29sbGVjdEludGVyYWN0aXZlU3ByaXRlKGNoaWxkLCBpUGFyZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4vLyAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIFNldHMgdGhlIHRhcmdldCBmb3IgZXZlbnQgZGVsZWdhdGlvblxuICpcbiAqIEBtZXRob2Qgc2V0VGFyZ2V0XG4gKiBAcGFyYW0gdGFyZ2V0IHtXZWJHTFJlbmRlcmVyfENhbnZhc1JlbmRlcmVyfSB0aGUgcmVuZGVyZXIgdG8gYmluZCBldmVudHMgdG9cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnNldFRhcmdldCA9IGZ1bmN0aW9uIHNldFRhcmdldCh0YXJnZXQpXG57XG4gICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0ICE9PSBudWxsKSBwbGF0Zm9ybS53aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQgPT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5zZXRUYXJnZXREb21FbGVtZW50KCB0YXJnZXQudmlldyApO1xuICAgIH1cblxuICAgIHBsYXRmb3JtLndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcywgdHJ1ZSk7XG4gICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG59O1xuXG4vKipcbiAqIFNldHMgdGhlIGRvbSBlbGVtZW50IHdoaWNoIHdpbGwgcmVjZWl2ZSBtb3VzZS90b3VjaCBldmVudHMuIFRoaXMgaXMgdXNlZnVsIGZvciB3aGVuIHlvdSBoYXZlIG90aGVyIERPTVxuICogZWxlbWVudHMgb250b3Agb2YgdGhlIHJlbmRlcmVycyBDYW52YXMgZWxlbWVudC4gV2l0aCB0aGlzIHlvdSdsbCBiZSBhYmxlIHRvIGRlbGVnYXRlIGFub3RoZXIgZG9tIGVsZW1lbnRcbiAqIHRvIHJlY2VpdmUgdGhvc2UgZXZlbnRzXG4gKlxuICogQG1ldGhvZCBzZXRUYXJnZXREb21FbGVtZW50XG4gKiBAcGFyYW0gZG9tRWxlbWVudCB7RE9NRWxlbWVudH0gdGhlIGRvbSBlbGVtZW50IHdoaWNoIHdpbGwgcmVjZWl2ZSBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5zZXRUYXJnZXREb21FbGVtZW50ID0gZnVuY3Rpb24gc2V0VGFyZ2V0RG9tRWxlbWVudChkb21FbGVtZW50KVxue1xuICAgIC8vcmVtb3ZlIHByZXZpb3VzZSBsaXN0ZW5lcnNcbiAgICBpZiAodGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuc3R5bGVbJy1tcy1jb250ZW50LXpvb21pbmcnXSA9ICcnO1xuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5zdHlsZVsnLW1zLXRvdWNoLWFjdGlvbiddID0gJyc7XG5cbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcywgdHJ1ZSk7XG4gICAgICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMsIHRydWUpO1xuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW91dCcsIHRoaXMsIHRydWUpO1xuICAgICAgICAvLyBhaW50IG5vIG11bHRpIHRvdWNoIGp1c3QgeWV0IVxuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcywgdHJ1ZSk7XG4gICAgICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcywgdHJ1ZSk7XG4gICAgICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMsIHRydWUpO1xuICAgIH1cblxuICAgIHZhciBuYXZpZ2F0b3IgPSBwbGF0Zm9ybS5uYXZpZ2F0b3I7XG4gICAgaWYgKG5hdmlnYXRvciAmJiBuYXZpZ2F0b3IubXNQb2ludGVyRW5hYmxlZCkge1xuICAgICAgICAvLyB0aW1lIHRvIHJlbW92ZSBzb21lIG9mIHRoYXQgem9vbSBpbiBqYS4uXG4gICAgICAgIGRvbUVsZW1lbnQuc3R5bGVbJy1tcy1jb250ZW50LXpvb21pbmcnXSA9ICdub25lJztcbiAgICAgICAgZG9tRWxlbWVudC5zdHlsZVsnLW1zLXRvdWNoLWFjdGlvbiddID0gJ25vbmUnO1xuICAgICAgICAvLyBETyBzb21lIHdpbmRvdyBzcGVjaWZpYyB0b3VjaCFcbiAgICB9XG5cbiAgICBkb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMsIHRydWUpO1xuICAgIGRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcywgdHJ1ZSk7XG4gICAgZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW91dCcsIHRoaXMsIHRydWUpO1xuICAgIC8vIGFpbnQgbm8gbXVsdGkgdG91Y2gganVzdCB5ZXQhXG4gICAgZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcywgdHJ1ZSk7XG4gICAgZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMsIHRydWUpO1xuICAgIGRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcywgdHJ1ZSk7XG5cbiAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudCA9IGRvbUVsZW1lbnQ7XG59O1xuXG5cbi8qKlxuICogdXBkYXRlcyB0aGUgc3RhdGUgb2YgaW50ZXJhY3RpdmUgb2JqZWN0c1xuICpcbiAqIEBtZXRob2QgdXBkYXRlXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGUgPSBmdW5jdGlvbiB1cGRhdGUoKVxue1xuICAgIGlmKCF0aGlzLnRhcmdldClyZXR1cm47XG5cbiAgICAvLyBmcmVxdWVuY3kgb2YgMzBmcHM/P1xuICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xuICAgIHZhciBkaWZmID0gbm93IC0gdGhpcy5sYXN0O1xuICAgIGRpZmYgPSAoZGlmZiAqIDMwKSAvIDEwMDA7XG4gICAgaWYgKGRpZmYgPCAxKSByZXR1cm47XG4gICAgdGhpcy5sYXN0ID0gbm93O1xuICAgIC8vXG5cbiAgICB2YXIgaSwgbDtcblxuICAgIC8vIG9rLi4gc28gbW91c2UgZXZlbnRzPz9cbiAgICAvLyB5ZXMgZm9yIG5vdyA6KVxuICAgIC8vIE9QVElNU0UgLSBob3cgb2Z0ZW4gdG8gY2hlY2s/P1xuICAgIGlmKHRoaXMuZGlydHkpXG4gICAge1xuICAgICAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgZm9yIChpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXS5pbnRlcmFjdGl2ZUNoaWxkcmVuID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmludGVyYWN0aXZlSXRlbXMgPSBbXTtcblxuICAgICAgICBpZiAodGhpcy5zdGFnZS5pbnRlcmFjdGl2ZSkgdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLnB1c2godGhpcy5zdGFnZSk7XG4gICAgICAgIC8vIGdvIHRocm91Z2ggYW5kIGNvbGxlY3QgYWxsIHRoZSBvYmplY3RzIHRoYXQgYXJlIGludGVyYWN0aXZlLi5cbiAgICAgICAgdGhpcy5jb2xsZWN0SW50ZXJhY3RpdmVTcHJpdGUodGhpcy5zdGFnZSwgdGhpcy5zdGFnZSk7XG4gICAgfVxuXG4gICAgLy8gbG9vcCB0aHJvdWdoIGludGVyYWN0aXZlIG9iamVjdHMhXG4gICAgdmFyIGxlbmd0aCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7XG5cbiAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5zdHlsZS5jdXJzb3IgPSBcImRlZmF1bHRcIjtcblxuXG4gICAgLy8gbG9vcCB0aHJvdWdoIGludGVyYWN0aXZlIG9iamVjdHMhXG4gICAgZm9yIChpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcblxuXG4gICAgICAgIC8vaWYoIWl0ZW0udmlzaWJsZSljb250aW51ZTtcblxuICAgICAgICAvLyBPUFRJTUlTQVRJT04gLSBvbmx5IGNhbGN1bGF0ZSBldmVyeSB0aW1lIGlmIHRoZSBtb3VzZW1vdmUgZnVuY3Rpb24gZXhpc3RzLi5cbiAgICAgICAgLy8gT0sgc28uLiBkb2VzIHRoZSBvYmplY3QgaGF2ZSBhbnkgb3RoZXIgaW50ZXJhY3RpdmUgZnVuY3Rpb25zP1xuICAgICAgICAvLyBoaXQtdGVzdCB0aGUgY2xpcCFcblxuXG4gICAgICAgIGlmKGl0ZW0ubW91c2VvdmVyIHx8IGl0ZW0ubW91c2VvdXQgfHwgaXRlbS5idXR0b25Nb2RlKVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBvayBzbyB0aGVyZSBhcmUgc29tZSBmdW5jdGlvbnMgc28gbGV0cyBoaXQgdGVzdCBpdC4uXG4gICAgICAgICAgICBpdGVtLl9faGl0ID0gdGhpcy5oaXRUZXN0KGl0ZW0sIHRoaXMubW91c2UpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZS50YXJnZXQgPSBpdGVtO1xuICAgICAgICAgICAgLy8gb2sgc28gZGVhbCB3aXRoIGludGVyYWN0aW9ucy4uXG4gICAgICAgICAgICAvLyBsb2tzIGxpa2UgdGhlcmUgd2FzIGEgaGl0IVxuICAgICAgICAgICAgaWYoaXRlbS5fX2hpdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtLmJ1dHRvbk1vZGUpIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwicG9pbnRlclwiO1xuXG4gICAgICAgICAgICAgICAgaWYoIWl0ZW0uX19pc092ZXIpXG4gICAgICAgICAgICAgICAge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmKGl0ZW0ubW91c2VvdmVyKWl0ZW0ubW91c2VvdmVyKHRoaXMubW91c2UpO1xuICAgICAgICAgICAgICAgICAgICBpdGVtLl9faXNPdmVyID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWYoaXRlbS5fX2lzT3ZlcilcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJvbGwgb3V0IVxuICAgICAgICAgICAgICAgICAgICBpZihpdGVtLm1vdXNlb3V0KWl0ZW0ubW91c2VvdXQodGhpcy5tb3VzZSk7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uX19pc092ZXIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0+XG4gICAgfVxufTtcblxuLyoqXG4gKiBJcyBjYWxsZWQgd2hlbiB0aGUgbW91c2UgbW92ZXMgYWNjcm9zcyB0aGUgcmVuZGVyZXIgZWxlbWVudFxuICpcbiAqIEBtZXRob2Qgb25Nb3VzZU1vdmVcbiAqIEBwYXJhbSBldmVudCB7RXZlbnR9IFRoZSBET00gZXZlbnQgb2YgdGhlIG1vdXNlIG1vdmluZ1xuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Nb3VzZU1vdmUgPSBmdW5jdGlvbiBvbk1vdXNlTW92ZShldmVudClcbntcbiAgICB0aGlzLm1vdXNlLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcbiAgICAvLyBUT0RPIG9wdGltaXplIGJ5IG5vdCBjaGVjayBFVkVSWSBUSU1FISBtYXliZSBoYWxmIGFzIG9mdGVuPyAvL1xuICAgIHZhciByZWN0ID0gdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICB0aGlzLm1vdXNlLmdsb2JhbC54ID0gKGV2ZW50LmNsaWVudFggLSByZWN0LmxlZnQpICogKHRoaXMudGFyZ2V0LndpZHRoIC8gcmVjdC53aWR0aCk7XG4gICAgdGhpcy5tb3VzZS5nbG9iYWwueSA9IChldmVudC5jbGllbnRZIC0gcmVjdC50b3ApICogKCB0aGlzLnRhcmdldC5oZWlnaHQgLyByZWN0LmhlaWdodCk7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcbiAgICAgICAgaWYgKGl0ZW0ubW91c2Vtb3ZlKSB7XG4gICAgICAgICAgICAvL2NhbGwgdGhlIGZ1bmN0aW9uIVxuICAgICAgICAgICAgaXRlbS5tb3VzZW1vdmUodGhpcy5tb3VzZSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIElzIGNhbGxlZCB3aGVuIHRoZSBtb3VzZSBidXR0b24gaXMgcHJlc3NlZCBkb3duIG9uIHRoZSByZW5kZXJlciBlbGVtZW50XG4gKlxuICogQG1ldGhvZCBvbk1vdXNlRG93blxuICogQHBhcmFtIGV2ZW50IHtFdmVudH0gVGhlIERPTSBldmVudCBvZiBhIG1vdXNlIGJ1dHRvbiBiZWluZyBwcmVzc2VkIGRvd25cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uTW91c2VEb3duID0gZnVuY3Rpb24gb25Nb3VzZURvd24oZXZlbnQpXG57XG4gICAgdGhpcy5tb3VzZS5vcmlnaW5hbEV2ZW50ID0gZXZlbnQ7XG5cbiAgICAvLyBsb29wIHRocm91Z2ggaW50ZWFjdGlvbiB0cmVlLi4uXG4gICAgLy8gaGl0IHRlc3QgZWFjaCBpdGVtISAtPlxuICAgIC8vIGdldCBpbnRlcmFjdGl2ZSBpdGVtcyB1bmRlciBwb2ludD8/XG4gICAgLy9zdGFnZS5fX2lcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHZhciBwYXJlbnQgPSB0aGlzLnN0YWdlO1xuICAgIHZhciBoaXQgPSBmYWxzZTtcblxuICAgIC8vIHdoaWxlXG4gICAgLy8gaGl0IHRlc3RcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcblxuICAgICAgICBpZihpdGVtLm1vdXNlZG93biB8fCBpdGVtLmNsaWNrKVxuICAgICAgICB7XG4gICAgICAgICAgICBpdGVtLl9fbW91c2VJc0Rvd24gPSB0cnVlO1xuICAgICAgICAgICAgaGl0ID0gaXRlbS5fX2hpdCA9IHRoaXMuaGl0VGVzdChpdGVtLCB0aGlzLm1vdXNlKTtcblxuICAgICAgICAgICAgaWYoaXRlbS5fX2hpdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvL2NhbGwgdGhlIGZ1bmN0aW9uIVxuICAgICAgICAgICAgICAgIGlmKGl0ZW0ubW91c2Vkb3duKWl0ZW0ubW91c2Vkb3duKHRoaXMubW91c2UpO1xuICAgICAgICAgICAgICAgIGl0ZW0uX19pc0Rvd24gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgLy8ganVzdCB0aGUgb25lIVxuICAgICAgICAgICAgICAgIGlmKCFpdGVtLmludGVyYWN0aXZlQ2hpbGRyZW4pYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5wcm90by5vbk1vdXNlT3V0ID0gZnVuY3Rpb24gb25Nb3VzZU91dChldmVudClcbntcbiAgICB2YXIgbGVuZ3RoID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aDtcblxuICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwiZGVmYXVsdFwiO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGl0ZW0gPSB0aGlzLmludGVyYWN0aXZlSXRlbXNbaV07XG5cbiAgICAgICAgaWYoaXRlbS5fX2lzT3ZlcilcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5tb3VzZS50YXJnZXQgPSBpdGVtO1xuICAgICAgICAgICAgaWYoaXRlbS5tb3VzZW91dClpdGVtLm1vdXNlb3V0KHRoaXMubW91c2UpO1xuICAgICAgICAgICAgaXRlbS5fX2lzT3ZlciA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBJcyBjYWxsZWQgd2hlbiB0aGUgbW91c2UgYnV0dG9uIGlzIHJlbGVhc2VkIG9uIHRoZSByZW5kZXJlciBlbGVtZW50XG4gKlxuICogQG1ldGhvZCBvbk1vdXNlVXBcbiAqIEBwYXJhbSBldmVudCB7RXZlbnR9IFRoZSBET00gZXZlbnQgb2YgYSBtb3VzZSBidXR0b24gYmVpbmcgcmVsZWFzZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uTW91c2VVcCA9IGZ1bmN0aW9uIG9uTW91c2VVcChldmVudClcbntcbiAgICB0aGlzLm1vdXNlLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcblxuICAgIHZhciB1cCA9IGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGl0ZW0gPSB0aGlzLmludGVyYWN0aXZlSXRlbXNbaV07XG5cbiAgICAgICAgaWYoaXRlbS5tb3VzZXVwIHx8IGl0ZW0ubW91c2V1cG91dHNpZGUgfHwgaXRlbS5jbGljaylcbiAgICAgICAge1xuICAgICAgICAgICAgaXRlbS5fX2hpdCA9IHRoaXMuaGl0VGVzdChpdGVtLCB0aGlzLm1vdXNlKTtcblxuICAgICAgICAgICAgaWYoaXRlbS5fX2hpdCAmJiAhdXApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy9jYWxsIHRoZSBmdW5jdGlvbiFcbiAgICAgICAgICAgICAgICBpZihpdGVtLm1vdXNldXApXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpdGVtLm1vdXNldXAodGhpcy5tb3VzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmKGl0ZW0uX19pc0Rvd24pXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZihpdGVtLmNsaWNrKWl0ZW0uY2xpY2sodGhpcy5tb3VzZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFpdGVtLmludGVyYWN0aXZlQ2hpbGRyZW4pIHVwID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtLl9faXNEb3duKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5tb3VzZXVwb3V0c2lkZSlpdGVtLm1vdXNldXBvdXRzaWRlKHRoaXMubW91c2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaXRlbS5fX2lzRG93biA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBUZXN0cyBpZiB0aGUgY3VycmVudCBtb3VzZSBjb29yZHMgaGl0IGEgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBoaXRUZXN0XG4gKiBAcGFyYW0gaXRlbSB7RGlzcGxheU9iamVjdH0gVGhlIGRpc3BsYXlPYmplY3QgdG8gdGVzdCBmb3IgYSBoaXRcbiAqIEBwYXJhbSBpbnRlcmFjdGlvbkRhdGEge0ludGVyYWN0aW9uRGF0YX0gVGhlIGludGVyYWN0aW9uZGF0YSBvYmplY3QgdG8gdXBkYXRlIGluIHRoZSBjYXNlIG9mIGEgaGl0XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5oaXRUZXN0ID0gZnVuY3Rpb24gaGl0VGVzdChpdGVtLCBpbnRlcmFjdGlvbkRhdGEpXG57XG4gICAgdmFyIHdvcmxkID0gaW50ZXJhY3Rpb25EYXRhLmdsb2JhbDtcblxuICAgIGlmKGl0ZW0udmNvdW50ICE9PSBnbG9iYWxzLnZpc2libGVDb3VudClyZXR1cm4gZmFsc2U7XG5cbiAgICB2YXIgaXNTcHJpdGUgPSAoaXRlbSBpbnN0YW5jZW9mIFNwcml0ZSksXG4gICAgICAgIHdvcmxkVHJhbnNmb3JtID0gaXRlbS53b3JsZFRyYW5zZm9ybSxcbiAgICAgICAgYTAwID0gd29ybGRUcmFuc2Zvcm1bMF0sIGEwMSA9IHdvcmxkVHJhbnNmb3JtWzFdLCBhMDIgPSB3b3JsZFRyYW5zZm9ybVsyXSxcbiAgICAgICAgYTEwID0gd29ybGRUcmFuc2Zvcm1bM10sIGExMSA9IHdvcmxkVHJhbnNmb3JtWzRdLCBhMTIgPSB3b3JsZFRyYW5zZm9ybVs1XSxcbiAgICAgICAgaWQgPSAxIC8gKGEwMCAqIGExMSArIGEwMSAqIC1hMTApLFxuICAgICAgICB4ID0gYTExICogaWQgKiB3b3JsZC54ICsgLWEwMSAqIGlkICogd29ybGQueSArIChhMTIgKiBhMDEgLSBhMDIgKiBhMTEpICogaWQsXG4gICAgICAgIHkgPSBhMDAgKiBpZCAqIHdvcmxkLnkgKyAtYTEwICogaWQgKiB3b3JsZC54ICsgKC1hMTIgKiBhMDAgKyBhMDIgKiBhMTApICogaWQ7XG5cbiAgICBpbnRlcmFjdGlvbkRhdGEudGFyZ2V0ID0gaXRlbTtcblxuICAgIC8vYSBzcHJpdGUgb3IgZGlzcGxheSBvYmplY3Qgd2l0aCBhIGhpdCBhcmVhIGRlZmluZWRcbiAgICBpZihpdGVtLmhpdEFyZWEgJiYgaXRlbS5oaXRBcmVhLmNvbnRhaW5zKSB7XG4gICAgICAgIGlmKGl0ZW0uaGl0QXJlYS5jb250YWlucyh4LCB5KSkge1xuICAgICAgICAgICAgLy9pZihpc1Nwcml0ZSlcbiAgICAgICAgICAgIGludGVyYWN0aW9uRGF0YS50YXJnZXQgPSBpdGVtO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gYSBzcHJpdGUgd2l0aCBubyBoaXRhcmVhIGRlZmluZWRcbiAgICBlbHNlIGlmKGlzU3ByaXRlKVxuICAgIHtcbiAgICAgICAgdmFyIHdpZHRoID0gaXRlbS50ZXh0dXJlLmZyYW1lLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0ID0gaXRlbS50ZXh0dXJlLmZyYW1lLmhlaWdodCxcbiAgICAgICAgICAgIHgxID0gLXdpZHRoICogaXRlbS5hbmNob3IueCxcbiAgICAgICAgICAgIHkxO1xuXG4gICAgICAgIGlmKHggPiB4MSAmJiB4IDwgeDEgKyB3aWR0aClcbiAgICAgICAge1xuICAgICAgICAgICAgeTEgPSAtaGVpZ2h0ICogaXRlbS5hbmNob3IueTtcblxuICAgICAgICAgICAgaWYoeSA+IHkxICYmIHkgPCB5MSArIGhlaWdodClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIHRhcmdldCBwcm9wZXJ0eSBpZiBhIGhpdCBpcyB0cnVlIVxuICAgICAgICAgICAgICAgIGludGVyYWN0aW9uRGF0YS50YXJnZXQgPSBpdGVtXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGl0ZW0uY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIHRlbXBJdGVtID0gaXRlbS5jaGlsZHJlbltpXTtcbiAgICAgICAgdmFyIGhpdCA9IHRoaXMuaGl0VGVzdCh0ZW1wSXRlbSwgaW50ZXJhY3Rpb25EYXRhKTtcbiAgICAgICAgaWYoaGl0KVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBobW0uLiBUT0RPIFNFVCBDT1JSRUNUIFRBUkdFVD9cbiAgICAgICAgICAgIGludGVyYWN0aW9uRGF0YS50YXJnZXQgPSBpdGVtXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07XG5cbi8qKlxuICogSXMgY2FsbGVkIHdoZW4gYSB0b3VjaCBpcyBtb3ZlZCBhY2Nyb3NzIHRoZSByZW5kZXJlciBlbGVtZW50XG4gKlxuICogQG1ldGhvZCBvblRvdWNoTW92ZVxuICogQHBhcmFtIGV2ZW50IHtFdmVudH0gVGhlIERPTSBldmVudCBvZiBhIHRvdWNoIG1vdmluZyBhY2Nyb3NzIHRoZSByZW5kZXJlciB2aWV3XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vblRvdWNoTW92ZSA9IGZ1bmN0aW9uIG9uVG91Y2hNb3ZlKGV2ZW50KVxue1xuICAgIHZhciByZWN0ID0gdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICAgIGNoYW5nZWRUb3VjaGVzID0gZXZlbnQuY2hhbmdlZFRvdWNoZXMsXG4gICAgICAgIGksIGwsIHRvdWNoRXZlbnQsIHRvdWNoRGF0YSwgaWksIGxsLCBpdGVtO1xuXG4gICAgZm9yIChpID0gMCwgbCA9IGNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHRvdWNoRXZlbnQgPSBjaGFuZ2VkVG91Y2hlc1tpXTtcbiAgICAgICAgdG91Y2hEYXRhID0gdGhpcy50b3VjaHNbdG91Y2hFdmVudC5pZGVudGlmaWVyXTtcbiAgICAgICAgdG91Y2hEYXRhLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcblxuICAgICAgICAvLyB1cGRhdGUgdGhlIHRvdWNoIHBvc2l0aW9uXG4gICAgICAgIHRvdWNoRGF0YS5nbG9iYWwueCA9ICh0b3VjaEV2ZW50LmNsaWVudFggLSByZWN0LmxlZnQpICogKHRoaXMudGFyZ2V0LndpZHRoIC8gcmVjdC53aWR0aCk7XG4gICAgICAgIHRvdWNoRGF0YS5nbG9iYWwueSA9ICh0b3VjaEV2ZW50LmNsaWVudFkgLSByZWN0LnRvcCkgICogKHRoaXMudGFyZ2V0LmhlaWdodCAvIHJlY3QuaGVpZ2h0KTtcblxuICAgICAgICBmb3IgKGlpID0gMCwgbGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpaSA8IGxsOyBpaSsrKVxuICAgICAgICB7XG4gICAgICAgICAgICBpdGVtID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2ldO1xuICAgICAgICAgICAgaWYgKGl0ZW0udG91Y2htb3ZlKSBpdGVtLnRvdWNobW92ZSh0b3VjaERhdGEpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBJcyBjYWxsZWQgd2hlbiBhIHRvdWNoIGlzIHN0YXJ0ZWQgb24gdGhlIHJlbmRlcmVyIGVsZW1lbnRcbiAqXG4gKiBAbWV0aG9kIG9uVG91Y2hTdGFydFxuICogQHBhcmFtIGV2ZW50IHtFdmVudH0gVGhlIERPTSBldmVudCBvZiBhIHRvdWNoIHN0YXJ0aW5nIG9uIHRoZSByZW5kZXJlciB2aWV3XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vblRvdWNoU3RhcnQgPSBmdW5jdGlvbiBvblRvdWNoU3RhcnQoZXZlbnQpXG57XG4gICAgdmFyIHJlY3QgPSB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgY2hhbmdlZFRvdWNoZXMgPSBldmVudC5jaGFuZ2VkVG91Y2hlcztcblxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIHRvdWNoRXZlbnQgPSBjaGFuZ2VkVG91Y2hlc1tpXTtcblxuICAgICAgICB2YXIgdG91Y2hEYXRhID0gdGhpcy5wb29sLnBvcCgpO1xuICAgICAgICBpZiAoIXRvdWNoRGF0YSkgdG91Y2hEYXRhID0gbmV3IEludGVyYWN0aW9uRGF0YSgpO1xuXG4gICAgICAgIHRvdWNoRGF0YS5vcmlnaW5hbEV2ZW50ID0gZXZlbnQ7XG5cbiAgICAgICAgdGhpcy50b3VjaHNbdG91Y2hFdmVudC5pZGVudGlmaWVyXSA9IHRvdWNoRGF0YTtcbiAgICAgICAgdG91Y2hEYXRhLmdsb2JhbC54ID0gKHRvdWNoRXZlbnQuY2xpZW50WCAtIHJlY3QubGVmdCkgKiAodGhpcy50YXJnZXQud2lkdGggLyByZWN0LndpZHRoKTtcbiAgICAgICAgdG91Y2hEYXRhLmdsb2JhbC55ID0gKHRvdWNoRXZlbnQuY2xpZW50WSAtIHJlY3QudG9wKSAgKiAodGhpcy50YXJnZXQuaGVpZ2h0IC8gcmVjdC5oZWlnaHQpO1xuXG4gICAgICAgIGZvciAodmFyIGlpID0gMCwgbGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpaSA8IGxsOyBpaSsrKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpaV07XG5cbiAgICAgICAgICAgIGlmIChpdGVtLnRvdWNoc3RhcnQgfHwgaXRlbS50YXApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaXRlbS5fX2hpdCA9IHRoaXMuaGl0VGVzdChpdGVtLCB0b3VjaERhdGEpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGl0ZW0uX19oaXQpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAvL2NhbGwgdGhlIGZ1bmN0aW9uIVxuICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbS50b3VjaHN0YXJ0KSBpdGVtLnRvdWNoc3RhcnQodG91Y2hEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5fX2lzRG93biA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uX190b3VjaERhdGEgPSB0b3VjaERhdGE7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYoIWl0ZW0uaW50ZXJhY3RpdmVDaGlsZHJlbilicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIElzIGNhbGxlZCB3aGVuIGEgdG91Y2ggaXMgZW5kZWQgb24gdGhlIHJlbmRlcmVyIGVsZW1lbnRcbiAqXG4gKiBAbWV0aG9kIG9uVG91Y2hFbmRcbiAqIEBwYXJhbSBldmVudCB7RXZlbnR9IFRoZSBET00gZXZlbnQgb2YgYSB0b3VjaCBlbmRpbmcgb24gdGhlIHJlbmRlcmVyIHZpZXdcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uVG91Y2hFbmQgPSBmdW5jdGlvbiBvblRvdWNoRW5kKGV2ZW50KVxue1xuICAgIC8vdGhpcy5tb3VzZS5vcmlnaW5hbEV2ZW50ID0gZXZlbnQ7XG4gICAgdmFyIHJlY3QgPSB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgY2hhbmdlZFRvdWNoZXMgPSBldmVudC5jaGFuZ2VkVG91Y2hlcztcblxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIHRvdWNoRXZlbnQgPSBjaGFuZ2VkVG91Y2hlc1tpXTtcbiAgICAgICAgdmFyIHRvdWNoRGF0YSA9IHRoaXMudG91Y2hzW3RvdWNoRXZlbnQuaWRlbnRpZmllcl07XG4gICAgICAgIHZhciB1cCA9IGZhbHNlO1xuICAgICAgICB0b3VjaERhdGEuZ2xvYmFsLnggPSAodG91Y2hFdmVudC5jbGllbnRYIC0gcmVjdC5sZWZ0KSAqICh0aGlzLnRhcmdldC53aWR0aCAvIHJlY3Qud2lkdGgpO1xuICAgICAgICB0b3VjaERhdGEuZ2xvYmFsLnkgPSAodG91Y2hFdmVudC5jbGllbnRZIC0gcmVjdC50b3ApICAqICh0aGlzLnRhcmdldC5oZWlnaHQgLyByZWN0LmhlaWdodCk7XG5cbiAgICAgICAgZm9yICh2YXIgaWkgPSAwLCBsbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGlpIDwgbGw7IGlpKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciBpdGVtID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2lpXTtcbiAgICAgICAgICAgIHZhciBpdGVtVG91Y2hEYXRhID0gaXRlbS5fX3RvdWNoRGF0YTsgLy8gPC0tIEhlcmUhXG4gICAgICAgICAgICBpdGVtLl9faGl0ID0gdGhpcy5oaXRUZXN0KGl0ZW0sIHRvdWNoRGF0YSk7XG5cbiAgICAgICAgICAgIGlmKGl0ZW1Ub3VjaERhdGEgPT0gdG91Y2hEYXRhKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIHNvIHRoaXMgb25lIFdBUyBkb3duLi4uXG4gICAgICAgICAgICAgICAgdG91Y2hEYXRhLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcbiAgICAgICAgICAgICAgICAvLyBoaXRUZXN0Pz9cblxuICAgICAgICAgICAgICAgIGlmKGl0ZW0udG91Y2hlbmQgfHwgaXRlbS50YXApXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZihpdGVtLl9faGl0ICYmICF1cClcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS50b3VjaGVuZClpdGVtLnRvdWNoZW5kKHRvdWNoRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihpdGVtLl9faXNEb3duKVxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGl0ZW0udGFwKWl0ZW0udGFwKHRvdWNoRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFpdGVtLmludGVyYWN0aXZlQ2hpbGRyZW4pdXAgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5fX2lzRG93bilcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpdGVtLnRvdWNoZW5kb3V0c2lkZSlpdGVtLnRvdWNoZW5kb3V0c2lkZSh0b3VjaERhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaXRlbS5fX2lzRG93biA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGl0ZW0uX190b3VjaERhdGEgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbW92ZSB0aGUgdG91Y2guLlxuICAgICAgICB0aGlzLnBvb2wucHVzaCh0b3VjaERhdGEpO1xuICAgICAgICB0aGlzLnRvdWNoc1t0b3VjaEV2ZW50LmlkZW50aWZpZXJdID0gbnVsbDtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEludGVyYWN0aW9uTWFuYWdlcjtcbiIsIi8qKlxuICogQGF1dGhvciBEci4gS2liaXR6IDxpbmZvQGRya2liaXR6LmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAvLyBhdXRvRGV0ZWN0ZWQ6IGZhbHNlLFxuXG4gICAgZ2w6IG51bGwsXG4gICAgc2hhZGVyUHJvZ3JhbTogbnVsbCxcbiAgICBwcmltaXRpdmVQcm9ncmFtOiBudWxsLFxuICAgIHN0cmlwU2hhZGVyUHJvZ3JhbTogbnVsbCxcblxuICAgIHRleHR1cmVzVG9VcGRhdGU6IFtdLFxuICAgIHRleHR1cmVzVG9EZXN0cm95OiBbXSxcbiAgICB2aXNpYmxlQ291bnQ6IDBcbn07XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgbWF0MyA9IHJlcXVpcmUoJy4uL2dlb20vbWF0cml4JykubWF0MztcblxudmFyIEZpbHRlckJsb2NrID0gcmVxdWlyZSgnLi4vZmlsdGVycy9GaWx0ZXJCbG9jaycpO1xudmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vZ2VvbS9Qb2ludCcpO1xuXG4vKipcbiAqIFRoZSBiYXNlIGNsYXNzIGZvciBhbGwgb2JqZWN0cyB0aGF0IGFyZSByZW5kZXJlZCBvbiB0aGUgc2NyZWVuLlxuICpcbiAqIEBjbGFzcyBEaXNwbGF5T2JqZWN0XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRGlzcGxheU9iamVjdCgpXG57XG4gICAgdGhpcy5sYXN0ID0gdGhpcztcbiAgICB0aGlzLmZpcnN0ID0gdGhpcztcblxuICAgIC8qKlxuICAgICAqIFRoZSBjb29yZGluYXRlIG9mIHRoZSBvYmplY3QgcmVsYXRpdmUgdG8gdGhlIGxvY2FsIGNvb3JkaW5hdGVzIG9mIHRoZSBwYXJlbnQuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgcG9zaXRpb25cbiAgICAgKiBAdHlwZSBQb2ludFxuICAgICAqL1xuICAgIHRoaXMucG9zaXRpb24gPSBuZXcgUG9pbnQoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzY2FsZSBmYWN0b3Igb2YgdGhlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBzY2FsZVxuICAgICAqIEB0eXBlIFBvaW50XG4gICAgICovXG4gICAgdGhpcy5zY2FsZSA9IG5ldyBQb2ludCgxLDEpOy8ve3g6MSwgeToxfTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBwaXZvdCBwb2ludCBvZiB0aGUgZGlzcGxheU9iamVjdCB0aGF0IGl0IHJvdGF0ZXMgYXJvdW5kXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgcGl2b3RcbiAgICAgKiBAdHlwZSBQb2ludFxuICAgICAqL1xuICAgIHRoaXMucGl2b3QgPSBuZXcgUG9pbnQoMCwwKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByb3RhdGlvbiBvZiB0aGUgb2JqZWN0IGluIHJhZGlhbnMuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgcm90YXRpb25cbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICB0aGlzLnJvdGF0aW9uID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBvcGFjaXR5IG9mIHRoZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYWxwaGFcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICB0aGlzLmFscGhhID0gMTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB2aXNpYmlsaXR5IG9mIHRoZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdmlzaWJsZVxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLnZpc2libGUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogVGhpcyBpcyB0aGUgZGVmaW5lZCBhcmVhIHRoYXQgd2lsbCBwaWNrIHVwIG1vdXNlIC8gdG91Y2ggZXZlbnRzLiBJdCBpcyBudWxsIGJ5IGRlZmF1bHQuXG4gICAgICogU2V0dGluZyBpdCBpcyBhIG5lYXQgd2F5IG9mIG9wdGltaXNpbmcgdGhlIGhpdFRlc3QgZnVuY3Rpb24gdGhhdCB0aGUgaW50ZXJhY3Rpb25NYW5hZ2VyIHdpbGwgdXNlIChhcyBpdCB3aWxsIG5vdCBuZWVkIHRvIGhpdCB0ZXN0IGFsbCB0aGUgY2hpbGRyZW4pXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgaGl0QXJlYVxuICAgICAqIEB0eXBlIFJlY3RhbmdsZXxDaXJjbGV8RWxsaXBzZXxQb2x5Z29uXG4gICAgICovXG4gICAgdGhpcy5oaXRBcmVhID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoaXMgaXMgdXNlZCB0byBpbmRpY2F0ZSBpZiB0aGUgZGlzcGxheU9iamVjdCBzaG91bGQgZGlzcGxheSBhIG1vdXNlIGhhbmQgY3Vyc29yIG9uIHJvbGxvdmVyXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYnV0dG9uTW9kZVxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLmJ1dHRvbk1vZGUgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIENhbiB0aGlzIG9iamVjdCBiZSByZW5kZXJlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHJlbmRlcmFibGVcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICovXG4gICAgdGhpcy5yZW5kZXJhYmxlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgZGlzcGxheSBvYmplY3QgY29udGFpbmVyIHRoYXQgY29udGFpbnMgdGhpcyBkaXNwbGF5IG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBwYXJlbnRcbiAgICAgKiBAdHlwZSBEaXNwbGF5T2JqZWN0Q29udGFpbmVyXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5wYXJlbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gVGhlIHN0YWdlIHRoZSBkaXNwbGF5IG9iamVjdCBpcyBjb25uZWN0ZWQgdG8sIG9yIHVuZGVmaW5lZCBpZiBpdCBpcyBub3QgY29ubmVjdGVkIHRvIHRoZSBzdGFnZS5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBzdGFnZVxuICAgICAqIEB0eXBlIFN0YWdlXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5zdGFnZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgbXVsdGlwbGllZCBhbHBoYSBvZiB0aGUgZGlzcGxheW9iamVjdFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHdvcmxkQWxwaGFcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLndvcmxkQWxwaGEgPSAxO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gV2hldGhlciBvciBub3QgdGhlIG9iamVjdCBpcyBpbnRlcmFjdGl2ZSwgZG8gbm90IHRvZ2dsZSBkaXJlY3RseSEgdXNlIHRoZSBgaW50ZXJhY3RpdmVgIHByb3BlcnR5XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgX2ludGVyYWN0aXZlXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5faW50ZXJhY3RpdmUgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIEN1cnJlbnQgdHJhbnNmb3JtIG9mIHRoZSBvYmplY3QgYmFzZWQgb24gd29ybGQgKHBhcmVudCkgZmFjdG9yc1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHdvcmxkVHJhbnNmb3JtXG4gICAgICogQHR5cGUgTWF0M1xuICAgICAqIEByZWFkT25seVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy53b3JsZFRyYW5zZm9ybSA9IG1hdDMuY3JlYXRlKCkvL21hdDMuaWRlbnRpdHkoKTtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIEN1cnJlbnQgdHJhbnNmb3JtIG9mIHRoZSBvYmplY3QgbG9jYWxseVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGxvY2FsVHJhbnNmb3JtXG4gICAgICogQHR5cGUgTWF0M1xuICAgICAqIEByZWFkT25seVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5sb2NhbFRyYW5zZm9ybSA9IG1hdDMuY3JlYXRlKCkvL21hdDMuaWRlbnRpdHkoKTtcblxuICAgIC8qKlxuICAgICAqIFtOWUldIFVua293blxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGNvbG9yXG4gICAgICogQHR5cGUgQXJyYXk8PlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5jb2xvciA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogW05ZSV0gSG9sZHMgd2hldGhlciBvciBub3QgdGhpcyBvYmplY3QgaXMgZHluYW1pYywgZm9yIHJlbmRlcmluZyBvcHRpbWl6YXRpb25cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBkeW5hbWljXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5keW5hbWljID0gdHJ1ZTtcblxuICAgIC8vIGNoYWNoIHRoYXQgcHVwcHkhXG4gICAgdGhpcy5fc3IgPSAwO1xuICAgIHRoaXMuX2NyID0gMTtcblxuICAgIC8qXG4gICAgICogTU9VU0UgQ2FsbGJhY2tzXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VycyBjbGlja3Mgb24gdGhlIGRpc3BsYXlPYmplY3Qgd2l0aCB0aGVpciBtb3VzZVxuICAgICAqIEBtZXRob2QgY2xpY2tcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIGNsaWNrcyB0aGUgbW91c2UgZG93biBvdmVyIHRoZSBzcHJpdGVcbiAgICAgKiBAbWV0aG9kIG1vdXNlZG93blxuICAgICAqIEBwYXJhbSBpbnRlcmFjdGlvbkRhdGEge0ludGVyYWN0aW9uRGF0YX1cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEEgY2FsbGJhY2sgdGhhdCBpcyB1c2VkIHdoZW4gdGhlIHVzZXIgcmVsZWFzZXMgdGhlIG1vdXNlIHRoYXQgd2FzIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBmb3IgdGhpcyBjYWxsYmFjayB0byBiZSBmaXJlZCB0aGUgbW91c2UgbXVzdCBoYXZlIGJlZW4gcHJlc3NlZCBkb3duIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBAbWV0aG9kIG1vdXNldXBcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIHJlbGVhc2VzIHRoZSBtb3VzZSB0aGF0IHdhcyBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0IGJ1dCBpcyBubyBsb25nZXIgb3ZlciB0aGUgZGlzcGxheU9iamVjdFxuICAgICAqIGZvciB0aGlzIGNhbGxiYWNrIHRvIGJlIGZpcmVkLCBUaGUgdG91Y2ggbXVzdCBoYXZlIHN0YXJ0ZWQgb3ZlciB0aGUgZGlzcGxheU9iamVjdFxuICAgICAqIEBtZXRob2QgbW91c2V1cG91dHNpZGVcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VycyBtb3VzZSByb2xscyBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0XG4gICAgICogQG1ldGhvZCBtb3VzZW92ZXJcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VycyBtb3VzZSBsZWF2ZXMgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBAbWV0aG9kIG1vdXNlb3V0XG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG5cbiAgICAvKlxuICAgICAqIFRPVUNIIENhbGxiYWNrc1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlcnMgdGFwcyBvbiB0aGUgc3ByaXRlIHdpdGggdGhlaXIgZmluZ2VyXG4gICAgICogYmFzaWNhbGx5IGEgdG91Y2ggdmVyc2lvbiBvZiBjbGlja1xuICAgICAqIEBtZXRob2QgdGFwXG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlciB0b3VjaCdzIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBAbWV0aG9kIHRvdWNoc3RhcnRcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIHJlbGVhc2VzIGEgdG91Y2ggb3ZlciB0aGUgZGlzcGxheU9iamVjdFxuICAgICAqIEBtZXRob2QgdG91Y2hlbmRcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIHJlbGVhc2VzIHRoZSB0b3VjaCB0aGF0IHdhcyBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0XG4gICAgICogZm9yIHRoaXMgY2FsbGJhY2sgdG8gYmUgZmlyZWQsIFRoZSB0b3VjaCBtdXN0IGhhdmUgc3RhcnRlZCBvdmVyIHRoZSBzcHJpdGVcbiAgICAgKiBAbWV0aG9kIHRvdWNoZW5kb3V0c2lkZVxuICAgICAqIEBwYXJhbSBpbnRlcmFjdGlvbkRhdGEge0ludGVyYWN0aW9uRGF0YX1cbiAgICAgKi9cbn1cbnZhciBwcm90byA9IERpc3BsYXlPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIEluZGljYXRlcyBpZiB0aGUgc3ByaXRlIHdpbGwgaGF2ZSB0b3VjaCBhbmQgbW91c2UgaW50ZXJhY3Rpdml0eS4gSXQgaXMgZmFsc2UgYnkgZGVmYXVsdFxuICpcbiAqIEBwcm9wZXJ0eSBpbnRlcmFjdGl2ZVxuICogQHR5cGUgQm9vbGVhblxuICogQGRlZmF1bHQgZmFsc2VcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnaW50ZXJhY3RpdmUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludGVyYWN0aXZlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9pbnRlcmFjdGl2ZSA9IHZhbHVlO1xuXG4gICAgICAgIC8vIFRPRE8gbW9yZSB0byBiZSBkb25lIGhlcmUuLlxuICAgICAgICAvLyBuZWVkIHRvIHNvcnQgb3V0IGEgcmUtY3Jhd2whXG4gICAgICAgIGlmKHRoaXMuc3RhZ2UpdGhpcy5zdGFnZS5kaXJ0eSA9IHRydWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogU2V0cyBhIG1hc2sgZm9yIHRoZSBkaXNwbGF5T2JqZWN0LiBBIG1hc2sgaXMgYW4gb2JqZWN0IHRoYXQgbGltaXRzIHRoZSB2aXNpYmlsaXR5IG9mIGFuIG9iamVjdCB0byB0aGUgc2hhcGUgb2YgdGhlIG1hc2sgYXBwbGllZCB0byBpdC5cbiAqIEluIFBpeGkgYSByZWd1bGFyIG1hc2sgbXVzdCBiZSBhIEdyYXBoaWNzIG9iamVjdC4gVGhpcyBhbGxvd3MgZm9yIG11Y2ggZmFzdGVyIG1hc2tpbmcgaW4gY2FudmFzIGFzIGl0IHV0aWxpc2VzIHNoYXBlIGNsaXBwaW5nLlxuICogVG8gcmVtb3ZlIGEgbWFzaywgc2V0IHRoaXMgcHJvcGVydHkgdG8gbnVsbC5cbiAqXG4gKiBAcHJvcGVydHkgbWFza1xuICogQHR5cGUgR3JhcGhpY3NcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnbWFzaycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFzaztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcblxuICAgICAgICB0aGlzLl9tYXNrID0gdmFsdWU7XG5cbiAgICAgICAgaWYodmFsdWUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuYWRkRmlsdGVyKHZhbHVlKVxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgIHRoaXMucmVtb3ZlRmlsdGVyKCk7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuLyoqXG4gKiBbRGVwcmVjYXRlZF0gSW5kaWNhdGVzIGlmIHRoZSBzcHJpdGUgd2lsbCBoYXZlIHRvdWNoIGFuZCBtb3VzZSBpbnRlcmFjdGl2aXR5LiBJdCBpcyBmYWxzZSBieSBkZWZhdWx0XG4gKiBJbnN0ZWFkIG9mIHVzaW5nIHRoaXMgZnVuY3Rpb24geW91IGNhbiBub3cgc2ltcGx5IHNldCB0aGUgaW50ZXJhY3RpdmUgcHJvcGVydHkgdG8gdHJ1ZSBvciBmYWxzZVxuICpcbiAqIEBkZXByZWNhdGVkXG4gKiBAbWV0aG9kIHNldEludGVyYWN0aXZlXG4gKiBAcGFyYW0gaW50ZXJhY3RpdmUge0Jvb2xlYW59XG4gKiBAZGVwcmVjYXRlZCBTaW1wbHkgc2V0IHRoZSBgaW50ZXJhY3RpdmVgIHByb3BlcnR5IGRpcmVjdGx5XG4gKi9cbnByb3RvLnNldEludGVyYWN0aXZlID0gZnVuY3Rpb24gc2V0SW50ZXJhY3RpdmUoaW50ZXJhY3RpdmUpXG57XG4gICAgdGhpcy5pbnRlcmFjdGl2ZSA9IGludGVyYWN0aXZlO1xufTtcblxuLypcbiAqIEFkZHMgYSBmaWx0ZXIgdG8gdGhpcyBkaXNwbGF5T2JqZWN0XG4gKlxuICogQG1ldGhvZCBhZGRGaWx0ZXJcbiAqIEBwYXJhbSBtYXNrIHtHcmFwaGljc30gdGhlIGdyYXBoaWNzIG9iamVjdCB0byB1c2UgYXMgYSBmaWx0ZXJcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmFkZEZpbHRlciA9IGZ1bmN0aW9uIGFkZEZpbHRlcihtYXNrKVxue1xuICAgIGlmKHRoaXMuZmlsdGVyKXJldHVybjtcbiAgICB0aGlzLmZpbHRlciA9IHRydWU7XG5cbiAgICAvLyBpbnNlcnQgYSBmaWx0ZXIgYmxvY2suLlxuICAgIHZhciBzdGFydCA9IG5ldyBGaWx0ZXJCbG9jaygpO1xuICAgIHZhciBlbmQgPSBuZXcgRmlsdGVyQmxvY2soKTtcblxuICAgIHN0YXJ0Lm1hc2sgPSBtYXNrO1xuICAgIGVuZC5tYXNrID0gbWFzaztcblxuICAgIHN0YXJ0LmZpcnN0ID0gc3RhcnQubGFzdCA9ICB0aGlzO1xuICAgIGVuZC5maXJzdCA9IGVuZC5sYXN0ID0gdGhpcztcblxuICAgIHN0YXJ0Lm9wZW4gPSB0cnVlO1xuXG4gICAgLypcbiAgICAgKiBpbnNlcnQgc3RhcnRcbiAgICAgKi9cblxuICAgIHZhciBjaGlsZEZpcnN0LCBjaGlsZExhc3QsXG4gICAgICAgIG5leHRPYmplY3QsIHByZXZpb3VzT2JqZWN0O1xuXG4gICAgY2hpbGRGaXJzdCA9IGNoaWxkTGFzdCA9IHN0YXJ0O1xuICAgIHByZXZpb3VzT2JqZWN0ID0gdGhpcy5maXJzdC5faVByZXY7XG5cbiAgICBpZihwcmV2aW91c09iamVjdClcbiAgICB7XG4gICAgICAgIG5leHRPYmplY3QgPSBwcmV2aW91c09iamVjdC5faU5leHQ7XG4gICAgICAgIGNoaWxkRmlyc3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IGNoaWxkRmlyc3Q7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIG5leHRPYmplY3QgPSB0aGlzO1xuICAgIH1cblxuICAgIGlmKG5leHRPYmplY3QpXG4gICAge1xuICAgICAgICBuZXh0T2JqZWN0Ll9pUHJldiA9IGNoaWxkTGFzdDtcbiAgICAgICAgY2hpbGRMYXN0Ll9pTmV4dCA9IG5leHRPYmplY3Q7XG4gICAgfVxuXG5cbiAgICAvLyBub3cgaW5zZXJ0IHRoZSBlbmQgZmlsdGVyIGJsb2NrLi5cblxuICAgIC8qXG4gICAgICogaW5zZXJ0IGVuZCBmaWx0ZXJcbiAgICAgKi9cbiAgICBjaGlsZEZpcnN0ID0gZW5kO1xuICAgIGNoaWxkTGFzdCA9IGVuZDtcbiAgICBuZXh0T2JqZWN0ID0gbnVsbDtcbiAgICBwcmV2aW91c09iamVjdCA9IG51bGw7XG5cbiAgICBwcmV2aW91c09iamVjdCA9IHRoaXMubGFzdDtcbiAgICBuZXh0T2JqZWN0ID0gcHJldmlvdXNPYmplY3QuX2lOZXh0O1xuXG4gICAgaWYobmV4dE9iamVjdClcbiAgICB7XG4gICAgICAgIG5leHRPYmplY3QuX2lQcmV2ID0gY2hpbGRMYXN0O1xuICAgICAgICBjaGlsZExhc3QuX2lOZXh0ID0gbmV4dE9iamVjdDtcbiAgICB9XG5cbiAgICBjaGlsZEZpcnN0Ll9pUHJldiA9IHByZXZpb3VzT2JqZWN0O1xuICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IGNoaWxkRmlyc3Q7XG5cbiAgICB2YXIgdXBkYXRlTGFzdCA9IHRoaXM7XG5cbiAgICB2YXIgcHJldkxhc3QgPSB0aGlzLmxhc3Q7XG4gICAgd2hpbGUodXBkYXRlTGFzdClcbiAgICB7XG4gICAgICAgIGlmKHVwZGF0ZUxhc3QubGFzdCA9PSBwcmV2TGFzdClcbiAgICAgICAge1xuICAgICAgICAgICAgdXBkYXRlTGFzdC5sYXN0ID0gZW5kO1xuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZUxhc3QgPSB1cGRhdGVMYXN0LnBhcmVudDtcbiAgICB9XG5cbiAgICB0aGlzLmZpcnN0ID0gc3RhcnQ7XG5cbiAgICAvLyBpZiB3ZWJHTC4uLlxuICAgIGlmKHRoaXMuX19yZW5kZXJHcm91cClcbiAgICB7XG4gICAgICAgIHRoaXMuX19yZW5kZXJHcm91cC5hZGRGaWx0ZXJCbG9ja3Moc3RhcnQsIGVuZCk7XG4gICAgfVxuXG4gICAgbWFzay5yZW5kZXJhYmxlID0gZmFsc2U7XG59O1xuXG4vKlxuICogUmVtb3ZlcyB0aGUgZmlsdGVyIHRvIHRoaXMgZGlzcGxheU9iamVjdFxuICpcbiAqIEBtZXRob2QgcmVtb3ZlRmlsdGVyXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW1vdmVGaWx0ZXIgPSBmdW5jdGlvbiByZW1vdmVGaWx0ZXIoKVxue1xuICAgIGlmKCF0aGlzLmZpbHRlcilyZXR1cm47XG4gICAgdGhpcy5maWx0ZXIgPSBmYWxzZTtcblxuICAgIC8vIG1vZGlmeSB0aGUgbGlzdC4uXG4gICAgdmFyIHN0YXJ0QmxvY2sgPSB0aGlzLmZpcnN0O1xuXG4gICAgdmFyIG5leHRPYmplY3QgPSBzdGFydEJsb2NrLl9pTmV4dDtcbiAgICB2YXIgcHJldmlvdXNPYmplY3QgPSBzdGFydEJsb2NrLl9pUHJldjtcblxuICAgIGlmKG5leHRPYmplY3QpbmV4dE9iamVjdC5faVByZXYgPSBwcmV2aW91c09iamVjdDtcbiAgICBpZihwcmV2aW91c09iamVjdClwcmV2aW91c09iamVjdC5faU5leHQgPSBuZXh0T2JqZWN0O1xuXG4gICAgdGhpcy5maXJzdCA9IHN0YXJ0QmxvY2suX2lOZXh0O1xuXG5cbiAgICAvLyByZW1vdmUgdGhlIGVuZCBmaWx0ZXJcbiAgICB2YXIgbGFzdEJsb2NrID0gdGhpcy5sYXN0O1xuXG4gICAgbmV4dE9iamVjdCA9IGxhc3RCbG9jay5faU5leHQ7XG4gICAgcHJldmlvdXNPYmplY3QgPSBsYXN0QmxvY2suX2lQcmV2O1xuXG4gICAgaWYobmV4dE9iamVjdCluZXh0T2JqZWN0Ll9pUHJldiA9IHByZXZpb3VzT2JqZWN0O1xuICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IG5leHRPYmplY3Q7XG5cbiAgICAvLyB0aGlzIGlzIGFsd2F5cyB0cnVlIHRvbyFcbiAgICB2YXIgdGVtcExhc3QgPSAgbGFzdEJsb2NrLl9pUHJldjtcbiAgICAvLyBuZWVkIHRvIG1ha2Ugc3VyZSB0aGUgcGFyZW50cyBsYXN0IGlzIHVwZGF0ZWQgdG9vXG4gICAgdmFyIHVwZGF0ZUxhc3QgPSB0aGlzO1xuICAgIHdoaWxlKHVwZGF0ZUxhc3QubGFzdCA9PSBsYXN0QmxvY2spXG4gICAge1xuICAgICAgICB1cGRhdGVMYXN0Lmxhc3QgPSB0ZW1wTGFzdDtcbiAgICAgICAgdXBkYXRlTGFzdCA9IHVwZGF0ZUxhc3QucGFyZW50O1xuICAgICAgICBpZighdXBkYXRlTGFzdClicmVhaztcbiAgICB9XG5cbiAgICB2YXIgbWFzayA9IHN0YXJ0QmxvY2subWFza1xuICAgIG1hc2sucmVuZGVyYWJsZSA9IHRydWU7XG5cbiAgICAvLyBpZiB3ZWJHTC4uLlxuICAgIGlmKHRoaXMuX19yZW5kZXJHcm91cClcbiAgICB7XG4gICAgICAgIHRoaXMuX19yZW5kZXJHcm91cC5yZW1vdmVGaWx0ZXJCbG9ja3Moc3RhcnRCbG9jaywgbGFzdEJsb2NrKTtcbiAgICB9XG59O1xuXG4vKlxuICogVXBkYXRlcyB0aGUgb2JqZWN0IHRyYW5zZm9ybSBmb3IgcmVuZGVyaW5nXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgLy8gVE9ETyBPUFRJTUlaRSBUSElTISEgd2l0aCBkaXJ0eVxuICAgIGlmKHRoaXMucm90YXRpb24gIT09IHRoaXMucm90YXRpb25DYWNoZSlcbiAgICB7XG4gICAgICAgIHRoaXMucm90YXRpb25DYWNoZSA9IHRoaXMucm90YXRpb247XG4gICAgICAgIHRoaXMuX3NyID0gIE1hdGguc2luKHRoaXMucm90YXRpb24pO1xuICAgICAgICB0aGlzLl9jciA9ICBNYXRoLmNvcyh0aGlzLnJvdGF0aW9uKTtcbiAgICB9XG5cbiAgICB2YXIgbG9jYWxUcmFuc2Zvcm0gPSB0aGlzLmxvY2FsVHJhbnNmb3JtO1xuICAgIHZhciBwYXJlbnRUcmFuc2Zvcm0gPSB0aGlzLnBhcmVudC53b3JsZFRyYW5zZm9ybTtcbiAgICB2YXIgd29ybGRUcmFuc2Zvcm0gPSB0aGlzLndvcmxkVHJhbnNmb3JtO1xuICAgIC8vY29uc29sZS5sb2cobG9jYWxUcmFuc2Zvcm0pXG4gICAgbG9jYWxUcmFuc2Zvcm1bMF0gPSB0aGlzLl9jciAqIHRoaXMuc2NhbGUueDtcbiAgICBsb2NhbFRyYW5zZm9ybVsxXSA9IC10aGlzLl9zciAqIHRoaXMuc2NhbGUueVxuICAgIGxvY2FsVHJhbnNmb3JtWzNdID0gdGhpcy5fc3IgKiB0aGlzLnNjYWxlLng7XG4gICAgbG9jYWxUcmFuc2Zvcm1bNF0gPSB0aGlzLl9jciAqIHRoaXMuc2NhbGUueTtcblxuICAgIC8vIFRPRE8gLS0+IGRvIHdlIGV2ZW4gbmVlZCBhIGxvY2FsIG1hdHJpeD8/P1xuXG4gICAgdmFyIHB4ID0gdGhpcy5waXZvdC54O1xuICAgIHZhciBweSA9IHRoaXMucGl2b3QueTtcblxuICAgIC8vIENhY2hlIHRoZSBtYXRyaXggdmFsdWVzIChtYWtlcyBmb3IgaHVnZSBzcGVlZCBpbmNyZWFzZXMhKVxuICAgIHZhciBhMDAgPSBsb2NhbFRyYW5zZm9ybVswXSwgYTAxID0gbG9jYWxUcmFuc2Zvcm1bMV0sIGEwMiA9IHRoaXMucG9zaXRpb24ueCAtIGxvY2FsVHJhbnNmb3JtWzBdICogcHggLSBweSAqIGxvY2FsVHJhbnNmb3JtWzFdLFxuICAgICAgICBhMTAgPSBsb2NhbFRyYW5zZm9ybVszXSwgYTExID0gbG9jYWxUcmFuc2Zvcm1bNF0sIGExMiA9IHRoaXMucG9zaXRpb24ueSAtIGxvY2FsVHJhbnNmb3JtWzRdICogcHkgLSBweCAqIGxvY2FsVHJhbnNmb3JtWzNdLFxuXG4gICAgICAgIGIwMCA9IHBhcmVudFRyYW5zZm9ybVswXSwgYjAxID0gcGFyZW50VHJhbnNmb3JtWzFdLCBiMDIgPSBwYXJlbnRUcmFuc2Zvcm1bMl0sXG4gICAgICAgIGIxMCA9IHBhcmVudFRyYW5zZm9ybVszXSwgYjExID0gcGFyZW50VHJhbnNmb3JtWzRdLCBiMTIgPSBwYXJlbnRUcmFuc2Zvcm1bNV07XG5cbiAgICBsb2NhbFRyYW5zZm9ybVsyXSA9IGEwMlxuICAgIGxvY2FsVHJhbnNmb3JtWzVdID0gYTEyXG5cbiAgICB3b3JsZFRyYW5zZm9ybVswXSA9IGIwMCAqIGEwMCArIGIwMSAqIGExMDtcbiAgICB3b3JsZFRyYW5zZm9ybVsxXSA9IGIwMCAqIGEwMSArIGIwMSAqIGExMTtcbiAgICB3b3JsZFRyYW5zZm9ybVsyXSA9IGIwMCAqIGEwMiArIGIwMSAqIGExMiArIGIwMjtcblxuICAgIHdvcmxkVHJhbnNmb3JtWzNdID0gYjEwICogYTAwICsgYjExICogYTEwO1xuICAgIHdvcmxkVHJhbnNmb3JtWzRdID0gYjEwICogYTAxICsgYjExICogYTExO1xuICAgIHdvcmxkVHJhbnNmb3JtWzVdID0gYjEwICogYTAyICsgYjExICogYTEyICsgYjEyO1xuXG4gICAgLy8gYmVjYXVzZSB3ZSBhcmUgdXNpbmcgYWZmaW5lIHRyYW5zZm9ybWF0aW9uLCB3ZSBjYW4gb3B0aW1pc2UgdGhlIG1hdHJpeCBjb25jYXRlbmF0aW9uIHByb2Nlc3MuLiB3b29vIVxuICAgIC8vIG1hdDMubXVsdGlwbHkodGhpcy5sb2NhbFRyYW5zZm9ybSwgdGhpcy5wYXJlbnQud29ybGRUcmFuc2Zvcm0sIHRoaXMud29ybGRUcmFuc2Zvcm0pO1xuICAgIHRoaXMud29ybGRBbHBoYSA9IHRoaXMuYWxwaGEgKiB0aGlzLnBhcmVudC53b3JsZEFscGhhO1xuXG4gICAgdGhpcy52Y291bnQgPSBnbG9iYWxzLnZpc2libGVDb3VudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGlzcGxheU9iamVjdDtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIERpc3BsYXlPYmplY3QgPSByZXF1aXJlKCcuL0Rpc3BsYXlPYmplY3QnKTtcblxuLyoqXG4gKiBBIERpc3BsYXlPYmplY3RDb250YWluZXIgcmVwcmVzZW50cyBhIGNvbGxlY3Rpb24gb2YgZGlzcGxheSBvYmplY3RzLlxuICogSXQgaXMgdGhlIGJhc2UgY2xhc3Mgb2YgYWxsIGRpc3BsYXkgb2JqZWN0cyB0aGF0IGFjdCBhcyBhIGNvbnRhaW5lciBmb3Igb3RoZXIgb2JqZWN0cy5cbiAqXG4gKiBAY2xhc3MgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdFxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERpc3BsYXlPYmplY3RDb250YWluZXIoKVxue1xuICAgIERpc3BsYXlPYmplY3QuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBvZiBjaGlsZHJlbiBvZiB0aGlzIGNvbnRhaW5lci5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjaGlsZHJlblxuICAgICAqIEB0eXBlIEFycmF5PERpc3BsYXlPYmplY3Q+XG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xufVxuXG52YXIgcHJvdG8gPSBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGlzcGxheU9iamVjdC5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBEaXNwbGF5T2JqZWN0Q29udGFpbmVyfVxufSk7XG5cbi8vVE9ETyBtYWtlIHZpc2libGUgYSBnZXR0ZXIgc2V0dGVyXG4vKlxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAndmlzaWJsZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdmlzaWJsZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdmlzaWJsZSA9IHZhbHVlO1xuXG4gICAgfVxufSk7Ki9cblxuLyoqXG4gKiBBZGRzIGEgY2hpbGQgdG8gdGhlIGNvbnRhaW5lci5cbiAqXG4gKiBAbWV0aG9kIGFkZENoaWxkXG4gKiBAcGFyYW0gY2hpbGQge0Rpc3BsYXlPYmplY3R9IFRoZSBEaXNwbGF5T2JqZWN0IHRvIGFkZCB0byB0aGUgY29udGFpbmVyXG4gKi9cbnByb3RvLmFkZENoaWxkID0gZnVuY3Rpb24gYWRkQ2hpbGQoY2hpbGQpXG57XG4gICAgaWYgKGNoaWxkLnBhcmVudCkge1xuICAgICAgICAvLy8vIENPVUxEIEJFIFRISVM/Pz9cbiAgICAgICAgY2hpbGQucGFyZW50LnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAvLyAgcmV0dXJuO1xuICAgIH1cbiAgICBjaGlsZC5wYXJlbnQgPSB0aGlzO1xuXG4gICAgdGhpcy5jaGlsZHJlbi5wdXNoKGNoaWxkKTtcblxuICAgIC8vIHVwZGF0ZSB0aGUgc3RhZ2UgcmVmZmVyZW5jZS4uXG5cbiAgICBpZih0aGlzLnN0YWdlKVxuICAgIHtcbiAgICAgICAgdmFyIHRtcENoaWxkID0gY2hpbGQ7XG4gICAgICAgIGRvXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKHRtcENoaWxkLmludGVyYWN0aXZlKXRoaXMuc3RhZ2UuZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgdG1wQ2hpbGQuc3RhZ2UgPSB0aGlzLnN0YWdlO1xuICAgICAgICAgICAgdG1wQ2hpbGQgPSB0bXBDaGlsZC5faU5leHQ7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUodG1wQ2hpbGQpXG4gICAgfVxuXG4gICAgLy8gTElOS0VEIExJU1QgLy9cblxuICAgIC8vIG1vZGlmeSB0aGUgbGlzdC4uXG4gICAgdmFyIGNoaWxkRmlyc3QgPSBjaGlsZC5maXJzdFxuICAgIHZhciBjaGlsZExhc3QgPSBjaGlsZC5sYXN0O1xuICAgIHZhciBuZXh0T2JqZWN0O1xuICAgIHZhciBwcmV2aW91c09iamVjdDtcblxuICAgIC8vIHRoaXMgY291bGQgYmUgd3JvbmcgaWYgdGhlcmUgaXMgYSBmaWx0ZXI/P1xuICAgIGlmKHRoaXMuZmlsdGVyKVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNPYmplY3QgPSAgdGhpcy5sYXN0Ll9pUHJldjtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNPYmplY3QgPSB0aGlzLmxhc3Q7XG4gICAgfVxuXG4gICAgbmV4dE9iamVjdCA9IHByZXZpb3VzT2JqZWN0Ll9pTmV4dDtcblxuICAgIC8vIGFsd2F5cyB0cnVlIGluIHRoaXMgY2FzZVxuICAgIC8vIG5lZWQgdG8gbWFrZSBzdXJlIHRoZSBwYXJlbnRzIGxhc3QgaXMgdXBkYXRlZCB0b29cbiAgICB2YXIgdXBkYXRlTGFzdCA9IHRoaXM7XG4gICAgdmFyIHByZXZMYXN0ID0gcHJldmlvdXNPYmplY3Q7XG5cbiAgICB3aGlsZSh1cGRhdGVMYXN0KVxuICAgIHtcbiAgICAgICAgaWYodXBkYXRlTGFzdC5sYXN0ID09IHByZXZMYXN0KVxuICAgICAgICB7XG4gICAgICAgICAgICB1cGRhdGVMYXN0Lmxhc3QgPSBjaGlsZC5sYXN0O1xuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZUxhc3QgPSB1cGRhdGVMYXN0LnBhcmVudDtcbiAgICB9XG5cbiAgICBpZihuZXh0T2JqZWN0KVxuICAgIHtcbiAgICAgICAgbmV4dE9iamVjdC5faVByZXYgPSBjaGlsZExhc3Q7XG4gICAgICAgIGNoaWxkTGFzdC5faU5leHQgPSBuZXh0T2JqZWN0O1xuICAgIH1cblxuICAgIGNoaWxkRmlyc3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgcHJldmlvdXNPYmplY3QuX2lOZXh0ID0gY2hpbGRGaXJzdDtcblxuICAgIC8vIG5lZWQgdG8gcmVtb3ZlIGFueSByZW5kZXIgZ3JvdXBzLi5cbiAgICBpZih0aGlzLl9fcmVuZGVyR3JvdXApXG4gICAge1xuICAgICAgICAvLyBiZWluZyB1c2VkIGJ5IGEgcmVuZGVyVGV4dHVyZS4uIGlmIGl0IGV4aXN0cyB0aGVuIGl0IG11c3QgYmUgZnJvbSBhIHJlbmRlciB0ZXh0dXJlO1xuICAgICAgICBpZihjaGlsZC5fX3JlbmRlckdyb3VwKWNoaWxkLl9fcmVuZGVyR3JvdXAucmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGNoaWxkKTtcbiAgICAgICAgLy8gYWRkIHRoZW0gdG8gdGhlIG5ldyByZW5kZXIgZ3JvdXAuLlxuICAgICAgICB0aGlzLl9fcmVuZGVyR3JvdXAuYWRkRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGNoaWxkKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEFkZHMgYSBjaGlsZCB0byB0aGUgY29udGFpbmVyIGF0IGEgc3BlY2lmaWVkIGluZGV4LiBJZiB0aGUgaW5kZXggaXMgb3V0IG9mIGJvdW5kcyBhbiBlcnJvciB3aWxsIGJlIHRocm93blxuICpcbiAqIEBtZXRob2QgYWRkQ2hpbGRBdFxuICogQHBhcmFtIGNoaWxkIHtEaXNwbGF5T2JqZWN0fSBUaGUgY2hpbGQgdG8gYWRkXG4gKiBAcGFyYW0gaW5kZXgge051bWJlcn0gVGhlIGluZGV4IHRvIHBsYWNlIHRoZSBjaGlsZCBpblxuICovXG5wcm90by5hZGRDaGlsZEF0ID0gZnVuY3Rpb24gYWRkQ2hpbGRBdChjaGlsZCwgaW5kZXgpXG57XG4gICAgaWYoaW5kZXggPj0gMCAmJiBpbmRleCA8PSB0aGlzLmNoaWxkcmVuLmxlbmd0aClcbiAgICB7XG4gICAgICAgIGlmIChjaGlsZC5wYXJlbnQpIHtcbiAgICAgICAgICAgIGNoaWxkLnBhcmVudC5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgICAgIH1cbiAgICAgICAgY2hpbGQucGFyZW50ID0gdGhpcztcblxuICAgICAgICBpZih0aGlzLnN0YWdlKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgdG1wQ2hpbGQgPSBjaGlsZDtcbiAgICAgICAgICAgIGRvXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWYodG1wQ2hpbGQuaW50ZXJhY3RpdmUpdGhpcy5zdGFnZS5kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdG1wQ2hpbGQuc3RhZ2UgPSB0aGlzLnN0YWdlO1xuICAgICAgICAgICAgICAgIHRtcENoaWxkID0gdG1wQ2hpbGQuX2lOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUodG1wQ2hpbGQpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb2RpZnkgdGhlIGxpc3QuLlxuICAgICAgICB2YXIgY2hpbGRGaXJzdCA9IGNoaWxkLmZpcnN0O1xuICAgICAgICB2YXIgY2hpbGRMYXN0ID0gY2hpbGQubGFzdDtcbiAgICAgICAgdmFyIG5leHRPYmplY3Q7XG4gICAgICAgIHZhciBwcmV2aW91c09iamVjdDtcblxuICAgICAgICBpZihpbmRleCA9PT0gdGhpcy5jaGlsZHJlbi5sZW5ndGgpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHByZXZpb3VzT2JqZWN0ID0gdGhpcy5sYXN0O1xuICAgICAgICAgICAgdmFyIHVwZGF0ZUxhc3QgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIHByZXZMYXN0ID0gdGhpcy5sYXN0O1xuICAgICAgICAgICAgd2hpbGUodXBkYXRlTGFzdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZih1cGRhdGVMYXN0Lmxhc3QgPT0gcHJldkxhc3QpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVMYXN0Lmxhc3QgPSBjaGlsZC5sYXN0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB1cGRhdGVMYXN0ID0gdXBkYXRlTGFzdC5wYXJlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZighaW5kZXgpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHByZXZpb3VzT2JqZWN0ID0gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHByZXZpb3VzT2JqZWN0ID0gdGhpcy5jaGlsZHJlbltpbmRleC0xXS5sYXN0O1xuICAgICAgICB9XG5cbiAgICAgICAgbmV4dE9iamVjdCA9IHByZXZpb3VzT2JqZWN0Ll9pTmV4dDtcblxuICAgICAgICAvLyBhbHdheXMgdHJ1ZSBpbiB0aGlzIGNhc2VcbiAgICAgICAgaWYobmV4dE9iamVjdClcbiAgICAgICAge1xuICAgICAgICAgICAgbmV4dE9iamVjdC5faVByZXYgPSBjaGlsZExhc3Q7XG4gICAgICAgICAgICBjaGlsZExhc3QuX2lOZXh0ID0gbmV4dE9iamVjdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNoaWxkRmlyc3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IGNoaWxkRmlyc3Q7XG5cbiAgICAgICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDAsIGNoaWxkKTtcbiAgICAgICAgLy8gbmVlZCB0byByZW1vdmUgYW55IHJlbmRlciBncm91cHMuLlxuICAgICAgICBpZih0aGlzLl9fcmVuZGVyR3JvdXApXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIGJlaW5nIHVzZWQgYnkgYSByZW5kZXJUZXh0dXJlLi4gaWYgaXQgZXhpc3RzIHRoZW4gaXQgbXVzdCBiZSBmcm9tIGEgcmVuZGVyIHRleHR1cmU7XG4gICAgICAgICAgICBpZihjaGlsZC5fX3JlbmRlckdyb3VwKWNoaWxkLl9fcmVuZGVyR3JvdXAucmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGNoaWxkKTtcbiAgICAgICAgICAgIC8vIGFkZCB0aGVtIHRvIHRoZSBuZXcgcmVuZGVyIGdyb3VwLi5cbiAgICAgICAgICAgIHRoaXMuX19yZW5kZXJHcm91cC5hZGREaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4oY2hpbGQpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGNoaWxkICsgXCIgVGhlIGluZGV4IFwiKyBpbmRleCArXCIgc3VwcGxpZWQgaXMgb3V0IG9mIGJvdW5kcyBcIiArIHRoaXMuY2hpbGRyZW4ubGVuZ3RoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFtOWUldIFN3YXBzIHRoZSBkZXB0aCBvZiAyIGRpc3BsYXlPYmplY3RzXG4gKlxuICogQG1ldGhvZCBzd2FwQ2hpbGRyZW5cbiAqIEBwYXJhbSBjaGlsZCB7RGlzcGxheU9iamVjdH1cbiAqIEBwYXJhbSBjaGlsZDIge0Rpc3BsYXlPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5zd2FwQ2hpbGRyZW4gPSBmdW5jdGlvbiBzd2FwQ2hpbGRyZW4oY2hpbGQsIGNoaWxkMilcbntcbiAgICAvKlxuICAgICAqIHRoaXMgZnVudGlvbiBuZWVkcyB0byBiZSByZWNvZGVkLi5cbiAgICAgKiBjYW4gYmUgZG9uZSBhIGxvdCBmYXN0ZXIuLlxuICAgICAqL1xuICAgIHJldHVybjtcblxuICAgIC8vIG5lZWQgdG8gZml4IHRoaXMgZnVuY3Rpb24gOi9cbiAgICAvKlxuICAgIC8vIFRPRE8gSSBhbHJlYWR5IGtub3cgdGhpcz8/XG4gICAgdmFyIGluZGV4ID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKCBjaGlsZCApO1xuICAgIHZhciBpbmRleDIgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoIGNoaWxkMiApO1xuXG4gICAgaWYgKCBpbmRleCAhPT0gLTEgJiYgaW5kZXgyICE9PSAtMSApXG4gICAge1xuICAgICAgICAvLyBjb29sXG5cbiAgICAgICAgLypcbiAgICAgICAgaWYodGhpcy5zdGFnZSlcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gdGhpcyBpcyB0byBzYXRpc2Z5IHRoZSB3ZWJHTCBiYXRjaGluZy4uXG4gICAgICAgICAgICAvLyBUT0RPIHN1cmUgdGhlcmUgaXMgYSBuaWNlciB3YXkgdG8gYWNoaWV2ZSB0aGlzIVxuICAgICAgICAgICAgdGhpcy5zdGFnZS5fX3JlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgIHRoaXMuc3RhZ2UuX19yZW1vdmVDaGlsZChjaGlsZDIpO1xuXG4gICAgICAgICAgICB0aGlzLnN0YWdlLl9fYWRkQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgICAgdGhpcy5zdGFnZS5fX2FkZENoaWxkKGNoaWxkMik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzd2FwIHRoZSBwb3NpdGlvbnMuLlxuICAgICAgICB0aGlzLmNoaWxkcmVuW2luZGV4XSA9IGNoaWxkMjtcbiAgICAgICAgdGhpcy5jaGlsZHJlbltpbmRleDJdID0gY2hpbGQ7XG5cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGNoaWxkICsgXCIgQm90aCB0aGUgc3VwcGxpZWQgRGlzcGxheU9iamVjdHMgbXVzdCBiZSBhIGNoaWxkIG9mIHRoZSBjYWxsZXIgXCIgKyB0aGlzKTtcbiAgICB9Ki9cbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgQ2hpbGQgYXQgdGhlIHNwZWNpZmllZCBpbmRleFxuICpcbiAqIEBtZXRob2QgZ2V0Q2hpbGRBdFxuICogQHBhcmFtIGluZGV4IHtOdW1iZXJ9IFRoZSBpbmRleCB0byBnZXQgdGhlIGNoaWxkIGZyb21cbiAqL1xucHJvdG8uZ2V0Q2hpbGRBdCA9IGZ1bmN0aW9uIGdldENoaWxkQXQoaW5kZXgpXG57XG4gICAgaWYoaW5kZXggPj0gMCAmJiBpbmRleCA8IHRoaXMuY2hpbGRyZW4ubGVuZ3RoKVxuICAgIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hpbGRyZW5baW5kZXhdO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIlRoZSBzdXBwbGllZCBpbmRleCBpcyBvdXQgb2YgYm91bmRzXCIpO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhIGNoaWxkIGZyb20gdGhlIGNvbnRhaW5lci5cbiAqXG4gKiBAbWV0aG9kIHJlbW92ZUNoaWxkXG4gKiBAcGFyYW0gY2hpbGQge0Rpc3BsYXlPYmplY3R9IFRoZSBEaXNwbGF5T2JqZWN0IHRvIHJlbW92ZVxuICovXG5wcm90by5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uIHJlbW92ZUNoaWxkKGNoaWxkKVxue1xuICAgIHZhciBpbmRleCA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZiggY2hpbGQgKTtcbiAgICBpZiAoIGluZGV4ICE9PSAtMSApXG4gICAge1xuICAgICAgICAvLyB1bmxpbmsgLy9cbiAgICAgICAgLy8gbW9kaWZ5IHRoZSBsaXN0Li5cbiAgICAgICAgdmFyIGNoaWxkRmlyc3QgPSBjaGlsZC5maXJzdDtcbiAgICAgICAgdmFyIGNoaWxkTGFzdCA9IGNoaWxkLmxhc3Q7XG5cbiAgICAgICAgdmFyIG5leHRPYmplY3QgPSBjaGlsZExhc3QuX2lOZXh0O1xuICAgICAgICB2YXIgcHJldmlvdXNPYmplY3QgPSBjaGlsZEZpcnN0Ll9pUHJldjtcblxuICAgICAgICBpZihuZXh0T2JqZWN0KW5leHRPYmplY3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IG5leHRPYmplY3Q7XG5cbiAgICAgICAgaWYodGhpcy5sYXN0ID09IGNoaWxkTGFzdClcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIHRlbXBMYXN0ID0gIGNoaWxkRmlyc3QuX2lQcmV2O1xuICAgICAgICAgICAgLy8gbmVlZCB0byBtYWtlIHN1cmUgdGhlIHBhcmVudHMgbGFzdCBpcyB1cGRhdGVkIHRvb1xuICAgICAgICAgICAgdmFyIHVwZGF0ZUxhc3QgPSB0aGlzO1xuICAgICAgICAgICAgd2hpbGUodXBkYXRlTGFzdC5sYXN0ID09IGNoaWxkTGFzdC5sYXN0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxhc3QubGFzdCA9IHRlbXBMYXN0O1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxhc3QgPSB1cGRhdGVMYXN0LnBhcmVudDtcbiAgICAgICAgICAgICAgICBpZighdXBkYXRlTGFzdClicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNoaWxkTGFzdC5faU5leHQgPSBudWxsO1xuICAgICAgICBjaGlsZEZpcnN0Ll9pUHJldiA9IG51bGw7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSBzdGFnZSByZWZlcmVuY2UuLlxuICAgICAgICBpZih0aGlzLnN0YWdlKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgdG1wQ2hpbGQgPSBjaGlsZDtcbiAgICAgICAgICAgIGRvXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWYodG1wQ2hpbGQuaW50ZXJhY3RpdmUpdGhpcy5zdGFnZS5kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdG1wQ2hpbGQuc3RhZ2UgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRtcENoaWxkID0gdG1wQ2hpbGQuX2lOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUodG1wQ2hpbGQpXG4gICAgICAgIH1cblxuICAgICAgICAvLyB3ZWJHTCB0cmltXG4gICAgICAgIGlmKGNoaWxkLl9fcmVuZGVyR3JvdXApXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNoaWxkLl9fcmVuZGVyR3JvdXAucmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGNoaWxkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNoaWxkLnBhcmVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoIGluZGV4LCAxICk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihjaGlsZCArIFwiIFRoZSBzdXBwbGllZCBEaXNwbGF5T2JqZWN0IG11c3QgYmUgYSBjaGlsZCBvZiB0aGUgY2FsbGVyIFwiICsgdGhpcyk7XG4gICAgfVxufTtcblxuLypcbiAqIFVwZGF0ZXMgdGhlIGNvbnRhaW5lcidzIGNoaWxkcmVuJ3MgdHJhbnNmb3JtIGZvciByZW5kZXJpbmdcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRyYW5zZm9ybVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8udXBkYXRlVHJhbnNmb3JtID0gZnVuY3Rpb24gdXBkYXRlVHJhbnNmb3JtKClcbntcbiAgICBpZighdGhpcy52aXNpYmxlKXJldHVybjtcblxuICAgIERpc3BsYXlPYmplY3QucHJvdG90eXBlLnVwZGF0ZVRyYW5zZm9ybS5jYWxsKCB0aGlzICk7XG5cbiAgICBmb3IodmFyIGk9MCxqPXRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpPGo7IGkrKylcbiAgICB7XG4gICAgICAgIHRoaXMuY2hpbGRyZW5baV0udXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaXNwbGF5T2JqZWN0Q29udGFpbmVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgU3ByaXRlID0gcmVxdWlyZSgnLi9TcHJpdGUnKTtcblxuLyoqXG4gKiBBIE1vdmllQ2xpcCBpcyBhIHNpbXBsZSB3YXkgdG8gZGlzcGxheSBhbiBhbmltYXRpb24gZGVwaWN0ZWQgYnkgYSBsaXN0IG9mIHRleHR1cmVzLlxuICpcbiAqIEBjbGFzcyBNb3ZpZUNsaXBcbiAqIEBleHRlbmRzIFNwcml0ZVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdGV4dHVyZXMge0FycmF5PFRleHR1cmU+fSBhbiBhcnJheSBvZiB7VGV4dHVyZX0gb2JqZWN0cyB0aGF0IG1ha2UgdXAgdGhlIGFuaW1hdGlvblxuICovXG5mdW5jdGlvbiBNb3ZpZUNsaXAodGV4dHVyZXMpXG57XG4gICAgU3ByaXRlLmNhbGwodGhpcywgdGV4dHVyZXNbMF0pO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGFycmF5IG9mIHRleHR1cmVzIHRoYXQgbWFrZSB1cCB0aGUgYW5pbWF0aW9uXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdGV4dHVyZXNcbiAgICAgKiBAdHlwZSBBcnJheVxuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZXMgPSB0ZXh0dXJlcztcblxuICAgIC8qKlxuICAgICAqIFRoZSBzcGVlZCB0aGF0IHRoZSBNb3ZpZUNsaXAgd2lsbCBwbGF5IGF0LiBIaWdoZXIgaXMgZmFzdGVyLCBsb3dlciBpcyBzbG93ZXJcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBhbmltYXRpb25TcGVlZFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDFcbiAgICAgKi9cbiAgICB0aGlzLmFuaW1hdGlvblNwZWVkID0gMTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgb3Igbm90IHRoZSBtb3ZpZSBjbGlwIHJlcGVhdHMgYWZ0ZXIgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBsb29wXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICB0aGlzLmxvb3AgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogRnVuY3Rpb24gdG8gY2FsbCB3aGVuIGEgTW92aWVDbGlwIGZpbmlzaGVzIHBsYXlpbmdcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBvbkNvbXBsZXRlXG4gICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgKi9cbiAgICB0aGlzLm9uQ29tcGxldGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gVGhlIGluZGV4IE1vdmllQ2xpcHMgY3VycmVudCBmcmFtZSAodGhpcyBtYXkgbm90IGhhdmUgdG8gYmUgYSB3aG9sZSBudW1iZXIpXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgY3VycmVudEZyYW1lXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMuY3VycmVudEZyYW1lID0gMDtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIEluZGljYXRlcyBpZiB0aGUgTW92aWVDbGlwIGlzIGN1cnJlbnRseSBwbGF5aW5nXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgcGxheWluZ1xuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbn1cblxudmFyIHByb3RvID0gTW92aWVDbGlwLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3ByaXRlLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IE1vdmllQ2xpcH1cbn0pO1xuXG4vKipcbiogW3JlYWQtb25seV0gdG90YWxGcmFtZXMgaXMgdGhlIHRvdGFsIG51bWJlciBvZiBmcmFtZXMgaW4gdGhlIE1vdmllQ2xpcC4gVGhpcyBpcyB0aGUgc2FtZSBhcyBudW1iZXIgb2YgdGV4dHVyZXNcbiogYXNzaWduZWQgdG8gdGhlIE1vdmllQ2xpcC5cbipcbiogQHByb3BlcnR5IHRvdGFsRnJhbWVzXG4qIEB0eXBlIE51bWJlclxuKiBAZGVmYXVsdCAwXG4qIEByZWFkT25seVxuKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ3RvdGFsRnJhbWVzJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRleHR1cmVzLmxlbmd0aDtcbiAgICB9XG59KTtcblxuXG4vKipcbiAqIFN0b3BzIHRoZSBNb3ZpZUNsaXBcbiAqXG4gKiBAbWV0aG9kIHN0b3BcbiAqL1xucHJvdG8uc3RvcCA9IGZ1bmN0aW9uKClcbntcbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbn1cblxuLyoqXG4gKiBQbGF5cyB0aGUgTW92aWVDbGlwXG4gKlxuICogQG1ldGhvZCBwbGF5XG4gKi9cbnByb3RvLnBsYXkgPSBmdW5jdGlvbigpXG57XG4gICAgdGhpcy5wbGF5aW5nID0gdHJ1ZTtcbn1cblxuLyoqXG4gKiBTdG9wcyB0aGUgTW92aWVDbGlwIGFuZCBnb2VzIHRvIGEgc3BlY2lmaWMgZnJhbWVcbiAqXG4gKiBAbWV0aG9kIGdvdG9BbmRTdG9wXG4gKiBAcGFyYW0gZnJhbWVOdW1iZXIge051bWJlcn0gZnJhbWUgaW5kZXggdG8gc3RvcCBhdFxuICovXG5wcm90by5nb3RvQW5kU3RvcCA9IGZ1bmN0aW9uKGZyYW1lTnVtYmVyKVxue1xuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuICAgIHRoaXMuY3VycmVudEZyYW1lID0gZnJhbWVOdW1iZXI7XG4gICAgdmFyIHJvdW5kID0gKHRoaXMuY3VycmVudEZyYW1lICsgMC41KSB8IDA7XG4gICAgdGhpcy5zZXRUZXh0dXJlKHRoaXMudGV4dHVyZXNbcm91bmQgJSB0aGlzLnRleHR1cmVzLmxlbmd0aF0pO1xufVxuXG4vKipcbiAqIEdvZXMgdG8gYSBzcGVjaWZpYyBmcmFtZSBhbmQgYmVnaW5zIHBsYXlpbmcgdGhlIE1vdmllQ2xpcFxuICpcbiAqIEBtZXRob2QgZ290b0FuZFBsYXlcbiAqIEBwYXJhbSBmcmFtZU51bWJlciB7TnVtYmVyfSBmcmFtZSBpbmRleCB0byBzdGFydCBhdFxuICovXG5wcm90by5nb3RvQW5kUGxheSA9IGZ1bmN0aW9uIGdvdG9BbmRQbGF5KGZyYW1lTnVtYmVyKVxue1xuICAgIHRoaXMuY3VycmVudEZyYW1lID0gZnJhbWVOdW1iZXI7XG4gICAgdGhpcy5wbGF5aW5nID0gdHJ1ZTtcbn07XG5cbi8qXG4gKiBVcGRhdGVzIHRoZSBvYmplY3QgdHJhbnNmb3JtIGZvciByZW5kZXJpbmdcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRyYW5zZm9ybVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8udXBkYXRlVHJhbnNmb3JtID0gZnVuY3Rpb24gdXBkYXRlVHJhbnNmb3JtKClcbntcbiAgICBTcHJpdGUucHJvdG90eXBlLnVwZGF0ZVRyYW5zZm9ybS5jYWxsKHRoaXMpO1xuXG4gICAgaWYoIXRoaXMucGxheWluZylyZXR1cm47XG5cbiAgICB0aGlzLmN1cnJlbnRGcmFtZSArPSB0aGlzLmFuaW1hdGlvblNwZWVkO1xuXG4gICAgdmFyIHJvdW5kID0gKHRoaXMuY3VycmVudEZyYW1lICsgMC41KSB8IDA7XG5cbiAgICBpZih0aGlzLmxvb3AgfHwgcm91bmQgPCB0aGlzLnRleHR1cmVzLmxlbmd0aClcbiAgICB7XG4gICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0aGlzLnRleHR1cmVzW3JvdW5kICUgdGhpcy50ZXh0dXJlcy5sZW5ndGhdKTtcbiAgICB9XG4gICAgZWxzZSBpZihyb3VuZCA+PSB0aGlzLnRleHR1cmVzLmxlbmd0aClcbiAgICB7XG4gICAgICAgIHRoaXMuZ290b0FuZFN0b3AodGhpcy50ZXh0dXJlcy5sZW5ndGggLSAxKTtcbiAgICAgICAgaWYodGhpcy5vbkNvbXBsZXRlKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLm9uQ29tcGxldGUoKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTW92aWVDbGlwO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYmxlbmRNb2RlcyA9IHJlcXVpcmUoJy4vYmxlbmRNb2RlcycpO1xudmFyIERpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuL0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xuXG4vKipcbiAqIFRoZSBTUHJpdGUgb2JqZWN0IGlzIHRoZSBiYXNlIGZvciBhbGwgdGV4dHVyZWQgb2JqZWN0cyB0aGF0IGFyZSByZW5kZXJlZCB0byB0aGUgc2NyZWVuXG4gKlxuICogQGNsYXNzIFNwcml0ZVxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX0gVGhlIHRleHR1cmUgZm9yIHRoaXMgc3ByaXRlXG4gKiBAdHlwZSBTdHJpbmdcbiAqL1xuZnVuY3Rpb24gU3ByaXRlKHRleHR1cmUpXG57XG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGFuY2hvciBzZXRzIHRoZSBvcmlnaW4gcG9pbnQgb2YgdGhlIHRleHR1cmUuXG4gICAgICogVGhlIGRlZmF1bHQgaXMgMCwwIHRoaXMgbWVhbnMgdGhlIHRleHR1cmVzIG9yaWdpbiBpcyB0aGUgdG9wIGxlZnRcbiAgICAgKiBTZXR0aW5nIHRoYW4gYW5jaG9yIHRvIDAuNSwwLjUgbWVhbnMgdGhlIHRleHR1cmVzIG9yaWdpbiBpcyBjZW50ZXJlZFxuICAgICAqIFNldHRpbmcgdGhlIGFuY2hvciB0byAxLDEgd291bGQgbWVhbiB0aGUgdGV4dHVyZXMgb3JpZ2luIHBvaW50cyB3aWxsIGJlIHRoZSBib3R0b20gcmlnaHRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBhbmNob3JcbiAgICAgKiBAdHlwZSBQb2ludFxuICAgICAqL1xuICAgIHRoaXMuYW5jaG9yID0gbmV3IFBvaW50KCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGV4dHVyZSB0aGF0IHRoZSBzcHJpdGUgaXMgdXNpbmdcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0ZXh0dXJlXG4gICAgICogQHR5cGUgVGV4dHVyZVxuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYmxlbmQgbW9kZSBvZiBzcHJpdGUuXG4gICAgICogY3VycmVudGx5IHN1cHBvcnRzIGJsZW5kTW9kZXMuTk9STUFMIGFuZCBibGVuZE1vZGVzLlNDUkVFTlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGJsZW5kTW9kZVxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHRoaXMuYmxlbmRNb2RlID0gYmxlbmRNb2Rlcy5OT1JNQUw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHNwcml0ZSAodGhpcyBpcyBpbml0aWFsbHkgc2V0IGJ5IHRoZSB0ZXh0dXJlKVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IF93aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5fd2lkdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgc3ByaXRlICh0aGlzIGlzIGluaXRpYWxseSBzZXQgYnkgdGhlIHRleHR1cmUpXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgX2hlaWdodFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5faGVpZ2h0ID0gMDtcblxuICAgIGlmKHRleHR1cmUuYmFzZVRleHR1cmUuaGFzTG9hZGVkKVxuICAgIHtcbiAgICAgICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgdGhpcy50ZXh0dXJlLmFkZEV2ZW50TGlzdGVuZXIoICd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGF0Lm9uVGV4dHVyZVVwZGF0ZSgpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnJlbmRlcmFibGUgPSB0cnVlO1xufVxuXG52YXIgcHJvdG8gPSBTcHJpdGUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFNwcml0ZX1cbn0pO1xuXG4vKipcbiAqIFRoZSB3aWR0aCBvZiB0aGUgc3ByaXRlLCBzZXR0aW5nIHRoaXMgd2lsbCBhY3R1YWxseSBtb2RpZnkgdGhlIHNjYWxlIHRvIGFjaGVpdmUgdGhlIHZhbHVlIHNldFxuICpcbiAqIEBwcm9wZXJ0eSB3aWR0aFxuICogQHR5cGUgTnVtYmVyXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ3dpZHRoJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNjYWxlLnggKiB0aGlzLnRleHR1cmUuZnJhbWUud2lkdGg7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuc2NhbGUueCA9IHZhbHVlIC8gdGhpcy50ZXh0dXJlLmZyYW1lLndpZHRoXG4gICAgICAgIHRoaXMuX3dpZHRoID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogVGhlIGhlaWdodCBvZiB0aGUgc3ByaXRlLCBzZXR0aW5nIHRoaXMgd2lsbCBhY3R1YWxseSBtb2RpZnkgdGhlIHNjYWxlIHRvIGFjaGVpdmUgdGhlIHZhbHVlIHNldFxuICpcbiAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAqIEB0eXBlIE51bWJlclxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdoZWlnaHQnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICB0aGlzLnNjYWxlLnkgKiB0aGlzLnRleHR1cmUuZnJhbWUuaGVpZ2h0O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLnNjYWxlLnkgPSB2YWx1ZSAvIHRoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHRcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogU2V0cyB0aGUgdGV4dHVyZSBvZiB0aGUgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBzZXRUZXh0dXJlXG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX0gVGhlIHRleHR1cmUgdGhhdCBpcyBkaXNwbGF5ZWQgYnkgdGhlIHNwcml0ZVxuICovXG5wcm90by5zZXRUZXh0dXJlID0gZnVuY3Rpb24gc2V0VGV4dHVyZSh0ZXh0dXJlKVxue1xuICAgIC8vIHN0b3AgY3VycmVudCB0ZXh0dXJlO1xuICAgIGlmKHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZSAhPSB0ZXh0dXJlLmJhc2VUZXh0dXJlKVxuICAgIHtcbiAgICAgICAgdGhpcy50ZXh0dXJlQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcblxuICAgICAgICBpZih0aGlzLl9fcmVuZGVyR3JvdXApXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuX19yZW5kZXJHcm91cC51cGRhdGVUZXh0dXJlKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG59O1xuXG4vKipcbiAqIFdoZW4gdGhlIHRleHR1cmUgaXMgdXBkYXRlZCwgdGhpcyBldmVudCB3aWxsIGZpcmUgdG8gdXBkYXRlIHRoZSBzY2FsZSBhbmQgZnJhbWVcbiAqXG4gKiBAbWV0aG9kIG9uVGV4dHVyZVVwZGF0ZVxuICogQHBhcmFtIGV2ZW50XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vblRleHR1cmVVcGRhdGUgPSBmdW5jdGlvbiBvblRleHR1cmVVcGRhdGUoZXZlbnQpXG57XG4gICAgLy8gc28gaWYgX3dpZHRoIGlzIDAgdGhlbiB3aWR0aCB3YXMgbm90IHNldC4uXG4gICAgaWYodGhpcy5fd2lkdGgpdGhpcy5zY2FsZS54ID0gdGhpcy5fd2lkdGggLyB0aGlzLnRleHR1cmUuZnJhbWUud2lkdGg7XG4gICAgaWYodGhpcy5faGVpZ2h0KXRoaXMuc2NhbGUueSA9IHRoaXMuX2hlaWdodCAvIHRoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQ7XG5cbiAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbn07XG5cbi8vIHNvbWUgaGVscGVyIGZ1bmN0aW9ucy4uXG5cbi8qKlxuICpcbiAqIEhlbHBlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgYSBzcHJpdGUgdGhhdCB3aWxsIGNvbnRhaW4gYSB0ZXh0dXJlIGJhc2VkIG9uIGFuIGltYWdlIHVybFxuICogSWYgdGhlIGltYWdlIGlzIG5vdCBpbiB0aGUgdGV4dHVyZSBjYWNoZSBpdCB3aWxsIGJlIGxvYWRlZFxuICpcbiAqIEBtZXRob2QgZnJvbUltYWdlXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0gaW1hZ2VJZCB7U3RyaW5nfSBUaGUgaW1hZ2UgdXJsIG9mIHRoZSB0ZXh0dXJlXG4gKiBAcmV0dXJuIHtTcHJpdGV9IEEgbmV3IFNwcml0ZSB1c2luZyBhIHRleHR1cmUgZnJvbSB0aGUgdGV4dHVyZSBjYWNoZSBtYXRjaGluZyB0aGUgaW1hZ2UgaWRcbiAqL1xuU3ByaXRlLmZyb21JbWFnZSA9IGZ1bmN0aW9uIGZyb21JbWFnZShpbWFnZUlkKVxue1xuICAgIHZhciB0ZXh0dXJlID0gVGV4dHVyZS5mcm9tSW1hZ2UoaW1hZ2VJZCk7XG4gICAgcmV0dXJuIG5ldyBTcHJpdGUodGV4dHVyZSk7XG59O1xuXG4vKipcbiAqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCBjcmVhdGVzIGEgc3ByaXRlIHRoYXQgd2lsbCBjb250YWluIGEgdGV4dHVyZSBmcm9tIHRoZSBUZXh0dXJlQ2FjaGUgYmFzZWQgb24gdGhlIGZyYW1lSWRcbiAqIFRoZSBmcmFtZSBpZHMgYXJlIGNyZWF0ZWQgd2hlbiBhIFRleHR1cmUgcGFja2VyIGZpbGUgaGFzIGJlZW4gbG9hZGVkXG4gKlxuICogQG1ldGhvZCBmcm9tRnJhbWVcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSBmcmFtZUlkIHtTdHJpbmd9IFRoZSBmcmFtZSBJZCBvZiB0aGUgdGV4dHVyZSBpbiB0aGUgY2FjaGVcbiAqIEByZXR1cm4ge1Nwcml0ZX0gQSBuZXcgU3ByaXRlIHVzaW5nIGEgdGV4dHVyZSBmcm9tIHRoZSB0ZXh0dXJlIGNhY2hlIG1hdGNoaW5nIHRoZSBmcmFtZUlkXG4gKi9cblNwcml0ZS5mcm9tRnJhbWUgPSBmdW5jdGlvbiBmcm9tRnJhbWUoZnJhbWVJZClcbntcbiAgICB2YXIgdGV4dHVyZSA9IFRleHR1cmUuY2FjaGVbZnJhbWVJZF07XG4gICAgaWYoIXRleHR1cmUpdGhyb3cgbmV3IEVycm9yKFwiVGhlIGZyYW1lSWQgJ1wiKyBmcmFtZUlkICtcIicgZG9lcyBub3QgZXhpc3QgaW4gdGhlIHRleHR1cmUgY2FjaGVcIiArIHRoaXMpO1xuICAgIHJldHVybiBuZXcgU3ByaXRlKHRleHR1cmUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTcHJpdGU7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgbWF0MyA9IHJlcXVpcmUoJy4uL2dlb20vbWF0cml4JykubWF0MztcbnZhciBoZXgycmdiID0gcmVxdWlyZSgnLi4vdXRpbHMvY29sb3InKS5oZXgycmdiO1xuXG52YXIgRGlzcGxheU9iamVjdENvbnRhaW5lciA9IHJlcXVpcmUoJy4vRGlzcGxheU9iamVjdENvbnRhaW5lcicpO1xudmFyIEludGVyYWN0aW9uTWFuYWdlciA9IHJlcXVpcmUoJy4uL0ludGVyYWN0aW9uTWFuYWdlcicpO1xudmFyIFJlY3RhbmdsZSA9IHJlcXVpcmUoJy4uL2dlb20vUmVjdGFuZ2xlJyk7XG5cbi8qKlxuICogQSBTdGFnZSByZXByZXNlbnRzIHRoZSByb290IG9mIHRoZSBkaXNwbGF5IHRyZWUuIEV2ZXJ5dGhpbmcgY29ubmVjdGVkIHRvIHRoZSBzdGFnZSBpcyByZW5kZXJlZFxuICpcbiAqIEBjbGFzcyBTdGFnZVxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gYmFja2dyb3VuZENvbG9yIHtOdW1iZXJ9IHRoZSBiYWNrZ3JvdW5kIGNvbG9yIG9mIHRoZSBzdGFnZSwgZWFzaWVzdCB3YXkgdG8gcGFzcyB0aGlzIGluIGlzIGluIGhleCBmb3JtYXRcbiAqICAgICAgbGlrZTogMHhGRkZGRkYgZm9yIHdoaXRlXG4gKi9cbmZ1bmN0aW9uIFN0YWdlKGJhY2tncm91bmRDb2xvcilcbntcbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBDdXJyZW50IHRyYW5zZm9ybSBvZiB0aGUgb2JqZWN0IGJhc2VkIG9uIHdvcmxkIChwYXJlbnQpIGZhY3RvcnNcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3b3JsZFRyYW5zZm9ybVxuICAgICAqIEB0eXBlIE1hdDNcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMud29ybGRUcmFuc2Zvcm0gPSBtYXQzLmNyZWF0ZSgpO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciBvciBub3QgdGhlIHN0YWdlIGlzIGludGVyYWN0aXZlXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgaW50ZXJhY3RpdmVcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICovXG4gICAgdGhpcy5pbnRlcmFjdGl2ZSA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaW50ZXJhY3Rpb24gbWFuYWdlIGZvciB0aGlzIHN0YWdlLCBtYW5hZ2VzIGFsbCBpbnRlcmFjdGl2ZSBhY3Rpdml0eSBvbiB0aGUgc3RhZ2VcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBpbnRlcmFjdGl2ZVxuICAgICAqIEB0eXBlIEludGVyYWN0aW9uTWFuYWdlclxuICAgICAqL1xuICAgIHRoaXMuaW50ZXJhY3Rpb25NYW5hZ2VyID0gbmV3IEludGVyYWN0aW9uTWFuYWdlcih0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHN0YWdlIGlzIGRpcnR5IGFuZCBuZWVkcyB0byBoYXZlIGludGVyYWN0aW9ucyB1cGRhdGVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZGlydHlcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcblxuICAgIHRoaXMuX19jaGlsZHJlbkFkZGVkID0gW107XG4gICAgdGhpcy5fX2NoaWxkcmVuUmVtb3ZlZCA9IFtdO1xuXG4gICAgLy90aGUgc3RhZ2UgaXMgaXQncyBvd24gc3RhZ2VcbiAgICB0aGlzLnN0YWdlID0gdGhpcztcblxuICAgIC8vb3B0aW1pemUgaGl0IGRldGVjdGlvbiBhIGJpdFxuICAgIHRoaXMuc3RhZ2UuaGl0QXJlYSA9IG5ldyBSZWN0YW5nbGUoMCwwLDEwMDAwMCwgMTAwMDAwKTtcblxuICAgIHRoaXMuc2V0QmFja2dyb3VuZENvbG9yKGJhY2tncm91bmRDb2xvcik7XG4gICAgdGhpcy53b3JsZFZpc2libGUgPSB0cnVlO1xufVxuXG52YXIgcHJvdG8gPSBTdGFnZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogU3RhZ2V9XG59KTtcblxuLyoqXG4gKiBTZXRzIGFub3RoZXIgRE9NIGVsZW1lbnQgd2hpY2ggY2FuIHJlY2VpdmUgbW91c2UvdG91Y2ggaW50ZXJhY3Rpb25zIGluc3RlYWQgb2YgdGhlIGRlZmF1bHQgQ2FudmFzIGVsZW1lbnQuXG4gKiBUaGlzIGlzIHVzZWZ1bCBmb3Igd2hlbiB5b3UgaGF2ZSBvdGhlciBET00gZWxlbWVudHMgb250b3Agb2YgdGhlIENhbnZhcyBlbGVtZW50LlxuICpcbiAqIEBtZXRob2Qgc2V0SW50ZXJhY3Rpb25EZWxlZ2F0ZVxuICogQHBhcmFtIGRvbUVsZW1lbnQge0RPTUVsZW1lbnR9IFRoaXMgbmV3IGRvbUVsZW1lbnQgd2hpY2ggd2lsbCByZWNlaXZlIG1vdXNlL3RvdWNoIGV2ZW50c1xuICovXG5wcm90by5zZXRJbnRlcmFjdGlvbkRlbGVnYXRlID0gZnVuY3Rpb24gc2V0SW50ZXJhY3Rpb25EZWxlZ2F0ZShkb21FbGVtZW50KVxue1xuXHR0aGlzLmludGVyYWN0aW9uTWFuYWdlci5zZXRUYXJnZXREb21FbGVtZW50KCBkb21FbGVtZW50ICk7XG59O1xuXG4vKlxuICogVXBkYXRlcyB0aGUgb2JqZWN0IHRyYW5zZm9ybSBmb3IgcmVuZGVyaW5nXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgdGhpcy53b3JsZEFscGhhID0gMTtcbiAgICB0aGlzLnZjb3VudCA9IGdsb2JhbHMudmlzaWJsZUNvdW50O1xuXG4gICAgZm9yKHZhciBpPTAsaj10aGlzLmNoaWxkcmVuLmxlbmd0aDsgaTxqOyBpKyspXG4gICAge1xuICAgICAgICB0aGlzLmNoaWxkcmVuW2ldLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgIH1cblxuICAgIGlmKHRoaXMuZGlydHkpXG4gICAge1xuICAgICAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgIC8vIHVwZGF0ZSBpbnRlcmFjdGl2ZSFcbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbk1hbmFnZXIuZGlydHkgPSB0cnVlO1xuICAgIH1cblxuXG4gICAgaWYodGhpcy5pbnRlcmFjdGl2ZSl0aGlzLmludGVyYWN0aW9uTWFuYWdlci51cGRhdGUoKTtcbn07XG5cbi8qKlxuICogU2V0cyB0aGUgYmFja2dyb3VuZCBjb2xvciBmb3IgdGhlIHN0YWdlXG4gKlxuICogQG1ldGhvZCBzZXRCYWNrZ3JvdW5kQ29sb3JcbiAqIEBwYXJhbSBiYWNrZ3JvdW5kQ29sb3Ige051bWJlcn0gdGhlIGNvbG9yIG9mIHRoZSBiYWNrZ3JvdW5kLCBlYXNpZXN0IHdheSB0byBwYXNzIHRoaXMgaW4gaXMgaW4gaGV4IGZvcm1hdFxuICogICAgICBsaWtlOiAweEZGRkZGRiBmb3Igd2hpdGVcbiAqL1xucHJvdG8uc2V0QmFja2dyb3VuZENvbG9yID0gZnVuY3Rpb24gc2V0QmFja2dyb3VuZENvbG9yKGJhY2tncm91bmRDb2xvcilcbntcbiAgICB0aGlzLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmRDb2xvciB8fCAweDAwMDAwMDtcbiAgICB0aGlzLmJhY2tncm91bmRDb2xvclNwbGl0ID0gaGV4MnJnYih0aGlzLmJhY2tncm91bmRDb2xvcik7XG4gICAgdmFyIGhleCA9IHRoaXMuYmFja2dyb3VuZENvbG9yLnRvU3RyaW5nKDE2KTtcbiAgICBoZXggPSBcIjAwMDAwMFwiLnN1YnN0cigwLCA2IC0gaGV4Lmxlbmd0aCkgKyBoZXg7XG4gICAgdGhpcy5iYWNrZ3JvdW5kQ29sb3JTdHJpbmcgPSBcIiNcIiArIGhleDtcbn07XG5cbi8qKlxuICogVGhpcyB3aWxsIHJldHVybiB0aGUgcG9pbnQgY29udGFpbmluZyBnbG9iYWwgY29vcmRzIG9mIHRoZSBtb3VzZS5cbiAqXG4gKiBAbWV0aG9kIGdldE1vdXNlUG9zaXRpb25cbiAqIEByZXR1cm4ge1BvaW50fSBUaGUgcG9pbnQgY29udGFpbmluZyB0aGUgY29vcmRzIG9mIHRoZSBnbG9iYWwgSW50ZXJhY3Rpb25EYXRhIHBvc2l0aW9uLlxuICovXG5wcm90by5nZXRNb3VzZVBvc2l0aW9uID0gZnVuY3Rpb24gZ2V0TW91c2VQb3NpdGlvbigpXG57XG4gICAgcmV0dXJuIHRoaXMuaW50ZXJhY3Rpb25NYW5hZ2VyLm1vdXNlLmdsb2JhbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhZ2U7XG4iLCIvKipcbiAqIEBhdXRob3IgRHIuIEtpYml0eiA8aW5mb0BkcmtpYml0ei5jb20+XG4gKi9cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdE5PUk1BTDogMCxcblx0U0NSRUVOOiAxXG59O1xuIiwiLyoqXG4gKiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL2V2ZW50dGFyZ2V0LmpzL1xuICogVEhhbmtTIG1yIERPb2IhXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBBZGRzIGV2ZW50IGVtaXR0ZXIgZnVuY3Rpb25hbGl0eSB0byBhIGNsYXNzXG4gKlxuICogQGNsYXNzIEV2ZW50VGFyZ2V0XG4gKiBAZXhhbXBsZVxuICogICAgICBmdW5jdGlvbiBNeUVtaXR0ZXIoKSB7XG4gKiAgICAgICAgICBFdmVudFRhcmdldC5jYWxsKHRoaXMpOyAvL21peGVzIGluIGV2ZW50IHRhcmdldCBzdHVmZlxuICogICAgICB9XG4gKlxuICogICAgICB2YXIgZW0gPSBuZXcgTXlFbWl0dGVyKCk7XG4gKiAgICAgIGVtLmVtaXQoeyB0eXBlOiAnZXZlbnROYW1lJywgZGF0YTogJ3NvbWUgZGF0YScgfSk7XG4gKi9cbmZ1bmN0aW9uIEV2ZW50VGFyZ2V0KCkge1xuXG4gICAgdmFyIGxpc3RlbmVycyA9IHt9O1xuXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyID0gdGhpcy5vbiA9IGZ1bmN0aW9uICggdHlwZSwgbGlzdGVuZXIgKSB7XG5cblxuICAgICAgICBpZiAoIGxpc3RlbmVyc1sgdHlwZSBdID09PSB1bmRlZmluZWQgKSB7XG5cbiAgICAgICAgICAgIGxpc3RlbmVyc1sgdHlwZSBdID0gW107XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggbGlzdGVuZXJzWyB0eXBlIF0uaW5kZXhPZiggbGlzdGVuZXIgKSA9PT0gLSAxICkge1xuXG4gICAgICAgICAgICBsaXN0ZW5lcnNbIHR5cGUgXS5wdXNoKCBsaXN0ZW5lciApO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50ID0gdGhpcy5lbWl0ID0gZnVuY3Rpb24gKCBldmVudCApIHtcblxuICAgICAgICBpZiAoICFsaXN0ZW5lcnNbIGV2ZW50LnR5cGUgXSB8fCAhbGlzdGVuZXJzWyBldmVudC50eXBlIF0ubGVuZ3RoICkge1xuXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGZvcih2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lcnNbIGV2ZW50LnR5cGUgXS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcblxuICAgICAgICAgICAgbGlzdGVuZXJzWyBldmVudC50eXBlIF1bIGkgXSggZXZlbnQgKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyID0gdGhpcy5vZmYgPSBmdW5jdGlvbiAoIHR5cGUsIGxpc3RlbmVyICkge1xuXG4gICAgICAgIHZhciBpbmRleCA9IGxpc3RlbmVyc1sgdHlwZSBdLmluZGV4T2YoIGxpc3RlbmVyICk7XG5cbiAgICAgICAgaWYgKCBpbmRleCAhPT0gLSAxICkge1xuXG4gICAgICAgICAgICBsaXN0ZW5lcnNbIHR5cGUgXS5zcGxpY2UoIGluZGV4LCAxICk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudFRhcmdldDtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIERpc3BsYXlPYmplY3QgPSByZXF1aXJlKCcuLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3QnKTtcblxuLyoqXG4gKiBUaGlzIG9iamVjdCBpcyBvbmUgdGhhdCB3aWxsIGFsbG93IHlvdSB0byBzcGVjaWZ5IGN1c3RvbSByZW5kZXJpbmcgZnVuY3Rpb25zIGJhc2VkIG9uIHJlbmRlciB0eXBlXG4gKlxuICogQGNsYXNzIEN1c3RvbVJlbmRlcmFibGVcbiAqIEBleHRlbmRzIERpc3BsYXlPYmplY3RcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDdXN0b21SZW5kZXJhYmxlKClcbntcblx0RGlzcGxheU9iamVjdC5jYWxsKHRoaXMpO1xufVxuXG52YXIgcHJvdG8gPSBDdXN0b21SZW5kZXJhYmxlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGlzcGxheU9iamVjdC5wcm90b3R5cGUsIHtcblx0Y29uc3RydWN0b3I6IHt2YWx1ZTogQ3VzdG9tUmVuZGVyYWJsZX1cbn0pO1xuXG4vKipcbiAqIElmIHRoaXMgb2JqZWN0IGlzIGJlaW5nIHJlbmRlcmVkIGJ5IGEgQ2FudmFzUmVuZGVyZXIgaXQgd2lsbCBjYWxsIHRoaXMgY2FsbGJhY2tcbiAqXG4gKiBAbWV0aG9kIHJlbmRlckNhbnZhc1xuICogQHBhcmFtIHJlbmRlcmVyIHtDYW52YXNSZW5kZXJlcn0gVGhlIHJlbmRlcmVyIGluc3RhbmNlXG4gKi9cbnByb3RvLnJlbmRlckNhbnZhcyA9IGZ1bmN0aW9uIHJlbmRlckNhbnZhcyhyZW5kZXJlcilcbntcbiAgICAvLyBvdmVycmlkZSFcbn07XG5cbi8qKlxuICogSWYgdGhpcyBvYmplY3QgaXMgYmVpbmcgcmVuZGVyZWQgYnkgYSBXZWJHTFJlbmRlcmVyIGl0IHdpbGwgY2FsbCB0aGlzIGNhbGxiYWNrIHRvIGluaXRpYWxpemVcbiAqXG4gKiBAbWV0aG9kIGluaXRXZWJHTFxuICogQHBhcmFtIHJlbmRlcmVyIHtXZWJHTFJlbmRlcmVyfSBUaGUgcmVuZGVyZXIgaW5zdGFuY2VcbiAqL1xucHJvdG8uaW5pdFdlYkdMID0gZnVuY3Rpb24gaW5pdFdlYkdMKHJlbmRlcmVyKVxue1xuICAgIC8vIG92ZXJyaWRlIVxufTtcblxuLyoqXG4gKiBJZiB0aGlzIG9iamVjdCBpcyBiZWluZyByZW5kZXJlZCBieSBhIFdlYkdMUmVuZGVyZXIgaXQgd2lsbCBjYWxsIHRoaXMgY2FsbGJhY2tcbiAqXG4gKiBAbWV0aG9kIHJlbmRlcldlYkdMXG4gKiBAcGFyYW0gcmVuZGVyZXIge1dlYkdMUmVuZGVyZXJ9IFRoZSByZW5kZXJlciBpbnN0YW5jZVxuICovXG5wcm90by5yZW5kZXJXZWJHTCA9IGZ1bmN0aW9uIHJlbmRlcldlYkdMKHJlbmRlckdyb3VwLCBwcm9qZWN0aW9uTWF0cml4KVxue1xuICAgIC8vIG5vdCBzdXJlIGlmIGJvdGggbmVlZGVkPyBidXQgeWEgaGF2ZSBmb3Igbm93IVxuICAgIC8vIG92ZXJyaWRlIVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDdXN0b21SZW5kZXJhYmxlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIFN0cmlwID0gcmVxdWlyZSgnLi9TdHJpcCcpO1xudmFyIERpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcblxuZnVuY3Rpb24gUm9wZSh0ZXh0dXJlLCBwb2ludHMpXG57XG4gICAgU3RyaXAuY2FsbCh0aGlzLCB0ZXh0dXJlKTtcbiAgICB0aGlzLnBvaW50cyA9IHBvaW50cztcblxuICAgIHRyeVxuICAgIHtcbiAgICAgICAgdGhpcy52ZXJ0aWNpZXMgPSBuZXcgRmxvYXQzMkFycmF5KHBvaW50cy5sZW5ndGggKiA0KTtcbiAgICAgICAgdGhpcy51dnMgPSBuZXcgRmxvYXQzMkFycmF5KHBvaW50cy5sZW5ndGggKiA0KTtcbiAgICAgICAgdGhpcy5jb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KHBvaW50cy5sZW5ndGggKiAyKTtcbiAgICAgICAgdGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KHBvaW50cy5sZW5ndGggKiAyKTtcbiAgICB9XG4gICAgY2F0Y2goZXJyb3IpXG4gICAge1xuICAgICAgICB0aGlzLnZlcnRpY2llcyA9IFtdO1xuICAgICAgICB0aGlzLnV2cyA9IFtdO1xuICAgICAgICB0aGlzLmNvbG9ycyA9IFtdO1xuICAgICAgICB0aGlzLmluZGljZXMgPSBbXTtcbiAgICB9XG5cbiAgICB0aGlzLnJlZnJlc2goKTtcbn1cblxudmFyIHByb3RvID0gUm9wZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0cmlwLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFJvcGV9XG59KTtcblxucHJvdG8ucmVmcmVzaCA9IGZ1bmN0aW9uIHJlZnJlc2goKVxue1xuICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50cztcbiAgICBpZihwb2ludHMubGVuZ3RoIDwgMSlyZXR1cm47XG5cbiAgICB2YXIgdXZzID0gdGhpcy51dnNcbiAgICB2YXIgaW5kaWNlcyA9IHRoaXMuaW5kaWNlcztcbiAgICB2YXIgY29sb3JzID0gdGhpcy5jb2xvcnM7XG5cbiAgICB2YXIgbGFzdFBvaW50ID0gcG9pbnRzWzBdO1xuICAgIHZhciBuZXh0UG9pbnQ7XG4gICAgdmFyIHBlcnAgPSB7eDowLCB5OjB9O1xuXG4gICAgdGhpcy5jb3VudC09MC4yO1xuXG5cbiAgICB1dnNbMF0gPSAwXG4gICAgdXZzWzFdID0gMVxuICAgIHV2c1syXSA9IDBcbiAgICB1dnNbM10gPSAxXG5cbiAgICBjb2xvcnNbMF0gPSAxO1xuICAgIGNvbG9yc1sxXSA9IDE7XG5cbiAgICBpbmRpY2VzWzBdID0gMDtcbiAgICBpbmRpY2VzWzFdID0gMTtcblxuICAgIHZhciB0b3RhbCA9IHBvaW50cy5sZW5ndGgsXG4gICAgICAgIHBvaW50LCBpbmRleCwgYW1vdW50O1xuXG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCB0b3RhbDsgaSsrKVxuICAgIHtcblxuICAgICAgICBwb2ludCA9IHBvaW50c1tpXTtcbiAgICAgICAgaW5kZXggPSBpICogNDtcbiAgICAgICAgLy8gdGltZSB0byBkbyBzb21lIHNtYXJ0IGRyYXdpbmchXG4gICAgICAgIGFtb3VudCA9IGkvKHRvdGFsLTEpXG5cbiAgICAgICAgaWYoaSUyKVxuICAgICAgICB7XG4gICAgICAgICAgICB1dnNbaW5kZXhdID0gYW1vdW50O1xuICAgICAgICAgICAgdXZzW2luZGV4KzFdID0gMDtcblxuICAgICAgICAgICAgdXZzW2luZGV4KzJdID0gYW1vdW50XG4gICAgICAgICAgICB1dnNbaW5kZXgrM10gPSAxXG5cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHV2c1tpbmRleF0gPSBhbW91bnRcbiAgICAgICAgICAgIHV2c1tpbmRleCsxXSA9IDBcblxuICAgICAgICAgICAgdXZzW2luZGV4KzJdID0gYW1vdW50XG4gICAgICAgICAgICB1dnNbaW5kZXgrM10gPSAxXG4gICAgICAgIH1cblxuICAgICAgICBpbmRleCA9IGkgKiAyO1xuICAgICAgICBjb2xvcnNbaW5kZXhdID0gMTtcbiAgICAgICAgY29sb3JzW2luZGV4KzFdID0gMTtcblxuICAgICAgICBpbmRleCA9IGkgKiAyO1xuICAgICAgICBpbmRpY2VzW2luZGV4XSA9IGluZGV4O1xuICAgICAgICBpbmRpY2VzW2luZGV4ICsgMV0gPSBpbmRleCArIDE7XG5cbiAgICAgICAgbGFzdFBvaW50ID0gcG9pbnQ7XG4gICAgfVxufTtcblxucHJvdG8udXBkYXRlVHJhbnNmb3JtID0gZnVuY3Rpb24gdXBkYXRlVHJhbnNmb3JtKClcbntcblxuICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50cztcbiAgICBpZihwb2ludHMubGVuZ3RoIDwgMSlyZXR1cm47XG5cbiAgICB2YXIgbGFzdFBvaW50ID0gcG9pbnRzWzBdO1xuICAgIHZhciBuZXh0UG9pbnQ7XG4gICAgdmFyIHBlcnAgPSB7eDowLCB5OjB9O1xuXG4gICAgdGhpcy5jb3VudC09MC4yO1xuXG4gICAgdmFyIHZlcnRpY2llcyA9IHRoaXMudmVydGljaWVzO1xuICAgIHZlcnRpY2llc1swXSA9IGxhc3RQb2ludC54ICsgcGVycC54XG4gICAgdmVydGljaWVzWzFdID0gbGFzdFBvaW50LnkgKyBwZXJwLnkgLy8rIDIwMFxuICAgIHZlcnRpY2llc1syXSA9IGxhc3RQb2ludC54IC0gcGVycC54XG4gICAgdmVydGljaWVzWzNdID0gbGFzdFBvaW50LnkgLSBwZXJwLnkvLysyMDBcbiAgICAvLyB0aW1lIHRvIGRvIHNvbWUgc21hcnQgZHJhd2luZyFcblxuICAgIHZhciB0b3RhbCA9IHBvaW50cy5sZW5ndGgsXG4gICAgICAgIHBvaW50LCBpbmRleCwgcmF0aW8sIHBlcnBMZW5ndGgsIG51bTtcblxuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgdG90YWw7IGkrKylcbiAgICB7XG4gICAgICAgIHBvaW50ID0gcG9pbnRzW2ldO1xuICAgICAgICBpbmRleCA9IGkgKiA0O1xuXG4gICAgICAgIGlmKGkgPCBwb2ludHMubGVuZ3RoLTEpXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5leHRQb2ludCA9IHBvaW50c1tpKzFdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgbmV4dFBvaW50ID0gcG9pbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBwZXJwLnkgPSAtKG5leHRQb2ludC54IC0gbGFzdFBvaW50LngpO1xuICAgICAgICBwZXJwLnggPSBuZXh0UG9pbnQueSAtIGxhc3RQb2ludC55O1xuXG4gICAgICAgIHJhdGlvID0gKDEgLSAoaSAvICh0b3RhbC0xKSkpICogMTA7XG4gICAgICAgICAgICAgICAgaWYocmF0aW8gPiAxKXJhdGlvID0gMTtcblxuICAgICAgICBwZXJwTGVuZ3RoID0gTWF0aC5zcXJ0KHBlcnAueCAqIHBlcnAueCArIHBlcnAueSAqIHBlcnAueSk7XG4gICAgICAgIG51bSA9IHRoaXMudGV4dHVyZS5oZWlnaHQvMi8vKDIwICsgTWF0aC5hYnMoTWF0aC5zaW4oKGkgKyB0aGlzLmNvdW50KSAqIDAuMykgKiA1MCkgKSogcmF0aW87XG4gICAgICAgIHBlcnAueCAvPSBwZXJwTGVuZ3RoO1xuICAgICAgICBwZXJwLnkgLz0gcGVycExlbmd0aDtcblxuICAgICAgICBwZXJwLnggKj0gbnVtO1xuICAgICAgICBwZXJwLnkgKj0gbnVtO1xuXG4gICAgICAgIHZlcnRpY2llc1tpbmRleF0gPSBwb2ludC54ICsgcGVycC54XG4gICAgICAgIHZlcnRpY2llc1tpbmRleCsxXSA9IHBvaW50LnkgKyBwZXJwLnlcbiAgICAgICAgdmVydGljaWVzW2luZGV4KzJdID0gcG9pbnQueCAtIHBlcnAueFxuICAgICAgICB2ZXJ0aWNpZXNbaW5kZXgrM10gPSBwb2ludC55IC0gcGVycC55XG5cbiAgICAgICAgbGFzdFBvaW50ID0gcG9pbnQ7XG4gICAgfVxuXG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwoIHRoaXMgKTtcbn07XG5cbnByb3RvLnNldFRleHR1cmUgPSBmdW5jdGlvbiBzZXRUZXh0dXJlKHRleHR1cmUpXG57XG4gICAgLy8gc3RvcCBjdXJyZW50IHRleHR1cmVcbiAgICB0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSb3BlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqIGJhc2VkIG9uIHBpeGkgaW1wYWN0IHNwaW5lIGltcGxlbWVudGF0aW9uIG1hZGUgYnkgRWVtZWxpIEtlbG9rb3JwaSAoQGVrZWxva29ycGkpIGh0dHBzOi8vZ2l0aHViLmNvbS9la2Vsb2tvcnBpXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHNwaW5lID0gcmVxdWlyZSgnLi4vdXRpbHMvc3BpbmUnKTtcbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG52YXIgU3ByaXRlID0gcmVxdWlyZSgnLi4vZGlzcGxheS9TcHJpdGUnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xuXG4vKipcbiAqIEEgY2xhc3MgdGhhdCBlbmFibGVzIHRoZSB5b3UgdG8gaW1wb3J0IGFuZCBydW4geW91ciBzcGluZSBhbmltYXRpb25zIGluIHBpeGkuXG4gKiBTcGluZSBhbmltYXRpb24gZGF0YSBuZWVkcyB0byBiZSBsb2FkZWQgdXNpbmcgdGhlIEFzc2V0TG9hZGVyIG9yIFNwaW5lTG9hZGVyIGJlZm9yZSBpdCBjYW4gYmUgdXNlZCBieSB0aGlzIGNsYXNzXG4gKiBTZWUgZXhhbXBsZSAxMiAoaHR0cDovL3d3dy5nb29kYm95ZGlnaXRhbC5jb20vcGl4aWpzL2V4YW1wbGVzLzEyLykgdG8gc2VlIGEgd29ya2luZyBleGFtcGxlIGFuZCBjaGVjayBvdXQgdGhlIHNvdXJjZVxuICpcbiAqIEBjbGFzcyBTcGluZVxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdXJsIHtTdHJpbmd9IFRoZSB1cmwgb2YgdGhlIHNwaW5lIGFuaW0gZmlsZSB0byBiZSB1c2VkXG4gKi9cbmZ1bmN0aW9uIFNwaW5lKHVybCkge1xuICAgIERpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMuc3BpbmVEYXRhID0gU3BpbmUuYW5pbUNhY2hlW3VybF07XG5cbiAgICBpZiAoIXRoaXMuc3BpbmVEYXRhKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNwaW5lIGRhdGEgbXVzdCBiZSBwcmVsb2FkZWQgdXNpbmcgU3BpbmVMb2FkZXIgb3IgQXNzZXRMb2FkZXI6IFwiICsgdXJsKTtcbiAgICB9XG5cbiAgICB0aGlzLnNrZWxldG9uID0gbmV3IHNwaW5lLlNrZWxldG9uKHRoaXMuc3BpbmVEYXRhKTtcbiAgICB0aGlzLnNrZWxldG9uLnVwZGF0ZVdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICB0aGlzLnN0YXRlRGF0YSA9IG5ldyBzcGluZS5BbmltYXRpb25TdGF0ZURhdGEodGhpcy5zcGluZURhdGEpO1xuICAgIHRoaXMuc3RhdGUgPSBuZXcgc3BpbmUuQW5pbWF0aW9uU3RhdGUodGhpcy5zdGF0ZURhdGEpO1xuXG4gICAgdGhpcy5zbG90Q29udGFpbmVycyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIG4gPSB0aGlzLnNrZWxldG9uLmRyYXdPcmRlci5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIHNsb3QgPSB0aGlzLnNrZWxldG9uLmRyYXdPcmRlcltpXTtcbiAgICAgICAgdmFyIGF0dGFjaG1lbnQgPSBzbG90LmF0dGFjaG1lbnQ7XG4gICAgICAgIHZhciBzbG90Q29udGFpbmVyID0gbmV3IERpc3BsYXlPYmplY3RDb250YWluZXIoKTtcbiAgICAgICAgdGhpcy5zbG90Q29udGFpbmVycy5wdXNoKHNsb3RDb250YWluZXIpO1xuICAgICAgICB0aGlzLmFkZENoaWxkKHNsb3RDb250YWluZXIpO1xuICAgICAgICBpZiAoIShhdHRhY2htZW50IGluc3RhbmNlb2Ygc3BpbmUuUmVnaW9uQXR0YWNobWVudCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHZhciBzcHJpdGVOYW1lID0gYXR0YWNobWVudC5yZW5kZXJlck9iamVjdC5uYW1lO1xuICAgICAgICB2YXIgc3ByaXRlID0gdGhpcy5jcmVhdGVTcHJpdGUoc2xvdCwgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdCk7XG4gICAgICAgIHNsb3QuY3VycmVudFNwcml0ZSA9IHNwcml0ZTtcbiAgICAgICAgc2xvdC5jdXJyZW50U3ByaXRlTmFtZSA9IHNwcml0ZU5hbWU7XG4gICAgICAgIHNsb3RDb250YWluZXIuYWRkQ2hpbGQoc3ByaXRlKTtcbiAgICB9XG59XG5cbnZhciBwcm90byA9IFNwaW5lLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBTcGluZX1cbn0pO1xuXG4vKlxuICogVXBkYXRlcyB0aGUgb2JqZWN0IHRyYW5zZm9ybSBmb3IgcmVuZGVyaW5nXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpIHtcbiAgICB0aGlzLmxhc3RUaW1lID0gdGhpcy5sYXN0VGltZSB8fCBEYXRlLm5vdygpO1xuICAgIHZhciB0aW1lRGVsdGEgPSAoRGF0ZS5ub3coKSAtIHRoaXMubGFzdFRpbWUpICogMC4wMDE7XG4gICAgdGhpcy5sYXN0VGltZSA9IERhdGUubm93KCk7XG4gICAgdGhpcy5zdGF0ZS51cGRhdGUodGltZURlbHRhKTtcbiAgICB0aGlzLnN0YXRlLmFwcGx5KHRoaXMuc2tlbGV0b24pO1xuICAgIHRoaXMuc2tlbGV0b24udXBkYXRlV29ybGRUcmFuc2Zvcm0oKTtcblxuICAgIHZhciBkcmF3T3JkZXIgPSB0aGlzLnNrZWxldG9uLmRyYXdPcmRlcjtcbiAgICBmb3IgKHZhciBpID0gMCwgbiA9IGRyYXdPcmRlci5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIHNsb3QgPSBkcmF3T3JkZXJbaV07XG4gICAgICAgIHZhciBhdHRhY2htZW50ID0gc2xvdC5hdHRhY2htZW50O1xuICAgICAgICB2YXIgc2xvdENvbnRhaW5lciA9IHRoaXMuc2xvdENvbnRhaW5lcnNbaV07XG4gICAgICAgIGlmICghKGF0dGFjaG1lbnQgaW5zdGFuY2VvZiBzcGluZS5SZWdpb25BdHRhY2htZW50KSkge1xuICAgICAgICAgICAgc2xvdENvbnRhaW5lci52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAoIXNsb3QuY3VycmVudFNwcml0ZU5hbWUgfHwgc2xvdC5jdXJyZW50U3ByaXRlTmFtZSAhPSBhdHRhY2htZW50Lm5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3ByaXRlTmFtZSA9IGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QubmFtZTtcbiAgICAgICAgICAgICAgICBpZiAoc2xvdC5jdXJyZW50U3ByaXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2xvdC5jdXJyZW50U3ByaXRlLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2xvdC5zcHJpdGVzID0gc2xvdC5zcHJpdGVzIHx8IHt9O1xuICAgICAgICAgICAgICAgIGlmIChzbG90LnNwcml0ZXNbc3ByaXRlTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBzbG90LnNwcml0ZXNbc3ByaXRlTmFtZV0udmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNwcml0ZSA9IHRoaXMuY3JlYXRlU3ByaXRlKHNsb3QsIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICBzbG90Q29udGFpbmVyLmFkZENoaWxkKHNwcml0ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNsb3QuY3VycmVudFNwcml0ZSA9IHNsb3Quc3ByaXRlc1tzcHJpdGVOYW1lXTtcbiAgICAgICAgICAgICAgICBzbG90LmN1cnJlbnRTcHJpdGVOYW1lID0gc3ByaXRlTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzbG90Q29udGFpbmVyLnZpc2libGUgPSB0cnVlO1xuXG4gICAgICAgIHZhciBib25lID0gc2xvdC5ib25lO1xuXG4gICAgICAgIHNsb3RDb250YWluZXIucG9zaXRpb24ueCA9IGJvbmUud29ybGRYICsgYXR0YWNobWVudC54ICogYm9uZS5tMDAgKyBhdHRhY2htZW50LnkgKiBib25lLm0wMTtcbiAgICAgICAgc2xvdENvbnRhaW5lci5wb3NpdGlvbi55ID0gYm9uZS53b3JsZFkgKyBhdHRhY2htZW50LnggKiBib25lLm0xMCArIGF0dGFjaG1lbnQueSAqIGJvbmUubTExO1xuICAgICAgICBzbG90Q29udGFpbmVyLnNjYWxlLnggPSBib25lLndvcmxkU2NhbGVYO1xuICAgICAgICBzbG90Q29udGFpbmVyLnNjYWxlLnkgPSBib25lLndvcmxkU2NhbGVZO1xuXG4gICAgICAgIHNsb3RDb250YWluZXIucm90YXRpb24gPSAtKHNsb3QuYm9uZS53b3JsZFJvdGF0aW9uICogTWF0aC5QSSAvIDE4MCk7XG4gICAgfVxuXG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyk7XG59O1xuXG5wcm90by5jcmVhdGVTcHJpdGUgPSBmdW5jdGlvbiBjcmVhdGVTcHJpdGUoc2xvdCwgZGVzY3JpcHRvcikge1xuICAgIHZhciBuYW1lID0gVGV4dHVyZS5jYWNoZVtkZXNjcmlwdG9yLm5hbWVdID8gZGVzY3JpcHRvci5uYW1lIDogZGVzY3JpcHRvci5uYW1lICsgXCIucG5nXCI7XG4gICAgdmFyIHNwcml0ZSA9IG5ldyBTcHJpdGUoVGV4dHVyZS5mcm9tRnJhbWUobmFtZSkpO1xuICAgIHNwcml0ZS5zY2FsZSA9IGRlc2NyaXB0b3Iuc2NhbGU7XG4gICAgc3ByaXRlLnJvdGF0aW9uID0gZGVzY3JpcHRvci5yb3RhdGlvbjtcbiAgICBzcHJpdGUuYW5jaG9yLnggPSBzcHJpdGUuYW5jaG9yLnkgPSAwLjU7XG5cbiAgICBzbG90LnNwcml0ZXMgPSBzbG90LnNwcml0ZXMgfHwge307XG4gICAgc2xvdC5zcHJpdGVzW2Rlc2NyaXB0b3IubmFtZV0gPSBzcHJpdGU7XG4gICAgcmV0dXJuIHNwcml0ZTtcbn07XG5cblNwaW5lLmFuaW1DYWNoZSA9IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNwaW5lO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGJsZW5kTW9kZXMgPSByZXF1aXJlKCcuLi9kaXNwbGF5L2JsZW5kTW9kZXMnKTtcbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG5cbmZ1bmN0aW9uIFN0cmlwKHRleHR1cmUsIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKCB0aGlzICk7XG4gICAgdGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcbiAgICB0aGlzLmJsZW5kTW9kZSA9IGJsZW5kTW9kZXMuTk9STUFMO1xuXG4gICAgdHJ5XG4gICAge1xuICAgICAgICB0aGlzLnV2cyA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDEsXG4gICAgICAgICAgICAgICAgMSwgMSxcbiAgICAgICAgICAgICAgICAxLCAwLCAwLDFdKTtcblxuICAgICAgICB0aGlzLnZlcnRpY2llcyA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAwXSk7XG5cbiAgICAgICAgdGhpcy5jb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KFsxLCAxLCAxLCAxXSk7XG5cbiAgICAgICAgdGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KFswLCAxLCAyLCAzXSk7XG4gICAgfVxuICAgIGNhdGNoKGVycm9yKVxuICAgIHtcbiAgICAgICAgdGhpcy51dnMgPSBbMCwgMSxcbiAgICAgICAgICAgICAgICAxLCAxLFxuICAgICAgICAgICAgICAgIDEsIDAsIDAsMV07XG5cbiAgICAgICAgdGhpcy52ZXJ0aWNpZXMgPSBbMCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAwLDAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDBdO1xuXG4gICAgICAgIHRoaXMuY29sb3JzID0gWzEsIDEsIDEsIDFdO1xuXG4gICAgICAgIHRoaXMuaW5kaWNlcyA9IFswLCAxLCAyLCAzXTtcbiAgICB9XG5cblxuICAgIC8qXG4gICAgdGhpcy51dnMgPSBuZXcgRmxvYXQzMkFycmF5KClcbiAgICB0aGlzLnZlcnRpY2llcyA9IG5ldyBGbG9hdDMyQXJyYXkoKVxuICAgIHRoaXMuY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheSgpXG4gICAgdGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KClcbiovXG4gICAgdGhpcy53aWR0aCA9IHdpZHRoO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgLy8gbG9hZCB0aGUgdGV4dHVyZSFcbiAgICBpZih0ZXh0dXJlLmJhc2VUZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIHRoaXMud2lkdGggICA9IHRoaXMudGV4dHVyZS5mcmFtZS53aWR0aDtcbiAgICAgICAgdGhpcy5oZWlnaHQgID0gdGhpcy50ZXh0dXJlLmZyYW1lLmhlaWdodDtcbiAgICAgICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICAgICAgdGhpcy50ZXh0dXJlLmFkZEV2ZW50TGlzdGVuZXIoICd1cGRhdGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGF0Lm9uVGV4dHVyZVVwZGF0ZSgpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnJlbmRlcmFibGUgPSB0cnVlO1xufVxuXG52YXIgcHJvdG8gPSBTdHJpcC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogU3RyaXB9XG59KTtcblxucHJvdG8uc2V0VGV4dHVyZSA9IGZ1bmN0aW9uIHNldFRleHR1cmUodGV4dHVyZSlcbntcbiAgICAvL1RPRE8gU0VUIFRIRSBURVhUVVJFU1xuICAgIC8vVE9ETyBWSVNJQklMSVRZXG5cbiAgICAvLyBzdG9wIGN1cnJlbnQgdGV4dHVyZVxuICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG4gICAgdGhpcy53aWR0aCAgID0gdGV4dHVyZS5mcmFtZS53aWR0aDtcbiAgICB0aGlzLmhlaWdodCAgPSB0ZXh0dXJlLmZyYW1lLmhlaWdodDtcbiAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbn07XG5cbnByb3RvLm9uVGV4dHVyZVVwZGF0ZSA9IGZ1bmN0aW9uIG9uVGV4dHVyZVVwZGF0ZShldmVudClcbntcbiAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbn07XG4vLyBzb21lIGhlbHBlciBmdW5jdGlvbnMuLlxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0cmlwO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGJsZW5kTW9kZXMgPSByZXF1aXJlKCcuLi9kaXNwbGF5L2JsZW5kTW9kZXMnKTtcbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi9nZW9tL1BvaW50Jyk7XG5cbi8qKlxuICogQSB0aWxpbmcgc3ByaXRlIGlzIGEgZmFzdCB3YXkgb2YgcmVuZGVyaW5nIGEgdGlsaW5nIGltYWdlXG4gKlxuICogQGNsYXNzIFRpbGluZ1Nwcml0ZVxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX0gdGhlIHRleHR1cmUgb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSAgdGhlIHdpZHRoIG9mIHRoZSB0aWxpbmcgc3ByaXRlXG4gKiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9IHRoZSBoZWlnaHQgb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAqL1xuZnVuY3Rpb24gVGlsaW5nU3ByaXRlKHRleHR1cmUsIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKCB0aGlzICk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGV4dHVyZSB0aGF0IHRoZSBzcHJpdGUgaXMgdXNpbmdcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0ZXh0dXJlXG4gICAgICogQHR5cGUgVGV4dHVyZVxuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSB3aWR0aDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzY2FsaW5nIG9mIHRoZSBpbWFnZSB0aGF0IGlzIGJlaW5nIHRpbGVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdGlsZVNjYWxlXG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLnRpbGVTY2FsZSA9IG5ldyBQb2ludCgxLDEpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG9mZnNldCBwb3NpdGlvbiBvZiB0aGUgaW1hZ2UgdGhhdCBpcyBiZWluZyB0aWxlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRpbGVQb3NpdGlvblxuICAgICAqIEB0eXBlIFBvaW50XG4gICAgICovXG4gICAgdGhpcy50aWxlUG9zaXRpb24gPSBuZXcgUG9pbnQoMCwwKTtcblxuICAgIHRoaXMucmVuZGVyYWJsZSA9IHRydWU7XG5cbiAgICB0aGlzLmJsZW5kTW9kZSA9IGJsZW5kTW9kZXMuTk9STUFMO1xufVxuXG52YXIgcHJvdG8gPSBUaWxpbmdTcHJpdGUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFRpbGluZ1Nwcml0ZX1cbn0pO1xuXG4vKipcbiAqIFNldHMgdGhlIHRleHR1cmUgb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIHNldFRleHR1cmVcbiAqIEBwYXJhbSB0ZXh0dXJlIHtUZXh0dXJlfSBUaGUgdGV4dHVyZSB0aGF0IGlzIGRpc3BsYXllZCBieSB0aGUgc3ByaXRlXG4gKi9cbnByb3RvLnNldFRleHR1cmUgPSBmdW5jdGlvbiBzZXRUZXh0dXJlKHRleHR1cmUpXG57XG4gICAgLy9UT0RPIFNFVCBUSEUgVEVYVFVSRVNcbiAgICAvL1RPRE8gVklTSUJJTElUWVxuXG4gICAgLy8gc3RvcCBjdXJyZW50IHRleHR1cmVcbiAgICB0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBXaGVuIHRoZSB0ZXh0dXJlIGlzIHVwZGF0ZWQsIHRoaXMgZXZlbnQgd2lsbCBmaXJlIHRvIHVwZGF0ZSB0aGUgZnJhbWVcbiAqXG4gKiBAbWV0aG9kIG9uVGV4dHVyZVVwZGF0ZVxuICogQHBhcmFtIGV2ZW50XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vblRleHR1cmVVcGRhdGUgPSBmdW5jdGlvbiBvblRleHR1cmVVcGRhdGUoZXZlbnQpXG57XG4gICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRpbGluZ1Nwcml0ZTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gRmlsdGVyQmxvY2sobWFzaylcbntcbiAgICB0aGlzLmdyYXBoaWNzID0gbWFzaztcbiAgICB0aGlzLnZpc2libGUgPSB0cnVlO1xuICAgIHRoaXMucmVuZGVyYWJsZSA9IHRydWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVyQmxvY2s7XG4iLCIvKipcbiAqIEBhdXRob3IgQ2hhZCBFbmdsZXIgPGNoYWRAcGFudGhlcmRldi5jb20+XG4gKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBUaGUgQ2lyY2xlIG9iamVjdCBjYW4gYmUgdXNlZCB0byBzcGVjaWZ5IGEgaGl0IGFyZWEgZm9yIGRpc3BsYXlvYmplY3RzXG4gKlxuICogQGNsYXNzIENpcmNsZVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0geCB7TnVtYmVyfSBUaGUgWCBjb29yZCBvZiB0aGUgdXBwZXItbGVmdCBjb3JuZXIgb2YgdGhlIGZyYW1pbmcgcmVjdGFuZ2xlIG9mIHRoaXMgY2lyY2xlXG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgdXBwZXItbGVmdCBjb3JuZXIgb2YgdGhlIGZyYW1pbmcgcmVjdGFuZ2xlIG9mIHRoaXMgY2lyY2xlXG4gKiBAcGFyYW0gcmFkaXVzIHtOdW1iZXJ9IFRoZSByYWRpdXMgb2YgdGhlIGNpcmNsZVxuICovXG5mdW5jdGlvbiBDaXJjbGUoeCwgeSwgcmFkaXVzKVxue1xuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB4XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueCA9IHggfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB5XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueSA9IHkgfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSByYWRpdXNcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXMgfHwgMDtcbn1cblxudmFyIHByb3RvID0gQ2lyY2xlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgY2xvbmUgb2YgdGhpcyBDaXJjbGUgaW5zdGFuY2VcbiAqXG4gKiBAbWV0aG9kIGNsb25lXG4gKiBAcmV0dXJuIHtDaXJjbGV9IGEgY29weSBvZiB0aGUgcG9seWdvblxuICovXG5wcm90by5jbG9uZSA9IGZ1bmN0aW9uIGNsb25lKClcbntcbiAgICByZXR1cm4gbmV3IENpcmNsZSh0aGlzLngsIHRoaXMueSwgdGhpcy5yYWRpdXMpO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIHgsIGFuZCB5IGNvb3JkcyBwYXNzZWQgdG8gdGhpcyBmdW5jdGlvbiBhcmUgY29udGFpbmVkIHdpdGhpbiB0aGlzIGNpcmNsZVxuICpcbiAqIEBtZXRob2QgY29udGFpbnNcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgcG9pbnQgdG8gdGVzdFxuICogQHJldHVybiB7Qm9vbGVhbn0gaWYgdGhlIHgveSBjb29yZHMgYXJlIHdpdGhpbiB0aGlzIHBvbHlnb25cbiAqL1xucHJvdG8uY29udGFpbnMgPSBmdW5jdGlvbiBjb250YWlucyh4LCB5KVxue1xuICAgIGlmKHRoaXMucmFkaXVzIDw9IDApXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIHZhciBkeCA9ICh0aGlzLnggLSB4KSxcbiAgICAgICAgZHkgPSAodGhpcy55IC0geSksXG4gICAgICAgIHIyID0gdGhpcy5yYWRpdXMgKiB0aGlzLnJhZGl1cztcblxuICAgIGR4ICo9IGR4O1xuICAgIGR5ICo9IGR5O1xuXG4gICAgcmV0dXJuIChkeCArIGR5IDw9IHIyKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2lyY2xlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIENoYWQgRW5nbGVyIDxjaGFkQHBhbnRoZXJkZXYuY29tPlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBSZWN0YW5nbGUgPSByZXF1aXJlKCcuL1JlY3RhbmdsZScpO1xuXG4vKipcbiAqIFRoZSBFbGxpcHNlIG9iamVjdCBjYW4gYmUgdXNlZCB0byBzcGVjaWZ5IGEgaGl0IGFyZWEgZm9yIGRpc3BsYXlvYmplY3RzXG4gKlxuICogQGNsYXNzIEVsbGlwc2VcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHVwcGVyLWxlZnQgY29ybmVyIG9mIHRoZSBmcmFtaW5nIHJlY3RhbmdsZSBvZiB0aGlzIGVsbGlwc2VcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSB1cHBlci1sZWZ0IGNvcm5lciBvZiB0aGUgZnJhbWluZyByZWN0YW5nbGUgb2YgdGhpcyBlbGxpcHNlXG4gKiBAcGFyYW0gd2lkdGgge051bWJlcn0gVGhlIG92ZXJhbGwgd2lkdGggb2YgdGhpcyBlbGxpcHNlXG4gKiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9IFRoZSBvdmVyYWxsIGhlaWdodCBvZiB0aGlzIGVsbGlwc2VcbiAqL1xuZnVuY3Rpb24gRWxsaXBzZSh4LCB5LCB3aWR0aCwgaGVpZ2h0KVxue1xuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB4XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueCA9IHggfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB5XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueSA9IHkgfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLndpZHRoID0gd2lkdGggfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQgfHwgMDtcbn1cblxudmFyIHByb3RvID0gRWxsaXBzZS5wcm90b3R5cGU7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGNsb25lIG9mIHRoaXMgRWxsaXBzZSBpbnN0YW5jZVxuICpcbiAqIEBtZXRob2QgY2xvbmVcbiAqIEByZXR1cm4ge0VsbGlwc2V9IGEgY29weSBvZiB0aGUgZWxsaXBzZVxuICovXG5wcm90by5jbG9uZSA9IGZ1bmN0aW9uIGNsb25lKClcbntcbiAgICByZXR1cm4gbmV3IEVsbGlwc2UodGhpcy54LCB0aGlzLnksIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbn07XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSB4LCBhbmQgeSBjb29yZHMgcGFzc2VkIHRvIHRoaXMgZnVuY3Rpb24gYXJlIGNvbnRhaW5lZCB3aXRoaW4gdGhpcyBlbGxpcHNlXG4gKlxuICogQG1ldGhvZCBjb250YWluc1xuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHBvaW50IHRvIHRlc3RcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSBpZiB0aGUgeC95IGNvb3JkcyBhcmUgd2l0aGluIHRoaXMgZWxsaXBzZVxuICovXG5wcm90by5jb250YWlucyA9IGZ1bmN0aW9uIGNvbnRhaW5zKHgsIHkpXG57XG4gICAgaWYodGhpcy53aWR0aCA8PSAwIHx8IHRoaXMuaGVpZ2h0IDw9IDApXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIC8vbm9ybWFsaXplIHRoZSBjb29yZHMgdG8gYW4gZWxsaXBzZSB3aXRoIGNlbnRlciAwLDBcbiAgICAvL2FuZCBhIHJhZGl1cyBvZiAwLjVcbiAgICB2YXIgbm9ybXggPSAoKHggLSB0aGlzLngpIC8gdGhpcy53aWR0aCkgLSAwLjUsXG4gICAgICAgIG5vcm15ID0gKCh5IC0gdGhpcy55KSAvIHRoaXMuaGVpZ2h0KSAtIDAuNTtcblxuICAgIG5vcm14ICo9IG5vcm14O1xuICAgIG5vcm15ICo9IG5vcm15O1xuXG4gICAgcmV0dXJuIChub3JteCArIG5vcm15IDwgMC4yNSk7XG59O1xuXG5wcm90by5nZXRCb3VuZHMgPSBmdW5jdGlvbiBnZXRCb3VuZHMoKVxue1xuICAgIHJldHVybiBuZXcgUmVjdGFuZ2xlKHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVsbGlwc2U7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVGhlIFBvaW50IG9iamVjdCByZXByZXNlbnRzIGEgbG9jYXRpb24gaW4gYSB0d28tZGltZW5zaW9uYWwgY29vcmRpbmF0ZSBzeXN0ZW0sIHdoZXJlIHggcmVwcmVzZW50cyB0aGUgaG9yaXpvbnRhbCBheGlzIGFuZCB5IHJlcHJlc2VudHMgdGhlIHZlcnRpY2FsIGF4aXMuXG4gKlxuICogQGNsYXNzIFBvaW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IHBvc2l0aW9uIG9mIHRoZSBwb2ludFxuICogQHBhcmFtIHkge051bWJlcn0gcG9zaXRpb24gb2YgdGhlIHBvaW50XG4gKi9cbmZ1bmN0aW9uIFBvaW50KHgsIHkpXG57XG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHhcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy54ID0geCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHlcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy55ID0geSB8fCAwO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBjbG9uZSBvZiB0aGlzIHBvaW50XG4gKlxuICogQG1ldGhvZCBjbG9uZVxuICogQHJldHVybiB7UG9pbnR9IGEgY29weSBvZiB0aGUgcG9pbnRcbiAqL1xuUG9pbnQucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKVxue1xuICAgIHJldHVybiBuZXcgUG9pbnQodGhpcy54LCB0aGlzLnkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQb2ludDtcbiIsIi8qKlxuICogQGF1dGhvciBBZHJpZW4gQnJhdWx0IDxhZHJpZW4uYnJhdWx0QGdtYWlsLmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUG9pbnQgPSByZXF1aXJlKCcuL1BvaW50Jyk7XG5cbi8qKlxuICogQGNsYXNzIFBvbHlnb25cbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHBvaW50cyoge0FycmF5PFBvaW50PnxBcnJheTxOdW1iZXI+fFBvaW50Li4ufE51bWJlci4uLn0gVGhpcyBjYW4gYmUgYW4gYXJyYXkgb2YgUG9pbnRzIHRoYXQgZm9ybSB0aGUgcG9seWdvbixcbiAqICAgICAgYSBmbGF0IGFycmF5IG9mIG51bWJlcnMgdGhhdCB3aWxsIGJlIGludGVycHJldGVkIGFzIFt4LHksIHgseSwgLi4uXSwgb3IgdGhlIGFydWdtZW50cyBwYXNzZWQgY2FuIGJlXG4gKiAgICAgIGFsbCB0aGUgcG9pbnRzIG9mIHRoZSBwb2x5Z29uIGUuZy4gYG5ldyBQb2x5Z29uKG5ldyBQb2ludCgpLCBuZXcgUG9pbnQoKSwgLi4uKWAsIG9yIHRoZVxuICogICAgICBhcmd1bWVudHMgcGFzc2VkIGNhbiBiZSBmbGF0IHgseSB2YWx1ZXMgZS5nLiBgbmV3IFBvbHlnb24oeCx5LCB4LHksIHgseSwgLi4uKWAgd2hlcmUgYHhgIGFuZCBgeWAgYXJlXG4gKiAgICAgIE51bWJlcnMuXG4gKi9cbmZ1bmN0aW9uIFBvbHlnb24ocG9pbnRzKVxue1xuICAgIC8vaWYgcG9pbnRzIGlzbid0IGFuIGFycmF5LCB1c2UgYXJndW1lbnRzIGFzIHRoZSBhcnJheVxuICAgIGlmKCEocG9pbnRzIGluc3RhbmNlb2YgQXJyYXkpKVxuICAgICAgICBwb2ludHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgLy9pZiB0aGlzIGlzIGEgZmxhdCBhcnJheSBvZiBudW1iZXJzLCBjb252ZXJ0IGl0IHRvIHBvaW50c1xuICAgIGlmKHR5cGVvZiBwb2ludHNbMF0gPT09ICdudW1iZXInKSB7XG4gICAgICAgIHZhciBwID0gW107XG4gICAgICAgIGZvcih2YXIgaSA9IDAsIGlsID0gcG9pbnRzLmxlbmd0aDsgaSA8IGlsOyBpKz0yKSB7XG4gICAgICAgICAgICBwLnB1c2goXG4gICAgICAgICAgICAgICAgbmV3IFBvaW50KHBvaW50c1tpXSwgcG9pbnRzW2kgKyAxXSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBwb2ludHMgPSBwO1xuICAgIH1cblxuICAgIHRoaXMucG9pbnRzID0gcG9pbnRzO1xufVxuXG52YXIgcHJvdG8gPSBQb2x5Z29uLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgY2xvbmUgb2YgdGhpcyBwb2x5Z29uXG4gKlxuICogQG1ldGhvZCBjbG9uZVxuICogQHJldHVybiB7UG9seWdvbn0gYSBjb3B5IG9mIHRoZSBwb2x5Z29uXG4gKi9cbnByb3RvLmNsb25lID0gZnVuY3Rpb24oKVxue1xuICAgIHZhciBwb2ludHMgPSBbXTtcbiAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcG9pbnRzLnB1c2godGhpcy5wb2ludHNbaV0uY2xvbmUoKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQb2x5Z29uKHBvaW50cyk7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgeCwgYW5kIHkgY29vcmRzIHBhc3NlZCB0byB0aGlzIGZ1bmN0aW9uIGFyZSBjb250YWluZWQgd2l0aGluIHRoaXMgcG9seWdvblxuICpcbiAqIEBtZXRob2QgY29udGFpbnNcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgcG9pbnQgdG8gdGVzdFxuICogQHJldHVybiB7Qm9vbGVhbn0gaWYgdGhlIHgveSBjb29yZHMgYXJlIHdpdGhpbiB0aGlzIHBvbHlnb25cbiAqL1xucHJvdG8uY29udGFpbnMgPSBmdW5jdGlvbih4LCB5KVxue1xuICAgIHZhciBpbnNpZGUgPSBmYWxzZTtcblxuICAgIC8vIHVzZSBzb21lIHJheWNhc3RpbmcgdG8gdGVzdCBoaXRzXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3N1YnN0YWNrL3BvaW50LWluLXBvbHlnb24vYmxvYi9tYXN0ZXIvaW5kZXguanNcbiAgICBmb3IodmFyIGkgPSAwLCBqID0gdGhpcy5wb2ludHMubGVuZ3RoIC0gMTsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaiA9IGkrKykge1xuICAgICAgICB2YXIgeGkgPSB0aGlzLnBvaW50c1tpXS54LCB5aSA9IHRoaXMucG9pbnRzW2ldLnksXG4gICAgICAgICAgICB4aiA9IHRoaXMucG9pbnRzW2pdLngsIHlqID0gdGhpcy5wb2ludHNbal0ueSxcbiAgICAgICAgICAgIGludGVyc2VjdCA9ICgoeWkgPiB5KSAhPSAoeWogPiB5KSkgJiYgKHggPCAoeGogLSB4aSkgKiAoeSAtIHlpKSAvICh5aiAtIHlpKSArIHhpKTtcblxuICAgICAgICBpZihpbnRlcnNlY3QpIGluc2lkZSA9ICFpbnNpZGU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGluc2lkZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUG9seWdvbjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tL1xuICovXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogdGhlIFJlY3RhbmdsZSBvYmplY3QgaXMgYW4gYXJlYSBkZWZpbmVkIGJ5IGl0cyBwb3NpdGlvbiwgYXMgaW5kaWNhdGVkIGJ5IGl0cyB0b3AtbGVmdCBjb3JuZXIgcG9pbnQgKHgsIHkpIGFuZCBieSBpdHMgd2lkdGggYW5kIGl0cyBoZWlnaHQuXG4gKlxuICogQGNsYXNzIFJlY3RhbmdsZVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0geCB7TnVtYmVyfSBUaGUgWCBjb29yZCBvZiB0aGUgdXBwZXItbGVmdCBjb3JuZXIgb2YgdGhlIHJlY3RhbmdsZVxuICogQHBhcmFtIHkge051bWJlcn0gVGhlIFkgY29vcmQgb2YgdGhlIHVwcGVyLWxlZnQgY29ybmVyIG9mIHRoZSByZWN0YW5nbGVcbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSBUaGUgb3ZlcmFsbCB3aWR0aCBvZiB0aGlzIHJlY3RhbmdsZVxuICogQHBhcmFtIGhlaWdodCB7TnVtYmVyfSBUaGUgb3ZlcmFsbCBoZWlnaHQgb2YgdGhpcyByZWN0YW5nbGVcbiAqL1xuZnVuY3Rpb24gUmVjdGFuZ2xlKHgsIHksIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHhcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy54ID0geCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHlcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy55ID0geSB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHdpZHRoXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSB3aWR0aCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IGhlaWdodFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodCB8fCAwO1xufVxudmFyIHByb3RvID0gUmVjdGFuZ2xlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgY2xvbmUgb2YgdGhpcyBSZWN0YW5nbGVcbiAqXG4gKiBAbWV0aG9kIGNsb25lXG4gKiBAcmV0dXJuIHtSZWN0YW5nbGV9IGEgY29weSBvZiB0aGUgcmVjdGFuZ2xlXG4gKi9cbnByb3RvLmNsb25lID0gZnVuY3Rpb24oKVxue1xuICAgIHJldHVybiBuZXcgUmVjdGFuZ2xlKHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgeCwgYW5kIHkgY29vcmRzIHBhc3NlZCB0byB0aGlzIGZ1bmN0aW9uIGFyZSBjb250YWluZWQgd2l0aGluIHRoaXMgUmVjdGFuZ2xlXG4gKlxuICogQG1ldGhvZCBjb250YWluc1xuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHBvaW50IHRvIHRlc3RcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSBpZiB0aGUgeC95IGNvb3JkcyBhcmUgd2l0aGluIHRoaXMgUmVjdGFuZ2xlXG4gKi9cbnByb3RvLmNvbnRhaW5zID0gZnVuY3Rpb24oeCwgeSlcbntcbiAgICBpZiAodGhpcy53aWR0aCA8PSAwIHx8IHRoaXMuaGVpZ2h0IDw9IDApXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIHZhciB4MSA9IHRoaXMueDtcbiAgICBpZiAoeCA+PSB4MSAmJiB4IDw9IHgxICsgdGhpcy53aWR0aClcbiAgICB7XG4gICAgICAgIHZhciB5MSA9IHRoaXMueTtcblxuICAgICAgICBpZiAoeSA+PSB5MSAmJiB5IDw9IHkxICsgdGhpcy5oZWlnaHQpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWN0YW5nbGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qXG4gKiBBIGxpZ2h0ZXIgdmVyc2lvbiBvZiB0aGUgcmFkIGdsLW1hdHJpeCBjcmVhdGVkIGJ5IEJyYW5kb24gSm9uZXMsIENvbGluIE1hY0tlbnppZSBJVlxuICogeW91IGJvdGggcm9jayFcbiAqL1xuXG52YXIgTWF0cml4ID0gZXhwb3J0cy5NYXRyaXggPSAodHlwZW9mIEZsb2F0MzJBcnJheSAhPT0gJ3VuZGVmaW5lZCcpID8gRmxvYXQzMkFycmF5IDogQXJyYXk7XG52YXIgbWF0MyAgID0gZXhwb3J0cy5tYXQzID0ge307XG52YXIgbWF0NCAgID0gZXhwb3J0cy5tYXQ0ID0ge307XG5cbm1hdDMuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKClcbntcbiAgICB2YXIgbWF0cml4ID0gbmV3IE1hdHJpeCg5KTtcblxuICAgIG1hdHJpeFswXSA9IDE7XG4gICAgbWF0cml4WzFdID0gMDtcbiAgICBtYXRyaXhbMl0gPSAwO1xuICAgIG1hdHJpeFszXSA9IDA7XG4gICAgbWF0cml4WzRdID0gMTtcbiAgICBtYXRyaXhbNV0gPSAwO1xuICAgIG1hdHJpeFs2XSA9IDA7XG4gICAgbWF0cml4WzddID0gMDtcbiAgICBtYXRyaXhbOF0gPSAxO1xuXG4gICAgcmV0dXJuIG1hdHJpeDtcbn07XG5cbm1hdDMuaWRlbnRpdHkgPSBmdW5jdGlvbiBpZGVudGl0eShtYXRyaXgpXG57XG4gICAgbWF0cml4WzBdID0gMTtcbiAgICBtYXRyaXhbMV0gPSAwO1xuICAgIG1hdHJpeFsyXSA9IDA7XG4gICAgbWF0cml4WzNdID0gMDtcbiAgICBtYXRyaXhbNF0gPSAxO1xuICAgIG1hdHJpeFs1XSA9IDA7XG4gICAgbWF0cml4WzZdID0gMDtcbiAgICBtYXRyaXhbN10gPSAwO1xuICAgIG1hdHJpeFs4XSA9IDE7XG5cbiAgICByZXR1cm4gbWF0cml4O1xufTtcblxubWF0NC5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoKVxue1xuICAgIHZhciBtYXRyaXggPSBuZXcgTWF0cml4KDE2KTtcblxuICAgIG1hdHJpeFswXSA9IDE7XG4gICAgbWF0cml4WzFdID0gMDtcbiAgICBtYXRyaXhbMl0gPSAwO1xuICAgIG1hdHJpeFszXSA9IDA7XG4gICAgbWF0cml4WzRdID0gMDtcbiAgICBtYXRyaXhbNV0gPSAxO1xuICAgIG1hdHJpeFs2XSA9IDA7XG4gICAgbWF0cml4WzddID0gMDtcbiAgICBtYXRyaXhbOF0gPSAwO1xuICAgIG1hdHJpeFs5XSA9IDA7XG4gICAgbWF0cml4WzEwXSA9IDE7XG4gICAgbWF0cml4WzExXSA9IDA7XG4gICAgbWF0cml4WzEyXSA9IDA7XG4gICAgbWF0cml4WzEzXSA9IDA7XG4gICAgbWF0cml4WzE0XSA9IDA7XG4gICAgbWF0cml4WzE1XSA9IDE7XG5cbiAgICByZXR1cm4gbWF0cml4O1xufTtcblxubWF0My5tdWx0aXBseSA9IGZ1bmN0aW9uIG11bHRpcGx5KG1hdCwgbWF0MiwgZGVzdClcbntcbiAgICBpZiAoIWRlc3QpIHsgZGVzdCA9IG1hdDsgfVxuXG4gICAgLy8gQ2FjaGUgdGhlIG1hdHJpeCB2YWx1ZXMgKG1ha2VzIGZvciBodWdlIHNwZWVkIGluY3JlYXNlcyEpXG4gICAgdmFyIGEwMCA9IG1hdFswXSwgYTAxID0gbWF0WzFdLCBhMDIgPSBtYXRbMl0sXG4gICAgICAgIGExMCA9IG1hdFszXSwgYTExID0gbWF0WzRdLCBhMTIgPSBtYXRbNV0sXG4gICAgICAgIGEyMCA9IG1hdFs2XSwgYTIxID0gbWF0WzddLCBhMjIgPSBtYXRbOF0sXG5cbiAgICAgICAgYjAwID0gbWF0MlswXSwgYjAxID0gbWF0MlsxXSwgYjAyID0gbWF0MlsyXSxcbiAgICAgICAgYjEwID0gbWF0MlszXSwgYjExID0gbWF0Mls0XSwgYjEyID0gbWF0Mls1XSxcbiAgICAgICAgYjIwID0gbWF0Mls2XSwgYjIxID0gbWF0Mls3XSwgYjIyID0gbWF0Mls4XTtcblxuICAgIGRlc3RbMF0gPSBiMDAgKiBhMDAgKyBiMDEgKiBhMTAgKyBiMDIgKiBhMjA7XG4gICAgZGVzdFsxXSA9IGIwMCAqIGEwMSArIGIwMSAqIGExMSArIGIwMiAqIGEyMTtcbiAgICBkZXN0WzJdID0gYjAwICogYTAyICsgYjAxICogYTEyICsgYjAyICogYTIyO1xuXG4gICAgZGVzdFszXSA9IGIxMCAqIGEwMCArIGIxMSAqIGExMCArIGIxMiAqIGEyMDtcbiAgICBkZXN0WzRdID0gYjEwICogYTAxICsgYjExICogYTExICsgYjEyICogYTIxO1xuICAgIGRlc3RbNV0gPSBiMTAgKiBhMDIgKyBiMTEgKiBhMTIgKyBiMTIgKiBhMjI7XG5cbiAgICBkZXN0WzZdID0gYjIwICogYTAwICsgYjIxICogYTEwICsgYjIyICogYTIwO1xuICAgIGRlc3RbN10gPSBiMjAgKiBhMDEgKyBiMjEgKiBhMTEgKyBiMjIgKiBhMjE7XG4gICAgZGVzdFs4XSA9IGIyMCAqIGEwMiArIGIyMSAqIGExMiArIGIyMiAqIGEyMjtcblxuICAgIHJldHVybiBkZXN0O1xufTtcblxubWF0My5jbG9uZSA9IGZ1bmN0aW9uIGNsb25lKG1hdClcbntcbiAgICB2YXIgbWF0cml4ID0gbmV3IE1hdHJpeCg5KTtcblxuICAgIG1hdHJpeFswXSA9IG1hdFswXTtcbiAgICBtYXRyaXhbMV0gPSBtYXRbMV07XG4gICAgbWF0cml4WzJdID0gbWF0WzJdO1xuICAgIG1hdHJpeFszXSA9IG1hdFszXTtcbiAgICBtYXRyaXhbNF0gPSBtYXRbNF07XG4gICAgbWF0cml4WzVdID0gbWF0WzVdO1xuICAgIG1hdHJpeFs2XSA9IG1hdFs2XTtcbiAgICBtYXRyaXhbN10gPSBtYXRbN107XG4gICAgbWF0cml4WzhdID0gbWF0WzhdO1xuXG4gICAgcmV0dXJuIG1hdHJpeDtcbn07XG5cbm1hdDMudHJhbnNwb3NlID0gZnVuY3Rpb24gdHJhbnNwb3NlKG1hdCwgZGVzdClcbntcbiAgICAvLyBJZiB3ZSBhcmUgdHJhbnNwb3Npbmcgb3Vyc2VsdmVzIHdlIGNhbiBza2lwIGEgZmV3IHN0ZXBzIGJ1dCBoYXZlIHRvIGNhY2hlIHNvbWUgdmFsdWVzXG4gICAgaWYgKCFkZXN0IHx8IG1hdCA9PT0gZGVzdCkge1xuICAgICAgICB2YXIgYTAxID0gbWF0WzFdLCBhMDIgPSBtYXRbMl0sXG4gICAgICAgICAgICBhMTIgPSBtYXRbNV07XG5cbiAgICAgICAgbWF0WzFdID0gbWF0WzNdO1xuICAgICAgICBtYXRbMl0gPSBtYXRbNl07XG4gICAgICAgIG1hdFszXSA9IGEwMTtcbiAgICAgICAgbWF0WzVdID0gbWF0WzddO1xuICAgICAgICBtYXRbNl0gPSBhMDI7XG4gICAgICAgIG1hdFs3XSA9IGExMjtcbiAgICAgICAgcmV0dXJuIG1hdDtcbiAgICB9XG5cbiAgICBkZXN0WzBdID0gbWF0WzBdO1xuICAgIGRlc3RbMV0gPSBtYXRbM107XG4gICAgZGVzdFsyXSA9IG1hdFs2XTtcbiAgICBkZXN0WzNdID0gbWF0WzFdO1xuICAgIGRlc3RbNF0gPSBtYXRbNF07XG4gICAgZGVzdFs1XSA9IG1hdFs3XTtcbiAgICBkZXN0WzZdID0gbWF0WzJdO1xuICAgIGRlc3RbN10gPSBtYXRbNV07XG4gICAgZGVzdFs4XSA9IG1hdFs4XTtcbiAgICByZXR1cm4gZGVzdDtcbn07XG5cbm1hdDMudG9NYXQ0ID0gZnVuY3Rpb24gdG9NYXQ0KG1hdCwgZGVzdClcbntcbiAgICBpZiAoIWRlc3QpIHsgZGVzdCA9IG1hdDQuY3JlYXRlKCk7IH1cblxuICAgIGRlc3RbMTVdID0gMTtcbiAgICBkZXN0WzE0XSA9IDA7XG4gICAgZGVzdFsxM10gPSAwO1xuICAgIGRlc3RbMTJdID0gMDtcblxuICAgIGRlc3RbMTFdID0gMDtcbiAgICBkZXN0WzEwXSA9IG1hdFs4XTtcbiAgICBkZXN0WzldID0gbWF0WzddO1xuICAgIGRlc3RbOF0gPSBtYXRbNl07XG5cbiAgICBkZXN0WzddID0gMDtcbiAgICBkZXN0WzZdID0gbWF0WzVdO1xuICAgIGRlc3RbNV0gPSBtYXRbNF07XG4gICAgZGVzdFs0XSA9IG1hdFszXTtcblxuICAgIGRlc3RbM10gPSAwO1xuICAgIGRlc3RbMl0gPSBtYXRbMl07XG4gICAgZGVzdFsxXSA9IG1hdFsxXTtcbiAgICBkZXN0WzBdID0gbWF0WzBdO1xuXG4gICAgcmV0dXJuIGRlc3Q7XG59O1xuXG5cbi8vLy8vXG5cblxubWF0NC5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoKVxue1xuICAgIHZhciBtYXRyaXggPSBuZXcgTWF0cml4KDE2KTtcblxuICAgIG1hdHJpeFswXSA9IDE7XG4gICAgbWF0cml4WzFdID0gMDtcbiAgICBtYXRyaXhbMl0gPSAwO1xuICAgIG1hdHJpeFszXSA9IDA7XG4gICAgbWF0cml4WzRdID0gMDtcbiAgICBtYXRyaXhbNV0gPSAxO1xuICAgIG1hdHJpeFs2XSA9IDA7XG4gICAgbWF0cml4WzddID0gMDtcbiAgICBtYXRyaXhbOF0gPSAwO1xuICAgIG1hdHJpeFs5XSA9IDA7XG4gICAgbWF0cml4WzEwXSA9IDE7XG4gICAgbWF0cml4WzExXSA9IDA7XG4gICAgbWF0cml4WzEyXSA9IDA7XG4gICAgbWF0cml4WzEzXSA9IDA7XG4gICAgbWF0cml4WzE0XSA9IDA7XG4gICAgbWF0cml4WzE1XSA9IDE7XG5cbiAgICByZXR1cm4gbWF0cml4O1xufTtcblxubWF0NC50cmFuc3Bvc2UgPSBmdW5jdGlvbiB0cmFuc3Bvc2UobWF0LCBkZXN0KVxue1xuICAgIC8vIElmIHdlIGFyZSB0cmFuc3Bvc2luZyBvdXJzZWx2ZXMgd2UgY2FuIHNraXAgYSBmZXcgc3RlcHMgYnV0IGhhdmUgdG8gY2FjaGUgc29tZSB2YWx1ZXNcbiAgICBpZiAoIWRlc3QgfHwgbWF0ID09PSBkZXN0KVxuICAgIHtcbiAgICAgICAgdmFyIGEwMSA9IG1hdFsxXSwgYTAyID0gbWF0WzJdLCBhMDMgPSBtYXRbM10sXG4gICAgICAgICAgICBhMTIgPSBtYXRbNl0sIGExMyA9IG1hdFs3XSxcbiAgICAgICAgICAgIGEyMyA9IG1hdFsxMV07XG5cbiAgICAgICAgbWF0WzFdID0gbWF0WzRdO1xuICAgICAgICBtYXRbMl0gPSBtYXRbOF07XG4gICAgICAgIG1hdFszXSA9IG1hdFsxMl07XG4gICAgICAgIG1hdFs0XSA9IGEwMTtcbiAgICAgICAgbWF0WzZdID0gbWF0WzldO1xuICAgICAgICBtYXRbN10gPSBtYXRbMTNdO1xuICAgICAgICBtYXRbOF0gPSBhMDI7XG4gICAgICAgIG1hdFs5XSA9IGExMjtcbiAgICAgICAgbWF0WzExXSA9IG1hdFsxNF07XG4gICAgICAgIG1hdFsxMl0gPSBhMDM7XG4gICAgICAgIG1hdFsxM10gPSBhMTM7XG4gICAgICAgIG1hdFsxNF0gPSBhMjM7XG4gICAgICAgIHJldHVybiBtYXQ7XG4gICAgfVxuXG4gICAgZGVzdFswXSA9IG1hdFswXTtcbiAgICBkZXN0WzFdID0gbWF0WzRdO1xuICAgIGRlc3RbMl0gPSBtYXRbOF07XG4gICAgZGVzdFszXSA9IG1hdFsxMl07XG4gICAgZGVzdFs0XSA9IG1hdFsxXTtcbiAgICBkZXN0WzVdID0gbWF0WzVdO1xuICAgIGRlc3RbNl0gPSBtYXRbOV07XG4gICAgZGVzdFs3XSA9IG1hdFsxM107XG4gICAgZGVzdFs4XSA9IG1hdFsyXTtcbiAgICBkZXN0WzldID0gbWF0WzZdO1xuICAgIGRlc3RbMTBdID0gbWF0WzEwXTtcbiAgICBkZXN0WzExXSA9IG1hdFsxNF07XG4gICAgZGVzdFsxMl0gPSBtYXRbM107XG4gICAgZGVzdFsxM10gPSBtYXRbN107XG4gICAgZGVzdFsxNF0gPSBtYXRbMTFdO1xuICAgIGRlc3RbMTVdID0gbWF0WzE1XTtcbiAgICByZXR1cm4gZGVzdDtcbn1cblxubWF0NC5tdWx0aXBseSA9IGZ1bmN0aW9uIG11bHRpcGx5KG1hdCwgbWF0MiwgZGVzdClcbntcbiAgICBpZiAoIWRlc3QpIHsgZGVzdCA9IG1hdDsgfVxuXG4gICAgLy8gQ2FjaGUgdGhlIG1hdHJpeCB2YWx1ZXMgKG1ha2VzIGZvciBodWdlIHNwZWVkIGluY3JlYXNlcyEpXG4gICAgdmFyIGEwMCA9IG1hdFsgMF0sIGEwMSA9IG1hdFsgMV0sIGEwMiA9IG1hdFsgMl0sIGEwMyA9IG1hdFszXTtcbiAgICB2YXIgYTEwID0gbWF0WyA0XSwgYTExID0gbWF0WyA1XSwgYTEyID0gbWF0WyA2XSwgYTEzID0gbWF0WzddO1xuICAgIHZhciBhMjAgPSBtYXRbIDhdLCBhMjEgPSBtYXRbIDldLCBhMjIgPSBtYXRbMTBdLCBhMjMgPSBtYXRbMTFdO1xuICAgIHZhciBhMzAgPSBtYXRbMTJdLCBhMzEgPSBtYXRbMTNdLCBhMzIgPSBtYXRbMTRdLCBhMzMgPSBtYXRbMTVdO1xuXG4gICAgLy8gQ2FjaGUgb25seSB0aGUgY3VycmVudCBsaW5lIG9mIHRoZSBzZWNvbmQgbWF0cml4XG4gICAgdmFyIGIwICA9IG1hdDJbMF0sIGIxID0gbWF0MlsxXSwgYjIgPSBtYXQyWzJdLCBiMyA9IG1hdDJbM107XG4gICAgZGVzdFswXSA9IGIwKmEwMCArIGIxKmExMCArIGIyKmEyMCArIGIzKmEzMDtcbiAgICBkZXN0WzFdID0gYjAqYTAxICsgYjEqYTExICsgYjIqYTIxICsgYjMqYTMxO1xuICAgIGRlc3RbMl0gPSBiMCphMDIgKyBiMSphMTIgKyBiMiphMjIgKyBiMyphMzI7XG4gICAgZGVzdFszXSA9IGIwKmEwMyArIGIxKmExMyArIGIyKmEyMyArIGIzKmEzMztcblxuICAgIGIwID0gbWF0Mls0XTtcbiAgICBiMSA9IG1hdDJbNV07XG4gICAgYjIgPSBtYXQyWzZdO1xuICAgIGIzID0gbWF0Mls3XTtcbiAgICBkZXN0WzRdID0gYjAqYTAwICsgYjEqYTEwICsgYjIqYTIwICsgYjMqYTMwO1xuICAgIGRlc3RbNV0gPSBiMCphMDEgKyBiMSphMTEgKyBiMiphMjEgKyBiMyphMzE7XG4gICAgZGVzdFs2XSA9IGIwKmEwMiArIGIxKmExMiArIGIyKmEyMiArIGIzKmEzMjtcbiAgICBkZXN0WzddID0gYjAqYTAzICsgYjEqYTEzICsgYjIqYTIzICsgYjMqYTMzO1xuXG4gICAgYjAgPSBtYXQyWzhdO1xuICAgIGIxID0gbWF0Mls5XTtcbiAgICBiMiA9IG1hdDJbMTBdO1xuICAgIGIzID0gbWF0MlsxMV07XG4gICAgZGVzdFs4XSA9IGIwKmEwMCArIGIxKmExMCArIGIyKmEyMCArIGIzKmEzMDtcbiAgICBkZXN0WzldID0gYjAqYTAxICsgYjEqYTExICsgYjIqYTIxICsgYjMqYTMxO1xuICAgIGRlc3RbMTBdID0gYjAqYTAyICsgYjEqYTEyICsgYjIqYTIyICsgYjMqYTMyO1xuICAgIGRlc3RbMTFdID0gYjAqYTAzICsgYjEqYTEzICsgYjIqYTIzICsgYjMqYTMzO1xuXG4gICAgYjAgPSBtYXQyWzEyXTtcbiAgICBiMSA9IG1hdDJbMTNdO1xuICAgIGIyID0gbWF0MlsxNF07XG4gICAgYjMgPSBtYXQyWzE1XTtcbiAgICBkZXN0WzEyXSA9IGIwKmEwMCArIGIxKmExMCArIGIyKmEyMCArIGIzKmEzMDtcbiAgICBkZXN0WzEzXSA9IGIwKmEwMSArIGIxKmExMSArIGIyKmEyMSArIGIzKmEzMTtcbiAgICBkZXN0WzE0XSA9IGIwKmEwMiArIGIxKmExMiArIGIyKmEyMiArIGIzKmEzMjtcbiAgICBkZXN0WzE1XSA9IGIwKmEwMyArIGIxKmExMyArIGIyKmEyMyArIGIzKmEzMztcblxuICAgIHJldHVybiBkZXN0O1xufTtcbiIsIi8qKlxuICogQGF1dGhvciBEci4gS2liaXR6IDxpbmZvQGRya2liaXR6LmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuL3BsYXRmb3JtJyk7XG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4vY29yZS9nbG9iYWxzJyk7XG52YXIgc2hhZGVycyA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzL3dlYmdsL3NoYWRlcnMnKTtcbnZhciBtYXRyaXggID0gcmVxdWlyZSgnLi9nZW9tL21hdHJpeCcpO1xuXG52YXIgcGl4aSA9IG1vZHVsZS5leHBvcnRzID0gT2JqZWN0LmNyZWF0ZShnbG9iYWxzKTtcblxucGl4aS5Qb2ludCAgICAgPSByZXF1aXJlKCcuL2dlb20vUG9pbnQnKTtcbnBpeGkuUmVjdGFuZ2xlID0gcmVxdWlyZSgnLi9nZW9tL1JlY3RhbmdsZScpO1xucGl4aS5Qb2x5Z29uICAgPSByZXF1aXJlKCcuL2dlb20vUG9seWdvbicpO1xucGl4aS5DaXJjbGUgICAgPSByZXF1aXJlKCcuL2dlb20vQ2lyY2xlJyk7XG5waXhpLkVsbGlwc2UgICA9IHJlcXVpcmUoJy4vZ2VvbS9FbGxpcHNlJyk7XG5waXhpLk1hdHJpeCAgICA9IG1hdHJpeC5NYXRyaXg7XG5waXhpLm1hdDMgICAgICA9IG1hdHJpeC5tYXQzO1xucGl4aS5tYXQ0ICAgICAgPSBtYXRyaXgubWF0NDtcblxucGl4aS5ibGVuZE1vZGVzICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9kaXNwbGF5L2JsZW5kTW9kZXMnKTtcbnBpeGkuRGlzcGxheU9iamVjdCAgICAgICAgICA9IHJlcXVpcmUoJy4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Jyk7XG5waXhpLkRpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuL2Rpc3BsYXkvRGlzcGxheU9iamVjdENvbnRhaW5lcicpO1xucGl4aS5TcHJpdGUgICAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9kaXNwbGF5L1Nwcml0ZScpO1xucGl4aS5Nb3ZpZUNsaXAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9kaXNwbGF5L01vdmllQ2xpcCcpO1xuXG5waXhpLkZpbHRlckJsb2NrID0gcmVxdWlyZSgnLi9maWx0ZXJzL0ZpbHRlckJsb2NrJyk7XG5cbnBpeGkuVGV4dCAgICAgICA9IHJlcXVpcmUoJy4vdGV4dC9UZXh0Jyk7XG5waXhpLkJpdG1hcFRleHQgPSByZXF1aXJlKCcuL3RleHQvQml0bWFwVGV4dCcpO1xuXG5waXhpLkludGVyYWN0aW9uTWFuYWdlciA9IHJlcXVpcmUoJy4vSW50ZXJhY3Rpb25NYW5hZ2VyJyk7XG5waXhpLlN0YWdlICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vZGlzcGxheS9TdGFnZScpO1xuXG5waXhpLkV2ZW50VGFyZ2V0ICAgICAgICA9IHJlcXVpcmUoJy4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG5cbnBpeGkuYXV0b0RldGVjdFJlbmRlcmVyID0gcmVxdWlyZSgnLi91dGlscy9hdXRvRGV0ZWN0UmVuZGVyZXInKTtcbnBpeGkuUG9seUsgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi91dGlscy9Qb2x5aycpO1xuXG5waXhpLldlYkdMR3JhcGhpY3MgICAgPSByZXF1aXJlKCcuL3JlbmRlcmVycy93ZWJnbC9ncmFwaGljcycpO1xucGl4aS5XZWJHTFJlbmRlcmVyICAgID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xSZW5kZXJlcicpO1xucGl4aS5XZWJHTEJhdGNoICAgICAgID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xCYXRjaCcpO1xucGl4aS5XZWJHTFJlbmRlckdyb3VwID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xSZW5kZXJHcm91cCcpO1xucGl4aS5DYW52YXNSZW5kZXJlciAgID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMvY2FudmFzL0NhbnZhc1JlbmRlcmVyJyk7XG5waXhpLkNhbnZhc0dyYXBoaWNzICAgPSByZXF1aXJlKCcuL3JlbmRlcmVycy9jYW52YXMvZ3JhcGhpY3MnKTtcblxucGl4aS5HcmFwaGljcyA9IHJlcXVpcmUoJy4vcHJpbWl0aXZlcy9HcmFwaGljcycpO1xuXG5waXhpLlN0cmlwICAgICAgICAgICAgPSByZXF1aXJlKCcuL2V4dHJhcy9TdHJpcCcpO1xucGl4aS5Sb3BlICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9leHRyYXMvUm9wZScpO1xucGl4aS5UaWxpbmdTcHJpdGUgICAgID0gcmVxdWlyZSgnLi9leHRyYXMvVGlsaW5nU3ByaXRlJyk7XG5waXhpLlNwaW5lICAgICAgICAgICAgPSByZXF1aXJlKCcuL2V4dHJhcy9TcGluZScpO1xucGl4aS5DdXN0b21SZW5kZXJhYmxlID0gcmVxdWlyZSgnLi9leHRyYXMvQ3VzdG9tUmVuZGVyYWJsZScpO1xuXG5waXhpLkJhc2VUZXh0dXJlICAgPSByZXF1aXJlKCcuL3RleHR1cmVzL0Jhc2VUZXh0dXJlJyk7XG5waXhpLlRleHR1cmUgICAgICAgPSByZXF1aXJlKCcuL3RleHR1cmVzL1RleHR1cmUnKTtcbnBpeGkuUmVuZGVyVGV4dHVyZSA9IHJlcXVpcmUoJy4vdGV4dHVyZXMvUmVuZGVyVGV4dHVyZScpO1xuXG5waXhpLkFzc2V0TG9hZGVyICAgICAgID0gcmVxdWlyZSgnLi9sb2FkZXJzL0Fzc2V0TG9hZGVyJyk7XG5waXhpLkpzb25Mb2FkZXIgICAgICAgID0gcmVxdWlyZSgnLi9sb2FkZXJzL0pzb25Mb2FkZXInKTtcbnBpeGkuU3ByaXRlU2hlZXRMb2FkZXIgPSByZXF1aXJlKCcuL2xvYWRlcnMvU3ByaXRlU2hlZXRMb2FkZXInKTtcbnBpeGkuSW1hZ2VMb2FkZXIgICAgICAgPSByZXF1aXJlKCcuL2xvYWRlcnMvSW1hZ2VMb2FkZXInKTtcbnBpeGkuQml0bWFwRm9udExvYWRlciAgPSByZXF1aXJlKCcuL2xvYWRlcnMvQml0bWFwRm9udExvYWRlcicpO1xucGl4aS5TcGluZUxvYWRlciAgICAgICA9IHJlcXVpcmUoJy4vbG9hZGVycy9TcGluZUxvYWRlcicpO1xuXG5waXhpLmluaXRQcmltaXRpdmVTaGFkZXIgICAgID0gc2hhZGVycy5pbml0UHJpbWl0aXZlU2hhZGVyO1xucGl4aS5pbml0RGVmYXVsdFNoYWRlciAgICAgICA9IHNoYWRlcnMuaW5pdERlZmF1bHRTaGFkZXI7XG5waXhpLmluaXREZWZhdWx0U3RyaXBTaGFkZXIgID0gc2hhZGVycy5pbml0RGVmYXVsdFN0cmlwU2hhZGVyO1xucGl4aS5hY3RpdmF0ZURlZmF1bHRTaGFkZXIgICA9IHNoYWRlcnMuYWN0aXZhdGVEZWZhdWx0U2hhZGVyO1xucGl4aS5hY3RpdmF0ZVByaW1pdGl2ZVNoYWRlciA9IHNoYWRlcnMuYWN0aXZhdGVQcmltaXRpdmVTaGFkZXI7XG5cbi8qXG4gKiBERUJVR0dJTkcgT05MWVxuICovXG5waXhpLnJ1bkxpc3QgPSBmdW5jdGlvbiBydW5MaXN0KGl0ZW0pXG57XG4gICAgcGxhdGZvcm0uY29uc29sZS5sb2coXCI+Pj4+Pj4+Pj5cIilcbiAgICBwbGF0Zm9ybS5jb25zb2xlLmxvZyhcIl9cIilcbiAgICB2YXIgc2FmZSA9IDA7XG4gICAgdmFyIHRtcCA9IGl0ZW0uZmlyc3Q7XG4gICAgcGxhdGZvcm0uY29uc29sZS5sb2codG1wKTtcblxuICAgIHdoaWxlKHRtcC5faU5leHQpXG4gICAge1xuICAgICAgICBzYWZlKys7XG4gICAgICAgIHRtcCA9IHRtcC5faU5leHQ7XG4gICAgICAgIHBsYXRmb3JtLmNvbnNvbGUubG9nKHRtcCk7XG5cbiAgICAgICAgaWYoc2FmZSA+IDEwMClcbiAgICAgICAge1xuICAgICAgICAgICAgcGxhdGZvcm0uY29uc29sZS5sb2coXCJCUkVBS1wiKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgIH1cbn07XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBFdmVudFRhcmdldCA9IHJlcXVpcmUoJy4uL2V2ZW50cy9FdmVudFRhcmdldCcpO1xuXG4vKipcbiAqIE1hcHMgZmlsZSBleHRlbnNpb24gdG8gbG9hZGVyIHR5cGVzXG4gKlxuICogQHByb3BlcnR5IGxvYWRlcnNCeVR5cGVcbiAqIEB0eXBlIE9iamVjdFxuICovXG52YXIgbG9hZGVyc0J5VHlwZSA9IHt9O1xuXG4vKipcbiAqIEEgQ2xhc3MgdGhhdCBsb2FkcyBhIGJ1bmNoIG9mIGltYWdlcyAvIHNwcml0ZSBzaGVldCAvIGJpdG1hcCBmb250IGZpbGVzLiBPbmNlIHRoZVxuICogYXNzZXRzIGhhdmUgYmVlbiBsb2FkZWQgdGhleSBhcmUgYWRkZWQgdG8gdGhlIFRleHR1cmUgY2FjaGUgYW5kIGNhbiBiZSBhY2Nlc3NlZFxuICogZWFzaWx5IHRocm91Z2ggVGV4dHVyZS5mcm9tSW1hZ2UoKSBhbmQgU3ByaXRlLmZyb21JbWFnZSgpXG4gKiBXaGVuIGFsbCBpdGVtcyBoYXZlIGJlZW4gbG9hZGVkIHRoaXMgY2xhc3Mgd2lsbCBkaXNwYXRjaCBhIFwib25Mb2FkZWRcIiBldmVudFxuICogQXMgZWFjaCBpbmRpdmlkdWFsIGl0ZW0gaXMgbG9hZGVkIHRoaXMgY2xhc3Mgd2lsbCBkaXNwYXRjaCBhIFwib25Qcm9ncmVzc1wiIGV2ZW50XG4gKlxuICogQGNsYXNzIEFzc2V0TG9hZGVyXG4gKiBAY29uc3RydWN0b3JcbiAqIEB1c2VzIEV2ZW50VGFyZ2V0XG4gKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGFzc2V0VVJMcyBhbiBhcnJheSBvZiBpbWFnZS9zcHJpdGUgc2hlZXQgdXJscyB0aGF0IHlvdSB3b3VsZCBsaWtlIGxvYWRlZFxuICogICAgICBzdXBwb3J0ZWQuIFN1cHBvcnRlZCBpbWFnZSBmb3JtYXRzIGluY2x1ZGUgXCJqcGVnXCIsIFwianBnXCIsIFwicG5nXCIsIFwiZ2lmXCIuIFN1cHBvcnRlZFxuICogICAgICBzcHJpdGUgc2hlZXQgZGF0YSBmb3JtYXRzIG9ubHkgaW5jbHVkZSBcIkpTT05cIiBhdCB0aGlzIHRpbWUuIFN1cHBvcnRlZCBiaXRtYXAgZm9udFxuICogICAgICBkYXRhIGZvcm1hdHMgaW5jbHVkZSBcInhtbFwiIGFuZCBcImZudFwiLlxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKi9cbmZ1bmN0aW9uIEFzc2V0TG9hZGVyKGFzc2V0VVJMcywgY3Jvc3NvcmlnaW4pXG57XG4gICAgRXZlbnRUYXJnZXQuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBhcnJheSBvZiBhc3NldCBVUkxzIHRoYXQgYXJlIGdvaW5nIHRvIGJlIGxvYWRlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGFzc2V0VVJMc1xuICAgICAqIEB0eXBlIEFycmF5PFN0cmluZz5cbiAgICAgKi9cbiAgICB0aGlzLmFzc2V0VVJMcyA9IGFzc2V0VVJMcztcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3NzIG9yaWdpblxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGNyb3Nzb3JpZ2luXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMuY3Jvc3NvcmlnaW4gPSBjcm9zc29yaWdpbjtcbn1cblxudmFyIHByb3RvID0gQXNzZXRMb2FkZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gYW4gaXRlbSBoYXMgbG9hZGVkXG4gKiBAZXZlbnQgb25Qcm9ncmVzc1xuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiBhbGwgdGhlIGFzc2V0cyBoYXZlIGxvYWRlZFxuICogQGV2ZW50IG9uQ29tcGxldGVcbiAqL1xuXG4vKipcbiAqIFN0YXJ0cyBsb2FkaW5nIHRoZSBhc3NldHMgc2VxdWVudGlhbGx5XG4gKlxuICogQG1ldGhvZCBsb2FkXG4gKi9cbnByb3RvLmxvYWQgPSBmdW5jdGlvbiBsb2FkKClcbntcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gb25Mb2FkKCkge1xuICAgICAgICBzY29wZS5vbkFzc2V0TG9hZGVkKCk7XG4gICAgfVxuXG4gICAgdGhpcy5sb2FkQ291bnQgPSB0aGlzLmFzc2V0VVJMcy5sZW5ndGg7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuYXNzZXRVUkxzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBmaWxlTmFtZSA9IHRoaXMuYXNzZXRVUkxzW2ldO1xuICAgICAgICB2YXIgZmlsZVR5cGUgPSBmaWxlTmFtZS5zcGxpdChcIi5cIikucG9wKCkudG9Mb3dlckNhc2UoKTtcblxuICAgICAgICB2YXIgQ29uc3RydWN0b3IgPSBsb2FkZXJzQnlUeXBlW2ZpbGVUeXBlXTtcbiAgICAgICAgaWYoIUNvbnN0cnVjdG9yKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZpbGVUeXBlICsgXCIgaXMgYW4gdW5zdXBwb3J0ZWQgZmlsZSB0eXBlXCIpO1xuXG4gICAgICAgIHZhciBsb2FkZXIgPSBuZXcgQ29uc3RydWN0b3IoZmlsZU5hbWUsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuXG4gICAgICAgIGxvYWRlci5hZGRFdmVudExpc3RlbmVyKFwibG9hZGVkXCIsIG9uTG9hZCk7XG4gICAgICAgIGxvYWRlci5sb2FkKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbnZva2VkIGFmdGVyIGVhY2ggZmlsZSBpcyBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIG9uQXNzZXRMb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uQXNzZXRMb2FkZWQgPSBmdW5jdGlvbiBvbkFzc2V0TG9hZGVkKClcbntcbiAgICB0aGlzLmxvYWRDb3VudC0tO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogXCJvblByb2dyZXNzXCIsIGNvbnRlbnQ6IHRoaXN9KTtcbiAgICBpZiAodGhpcy5vblByb2dyZXNzKSB0aGlzLm9uUHJvZ3Jlc3MoKTtcblxuICAgIGlmICghdGhpcy5sb2FkQ291bnQpXG4gICAge1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6IFwib25Db21wbGV0ZVwiLCBjb250ZW50OiB0aGlzfSk7XG4gICAgICAgIGlmKHRoaXMub25Db21wbGV0ZSkgdGhpcy5vbkNvbXBsZXRlKCk7XG4gICAgfVxufTtcblxuQXNzZXRMb2FkZXIucmVnaXN0ZXJMb2FkZXJUeXBlID0gZnVuY3Rpb24gcmVnaXN0ZXJMb2FkZXJUeXBlKHR5cGUsIGNvbnN0cnVjdG9yKVxue1xuICAgIGxvYWRlcnNCeVR5cGVbdHlwZV0gPSBjb25zdHJ1Y3Rvcjtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXNzZXRMb2FkZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBc3NldExvYWRlciA9IHJlcXVpcmUoJy4vQXNzZXRMb2FkZXInKTtcbnZhciBJbWFnZUxvYWRlciA9IHJlcXVpcmUoJy4vSW1hZ2VMb2FkZXInKTtcbnZhciBSZWN0YW5nbGUgPSByZXF1aXJlKCcuLi9nZW9tL1JlY3RhbmdsZScpO1xudmFyIEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG52YXIgQml0bWFwVGV4dCA9IHJlcXVpcmUoJy4uL3RleHQvQml0bWFwVGV4dCcpO1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuLi90ZXh0dXJlcy9UZXh0dXJlJyk7XG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xuXG4vKipcbiAqIFRoZSB4bWwgbG9hZGVyIGlzIHVzZWQgdG8gbG9hZCBpbiBYTUwgYml0bWFwIGZvbnQgZGF0YSAoXCJ4bWxcIiBvciBcImZudFwiKVxuICogVG8gZ2VuZXJhdGUgdGhlIGRhdGEgeW91IGNhbiB1c2UgaHR0cDovL3d3dy5hbmdlbGNvZGUuY29tL3Byb2R1Y3RzL2JtZm9udC9cbiAqIFRoaXMgbG9hZGVyIHdpbGwgYWxzbyBsb2FkIHRoZSBpbWFnZSBmaWxlIGFzIHRoZSBkYXRhLlxuICogV2hlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgXCJsb2FkZWRcIiBldmVudFxuICpcbiAqIEBjbGFzcyBCaXRtYXBGb250TG9hZGVyXG4gKiBAdXNlcyBFdmVudFRhcmdldFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdXJsIHtTdHJpbmd9IFRoZSB1cmwgb2YgdGhlIHNwcml0ZSBzaGVldCBKU09OIGZpbGVcbiAqIEBwYXJhbSBjcm9zc29yaWdpbiB7Qm9vbGVhbn0gV2hldGhlciByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zc29yaWdpblxuICovXG5mdW5jdGlvbiBCaXRtYXBGb250TG9hZGVyKHVybCwgY3Jvc3NvcmlnaW4pXG57XG4gICAgLypcbiAgICAgKiBpIHVzZSB0ZXh0dXJlIHBhY2tlciB0byBsb2FkIHRoZSBhc3NldHMuLlxuICAgICAqIGh0dHA6Ly93d3cuY29kZWFuZHdlYi5jb20vdGV4dHVyZXBhY2tlclxuICAgICAqIG1ha2Ugc3VyZSB0byBzZXQgdGhlIGZvcm1hdCBhcyBcIkpTT05cIlxuICAgICAqL1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdXJsIG9mIHRoZSBiaXRtYXAgZm9udCBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zcyBvcmlnaW5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjcm9zc29yaWdpblxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLmNyb3Nzb3JpZ2luID0gY3Jvc3NvcmlnaW47XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgYmFzZSB1cmwgb2YgdGhlIGJpdG1hcCBmb250IGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBiYXNlVXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5iYXNlVXJsID0gdXJsLnJlcGxhY2UoL1teXFwvXSokLywgXCJcIik7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBXaGV0aGVyIHRoZSBkYXRhIGhhcyBsb2FkZWQgeWV0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbG9hZGVkXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgdGV4dHVyZSBvZiB0aGUgYml0bWFwIGZvbnRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBiYXNlVXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy50ZXh0dXJlID0gbnVsbDtcbn1cblxudmFyIHByb3RvID0gQml0bWFwRm9udExvYWRlci5wcm90b3R5cGU7XG5cbnByb3RvLmhhbmRsZUV2ZW50ID0gZnVuY3Rpb24gaGFuZGxlRXZlbnQoZXZlbnQpIHtcbiAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcbiAgICBjYXNlICdsb2FkJzpcbiAgICAgICAgdGhpcy5vblhNTExvYWRlZCgpOyBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLm9uRXJyb3IoKTsgYnJlYWs7XG4gICAgfVxufTtcblxuLyoqXG4gKiBMb2FkcyB0aGUgWE1MIGZvbnQgZGF0YVxuICpcbiAqIEBtZXRob2QgbG9hZFxuICovXG5wcm90by5sb2FkID0gZnVuY3Rpb24gbG9hZCgpXG57XG4gICAgdGhpcy5yZXF1ZXN0ID0gcGxhdGZvcm0uY3JlYXRlUmVxdWVzdCgpO1xuICAgIHRoaXMucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcyk7XG4gICAgdGhpcy5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcyk7XG5cbiAgICB0aGlzLnJlcXVlc3Qub3BlbihcIkdFVFwiLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgaWYgKHRoaXMucmVxdWVzdC5vdmVycmlkZU1pbWVUeXBlKSB0aGlzLnJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZShcImFwcGxpY2F0aW9uL3htbFwiKTtcbiAgICB0aGlzLnJlcXVlc3Quc2VuZChudWxsKVxufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gWE1MIGZpbGUgaXMgbG9hZGVkLCBwYXJzZXMgdGhlIGRhdGFcbiAqXG4gKiBAbWV0aG9kIG9uWE1MTG9hZGVkXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vblhNTExvYWRlZCA9IGZ1bmN0aW9uIG9uWE1MTG9hZGVkKClcbntcbiAgICB2YXIgdGV4dHVyZVVybCA9IHRoaXMuYmFzZVVybCArIHRoaXMucmVxdWVzdC5yZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInBhZ2VcIilbMF0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oXCJmaWxlXCIpLm5vZGVWYWx1ZTtcbiAgICB2YXIgaW1hZ2UgPSBuZXcgSW1hZ2VMb2FkZXIodGV4dHVyZVVybCwgdGhpcy5jcm9zc29yaWdpbik7XG4gICAgdGhpcy50ZXh0dXJlID0gaW1hZ2UudGV4dHVyZS5iYXNlVGV4dHVyZTtcblxuICAgIHZhciBkYXRhID0ge307XG4gICAgdmFyIGluZm8gPSB0aGlzLnJlcXVlc3QucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbmZvXCIpWzBdO1xuICAgIHZhciBjb21tb24gPSB0aGlzLnJlcXVlc3QucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJjb21tb25cIilbMF07XG4gICAgZGF0YS5mb250ID0gaW5mby5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbShcImZhY2VcIikubm9kZVZhbHVlO1xuICAgIGRhdGEuc2l6ZSA9IHBhcnNlSW50KGluZm8uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oXCJzaXplXCIpLm5vZGVWYWx1ZSwgMTApO1xuICAgIGRhdGEubGluZUhlaWdodCA9IHBhcnNlSW50KGNvbW1vbi5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbShcImxpbmVIZWlnaHRcIikubm9kZVZhbHVlLCAxMCk7XG4gICAgZGF0YS5jaGFycyA9IHt9O1xuXG4gICAgLy9wYXJzZSBsZXR0ZXJzXG4gICAgdmFyIGxldHRlcnMgPSB0aGlzLnJlcXVlc3QucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJjaGFyXCIpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZXR0ZXJzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGNoYXJDb2RlID0gcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbShcImlkXCIpLm5vZGVWYWx1ZSwgMTApO1xuXG4gICAgICAgIHZhciB0ZXh0dXJlUmVjdCA9IG5ldyBSZWN0YW5nbGUoXG4gICAgICAgICAgICBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKFwieFwiKS5ub2RlVmFsdWUsIDEwKSxcbiAgICAgICAgICAgIHBhcnNlSW50KGxldHRlcnNbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oXCJ5XCIpLm5vZGVWYWx1ZSwgMTApLFxuICAgICAgICAgICAgcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbShcIndpZHRoXCIpLm5vZGVWYWx1ZSwgMTApLFxuICAgICAgICAgICAgcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbShcImhlaWdodFwiKS5ub2RlVmFsdWUsIDEwKVxuICAgICAgICApO1xuXG4gICAgICAgIGRhdGEuY2hhcnNbY2hhckNvZGVdID0ge1xuICAgICAgICAgICAgeE9mZnNldDogcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbShcInhvZmZzZXRcIikubm9kZVZhbHVlLCAxMCksXG4gICAgICAgICAgICB5T2Zmc2V0OiBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKFwieW9mZnNldFwiKS5ub2RlVmFsdWUsIDEwKSxcbiAgICAgICAgICAgIHhBZHZhbmNlOiBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKFwieGFkdmFuY2VcIikubm9kZVZhbHVlLCAxMCksXG4gICAgICAgICAgICBrZXJuaW5nOiB7fSxcbiAgICAgICAgICAgIHRleHR1cmU6IFRleHR1cmUuY2FjaGVbY2hhckNvZGVdID0gbmV3IFRleHR1cmUodGhpcy50ZXh0dXJlLCB0ZXh0dXJlUmVjdClcblxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vcGFyc2Uga2VybmluZ3NcbiAgICB2YXIga2VybmluZ3MgPSB0aGlzLnJlcXVlc3QucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJrZXJuaW5nXCIpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBrZXJuaW5ncy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgdmFyIGZpcnN0ID0gcGFyc2VJbnQoa2VybmluZ3NbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oXCJmaXJzdFwiKS5ub2RlVmFsdWUsIDEwKTtcbiAgICAgICB2YXIgc2Vjb25kID0gcGFyc2VJbnQoa2VybmluZ3NbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oXCJzZWNvbmRcIikubm9kZVZhbHVlLCAxMCk7XG4gICAgICAgdmFyIGFtb3VudCA9IHBhcnNlSW50KGtlcm5pbmdzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKFwiYW1vdW50XCIpLm5vZGVWYWx1ZSwgMTApO1xuXG4gICAgICAgIGRhdGEuY2hhcnNbc2Vjb25kXS5rZXJuaW5nW2ZpcnN0XSA9IGFtb3VudDtcblxuICAgIH1cblxuICAgIEJpdG1hcFRleHQuZm9udHNbZGF0YS5mb250XSA9IGRhdGE7XG5cbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIGltYWdlLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkZWRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHNjb3BlLm9uTG9hZGVkKCk7XG4gICAgfSk7XG4gICAgaW1hZ2UubG9hZCgpO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gYWxsIGZpbGVzIGFyZSBsb2FkZWQgKHhtbC9mbnQgYW5kIHRleHR1cmUpXG4gKlxuICogQG1ldGhvZCBvbkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Mb2FkZWQgPSBmdW5jdGlvbiBvbkxvYWRlZCgpXG57XG4gICAgdGhpcy5sb2FkZWQgPSB0cnVlO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogXCJsb2FkZWRcIiwgY29udGVudDogdGhpc30pO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBlcnJvciBvY2N1cmVkXG4gKlxuICogQG1ldGhvZCBvbkVycm9yXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkVycm9yID0gZnVuY3Rpb24gb25FcnJvcigpXG57XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiBcImVycm9yXCIsIGNvbnRlbnQ6IHRoaXN9KTtcbn07XG5cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgneG1sJywgQml0bWFwRm9udExvYWRlcik7XG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUoJ2ZudCcsIEJpdG1hcEZvbnRMb2FkZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJpdG1hcEZvbnRMb2FkZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBc3NldExvYWRlciA9IHJlcXVpcmUoJy4vQXNzZXRMb2FkZXInKTtcbnZhciBFdmVudFRhcmdldCA9IHJlcXVpcmUoJy4uL2V2ZW50cy9FdmVudFRhcmdldCcpO1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuLi90ZXh0dXJlcy9UZXh0dXJlJyk7XG5cbi8qKlxuICogVGhlIGltYWdlIGxvYWRlciBjbGFzcyBpcyByZXNwb25zaWJsZSBmb3IgbG9hZGluZyBpbWFnZXMgZmlsZSBmb3JtYXRzIChcImpwZWdcIiwgXCJqcGdcIiwgXCJwbmdcIiBhbmQgXCJnaWZcIilcbiAqIE9uY2UgdGhlIGltYWdlIGhhcyBiZWVuIGxvYWRlZCBpdCBpcyBzdG9yZWQgaW4gdGhlIHRleHR1cmUgY2FjaGUgYW5kIGNhbiBiZSBhY2Nlc3NlZCB0aG91Z2ggVGV4dHVyZS5mcm9tRnJhbWVJZCgpIGFuZCBTcHJpdGUuZnJvbUZyb21lSWQoKVxuICogV2hlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgJ2xvYWRlZCcgZXZlbnRcbiAqXG4gKiBAY2xhc3MgSW1hZ2VMb2FkZXJcbiAqIEB1c2VzIEV2ZW50VGFyZ2V0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB1cmwge1N0cmluZ30gVGhlIHVybCBvZiB0aGUgaW1hZ2VcbiAqIEBwYXJhbSBjcm9zc29yaWdpbiB7Qm9vbGVhbn0gV2hldGhlciByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zc29yaWdpblxuICovXG5mdW5jdGlvbiBJbWFnZUxvYWRlcih1cmwsIGNyb3Nzb3JpZ2luKVxue1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGV4dHVyZSBiZWluZyBsb2FkZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0ZXh0dXJlXG4gICAgICogQHR5cGUgVGV4dHVyZVxuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZSA9IFRleHR1cmUuZnJvbUltYWdlKHVybCwgY3Jvc3NvcmlnaW4pO1xuXG4gICAgLyoqXG4gICAgICogaWYgdGhlIGltYWdlIGlzIGxvYWRlZCB3aXRoIGxvYWRGcmFtZWRTcHJpdGVTaGVldFxuICAgICAqIGZyYW1lcyB3aWxsIGNvbnRhaW4gdGhlIHNwcml0ZSBzaGVldCBmcmFtZXNcbiAgICAgKlxuICAgICAqL1xuICAgIHRoaXMuZnJhbWVzID0gW107XG59XG5cbnZhciBwcm90byA9IEltYWdlTG9hZGVyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBMb2FkcyBpbWFnZSBvciB0YWtlcyBpdCBmcm9tIGNhY2hlXG4gKlxuICogQG1ldGhvZCBsb2FkXG4gKi9cbnByb3RvLmxvYWQgPSBmdW5jdGlvbiBsb2FkKClcbntcbiAgICBpZighdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgICAgIHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5hZGRFdmVudExpc3RlbmVyKFwibG9hZGVkXCIsIGZ1bmN0aW9uKClcbiAgICAgICAge1xuICAgICAgICAgICAgc2NvcGUub25Mb2FkZWQoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMub25Mb2FkZWQoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEludm9rZWQgd2hlbiBpbWFnZSBmaWxlIGlzIGxvYWRlZCBvciBpdCBpcyBhbHJlYWR5IGNhY2hlZCBhbmQgcmVhZHkgdG8gdXNlXG4gKlxuICogQG1ldGhvZCBvbkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Mb2FkZWQgPSBmdW5jdGlvbiBvbkxvYWRlZCgpXG57XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiBcImxvYWRlZFwiLCBjb250ZW50OiB0aGlzfSk7XG59O1xuXG4vKipcbiAqIExvYWRzIGltYWdlIGFuZCBzcGxpdCBpdCB0byB1bmlmb3JtIHNpemVkIGZyYW1lc1xuICpcbiAqXG4gKiBAbWV0aG9kIGxvYWRGcmFtZWRTcHJpdGVTaGVldFxuICogQHBhcmFtIGZyYW1lV2lkdGgge051bWJlcn0gd2l0aCBvZiBlYWNoIGZyYW1lXG4gKiBAcGFyYW0gZnJhbWVIZWlnaHQge051bWJlcn0gaGVpZ2h0IG9mIGVhY2ggZnJhbWVcbiAqIEBwYXJhbSB0ZXh0dXJlTmFtZSB7U3RyaW5nfSBpZiBnaXZlbiwgdGhlIGZyYW1lcyB3aWxsIGJlIGNhY2hlZCBpbiA8dGV4dHVyZU5hbWU+LTxvcmQ+IGZvcm1hdFxuICovXG5wcm90by5sb2FkRnJhbWVkU3ByaXRlU2hlZXQgPSBmdW5jdGlvbihmcmFtZVdpZHRoLCBmcmFtZUhlaWdodCwgdGV4dHVyZU5hbWUpXG57XG4gICAgdGhpcy5mcmFtZXMgPSBbXTtcbiAgICB2YXIgY29scyA9IE1hdGguZmxvb3IodGhpcy50ZXh0dXJlLndpZHRoIC8gZnJhbWVXaWR0aCk7XG4gICAgdmFyIHJvd3MgPSBNYXRoLmZsb29yKHRoaXMudGV4dHVyZS5oZWlnaHQgLyBmcmFtZUhlaWdodCk7XG5cbiAgICB2YXIgaT0wO1xuICAgIGZvciAodmFyIHk9MDsgeTxyb3dzOyB5KyspXG4gICAge1xuICAgICAgICBmb3IgKHZhciB4PTA7IHg8Y29sczsgeCsrLGkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIHRleHR1cmUgPSBuZXcgVGV4dHVyZSh0aGlzLnRleHR1cmUsIHtcbiAgICAgICAgICAgICAgICB4OiB4KmZyYW1lV2lkdGgsXG4gICAgICAgICAgICAgICAgeTogeSpmcmFtZUhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogZnJhbWVXaWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IGZyYW1lSGVpZ2h0XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5mcmFtZXMucHVzaCh0ZXh0dXJlKTtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlTmFtZSkgVGV4dHVyZS5jYWNoZVt0ZXh0dXJlTmFtZSsnLScraV0gPSB0ZXh0dXJlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoIXRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQpXG4gICAge1xuICAgICAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgICAgICB0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRlZFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNjb3BlLm9uTG9hZGVkKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLm9uTG9hZGVkKCk7XG4gICAgfVxufTtcblxuQXNzZXRMb2FkZXIucmVnaXN0ZXJMb2FkZXJUeXBlKCdqcGcnLCBJbWFnZUxvYWRlcik7XG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUoJ2pwZWcnLCBJbWFnZUxvYWRlcik7XG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUoJ3BuZycsIEltYWdlTG9hZGVyKTtcbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgnZ2lmJywgSW1hZ2VMb2FkZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEltYWdlTG9hZGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXNzZXRMb2FkZXIgPSByZXF1aXJlKCcuL0Fzc2V0TG9hZGVyJyk7XG52YXIgSW1hZ2VMb2FkZXIgPSByZXF1aXJlKCcuL0ltYWdlTG9hZGVyJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xudmFyIFNwaW5lID0gcmVxdWlyZSgnLi4vZXh0cmFzL1NwaW5lJyk7XG52YXIgU2tlbGV0b25Kc29uID0gcmVxdWlyZSgnLi4vdXRpbHMvc3BpbmUnKS5Ta2VsZXRvbkpzb247XG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xuXG4vKipcbiAqIFRoZSBqc29uIGZpbGUgbG9hZGVyIGlzIHVzZWQgdG8gbG9hZCBpbiBKU09OIGRhdGEgYW5kIHBhcnNpbmcgaXRcbiAqIFdoZW4gbG9hZGVkIHRoaXMgY2xhc3Mgd2lsbCBkaXNwYXRjaCBhIFwibG9hZGVkXCIgZXZlbnRcbiAqIElmIGxvYWQgZmFpbGVkIHRoaXMgY2xhc3Mgd2lsbCBkaXNwYXRjaCBhIFwiZXJyb3JcIiBldmVudFxuICpcbiAqIEBjbGFzcyBKc29uTG9hZGVyXG4gKiBAdXNlcyBFdmVudFRhcmdldFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdXJsIHtTdHJpbmd9IFRoZSB1cmwgb2YgdGhlIEpTT04gZmlsZVxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKi9cbmZ1bmN0aW9uIEpzb25Mb2FkZXIodXJsLCBjcm9zc29yaWdpbikge1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdXJsIG9mIHRoZSBiaXRtYXAgZm9udCBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zcyBvcmlnaW5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjcm9zc29yaWdpblxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLmNyb3Nzb3JpZ2luID0gY3Jvc3NvcmlnaW47XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgYmFzZSB1cmwgb2YgdGhlIGJpdG1hcCBmb250IGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBiYXNlVXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5iYXNlVXJsID0gdXJsLnJlcGxhY2UoL1teXFwvXSokLywgXCJcIik7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBXaGV0aGVyIHRoZSBkYXRhIGhhcyBsb2FkZWQgeWV0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbG9hZGVkXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IEpzb25Mb2FkZXIucHJvdG90eXBlO1xuXG5wcm90by5oYW5kbGVFdmVudCA9IGZ1bmN0aW9uIGhhbmRsZUV2ZW50KGV2ZW50KSB7XG4gICAgc3dpdGNoIChldmVudC50eXBlKSB7XG4gICAgY2FzZSAnbG9hZCc6XG4gICAgICAgIHRoaXMub25KU09OTG9hZGVkKCk7IGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMub25FcnJvcigpOyBicmVhaztcbiAgICB9XG59O1xuXG4vKipcbiAqIExvYWRzIHRoZSBKU09OIGRhdGFcbiAqXG4gKiBAbWV0aG9kIGxvYWRcbiAqL1xucHJvdG8ubG9hZCA9IGZ1bmN0aW9uIGxvYWQoKVxue1xuICAgIHRoaXMucmVxdWVzdCA9IHBsYXRmb3JtLmNyZWF0ZVJlcXVlc3QoKTtcbiAgICB0aGlzLnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHRoaXMpO1xuICAgIHRoaXMucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMpO1xuXG4gICAgdGhpcy5yZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdGhpcy51cmwsIHRydWUpO1xuICAgIGlmICh0aGlzLnJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSkgdGhpcy5yZXF1ZXN0Lm92ZXJyaWRlTWltZVR5cGUoXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xuICAgIHRoaXMucmVxdWVzdC5zZW5kKG51bGwpO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBKU09OIGZpbGUgaXMgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBvbkpTT05Mb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uSlNPTkxvYWRlZCA9IGZ1bmN0aW9uIG9uSlNPTkxvYWRlZCgpXG57XG4gICAgdGhpcy5qc29uID0gSlNPTi5wYXJzZSh0aGlzLnJlcXVlc3QucmVzcG9uc2VUZXh0KTtcblxuICAgIGlmKHRoaXMuanNvbi5mcmFtZXMpXG4gICAge1xuICAgICAgICAvLyBzcHJpdGUgc2hlZXRcbiAgICAgICAgdmFyIHNjb3BlID0gdGhpcztcbiAgICAgICAgdmFyIHRleHR1cmVVcmwgPSB0aGlzLmJhc2VVcmwgKyB0aGlzLmpzb24ubWV0YS5pbWFnZTtcbiAgICAgICAgdmFyIGltYWdlID0gbmV3IEltYWdlTG9hZGVyKHRleHR1cmVVcmwsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuICAgICAgICB2YXIgZnJhbWVEYXRhID0gdGhpcy5qc29uLmZyYW1lcztcblxuICAgICAgICB0aGlzLnRleHR1cmUgPSBpbWFnZS50ZXh0dXJlLmJhc2VUZXh0dXJlO1xuICAgICAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKFwibG9hZGVkXCIsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgc2NvcGUub25Mb2FkZWQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yICh2YXIgaSBpbiBmcmFtZURhdGEpIHtcbiAgICAgICAgICAgIHZhciByZWN0ID0gZnJhbWVEYXRhW2ldLmZyYW1lO1xuICAgICAgICAgICAgaWYgKHJlY3QpIHtcbiAgICAgICAgICAgICAgICBUZXh0dXJlLmNhY2hlW2ldID0gbmV3IFRleHR1cmUodGhpcy50ZXh0dXJlLCB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHJlY3QueCxcbiAgICAgICAgICAgICAgICAgICAgeTogcmVjdC55LFxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogcmVjdC53LFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IHJlY3QuaFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChmcmFtZURhdGFbaV0udHJpbW1lZCkge1xuICAgICAgICAgICAgICAgICAgICAvL3ZhciByZWFsU2l6ZSA9IGZyYW1lRGF0YVtpXS5zcHJpdGVTb3VyY2VTaXplO1xuICAgICAgICAgICAgICAgICAgICBUZXh0dXJlLmNhY2hlW2ldLnJlYWxTaXplID0gZnJhbWVEYXRhW2ldLnNwcml0ZVNvdXJjZVNpemU7XG4gICAgICAgICAgICAgICAgICAgIFRleHR1cmUuY2FjaGVbaV0udHJpbS54ID0gMDsgLy8gKHJlYWxTaXplLnggLyByZWN0LncpXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSB0aGUgb2Zmc2V0IVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGltYWdlLmxvYWQoKTtcblxuICAgIH1cbiAgICBlbHNlIGlmKHRoaXMuanNvbi5ib25lcylcbiAgICB7XG4gICAgICAgIC8vIHNwaW5lIGFuaW1hdGlvblxuICAgICAgICB2YXIgc3BpbmVKc29uUGFyc2VyID0gbmV3IFNrZWxldG9uSnNvbigpO1xuICAgICAgICB2YXIgc2tlbGV0b25EYXRhID0gc3BpbmVKc29uUGFyc2VyLnJlYWRTa2VsZXRvbkRhdGEodGhpcy5qc29uKTtcbiAgICAgICAgU3BpbmUuYW5pbUNhY2hlW3RoaXMudXJsXSA9IHNrZWxldG9uRGF0YTtcbiAgICAgICAgdGhpcy5vbkxvYWRlZCgpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLm9uTG9hZGVkKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBqc29uIGZpbGUgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBvbkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Mb2FkZWQgPSBmdW5jdGlvbiBvbkxvYWRlZCgpXG57XG4gICAgdGhpcy5sb2FkZWQgPSB0cnVlO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogXCJsb2FkZWRcIiwgY29udGVudDogdGhpc30pO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBlcnJvciBvY2N1cmVkXG4gKlxuICogQG1ldGhvZCBvbkVycm9yXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkVycm9yID0gZnVuY3Rpb24gb25FcnJvcigpXG57XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiBcImVycm9yXCIsIGNvbnRlbnQ6IHRoaXN9KTtcbn07XG5cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgnanNvbicsIEpzb25Mb2FkZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpzb25Mb2FkZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICogYmFzZWQgb24gcGl4aSBpbXBhY3Qgc3BpbmUgaW1wbGVtZW50YXRpb24gbWFkZSBieSBFZW1lbGkgS2Vsb2tvcnBpIChAZWtlbG9rb3JwaSkgaHR0cHM6Ly9naXRodWIuY29tL2VrZWxva29ycGlcbiAqXG4gKiBBd2Vzb21lIEpTIHJ1biB0aW1lIHByb3ZpZGVkIGJ5IEVzb3RlcmljU29mdHdhcmVcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc290ZXJpY1NvZnR3YXJlL3NwaW5lLXJ1bnRpbWVzXG4gKlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBc3NldExvYWRlciA9IHJlcXVpcmUoJy4vQXNzZXRMb2FkZXInKTtcbnZhciBKc29uTG9hZGVyID0gcmVxdWlyZSgnLi9Kc29uTG9hZGVyJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBTcGluZSA9IHJlcXVpcmUoJy4uL2V4dHJhcy9TcGluZScpO1xudmFyIFNrZWxldG9uSnNvbiA9IHJlcXVpcmUoJy4uL3V0aWxzL3NwaW5lJykuU2tlbGV0b25Kc29uO1xuXG4vKipcbiAqIFRoZSBTcGluZSBsb2FkZXIgaXMgdXNlZCB0byBsb2FkIGluIEpTT04gc3BpbmUgZGF0YVxuICogVG8gZ2VuZXJhdGUgdGhlIGRhdGEgeW91IG5lZWQgdG8gdXNlIGh0dHA6Ly9lc290ZXJpY3NvZnR3YXJlLmNvbS8gYW5kIGV4cG9ydCB0aGUgXCJKU09OXCIgZm9ybWF0XG4gKiBEdWUgdG8gYSBjbGFzaCBvZiBuYW1lcyAgWW91IHdpbGwgbmVlZCB0byBjaGFuZ2UgdGhlIGV4dGVuc2lvbiBvZiB0aGUgc3BpbmUgZmlsZSBmcm9tICouanNvbiB0byAqLmFuaW0gZm9yIGl0IHRvIGxvYWRcbiAqIFNlZSBleGFtcGxlIDEyIChodHRwOi8vd3d3Lmdvb2Rib3lkaWdpdGFsLmNvbS9waXhpanMvZXhhbXBsZXMvMTIvKSB0byBzZWUgYSB3b3JraW5nIGV4YW1wbGUgYW5kIGNoZWNrIG91dCB0aGUgc291cmNlXG4gKiBZb3Ugd2lsbCBuZWVkIHRvIGdlbmVyYXRlIGEgc3ByaXRlIHNoZWV0IHRvIGFjY29tcGFueSB0aGUgc3BpbmUgZGF0YVxuICogV2hlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgXCJsb2FkZWRcIiBldmVudFxuICpcbiAqIEBjbGFzcyBTcGluZVxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHVybCB7U3RyaW5nfSBUaGUgdXJsIG9mIHRoZSBKU09OIGZpbGVcbiAqIEBwYXJhbSBjcm9zc29yaWdpbiB7Qm9vbGVhbn0gV2hldGhlciByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zc29yaWdpblxuICovXG5mdW5jdGlvbiBTcGluZUxvYWRlcih1cmwsIGNyb3Nzb3JpZ2luKVxue1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdXJsIG9mIHRoZSBiaXRtYXAgZm9udCBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zcyBvcmlnaW5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjcm9zc29yaWdpblxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLmNyb3Nzb3JpZ2luID0gY3Jvc3NvcmlnaW47XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBXaGV0aGVyIHRoZSBkYXRhIGhhcyBsb2FkZWQgeWV0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbG9hZGVkXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IFNwaW5lTG9hZGVyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBMb2FkcyB0aGUgSlNPTiBkYXRhXG4gKlxuICogQG1ldGhvZCBsb2FkXG4gKi9cbnByb3RvLmxvYWQgPSBmdW5jdGlvbiBsb2FkKClcbntcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHZhciBqc29uTG9hZGVyID0gbmV3IEpzb25Mb2FkZXIodGhpcy51cmwsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuICAgIGpzb25Mb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRlZFwiLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgc2NvcGUuanNvbiA9IGV2ZW50LmNvbnRlbnQuanNvbjtcbiAgICAgICAgc2NvcGUub25KU09OTG9hZGVkKCk7XG4gICAgfSk7XG4gICAganNvbkxvYWRlci5sb2FkKCk7XG59O1xuXG4vKipcbiAqIEludm9rZSB3aGVuIEpTT04gZmlsZSBpcyBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIG9uSlNPTkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25KU09OTG9hZGVkID0gZnVuY3Rpb24gb25KU09OTG9hZGVkKGV2ZW50KVxue1xuICAgIHZhciBzcGluZUpzb25QYXJzZXIgPSBuZXcgU2tlbGV0b25Kc29uKCk7XG4gICAgdmFyIHNrZWxldG9uRGF0YSA9IHNwaW5lSnNvblBhcnNlci5yZWFkU2tlbGV0b25EYXRhKHRoaXMuanNvbik7XG5cbiAgICBTcGluZS5hbmltQ2FjaGVbdGhpcy51cmxdID0gc2tlbGV0b25EYXRhO1xuXG4gICAgdGhpcy5vbkxvYWRlZCgpO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBKU09OIGZpbGUgaXMgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBvbkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Mb2FkZWQgPSBmdW5jdGlvbiBvbkxvYWRlZCgpXG57XG4gICAgdGhpcy5sb2FkZWQgPSB0cnVlO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogXCJsb2FkZWRcIiwgY29udGVudDogdGhpc30pO1xufTtcblxuQXNzZXRMb2FkZXIucmVnaXN0ZXJMb2FkZXJUeXBlKCdhbmltJywgU3BpbmVMb2FkZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNwaW5lTG9hZGVyO1xuXG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBKc29uTG9hZGVyID0gcmVxdWlyZSgnLi9Kc29uTG9hZGVyJyk7XG52YXIgSW1hZ2VMb2FkZXIgPSByZXF1aXJlKCcuL0ltYWdlTG9hZGVyJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xuXG4vKipcbiAqIFRoZSBzcHJpdGUgc2hlZXQgbG9hZGVyIGlzIHVzZWQgdG8gbG9hZCBpbiBKU09OIHNwcml0ZSBzaGVldCBkYXRhXG4gKiBUbyBnZW5lcmF0ZSB0aGUgZGF0YSB5b3UgY2FuIHVzZSBodHRwOi8vd3d3LmNvZGVhbmR3ZWIuY29tL3RleHR1cmVwYWNrZXIgYW5kIHB1Ymxpc2ggdGhlIFwiSlNPTlwiIGZvcm1hdFxuICogVGhlcmUgaXMgYSBmcmVlIHZlcnNpb24gc28gdGhhdHMgbmljZSwgYWx0aG91Z2ggdGhlIHBhaWQgdmVyc2lvbiBpcyBncmVhdCB2YWx1ZSBmb3IgbW9uZXkuXG4gKiBJdCBpcyBoaWdobHkgcmVjb21tZW5kZWQgdG8gdXNlIFNwcml0ZSBzaGVldHMgKGFsc28ga25vdyBhcyB0ZXh0dXJlIGF0bGFzXCIpIGFzIGl0IG1lYW5zIHNwcml0ZVwicyBjYW4gYmUgYmF0Y2hlZCBhbmQgZHJhd24gdG9nZXRoZXIgZm9yIGhpZ2hseSBpbmNyZWFzZWQgcmVuZGVyaW5nIHNwZWVkLlxuICogT25jZSB0aGUgZGF0YSBoYXMgYmVlbiBsb2FkZWQgdGhlIGZyYW1lcyBhcmUgc3RvcmVkIGluIHRoZSB0ZXh0dXJlIGNhY2hlIGFuZCBjYW4gYmUgYWNjZXNzZWQgdGhvdWdoIFRleHR1cmUuZnJvbUZyYW1lSWQoKSBhbmQgU3ByaXRlLmZyb21Gcm9tZUlkKClcbiAqIFRoaXMgbG9hZGVyIHdpbGwgYWxzbyBsb2FkIHRoZSBpbWFnZSBmaWxlIHRoYXQgdGhlIFNwcml0ZXNoZWV0IHBvaW50cyB0byBhcyB3ZWxsIGFzIHRoZSBkYXRhLlxuICogV2hlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgXCJsb2FkZWRcIiBldmVudFxuICpcbiAqIEBjbGFzcyBTcHJpdGVTaGVldExvYWRlclxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHVybCB7U3RyaW5nfSBUaGUgdXJsIG9mIHRoZSBzcHJpdGUgc2hlZXQgSlNPTiBmaWxlXG4gKiBAcGFyYW0gY3Jvc3NvcmlnaW4ge0Jvb2xlYW59IFdoZXRoZXIgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3NvcmlnaW5cbiAqL1xuZnVuY3Rpb24gU3ByaXRlU2hlZXRMb2FkZXIodXJsLCBjcm9zc29yaWdpbikge1xuICAgIC8qXG4gICAgICogaSB1c2UgdGV4dHVyZSBwYWNrZXIgdG8gbG9hZCB0aGUgYXNzZXRzLi5cbiAgICAgKiBodHRwOi8vd3d3LmNvZGVhbmR3ZWIuY29tL3RleHR1cmVwYWNrZXJcbiAgICAgKiBtYWtlIHN1cmUgdG8gc2V0IHRoZSBmb3JtYXQgYXMgXCJKU09OXCJcbiAgICAgKi9cbiAgICBFdmVudFRhcmdldC5jYWxsKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHVybCBvZiB0aGUgYml0bWFwIGZvbnQgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHVybFxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIHRoaXMudXJsID0gdXJsO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3Mgb3JpZ2luXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgY3Jvc3NvcmlnaW5cbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICovXG4gICAgdGhpcy5jcm9zc29yaWdpbiA9IGNyb3Nzb3JpZ2luO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gVGhlIGJhc2UgdXJsIG9mIHRoZSBiaXRtYXAgZm9udCBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYmFzZVVybFxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMuYmFzZVVybCA9IHVybC5yZXBsYWNlKC9bXlxcL10qJC8sIFwiXCIpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRleHR1cmUgYmVpbmcgbG9hZGVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdGV4dHVyZVxuICAgICAqIEB0eXBlIFRleHR1cmVcbiAgICAgKi9cbiAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZyYW1lcyBvZiB0aGUgc3ByaXRlIHNoZWV0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZnJhbWVzXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgdGhpcy5mcmFtZXMgPSB7fTtcbn1cblxudmFyIHByb3RvID0gU3ByaXRlU2hlZXRMb2FkZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIFRoaXMgd2lsbCBiZWdpbiBsb2FkaW5nIHRoZSBKU09OIGZpbGVcbiAqXG4gKiBAbWV0aG9kIGxvYWRcbiAqL1xucHJvdG8ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHZhciBqc29uTG9hZGVyID0gbmV3IEpzb25Mb2FkZXIodGhpcy51cmwsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuICAgIGpzb25Mb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRlZFwiLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgc2NvcGUuanNvbiA9IGV2ZW50LmNvbnRlbnQuanNvbjtcbiAgICAgICAgc2NvcGUub25KU09OTG9hZGVkKCk7XG4gICAgfSk7XG4gICAganNvbkxvYWRlci5sb2FkKCk7XG59O1xuXG4vKipcbiAqIEludm9rZSB3aGVuIEpTT04gZmlsZSBpcyBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIG9uSlNPTkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25KU09OTG9hZGVkID0gZnVuY3Rpb24gb25KU09OTG9hZGVkKClcbntcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHZhciB0ZXh0dXJlVXJsID0gdGhpcy5iYXNlVXJsICsgdGhpcy5qc29uLm1ldGEuaW1hZ2U7XG4gICAgdmFyIGltYWdlID0gbmV3IEltYWdlTG9hZGVyKHRleHR1cmVVcmwsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuICAgIHZhciBmcmFtZURhdGEgPSB0aGlzLmpzb24uZnJhbWVzO1xuXG4gICAgdGhpcy50ZXh0dXJlID0gaW1hZ2UudGV4dHVyZS5iYXNlVGV4dHVyZTtcbiAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKFwibG9hZGVkXCIsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBzY29wZS5vbkxvYWRlZCgpO1xuICAgIH0pO1xuXG4gICAgZm9yICh2YXIgaSBpbiBmcmFtZURhdGEpIHtcbiAgICAgICAgdmFyIHJlY3QgPSBmcmFtZURhdGFbaV0uZnJhbWU7XG4gICAgICAgIGlmIChyZWN0KSB7XG4gICAgICAgICAgICBUZXh0dXJlLmNhY2hlW2ldID0gbmV3IFRleHR1cmUodGhpcy50ZXh0dXJlLCB7XG4gICAgICAgICAgICAgICAgeDogcmVjdC54LFxuICAgICAgICAgICAgICAgIHk6IHJlY3QueSxcbiAgICAgICAgICAgICAgICB3aWR0aDogcmVjdC53LFxuICAgICAgICAgICAgICAgIGhlaWdodDogcmVjdC5oXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChmcmFtZURhdGFbaV0udHJpbW1lZCkge1xuICAgICAgICAgICAgICAgIC8vdmFyIHJlYWxTaXplID0gZnJhbWVEYXRhW2ldLnNwcml0ZVNvdXJjZVNpemU7XG4gICAgICAgICAgICAgICAgVGV4dHVyZS5jYWNoZVtpXS5yZWFsU2l6ZSA9IGZyYW1lRGF0YVtpXS5zcHJpdGVTb3VyY2VTaXplO1xuICAgICAgICAgICAgICAgIFRleHR1cmUuY2FjaGVbaV0udHJpbS54ID0gMDsgLy8gKHJlYWxTaXplLnggLyByZWN0LncpXG4gICAgICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHRoZSBvZmZzZXQhXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpbWFnZS5sb2FkKCk7XG59O1xuLyoqXG4gKiBJbnZva2Ugd2hlbiBhbGwgZmlsZXMgYXJlIGxvYWRlZCAoanNvbiBhbmQgdGV4dHVyZSlcbiAqXG4gKiBAbWV0aG9kIG9uTG9hZGVkXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkxvYWRlZCA9IGZ1bmN0aW9uIG9uTG9hZGVkKClcbntcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoe1xuICAgICAgICB0eXBlOiBcImxvYWRlZFwiLFxuICAgICAgICBjb250ZW50OiB0aGlzXG4gICAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNwcml0ZVNoZWV0TG9hZGVyO1xuIiwidmFyIGdsb2JhbD10eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge307LyoqXG4gKiBAYXV0aG9yIERyLiBLaWJpdHogPGluZm9AZHJraWJpdHouY29tPlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIGNvbnNvbGU6ICAgZ2xvYmFsLmNvbnNvbGUsXG4gICAgZG9jdW1lbnQ6ICBnbG9iYWwuZG9jdW1lbnQsXG4gICAgbG9jYXRpb246ICBnbG9iYWwubG9jYXRpb24sXG4gICAgbmF2aWdhdG9yOiBnbG9iYWwubmF2aWdhdG9yLFxuICAgIHdpbmRvdzogICAgZ2xvYmFsLndpbmRvdyxcblxuICAgIGNyZWF0ZUNhbnZhczogZnVuY3Rpb24gY3JlYXRlQ2FudmFzKCkge1xuICAgICAgICByZXR1cm4gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIH0sXG5cbiAgICBjcmVhdGVJbWFnZTogZnVuY3Rpb24gY3JlYXRlSW1hZ2UoKSB7XG4gICAgICAgIHJldHVybiBuZXcgZ2xvYmFsLkltYWdlKCk7XG4gICAgfSxcblxuICAgIGNyZWF0ZVJlcXVlc3Q6IGZ1bmN0aW9uIGNyZWF0ZVJlcXVlc3QoKSB7XG4gICAgICAgIHJldHVybiBuZXcgZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgfVxufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIERpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcblxuLyoqXG4gKiBUaGUgR3JhcGhpY3MgY2xhc3MgY29udGFpbnMgYSBzZXQgb2YgbWV0aG9kcyB0aGF0IHlvdSBjYW4gdXNlIHRvIGNyZWF0ZSBwcmltaXRpdmUgc2hhcGVzIGFuZCBsaW5lcy5cbiAqIEl0IGlzIGltcG9ydGFudCB0byBrbm93IHRoYXQgd2l0aCB0aGUgd2ViR0wgcmVuZGVyZXIgb25seSBzaW1wbGUgcG9seXMgY2FuIGJlIGZpbGxlZCBhdCB0aGlzIHN0YWdlXG4gKiBDb21wbGV4IHBvbHlzIHdpbGwgbm90IGJlIGZpbGxlZC4gSGVyZXMgYW4gZXhhbXBsZSBvZiBhIGNvbXBsZXggcG9seTogaHR0cDovL3d3dy5nb29kYm95ZGlnaXRhbC5jb20vd3AtY29udGVudC91cGxvYWRzLzIwMTMvMDYvY29tcGxleFBvbHlnb24ucG5nXG4gKlxuICogQGNsYXNzIEdyYXBoaWNzXG4gKiBAZXh0ZW5kcyBEaXNwbGF5T2JqZWN0Q29udGFpbmVyXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gR3JhcGhpY3MoKVxue1xuICAgIERpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucmVuZGVyYWJsZSA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWxwaGEgb2YgdGhlIGZpbGwgb2YgdGhpcyBncmFwaGljcyBvYmplY3RcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBmaWxsQWxwaGFcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICB0aGlzLmZpbGxBbHBoYSA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgYW55IGxpbmVzIGRyYXduXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbGluZVdpZHRoXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgdGhpcy5saW5lV2lkdGggPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIG9mIGFueSBsaW5lcyBkcmF3blxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGxpbmVDb2xvclxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIHRoaXMubGluZUNvbG9yID0gXCJibGFja1wiO1xuXG4gICAgLyoqXG4gICAgICogR3JhcGhpY3MgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGdyYXBoaWNzRGF0YVxuICAgICAqIEB0eXBlIEFycmF5XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLmdyYXBoaWNzRGF0YSA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3VycmVudCBwYXRoXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgY3VycmVudFBhdGhcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuY3VycmVudFBhdGggPSB7cG9pbnRzOltdfTtcbn1cblxudmFyIHByb3RvID0gR3JhcGhpY3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IEdyYXBoaWNzfVxufSk7XG5cbi8qKlxuICogU3BlY2lmaWVzIGEgbGluZSBzdHlsZSB1c2VkIGZvciBzdWJzZXF1ZW50IGNhbGxzIHRvIEdyYXBoaWNzIG1ldGhvZHMgc3VjaCBhcyB0aGUgbGluZVRvKCkgbWV0aG9kIG9yIHRoZSBkcmF3Q2lyY2xlKCkgbWV0aG9kLlxuICpcbiAqIEBtZXRob2QgbGluZVN0eWxlXG4gKiBAcGFyYW0gbGluZVdpZHRoIHtOdW1iZXJ9IHdpZHRoIG9mIHRoZSBsaW5lIHRvIGRyYXcsIHdpbGwgdXBkYXRlIHRoZSBvYmplY3QncyBzdG9yZWQgc3R5bGVcbiAqIEBwYXJhbSBjb2xvciB7TnVtYmVyfSBjb2xvciBvZiB0aGUgbGluZSB0byBkcmF3LCB3aWxsIHVwZGF0ZSB0aGUgb2JqZWN0J3Mgc3RvcmVkIHN0eWxlXG4gKiBAcGFyYW0gYWxwaGEge051bWJlcn0gYWxwaGEgb2YgdGhlIGxpbmUgdG8gZHJhdywgd2lsbCB1cGRhdGUgdGhlIG9iamVjdCdzIHN0b3JlZCBzdHlsZVxuICovXG5wcm90by5saW5lU3R5bGUgPSBmdW5jdGlvbiBsaW5lU3R5bGUobGluZVdpZHRoLCBjb2xvciwgYWxwaGEpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5saW5lV2lkdGggPSBsaW5lV2lkdGggfHwgMDtcbiAgICB0aGlzLmxpbmVDb2xvciA9IGNvbG9yIHx8IDA7XG4gICAgdGhpcy5saW5lQWxwaGEgPSAoYXJndW1lbnRzLmxlbmd0aCA8IDMpID8gMSA6IGFscGhhO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsIGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvciwgbGluZUFscGhhOnRoaXMubGluZUFscGhhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLCBmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsIGZpbGw6dGhpcy5maWxsaW5nLCBwb2ludHM6W10sIHR5cGU6IEdyYXBoaWNzLlBPTFl9O1xuXG4gICAgdGhpcy5ncmFwaGljc0RhdGEucHVzaCh0aGlzLmN1cnJlbnRQYXRoKTtcbn07XG5cbi8qKlxuICogTW92ZXMgdGhlIGN1cnJlbnQgZHJhd2luZyBwb3NpdGlvbiB0byAoeCwgeSkuXG4gKlxuICogQG1ldGhvZCBtb3ZlVG9cbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IHRoZSBYIGNvb3JkIHRvIG1vdmUgdG9cbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IHRoZSBZIGNvb3JkIHRvIG1vdmUgdG9cbiAqL1xucHJvdG8ubW92ZVRvID0gZnVuY3Rpb24gbW92ZVRvKHgsIHkpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHRoaXMuY3VycmVudFBhdGggPSB7bGluZVdpZHRoOnRoaXMubGluZVdpZHRoLCBsaW5lQ29sb3I6dGhpcy5saW5lQ29sb3IsIGxpbmVBbHBoYTp0aGlzLmxpbmVBbHBoYSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGxDb2xvcjp0aGlzLmZpbGxDb2xvciwgZmlsbEFscGhhOnRoaXMuZmlsbEFscGhhLCBmaWxsOnRoaXMuZmlsbGluZywgcG9pbnRzOltdLCB0eXBlOiBHcmFwaGljcy5QT0xZfTtcblxuICAgIHRoaXMuY3VycmVudFBhdGgucG9pbnRzLnB1c2goeCwgeSk7XG5cbiAgICB0aGlzLmdyYXBoaWNzRGF0YS5wdXNoKHRoaXMuY3VycmVudFBhdGgpO1xufTtcblxuLyoqXG4gKiBEcmF3cyBhIGxpbmUgdXNpbmcgdGhlIGN1cnJlbnQgbGluZSBzdHlsZSBmcm9tIHRoZSBjdXJyZW50IGRyYXdpbmcgcG9zaXRpb24gdG8gKHgsIHkpO1xuICogdGhlIGN1cnJlbnQgZHJhd2luZyBwb3NpdGlvbiBpcyB0aGVuIHNldCB0byAoeCwgeSkuXG4gKlxuICogQG1ldGhvZCBsaW5lVG9cbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IHRoZSBYIGNvb3JkIHRvIGRyYXcgdG9cbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IHRoZSBZIGNvb3JkIHRvIGRyYXcgdG9cbiAqL1xucHJvdG8ubGluZVRvID0gZnVuY3Rpb24gbGluZVRvKHgsIHkpXG57XG4gICAgdGhpcy5jdXJyZW50UGF0aC5wb2ludHMucHVzaCh4LCB5KTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogU3BlY2lmaWVzIGEgc2ltcGxlIG9uZS1jb2xvciBmaWxsIHRoYXQgc3Vic2VxdWVudCBjYWxscyB0byBvdGhlciBHcmFwaGljcyBtZXRob2RzXG4gKiAoc3VjaCBhcyBsaW5lVG8oKSBvciBkcmF3Q2lyY2xlKCkpIHVzZSB3aGVuIGRyYXdpbmcuXG4gKlxuICogQG1ldGhvZCBiZWdpbkZpbGxcbiAqIEBwYXJhbSBjb2xvciB7dWludH0gdGhlIGNvbG9yIG9mIHRoZSBmaWxsXG4gKiBAcGFyYW0gYWxwaGEge051bWJlcn0gdGhlIGFscGhhXG4gKi9cbnByb3RvLmJlZ2luRmlsbCA9IGZ1bmN0aW9uIGJlZ2luRmlsbChjb2xvciwgYWxwaGEpXG57XG4gICAgdGhpcy5maWxsaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmZpbGxDb2xvciA9IGNvbG9yIHx8IDA7XG4gICAgdGhpcy5maWxsQWxwaGEgPSAoYXJndW1lbnRzLmxlbmd0aCA8IDIpID8gMSA6IGFscGhhO1xufTtcblxuLyoqXG4gKiBBcHBsaWVzIGEgZmlsbCB0byB0aGUgbGluZXMgYW5kIHNoYXBlcyB0aGF0IHdlcmUgYWRkZWQgc2luY2UgdGhlIGxhc3QgY2FsbCB0byB0aGUgYmVnaW5GaWxsKCkgbWV0aG9kLlxuICpcbiAqIEBtZXRob2QgZW5kRmlsbFxuICovXG5wcm90by5lbmRGaWxsID0gZnVuY3Rpb24gZW5kRmlsbCgpXG57XG4gICAgdGhpcy5maWxsaW5nID0gZmFsc2U7XG4gICAgdGhpcy5maWxsQ29sb3IgPSBudWxsO1xuICAgIHRoaXMuZmlsbEFscGhhID0gMTtcbn07XG5cbi8qKlxuICogQG1ldGhvZCBkcmF3UmVjdFxuICpcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSB0b3AtbGVmdCBvZiB0aGUgcmVjdGFuZ2xlXG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgdG9wLWxlZnQgb2YgdGhlIHJlY3RhbmdsZVxuICogQHBhcmFtIHdpZHRoIHtOdW1iZXJ9IFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlXG4gKiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9IFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZVxuICovXG5wcm90by5kcmF3UmVjdCA9IGZ1bmN0aW9uIGRyYXdSZWN0KHgsIHksIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsIGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvciwgbGluZUFscGhhOnRoaXMubGluZUFscGhhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLCBmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsIGZpbGw6dGhpcy5maWxsaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRzOlt4LCB5LCB3aWR0aCwgaGVpZ2h0XSwgdHlwZTogR3JhcGhpY3MuUkVDVH07XG5cbiAgICB0aGlzLmdyYXBoaWNzRGF0YS5wdXNoKHRoaXMuY3VycmVudFBhdGgpO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBEcmF3cyBhIGNpcmNsZS5cbiAqXG4gKiBAbWV0aG9kIGRyYXdDaXJjbGVcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSBjZW50ZXIgb2YgdGhlIGNpcmNsZVxuICogQHBhcmFtIHkge051bWJlcn0gVGhlIFkgY29vcmQgb2YgdGhlIGNlbnRlciBvZiB0aGUgY2lyY2xlXG4gKiBAcGFyYW0gcmFkaXVzIHtOdW1iZXJ9IFRoZSByYWRpdXMgb2YgdGhlIGNpcmNsZVxuICovXG5wcm90by5kcmF3Q2lyY2xlID0gZnVuY3Rpb24gZHJhd0NpcmNsZSh4LCB5LCByYWRpdXMpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsIGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvciwgbGluZUFscGhhOnRoaXMubGluZUFscGhhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLCBmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsIGZpbGw6dGhpcy5maWxsaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRzOlt4LCB5LCByYWRpdXMsIHJhZGl1c10sIHR5cGU6IEdyYXBoaWNzLkNJUkN9O1xuXG4gICAgdGhpcy5ncmFwaGljc0RhdGEucHVzaCh0aGlzLmN1cnJlbnRQYXRoKTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogRHJhd3MgYW4gZWxpcHNlLlxuICpcbiAqIEBtZXRob2QgZHJhd0VsaXBzZVxuICogQHBhcmFtIHgge051bWJlcn1cbiAqIEBwYXJhbSB5IHtOdW1iZXJ9XG4gKiBAcGFyYW0gd2lkdGgge051bWJlcn1cbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn1cbiAqL1xucHJvdG8uZHJhd0VsaXBzZSA9IGZ1bmN0aW9uIGRyYXdFbGlwc2UoeCwgeSwgd2lkdGgsIGhlaWdodClcbntcbiAgICBpZiAoIXRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aCkgdGhpcy5ncmFwaGljc0RhdGEucG9wKCk7XG5cbiAgICB0aGlzLmN1cnJlbnRQYXRoID0ge2xpbmVXaWR0aDp0aGlzLmxpbmVXaWR0aCwgbGluZUNvbG9yOnRoaXMubGluZUNvbG9yLCBsaW5lQWxwaGE6dGhpcy5saW5lQWxwaGEsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxsQ29sb3I6dGhpcy5maWxsQ29sb3IsIGZpbGxBbHBoYTp0aGlzLmZpbGxBbHBoYSwgZmlsbDp0aGlzLmZpbGxpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludHM6W3gsIHksIHdpZHRoLCBoZWlnaHRdLCB0eXBlOiBHcmFwaGljcy5FTElQfTtcblxuICAgIHRoaXMuZ3JhcGhpY3NEYXRhLnB1c2godGhpcy5jdXJyZW50UGF0aCk7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG59O1xuXG4vKipcbiAqIENsZWFycyB0aGUgZ3JhcGhpY3MgdGhhdCB3ZXJlIGRyYXduIHRvIHRoaXMgR3JhcGhpY3Mgb2JqZWN0LCBhbmQgcmVzZXRzIGZpbGwgYW5kIGxpbmUgc3R5bGUgc2V0dGluZ3MuXG4gKlxuICogQG1ldGhvZCBjbGVhclxuICovXG5wcm90by5jbGVhciA9IGZ1bmN0aW9uIGNsZWFyKClcbntcbiAgICB0aGlzLmxpbmVXaWR0aCA9IDA7XG4gICAgdGhpcy5maWxsaW5nID0gZmFsc2U7XG5cbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICB0aGlzLmNsZWFyRGlydHkgPSB0cnVlO1xuICAgIHRoaXMuZ3JhcGhpY3NEYXRhID0gW107XG59O1xuXG4vLyBTT01FIFRZUEVTOlxuR3JhcGhpY3MuUE9MWSA9IDA7XG5HcmFwaGljcy5SRUNUID0gMTtcbkdyYXBoaWNzLkNJUkMgPSAyO1xuR3JhcGhpY3MuRUxJUCA9IDM7XG5cbm1vZHVsZS5leHBvcnRzID0gR3JhcGhpY3M7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwbGF0Zm9ybSA9IHJlcXVpcmUoJy4uLy4uL3BsYXRmb3JtJyk7XG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xuXG52YXIgY2FudmFzR3JhcGhpY3MgPSByZXF1aXJlKCcuL2dyYXBoaWNzJyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uLy4uL3RleHR1cmVzL1RleHR1cmUnKTtcbnZhciBEaXNwbGF5T2JqZWN0ID0gcmVxdWlyZSgnLi4vLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Jyk7XG5cbnZhciBTcHJpdGUgPSByZXF1aXJlKCcuLi8uLi9kaXNwbGF5L1Nwcml0ZScpO1xudmFyIFRpbGluZ1Nwcml0ZSA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9UaWxpbmdTcHJpdGUnKTtcbnZhciBTdHJpcCA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9TdHJpcCcpO1xudmFyIEN1c3RvbVJlbmRlcmFibGUgPSByZXF1aXJlKCcuLi8uLi9leHRyYXMvQ3VzdG9tUmVuZGVyYWJsZScpO1xudmFyIEdyYXBoaWNzID0gcmVxdWlyZSgnLi4vLi4vcHJpbWl0aXZlcy9HcmFwaGljcycpO1xudmFyIEZpbHRlckJsb2NrID0gcmVxdWlyZSgnLi4vLi4vZmlsdGVycy9GaWx0ZXJCbG9jaycpO1xuXG4vKipcbiAqIHRoZSBDYW52YXNSZW5kZXJlciBkcmF3cyB0aGUgc3RhZ2UgYW5kIGFsbCBpdHMgY29udGVudCBvbnRvIGEgMmQgY2FudmFzLiBUaGlzIHJlbmRlcmVyIHNob3VsZCBiZSB1c2VkIGZvciBicm93c2VycyB0aGF0IGRvIG5vdCBzdXBwb3J0IHdlYkdMLlxuICogRG9udCBmb3JnZXQgdG8gYWRkIHRoZSB2aWV3IHRvIHlvdXIgRE9NIG9yIHlvdSB3aWxsIG5vdCBzZWUgYW55dGhpbmcgOilcbiAqXG4gKiBAY2xhc3MgQ2FudmFzUmVuZGVyZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHdpZHRoPTAge051bWJlcn0gdGhlIHdpZHRoIG9mIHRoZSBjYW52YXMgdmlld1xuICogQHBhcmFtIGhlaWdodD0wIHtOdW1iZXJ9IHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyB2aWV3XG4gKiBAcGFyYW0gdmlldyB7Q2FudmFzfSB0aGUgY2FudmFzIHRvIHVzZSBhcyBhIHZpZXcsIG9wdGlvbmFsXG4gKiBAcGFyYW0gdHJhbnNwYXJlbnQ9ZmFsc2Uge0Jvb2xlYW59IHRoZSB0cmFuc3BhcmVuY3kgb2YgdGhlIHJlbmRlciB2aWV3LCBkZWZhdWx0IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIENhbnZhc1JlbmRlcmVyKHdpZHRoLCBoZWlnaHQsIHZpZXcsIHRyYW5zcGFyZW50KVxue1xuICAgIHRoaXMudHJhbnNwYXJlbnQgPSB0cmFuc3BhcmVudDtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgY2FudmFzIHZpZXdcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDgwMFxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSB3aWR0aCB8fCA4MDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBjYW52YXMgdmlld1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IGhlaWdodFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDYwMFxuICAgICAqL1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0IHx8IDYwMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYW52YXMgZWxlbWVudCB0aGF0IHRoZSBldmVyeXRoaW5nIGlzIGRyYXduIHRvXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdmlld1xuICAgICAqIEB0eXBlIENhbnZhc1xuICAgICAqL1xuICAgIHRoaXMudmlldyA9IHZpZXcgfHwgcGxhdGZvcm0uY3JlYXRlQ2FudmFzKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FudmFzIGNvbnRleHQgdGhhdCB0aGUgZXZlcnl0aGluZyBpcyBkcmF3biB0b1xuICAgICAqIEBwcm9wZXJ0eSBjb250ZXh0XG4gICAgICogQHR5cGUgQ2FudmFzIDJkIENvbnRleHRcbiAgICAgKi9cbiAgICB0aGlzLmNvbnRleHQgPSB0aGlzLnZpZXcuZ2V0Q29udGV4dChcIjJkXCIpO1xuXG4gICAgdGhpcy5yZWZyZXNoID0gdHJ1ZTtcbiAgICAvLyBoYWNrIHRvIGVuYWJsZSBzb21lIGhhcmR3YXJlIGFjY2VsZXJhdGlvbiFcbiAgICAvL3RoaXMudmlldy5zdHlsZVtcInRyYW5zZm9ybVwiXSA9IFwidHJhbnNsYXRleigwKVwiO1xuXG4gICAgdGhpcy52aWV3LndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLnZpZXcuaGVpZ2h0ID0gdGhpcy5oZWlnaHQ7XG4gICAgdGhpcy5jb3VudCA9IDA7XG59XG5cbnZhciBwcm90byA9IENhbnZhc1JlbmRlcmVyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBSZW5kZXJzIHRoZSBzdGFnZSB0byBpdHMgY2FudmFzIHZpZXdcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclxuICogQHBhcmFtIHN0YWdlIHtTdGFnZX0gdGhlIFN0YWdlIGVsZW1lbnQgdG8gYmUgcmVuZGVyZWRcbiAqL1xucHJvdG8ucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyKHN0YWdlKVxue1xuXG4gICAgLy9zdGFnZS5fX2NoaWxkcmVuQWRkZWQgPSBbXTtcbiAgICAvL3N0YWdlLl9fY2hpbGRyZW5SZW1vdmVkID0gW107XG5cbiAgICAvLyB1cGRhdGUgdGV4dHVyZXMgaWYgbmVlZCBiZVxuICAgIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZSA9IFtdO1xuICAgIGdsb2JhbHMudGV4dHVyZXNUb0Rlc3Ryb3kgPSBbXTtcblxuICAgIGdsb2JhbHMudmlzaWJsZUNvdW50Kys7XG4gICAgc3RhZ2UudXBkYXRlVHJhbnNmb3JtKCk7XG5cbiAgICAvLyB1cGRhdGUgdGhlIGJhY2tncm91bmQgY29sb3JcbiAgICBpZih0aGlzLnZpZXcuc3R5bGUuYmFja2dyb3VuZENvbG9yIT1zdGFnZS5iYWNrZ3JvdW5kQ29sb3JTdHJpbmcgJiYgIXRoaXMudHJhbnNwYXJlbnQpdGhpcy52aWV3LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHN0YWdlLmJhY2tncm91bmRDb2xvclN0cmluZztcblxuICAgIHRoaXMuY29udGV4dC5zZXRUcmFuc2Zvcm0oMSwwLDAsMSwwLDApO1xuICAgIHRoaXMuY29udGV4dC5jbGVhclJlY3QoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpXG4gICAgdGhpcy5yZW5kZXJEaXNwbGF5T2JqZWN0KHN0YWdlKTtcbiAgICAvL2FzXG5cbiAgICAvLyBydW4gaW50ZXJhY3Rpb24hXG4gICAgaWYoc3RhZ2UuaW50ZXJhY3RpdmUpXG4gICAge1xuICAgICAgICAvL25lZWQgdG8gYWRkIHNvbWUgZXZlbnRzIVxuICAgICAgICBpZighc3RhZ2UuX2ludGVyYWN0aXZlRXZlbnRzQWRkZWQpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHN0YWdlLl9pbnRlcmFjdGl2ZUV2ZW50c0FkZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHN0YWdlLmludGVyYWN0aW9uTWFuYWdlci5zZXRUYXJnZXQodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZW1vdmUgZnJhbWUgdXBkYXRlcy4uXG4gICAgaWYgKFRleHR1cmUuZnJhbWVVcGRhdGVzLmxlbmd0aCA+IDApXG4gICAge1xuICAgICAgICBUZXh0dXJlLmZyYW1lVXBkYXRlcyA9IFtdO1xuICAgIH1cbn07XG5cbi8qKlxuICogcmVzaXplcyB0aGUgY2FudmFzIHZpZXcgdG8gdGhlIHNwZWNpZmllZCB3aWR0aCBhbmQgaGVpZ2h0XG4gKlxuICogQG1ldGhvZCByZXNpemVcbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSB0aGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMgdmlld1xuICogQHBhcmFtIGhlaWdodCB7TnVtYmVyfSB0aGUgbmV3IGhlaWdodCBvZiB0aGUgY2FudmFzIHZpZXdcbiAqL1xucHJvdG8ucmVzaXplID0gZnVuY3Rpb24gcmVzaXplKHdpZHRoLCBoZWlnaHQpXG57XG4gICAgdGhpcy53aWR0aCA9IHdpZHRoO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgdGhpcy52aWV3LndpZHRoID0gd2lkdGg7XG4gICAgdGhpcy52aWV3LmhlaWdodCA9IGhlaWdodDtcbn07XG5cbi8qKlxuICogUmVuZGVycyBhIGRpc3BsYXkgb2JqZWN0XG4gKlxuICogQG1ldGhvZCByZW5kZXJEaXNwbGF5T2JqZWN0XG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gVGhlIGRpc3BsYXlPYmplY3QgdG8gcmVuZGVyXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJEaXNwbGF5T2JqZWN0ID0gZnVuY3Rpb24gcmVuZGVyRGlzcGxheU9iamVjdChkaXNwbGF5T2JqZWN0KVxue1xuICAgIC8vIG5vIGxvZ2VyIHJlY3VycnNpdmUhXG4gICAgdmFyIHRyYW5zZm9ybTtcbiAgICB2YXIgY29udGV4dCA9IHRoaXMuY29udGV4dDtcblxuICAgIGNvbnRleHQuZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gJ3NvdXJjZS1vdmVyJztcblxuICAgIC8vIG9uZSB0aGUgZGlzcGxheSBvYmplY3QgaGl0cyB0aGlzLiB3ZSBjYW4gYnJlYWsgdGhlIGxvb3BcbiAgICB2YXIgdGVzdE9iamVjdCA9IGRpc3BsYXlPYmplY3QubGFzdC5faU5leHQ7XG4gICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QuZmlyc3Q7XG5cbiAgICBkb1xuICAgIHtcbiAgICAgICAgdHJhbnNmb3JtID0gZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybTtcblxuICAgICAgICBpZighZGlzcGxheU9iamVjdC52aXNpYmxlKVxuICAgICAgICB7XG4gICAgICAgICAgICBkaXNwbGF5T2JqZWN0ID0gZGlzcGxheU9iamVjdC5sYXN0Ll9pTmV4dDtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIWRpc3BsYXlPYmplY3QucmVuZGVyYWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QuX2lOZXh0O1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3ByaXRlKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIHZhciBmcmFtZSA9IGRpc3BsYXlPYmplY3QudGV4dHVyZS5mcmFtZTtcblxuICAgICAgICAgICAgaWYoZnJhbWUgJiYgZnJhbWUud2lkdGggJiYgZnJhbWUuaGVpZ2h0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBkaXNwbGF5T2JqZWN0LndvcmxkQWxwaGE7XG5cbiAgICAgICAgICAgICAgICBjb250ZXh0LnNldFRyYW5zZm9ybSh0cmFuc2Zvcm1bMF0sIHRyYW5zZm9ybVszXSwgdHJhbnNmb3JtWzFdLCB0cmFuc2Zvcm1bNF0sIHRyYW5zZm9ybVsyXSwgdHJhbnNmb3JtWzVdKTtcblxuICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKGRpc3BsYXlPYmplY3QudGV4dHVyZS5iYXNlVGV4dHVyZS5zb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLngsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZS5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkaXNwbGF5T2JqZWN0LmFuY2hvci54KSAqIC1mcmFtZS53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRpc3BsYXlPYmplY3QuYW5jaG9yLnkpICogLWZyYW1lLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWUud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLmhlaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3RyaXApXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2V0VHJhbnNmb3JtKHRyYW5zZm9ybVswXSwgdHJhbnNmb3JtWzNdLCB0cmFuc2Zvcm1bMV0sIHRyYW5zZm9ybVs0XSwgdHJhbnNmb3JtWzJdLCB0cmFuc2Zvcm1bNV0pXG4gICAgICAgICAgICB0aGlzLnJlbmRlclN0cmlwKGRpc3BsYXlPYmplY3QpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIFRpbGluZ1Nwcml0ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgY29udGV4dC5zZXRUcmFuc2Zvcm0odHJhbnNmb3JtWzBdLCB0cmFuc2Zvcm1bM10sIHRyYW5zZm9ybVsxXSwgdHJhbnNmb3JtWzRdLCB0cmFuc2Zvcm1bMl0sIHRyYW5zZm9ybVs1XSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGlsaW5nU3ByaXRlKGRpc3BsYXlPYmplY3QpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIEN1c3RvbVJlbmRlcmFibGUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGRpc3BsYXlPYmplY3QucmVuZGVyQ2FudmFzKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIEdyYXBoaWNzKVxuICAgICAgICB7XG4gICAgICAgICAgICBjb250ZXh0LnNldFRyYW5zZm9ybSh0cmFuc2Zvcm1bMF0sIHRyYW5zZm9ybVszXSwgdHJhbnNmb3JtWzFdLCB0cmFuc2Zvcm1bNF0sIHRyYW5zZm9ybVsyXSwgdHJhbnNmb3JtWzVdKVxuICAgICAgICAgICAgY2FudmFzR3JhcGhpY3MucmVuZGVyR3JhcGhpY3MoZGlzcGxheU9iamVjdCwgY29udGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgRmlsdGVyQmxvY2spXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKGRpc3BsYXlPYmplY3Qub3BlbilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LnNhdmUoKTtcblxuICAgICAgICAgICAgICAgIHZhciBjYWNoZUFscGhhID0gZGlzcGxheU9iamVjdC5tYXNrLmFscGhhO1xuICAgICAgICAgICAgICAgIHZhciBtYXNrVHJhbnNmb3JtID0gZGlzcGxheU9iamVjdC5tYXNrLndvcmxkVHJhbnNmb3JtO1xuXG4gICAgICAgICAgICAgICAgY29udGV4dC5zZXRUcmFuc2Zvcm0obWFza1RyYW5zZm9ybVswXSwgbWFza1RyYW5zZm9ybVszXSwgbWFza1RyYW5zZm9ybVsxXSwgbWFza1RyYW5zZm9ybVs0XSwgbWFza1RyYW5zZm9ybVsyXSwgbWFza1RyYW5zZm9ybVs1XSlcblxuICAgICAgICAgICAgICAgIGRpc3BsYXlPYmplY3QubWFzay53b3JsZEFscGhhID0gMC41O1xuXG4gICAgICAgICAgICAgICAgY29udGV4dC53b3JsZEFscGhhID0gMDtcblxuICAgICAgICAgICAgICAgIGNhbnZhc0dyYXBoaWNzLnJlbmRlckdyYXBoaWNzTWFzayhkaXNwbGF5T2JqZWN0Lm1hc2ssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuY2xpcCgpO1xuXG4gICAgICAgICAgICAgICAgZGlzcGxheU9iamVjdC5tYXNrLndvcmxkQWxwaGEgPSBjYWNoZUFscGhhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQucmVzdG9yZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgLy8gIGNvdW50KytcbiAgICAgICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QuX2lOZXh0O1xuXG5cbiAgICB9XG4gICAgd2hpbGUoZGlzcGxheU9iamVjdCAhPSB0ZXN0T2JqZWN0KVxufTtcblxuLyoqXG4gKiBSZW5kZXJzIGEgZmxhdCBzdHJpcFxuICpcbiAqIEBtZXRob2QgcmVuZGVyU3RyaXBGbGF0XG4gKiBAcGFyYW0gc3RyaXAge1N0cmlwfSBUaGUgU3RyaXAgdG8gcmVuZGVyXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJTdHJpcEZsYXQgPSBmdW5jdGlvbiByZW5kZXJTdHJpcEZsYXQoc3RyaXApXG57XG4gICAgdmFyIGNvbnRleHQgPSB0aGlzLmNvbnRleHQ7XG4gICAgdmFyIHZlcnRpY2llcyA9IHN0cmlwLnZlcnRpY2llcztcbiAgICB2YXIgdXZzID0gc3RyaXAudXZzO1xuXG4gICAgdmFyIGxlbmd0aCA9IHZlcnRpY2llcy5sZW5ndGgvMjtcbiAgICB0aGlzLmNvdW50Kys7XG5cbiAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuICAgIGZvciAodmFyIGk9MTsgaSA8IGxlbmd0aC0yOyBpKyspXG4gICAge1xuXG4gICAgICAgIC8vIGRyYXcgc29tZSB0cmlhbmdsZXMhXG4gICAgICAgIHZhciBpbmRleCA9IGkqMjtcblxuICAgICAgICAgdmFyIHgwID0gdmVydGljaWVzW2luZGV4XSwgICB4MSA9IHZlcnRpY2llc1tpbmRleCsyXSwgeDIgPSB2ZXJ0aWNpZXNbaW5kZXgrNF07XG4gICAgICAgICB2YXIgeTAgPSB2ZXJ0aWNpZXNbaW5kZXgrMV0sIHkxID0gdmVydGljaWVzW2luZGV4KzNdLCB5MiA9IHZlcnRpY2llc1tpbmRleCs1XTtcblxuICAgICAgICBjb250ZXh0Lm1vdmVUbyh4MCwgeTApO1xuICAgICAgICBjb250ZXh0LmxpbmVUbyh4MSwgeTEpO1xuICAgICAgICBjb250ZXh0LmxpbmVUbyh4MiwgeTIpO1xuXG4gICAgfVxuXG4gICAgY29udGV4dC5maWxsU3R5bGUgPSBcIiNGRjAwMDBcIjtcbiAgICBjb250ZXh0LmZpbGwoKTtcbiAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xufTtcblxuLyoqXG4gKiBSZW5kZXJzIGEgdGlsaW5nIHNwcml0ZVxuICpcbiAqIEBtZXRob2QgcmVuZGVyVGlsaW5nU3ByaXRlXG4gKiBAcGFyYW0gc3ByaXRlIHtUaWxpbmdTcHJpdGV9IFRoZSB0aWxpbmdzcHJpdGUgdG8gcmVuZGVyXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJUaWxpbmdTcHJpdGUgPSBmdW5jdGlvbiByZW5kZXJUaWxpbmdTcHJpdGUoc3ByaXRlKVxue1xuICAgIHZhciBjb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IHNwcml0ZS53b3JsZEFscGhhO1xuXG4gICAgaWYoIXNwcml0ZS5fX3RpbGVQYXR0ZXJuKSBzcHJpdGUuX190aWxlUGF0dGVybiA9IGNvbnRleHQuY3JlYXRlUGF0dGVybihzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5zb3VyY2UsIFwicmVwZWF0XCIpO1xuXG4gICAgY29udGV4dC5iZWdpblBhdGgoKTtcblxuICAgIHZhciB0aWxlUG9zaXRpb24gPSBzcHJpdGUudGlsZVBvc2l0aW9uO1xuICAgIHZhciB0aWxlU2NhbGUgPSBzcHJpdGUudGlsZVNjYWxlO1xuXG4gICAgLy8gb2Zmc2V0XG4gICAgY29udGV4dC5zY2FsZSh0aWxlU2NhbGUueCx0aWxlU2NhbGUueSk7XG4gICAgY29udGV4dC50cmFuc2xhdGUodGlsZVBvc2l0aW9uLngsIHRpbGVQb3NpdGlvbi55KTtcblxuICAgIGNvbnRleHQuZmlsbFN0eWxlID0gc3ByaXRlLl9fdGlsZVBhdHRlcm47XG4gICAgY29udGV4dC5maWxsUmVjdCgtdGlsZVBvc2l0aW9uLngsLXRpbGVQb3NpdGlvbi55LHNwcml0ZS53aWR0aCAvIHRpbGVTY2FsZS54LCBzcHJpdGUuaGVpZ2h0IC8gdGlsZVNjYWxlLnkpO1xuXG4gICAgY29udGV4dC5zY2FsZSgxL3RpbGVTY2FsZS54LCAxL3RpbGVTY2FsZS55KTtcbiAgICBjb250ZXh0LnRyYW5zbGF0ZSgtdGlsZVBvc2l0aW9uLngsIC10aWxlUG9zaXRpb24ueSk7XG5cbiAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xufTtcblxuLyoqXG4gKiBSZW5kZXJzIGEgc3RyaXBcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclN0cmlwXG4gKiBAcGFyYW0gc3RyaXAge1N0cmlwfSBUaGUgU3RyaXAgdG8gcmVuZGVyXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJTdHJpcCA9IGZ1bmN0aW9uIHJlbmRlclN0cmlwKHN0cmlwKVxue1xuICAgIHZhciBjb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgLy8gZHJhdyB0cmlhbmdsZXMhIVxuICAgIHZhciB2ZXJ0aWNpZXMgPSBzdHJpcC52ZXJ0aWNpZXM7XG4gICAgdmFyIHV2cyA9IHN0cmlwLnV2cztcblxuICAgIHZhciBsZW5ndGggPSB2ZXJ0aWNpZXMubGVuZ3RoLzI7XG4gICAgdGhpcy5jb3VudCsrO1xuICAgIGZvciAodmFyIGk9MTsgaSA8IGxlbmd0aC0yOyBpKyspXG4gICAge1xuXG4gICAgICAgIC8vIGRyYXcgc29tZSB0cmlhbmdsZXMhXG4gICAgICAgIHZhciBpbmRleCA9IGkqMjtcblxuICAgICAgICAgdmFyIHgwID0gdmVydGljaWVzW2luZGV4XSwgICB4MSA9IHZlcnRpY2llc1tpbmRleCsyXSwgeDIgPSB2ZXJ0aWNpZXNbaW5kZXgrNF07XG4gICAgICAgICB2YXIgeTAgPSB2ZXJ0aWNpZXNbaW5kZXgrMV0sIHkxID0gdmVydGljaWVzW2luZGV4KzNdLCB5MiA9IHZlcnRpY2llc1tpbmRleCs1XTtcblxuICAgICAgICAgdmFyIHUwID0gdXZzW2luZGV4XSAqIHN0cmlwLnRleHR1cmUud2lkdGgsICAgdTEgPSB1dnNbaW5kZXgrMl0gKiBzdHJpcC50ZXh0dXJlLndpZHRoLCB1MiA9IHV2c1tpbmRleCs0XSogc3RyaXAudGV4dHVyZS53aWR0aDtcbiAgICAgICAgIHZhciB2MCA9IHV2c1tpbmRleCsxXSogc3RyaXAudGV4dHVyZS5oZWlnaHQsIHYxID0gdXZzW2luZGV4KzNdICogc3RyaXAudGV4dHVyZS5oZWlnaHQsIHYyID0gdXZzW2luZGV4KzVdKiBzdHJpcC50ZXh0dXJlLmhlaWdodDtcblxuXG4gICAgICAgIGNvbnRleHQuc2F2ZSgpO1xuICAgICAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuICAgICAgICBjb250ZXh0Lm1vdmVUbyh4MCwgeTApO1xuICAgICAgICBjb250ZXh0LmxpbmVUbyh4MSwgeTEpO1xuICAgICAgICBjb250ZXh0LmxpbmVUbyh4MiwgeTIpO1xuICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuXG4gICAgICAgIGNvbnRleHQuY2xpcCgpO1xuXG5cbiAgICAgICAgLy8gQ29tcHV0ZSBtYXRyaXggdHJhbnNmb3JtXG4gICAgICAgIHZhciBkZWx0YSA9IHUwKnYxICsgdjAqdTIgKyB1MSp2MiAtIHYxKnUyIC0gdjAqdTEgLSB1MCp2MjtcbiAgICAgICAgdmFyIGRlbHRhX2EgPSB4MCp2MSArIHYwKngyICsgeDEqdjIgLSB2MSp4MiAtIHYwKngxIC0geDAqdjI7XG4gICAgICAgIHZhciBkZWx0YV9iID0gdTAqeDEgKyB4MCp1MiArIHUxKngyIC0geDEqdTIgLSB4MCp1MSAtIHUwKngyO1xuICAgICAgICB2YXIgZGVsdGFfYyA9IHUwKnYxKngyICsgdjAqeDEqdTIgKyB4MCp1MSp2MiAtIHgwKnYxKnUyIC0gdjAqdTEqeDIgLSB1MCp4MSp2MjtcbiAgICAgICAgdmFyIGRlbHRhX2QgPSB5MCp2MSArIHYwKnkyICsgeTEqdjIgLSB2MSp5MiAtIHYwKnkxIC0geTAqdjI7XG4gICAgICAgIHZhciBkZWx0YV9lID0gdTAqeTEgKyB5MCp1MiArIHUxKnkyIC0geTEqdTIgLSB5MCp1MSAtIHUwKnkyO1xuICAgICAgICB2YXIgZGVsdGFfZiA9IHUwKnYxKnkyICsgdjAqeTEqdTIgKyB5MCp1MSp2MiAtIHkwKnYxKnUyIC0gdjAqdTEqeTIgLSB1MCp5MSp2MjtcblxuXG5cblxuICAgICAgICBjb250ZXh0LnRyYW5zZm9ybShkZWx0YV9hL2RlbHRhLCBkZWx0YV9kL2RlbHRhLFxuICAgICAgICAgICAgICAgICAgICAgIGRlbHRhX2IvZGVsdGEsIGRlbHRhX2UvZGVsdGEsXG4gICAgICAgICAgICAgICAgICAgICAgZGVsdGFfYy9kZWx0YSwgZGVsdGFfZi9kZWx0YSk7XG5cbiAgICAgICAgY29udGV4dC5kcmF3SW1hZ2Uoc3RyaXAudGV4dHVyZS5iYXNlVGV4dHVyZS5zb3VyY2UsIDAsIDApO1xuICAgICAgICBjb250ZXh0LnJlc3RvcmUoKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbnZhc1JlbmRlcmVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi8uLi9wbGF0Zm9ybScpO1xudmFyIEdyYXBoaWNzID0gcmVxdWlyZSgnLi4vLi4vcHJpbWl0aXZlcy9HcmFwaGljcycpO1xuXG4vKipcbiAqIEEgc2V0IG9mIGZ1bmN0aW9ucyB1c2VkIGJ5IHRoZSBjYW52YXMgcmVuZGVyZXIgdG8gZHJhdyB0aGUgcHJpbWl0aXZlIGdyYXBoaWNzIGRhdGFcbiAqXG4gKiBAbW9kdWxlIHJlbmRlcmVycy9jYW52YXMvZ3JhcGhpY3NcbiAqL1xuXG4vKlxuICogUmVuZGVycyB0aGUgZ3JhcGhpY3Mgb2JqZWN0XG4gKlxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqIEBtZXRob2QgcmVuZGVyR3JhcGhpY3NcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gY29udGV4dCB7Q29udGV4dDJEfVxuICovXG5leHBvcnRzLnJlbmRlckdyYXBoaWNzID0gZnVuY3Rpb24gcmVuZGVyR3JhcGhpY3MoZ3JhcGhpY3MsIGNvbnRleHQpXG57XG4gICAgdmFyIHdvcmxkQWxwaGEgPSBncmFwaGljcy53b3JsZEFscGhhLFxuICAgICAgICBkYXRhLCBwb2ludHMsIGNvbG9yLCBpaSwgbGw7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGdyYXBoaWNzLmdyYXBoaWNzRGF0YS5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICBkYXRhID0gZ3JhcGhpY3MuZ3JhcGhpY3NEYXRhW2ldO1xuICAgICAgICBwb2ludHMgPSBkYXRhLnBvaW50cztcblxuICAgICAgICBjb2xvciA9IGNvbnRleHQuc3Ryb2tlU3R5bGUgPSAnIycgKyAoJzAwMDAwJyArICggZGF0YS5saW5lQ29sb3IgfCAwKS50b1N0cmluZygxNikpLnN1YnN0cigtNik7XG5cbiAgICAgICAgY29udGV4dC5saW5lV2lkdGggPSBkYXRhLmxpbmVXaWR0aDtcblxuICAgICAgICBpZihkYXRhLnR5cGUgPT0gR3JhcGhpY3MuUE9MWSlcbiAgICAgICAge1xuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcblxuICAgICAgICAgICAgY29udGV4dC5tb3ZlVG8ocG9pbnRzWzBdLCBwb2ludHNbMV0pO1xuXG4gICAgICAgICAgICBmb3IgKGlpID0gMSwgbGwgPSBwb2ludHMubGVuZ3RoIC8gMjsgaWkgPCBsbDsgaWkrKylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmxpbmVUbyhwb2ludHNbaWkgKiAyXSwgcG9pbnRzW2lpICogMiArIDFdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlIGZpcnN0IGFuZCBsYXN0IHBvaW50IGFyZSB0aGUgc2FtZSBjbG9zZSB0aGUgcGF0aCAtIG11Y2ggbmVhdGVyIDopXG4gICAgICAgICAgICBpZihwb2ludHNbMF0gPT0gcG9pbnRzW3BvaW50cy5sZW5ndGgtMl0gJiYgcG9pbnRzWzFdID09IHBvaW50c1twb2ludHMubGVuZ3RoLTFdKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuY2xvc2VQYXRoKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGRhdGEuZmlsbClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5maWxsQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbFN0eWxlID0gY29sb3IgPSAnIycgKyAoJzAwMDAwJyArICggZGF0YS5maWxsQ29sb3IgfCAwKS50b1N0cmluZygxNikpLnN1YnN0cigtNik7XG4gICAgICAgICAgICAgICAgY29udGV4dC5maWxsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihkYXRhLmxpbmVXaWR0aClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5saW5lQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuc3Ryb2tlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT0gR3JhcGhpY3MuUkVDVClcbiAgICAgICAge1xuXG4gICAgICAgICAgICBpZihkYXRhLmZpbGxDb2xvciB8fCBkYXRhLmZpbGxDb2xvciA9PT0gMClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5maWxsQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbFN0eWxlID0gY29sb3IgPSAnIycgKyAoJzAwMDAwJyArICggZGF0YS5maWxsQ29sb3IgfCAwKS50b1N0cmluZygxNikpLnN1YnN0cigtNik7XG4gICAgICAgICAgICAgICAgY29udGV4dC5maWxsUmVjdChwb2ludHNbMF0sIHBvaW50c1sxXSwgcG9pbnRzWzJdLCBwb2ludHNbM10pO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihkYXRhLmxpbmVXaWR0aClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5saW5lQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuc3Ryb2tlUmVjdChwb2ludHNbMF0sIHBvaW50c1sxXSwgcG9pbnRzWzJdLCBwb2ludHNbM10pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT0gR3JhcGhpY3MuQ0lSQylcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gVE9ETyAtIG5lZWQgdG8gYmUgVW5kZWZpbmVkIVxuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcbiAgICAgICAgICAgIGNvbnRleHQuYXJjKHBvaW50c1swXSwgcG9pbnRzWzFdLCBwb2ludHNbMl0sMCwyKk1hdGguUEkpO1xuICAgICAgICAgICAgY29udGV4dC5jbG9zZVBhdGgoKTtcblxuICAgICAgICAgICAgaWYoZGF0YS5maWxsKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBkYXRhLmZpbGxBbHBoYSAqIHdvcmxkQWxwaGE7XG4gICAgICAgICAgICAgICAgY29udGV4dC5maWxsU3R5bGUgPSBjb2xvciA9ICcjJyArICgnMDAwMDAnICsgKCBkYXRhLmZpbGxDb2xvciB8IDApLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC02KTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmZpbGwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKGRhdGEubGluZVdpZHRoKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBkYXRhLmxpbmVBbHBoYSAqIHdvcmxkQWxwaGE7XG4gICAgICAgICAgICAgICAgY29udGV4dC5zdHJva2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRhdGEudHlwZSA9PSBHcmFwaGljcy5FTElQKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIC8vIGVsaXBzZSBjb2RlIHRha2VuIGZyb206IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjE3Mjc5OC9ob3ctdG8tZHJhdy1hbi1vdmFsLWluLWh0bWw1LWNhbnZhc1xuXG4gICAgICAgICAgICB2YXIgZWxpcHNlRGF0YSA9ICBkYXRhLnBvaW50cztcblxuICAgICAgICAgICAgdmFyIHcgPSBlbGlwc2VEYXRhWzJdICogMjtcbiAgICAgICAgICAgIHZhciBoID0gZWxpcHNlRGF0YVszXSAqIDI7XG5cbiAgICAgICAgICAgIHZhciB4ID0gZWxpcHNlRGF0YVswXSAtIHcvMjtcbiAgICAgICAgICAgIHZhciB5ID0gZWxpcHNlRGF0YVsxXSAtIGgvMjtcblxuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcblxuICAgICAgICAgICAgdmFyIGthcHBhID0gMC41NTIyODQ4LFxuICAgICAgICAgICAgb3ggPSAodyAvIDIpICoga2FwcGEsIC8vIGNvbnRyb2wgcG9pbnQgb2Zmc2V0IGhvcml6b250YWxcbiAgICAgICAgICAgIG95ID0gKGggLyAyKSAqIGthcHBhLCAvLyBjb250cm9sIHBvaW50IG9mZnNldCB2ZXJ0aWNhbFxuICAgICAgICAgICAgeGUgPSB4ICsgdywgICAgICAgICAgIC8vIHgtZW5kXG4gICAgICAgICAgICB5ZSA9IHkgKyBoLCAgICAgICAgICAgLy8geS1lbmRcbiAgICAgICAgICAgIHhtID0geCArIHcgLyAyLCAgICAgICAvLyB4LW1pZGRsZVxuICAgICAgICAgICAgeW0gPSB5ICsgaCAvIDI7ICAgICAgIC8vIHktbWlkZGxlXG5cbiAgICAgICAgICAgIGNvbnRleHQubW92ZVRvKHgsIHltKTtcbiAgICAgICAgICAgIGNvbnRleHQuYmV6aWVyQ3VydmVUbyh4LCB5bSAtIG95LCB4bSAtIG94LCB5LCB4bSwgeSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeG0gKyBveCwgeSwgeGUsIHltIC0gb3ksIHhlLCB5bSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeGUsIHltICsgb3ksIHhtICsgb3gsIHllLCB4bSwgeWUpO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhtIC0gb3gsIHllLCB4LCB5bSArIG95LCB4LCB5bSk7XG5cbiAgICAgICAgICAgIGNvbnRleHQuY2xvc2VQYXRoKCk7XG5cbiAgICAgICAgICAgIGlmKGRhdGEuZmlsbClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5maWxsQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbFN0eWxlID0gY29sb3IgPSAnIycgKyAoJzAwMDAwJyArICggZGF0YS5maWxsQ29sb3IgfCAwKS50b1N0cmluZygxNikpLnN1YnN0cigtNik7XG4gICAgICAgICAgICAgICAgY29udGV4dC5maWxsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihkYXRhLmxpbmVXaWR0aClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5saW5lQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuc3Ryb2tlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKlxuICogUmVuZGVycyBhIGdyYXBoaWNzIG1hc2tcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCByZW5kZXJHcmFwaGljc01hc2tcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gY29udGV4dCB7Q29udGV4dDJEfVxuICovXG5leHBvcnRzLnJlbmRlckdyYXBoaWNzTWFzayA9IGZ1bmN0aW9uIHJlbmRlckdyYXBoaWNzTWFzayhncmFwaGljcywgY29udGV4dClcbntcbiAgICB2YXIgd29ybGRBbHBoYSA9IGdyYXBoaWNzLndvcmxkQWxwaGE7XG5cbiAgICB2YXIgbGVuID0gZ3JhcGhpY3MuZ3JhcGhpY3NEYXRhLmxlbmd0aDtcbiAgICBpZihsZW4gPiAxKVxuICAgIHtcbiAgICAgICAgbGVuID0gMTtcbiAgICAgICAgcGxhdGZvcm0uY29uc29sZS53YXJuKFwiUGl4aS5qcyB3YXJuaW5nOiBtYXNrcyBpbiBjYW52YXMgY2FuIG9ubHkgbWFzayB1c2luZyB0aGUgZmlyc3QgcGF0aCBpbiB0aGUgZ3JhcGhpY3Mgb2JqZWN0XCIpXG4gICAgfVxuXG4gICAgZm9yICh2YXIgaT0wOyBpIDwgMTsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGRhdGEgPSBncmFwaGljcy5ncmFwaGljc0RhdGFbaV07XG4gICAgICAgIHZhciBwb2ludHMgPSBkYXRhLnBvaW50cztcblxuICAgICAgICBpZihkYXRhLnR5cGUgPT0gR3JhcGhpY3MuUE9MWSlcbiAgICAgICAge1xuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcbiAgICAgICAgICAgIGNvbnRleHQubW92ZVRvKHBvaW50c1swXSwgcG9pbnRzWzFdKTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaj0xOyBqIDwgcG9pbnRzLmxlbmd0aC8yOyBqKyspXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5saW5lVG8ocG9pbnRzW2ogKiAyXSwgcG9pbnRzW2ogKiAyICsgMV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGUgZmlyc3QgYW5kIGxhc3QgcG9pbnQgYXJlIHRoZSBzYW1lIGNsb3NlIHRoZSBwYXRoIC0gbXVjaCBuZWF0ZXIgOilcbiAgICAgICAgICAgIGlmKHBvaW50c1swXSA9PSBwb2ludHNbcG9pbnRzLmxlbmd0aC0yXSAmJiBwb2ludHNbMV0gPT0gcG9pbnRzW3BvaW50cy5sZW5ndGgtMV0pXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5jbG9zZVBhdGgoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGF0YS50eXBlID09IEdyYXBoaWNzLlJFQ1QpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG4gICAgICAgICAgICBjb250ZXh0LnJlY3QocG9pbnRzWzBdLCBwb2ludHNbMV0sIHBvaW50c1syXSwgcG9pbnRzWzNdKTtcbiAgICAgICAgICAgIGNvbnRleHQuY2xvc2VQYXRoKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT0gR3JhcGhpY3MuQ0lSQylcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gVE9ETyAtIG5lZWQgdG8gYmUgVW5kZWZpbmVkIVxuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcbiAgICAgICAgICAgIGNvbnRleHQuYXJjKHBvaW50c1swXSwgcG9pbnRzWzFdLCBwb2ludHNbMl0sMCwyKk1hdGguUEkpO1xuICAgICAgICAgICAgY29udGV4dC5jbG9zZVBhdGgoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRhdGEudHlwZSA9PSBHcmFwaGljcy5FTElQKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIC8vIGVsaXBzZSBjb2RlIHRha2VuIGZyb206IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjE3Mjc5OC9ob3ctdG8tZHJhdy1hbi1vdmFsLWluLWh0bWw1LWNhbnZhc1xuICAgICAgICAgICAgdmFyIGVsaXBzZURhdGEgPSAgZGF0YS5wb2ludHM7XG5cbiAgICAgICAgICAgIHZhciB3ID0gZWxpcHNlRGF0YVsyXSAqIDI7XG4gICAgICAgICAgICB2YXIgaCA9IGVsaXBzZURhdGFbM10gKiAyO1xuXG4gICAgICAgICAgICB2YXIgeCA9IGVsaXBzZURhdGFbMF0gLSB3LzI7XG4gICAgICAgICAgICB2YXIgeSA9IGVsaXBzZURhdGFbMV0gLSBoLzI7XG5cbiAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgICAgIHZhciBrYXBwYSA9IDAuNTUyMjg0OCxcbiAgICAgICAgICAgIG94ID0gKHcgLyAyKSAqIGthcHBhLCAvLyBjb250cm9sIHBvaW50IG9mZnNldCBob3Jpem9udGFsXG4gICAgICAgICAgICBveSA9IChoIC8gMikgKiBrYXBwYSwgLy8gY29udHJvbCBwb2ludCBvZmZzZXQgdmVydGljYWxcbiAgICAgICAgICAgIHhlID0geCArIHcsICAgICAgICAgICAvLyB4LWVuZFxuICAgICAgICAgICAgeWUgPSB5ICsgaCwgICAgICAgICAgIC8vIHktZW5kXG4gICAgICAgICAgICB4bSA9IHggKyB3IC8gMiwgICAgICAgLy8geC1taWRkbGVcbiAgICAgICAgICAgIHltID0geSArIGggLyAyOyAgICAgICAvLyB5LW1pZGRsZVxuXG4gICAgICAgICAgICBjb250ZXh0Lm1vdmVUbyh4LCB5bSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeCwgeW0gLSBveSwgeG0gLSBveCwgeSwgeG0sIHkpO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhtICsgb3gsIHksIHhlLCB5bSAtIG95LCB4ZSwgeW0pO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhlLCB5bSArIG95LCB4bSArIG94LCB5ZSwgeG0sIHllKTtcbiAgICAgICAgICAgIGNvbnRleHQuYmV6aWVyQ3VydmVUbyh4bSAtIG94LCB5ZSwgeCwgeW0gKyBveSwgeCwgeW0pO1xuICAgICAgICAgICAgY29udGV4dC5jbG9zZVBhdGgoKTtcbiAgICAgICAgfVxuXG4gICAgfVxufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi8uLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBibGVuZE1vZGVzID0gcmVxdWlyZSgnLi4vLi4vZGlzcGxheS9ibGVuZE1vZGVzJyk7XG5cbi8qKlxuICogQSBXZWJHTEJhdGNoIEVuYWJsZXMgYSBncm91cCBvZiBzcHJpdGVzIHRvIGJlIGRyYXduIHVzaW5nIHRoZSBzYW1lIHNldHRpbmdzLlxuICogaWYgYSBncm91cCBvZiBzcHJpdGVzIGFsbCBoYXZlIHRoZSBzYW1lIGJhc2VUZXh0dXJlIGFuZCBibGVuZE1vZGUgdGhlbiB0aGV5IGNhbiBiZSBncm91cGVkIGludG8gYSBiYXRjaC5cbiAqIEFsbCB0aGUgc3ByaXRlcyBpbiBhIGJhdGNoIGNhbiB0aGVuIGJlIGRyYXduIGluIG9uZSBnbyBieSB0aGUgR1BVIHdoaWNoIGlzIGh1Z2VseSBlZmZpY2llbnQuIEFMTCBzcHJpdGVzXG4gKiBpbiB0aGUgd2ViR0wgcmVuZGVyZXIgYXJlIGFkZGVkIHRvIGEgYmF0Y2ggZXZlbiBpZiB0aGUgYmF0Y2ggb25seSBjb250YWlucyBvbmUgc3ByaXRlLiBCYXRjaGluZyBpcyBoYW5kbGVkXG4gKiBhdXRvbWF0aWNhbGx5IGJ5IHRoZSB3ZWJHTCByZW5kZXJlci4gQSBnb29kIHRpcCBpczogdGhlIHNtYWxsZXIgdGhlIG51bWJlciBvZiBiYXRjaHMgdGhlcmUgYXJlLCB0aGUgZmFzdGVyXG4gKiB0aGUgd2ViR0wgcmVuZGVyZXIgd2lsbCBydW4uXG4gKlxuICogQGNsYXNzIFdlYkdMQmF0Y2hcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIGdsIHtXZWJHTENvbnRleHR9IGFuIGluc3RhbmNlIG9mIHRoZSB3ZWJHTCBjb250ZXh0XG4gKi9cbmZ1bmN0aW9uIFdlYkdMQmF0Y2goZ2wpXG57XG4gICAgdGhpcy5nbCA9IGdsO1xuXG4gICAgdGhpcy5zaXplID0gMDtcblxuICAgIHRoaXMudmVydGV4QnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMuaW5kZXhCdWZmZXIgPSAgZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdGhpcy51dkJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmNvbG9yQnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMuYmxlbmRNb2RlID0gYmxlbmRNb2Rlcy5OT1JNQUw7XG4gICAgdGhpcy5keW5hbWljU2l6ZSA9IDE7XG59XG5cbnZhciBwcm90byA9IFdlYkdMQmF0Y2gucHJvdG90eXBlO1xuXG4vKipcbiAqIENsZWFucyB0aGUgYmF0Y2ggc28gdGhhdCBpcyBjYW4gYmUgcmV0dXJuZWQgdG8gYW4gb2JqZWN0IHBvb2wgYW5kIHJldXNlZFxuICpcbiAqIEBtZXRob2QgY2xlYW5cbiAqL1xucHJvdG8uY2xlYW4gPSBmdW5jdGlvbiBjbGVhbigpXG57XG4gICAgdGhpcy52ZXJ0aWNpZXMgPSBbXTtcbiAgICB0aGlzLnV2cyA9IFtdO1xuICAgIHRoaXMuaW5kaWNlcyA9IFtdO1xuICAgIHRoaXMuY29sb3JzID0gW107XG4gICAgdGhpcy5keW5hbWljU2l6ZSA9IDE7XG4gICAgdGhpcy50ZXh0dXJlID0gbnVsbDtcbiAgICB0aGlzLnNpemUgPSAwO1xuICAgIHRoaXMuaGVhZCA9IG51bGw7XG4gICAgdGhpcy50YWlsID0gbnVsbDtcbn07XG5cbi8qKlxuICogUmVjcmVhdGVzIHRoZSBidWZmZXJzIGluIHRoZSBldmVudCBvZiBhIGNvbnRleHQgbG9zc1xuICpcbiAqIEBtZXRob2QgcmVzdG9yZUxvc3RDb250ZXh0XG4gKiBAcGFyYW0gZ2wge1dlYkdMQ29udGV4dH1cbiAqL1xucHJvdG8ucmVzdG9yZUxvc3RDb250ZXh0ID0gZnVuY3Rpb24gcmVzdG9yZUxvc3RDb250ZXh0KGdsKVxue1xuICAgIHRoaXMuZ2wgPSBnbDtcbiAgICB0aGlzLnZlcnRleEJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmluZGV4QnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMudXZCdWZmZXIgPSAgZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdGhpcy5jb2xvckJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbn07XG5cbi8qKlxuICogaW5pdHMgdGhlIGJhdGNoJ3MgdGV4dHVyZSBhbmQgYmxlbmQgbW9kZSBiYXNlZCBpZiB0aGUgc3VwcGxpZWQgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBpbml0XG4gKiBAcGFyYW0gc3ByaXRlIHtTcHJpdGV9IHRoZSBmaXJzdCBzcHJpdGUgdG8gYmUgYWRkZWQgdG8gdGhlIGJhdGNoLiBPbmx5IHNwcml0ZXMgd2l0aFxuICogICAgICB0aGUgc2FtZSBiYXNlIHRleHR1cmUgYW5kIGJsZW5kIG1vZGUgd2lsbCBiZSBhbGxvd2VkIHRvIGJlIGFkZGVkIHRvIHRoaXMgYmF0Y2hcbiAqL1xucHJvdG8uaW5pdCA9IGZ1bmN0aW9uIGluaXQoc3ByaXRlKVxue1xuICAgIHNwcml0ZS5iYXRjaCA9IHRoaXM7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgdGhpcy5ibGVuZE1vZGUgPSBzcHJpdGUuYmxlbmRNb2RlO1xuICAgIHRoaXMudGV4dHVyZSA9IHNwcml0ZS50ZXh0dXJlLmJhc2VUZXh0dXJlO1xuICAgIHRoaXMuaGVhZCA9IHNwcml0ZTtcbiAgICB0aGlzLnRhaWwgPSBzcHJpdGU7XG4gICAgdGhpcy5zaXplID0gMTtcblxuICAgIHRoaXMuZ3Jvd0JhdGNoKCk7XG59O1xuXG4vKipcbiAqIGluc2VydHMgYSBzcHJpdGUgYmVmb3JlIHRoZSBzcGVjaWZpZWQgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBpbnNlcnRCZWZvcmVcbiAqIEBwYXJhbSBzcHJpdGUge1Nwcml0ZX0gdGhlIHNwcml0ZSB0byBiZSBhZGRlZFxuICogQHBhcmFtIG5leHRTcHJpdGUge25leHRTcHJpdGV9IHRoZSBmaXJzdCBzcHJpdGUgd2lsbCBiZSBpbnNlcnRlZCBiZWZvcmUgdGhpcyBzcHJpdGVcbiAqL1xucHJvdG8uaW5zZXJ0QmVmb3JlID0gZnVuY3Rpb24gaW5zZXJ0QmVmb3JlKHNwcml0ZSwgbmV4dFNwcml0ZSlcbntcbiAgICB0aGlzLnNpemUrKztcblxuICAgIHNwcml0ZS5iYXRjaCA9IHRoaXM7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgdmFyIHRlbXBQcmV2ID0gbmV4dFNwcml0ZS5fX3ByZXY7XG4gICAgbmV4dFNwcml0ZS5fX3ByZXYgPSBzcHJpdGU7XG4gICAgc3ByaXRlLl9fbmV4dCA9IG5leHRTcHJpdGU7XG5cbiAgICBpZih0ZW1wUHJldilcbiAgICB7XG4gICAgICAgIHNwcml0ZS5fX3ByZXYgPSB0ZW1wUHJldjtcbiAgICAgICAgdGVtcFByZXYuX19uZXh0ID0gc3ByaXRlO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLmhlYWQgPSBzcHJpdGU7XG4gICAgfVxufTtcblxuLyoqXG4gKiBpbnNlcnRzIGEgc3ByaXRlIGFmdGVyIHRoZSBzcGVjaWZpZWQgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBpbnNlcnRBZnRlclxuICogQHBhcmFtIHNwcml0ZSB7U3ByaXRlfSB0aGUgc3ByaXRlIHRvIGJlIGFkZGVkXG4gKiBAcGFyYW0gIHByZXZpb3VzU3ByaXRlIHtTcHJpdGV9IHRoZSBmaXJzdCBzcHJpdGUgd2lsbCBiZSBpbnNlcnRlZCBhZnRlciB0aGlzIHNwcml0ZVxuICovXG5wcm90by5pbnNlcnRBZnRlciA9IGZ1bmN0aW9uIGluc2VydEFmdGVyKHNwcml0ZSwgcHJldmlvdXNTcHJpdGUpXG57XG4gICAgdGhpcy5zaXplKys7XG5cbiAgICBzcHJpdGUuYmF0Y2ggPSB0aGlzO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuXG4gICAgdmFyIHRlbXBOZXh0ID0gcHJldmlvdXNTcHJpdGUuX19uZXh0O1xuICAgIHByZXZpb3VzU3ByaXRlLl9fbmV4dCA9IHNwcml0ZTtcbiAgICBzcHJpdGUuX19wcmV2ID0gcHJldmlvdXNTcHJpdGU7XG5cbiAgICBpZih0ZW1wTmV4dClcbiAgICB7XG4gICAgICAgIHNwcml0ZS5fX25leHQgPSB0ZW1wTmV4dDtcbiAgICAgICAgdGVtcE5leHQuX19wcmV2ID0gc3ByaXRlO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLnRhaWwgPSBzcHJpdGVcbiAgICB9XG59O1xuXG4vKipcbiAqIHJlbW92ZXMgYSBzcHJpdGUgZnJvbSB0aGUgYmF0Y2hcbiAqXG4gKiBAbWV0aG9kIHJlbW92ZVxuICogQHBhcmFtIHNwcml0ZSB7U3ByaXRlfSB0aGUgc3ByaXRlIHRvIGJlIHJlbW92ZWRcbiAqL1xucHJvdG8ucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKHNwcml0ZSlcbntcbiAgICB0aGlzLnNpemUtLTtcblxuICAgIGlmICghdGhpcy5zaXplKVxuICAgIHtcbiAgICAgICAgc3ByaXRlLmJhdGNoID0gbnVsbDtcbiAgICAgICAgc3ByaXRlLl9fcHJldiA9IG51bGw7XG4gICAgICAgIHNwcml0ZS5fX25leHQgPSBudWxsO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoc3ByaXRlLl9fcHJldilcbiAgICB7XG4gICAgICAgIHNwcml0ZS5fX3ByZXYuX19uZXh0ID0gc3ByaXRlLl9fbmV4dDtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5oZWFkID0gc3ByaXRlLl9fbmV4dDtcbiAgICAgICAgdGhpcy5oZWFkLl9fcHJldiA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYoc3ByaXRlLl9fbmV4dClcbiAgICB7XG4gICAgICAgIHNwcml0ZS5fX25leHQuX19wcmV2ID0gc3ByaXRlLl9fcHJldjtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy50YWlsID0gc3ByaXRlLl9fcHJldjtcbiAgICAgICAgdGhpcy50YWlsLl9fbmV4dCA9IG51bGxcbiAgICB9XG5cbiAgICBzcHJpdGUuYmF0Y2ggPSBudWxsO1xuICAgIHNwcml0ZS5fX25leHQgPSBudWxsO1xuICAgIHNwcml0ZS5fX3ByZXYgPSBudWxsO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBTcGxpdHMgdGhlIGJhdGNoIGludG8gdHdvIHdpdGggdGhlIHNwZWNpZmllZCBzcHJpdGUgYmVpbmcgdGhlIHN0YXJ0IG9mIHRoZSBuZXcgYmF0Y2guXG4gKlxuICogQG1ldGhvZCBzcGxpdFxuICogQHBhcmFtIHNwcml0ZSB7U3ByaXRlfSB0aGUgc3ByaXRlIHRoYXQgaW5kaWNhdGVzIHdoZXJlIHRoZSBiYXRjaCBzaG91bGQgYmUgc3BsaXRcbiAqIEByZXR1cm4ge1dlYkdMQmF0Y2h9IHRoZSBuZXcgYmF0Y2hcbiAqL1xucHJvdG8uc3BsaXQgPSBmdW5jdGlvbiBzcGxpdChzcHJpdGUpXG57XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG5cbiAgICB2YXIgYmF0Y2ggPSBuZXcgV2ViR0xCYXRjaCh0aGlzLmdsKTtcbiAgICBiYXRjaC5pbml0KHNwcml0ZSk7XG4gICAgYmF0Y2gudGV4dHVyZSA9IHRoaXMudGV4dHVyZTtcbiAgICBiYXRjaC50YWlsID0gdGhpcy50YWlsO1xuXG4gICAgdGhpcy50YWlsID0gc3ByaXRlLl9fcHJldjtcbiAgICB0aGlzLnRhaWwuX19uZXh0ID0gbnVsbDtcblxuICAgIHNwcml0ZS5fX3ByZXYgPSBudWxsO1xuICAgIC8vIHJldHVybiBhIHNwbGl0ZSBiYXRjaCFcblxuICAgIC8vIFRPRE8gdGhpcyBzaXplIGlzIHdyb25nIVxuICAgIC8vIG5lZWQgdG8gcmVjYWxjdWxhdGUgOi8gcHJvYmxlbSB3aXRoIGEgbGlua2VkIGxpc3QhXG4gICAgLy8gdW5sZXNzIGl0IGdldHMgY2FsY3VsYXRlZCBpbiB0aGUgXCJjbGVhblwiP1xuXG4gICAgLy8gbmVlZCB0byBsb29wIHRocm91Z2ggaXRlbXMgYXMgdGhlcmUgaXMgbm8gd2F5IHRvIGtub3cgdGhlIGxlbmd0aCBvbiBhIGxpbmtlZCBsaXN0IDovXG4gICAgdmFyIHRlbXBTaXplID0gMDtcbiAgICB3aGlsZShzcHJpdGUpXG4gICAge1xuICAgICAgICB0ZW1wU2l6ZSsrO1xuICAgICAgICBzcHJpdGUuYmF0Y2ggPSBiYXRjaDtcbiAgICAgICAgc3ByaXRlID0gc3ByaXRlLl9fbmV4dDtcbiAgICB9XG5cbiAgICBiYXRjaC5zaXplID0gdGVtcFNpemU7XG4gICAgdGhpcy5zaXplIC09IHRlbXBTaXplO1xuXG4gICAgcmV0dXJuIGJhdGNoO1xufTtcblxuLyoqXG4gKiBNZXJnZXMgdHdvIGJhdGNocyB0b2dldGhlclxuICpcbiAqIEBtZXRob2QgbWVyZ2VcbiAqIEBwYXJhbSBiYXRjaCB7V2ViR0xCYXRjaH0gdGhlIGJhdGNoIHRoYXQgd2lsbCBiZSBtZXJnZWRcbiAqL1xucHJvdG8ubWVyZ2UgPSBmdW5jdGlvbiBtZXJnZShiYXRjaClcbntcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcblxuICAgIHRoaXMudGFpbC5fX25leHQgPSBiYXRjaC5oZWFkO1xuICAgIGJhdGNoLmhlYWQuX19wcmV2ID0gdGhpcy50YWlsO1xuXG4gICAgdGhpcy5zaXplICs9IGJhdGNoLnNpemU7XG5cbiAgICB0aGlzLnRhaWwgPSBiYXRjaC50YWlsO1xuXG4gICAgdmFyIHNwcml0ZSA9IGJhdGNoLmhlYWQ7XG4gICAgd2hpbGUoc3ByaXRlKVxuICAgIHtcbiAgICAgICAgc3ByaXRlLmJhdGNoID0gdGhpcztcbiAgICAgICAgc3ByaXRlID0gc3ByaXRlLl9fbmV4dDtcbiAgICB9XG59O1xuXG4vKipcbiAqIEdyb3dzIHRoZSBzaXplIG9mIHRoZSBiYXRjaC4gQXMgdGhlIGVsZW1lbnRzIGluIHRoZSBiYXRjaCBjYW5ub3QgaGF2ZSBhIGR5bmFtaWMgc2l6ZSB0aGlzXG4gKiBmdW5jdGlvbiBpcyB1c2VkIHRvIGluY3JlYXNlIHRoZSBzaXplIG9mIHRoZSBiYXRjaC4gSXQgYWxzbyBjcmVhdGVzIGEgbGl0dGxlIGV4dHJhIHJvb20gc29cbiAqIHRoYXQgdGhlIGJhdGNoIGRvZXMgbm90IG5lZWQgdG8gYmUgcmVzaXplZCBldmVyeSB0aW1lIGEgc3ByaXRlIGlzIGFkZGVkXG4gKlxuICogQG1ldGhvZCBncm93QmF0Y2hcbiAqL1xucHJvdG8uZ3Jvd0JhdGNoID0gZnVuY3Rpb24gZ3Jvd0JhdGNoKClcbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuICAgIGlmKCB0aGlzLnNpemUgPT0gMSlcbiAgICB7XG4gICAgICAgIHRoaXMuZHluYW1pY1NpemUgPSAxO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLmR5bmFtaWNTaXplID0gdGhpcy5zaXplICogMS41XG4gICAgfVxuICAgIC8vIGdyb3cgdmVydHNcbiAgICB0aGlzLnZlcnRpY2llcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5keW5hbWljU2l6ZSAqIDgpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUix0aGlzLnZlcnRpY2llcyAsIGdsLkRZTkFNSUNfRFJBVyk7XG5cbiAgICB0aGlzLnV2cyAgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLmR5bmFtaWNTaXplICogOCApO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnV2QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy51dnMgLCBnbC5EWU5BTUlDX0RSQVcpO1xuXG4gICAgdGhpcy5kaXJ0eVVWUyA9IHRydWU7XG5cbiAgICB0aGlzLmNvbG9ycyAgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLmR5bmFtaWNTaXplICogNCApO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLmNvbG9yQnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy5jb2xvcnMgLCBnbC5EWU5BTUlDX0RSQVcpO1xuXG4gICAgdGhpcy5kaXJ0eUNvbG9ycyA9IHRydWU7XG5cbiAgICB0aGlzLmluZGljZXMgPSBuZXcgVWludDE2QXJyYXkodGhpcy5keW5hbWljU2l6ZSAqIDYpO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmluZGljZXMubGVuZ3RoLzY7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaW5kZXgyID0gaSAqIDY7XG4gICAgICAgIHZhciBpbmRleDMgPSBpICogNDtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDBdID0gaW5kZXgzICsgMDtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDFdID0gaW5kZXgzICsgMTtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDJdID0gaW5kZXgzICsgMjtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDNdID0gaW5kZXgzICsgMDtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDRdID0gaW5kZXgzICsgMjtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDVdID0gaW5kZXgzICsgMztcbiAgICB9XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGljZXMsIGdsLlNUQVRJQ19EUkFXKTtcbn07XG5cbi8qKlxuICogUmVmcmVzaCdzIGFsbCB0aGUgZGF0YSBpbiB0aGUgYmF0Y2ggYW5kIHN5bmMncyBpdCB3aXRoIHRoZSB3ZWJHTCBidWZmZXJzXG4gKlxuICogQG1ldGhvZCByZWZyZXNoXG4gKi9cbnByb3RvLnJlZnJlc2ggPSBmdW5jdGlvbiByZWZyZXNoKClcbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuXG4gICAgaWYgKHRoaXMuZHluYW1pY1NpemUgPCB0aGlzLnNpemUpXG4gICAge1xuICAgICAgICB0aGlzLmdyb3dCYXRjaCgpO1xuICAgIH1cblxuICAgIHZhciBpbmRleFJ1biA9IDA7XG4gICAgdmFyIHdvcmxkVHJhbnNmb3JtLCB3aWR0aCwgaGVpZ2h0LCBhWCwgYVksIHcwLCB3MSwgaDAsIGgxLCBpbmRleDtcbiAgICB2YXIgYSwgYiwgYywgZCwgdHgsIHR5LCBjb2xvckluZGV4O1xuXG4gICAgdmFyIGRpc3BsYXlPYmplY3QgPSB0aGlzLmhlYWQ7XG5cbiAgICB3aGlsZShkaXNwbGF5T2JqZWN0KVxuICAgIHtcbiAgICAgICAgaW5kZXggPSBpbmRleFJ1biAqIDg7XG5cbiAgICAgICAgdmFyIHRleHR1cmUgPSBkaXNwbGF5T2JqZWN0LnRleHR1cmU7XG5cbiAgICAgICAgdmFyIGZyYW1lID0gdGV4dHVyZS5mcmFtZTtcbiAgICAgICAgdmFyIHR3ID0gdGV4dHVyZS5iYXNlVGV4dHVyZS53aWR0aDtcbiAgICAgICAgdmFyIHRoID0gdGV4dHVyZS5iYXNlVGV4dHVyZS5oZWlnaHQ7XG5cbiAgICAgICAgdGhpcy51dnNbaW5kZXggKyAwXSA9IGZyYW1lLnggLyB0dztcbiAgICAgICAgdGhpcy51dnNbaW5kZXggKzFdID0gZnJhbWUueSAvIHRoO1xuXG4gICAgICAgIHRoaXMudXZzW2luZGV4ICsyXSA9IChmcmFtZS54ICsgZnJhbWUud2lkdGgpIC8gdHc7XG4gICAgICAgIHRoaXMudXZzW2luZGV4ICszXSA9IGZyYW1lLnkgLyB0aDtcblxuICAgICAgICB0aGlzLnV2c1tpbmRleCArNF0gPSAoZnJhbWUueCArIGZyYW1lLndpZHRoKSAvIHR3O1xuICAgICAgICB0aGlzLnV2c1tpbmRleCArNV0gPSAoZnJhbWUueSArIGZyYW1lLmhlaWdodCkgLyB0aDtcblxuICAgICAgICB0aGlzLnV2c1tpbmRleCArNl0gPSBmcmFtZS54IC8gdHc7XG4gICAgICAgIHRoaXMudXZzW2luZGV4ICs3XSA9IChmcmFtZS55ICsgZnJhbWUuaGVpZ2h0KSAvIHRoO1xuXG4gICAgICAgIGRpc3BsYXlPYmplY3QudXBkYXRlRnJhbWUgPSBmYWxzZTtcblxuICAgICAgICBjb2xvckluZGV4ID0gaW5kZXhSdW4gKiA0O1xuICAgICAgICB0aGlzLmNvbG9yc1tjb2xvckluZGV4XSA9IHRoaXMuY29sb3JzW2NvbG9ySW5kZXggKyAxXSA9IHRoaXMuY29sb3JzW2NvbG9ySW5kZXggKyAyXSA9IHRoaXMuY29sb3JzW2NvbG9ySW5kZXggKyAzXSA9IGRpc3BsYXlPYmplY3Qud29ybGRBbHBoYTtcblxuICAgICAgICBkaXNwbGF5T2JqZWN0ID0gZGlzcGxheU9iamVjdC5fX25leHQ7XG5cbiAgICAgICAgaW5kZXhSdW4gKys7XG4gICAgfVxuXG4gICAgdGhpcy5kaXJ0eVVWUyA9IHRydWU7XG4gICAgdGhpcy5kaXJ0eUNvbG9ycyA9IHRydWU7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgYWxsIHRoZSByZWxldmFudCBnZW9tZXRyeSBhbmQgdXBsb2FkcyB0aGUgZGF0YSB0byB0aGUgR1BVXG4gKlxuICogQG1ldGhvZCB1cGRhdGVcbiAqL1xucHJvdG8udXBkYXRlID0gZnVuY3Rpb24gdXBkYXRlKClcbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuICAgIHZhciB3b3JsZFRyYW5zZm9ybSwgd2lkdGgsIGhlaWdodCwgYVgsIGFZLCB3MCwgdzEsIGgwLCBoMSwgaW5kZXgsIGluZGV4MiwgaW5kZXgzXG5cbiAgICB2YXIgYSwgYiwgYywgZCwgdHgsIHR5O1xuXG4gICAgdmFyIGluZGV4UnVuID0gMDtcblxuICAgIHZhciBkaXNwbGF5T2JqZWN0ID0gdGhpcy5oZWFkO1xuXG4gICAgd2hpbGUoZGlzcGxheU9iamVjdClcbiAgICB7XG4gICAgICAgIGlmKGRpc3BsYXlPYmplY3QudmNvdW50ID09PSBnbG9iYWxzLnZpc2libGVDb3VudClcbiAgICAgICAge1xuICAgICAgICAgICAgd2lkdGggPSBkaXNwbGF5T2JqZWN0LnRleHR1cmUuZnJhbWUud2lkdGg7XG4gICAgICAgICAgICBoZWlnaHQgPSBkaXNwbGF5T2JqZWN0LnRleHR1cmUuZnJhbWUuaGVpZ2h0O1xuXG4gICAgICAgICAgICAvLyBUT0RPIHRyaW0/P1xuICAgICAgICAgICAgYVggPSBkaXNwbGF5T2JqZWN0LmFuY2hvci54Oy8vIC0gZGlzcGxheU9iamVjdC50ZXh0dXJlLnRyaW0ueFxuICAgICAgICAgICAgYVkgPSBkaXNwbGF5T2JqZWN0LmFuY2hvci55OyAvLy0gZGlzcGxheU9iamVjdC50ZXh0dXJlLnRyaW0ueVxuICAgICAgICAgICAgdzAgPSB3aWR0aCAqICgxLWFYKTtcbiAgICAgICAgICAgIHcxID0gd2lkdGggKiAtYVg7XG5cbiAgICAgICAgICAgIGgwID0gaGVpZ2h0ICogKDEtYVkpO1xuICAgICAgICAgICAgaDEgPSBoZWlnaHQgKiAtYVk7XG5cbiAgICAgICAgICAgIGluZGV4ID0gaW5kZXhSdW4gKiA4O1xuXG4gICAgICAgICAgICB3b3JsZFRyYW5zZm9ybSA9IGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm07XG5cbiAgICAgICAgICAgIGEgPSB3b3JsZFRyYW5zZm9ybVswXTtcbiAgICAgICAgICAgIGIgPSB3b3JsZFRyYW5zZm9ybVszXTtcbiAgICAgICAgICAgIGMgPSB3b3JsZFRyYW5zZm9ybVsxXTtcbiAgICAgICAgICAgIGQgPSB3b3JsZFRyYW5zZm9ybVs0XTtcbiAgICAgICAgICAgIHR4ID0gd29ybGRUcmFuc2Zvcm1bMl07XG4gICAgICAgICAgICB0eSA9IHdvcmxkVHJhbnNmb3JtWzVdO1xuXG4gICAgICAgICAgICB0aGlzLnZlcnRpY2llc1tpbmRleCArIDAgXSA9IGEgKiB3MSArIGMgKiBoMSArIHR4O1xuICAgICAgICAgICAgdGhpcy52ZXJ0aWNpZXNbaW5kZXggKyAxIF0gPSBkICogaDEgKyBiICogdzEgKyB0eTtcblxuICAgICAgICAgICAgdGhpcy52ZXJ0aWNpZXNbaW5kZXggKyAyIF0gPSBhICogdzAgKyBjICogaDEgKyB0eDtcbiAgICAgICAgICAgIHRoaXMudmVydGljaWVzW2luZGV4ICsgMyBdID0gZCAqIGgxICsgYiAqIHcwICsgdHk7XG5cbiAgICAgICAgICAgIHRoaXMudmVydGljaWVzW2luZGV4ICsgNCBdID0gYSAqIHcwICsgYyAqIGgwICsgdHg7XG4gICAgICAgICAgICB0aGlzLnZlcnRpY2llc1tpbmRleCArIDUgXSA9IGQgKiBoMCArIGIgKiB3MCArIHR5O1xuXG4gICAgICAgICAgICB0aGlzLnZlcnRpY2llc1tpbmRleCArIDZdID0gIGEgKiB3MSArIGMgKiBoMCArIHR4O1xuICAgICAgICAgICAgdGhpcy52ZXJ0aWNpZXNbaW5kZXggKyA3XSA9ICBkICogaDAgKyBiICogdzEgKyB0eTtcblxuICAgICAgICAgICAgaWYoZGlzcGxheU9iamVjdC51cGRhdGVGcmFtZSB8fCBkaXNwbGF5T2JqZWN0LnRleHR1cmUudXBkYXRlRnJhbWUpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXJ0eVVWUyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB2YXIgdGV4dHVyZSA9IGRpc3BsYXlPYmplY3QudGV4dHVyZTtcblxuICAgICAgICAgICAgICAgIHZhciBmcmFtZSA9IHRleHR1cmUuZnJhbWU7XG4gICAgICAgICAgICAgICAgdmFyIHR3ID0gdGV4dHVyZS5iYXNlVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICB2YXIgdGggPSB0ZXh0dXJlLmJhc2VUZXh0dXJlLmhlaWdodDtcblxuICAgICAgICAgICAgICAgIHRoaXMudXZzW2luZGV4ICsgMF0gPSBmcmFtZS54IC8gdHc7XG4gICAgICAgICAgICAgICAgdGhpcy51dnNbaW5kZXggKzFdID0gZnJhbWUueSAvIHRoO1xuXG4gICAgICAgICAgICAgICAgdGhpcy51dnNbaW5kZXggKzJdID0gKGZyYW1lLnggKyBmcmFtZS53aWR0aCkgLyB0dztcbiAgICAgICAgICAgICAgICB0aGlzLnV2c1tpbmRleCArM10gPSBmcmFtZS55IC8gdGg7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnV2c1tpbmRleCArNF0gPSAoZnJhbWUueCArIGZyYW1lLndpZHRoKSAvIHR3O1xuICAgICAgICAgICAgICAgIHRoaXMudXZzW2luZGV4ICs1XSA9IChmcmFtZS55ICsgZnJhbWUuaGVpZ2h0KSAvIHRoO1xuXG4gICAgICAgICAgICAgICAgdGhpcy51dnNbaW5kZXggKzZdID0gZnJhbWUueCAvIHR3O1xuICAgICAgICAgICAgICAgIHRoaXMudXZzW2luZGV4ICs3XSA9IChmcmFtZS55ICsgZnJhbWUuaGVpZ2h0KSAvIHRoO1xuXG4gICAgICAgICAgICAgICAgZGlzcGxheU9iamVjdC51cGRhdGVGcmFtZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUT0RPIHRoaXMgcHJvYmFibHkgY291bGQgZG8gd2l0aCBzb21lIG9wdGltaXNhdGlvbi4uLi5cbiAgICAgICAgICAgIGlmKGRpc3BsYXlPYmplY3QuY2FjaGVBbHBoYSAhPSBkaXNwbGF5T2JqZWN0LndvcmxkQWxwaGEpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGlzcGxheU9iamVjdC5jYWNoZUFscGhhID0gZGlzcGxheU9iamVjdC53b3JsZEFscGhhO1xuXG4gICAgICAgICAgICAgICAgdmFyIGNvbG9ySW5kZXggPSBpbmRleFJ1biAqIDQ7XG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvcnNbY29sb3JJbmRleF0gPSB0aGlzLmNvbG9yc1tjb2xvckluZGV4ICsgMV0gPSB0aGlzLmNvbG9yc1tjb2xvckluZGV4ICsgMl0gPSB0aGlzLmNvbG9yc1tjb2xvckluZGV4ICsgM10gPSBkaXNwbGF5T2JqZWN0LndvcmxkQWxwaGE7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXJ0eUNvbG9ycyA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBpbmRleCA9IGluZGV4UnVuICogODtcblxuICAgICAgICAgICAgdGhpcy52ZXJ0aWNpZXNbaW5kZXggKyAwIF0gPSAwO1xuICAgICAgICAgICAgdGhpcy52ZXJ0aWNpZXNbaW5kZXggKyAxIF0gPSAwO1xuXG4gICAgICAgICAgICB0aGlzLnZlcnRpY2llc1tpbmRleCArIDIgXSA9IDA7XG4gICAgICAgICAgICB0aGlzLnZlcnRpY2llc1tpbmRleCArIDMgXSA9IDA7XG5cbiAgICAgICAgICAgIHRoaXMudmVydGljaWVzW2luZGV4ICsgNCBdID0gMDtcbiAgICAgICAgICAgIHRoaXMudmVydGljaWVzW2luZGV4ICsgNSBdID0gMDtcblxuICAgICAgICAgICAgdGhpcy52ZXJ0aWNpZXNbaW5kZXggKyA2XSA9IDA7XG4gICAgICAgICAgICB0aGlzLnZlcnRpY2llc1tpbmRleCArIDddID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGluZGV4UnVuKys7XG4gICAgICAgIGRpc3BsYXlPYmplY3QgPSBkaXNwbGF5T2JqZWN0Ll9fbmV4dDtcbiAgIH1cbn07XG5cbi8qKlxuICogRHJhd3MgdGhlIGJhdGNoIHRvIHRoZSBmcmFtZSBidWZmZXJcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclxuICovXG5wcm90by5yZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIoc3RhcnQsIGVuZClcbntcbiAgICBzdGFydCA9IHN0YXJ0IHx8IDA7XG5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIpIGVuZCA9IHRoaXMuc2l6ZTtcblxuICAgIGlmKHRoaXMuZGlydHkpXG4gICAge1xuICAgICAgICB0aGlzLnJlZnJlc2goKTtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5zaXplKSByZXR1cm47XG5cbiAgICB0aGlzLnVwZGF0ZSgpO1xuICAgIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgICAvL1RPRE8gb3B0aW1pemUgdGhpcyFcblxuICAgIHZhciBzaGFkZXJQcm9ncmFtID0gZ2xvYmFscy5zaGFkZXJQcm9ncmFtO1xuICAgIGdsLnVzZVByb2dyYW0oc2hhZGVyUHJvZ3JhbSk7XG5cbiAgICAvLyB1cGRhdGUgdGhlIHZlcnRzLi5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICAgIC8vIG9rLi5cbiAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdGhpcy52ZXJ0aWNpZXMpXG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXJQcm9ncmFtLnZlcnRleFBvc2l0aW9uQXR0cmlidXRlLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuICAgIC8vIHVwZGF0ZSB0aGUgdXZzXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudXZCdWZmZXIpO1xuXG4gICAgaWYodGhpcy5kaXJ0eVVWUylcbiAgICB7XG4gICAgICAgIHRoaXMuZGlydHlVVlMgPSBmYWxzZTtcbiAgICAgICAgZ2wuYnVmZmVyU3ViRGF0YShnbC5BUlJBWV9CVUZGRVIsICAwLCB0aGlzLnV2cyk7XG4gICAgfVxuXG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXJQcm9ncmFtLnRleHR1cmVDb29yZEF0dHJpYnV0ZSwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgIGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTApO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRoaXMudGV4dHVyZS5fZ2xUZXh0dXJlKTtcblxuICAgIC8vIHVwZGF0ZSBjb2xvciFcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy5jb2xvckJ1ZmZlcik7XG5cbiAgICBpZih0aGlzLmRpcnR5Q29sb3JzKVxuICAgIHtcbiAgICAgICAgdGhpcy5kaXJ0eUNvbG9ycyA9IGZhbHNlO1xuICAgICAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdGhpcy5jb2xvcnMpO1xuICAgIH1cblxuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyUHJvZ3JhbS5jb2xvckF0dHJpYnV0ZSwgMSwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgIC8vIGRvbnQgbmVlZCB0byB1cGxvYWQhXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgdGhpcy5pbmRleEJ1ZmZlcik7XG5cbiAgICB2YXIgbGVuID0gZW5kIC0gc3RhcnQ7XG5cbiAgICAvLyBEUkFXIFRIQVQgdGhpcyFcbiAgICBnbC5kcmF3RWxlbWVudHMoZ2wuVFJJQU5HTEVTLCBsZW4gKiA2LCBnbC5VTlNJR05FRF9TSE9SVCwgc3RhcnQgKiAyICogNiApO1xufTtcblxuLyoqXG4gKiBJbnRlcm5hbCBXZWJHTEJhdGNoIHBvb2xcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgYmF0Y2hlcyA9IFtdO1xuXG4vKipcbiAqIENhbGwgd2hlbiByZXN0b3JpbmcgYSBsb3N0IGNvbnRleHRcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHJlc3RvcmVCYXRjaGVzXG4gKiBAcmV0dXJuIHZvaWRcbiAqL1xuV2ViR0xCYXRjaC5yZXN0b3JlQmF0Y2hlcyA9IGZ1bmN0aW9uIHJlc3RvcmVCYXRjaGVzKGdsKVxue1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gYmF0Y2hlcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICBiYXRjaGVzW2ldLnJlc3RvcmVMb3N0Q29udGV4dChnbCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBHZXRzIGEgbmV3IFdlYkdMQmF0Y2ggZnJvbSB0aGUgcG9vbFxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZ2V0QmF0Y2hcbiAqIEByZXR1cm4ge1dlYkdMQmF0Y2h9XG4gKi9cbldlYkdMQmF0Y2guZ2V0QmF0Y2ggPSBmdW5jdGlvbiBnZXRCYXRjaCgpXG57XG4gICAgaWYgKCFiYXRjaGVzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYkdMQmF0Y2goZ2xvYmFscy5nbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGJhdGNoZXMucG9wKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBQdXRzIGEgYmF0Y2ggYmFjayBpbnRvIHRoZSBwb29sXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCByZXR1cm5CYXRjaFxuICogQHBhcmFtIGJhdGNoIHtXZWJHTEJhdGNofSBUaGUgYmF0Y2ggdG8gcmV0dXJuXG4gKi9cbldlYkdMQmF0Y2gucmV0dXJuQmF0Y2ggPSBmdW5jdGlvbiByZXR1cm5CYXRjaChiYXRjaClcbntcbiAgICBiYXRjaC5jbGVhbigpO1xuICAgIGJhdGNoZXMucHVzaChiYXRjaCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkdMQmF0Y2g7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgd2ViZ2xHcmFwaGljcyA9IHJlcXVpcmUoJy4vZ3JhcGhpY3MnKTtcbnZhciBXZWJHTEJhdGNoID0gcmVxdWlyZSgnLi9XZWJHTEJhdGNoJyk7XG52YXIgbWF0MyA9IHJlcXVpcmUoJy4uLy4uL2dlb20vbWF0cml4JykubWF0MztcblxudmFyIFRpbGluZ1Nwcml0ZSA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9UaWxpbmdTcHJpdGUnKTtcbnZhciBTdHJpcCA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9TdHJpcCcpO1xudmFyIEdyYXBoaWNzID0gcmVxdWlyZSgnLi4vLi4vcHJpbWl0aXZlcy9HcmFwaGljcycpO1xudmFyIEZpbHRlckJsb2NrID0gcmVxdWlyZSgnLi4vLi4vZmlsdGVycy9GaWx0ZXJCbG9jaycpO1xudmFyIFNwcml0ZSA9IHJlcXVpcmUoJy4uLy4uL2Rpc3BsYXkvU3ByaXRlJyk7XG52YXIgQ3VzdG9tUmVuZGVyYWJsZSA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9DdXN0b21SZW5kZXJhYmxlJyk7XG5cbi8qKlxuICogQSBXZWJHTEJhdGNoIEVuYWJsZXMgYSBncm91cCBvZiBzcHJpdGVzIHRvIGJlIGRyYXduIHVzaW5nIHRoZSBzYW1lIHNldHRpbmdzLlxuICogaWYgYSBncm91cCBvZiBzcHJpdGVzIGFsbCBoYXZlIHRoZSBzYW1lIGJhc2VUZXh0dXJlIGFuZCBibGVuZE1vZGUgdGhlbiB0aGV5IGNhbiBiZVxuICogZ3JvdXBlZCBpbnRvIGEgYmF0Y2guIEFsbCB0aGUgc3ByaXRlcyBpbiBhIGJhdGNoIGNhbiB0aGVuIGJlIGRyYXduIGluIG9uZSBnbyBieSB0aGVcbiAqIEdQVSB3aGljaCBpcyBodWdlbHkgZWZmaWNpZW50LiBBTEwgc3ByaXRlcyBpbiB0aGUgd2ViR0wgcmVuZGVyZXIgYXJlIGFkZGVkIHRvIGEgYmF0Y2hcbiAqIGV2ZW4gaWYgdGhlIGJhdGNoIG9ubHkgY29udGFpbnMgb25lIHNwcml0ZS4gQmF0Y2hpbmcgaXMgaGFuZGxlZCBhdXRvbWF0aWNhbGx5IGJ5IHRoZVxuICogd2ViR0wgcmVuZGVyZXIuIEEgZ29vZCB0aXAgaXM6IHRoZSBzbWFsbGVyIHRoZSBudW1iZXIgb2YgYmF0Y2hzIHRoZXJlIGFyZSwgdGhlIGZhc3RlclxuICogdGhlIHdlYkdMIHJlbmRlcmVyIHdpbGwgcnVuLlxuICpcbiAqIEBjbGFzcyBXZWJHTEJhdGNoXG4gKiBAY29udHJ1Y3RvclxuICogQHBhcmFtIGdsIHtXZWJHTENvbnRleHR9IEFuIGluc3RhbmNlIG9mIHRoZSB3ZWJHTCBjb250ZXh0XG4gKi9cbmZ1bmN0aW9uIFdlYkdMUmVuZGVyR3JvdXAoZ2wpXG57XG4gICAgdGhpcy5nbCA9IGdsO1xuICAgIHRoaXMucm9vdCA9IG51bGw7XG4gICAgLy8gdGhpcy5iYWNrZ3JvdW5kQ29sb3IgPSBudWxsO1xuICAgIHRoaXMuYmF0Y2hzID0gW107XG4gICAgdGhpcy50b1JlbW92ZSA9IFtdO1xufVxuXG52YXIgcHJvdG8gPSBXZWJHTFJlbmRlckdyb3VwLnByb3RvdHlwZTtcblxuLyoqXG4gKiBBZGQgYSBkaXNwbGF5IG9iamVjdCB0byB0aGUgd2ViZ2wgcmVuZGVyZXJcbiAqXG4gKiBAbWV0aG9kIHNldFJlbmRlcmFibGVcbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uc2V0UmVuZGVyYWJsZSA9IGZ1bmN0aW9uIHNldFJlbmRlcmFibGUoZGlzcGxheU9iamVjdClcbntcbiAgICAvLyBoYXMgdGhpcyBjaGFuZ2VkPz9cbiAgICBpZih0aGlzLnJvb3QpdGhpcy5yZW1vdmVEaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4odGhpcy5yb290KTtcblxuICAgIGRpc3BsYXlPYmplY3Qud29ybGRWaXNpYmxlID0gZGlzcGxheU9iamVjdC52aXNpYmxlO1xuXG4gICAgLy8gc29vb29vbyAvL1xuICAgIC8vIHRvIGNoZWNrIGlmIGFueSBiYXRjaHMgZXhpc3QgYWxyZWFkeT8/XG5cbiAgICAvLyBUT0RPIHdoYXQgaWYgaXRzIGFscmVhZHkgaGFzIGFuIG9iamVjdD8gc2hvdWxkIHJlbW92ZSBpdFxuICAgIHRoaXMucm9vdCA9IGRpc3BsYXlPYmplY3Q7XG4gICAgdGhpcy5hZGREaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4oZGlzcGxheU9iamVjdCk7XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgdGhlIHN0YWdlIHRvIGl0cyB3ZWJnbCB2aWV3XG4gKlxuICogQG1ldGhvZCByZW5kZXJcbiAqIEBwYXJhbSBwcm9qZWN0aW9uIHtPYmplY3R9XG4gKi9cbnByb3RvLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcihwcm9qZWN0aW9uKVxue1xuICAgIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgICBXZWJHTFJlbmRlckdyb3VwLnVwZGF0ZVRleHR1cmVzKGdsKTtcblxuICAgIGdsLnVuaWZvcm0yZihnbG9iYWxzLnNoYWRlclByb2dyYW0ucHJvamVjdGlvblZlY3RvciwgcHJvamVjdGlvbi54LCBwcm9qZWN0aW9uLnkpO1xuICAgIGdsLmJsZW5kRnVuYyhnbC5PTkUsIGdsLk9ORV9NSU5VU19TUkNfQUxQSEEpO1xuXG4gICAgLy8gd2lsbCByZW5kZXIgYWxsIHRoZSBlbGVtZW50cyBpbiB0aGUgZ3JvdXBcbiAgICB2YXIgcmVuZGVyYWJsZTtcblxuICAgIGZvciAodmFyIGk9MDsgaSA8IHRoaXMuYmF0Y2hzLmxlbmd0aDsgaSsrKVxuICAgIHtcblxuICAgICAgICByZW5kZXJhYmxlID0gdGhpcy5iYXRjaHNbaV07XG4gICAgICAgIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBXZWJHTEJhdGNoKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmJhdGNoc1tpXS5yZW5kZXIoKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm9uIHNwcml0ZSBiYXRjaC4uXG4gICAgICAgIHZhciB3b3JsZFZpc2libGUgPSByZW5kZXJhYmxlLnZjb3VudCA9PT0gZ2xvYmFscy52aXNpYmxlQ291bnQ7XG5cbiAgICAgICAgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIFRpbGluZ1Nwcml0ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgaWYod29ybGRWaXNpYmxlKXRoaXMucmVuZGVyVGlsaW5nU3ByaXRlKHJlbmRlcmFibGUsIHByb2plY3Rpb24pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIFN0cmlwKVxuICAgICAgICB7XG4gICAgICAgICAgICBpZih3b3JsZFZpc2libGUpdGhpcy5yZW5kZXJTdHJpcChyZW5kZXJhYmxlLCBwcm9qZWN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBHcmFwaGljcylcbiAgICAgICAge1xuICAgICAgICAgICAgaWYod29ybGRWaXNpYmxlICYmIHJlbmRlcmFibGUucmVuZGVyYWJsZSkgd2ViZ2xHcmFwaGljcy5yZW5kZXJHcmFwaGljcyhyZW5kZXJhYmxlLCBwcm9qZWN0aW9uKTsvLywgcHJvamVjdGlvbk1hdHJpeCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihyZW5kZXJhYmxlIGluc3RhbmNlb2YgRmlsdGVyQmxvY2spXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgKiBmb3Igbm93IG9ubHkgbWFza3MgYXJlIHN1cHBvcnRlZC4uXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmKHJlbmRlcmFibGUub3BlbilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuU1RFTkNJTF9URVNUKTtcblxuICAgICAgICAgICAgICAgIGdsLmNvbG9yTWFzayhmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuQUxXQVlTLDEsMHhmZik7XG4gICAgICAgICAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsZ2wuS0VFUCxnbC5SRVBMQUNFKTtcblxuICAgICAgICAgICAgICAgIHdlYmdsR3JhcGhpY3MucmVuZGVyR3JhcGhpY3MocmVuZGVyYWJsZS5tYXNrLCBwcm9qZWN0aW9uKTtcblxuICAgICAgICAgICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICBnbC5zdGVuY2lsRnVuYyhnbC5OT1RFUVVBTCwwLDB4ZmYpO1xuICAgICAgICAgICAgICAgIGdsLnN0ZW5jaWxPcChnbC5LRUVQLGdsLktFRVAsZ2wuS0VFUCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBSZW5kZXJzIHRoZSBzdGFnZSB0byBpdHMgd2ViZ2wgdmlld1xuICpcbiAqIEBtZXRob2QgaGFuZGxlRmlsdGVyXG4gKiBAcGFyYW0gZmlsdGVyIHtGaWx0ZXJCbG9ja31cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmhhbmRsZUZpbHRlciA9IGZ1bmN0aW9uIGhhbmRsZUZpbHRlcihmaWx0ZXIsIHByb2plY3Rpb24pXG57XG5cbn07XG5cbi8qKlxuICogUmVuZGVycyBhIHNwZWNpZmljIGRpc3BsYXlPYmplY3RcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclNwZWNpZmljXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH1cbiAqIEBwYXJhbSBwcm9qZWN0aW9uIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJTcGVjaWZpYyA9IGZ1bmN0aW9uIHJlbmRlclNwZWNpZmljKGRpc3BsYXlPYmplY3QsIHByb2plY3Rpb24pXG57XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIFdlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZXMoZ2wpO1xuXG4gICAgZ2wudW5pZm9ybTJmKGdsb2JhbHMuc2hhZGVyUHJvZ3JhbS5wcm9qZWN0aW9uVmVjdG9yLCBwcm9qZWN0aW9uLngsIHByb2plY3Rpb24ueSk7XG5cbiAgICAvLyB0byBkbyFcbiAgICAvLyByZW5kZXIgcGFydCBvZiB0aGUgc2NlbmUuLi5cblxuICAgIHZhciBzdGFydEluZGV4LCBzdGFydEJhdGNoSW5kZXgsXG4gICAgICAgIGVuZEluZGV4LCBlbmRCYXRjaEluZGV4LFxuICAgICAgICBoZWFkLCBuZXh0O1xuXG4gICAgLypcbiAgICAgKiAgTE9PSyBGT1IgVEhFIE5FWFQgU1BSSVRFXG4gICAgICogIFRoaXMgcGFydCBsb29rcyBmb3IgdGhlIGNsb3Nlc3QgbmV4dCBzcHJpdGUgdGhhdCBjYW4gZ28gaW50byBhIGJhdGNoXG4gICAgICogIGl0IGtlZXBzIGxvb2tpbmcgdW50aWwgaXQgZmluZHMgYSBzcHJpdGUgb3IgZ2V0cyB0byB0aGUgZW5kIG9mIHRoZSBkaXNwbGF5XG4gICAgICogIHNjZW5lIGdyYXBoXG4gICAgICovXG4gICAgdmFyIG5leHRSZW5kZXJhYmxlID0gZGlzcGxheU9iamVjdC5maXJzdDtcbiAgICB3aGlsZShuZXh0UmVuZGVyYWJsZS5faU5leHQpXG4gICAge1xuICAgICAgICBuZXh0UmVuZGVyYWJsZSA9IG5leHRSZW5kZXJhYmxlLl9pTmV4dDtcbiAgICAgICAgaWYobmV4dFJlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBuZXh0UmVuZGVyYWJsZS5fX3JlbmRlckdyb3VwKWJyZWFrO1xuICAgIH1cbiAgICB2YXIgc3RhcnRCYXRjaCA9IG5leHRSZW5kZXJhYmxlLmJhdGNoO1xuXG4gICAgaWYobmV4dFJlbmRlcmFibGUgaW5zdGFuY2VvZiBTcHJpdGUpXG4gICAge1xuICAgICAgICBzdGFydEJhdGNoID0gbmV4dFJlbmRlcmFibGUuYmF0Y2g7XG5cbiAgICAgICAgaGVhZCA9IHN0YXJ0QmF0Y2guaGVhZDtcbiAgICAgICAgbmV4dCA9IGhlYWQ7XG5cbiAgICAgICAgLy8gb2sgbm93IHdlIGhhdmUgdGhlIGJhdGNoLi4gbmVlZCB0byBmaW5kIHRoZSBzdGFydCBpbmRleCFcbiAgICAgICAgaWYoaGVhZCA9PSBuZXh0UmVuZGVyYWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhcnRJbmRleCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBzdGFydEluZGV4ID0gMTtcblxuICAgICAgICAgICAgd2hpbGUoaGVhZC5fX25leHQgIT0gbmV4dFJlbmRlcmFibGUpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgc3RhcnRJbmRleCsrO1xuICAgICAgICAgICAgICAgIGhlYWQgPSBoZWFkLl9fbmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBzdGFydEJhdGNoID0gbmV4dFJlbmRlcmFibGU7XG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBMQVNUIHJlbmRlcmFibGUgb2JqZWN0XG4gICAgdmFyIGxhc3RSZW5kZXJhYmxlID0gZGlzcGxheU9iamVjdDtcbiAgICB2YXIgZW5kQmF0Y2g7XG4gICAgdmFyIGxhc3RJdGVtID0gZGlzcGxheU9iamVjdDtcbiAgICB3aGlsZShsYXN0SXRlbS5jaGlsZHJlbi5sZW5ndGggPiAwKVxuICAgIHtcbiAgICAgICAgbGFzdEl0ZW0gPSBsYXN0SXRlbS5jaGlsZHJlbltsYXN0SXRlbS5jaGlsZHJlbi5sZW5ndGgtMV07XG4gICAgICAgIGlmKGxhc3RJdGVtLnJlbmRlcmFibGUpbGFzdFJlbmRlcmFibGUgPSBsYXN0SXRlbTtcbiAgICB9XG5cbiAgICBpZihsYXN0UmVuZGVyYWJsZSBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICB7XG4gICAgICAgIGVuZEJhdGNoID0gbGFzdFJlbmRlcmFibGUuYmF0Y2g7XG5cbiAgICAgICAgaGVhZCA9IGVuZEJhdGNoLmhlYWQ7XG5cbiAgICAgICAgaWYoaGVhZCA9PSBsYXN0UmVuZGVyYWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgZW5kSW5kZXggPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgZW5kSW5kZXggPSAxO1xuXG4gICAgICAgICAgICB3aGlsZShoZWFkLl9fbmV4dCAhPSBsYXN0UmVuZGVyYWJsZSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBlbmRJbmRleCsrO1xuICAgICAgICAgICAgICAgIGhlYWQgPSBoZWFkLl9fbmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBlbmRCYXRjaCA9IGxhc3RSZW5kZXJhYmxlO1xuICAgIH1cblxuICAgIC8vIFRPRE8gLSBuZWVkIHRvIGZvbGQgdGhpcyB1cCBhIGJpdCFcblxuICAgIGlmKHN0YXJ0QmF0Y2ggPT0gZW5kQmF0Y2gpXG4gICAge1xuICAgICAgICBpZihzdGFydEJhdGNoIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhcnRCYXRjaC5yZW5kZXIoc3RhcnRJbmRleCwgZW5kSW5kZXgrMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclNwZWNpYWwoc3RhcnRCYXRjaCwgcHJvamVjdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIG5vdyB3ZSBoYXZlIGZpcnN0IGFuZCBsYXN0IVxuICAgIHN0YXJ0QmF0Y2hJbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2Yoc3RhcnRCYXRjaCk7XG4gICAgZW5kQmF0Y2hJbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoZW5kQmF0Y2gpO1xuXG4gICAgLy8gRE8gdGhlIGZpcnN0IGJhdGNoXG4gICAgaWYoc3RhcnRCYXRjaCBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpXG4gICAge1xuICAgICAgICBzdGFydEJhdGNoLnJlbmRlcihzdGFydEluZGV4KTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5yZW5kZXJTcGVjaWFsKHN0YXJ0QmF0Y2gsIHByb2plY3Rpb24pO1xuICAgIH1cblxuICAgIC8vIERPIHRoZSBtaWRkbGUgYmF0Y2hzLi5cbiAgICB2YXIgcmVuZGVyYWJsZTtcbiAgICBmb3IgKHZhciBpPXN0YXJ0QmF0Y2hJbmRleCsxOyBpIDwgZW5kQmF0Y2hJbmRleDsgaSsrKVxuICAgIHtcbiAgICAgICAgcmVuZGVyYWJsZSA9IHRoaXMuYmF0Y2hzW2ldO1xuXG4gICAgICAgIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBXZWJHTEJhdGNoKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmJhdGNoc1tpXS5yZW5kZXIoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyU3BlY2lhbChyZW5kZXJhYmxlLCBwcm9qZWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIERPIHRoZSBsYXN0IGJhdGNoLi5cbiAgICBpZihlbmRCYXRjaCBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpXG4gICAge1xuICAgICAgICBlbmRCYXRjaC5yZW5kZXIoMCwgZW5kSW5kZXgrMSk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMucmVuZGVyU3BlY2lhbChlbmRCYXRjaCwgcHJvamVjdGlvbik7XG4gICAgfVxufTtcblxuLyoqXG4gKiBSZW5kZXJzIGEgc3BlY2lmaWMgcmVuZGVyYWJsZVxuICpcbiAqIEBtZXRob2QgcmVuZGVyU3BlY2lhbFxuICogQHBhcmFtIHJlbmRlcmFibGUge0Rpc3BsYXlPYmplY3R9XG4gKiBAcGFyYW0gcHJvamVjdGlvbiB7T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyU3BlY2lhbCA9IGZ1bmN0aW9uIHJlbmRlclNwZWNpYWwocmVuZGVyYWJsZSwgcHJvamVjdGlvbilcbntcbiAgICB2YXIgd29ybGRWaXNpYmxlID0gcmVuZGVyYWJsZS52Y291bnQgPT09IGdsb2JhbHMudmlzaWJsZUNvdW50O1xuXG4gICAgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIFRpbGluZ1Nwcml0ZSlcbiAgICB7XG4gICAgICAgIGlmKHdvcmxkVmlzaWJsZSl0aGlzLnJlbmRlclRpbGluZ1Nwcml0ZShyZW5kZXJhYmxlLCBwcm9qZWN0aW9uKTtcbiAgICB9XG4gICAgZWxzZSBpZihyZW5kZXJhYmxlIGluc3RhbmNlb2YgU3RyaXApXG4gICAge1xuICAgICAgICBpZih3b3JsZFZpc2libGUpdGhpcy5yZW5kZXJTdHJpcChyZW5kZXJhYmxlLCBwcm9qZWN0aW9uKTtcbiAgICB9XG4gICAgZWxzZSBpZihyZW5kZXJhYmxlIGluc3RhbmNlb2YgQ3VzdG9tUmVuZGVyYWJsZSlcbiAgICB7XG4gICAgICAgIGlmKHdvcmxkVmlzaWJsZSkgcmVuZGVyYWJsZS5yZW5kZXJXZWJHTCh0aGlzLCBwcm9qZWN0aW9uKTtcbiAgICB9XG4gICAgZWxzZSBpZihyZW5kZXJhYmxlIGluc3RhbmNlb2YgR3JhcGhpY3MpXG4gICAge1xuICAgICAgICBpZih3b3JsZFZpc2libGUgJiYgcmVuZGVyYWJsZS5yZW5kZXJhYmxlKSB3ZWJnbEdyYXBoaWNzLnJlbmRlckdyYXBoaWNzKHJlbmRlcmFibGUsIHByb2plY3Rpb24pO1xuICAgIH1cbiAgICBlbHNlIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBGaWx0ZXJCbG9jaylcbiAgICB7XG4gICAgICAgIC8qXG4gICAgICAgICAqIGZvciBub3cgb25seSBtYXNrcyBhcmUgc3VwcG9ydGVkLi5cbiAgICAgICAgICovXG4gICAgICAgIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgaWYocmVuZGVyYWJsZS5vcGVuKVxuICAgICAgICB7XG4gICAgICAgICAgICBnbC5lbmFibGUoZ2wuU1RFTkNJTF9URVNUKTtcblxuICAgICAgICAgICAgZ2wuY29sb3JNYXNrKGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jKGdsLkFMV0FZUywxLDB4ZmYpO1xuICAgICAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsZ2wuS0VFUCxnbC5SRVBMQUNFKTtcblxuICAgICAgICAgICAgd2ViZ2xHcmFwaGljcy5yZW5kZXJHcmFwaGljcyhyZW5kZXJhYmxlLm1hc2ssIHByb2plY3Rpb24pO1xuXG4gICAgICAgICAgICAvLyB3ZSBrbm93IHRoaXMgaXMgYSByZW5kZXIgdGV4dHVyZSBzbyBlbmFibGUgYWxwaGEgdG9vLi5cbiAgICAgICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jKGdsLk5PVEVRVUFMLDAsMHhmZik7XG4gICAgICAgICAgICBnbC5zdGVuY2lsT3AoZ2wuS0VFUCxnbC5LRUVQLGdsLktFRVApO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBVcGRhdGVzIGEgd2ViZ2wgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgdXBkYXRlVGV4dHVyZVxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUZXh0dXJlID0gZnVuY3Rpb24gdXBkYXRlVGV4dHVyZShkaXNwbGF5T2JqZWN0KVxue1xuXG4gICAgLy8gVE9ETyBkZWZpbml0ZWx5IGNhbiBvcHRpbXNlIHRoaXMgZnVuY3Rpb24uLlxuXG4gICAgdGhpcy5yZW1vdmVPYmplY3QoZGlzcGxheU9iamVjdCk7XG5cbiAgICAvKlxuICAgICAqICBMT09LIEZPUiBUSEUgUFJFVklPVVMgUkVOREVSQUJMRVxuICAgICAqICBUaGlzIHBhcnQgbG9va3MgZm9yIHRoZSBjbG9zZXN0IHByZXZpb3VzIHNwcml0ZSB0aGF0IGNhbiBnbyBpbnRvIGEgYmF0Y2hcbiAgICAgKiAgSXQga2VlcHMgZ29pbmcgYmFjayB1bnRpbCBpdCBmaW5kcyBhIHNwcml0ZSBvciB0aGUgc3RhZ2VcbiAgICAgKi9cbiAgICB2YXIgcHJldmlvdXNSZW5kZXJhYmxlID0gZGlzcGxheU9iamVjdC5maXJzdDtcbiAgICB3aGlsZShwcmV2aW91c1JlbmRlcmFibGUgIT0gdGhpcy5yb290KVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNSZW5kZXJhYmxlID0gcHJldmlvdXNSZW5kZXJhYmxlLl9pUHJldjtcbiAgICAgICAgaWYocHJldmlvdXNSZW5kZXJhYmxlLnJlbmRlcmFibGUgJiYgcHJldmlvdXNSZW5kZXJhYmxlLl9fcmVuZGVyR3JvdXApYnJlYWs7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiAgTE9PSyBGT1IgVEhFIE5FWFQgU1BSSVRFXG4gICAgICogIFRoaXMgcGFydCBsb29rcyBmb3IgdGhlIGNsb3Nlc3QgbmV4dCBzcHJpdGUgdGhhdCBjYW4gZ28gaW50byBhIGJhdGNoXG4gICAgICogIGl0IGtlZXBzIGxvb2tpbmcgdW50aWwgaXQgZmluZHMgYSBzcHJpdGUgb3IgZ2V0cyB0byB0aGUgZW5kIG9mIHRoZSBkaXNwbGF5XG4gICAgICogIHNjZW5lIGdyYXBoXG4gICAgICovXG4gICAgdmFyIG5leHRSZW5kZXJhYmxlID0gZGlzcGxheU9iamVjdC5sYXN0O1xuICAgIHdoaWxlKG5leHRSZW5kZXJhYmxlLl9pTmV4dClcbiAgICB7XG4gICAgICAgIG5leHRSZW5kZXJhYmxlID0gbmV4dFJlbmRlcmFibGUuX2lOZXh0O1xuICAgICAgICBpZihuZXh0UmVuZGVyYWJsZS5yZW5kZXJhYmxlICYmIG5leHRSZW5kZXJhYmxlLl9fcmVuZGVyR3JvdXApYnJlYWs7XG4gICAgfVxuXG4gICAgdGhpcy5pbnNlcnRPYmplY3QoZGlzcGxheU9iamVjdCwgcHJldmlvdXNSZW5kZXJhYmxlLCBuZXh0UmVuZGVyYWJsZSk7XG59O1xuXG4vKipcbiAqIEFkZHMgZmlsdGVyIGJsb2Nrc1xuICpcbiAqIEBtZXRob2QgYWRkRmlsdGVyQmxvY2tzXG4gKiBAcGFyYW0gc3RhcnQge0ZpbHRlckJsb2NrfVxuICogQHBhcmFtIGVuZCB7RmlsdGVyQmxvY2t9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5hZGRGaWx0ZXJCbG9ja3MgPSBmdW5jdGlvbiBhZGRGaWx0ZXJCbG9ja3Moc3RhcnQsIGVuZClcbntcbiAgICBzdGFydC5fX3JlbmRlckdyb3VwID0gdGhpcztcbiAgICBlbmQuX19yZW5kZXJHcm91cCA9IHRoaXM7XG4gICAgLypcbiAgICAgKiAgTE9PSyBGT1IgVEhFIFBSRVZJT1VTIFJFTkRFUkFCTEVcbiAgICAgKiAgVGhpcyBwYXJ0IGxvb2tzIGZvciB0aGUgY2xvc2VzdCBwcmV2aW91cyBzcHJpdGUgdGhhdCBjYW4gZ28gaW50byBhIGJhdGNoXG4gICAgICogIEl0IGtlZXBzIGdvaW5nIGJhY2sgdW50aWwgaXQgZmluZHMgYSBzcHJpdGUgb3IgdGhlIHN0YWdlXG4gICAgICovXG4gICAgdmFyIHByZXZpb3VzUmVuZGVyYWJsZSA9IHN0YXJ0O1xuICAgIHdoaWxlKHByZXZpb3VzUmVuZGVyYWJsZSAhPSB0aGlzLnJvb3QpXG4gICAge1xuICAgICAgICBwcmV2aW91c1JlbmRlcmFibGUgPSBwcmV2aW91c1JlbmRlcmFibGUuX2lQcmV2O1xuICAgICAgICBpZihwcmV2aW91c1JlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBwcmV2aW91c1JlbmRlcmFibGUuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG4gICAgdGhpcy5pbnNlcnRBZnRlcihzdGFydCwgcHJldmlvdXNSZW5kZXJhYmxlKTtcblxuICAgIC8qXG4gICAgICogIExPT0sgRk9SIFRIRSBORVhUIFNQUklURVxuICAgICAqICBUaGlzIHBhcnQgbG9va3MgZm9yIHRoZSBjbG9zZXN0IG5leHQgc3ByaXRlIHRoYXQgY2FuIGdvIGludG8gYSBiYXRjaFxuICAgICAqICBpdCBrZWVwcyBsb29raW5nIHVudGlsIGl0IGZpbmRzIGEgc3ByaXRlIG9yIGdldHMgdG8gdGhlIGVuZCBvZiB0aGUgZGlzcGxheVxuICAgICAqICBzY2VuZSBncmFwaFxuICAgICAqL1xuICAgIHZhciBwcmV2aW91c1JlbmRlcmFibGUyID0gZW5kO1xuICAgIHdoaWxlKHByZXZpb3VzUmVuZGVyYWJsZTIgIT0gdGhpcy5yb290KVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNSZW5kZXJhYmxlMiA9IHByZXZpb3VzUmVuZGVyYWJsZTIuX2lQcmV2O1xuICAgICAgICBpZihwcmV2aW91c1JlbmRlcmFibGUyLnJlbmRlcmFibGUgJiYgcHJldmlvdXNSZW5kZXJhYmxlMi5fX3JlbmRlckdyb3VwKWJyZWFrO1xuICAgIH1cbiAgICB0aGlzLmluc2VydEFmdGVyKGVuZCwgcHJldmlvdXNSZW5kZXJhYmxlMik7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBmaWx0ZXIgYmxvY2tzXG4gKlxuICogQG1ldGhvZCByZW1vdmVGaWx0ZXJCbG9ja3NcbiAqIEBwYXJhbSBzdGFydCB7RmlsdGVyQmxvY2t9XG4gKiBAcGFyYW0gZW5kIHtGaWx0ZXJCbG9ja31cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbW92ZUZpbHRlckJsb2NrcyA9IGZ1bmN0aW9uIHJlbW92ZUZpbHRlckJsb2NrcyhzdGFydCwgZW5kKVxue1xuICAgIHRoaXMucmVtb3ZlT2JqZWN0KHN0YXJ0KTtcbiAgICB0aGlzLnJlbW92ZU9iamVjdChlbmQpO1xufTtcblxuLyoqXG4gKiBBZGRzIGEgZGlzcGxheSBvYmplY3QgYW5kIGNoaWxkcmVuIHRvIHRoZSB3ZWJnbCBjb250ZXh0XG4gKlxuICogQG1ldGhvZCBhZGREaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW5cbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uYWRkRGlzcGxheU9iamVjdEFuZENoaWxkcmVuID0gZnVuY3Rpb24gYWRkRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGRpc3BsYXlPYmplY3QpXG57XG4gICAgaWYoZGlzcGxheU9iamVjdC5fX3JlbmRlckdyb3VwKWRpc3BsYXlPYmplY3QuX19yZW5kZXJHcm91cC5yZW1vdmVEaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4oZGlzcGxheU9iamVjdCk7XG5cbiAgICAvKlxuICAgICAqICBMT09LIEZPUiBUSEUgUFJFVklPVVMgUkVOREVSQUJMRVxuICAgICAqICBUaGlzIHBhcnQgbG9va3MgZm9yIHRoZSBjbG9zZXN0IHByZXZpb3VzIHNwcml0ZSB0aGF0IGNhbiBnbyBpbnRvIGEgYmF0Y2hcbiAgICAgKiAgSXQga2VlcHMgZ29pbmcgYmFjayB1bnRpbCBpdCBmaW5kcyBhIHNwcml0ZSBvciB0aGUgc3RhZ2VcbiAgICAgKi9cblxuICAgIHZhciBwcmV2aW91c1JlbmRlcmFibGUgPSBkaXNwbGF5T2JqZWN0LmZpcnN0O1xuICAgIHdoaWxlKHByZXZpb3VzUmVuZGVyYWJsZSAhPSB0aGlzLnJvb3QuZmlyc3QpXG4gICAge1xuICAgICAgICBwcmV2aW91c1JlbmRlcmFibGUgPSBwcmV2aW91c1JlbmRlcmFibGUuX2lQcmV2O1xuICAgICAgICBpZihwcmV2aW91c1JlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBwcmV2aW91c1JlbmRlcmFibGUuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG5cbiAgICAvKlxuICAgICAqICBMT09LIEZPUiBUSEUgTkVYVCBTUFJJVEVcbiAgICAgKiAgVGhpcyBwYXJ0IGxvb2tzIGZvciB0aGUgY2xvc2VzdCBuZXh0IHNwcml0ZSB0aGF0IGNhbiBnbyBpbnRvIGEgYmF0Y2hcbiAgICAgKiAgaXQga2VlcHMgbG9va2luZyB1bnRpbCBpdCBmaW5kcyBhIHNwcml0ZSBvciBnZXRzIHRvIHRoZSBlbmQgb2YgdGhlIGRpc3BsYXlcbiAgICAgKiAgc2NlbmUgZ3JhcGhcbiAgICAgKi9cbiAgICB2YXIgbmV4dFJlbmRlcmFibGUgPSBkaXNwbGF5T2JqZWN0Lmxhc3Q7XG4gICAgd2hpbGUobmV4dFJlbmRlcmFibGUuX2lOZXh0KVxuICAgIHtcbiAgICAgICAgbmV4dFJlbmRlcmFibGUgPSBuZXh0UmVuZGVyYWJsZS5faU5leHQ7XG4gICAgICAgIGlmKG5leHRSZW5kZXJhYmxlLnJlbmRlcmFibGUgJiYgbmV4dFJlbmRlcmFibGUuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG5cbiAgICAvLyBvbmUgdGhlIGRpc3BsYXkgb2JqZWN0IGhpdHMgdGhpcy4gd2UgY2FuIGJyZWFrIHRoZSBsb29wXG5cbiAgICB2YXIgdGVtcE9iamVjdCA9IGRpc3BsYXlPYmplY3QuZmlyc3Q7XG4gICAgdmFyIHRlc3RPYmplY3QgPSBkaXNwbGF5T2JqZWN0Lmxhc3QuX2lOZXh0O1xuICAgIGRvXG4gICAge1xuICAgICAgICB0ZW1wT2JqZWN0Ll9fcmVuZGVyR3JvdXAgPSB0aGlzO1xuXG4gICAgICAgIGlmKHRlbXBPYmplY3QucmVuZGVyYWJsZSlcbiAgICAgICAge1xuXG4gICAgICAgICAgICB0aGlzLmluc2VydE9iamVjdCh0ZW1wT2JqZWN0LCBwcmV2aW91c1JlbmRlcmFibGUsIG5leHRSZW5kZXJhYmxlKTtcbiAgICAgICAgICAgIHByZXZpb3VzUmVuZGVyYWJsZSA9IHRlbXBPYmplY3Q7XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wT2JqZWN0ID0gdGVtcE9iamVjdC5faU5leHQ7XG4gICAgfVxuICAgIHdoaWxlKHRlbXBPYmplY3QgIT0gdGVzdE9iamVjdClcbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhIGRpc3BsYXkgb2JqZWN0IGFuZCBjaGlsZHJlbiB0byB0aGUgd2ViZ2wgY29udGV4dFxuICpcbiAqIEBtZXRob2QgcmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlbiA9IGZ1bmN0aW9uIHJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihkaXNwbGF5T2JqZWN0KVxue1xuICAgIGlmKGRpc3BsYXlPYmplY3QuX19yZW5kZXJHcm91cCAhPSB0aGlzKXJldHVybjtcblxuLy8gIHZhciBkaXNwbGF5T2JqZWN0ID0gZGlzcGxheU9iamVjdC5maXJzdDtcbiAgICB2YXIgbGFzdE9iamVjdCA9IGRpc3BsYXlPYmplY3QubGFzdDtcbiAgICBkb1xuICAgIHtcbiAgICAgICAgZGlzcGxheU9iamVjdC5fX3JlbmRlckdyb3VwID0gbnVsbDtcbiAgICAgICAgaWYoZGlzcGxheU9iamVjdC5yZW5kZXJhYmxlKXRoaXMucmVtb3ZlT2JqZWN0KGRpc3BsYXlPYmplY3QpO1xuICAgICAgICBkaXNwbGF5T2JqZWN0ID0gZGlzcGxheU9iamVjdC5faU5leHQ7XG4gICAgfVxuICAgIHdoaWxlKGRpc3BsYXlPYmplY3QpXG59O1xuXG4vKipcbiAqIEluc2VydHMgYSBkaXNwbGF5T2JqZWN0IGludG8gdGhlIGxpbmtlZCBsaXN0XG4gKlxuICogQG1ldGhvZCBpbnNlcnRPYmplY3RcbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fVxuICogQHBhcmFtIHByZXZpb3VzT2JqZWN0IHtEaXNwbGF5T2JqZWN0fVxuICogQHBhcmFtIG5leHRPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5pbnNlcnRPYmplY3QgPSBmdW5jdGlvbiBpbnNlcnRPYmplY3QoZGlzcGxheU9iamVjdCwgcHJldmlvdXNPYmplY3QsIG5leHRPYmplY3QpXG57XG4gICAgLy8gd2hpbGUgbG9vcGluZyBiZWxvdyBUSEUgT0JKRUNUIE1BWSBOT1QgSEFWRSBCRUVOIEFEREVEXG4gICAgdmFyIHByZXZpb3VzU3ByaXRlID0gcHJldmlvdXNPYmplY3QsXG4gICAgICAgIG5leHRTcHJpdGUgPSBuZXh0T2JqZWN0LFxuICAgICAgICBiYXRjaCwgaW5kZXg7XG5cbiAgICAvKlxuICAgICAqIHNvIG5vdyB3ZSBoYXZlIHRoZSBuZXh0IHJlbmRlcmFibGUgYW5kIHRoZSBwcmV2aW91cyByZW5kZXJhYmxlXG4gICAgICpcbiAgICAgKi9cbiAgICBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3ByaXRlKVxuICAgIHtcbiAgICAgICAgdmFyIHByZXZpb3VzQmF0Y2gsIG5leHRCYXRjaDtcblxuICAgICAgICBpZihwcmV2aW91c1Nwcml0ZSBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgcHJldmlvdXNCYXRjaCA9IHByZXZpb3VzU3ByaXRlLmJhdGNoO1xuICAgICAgICAgICAgaWYocHJldmlvdXNCYXRjaClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihwcmV2aW91c0JhdGNoLnRleHR1cmUgPT0gZGlzcGxheU9iamVjdC50ZXh0dXJlLmJhc2VUZXh0dXJlICYmIHByZXZpb3VzQmF0Y2guYmxlbmRNb2RlID09IGRpc3BsYXlPYmplY3QuYmxlbmRNb2RlKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNCYXRjaC5pbnNlcnRBZnRlcihkaXNwbGF5T2JqZWN0LCBwcmV2aW91c1Nwcml0ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBUT0RPIHJld29yZCFcbiAgICAgICAgICAgIHByZXZpb3VzQmF0Y2ggPSBwcmV2aW91c1Nwcml0ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG5leHRTcHJpdGUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKG5leHRTcHJpdGUgaW5zdGFuY2VvZiBTcHJpdGUpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmV4dEJhdGNoID0gbmV4dFNwcml0ZS5iYXRjaDtcblxuICAgICAgICAgICAgICAgIC8vYmF0Y2ggbWF5IG5vdCBleGlzdCBpZiBpdGVtIHdhcyBhZGRlZCB0byB0aGUgZGlzcGxheSBsaXN0IGJ1dCBub3QgdG8gdGhlIHdlYkdMXG4gICAgICAgICAgICAgICAgaWYobmV4dEJhdGNoKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaWYobmV4dEJhdGNoLnRleHR1cmUgPT0gZGlzcGxheU9iamVjdC50ZXh0dXJlLmJhc2VUZXh0dXJlICYmIG5leHRCYXRjaC5ibGVuZE1vZGUgPT0gZGlzcGxheU9iamVjdC5ibGVuZE1vZGUpXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHRCYXRjaC5pbnNlcnRCZWZvcmUoZGlzcGxheU9iamVjdCwgbmV4dFNwcml0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihuZXh0QmF0Y2ggPT0gcHJldmlvdXNCYXRjaClcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUSEVSRSBJUyBBIFNQTElUIElOIFRISVMgQkFUQ0ghIC8vXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNwbGl0QmF0Y2ggPSBwcmV2aW91c0JhdGNoLnNwbGl0KG5leHRTcHJpdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENPT0whXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIGl0IGJhY2sgaW50byB0aGUgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqIE9PUFMhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICogc2VlbXMgdGhlIG5ldyBzcHJpdGUgaXMgaW4gdGhlIG1pZGRsZSBvZiBhIGJhdGNoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICogbGV0cyBzcGxpdCBpdC4uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmF0Y2ggPSBXZWJHTEJhdGNoLmdldEJhdGNoKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoIHByZXZpb3VzQmF0Y2ggKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYXRjaC5pbml0KGRpc3BsYXlPYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCArIDEsIDAsIGJhdGNoLCBzcGxpdEJhdGNoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPIHJlLXdvcmQhXG5cbiAgICAgICAgICAgICAgICBuZXh0QmF0Y2ggPSBuZXh0U3ByaXRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLypcbiAgICAgICAgICogbG9va3MgbGlrZSBpdCBkb2VzIG5vdCBiZWxvbmcgdG8gYW55IGJhdGNoIVxuICAgICAgICAgKiBidXQgaXMgYWxzbyBub3QgaW50ZXJzZWN0aW5nIG9uZS4uXG4gICAgICAgICAqIHRpbWUgdG8gY3JlYXRlIGFuZXcgb25lIVxuICAgICAgICAgKi9cblxuICAgICAgICBiYXRjaCA9IFdlYkdMQmF0Y2guZ2V0QmF0Y2goKTtcbiAgICAgICAgYmF0Y2guaW5pdChkaXNwbGF5T2JqZWN0KTtcblxuICAgICAgICBpZihwcmV2aW91c0JhdGNoKSAvLyBpZiB0aGlzIGlzIGludmFsaWQgaXQgbWVhbnNcbiAgICAgICAge1xuICAgICAgICAgICAgaW5kZXggPSB0aGlzLmJhdGNocy5pbmRleE9mKCBwcmV2aW91c0JhdGNoICk7XG4gICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXggKyAxLCAwLCBiYXRjaCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmJhdGNocy5wdXNoKGJhdGNoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgVGlsaW5nU3ByaXRlKVxuICAgIHtcblxuICAgICAgICAvLyBhZGQgdG8gYSBiYXRjaCEhXG4gICAgICAgIHRoaXMuaW5pdFRpbGluZ1Nwcml0ZShkaXNwbGF5T2JqZWN0KTtcbiAgICAvLyAgdGhpcy5iYXRjaHMucHVzaChkaXNwbGF5T2JqZWN0KTtcblxuICAgIH1cbiAgICBlbHNlIGlmKGRpc3BsYXlPYmplY3QgaW5zdGFuY2VvZiBTdHJpcClcbiAgICB7XG4gICAgICAgIC8vIGFkZCB0byBhIGJhdGNoISFcbiAgICAgICAgdGhpcy5pbml0U3RyaXAoZGlzcGxheU9iamVjdCk7XG4gICAgLy8gIHRoaXMuYmF0Y2hzLnB1c2goZGlzcGxheU9iamVjdCk7XG4gICAgfVxuICAgIC8qZWxzZSBpZihkaXNwbGF5T2JqZWN0KS8vIGluc3RhbmNlb2YgR3JhcGhpY3MpXG4gICAge1xuICAgICAgICAvL2Rpc3BsYXlPYmplY3QuaW5pdFdlYkdMKHRoaXMpO1xuXG4gICAgICAgIC8vIGFkZCB0byBhIGJhdGNoISFcbiAgICAgICAgLy90aGlzLmluaXRTdHJpcChkaXNwbGF5T2JqZWN0KTtcbiAgICAgICAgLy90aGlzLmJhdGNocy5wdXNoKGRpc3BsYXlPYmplY3QpO1xuICAgIH0qL1xuXG4gICAgdGhpcy5pbnNlcnRBZnRlcihkaXNwbGF5T2JqZWN0LCBwcmV2aW91c1Nwcml0ZSk7XG5cbiAgICAvLyBpbnNlcnQgYW5kIFNQTElUIVxufTtcblxuLyoqXG4gKiBJbnNlcnRzIGEgZGlzcGxheU9iamVjdCBpbnRvIHRoZSBsaW5rZWQgbGlzdFxuICpcbiAqIEBtZXRob2QgaW5zZXJ0QWZ0ZXJcbiAqIEBwYXJhbSBpdGVtIHtEaXNwbGF5T2JqZWN0fVxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9IFRoZSBvYmplY3QgdG8gaW5zZXJ0XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5pbnNlcnRBZnRlciA9IGZ1bmN0aW9uIGluc2VydEFmdGVyKGl0ZW0sIGRpc3BsYXlPYmplY3QpXG57XG4gICAgdmFyIHByZXZpb3VzQmF0Y2gsIHNwbGl0QmF0Y2gsIGluZGV4O1xuXG4gICAgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICB7XG4gICAgICAgIHByZXZpb3VzQmF0Y2ggPSBkaXNwbGF5T2JqZWN0LmJhdGNoO1xuXG4gICAgICAgIGlmKHByZXZpb3VzQmF0Y2gpXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIHNvIHRoaXMgb2JqZWN0IGlzIGluIGEgYmF0Y2ghXG5cbiAgICAgICAgICAgIC8vIGlzIGl0IG5vdD8gbmVlZCB0byBzcGxpdCB0aGUgYmF0Y2hcbiAgICAgICAgICAgIGlmKHByZXZpb3VzQmF0Y2gudGFpbCA9PSBkaXNwbGF5T2JqZWN0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIGlzIGl0IHRhaWw/IGluc2VydCBpbiB0byBiYXRjaHNcbiAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoIHByZXZpb3VzQmF0Y2ggKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXgrMSwgMCwgaXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETyBNT0RJRlkgQUREIC8gUkVNT1ZFIENISUxEIFRPIEFDQ09VTlQgRk9SIEZJTFRFUlMgKGFsc28gZ2V0IHByZXYgYW5kIG5leHQpIC8vXG5cbiAgICAgICAgICAgICAgICAvLyBUSEVSRSBJUyBBIFNQTElUIElOIFRISVMgQkFUQ0ghIC8vXG4gICAgICAgICAgICAgICAgc3BsaXRCYXRjaCA9IHByZXZpb3VzQmF0Y2guc3BsaXQoZGlzcGxheU9iamVjdC5fX25leHQpO1xuXG4gICAgICAgICAgICAgICAgLy8gQ09PTCFcbiAgICAgICAgICAgICAgICAvLyBhZGQgaXQgYmFjayBpbnRvIHRoZSBhcnJheVxuICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICogT09QUyFcbiAgICAgICAgICAgICAgICAgKiBzZWVtcyB0aGUgbmV3IHNwcml0ZSBpcyBpbiB0aGUgbWlkZGxlIG9mIGEgYmF0Y2hcbiAgICAgICAgICAgICAgICAgKiBsZXRzIHNwbGl0IGl0Li5cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoIHByZXZpb3VzQmF0Y2ggKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXggKyAxLCAwLCBpdGVtLCBzcGxpdEJhdGNoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuYmF0Y2hzLnB1c2goaXRlbSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgaW5kZXggPSB0aGlzLmJhdGNocy5pbmRleE9mKCBkaXNwbGF5T2JqZWN0ICk7XG4gICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCArIDEsIDAsIGl0ZW0pO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhIGRpc3BsYXlPYmplY3QgZnJvbSB0aGUgbGlua2VkIGxpc3RcbiAqXG4gKiBAbWV0aG9kIHJlbW92ZU9iamVjdFxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9IFRoZSBvYmplY3QgdG8gcmVtb3ZlXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW1vdmVPYmplY3QgPSBmdW5jdGlvbiByZW1vdmVPYmplY3QoZGlzcGxheU9iamVjdClcbntcbiAgICAvLyBsb29wIHRocm91Z2ggY2hpbGRyZW4uLlxuICAgIC8vIGRpc3BsYXkgb2JqZWN0IC8vXG5cbiAgICAvLyBhZGQgYSBjaGlsZCBmcm9tIHRoZSByZW5kZXIgZ3JvdXAuLlxuICAgIC8vIHJlbW92ZSBpdCBhbmQgYWxsIGl0cyBjaGlsZHJlbiFcbiAgICAvL2Rpc3BsYXlPYmplY3QuY2FjaGVWaXNpYmxlID0gZmFsc2U7Ly9kaXNwbGF5T2JqZWN0LnZpc2libGU7XG5cbiAgICAvKlxuICAgICAqIHJlbW92aW5nIGlzIGEgbG90IHF1aWNrZXIuLlxuICAgICAqXG4gICAgICovXG4gICAgdmFyIGJhdGNoVG9SZW1vdmUsIGluZGV4O1xuXG4gICAgaWYgKGRpc3BsYXlPYmplY3QgaW5zdGFuY2VvZiBTcHJpdGUpXG4gICAge1xuICAgICAgICAvLyBzaG91bGQgYWx3YXlzIGhhdmUgYSBiYXRjaCFcbiAgICAgICAgdmFyIGJhdGNoID0gZGlzcGxheU9iamVjdC5iYXRjaDtcbiAgICAgICAgaWYoIWJhdGNoKXJldHVybjsgLy8gdGhpcyBtZWFucyB0aGUgZGlzcGxheSBsaXN0IGhhcyBiZWVuIGFsdGVyZWQgYmVmcmUgcmVuZGVyaW5nXG5cbiAgICAgICAgYmF0Y2gucmVtb3ZlKGRpc3BsYXlPYmplY3QpO1xuXG4gICAgICAgIGlmICghYmF0Y2guc2l6ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgYmF0Y2hUb1JlbW92ZSA9IGJhdGNoO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIGJhdGNoVG9SZW1vdmUgPSBkaXNwbGF5T2JqZWN0O1xuICAgIH1cblxuICAgIC8qXG4gICAgICogTG9va3MgbGlrZSB0aGVyZSBpcyBzb210aGluZyB0aGF0IG5lZWRzIHJlbW92aW5nIVxuICAgICAqL1xuICAgIGlmKGJhdGNoVG9SZW1vdmUpXG4gICAge1xuICAgICAgICBpbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoIGJhdGNoVG9SZW1vdmUgKTtcbiAgICAgICAgaWYgKGluZGV4ID09PSAtMSkgcmV0dXJuOy8vIHRoaXMgbWVhbnMgaXQgd2FzIGFkZGVkIHRoZW4gcmVtb3ZlZCBiZWZvcmUgcmVuZGVyZWRcblxuICAgICAgICAvLyBvayBzby4uIGNoZWNrIHRvIHNlZSBpZiB5b3UgYWRqYWNlbnQgYmF0Y2hzIHNob3VsZCBiZSBqb2luZWQuXG4gICAgICAgIC8vIFRPRE8gbWF5IG9wdGltaXNlP1xuICAgICAgICBpZiAoaW5kZXggPT09IDAgfHwgaW5kZXggPT09IHRoaXMuYmF0Y2hzLmxlbmd0aCAtIDEpXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIHdoYSAtIGV2YSEganVzdCBnZXQgb2YgdGhlIGVtcHR5IGJhdGNoIVxuICAgICAgICAgICAgdGhpcy5iYXRjaHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIGlmIChiYXRjaFRvUmVtb3ZlIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICAgICAgICAgICAgICBXZWJHTEJhdGNoLnJldHVybkJhdGNoKGJhdGNoVG9SZW1vdmUpO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLmJhdGNoc1tpbmRleCAtIDFdIGluc3RhbmNlb2YgV2ViR0xCYXRjaCAmJiB0aGlzLmJhdGNoc1tpbmRleCArIDFdIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICAgICAge1xuICAgICAgICAgICAgaWYodGhpcy5iYXRjaHNbaW5kZXggLSAxXS50ZXh0dXJlID09IHRoaXMuYmF0Y2hzW2luZGV4ICsgMV0udGV4dHVyZSAmJiB0aGlzLmJhdGNoc1tpbmRleCAtIDFdLmJsZW5kTW9kZSA9PSB0aGlzLmJhdGNoc1tpbmRleCArIDFdLmJsZW5kTW9kZSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiTUVSR0VcIilcbiAgICAgICAgICAgICAgICB0aGlzLmJhdGNoc1tpbmRleCAtIDFdLm1lcmdlKHRoaXMuYmF0Y2hzW2luZGV4ICsgMV0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKGJhdGNoVG9SZW1vdmUgaW5zdGFuY2VvZiBXZWJHTEJhdGNoKVxuICAgICAgICAgICAgICAgICAgICBXZWJHTEJhdGNoLnJldHVybkJhdGNoKGJhdGNoVG9SZW1vdmUpO1xuXG4gICAgICAgICAgICAgICAgV2ViR0xCYXRjaC5yZXR1cm5CYXRjaCh0aGlzLmJhdGNoc1tpbmRleCArIDFdKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXgsIDIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGlmIChiYXRjaFRvUmVtb3ZlIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICAgICAgICAgIFdlYkdMQmF0Y2gucmV0dXJuQmF0Y2goYmF0Y2hUb1JlbW92ZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyBhIHRpbGluZyBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIGluaXRUaWxpbmdTcHJpdGVcbiAqIEBwYXJhbSBzcHJpdGUge1RpbGluZ1Nwcml0ZX0gVGhlIHRpbGluZyBzcHJpdGUgdG8gaW5pdGlhbGl6ZVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uaW5pdFRpbGluZ1Nwcml0ZSA9IGZ1bmN0aW9uIGluaXRUaWxpbmdTcHJpdGUoc3ByaXRlKVxue1xuICAgIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgICAvLyBtYWtlIHRoZSB0ZXh0dXJlIHRpbGFibGUuLlxuXG4gICAgc3ByaXRlLnZlcnRpY2llcyA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcHJpdGUud2lkdGgsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcHJpdGUud2lkdGgsICBzcHJpdGUuaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAgc3ByaXRlLmhlaWdodF0pO1xuXG4gICAgc3ByaXRlLnV2cyA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMSwgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDFdKTtcblxuICAgIHNwcml0ZS5jb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KFsxLDEsMSwxXSk7XG5cbiAgICBzcHJpdGUuaW5kaWNlcyA9ICBuZXcgVWludDE2QXJyYXkoWzAsIDEsIDMsMl0pLy8sIDJdKTtcblxuICAgIHNwcml0ZS5fdmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgc3ByaXRlLl9pbmRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHNwcml0ZS5fdXZCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzcHJpdGUuX2NvbG9yQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3ByaXRlLl92ZXJ0ZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzcHJpdGUudmVydGljaWVzLCBnbC5TVEFUSUNfRFJBVyk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3ByaXRlLl91dkJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsICBzcHJpdGUudXZzLCBnbC5EWU5BTUlDX0RSQVcpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHNwcml0ZS5fY29sb3JCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzcHJpdGUuY29sb3JzLCBnbC5TVEFUSUNfRFJBVyk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzcHJpdGUuX2luZGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzcHJpdGUuaW5kaWNlcywgZ2wuU1RBVElDX0RSQVcpO1xuXG4vLyAgICByZXR1cm4gKCAoeCA+IDApICYmICgoeCAmICh4IC0gMSkpID09IDApICk7XG5cbiAgICBpZihzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlKVxuICAgIHtcbiAgICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSk7XG4gICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLlJFUEVBVCk7XG4gICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLlJFUEVBVCk7XG4gICAgICAgIHNwcml0ZS50ZXh0dXJlLmJhc2VUZXh0dXJlLl9wb3dlck9mMiA9IHRydWU7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHNwcml0ZS50ZXh0dXJlLmJhc2VUZXh0dXJlLl9wb3dlck9mMiA9IHRydWU7XG4gICAgfVxufTtcblxuLyoqXG4gKiBSZW5kZXJzIGEgU3RyaXBcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclN0cmlwXG4gKiBAcGFyYW0gc3RyaXAge1N0cmlwfSBUaGUgc3RyaXAgdG8gcmVuZGVyXG4gKiBAcGFyYW0gcHJvamVjdGlvbiB7T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyU3RyaXAgPSBmdW5jdGlvbiByZW5kZXJTdHJpcChzdHJpcCwgcHJvamVjdGlvbilcbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuICAgIHZhciBzaGFkZXJQcm9ncmFtID0gZ2xvYmFscy5zaGFkZXJQcm9ncmFtO1xuLy8gIG1hdFxuICAgIC8vdmFyIG1hdDRSZWFsID0gbWF0My50b01hdDQoc3RyaXAud29ybGRUcmFuc2Zvcm0pO1xuICAgIC8vbWF0NC50cmFuc3Bvc2UobWF0NFJlYWwpO1xuICAgIC8vbWF0NC5tdWx0aXBseShwcm9qZWN0aW9uTWF0cml4LCBtYXQ0UmVhbCwgbWF0NFJlYWwgKVxuXG5cbiAgICBnbC51c2VQcm9ncmFtKGdsb2JhbHMuc3RyaXBTaGFkZXJQcm9ncmFtKTtcblxuICAgIHZhciBtID0gbWF0My5jbG9uZShzdHJpcC53b3JsZFRyYW5zZm9ybSk7XG5cbiAgICBtYXQzLnRyYW5zcG9zZShtKTtcblxuICAgIC8vIHNldCB0aGUgbWF0cml4IHRyYW5zZm9ybSBmb3IgdGhlXG4gICAgZ2wudW5pZm9ybU1hdHJpeDNmdihnbG9iYWxzLnN0cmlwU2hhZGVyUHJvZ3JhbS50cmFuc2xhdGlvbk1hdHJpeCwgZmFsc2UsIG0pO1xuICAgIGdsLnVuaWZvcm0yZihnbG9iYWxzLnN0cmlwU2hhZGVyUHJvZ3JhbS5wcm9qZWN0aW9uVmVjdG9yLCBwcm9qZWN0aW9uLngsIHByb2plY3Rpb24ueSk7XG4gICAgZ2wudW5pZm9ybTFmKGdsb2JhbHMuc3RyaXBTaGFkZXJQcm9ncmFtLmFscGhhLCBzdHJpcC53b3JsZEFscGhhKTtcblxuLypcbiAgICBpZihzdHJpcC5ibGVuZE1vZGUgPT0gYmxlbmRNb2Rlcy5OT1JNQUwpXG4gICAge1xuICAgICAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgZ2wuYmxlbmRGdW5jKGdsLk9ORSwgZ2wuT05FX01JTlVTX1NSQ19DT0xPUik7XG4gICAgfVxuICAgICovXG5cblxuICAgIGlmKCFzdHJpcC5kaXJ0eSlcbiAgICB7XG5cbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl92ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgc3RyaXAudmVydGljaWVzKVxuICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlclByb2dyYW0udmVydGV4UG9zaXRpb25BdHRyaWJ1dGUsIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSB1dnNcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl91dkJ1ZmZlcik7XG4gICAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyUHJvZ3JhbS50ZXh0dXJlQ29vcmRBdHRyaWJ1dGUsIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgZ2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCk7XG4gICAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHN0cmlwLnRleHR1cmUuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSk7XG5cbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl9jb2xvckJ1ZmZlcik7XG4gICAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyUHJvZ3JhbS5jb2xvckF0dHJpYnV0ZSwgMSwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgICAgICAvLyBkb250IG5lZWQgdG8gdXBsb2FkIVxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzdHJpcC5faW5kZXhCdWZmZXIpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBzdHJpcC5kaXJ0eSA9IGZhbHNlO1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAuX3ZlcnRleEJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC52ZXJ0aWNpZXMsIGdsLlNUQVRJQ19EUkFXKVxuICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlclByb2dyYW0udmVydGV4UG9zaXRpb25BdHRyaWJ1dGUsIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSB1dnNcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl91dkJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC51dnMsIGdsLlNUQVRJQ19EUkFXKVxuICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlclByb2dyYW0udGV4dHVyZUNvb3JkQXR0cmlidXRlLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgICAgIGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTApO1xuICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBzdHJpcC50ZXh0dXJlLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUpO1xuXG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fY29sb3JCdWZmZXIpO1xuICAgICAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAuY29sb3JzLCBnbC5TVEFUSUNfRFJBVylcbiAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXJQcm9ncmFtLmNvbG9yQXR0cmlidXRlLCAxLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgICAgIC8vIGRvbnQgbmVlZCB0byB1cGxvYWQhXG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHN0cmlwLl9pbmRleEJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHN0cmlwLmluZGljZXMsIGdsLlNUQVRJQ19EUkFXKTtcblxuICAgIH1cbiAgICAvL2NvbnNvbGUubG9nKGdsLlRSSUFOR0xFX1NUUklQKTtcblxuICAgIGdsLmRyYXdFbGVtZW50cyhnbC5UUklBTkdMRV9TVFJJUCwgc3RyaXAuaW5kaWNlcy5sZW5ndGgsIGdsLlVOU0lHTkVEX1NIT1JULCAwKTtcblxuICAgIGdsLnVzZVByb2dyYW0oZ2xvYmFscy5zaGFkZXJQcm9ncmFtKTtcbn07XG5cbi8qKlxuICogUmVuZGVycyBhIFRpbGluZ1Nwcml0ZVxuICpcbiAqIEBtZXRob2QgcmVuZGVyVGlsaW5nU3ByaXRlXG4gKiBAcGFyYW0gc3ByaXRlIHtUaWxpbmdTcHJpdGV9IFRoZSB0aWxpbmcgc3ByaXRlIHRvIHJlbmRlclxuICogQHBhcmFtIHByb2plY3Rpb25NYXRyaXgge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbmRlclRpbGluZ1Nwcml0ZSA9IGZ1bmN0aW9uIHJlbmRlclRpbGluZ1Nwcml0ZShzcHJpdGUsIHByb2plY3Rpb25NYXRyaXgpXG57XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcbiAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IGdsb2JhbHMuc2hhZGVyUHJvZ3JhbTtcblxuICAgIHZhciB0aWxlUG9zaXRpb24gPSBzcHJpdGUudGlsZVBvc2l0aW9uO1xuICAgIHZhciB0aWxlU2NhbGUgPSBzcHJpdGUudGlsZVNjYWxlO1xuXG4gICAgdmFyIG9mZnNldFggPSAgdGlsZVBvc2l0aW9uLngvc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUud2lkdGg7XG4gICAgdmFyIG9mZnNldFkgPSAgdGlsZVBvc2l0aW9uLnkvc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUuaGVpZ2h0O1xuXG4gICAgdmFyIHNjYWxlWCA9ICAoc3ByaXRlLndpZHRoIC8gc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUud2lkdGgpICAvIHRpbGVTY2FsZS54O1xuICAgIHZhciBzY2FsZVkgPSAgKHNwcml0ZS5oZWlnaHQgLyBzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5oZWlnaHQpIC8gdGlsZVNjYWxlLnk7XG5cbiAgICBzcHJpdGUudXZzWzBdID0gMCAtIG9mZnNldFg7XG4gICAgc3ByaXRlLnV2c1sxXSA9IDAgLSBvZmZzZXRZO1xuXG4gICAgc3ByaXRlLnV2c1syXSA9ICgxICogc2NhbGVYKSAgLW9mZnNldFg7XG4gICAgc3ByaXRlLnV2c1szXSA9IDAgLSBvZmZzZXRZO1xuXG4gICAgc3ByaXRlLnV2c1s0XSA9ICgxICpzY2FsZVgpIC0gb2Zmc2V0WDtcbiAgICBzcHJpdGUudXZzWzVdID0gKDEgKnNjYWxlWSkgLSBvZmZzZXRZO1xuXG4gICAgc3ByaXRlLnV2c1s2XSA9IDAgLSBvZmZzZXRYO1xuICAgIHNwcml0ZS51dnNbN10gPSAoMSAqc2NhbGVZKSAtIG9mZnNldFk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3ByaXRlLl91dkJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyU3ViRGF0YShnbC5BUlJBWV9CVUZGRVIsIDAsIHNwcml0ZS51dnMpXG5cbiAgICB0aGlzLnJlbmRlclN0cmlwKHNwcml0ZSwgcHJvamVjdGlvbk1hdHJpeCk7XG59O1xuXG4vKipcbiAqIEluaXRpYWxpemVzIGEgc3RyaXAgdG8gYmUgcmVuZGVyZWRcbiAqXG4gKiBAbWV0aG9kIGluaXRTdHJpcFxuICogQHBhcmFtIHN0cmlwIHtTdHJpcH0gVGhlIHN0cmlwIHRvIGluaXRpYWxpemVcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmluaXRTdHJpcCA9IGZ1bmN0aW9uIGluaXRTdHJpcChzdHJpcClcbntcbiAgICAvLyBidWlsZCB0aGUgc3RyaXAhXG4gICAgdmFyIGdsID0gdGhpcy5nbDtcbiAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IHRoaXMuc2hhZGVyUHJvZ3JhbTtcblxuICAgIHN0cmlwLl92ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzdHJpcC5faW5kZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzdHJpcC5fdXZCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzdHJpcC5fY29sb3JCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fdmVydGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAudmVydGljaWVzLCBnbC5EWU5BTUlDX0RSQVcpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl91dkJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsICBzdHJpcC51dnMsIGdsLlNUQVRJQ19EUkFXKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fY29sb3JCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5jb2xvcnMsIGdsLlNUQVRJQ19EUkFXKTtcblxuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc3RyaXAuX2luZGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzdHJpcC5pbmRpY2VzLCBnbC5TVEFUSUNfRFJBVyk7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgYSBsb2FkZWQgd2ViZ2wgdGV4dHVyZVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgdXBkYXRlVGV4dHVyZVxuICogQHBhcmFtIGdsIHtXZWJHTENvbnRleHR9IEFuIGluc3RhbmNlIG9mIHRoZSB3ZWJHTCBjb250ZXh0XG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX0gVGhlIHRleHR1cmUgdG8gdXBkYXRlXG4gKi9cbldlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZSA9IGZ1bmN0aW9uIHVwZGF0ZVRleHR1cmUoZ2wsIHRleHR1cmUpXG57XG4gICAgLy9UT0RPIGJyZWFrIHRoaXMgb3V0IGludG8gYSB0ZXh0dXJlIG1hbmFnZXIuLi5cbiAgICBpZighdGV4dHVyZS5fZ2xUZXh0dXJlKVxuICAgIHtcbiAgICAgICAgdGV4dHVyZS5fZ2xUZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgIH1cblxuICAgIGlmKHRleHR1cmUuaGFzTG9hZGVkKVxuICAgIHtcbiAgICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZS5fZ2xUZXh0dXJlKTtcbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCB0cnVlKTtcblxuICAgICAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIHRleHR1cmUuc291cmNlKTtcbiAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLkxJTkVBUik7XG4gICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpO1xuXG4gICAgICAgIC8vIHJlZ3VsZXIuLi5cblxuICAgICAgICBpZighdGV4dHVyZS5fcG93ZXJPZjIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5SRVBFQVQpO1xuICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuUkVQRUFUKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuICAgIH1cbn07XG5cbi8qKlxuICogRGVzdHJveXMgYSBsb2FkZWQgd2ViZ2wgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgZGVzdHJveVRleHR1cmVcbiAqIEBwYXJhbSBnbCB7V2ViR0xDb250ZXh0fSBBbiBpbnN0YW5jZSBvZiB0aGUgd2ViR0wgY29udGV4dFxuICogQHBhcmFtIHRleHR1cmUge1RleHR1cmV9IFRoZSB0ZXh0dXJlIHRvIHVwZGF0ZVxuICovXG5XZWJHTFJlbmRlckdyb3VwLmRlc3Ryb3lUZXh0dXJlID0gZnVuY3Rpb24gZGVzdHJveVRleHR1cmUoZ2wsIHRleHR1cmUpXG57XG4gICAgLy9UT0RPIGJyZWFrIHRoaXMgb3V0IGludG8gYSB0ZXh0dXJlIG1hbmFnZXIuLi5cbiAgICBpZih0ZXh0dXJlLl9nbFRleHR1cmUpXG4gICAge1xuICAgICAgICB0ZXh0dXJlLl9nbFRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgICAgIGdsLmRlbGV0ZVRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZS5fZ2xUZXh0dXJlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGhlIHRleHR1cmVzIGxvYWRlZCBpbnRvIHRoaXMgd2ViZ2wgcmVuZGVyZXJcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHVwZGF0ZVRleHR1cmVzXG4gKiBAcGFyYW0gZ2wge1dlYkdMQ29udGV4dH0gQW4gaW5zdGFuY2Ugb2YgdGhlIHdlYkdMIGNvbnRleHRcbiAqL1xuV2ViR0xSZW5kZXJHcm91cC51cGRhdGVUZXh0dXJlcyA9IGZ1bmN0aW9uIHVwZGF0ZVRleHR1cmVzKGdsKVxue1xuICAgIC8vVE9ETyBicmVhayB0aGlzIG91dCBpbnRvIGEgdGV4dHVyZSBtYW5hZ2VyLi4uXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBnbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgICAgICBXZWJHTFJlbmRlckdyb3VwLnVwZGF0ZVRleHR1cmUoZ2wsIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZVtpXSk7XG4gICAgZm9yIChpID0gMCwgbCA9IGdsb2JhbHMudGV4dHVyZXNUb0Rlc3Ryb3kubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgICAgICBXZWJHTFJlbmRlckdyb3VwLmRlc3Ryb3lUZXh0dXJlKGdsLCBnbG9iYWxzLnRleHR1cmVzVG9EZXN0cm95W2ldKTtcbiAgICBnbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUgPSBbXTtcbiAgICBnbG9iYWxzLnRleHR1cmVzVG9EZXN0cm95ID0gW107XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkdMUmVuZGVyR3JvdXA7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwbGF0Zm9ybSA9IHJlcXVpcmUoJy4uLy4uL3BsYXRmb3JtJyk7XG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xudmFyIHNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKTtcblxudmFyIFdlYkdMQmF0Y2ggPSByZXF1aXJlKCcuL1dlYkdMQmF0Y2gnKTtcbnZhciBXZWJHTFJlbmRlckdyb3VwID0gcmVxdWlyZSgnLi9XZWJHTFJlbmRlckdyb3VwJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi8uLi9nZW9tL1BvaW50Jyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uLy4uL3RleHR1cmVzL1RleHR1cmUnKTtcblxuLyoqXG4gKiB0aGUgV2ViR0xSZW5kZXJlciBpcyBkcmF3cyB0aGUgc3RhZ2UgYW5kIGFsbCBpdHMgY29udGVudCBvbnRvIGEgd2ViR0wgZW5hYmxlZCBjYW52YXMuIFRoaXMgcmVuZGVyZXJcbiAqIHNob3VsZCBiZSB1c2VkIGZvciBicm93c2VycyBzdXBwb3J0IHdlYkdMLiBUaGlzIFJlbmRlciB3b3JrcyBieSBhdXRvbWF0aWNhbGx5IG1hbmFnaW5nIHdlYkdMQmF0Y2hzLlxuICogU28gbm8gbmVlZCBmb3IgU3ByaXRlIEJhdGNoJ3Mgb3IgU3ByaXRlIENsb3VkJ3NcbiAqIERvbnQgZm9yZ2V0IHRvIGFkZCB0aGUgdmlldyB0byB5b3VyIERPTSBvciB5b3Ugd2lsbCBub3Qgc2VlIGFueXRoaW5nIDopXG4gKlxuICogQGNsYXNzIFdlYkdMUmVuZGVyZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHdpZHRoPTAge051bWJlcn0gdGhlIHdpZHRoIG9mIHRoZSBjYW52YXMgdmlld1xuICogQHBhcmFtIGhlaWdodD0wIHtOdW1iZXJ9IHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyB2aWV3XG4gKiBAcGFyYW0gdmlldyB7Q2FudmFzfSB0aGUgY2FudmFzIHRvIHVzZSBhcyBhIHZpZXcsIG9wdGlvbmFsXG4gKiBAcGFyYW0gdHJhbnNwYXJlbnQ9ZmFsc2Uge0Jvb2xlYW59IHRoZSB0cmFuc3BhcmVuY3kgb2YgdGhlIHJlbmRlciB2aWV3LCBkZWZhdWx0IGZhbHNlXG4gKiBAcGFyYW0gYW50aWFsaWFzPWZhbHNlIHtCb29sZWFufSBzZXRzIGFudGlhbGlhcyAob25seSBhcHBsaWNhYmxlIGluIGNocm9tZSBhdCB0aGUgbW9tZW50KVxuICpcbiAqL1xuZnVuY3Rpb24gV2ViR0xSZW5kZXJlcih3aWR0aCwgaGVpZ2h0LCB2aWV3LCB0cmFuc3BhcmVudCwgYW50aWFsaWFzKVxue1xuICAgIHZhciBnbDtcblxuICAgIHRoaXMudHJhbnNwYXJlbnQgPSAhIXRyYW5zcGFyZW50O1xuXG4gICAgdGhpcy53aWR0aCA9IHdpZHRoIHx8IDgwMDtcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodCB8fCA2MDA7XG5cbiAgICB0aGlzLnZpZXcgPSB2aWV3IHx8IHBsYXRmb3JtLmNyZWF0ZUNhbnZhcygpO1xuICAgIHRoaXMudmlldy53aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgdGhpcy52aWV3LmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgLy8gZGVhbCB3aXRoIGxvc2luZyBjb250ZXh0Li5cbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHRoaXMudmlldy5hZGRFdmVudExpc3RlbmVyKCd3ZWJnbGNvbnRleHRsb3N0JywgZnVuY3Rpb24oZXZlbnQpIHsgc2NvcGUuaGFuZGxlQ29udGV4dExvc3QoZXZlbnQpOyB9LCBmYWxzZSlcbiAgICB0aGlzLnZpZXcuYWRkRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0cmVzdG9yZWQnLCBmdW5jdGlvbihldmVudCkgeyBzY29wZS5oYW5kbGVDb250ZXh0UmVzdG9yZWQoZXZlbnQpOyB9LCBmYWxzZSlcblxuICAgIHRoaXMuYmF0Y2hzID0gW107XG5cbiAgICAvLyBkbyBhIGNhdGNoLi4gb25seSAxIHdlYkdMIHJlbmRlcmVyLi5cbiAgICB0cnlcbiAgICB7XG4gICAgICAgIGdsID0gZ2xvYmFscy5nbCA9IHRoaXMuZ2wgPSB0aGlzLnZpZXcuZ2V0Q29udGV4dChcImV4cGVyaW1lbnRhbC13ZWJnbFwiLCAge1xuICAgICAgICAgICAgIGFscGhhOiB0aGlzLnRyYW5zcGFyZW50LFxuICAgICAgICAgICAgIGFudGlhbGlhczohIWFudGlhbGlhcywgLy8gU1BFRUQgVVA/P1xuICAgICAgICAgICAgIHByZW11bHRpcGxpZWRBbHBoYTpmYWxzZSxcbiAgICAgICAgICAgICBzdGVuY2lsOnRydWVcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNhdGNoIChlKVxuICAgIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiIFRoaXMgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHdlYkdMLiBUcnkgdXNpbmcgdGhlIGNhbnZhcyByZW5kZXJlclwiICsgdGhpcyk7XG4gICAgfVxuXG4gICAgc2hhZGVycy5pbml0UHJpbWl0aXZlU2hhZGVyKCk7XG4gICAgc2hhZGVycy5pbml0RGVmYXVsdFNoYWRlcigpO1xuICAgIHNoYWRlcnMuaW5pdERlZmF1bHRTdHJpcFNoYWRlcigpO1xuXG4gICAgc2hhZGVycy5hY3RpdmF0ZURlZmF1bHRTaGFkZXIoKTtcblxuICAgIHRoaXMuYmF0Y2ggPSBuZXcgV2ViR0xCYXRjaChnbCk7XG4gICAgZ2wuZGlzYWJsZShnbC5ERVBUSF9URVNUKTtcbiAgICBnbC5kaXNhYmxlKGdsLkNVTExfRkFDRSk7XG5cbiAgICBnbC5lbmFibGUoZ2wuQkxFTkQpO1xuICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0aGlzLnRyYW5zcGFyZW50KTtcblxuICAgIHRoaXMucHJvamVjdGlvbiA9IG5ldyBQb2ludCg0MDAsIDMwMCk7XG5cbiAgICB0aGlzLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgdGhpcy5jb250ZXh0TG9zdCA9IGZhbHNlO1xuXG4gICAgdGhpcy5zdGFnZVJlbmRlckdyb3VwID0gbmV3IFdlYkdMUmVuZGVyR3JvdXAodGhpcy5nbCk7XG59XG5cbnZhciBwcm90byA9IFdlYkdMUmVuZGVyZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIFJlbmRlcnMgdGhlIHN0YWdlIHRvIGl0cyB3ZWJHTCB2aWV3XG4gKlxuICogQG1ldGhvZCByZW5kZXJcbiAqIEBwYXJhbSBzdGFnZSB7U3RhZ2V9IHRoZSBTdGFnZSBlbGVtZW50IHRvIGJlIHJlbmRlcmVkXG4gKi9cbnByb3RvLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcihzdGFnZSlcbntcbiAgICBpZih0aGlzLmNvbnRleHRMb3N0KXJldHVybjtcblxuXG4gICAgLy8gaWYgcmVuZGVyaW5nIGEgbmV3IHN0YWdlIGNsZWFyIHRoZSBiYXRjaHMuLlxuICAgIGlmKHRoaXMuX19zdGFnZSAhPT0gc3RhZ2UpXG4gICAge1xuICAgICAgICAvLyBUT0RPIG1ha2UgdGhpcyB3b3JrXG4gICAgICAgIC8vIGRvbnQgdGhpbmsgdGhpcyBpcyBuZWVkZWQgYW55IG1vcmU/XG4gICAgICAgIHRoaXMuX19zdGFnZSA9IHN0YWdlO1xuICAgICAgICB0aGlzLnN0YWdlUmVuZGVyR3JvdXAuc2V0UmVuZGVyYWJsZShzdGFnZSk7XG4gICAgfVxuXG4gICAgLy8gVE9ETyBub3QgbmVlZGVkIG5vdy4uLlxuICAgIC8vIHVwZGF0ZSBjaGlsZHJlbiBpZiBuZWVkIGJlXG4gICAgLy8gYmVzdCB0byByZW1vdmUgZmlyc3QhXG4gICAgLypmb3IgKHZhciBpPTA7IGkgPCBzdGFnZS5fX2NoaWxkcmVuUmVtb3ZlZC5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBncm91cCA9IHN0YWdlLl9fY2hpbGRyZW5SZW1vdmVkW2ldLl9fcmVuZGVyR3JvdXBcbiAgICAgICAgaWYoZ3JvdXApZ3JvdXAucmVtb3ZlRGlzcGxheU9iamVjdChzdGFnZS5fX2NoaWxkcmVuUmVtb3ZlZFtpXSk7XG4gICAgfSovXG5cbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuXG4gICAgLy8gdXBkYXRlIGFueSB0ZXh0dXJlc1xuICAgIFdlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZXMoZ2wpO1xuXG4gICAgLy8gdXBkYXRlIHRoZSBzY2VuZSBncmFwaFxuICAgIGdsb2JhbHMudmlzaWJsZUNvdW50Kys7XG4gICAgc3RhZ2UudXBkYXRlVHJhbnNmb3JtKCk7XG5cbiAgICAvLyAtLSBEb2VzIHRoaXMgbmVlZCB0byBiZSBzZXQgZXZlcnkgZnJhbWU/IC0tIC8vXG4gICAgZ2wuY29sb3JNYXNrKHRydWUsIHRydWUsIHRydWUsIHRoaXMudHJhbnNwYXJlbnQpO1xuICAgIGdsLnZpZXdwb3J0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG5cbiAgICBnbC5jbGVhckNvbG9yKHN0YWdlLmJhY2tncm91bmRDb2xvclNwbGl0WzBdLHN0YWdlLmJhY2tncm91bmRDb2xvclNwbGl0WzFdLHN0YWdlLmJhY2tncm91bmRDb2xvclNwbGl0WzJdLCAhdGhpcy50cmFuc3BhcmVudCk7XG4gICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG5cbiAgICAvLyBIQUNLIFRPIFRFU1RcblxuICAgIC8vIHRoaXMuc3RhZ2VSZW5kZXJHcm91cC5iYWNrZ3JvdW5kQ29sb3IgPSBzdGFnZS5iYWNrZ3JvdW5kQ29sb3JTcGxpdDtcbiAgICB0aGlzLnN0YWdlUmVuZGVyR3JvdXAucmVuZGVyKHRoaXMucHJvamVjdGlvbik7XG5cbiAgICAvLyBpbnRlcmFjdGlvblxuICAgIC8vIHJ1biBpbnRlcmFjdGlvbiFcbiAgICBpZihzdGFnZS5pbnRlcmFjdGl2ZSlcbiAgICB7XG4gICAgICAgIC8vbmVlZCB0byBhZGQgc29tZSBldmVudHMhXG4gICAgICAgIGlmKCFzdGFnZS5faW50ZXJhY3RpdmVFdmVudHNBZGRlZClcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhZ2UuX2ludGVyYWN0aXZlRXZlbnRzQWRkZWQgPSB0cnVlO1xuICAgICAgICAgICAgc3RhZ2UuaW50ZXJhY3Rpb25NYW5hZ2VyLnNldFRhcmdldCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGFmdGVyIHJlbmRlcmluZyBsZXRzIGNvbmZpcm0gYWxsIGZyYW1lcyB0aGF0IGhhdmUgYmVlbiB1b2RhdGVkLi5cbiAgICBpZihUZXh0dXJlLmZyYW1lVXBkYXRlcy5sZW5ndGggPiAwKVxuICAgIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBUZXh0dXJlLmZyYW1lVXBkYXRlcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIFRleHR1cmUuZnJhbWVVcGRhdGVzW2ldLnVwZGF0ZUZyYW1lID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBUZXh0dXJlLmZyYW1lVXBkYXRlcyA9IFtdO1xuICAgIH1cbn07XG5cbi8qKlxuICogcmVzaXplcyB0aGUgd2ViR0wgdmlldyB0byB0aGUgc3BlY2lmaWVkIHdpZHRoIGFuZCBoZWlnaHRcbiAqXG4gKiBAbWV0aG9kIHJlc2l6ZVxuICogQHBhcmFtIHdpZHRoIHtOdW1iZXJ9IHRoZSBuZXcgd2lkdGggb2YgdGhlIHdlYkdMIHZpZXdcbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn0gdGhlIG5ldyBoZWlnaHQgb2YgdGhlIHdlYkdMIHZpZXdcbiAqL1xucHJvdG8ucmVzaXplID0gZnVuY3Rpb24gcmVzaXplKHdpZHRoLCBoZWlnaHQpXG57XG4gICAgdGhpcy53aWR0aCA9IHdpZHRoO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgdGhpcy52aWV3LndpZHRoID0gd2lkdGg7XG4gICAgdGhpcy52aWV3LmhlaWdodCA9IGhlaWdodDtcblxuICAgIHRoaXMuZ2wudmlld3BvcnQoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXG4gICAgLy92YXIgcHJvamVjdGlvbk1hdHJpeCA9IHRoaXMucHJvamVjdGlvbk1hdHJpeDtcblxuICAgIHRoaXMucHJvamVjdGlvbi54ID0gdGhpcy53aWR0aC8yO1xuICAgIHRoaXMucHJvamVjdGlvbi55ID0gdGhpcy5oZWlnaHQvMjtcblxuLy8gIHByb2plY3Rpb25NYXRyaXhbMF0gPSAyL3RoaXMud2lkdGg7XG4vLyAgcHJvamVjdGlvbk1hdHJpeFs1XSA9IC0yL3RoaXMuaGVpZ2h0O1xuLy8gIHByb2plY3Rpb25NYXRyaXhbMTJdID0gLTE7XG4vLyAgcHJvamVjdGlvbk1hdHJpeFsxM10gPSAxO1xufTtcblxuLyoqXG4gKiBIYW5kbGVzIGEgbG9zdCB3ZWJnbCBjb250ZXh0XG4gKlxuICogQG1ldGhvZCBoYW5kbGVDb250ZXh0TG9zdFxuICogQHBhcmFtIGV2ZW50IHtFdmVudH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmhhbmRsZUNvbnRleHRMb3N0ID0gZnVuY3Rpb24gaGFuZGxlQ29udGV4dExvc3QoZXZlbnQpXG57XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLmNvbnRleHRMb3N0ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogSGFuZGxlcyBhIHJlc3RvcmVkIHdlYmdsIGNvbnRleHRcbiAqXG4gKiBAbWV0aG9kIGhhbmRsZUNvbnRleHRSZXN0b3JlZFxuICogQHBhcmFtIGV2ZW50IHtFdmVudH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmhhbmRsZUNvbnRleHRSZXN0b3JlZCA9IGZ1bmN0aW9uIGhhbmRsZUNvbnRleHRSZXN0b3JlZChldmVudClcbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsID0gdGhpcy52aWV3LmdldENvbnRleHQoXCJleHBlcmltZW50YWwtd2ViZ2xcIiwgIHtcbiAgICAgICAgYWxwaGE6IHRydWVcbiAgICB9KTtcblxuICAgIHRoaXMuaW5pdFNoYWRlcnMoKTtcblxuICAgIGZvcih2YXIga2V5IGluIFRleHR1cmUuY2FjaGUpXG4gICAge1xuICAgICAgICB2YXIgdGV4dHVyZSA9IFRleHR1cmUuY2FjaGVba2V5XS5iYXNlVGV4dHVyZTtcbiAgICAgICAgdGV4dHVyZS5fZ2xUZXh0dXJlID0gbnVsbDtcbiAgICAgICAgV2ViR0xSZW5kZXJHcm91cC51cGRhdGVUZXh0dXJlKGdsLCB0ZXh0dXJlKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuYmF0Y2hzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHRoaXMuYmF0Y2hzW2ldLnJlc3RvcmVMb3N0Q29udGV4dChnbCkvL1xuICAgICAgICB0aGlzLmJhdGNoc1tpXS5kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgV2ViR0xCYXRjaC5yZXN0b3JlQmF0Y2hlcyh0aGlzLmdsKTtcblxuICAgIHRoaXMuY29udGV4dExvc3QgPSBmYWxzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2ViR0xSZW5kZXJlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKTtcbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgbWF0MyA9IHJlcXVpcmUoJy4uLy4uL2dlb20vbWF0cml4JykubWF0MztcbnZhciBoZXgycmdiID0gcmVxdWlyZSgnLi4vLi4vdXRpbHMvY29sb3InKS5oZXgycmdiO1xudmFyIHRyaWFuZ3VsYXRlID0gcmVxdWlyZSgnLi4vLi4vdXRpbHMvUG9seWsnKS50cmlhbmd1bGF0ZTtcblxudmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vLi4vZ2VvbS9Qb2ludCcpO1xudmFyIEdyYXBoaWNzID0gcmVxdWlyZSgnLi4vLi4vcHJpbWl0aXZlcy9HcmFwaGljcycpO1xuXG4vKipcbiAqIEEgc2V0IG9mIGZ1bmN0aW9ucyB1c2VkIGJ5IHRoZSB3ZWJHTCByZW5kZXJlciB0byBkcmF3IHRoZSBwcmltaXRpdmUgZ3JhcGhpY3MgZGF0YVxuICpcbiAqIEBtb2R1bGUgcmVuZGVyZXJzL3dlYmdsL2dyYXBoaWNzXG4gKi9cblxuLyoqXG4gKiBSZW5kZXJzIHRoZSBncmFwaGljcyBvYmplY3RcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCByZW5kZXJHcmFwaGljc1xuICogQHBhcmFtIGdyYXBoaWNzIHtHcmFwaGljc31cbiAqIEBwYXJhbSBwcm9qZWN0aW9uIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMucmVuZGVyR3JhcGhpY3MgPSBmdW5jdGlvbiByZW5kZXJHcmFwaGljcyhncmFwaGljcywgcHJvamVjdGlvbilcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgaWYoIWdyYXBoaWNzLl93ZWJHTClncmFwaGljcy5fd2ViR0wgPSB7cG9pbnRzOltdLCBpbmRpY2VzOltdLCBsYXN0SW5kZXg6MCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXI6Z2wuY3JlYXRlQnVmZmVyKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhCdWZmZXI6Z2wuY3JlYXRlQnVmZmVyKCl9O1xuXG4gICAgaWYoZ3JhcGhpY3MuZGlydHkpXG4gICAge1xuICAgICAgICBncmFwaGljcy5kaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIGlmKGdyYXBoaWNzLmNsZWFyRGlydHkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGdyYXBoaWNzLmNsZWFyRGlydHkgPSBmYWxzZTtcblxuICAgICAgICAgICAgZ3JhcGhpY3MuX3dlYkdMLmxhc3RJbmRleCA9IDA7XG4gICAgICAgICAgICBncmFwaGljcy5fd2ViR0wucG9pbnRzID0gW107XG4gICAgICAgICAgICBncmFwaGljcy5fd2ViR0wuaW5kaWNlcyA9IFtdO1xuXG4gICAgICAgIH1cblxuICAgICAgICBleHBvcnRzLnVwZGF0ZUdyYXBoaWNzKGdyYXBoaWNzKTtcbiAgICB9XG5cblxuICAgIHNoYWRlcnMuYWN0aXZhdGVQcmltaXRpdmVTaGFkZXIoKTtcblxuICAgIC8vIFRoaXMgIGNvdWxkIGJlIHNwZWVkZWQgdXAgZm8gc3VyZSFcbiAgICB2YXIgbSA9IG1hdDMuY2xvbmUoZ3JhcGhpY3Mud29ybGRUcmFuc2Zvcm0pO1xuXG4gICAgbWF0My50cmFuc3Bvc2UobSk7XG5cbiAgICAvLyBzZXQgdGhlIG1hdHJpeCB0cmFuc2Zvcm0gZm9yIHRoZVxuICAgIGdsLmJsZW5kRnVuYyhnbC5PTkUsIGdsLk9ORV9NSU5VU19TUkNfQUxQSEEpO1xuXG4gICAgZ2wudW5pZm9ybU1hdHJpeDNmdihnbG9iYWxzLnByaW1pdGl2ZVByb2dyYW0udHJhbnNsYXRpb25NYXRyaXgsIGZhbHNlLCBtKTtcblxuICAgIGdsLnVuaWZvcm0yZihnbG9iYWxzLnByaW1pdGl2ZVByb2dyYW0ucHJvamVjdGlvblZlY3RvciwgcHJvamVjdGlvbi54LCBwcm9qZWN0aW9uLnkpO1xuXG4gICAgZ2wudW5pZm9ybTFmKGdsb2JhbHMucHJpbWl0aXZlUHJvZ3JhbS5hbHBoYSwgZ3JhcGhpY3Mud29ybGRBbHBoYSk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgZ3JhcGhpY3MuX3dlYkdMLmJ1ZmZlcik7XG5cbiAgICAvLyBXSFkgRE9FUyBUSElTIExJTkUgTkVFRCBUTyBCRSBUSEVSRT8/P1xuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoZ2xvYmFscy5zaGFkZXJQcm9ncmFtLnZlcnRleFBvc2l0aW9uQXR0cmlidXRlLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuICAgIC8vIGl0cyBub3QgZXZlbiB1c2VkLi4gYnV0IG5lZWQgdG8gYmUgc2V0IG9yIGl0IGJyZWFrcz9cbiAgICAvLyBvbmx5IG9uIHBjIHRob3VnaC4uXG5cbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGdsb2JhbHMucHJpbWl0aXZlUHJvZ3JhbS52ZXJ0ZXhQb3NpdGlvbkF0dHJpYnV0ZSwgMiwgZ2wuRkxPQVQsIGZhbHNlLCA0ICogNiwgMCk7XG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihnbG9iYWxzLnByaW1pdGl2ZVByb2dyYW0uY29sb3JBdHRyaWJ1dGUsIDQsIGdsLkZMT0FULCBmYWxzZSw0ICogNiwgMiAqIDQpO1xuXG4gICAgLy8gc2V0IHRoZSBpbmRleCBidWZmZXIhXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgZ3JhcGhpY3MuX3dlYkdMLmluZGV4QnVmZmVyKTtcblxuICAgIGdsLmRyYXdFbGVtZW50cyhnbC5UUklBTkdMRV9TVFJJUCwgIGdyYXBoaWNzLl93ZWJHTC5pbmRpY2VzLmxlbmd0aCwgZ2wuVU5TSUdORURfU0hPUlQsIDAgKTtcblxuICAgIC8vIHJldHVybiB0byBkZWZhdWx0IHNoYWRlci4uLlxuICAgIHNoYWRlcnMuYWN0aXZhdGVEZWZhdWx0U2hhZGVyKCk7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGhlIGdyYXBoaWNzIG9iamVjdFxuICpcbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIHVwZGF0ZUdyYXBoaWNzXG4gKiBAcGFyYW0gZ3JhcGhpY3Mge0dyYXBoaWNzfVxuICovXG5leHBvcnRzLnVwZGF0ZUdyYXBoaWNzID0gZnVuY3Rpb24gdXBkYXRlR3JhcGhpY3MoZ3JhcGhpY3MpXG57XG4gICAgZm9yICh2YXIgaT1ncmFwaGljcy5fd2ViR0wubGFzdEluZGV4OyBpIDwgZ3JhcGhpY3MuZ3JhcGhpY3NEYXRhLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGRhdGEgPSBncmFwaGljcy5ncmFwaGljc0RhdGFbaV07XG5cbiAgICAgICAgaWYoZGF0YS50eXBlID09IEdyYXBoaWNzLlBPTFkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKGRhdGEuZmlsbClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihkYXRhLnBvaW50cy5sZW5ndGg+MylcbiAgICAgICAgICAgICAgICBleHBvcnRzLmJ1aWxkUG9seShkYXRhLCBncmFwaGljcy5fd2ViR0wpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihkYXRhLmxpbmVXaWR0aCA+IDApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZXhwb3J0cy5idWlsZExpbmUoZGF0YSwgZ3JhcGhpY3MuX3dlYkdMKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRhdGEudHlwZSA9PSBHcmFwaGljcy5SRUNUKVxuICAgICAgICB7XG4gICAgICAgICAgICBleHBvcnRzLmJ1aWxkUmVjdGFuZ2xlKGRhdGEsIGdyYXBoaWNzLl93ZWJHTCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT0gR3JhcGhpY3MuQ0lSQyB8fCBkYXRhLnR5cGUgPT0gR3JhcGhpY3MuRUxJUClcbiAgICAgICAge1xuICAgICAgICAgICAgZXhwb3J0cy5idWlsZENpcmNsZShkYXRhLCBncmFwaGljcy5fd2ViR0wpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ3JhcGhpY3MuX3dlYkdMLmxhc3RJbmRleCA9IGdyYXBoaWNzLmdyYXBoaWNzRGF0YS5sZW5ndGg7XG5cbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgZ3JhcGhpY3MuX3dlYkdMLmdsUG9pbnRzID0gbmV3IEZsb2F0MzJBcnJheShncmFwaGljcy5fd2ViR0wucG9pbnRzKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBncmFwaGljcy5fd2ViR0wuYnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgZ3JhcGhpY3MuX3dlYkdMLmdsUG9pbnRzLCBnbC5TVEFUSUNfRFJBVyk7XG5cbiAgICBncmFwaGljcy5fd2ViR0wuZ2xJbmRpY2llcyA9IG5ldyBVaW50MTZBcnJheShncmFwaGljcy5fd2ViR0wuaW5kaWNlcyk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBncmFwaGljcy5fd2ViR0wuaW5kZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIGdyYXBoaWNzLl93ZWJHTC5nbEluZGljaWVzLCBnbC5TVEFUSUNfRFJBVyk7XG59O1xuXG4vKipcbiAqIEJ1aWxkcyBhIHJlY3RhbmdsZSB0byBkcmF3XG4gKlxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqIEBtZXRob2QgYnVpbGRSZWN0YW5nbGVcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gd2ViR0xEYXRhIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYnVpbGRSZWN0YW5nbGUgPSBmdW5jdGlvbiBidWlsZFJlY3RhbmdsZShncmFwaGljc0RhdGEsIHdlYkdMRGF0YSlcbntcbiAgICAvLyAtLS0gLy9cbiAgICAvLyBuZWVkIHRvIGNvbnZlcnQgcG9pbnRzIHRvIGEgbmljZSByZWd1bGFyIGRhdGFcbiAgICAvL1xuICAgIHZhciByZWN0RGF0YSA9IGdyYXBoaWNzRGF0YS5wb2ludHM7XG4gICAgdmFyIHggPSByZWN0RGF0YVswXTtcbiAgICB2YXIgeSA9IHJlY3REYXRhWzFdO1xuICAgIHZhciB3aWR0aCA9IHJlY3REYXRhWzJdO1xuICAgIHZhciBoZWlnaHQgPSByZWN0RGF0YVszXTtcblxuXG4gICAgaWYoZ3JhcGhpY3NEYXRhLmZpbGwpXG4gICAge1xuICAgICAgICB2YXIgY29sb3IgPSBoZXgycmdiKGdyYXBoaWNzRGF0YS5maWxsQ29sb3IpO1xuICAgICAgICB2YXIgYWxwaGEgPSBncmFwaGljc0RhdGEuZmlsbEFscGhhO1xuXG4gICAgICAgIHZhciByID0gY29sb3JbMF0gKiBhbHBoYTtcbiAgICAgICAgdmFyIGcgPSBjb2xvclsxXSAqIGFscGhhO1xuICAgICAgICB2YXIgYiA9IGNvbG9yWzJdICogYWxwaGE7XG5cbiAgICAgICAgdmFyIHZlcnRzID0gd2ViR0xEYXRhLnBvaW50cztcbiAgICAgICAgdmFyIGluZGljZXMgPSB3ZWJHTERhdGEuaW5kaWNlcztcblxuICAgICAgICB2YXIgdmVydFBvcyA9IHZlcnRzLmxlbmd0aC82O1xuXG4gICAgICAgIC8vIHN0YXJ0XG4gICAgICAgIHZlcnRzLnB1c2goeCwgeSk7XG4gICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgIHZlcnRzLnB1c2goeCArIHdpZHRoLCB5KTtcbiAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgdmVydHMucHVzaCh4ICwgeSArIGhlaWdodCk7XG4gICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgIHZlcnRzLnB1c2goeCArIHdpZHRoLCB5ICsgaGVpZ2h0KTtcbiAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgLy8gaW5zZXJ0IDIgZGVhZCB0cmlhbmdsZXMuLlxuICAgICAgICBpbmRpY2VzLnB1c2godmVydFBvcywgdmVydFBvcywgdmVydFBvcysxLCB2ZXJ0UG9zKzIsIHZlcnRQb3MrMywgdmVydFBvcyszKVxuICAgIH1cblxuICAgIGlmKGdyYXBoaWNzRGF0YS5saW5lV2lkdGgpXG4gICAge1xuICAgICAgICBncmFwaGljc0RhdGEucG9pbnRzID0gW3gsIHksXG4gICAgICAgICAgICAgICAgICB4ICsgd2lkdGgsIHksXG4gICAgICAgICAgICAgICAgICB4ICsgd2lkdGgsIHkgKyBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICB4LCB5ICsgaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgeCwgeV07XG5cbiAgICAgICAgZXhwb3J0cy5idWlsZExpbmUoZ3JhcGhpY3NEYXRhLCB3ZWJHTERhdGEpO1xuICAgIH1cbn07XG5cbi8qKlxuICogQnVpbGRzIGEgY2lyY2xlIHRvIGRyYXdcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBidWlsZENpcmNsZVxuICogQHBhcmFtIGdyYXBoaWNzIHtHcmFwaGljc31cbiAqIEBwYXJhbSB3ZWJHTERhdGEge09iamVjdH1cbiAqL1xuZXhwb3J0cy5idWlsZENpcmNsZSA9IGZ1bmN0aW9uIGJ1aWxkQ2lyY2xlKGdyYXBoaWNzRGF0YSwgd2ViR0xEYXRhKVxue1xuICAgIC8vIC0tLSAvL1xuICAgIC8vIG5lZWQgdG8gY29udmVydCBwb2ludHMgdG8gYSBuaWNlIHJlZ3VsYXIgZGF0YVxuICAgIC8vXG4gICAgdmFyIHJlY3REYXRhID0gZ3JhcGhpY3NEYXRhLnBvaW50cztcbiAgICB2YXIgeCA9IHJlY3REYXRhWzBdO1xuICAgIHZhciB5ID0gcmVjdERhdGFbMV07XG4gICAgdmFyIHdpZHRoID0gcmVjdERhdGFbMl07XG4gICAgdmFyIGhlaWdodCA9IHJlY3REYXRhWzNdO1xuXG4gICAgdmFyIHRvdGFsU2VncyA9IDQwO1xuICAgIHZhciBzZWcgPSAoTWF0aC5QSSAqIDIpIC8gdG90YWxTZWdzIDtcbiAgICB2YXIgaTtcblxuICAgIGlmIChncmFwaGljc0RhdGEuZmlsbClcbiAgICB7XG4gICAgICAgIHZhciBjb2xvciA9IGhleDJyZ2IoZ3JhcGhpY3NEYXRhLmZpbGxDb2xvcik7XG4gICAgICAgIHZhciBhbHBoYSA9IGdyYXBoaWNzRGF0YS5maWxsQWxwaGE7XG5cbiAgICAgICAgdmFyIHIgPSBjb2xvclswXSAqIGFscGhhO1xuICAgICAgICB2YXIgZyA9IGNvbG9yWzFdICogYWxwaGE7XG4gICAgICAgIHZhciBiID0gY29sb3JbMl0gKiBhbHBoYTtcblxuICAgICAgICB2YXIgdmVydHMgPSB3ZWJHTERhdGEucG9pbnRzO1xuICAgICAgICB2YXIgaW5kaWNlcyA9IHdlYkdMRGF0YS5pbmRpY2VzO1xuXG4gICAgICAgIHZhciB2ZWNQb3MgPSB2ZXJ0cy5sZW5ndGgvNjtcblxuICAgICAgICBpbmRpY2VzLnB1c2godmVjUG9zKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdG90YWxTZWdzICsgMSA7IGkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgdmVydHMucHVzaCh4LHksIHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgdmVydHMucHVzaCh4ICsgTWF0aC5zaW4oc2VnICogaSkgKiB3aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgeSArIE1hdGguY29zKHNlZyAqIGkpICogaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICByLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgICAgIGluZGljZXMucHVzaCh2ZWNQb3MrKywgdmVjUG9zKyspO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5kaWNlcy5wdXNoKHZlY1Bvcy0xKTtcbiAgICB9XG5cbiAgICBpZiAoZ3JhcGhpY3NEYXRhLmxpbmVXaWR0aClcbiAgICB7XG4gICAgICAgIGdyYXBoaWNzRGF0YS5wb2ludHMgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdG90YWxTZWdzICsgMTsgaSsrKVxuICAgICAgICB7XG4gICAgICAgICAgICBncmFwaGljc0RhdGEucG9pbnRzLnB1c2goeCArIE1hdGguc2luKHNlZyAqIGkpICogd2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeSArIE1hdGguY29zKHNlZyAqIGkpICogaGVpZ2h0KVxuICAgICAgICB9XG5cbiAgICAgICAgZXhwb3J0cy5idWlsZExpbmUoZ3JhcGhpY3NEYXRhLCB3ZWJHTERhdGEpO1xuICAgIH1cbn07XG5cbi8qKlxuICogQnVpbGRzIGEgbGluZSB0byBkcmF3XG4gKlxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqIEBtZXRob2QgYnVpbGRMaW5lXG4gKiBAcGFyYW0gZ3JhcGhpY3Mge0dyYXBoaWNzfVxuICogQHBhcmFtIHdlYkdMRGF0YSB7T2JqZWN0fVxuICovXG5leHBvcnRzLmJ1aWxkTGluZSA9IGZ1bmN0aW9uIGJ1aWxkTGluZShncmFwaGljc0RhdGEsIHdlYkdMRGF0YSlcbntcbiAgICAvLyBUT0RPIE9QVElNSVNFIVxuXG4gICAgdmFyIHdyYXAgPSB0cnVlO1xuICAgIHZhciBwb2ludHMgPSBncmFwaGljc0RhdGEucG9pbnRzO1xuICAgIGlmIChwb2ludHMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICAvLyBnZXQgZmlyc3QgYW5kIGxhc3QgcG9pbnQuLiBmaWd1cmUgb3V0IHRoZSBtaWRkbGUhXG4gICAgdmFyIGZpcnN0UG9pbnQgPSBuZXcgUG9pbnQoIHBvaW50c1swXSwgcG9pbnRzWzFdICk7XG4gICAgdmFyIGxhc3RQb2ludCA9IG5ldyBQb2ludCggcG9pbnRzW3BvaW50cy5sZW5ndGggLSAyXSwgcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXSApO1xuXG4gICAgLy8gaWYgdGhlIGZpcnN0IHBvaW50IGlzIHRoZSBsYXN0IHBvaW50IC0gZ29vbmEgaGF2ZSBpc3N1ZXMgOilcbiAgICBpZiAoZmlyc3RQb2ludC54ID09IGxhc3RQb2ludC54ICYmIGZpcnN0UG9pbnQueSA9PSBsYXN0UG9pbnQueSlcbiAgICB7XG4gICAgICAgIHBvaW50cy5wb3AoKTtcbiAgICAgICAgcG9pbnRzLnBvcCgpO1xuXG4gICAgICAgIGxhc3RQb2ludCA9IG5ldyBQb2ludCggcG9pbnRzW3BvaW50cy5sZW5ndGggLSAyXSwgcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXSApO1xuXG4gICAgICAgIHZhciBtaWRQb2ludFggPSBsYXN0UG9pbnQueCArIChmaXJzdFBvaW50LnggLSBsYXN0UG9pbnQueCkgKjAuNTtcbiAgICAgICAgdmFyIG1pZFBvaW50WSA9IGxhc3RQb2ludC55ICsgKGZpcnN0UG9pbnQueSAtIGxhc3RQb2ludC55KSAqMC41O1xuXG4gICAgICAgIHBvaW50cy51bnNoaWZ0KG1pZFBvaW50WCwgbWlkUG9pbnRZKTtcbiAgICAgICAgcG9pbnRzLnB1c2gobWlkUG9pbnRYLCBtaWRQb2ludFkpXG4gICAgfVxuXG4gICAgdmFyIHZlcnRzID0gd2ViR0xEYXRhLnBvaW50cztcbiAgICB2YXIgaW5kaWNlcyA9IHdlYkdMRGF0YS5pbmRpY2VzO1xuICAgIHZhciBsZW5ndGggPSBwb2ludHMubGVuZ3RoIC8gMjtcbiAgICB2YXIgaW5kZXhDb3VudCA9IHBvaW50cy5sZW5ndGg7XG4gICAgdmFyIGluZGV4U3RhcnQgPSB2ZXJ0cy5sZW5ndGgvNjtcblxuICAgIC8vIERSQVcgdGhlIExpbmVcbiAgICB2YXIgd2lkdGggPSBncmFwaGljc0RhdGEubGluZVdpZHRoIC8gMjtcblxuICAgIC8vIHNvcnQgY29sb3JcbiAgICB2YXIgY29sb3IgPSBoZXgycmdiKGdyYXBoaWNzRGF0YS5saW5lQ29sb3IpO1xuICAgIHZhciBhbHBoYSA9IGdyYXBoaWNzRGF0YS5saW5lQWxwaGE7XG4gICAgdmFyIHIgPSBjb2xvclswXSAqIGFscGhhO1xuICAgIHZhciBnID0gY29sb3JbMV0gKiBhbHBoYTtcbiAgICB2YXIgYiA9IGNvbG9yWzJdICogYWxwaGE7XG5cbiAgICB2YXIgcDF4LCBwMXksIHAyeCwgcDJ5LCBwM3gsIHAzeTtcbiAgICB2YXIgcGVycHgsIHBlcnB5LCBwZXJwMngsIHBlcnAyeSwgcGVycDN4LCBwZXJwM3k7XG4gICAgdmFyIGlweCwgaXB5O1xuICAgIHZhciBhMSwgYjEsIGMxLCBhMiwgYjIsIGMyO1xuICAgIHZhciBkZW5vbSwgcGRpc3QsIGRpc3Q7XG4gICAgdmFyIHB4LCBweTtcblxuICAgIHAxeCA9IHBvaW50c1swXTtcbiAgICBwMXkgPSBwb2ludHNbMV07XG5cbiAgICBwMnggPSBwb2ludHNbMl07XG4gICAgcDJ5ID0gcG9pbnRzWzNdO1xuXG4gICAgcGVycHggPSAtKHAxeSAtIHAyeSk7XG4gICAgcGVycHkgPSAgcDF4IC0gcDJ4O1xuXG4gICAgZGlzdCA9IE1hdGguc3FydChwZXJweCpwZXJweCArIHBlcnB5KnBlcnB5KTtcblxuICAgIHBlcnB4IC89IGRpc3Q7XG4gICAgcGVycHkgLz0gZGlzdDtcbiAgICBwZXJweCAqPSB3aWR0aDtcbiAgICBwZXJweSAqPSB3aWR0aDtcblxuICAgIC8vIHN0YXJ0XG4gICAgdmVydHMucHVzaChwMXggLSBwZXJweCAsIHAxeSAtIHBlcnB5LFxuICAgICAgICAgICAgICAgIHIsIGcsIGIsIGFscGhhKTtcblxuICAgIHZlcnRzLnB1c2gocDF4ICsgcGVycHggLCBwMXkgKyBwZXJweSxcbiAgICAgICAgICAgICAgICByLCBnLCBiLCBhbHBoYSk7XG5cbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IGxlbmd0aC0xOyBpKyspXG4gICAge1xuICAgICAgICBwMXggPSBwb2ludHNbKGktMSkqMl07XG4gICAgICAgIHAxeSA9IHBvaW50c1soaS0xKSoyICsgMV07XG5cbiAgICAgICAgcDJ4ID0gcG9pbnRzWyhpKSoyXVxuICAgICAgICBwMnkgPSBwb2ludHNbKGkpKjIgKyAxXVxuXG4gICAgICAgIHAzeCA9IHBvaW50c1soaSsxKSoyXTtcbiAgICAgICAgcDN5ID0gcG9pbnRzWyhpKzEpKjIgKyAxXTtcblxuICAgICAgICBwZXJweCA9IC0ocDF5IC0gcDJ5KTtcbiAgICAgICAgcGVycHkgPSBwMXggLSBwMng7XG5cbiAgICAgICAgZGlzdCA9IE1hdGguc3FydChwZXJweCpwZXJweCArIHBlcnB5KnBlcnB5KTtcbiAgICAgICAgcGVycHggLz0gZGlzdDtcbiAgICAgICAgcGVycHkgLz0gZGlzdDtcbiAgICAgICAgcGVycHggKj0gd2lkdGg7XG4gICAgICAgIHBlcnB5ICo9IHdpZHRoO1xuXG4gICAgICAgIHBlcnAyeCA9IC0ocDJ5IC0gcDN5KTtcbiAgICAgICAgcGVycDJ5ID0gcDJ4IC0gcDN4O1xuXG4gICAgICAgIGRpc3QgPSBNYXRoLnNxcnQocGVycDJ4KnBlcnAyeCArIHBlcnAyeSpwZXJwMnkpO1xuICAgICAgICBwZXJwMnggLz0gZGlzdDtcbiAgICAgICAgcGVycDJ5IC89IGRpc3Q7XG4gICAgICAgIHBlcnAyeCAqPSB3aWR0aDtcbiAgICAgICAgcGVycDJ5ICo9IHdpZHRoO1xuXG4gICAgICAgIGExID0gKC1wZXJweSArIHAxeSkgLSAoLXBlcnB5ICsgcDJ5KTtcbiAgICAgICAgYjEgPSAoLXBlcnB4ICsgcDJ4KSAtICgtcGVycHggKyBwMXgpO1xuICAgICAgICBjMSA9ICgtcGVycHggKyBwMXgpICogKC1wZXJweSArIHAyeSkgLSAoLXBlcnB4ICsgcDJ4KSAqICgtcGVycHkgKyBwMXkpO1xuICAgICAgICBhMiA9ICgtcGVycDJ5ICsgcDN5KSAtICgtcGVycDJ5ICsgcDJ5KTtcbiAgICAgICAgYjIgPSAoLXBlcnAyeCArIHAyeCkgLSAoLXBlcnAyeCArIHAzeCk7XG4gICAgICAgIGMyID0gKC1wZXJwMnggKyBwM3gpICogKC1wZXJwMnkgKyBwMnkpIC0gKC1wZXJwMnggKyBwMngpICogKC1wZXJwMnkgKyBwM3kpO1xuXG4gICAgICAgIGRlbm9tID0gYTEqYjIgLSBhMipiMTtcblxuICAgICAgICBpZiAoZGVub20gPT09IDApIHtcbiAgICAgICAgICAgIGRlbm9tKz0xO1xuICAgICAgICB9XG5cbiAgICAgICAgcHggPSAoYjEqYzIgLSBiMipjMSkvZGVub207XG4gICAgICAgIHB5ID0gKGEyKmMxIC0gYTEqYzIpL2Rlbm9tO1xuXG4gICAgICAgIHBkaXN0ID0gKHB4IC1wMngpICogKHB4IC1wMngpICsgKHB5IC1wMnkpICsgKHB5IC1wMnkpO1xuXG4gICAgICAgIGlmKHBkaXN0ID4gMTQwICogMTQwKVxuICAgICAgICB7XG4gICAgICAgICAgICBwZXJwM3ggPSBwZXJweCAtIHBlcnAyeDtcbiAgICAgICAgICAgIHBlcnAzeSA9IHBlcnB5IC0gcGVycDJ5O1xuXG4gICAgICAgICAgICBkaXN0ID0gTWF0aC5zcXJ0KHBlcnAzeCpwZXJwM3ggKyBwZXJwM3kqcGVycDN5KTtcbiAgICAgICAgICAgIHBlcnAzeCAvPSBkaXN0O1xuICAgICAgICAgICAgcGVycDN5IC89IGRpc3Q7XG4gICAgICAgICAgICBwZXJwM3ggKj0gd2lkdGg7XG4gICAgICAgICAgICBwZXJwM3kgKj0gd2lkdGg7XG5cbiAgICAgICAgICAgIHZlcnRzLnB1c2gocDJ4IC0gcGVycDN4LCBwMnkgLXBlcnAzeSk7XG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgdmVydHMucHVzaChwMnggKyBwZXJwM3gsIHAyeSArcGVycDN5KTtcbiAgICAgICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHAyeCAtIHBlcnAzeCwgcDJ5IC1wZXJwM3kpO1xuICAgICAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgICAgIGluZGV4Q291bnQrKztcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZlcnRzLnB1c2gocHggLCBweSk7XG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgdmVydHMucHVzaChwMnggLSAocHgtcDJ4KSwgcDJ5IC0gKHB5IC0gcDJ5KSk7XG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHIsIGcsIGIsIGFscGhhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHAxeCA9IHBvaW50c1sobGVuZ3RoLTIpKjJdXG4gICAgcDF5ID0gcG9pbnRzWyhsZW5ndGgtMikqMiArIDFdXG5cbiAgICBwMnggPSBwb2ludHNbKGxlbmd0aC0xKSoyXVxuICAgIHAyeSA9IHBvaW50c1sobGVuZ3RoLTEpKjIgKyAxXVxuXG4gICAgcGVycHggPSAtKHAxeSAtIHAyeSlcbiAgICBwZXJweSA9IHAxeCAtIHAyeDtcblxuICAgIGRpc3QgPSBNYXRoLnNxcnQocGVycHgqcGVycHggKyBwZXJweSpwZXJweSk7XG4gICAgcGVycHggLz0gZGlzdDtcbiAgICBwZXJweSAvPSBkaXN0O1xuICAgIHBlcnB4ICo9IHdpZHRoO1xuICAgIHBlcnB5ICo9IHdpZHRoO1xuXG4gICAgdmVydHMucHVzaChwMnggLSBwZXJweCAsIHAyeSAtIHBlcnB5KVxuICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgdmVydHMucHVzaChwMnggKyBwZXJweCAsIHAyeSArIHBlcnB5KVxuICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgaW5kaWNlcy5wdXNoKGluZGV4U3RhcnQpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGluZGV4Q291bnQ7IGkrKylcbiAgICB7XG4gICAgICAgIGluZGljZXMucHVzaChpbmRleFN0YXJ0KyspO1xuICAgIH1cblxuICAgIGluZGljZXMucHVzaChpbmRleFN0YXJ0LTEpO1xufTtcblxuLyoqXG4gKiBCdWlsZHMgYSBwb2x5Z29uIHRvIGRyYXdcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBidWlsZFBvbHlcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gd2ViR0xEYXRhIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYnVpbGRQb2x5ID0gZnVuY3Rpb24gYnVpbGRQb2x5KGdyYXBoaWNzRGF0YSwgd2ViR0xEYXRhKVxue1xuICAgIHZhciBwb2ludHMgPSBncmFwaGljc0RhdGEucG9pbnRzO1xuICAgIGlmIChwb2ludHMubGVuZ3RoIDwgNikgcmV0dXJuO1xuXG4gICAgLy8gZ2V0IGZpcnN0IGFuZCBsYXN0IHBvaW50Li4gZmlndXJlIG91dCB0aGUgbWlkZGxlIVxuICAgIHZhciB2ZXJ0cyA9IHdlYkdMRGF0YS5wb2ludHM7XG4gICAgdmFyIGluZGljZXMgPSB3ZWJHTERhdGEuaW5kaWNlcztcblxuICAgIHZhciB0cmlhbmdsZXMgPSB0cmlhbmd1bGF0ZShwb2ludHMpO1xuICAgIHZhciB2ZXJ0UG9zID0gdmVydHMubGVuZ3RoIC8gNjtcblxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdHJpYW5nbGVzLmxlbmd0aDsgaSA8IGw7IGkrPTMpXG4gICAge1xuICAgICAgICBpbmRpY2VzLnB1c2godHJpYW5nbGVzW2ldICsgdmVydFBvcyk7XG4gICAgICAgIGluZGljZXMucHVzaCh0cmlhbmdsZXNbaV0gKyB2ZXJ0UG9zKTtcbiAgICAgICAgaW5kaWNlcy5wdXNoKHRyaWFuZ2xlc1tpKzFdICsgdmVydFBvcyk7XG4gICAgICAgIGluZGljZXMucHVzaCh0cmlhbmdsZXNbaSsyXSArdmVydFBvcyk7XG4gICAgICAgIGluZGljZXMucHVzaCh0cmlhbmdsZXNbaSsyXSArIHZlcnRQb3MpO1xuICAgIH1cblxuICAgIC8vIHNvcnQgY29sb3JcbiAgICB2YXIgY29sb3IgPSBoZXgycmdiKGdyYXBoaWNzRGF0YS5maWxsQ29sb3IpO1xuICAgIHZhciBhbHBoYSA9IGdyYXBoaWNzRGF0YS5maWxsQWxwaGE7XG4gICAgdmFyIHIgPSBjb2xvclswXSAqIGFscGhhO1xuICAgIHZhciBnID0gY29sb3JbMV0gKiBhbHBoYTtcbiAgICB2YXIgYiA9IGNvbG9yWzJdICogYWxwaGE7XG5cbiAgICBmb3IgKGkgPSAwLCBsID0gcG9pbnRzLmxlbmd0aCAvIDI7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2ZXJ0cy5wdXNoKHBvaW50c1tpICogMl0sIHBvaW50c1tpICogMiArIDFdLFxuICAgICAgICAgICAgICAgICAgIHIsIGcsIGIsIGFscGhhKTtcbiAgICB9XG59O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi8uLi9wbGF0Zm9ybScpO1xudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi8uLi9jb3JlL2dsb2JhbHMnKTtcblxuLypcbiAqIHRoZSBkZWZhdWx0IHN1b2VyIGZhc3Qgc2hhZGVyIVxuICovXG5cbnZhciBzaGFkZXJGcmFnbWVudFNyYyA9IFtcbiAgICBcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1wiLFxuICAgIFwidmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7XCIsXG4gICAgXCJ2YXJ5aW5nIGZsb2F0IHZDb2xvcjtcIixcbiAgICBcInVuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyO1wiLFxuICAgIFwidm9pZCBtYWluKHZvaWQpIHtcIixcbiAgICAgICAgXCJnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkpKTtcIixcbiAgICAgICAgXCJnbF9GcmFnQ29sb3IgPSBnbF9GcmFnQ29sb3IgKiB2Q29sb3I7XCIsXG4gICAgXCJ9XCJcbl0uam9pbihcIlxcblwiKTtcblxudmFyIHNoYWRlclZlcnRleFNyYyA9IFtcbiAgICBcImF0dHJpYnV0ZSB2ZWMyIGFWZXJ0ZXhQb3NpdGlvbjtcIixcbiAgICBcImF0dHJpYnV0ZSB2ZWMyIGFUZXh0dXJlQ29vcmQ7XCIsXG4gICAgXCJhdHRyaWJ1dGUgZmxvYXQgYUNvbG9yO1wiLFxuICAgIC8vXCJ1bmlmb3JtIG1hdDQgdU1WTWF0cml4O1wiLFxuXG4gICAgXCJ1bmlmb3JtIHZlYzIgcHJvamVjdGlvblZlY3RvcjtcIixcbiAgICBcInZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkO1wiLFxuICAgIFwidmFyeWluZyBmbG9hdCB2Q29sb3I7XCIsXG4gICAgXCJ2b2lkIG1haW4odm9pZCkge1wiLFxuICAgICAgICAvLyBcImdsX1Bvc2l0aW9uID0gdU1WTWF0cml4ICogdmVjNChhVmVydGV4UG9zaXRpb24sIDEuMCwgMS4wKTtcIixcbiAgICAgICAgXCJnbF9Qb3NpdGlvbiA9IHZlYzQoIGFWZXJ0ZXhQb3NpdGlvbi54IC8gcHJvamVjdGlvblZlY3Rvci54IC0xLjAsIGFWZXJ0ZXhQb3NpdGlvbi55IC8gLXByb2plY3Rpb25WZWN0b3IueSArIDEuMCAsIDAuMCwgMS4wKTtcIixcbiAgICAgICAgXCJ2VGV4dHVyZUNvb3JkID0gYVRleHR1cmVDb29yZDtcIixcbiAgICAgICAgXCJ2Q29sb3IgPSBhQ29sb3I7XCIsXG4gICAgXCJ9XCJcbl0uam9pbihcIlxcblwiKTtcblxuLypcbiAqIHRoZSB0cmlhbmdsZSBzdHJpcCBzaGFkZXIuLlxuICovXG5cbnZhciBzdHJpcFNoYWRlckZyYWdtZW50U3JjID0gW1xuICAgIFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XCIsXG4gICAgXCJ2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDtcIixcbiAgICBcInZhcnlpbmcgZmxvYXQgdkNvbG9yO1wiLFxuICAgIFwidW5pZm9ybSBmbG9hdCBhbHBoYTtcIixcbiAgICBcInVuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyO1wiLFxuICAgIFwidm9pZCBtYWluKHZvaWQpIHtcIixcbiAgICAgICAgXCJnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkpKTtcIixcbiAgICAgICAgXCJnbF9GcmFnQ29sb3IgPSBnbF9GcmFnQ29sb3IgKiBhbHBoYTtcIixcbiAgICBcIn1cIlxuXS5qb2luKFwiXFxuXCIpO1xuXG5cbnZhciBzdHJpcFNoYWRlclZlcnRleFNyYyA9IFtcbiAgICBcImF0dHJpYnV0ZSB2ZWMyIGFWZXJ0ZXhQb3NpdGlvbjtcIixcbiAgICBcImF0dHJpYnV0ZSB2ZWMyIGFUZXh0dXJlQ29vcmQ7XCIsXG4gICAgXCJhdHRyaWJ1dGUgZmxvYXQgYUNvbG9yO1wiLFxuICAgIFwidW5pZm9ybSBtYXQzIHRyYW5zbGF0aW9uTWF0cml4O1wiLFxuICAgIFwidW5pZm9ybSB2ZWMyIHByb2plY3Rpb25WZWN0b3I7XCIsXG4gICAgXCJ2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDtcIixcbiAgICBcInZhcnlpbmcgZmxvYXQgdkNvbG9yO1wiLFxuICAgIFwidm9pZCBtYWluKHZvaWQpIHtcIixcbiAgICBcInZlYzMgdiA9IHRyYW5zbGF0aW9uTWF0cml4ICogdmVjMyhhVmVydGV4UG9zaXRpb24sIDEuMCk7XCIsXG4gICAgICAgIFwiZ2xfUG9zaXRpb24gPSB2ZWM0KCB2LnggLyBwcm9qZWN0aW9uVmVjdG9yLnggLTEuMCwgdi55IC8gLXByb2plY3Rpb25WZWN0b3IueSArIDEuMCAsIDAuMCwgMS4wKTtcIixcbiAgICAgICAgXCJ2VGV4dHVyZUNvb3JkID0gYVRleHR1cmVDb29yZDtcIixcbiAgICAgICAgXCJ2Q29sb3IgPSBhQ29sb3I7XCIsXG4gICAgXCJ9XCJcbl0uam9pbihcIlxcblwiKTtcblxuXG4vKlxuICogcHJpbWl0aXZlIHNoYWRlci4uXG4gKi9cblxudmFyIHByaW1pdGl2ZVNoYWRlckZyYWdtZW50U3JjID0gW1xuICAgIFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XCIsXG4gICAgXCJ2YXJ5aW5nIHZlYzQgdkNvbG9yO1wiLFxuICAgIFwidm9pZCBtYWluKHZvaWQpIHtcIixcbiAgICAgICAgXCJnbF9GcmFnQ29sb3IgPSB2Q29sb3I7XCIsXG4gICAgXCJ9XCJcbl0uam9pbihcIlxcblwiKTtcblxudmFyIHByaW1pdGl2ZVNoYWRlclZlcnRleFNyYyA9IFtcbiAgICBcImF0dHJpYnV0ZSB2ZWMyIGFWZXJ0ZXhQb3NpdGlvbjtcIixcbiAgICBcImF0dHJpYnV0ZSB2ZWM0IGFDb2xvcjtcIixcbiAgICBcInVuaWZvcm0gbWF0MyB0cmFuc2xhdGlvbk1hdHJpeDtcIixcbiAgICBcInVuaWZvcm0gdmVjMiBwcm9qZWN0aW9uVmVjdG9yO1wiLFxuICAgIFwidW5pZm9ybSBmbG9hdCBhbHBoYTtcIixcbiAgICBcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXG4gICAgXCJ2b2lkIG1haW4odm9pZCkge1wiLFxuICAgICAgICBcInZlYzMgdiA9IHRyYW5zbGF0aW9uTWF0cml4ICogdmVjMyhhVmVydGV4UG9zaXRpb24sIDEuMCk7XCIsXG4gICAgICAgIFwiZ2xfUG9zaXRpb24gPSB2ZWM0KCB2LnggLyBwcm9qZWN0aW9uVmVjdG9yLnggLTEuMCwgdi55IC8gLXByb2plY3Rpb25WZWN0b3IueSArIDEuMCAsIDAuMCwgMS4wKTtcIixcbiAgICAgICAgXCJ2Q29sb3IgPSBhQ29sb3IgICogYWxwaGE7XCIsXG4gICAgXCJ9XCJcbl0uam9pbihcIlxcblwiKTtcblxuZnVuY3Rpb24gY29tcGlsZVNoYWRlcihnbCwgc2hhZGVyU3JjLCBzaGFkZXJUeXBlKVxue1xuICAgIHZhciBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoc2hhZGVyVHlwZSk7XG4gICAgZ2wuc2hhZGVyU291cmNlKHNoYWRlciwgc2hhZGVyU3JjKTtcbiAgICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cbiAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgICBwbGF0Zm9ybS5jb25zb2xlLmVycm9yKGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBzaGFkZXI7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVQcm9ncmFtKHZlcnRleFNyYywgZnJhZ21lbnRTcmMpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcbiAgICB2YXIgZnJhZ21lbnRTaGFkZXIgPSBjb21waWxlU2hhZGVyKGdsLCBmcmFnbWVudFNyYywgZ2wuRlJBR01FTlRfU0hBREVSKTtcbiAgICB2YXIgdmVydGV4U2hhZGVyID0gY29tcGlsZVNoYWRlcihnbCwgdmVydGV4U3JjLCBnbC5WRVJURVhfU0hBREVSKTtcblxuICAgIHZhciBzaGFkZXJQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuXG4gICAgZ2wuYXR0YWNoU2hhZGVyKHNoYWRlclByb2dyYW0sIHZlcnRleFNoYWRlcik7XG4gICAgZ2wuYXR0YWNoU2hhZGVyKHNoYWRlclByb2dyYW0sIGZyYWdtZW50U2hhZGVyKTtcbiAgICBnbC5saW5rUHJvZ3JhbShzaGFkZXJQcm9ncmFtKTtcblxuICAgIGlmICghZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihzaGFkZXJQcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcbiAgICAgICAgcGxhdGZvcm0uY29uc29sZS5lcnJvcihcIkNvdWxkIG5vdCBpbml0aWFsaXNlIHNoYWRlcnNcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNoYWRlclByb2dyYW07XG59XG5cbmV4cG9ydHMuaW5pdERlZmF1bHRTaGFkZXIgPSBmdW5jdGlvbiBpbml0RGVmYXVsdFNoYWRlcigpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcbiAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IGNvbXBpbGVQcm9ncmFtKHNoYWRlclZlcnRleFNyYywgc2hhZGVyRnJhZ21lbnRTcmMpXG5cbiAgICBnbC51c2VQcm9ncmFtKHNoYWRlclByb2dyYW0pO1xuXG4gICAgc2hhZGVyUHJvZ3JhbS52ZXJ0ZXhQb3NpdGlvbkF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHNoYWRlclByb2dyYW0sIFwiYVZlcnRleFBvc2l0aW9uXCIpO1xuICAgIHNoYWRlclByb2dyYW0ucHJvamVjdGlvblZlY3RvciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihzaGFkZXJQcm9ncmFtLCBcInByb2plY3Rpb25WZWN0b3JcIik7XG4gICAgc2hhZGVyUHJvZ3JhbS50ZXh0dXJlQ29vcmRBdHRyaWJ1dGUgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihzaGFkZXJQcm9ncmFtLCBcImFUZXh0dXJlQ29vcmRcIik7XG4gICAgc2hhZGVyUHJvZ3JhbS5jb2xvckF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHNoYWRlclByb2dyYW0sIFwiYUNvbG9yXCIpO1xuXG4gICAgLy8gc2hhZGVyUHJvZ3JhbS5tdk1hdHJpeFVuaWZvcm0gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24oc2hhZGVyUHJvZ3JhbSwgXCJ1TVZNYXRyaXhcIik7XG4gICAgc2hhZGVyUHJvZ3JhbS5zYW1wbGVyVW5pZm9ybSA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihzaGFkZXJQcm9ncmFtLCBcInVTYW1wbGVyXCIpO1xuXG4gICAgZ2xvYmFscy5zaGFkZXJQcm9ncmFtID0gc2hhZGVyUHJvZ3JhbTtcbn07XG5cbmV4cG9ydHMuaW5pdFByaW1pdGl2ZVNoYWRlciA9IGZ1bmN0aW9uIGluaXRQcmltaXRpdmVTaGFkZXIoKVxue1xuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG5cbiAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IGNvbXBpbGVQcm9ncmFtKHByaW1pdGl2ZVNoYWRlclZlcnRleFNyYywgcHJpbWl0aXZlU2hhZGVyRnJhZ21lbnRTcmMpXG5cbiAgICBnbC51c2VQcm9ncmFtKHNoYWRlclByb2dyYW0pO1xuXG4gICAgc2hhZGVyUHJvZ3JhbS52ZXJ0ZXhQb3NpdGlvbkF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHNoYWRlclByb2dyYW0sIFwiYVZlcnRleFBvc2l0aW9uXCIpO1xuICAgIHNoYWRlclByb2dyYW0uY29sb3JBdHRyaWJ1dGUgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihzaGFkZXJQcm9ncmFtLCBcImFDb2xvclwiKTtcblxuICAgIHNoYWRlclByb2dyYW0ucHJvamVjdGlvblZlY3RvciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihzaGFkZXJQcm9ncmFtLCBcInByb2plY3Rpb25WZWN0b3JcIik7XG4gICAgc2hhZGVyUHJvZ3JhbS50cmFuc2xhdGlvbk1hdHJpeCA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihzaGFkZXJQcm9ncmFtLCBcInRyYW5zbGF0aW9uTWF0cml4XCIpO1xuXG4gICAgc2hhZGVyUHJvZ3JhbS5hbHBoYSA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihzaGFkZXJQcm9ncmFtLCBcImFscGhhXCIpO1xuXG4gICAgZ2xvYmFscy5wcmltaXRpdmVQcm9ncmFtID0gc2hhZGVyUHJvZ3JhbTtcbn07XG5cbmV4cG9ydHMuaW5pdERlZmF1bHRTdHJpcFNoYWRlciA9IGZ1bmN0aW9uIGluaXREZWZhdWx0U3RyaXBTaGFkZXIoKVxue1xuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG4gICAgdmFyIHNoYWRlclByb2dyYW0gPSBjb21waWxlUHJvZ3JhbShzdHJpcFNoYWRlclZlcnRleFNyYywgc3RyaXBTaGFkZXJGcmFnbWVudFNyYylcblxuICAgIGdsLnVzZVByb2dyYW0oc2hhZGVyUHJvZ3JhbSk7XG5cbiAgICBzaGFkZXJQcm9ncmFtLnZlcnRleFBvc2l0aW9uQXR0cmlidXRlID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24oc2hhZGVyUHJvZ3JhbSwgXCJhVmVydGV4UG9zaXRpb25cIik7XG4gICAgc2hhZGVyUHJvZ3JhbS5wcm9qZWN0aW9uVmVjdG9yID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHNoYWRlclByb2dyYW0sIFwicHJvamVjdGlvblZlY3RvclwiKTtcbiAgICBzaGFkZXJQcm9ncmFtLnRleHR1cmVDb29yZEF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHNoYWRlclByb2dyYW0sIFwiYVRleHR1cmVDb29yZFwiKTtcbiAgICBzaGFkZXJQcm9ncmFtLnRyYW5zbGF0aW9uTWF0cml4ID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHNoYWRlclByb2dyYW0sIFwidHJhbnNsYXRpb25NYXRyaXhcIik7XG4gICAgc2hhZGVyUHJvZ3JhbS5hbHBoYSA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihzaGFkZXJQcm9ncmFtLCBcImFscGhhXCIpO1xuXG4gICAgc2hhZGVyUHJvZ3JhbS5jb2xvckF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHNoYWRlclByb2dyYW0sIFwiYUNvbG9yXCIpO1xuXG4gICAgc2hhZGVyUHJvZ3JhbS5wcm9qZWN0aW9uVmVjdG9yID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHNoYWRlclByb2dyYW0sIFwicHJvamVjdGlvblZlY3RvclwiKTtcblxuICAgIHNoYWRlclByb2dyYW0uc2FtcGxlclVuaWZvcm0gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24oc2hhZGVyUHJvZ3JhbSwgXCJ1U2FtcGxlclwiKTtcblxuICAgIGdsb2JhbHMuc3RyaXBTaGFkZXJQcm9ncmFtID0gc2hhZGVyUHJvZ3JhbTtcbn07XG5cbmV4cG9ydHMuYWN0aXZhdGVEZWZhdWx0U2hhZGVyID0gZnVuY3Rpb24gYWN0aXZhdGVEZWZhdWx0U2hhZGVyKClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuICAgIHZhciBzaGFkZXJQcm9ncmFtID0gZ2xvYmFscy5zaGFkZXJQcm9ncmFtO1xuXG4gICAgZ2wudXNlUHJvZ3JhbShzaGFkZXJQcm9ncmFtKTtcblxuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHNoYWRlclByb2dyYW0udmVydGV4UG9zaXRpb25BdHRyaWJ1dGUpO1xuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHNoYWRlclByb2dyYW0udGV4dHVyZUNvb3JkQXR0cmlidXRlKTtcbiAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShzaGFkZXJQcm9ncmFtLmNvbG9yQXR0cmlidXRlKTtcbn07XG5cbmV4cG9ydHMuYWN0aXZhdGVQcmltaXRpdmVTaGFkZXIgPSBmdW5jdGlvbiBhY3RpdmF0ZVByaW1pdGl2ZVNoYWRlcigpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIGdsLmRpc2FibGVWZXJ0ZXhBdHRyaWJBcnJheShnbG9iYWxzLnNoYWRlclByb2dyYW0udGV4dHVyZUNvb3JkQXR0cmlidXRlKTtcbiAgICBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5zaGFkZXJQcm9ncmFtLmNvbG9yQXR0cmlidXRlKTtcblxuICAgIGdsLnVzZVByb2dyYW0oZ2xvYmFscy5wcmltaXRpdmVQcm9ncmFtKTtcblxuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMucHJpbWl0aXZlUHJvZ3JhbS52ZXJ0ZXhQb3NpdGlvbkF0dHJpYnV0ZSk7XG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5wcmltaXRpdmVQcm9ncmFtLmNvbG9yQXR0cmlidXRlKTtcbn07XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG52YXIgU3ByaXRlID0gcmVxdWlyZSgnLi4vZGlzcGxheS9TcHJpdGUnKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcblxuLyoqXG4gKiBBIFRleHQgT2JqZWN0IHdpbGwgY3JlYXRlIGEgbGluZShzKSBvZiB0ZXh0IHVzaW5nIGJpdG1hcCBmb250LiBUbyBzcGxpdCBhIGxpbmUgeW91IGNhbiB1c2UgXCJcXG5cIiwgXCJcXHJcIiBvciBcIlxcclxcblwiXG4gKiBZb3UgY2FuIGdlbmVyYXRlIHRoZSBmbnQgZmlsZXMgdXNpbmdcbiAqIGh0dHA6Ly93d3cuYW5nZWxjb2RlLmNvbS9wcm9kdWN0cy9ibWZvbnQvIGZvciB3aW5kb3dzIG9yXG4gKiBodHRwOi8vd3d3LmJtZ2x5cGguY29tLyBmb3IgbWFjLlxuICpcbiAqIEBjbGFzcyBCaXRtYXBUZXh0XG4gKiBAZXh0ZW5kcyBEaXNwbGF5T2JqZWN0Q29udGFpbmVyXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB0ZXh0IHtTdHJpbmd9IFRoZSBjb3B5IHRoYXQgeW91IHdvdWxkIGxpa2UgdGhlIHRleHQgdG8gZGlzcGxheVxuICogQHBhcmFtIHN0eWxlIHtPYmplY3R9IFRoZSBzdHlsZSBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0gc3R5bGUuZm9udCB7U3RyaW5nfSBUaGUgc2l6ZSAob3B0aW9uYWwpIGFuZCBiaXRtYXAgZm9udCBpZCAocmVxdWlyZWQpIGVxIFwiQXJpYWxcIiBvciBcIjIwcHggQXJpYWxcIiAobXVzdCBoYXZlIGxvYWRlZCBwcmV2aW91c2x5KVxuICogQHBhcmFtIFtzdHlsZS5hbGlnbj1cImxlZnRcIl0ge1N0cmluZ30gQW4gYWxpZ25tZW50IG9mIHRoZSBtdWx0aWxpbmUgdGV4dCAoXCJsZWZ0XCIsIFwiY2VudGVyXCIgb3IgXCJyaWdodFwiKVxuICovXG5mdW5jdGlvbiBCaXRtYXBUZXh0KHRleHQsIHN0eWxlKVxue1xuICAgIERpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMuc2V0VGV4dCh0ZXh0KTtcbiAgICB0aGlzLnNldFN0eWxlKHN0eWxlKTtcbiAgICB0aGlzLnVwZGF0ZVRleHQoKTtcbiAgICB0aGlzLmRpcnR5ID0gZmFsc2Vcbn1cblxudmFyIHByb3RvID0gQml0bWFwVGV4dC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogQml0bWFwVGV4dH1cbn0pO1xuXG4vKipcbiAqIFNldCB0aGUgY29weSBmb3IgdGhlIHRleHQgb2JqZWN0XG4gKlxuICogQG1ldGhvZCBzZXRUZXh0XG4gKiBAcGFyYW0gdGV4dCB7U3RyaW5nfSBUaGUgY29weSB0aGF0IHlvdSB3b3VsZCBsaWtlIHRoZSB0ZXh0IHRvIGRpc3BsYXlcbiAqL1xucHJvdG8uc2V0VGV4dCA9IGZ1bmN0aW9uIHNldFRleHQodGV4dClcbntcbiAgICB0aGlzLnRleHQgPSB0ZXh0IHx8IFwiIFwiO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBTZXQgdGhlIHN0eWxlIG9mIHRoZSB0ZXh0XG4gKlxuICogQG1ldGhvZCBzZXRTdHlsZVxuICogQHBhcmFtIHN0eWxlIHtPYmplY3R9IFRoZSBzdHlsZSBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0gc3R5bGUuZm9udCB7U3RyaW5nfSBUaGUgc2l6ZSAob3B0aW9uYWwpIGFuZCBiaXRtYXAgZm9udCBpZCAocmVxdWlyZWQpIGVxIFwiQXJpYWxcIiBvciBcIjIwcHggQXJpYWxcIiAobXVzdCBoYXZlIGxvYWRlZCBwcmV2aW91c2x5KVxuICogQHBhcmFtIFtzdHlsZS5hbGlnbj1cImxlZnRcIl0ge1N0cmluZ30gQW4gYWxpZ25tZW50IG9mIHRoZSBtdWx0aWxpbmUgdGV4dCAoXCJsZWZ0XCIsIFwiY2VudGVyXCIgb3IgXCJyaWdodFwiKVxuICovXG5wcm90by5zZXRTdHlsZSA9IGZ1bmN0aW9uIHNldFN0eWxlKHN0eWxlKVxue1xuICAgIHN0eWxlID0gc3R5bGUgfHwge307XG4gICAgc3R5bGUuYWxpZ24gPSBzdHlsZS5hbGlnbiB8fCBcImxlZnRcIjtcbiAgICB0aGlzLnN0eWxlID0gc3R5bGU7XG5cbiAgICB2YXIgZm9udCA9IHN0eWxlLmZvbnQuc3BsaXQoXCIgXCIpO1xuICAgIHRoaXMuZm9udE5hbWUgPSBmb250W2ZvbnQubGVuZ3RoIC0gMV07XG4gICAgdGhpcy5mb250U2l6ZSA9IGZvbnQubGVuZ3RoID49IDIgPyBwYXJzZUludChmb250W2ZvbnQubGVuZ3RoIC0gMl0sIDEwKSA6IEJpdG1hcFRleHQuZm9udHNbdGhpcy5mb250TmFtZV0uc2l6ZTtcblxuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBSZW5kZXJzIHRleHRcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRleHRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRleHQgPSBmdW5jdGlvbiB1cGRhdGVUZXh0KClcbntcbiAgICB2YXIgZGF0YSA9IEJpdG1hcFRleHQuZm9udHNbdGhpcy5mb250TmFtZV07XG4gICAgdmFyIHBvcyA9IG5ldyBQb2ludCgpO1xuICAgIHZhciBwcmV2Q2hhckNvZGUgPSBudWxsO1xuICAgIHZhciBjaGFycyA9IFtdO1xuICAgIHZhciBtYXhMaW5lV2lkdGggPSAwO1xuICAgIHZhciBsaW5lV2lkdGhzID0gW107XG4gICAgdmFyIGxpbmUgPSAwO1xuICAgIHZhciBzY2FsZSA9IHRoaXMuZm9udFNpemUgLyBkYXRhLnNpemU7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHRoaXMudGV4dC5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBjaGFyQ29kZSA9IHRoaXMudGV4dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICBpZigvKD86XFxyXFxufFxccnxcXG4pLy50ZXN0KHRoaXMudGV4dC5jaGFyQXQoaSkpKVxuICAgICAgICB7XG4gICAgICAgICAgICBsaW5lV2lkdGhzLnB1c2gocG9zLngpO1xuICAgICAgICAgICAgbWF4TGluZVdpZHRoID0gTWF0aC5tYXgobWF4TGluZVdpZHRoLCBwb3MueCk7XG4gICAgICAgICAgICBsaW5lKys7XG5cbiAgICAgICAgICAgIHBvcy54ID0gMDtcbiAgICAgICAgICAgIHBvcy55ICs9IGRhdGEubGluZUhlaWdodDtcbiAgICAgICAgICAgIHByZXZDaGFyQ29kZSA9IG51bGw7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjaGFyRGF0YSA9IGRhdGEuY2hhcnNbY2hhckNvZGVdO1xuICAgICAgICBpZighY2hhckRhdGEpIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmKHByZXZDaGFyQ29kZSAmJiBjaGFyRGF0YVtwcmV2Q2hhckNvZGVdKVxuICAgICAgICB7XG4gICAgICAgICAgIHBvcy54ICs9IGNoYXJEYXRhLmtlcm5pbmdbcHJldkNoYXJDb2RlXTtcbiAgICAgICAgfVxuICAgICAgICBjaGFycy5wdXNoKHt0ZXh0dXJlOmNoYXJEYXRhLnRleHR1cmUsIGxpbmU6IGxpbmUsIGNoYXJDb2RlOiBjaGFyQ29kZSwgcG9zaXRpb246IG5ldyBQb2ludChwb3MueCArIGNoYXJEYXRhLnhPZmZzZXQsIHBvcy55ICsgY2hhckRhdGEueU9mZnNldCl9KTtcbiAgICAgICAgcG9zLnggKz0gY2hhckRhdGEueEFkdmFuY2U7XG5cbiAgICAgICAgcHJldkNoYXJDb2RlID0gY2hhckNvZGU7XG4gICAgfVxuXG4gICAgbGluZVdpZHRocy5wdXNoKHBvcy54KTtcbiAgICBtYXhMaW5lV2lkdGggPSBNYXRoLm1heChtYXhMaW5lV2lkdGgsIHBvcy54KTtcblxuICAgIHZhciBsaW5lQWxpZ25PZmZzZXRzID0gW107XG4gICAgZm9yKGkgPSAwOyBpIDw9IGxpbmU7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBhbGlnbk9mZnNldCA9IDA7XG4gICAgICAgIGlmKHRoaXMuc3R5bGUuYWxpZ24gPT0gXCJyaWdodFwiKVxuICAgICAgICB7XG4gICAgICAgICAgICBhbGlnbk9mZnNldCA9IG1heExpbmVXaWR0aCAtIGxpbmVXaWR0aHNbaV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZih0aGlzLnN0eWxlLmFsaWduID09IFwiY2VudGVyXCIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGFsaWduT2Zmc2V0ID0gKG1heExpbmVXaWR0aCAtIGxpbmVXaWR0aHNbaV0pIC8gMjtcbiAgICAgICAgfVxuICAgICAgICBsaW5lQWxpZ25PZmZzZXRzLnB1c2goYWxpZ25PZmZzZXQpO1xuICAgIH1cblxuICAgIGZvcihpID0gMDsgaSA8IGNoYXJzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGMgPSBuZXcgU3ByaXRlKGNoYXJzW2ldLnRleHR1cmUpOyAvL1Nwcml0ZS5mcm9tRnJhbWUoY2hhcnNbaV0uY2hhckNvZGUpO1xuICAgICAgICBjLnBvc2l0aW9uLnggPSAoY2hhcnNbaV0ucG9zaXRpb24ueCArIGxpbmVBbGlnbk9mZnNldHNbY2hhcnNbaV0ubGluZV0pICogc2NhbGU7XG4gICAgICAgIGMucG9zaXRpb24ueSA9IGNoYXJzW2ldLnBvc2l0aW9uLnkgKiBzY2FsZTtcbiAgICAgICAgYy5zY2FsZS54ID0gYy5zY2FsZS55ID0gc2NhbGU7XG4gICAgICAgIHRoaXMuYWRkQ2hpbGQoYyk7XG4gICAgfVxuXG4gICAgdGhpcy53aWR0aCA9IHBvcy54ICogc2NhbGU7XG4gICAgdGhpcy5oZWlnaHQgPSAocG9zLnkgKyBkYXRhLmxpbmVIZWlnaHQpICogc2NhbGU7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGhlIHRyYW5zZm9yIG9mIHRoaXMgb2JqZWN0XG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgaWYodGhpcy5kaXJ0eSlcbiAgICB7XG4gICAgICAgIHdoaWxlKHRoaXMuY2hpbGRyZW4ubGVuZ3RoID4gMClcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVDaGlsZCh0aGlzLmdldENoaWxkQXQoMCkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlVGV4dCgpO1xuXG4gICAgICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbCh0aGlzKTtcbn07XG5cbkJpdG1hcFRleHQuZm9udHMgPSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBCaXRtYXBUZXh0O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcbnZhciBTcHJpdGUgPSByZXF1aXJlKCcuLi9kaXNwbGF5L1Nwcml0ZScpO1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuLi90ZXh0dXJlcy9UZXh0dXJlJyk7XG5cbi8qKlxuICogQSBUZXh0IE9iamVjdCB3aWxsIGNyZWF0ZSBhIGxpbmUocykgb2YgdGV4dCB0byBzcGxpdCBhIGxpbmUgeW91IGNhbiB1c2UgXCJcXG5cIlxuICpcbiAqIEBjbGFzcyBUZXh0XG4gKiBAZXh0ZW5kcyBTcHJpdGVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHRleHQge1N0cmluZ30gVGhlIGNvcHkgdGhhdCB5b3Ugd291bGQgbGlrZSB0aGUgdGV4dCB0byBkaXNwbGF5XG4gKiBAcGFyYW0gW3N0eWxlXSB7T2JqZWN0fSBUaGUgc3R5bGUgcGFyYW1ldGVyc1xuICogQHBhcmFtIFtzdHlsZS5mb250XSB7U3RyaW5nfSBkZWZhdWx0IFwiYm9sZCAyMHB0IEFyaWFsXCIgVGhlIHN0eWxlIGFuZCBzaXplIG9mIHRoZSBmb250XG4gKiBAcGFyYW0gW3N0eWxlLmZpbGw9XCJibGFja1wiXSB7T2JqZWN0fSBBIGNhbnZhcyBmaWxsc3R5bGUgdGhhdCB3aWxsIGJlIHVzZWQgb24gdGhlIHRleHQgZWcgXCJyZWRcIiwgXCIjMDBGRjAwXCJcbiAqIEBwYXJhbSBbc3R5bGUuYWxpZ249XCJsZWZ0XCJdIHtTdHJpbmd9IEFuIGFsaWdubWVudCBvZiB0aGUgbXVsdGlsaW5lIHRleHQgKFwibGVmdFwiLCBcImNlbnRlclwiIG9yIFwicmlnaHRcIilcbiAqIEBwYXJhbSBbc3R5bGUuc3Ryb2tlXSB7U3RyaW5nfSBBIGNhbnZhcyBmaWxsc3R5bGUgdGhhdCB3aWxsIGJlIHVzZWQgb24gdGhlIHRleHQgc3Ryb2tlIGVnIFwiYmx1ZVwiLCBcIiNGQ0ZGMDBcIlxuICogQHBhcmFtIFtzdHlsZS5zdHJva2VUaGlja25lc3M9MF0ge051bWJlcn0gQSBudW1iZXIgdGhhdCByZXByZXNlbnRzIHRoZSB0aGlja25lc3Mgb2YgdGhlIHN0cm9rZS4gRGVmYXVsdCBpcyAwIChubyBzdHJva2UpXG4gKiBAcGFyYW0gW3N0eWxlLndvcmRXcmFwPWZhbHNlXSB7Qm9vbGVhbn0gSW5kaWNhdGVzIGlmIHdvcmQgd3JhcCBzaG91bGQgYmUgdXNlZFxuICogQHBhcmFtIFtzdHlsZS53b3JkV3JhcFdpZHRoPTEwMF0ge051bWJlcn0gVGhlIHdpZHRoIGF0IHdoaWNoIHRleHQgd2lsbCB3cmFwXG4gKi9cbmZ1bmN0aW9uIFRleHQodGV4dCwgc3R5bGUpXG57XG4gICAgdGhpcy5jYW52YXMgPSBwbGF0Zm9ybS5jcmVhdGVDYW52YXMoKTtcbiAgICB0aGlzLmNvbnRleHQgPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG4gICAgU3ByaXRlLmNhbGwodGhpcywgVGV4dHVyZS5mcm9tQ2FudmFzKHRoaXMuY2FudmFzKSk7XG5cbiAgICB0aGlzLnNldFRleHQodGV4dCk7XG4gICAgdGhpcy5zZXRTdHlsZShzdHlsZSk7XG5cbiAgICB0aGlzLnVwZGF0ZVRleHQoKTtcbiAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG59XG5cbi8vIGNvbnN0cnVjdG9yXG52YXIgcHJvdG8gPSBUZXh0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3ByaXRlLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFRleHR9XG59KTtcblxuLyoqXG4gKiBTZXQgdGhlIHN0eWxlIG9mIHRoZSB0ZXh0XG4gKlxuICogQG1ldGhvZCBzZXRTdHlsZVxuICogQHBhcmFtIFtzdHlsZV0ge09iamVjdH0gVGhlIHN0eWxlIHBhcmFtZXRlcnNcbiAqIEBwYXJhbSBbc3R5bGUuZm9udD1cImJvbGQgMjBwdCBBcmlhbFwiXSB7U3RyaW5nfSBUaGUgc3R5bGUgYW5kIHNpemUgb2YgdGhlIGZvbnRcbiAqIEBwYXJhbSBbc3R5bGUuZmlsbD1cImJsYWNrXCJdIHtPYmplY3R9IEEgY2FudmFzIGZpbGxzdHlsZSB0aGF0IHdpbGwgYmUgdXNlZCBvbiB0aGUgdGV4dCBlZyBcInJlZFwiLCBcIiMwMEZGMDBcIlxuICogQHBhcmFtIFtzdHlsZS5hbGlnbj1cImxlZnRcIl0ge1N0cmluZ30gQW4gYWxpZ25tZW50IG9mIHRoZSBtdWx0aWxpbmUgdGV4dCAoXCJsZWZ0XCIsIFwiY2VudGVyXCIgb3IgXCJyaWdodFwiKVxuICogQHBhcmFtIFtzdHlsZS5zdHJva2U9XCJibGFja1wiXSB7U3RyaW5nfSBBIGNhbnZhcyBmaWxsc3R5bGUgdGhhdCB3aWxsIGJlIHVzZWQgb24gdGhlIHRleHQgc3Ryb2tlIGVnIFwiYmx1ZVwiLCBcIiNGQ0ZGMDBcIlxuICogQHBhcmFtIFtzdHlsZS5zdHJva2VUaGlja25lc3M9MF0ge051bWJlcn0gQSBudW1iZXIgdGhhdCByZXByZXNlbnRzIHRoZSB0aGlja25lc3Mgb2YgdGhlIHN0cm9rZS4gRGVmYXVsdCBpcyAwIChubyBzdHJva2UpXG4gKiBAcGFyYW0gW3N0eWxlLndvcmRXcmFwPWZhbHNlXSB7Qm9vbGVhbn0gSW5kaWNhdGVzIGlmIHdvcmQgd3JhcCBzaG91bGQgYmUgdXNlZFxuICogQHBhcmFtIFtzdHlsZS53b3JkV3JhcFdpZHRoPTEwMF0ge051bWJlcn0gVGhlIHdpZHRoIGF0IHdoaWNoIHRleHQgd2lsbCB3cmFwXG4gKi9cbnByb3RvLnNldFN0eWxlID0gZnVuY3Rpb24gc2V0U3R5bGUoc3R5bGUpXG57XG4gICAgc3R5bGUgPSBzdHlsZSB8fCB7fTtcbiAgICBzdHlsZS5mb250ID0gc3R5bGUuZm9udCB8fCBcImJvbGQgMjBwdCBBcmlhbFwiO1xuICAgIHN0eWxlLmZpbGwgPSBzdHlsZS5maWxsIHx8IFwiYmxhY2tcIjtcbiAgICBzdHlsZS5hbGlnbiA9IHN0eWxlLmFsaWduIHx8IFwibGVmdFwiO1xuICAgIHN0eWxlLnN0cm9rZSA9IHN0eWxlLnN0cm9rZSB8fCBcImJsYWNrXCI7IC8vcHJvdmlkZSBhIGRlZmF1bHQsIHNlZTogaHR0cHM6Ly9naXRodWIuY29tL0dvb2RCb3lEaWdpdGFsL3BpeGkuanMvaXNzdWVzLzEzNlxuICAgIHN0eWxlLnN0cm9rZVRoaWNrbmVzcyA9IHN0eWxlLnN0cm9rZVRoaWNrbmVzcyB8fCAwO1xuICAgIHN0eWxlLndvcmRXcmFwID0gc3R5bGUud29yZFdyYXAgfHwgZmFsc2U7XG4gICAgc3R5bGUud29yZFdyYXBXaWR0aCA9IHN0eWxlLndvcmRXcmFwV2lkdGggfHwgMTAwO1xuICAgIHRoaXMuc3R5bGUgPSBzdHlsZTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogU2V0IHRoZSBjb3B5IGZvciB0aGUgdGV4dCBvYmplY3QuIFRvIHNwbGl0IGEgbGluZSB5b3UgY2FuIHVzZSBcIlxcblwiXG4gKlxuICogQG1ldGhvcyBzZXRUZXh0XG4gKiBAcGFyYW0ge1N0cmluZ30gdGV4dCBUaGUgY29weSB0aGF0IHlvdSB3b3VsZCBsaWtlIHRoZSB0ZXh0IHRvIGRpc3BsYXlcbiAqL1xucHJvdG8uc2V0VGV4dCA9IGZ1bmN0aW9uIHNldFRleHQodGV4dClcbntcbiAgICB0aGlzLnRleHQgPSB0ZXh0LnRvU3RyaW5nKCkgfHwgXCIgXCI7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgdGV4dFxuICpcbiAqIEBtZXRob2QgdXBkYXRlVGV4dFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8udXBkYXRlVGV4dCA9IGZ1bmN0aW9uIHVwZGF0ZVRleHQoKVxue1xuICAgIHRoaXMuY29udGV4dC5mb250ID0gdGhpcy5zdHlsZS5mb250O1xuXG4gICAgdmFyIG91dHB1dFRleHQgPSB0aGlzLnRleHQ7XG5cbiAgICAvLyB3b3JkIHdyYXBcbiAgICAvLyBwcmVzZXJ2ZSBvcmlnaW5hbCB0ZXh0XG4gICAgaWYodGhpcy5zdHlsZS53b3JkV3JhcClvdXRwdXRUZXh0ID0gdGhpcy53b3JkV3JhcCh0aGlzLnRleHQpO1xuXG4gICAgLy9zcGxpdCB0ZXh0IGludG8gbGluZXNcbiAgICB2YXIgbGluZXMgPSBvdXRwdXRUZXh0LnNwbGl0KC8oPzpcXHJcXG58XFxyfFxcbikvKTtcblxuICAgIC8vY2FsY3VsYXRlIHRleHQgd2lkdGhcbiAgICB2YXIgbGluZVdpZHRocyA9IFtdO1xuICAgIHZhciBtYXhMaW5lV2lkdGggPSAwO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgbGluZVdpZHRoID0gdGhpcy5jb250ZXh0Lm1lYXN1cmVUZXh0KGxpbmVzW2ldKS53aWR0aDtcbiAgICAgICAgbGluZVdpZHRoc1tpXSA9IGxpbmVXaWR0aDtcbiAgICAgICAgbWF4TGluZVdpZHRoID0gTWF0aC5tYXgobWF4TGluZVdpZHRoLCBsaW5lV2lkdGgpO1xuICAgIH1cbiAgICB0aGlzLmNhbnZhcy53aWR0aCA9IG1heExpbmVXaWR0aCArIHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzO1xuXG4gICAgLy9jYWxjdWxhdGUgdGV4dCBoZWlnaHRcbiAgICB2YXIgbGluZUhlaWdodCA9IHRoaXMuZGV0ZXJtaW5lRm9udEhlaWdodChcImZvbnQ6IFwiICsgdGhpcy5zdHlsZS5mb250ICArIFwiO1wiKSArIHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzO1xuICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IGxpbmVIZWlnaHQgKiBsaW5lcy5sZW5ndGg7XG5cbiAgICAvL3NldCBjYW52YXMgdGV4dCBzdHlsZXNcbiAgICB0aGlzLmNvbnRleHQuZmlsbFN0eWxlID0gdGhpcy5zdHlsZS5maWxsO1xuICAgIHRoaXMuY29udGV4dC5mb250ID0gdGhpcy5zdHlsZS5mb250O1xuXG4gICAgdGhpcy5jb250ZXh0LnN0cm9rZVN0eWxlID0gdGhpcy5zdHlsZS5zdHJva2U7XG4gICAgdGhpcy5jb250ZXh0LmxpbmVXaWR0aCA9IHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzO1xuXG4gICAgdGhpcy5jb250ZXh0LnRleHRCYXNlbGluZSA9IFwidG9wXCI7XG5cbiAgICAvL2RyYXcgbGluZXMgbGluZSBieSBsaW5lXG4gICAgZm9yIChpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGxpbmVQb3NpdGlvbiA9IG5ldyBQb2ludCh0aGlzLnN0eWxlLnN0cm9rZVRoaWNrbmVzcyAvIDIsIHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzIC8gMiArIGkgKiBsaW5lSGVpZ2h0KTtcblxuICAgICAgICBpZih0aGlzLnN0eWxlLmFsaWduID09IFwicmlnaHRcIilcbiAgICAgICAge1xuICAgICAgICAgICAgbGluZVBvc2l0aW9uLnggKz0gbWF4TGluZVdpZHRoIC0gbGluZVdpZHRoc1tpXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKHRoaXMuc3R5bGUuYWxpZ24gPT0gXCJjZW50ZXJcIilcbiAgICAgICAge1xuICAgICAgICAgICAgbGluZVBvc2l0aW9uLnggKz0gKG1heExpbmVXaWR0aCAtIGxpbmVXaWR0aHNbaV0pIC8gMjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuc3R5bGUuc3Ryb2tlICYmIHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQuc3Ryb2tlVGV4dChsaW5lc1tpXSwgbGluZVBvc2l0aW9uLngsIGxpbmVQb3NpdGlvbi55KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuc3R5bGUuZmlsbClcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmZpbGxUZXh0KGxpbmVzW2ldLCBsaW5lUG9zaXRpb24ueCwgbGluZVBvc2l0aW9uLnkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVUZXh0dXJlKCk7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGV4dHVyZSBzaXplIGJhc2VkIG9uIGNhbnZhcyBzaXplXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUZXh0dXJlXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUZXh0dXJlID0gZnVuY3Rpb24gdXBkYXRlVGV4dHVyZSgpXG57XG4gICAgdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLndpZHRoID0gdGhpcy5jYW52YXMud2lkdGg7XG4gICAgdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLmhlaWdodCA9IHRoaXMuY2FudmFzLmhlaWdodDtcbiAgICB0aGlzLnRleHR1cmUuZnJhbWUud2lkdGggPSB0aGlzLmNhbnZhcy53aWR0aDtcbiAgICB0aGlzLnRleHR1cmUuZnJhbWUuaGVpZ2h0ID0gdGhpcy5jYW52YXMuaGVpZ2h0O1xuXG4gICAgdGhpcy5fd2lkdGggPSB0aGlzLmNhbnZhcy53aWR0aDtcbiAgICB0aGlzLl9oZWlnaHQgPSB0aGlzLmNhbnZhcy5oZWlnaHQ7XG5cbiAgICBnbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUucHVzaCh0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUpO1xufTtcblxuLyoqXG4gKiBVcGRhdGVzIHRoZSB0cmFuc2ZvciBvZiB0aGlzIG9iamVjdFxuICpcbiAqIEBtZXRob2QgdXBkYXRlVHJhbnNmb3JtXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUcmFuc2Zvcm0gPSBmdW5jdGlvbiB1cGRhdGVUcmFuc2Zvcm0oKVxue1xuICAgIGlmKHRoaXMuZGlydHkpXG4gICAge1xuICAgICAgICB0aGlzLnVwZGF0ZVRleHQoKTtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIFNwcml0ZS5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyk7XG59O1xuXG4vKlxuICogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3VzZXJzLzM0NDQxL2VsbGlzYmJlblxuICogZ3JlYXQgc29sdXRpb24gdG8gdGhlIHByb2JsZW0hXG4gKlxuICogQG1ldGhvZCBkZXRlcm1pbmVGb250SGVpZ2h0XG4gKiBAcGFyYW0gZm9udFN0eWxlIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5kZXRlcm1pbmVGb250SGVpZ2h0ID0gZnVuY3Rpb24gZGV0ZXJtaW5lRm9udEhlaWdodChmb250U3R5bGUpXG57XG4gICAgLy8gYnVpbGQgYSBsaXR0bGUgcmVmZXJlbmNlIGRpY3Rpb25hcnkgc28gaWYgdGhlIGZvbnQgc3R5bGUgaGFzIGJlZW4gdXNlZCByZXR1cm4gYVxuICAgIC8vIGNhY2hlZCB2ZXJzaW9uLi4uXG4gICAgdmFyIHJlc3VsdCA9IFRleHQuaGVpZ2h0Q2FjaGVbZm9udFN0eWxlXTtcblxuICAgIGlmKCFyZXN1bHQpXG4gICAge1xuICAgICAgICB2YXIgYm9keSA9IHBsYXRmb3JtLmRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXTtcbiAgICAgICAgdmFyIGR1bW15ID0gcGxhdGZvcm0uZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgdmFyIGR1bW15VGV4dCA9IHBsYXRmb3JtLmRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFwiTVwiKTtcbiAgICAgICAgZHVtbXkuYXBwZW5kQ2hpbGQoZHVtbXlUZXh0KTtcbiAgICAgICAgZHVtbXkuc2V0QXR0cmlidXRlKFwic3R5bGVcIiwgZm9udFN0eWxlICsgJztwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjAnKTtcbiAgICAgICAgYm9keS5hcHBlbmRDaGlsZChkdW1teSk7XG5cbiAgICAgICAgcmVzdWx0ID0gZHVtbXkub2Zmc2V0SGVpZ2h0O1xuICAgICAgICBUZXh0LmhlaWdodENhY2hlW2ZvbnRTdHlsZV0gPSByZXN1bHQ7XG5cbiAgICAgICAgYm9keS5yZW1vdmVDaGlsZChkdW1teSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogQSBUZXh0IE9iamVjdCB3aWxsIGFwcGx5IHdvcmR3cmFwXG4gKlxuICogQG1ldGhvZCB3b3JkV3JhcFxuICogQHBhcmFtIHRleHQge1N0cmluZ31cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLndvcmRXcmFwID0gZnVuY3Rpb24gd29yZFdyYXAodGV4dClcbntcbiAgICAvLyBzZWFyY2ggZ29vZCB3cmFwIHBvc2l0aW9uXG4gICAgZnVuY3Rpb24gc2VhcmNoV3JhcFBvcyhjdHgsIHRleHQsIHN0YXJ0LCBlbmQsIHdyYXBXaWR0aClcbiAgICB7XG4gICAgICAgIHZhciBwID0gTWF0aC5mbG9vcigoZW5kLXN0YXJ0KSAvIDIpICsgc3RhcnQ7XG4gICAgICAgIGlmKHAgPT0gc3RhcnQpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoY3R4Lm1lYXN1cmVUZXh0KHRleHQuc3Vic3RyaW5nKDAscCkpLndpZHRoIDw9IHdyYXBXaWR0aClcbiAgICAgICAge1xuICAgICAgICAgICAgaWYoY3R4Lm1lYXN1cmVUZXh0KHRleHQuc3Vic3RyaW5nKDAscCsxKSkud2lkdGggPiB3cmFwV2lkdGgpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlYXJjaFdyYXBQb3MoY3R4LCB0ZXh0LCBwLCBlbmQsIHdyYXBXaWR0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICByZXR1cm4gc2VhcmNoV3JhcFBvcyhjdHgsIHRleHQsIHN0YXJ0LCBwLCB3cmFwV2lkdGgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGluZVdyYXAoY3R4LCB0ZXh0LCB3cmFwV2lkdGgpXG4gICAge1xuICAgICAgICBpZihjdHgubWVhc3VyZVRleHQodGV4dCkud2lkdGggPD0gd3JhcFdpZHRoIHx8IHRleHQubGVuZ3RoIDwgMSlcbiAgICAgICAge1xuICAgICAgICAgICAgcmV0dXJuIHRleHQ7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHBvcyA9IHNlYXJjaFdyYXBQb3MoY3R4LCB0ZXh0LCAwLCB0ZXh0Lmxlbmd0aCwgd3JhcFdpZHRoKTtcbiAgICAgICAgcmV0dXJuIHRleHQuc3Vic3RyaW5nKDAsIHBvcykgKyBcIlxcblwiICsgbGluZVdyYXAoY3R4LCB0ZXh0LnN1YnN0cmluZyhwb3MpLCB3cmFwV2lkdGgpO1xuICAgIH1cblxuICAgIHZhciByZXN1bHQgPSBcIlwiO1xuICAgIHZhciBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgIHJlc3VsdCArPSBsaW5lV3JhcCh0aGlzLmNvbnRleHQsIGxpbmVzW2ldLCB0aGlzLnN0eWxlLndvcmRXcmFwV2lkdGgpICsgXCJcXG5cIjtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBEZXN0cm95cyB0aGlzIHRleHQgb2JqZWN0XG4gKlxuICogQG1ldGhvZCBkZXN0cm95XG4gKiBAcGFyYW0gZGVzdHJveVRleHR1cmUge0Jvb2xlYW59XG4gKi9cbnByb3RvLmRlc3Ryb3kgPSBmdW5jdGlvbiBkZXN0cm95KGRlc3Ryb3lUZXh0dXJlKVxue1xuICAgIGlmKGRlc3Ryb3lUZXh0dXJlKVxuICAgIHtcbiAgICAgICAgdGhpcy50ZXh0dXJlLmRlc3Ryb3koKTtcbiAgICB9XG5cbn07XG5cblRleHQuaGVpZ2h0Q2FjaGUgPSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBFdmVudFRhcmdldCA9IHJlcXVpcmUoJy4uL2V2ZW50cy9FdmVudFRhcmdldCcpO1xudmFyIGJhc2VUZXh0dXJlQ2FjaGUgPSB7fTtcblxuLyoqXG4gKiBBIHRleHR1cmUgc3RvcmVzIHRoZSBpbmZvcm1hdGlvbiB0aGF0IHJlcHJlc2VudHMgYW4gaW1hZ2UuIEFsbCB0ZXh0dXJlcyBoYXZlIGEgYmFzZSB0ZXh0dXJlXG4gKlxuICogQGNsYXNzIEJhc2VUZXh0dXJlXG4gKiBAdXNlcyBFdmVudFRhcmdldFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gc291cmNlIHtTdHJpbmd9IHRoZSBzb3VyY2Ugb2JqZWN0IChpbWFnZSBvciBjYW52YXMpXG4gKi9cbmZ1bmN0aW9uIEJhc2VUZXh0dXJlKHNvdXJjZSlcbntcbiAgICBFdmVudFRhcmdldC5jYWxsKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gVGhlIHdpZHRoIG9mIHRoZSBiYXNlIHRleHR1cmUgc2V0IHdoZW4gdGhlIGltYWdlIGhhcyBsb2FkZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSAxMDA7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgaGVpZ2h0IG9mIHRoZSBiYXNlIHRleHR1cmUgc2V0IHdoZW4gdGhlIGltYWdlIGhhcyBsb2FkZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLmhlaWdodCA9IDEwMDtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIERlc2NyaWJlcyBpZiB0aGUgYmFzZSB0ZXh0dXJlIGhhcyBsb2FkZWQgb3Igbm90XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgaGFzTG9hZGVkXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMuaGFzTG9hZGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc291cmNlIHRoYXQgaXMgbG9hZGVkIHRvIGNyZWF0ZSB0aGUgdGV4dHVyZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHNvdXJjZVxuICAgICAqIEB0eXBlIEltYWdlXG4gICAgICovXG4gICAgdGhpcy5zb3VyY2UgPSBzb3VyY2U7XG5cbiAgICBpZighc291cmNlKXJldHVybjtcblxuICAgIGlmKCdjb21wbGV0ZScgaW4gdGhpcy5zb3VyY2UpXG4gICAge1xuICAgICAgICBpZih0aGlzLnNvdXJjZS5jb21wbGV0ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5oYXNMb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMuc291cmNlLndpZHRoO1xuICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLnNvdXJjZS5oZWlnaHQ7XG5cbiAgICAgICAgICAgIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZS5wdXNoKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuXG4gICAgICAgICAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uub25sb2FkID0gZnVuY3Rpb24oKXtcblxuICAgICAgICAgICAgICAgIHNjb3BlLmhhc0xvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgc2NvcGUud2lkdGggPSBzY29wZS5zb3VyY2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgc2NvcGUuaGVpZ2h0ID0gc2NvcGUuc291cmNlLmhlaWdodDtcblxuICAgICAgICAgICAgICAgIC8vIGFkZCBpdCB0byBzb21ld2hlcmUuLi5cbiAgICAgICAgICAgICAgICBnbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUucHVzaChzY29wZSk7XG4gICAgICAgICAgICAgICAgc2NvcGUuZGlzcGF0Y2hFdmVudCggeyB0eXBlOiAnbG9hZGVkJywgY29udGVudDogc2NvcGUgfSApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gIHRoaXMuaW1hZ2Uuc3JjID0gaW1hZ2VVcmw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5oYXNMb2FkZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLndpZHRoID0gdGhpcy5zb3VyY2Uud2lkdGg7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5zb3VyY2UuaGVpZ2h0O1xuXG4gICAgICAgIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZS5wdXNoKHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuX3Bvd2VyT2YyID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IEJhc2VUZXh0dXJlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBEZXN0cm95cyB0aGlzIGJhc2UgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgZGVzdHJveVxuICovXG5wcm90by5kZXN0cm95ID0gZnVuY3Rpb24gZGVzdHJveSgpXG57XG4gICAgaWYodGhpcy5zb3VyY2Uuc3JjKVxuICAgIHtcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3JjID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuICAgIGdsb2JhbHMudGV4dHVyZXNUb0Rlc3Ryb3kucHVzaCh0aGlzKTtcbn07XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGJhc2UgdGV4dHVyZSBiYXNlZCBvbiBhbiBpbWFnZSB1cmxcbiAqIElmIHRoZSBpbWFnZSBpcyBub3QgaW4gdGhlIGJhc2UgdGV4dHVyZSBjYWNoZSBpdCB3aWxsIGJlICBjcmVhdGVkIGFuZCBsb2FkZWRcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGZyb21JbWFnZVxuICogQHBhcmFtIGltYWdlVXJsIHtTdHJpbmd9IFRoZSBpbWFnZSB1cmwgb2YgdGhlIHRleHR1cmVcbiAqIEByZXR1cm4gQmFzZVRleHR1cmVcbiAqL1xuQmFzZVRleHR1cmUuZnJvbUltYWdlID0gZnVuY3Rpb24gZnJvbUltYWdlKGltYWdlVXJsLCBjcm9zc29yaWdpbilcbntcbiAgICB2YXIgYmFzZVRleHR1cmUgPSBiYXNlVGV4dHVyZUNhY2hlW2ltYWdlVXJsXTtcbiAgICBpZighYmFzZVRleHR1cmUpXG4gICAge1xuICAgICAgICB2YXIgaW1hZ2UgPSBuZXcgcGxhdGZvcm0uY3JlYXRlSW1hZ2UoKTtcbiAgICAgICAgaWYgKGNyb3Nzb3JpZ2luKVxuICAgICAgICB7XG4gICAgICAgICAgICBpbWFnZS5jcm9zc09yaWdpbiA9ICcnO1xuICAgICAgICB9XG4gICAgICAgIGltYWdlLnNyYyA9IGltYWdlVXJsO1xuICAgICAgICBiYXNlVGV4dHVyZSA9IG5ldyBCYXNlVGV4dHVyZShpbWFnZSk7XG4gICAgICAgIGJhc2VUZXh0dXJlQ2FjaGVbaW1hZ2VVcmxdID0gYmFzZVRleHR1cmU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJhc2VUZXh0dXJlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlVGV4dHVyZTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBtYXQzID0gcmVxdWlyZSgnLi4vZ2VvbS9tYXRyaXgnKS5tYXQzO1xuXG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4vVGV4dHVyZScpO1xudmFyIEJhc2VUZXh0dXJlID0gcmVxdWlyZSgnLi9CYXNlVGV4dHVyZScpO1xudmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vZ2VvbS9Qb2ludCcpO1xudmFyIFJlY3RhbmdsZSA9IHJlcXVpcmUoJy4uL2dlb20vUmVjdGFuZ2xlJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBDYW52YXNSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVycy9jYW52YXMvQ2FudmFzUmVuZGVyZXInKTtcbnZhciBXZWJHTFJlbmRlckdyb3VwID0gcmVxdWlyZSgnLi4vcmVuZGVyZXJzL3dlYmdsL1dlYkdMUmVuZGVyR3JvdXAnKTtcblxuLyoqXG4gQSBSZW5kZXJUZXh0dXJlIGlzIGEgc3BlY2lhbCB0ZXh0dXJlIHRoYXQgYWxsb3dzIGFueSBwaXhpIGRpc3BsYXlPYmplY3QgdG8gYmUgcmVuZGVyZWQgdG8gaXQuXG5cbiBfX0hpbnRfXzogQWxsIERpc3BsYXlPYmplY3RzIChleG1wbC4gU3ByaXRlcykgdGhhdCByZW5kZXJzIG9uIFJlbmRlclRleHR1cmUgc2hvdWxkIGJlIHByZWxvYWRlZC5cbiBPdGhlcndpc2UgYmxhY2sgcmVjdGFuZ2xlcyB3aWxsIGJlIGRyYXduIGluc3RlYWQuXG5cbiBSZW5kZXJUZXh0dXJlIHRha2VzIHNuYXBzaG90IG9mIERpc3BsYXlPYmplY3QgcGFzc2VkIHRvIHJlbmRlciBtZXRob2QuIElmIERpc3BsYXlPYmplY3QgaXMgcGFzc2VkIHRvIHJlbmRlciBtZXRob2QsIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiBpdCB3aWxsIGJlIGlnbm9yZWQuIEZvciBleGFtcGxlOlxuXG4gICAgdmFyIHJlbmRlclRleHR1cmUgPSBuZXcgUmVuZGVyVGV4dHVyZSg4MDAsIDYwMCk7XG4gICAgdmFyIHNwcml0ZSA9IFNwcml0ZS5mcm9tSW1hZ2UoXCJzcGluT2JqXzAxLnBuZ1wiKTtcbiAgICBzcHJpdGUucG9zaXRpb24ueCA9IDgwMC8yO1xuICAgIHNwcml0ZS5wb3NpdGlvbi55ID0gNjAwLzI7XG4gICAgc3ByaXRlLmFuY2hvci54ID0gMC41O1xuICAgIHNwcml0ZS5hbmNob3IueSA9IDAuNTtcbiAgICByZW5kZXJUZXh0dXJlLnJlbmRlcihzcHJpdGUpO1xuXG4gU3ByaXRlIGluIHRoaXMgY2FzZSB3aWxsIGJlIHJlbmRlcmVkIHRvIDAsMCBwb3NpdGlvbi4gVG8gcmVuZGVyIHRoaXMgc3ByaXRlIGF0IGNlbnRlciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyIHNob3VsZCBiZSB1c2VkOlxuXG4gICAgdmFyIGRvYyA9IG5ldyBEaXNwbGF5T2JqZWN0Q29udGFpbmVyKCk7XG4gICAgZG9jLmFkZENoaWxkKHNwcml0ZSk7XG4gICAgcmVuZGVyVGV4dHVyZS5yZW5kZXIoZG9jKTsgIC8vIFJlbmRlcnMgdG8gY2VudGVyIG9mIHJlbmRlclRleHR1cmVcblxuIEBjbGFzcyBSZW5kZXJUZXh0dXJlXG4gQGV4dGVuZHMgVGV4dHVyZVxuIEBjb25zdHJ1Y3RvclxuIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSBUaGUgd2lkdGggb2YgdGhlIHJlbmRlciB0ZXh0dXJlXG4gQHBhcmFtIGhlaWdodCB7TnVtYmVyfSBUaGUgaGVpZ2h0IG9mIHRoZSByZW5kZXIgdGV4dHVyZVxuICovXG5mdW5jdGlvbiBSZW5kZXJUZXh0dXJlKHdpZHRoLCBoZWlnaHQpXG57XG4gICAgRXZlbnRUYXJnZXQuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy53aWR0aCA9IHdpZHRoIHx8IDEwMDtcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodCB8fCAxMDA7XG5cbiAgICB0aGlzLmlkZW50aXR5TWF0cml4ID0gbWF0My5jcmVhdGUoKTtcblxuICAgIHRoaXMuZnJhbWUgPSBuZXcgUmVjdGFuZ2xlKDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuICAgIGlmKGdsb2JhbHMuZ2wpXG4gICAge1xuICAgICAgICB0aGlzLmluaXRXZWJHTCgpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLmluaXRDYW52YXMoKTtcbiAgICB9XG59XG5cbnZhciBwcm90byA9IFJlbmRlclRleHR1cmUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShUZXh0dXJlLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFJlbmRlclRleHR1cmV9XG59KTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgd2ViZ2wgZGF0YSBmb3IgdGhpcyB0ZXh0dXJlXG4gKlxuICogQG1ldGhvZCBpbml0V2ViR0xcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmluaXRXZWJHTCA9IGZ1bmN0aW9uIGluaXRXZWJHTCgpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcbiAgICB0aGlzLmdsRnJhbWVidWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuXG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmdsRnJhbWVidWZmZXIgKTtcblxuICAgIHRoaXMuZ2xGcmFtZWJ1ZmZlci53aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgdGhpcy5nbEZyYW1lYnVmZmVyLmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgdGhpcy5iYXNlVGV4dHVyZSA9IG5ldyBCYXNlVGV4dHVyZSgpO1xuXG4gICAgdGhpcy5iYXNlVGV4dHVyZS53aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgdGhpcy5iYXNlVGV4dHVyZS5oZWlnaHQgPSB0aGlzLmhlaWdodDtcblxuICAgIHRoaXMuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0aGlzLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUpO1xuXG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAgdGhpcy53aWR0aCwgIHRoaXMuaGVpZ2h0LCAwLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcblxuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5MSU5FQVIpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgdGhpcy5iYXNlVGV4dHVyZS5pc1JlbmRlciA9IHRydWU7XG5cbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZ2xGcmFtZWJ1ZmZlciApO1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgdGhpcy5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlLCAwKTtcblxuICAgIC8vIGNyZWF0ZSBhIHByb2plY3Rpb24gbWF0cml4Li5cbiAgICB0aGlzLnByb2plY3Rpb24gPSBuZXcgUG9pbnQodGhpcy53aWR0aC8yICwgdGhpcy5oZWlnaHQvMik7XG5cbiAgICAvLyBzZXQgdGhlIGNvcnJlY3QgcmVuZGVyIGZ1bmN0aW9uLi5cbiAgICB0aGlzLnJlbmRlciA9IHRoaXMucmVuZGVyV2ViR0w7XG59O1xuXG5wcm90by5yZXNpemUgPSBmdW5jdGlvbiByZXNpemUod2lkdGgsIGhlaWdodClcbntcblxuICAgIHRoaXMud2lkdGggPSB3aWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuICAgIGlmKGdsb2JhbHMuZ2wpXG4gICAge1xuICAgICAgICB0aGlzLnByb2plY3Rpb24ueCA9IHRoaXMud2lkdGgvMlxuICAgICAgICB0aGlzLnByb2plY3Rpb24ueSA9IHRoaXMuaGVpZ2h0LzI7XG5cbiAgICAgICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcbiAgICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlKTtcbiAgICAgICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAgdGhpcy53aWR0aCwgIHRoaXMuaGVpZ2h0LCAwLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcblxuICAgICAgICB0aGlzLmZyYW1lLndpZHRoID0gdGhpcy53aWR0aFxuICAgICAgICB0aGlzLmZyYW1lLmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgY2FudmFzIGRhdGEgZm9yIHRoaXMgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgaW5pdENhbnZhc1xuICogQHByaXZhdGVcbiAqL1xucHJvdG8uaW5pdENhbnZhcyA9IGZ1bmN0aW9uIGluaXRDYW52YXMoKVxue1xuICAgIHRoaXMucmVuZGVyZXIgPSBuZXcgQ2FudmFzUmVuZGVyZXIodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQsIG51bGwsIDApO1xuXG4gICAgdGhpcy5iYXNlVGV4dHVyZSA9IG5ldyBCYXNlVGV4dHVyZSh0aGlzLnJlbmRlcmVyLnZpZXcpO1xuICAgIHRoaXMuZnJhbWUgPSBuZXcgUmVjdGFuZ2xlKDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXJDYW52YXM7XG59O1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBkcmF3IHRoZSBkaXNwbGF5IG9iamVjdCB0byB0aGUgdGV4dHVyZS5cbiAqXG4gKiBAbWV0aG9kIHJlbmRlcldlYkdMXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gVGhlIGRpc3BsYXkgb2JqZWN0IHRvIHJlbmRlciB0aGlzIHRleHR1cmUgb25cbiAqIEBwYXJhbSBjbGVhciB7Qm9vbGVhbn0gSWYgdHJ1ZSB0aGUgdGV4dHVyZSB3aWxsIGJlIGNsZWFyZWQgYmVmb3JlIHRoZSBkaXNwbGF5T2JqZWN0IGlzIGRyYXduXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJXZWJHTCA9IGZ1bmN0aW9uIHJlbmRlcldlYkdMKGRpc3BsYXlPYmplY3QsIHBvc2l0aW9uLCBjbGVhcilcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgLy8gZW5hYmxlIHRoZSBhbHBoYSBjb2xvciBtYXNrLi5cbiAgICBnbC5jb2xvck1hc2sodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG5cbiAgICBnbC52aWV3cG9ydCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZ2xGcmFtZWJ1ZmZlciApO1xuXG4gICAgaWYoY2xlYXIpXG4gICAge1xuICAgICAgICBnbC5jbGVhckNvbG9yKDAsMCwwLCAwKTtcbiAgICAgICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG4gICAgfVxuXG4gICAgLy8gVEhJUyBXSUxMIE1FU1MgV0lUSCBISVQgVEVTVElORyFcbiAgICB2YXIgY2hpbGRyZW4gPSBkaXNwbGF5T2JqZWN0LmNoaWxkcmVuO1xuXG4gICAgLy9UT0RPIC0/IGNyZWF0ZSBhIG5ldyBvbmU/Pz8gZG9udCB0aGluayBzbyFcbiAgICB2YXIgb3JpZ2luYWxXb3JsZFRyYW5zZm9ybSA9IGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm07XG4gICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybSA9IG1hdDMuY3JlYXRlKCk7Ly9zdGhpcy5pZGVudGl0eU1hdHJpeDtcbiAgICAvLyBtb2RpZnkgdG8gZmxpcC4uLlxuICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm1bNF0gPSAtMTtcbiAgICBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtWzVdID0gdGhpcy5wcm9qZWN0aW9uLnkgKiAyO1xuXG5cbiAgICBpZihwb3NpdGlvbilcbiAgICB7XG4gICAgICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm1bMl0gPSBwb3NpdGlvbi54O1xuICAgICAgICBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtWzVdIC09IHBvc2l0aW9uLnk7XG4gICAgfVxuXG4gICAgZ2xvYmFscy52aXNpYmxlQ291bnQrKztcbiAgICBkaXNwbGF5T2JqZWN0LnZjb3VudCA9IGdsb2JhbHMudmlzaWJsZUNvdW50O1xuXG4gICAgZm9yKHZhciBpPTAsaj1jaGlsZHJlbi5sZW5ndGg7IGk8ajsgaSsrKVxuICAgIHtcbiAgICAgICAgY2hpbGRyZW5baV0udXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgdmFyIHJlbmRlckdyb3VwID0gZGlzcGxheU9iamVjdC5fX3JlbmRlckdyb3VwO1xuXG4gICAgaWYocmVuZGVyR3JvdXApXG4gICAge1xuICAgICAgICBpZihkaXNwbGF5T2JqZWN0ID09IHJlbmRlckdyb3VwLnJvb3QpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHJlbmRlckdyb3VwLnJlbmRlcih0aGlzLnByb2plY3Rpb24pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgcmVuZGVyR3JvdXAucmVuZGVyU3BlY2lmaWMoZGlzcGxheU9iamVjdCwgdGhpcy5wcm9qZWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBpZighdGhpcy5yZW5kZXJHcm91cCl0aGlzLnJlbmRlckdyb3VwID0gbmV3IFdlYkdMUmVuZGVyR3JvdXAoZ2wpO1xuICAgICAgICB0aGlzLnJlbmRlckdyb3VwLnNldFJlbmRlcmFibGUoZGlzcGxheU9iamVjdCk7XG4gICAgICAgIHRoaXMucmVuZGVyR3JvdXAucmVuZGVyKHRoaXMucHJvamVjdGlvbik7XG4gICAgfVxuXG4gICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybSA9IG9yaWdpbmFsV29ybGRUcmFuc2Zvcm07XG59O1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBkcmF3IHRoZSBkaXNwbGF5IG9iamVjdCB0byB0aGUgdGV4dHVyZS5cbiAqXG4gKiBAbWV0aG9kIHJlbmRlckNhbnZhc1xuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9IFRoZSBkaXNwbGF5IG9iamVjdCB0byByZW5kZXIgdGhpcyB0ZXh0dXJlIG9uXG4gKiBAcGFyYW0gY2xlYXIge0Jvb2xlYW59IElmIHRydWUgdGhlIHRleHR1cmUgd2lsbCBiZSBjbGVhcmVkIGJlZm9yZSB0aGUgZGlzcGxheU9iamVjdCBpcyBkcmF3blxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyQ2FudmFzID0gZnVuY3Rpb24gcmVuZGVyQ2FudmFzKGRpc3BsYXlPYmplY3QsIHBvc2l0aW9uLCBjbGVhcilcbntcbiAgICB2YXIgY2hpbGRyZW4gPSBkaXNwbGF5T2JqZWN0LmNoaWxkcmVuO1xuXG4gICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybSA9IG1hdDMuY3JlYXRlKCk7XG5cbiAgICBpZihwb3NpdGlvbilcbiAgICB7XG4gICAgICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm1bMl0gPSBwb3NpdGlvbi54O1xuICAgICAgICBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtWzVdID0gcG9zaXRpb24ueTtcbiAgICB9XG5cblxuICAgIGZvcih2YXIgaT0wLGo9Y2hpbGRyZW4ubGVuZ3RoOyBpPGo7IGkrKylcbiAgICB7XG4gICAgICAgIGNoaWxkcmVuW2ldLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgIH1cblxuICAgIGlmKGNsZWFyKXRoaXMucmVuZGVyZXIuY29udGV4dC5jbGVhclJlY3QoMCwwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICB0aGlzLnJlbmRlcmVyLnJlbmRlckRpc3BsYXlPYmplY3QoZGlzcGxheU9iamVjdCk7XG5cbiAgICB0aGlzLnJlbmRlcmVyLmNvbnRleHQuc2V0VHJhbnNmb3JtKDEsMCwwLDEsMCwwKTtcblxuICAgIC8vZ2xvYmFscy50ZXh0dXJlc1RvVXBkYXRlLnB1c2godGhpcy5iYXNlVGV4dHVyZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlbmRlclRleHR1cmU7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBCYXNlVGV4dHVyZSA9IHJlcXVpcmUoJy4vQmFzZVRleHR1cmUnKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcbnZhciBSZWN0YW5nbGUgPSByZXF1aXJlKCcuLi9nZW9tL1JlY3RhbmdsZScpO1xudmFyIEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG5cbi8qKlxuICogQSB0ZXh0dXJlIHN0b3JlcyB0aGUgaW5mb3JtYXRpb24gdGhhdCByZXByZXNlbnRzIGFuIGltYWdlIG9yIHBhcnQgb2YgYW4gaW1hZ2UuIEl0IGNhbm5vdCBiZSBhZGRlZFxuICogdG8gdGhlIGRpc3BsYXkgbGlzdCBkaXJlY3RseS4gVG8gZG8gdGhpcyB1c2UgU3ByaXRlLiBJZiBubyBmcmFtZSBpcyBwcm92aWRlZCB0aGVuIHRoZSB3aG9sZSBpbWFnZSBpcyB1c2VkXG4gKlxuICogQGNsYXNzIFRleHR1cmVcbiAqIEB1c2VzIEV2ZW50VGFyZ2V0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSBiYXNlVGV4dHVyZSB7QmFzZVRleHR1cmV9IFRoZSBiYXNlIHRleHR1cmUgc291cmNlIHRvIGNyZWF0ZSB0aGUgdGV4dHVyZSBmcm9tXG4gKiBAcGFyYW0gZnJhbWUge1JlY3RhbmdsZX0gVGhlIHJlY3RhbmdsZSBmcmFtZSBvZiB0aGUgdGV4dHVyZSB0byBzaG93XG4gKi9cbmZ1bmN0aW9uIFRleHR1cmUoYmFzZVRleHR1cmUsIGZyYW1lKVxue1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwoIHRoaXMgKTtcblxuICAgIGlmKCFmcmFtZSlcbiAgICB7XG4gICAgICAgIHRoaXMubm9GcmFtZSA9IHRydWU7XG4gICAgICAgIGZyYW1lID0gbmV3IFJlY3RhbmdsZSgwLDAsMSwxKTtcbiAgICB9XG5cbiAgICBpZihiYXNlVGV4dHVyZSBpbnN0YW5jZW9mIFRleHR1cmUpXG4gICAgICAgIGJhc2VUZXh0dXJlID0gYmFzZVRleHR1cmUuYmFzZVRleHR1cmU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYmFzZSB0ZXh0dXJlIG9mIHRoaXMgdGV4dHVyZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGJhc2VUZXh0dXJlXG4gICAgICogQHR5cGUgQmFzZVRleHR1cmVcbiAgICAgKi9cbiAgICB0aGlzLmJhc2VUZXh0dXJlID0gYmFzZVRleHR1cmU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnJhbWUgc3BlY2lmaWVzIHRoZSByZWdpb24gb2YgdGhlIGJhc2UgdGV4dHVyZSB0aGF0IHRoaXMgdGV4dHVyZSB1c2VzXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZnJhbWVcbiAgICAgKiBAdHlwZSBSZWN0YW5nbGVcbiAgICAgKi9cbiAgICB0aGlzLmZyYW1lID0gZnJhbWU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHJpbSBwb2ludFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRyaW1cbiAgICAgKiBAdHlwZSBQb2ludFxuICAgICAqL1xuICAgIHRoaXMudHJpbSA9IG5ldyBQb2ludCgpO1xuXG4gICAgdGhpcy5zY29wZSA9IHRoaXM7XG5cbiAgICBpZihiYXNlVGV4dHVyZS5oYXNMb2FkZWQpXG4gICAge1xuICAgICAgICBpZih0aGlzLm5vRnJhbWUpZnJhbWUgPSBuZXcgUmVjdGFuZ2xlKDAsMCwgYmFzZVRleHR1cmUud2lkdGgsIGJhc2VUZXh0dXJlLmhlaWdodCk7XG4gICAgICAgIC8vY29uc29sZS5sb2coZnJhbWUpXG5cbiAgICAgICAgdGhpcy5zZXRGcmFtZShmcmFtZSk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgICAgIGJhc2VUZXh0dXJlLmFkZEV2ZW50TGlzdGVuZXIoICdsb2FkZWQnLCBmdW5jdGlvbigpeyBzY29wZS5vbkJhc2VUZXh0dXJlTG9hZGVkKCl9ICk7XG4gICAgfVxufVxuXG52YXIgcHJvdG8gPSBUZXh0dXJlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDYWxsZWQgd2hlbiB0aGUgYmFzZSB0ZXh0dXJlIGlzIGxvYWRlZFxuICpcbiAqIEBtZXRob2Qgb25CYXNlVGV4dHVyZUxvYWRlZFxuICogQHBhcmFtIGV2ZW50XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkJhc2VUZXh0dXJlTG9hZGVkID0gZnVuY3Rpb24gb25CYXNlVGV4dHVyZUxvYWRlZChldmVudClcbntcbiAgICB2YXIgYmFzZVRleHR1cmUgPSB0aGlzLmJhc2VUZXh0dXJlO1xuICAgIGJhc2VUZXh0dXJlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdsb2FkZWQnLCB0aGlzLm9uTG9hZGVkICk7XG5cbiAgICBpZih0aGlzLm5vRnJhbWUpdGhpcy5mcmFtZSA9IG5ldyBSZWN0YW5nbGUoMCwwLCBiYXNlVGV4dHVyZS53aWR0aCwgYmFzZVRleHR1cmUuaGVpZ2h0KTtcbiAgICB0aGlzLm5vRnJhbWUgPSBmYWxzZTtcbiAgICB0aGlzLndpZHRoID0gdGhpcy5mcmFtZS53aWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IHRoaXMuZnJhbWUuaGVpZ2h0O1xuXG4gICAgdGhpcy5zY29wZS5kaXNwYXRjaEV2ZW50KCB7IHR5cGU6ICd1cGRhdGUnLCBjb250ZW50OiB0aGlzIH0gKTtcbn07XG5cbi8qKlxuICogRGVzdHJveXMgdGhpcyB0ZXh0dXJlXG4gKlxuICogQG1ldGhvZCBkZXN0cm95XG4gKiBAcGFyYW0gZGVzdHJveUJhc2Uge0Jvb2xlYW59IFdoZXRoZXIgdG8gZGVzdHJveSB0aGUgYmFzZSB0ZXh0dXJlIGFzIHdlbGxcbiAqL1xucHJvdG8uZGVzdHJveSA9IGZ1bmN0aW9uIGRlc3Ryb3koZGVzdHJveUJhc2UpXG57XG4gICAgaWYoZGVzdHJveUJhc2UpdGhpcy5iYXNlVGV4dHVyZS5kZXN0cm95KCk7XG59O1xuXG4vKipcbiAqIFNwZWNpZmllcyB0aGUgcmVjdGFuZ2xlIHJlZ2lvbiBvZiB0aGUgYmFzZVRleHR1cmVcbiAqXG4gKiBAbWV0aG9kIHNldEZyYW1lXG4gKiBAcGFyYW0gZnJhbWUge1JlY3RhbmdsZX0gVGhlIGZyYW1lIG9mIHRoZSB0ZXh0dXJlIHRvIHNldCBpdCB0b1xuICovXG5wcm90by5zZXRGcmFtZSA9IGZ1bmN0aW9uIHNldEZyYW1lKGZyYW1lKVxue1xuICAgIHRoaXMuZnJhbWUgPSBmcmFtZTtcbiAgICB0aGlzLndpZHRoID0gZnJhbWUud2lkdGg7XG4gICAgdGhpcy5oZWlnaHQgPSBmcmFtZS5oZWlnaHQ7XG5cbiAgICBpZihmcmFtZS54ICsgZnJhbWUud2lkdGggPiB0aGlzLmJhc2VUZXh0dXJlLndpZHRoIHx8IGZyYW1lLnkgKyBmcmFtZS5oZWlnaHQgPiB0aGlzLmJhc2VUZXh0dXJlLmhlaWdodClcbiAgICB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRleHR1cmUgRXJyb3I6IGZyYW1lIGRvZXMgbm90IGZpdCBpbnNpZGUgdGhlIGJhc2UgVGV4dHVyZSBkaW1lbnNpb25zIFwiICsgdGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG5cbiAgICBUZXh0dXJlLmZyYW1lVXBkYXRlcy5wdXNoKHRoaXMpO1xuICAgIC8vdGhpcy5kaXNwYXRjaEV2ZW50KCB7IHR5cGU6ICd1cGRhdGUnLCBjb250ZW50OiB0aGlzIH0gKTtcbn07XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHRleHR1cmUgYmFzZWQgb24gYW4gaW1hZ2UgdXJsXG4gKiBJZiB0aGUgaW1hZ2UgaXMgbm90IGluIHRoZSB0ZXh0dXJlIGNhY2hlIGl0IHdpbGwgYmUgIGNyZWF0ZWQgYW5kIGxvYWRlZFxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZnJvbUltYWdlXG4gKiBAcGFyYW0gaW1hZ2VVcmwge1N0cmluZ30gVGhlIGltYWdlIHVybCBvZiB0aGUgdGV4dHVyZVxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKiBAcmV0dXJuIFRleHR1cmVcbiAqL1xuVGV4dHVyZS5mcm9tSW1hZ2UgPSBmdW5jdGlvbiBmcm9tSW1hZ2UoaW1hZ2VVcmwsIGNyb3Nzb3JpZ2luKVxue1xuICAgIHZhciB0ZXh0dXJlID0gVGV4dHVyZS5jYWNoZVtpbWFnZVVybF07XG5cbiAgICBpZighdGV4dHVyZSlcbiAgICB7XG4gICAgICAgIHRleHR1cmUgPSBuZXcgVGV4dHVyZShCYXNlVGV4dHVyZS5mcm9tSW1hZ2UoaW1hZ2VVcmwsIGNyb3Nzb3JpZ2luKSk7XG4gICAgICAgIFRleHR1cmUuY2FjaGVbaW1hZ2VVcmxdID0gdGV4dHVyZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGV4dHVyZTtcbn07XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHRleHR1cmUgYmFzZWQgb24gYSBmcmFtZSBpZFxuICogSWYgdGhlIGZyYW1lIGlkIGlzIG5vdCBpbiB0aGUgdGV4dHVyZSBjYWNoZSBhbiBlcnJvciB3aWxsIGJlIHRocm93blxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZnJvbUZyYW1lXG4gKiBAcGFyYW0gZnJhbWVJZCB7U3RyaW5nfSBUaGUgZnJhbWUgaWQgb2YgdGhlIHRleHR1cmVcbiAqIEByZXR1cm4gVGV4dHVyZVxuICovXG5UZXh0dXJlLmZyb21GcmFtZSA9IGZ1bmN0aW9uIGZyb21GcmFtZShmcmFtZUlkKVxue1xuICAgIHZhciB0ZXh0dXJlID0gVGV4dHVyZS5jYWNoZVtmcmFtZUlkXTtcbiAgICBpZighdGV4dHVyZSl0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZnJhbWVJZCAnXCIrIGZyYW1lSWQgK1wiJyBkb2VzIG5vdCBleGlzdCBpbiB0aGUgdGV4dHVyZSBjYWNoZSBcIiArIHRoaXMpO1xuICAgIHJldHVybiB0ZXh0dXJlO1xufTtcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgdGV4dHVyZSBiYXNlZCBvbiBhIGNhbnZhcyBlbGVtZW50XG4gKiBJZiB0aGUgY2FudmFzIGlzIG5vdCBpbiB0aGUgdGV4dHVyZSBjYWNoZSBpdCB3aWxsIGJlICBjcmVhdGVkIGFuZCBsb2FkZWRcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGZyb21DYW52YXNcbiAqIEBwYXJhbSBjYW52YXMge0NhbnZhc30gVGhlIGNhbnZhcyBlbGVtZW50IHNvdXJjZSBvZiB0aGUgdGV4dHVyZVxuICogQHJldHVybiBUZXh0dXJlXG4gKi9cblRleHR1cmUuZnJvbUNhbnZhcyA9IGZ1bmN0aW9uIGZyb21DYW52YXMoY2FudmFzKVxue1xuICAgIHZhciBiYXNlVGV4dHVyZSA9IG5ldyBCYXNlVGV4dHVyZShjYW52YXMpO1xuICAgIHJldHVybiBuZXcgVGV4dHVyZShiYXNlVGV4dHVyZSk7XG59O1xuXG5cbi8qKlxuICogQWRkcyBhIHRleHR1cmUgdG8gdGhlIHRleHR1cmVDYWNoZS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGFkZFRleHR1cmVUb0NhY2hlXG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX1cbiAqIEBwYXJhbSBpZCB7U3RyaW5nfSB0aGUgaWQgdGhhdCB0aGUgdGV4dHVyZSB3aWxsIGJlIHN0b3JlZCBhZ2FpbnN0LlxuICovXG5UZXh0dXJlLmFkZFRleHR1cmVUb0NhY2hlID0gZnVuY3Rpb24gYWRkVGV4dHVyZVRvQ2FjaGUodGV4dHVyZSwgaWQpXG57XG4gICAgVGV4dHVyZS5jYWNoZVtpZF0gPSB0ZXh0dXJlO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgYSB0ZXh0dXJlIGZyb20gdGhlIHRleHR1cmVDYWNoZS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHJlbW92ZVRleHR1cmVGcm9tQ2FjaGVcbiAqIEBwYXJhbSBpZCB7U3RyaW5nfSB0aGUgaWQgb2YgdGhlIHRleHR1cmUgdG8gYmUgcmVtb3ZlZFxuICogQHJldHVybiB7VGV4dHVyZX0gdGhlIHRleHR1cmUgdGhhdCB3YXMgcmVtb3ZlZFxuICovXG5UZXh0dXJlLnJlbW92ZVRleHR1cmVGcm9tQ2FjaGUgPSBmdW5jdGlvbiByZW1vdmVUZXh0dXJlRnJvbUNhY2hlKGlkKVxue1xuICAgIHZhciB0ZXh0dXJlID0gVGV4dHVyZS5jYWNoZVtpZF1cbiAgICBUZXh0dXJlLmNhY2hlW2lkXSA9IG51bGw7XG4gICAgcmV0dXJuIHRleHR1cmU7XG59O1xuXG5UZXh0dXJlLmNhY2hlID0ge307XG4vLyB0aGlzIGlzIG1vcmUgZm9yIHdlYkdMLi4gaXQgY29udGFpbnMgdXBkYXRlZCBmcmFtZXMuLlxuVGV4dHVyZS5mcmFtZVVwZGF0ZXMgPSBbXTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0dXJlO1xuIiwiLypcbiAgICBQb2x5SyBsaWJyYXJ5XG4gICAgdXJsOiBodHRwOi8vcG9seWsuaXZhbmsubmV0XG4gICAgUmVsZWFzZWQgdW5kZXIgTUlUIGxpY2VuY2UuXG5cbiAgICBDb3B5cmlnaHQgKGMpIDIwMTIgSXZhbiBLdWNraXJcblxuICAgIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uXG4gICAgb2J0YWluaW5nIGEgY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb25cbiAgICBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXRcbiAgICByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSxcbiAgICBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICAgIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZVxuICAgIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nXG4gICAgY29uZGl0aW9uczpcblxuICAgIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlXG4gICAgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG5cbiAgICBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELFxuICAgIEVYUFJFU1MgT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFU1xuICAgIE9GIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EXG4gICAgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFRcbiAgICBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSxcbiAgICBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkdcbiAgICBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SXG4gICAgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4gICAgVGhpcyBpcyBhbiBhbWF6aW5nIGxpYiFcblxuICAgIHNsaWdodGx5IG1vZGlmaWVkIGJ5IG1hdCBncm92ZXMgKG1hdGdyb3Zlcy5jb20pO1xuKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vcGxhdGZvcm0nKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYSBwb2ludCBpcyB3aXRoaW4gYSB0cmlhbmdsZVxuICpcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIHBvaW50SW5UcmlhbmdsZShweCwgcHksIGF4LCBheSwgYngsIGJ5LCBjeCwgY3kpXG57XG4gICAgdmFyIHYweCA9IGN4LWF4O1xuICAgIHZhciB2MHkgPSBjeS1heTtcbiAgICB2YXIgdjF4ID0gYngtYXg7XG4gICAgdmFyIHYxeSA9IGJ5LWF5O1xuICAgIHZhciB2MnggPSBweC1heDtcbiAgICB2YXIgdjJ5ID0gcHktYXk7XG5cbiAgICB2YXIgZG90MDAgPSB2MHgqdjB4K3YweSp2MHk7XG4gICAgdmFyIGRvdDAxID0gdjB4KnYxeCt2MHkqdjF5O1xuICAgIHZhciBkb3QwMiA9IHYweCp2MngrdjB5KnYyeTtcbiAgICB2YXIgZG90MTEgPSB2MXgqdjF4K3YxeSp2MXk7XG4gICAgdmFyIGRvdDEyID0gdjF4KnYyeCt2MXkqdjJ5O1xuXG4gICAgdmFyIGludkRlbm9tID0gMSAvIChkb3QwMCAqIGRvdDExIC0gZG90MDEgKiBkb3QwMSk7XG4gICAgdmFyIHUgPSAoZG90MTEgKiBkb3QwMiAtIGRvdDAxICogZG90MTIpICogaW52RGVub207XG4gICAgdmFyIHYgPSAoZG90MDAgKiBkb3QxMiAtIGRvdDAxICogZG90MDIpICogaW52RGVub207XG5cbiAgICAvLyBDaGVjayBpZiBwb2ludCBpcyBpbiB0cmlhbmdsZVxuICAgIHJldHVybiAodSA+PSAwKSAmJiAodiA+PSAwKSAmJiAodSArIHYgPCAxKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYSBzaGFwZSBpcyBjb252ZXhcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBjb252ZXgoYXgsIGF5LCBieCwgYnksIGN4LCBjeSwgc2lnbilcbntcbiAgICByZXR1cm4gKChheS1ieSkqKGN4LWJ4KSArIChieC1heCkqKGN5LWJ5KSA+PSAwKSA9PSBzaWduO1xufVxuXG4vKipcbiAqIFRyaWFuZ3VsYXRlcyBzaGFwZXMgZm9yIHdlYkdMIGdyYXBoaWMgZmlsbHNcbiAqXG4gKiBAbmFtZXNwYWNlIFBvbHlLXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZXhwb3J0cy50cmlhbmd1bGF0ZSA9IGZ1bmN0aW9uKHApXG57XG4gICAgdmFyIHNpZ24gPSB0cnVlO1xuXG4gICAgdmFyIG4gPSBwLmxlbmd0aD4+MTtcbiAgICBpZihuPDMpIHJldHVybiBbXTtcbiAgICB2YXIgdGdzID0gW107XG4gICAgdmFyIGF2bCA9IFtdO1xuICAgIGZvcih2YXIgaT0wOyBpPG47IGkrKykgYXZsLnB1c2goaSk7XG5cbiAgICBpID0gMDtcbiAgICB2YXIgYWwgPSBuO1xuICAgIHdoaWxlKGFsID4gMylcbiAgICB7XG4gICAgICAgIHZhciBpMCA9IGF2bFsoaSswKSVhbF07XG4gICAgICAgIHZhciBpMSA9IGF2bFsoaSsxKSVhbF07XG4gICAgICAgIHZhciBpMiA9IGF2bFsoaSsyKSVhbF07XG5cbiAgICAgICAgdmFyIGF4ID0gcFsyKmkwXSwgIGF5ID0gcFsyKmkwKzFdO1xuICAgICAgICB2YXIgYnggPSBwWzIqaTFdLCAgYnkgPSBwWzIqaTErMV07XG4gICAgICAgIHZhciBjeCA9IHBbMippMl0sICBjeSA9IHBbMippMisxXTtcblxuICAgICAgICB2YXIgZWFyRm91bmQgPSBmYWxzZTtcbiAgICAgICAgaWYoY29udmV4KGF4LCBheSwgYngsIGJ5LCBjeCwgY3ksIHNpZ24pKVxuICAgICAgICB7XG4gICAgICAgICAgICBlYXJGb3VuZCA9IHRydWU7XG4gICAgICAgICAgICBmb3IodmFyIGo9MDsgajxhbDsgaisrKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHZhciB2aSA9IGF2bFtqXTtcbiAgICAgICAgICAgICAgICBpZih2aT09aTAgfHwgdmk9PWkxIHx8IHZpPT1pMikgY29udGludWU7XG4gICAgICAgICAgICAgICAgaWYocG9pbnRJblRyaWFuZ2xlKHBbMip2aV0sIHBbMip2aSsxXSwgYXgsIGF5LCBieCwgYnksIGN4LCBjeSkpIHtlYXJGb3VuZCA9IGZhbHNlOyBicmVhazt9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYoZWFyRm91bmQpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRncy5wdXNoKGkwLCBpMSwgaTIpO1xuICAgICAgICAgICAgYXZsLnNwbGljZSgoaSsxKSVhbCwgMSk7XG4gICAgICAgICAgICBhbC0tO1xuICAgICAgICAgICAgaSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihpKysgPiAzKmFsKVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBuZWVkIHRvIGZsaXAgZmxpcCByZXZlcnNlIGl0IVxuICAgICAgICAgICAgLy8gcmVzZXQhXG4gICAgICAgICAgICBpZihzaWduKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRncyA9IFtdO1xuICAgICAgICAgICAgICAgIGF2bCA9IFtdO1xuICAgICAgICAgICAgICAgIGZvcihpPTA7IGk8bjsgaSsrKSBhdmwucHVzaChpKTtcblxuICAgICAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICAgICAgICAgIGFsID0gbjtcblxuICAgICAgICAgICAgICAgIHNpZ24gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybS5jb25zb2xlLndhcm4oXCJQSVhJIFdhcm5pbmc6IHNoYXBlIHRvbyBjb21wbGV4IHRvIGZpbGxcIilcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGdzLnB1c2goYXZsWzBdLCBhdmxbMV0sIGF2bFsyXSk7XG4gICAgcmV0dXJuIHRncztcbn1cbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vcGxhdGZvcm0nKTtcbnZhciBDYW52YXNSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVycy9jYW52YXMvQ2FudmFzUmVuZGVyZXInKTtcbnZhciBXZWJHTFJlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXJzL3dlYmdsL1dlYkdMUmVuZGVyZXInKTtcblxuLyoqXG4gKiBUaGlzIGhlbHBlciBmdW5jdGlvbiB3aWxsIGF1dG9tYXRpY2FsbHkgZGV0ZWN0IHdoaWNoIHJlbmRlcmVyIHlvdSBzaG91bGQgYmUgdXNpbmcuXG4gKiBXZWJHTCBpcyB0aGUgcHJlZmVycmVkIHJlbmRlcmVyIGFzIGl0IGlzIGEgbG90IGZhc3Rlc3QuIElmIHdlYkdMIGlzIG5vdCBzdXBwb3J0ZWQgYnlcbiAqIHRoZSBicm93c2VyIHRoZW4gdGhpcyBmdW5jdGlvbiB3aWxsIHJldHVybiBhIGNhbnZhcyByZW5kZXJlclxuICpcbiAqIEBtZXRob2QgYXV0b0RldGVjdFJlbmRlcmVyXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0gd2lkdGgge051bWJlcn0gdGhlIHdpZHRoIG9mIHRoZSByZW5kZXJlcnMgdmlld1xuICogQHBhcmFtIGhlaWdodCB7TnVtYmVyfSB0aGUgaGVpZ2h0IG9mIHRoZSByZW5kZXJlcnMgdmlld1xuICogQHBhcmFtIHZpZXcge0NhbnZhc30gdGhlIGNhbnZhcyB0byB1c2UgYXMgYSB2aWV3LCBvcHRpb25hbFxuICogQHBhcmFtIHRyYW5zcGFyZW50PWZhbHNlIHtCb29sZWFufSB0aGUgdHJhbnNwYXJlbmN5IG9mIHRoZSByZW5kZXIgdmlldywgZGVmYXVsdCBmYWxzZVxuICogQHBhcmFtIGFudGlhbGlhcz1mYWxzZSB7Qm9vbGVhbn0gc2V0cyBhbnRpYWxpYXMgKG9ubHkgYXBwbGljYWJsZSBpbiB3ZWJHTCBjaHJvbWUgYXQgdGhlIG1vbWVudClcbiAqXG4gKiBhbnRpYWxpYXNcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhdXRvRGV0ZWN0UmVuZGVyZXIod2lkdGgsIGhlaWdodCwgdmlldywgdHJhbnNwYXJlbnQsIGFudGlhbGlhcylcbntcbiAgICBpZighd2lkdGgpd2lkdGggPSA4MDA7XG4gICAgaWYoIWhlaWdodCloZWlnaHQgPSA2MDA7XG5cbiAgICAvLyBCT1JST1dFRCBmcm9tIE1yIERvb2IgKG1yZG9vYi5jb20pXG4gICAgdmFyIHdlYmdsID0gKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjYW52YXMgPSBwbGF0Zm9ybS5jcmVhdGVDYW52YXMoKTtcbiAgICAgICAgICAgIHJldHVybiAhISBwbGF0Zm9ybS53aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ICYmIChjYW52YXMuZ2V0Q29udGV4dCgnd2ViZ2wnKSB8fCBjYW52YXMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJykpO1xuICAgICAgICB9IGNhdGNoKCBlICkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSgpKTtcblxuICAgIC8vY29uc29sZS5sb2cod2ViZ2wpO1xuICAgIGlmKCB3ZWJnbCApXG4gICAge1xuICAgICAgICByZXR1cm4gbmV3IFdlYkdMUmVuZGVyZXIod2lkdGgsIGhlaWdodCwgdmlldywgdHJhbnNwYXJlbnQsIGFudGlhbGlhcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBDYW52YXNSZW5kZXJlcih3aWR0aCwgaGVpZ2h0LCB2aWV3LCB0cmFuc3BhcmVudCk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENvbnZlcnRzIGEgaGV4IGNvbG9yIG51bWJlciB0byBhbiBbUiwgRywgQl0gYXJyYXlcbiAqXG4gKiBAcGFyYW0gaGV4IHtOdW1iZXJ9XG4gKi9cbmV4cG9ydHMuaGV4MnJnYiA9IGZ1bmN0aW9uIGhleDJyZ2IoaGV4KVxue1xuICAgIHJldHVybiBbKGhleCA+PiAxNiAmIDB4RkYpIC8gMjU1LCAoIGhleCA+PiA4ICYgMHhGRikgLyAyNTUsIChoZXggJiAweEZGKS8gMjU1XTtcbn07XG4iLCJ2YXIgZ2xvYmFsPXR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fTsvLyBodHRwOi8vcGF1bGlyaXNoLmNvbS8yMDExL3JlcXVlc3RhbmltYXRpb25mcmFtZS1mb3Itc21hcnQtYW5pbWF0aW5nL1xuLy8gaHR0cDovL215Lm9wZXJhLmNvbS9lbW9sbGVyL2Jsb2cvMjAxMS8xMi8yMC9yZXF1ZXN0YW5pbWF0aW9uZnJhbWUtZm9yLXNtYXJ0LWVyLWFuaW1hdGluZ1xuXG4vLyByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgcG9seWZpbGwgYnkgRXJpayBNw7ZsbGVyLiBmaXhlcyBmcm9tIFBhdWwgSXJpc2ggYW5kIFRpbm8gWmlqZGVsXG5cbi8vIE1JVCBsaWNlbnNlXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLyoqXG4gICAgICogQSBwb2x5ZmlsbCBmb3IgcmVxdWVzdEFuaW1hdGlvbkZyYW1lXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIHJlcXVlc3RBbmltYXRpb25GcmFtZVxuICAgICAqL1xuICAgIC8qKlxuICAgICAqIEEgcG9seWZpbGwgZm9yIGNhbmNlbEFuaW1hdGlvbkZyYW1lXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGNhbmNlbEFuaW1hdGlvbkZyYW1lXG4gICAgICovXG4gICAgdmFyIGxhc3RUaW1lID0gMDtcbiAgICB2YXIgdmVuZG9ycyA9IFsnbXMnLCAnbW96JywgJ3dlYmtpdCcsICdvJ107XG5cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgdmVuZG9ycy5sZW5ndGggJiYgIWdsb2JhbC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7IGkrKykge1xuICAgICAgICBnbG9iYWwucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZ2xvYmFsW3ZlbmRvcnNbaV0rJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuICAgICAgICBnbG9iYWwuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBnbG9iYWxbdmVuZG9yc1tpXSsnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXSB8fFxuICAgICAgICAgICAgZ2xvYmFsW3ZlbmRvcnNbaV0rJ0NhbmNlbFJlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuICAgIH1cblxuICAgIGlmICghZ2xvYmFsLnJlcXVlc3RBbmltYXRpb25GcmFtZSlcbiAgICAgICAgZ2xvYmFsLnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrLCBlbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgY3VyclRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgdmFyIHRpbWVUb0NhbGwgPSBNYXRoLm1heCgwLCAxNiAtIChjdXJyVGltZSAtIGxhc3RUaW1lKSk7XG4gICAgICAgICAgICB2YXIgaWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjYWxsYmFjayhjdXJyVGltZSArIHRpbWVUb0NhbGwpOyB9LCB0aW1lVG9DYWxsKTtcbiAgICAgICAgICAgIGxhc3RUaW1lID0gY3VyclRpbWUgKyB0aW1lVG9DYWxsO1xuICAgICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICB9O1xuXG4gICAgaWYgKCFnbG9iYWwuY2FuY2VsQW5pbWF0aW9uRnJhbWUpXG4gICAgICAgIGdsb2JhbC5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoaWQpO1xuICAgICAgICB9O1xuXG4gICAgcmV0dXJuIGdsb2JhbC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG5cbn0oKSk7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICogYmFzZWQgb24gcGl4aSBpbXBhY3Qgc3BpbmUgaW1wbGVtZW50YXRpb24gbWFkZSBieSBFZW1lbGkgS2Vsb2tvcnBpIChAZWtlbG9rb3JwaSkgaHR0cHM6Ly9naXRodWIuY29tL2VrZWxva29ycGlcbiAqXG4gKiBBd2Vzb21lIEpTIHJ1biB0aW1lIHByb3ZpZGVkIGJ5IEVzb3RlcmljU29mdHdhcmVcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc290ZXJpY1NvZnR3YXJlL3NwaW5lLXJ1bnRpbWVzXG4gKlxuICovXG4ndXNlIHN0cmljdCc7XG5cbi8qXG4gKiBBd2Vzb21lIEpTIHJ1biB0aW1lIHByb3ZpZGVkIGJ5IEVzb3RlcmljU29mdHdhcmVcbiAqXG4gKiBodHRwczovL2dpdGh1Yi5jb20vRXNvdGVyaWNTb2Z0d2FyZS9zcGluZS1ydW50aW1lc1xuICpcbiAqL1xuXG52YXIgc3BpbmUgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5zcGluZS5Cb25lRGF0YSA9IGZ1bmN0aW9uIChuYW1lLCBwYXJlbnQpIHtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xufTtcbnNwaW5lLkJvbmVEYXRhLnByb3RvdHlwZSA9IHtcbiAgICBsZW5ndGg6IDAsXG4gICAgeDogMCwgeTogMCxcbiAgICByb3RhdGlvbjogMCxcbiAgICBzY2FsZVg6IDEsIHNjYWxlWTogMVxufTtcblxuc3BpbmUuU2xvdERhdGEgPSBmdW5jdGlvbiAobmFtZSwgYm9uZURhdGEpIHtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYm9uZURhdGEgPSBib25lRGF0YTtcbn07XG5zcGluZS5TbG90RGF0YS5wcm90b3R5cGUgPSB7XG4gICAgcjogMSwgZzogMSwgYjogMSwgYTogMSxcbiAgICBhdHRhY2htZW50TmFtZTogbnVsbFxufTtcblxuc3BpbmUuQm9uZSA9IGZ1bmN0aW9uIChib25lRGF0YSwgcGFyZW50KSB7XG4gICAgdGhpcy5kYXRhID0gYm9uZURhdGE7XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgdGhpcy5zZXRUb1NldHVwUG9zZSgpO1xufTtcbnNwaW5lLkJvbmUueURvd24gPSBmYWxzZTtcbnNwaW5lLkJvbmUucHJvdG90eXBlID0ge1xuICAgIHg6IDAsIHk6IDAsXG4gICAgcm90YXRpb246IDAsXG4gICAgc2NhbGVYOiAxLCBzY2FsZVk6IDEsXG4gICAgbTAwOiAwLCBtMDE6IDAsIHdvcmxkWDogMCwgLy8gYSBiIHhcbiAgICBtMTA6IDAsIG0xMTogMCwgd29ybGRZOiAwLCAvLyBjIGQgeVxuICAgIHdvcmxkUm90YXRpb246IDAsXG4gICAgd29ybGRTY2FsZVg6IDEsIHdvcmxkU2NhbGVZOiAxLFxuICAgIHVwZGF0ZVdvcmxkVHJhbnNmb3JtOiBmdW5jdGlvbiAoZmxpcFgsIGZsaXBZKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudDtcbiAgICAgICAgaWYgKHBhcmVudCAhPSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLndvcmxkWCA9IHRoaXMueCAqIHBhcmVudC5tMDAgKyB0aGlzLnkgKiBwYXJlbnQubTAxICsgcGFyZW50LndvcmxkWDtcbiAgICAgICAgICAgIHRoaXMud29ybGRZID0gdGhpcy54ICogcGFyZW50Lm0xMCArIHRoaXMueSAqIHBhcmVudC5tMTEgKyBwYXJlbnQud29ybGRZO1xuICAgICAgICAgICAgdGhpcy53b3JsZFNjYWxlWCA9IHBhcmVudC53b3JsZFNjYWxlWCAqIHRoaXMuc2NhbGVYO1xuICAgICAgICAgICAgdGhpcy53b3JsZFNjYWxlWSA9IHBhcmVudC53b3JsZFNjYWxlWSAqIHRoaXMuc2NhbGVZO1xuICAgICAgICAgICAgdGhpcy53b3JsZFJvdGF0aW9uID0gcGFyZW50LndvcmxkUm90YXRpb24gKyB0aGlzLnJvdGF0aW9uO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy53b3JsZFggPSB0aGlzLng7XG4gICAgICAgICAgICB0aGlzLndvcmxkWSA9IHRoaXMueTtcbiAgICAgICAgICAgIHRoaXMud29ybGRTY2FsZVggPSB0aGlzLnNjYWxlWDtcbiAgICAgICAgICAgIHRoaXMud29ybGRTY2FsZVkgPSB0aGlzLnNjYWxlWTtcbiAgICAgICAgICAgIHRoaXMud29ybGRSb3RhdGlvbiA9IHRoaXMucm90YXRpb247XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJhZGlhbnMgPSB0aGlzLndvcmxkUm90YXRpb24gKiBNYXRoLlBJIC8gMTgwO1xuICAgICAgICB2YXIgY29zID0gTWF0aC5jb3MocmFkaWFucyk7XG4gICAgICAgIHZhciBzaW4gPSBNYXRoLnNpbihyYWRpYW5zKTtcbiAgICAgICAgdGhpcy5tMDAgPSBjb3MgKiB0aGlzLndvcmxkU2NhbGVYO1xuICAgICAgICB0aGlzLm0xMCA9IHNpbiAqIHRoaXMud29ybGRTY2FsZVg7XG4gICAgICAgIHRoaXMubTAxID0gLXNpbiAqIHRoaXMud29ybGRTY2FsZVk7XG4gICAgICAgIHRoaXMubTExID0gY29zICogdGhpcy53b3JsZFNjYWxlWTtcbiAgICAgICAgaWYgKGZsaXBYKSB7XG4gICAgICAgICAgICB0aGlzLm0wMCA9IC10aGlzLm0wMDtcbiAgICAgICAgICAgIHRoaXMubTAxID0gLXRoaXMubTAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy5tMTAgPSAtdGhpcy5tMTA7XG4gICAgICAgICAgICB0aGlzLm0xMSA9IC10aGlzLm0xMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3BpbmUuQm9uZS55RG93bikge1xuICAgICAgICAgICAgdGhpcy5tMTAgPSAtdGhpcy5tMTA7XG4gICAgICAgICAgICB0aGlzLm0xMSA9IC10aGlzLm0xMTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc2V0VG9TZXR1cFBvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgICAgIHRoaXMueCA9IGRhdGEueDtcbiAgICAgICAgdGhpcy55ID0gZGF0YS55O1xuICAgICAgICB0aGlzLnJvdGF0aW9uID0gZGF0YS5yb3RhdGlvbjtcbiAgICAgICAgdGhpcy5zY2FsZVggPSBkYXRhLnNjYWxlWDtcbiAgICAgICAgdGhpcy5zY2FsZVkgPSBkYXRhLnNjYWxlWTtcbiAgICB9XG59O1xuXG5zcGluZS5TbG90ID0gZnVuY3Rpb24gKHNsb3REYXRhLCBza2VsZXRvbiwgYm9uZSkge1xuICAgIHRoaXMuZGF0YSA9IHNsb3REYXRhO1xuICAgIHRoaXMuc2tlbGV0b24gPSBza2VsZXRvbjtcbiAgICB0aGlzLmJvbmUgPSBib25lO1xuICAgIHRoaXMuc2V0VG9TZXR1cFBvc2UoKTtcbn07XG5zcGluZS5TbG90LnByb3RvdHlwZSA9IHtcbiAgICByOiAxLCBnOiAxLCBiOiAxLCBhOiAxLFxuICAgIF9hdHRhY2htZW50VGltZTogMCxcbiAgICBhdHRhY2htZW50OiBudWxsLFxuICAgIHNldEF0dGFjaG1lbnQ6IGZ1bmN0aW9uIChhdHRhY2htZW50KSB7XG4gICAgICAgIHRoaXMuYXR0YWNobWVudCA9IGF0dGFjaG1lbnQ7XG4gICAgICAgIHRoaXMuX2F0dGFjaG1lbnRUaW1lID0gdGhpcy5za2VsZXRvbi50aW1lO1xuICAgIH0sXG4gICAgc2V0QXR0YWNobWVudFRpbWU6IGZ1bmN0aW9uICh0aW1lKSB7XG4gICAgICAgIHRoaXMuX2F0dGFjaG1lbnRUaW1lID0gdGhpcy5za2VsZXRvbi50aW1lIC0gdGltZTtcbiAgICB9LFxuICAgIGdldEF0dGFjaG1lbnRUaW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNrZWxldG9uLnRpbWUgLSB0aGlzLl9hdHRhY2htZW50VGltZTtcbiAgICB9LFxuICAgIHNldFRvU2V0dXBQb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkYXRhID0gdGhpcy5kYXRhO1xuICAgICAgICB0aGlzLnIgPSBkYXRhLnI7XG4gICAgICAgIHRoaXMuZyA9IGRhdGEuZztcbiAgICAgICAgdGhpcy5iID0gZGF0YS5iO1xuICAgICAgICB0aGlzLmEgPSBkYXRhLmE7XG5cbiAgICAgICAgdmFyIHNsb3REYXRhcyA9IHRoaXMuc2tlbGV0b24uZGF0YS5zbG90cztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBzbG90RGF0YXMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoc2xvdERhdGFzW2ldID09IGRhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldEF0dGFjaG1lbnQoIWRhdGEuYXR0YWNobWVudE5hbWUgPyBudWxsIDogdGhpcy5za2VsZXRvbi5nZXRBdHRhY2htZW50QnlTbG90SW5kZXgoaSwgZGF0YS5hdHRhY2htZW50TmFtZSkpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuc3BpbmUuU2tpbiA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmF0dGFjaG1lbnRzID0ge307XG59O1xuc3BpbmUuU2tpbi5wcm90b3R5cGUgPSB7XG4gICAgYWRkQXR0YWNobWVudDogZnVuY3Rpb24gKHNsb3RJbmRleCwgbmFtZSwgYXR0YWNobWVudCkge1xuICAgICAgICB0aGlzLmF0dGFjaG1lbnRzW3Nsb3RJbmRleCArIFwiOlwiICsgbmFtZV0gPSBhdHRhY2htZW50O1xuICAgIH0sXG4gICAgZ2V0QXR0YWNobWVudDogZnVuY3Rpb24gKHNsb3RJbmRleCwgbmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5hdHRhY2htZW50c1tzbG90SW5kZXggKyBcIjpcIiArIG5hbWVdO1xuICAgIH0sXG4gICAgX2F0dGFjaEFsbDogZnVuY3Rpb24gKHNrZWxldG9uLCBvbGRTa2luKSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvbGRTa2luLmF0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgICB2YXIgY29sb24gPSBrZXkuaW5kZXhPZihcIjpcIik7XG4gICAgICAgICAgICB2YXIgc2xvdEluZGV4ID0gcGFyc2VJbnQoa2V5LnN1YnN0cmluZygwLCBjb2xvbiksIDEwKTtcbiAgICAgICAgICAgIHZhciBuYW1lID0ga2V5LnN1YnN0cmluZyhjb2xvbiArIDEpO1xuICAgICAgICAgICAgdmFyIHNsb3QgPSBza2VsZXRvbi5zbG90c1tzbG90SW5kZXhdO1xuICAgICAgICAgICAgaWYgKHNsb3QuYXR0YWNobWVudCAmJiBzbG90LmF0dGFjaG1lbnQubmFtZSA9PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIGF0dGFjaG1lbnQgPSB0aGlzLmdldEF0dGFjaG1lbnQoc2xvdEluZGV4LCBuYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoYXR0YWNobWVudCkgc2xvdC5zZXRBdHRhY2htZW50KGF0dGFjaG1lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuc3BpbmUuQW5pbWF0aW9uID0gZnVuY3Rpb24gKG5hbWUsIHRpbWVsaW5lcywgZHVyYXRpb24pIHtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMudGltZWxpbmVzID0gdGltZWxpbmVzO1xuICAgIHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjtcbn07XG5zcGluZS5BbmltYXRpb24ucHJvdG90eXBlID0ge1xuICAgIGFwcGx5OiBmdW5jdGlvbiAoc2tlbGV0b24sIHRpbWUsIGxvb3ApIHtcbiAgICAgICAgaWYgKGxvb3AgJiYgdGhpcy5kdXJhdGlvbikgdGltZSAlPSB0aGlzLmR1cmF0aW9uO1xuICAgICAgICB2YXIgdGltZWxpbmVzID0gdGhpcy50aW1lbGluZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gdGltZWxpbmVzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIHRpbWVsaW5lc1tpXS5hcHBseShza2VsZXRvbiwgdGltZSwgMSk7XG4gICAgfSxcbiAgICBtaXg6IGZ1bmN0aW9uIChza2VsZXRvbiwgdGltZSwgbG9vcCwgYWxwaGEpIHtcbiAgICAgICAgaWYgKGxvb3AgJiYgdGhpcy5kdXJhdGlvbikgdGltZSAlPSB0aGlzLmR1cmF0aW9uO1xuICAgICAgICB2YXIgdGltZWxpbmVzID0gdGhpcy50aW1lbGluZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gdGltZWxpbmVzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIHRpbWVsaW5lc1tpXS5hcHBseShza2VsZXRvbiwgdGltZSwgYWxwaGEpO1xuICAgIH1cbn07XG5cbnNwaW5lLmJpbmFyeVNlYXJjaCA9IGZ1bmN0aW9uICh2YWx1ZXMsIHRhcmdldCwgc3RlcCkge1xuICAgIHZhciBsb3cgPSAwO1xuICAgIHZhciBoaWdoID0gTWF0aC5mbG9vcih2YWx1ZXMubGVuZ3RoIC8gc3RlcCkgLSAyO1xuICAgIGlmICghaGlnaCkgcmV0dXJuIHN0ZXA7XG4gICAgdmFyIGN1cnJlbnQgPSBoaWdoID4+PiAxO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGlmICh2YWx1ZXNbKGN1cnJlbnQgKyAxKSAqIHN0ZXBdIDw9IHRhcmdldClcbiAgICAgICAgICAgIGxvdyA9IGN1cnJlbnQgKyAxO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICBoaWdoID0gY3VycmVudDtcbiAgICAgICAgaWYgKGxvdyA9PSBoaWdoKSByZXR1cm4gKGxvdyArIDEpICogc3RlcDtcbiAgICAgICAgY3VycmVudCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcbiAgICB9XG59O1xuc3BpbmUubGluZWFyU2VhcmNoID0gZnVuY3Rpb24gKHZhbHVlcywgdGFyZ2V0LCBzdGVwKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxhc3QgPSB2YWx1ZXMubGVuZ3RoIC0gc3RlcDsgaSA8PSBsYXN0OyBpICs9IHN0ZXApXG4gICAgICAgIGlmICh2YWx1ZXNbaV0gPiB0YXJnZXQpIHJldHVybiBpO1xuICAgIHJldHVybiAtMTtcbn07XG5cbnNwaW5lLkN1cnZlcyA9IGZ1bmN0aW9uIChmcmFtZUNvdW50KSB7XG4gICAgdGhpcy5jdXJ2ZXMgPSBbXTsgLy8gZGZ4LCBkZnksIGRkZngsIGRkZnksIGRkZGZ4LCBkZGRmeSwgLi4uXG4gICAgdGhpcy5jdXJ2ZXMubGVuZ3RoID0gKGZyYW1lQ291bnQgLSAxKSAqIDY7XG59O1xuc3BpbmUuQ3VydmVzLnByb3RvdHlwZSA9IHtcbiAgICBzZXRMaW5lYXI6IGZ1bmN0aW9uIChmcmFtZUluZGV4KSB7XG4gICAgICAgIHRoaXMuY3VydmVzW2ZyYW1lSW5kZXggKiA2XSA9IDAvKkxJTkVBUiovO1xuICAgIH0sXG4gICAgc2V0U3RlcHBlZDogZnVuY3Rpb24gKGZyYW1lSW5kZXgpIHtcbiAgICAgICAgdGhpcy5jdXJ2ZXNbZnJhbWVJbmRleCAqIDZdID0gLTEvKlNURVBQRUQqLztcbiAgICB9LFxuICAgIC8qKiBTZXRzIHRoZSBjb250cm9sIGhhbmRsZSBwb3NpdGlvbnMgZm9yIGFuIGludGVycG9sYXRpb24gYmV6aWVyIGN1cnZlIHVzZWQgdG8gdHJhbnNpdGlvbiBmcm9tIHRoaXMga2V5ZnJhbWUgdG8gdGhlIG5leHQuXG4gICAgICogY3gxIGFuZCBjeDIgYXJlIGZyb20gMCB0byAxLCByZXByZXNlbnRpbmcgdGhlIHBlcmNlbnQgb2YgdGltZSBiZXR3ZWVuIHRoZSB0d28ga2V5ZnJhbWVzLiBjeTEgYW5kIGN5MiBhcmUgdGhlIHBlcmNlbnQgb2ZcbiAgICAgKiB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBrZXlmcmFtZSdzIHZhbHVlcy4gKi9cbiAgICBzZXRDdXJ2ZTogZnVuY3Rpb24gKGZyYW1lSW5kZXgsIGN4MSwgY3kxLCBjeDIsIGN5Mikge1xuICAgICAgICB2YXIgc3ViZGl2X3N0ZXAgPSAxIC8gMTAvKkJFWklFUl9TRUdNRU5UUyovO1xuICAgICAgICB2YXIgc3ViZGl2X3N0ZXAyID0gc3ViZGl2X3N0ZXAgKiBzdWJkaXZfc3RlcDtcbiAgICAgICAgdmFyIHN1YmRpdl9zdGVwMyA9IHN1YmRpdl9zdGVwMiAqIHN1YmRpdl9zdGVwO1xuICAgICAgICB2YXIgcHJlMSA9IDMgKiBzdWJkaXZfc3RlcDtcbiAgICAgICAgdmFyIHByZTIgPSAzICogc3ViZGl2X3N0ZXAyO1xuICAgICAgICB2YXIgcHJlNCA9IDYgKiBzdWJkaXZfc3RlcDI7XG4gICAgICAgIHZhciBwcmU1ID0gNiAqIHN1YmRpdl9zdGVwMztcbiAgICAgICAgdmFyIHRtcDF4ID0gLWN4MSAqIDIgKyBjeDI7XG4gICAgICAgIHZhciB0bXAxeSA9IC1jeTEgKiAyICsgY3kyO1xuICAgICAgICB2YXIgdG1wMnggPSAoY3gxIC0gY3gyKSAqIDMgKyAxO1xuICAgICAgICB2YXIgdG1wMnkgPSAoY3kxIC0gY3kyKSAqIDMgKyAxO1xuICAgICAgICB2YXIgaSA9IGZyYW1lSW5kZXggKiA2O1xuICAgICAgICB2YXIgY3VydmVzID0gdGhpcy5jdXJ2ZXM7XG4gICAgICAgIGN1cnZlc1tpXSA9IGN4MSAqIHByZTEgKyB0bXAxeCAqIHByZTIgKyB0bXAyeCAqIHN1YmRpdl9zdGVwMztcbiAgICAgICAgY3VydmVzW2kgKyAxXSA9IGN5MSAqIHByZTEgKyB0bXAxeSAqIHByZTIgKyB0bXAyeSAqIHN1YmRpdl9zdGVwMztcbiAgICAgICAgY3VydmVzW2kgKyAyXSA9IHRtcDF4ICogcHJlNCArIHRtcDJ4ICogcHJlNTtcbiAgICAgICAgY3VydmVzW2kgKyAzXSA9IHRtcDF5ICogcHJlNCArIHRtcDJ5ICogcHJlNTtcbiAgICAgICAgY3VydmVzW2kgKyA0XSA9IHRtcDJ4ICogcHJlNTtcbiAgICAgICAgY3VydmVzW2kgKyA1XSA9IHRtcDJ5ICogcHJlNTtcbiAgICB9LFxuICAgIGdldEN1cnZlUGVyY2VudDogZnVuY3Rpb24gKGZyYW1lSW5kZXgsIHBlcmNlbnQpIHtcbiAgICAgICAgcGVyY2VudCA9IHBlcmNlbnQgPCAwID8gMCA6IChwZXJjZW50ID4gMSA/IDEgOiBwZXJjZW50KTtcbiAgICAgICAgdmFyIGN1cnZlSW5kZXggPSBmcmFtZUluZGV4ICogNjtcbiAgICAgICAgdmFyIGN1cnZlcyA9IHRoaXMuY3VydmVzO1xuICAgICAgICB2YXIgZGZ4ID0gY3VydmVzW2N1cnZlSW5kZXhdO1xuICAgICAgICBpZiAoIWRmeC8qTElORUFSKi8pIHJldHVybiBwZXJjZW50O1xuICAgICAgICBpZiAoZGZ4ID09IC0xLypTVEVQUEVEKi8pIHJldHVybiAwO1xuICAgICAgICB2YXIgZGZ5ID0gY3VydmVzW2N1cnZlSW5kZXggKyAxXTtcbiAgICAgICAgdmFyIGRkZnggPSBjdXJ2ZXNbY3VydmVJbmRleCArIDJdO1xuICAgICAgICB2YXIgZGRmeSA9IGN1cnZlc1tjdXJ2ZUluZGV4ICsgM107XG4gICAgICAgIHZhciBkZGRmeCA9IGN1cnZlc1tjdXJ2ZUluZGV4ICsgNF07XG4gICAgICAgIHZhciBkZGRmeSA9IGN1cnZlc1tjdXJ2ZUluZGV4ICsgNV07XG4gICAgICAgIHZhciB4ID0gZGZ4LCB5ID0gZGZ5O1xuICAgICAgICB2YXIgaSA9IDEwLypCRVpJRVJfU0VHTUVOVFMqLyAtIDI7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBpZiAoeCA+PSBwZXJjZW50KSB7XG4gICAgICAgICAgICAgICAgdmFyIGxhc3RYID0geCAtIGRmeDtcbiAgICAgICAgICAgICAgICB2YXIgbGFzdFkgPSB5IC0gZGZ5O1xuICAgICAgICAgICAgICAgIHJldHVybiBsYXN0WSArICh5IC0gbGFzdFkpICogKHBlcmNlbnQgLSBsYXN0WCkgLyAoeCAtIGxhc3RYKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghaSkgYnJlYWs7XG4gICAgICAgICAgICBpLS07XG4gICAgICAgICAgICBkZnggKz0gZGRmeDtcbiAgICAgICAgICAgIGRmeSArPSBkZGZ5O1xuICAgICAgICAgICAgZGRmeCArPSBkZGRmeDtcbiAgICAgICAgICAgIGRkZnkgKz0gZGRkZnk7XG4gICAgICAgICAgICB4ICs9IGRmeDtcbiAgICAgICAgICAgIHkgKz0gZGZ5O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB5ICsgKDEgLSB5KSAqIChwZXJjZW50IC0geCkgLyAoMSAtIHgpOyAvLyBMYXN0IHBvaW50IGlzIDEsMS5cbiAgICB9XG59O1xuXG5zcGluZS5Sb3RhdGVUaW1lbGluZSA9IGZ1bmN0aW9uIChmcmFtZUNvdW50KSB7XG4gICAgdGhpcy5jdXJ2ZXMgPSBuZXcgc3BpbmUuQ3VydmVzKGZyYW1lQ291bnQpO1xuICAgIHRoaXMuZnJhbWVzID0gW107IC8vIHRpbWUsIGFuZ2xlLCAuLi5cbiAgICB0aGlzLmZyYW1lcy5sZW5ndGggPSBmcmFtZUNvdW50ICogMjtcbn07XG5zcGluZS5Sb3RhdGVUaW1lbGluZS5wcm90b3R5cGUgPSB7XG4gICAgYm9uZUluZGV4OiAwLFxuICAgIGdldEZyYW1lQ291bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnJhbWVzLmxlbmd0aCAvIDI7XG4gICAgfSxcbiAgICBzZXRGcmFtZTogZnVuY3Rpb24gKGZyYW1lSW5kZXgsIHRpbWUsIGFuZ2xlKSB7XG4gICAgICAgIGZyYW1lSW5kZXggKj0gMjtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleF0gPSB0aW1lO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgMV0gPSBhbmdsZTtcbiAgICB9LFxuICAgIGFwcGx5OiBmdW5jdGlvbiAoc2tlbGV0b24sIHRpbWUsIGFscGhhKSB7XG4gICAgICAgIHZhciBmcmFtZXMgPSB0aGlzLmZyYW1lcyxcbiAgICAgICAgICAgIGFtb3VudDtcblxuICAgICAgICBpZiAodGltZSA8IGZyYW1lc1swXSkgcmV0dXJuOyAvLyBUaW1lIGlzIGJlZm9yZSBmaXJzdCBmcmFtZS5cblxuICAgICAgICB2YXIgYm9uZSA9IHNrZWxldG9uLmJvbmVzW3RoaXMuYm9uZUluZGV4XTtcblxuICAgICAgICBpZiAodGltZSA+PSBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDJdKSB7IC8vIFRpbWUgaXMgYWZ0ZXIgbGFzdCBmcmFtZS5cbiAgICAgICAgICAgIGFtb3VudCA9IGJvbmUuZGF0YS5yb3RhdGlvbiArIGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gMV0gLSBib25lLnJvdGF0aW9uO1xuICAgICAgICAgICAgd2hpbGUgKGFtb3VudCA+IDE4MClcbiAgICAgICAgICAgICAgICBhbW91bnQgLT0gMzYwO1xuICAgICAgICAgICAgd2hpbGUgKGFtb3VudCA8IC0xODApXG4gICAgICAgICAgICAgICAgYW1vdW50ICs9IDM2MDtcbiAgICAgICAgICAgIGJvbmUucm90YXRpb24gKz0gYW1vdW50ICogYWxwaGE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbnRlcnBvbGF0ZSBiZXR3ZWVuIHRoZSBsYXN0IGZyYW1lIGFuZCB0aGUgY3VycmVudCBmcmFtZS5cbiAgICAgICAgdmFyIGZyYW1lSW5kZXggPSBzcGluZS5iaW5hcnlTZWFyY2goZnJhbWVzLCB0aW1lLCAyKTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZVZhbHVlID0gZnJhbWVzW2ZyYW1lSW5kZXggLSAxXTtcbiAgICAgICAgdmFyIGZyYW1lVGltZSA9IGZyYW1lc1tmcmFtZUluZGV4XTtcbiAgICAgICAgdmFyIHBlcmNlbnQgPSAxIC0gKHRpbWUgLSBmcmFtZVRpbWUpIC8gKGZyYW1lc1tmcmFtZUluZGV4IC0gMi8qTEFTVF9GUkFNRV9USU1FKi9dIC0gZnJhbWVUaW1lKTtcbiAgICAgICAgcGVyY2VudCA9IHRoaXMuY3VydmVzLmdldEN1cnZlUGVyY2VudChmcmFtZUluZGV4IC8gMiAtIDEsIHBlcmNlbnQpO1xuXG4gICAgICAgIGFtb3VudCA9IGZyYW1lc1tmcmFtZUluZGV4ICsgMS8qRlJBTUVfVkFMVUUqL10gLSBsYXN0RnJhbWVWYWx1ZTtcbiAgICAgICAgd2hpbGUgKGFtb3VudCA+IDE4MClcbiAgICAgICAgICAgIGFtb3VudCAtPSAzNjA7XG4gICAgICAgIHdoaWxlIChhbW91bnQgPCAtMTgwKVxuICAgICAgICAgICAgYW1vdW50ICs9IDM2MDtcbiAgICAgICAgYW1vdW50ID0gYm9uZS5kYXRhLnJvdGF0aW9uICsgKGxhc3RGcmFtZVZhbHVlICsgYW1vdW50ICogcGVyY2VudCkgLSBib25lLnJvdGF0aW9uO1xuICAgICAgICB3aGlsZSAoYW1vdW50ID4gMTgwKVxuICAgICAgICAgICAgYW1vdW50IC09IDM2MDtcbiAgICAgICAgd2hpbGUgKGFtb3VudCA8IC0xODApXG4gICAgICAgICAgICBhbW91bnQgKz0gMzYwO1xuICAgICAgICBib25lLnJvdGF0aW9uICs9IGFtb3VudCAqIGFscGhhO1xuICAgIH1cbn07XG5cbnNwaW5lLlRyYW5zbGF0ZVRpbWVsaW5lID0gZnVuY3Rpb24gKGZyYW1lQ291bnQpIHtcbiAgICB0aGlzLmN1cnZlcyA9IG5ldyBzcGluZS5DdXJ2ZXMoZnJhbWVDb3VudCk7XG4gICAgdGhpcy5mcmFtZXMgPSBbXTsgLy8gdGltZSwgeCwgeSwgLi4uXG4gICAgdGhpcy5mcmFtZXMubGVuZ3RoID0gZnJhbWVDb3VudCAqIDM7XG59O1xuc3BpbmUuVHJhbnNsYXRlVGltZWxpbmUucHJvdG90eXBlID0ge1xuICAgIGJvbmVJbmRleDogMCxcbiAgICBnZXRGcmFtZUNvdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZyYW1lcy5sZW5ndGggLyAzO1xuICAgIH0sXG4gICAgc2V0RnJhbWU6IGZ1bmN0aW9uIChmcmFtZUluZGV4LCB0aW1lLCB4LCB5KSB7XG4gICAgICAgIGZyYW1lSW5kZXggKj0gMztcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleF0gPSB0aW1lO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgMV0gPSB4O1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgMl0gPSB5O1xuICAgIH0sXG4gICAgYXBwbHk6IGZ1bmN0aW9uIChza2VsZXRvbiwgdGltZSwgYWxwaGEpIHtcbiAgICAgICAgdmFyIGZyYW1lcyA9IHRoaXMuZnJhbWVzO1xuICAgICAgICBpZiAodGltZSA8IGZyYW1lc1swXSkgcmV0dXJuOyAvLyBUaW1lIGlzIGJlZm9yZSBmaXJzdCBmcmFtZS5cblxuICAgICAgICB2YXIgYm9uZSA9IHNrZWxldG9uLmJvbmVzW3RoaXMuYm9uZUluZGV4XTtcblxuICAgICAgICBpZiAodGltZSA+PSBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDNdKSB7IC8vIFRpbWUgaXMgYWZ0ZXIgbGFzdCBmcmFtZS5cbiAgICAgICAgICAgIGJvbmUueCArPSAoYm9uZS5kYXRhLnggKyBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDJdIC0gYm9uZS54KSAqIGFscGhhO1xuICAgICAgICAgICAgYm9uZS55ICs9IChib25lLmRhdGEueSArIGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gMV0gLSBib25lLnkpICogYWxwaGE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbnRlcnBvbGF0ZSBiZXR3ZWVuIHRoZSBsYXN0IGZyYW1lIGFuZCB0aGUgY3VycmVudCBmcmFtZS5cbiAgICAgICAgdmFyIGZyYW1lSW5kZXggPSBzcGluZS5iaW5hcnlTZWFyY2goZnJhbWVzLCB0aW1lLCAzKTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZVggPSBmcmFtZXNbZnJhbWVJbmRleCAtIDJdO1xuICAgICAgICB2YXIgbGFzdEZyYW1lWSA9IGZyYW1lc1tmcmFtZUluZGV4IC0gMV07XG4gICAgICAgIHZhciBmcmFtZVRpbWUgPSBmcmFtZXNbZnJhbWVJbmRleF07XG4gICAgICAgIHZhciBwZXJjZW50ID0gMSAtICh0aW1lIC0gZnJhbWVUaW1lKSAvIChmcmFtZXNbZnJhbWVJbmRleCArIC0zLypMQVNUX0ZSQU1FX1RJTUUqL10gLSBmcmFtZVRpbWUpO1xuICAgICAgICBwZXJjZW50ID0gdGhpcy5jdXJ2ZXMuZ2V0Q3VydmVQZXJjZW50KGZyYW1lSW5kZXggLyAzIC0gMSwgcGVyY2VudCk7XG5cbiAgICAgICAgYm9uZS54ICs9IChib25lLmRhdGEueCArIGxhc3RGcmFtZVggKyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAxLypGUkFNRV9YKi9dIC0gbGFzdEZyYW1lWCkgKiBwZXJjZW50IC0gYm9uZS54KSAqIGFscGhhO1xuICAgICAgICBib25lLnkgKz0gKGJvbmUuZGF0YS55ICsgbGFzdEZyYW1lWSArIChmcmFtZXNbZnJhbWVJbmRleCArIDIvKkZSQU1FX1kqL10gLSBsYXN0RnJhbWVZKSAqIHBlcmNlbnQgLSBib25lLnkpICogYWxwaGE7XG4gICAgfVxufTtcblxuc3BpbmUuU2NhbGVUaW1lbGluZSA9IGZ1bmN0aW9uIChmcmFtZUNvdW50KSB7XG4gICAgdGhpcy5jdXJ2ZXMgPSBuZXcgc3BpbmUuQ3VydmVzKGZyYW1lQ291bnQpO1xuICAgIHRoaXMuZnJhbWVzID0gW107IC8vIHRpbWUsIHgsIHksIC4uLlxuICAgIHRoaXMuZnJhbWVzLmxlbmd0aCA9IGZyYW1lQ291bnQgKiAzO1xufTtcbnNwaW5lLlNjYWxlVGltZWxpbmUucHJvdG90eXBlID0ge1xuICAgIGJvbmVJbmRleDogMCxcbiAgICBnZXRGcmFtZUNvdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZyYW1lcy5sZW5ndGggLyAzO1xuICAgIH0sXG4gICAgc2V0RnJhbWU6IGZ1bmN0aW9uIChmcmFtZUluZGV4LCB0aW1lLCB4LCB5KSB7XG4gICAgICAgIGZyYW1lSW5kZXggKj0gMztcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleF0gPSB0aW1lO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgMV0gPSB4O1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgMl0gPSB5O1xuICAgIH0sXG4gICAgYXBwbHk6IGZ1bmN0aW9uIChza2VsZXRvbiwgdGltZSwgYWxwaGEpIHtcbiAgICAgICAgdmFyIGZyYW1lcyA9IHRoaXMuZnJhbWVzO1xuICAgICAgICBpZiAodGltZSA8IGZyYW1lc1swXSkgcmV0dXJuOyAvLyBUaW1lIGlzIGJlZm9yZSBmaXJzdCBmcmFtZS5cblxuICAgICAgICB2YXIgYm9uZSA9IHNrZWxldG9uLmJvbmVzW3RoaXMuYm9uZUluZGV4XTtcblxuICAgICAgICBpZiAodGltZSA+PSBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDNdKSB7IC8vIFRpbWUgaXMgYWZ0ZXIgbGFzdCBmcmFtZS5cbiAgICAgICAgICAgIGJvbmUuc2NhbGVYICs9IChib25lLmRhdGEuc2NhbGVYIC0gMSArIGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gMl0gLSBib25lLnNjYWxlWCkgKiBhbHBoYTtcbiAgICAgICAgICAgIGJvbmUuc2NhbGVZICs9IChib25lLmRhdGEuc2NhbGVZIC0gMSArIGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gMV0gLSBib25lLnNjYWxlWSkgKiBhbHBoYTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEludGVycG9sYXRlIGJldHdlZW4gdGhlIGxhc3QgZnJhbWUgYW5kIHRoZSBjdXJyZW50IGZyYW1lLlxuICAgICAgICB2YXIgZnJhbWVJbmRleCA9IHNwaW5lLmJpbmFyeVNlYXJjaChmcmFtZXMsIHRpbWUsIDMpO1xuICAgICAgICB2YXIgbGFzdEZyYW1lWCA9IGZyYW1lc1tmcmFtZUluZGV4IC0gMl07XG4gICAgICAgIHZhciBsYXN0RnJhbWVZID0gZnJhbWVzW2ZyYW1lSW5kZXggLSAxXTtcbiAgICAgICAgdmFyIGZyYW1lVGltZSA9IGZyYW1lc1tmcmFtZUluZGV4XTtcbiAgICAgICAgdmFyIHBlcmNlbnQgPSAxIC0gKHRpbWUgLSBmcmFtZVRpbWUpIC8gKGZyYW1lc1tmcmFtZUluZGV4ICsgLTMvKkxBU1RfRlJBTUVfVElNRSovXSAtIGZyYW1lVGltZSk7XG4gICAgICAgIHBlcmNlbnQgPSB0aGlzLmN1cnZlcy5nZXRDdXJ2ZVBlcmNlbnQoZnJhbWVJbmRleCAvIDMgLSAxLCBwZXJjZW50KTtcblxuICAgICAgICBib25lLnNjYWxlWCArPSAoYm9uZS5kYXRhLnNjYWxlWCAtIDEgKyBsYXN0RnJhbWVYICsgKGZyYW1lc1tmcmFtZUluZGV4ICsgMS8qRlJBTUVfWCovXSAtIGxhc3RGcmFtZVgpICogcGVyY2VudCAtIGJvbmUuc2NhbGVYKSAqIGFscGhhO1xuICAgICAgICBib25lLnNjYWxlWSArPSAoYm9uZS5kYXRhLnNjYWxlWSAtIDEgKyBsYXN0RnJhbWVZICsgKGZyYW1lc1tmcmFtZUluZGV4ICsgMi8qRlJBTUVfWSovXSAtIGxhc3RGcmFtZVkpICogcGVyY2VudCAtIGJvbmUuc2NhbGVZKSAqIGFscGhhO1xuICAgIH1cbn07XG5cbnNwaW5lLkNvbG9yVGltZWxpbmUgPSBmdW5jdGlvbiAoZnJhbWVDb3VudCkge1xuICAgIHRoaXMuY3VydmVzID0gbmV3IHNwaW5lLkN1cnZlcyhmcmFtZUNvdW50KTtcbiAgICB0aGlzLmZyYW1lcyA9IFtdOyAvLyB0aW1lLCByLCBnLCBiLCBhLCAuLi5cbiAgICB0aGlzLmZyYW1lcy5sZW5ndGggPSBmcmFtZUNvdW50ICogNTtcbn07XG5zcGluZS5Db2xvclRpbWVsaW5lLnByb3RvdHlwZSA9IHtcbiAgICBzbG90SW5kZXg6IDAsXG4gICAgZ2V0RnJhbWVDb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcmFtZXMubGVuZ3RoIC8gMjtcbiAgICB9LFxuICAgIHNldEZyYW1lOiBmdW5jdGlvbiAoZnJhbWVJbmRleCwgdGltZSwgciwgZywgYiwgYSkge1xuICAgICAgICBmcmFtZUluZGV4ICo9IDU7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXhdID0gdGltZTtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDFdID0gcjtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDJdID0gZztcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDNdID0gYjtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDRdID0gYTtcbiAgICB9LFxuICAgIGFwcGx5OiBmdW5jdGlvbiAoc2tlbGV0b24sIHRpbWUsIGFscGhhKSB7XG4gICAgICAgIHZhciBmcmFtZXMgPSB0aGlzLmZyYW1lcztcbiAgICAgICAgaWYgKHRpbWUgPCBmcmFtZXNbMF0pIHJldHVybjsgLy8gVGltZSBpcyBiZWZvcmUgZmlyc3QgZnJhbWUuXG5cbiAgICAgICAgdmFyIHNsb3QgPSBza2VsZXRvbi5zbG90c1t0aGlzLnNsb3RJbmRleF07XG5cbiAgICAgICAgaWYgKHRpbWUgPj0gZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSA1XSkgeyAvLyBUaW1lIGlzIGFmdGVyIGxhc3QgZnJhbWUuXG4gICAgICAgICAgICB2YXIgaSA9IGZyYW1lcy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgc2xvdC5yID0gZnJhbWVzW2kgLSAzXTtcbiAgICAgICAgICAgIHNsb3QuZyA9IGZyYW1lc1tpIC0gMl07XG4gICAgICAgICAgICBzbG90LmIgPSBmcmFtZXNbaSAtIDFdO1xuICAgICAgICAgICAgc2xvdC5hID0gZnJhbWVzW2ldO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW50ZXJwb2xhdGUgYmV0d2VlbiB0aGUgbGFzdCBmcmFtZSBhbmQgdGhlIGN1cnJlbnQgZnJhbWUuXG4gICAgICAgIHZhciBmcmFtZUluZGV4ID0gc3BpbmUuYmluYXJ5U2VhcmNoKGZyYW1lcywgdGltZSwgNSk7XG4gICAgICAgIHZhciBsYXN0RnJhbWVSID0gZnJhbWVzW2ZyYW1lSW5kZXggLSA0XTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZUcgPSBmcmFtZXNbZnJhbWVJbmRleCAtIDNdO1xuICAgICAgICB2YXIgbGFzdEZyYW1lQiA9IGZyYW1lc1tmcmFtZUluZGV4IC0gMl07XG4gICAgICAgIHZhciBsYXN0RnJhbWVBID0gZnJhbWVzW2ZyYW1lSW5kZXggLSAxXTtcbiAgICAgICAgdmFyIGZyYW1lVGltZSA9IGZyYW1lc1tmcmFtZUluZGV4XTtcbiAgICAgICAgdmFyIHBlcmNlbnQgPSAxIC0gKHRpbWUgLSBmcmFtZVRpbWUpIC8gKGZyYW1lc1tmcmFtZUluZGV4IC0gNS8qTEFTVF9GUkFNRV9USU1FKi9dIC0gZnJhbWVUaW1lKTtcbiAgICAgICAgcGVyY2VudCA9IHRoaXMuY3VydmVzLmdldEN1cnZlUGVyY2VudChmcmFtZUluZGV4IC8gNSAtIDEsIHBlcmNlbnQpO1xuXG4gICAgICAgIHZhciByID0gbGFzdEZyYW1lUiArIChmcmFtZXNbZnJhbWVJbmRleCArIDEvKkZSQU1FX1IqL10gLSBsYXN0RnJhbWVSKSAqIHBlcmNlbnQ7XG4gICAgICAgIHZhciBnID0gbGFzdEZyYW1lRyArIChmcmFtZXNbZnJhbWVJbmRleCArIDIvKkZSQU1FX0cqL10gLSBsYXN0RnJhbWVHKSAqIHBlcmNlbnQ7XG4gICAgICAgIHZhciBiID0gbGFzdEZyYW1lQiArIChmcmFtZXNbZnJhbWVJbmRleCArIDMvKkZSQU1FX0IqL10gLSBsYXN0RnJhbWVCKSAqIHBlcmNlbnQ7XG4gICAgICAgIHZhciBhID0gbGFzdEZyYW1lQSArIChmcmFtZXNbZnJhbWVJbmRleCArIDQvKkZSQU1FX0EqL10gLSBsYXN0RnJhbWVBKSAqIHBlcmNlbnQ7XG4gICAgICAgIGlmIChhbHBoYSA8IDEpIHtcbiAgICAgICAgICAgIHNsb3QuciArPSAociAtIHNsb3QucikgKiBhbHBoYTtcbiAgICAgICAgICAgIHNsb3QuZyArPSAoZyAtIHNsb3QuZykgKiBhbHBoYTtcbiAgICAgICAgICAgIHNsb3QuYiArPSAoYiAtIHNsb3QuYikgKiBhbHBoYTtcbiAgICAgICAgICAgIHNsb3QuYSArPSAoYSAtIHNsb3QuYSkgKiBhbHBoYTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNsb3QuciA9IHI7XG4gICAgICAgICAgICBzbG90LmcgPSBnO1xuICAgICAgICAgICAgc2xvdC5iID0gYjtcbiAgICAgICAgICAgIHNsb3QuYSA9IGE7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zcGluZS5BdHRhY2htZW50VGltZWxpbmUgPSBmdW5jdGlvbiAoZnJhbWVDb3VudCkge1xuICAgIHRoaXMuY3VydmVzID0gbmV3IHNwaW5lLkN1cnZlcyhmcmFtZUNvdW50KTtcbiAgICB0aGlzLmZyYW1lcyA9IFtdOyAvLyB0aW1lLCAuLi5cbiAgICB0aGlzLmZyYW1lcy5sZW5ndGggPSBmcmFtZUNvdW50O1xuICAgIHRoaXMuYXR0YWNobWVudE5hbWVzID0gW107IC8vIHRpbWUsIC4uLlxuICAgIHRoaXMuYXR0YWNobWVudE5hbWVzLmxlbmd0aCA9IGZyYW1lQ291bnQ7XG59O1xuc3BpbmUuQXR0YWNobWVudFRpbWVsaW5lLnByb3RvdHlwZSA9IHtcbiAgICBzbG90SW5kZXg6IDAsXG4gICAgZ2V0RnJhbWVDb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZnJhbWVzLmxlbmd0aDtcbiAgICB9LFxuICAgIHNldEZyYW1lOiBmdW5jdGlvbiAoZnJhbWVJbmRleCwgdGltZSwgYXR0YWNobWVudE5hbWUpIHtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleF0gPSB0aW1lO1xuICAgICAgICB0aGlzLmF0dGFjaG1lbnROYW1lc1tmcmFtZUluZGV4XSA9IGF0dGFjaG1lbnROYW1lO1xuICAgIH0sXG4gICAgYXBwbHk6IGZ1bmN0aW9uIChza2VsZXRvbiwgdGltZSwgYWxwaGEpIHtcbiAgICAgICAgdmFyIGZyYW1lcyA9IHRoaXMuZnJhbWVzO1xuICAgICAgICBpZiAodGltZSA8IGZyYW1lc1swXSkgcmV0dXJuOyAvLyBUaW1lIGlzIGJlZm9yZSBmaXJzdCBmcmFtZS5cblxuICAgICAgICB2YXIgZnJhbWVJbmRleDtcbiAgICAgICAgaWYgKHRpbWUgPj0gZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAxXSkgLy8gVGltZSBpcyBhZnRlciBsYXN0IGZyYW1lLlxuICAgICAgICAgICAgZnJhbWVJbmRleCA9IGZyYW1lcy5sZW5ndGggLSAxO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICBmcmFtZUluZGV4ID0gc3BpbmUuYmluYXJ5U2VhcmNoKGZyYW1lcywgdGltZSwgMSkgLSAxO1xuXG4gICAgICAgIHZhciBhdHRhY2htZW50TmFtZSA9IHRoaXMuYXR0YWNobWVudE5hbWVzW2ZyYW1lSW5kZXhdO1xuICAgICAgICBza2VsZXRvbi5zbG90c1t0aGlzLnNsb3RJbmRleF0uc2V0QXR0YWNobWVudCghYXR0YWNobWVudE5hbWUgPyBudWxsIDogc2tlbGV0b24uZ2V0QXR0YWNobWVudEJ5U2xvdEluZGV4KHRoaXMuc2xvdEluZGV4LCBhdHRhY2htZW50TmFtZSkpO1xuICAgIH1cbn07XG5cbnNwaW5lLlNrZWxldG9uRGF0YSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmJvbmVzID0gW107XG4gICAgdGhpcy5zbG90cyA9IFtdO1xuICAgIHRoaXMuc2tpbnMgPSBbXTtcbiAgICB0aGlzLmFuaW1hdGlvbnMgPSBbXTtcbn07XG5zcGluZS5Ta2VsZXRvbkRhdGEucHJvdG90eXBlID0ge1xuICAgIGRlZmF1bHRTa2luOiBudWxsLFxuICAgIC8qKiBAcmV0dXJuIE1heSBiZSBudWxsLiAqL1xuICAgIGZpbmRCb25lOiBmdW5jdGlvbiAoYm9uZU5hbWUpIHtcbiAgICAgICAgdmFyIGJvbmVzID0gdGhpcy5ib25lcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBib25lcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoYm9uZXNbaV0ubmFtZSA9PSBib25lTmFtZSkgcmV0dXJuIGJvbmVzW2ldO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIC0xIGlmIHRoZSBib25lIHdhcyBub3QgZm91bmQuICovXG4gICAgZmluZEJvbmVJbmRleDogZnVuY3Rpb24gKGJvbmVOYW1lKSB7XG4gICAgICAgIHZhciBib25lcyA9IHRoaXMuYm9uZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYm9uZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKGJvbmVzW2ldLm5hbWUgPT0gYm9uZU5hbWUpIHJldHVybiBpO1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiBNYXkgYmUgbnVsbC4gKi9cbiAgICBmaW5kU2xvdDogZnVuY3Rpb24gKHNsb3ROYW1lKSB7XG4gICAgICAgIHZhciBzbG90cyA9IHRoaXMuc2xvdHM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2xvdHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoc2xvdHNbaV0ubmFtZSA9PSBzbG90TmFtZSkgcmV0dXJuIHNsb3RzW2ldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gLTEgaWYgdGhlIGJvbmUgd2FzIG5vdCBmb3VuZC4gKi9cbiAgICBmaW5kU2xvdEluZGV4OiBmdW5jdGlvbiAoc2xvdE5hbWUpIHtcbiAgICAgICAgdmFyIHNsb3RzID0gdGhpcy5zbG90cztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBzbG90cy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoc2xvdHNbaV0ubmFtZSA9PSBzbG90TmFtZSkgcmV0dXJuIGk7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIE1heSBiZSBudWxsLiAqL1xuICAgIGZpbmRTa2luOiBmdW5jdGlvbiAoc2tpbk5hbWUpIHtcbiAgICAgICAgdmFyIHNraW5zID0gdGhpcy5za2lucztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBza2lucy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoc2tpbnNbaV0ubmFtZSA9PSBza2luTmFtZSkgcmV0dXJuIHNraW5zW2ldO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIE1heSBiZSBudWxsLiAqL1xuICAgIGZpbmRBbmltYXRpb246IGZ1bmN0aW9uIChhbmltYXRpb25OYW1lKSB7XG4gICAgICAgIHZhciBhbmltYXRpb25zID0gdGhpcy5hbmltYXRpb25zO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGFuaW1hdGlvbnMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKGFuaW1hdGlvbnNbaV0ubmFtZSA9PSBhbmltYXRpb25OYW1lKSByZXR1cm4gYW5pbWF0aW9uc1tpXTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuc3BpbmUuU2tlbGV0b24gPSBmdW5jdGlvbiAoc2tlbGV0b25EYXRhKSB7XG4gICAgdGhpcy5kYXRhID0gc2tlbGV0b25EYXRhO1xuXG4gICAgdGhpcy5ib25lcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2tlbGV0b25EYXRhLmJvbmVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICB2YXIgYm9uZURhdGEgPSBza2VsZXRvbkRhdGEuYm9uZXNbaV07XG4gICAgICAgIHZhciBwYXJlbnQgPSAhYm9uZURhdGEucGFyZW50ID8gbnVsbCA6IHRoaXMuYm9uZXNbc2tlbGV0b25EYXRhLmJvbmVzLmluZGV4T2YoYm9uZURhdGEucGFyZW50KV07XG4gICAgICAgIHRoaXMuYm9uZXMucHVzaChuZXcgc3BpbmUuQm9uZShib25lRGF0YSwgcGFyZW50KSk7XG4gICAgfVxuXG4gICAgdGhpcy5zbG90cyA9IFtdO1xuICAgIHRoaXMuZHJhd09yZGVyID0gW107XG4gICAgZm9yIChpID0gMCwgbiA9IHNrZWxldG9uRGF0YS5zbG90cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIHNsb3REYXRhID0gc2tlbGV0b25EYXRhLnNsb3RzW2ldO1xuICAgICAgICB2YXIgYm9uZSA9IHRoaXMuYm9uZXNbc2tlbGV0b25EYXRhLmJvbmVzLmluZGV4T2Yoc2xvdERhdGEuYm9uZURhdGEpXTtcbiAgICAgICAgdmFyIHNsb3QgPSBuZXcgc3BpbmUuU2xvdChzbG90RGF0YSwgdGhpcywgYm9uZSk7XG4gICAgICAgIHRoaXMuc2xvdHMucHVzaChzbG90KTtcbiAgICAgICAgdGhpcy5kcmF3T3JkZXIucHVzaChzbG90KTtcbiAgICB9XG59O1xuc3BpbmUuU2tlbGV0b24ucHJvdG90eXBlID0ge1xuICAgIHg6IDAsIHk6IDAsXG4gICAgc2tpbjogbnVsbCxcbiAgICByOiAxLCBnOiAxLCBiOiAxLCBhOiAxLFxuICAgIHRpbWU6IDAsXG4gICAgZmxpcFg6IGZhbHNlLCBmbGlwWTogZmFsc2UsXG4gICAgLyoqIFVwZGF0ZXMgdGhlIHdvcmxkIHRyYW5zZm9ybSBmb3IgZWFjaCBib25lLiAqL1xuICAgIHVwZGF0ZVdvcmxkVHJhbnNmb3JtOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbGlwWCA9IHRoaXMuZmxpcFg7XG4gICAgICAgIHZhciBmbGlwWSA9IHRoaXMuZmxpcFk7XG4gICAgICAgIHZhciBib25lcyA9IHRoaXMuYm9uZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYm9uZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgYm9uZXNbaV0udXBkYXRlV29ybGRUcmFuc2Zvcm0oZmxpcFgsIGZsaXBZKTtcbiAgICB9LFxuICAgIC8qKiBTZXRzIHRoZSBib25lcyBhbmQgc2xvdHMgdG8gdGhlaXIgc2V0dXAgcG9zZSB2YWx1ZXMuICovXG4gICAgc2V0VG9TZXR1cFBvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXRCb25lc1RvU2V0dXBQb3NlKCk7XG4gICAgICAgIHRoaXMuc2V0U2xvdHNUb1NldHVwUG9zZSgpO1xuICAgIH0sXG4gICAgc2V0Qm9uZXNUb1NldHVwUG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYm9uZXMgPSB0aGlzLmJvbmVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGJvbmVzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGJvbmVzW2ldLnNldFRvU2V0dXBQb3NlKCk7XG4gICAgfSxcbiAgICBzZXRTbG90c1RvU2V0dXBQb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzbG90cyA9IHRoaXMuc2xvdHM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2xvdHMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgc2xvdHNbaV0uc2V0VG9TZXR1cFBvc2UoaSk7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiBNYXkgcmV0dXJuIG51bGwuICovXG4gICAgZ2V0Um9vdEJvbmU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYm9uZXMubGVuZ3RoID8gdGhpcy5ib25lc1swXSA6IG51bGw7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiBNYXkgYmUgbnVsbC4gKi9cbiAgICBmaW5kQm9uZTogZnVuY3Rpb24gKGJvbmVOYW1lKSB7XG4gICAgICAgIHZhciBib25lcyA9IHRoaXMuYm9uZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYm9uZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKGJvbmVzW2ldLmRhdGEubmFtZSA9PSBib25lTmFtZSkgcmV0dXJuIGJvbmVzW2ldO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIC0xIGlmIHRoZSBib25lIHdhcyBub3QgZm91bmQuICovXG4gICAgZmluZEJvbmVJbmRleDogZnVuY3Rpb24gKGJvbmVOYW1lKSB7XG4gICAgICAgIHZhciBib25lcyA9IHRoaXMuYm9uZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYm9uZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKGJvbmVzW2ldLmRhdGEubmFtZSA9PSBib25lTmFtZSkgcmV0dXJuIGk7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIE1heSBiZSBudWxsLiAqL1xuICAgIGZpbmRTbG90OiBmdW5jdGlvbiAoc2xvdE5hbWUpIHtcbiAgICAgICAgdmFyIHNsb3RzID0gdGhpcy5zbG90cztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBzbG90cy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoc2xvdHNbaV0uZGF0YS5uYW1lID09IHNsb3ROYW1lKSByZXR1cm4gc2xvdHNbaV07XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gLTEgaWYgdGhlIGJvbmUgd2FzIG5vdCBmb3VuZC4gKi9cbiAgICBmaW5kU2xvdEluZGV4OiBmdW5jdGlvbiAoc2xvdE5hbWUpIHtcbiAgICAgICAgdmFyIHNsb3RzID0gdGhpcy5zbG90cztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBzbG90cy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoc2xvdHNbaV0uZGF0YS5uYW1lID09IHNsb3ROYW1lKSByZXR1cm4gaTtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH0sXG4gICAgc2V0U2tpbkJ5TmFtZTogZnVuY3Rpb24gKHNraW5OYW1lKSB7XG4gICAgICAgIHZhciBza2luID0gdGhpcy5kYXRhLmZpbmRTa2luKHNraW5OYW1lKTtcbiAgICAgICAgaWYgKCFza2luKSB0aHJvdyBcIlNraW4gbm90IGZvdW5kOiBcIiArIHNraW5OYW1lO1xuICAgICAgICB0aGlzLnNldFNraW4oc2tpbik7XG4gICAgfSxcbiAgICAvKiogU2V0cyB0aGUgc2tpbiB1c2VkIHRvIGxvb2sgdXAgYXR0YWNobWVudHMgbm90IGZvdW5kIGluIHRoZSB7QGxpbmsgU2tlbGV0b25EYXRhI2dldERlZmF1bHRTa2luKCkgZGVmYXVsdCBza2lufS4gQXR0YWNobWVudHNcbiAgICAgKiBmcm9tIHRoZSBuZXcgc2tpbiBhcmUgYXR0YWNoZWQgaWYgdGhlIGNvcnJlc3BvbmRpbmcgYXR0YWNobWVudCBmcm9tIHRoZSBvbGQgc2tpbiB3YXMgYXR0YWNoZWQuXG4gICAgICogQHBhcmFtIG5ld1NraW4gTWF5IGJlIG51bGwuICovXG4gICAgc2V0U2tpbjogZnVuY3Rpb24gKG5ld1NraW4pIHtcbiAgICAgICAgaWYgKHRoaXMuc2tpbiAmJiBuZXdTa2luKSBuZXdTa2luLl9hdHRhY2hBbGwodGhpcywgdGhpcy5za2luKTtcbiAgICAgICAgdGhpcy5za2luID0gbmV3U2tpbjtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIE1heSBiZSBudWxsLiAqL1xuICAgIGdldEF0dGFjaG1lbnRCeVNsb3ROYW1lOiBmdW5jdGlvbiAoc2xvdE5hbWUsIGF0dGFjaG1lbnROYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldEF0dGFjaG1lbnRCeVNsb3RJbmRleCh0aGlzLmRhdGEuZmluZFNsb3RJbmRleChzbG90TmFtZSksIGF0dGFjaG1lbnROYW1lKTtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIE1heSBiZSBudWxsLiAqL1xuICAgIGdldEF0dGFjaG1lbnRCeVNsb3RJbmRleDogZnVuY3Rpb24gKHNsb3RJbmRleCwgYXR0YWNobWVudE5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuc2tpbikge1xuICAgICAgICAgICAgdmFyIGF0dGFjaG1lbnQgPSB0aGlzLnNraW4uZ2V0QXR0YWNobWVudChzbG90SW5kZXgsIGF0dGFjaG1lbnROYW1lKTtcbiAgICAgICAgICAgIGlmIChhdHRhY2htZW50KSByZXR1cm4gYXR0YWNobWVudDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5kYXRhLmRlZmF1bHRTa2luKSByZXR1cm4gdGhpcy5kYXRhLmRlZmF1bHRTa2luLmdldEF0dGFjaG1lbnQoc2xvdEluZGV4LCBhdHRhY2htZW50TmFtZSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLyoqIEBwYXJhbSBhdHRhY2htZW50TmFtZSBNYXkgYmUgbnVsbC4gKi9cbiAgICBzZXRBdHRhY2htZW50OiBmdW5jdGlvbiAoc2xvdE5hbWUsIGF0dGFjaG1lbnROYW1lKSB7XG4gICAgICAgIHZhciBzbG90cyA9IHRoaXMuc2xvdHM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2xvdHMuc2l6ZTsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgdmFyIHNsb3QgPSBzbG90c1tpXTtcbiAgICAgICAgICAgIGlmIChzbG90LmRhdGEubmFtZSA9PSBzbG90TmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBhdHRhY2htZW50ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBpZiAoYXR0YWNobWVudE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudCA9IHRoaXMuZ2V0QXR0YWNobWVudChpLCBhdHRhY2htZW50TmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRhY2htZW50ID09IG51bGwpIHRocm93IFwiQXR0YWNobWVudCBub3QgZm91bmQ6IFwiICsgYXR0YWNobWVudE5hbWUgKyBcIiwgZm9yIHNsb3Q6IFwiICsgc2xvdE5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNsb3Quc2V0QXR0YWNobWVudChhdHRhY2htZW50KTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgXCJTbG90IG5vdCBmb3VuZDogXCIgKyBzbG90TmFtZTtcbiAgICB9LFxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKGRlbHRhKSB7XG4gICAgICAgIHRoaXMudGltZSArPSBkZWx0YTtcbiAgICB9XG59O1xuXG5zcGluZS5BdHRhY2htZW50VHlwZSA9IHtcbiAgICByZWdpb246IDBcbn07XG5cbnNwaW5lLlJlZ2lvbkF0dGFjaG1lbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5vZmZzZXQgPSBbXTtcbiAgICB0aGlzLm9mZnNldC5sZW5ndGggPSA4O1xuICAgIHRoaXMudXZzID0gW107XG4gICAgdGhpcy51dnMubGVuZ3RoID0gODtcbn07XG5zcGluZS5SZWdpb25BdHRhY2htZW50LnByb3RvdHlwZSA9IHtcbiAgICB4OiAwLCB5OiAwLFxuICAgIHJvdGF0aW9uOiAwLFxuICAgIHNjYWxlWDogMSwgc2NhbGVZOiAxLFxuICAgIHdpZHRoOiAwLCBoZWlnaHQ6IDAsXG4gICAgcmVuZGVyZXJPYmplY3Q6IG51bGwsXG4gICAgcmVnaW9uT2Zmc2V0WDogMCwgcmVnaW9uT2Zmc2V0WTogMCxcbiAgICByZWdpb25XaWR0aDogMCwgcmVnaW9uSGVpZ2h0OiAwLFxuICAgIHJlZ2lvbk9yaWdpbmFsV2lkdGg6IDAsIHJlZ2lvbk9yaWdpbmFsSGVpZ2h0OiAwLFxuICAgIHNldFVWczogZnVuY3Rpb24gKHUsIHYsIHUyLCB2Miwgcm90YXRlKSB7XG4gICAgICAgIHZhciB1dnMgPSB0aGlzLnV2cztcbiAgICAgICAgaWYgKHJvdGF0ZSkge1xuICAgICAgICAgICAgdXZzWzIvKlgyKi9dID0gdTtcbiAgICAgICAgICAgIHV2c1szLypZMiovXSA9IHYyO1xuICAgICAgICAgICAgdXZzWzQvKlgzKi9dID0gdTtcbiAgICAgICAgICAgIHV2c1s1LypZMyovXSA9IHY7XG4gICAgICAgICAgICB1dnNbNi8qWDQqL10gPSB1MjtcbiAgICAgICAgICAgIHV2c1s3LypZNCovXSA9IHY7XG4gICAgICAgICAgICB1dnNbMC8qWDEqL10gPSB1MjtcbiAgICAgICAgICAgIHV2c1sxLypZMSovXSA9IHYyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdXZzWzAvKlgxKi9dID0gdTtcbiAgICAgICAgICAgIHV2c1sxLypZMSovXSA9IHYyO1xuICAgICAgICAgICAgdXZzWzIvKlgyKi9dID0gdTtcbiAgICAgICAgICAgIHV2c1szLypZMiovXSA9IHY7XG4gICAgICAgICAgICB1dnNbNC8qWDMqL10gPSB1MjtcbiAgICAgICAgICAgIHV2c1s1LypZMyovXSA9IHY7XG4gICAgICAgICAgICB1dnNbNi8qWDQqL10gPSB1MjtcbiAgICAgICAgICAgIHV2c1s3LypZNCovXSA9IHYyO1xuICAgICAgICB9XG4gICAgfSxcbiAgICB1cGRhdGVPZmZzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHJlZ2lvblNjYWxlWCA9IHRoaXMud2lkdGggLyB0aGlzLnJlZ2lvbk9yaWdpbmFsV2lkdGggKiB0aGlzLnNjYWxlWDtcbiAgICAgICAgdmFyIHJlZ2lvblNjYWxlWSA9IHRoaXMuaGVpZ2h0IC8gdGhpcy5yZWdpb25PcmlnaW5hbEhlaWdodCAqIHRoaXMuc2NhbGVZO1xuICAgICAgICB2YXIgbG9jYWxYID0gLXRoaXMud2lkdGggLyAyICogdGhpcy5zY2FsZVggKyB0aGlzLnJlZ2lvbk9mZnNldFggKiByZWdpb25TY2FsZVg7XG4gICAgICAgIHZhciBsb2NhbFkgPSAtdGhpcy5oZWlnaHQgLyAyICogdGhpcy5zY2FsZVkgKyB0aGlzLnJlZ2lvbk9mZnNldFkgKiByZWdpb25TY2FsZVk7XG4gICAgICAgIHZhciBsb2NhbFgyID0gbG9jYWxYICsgdGhpcy5yZWdpb25XaWR0aCAqIHJlZ2lvblNjYWxlWDtcbiAgICAgICAgdmFyIGxvY2FsWTIgPSBsb2NhbFkgKyB0aGlzLnJlZ2lvbkhlaWdodCAqIHJlZ2lvblNjYWxlWTtcbiAgICAgICAgdmFyIHJhZGlhbnMgPSB0aGlzLnJvdGF0aW9uICogTWF0aC5QSSAvIDE4MDtcbiAgICAgICAgdmFyIGNvcyA9IE1hdGguY29zKHJhZGlhbnMpO1xuICAgICAgICB2YXIgc2luID0gTWF0aC5zaW4ocmFkaWFucyk7XG4gICAgICAgIHZhciBsb2NhbFhDb3MgPSBsb2NhbFggKiBjb3MgKyB0aGlzLng7XG4gICAgICAgIHZhciBsb2NhbFhTaW4gPSBsb2NhbFggKiBzaW47XG4gICAgICAgIHZhciBsb2NhbFlDb3MgPSBsb2NhbFkgKiBjb3MgKyB0aGlzLnk7XG4gICAgICAgIHZhciBsb2NhbFlTaW4gPSBsb2NhbFkgKiBzaW47XG4gICAgICAgIHZhciBsb2NhbFgyQ29zID0gbG9jYWxYMiAqIGNvcyArIHRoaXMueDtcbiAgICAgICAgdmFyIGxvY2FsWDJTaW4gPSBsb2NhbFgyICogc2luO1xuICAgICAgICB2YXIgbG9jYWxZMkNvcyA9IGxvY2FsWTIgKiBjb3MgKyB0aGlzLnk7XG4gICAgICAgIHZhciBsb2NhbFkyU2luID0gbG9jYWxZMiAqIHNpbjtcbiAgICAgICAgdmFyIG9mZnNldCA9IHRoaXMub2Zmc2V0O1xuICAgICAgICBvZmZzZXRbMC8qWDEqL10gPSBsb2NhbFhDb3MgLSBsb2NhbFlTaW47XG4gICAgICAgIG9mZnNldFsxLypZMSovXSA9IGxvY2FsWUNvcyArIGxvY2FsWFNpbjtcbiAgICAgICAgb2Zmc2V0WzIvKlgyKi9dID0gbG9jYWxYQ29zIC0gbG9jYWxZMlNpbjtcbiAgICAgICAgb2Zmc2V0WzMvKlkyKi9dID0gbG9jYWxZMkNvcyArIGxvY2FsWFNpbjtcbiAgICAgICAgb2Zmc2V0WzQvKlgzKi9dID0gbG9jYWxYMkNvcyAtIGxvY2FsWTJTaW47XG4gICAgICAgIG9mZnNldFs1LypZMyovXSA9IGxvY2FsWTJDb3MgKyBsb2NhbFgyU2luO1xuICAgICAgICBvZmZzZXRbNi8qWDQqL10gPSBsb2NhbFgyQ29zIC0gbG9jYWxZU2luO1xuICAgICAgICBvZmZzZXRbNy8qWTQqL10gPSBsb2NhbFlDb3MgKyBsb2NhbFgyU2luO1xuICAgIH0sXG4gICAgY29tcHV0ZVZlcnRpY2VzOiBmdW5jdGlvbiAoeCwgeSwgYm9uZSwgdmVydGljZXMpIHtcbiAgICAgICAgeCArPSBib25lLndvcmxkWDtcbiAgICAgICAgeSArPSBib25lLndvcmxkWTtcbiAgICAgICAgdmFyIG0wMCA9IGJvbmUubTAwO1xuICAgICAgICB2YXIgbTAxID0gYm9uZS5tMDE7XG4gICAgICAgIHZhciBtMTAgPSBib25lLm0xMDtcbiAgICAgICAgdmFyIG0xMSA9IGJvbmUubTExO1xuICAgICAgICB2YXIgb2Zmc2V0ID0gdGhpcy5vZmZzZXQ7XG4gICAgICAgIHZlcnRpY2VzWzAvKlgxKi9dID0gb2Zmc2V0WzAvKlgxKi9dICogbTAwICsgb2Zmc2V0WzEvKlkxKi9dICogbTAxICsgeDtcbiAgICAgICAgdmVydGljZXNbMS8qWTEqL10gPSBvZmZzZXRbMC8qWDEqL10gKiBtMTAgKyBvZmZzZXRbMS8qWTEqL10gKiBtMTEgKyB5O1xuICAgICAgICB2ZXJ0aWNlc1syLypYMiovXSA9IG9mZnNldFsyLypYMiovXSAqIG0wMCArIG9mZnNldFszLypZMiovXSAqIG0wMSArIHg7XG4gICAgICAgIHZlcnRpY2VzWzMvKlkyKi9dID0gb2Zmc2V0WzIvKlgyKi9dICogbTEwICsgb2Zmc2V0WzMvKlkyKi9dICogbTExICsgeTtcbiAgICAgICAgdmVydGljZXNbNC8qWDMqL10gPSBvZmZzZXRbNC8qWDMqL10gKiBtMDAgKyBvZmZzZXRbNS8qWDMqL10gKiBtMDEgKyB4O1xuICAgICAgICB2ZXJ0aWNlc1s1LypYMyovXSA9IG9mZnNldFs0LypYMyovXSAqIG0xMCArIG9mZnNldFs1LypYMyovXSAqIG0xMSArIHk7XG4gICAgICAgIHZlcnRpY2VzWzYvKlg0Ki9dID0gb2Zmc2V0WzYvKlg0Ki9dICogbTAwICsgb2Zmc2V0WzcvKlk0Ki9dICogbTAxICsgeDtcbiAgICAgICAgdmVydGljZXNbNy8qWTQqL10gPSBvZmZzZXRbNi8qWDQqL10gKiBtMTAgKyBvZmZzZXRbNy8qWTQqL10gKiBtMTEgKyB5O1xuICAgIH1cbn1cblxuc3BpbmUuQW5pbWF0aW9uU3RhdGVEYXRhID0gZnVuY3Rpb24gKHNrZWxldG9uRGF0YSkge1xuICAgIHRoaXMuc2tlbGV0b25EYXRhID0gc2tlbGV0b25EYXRhO1xuICAgIHRoaXMuYW5pbWF0aW9uVG9NaXhUaW1lID0ge307XG59O1xuc3BpbmUuQW5pbWF0aW9uU3RhdGVEYXRhLnByb3RvdHlwZSA9IHtcbiAgICAgICAgZGVmYXVsdE1peDogMCxcbiAgICBzZXRNaXhCeU5hbWU6IGZ1bmN0aW9uIChmcm9tTmFtZSwgdG9OYW1lLCBkdXJhdGlvbikge1xuICAgICAgICB2YXIgZnJvbSA9IHRoaXMuc2tlbGV0b25EYXRhLmZpbmRBbmltYXRpb24oZnJvbU5hbWUpO1xuICAgICAgICBpZiAoIWZyb20pIHRocm93IFwiQW5pbWF0aW9uIG5vdCBmb3VuZDogXCIgKyBmcm9tTmFtZTtcbiAgICAgICAgdmFyIHRvID0gdGhpcy5za2VsZXRvbkRhdGEuZmluZEFuaW1hdGlvbih0b05hbWUpO1xuICAgICAgICBpZiAoIXRvKSB0aHJvdyBcIkFuaW1hdGlvbiBub3QgZm91bmQ6IFwiICsgdG9OYW1lO1xuICAgICAgICB0aGlzLnNldE1peChmcm9tLCB0bywgZHVyYXRpb24pO1xuICAgIH0sXG4gICAgc2V0TWl4OiBmdW5jdGlvbiAoZnJvbSwgdG8sIGR1cmF0aW9uKSB7XG4gICAgICAgIHRoaXMuYW5pbWF0aW9uVG9NaXhUaW1lW2Zyb20ubmFtZSArIFwiOlwiICsgdG8ubmFtZV0gPSBkdXJhdGlvbjtcbiAgICB9LFxuICAgIGdldE1peDogZnVuY3Rpb24gKGZyb20sIHRvKSB7XG4gICAgICAgIHZhciB0aW1lID0gdGhpcy5hbmltYXRpb25Ub01peFRpbWVbZnJvbS5uYW1lICsgXCI6XCIgKyB0by5uYW1lXTtcbiAgICAgICAgICAgIHJldHVybiB0aW1lID8gdGltZSA6IHRoaXMuZGVmYXVsdE1peDtcbiAgICB9XG59O1xuXG5zcGluZS5BbmltYXRpb25TdGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZURhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBzdGF0ZURhdGE7XG4gICAgdGhpcy5xdWV1ZSA9IFtdO1xufTtcbnNwaW5lLkFuaW1hdGlvblN0YXRlLnByb3RvdHlwZSA9IHtcbiAgICBjdXJyZW50OiBudWxsLFxuICAgIHByZXZpb3VzOiBudWxsLFxuICAgIGN1cnJlbnRUaW1lOiAwLFxuICAgIHByZXZpb3VzVGltZTogMCxcbiAgICBjdXJyZW50TG9vcDogZmFsc2UsXG4gICAgcHJldmlvdXNMb29wOiBmYWxzZSxcbiAgICBtaXhUaW1lOiAwLFxuICAgIG1peER1cmF0aW9uOiAwLFxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKGRlbHRhKSB7XG4gICAgICAgIHRoaXMuY3VycmVudFRpbWUgKz0gZGVsdGE7XG4gICAgICAgIHRoaXMucHJldmlvdXNUaW1lICs9IGRlbHRhO1xuICAgICAgICB0aGlzLm1peFRpbWUgKz0gZGVsdGE7XG5cbiAgICAgICAgaWYgKHRoaXMucXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy5xdWV1ZVswXTtcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRUaW1lID49IGVudHJ5LmRlbGF5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0QW5pbWF0aW9uKGVudHJ5LmFuaW1hdGlvbiwgZW50cnkubG9vcCk7XG4gICAgICAgICAgICAgICAgdGhpcy5xdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBhcHBseTogZnVuY3Rpb24gKHNrZWxldG9uKSB7XG4gICAgICAgIGlmICghdGhpcy5jdXJyZW50KSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLnByZXZpb3VzKSB7XG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzLmFwcGx5KHNrZWxldG9uLCB0aGlzLnByZXZpb3VzVGltZSwgdGhpcy5wcmV2aW91c0xvb3ApO1xuICAgICAgICAgICAgdmFyIGFscGhhID0gdGhpcy5taXhUaW1lIC8gdGhpcy5taXhEdXJhdGlvbjtcbiAgICAgICAgICAgIGlmIChhbHBoYSA+PSAxKSB7XG4gICAgICAgICAgICAgICAgYWxwaGEgPSAxO1xuICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXMgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Lm1peChza2VsZXRvbiwgdGhpcy5jdXJyZW50VGltZSwgdGhpcy5jdXJyZW50TG9vcCwgYWxwaGEpO1xuICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgIHRoaXMuY3VycmVudC5hcHBseShza2VsZXRvbiwgdGhpcy5jdXJyZW50VGltZSwgdGhpcy5jdXJyZW50TG9vcCk7XG4gICAgfSxcbiAgICBjbGVhckFuaW1hdGlvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgdGhpcy5jdXJyZW50ID0gbnVsbDtcbiAgICAgICAgdGhpcy5xdWV1ZS5sZW5ndGggPSAwO1xuICAgIH0sXG4gICAgX3NldEFuaW1hdGlvbjogZnVuY3Rpb24gKGFuaW1hdGlvbiwgbG9vcCkge1xuICAgICAgICB0aGlzLnByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgaWYgKGFuaW1hdGlvbiAmJiB0aGlzLmN1cnJlbnQpIHtcbiAgICAgICAgICAgIHRoaXMubWl4RHVyYXRpb24gPSB0aGlzLmRhdGEuZ2V0TWl4KHRoaXMuY3VycmVudCwgYW5pbWF0aW9uKTtcbiAgICAgICAgICAgIGlmICh0aGlzLm1peER1cmF0aW9uID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWl4VGltZSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91cyA9IHRoaXMuY3VycmVudDtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXZpb3VzVGltZSA9IHRoaXMuY3VycmVudFRpbWU7XG4gICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c0xvb3AgPSB0aGlzLmN1cnJlbnRMb29wO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3VycmVudCA9IGFuaW1hdGlvbjtcbiAgICAgICAgdGhpcy5jdXJyZW50TG9vcCA9IGxvb3A7XG4gICAgICAgIHRoaXMuY3VycmVudFRpbWUgPSAwO1xuICAgIH0sXG4gICAgLyoqIEBzZWUgI3NldEFuaW1hdGlvbihBbmltYXRpb24sIEJvb2xlYW4pICovXG4gICAgc2V0QW5pbWF0aW9uQnlOYW1lOiBmdW5jdGlvbiAoYW5pbWF0aW9uTmFtZSwgbG9vcCkge1xuICAgICAgICB2YXIgYW5pbWF0aW9uID0gdGhpcy5kYXRhLnNrZWxldG9uRGF0YS5maW5kQW5pbWF0aW9uKGFuaW1hdGlvbk5hbWUpO1xuICAgICAgICBpZiAoIWFuaW1hdGlvbikgdGhyb3cgXCJBbmltYXRpb24gbm90IGZvdW5kOiBcIiArIGFuaW1hdGlvbk5hbWU7XG4gICAgICAgIHRoaXMuc2V0QW5pbWF0aW9uKGFuaW1hdGlvbiwgbG9vcCk7XG4gICAgfSxcbiAgICAvKiogU2V0IHRoZSBjdXJyZW50IGFuaW1hdGlvbi4gQW55IHF1ZXVlZCBhbmltYXRpb25zIGFyZSBjbGVhcmVkIGFuZCB0aGUgY3VycmVudCBhbmltYXRpb24gdGltZSBpcyBzZXQgdG8gMC5cbiAgICAgKiBAcGFyYW0gYW5pbWF0aW9uIE1heSBiZSBudWxsLiAqL1xuICAgIHNldEFuaW1hdGlvbjogZnVuY3Rpb24gKGFuaW1hdGlvbiwgbG9vcCkge1xuICAgICAgICB0aGlzLnF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuX3NldEFuaW1hdGlvbihhbmltYXRpb24sIGxvb3ApO1xuICAgIH0sXG4gICAgLyoqIEBzZWUgI2FkZEFuaW1hdGlvbihBbmltYXRpb24sIEJvb2xlYW4sIE51bWJlcikgKi9cbiAgICBhZGRBbmltYXRpb25CeU5hbWU6IGZ1bmN0aW9uIChhbmltYXRpb25OYW1lLCBsb29wLCBkZWxheSkge1xuICAgICAgICB2YXIgYW5pbWF0aW9uID0gdGhpcy5kYXRhLnNrZWxldG9uRGF0YS5maW5kQW5pbWF0aW9uKGFuaW1hdGlvbk5hbWUpO1xuICAgICAgICBpZiAoIWFuaW1hdGlvbikgdGhyb3cgXCJBbmltYXRpb24gbm90IGZvdW5kOiBcIiArIGFuaW1hdGlvbk5hbWU7XG4gICAgICAgIHRoaXMuYWRkQW5pbWF0aW9uKGFuaW1hdGlvbiwgbG9vcCwgZGVsYXkpO1xuICAgIH0sXG4gICAgLyoqIEFkZHMgYW4gYW5pbWF0aW9uIHRvIGJlIHBsYXllZCBkZWxheSBzZWNvbmRzIGFmdGVyIHRoZSBjdXJyZW50IG9yIGxhc3QgcXVldWVkIGFuaW1hdGlvbi5cbiAgICAgKiBAcGFyYW0gZGVsYXkgTWF5IGJlIDw9IDAgdG8gdXNlIGR1cmF0aW9uIG9mIHByZXZpb3VzIGFuaW1hdGlvbiBtaW51cyBhbnkgbWl4IGR1cmF0aW9uIHBsdXMgdGhlIG5lZ2F0aXZlIGRlbGF5LiAqL1xuICAgIGFkZEFuaW1hdGlvbjogZnVuY3Rpb24gKGFuaW1hdGlvbiwgbG9vcCwgZGVsYXkpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0ge307XG4gICAgICAgIGVudHJ5LmFuaW1hdGlvbiA9IGFuaW1hdGlvbjtcbiAgICAgICAgZW50cnkubG9vcCA9IGxvb3A7XG5cbiAgICAgICAgaWYgKCFkZWxheSB8fCBkZWxheSA8PSAwKSB7XG4gICAgICAgICAgICB2YXIgcHJldmlvdXNBbmltYXRpb24gPSB0aGlzLnF1ZXVlLmxlbmd0aCA/IHRoaXMucXVldWVbdGhpcy5xdWV1ZS5sZW5ndGggLSAxXS5hbmltYXRpb24gOiB0aGlzLmN1cnJlbnQ7XG4gICAgICAgICAgICBpZiAocHJldmlvdXNBbmltYXRpb24gIT0gbnVsbClcbiAgICAgICAgICAgICAgICBkZWxheSA9IHByZXZpb3VzQW5pbWF0aW9uLmR1cmF0aW9uIC0gdGhpcy5kYXRhLmdldE1peChwcmV2aW91c0FuaW1hdGlvbiwgYW5pbWF0aW9uKSArIChkZWxheSB8fCAwKTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBkZWxheSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZW50cnkuZGVsYXkgPSBkZWxheTtcblxuICAgICAgICB0aGlzLnF1ZXVlLnB1c2goZW50cnkpO1xuICAgIH0sXG4gICAgLyoqIFJldHVybnMgdHJ1ZSBpZiBubyBhbmltYXRpb24gaXMgc2V0IG9yIGlmIHRoZSBjdXJyZW50IHRpbWUgaXMgZ3JlYXRlciB0aGFuIHRoZSBhbmltYXRpb24gZHVyYXRpb24sIHJlZ2FyZGxlc3Mgb2YgbG9vcGluZy4gKi9cbiAgICBpc0NvbXBsZXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAhdGhpcy5jdXJyZW50IHx8IHRoaXMuY3VycmVudFRpbWUgPj0gdGhpcy5jdXJyZW50LmR1cmF0aW9uO1xuICAgIH1cbn07XG5cbnNwaW5lLlNrZWxldG9uSnNvbiA9IGZ1bmN0aW9uIChhdHRhY2htZW50TG9hZGVyKSB7XG4gICAgdGhpcy5hdHRhY2htZW50TG9hZGVyID0gYXR0YWNobWVudExvYWRlcjtcbn07XG5zcGluZS5Ta2VsZXRvbkpzb24ucHJvdG90eXBlID0ge1xuICAgIHNjYWxlOiAxLFxuICAgIHJlYWRTa2VsZXRvbkRhdGE6IGZ1bmN0aW9uIChyb290KSB7XG4gICAgICAgIC8qanNoaW50IC1XMDY5Ki9cbiAgICAgICAgdmFyIHNrZWxldG9uRGF0YSA9IG5ldyBzcGluZS5Ta2VsZXRvbkRhdGEoKSxcbiAgICAgICAgICAgIGJvbmVEYXRhO1xuXG4gICAgICAgIC8vIEJvbmVzLlxuICAgICAgICB2YXIgYm9uZXMgPSByb290W1wiYm9uZXNcIl07XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYm9uZXMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgYm9uZU1hcCA9IGJvbmVzW2ldO1xuICAgICAgICAgICAgdmFyIHBhcmVudCA9IG51bGw7XG4gICAgICAgICAgICBpZiAoYm9uZU1hcFtcInBhcmVudFwiXSkge1xuICAgICAgICAgICAgICAgIHBhcmVudCA9IHNrZWxldG9uRGF0YS5maW5kQm9uZShib25lTWFwW1wicGFyZW50XCJdKTtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcmVudCkgdGhyb3cgXCJQYXJlbnQgYm9uZSBub3QgZm91bmQ6IFwiICsgYm9uZU1hcFtcInBhcmVudFwiXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJvbmVEYXRhID0gbmV3IHNwaW5lLkJvbmVEYXRhKGJvbmVNYXBbXCJuYW1lXCJdLCBwYXJlbnQpO1xuICAgICAgICAgICAgYm9uZURhdGEubGVuZ3RoID0gKGJvbmVNYXBbXCJsZW5ndGhcIl0gfHwgMCkgKiB0aGlzLnNjYWxlO1xuICAgICAgICAgICAgYm9uZURhdGEueCA9IChib25lTWFwW1wieFwiXSB8fCAwKSAqIHRoaXMuc2NhbGU7XG4gICAgICAgICAgICBib25lRGF0YS55ID0gKGJvbmVNYXBbXCJ5XCJdIHx8IDApICogdGhpcy5zY2FsZTtcbiAgICAgICAgICAgIGJvbmVEYXRhLnJvdGF0aW9uID0gKGJvbmVNYXBbXCJyb3RhdGlvblwiXSB8fCAwKTtcbiAgICAgICAgICAgIGJvbmVEYXRhLnNjYWxlWCA9IGJvbmVNYXBbXCJzY2FsZVhcIl0gfHwgMTtcbiAgICAgICAgICAgIGJvbmVEYXRhLnNjYWxlWSA9IGJvbmVNYXBbXCJzY2FsZVlcIl0gfHwgMTtcbiAgICAgICAgICAgIHNrZWxldG9uRGF0YS5ib25lcy5wdXNoKGJvbmVEYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNsb3RzLlxuICAgICAgICB2YXIgc2xvdHMgPSByb290W1wic2xvdHNcIl07XG4gICAgICAgIGZvciAoaSA9IDAsIG4gPSBzbG90cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBzbG90TWFwID0gc2xvdHNbaV07XG4gICAgICAgICAgICBib25lRGF0YSA9IHNrZWxldG9uRGF0YS5maW5kQm9uZShzbG90TWFwW1wiYm9uZVwiXSk7XG4gICAgICAgICAgICBpZiAoIWJvbmVEYXRhKSB0aHJvdyBcIlNsb3QgYm9uZSBub3QgZm91bmQ6IFwiICsgc2xvdE1hcFtcImJvbmVcIl07XG4gICAgICAgICAgICB2YXIgc2xvdERhdGEgPSBuZXcgc3BpbmUuU2xvdERhdGEoc2xvdE1hcFtcIm5hbWVcIl0sIGJvbmVEYXRhKTtcblxuICAgICAgICAgICAgdmFyIGNvbG9yID0gc2xvdE1hcFtcImNvbG9yXCJdO1xuICAgICAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgICAgICAgc2xvdERhdGEuciA9IHNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yKGNvbG9yLCAwKTtcbiAgICAgICAgICAgICAgICBzbG90RGF0YS5nID0gc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IoY29sb3IsIDEpO1xuICAgICAgICAgICAgICAgIHNsb3REYXRhLmIgPSBzcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvcihjb2xvciwgMik7XG4gICAgICAgICAgICAgICAgc2xvdERhdGEuYSA9IHNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yKGNvbG9yLCAzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2xvdERhdGEuYXR0YWNobWVudE5hbWUgPSBzbG90TWFwW1wiYXR0YWNobWVudFwiXTtcblxuICAgICAgICAgICAgc2tlbGV0b25EYXRhLnNsb3RzLnB1c2goc2xvdERhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2tpbnMuXG4gICAgICAgIHZhciBza2lucyA9IHJvb3RbXCJza2luc1wiXTtcbiAgICAgICAgZm9yICh2YXIgc2tpbk5hbWUgaW4gc2tpbnMpIHtcbiAgICAgICAgICAgIGlmICghc2tpbnMuaGFzT3duUHJvcGVydHkoc2tpbk5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHZhciBza2luTWFwID0gc2tpbnNbc2tpbk5hbWVdO1xuICAgICAgICAgICAgdmFyIHNraW4gPSBuZXcgc3BpbmUuU2tpbihza2luTmFtZSk7XG4gICAgICAgICAgICBmb3IgKHZhciBzbG90TmFtZSBpbiBza2luTWFwKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFza2luTWFwLmhhc093blByb3BlcnR5KHNsb3ROYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgdmFyIHNsb3RJbmRleCA9IHNrZWxldG9uRGF0YS5maW5kU2xvdEluZGV4KHNsb3ROYW1lKTtcbiAgICAgICAgICAgICAgICB2YXIgc2xvdEVudHJ5ID0gc2tpbk1hcFtzbG90TmFtZV07XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgYXR0YWNobWVudE5hbWUgaW4gc2xvdEVudHJ5KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghc2xvdEVudHJ5Lmhhc093blByb3BlcnR5KGF0dGFjaG1lbnROYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhdHRhY2htZW50ID0gdGhpcy5yZWFkQXR0YWNobWVudChza2luLCBhdHRhY2htZW50TmFtZSwgc2xvdEVudHJ5W2F0dGFjaG1lbnROYW1lXSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRhY2htZW50ICE9IG51bGwpIHNraW4uYWRkQXR0YWNobWVudChzbG90SW5kZXgsIGF0dGFjaG1lbnROYW1lLCBhdHRhY2htZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBza2VsZXRvbkRhdGEuc2tpbnMucHVzaChza2luKTtcbiAgICAgICAgICAgIGlmIChza2luLm5hbWUgPT0gXCJkZWZhdWx0XCIpIHNrZWxldG9uRGF0YS5kZWZhdWx0U2tpbiA9IHNraW47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBbmltYXRpb25zLlxuICAgICAgICB2YXIgYW5pbWF0aW9ucyA9IHJvb3RbXCJhbmltYXRpb25zXCJdO1xuICAgICAgICBmb3IgKHZhciBhbmltYXRpb25OYW1lIGluIGFuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICghYW5pbWF0aW9ucy5oYXNPd25Qcm9wZXJ0eShhbmltYXRpb25OYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICB0aGlzLnJlYWRBbmltYXRpb24oYW5pbWF0aW9uTmFtZSwgYW5pbWF0aW9uc1thbmltYXRpb25OYW1lXSwgc2tlbGV0b25EYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBza2VsZXRvbkRhdGE7XG4gICAgfSxcbiAgICByZWFkQXR0YWNobWVudDogZnVuY3Rpb24gKHNraW4sIG5hbWUsIG1hcCkge1xuICAgICAgICAvKmpzaGludCAtVzA2OSovXG4gICAgICAgIG5hbWUgPSBtYXBbXCJuYW1lXCJdIHx8IG5hbWU7XG5cbiAgICAgICAgdmFyIHR5cGUgPSBzcGluZS5BdHRhY2htZW50VHlwZVttYXBbXCJ0eXBlXCJdIHx8IFwicmVnaW9uXCJdO1xuXG4gICAgICAgIGlmICh0eXBlID09IHNwaW5lLkF0dGFjaG1lbnRUeXBlLnJlZ2lvbikge1xuICAgICAgICAgICAgdmFyIGF0dGFjaG1lbnQgPSBuZXcgc3BpbmUuUmVnaW9uQXR0YWNobWVudCgpO1xuICAgICAgICAgICAgYXR0YWNobWVudC54ID0gKG1hcFtcInhcIl0gfHwgMCkgKiB0aGlzLnNjYWxlO1xuICAgICAgICAgICAgYXR0YWNobWVudC55ID0gKG1hcFtcInlcIl0gfHwgMCkgKiB0aGlzLnNjYWxlO1xuICAgICAgICAgICAgYXR0YWNobWVudC5zY2FsZVggPSBtYXBbXCJzY2FsZVhcIl0gfHwgMTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQuc2NhbGVZID0gbWFwW1wic2NhbGVZXCJdIHx8IDE7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJvdGF0aW9uID0gbWFwW1wicm90YXRpb25cIl0gfHwgMDtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQud2lkdGggPSAobWFwW1wid2lkdGhcIl0gfHwgMzIpICogdGhpcy5zY2FsZTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQuaGVpZ2h0ID0gKG1hcFtcImhlaWdodFwiXSB8fCAzMikgKiB0aGlzLnNjYWxlO1xuICAgICAgICAgICAgYXR0YWNobWVudC51cGRhdGVPZmZzZXQoKTtcblxuICAgICAgICAgICAgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdCA9IHt9O1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdC5uYW1lID0gbmFtZTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3Quc2NhbGUgPSB7fTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3Quc2NhbGUueCA9IGF0dGFjaG1lbnQuc2NhbGVYO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdC5zY2FsZS55ID0gYXR0YWNobWVudC5zY2FsZVk7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0LnJvdGF0aW9uID0gLWF0dGFjaG1lbnQucm90YXRpb24gKiBNYXRoLlBJIC8gMTgwO1xuICAgICAgICAgICAgcmV0dXJuIGF0dGFjaG1lbnQ7XG4gICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgXCJVbmtub3duIGF0dGFjaG1lbnQgdHlwZTogXCIgKyB0eXBlO1xuICAgIH0sXG5cbiAgICByZWFkQW5pbWF0aW9uOiBmdW5jdGlvbiAobmFtZSwgbWFwLCBza2VsZXRvbkRhdGEpIHtcbiAgICAgICAgLypqc2hpbnQgLVcwNjkqL1xuICAgICAgICB2YXIgdGltZWxpbmVzID0gW107XG4gICAgICAgIHZhciBkdXJhdGlvbiA9IDA7XG4gICAgICAgIHZhciBmcmFtZUluZGV4LCB0aW1lbGluZSwgdGltZWxpbmVOYW1lLCB2YWx1ZU1hcCwgdmFsdWVzLFxuICAgICAgICAgICAgaSwgbjtcblxuICAgICAgICB2YXIgYm9uZXMgPSBtYXBbXCJib25lc1wiXTtcbiAgICAgICAgZm9yICh2YXIgYm9uZU5hbWUgaW4gYm9uZXMpIHtcbiAgICAgICAgICAgIGlmICghYm9uZXMuaGFzT3duUHJvcGVydHkoYm9uZU5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHZhciBib25lSW5kZXggPSBza2VsZXRvbkRhdGEuZmluZEJvbmVJbmRleChib25lTmFtZSk7XG4gICAgICAgICAgICBpZiAoYm9uZUluZGV4ID09IC0xKSB0aHJvdyBcIkJvbmUgbm90IGZvdW5kOiBcIiArIGJvbmVOYW1lO1xuICAgICAgICAgICAgdmFyIGJvbmVNYXAgPSBib25lc1tib25lTmFtZV07XG5cbiAgICAgICAgICAgIGZvciAodGltZWxpbmVOYW1lIGluIGJvbmVNYXApIHtcbiAgICAgICAgICAgICAgICBpZiAoIWJvbmVNYXAuaGFzT3duUHJvcGVydHkodGltZWxpbmVOYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gYm9uZU1hcFt0aW1lbGluZU5hbWVdO1xuICAgICAgICAgICAgICAgIGlmICh0aW1lbGluZU5hbWUgPT0gXCJyb3RhdGVcIikge1xuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZSA9IG5ldyBzcGluZS5Sb3RhdGVUaW1lbGluZSh2YWx1ZXMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUuYm9uZUluZGV4ID0gYm9uZUluZGV4O1xuXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lSW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBuID0gdmFsdWVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVNYXAgPSB2YWx1ZXNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lbGluZS5zZXRGcmFtZShmcmFtZUluZGV4LCB2YWx1ZU1hcFtcInRpbWVcIl0sIHZhbHVlTWFwW1wiYW5nbGVcIl0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3BpbmUuU2tlbGV0b25Kc29uLnJlYWRDdXJ2ZSh0aW1lbGluZSwgZnJhbWVJbmRleCwgdmFsdWVNYXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVJbmRleCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lcy5wdXNoKHRpbWVsaW5lKTtcbiAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgdGltZWxpbmUuZnJhbWVzW3RpbWVsaW5lLmdldEZyYW1lQ291bnQoKSAqIDIgLSAyXSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRpbWVsaW5lTmFtZSA9PSBcInRyYW5zbGF0ZVwiIHx8IHRpbWVsaW5lTmFtZSA9PSBcInNjYWxlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRpbWVsaW5lU2NhbGUgPSAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGltZWxpbmVOYW1lID09IFwic2NhbGVcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lID0gbmV3IHNwaW5lLlNjYWxlVGltZWxpbmUodmFsdWVzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUgPSBuZXcgc3BpbmUuVHJhbnNsYXRlVGltZWxpbmUodmFsdWVzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lbGluZVNjYWxlID0gdGhpcy5zY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZS5ib25lSW5kZXggPSBib25lSW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgZnJhbWVJbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDAsIG4gPSB2YWx1ZXMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZU1hcCA9IHZhbHVlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB4ID0gKHZhbHVlTWFwW1wieFwiXSB8fCAwKSAqIHRpbWVsaW5lU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgeSA9ICh2YWx1ZU1hcFtcInlcIl0gfHwgMCkgKiB0aW1lbGluZVNjYWxlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUuc2V0RnJhbWUoZnJhbWVJbmRleCwgdmFsdWVNYXBbXCJ0aW1lXCJdLCB4LCB5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwaW5lLlNrZWxldG9uSnNvbi5yZWFkQ3VydmUodGltZWxpbmUsIGZyYW1lSW5kZXgsIHZhbHVlTWFwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZXMucHVzaCh0aW1lbGluZSk7XG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uID0gTWF0aC5tYXgoZHVyYXRpb24sIHRpbWVsaW5lLmZyYW1lc1t0aW1lbGluZS5nZXRGcmFtZUNvdW50KCkgKiAzIC0gM10pO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCB0aW1lbGluZSB0eXBlIGZvciBhIGJvbmU6IFwiICsgdGltZWxpbmVOYW1lICsgXCIgKFwiICsgYm9uZU5hbWUgKyBcIilcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgc2xvdHMgPSBtYXBbXCJzbG90c1wiXTtcbiAgICAgICAgZm9yICh2YXIgc2xvdE5hbWUgaW4gc2xvdHMpIHtcbiAgICAgICAgICAgIGlmICghc2xvdHMuaGFzT3duUHJvcGVydHkoc2xvdE5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHZhciBzbG90TWFwID0gc2xvdHNbc2xvdE5hbWVdO1xuICAgICAgICAgICAgdmFyIHNsb3RJbmRleCA9IHNrZWxldG9uRGF0YS5maW5kU2xvdEluZGV4KHNsb3ROYW1lKTtcblxuICAgICAgICAgICAgZm9yICh0aW1lbGluZU5hbWUgaW4gc2xvdE1hcCkge1xuICAgICAgICAgICAgICAgIGlmICghc2xvdE1hcC5oYXNPd25Qcm9wZXJ0eSh0aW1lbGluZU5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBzbG90TWFwW3RpbWVsaW5lTmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKHRpbWVsaW5lTmFtZSA9PSBcImNvbG9yXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUgPSBuZXcgc3BpbmUuQ29sb3JUaW1lbGluZSh2YWx1ZXMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUuc2xvdEluZGV4ID0gc2xvdEluZGV4O1xuXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lSW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBuID0gdmFsdWVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVNYXAgPSB2YWx1ZXNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sb3IgPSB2YWx1ZU1hcFtcImNvbG9yXCJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHIgPSBzcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvcihjb2xvciwgMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZyA9IHNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yKGNvbG9yLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBiID0gc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IoY29sb3IsIDIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGEgPSBzcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvcihjb2xvciwgMyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lbGluZS5zZXRGcmFtZShmcmFtZUluZGV4LCB2YWx1ZU1hcFtcInRpbWVcIl0sIHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3BpbmUuU2tlbGV0b25Kc29uLnJlYWRDdXJ2ZSh0aW1lbGluZSwgZnJhbWVJbmRleCwgdmFsdWVNYXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVJbmRleCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lcy5wdXNoKHRpbWVsaW5lKTtcbiAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgdGltZWxpbmUuZnJhbWVzW3RpbWVsaW5lLmdldEZyYW1lQ291bnQoKSAqIDUgLSA1XSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRpbWVsaW5lTmFtZSA9PSBcImF0dGFjaG1lbnRcIikge1xuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZSA9IG5ldyBzcGluZS5BdHRhY2htZW50VGltZWxpbmUodmFsdWVzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lLnNsb3RJbmRleCA9IHNsb3RJbmRleDtcblxuICAgICAgICAgICAgICAgICAgICBmcmFtZUluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMCwgbiA9IHZhbHVlcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlTWFwID0gdmFsdWVzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUuc2V0RnJhbWUoZnJhbWVJbmRleCsrLCB2YWx1ZU1hcFtcInRpbWVcIl0sIHZhbHVlTWFwW1wibmFtZVwiXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmVzLnB1c2godGltZWxpbmUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgdGltZWxpbmUuZnJhbWVzW3RpbWVsaW5lLmdldEZyYW1lQ291bnQoKSAtIDFdKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgdGltZWxpbmUgdHlwZSBmb3IgYSBzbG90OiBcIiArIHRpbWVsaW5lTmFtZSArIFwiIChcIiArIHNsb3ROYW1lICsgXCIpXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc2tlbGV0b25EYXRhLmFuaW1hdGlvbnMucHVzaChuZXcgc3BpbmUuQW5pbWF0aW9uKG5hbWUsIHRpbWVsaW5lcywgZHVyYXRpb24pKTtcbiAgICB9XG59O1xuc3BpbmUuU2tlbGV0b25Kc29uLnJlYWRDdXJ2ZSA9IGZ1bmN0aW9uICh0aW1lbGluZSwgZnJhbWVJbmRleCwgdmFsdWVNYXApIHtcbiAgICAvKmpzaGludCAtVzA2OSovXG4gICAgdmFyIGN1cnZlID0gdmFsdWVNYXBbXCJjdXJ2ZVwiXTtcbiAgICBpZiAoIWN1cnZlKSByZXR1cm47XG4gICAgaWYgKGN1cnZlID09IFwic3RlcHBlZFwiKVxuICAgICAgICB0aW1lbGluZS5jdXJ2ZXMuc2V0U3RlcHBlZChmcmFtZUluZGV4KTtcbiAgICBlbHNlIGlmIChjdXJ2ZSBpbnN0YW5jZW9mIEFycmF5KVxuICAgICAgICB0aW1lbGluZS5jdXJ2ZXMuc2V0Q3VydmUoZnJhbWVJbmRleCwgY3VydmVbMF0sIGN1cnZlWzFdLCBjdXJ2ZVsyXSwgY3VydmVbM10pO1xufTtcbnNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yID0gZnVuY3Rpb24gKGhleFN0cmluZywgY29sb3JJbmRleCkge1xuICAgIGlmIChoZXhTdHJpbmcubGVuZ3RoICE9IDgpIHRocm93IFwiQ29sb3IgaGV4aWRlY2ltYWwgbGVuZ3RoIG11c3QgYmUgOCwgcmVjaWV2ZWQ6IFwiICsgaGV4U3RyaW5nO1xuICAgIHJldHVybiBwYXJzZUludChoZXhTdHJpbmcuc3Vic3RyaW5nKGNvbG9ySW5kZXggKiAyLCAyKSwgMTYpIC8gMjU1O1xufTtcblxuc3BpbmUuQXRsYXMgPSBmdW5jdGlvbiAoYXRsYXNUZXh0LCB0ZXh0dXJlTG9hZGVyKSB7XG4gICAgdGhpcy50ZXh0dXJlTG9hZGVyID0gdGV4dHVyZUxvYWRlcjtcbiAgICB0aGlzLnBhZ2VzID0gW107XG4gICAgdGhpcy5yZWdpb25zID0gW107XG5cbiAgICB2YXIgcmVhZGVyID0gbmV3IHNwaW5lLkF0bGFzUmVhZGVyKGF0bGFzVGV4dCk7XG4gICAgdmFyIHR1cGxlID0gW107XG4gICAgdHVwbGUubGVuZ3RoID0gNDtcbiAgICB2YXIgcGFnZSA9IG51bGw7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgdmFyIGxpbmUgPSByZWFkZXIucmVhZExpbmUoKTtcbiAgICAgICAgaWYgKGxpbmUgPT0gbnVsbCkgYnJlYWs7XG4gICAgICAgIGxpbmUgPSByZWFkZXIudHJpbShsaW5lKTtcbiAgICAgICAgaWYgKCFsaW5lLmxlbmd0aClcbiAgICAgICAgICAgIHBhZ2UgPSBudWxsO1xuICAgICAgICBlbHNlIGlmICghcGFnZSkge1xuICAgICAgICAgICAgcGFnZSA9IG5ldyBzcGluZS5BdGxhc1BhZ2UoKTtcbiAgICAgICAgICAgIHBhZ2UubmFtZSA9IGxpbmU7XG5cbiAgICAgICAgICAgIHBhZ2UuZm9ybWF0ID0gc3BpbmUuQXRsYXMuRm9ybWF0W3JlYWRlci5yZWFkVmFsdWUoKV07XG5cbiAgICAgICAgICAgIHJlYWRlci5yZWFkVHVwbGUodHVwbGUpO1xuICAgICAgICAgICAgcGFnZS5taW5GaWx0ZXIgPSBzcGluZS5BdGxhcy5UZXh0dXJlRmlsdGVyW3R1cGxlWzBdXTtcbiAgICAgICAgICAgIHBhZ2UubWFnRmlsdGVyID0gc3BpbmUuQXRsYXMuVGV4dHVyZUZpbHRlclt0dXBsZVsxXV07XG5cbiAgICAgICAgICAgIHZhciBkaXJlY3Rpb24gPSByZWFkZXIucmVhZFZhbHVlKCk7XG4gICAgICAgICAgICBwYWdlLnVXcmFwID0gc3BpbmUuQXRsYXMuVGV4dHVyZVdyYXAuY2xhbXBUb0VkZ2U7XG4gICAgICAgICAgICBwYWdlLnZXcmFwID0gc3BpbmUuQXRsYXMuVGV4dHVyZVdyYXAuY2xhbXBUb0VkZ2U7XG4gICAgICAgICAgICBpZiAoZGlyZWN0aW9uID09IFwieFwiKVxuICAgICAgICAgICAgICAgIHBhZ2UudVdyYXAgPSBzcGluZS5BdGxhcy5UZXh0dXJlV3JhcC5yZXBlYXQ7XG4gICAgICAgICAgICBlbHNlIGlmIChkaXJlY3Rpb24gPT0gXCJ5XCIpXG4gICAgICAgICAgICAgICAgcGFnZS52V3JhcCA9IHNwaW5lLkF0bGFzLlRleHR1cmVXcmFwLnJlcGVhdDtcbiAgICAgICAgICAgIGVsc2UgaWYgKGRpcmVjdGlvbiA9PSBcInh5XCIpXG4gICAgICAgICAgICAgICAgcGFnZS51V3JhcCA9IHBhZ2UudldyYXAgPSBzcGluZS5BdGxhcy5UZXh0dXJlV3JhcC5yZXBlYXQ7XG5cbiAgICAgICAgICAgIHRleHR1cmVMb2FkZXIubG9hZChwYWdlLCBsaW5lKTtcblxuICAgICAgICAgICAgdGhpcy5wYWdlcy5wdXNoKHBhZ2UpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgcmVnaW9uID0gbmV3IHNwaW5lLkF0bGFzUmVnaW9uKCk7XG4gICAgICAgICAgICByZWdpb24ubmFtZSA9IGxpbmU7XG4gICAgICAgICAgICByZWdpb24ucGFnZSA9IHBhZ2U7XG5cbiAgICAgICAgICAgIHJlZ2lvbi5yb3RhdGUgPSByZWFkZXIucmVhZFZhbHVlKCkgPT0gXCJ0cnVlXCI7XG5cbiAgICAgICAgICAgIHJlYWRlci5yZWFkVHVwbGUodHVwbGUpO1xuICAgICAgICAgICAgdmFyIHggPSBwYXJzZUludCh0dXBsZVswXSwgMTApO1xuICAgICAgICAgICAgdmFyIHkgPSBwYXJzZUludCh0dXBsZVsxXSwgMTApO1xuXG4gICAgICAgICAgICByZWFkZXIucmVhZFR1cGxlKHR1cGxlKTtcbiAgICAgICAgICAgIHZhciB3aWR0aCA9IHBhcnNlSW50KHR1cGxlWzBdLCAxMCk7XG4gICAgICAgICAgICB2YXIgaGVpZ2h0ID0gcGFyc2VJbnQodHVwbGVbMV0sIDEwKTtcblxuICAgICAgICAgICAgcmVnaW9uLnUgPSB4IC8gcGFnZS53aWR0aDtcbiAgICAgICAgICAgIHJlZ2lvbi52ID0geSAvIHBhZ2UuaGVpZ2h0O1xuICAgICAgICAgICAgaWYgKHJlZ2lvbi5yb3RhdGUpIHtcbiAgICAgICAgICAgICAgICByZWdpb24udTIgPSAoeCArIGhlaWdodCkgLyBwYWdlLndpZHRoO1xuICAgICAgICAgICAgICAgIHJlZ2lvbi52MiA9ICh5ICsgd2lkdGgpIC8gcGFnZS5oZWlnaHQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlZ2lvbi51MiA9ICh4ICsgd2lkdGgpIC8gcGFnZS53aWR0aDtcbiAgICAgICAgICAgICAgICByZWdpb24udjIgPSAoeSArIGhlaWdodCkgLyBwYWdlLmhlaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlZ2lvbi54ID0geDtcbiAgICAgICAgICAgIHJlZ2lvbi55ID0geTtcbiAgICAgICAgICAgIHJlZ2lvbi53aWR0aCA9IE1hdGguYWJzKHdpZHRoKTtcbiAgICAgICAgICAgIHJlZ2lvbi5oZWlnaHQgPSBNYXRoLmFicyhoZWlnaHQpO1xuXG4gICAgICAgICAgICBpZiAocmVhZGVyLnJlYWRUdXBsZSh0dXBsZSkgPT0gNCkgeyAvLyBzcGxpdCBpcyBvcHRpb25hbFxuICAgICAgICAgICAgICAgIHJlZ2lvbi5zcGxpdHMgPSBbcGFyc2VJbnQodHVwbGVbMF0sIDEwKSwgcGFyc2VJbnQodHVwbGVbMV0sIDEwKSwgcGFyc2VJbnQodHVwbGVbMl0sIDEwKSwgcGFyc2VJbnQodHVwbGVbM10sIDEwKV07XG5cbiAgICAgICAgICAgICAgICBpZiAocmVhZGVyLnJlYWRUdXBsZSh0dXBsZSkgPT0gNCkgeyAvLyBwYWQgaXMgb3B0aW9uYWwsIGJ1dCBvbmx5IHByZXNlbnQgd2l0aCBzcGxpdHNcbiAgICAgICAgICAgICAgICAgICAgcmVnaW9uLnBhZHMgPSBbcGFyc2VJbnQodHVwbGVbMF0sIDEwKSwgcGFyc2VJbnQodHVwbGVbMV0sIDEwKSwgcGFyc2VJbnQodHVwbGVbMl0sIDEwKSwgcGFyc2VJbnQodHVwbGVbM10sIDEwKV07XG5cbiAgICAgICAgICAgICAgICAgICAgcmVhZGVyLnJlYWRUdXBsZSh0dXBsZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZWdpb24ub3JpZ2luYWxXaWR0aCA9IHBhcnNlSW50KHR1cGxlWzBdLCAxMCk7XG4gICAgICAgICAgICByZWdpb24ub3JpZ2luYWxIZWlnaHQgPSBwYXJzZUludCh0dXBsZVsxXSwgMTApO1xuXG4gICAgICAgICAgICByZWFkZXIucmVhZFR1cGxlKHR1cGxlKTtcbiAgICAgICAgICAgIHJlZ2lvbi5vZmZzZXRYID0gcGFyc2VJbnQodHVwbGVbMF0sIDEwKTtcbiAgICAgICAgICAgIHJlZ2lvbi5vZmZzZXRZID0gcGFyc2VJbnQodHVwbGVbMV0sIDEwKTtcblxuICAgICAgICAgICAgcmVnaW9uLmluZGV4ID0gcGFyc2VJbnQocmVhZGVyLnJlYWRWYWx1ZSgpLCAxMCk7XG5cbiAgICAgICAgICAgIHRoaXMucmVnaW9ucy5wdXNoKHJlZ2lvbik7XG4gICAgICAgIH1cbiAgICB9XG59O1xuc3BpbmUuQXRsYXMucHJvdG90eXBlID0ge1xuICAgIGZpbmRSZWdpb246IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHZhciByZWdpb25zID0gdGhpcy5yZWdpb25zO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHJlZ2lvbnMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKHJlZ2lvbnNbaV0ubmFtZSA9PSBuYW1lKSByZXR1cm4gcmVnaW9uc1tpXTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBkaXNwb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwYWdlcyA9IHRoaXMucGFnZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gcGFnZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgdGhpcy50ZXh0dXJlTG9hZGVyLnVubG9hZChwYWdlc1tpXS5yZW5kZXJlck9iamVjdCk7XG4gICAgfSxcbiAgICB1cGRhdGVVVnM6IGZ1bmN0aW9uIChwYWdlKSB7XG4gICAgICAgIHZhciByZWdpb25zID0gdGhpcy5yZWdpb25zO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHJlZ2lvbnMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcmVnaW9uID0gcmVnaW9uc1tpXTtcbiAgICAgICAgICAgIGlmIChyZWdpb24ucGFnZSAhPSBwYWdlKSBjb250aW51ZTtcbiAgICAgICAgICAgIHJlZ2lvbi51ID0gcmVnaW9uLnggLyBwYWdlLndpZHRoO1xuICAgICAgICAgICAgcmVnaW9uLnYgPSByZWdpb24ueSAvIHBhZ2UuaGVpZ2h0O1xuICAgICAgICAgICAgaWYgKHJlZ2lvbi5yb3RhdGUpIHtcbiAgICAgICAgICAgICAgICByZWdpb24udTIgPSAocmVnaW9uLnggKyByZWdpb24uaGVpZ2h0KSAvIHBhZ2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgcmVnaW9uLnYyID0gKHJlZ2lvbi55ICsgcmVnaW9uLndpZHRoKSAvIHBhZ2UuaGVpZ2h0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWdpb24udTIgPSAocmVnaW9uLnggKyByZWdpb24ud2lkdGgpIC8gcGFnZS53aWR0aDtcbiAgICAgICAgICAgICAgICByZWdpb24udjIgPSAocmVnaW9uLnkgKyByZWdpb24uaGVpZ2h0KSAvIHBhZ2UuaGVpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuc3BpbmUuQXRsYXMuRm9ybWF0ID0ge1xuICAgIGFscGhhOiAwLFxuICAgIGludGVuc2l0eTogMSxcbiAgICBsdW1pbmFuY2VBbHBoYTogMixcbiAgICByZ2I1NjU6IDMsXG4gICAgcmdiYTQ0NDQ6IDQsXG4gICAgcmdiODg4OiA1LFxuICAgIHJnYmE4ODg4OiA2XG59O1xuXG5zcGluZS5BdGxhcy5UZXh0dXJlRmlsdGVyID0ge1xuICAgIG5lYXJlc3Q6IDAsXG4gICAgbGluZWFyOiAxLFxuICAgIG1pcE1hcDogMixcbiAgICBtaXBNYXBOZWFyZXN0TmVhcmVzdDogMyxcbiAgICBtaXBNYXBMaW5lYXJOZWFyZXN0OiA0LFxuICAgIG1pcE1hcE5lYXJlc3RMaW5lYXI6IDUsXG4gICAgbWlwTWFwTGluZWFyTGluZWFyOiA2XG59O1xuXG5zcGluZS5BdGxhcy5UZXh0dXJlV3JhcCA9IHtcbiAgICBtaXJyb3JlZFJlcGVhdDogMCxcbiAgICBjbGFtcFRvRWRnZTogMSxcbiAgICByZXBlYXQ6IDJcbn07XG5cbnNwaW5lLkF0bGFzUGFnZSA9IGZ1bmN0aW9uICgpIHt9O1xuc3BpbmUuQXRsYXNQYWdlLnByb3RvdHlwZSA9IHtcbiAgICBuYW1lOiBudWxsLFxuICAgIGZvcm1hdDogbnVsbCxcbiAgICBtaW5GaWx0ZXI6IG51bGwsXG4gICAgbWFnRmlsdGVyOiBudWxsLFxuICAgIHVXcmFwOiBudWxsLFxuICAgIHZXcmFwOiBudWxsLFxuICAgIHJlbmRlcmVyT2JqZWN0OiBudWxsLFxuICAgIHdpZHRoOiAwLFxuICAgIGhlaWdodDogMFxufTtcblxuc3BpbmUuQXRsYXNSZWdpb24gPSBmdW5jdGlvbiAoKSB7fTtcbnNwaW5lLkF0bGFzUmVnaW9uLnByb3RvdHlwZSA9IHtcbiAgICBwYWdlOiBudWxsLFxuICAgIG5hbWU6IG51bGwsXG4gICAgeDogMCwgeTogMCxcbiAgICB3aWR0aDogMCwgaGVpZ2h0OiAwLFxuICAgIHU6IDAsIHY6IDAsIHUyOiAwLCB2MjogMCxcbiAgICBvZmZzZXRYOiAwLCBvZmZzZXRZOiAwLFxuICAgIG9yaWdpbmFsV2lkdGg6IDAsIG9yaWdpbmFsSGVpZ2h0OiAwLFxuICAgIGluZGV4OiAwLFxuICAgIHJvdGF0ZTogZmFsc2UsXG4gICAgc3BsaXRzOiBudWxsLFxuICAgIHBhZHM6IG51bGwsXG59O1xuXG5zcGluZS5BdGxhc1JlYWRlciA9IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgdGhpcy5saW5lcyA9IHRleHQuc3BsaXQoL1xcclxcbnxcXHJ8XFxuLyk7XG59O1xuc3BpbmUuQXRsYXNSZWFkZXIucHJvdG90eXBlID0ge1xuICAgIGluZGV4OiAwLFxuICAgIHRyaW06IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgXCJcIik7XG4gICAgfSxcbiAgICByZWFkTGluZTogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5pbmRleCA+PSB0aGlzLmxpbmVzLmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiB0aGlzLmxpbmVzW3RoaXMuaW5kZXgrK107XG4gICAgfSxcbiAgICByZWFkVmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGxpbmUgPSB0aGlzLnJlYWRMaW5lKCk7XG4gICAgICAgIHZhciBjb2xvbiA9IGxpbmUuaW5kZXhPZihcIjpcIik7XG4gICAgICAgIGlmIChjb2xvbiA9PSAtMSkgdGhyb3cgXCJJbnZhbGlkIGxpbmU6IFwiICsgbGluZTtcbiAgICAgICAgcmV0dXJuIHRoaXMudHJpbShsaW5lLnN1YnN0cmluZyhjb2xvbiArIDEpKTtcbiAgICB9LFxuICAgIC8qKiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgdHVwbGUgdmFsdWVzIHJlYWQgKDIgb3IgNCkuICovXG4gICAgcmVhZFR1cGxlOiBmdW5jdGlvbiAodHVwbGUpIHtcbiAgICAgICAgdmFyIGxpbmUgPSB0aGlzLnJlYWRMaW5lKCk7XG4gICAgICAgIHZhciBjb2xvbiA9IGxpbmUuaW5kZXhPZihcIjpcIik7XG4gICAgICAgIGlmIChjb2xvbiA9PSAtMSkgdGhyb3cgXCJJbnZhbGlkIGxpbmU6IFwiICsgbGluZTtcbiAgICAgICAgdmFyIGkgPSAwLCBsYXN0TWF0Y2g9IGNvbG9uICsgMTtcbiAgICAgICAgZm9yICg7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjb21tYSA9IGxpbmUuaW5kZXhPZihcIixcIiwgbGFzdE1hdGNoKTtcbiAgICAgICAgICAgIGlmIChjb21tYSA9PSAtMSkge1xuICAgICAgICAgICAgICAgIGlmICghaSkgdGhyb3cgXCJJbnZhbGlkIGxpbmU6IFwiICsgbGluZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHR1cGxlW2ldID0gdGhpcy50cmltKGxpbmUuc3Vic3RyKGxhc3RNYXRjaCwgY29tbWEgLSBsYXN0TWF0Y2gpKTtcbiAgICAgICAgICAgIGxhc3RNYXRjaCA9IGNvbW1hICsgMTtcbiAgICAgICAgfVxuICAgICAgICB0dXBsZVtpXSA9IHRoaXMudHJpbShsaW5lLnN1YnN0cmluZyhsYXN0TWF0Y2gpKTtcbiAgICAgICAgcmV0dXJuIGkgKyAxO1xuICAgIH1cbn1cblxuc3BpbmUuQXRsYXNBdHRhY2htZW50TG9hZGVyID0gZnVuY3Rpb24gKGF0bGFzKSB7XG4gICAgdGhpcy5hdGxhcyA9IGF0bGFzO1xufVxuc3BpbmUuQXRsYXNBdHRhY2htZW50TG9hZGVyLnByb3RvdHlwZSA9IHtcbiAgICBuZXdBdHRhY2htZW50OiBmdW5jdGlvbiAoc2tpbiwgdHlwZSwgbmFtZSkge1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBzcGluZS5BdHRhY2htZW50VHlwZS5yZWdpb246XG4gICAgICAgICAgICB2YXIgcmVnaW9uID0gdGhpcy5hdGxhcy5maW5kUmVnaW9uKG5hbWUpO1xuICAgICAgICAgICAgaWYgKCFyZWdpb24pIHRocm93IFwiUmVnaW9uIG5vdCBmb3VuZCBpbiBhdGxhczogXCIgKyBuYW1lICsgXCIgKFwiICsgdHlwZSArIFwiKVwiO1xuICAgICAgICAgICAgdmFyIGF0dGFjaG1lbnQgPSBuZXcgc3BpbmUuUmVnaW9uQXR0YWNobWVudChuYW1lKTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QgPSByZWdpb247XG4gICAgICAgICAgICBhdHRhY2htZW50LnNldFVWcyhyZWdpb24udSwgcmVnaW9uLnYsIHJlZ2lvbi51MiwgcmVnaW9uLnYyLCByZWdpb24ucm90YXRlKTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVnaW9uT2Zmc2V0WCA9IHJlZ2lvbi5vZmZzZXRYO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZWdpb25PZmZzZXRZID0gcmVnaW9uLm9mZnNldFk7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlZ2lvbldpZHRoID0gcmVnaW9uLndpZHRoO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZWdpb25IZWlnaHQgPSByZWdpb24uaGVpZ2h0O1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZWdpb25PcmlnaW5hbFdpZHRoID0gcmVnaW9uLm9yaWdpbmFsV2lkdGg7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlZ2lvbk9yaWdpbmFsSGVpZ2h0ID0gcmVnaW9uLm9yaWdpbmFsSGVpZ2h0O1xuICAgICAgICAgICAgcmV0dXJuIGF0dGFjaG1lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgXCJVbmtub3duIGF0dGFjaG1lbnQgdHlwZTogXCIgKyB0eXBlO1xuICAgIH1cbn1cblxuc3BpbmUuQm9uZS55RG93biA9IHRydWU7XG4iLCJ2YXIgZ2xvYmFsPXR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fTtcbi8vIFRoaXMgZmlsZSBpcyBjb3BpZWQgdG8gdGhlIGJ1aWxkIGRpcmVjdG9yeS5cbi8vIFdoZXJlIHRoZSBwaXhpIG1vZHVsZSBzaG91bGQgaGF2ZSBhbHNvIGJlZW4gY29waWVkIChzbyB0aGlzIHdvcmtzIGFzIGV4cGVjdGVkKS5cbmdsb2JhbC5QSVhJID0gcmVxdWlyZSgncGl4aScpO1xuZ2xvYmFsLnJlcXVlc3RBbmltRnJhbWUgPSByZXF1aXJlKCdwaXhpL3V0aWxzL3JhZicpO1xuIl19
