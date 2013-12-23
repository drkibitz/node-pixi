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
                               a00 * id * world.y + -a10 * id * world.x + (-a12 * a00 + a02 * a10) * id);
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
    /*jshint -W015*/
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

    this.interactionDOMElement.style.cursor = 'inherit';

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
                if(item.buttonMode) this.interactionDOMElement.style.cursor = item.defaultCursor;

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

    // while
    // hit test
    for (var i = 0, l = this.interactiveItems.length; i < l; i++)
    {
        var item = this.interactiveItems[i];

        if(item.mousedown || item.click)
        {
            item.__mouseIsDown = true;
            item.__hit = this.hitTest(item, this.mouse);

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

proto.onMouseOut = function onMouseOut()
{
    this.interactionDOMElement.style.cursor = 'inherit';

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
                interactionData.target = item;
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
            interactionData.target = item;
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

            if(itemTouchData === touchData)
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

},{"./core/globals":2,"./display/Sprite":6,"./geom/Point":34,"./platform":45}],2:[function(require,module,exports){
/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

module.exports = {
    // autoDetected: false,

    gl: null,
    primitiveShader: null,
    stripShader: null,
    defaultShader: null,

    offset: null,
    projection:null,

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
var Rectangle = require('../geom/Rectangle');

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

    this.defaultCursor = 'pointer';

    /**
     * [read-only] Current transform of the object based on world (parent) factors
     *
     * @property worldTransform
     * @type Mat3
     * @readOnly
     * @private
     */
    this.worldTransform = mat3.create();//mat3.identity();

    /**
     * [read-only] Current transform of the object locally
     *
     * @property localTransform
     * @type Mat3
     * @readOnly
     * @private
     */
    this.localTransform = mat3.create();//mat3.identity();

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


    this.filterArea = new Rectangle(0,0,1,1);

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
 * [Deprecated] Indicates if the sprite will have touch and mouse interactivity. It is false by default
 * Instead of using this function you can now simply set the interactive property to true or false
 *
 * @method setInteractive
 * @param interactive {Boolean}
 * @deprecated Simply set the `interactive` property directly
 */
proto.setInteractive = function(interactive)
{
    this.interactive = interactive;
};

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


        if(value)
        {
            if(this._mask)
            {
                value.start = this._mask.start;
                value.end = this._mask.end;
            }
            else
            {
                this.addFilter(value);
                value.renderable = false;
            }
        }
        else
        {
            this.removeFilter(this._mask);
            this._mask.renderable = true;
        }

        this._mask = value;
    }
});

/**
 * Sets the filters for the displayObject.
 * * IMPORTANT: This is a webGL only feature and will be ignored by the canvas renderer.
 * To remove filters simply set this property to 'null'
 * @property filters
 * @type Array An array of filters
 */
Object.defineProperty(proto, 'filters', {
    get: function() {
        return this._filters;
    },
    set: function(value) {

        if(value)
        {
            if(this._filters)this.removeFilter(this._filters);
            this.addFilter(value);

            // now put all the passes in one place..
            var passes = [];
            for (var i = 0; i < value.length; i++)
            {
                var filterPasses = value[i].passes;
                for (var j = 0; j < filterPasses.length; j++)
                {
                    passes.push(filterPasses[j]);
                }
            }

            value.start.filterPasses = passes;
        }
        else
        {
            if(this._filters) {
                this.removeFilter(this._filters);
            }
        }

        this._filters = value;
    }
});

/*
 * Adds a filter to this displayObject
 *
 * @method addFilter
 * @param mask {Graphics} the graphics object to use as a filter
 * @private
 */
proto.addFilter = function addFilter(data)
{
    //if(this.filter)return;
    //this.filter = true;
//  data[0].target = this;


    // insert a filter block..
    // TODO Onject pool these bad boys..
    var start = new FilterBlock();
    var end = new FilterBlock();

    data.start = start;
    data.end = end;

    start.data = data;
    end.data = data;

    start.first = start.last =  this;
    end.first = end.last = this;

    start.open = true;

    start.target = this;

    /*
     * insert start
     */

    var childFirst = start;
    var childLast = start;
    var nextObject;
    var previousObject;

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
        if(updateLast.last === prevLast)
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
};

/*
 * Removes the filter to this displayObject
 *
 * @method removeFilter
 * @private
 */
proto.removeFilter = function removeFilter(data)
{
    //if(!this.filter)return;
    //this.filter = false;
    // console.log('YUOIO')
    // modify the list..
    var startBlock = data.start;


    var nextObject = startBlock._iNext;
    var previousObject = startBlock._iPrev;

    if(nextObject)nextObject._iPrev = previousObject;
    if(previousObject)previousObject._iNext = nextObject;

    this.first = startBlock._iNext;

    // remove the end filter
    var lastBlock = data.end;

    nextObject = lastBlock._iNext;
    previousObject = lastBlock._iPrev;

    if(nextObject)nextObject._iPrev = previousObject;
    previousObject._iNext = nextObject;

    // this is always true too!
    var tempLast =  lastBlock._iPrev;
    // need to make sure the parents last is updated too
    var updateLast = this;
    while(updateLast.last === lastBlock)
    {
        updateLast.last = tempLast;
        updateLast = updateLast.parent;
        if(!updateLast)break;
    }

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
    localTransform[1] = -this._sr * this.scale.y;
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

    localTransform[2] = a02;
    localTransform[5] = a12;

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

},{"../core/globals":2,"../filters/FilterBlock":24,"../geom/Point":34,"../geom/Rectangle":36,"../geom/matrix":37}],4:[function(require,module,exports){
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

/**
 * Adds a child to the container.
 *
 * @method addChild
 * @param child {DisplayObject} The DisplayObject to add to the container
 */
proto.addChild = function addChild(child)
{
    if(child.parent && child.parent !== this)
    {
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
        while(tmpChild);
    }

    // LINKED LIST //

    // modify the list..
    var childFirst = child.first;
    var childLast = child.last;
    var nextObject;
    var previousObject;

    // this could be wrong if there is a filter??
    if(this._filters || this._mask)
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
        if(updateLast.last === prevLast)
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
        if(child.parent !== undefined)
        {
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
            while(tmpChild);
        }

        // modify the list..
        var childFirst = child.first;
        var childLast = child.last;
        var nextObject;
        var previousObject;

        if(index === this.children.length)
        {
            previousObject =  this.last;
            var updateLast = this;
            var prevLast = this.last;
            while(updateLast)
            {
                if(updateLast.last === prevLast)
                {
                    updateLast.last = child.last;
                }
                updateLast = updateLast.parent;
            }
        }
        else if(index === 0)
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
        throw new Error(child + ' The index '+ index +' supplied is out of bounds ' + this.children.length);
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
    if(child === child2) {
        return;
    }

    var index1 = this.children.indexOf(child);
    var index2 = this.children.indexOf(child2);

    if(index1 < 0 || index2 < 0) {
        throw new Error('swapChildren: Both the supplied DisplayObjects must be a child of the caller.');
    }

    this.removeChild(child);
    this.removeChild(child2);

    if(index1 < index2)
    {
        this.addChildAt(child2, index1);
        this.addChildAt(child, index2);
    }
    else
    {
        this.addChildAt(child, index2);
        this.addChildAt(child2, index1);
    }
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
        throw new Error('Both the supplied DisplayObjects must be a child of the caller ' + this);
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

        if(this.last === childLast)
        {
            var tempLast = childFirst._iPrev;
            // need to make sure the parents last is updated too
            var updateLast = this;

            while(updateLast.last === childLast)
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
            while(tmpChild);
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
        throw new Error(child + ' The supplied DisplayObject must be a child of the caller ' + this);
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
};

/**
 * Plays the MovieClip
 *
 * @method play
 */
proto.play = function()
{
    this.playing = true;
};

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
};

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
        this.scale.x = value / this.texture.frame.width;
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
        this.scale.y = value / this.texture.frame.height;
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
    if(this.texture.baseTexture !== texture.baseTexture)
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
proto.onTextureUpdate = function onTextureUpdate()
{
    // so if _width is 0 then width was not set..
    if(this._width)this.scale.x = this._width / this.texture.frame.width;
    if(this._height)this.scale.y = this._height / this.texture.frame.height;

    this.updateFrame = true;
};

// some helper functions..

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
    if(!texture) throw new Error('The frameId "' + frameId + '" does not exist in the texture cache' + this);
    return new Sprite(texture);
};

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

module.exports = Sprite;

},{"../geom/Point":34,"../textures/Texture":63,"./DisplayObjectContainer":4,"./blendModes":8}],7:[function(require,module,exports){
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

},{"../InteractionManager":1,"../core/globals":2,"../geom/Rectangle":36,"../geom/matrix":37,"../utils/color":66,"./DisplayObjectContainer":4}],8:[function(require,module,exports){
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
 * https://github.com/mrdoob/eventtarget.js/
 * THankS mr DOob!
 */

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

    this.removeAllEventListeners = function( type ) {
        var a = listeners[type];
        if (a)
            a.length = 0;
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
        this.verticies = new Array(points.length * 4);
        this.uvs = new Array(points.length * 4);
        this.colors = new Array(points.length * 2);
        this.indices = new Array(points.length * 2);
    }

    this.refresh();
}

var proto = Rope.prototype = Object.create(Strip.prototype, {
    constructor: {value: Rope}
});

proto.refresh = function refresh()
{
    var points = this.points;
    if(points.length < 1) return;

    var uvs = this.uvs;

    var lastPoint = points[0];
    var indices = this.indices;
    var colors = this.colors;

    this.count-=0.2;


    uvs[0] = 0;
    uvs[1] = 1;
    uvs[2] = 0;
    uvs[3] = 1;

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
        amount = i / (total-1);

        if(i%2)
        {
            uvs[index] = amount;
            uvs[index+1] = 0;

            uvs[index+2] = amount;
            uvs[index+3] = 1;

        }
        else
        {
            uvs[index] = amount;
            uvs[index+1] = 0;

            uvs[index+2] = amount;
            uvs[index+3] = 1;
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
    verticies[0] = lastPoint.x + perp.x;
    verticies[1] = lastPoint.y + perp.y; //+ 200
    verticies[2] = lastPoint.x - perp.x;
    verticies[3] = lastPoint.y - perp.y;//+200
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

        if(ratio > 1) ratio = 1;

        perpLength = Math.sqrt(perp.x * perp.x + perp.y * perp.y);
        num = this.texture.height / 2; //(20 + Math.abs(Math.sin((i + this.count) * 0.3) * 50) )* ratio;
        perp.x /= perpLength;
        perp.y /= perpLength;

        perp.x *= num;
        perp.y *= num;

        verticies[index] = point.x + perp.x;
        verticies[index+1] = point.y + perp.y;
        verticies[index+2] = point.x - perp.x;
        verticies[index+3] = point.y - perp.y;

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
        throw new Error('Spine data must be preloaded using SpineLoader or AssetLoader: ' + url);
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
            if (!slot.currentSpriteName || slot.currentSpriteName !== attachment.name) {
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
    var name = Texture.cache[descriptor.name] ? descriptor.name : descriptor.name + '.png';
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

},{"../display/DisplayObjectContainer":4,"../display/Sprite":6,"../textures/Texture":63,"../utils/spine":69}],13:[function(require,module,exports){
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

proto.onTextureUpdate = function onTextureUpdate()
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
proto.onTextureUpdate = function onTextureUpdate()
{
    this.updateFrame = true;
};

module.exports = TilingSprite;

},{"../display/DisplayObjectContainer":4,"../display/blendModes":8,"../geom/Point":34}],15:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

/**
 * This is the base class for  creating a pixi.js filter. Currently only webGL supports filters.
 * If you want to make a custom filter this should be your base class.
 * @class AbstractFilter
 * @constructor
 * @param fragmentSrc
 * @param uniforms
 */
function AbstractFilter(fragmentSrc, uniforms)
{
    /**
    * An array of passes - some filters contain a few steps this array simply stores the steps in a liniear fashion.
    * For example the blur filter has two passes blurX and blurY.
    * @property passes
    * @type Array an array of filter objects
    * @private
    */
    this.passes = [this];


    this.dirty = true;
    this.padding = 0;

    /**
    @property uniforms
    @private
    */
    this.uniforms = uniforms || {};

    this.fragmentSrc = fragmentSrc || [];
}

module.exports = AbstractFilter;

},{}],16:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var BlurXFilter = require('./BlurXFilter');
var BlurYFilter = require('./BlurYFilter');

/**
 *
 * The BlurFilter applies a Gaussian blur to an object.
 * The strength of the blur can be set for x- and y-axis separately (always relative to the stage).
 *
 * @class BlurFilter
 * @contructor
 */
function BlurFilter()
{
    this.blurXFilter = new BlurXFilter();
    this.blurYFilter = new BlurYFilter();

    this.passes =[this.blurXFilter, this.blurYFilter];
}

var proto = BlurFilter.prototype;

/**
 * Sets the strength of both the blurX and blurY properties simultaneously
 *
 * @property blur
 * @type Number the strength of the blur
 * @default 2
 */
Object.defineProperty(proto, 'blur', {
    get: function() {
        return this.blurXFilter.blur;
    },
    set: function(value) {
        this.blurXFilter.blur = this.blurYFilter.blur = value;
    }
});

/**
 * Sets the strength of the blurX property simultaneously
 *
 * @property blurX
 * @type Number the strength of the blurX
 * @default 2
 */
Object.defineProperty(proto, 'blurX', {
    get: function() {
        return this.blurXFilter.blur;
    },
    set: function(value) {
        this.blurXFilter.blur = value;
    }
});

/**
 * Sets the strength of the blurX property simultaneously
 *
 * @property blurY
 * @type Number the strength of the blurY
 * @default 2
 */
Object.defineProperty(proto, 'blurY', {
    get: function() {
        return this.blurYFilter.blur;
    },
    set: function(value) {
        this.blurYFilter.blur = value;
    }
});

module.exports = BlurFilter;

},{"./BlurXFilter":17,"./BlurYFilter":18}],17:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

function BlurXFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        blur: {type: '1f', value: 1/512},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform float blur;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '   vec4 sum = vec4(0.0);',

        '   sum += texture2D(uSampler, vec2(vTextureCoord.x - 4.0*blur, vTextureCoord.y)) * 0.05;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x - 3.0*blur, vTextureCoord.y)) * 0.09;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x - 2.0*blur, vTextureCoord.y)) * 0.12;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x - blur, vTextureCoord.y)) * 0.15;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * 0.16;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x + blur, vTextureCoord.y)) * 0.15;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x + 2.0*blur, vTextureCoord.y)) * 0.12;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x + 3.0*blur, vTextureCoord.y)) * 0.09;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x + 4.0*blur, vTextureCoord.y)) * 0.05;',

        '   gl_FragColor = sum;',
        '}'
    ];
}

var proto = BlurXFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: BlurXFilter}
});

Object.defineProperty(proto, 'blur', {
    get: function() {
        return this.uniforms.blur.value / (1/7000);
    },
    set: function(value) {

        this.dirty = true;
        this.uniforms.blur.value = (1/7000) * value;
    }
});

module.exports = BlurXFilter;

},{"./AbstractFilter":15}],18:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

function BlurYFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        blur: {type: '1f', value: 1/512},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform float blur;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '   vec4 sum = vec4(0.0);',

        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 4.0*blur)) * 0.05;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 3.0*blur)) * 0.09;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - 2.0*blur)) * 0.12;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y - blur)) * 0.15;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y)) * 0.16;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + blur)) * 0.15;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 2.0*blur)) * 0.12;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 3.0*blur)) * 0.09;',
        '   sum += texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y + 4.0*blur)) * 0.05;',

        '   gl_FragColor = sum;',
        '}'
    ];
}

var proto = BlurYFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: BlurYFilter}
});

Object.defineProperty(proto, 'blur', {
    get: function() {
        return this.uniforms.blur.value / (1/7000);
    },
    set: function(value) {
        //this.padding = value;
        this.uniforms.blur.value = (1/7000) * value;
    }
});

module.exports = BlurYFilter;

},{"./AbstractFilter":15}],19:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * The ColorMatrixFilter class lets you apply a 4x4 matrix transformation on the RGBA
 * color and alpha values of every pixel on your displayObject to produce a result
 * with a new set of RGBA color and alpha values. Its pretty powerful!
 * @class ColorMatrixFilter
 * @contructor
 */
function ColorMatrixFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        matrix: {type: 'mat4', value: [1,0,0,0,
                                       0,1,0,0,
                                       0,0,1,0,
                                       0,0,0,1]},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform float invert;',
        'uniform mat4 matrix;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '   gl_FragColor = texture2D(uSampler, vTextureCoord) * matrix;',
        '   gl_FragColor = gl_FragColor * vColor;',
        '}'
    ];
}

var proto = ColorMatrixFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: ColorMatrixFilter}
});

/**
 * Sets the matrix of the color matrix filter
 *
 * @property matrix
 * @type Array and array of 26 numbers
 * @default [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
 */
Object.defineProperty(proto, 'matrix', {
    get: function() {
        return this.uniforms.matrix.value;
    },
    set: function(value) {
        this.uniforms.matrix.value = value;
    }
});

module.exports = ColorMatrixFilter;

},{"./AbstractFilter":15}],20:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * This turns your displayObjects to black and white.
 * @class ColorStepFilter
 * @contructor
 */
function ColorStepFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        step: {type: '1f', value: 5},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform sampler2D uSampler;',
        'uniform float step;',

        'void main(void) {',
        '   vec4 color = texture2D(uSampler, vTextureCoord);',
        '   color = floor(color * step) / step;',
        '   gl_FragColor = color * vColor;',
        '}'
    ];
}

var proto = ColorStepFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: ColorStepFilter}
});

/**
The number of steps.
@property step
*/
Object.defineProperty(proto, 'step', {
    get: function() {
        return this.uniforms.step.value;
    },
    set: function(value) {
        this.uniforms.step.value = value;
    }
});

module.exports = ColorStepFilter;

},{"./AbstractFilter":15}],21:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

function CrossHatchFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        blur: {type: '1f', value: 1 / 512},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform float blur;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '    float lum = length(texture2D(uSampler, vTextureCoord.xy).rgb);',

        '    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);',

        '    if (lum < 1.00) {',
        '        if (mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) == 0.0) {',
        '            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
        '        }',
        '    }',

        '    if (lum < 0.75) {',
        '        if (mod(gl_FragCoord.x - gl_FragCoord.y, 10.0) == 0.0) {',
        '            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
        '        }',
        '    }',

        '    if (lum < 0.50) {',
        '        if (mod(gl_FragCoord.x + gl_FragCoord.y - 5.0, 10.0) == 0.0) {',
        '            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
        '        }',
        '    }',

        '    if (lum < 0.3) {',
        '        if (mod(gl_FragCoord.x - gl_FragCoord.y - 5.0, 10.0) == 0.0) {',
        '            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
        '        }',
        '    }',
        '}'
    ];
}

var proto = CrossHatchFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: CrossHatchFilter}
});

Object.defineProperty(proto, 'blur', {
    get: function() {
        return this.uniforms.blur.value / (1/7000);
    },
    set: function(value) {
        //this.padding = value;
        this.uniforms.blur.value = (1/7000) * value;
    }
});

module.exports = CrossHatchFilter;

},{"./AbstractFilter":15}],22:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * The DisplacementFilter class uses the pixel values from the specified texture (called the displacement map) to perform a displacement of an object.
 * You can use this filter to apply all manor of crazy warping effects
 * Currently the r property of the texture is used offset the x and the g propery of the texture is used to offset the y.
 * @class DisplacementFilter
 * @contructor
 * @param texture {Texture} The texture used for the displacemtent map * must be power of 2 texture at the moment
 */
function DisplacementFilter(texture)
{
    AbstractFilter.call( this );

    this.passes = [this];
    texture.baseTexture._powerOf2 = true;

    // set the uniforms
    //console.log()
    this.uniforms = {
        displacementMap: {type: 'sampler2D', value:texture},
        scale:           {type: '2f', value:{x:30, y:30}},
        offset:          {type: '2f', value:{x:0, y:0}},
        mapDimensions:   {type: '2f', value:{x:1, y:5112}},
        dimensions:   {type: '4fv', value:[0,0,0,0]}
    };

    if(texture.baseTexture.hasLoaded)
    {
        this.uniforms.mapDimensions.value.x = texture.width;
        this.uniforms.mapDimensions.value.y = texture.height;
    }
    else
    {
        this.boundLoadedFunction = this.onTextureLoaded.bind(this);

        texture.baseTexture.on('loaded', this.boundLoadedFunction);
    }

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform sampler2D displacementMap;',
        'uniform sampler2D uSampler;',
        'uniform vec2 scale;',
        'uniform vec2 offset;',
        'uniform vec4 dimensions;',
        'uniform vec2 mapDimensions;',// = vec2(256.0, 256.0);',
        // 'const vec2 textureDimensions = vec2(750.0, 750.0);',

        'void main(void) {',
        '   vec2 mapCords = vTextureCoord.xy;',
        //'   mapCords -= ;',
        '   mapCords += (dimensions.zw + offset)/ dimensions.xy ;',
        '   mapCords.y *= -1.0;',
        '   mapCords.y += 1.0;',
        '   vec2 matSample = texture2D(displacementMap, mapCords).xy;',
        '   matSample -= 0.5;',
        '   matSample *= scale;',
        '   matSample /= mapDimensions;',
        '   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x + matSample.x, vTextureCoord.y + matSample.y));',
        '   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb, 1.0);',
        '   vec2 cord = vTextureCoord;',

        //'   gl_FragColor =  texture2D(displacementMap, cord);',
        '   gl_FragColor = gl_FragColor * vColor;',
        '}'
    ];
}

var proto = DisplacementFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: DisplacementFilter}
});

proto.onTextureLoaded = function()
{
    this.uniforms.mapDimensions.value.x = this.uniforms.displacementMap.value.width;
    this.uniforms.mapDimensions.value.y = this.uniforms.displacementMap.value.height;

    this.uniforms.displacementMap.value.baseTexture.off('loaded', this.boundLoadedFunction);
};

/**
 * The texture used for the displacemtent map * must be power of 2 texture at the moment
 *
 * @property map
 * @type Texture
 */
Object.defineProperty(proto, 'map', {
    get: function() {
        return this.uniforms.displacementMap.value;
    },
    set: function(value) {
        this.uniforms.displacementMap.value = value;
    }
});

/**
 * The multiplier used to scale the displacement result from the map calculation.
 *
 * @property scale
 * @type Point
 */
Object.defineProperty(proto, 'scale', {
    get: function() {
        return this.uniforms.scale.value;
    },
    set: function(value) {
        this.uniforms.scale.value = value;
    }
});

/**
 * The offset used to move the displacement map.
 *
 * @property offset
 * @type Point
 */
Object.defineProperty(proto, 'offset', {
    get: function() {
        return this.uniforms.offset.value;
    },
    set: function(value) {
        this.uniforms.offset.value = value;
    }
});

module.exports = DisplacementFilter;

},{"./AbstractFilter":15}],23:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 * original filter: https://github.com/evanw/glfx.js/blob/master/src/filters/fun/dotscreen.js
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * This filter applies a pixlate effect making display objects appear 'blocky'
 * @class PixelateFilter
 * @contructor
 */
function DotScreenFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        scale: {type: '1f', value:1},
        angle: {type: '1f', value:5},
        dimensions:   {type: '4fv', value:[0,0,0,0]}
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform vec4 dimensions;',
        'uniform sampler2D uSampler;',

        'uniform float angle;',
        'uniform float scale;',

        'float pattern() {',
        '   float s = sin(angle), c = cos(angle);',
        '   vec2 tex = vTextureCoord * dimensions.xy;',
        '   vec2 point = vec2(',
        '       c * tex.x - s * tex.y,',
        '       s * tex.x + c * tex.y',
        '   ) * scale;',
        '   return (sin(point.x) * sin(point.y)) * 4.0;',
        '}',

        'void main() {',
        '   vec4 color = texture2D(uSampler, vTextureCoord);',
        '   float average = (color.r + color.g + color.b) / 3.0;',
        '   gl_FragColor = vec4(vec3(average * 10.0 - 5.0 + pattern()), color.a);',
        '}'
    ];
}

var proto = DotScreenFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: DotScreenFilter}
});

/**
 *
 * This describes the the scale
 * @property scale
 * @type Number
 */
Object.defineProperty(proto, 'scale', {
    get: function() {
        return this.uniforms.scale.value;
    },
    set: function(value) {
        this.dirty = true;
        this.uniforms.scale.value = value;
    }
});

/**
 *
 * This radius describes angle
 * @property angle
 * @type Number
 */
Object.defineProperty(proto, 'angle', {
    get: function() {
        return this.uniforms.angle.value;
    },
    set: function(value) {
        this.dirty = true;
        this.uniforms.angle.value = value;
    }
});

module.exports = DotScreenFilter;

},{"./AbstractFilter":15}],24:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

function FilterBlock()
{
    this.visible = true;
    this.renderable = true;
}

module.exports = FilterBlock;

},{}],25:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * This turns your displayObjects to black and white.
 * @class GrayFilter
 * @contructor
 */
function GrayFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        gray: {type: '1f', value: 1},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform sampler2D uSampler;',
        'uniform float gray;',

        'void main(void) {',
        '   gl_FragColor = texture2D(uSampler, vTextureCoord);',
        '   gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.2126*gl_FragColor.r + 0.7152*gl_FragColor.g + 0.0722*gl_FragColor.b), gray);',
        '   gl_FragColor = gl_FragColor * vColor;',
        '}'
    ];
}

var proto = GrayFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: GrayFilter}
});

/**
The strength of the gray. 1 will make the object black and white, 0 will make the object its normal color
@property gray
*/
Object.defineProperty(proto, 'gray', {
    get: function() {
        return this.uniforms.gray.value;
    },
    set: function(value) {
        this.uniforms.gray.value = value;
    }
});

module.exports = GrayFilter;

},{"./AbstractFilter":15}],26:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * This inverts your displayObjects colors.
 * @class InvertFilter
 * @contructor
 */
function InvertFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        invert: {type: '1f', value: 1},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform float invert;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '   gl_FragColor = texture2D(uSampler, vTextureCoord);',
        '   gl_FragColor.rgb = mix( (vec3(1)-gl_FragColor.rgb) * gl_FragColor.a, gl_FragColor.rgb, 1.0 - invert);',
        //'   gl_FragColor.rgb = gl_FragColor.rgb  * gl_FragColor.a;',
        '   gl_FragColor = gl_FragColor * vColor;',
        '}'
    ];
}

var proto = InvertFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: InvertFilter}
});

/**
The strength of the invert. 1 will fully invert the colors, 0 will make the object its normal color
@property invert
*/
Object.defineProperty(proto, 'invert', {
    get: function() {
        return this.uniforms.invert.value;
    },
    set: function(value) {
        this.uniforms.invert.value = value;
    }
});

module.exports = InvertFilter;

},{"./AbstractFilter":15}],27:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * This filter applies a pixlate effect making display objects appear 'blocky'
 * @class PixelateFilter
 * @contructor
 */
function PixelateFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        invert: {type: '1f', value: 0},
        dimensions: {type: '4fv', value:new Float32Array([10000, 100, 10, 10])},
        pixelSize: {type: '2f', value:{x:10, y:10}},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform vec2 testDim;',
        'uniform vec4 dimensions;',
        'uniform vec2 pixelSize;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '   vec2 coord = vTextureCoord;',

        '   vec2 size = dimensions.xy/pixelSize;',

        '   vec2 color = floor( ( vTextureCoord * size ) ) / size + pixelSize/dimensions.xy * 0.5;',
        '   gl_FragColor = texture2D(uSampler, color);',
        '}'
    ];
}

var proto = PixelateFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: PixelateFilter}
});

/**
 *
 * This a point that describes the size of the blocs. x is the width of the block and y is the the height
 * @property size
 * @type Point
 */
Object.defineProperty(proto, 'size', {
    get: function() {
        return this.uniforms.pixelSize.value;
    },
    set: function(value) {
        this.dirty = true;
        this.uniforms.pixelSize.value = value;
    }
});

module.exports = PixelateFilter;

},{"./AbstractFilter":15}],28:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

function RGBSplitFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        red: {type: '2f', value: {x:20, y:20}},
        green: {type: '2f', value: {x:-20, y:20}},
        blue: {type: '2f', value: {x:20, y:-20}},
        dimensions:   {type: '4fv', value:[0,0,0,0]}
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform vec2 red;',
        'uniform vec2 green;',
        'uniform vec2 blue;',
        'uniform vec4 dimensions;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '   gl_FragColor.r = texture2D(uSampler, vTextureCoord + red/dimensions.xy).r;',
        '   gl_FragColor.g = texture2D(uSampler, vTextureCoord + green/dimensions.xy).g;',
        '   gl_FragColor.b = texture2D(uSampler, vTextureCoord + blue/dimensions.xy).b;',
        '   gl_FragColor.a = texture2D(uSampler, vTextureCoord).a;',
        '}'
    ];
}

var proto = RGBSplitFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: RGBSplitFilter}
});

Object.defineProperty(proto, 'angle', {
    get: function() {
        return this.uniforms.blur.value / (1/7000);
    },
    set: function(value) {
        //this.padding = value;
        this.uniforms.blur.value = (1/7000) * value;
    }
});

module.exports = RGBSplitFilter;

},{"./AbstractFilter":15}],29:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * This applies a sepia effect to your displayObjects.
 * @class SepiaFilter
 * @contructor
 */
function SepiaFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        sepia: {type: '1f', value: 1},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform float sepia;',
        'uniform sampler2D uSampler;',

        'const mat3 sepiaMatrix = mat3(0.3588, 0.7044, 0.1368, 0.2990, 0.5870, 0.1140, 0.2392, 0.4696, 0.0912);',

        'void main(void) {',
        '   gl_FragColor = texture2D(uSampler, vTextureCoord);',
        '   gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * sepiaMatrix, sepia);',
        '   gl_FragColor = gl_FragColor * vColor;',
        '}'
    ];
}

var proto = SepiaFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: SepiaFilter}
});

/**
The strength of the sepia. 1 will apply the full sepia effect, 0 will make the object its normal color
@property sepia
*/
Object.defineProperty(proto, 'sepia', {
    get: function() {
        return this.uniforms.sepia.value;
    },
    set: function(value) {
        this.uniforms.sepia.value = value;
    }
});

module.exports = SepiaFilter;

},{"./AbstractFilter":15}],30:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

function SmartBlurFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        blur: {type: '1f', value: 1/512},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'uniform sampler2D uSampler;',
        //'uniform vec2 delta;',
        'const vec2 delta = vec2(1.0/10.0, 0.0);',
        //'uniform float darkness;',

        'float random(vec3 scale, float seed) {',
        '   return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);',
        '}',


        'void main(void) {',
        '   vec4 color = vec4(0.0);',
        '   float total = 0.0;',

        '   float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);',

        '   for (float t = -30.0; t <= 30.0; t++) {',
        '       float percent = (t + offset - 0.5) / 30.0;',
        '       float weight = 1.0 - abs(percent);',
        '       vec4 sample = texture2D(uSampler, vTextureCoord + delta * percent);',
        '       sample.rgb *= sample.a;',
        '       color += sample * weight;',
        '       total += weight;',
        '   }',

        '   gl_FragColor = color / total;',
        '   gl_FragColor.rgb /= gl_FragColor.a + 0.00001;',
        //'   gl_FragColor.rgb *= darkness;',
        '}'
    ];
}

var proto = SmartBlurFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: SmartBlurFilter}
});

Object.defineProperty(proto, 'blur', {
    get: function() {
        return this.uniforms.blur.value;
    },
    set: function(value) {
        this.uniforms.blur.value = value;
    }
});

module.exports = SmartBlurFilter;

},{"./AbstractFilter":15}],31:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var AbstractFilter = require('./AbstractFilter');

/**
 *
 * This filter applies a pixlate effect making display objects appear 'blocky'
 * @class PixelateFilter
 * @contructor
 */
function TwistFilter()
{
    AbstractFilter.call( this );

    this.passes = [this];

    // set the uniforms
    this.uniforms = {
        radius: {type: '1f', value:0.5},
        angle: {type: '1f', value:5},
        offset: {type: '2f', value:{x:0.5, y:0.5}},
    };

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform vec4 dimensions;',
        'uniform sampler2D uSampler;',

        'uniform float radius;',
        'uniform float angle;',
        'uniform vec2 offset;',

        'void main(void) {',
        '   vec2 coord = vTextureCoord - offset;',
        '   float distance = length(coord);',

        '   if (distance < radius) {',
        '       float ratio = (radius - distance) / radius;',
        '       float angleMod = ratio * ratio * angle;',
        '       float s = sin(angleMod);',
        '       float c = cos(angleMod);',
        '       coord = vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c);',
        '   }',

        '   gl_FragColor = texture2D(uSampler, coord+offset);',
        '}'
    ];
}

var proto = TwistFilter.prototype = Object.create(AbstractFilter.prototype, {
    constructor: {value: TwistFilter}
});

/**
 *
 * This point describes the the offset of the twist
 * @property size
 * @type Point
 */
Object.defineProperty(proto, 'offset', {
    get: function() {
        return this.uniforms.offset.value;
    },
    set: function(value) {
        this.dirty = true;
        this.uniforms.offset.value = value;
    }
});

/**
 *
 * This radius describes size of the twist
 * @property size
 * @type Number
 */
Object.defineProperty(proto, 'radius', {
    get: function() {
        return this.uniforms.radius.value;
    },
    set: function(value) {
        this.dirty = true;
        this.uniforms.radius.value = value;
    }
});

/**
 *
 * This radius describes angle of the twist
 * @property angle
 * @type Number
 */
Object.defineProperty(proto, 'angle', {
    get: function() {
        return this.uniforms.angle.value;
    },
    set: function(value) {
        this.dirty = true;
        this.uniforms.angle.value = value;
    }
});

module.exports = TwistFilter;

},{"./AbstractFilter":15}],32:[function(require,module,exports){
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

},{}],33:[function(require,module,exports){
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

},{"./Rectangle":36}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
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
            intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if(intersect) inside = !inside;
    }

    return inside;
};

module.exports = Polygon;

},{"./Point":34}],36:[function(require,module,exports){
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

},{}],37:[function(require,module,exports){
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
};

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

},{}],38:[function(require,module,exports){
/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

var globals  = require('./core/globals');
var shaders  = require('./renderers/webgl/shaders');
var matrix   = require('./geom/matrix');

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

pixi.AbstractFilter     = require('./filters/AbstractFilter');
pixi.BlurFilter         = require('./filters/BlurFilter');
pixi.BlurXFilter        = require('./filters/BlurXFilter');
pixi.BlurYFilter        = require('./filters/BlurYFilter');
pixi.ColorMatrixFilter  = require('./filters/ColorMatrixFilter');
pixi.ColorStepFilter    = require('./filters/ColorStepFilter');
pixi.CrossHatchFilter   = require('./filters/CrossHatchFilter');
pixi.DisplacementFilter = require('./filters/DisplacementFilter');
pixi.DotScreenFilter    = require('./filters/DotScreenFilter');
pixi.FilterBlock        = require('./filters/FilterBlock');
pixi.GrayFilter         = require('./filters/GrayFilter');
pixi.InvertFilter       = require('./filters/InvertFilter');
pixi.PixelateFilter     = require('./filters/PixelateFilter');
pixi.RGBSplitFilter     = require('./filters/RGBSplitFilter');
pixi.SepiaFilter        = require('./filters/SepiaFilter');
pixi.SmartBlurFilter    = require('./filters/SmartBlurFilter');
pixi.TwistFilter        = require('./filters/TwistFilter');

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

pixi.initDefaultShaders        = shaders.initDefaultShaders;
pixi.activatePrimitiveShader   = shaders.activatePrimitiveShader;
pixi.deactivatePrimitiveShader = shaders.deactivatePrimitiveShader;
pixi.activateStripShader       = shaders.activateStripShader;
pixi.deactivateStripShader     = shaders.deactivateStripShader;

// DEBUGGING ONLY
// TODO: preprocess macros
var debug  = require('./utils/debug');
pixi.runList = debug.runList;

},{"./InteractionManager":1,"./core/globals":2,"./display/DisplayObject":3,"./display/DisplayObjectContainer":4,"./display/MovieClip":5,"./display/Sprite":6,"./display/Stage":7,"./display/blendModes":8,"./events/EventTarget":9,"./extras/CustomRenderable":10,"./extras/Rope":11,"./extras/Spine":12,"./extras/Strip":13,"./extras/TilingSprite":14,"./filters/AbstractFilter":15,"./filters/BlurFilter":16,"./filters/BlurXFilter":17,"./filters/BlurYFilter":18,"./filters/ColorMatrixFilter":19,"./filters/ColorStepFilter":20,"./filters/CrossHatchFilter":21,"./filters/DisplacementFilter":22,"./filters/DotScreenFilter":23,"./filters/FilterBlock":24,"./filters/GrayFilter":25,"./filters/InvertFilter":26,"./filters/PixelateFilter":27,"./filters/RGBSplitFilter":28,"./filters/SepiaFilter":29,"./filters/SmartBlurFilter":30,"./filters/TwistFilter":31,"./geom/Circle":32,"./geom/Ellipse":33,"./geom/Point":34,"./geom/Polygon":35,"./geom/Rectangle":36,"./geom/matrix":37,"./loaders/AssetLoader":39,"./loaders/BitmapFontLoader":40,"./loaders/ImageLoader":41,"./loaders/JsonLoader":42,"./loaders/SpineLoader":43,"./loaders/SpriteSheetLoader":44,"./primitives/Graphics":46,"./renderers/canvas/CanvasRenderer":47,"./renderers/canvas/graphics":48,"./renderers/webgl/WebGLBatch":52,"./renderers/webgl/WebGLRenderGroup":54,"./renderers/webgl/WebGLRenderer":55,"./renderers/webgl/graphics":57,"./renderers/webgl/shaders":58,"./text/BitmapText":59,"./text/Text":60,"./textures/BaseTexture":61,"./textures/RenderTexture":62,"./textures/Texture":63,"./utils/Polyk":64,"./utils/autoDetectRenderer":65,"./utils/debug":67}],39:[function(require,module,exports){
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

function getDataType(str)
{
    var test = 'data:';
    //starts with 'data:'
    var start = str.slice(0, test.length).toLowerCase();
    if (start === test) {
        var data = str.slice(test.length);

        var sepIdx = data.indexOf(',');
        if (sepIdx === -1) //malformed data URI scheme
            return null;

        //e.g. 'image/gif;base64' => 'image/gif'
        var info = data.slice(0, sepIdx).split(';')[0];

        //We might need to handle some special cases here...
        //standardize text/plain to 'txt' file extension
        if (!info || info.toLowerCase() === 'text/plain')
            return 'txt';

        //User specified mime type, try splitting it by '/'
        return info.split('/').pop().toLowerCase();
    }

    return null;
}

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
 *      supported. Supported image formats include 'jpeg', 'jpg', 'png', 'gif'. Supported
 *      sprite sheet data formats only include 'JSON' at this time. Supported bitmap font
 *      data formats include 'xml' and 'fnt'.
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
        //first see if we have a data URI scheme..
        var fileType = getDataType(fileName);

        //if not, assume it's a file URI
        if (!fileType)
            fileType = fileName.split('?').shift().split('.').pop().toLowerCase();

        var Constructor = loadersByType[fileType];
        if(!Constructor)
            throw new Error(fileType + ' is an unsupported file type');

        var loader = new Constructor(fileName, this.crossorigin);

        loader.addEventListener('loaded', onLoad);
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
    this.dispatchEvent({type: 'onProgress', content: this});
    if (this.onProgress) this.onProgress();

    if (!this.loadCount)
    {
        this.dispatchEvent({type: 'onComplete', content: this});
        if(this.onComplete) this.onComplete();
    }
};

AssetLoader.registerLoaderType = function registerLoaderType(type, constructor)
{
    loadersByType[type] = constructor;
};

module.exports = AssetLoader;

},{"../events/EventTarget":9}],40:[function(require,module,exports){
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
 * The xml loader is used to load in XML bitmap font data ('xml' or 'fnt')
 * To generate the data you can use http://www.angelcode.com/products/bmfont/
 * This loader will also load the image file as the data.
 * When loaded this class will dispatch a 'loaded' event
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
     * make sure to set the format as 'JSON'
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
    this.baseUrl = url.replace(/[^\/]*$/, '');

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
        this.onXMLLoaded();
        break;
    default:
        this.onError();
        break;
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

    this.request.open('GET', this.url, true);
    if (this.request.overrideMimeType) this.request.overrideMimeType('application/xml');
    this.request.send(null);
};

/**
 * Invoked when XML file is loaded, parses the data
 *
 * @method onXMLLoaded
 * @private
 */
proto.onXMLLoaded = function onXMLLoaded()
{
    var textureUrl = this.baseUrl + this.request.responseXML.getElementsByTagName('page')[0].attributes.getNamedItem('file').nodeValue;
    var image = new ImageLoader(textureUrl, this.crossorigin);
    this.texture = image.texture.baseTexture;

    var data = {};
    var info = this.request.responseXML.getElementsByTagName('info')[0];
    var common = this.request.responseXML.getElementsByTagName('common')[0];
    data.font = info.attributes.getNamedItem('face').nodeValue;
    data.size = parseInt(info.attributes.getNamedItem('size').nodeValue, 10);
    data.lineHeight = parseInt(common.attributes.getNamedItem('lineHeight').nodeValue, 10);
    data.chars = {};

    //parse letters
    var letters = this.request.responseXML.getElementsByTagName('char');

    for (var i = 0; i < letters.length; i++)
    {
        var charCode = parseInt(letters[i].attributes.getNamedItem('id').nodeValue, 10);

        var textureRect = new Rectangle(
            parseInt(letters[i].attributes.getNamedItem('x').nodeValue, 10),
            parseInt(letters[i].attributes.getNamedItem('y').nodeValue, 10),
            parseInt(letters[i].attributes.getNamedItem('width').nodeValue, 10),
            parseInt(letters[i].attributes.getNamedItem('height').nodeValue, 10)
        );

        data.chars[charCode] = {
            xOffset: parseInt(letters[i].attributes.getNamedItem('xoffset').nodeValue, 10),
            yOffset: parseInt(letters[i].attributes.getNamedItem('yoffset').nodeValue, 10),
            xAdvance: parseInt(letters[i].attributes.getNamedItem('xadvance').nodeValue, 10),
            kerning: {},
            texture: Texture.cache[charCode] = new Texture(this.texture, textureRect)

        };
    }

    //parse kernings
    var kernings = this.request.responseXML.getElementsByTagName('kerning');
    for (i = 0; i < kernings.length; i++)
    {
        var first = parseInt(kernings[i].attributes.getNamedItem('first').nodeValue, 10);
        var second = parseInt(kernings[i].attributes.getNamedItem('second').nodeValue, 10);
        var amount = parseInt(kernings[i].attributes.getNamedItem('amount').nodeValue, 10);

        data.chars[second].kerning[first] = amount;

    }

    BitmapText.fonts[data.font] = data;

    var scope = this;
    image.addEventListener('loaded', function() {
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
    this.dispatchEvent({type: 'loaded', content: this});
};

/**
 * Invoke when error occured
 *
 * @method onError
 * @private
 */
proto.onError = function onError()
{
    this.dispatchEvent({type: 'error', content: this});
};

AssetLoader.registerLoaderType('xml', BitmapFontLoader);
AssetLoader.registerLoaderType('fnt', BitmapFontLoader);

module.exports = BitmapFontLoader;

},{"../events/EventTarget":9,"../geom/Rectangle":36,"../platform":45,"../text/BitmapText":59,"../textures/Texture":63,"./AssetLoader":39,"./ImageLoader":41}],41:[function(require,module,exports){
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
        this.texture.baseTexture.addEventListener('loaded', function()
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
    this.dispatchEvent({type: 'loaded', content: this});
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
            if (textureName) Texture.cache[textureName + '-' + i] = texture;
        }
    }

    if(!this.texture.baseTexture.hasLoaded)
    {
        var scope = this;
        this.texture.baseTexture.addEventListener('loaded', function() {
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

},{"../events/EventTarget":9,"../textures/Texture":63,"./AssetLoader":39}],42:[function(require,module,exports){
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
 * When loaded this class will dispatch a 'loaded' event
 * If load failed this class will dispatch a 'error' event
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
    this.baseUrl = url.replace(/[^\/]*$/, '');

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

proto.handleEvent = function handleEvent(event)
{
    switch (event.type) {
    case 'load':
        this.onJSONLoaded();
        break;
    default:
        this.onError();
        break;
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

    this.request.open('GET', this.url, true);
    if (this.request.overrideMimeType) this.request.overrideMimeType('application/json');
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
        image.addEventListener('loaded', function() {
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
    this.dispatchEvent({type: 'loaded', content: this});
};

/**
 * Invoke when error occured
 *
 * @method onError
 * @private
 */
proto.onError = function onError()
{
    this.dispatchEvent({type: 'error', content: this});
};

AssetLoader.registerLoaderType('json', JsonLoader);

module.exports = JsonLoader;

},{"../events/EventTarget":9,"../extras/Spine":12,"../platform":45,"../textures/Texture":63,"../utils/spine":69,"./AssetLoader":39,"./ImageLoader":41}],43:[function(require,module,exports){
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
    jsonLoader.addEventListener('loaded', function (event) {
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
    this.dispatchEvent({type: 'loaded', content: this});
};

AssetLoader.registerLoaderType('anim', SpineLoader);

module.exports = SpineLoader;


},{"../events/EventTarget":9,"../extras/Spine":12,"../utils/spine":69,"./AssetLoader":39,"./JsonLoader":42}],44:[function(require,module,exports){
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
 * To generate the data you can use http://www.codeandweb.com/texturepacker and publish the 'JSON' format
 * There is a free version so thats nice, although the paid version is great value for money.
 * It is highly recommended to use Sprite sheets (also know as texture atlas') as it means sprite's can be batched and drawn together for highly increased rendering speed.
 * Once the data has been loaded the frames are stored in the texture cache and can be accessed though Texture.fromFrameId() and Sprite.fromFromeId()
 * This loader will also load the image file that the Spritesheet points to as well as the data.
 * When loaded this class will dispatch a 'loaded' event
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
     * make sure to set the format as 'JSON'
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
    this.baseUrl = url.replace(/[^\/]*$/, '');

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
    jsonLoader.addEventListener('loaded', function (event) {
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
    image.addEventListener('loaded', function () {
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
        type: 'loaded',
        content: this
    });
};

module.exports = SpriteSheetLoader;

},{"../events/EventTarget":9,"../textures/Texture":63,"./ImageLoader":41,"./JsonLoader":42}],45:[function(require,module,exports){
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

},{}],46:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var DisplayObjectContainer = require('../display/DisplayObjectContainer');
var Rectangle = require('../geom/Rectangle');

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
    this.lineColor = 'black';

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
 * Draws an ellipse.
 *
 * @method drawEllipse
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

    this.bounds = null; //new Rectangle();
};


proto.updateFilterBounds = function updateFilterBounds()
{
    if(!this.bounds)
    {
        var minX = Infinity;
        var maxX = -Infinity;

        var minY = Infinity;
        var maxY = -Infinity;

        var points, x, y;

        for (var i = 0; i < this.graphicsData.length; i++) {
            var data = this.graphicsData[i];
            var type = data.type;
            var lineWidth = data.lineWidth;

            points = data.points;

            if(type === Graphics.RECT)
            {
                x = points.x - lineWidth/2;
                y = points.y - lineWidth/2;
                var width = points.width + lineWidth;
                var height = points.height + lineWidth;

                minX = x < minX ? x : minX;
                maxX = x + width > maxX ? x + width : maxX;

                minY = y < minY ? x : minY;
                maxY = y + height > maxY ? y + height : maxY;
            }
            else if(type === Graphics.CIRC || type === Graphics.ELIP)
            {
                x = points.x;
                y = points.y;
                var radius = points.radius + lineWidth/2;

                minX = x - radius < minX ? x - radius : minX;
                maxX = x + radius > maxX ? x + radius : maxX;

                minY = y - radius < minY ? y - radius : minY;
                maxY = y + radius > maxY ? y + radius : maxY;
            }
            else
            {
                // POLY
                for (var j = 0; j < points.length; j+=2)
                {

                    x = points[j];
                    y = points[j+1];

                    minX = x-lineWidth < minX ? x-lineWidth : minX;
                    maxX = x+lineWidth > maxX ? x+lineWidth : maxX;

                    minY = y-lineWidth < minY ? y-lineWidth : minY;
                    maxY = y+lineWidth > maxY ? y+lineWidth : maxY;
                }
            }
        }

        this.bounds = new Rectangle(minX, minY, maxX - minX, maxY - minY);
    }
//  console.log(this.bounds);
};

// SOME TYPES:
Graphics.POLY = 0;
Graphics.RECT = 1;
Graphics.CIRC = 2;
Graphics.ELIP = 3;

module.exports = Graphics;

},{"../display/DisplayObjectContainer":4,"../geom/Rectangle":36}],47:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var platform = require('../../platform');
var globals = require('../../core/globals');

var canvasGraphics = require('./graphics');
var BaseTexture = require('../../textures/BaseTexture');
var Texture = require('../../textures/Texture');

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
    this.context = this.view.getContext( '2d' );

    //some filter variables
    this.smoothProperty = null;

    if('imageSmoothingEnabled' in this.context)
        this.smoothProperty = 'imageSmoothingEnabled';
    else if('webkitImageSmoothingEnabled' in this.context)
        this.smoothProperty = 'webkitImageSmoothingEnabled';
    else if('mozImageSmoothingEnabled' in this.context)
        this.smoothProperty = 'mozImageSmoothingEnabled';
    else if('oImageSmoothingEnabled' in this.context)
        this.smoothProperty = 'oImageSmoothingEnabled';

    this.scaleMode = null;

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
    if(this.view.style.backgroundColor !== stage.backgroundColorString && !this.transparent)
        this.view.style.backgroundColor = stage.backgroundColorString;

    this.context.setTransform(1,0,0,1,0,0);
    this.context.clearRect(0, 0, this.width, this.height);
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
    if(Texture.frameUpdates.length > 0)
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

            //ignore null sources
            if(frame && frame.width && frame.height && displayObject.texture.baseTexture.source)
            {
                context.globalAlpha = displayObject.worldAlpha;

                context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5]);

                //if smoothingEnabled is supported and we need to change the smoothing property for this texture
                if(this.smoothProperty && this.scaleMode !== displayObject.texture.baseTexture.scaleMode) {
                    this.scaleMode = displayObject.texture.baseTexture.scaleMode;
                    context[this.smoothProperty] = (this.scaleMode === BaseTexture.SCALE_MODE.LINEAR);
                }

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
            context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5]);
            this.renderStrip(displayObject);
        }
        else if(displayObject instanceof TilingSprite)
        {
            context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5]);
            this.renderTilingSprite(displayObject);
        }
        else if(displayObject instanceof CustomRenderable)
        {
            context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5]);
            displayObject.renderCanvas(this);
        }
        else if(displayObject instanceof Graphics)
        {
            context.setTransform(transform[0], transform[3], transform[1], transform[4], transform[2], transform[5]);
            canvasGraphics.renderGraphics(displayObject, context);
        }
        else if(displayObject instanceof FilterBlock)
        {
            if(displayObject.data instanceof Graphics)
            {
                var mask = displayObject.data;

                if(displayObject.open)
                {
                    context.save();

                    var cacheAlpha = mask.alpha;
                    var maskTransform = mask.worldTransform;

                    context.setTransform(maskTransform[0], maskTransform[3], maskTransform[1], maskTransform[4], maskTransform[2], maskTransform[5]);

                    mask.worldAlpha = 0.5;

                    context.worldAlpha = 0;

                    canvasGraphics.renderGraphicsMask(mask, context);
                    context.clip();

                    mask.worldAlpha = cacheAlpha;
                }
                else
                {
                    context.restore();
                }
            }
        }
        //count++
        displayObject = displayObject._iNext;
    }
    while(displayObject !== testObject);
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

    context.fillStyle = '#FF0000';
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

    if(!sprite.__tilePattern)
        sprite.__tilePattern = context.createPattern(sprite.texture.baseTexture.source, 'repeat');

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

    for (var i = 1; i < length-2; i++)
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
        var deltaA = x0*v1 + v0*x2 + x1*v2 - v1*x2 - v0*x1 - x0*v2;
        var deltaB = u0*x1 + x0*u2 + u1*x2 - x1*u2 - x0*u1 - u0*x2;
        var deltaC = u0*v1*x2 + v0*x1*u2 + x0*u1*v2 - x0*v1*u2 - v0*u1*x2 - u0*x1*v2;
        var deltaD = y0*v1 + v0*y2 + y1*v2 - v1*y2 - v0*y1 - y0*v2;
        var deltaE = u0*y1 + y0*u2 + u1*y2 - y1*u2 - y0*u1 - u0*y2;
        var deltaF = u0*v1*y2 + v0*y1*u2 + y0*u1*v2 - y0*v1*u2 - v0*u1*y2 - u0*y1*v2;

        context.transform(deltaA / delta, deltaD / delta,
                            deltaB / delta, deltaE / delta,
                            deltaC / delta, deltaF / delta);

        context.drawImage(strip.texture.baseTexture.source, 0, 0);
        context.restore();
    }
};

module.exports = CanvasRenderer;

},{"../../core/globals":2,"../../display/Sprite":6,"../../extras/CustomRenderable":10,"../../extras/Strip":13,"../../extras/TilingSprite":14,"../../filters/FilterBlock":24,"../../platform":45,"../../primitives/Graphics":46,"../../textures/BaseTexture":61,"../../textures/Texture":63,"./graphics":48}],48:[function(require,module,exports){
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
        color = '',
        data, points, ii, ll;

    for (var i = 0, l = graphics.graphicsData.length; i < l; i++)
    {
        data = graphics.graphicsData[i];
        points = data.points;

        color = context.strokeStyle = '#' + ('00000' + ( data.lineColor | 0).toString(16)).substr(-6);

        context.lineWidth = data.lineWidth;

        if(data.type === Graphics.POLY)
        {
            context.beginPath();

            context.moveTo(points[0], points[1]);

            for (ii = 1, ll = points.length / 2; ii < ll; ii++)
            {
                context.lineTo(points[ii * 2], points[ii * 2 + 1]);
            }

            // if the first and last point are the same close the path - much neater :)
            if(points[0] === points[points.length-2] && points[1] === points[points.length-1])
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
        else if(data.type === Graphics.RECT)
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
        else if(data.type === Graphics.CIRC)
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
        else if(data.type === Graphics.ELIP)
        {

            // ellipse code taken from: http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas

            var ellipseData =  data.points;

            var w = ellipseData[2] * 2;
            var h = ellipseData[3] * 2;

            var x = ellipseData[0] - w/2;
            var y = ellipseData[1] - h/2;

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
    var len = graphics.graphicsData.length;

    if(len === 0) return;

    if(len > 1)
    {
        len = 1;
        platform.console.warn('Pixi.js warning: masks in canvas can only mask using the first path in the graphics object');
    }

    for (var i = 0; i < 1; i++)
    {
        var data = graphics.graphicsData[i];
        var points = data.points;

        if(data.type === Graphics.POLY)
        {
            context.beginPath();
            context.moveTo(points[0], points[1]);

            for (var j=1; j < points.length/2; j++)
            {
                context.lineTo(points[j * 2], points[j * 2 + 1]);
            }

            // if the first and last point are the same close the path - much neater :)
            if(points[0] === points[points.length-2] && points[1] === points[points.length-1])
            {
                context.closePath();
            }

        }
        else if(data.type === Graphics.RECT)
        {
            context.beginPath();
            context.rect(points[0], points[1], points[2], points[3]);
            context.closePath();
        }
        else if(data.type === Graphics.CIRC)
        {
            // TODO - need to be Undefined!
            context.beginPath();
            context.arc(points[0], points[1], points[2],0,2*Math.PI);
            context.closePath();
        }
        else if(data.type === Graphics.ELIP)
        {

            // ellipse code taken from: http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas
            var ellipseData =  data.points;

            var w = ellipseData[2] * 2;
            var h = ellipseData[3] * 2;

            var x = ellipseData[0] - w/2;
            var y = ellipseData[1] - h/2;

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

},{"../../platform":45,"../../primitives/Graphics":46}],49:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 * @author Richard Davey http://www.photonstorm.com @photonstorm
 */
'use strict';

var compile = require('./compile');
var globals = require('../../core/globals');

/**
 * @constructor
 */
function PixiShader()
{
    /**
    * @property {any} program - The WebGL program.
    */
    this.program = null;

    /**
    * @property {array} fragmentSrc - The fragment shader.
    */
    this.fragmentSrc = [
        'precision lowp float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform sampler2D uSampler;',
        'void main(void) {',
        '   gl_FragColor = texture2D(uSampler, vTextureCoord) * vColor;',
        '}'
    ];

    /**
    * @property {number} textureCount - A local texture counter for multi-texture shaders.
    */
    this.textureCount = 0;
}

var proto = PixiShader.prototype;

proto.init = function init()
{
    var gl = globals.gl;
    var program = compile.program(gl, this.vertexSrc || PixiShader.defaultVertexSrc, this.fragmentSrc);

    gl.useProgram(program);

    // get and store the uniforms for the shader
    this.uSampler = gl.getUniformLocation(program, 'uSampler');
    this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
    this.offsetVector = gl.getUniformLocation(program, 'offsetVector');
    this.dimensions = gl.getUniformLocation(program, 'dimensions');

    // get and store the attributes
    this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    this.colorAttribute = gl.getAttribLocation(program, 'aColor');
    this.aTextureCoord = gl.getAttribLocation(program, 'aTextureCoord');

    // add those custom shaders!
    for (var key in this.uniforms)
    {
        // get the uniform locations..
        this.uniforms[key].uniformLocation = gl.getUniformLocation(program, key);
    }

    this.initUniforms();

    this.program = program;
};

/**
 * Initialises the shader uniform values.
 * Uniforms are specified in the GLSL_ES Specification: http://www.khronos.org/registry/webgl/specs/latest/1.0/
 * http://www.khronos.org/registry/gles/specs/2.0/GLSL_ES_Specification_1.0.17.pdf
 */
proto.initUniforms = function initUniforms()
{
    this.textureCount = 1;

    var uniform;

    for (var key in this.uniforms)
    {
        uniform = this.uniforms[key];

        var type = uniform.type;

        if (type === 'sampler2D')
        {
            uniform._init = false;

            if (uniform.value !== null)
            {
                this.initSampler2D(uniform);
            }
        }
        else if (type === 'mat2' || type === 'mat3' || type === 'mat4')
        {
            //  These require special handling
            uniform.glMatrix = true;
            uniform.glValueLength = 1;

            if (type === 'mat2')
            {
                uniform.glFunc = globals.gl.uniformMatrix2fv;
            }
            else if (type === 'mat3')
            {
                uniform.glFunc = globals.gl.uniformMatrix3fv;
            }
            else if (type === 'mat4')
            {
                uniform.glFunc = globals.gl.uniformMatrix4fv;
            }
        }
        else
        {
            //  GL function reference
            uniform.glFunc = globals.gl['uniform' + type];

            if (type === '2f' || type === '2i')
            {
                uniform.glValueLength = 2;
            }
            else if (type === '3f' || type === '3i')
            {
                uniform.glValueLength = 3;
            }
            else if (type === '4f' || type === '4i')
            {
                uniform.glValueLength = 4;
            }
            else
            {
                uniform.glValueLength = 1;
            }
        }
    }

};

/**
 * Initialises a Sampler2D uniform
 * (which may only be available later on after initUniforms once the texture is has loaded)
 */
proto.initSampler2D = function initSampler2D(uniform)
{
    if (!uniform.value || !uniform.value.baseTexture || !uniform.value.baseTexture.hasLoaded)
    {
        return;
    }

    globals.gl.activeTexture(globals.gl['TEXTURE' + this.textureCount]);
    globals.gl.bindTexture(globals.gl.TEXTURE_2D, uniform.value.baseTexture._glTexture);

    //  Extended texture data
    if (uniform.textureData)
    {
        var data = uniform.textureData;

        // GLTexture = mag linear, min linear_mipmap_linear, wrap repeat + gl.generateMipmap(gl.TEXTURE_2D);
        // GLTextureLinear = mag/min linear, wrap clamp
        // GLTextureNearestRepeat = mag/min NEAREST, wrap repeat
        // GLTextureNearest = mag/min nearest, wrap clamp
        // AudioTexture = whatever + luminance + width 512, height 2, border 0
        // KeyTexture = whatever + luminance + width 256, height 2, border 0

        //  magFilter can be: gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR or gl.NEAREST
        //  wrapS/T can be: gl.CLAMP_TO_EDGE or gl.REPEAT

        var magFilter = (data.magFilter) ? data.magFilter : globals.gl.LINEAR;
        var minFilter = (data.minFilter) ? data.minFilter : globals.gl.LINEAR;
        var wrapS = (data.wrapS) ? data.wrapS : globals.gl.CLAMP_TO_EDGE;
        var wrapT = (data.wrapT) ? data.wrapT : globals.gl.CLAMP_TO_EDGE;
        var format = (data.luminance) ? globals.gl.LUMINANCE : globals.gl.RGBA;

        if (data.repeat)
        {
            wrapS = globals.gl.REPEAT;
            wrapT = globals.gl.REPEAT;
        }

        globals.gl.pixelStorei(globals.gl.UNPACK_FLIP_Y_WEBGL, false);

        if (data.width)
        {
            var width = (data.width) ? data.width : 512;
            var height = (data.height) ? data.height : 2;
            var border = (data.border) ? data.border : 0;

            // void texImage2D(GLenum target, GLint level, GLenum internalformat, GLsizei width, GLsizei height, GLint border, GLenum format, GLenum type, ArrayBufferView? pixels);
            globals.gl.texImage2D(globals.gl.TEXTURE_2D, 0, format, width, height, border, format, globals.gl.UNSIGNED_BYTE, null);
        }
        else
        {
            //  void texImage2D(GLenum target, GLint level, GLenum internalformat, GLenum format, GLenum type, ImageData? pixels);
            globals.gl.texImage2D(globals.gl.TEXTURE_2D, 0, format, globals.gl.RGBA, globals.gl.UNSIGNED_BYTE, uniform.value.baseTexture.source);
        }

        globals.gl.texParameteri(globals.gl.TEXTURE_2D, globals.gl.TEXTURE_MAG_FILTER, magFilter);
        globals.gl.texParameteri(globals.gl.TEXTURE_2D, globals.gl.TEXTURE_MIN_FILTER, minFilter);
        globals.gl.texParameteri(globals.gl.TEXTURE_2D, globals.gl.TEXTURE_WRAP_S, wrapS);
        globals.gl.texParameteri(globals.gl.TEXTURE_2D, globals.gl.TEXTURE_WRAP_T, wrapT);
    }

    globals.gl.uniform1i(uniform.uniformLocation, this.textureCount);

    uniform._init = true;

    this.textureCount++;

};

/**
 * Updates the shader uniform values.
 */
proto.syncUniforms = function syncUniforms()
{
    this.textureCount = 1;
    var uniform;

    //  This would probably be faster in an array and it would guarantee key order
    for (var key in this.uniforms)
    {

        uniform = this.uniforms[key];

        if (uniform.glValueLength === 1)
        {
            if (uniform.glMatrix === true)
            {
                uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.transpose, uniform.value);
            }
            else
            {
                uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.value);
            }
        }
        else if (uniform.glValueLength === 2)
        {
            uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.value.x, uniform.value.y);
        }
        else if (uniform.glValueLength === 3)
        {
            uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.value.x, uniform.value.y, uniform.value.z);
        }
        else if (uniform.glValueLength === 4)
        {
            uniform.glFunc.call(globals.gl, uniform.uniformLocation, uniform.value.x, uniform.value.y, uniform.value.z, uniform.value.w);
        }
        else if (uniform.type === 'sampler2D')
        {
            if (uniform._init)
            {
                globals.gl.activeTexture(globals.gl['TEXTURE' + this.textureCount]);
                globals.gl.bindTexture(globals.gl.TEXTURE_2D, uniform.value.baseTexture._glTexture);
                globals.gl.uniform1i(uniform.uniformLocation, this.textureCount);
                this.textureCount++;
            }
            else
            {
                this.initSampler2D(uniform);
            }
        }
    }

};

PixiShader.defaultVertexSrc = [
    'attribute vec2 aVertexPosition;',
    'attribute vec2 aTextureCoord;',
    'attribute float aColor;',

    'uniform vec2 projectionVector;',
    'uniform vec2 offsetVector;',
    'varying vec2 vTextureCoord;',

    'varying float vColor;',

    'const vec2 center = vec2(-1.0, 1.0);',

    'void main(void) {',
    '   gl_Position = vec4( ((aVertexPosition + offsetVector) / projectionVector) + center , 0.0, 1.0);',
    '   vTextureCoord = aTextureCoord;',
    '   vColor = aColor;',
    '}'
];

module.exports = PixiShader;

},{"../../core/globals":2,"./compile":56}],50:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var compile = require('./compile');
var globals = require('../../core/globals');

function PrimitiveShader()
{
    // the webGL program..
    this.program = null;

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec4 vColor;',

        'void main(void) {',
        '   gl_FragColor = vColor;',
        '}'
    ];

    this.vertexSrc  = [
        'attribute vec2 aVertexPosition;',
        'attribute vec4 aColor;',
        'uniform mat3 translationMatrix;',
        'uniform vec2 projectionVector;',
        'uniform vec2 offsetVector;',
        'uniform float alpha;',
        'varying vec4 vColor;',

        'void main(void) {',
        '   vec3 v = translationMatrix * vec3(aVertexPosition , 1.0);',
        '   v -= offsetVector.xyx;',
        '   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / -projectionVector.y + 1.0 , 0.0, 1.0);',
        '   vColor = aColor  * alpha;',
        '}'
    ];
}

PrimitiveShader.prototype.init = function init()
{
    var gl = globals.gl;
    var program = compile.program(gl, this.vertexSrc, this.fragmentSrc);

    gl.useProgram(program);

    // get and store the uniforms for the shader
    this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
    this.offsetVector = gl.getUniformLocation(program, 'offsetVector');

    // get and store the attributes
    this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    this.colorAttribute = gl.getAttribLocation(program, 'aColor');

    this.translationMatrix = gl.getUniformLocation(program, 'translationMatrix');
    this.alpha = gl.getUniformLocation(program, 'alpha');

    this.program = program;
};

module.exports = PrimitiveShader;

},{"../../core/globals":2,"./compile":56}],51:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var compile = require('./compile');
var globals = require('../../core/globals');

function StripShader()
{
    // the webGL program..
    this.program = null;

    this.fragmentSrc = [
        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying float vColor;',
        'uniform float alpha;',
        'uniform sampler2D uSampler;',

        'void main(void) {',
        '   gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.x, vTextureCoord.y));',
        '   gl_FragColor = gl_FragColor * alpha;',
        '}'
    ];

    this.vertexSrc = [
        'attribute vec2 aVertexPosition;',
        'attribute vec2 aTextureCoord;',
        'attribute float aColor;',
        'uniform mat3 translationMatrix;',
        'uniform vec2 projectionVector;',
        'varying vec2 vTextureCoord;',
        'varying vec2 offsetVector;',
        'varying float vColor;',

        'void main(void) {',
        '   vec3 v = translationMatrix * vec3(aVertexPosition, 1.0);',
        '   v -= offsetVector.xyx;',
        '   gl_Position = vec4( v.x / projectionVector.x -1.0, v.y / projectionVector.y + 1.0 , 0.0, 1.0);',
        '   vTextureCoord = aTextureCoord;',
        '   vColor = aColor;',
        '}'
    ];
}

StripShader.prototype.init = function init()
{
    var gl = globals.gl;
    var program = compile.program(gl, this.vertexSrc, this.fragmentSrc);

    gl.useProgram(program);

    // get and store the uniforms for the shader
    this.uSampler = gl.getUniformLocation(program, 'uSampler');
    this.projectionVector = gl.getUniformLocation(program, 'projectionVector');
    this.offsetVector = gl.getUniformLocation(program, 'offsetVector');
    this.colorAttribute = gl.getAttribLocation(program, 'aColor');
    //this.dimensions = gl.getUniformLocation(this.program, 'dimensions');

    // get and store the attributes
    this.aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    this.aTextureCoord = gl.getAttribLocation(program, 'aTextureCoord');

    this.translationMatrix = gl.getUniformLocation(program, 'translationMatrix');
    this.alpha = gl.getUniformLocation(program, 'alpha');

    this.program = program;
};

module.exports = StripShader;

},{"../../core/globals":2,"./compile":56}],52:[function(require,module,exports){
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
    this.last = null;
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
        this.tail = sprite;
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
        this.tail.__next = null;
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
    if( this.size === 1)
    {
        this.dynamicSize = 1;
    }
    else
    {
        this.dynamicSize = this.size * 1.5;
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
    if (this.dynamicSize < this.size)
    {
        this.growBatch();
    }

    var indexRun = 0;
    var index, colorIndex;

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

        indexRun++;
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
    var worldTransform, width, height, aX, aY, w0, w1, h0, h1, index;

    var a, b, c, d, tx, ty;

    var indexRun = 0;

    var displayObject = this.head;
    var verticies = this.verticies;
    var uvs = this.uvs;
    var colors = this.colors;

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

            verticies[index + 0 ] = a * w1 + c * h1 + tx;
            verticies[index + 1 ] = d * h1 + b * w1 + ty;

            verticies[index + 2 ] = a * w0 + c * h1 + tx;
            verticies[index + 3 ] = d * h1 + b * w0 + ty;

            verticies[index + 4 ] = a * w0 + c * h0 + tx;
            verticies[index + 5 ] = d * h0 + b * w0 + ty;

            verticies[index + 6] =  a * w1 + c * h0 + tx;
            verticies[index + 7] =  d * h0 + b * w1 + ty;

            if(displayObject.updateFrame || displayObject.texture.updateFrame)
            {
                this.dirtyUVS = true;

                var texture = displayObject.texture;

                var frame = texture.frame;
                var tw = texture.baseTexture.width;
                var th = texture.baseTexture.height;

                uvs[index + 0] = frame.x / tw;
                uvs[index +1] = frame.y / th;

                uvs[index +2] = (frame.x + frame.width) / tw;
                uvs[index +3] = frame.y / th;

                uvs[index +4] = (frame.x + frame.width) / tw;
                uvs[index +5] = (frame.y + frame.height) / th;

                uvs[index +6] = frame.x / tw;
                uvs[index +7] = (frame.y + frame.height) / th;

                displayObject.updateFrame = false;
            }

            // TODO this probably could do with some optimisation....
            if(displayObject.cacheAlpha !== displayObject.worldAlpha)
            {
                displayObject.cacheAlpha = displayObject.worldAlpha;

                var colorIndex = indexRun * 4;
                colors[colorIndex] = colors[colorIndex + 1] = colors[colorIndex + 2] = colors[colorIndex + 3] = displayObject.worldAlpha;
                this.dirtyColors = true;
            }
        }
        else
        {
            index = indexRun * 8;

            verticies[index + 0 ] = verticies[index + 1 ] = verticies[index + 2 ] = verticies[index + 3 ] = verticies[index + 4 ] = verticies[index + 5 ] = verticies[index + 6] =  verticies[index + 7] = 0;
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

    var shaderProgram = globals.defaultShader;

    //gl.useProgram(shaderProgram);

    // update the verts..
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    // ok..
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verticies);
    gl.vertexAttribPointer(shaderProgram.aVertexPosition, 2, gl.FLOAT, false, 0, 0);
    // update the uvs
    //var isDefault = (shaderProgram == globals.shaderProgram)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);

    if(this.dirtyUVS)
    {
        this.dirtyUVS = false;
        gl.bufferSubData(gl.ARRAY_BUFFER,  0, this.uvs);
    }

    gl.vertexAttribPointer(shaderProgram.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

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

},{"../../core/globals":2,"../../display/blendModes":8}],53:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../../core/globals');
var Sprite = require('../../display/Sprite');
var Graphics = require('../../primitives/Graphics');
var PixiShader = require('./PixiShader');

function FilterTexture(width, height)
{
    var gl = globals.gl;

    // next time to create a frame buffer and texture
    this.frameBuffer = gl.createFramebuffer();
    this.texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D,  this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer );
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

    this.resize(width, height);
}

FilterTexture.prototype.resize = function resize(width, height)
{
    if(this.width === width && this.height === height) return;

    this.width = width;
    this.height = height;

    var gl = globals.gl;

    gl.bindTexture(gl.TEXTURE_2D,  this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,  width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

};

function WebGLFilterManager(transparent)
{
    this.transparent = transparent;

    this.filterStack = [];
    this.texturePool = [];

    this.offsetX = 0;
    this.offsetY = 0;

    this.initShaderBuffers();
}

var proto = WebGLFilterManager.prototype;

// API

proto.begin = function begin(projection, buffer)
{
    this.width = projection.x * 2;
    this.height = -projection.y * 2;
    this.buffer = buffer;
};

proto.pushFilter = function pushFilter(filterBlock)
{
    var gl = globals.gl;

    // filter program
    // OPTIMISATION - the first filter is free if its a simple color change?
    this.filterStack.push(filterBlock);

    var filter = filterBlock.filterPasses[0];

    this.offsetX += filterBlock.target.filterArea.x;
    this.offsetY += filterBlock.target.filterArea.y;

    var texture = this.texturePool.pop();
    if(!texture)
    {
        texture = new FilterTexture(this.width, this.height);
    }
    else
    {
        texture.resize(this.width, this.height);
    }

    gl.bindTexture(gl.TEXTURE_2D,  texture.texture);

    this.getBounds(filterBlock.target);

    // addpadding?
    //displayObject.filterArea.x

    var filterArea = filterBlock.target.filterArea;

    var padidng = filter.padding;
    filterArea.x -= padidng;
    filterArea.y -= padidng;
    filterArea.width += padidng * 2;
    filterArea.height += padidng * 2;

    // cap filter to screen size..
    if(filterArea.x < 0)filterArea.x = 0;
    if(filterArea.width > this.width)filterArea.width = this.width;
    if(filterArea.y < 0)filterArea.y = 0;
    if(filterArea.height > this.height)filterArea.height = this.height;

    //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,  filterArea.width, filterArea.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, texture.frameBuffer);

    //console.log(filterArea)
    // set view port
    gl.viewport(0, 0, filterArea.width, filterArea.height);

    // TODO need to remove these global elements..
    globals.projection.x = filterArea.width/2;
    globals.projection.y = -filterArea.height/2;

    globals.offset.x = -filterArea.x;
    globals.offset.y = -filterArea.y;

    //console.log(globals.defaultShader.projectionVector)
    // update projection
    gl.uniform2f(globals.defaultShader.projectionVector, filterArea.width/2, -filterArea.height/2);
    gl.uniform2f(globals.defaultShader.offsetVector, -filterArea.x, -filterArea.y);
    //globals.primitiveProgram

    gl.colorMask(true, true, true, true);
    gl.clearColor(0,0,0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    //filter.texture = texture;
    filterBlock._glFilterTexture = texture;

    //console.log("PUSH")
};


proto.popFilter = function popFilter()
{
    var gl = globals.gl;
    var filterBlock = this.filterStack.pop();
    var filterArea = filterBlock.target.filterArea;
    var texture = filterBlock._glFilterTexture;

    if(filterBlock.filterPasses.length > 1)
    {
        gl.viewport(0, 0, filterArea.width, filterArea.height);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        this.vertexArray[0] = 0;
        this.vertexArray[1] = filterArea.height;

        this.vertexArray[2] = filterArea.width;
        this.vertexArray[3] = filterArea.height;

        this.vertexArray[4] = 0;
        this.vertexArray[5] = 0;

        this.vertexArray[6] = filterArea.width;
        this.vertexArray[7] = 0;

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexArray);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        // nnow set the uvs..
        this.uvArray[2] = filterArea.width/this.width;
        this.uvArray[5] = filterArea.height/this.height;
        this.uvArray[6] = filterArea.width/this.width;
        this.uvArray[7] = filterArea.height/this.height;

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.uvArray);

        var inputTexture = texture;
        var outputTexture = this.texturePool.pop();
        if(!outputTexture)outputTexture = new FilterTexture(this.width, this.height);

        // need to clear this FBO as it may have some left over elements from a prvious filter.
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputTexture.frameBuffer );
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.disable(gl.BLEND);

        for (var i = 0; i < filterBlock.filterPasses.length-1; i++)
        {
            var filterPass = filterBlock.filterPasses[i];

            gl.bindFramebuffer(gl.FRAMEBUFFER, outputTexture.frameBuffer );

            // set texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, inputTexture.texture);

            // draw texture..
            //filterPass.applyFilterPass(filterArea.width, filterArea.height);
            this.applyFilterPass(filterPass, filterArea, filterArea.width, filterArea.height);

            // swap the textures..
            var temp = inputTexture;
            inputTexture = outputTexture;
            outputTexture = temp;
        }

        gl.enable(gl.BLEND);

        texture = inputTexture;
        this.texturePool.push(outputTexture);
    }

    var filter = filterBlock.filterPasses[filterBlock.filterPasses.length-1];

    this.offsetX -= filterArea.x;
    this.offsetY -= filterArea.y;


    var sizeX = this.width;
    var sizeY = this.height;

    var offsetX = 0;
    var offsetY = 0;

    var buffer = this.buffer;

    // time to render the filters texture to the previous scene
    if(this.filterStack.length === 0)
    {
        gl.colorMask(true, true, true, this.transparent);
    }
    else
    {
        var currentFilter = this.filterStack[this.filterStack.length-1];
        filterArea = currentFilter.target.filterArea;

        sizeX = filterArea.width;
        sizeY = filterArea.height;

        offsetX = filterArea.x;
        offsetY = filterArea.y;

        buffer =  currentFilter._glFilterTexture.frameBuffer;
    }



    // TODO need to remove these global elements..
    globals.projection.x = sizeX/2;
    globals.projection.y = -sizeY/2;

    globals.offset.x = offsetX;
    globals.offset.y = offsetY;

    filterArea = filterBlock.target.filterArea;

    var x = filterArea.x-offsetX;
    var y = filterArea.y-offsetY;

    // update the buffers..
    // make sure to flip the y!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    this.vertexArray[0] = x;
    this.vertexArray[1] = y + filterArea.height;

    this.vertexArray[2] = x + filterArea.width;
    this.vertexArray[3] = y + filterArea.height;

    this.vertexArray[4] = x;
    this.vertexArray[5] = y;

    this.vertexArray[6] = x + filterArea.width;
    this.vertexArray[7] = y;

    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexArray);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);

    this.uvArray[2] = filterArea.width/this.width;
    this.uvArray[5] = filterArea.height/this.height;
    this.uvArray[6] = filterArea.width/this.width;
    this.uvArray[7] = filterArea.height/this.height;

    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.uvArray);

    gl.viewport(0, 0, sizeX, sizeY);
    // bind the buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer );

    // set texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture.texture);

    // apply!
    //filter.applyFilterPass(sizeX, sizeY);
    this.applyFilterPass(filter, filterArea, sizeX, sizeY);

    // now restore the regular shader..
    gl.useProgram(globals.defaultShader.program);
    gl.uniform2f(globals.defaultShader.projectionVector, sizeX/2, -sizeY/2);
    gl.uniform2f(globals.defaultShader.offsetVector, -offsetX, -offsetY);

    // return the texture to the pool
    this.texturePool.push(texture);
    filterBlock._glFilterTexture = null;
};

proto.applyFilterPass = function applyFilterPass(filter, filterArea, width, height)
{
    // use program
    var gl = globals.gl;
    var shader = filter.shader;

    if(!shader)
    {
        shader = new PixiShader();

        shader.fragmentSrc = filter.fragmentSrc;
        shader.uniforms = filter.uniforms;
        shader.init();

        filter.shader = shader;
    }

    // set the shader
    gl.useProgram(shader.program);

    gl.uniform2f(shader.projectionVector, width/2, -height/2);
    gl.uniform2f(shader.offsetVector, 0,0);

    if(filter.uniforms.dimensions)
    {
        //console.log(filter.uniforms.dimensions)
        filter.uniforms.dimensions.value[0] = this.width;//width;
        filter.uniforms.dimensions.value[1] = this.height;//height;
        filter.uniforms.dimensions.value[2] = this.vertexArray[0];
        filter.uniforms.dimensions.value[3] = this.vertexArray[5];//filterArea.height;
    //  console.log(this.vertexArray[5])
    }

    shader.syncUniforms();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

    // draw the filter...
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0 );
};

proto.initShaderBuffers = function initShaderBuffers()
{
    var gl = globals.gl;

    // create some buffers
    this.vertexBuffer = gl.createBuffer();
    this.uvBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();

    // bind and upload the vertexs..
    // keep a refferance to the vertexFloatData..
    this.vertexArray = new Float32Array([0.0, 0.0,
                                         1.0, 0.0,
                                         0.0, 1.0,
                                         1.0, 1.0]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(
    gl.ARRAY_BUFFER,
    this.vertexArray,
    gl.STATIC_DRAW);


    // bind and upload the uv buffer
    this.uvArray = new Float32Array([0.0, 0.0,
                                     1.0, 0.0,
                                     0.0, 1.0,
                                     1.0, 1.0]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(
    gl.ARRAY_BUFFER,
    this.uvArray,
    gl.STATIC_DRAW);

    // bind and upload the index
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([0, 1, 2, 1, 3, 2]),
    gl.STATIC_DRAW);
};

proto.getBounds = function getBounds(displayObject)
{
    // time to get the width and height of the object!
    var worldTransform, width, height, aX, aY, w0, w1, h0, h1, doTest;
    var a, b, c, d, tx, ty, x1, x2, x3, x4, y1, y2, y3, y4;

    var tempObject = displayObject.first;
    var testObject = displayObject.last._iNext;

    var maxX = -Infinity;
    var maxY = -Infinity;

    var minX = Infinity;
    var minY = Infinity;

    do
    {
        // TODO can be optimized! - what if there is no scale / rotation?

        if(tempObject.visible)
        {
            if(tempObject instanceof Sprite)
            {
                width = tempObject.texture.frame.width;
                height = tempObject.texture.frame.height;

                // TODO trim??
                aX = tempObject.anchor.x;
                aY = tempObject.anchor.y;
                w0 = width * (1-aX);
                w1 = width * -aX;

                h0 = height * (1-aY);
                h1 = height * -aY;

                doTest = true;
            }
            else if(tempObject instanceof Graphics)
            {
                tempObject.updateFilterBounds();

                var bounds = tempObject.bounds;

                width = bounds.width;
                height = bounds.height;

                w0 = bounds.x;
                w1 = bounds.x + bounds.width;

                h0 = bounds.y;
                h1 = bounds.y + bounds.height;

                doTest = true;
            }
        }

        if(doTest)
        {
            worldTransform = tempObject.worldTransform;

            a = worldTransform[0];
            b = worldTransform[3];
            c = worldTransform[1];
            d = worldTransform[4];
            tx = worldTransform[2];
            ty = worldTransform[5];

            x1 = a * w1 + c * h1 + tx;
            y1 = d * h1 + b * w1 + ty;

            x2 = a * w0 + c * h1 + tx;
            y2 = d * h1 + b * w0 + ty;

            x3 = a * w0 + c * h0 + tx;
            y3 = d * h0 + b * w0 + ty;

            x4 =  a * w1 + c * h0 + tx;
            y4 =  d * h0 + b * w1 + ty;

            minX = x1 < minX ? x1 : minX;
            minX = x2 < minX ? x2 : minX;
            minX = x3 < minX ? x3 : minX;
            minX = x4 < minX ? x4 : minX;

            minY = y1 < minY ? y1 : minY;
            minY = y2 < minY ? y2 : minY;
            minY = y3 < minY ? y3 : minY;
            minY = y4 < minY ? y4 : minY;

            maxX = x1 > maxX ? x1 : maxX;
            maxX = x2 > maxX ? x2 : maxX;
            maxX = x3 > maxX ? x3 : maxX;
            maxX = x4 > maxX ? x4 : maxX;

            maxY = y1 > maxY ? y1 : maxY;
            maxY = y2 > maxY ? y2 : maxY;
            maxY = y3 > maxY ? y3 : maxY;
            maxY = y4 > maxY ? y4 : maxY;
        }

        doTest = false;
        tempObject = tempObject._iNext;

    }
    while(tempObject !== testObject);

    // maximum bounds is the size of the screen..
    //minX = minX > 0 ? minX : 0;
    //minY = minY > 0 ? minY : 0;

    displayObject.filterArea.x = minX;
    displayObject.filterArea.y = minY;

//  console.log(maxX+ " : " + minX)
    displayObject.filterArea.width = maxX - minX;
    displayObject.filterArea.height = maxY - minY;
};

module.exports = WebGLFilterManager;

},{"../../core/globals":2,"../../display/Sprite":6,"../../primitives/Graphics":46,"./PixiShader":49}],54:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../../core/globals');
var shaders = require('./shaders');
var webglGraphics = require('./graphics');
var WebGLBatch = require('./WebGLBatch');
var WebGLFilterManager = require('./WebGLFilterManager');
var mat3 = require('../../geom/matrix').mat3;

var BaseTexture = require('../../textures/BaseTexture');

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
function WebGLRenderGroup(gl, transparent)
{
    this.gl = gl;
    this.root = null;

    this.backgroundColor = undefined;
    this.transparent = transparent === undefined ? true : transparent;

    this.batchs = [];
    this.toRemove = [];
    //console.log(this.transparent);
    this.filterManager = new WebGLFilterManager(this.transparent);
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
proto.render = function render(projection, buffer)
{
    var gl = this.gl;

    WebGLRenderGroup.updateTextures(gl);

    gl.uniform2f(globals.defaultShader.projectionVector, projection.x, projection.y);

    this.filterManager.begin(projection, buffer);


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

        // render special
        this.renderSpecial(renderable, projection);
    }
};

/**
 * Renders the stage to its webgl view
 *
 * @method handleFilter
 * @param filter {FilterBlock}
 * @private
 */
proto.handleFilter = function handleFilter()/*(filter, projection)*/
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
proto.renderSpecific = function renderSpecific(displayObject, projection, buffer)
{
    var gl = this.gl;

    WebGLRenderGroup.updateTextures(gl);

    gl.uniform2f(globals.defaultShader.projectionVector, projection.x, projection.y);

    this.filterManager.begin(projection, buffer);

    // to do!
    // render part of the scene...

    var startIndex;
    var startBatchIndex;

    var endIndex;
    var endBatchIndex;
    var endBatch;

    var head;

    /*
     *  LOOK FOR THE NEXT SPRITE
     *  This part looks for the closest next sprite that can go into a batch
     *  it keeps looking until it finds a sprite or gets to the end of the display
     *  scene graph
     */
    var nextRenderable = displayObject.first;
    while(nextRenderable._iNext)
    {
        if(nextRenderable.renderable && nextRenderable.__renderGroup)break;
        nextRenderable = nextRenderable._iNext;
    }
    var startBatch = nextRenderable.batch;

    if(nextRenderable instanceof Sprite)
    {
        startBatch = nextRenderable.batch;

        head = startBatch.head;

        // ok now we have the batch.. need to find the start index!
        if(head === nextRenderable)
        {
            startIndex = 0;
        }
        else
        {
            startIndex = 1;

            while(head.__next !== nextRenderable)
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
    var lastRenderable = displayObject.last;
    while(lastRenderable._iPrev)
    {
        if(lastRenderable.renderable && lastRenderable.__renderGroup)break;
        lastRenderable = lastRenderable._iNext;
    }

    if(lastRenderable instanceof Sprite)
    {
        endBatch = lastRenderable.batch;

        head = endBatch.head;

        if(head === lastRenderable)
        {
            endIndex = 0;
        }
        else
        {
            endIndex = 1;

            while(head.__next !== lastRenderable)
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

    if(startBatch === endBatch)
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
    for (var i = startBatchIndex+1; i < endBatchIndex; i++)
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
        this.handleFilterBlock(renderable, projection);
    }
};

var maskStack = [];

proto.handleFilterBlock = function handleFilterBlock(filterBlock, projection)
{
    /*
     * for now only masks are supported..
     */
    var gl = globals.gl;

    if(filterBlock.open)
    {
        if(filterBlock.data instanceof Array)
        {
            this.filterManager.pushFilter(filterBlock);
            // ok so..

        }
        else
        {
            maskStack.push(filterBlock);

            gl.enable(gl.STENCIL_TEST);

            gl.colorMask(false, false, false, false);

            gl.stencilFunc(gl.ALWAYS,1,1);
            gl.stencilOp(gl.KEEP,gl.KEEP,gl.INCR);

            webglGraphics.renderGraphics(filterBlock.data, projection);

            gl.colorMask(true, true, true, true);
            gl.stencilFunc(gl.NOTEQUAL,0,maskStack.length);
            gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
        }
    }
    else
    {
        if(filterBlock.data instanceof Array)
        {
            this.filterManager.popFilter();
        }
        else
        {
            var maskData = maskStack.pop(filterBlock);

            if(maskData)
            {
                gl.colorMask(false, false, false, false);

                gl.stencilFunc(gl.ALWAYS,1,1);
                gl.stencilOp(gl.KEEP,gl.KEEP,gl.DECR);

                webglGraphics.renderGraphics(maskData.data, projection);

                gl.colorMask(true, true, true, true);
                gl.stencilFunc(gl.NOTEQUAL,0,maskStack.length);
                gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
            }

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
    while(previousRenderable !== this.root)
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
    while(previousRenderable !== this.root.first)
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
    while(previousRenderable2 !== this.root.first)
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
    while(previousRenderable !== this.root.first)
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
    while(tempObject !== testObject);
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
    if(displayObject.__renderGroup !== this) return;

    do
    {
        displayObject.__renderGroup = null;
        if(displayObject.renderable)this.removeObject(displayObject);
        displayObject = displayObject._iNext;
    }
    while(displayObject);
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
                if(previousBatch.texture === displayObject.texture.baseTexture && previousBatch.blendMode === displayObject.blendMode)
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
                    if(nextBatch.texture === displayObject.texture.baseTexture && nextBatch.blendMode === displayObject.blendMode)
                    {
                        nextBatch.insertBefore(displayObject, nextSprite);
                        return;
                    }
                    else
                    {
                        if(nextBatch === previousBatch)
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
    /*
    else if(displayObject)// instanceof Graphics)
    {
        //displayObject.initWebGL(this);

        // add to a batch!!
        //this.initStrip(displayObject);
        //this.batchs.push(displayObject);
    }
    */

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
            if(previousBatch.tail === displayObject)
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
                this.batchs.splice(index+1, 0, item, splitBatch);
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
        this.batchs.splice(index+1, 0, item);
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
        if(index === -1)return;// this means it was added then removed before rendered

        // ok so.. check to see if you adjacent batchs should be joined.
        // TODO may optimise?
        if(index === 0 || index === this.batchs.length-1)
        {
            // wha - eva! just get of the empty batch!
            this.batchs.splice(index, 1);
            if(batchToRemove instanceof WebGLBatch)WebGLBatch.returnBatch(batchToRemove);

            return;
        }

        if(this.batchs[index-1] instanceof WebGLBatch && this.batchs[index+1] instanceof WebGLBatch)
        {
            if(this.batchs[index-1].texture === this.batchs[index+1].texture && this.batchs[index-1].blendMode === this.batchs[index+1].blendMode)
            {
                //console.log("MERGE")
                this.batchs[index-1].merge(this.batchs[index+1]);

                if(batchToRemove instanceof WebGLBatch)WebGLBatch.returnBatch(batchToRemove);
                WebGLBatch.returnBatch(this.batchs[index+1]);
                this.batchs.splice(index, 2);
                return;
            }
        }

        this.batchs.splice(index, 1);
        if(batchToRemove instanceof WebGLBatch)WebGLBatch.returnBatch(batchToRemove);
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

    sprite.indices =  new Uint16Array([0, 1, 3,2]); //, 2]);

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

    shaders.activateStripShader();

    var shader = globals.stripShader;

    var m = mat3.clone(strip.worldTransform);

    mat3.transpose(m);

    // set the matrix transform for the
    gl.uniformMatrix3fv(shader.translationMatrix, false, m);
    gl.uniform2f(shader.projectionVector, projection.x, projection.y);
    gl.uniform2f(shader.offsetVector, -globals.offset.x, -globals.offset.y);

    gl.uniform1f(shader.alpha, strip.worldAlpha);

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
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, strip.verticies);
        gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);

        // update the uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, strip._uvBuffer);
        gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, strip.texture.baseTexture._glTexture);

        gl.bindBuffer(gl.ARRAY_BUFFER, strip._colorBuffer);
        gl.vertexAttribPointer(shader.colorAttribute, 1, gl.FLOAT, false, 0, 0);

        // dont need to upload!
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, strip._indexBuffer);
    }
    else
    {
        strip.dirty = false;
        gl.bindBuffer(gl.ARRAY_BUFFER, strip._vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, strip.verticies, gl.STATIC_DRAW);
        gl.vertexAttribPointer(shader.aVertexPosition, 2, gl.FLOAT, false, 0, 0);

        // update the uvs
        gl.bindBuffer(gl.ARRAY_BUFFER, strip._uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, strip.uvs, gl.STATIC_DRAW);
        gl.vertexAttribPointer(shader.aTextureCoord, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, strip.texture.baseTexture._glTexture);

        gl.bindBuffer(gl.ARRAY_BUFFER, strip._colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, strip.colors, gl.STATIC_DRAW);
        gl.vertexAttribPointer(shader.colorAttribute, 1, gl.FLOAT, false, 0, 0);

        // dont need to upload!
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, strip._indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, strip.indices, gl.STATIC_DRAW);

    }

    gl.drawElements(gl.TRIANGLE_STRIP, strip.indices.length, gl.UNSIGNED_SHORT, 0);

    shaders.deactivateStripShader();
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
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprite.uvs);

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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texture.scaleMode === BaseTexture.SCALE_MODE.LINEAR ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, texture.scaleMode === BaseTexture.SCALE_MODE.LINEAR ? gl.LINEAR : gl.NEAREST);

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

},{"../../core/globals":2,"../../display/Sprite":6,"../../extras/CustomRenderable":10,"../../extras/Strip":13,"../../extras/TilingSprite":14,"../../filters/FilterBlock":24,"../../geom/matrix":37,"../../primitives/Graphics":46,"../../textures/BaseTexture":61,"./WebGLBatch":52,"./WebGLFilterManager":53,"./graphics":57,"./shaders":58}],55:[function(require,module,exports){
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
    this.view.addEventListener('webglcontextlost', function(event) { scope.handleContextLost(event); }, false);
    this.view.addEventListener('webglcontextrestored', function(event) { scope.handleContextRestored(event); }, false);

    this.batchs = [];

    var options = {
        alpha: this.transparent,
        antialias:!!antialias, // SPEED UP??
        premultipliedAlpha:false,
        stencil:true
    };

    // do a catch.. only 1 webGL renderer..
    //try 'experimental-webgl'
    try {
        gl = this.view.getContext('experimental-webgl',  options);
    } catch (e) {
        //try 'webgl'
        try {
            gl = this.view.getContext('webgl',  options);
        } catch (e2) {
            // fail, not able to get a context
            throw new Error(' This browser does not support webGL. Try using the canvas renderer' + this);
        }
    }
    // TODO remove this global..
    this.gl = globals.gl = gl;

    shaders.initDefaultShaders();

    gl.useProgram(globals.defaultShader.program);

    this.batch = new WebGLBatch(gl);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    gl.enable(gl.BLEND);
    gl.colorMask(true, true, true, this.transparent);

    // TODO remove these globals..
    this.projection = globals.projection = new Point(400, 300);
    this.offset = globals.offset = new Point(0, 0);

    this.resize(this.width, this.height);
    this.contextLost = false;

    this.stageRenderGroup = new WebGLRenderGroup(this.gl, this.transparent);
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

    this.stageRenderGroup.backgroundColor = stage.backgroundColorSplit;

    this.projection.x =  this.width/2;
    this.projection.y =  -this.height/2;

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

    this.projection.x =  this.width/2;
    this.projection.y =  -this.height/2;

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
proto.handleContextRestored = function handleContextRestored()/*(event)*/
{
    var gl = this.gl = this.view.getContext('experimental-webgl',  {
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
        this.batchs[i].restoreLostContext(gl);
        this.batchs[i].dirty = true;
    }

    WebGLBatch.restoreBatches(gl);

    this.contextLost = false;
};

module.exports = WebGLRenderer;

},{"../../core/globals":2,"../../geom/Point":34,"../../platform":45,"../../textures/Texture":63,"./WebGLBatch":52,"./WebGLRenderGroup":54,"./shaders":58}],56:[function(require,module,exports){
/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

var platform = require('../../platform');

exports.shader = function compileShader(gl, shaderSrc, shaderType)
{
    var src = shaderSrc.join('\n');
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        if (platform.console) platform.console.error(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
};

exports.program = function compileProgram(gl, vertexSrc, fragmentSrc)
{
    var fragmentShader = exports.shader(gl, fragmentSrc, gl.FRAGMENT_SHADER);
    var vertexShader = exports.shader(gl, vertexSrc, gl.VERTEX_SHADER);

    var shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        if (platform.console) platform.console.error('Could not initialise shaders');
        return null;
    }

    return shaderProgram;
};

},{"../../platform":45}],57:[function(require,module,exports){
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

    gl.uniformMatrix3fv(globals.primitiveShader.translationMatrix, false, m);

    gl.uniform2f(globals.primitiveShader.projectionVector, projection.x, -projection.y);
    gl.uniform2f(globals.primitiveShader.offsetVector, -globals.offset.x, -globals.offset.y);

    gl.uniform1f(globals.primitiveShader.alpha, graphics.worldAlpha);
    gl.bindBuffer(gl.ARRAY_BUFFER, graphics._webGL.buffer);

    gl.vertexAttribPointer(globals.primitiveShader.aVertexPosition, 2, gl.FLOAT, false, 4 * 6, 0);
    gl.vertexAttribPointer(globals.primitiveShader.colorAttribute, 4, gl.FLOAT, false,4 * 6, 2 * 4);

    // set the index buffer!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, graphics._webGL.indexBuffer);


    gl.drawElements(gl.TRIANGLE_STRIP,  graphics._webGL.indices.length, gl.UNSIGNED_SHORT, 0 );

    shaders.deactivatePrimitiveShader();

    // return to default shader...
//  shaders.activateShader(globals.defaultShader);
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
    for (var i = graphics._webGL.lastIndex; i < graphics.graphicsData.length; i++)
    {
        var data = graphics.graphicsData[i];

        if(data.type === Graphics.POLY)
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
        else if(data.type === Graphics.RECT)
        {
            exports.buildRectangle(data, graphics._webGL);
        }
        else if(data.type === Graphics.CIRC || data.type === Graphics.ELIP);
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
        indices.push(vertPos, vertPos, vertPos+1, vertPos+2, vertPos+3, vertPos+3);
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

    var i = 0;

    if(graphicsData.fill)
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

    if(graphicsData.lineWidth)
    {
        graphicsData.points = [];

        for (i = 0; i < totalSegs + 1; i++)
        {
            graphicsData.points.push(x + Math.sin(seg * i) * width,
                                     y + Math.cos(seg * i) * height);
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
    var i = 0;

    var points = graphicsData.points;
    if(points.length === 0)return;

    // if the line width is an odd number add 0.5 to align to a whole pixel
    if(graphicsData.lineWidth%2)
    {
        for (i = 0; i < points.length; i++) {
            points[i] += 0.5;
        }
    }

    // get first and last point.. figure out the middle!
    var firstPoint = new Point( points[0], points[1] );
    var lastPoint = new Point( points[points.length - 2], points[points.length - 1] );

    // if the first point is the last point - goona have issues :)
    if(firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y)
    {
        points.pop();
        points.pop();

        lastPoint = new Point( points[points.length - 2], points[points.length - 1] );

        var midPointX = lastPoint.x + (firstPoint.x - lastPoint.x) *0.5;
        var midPointY = lastPoint.y + (firstPoint.y - lastPoint.y) *0.5;

        points.unshift(midPointX, midPointY);
        points.push(midPointX, midPointY);
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

    var px, py, p1x, p1y, p2x, p2y, p3x, p3y;
    var perpx, perpy, perp2x, perp2y, perp3x, perp3y;
    var a1, b1, c1, a2, b2, c2;
    var denom, pdist, dist;

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

    for (i = 1; i < length-1; i++)
    {
        p1x = points[(i-1)*2];
        p1y = points[(i-1)*2 + 1];

        p2x = points[(i)*2];
        p2y = points[(i)*2 + 1];

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

        if(Math.abs(denom) < 0.1 )
        {

            denom+=10.1;
            verts.push(p2x - perpx , p2y - perpy,
                r, g, b, alpha);

            verts.push(p2x + perpx , p2y + perpy,
                r, g, b, alpha);

            continue;
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

    p1x = points[(length-2)*2];
    p1y = points[(length-2)*2 + 1];

    p2x = points[(length-1)*2];
    p2y = points[(length-1)*2 + 1];

    perpx = -(p1y - p2y);
    perpy = p1x - p2x;

    dist = Math.sqrt(perpx*perpx + perpy*perpy);
    perpx /= dist;
    perpy /= dist;
    perpx *= width;
    perpy *= width;

    verts.push(p2x - perpx , p2y - perpy);
    verts.push(r, g, b, alpha);

    verts.push(p2x + perpx , p2y + perpy);
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
    if(points.length < 6)return;

    // get first and last point.. figure out the middle!
    var verts = webGLData.points;
    var indices = webGLData.indices;

    var length = points.length / 2;

    // sort color
    var color = hex2rgb(graphicsData.fillColor);
    var alpha = graphicsData.fillAlpha;
    var r = color[0] * alpha;
    var g = color[1] * alpha;
    var b = color[2] * alpha;

    var triangles = triangulate(points);

    var vertPos = verts.length / 6;

    var i = 0;

    for (i = 0; i < triangles.length; i+=3)
    {
        indices.push(triangles[i] + vertPos);
        indices.push(triangles[i] + vertPos);
        indices.push(triangles[i+1] + vertPos);
        indices.push(triangles[i+2] +vertPos);
        indices.push(triangles[i+2] + vertPos);
    }

    for (i = 0; i < length; i++)
    {
        verts.push(points[i * 2], points[i * 2 + 1],
                   r, g, b, alpha);
    }
};

},{"../../core/globals":2,"../../geom/Point":34,"../../geom/matrix":37,"../../primitives/Graphics":46,"../../utils/Polyk":64,"../../utils/color":66,"./shaders":58}],58:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('../../core/globals');
var PrimitiveShader = require('./PrimitiveShader');
var StripShader = require('./StripShader');
var PixiShader = require('./PixiShader');

exports.initDefaultShaders = function initDefaultShaders()
{
    globals.primitiveShader = new PrimitiveShader();
    globals.primitiveShader.init();

    globals.stripShader = new StripShader();
    globals.stripShader.init();

    globals.defaultShader = new PixiShader();
    globals.defaultShader.init();

    var gl = globals.gl;
    var shaderProgram = globals.defaultShader.program;

    gl.useProgram(shaderProgram);

    gl.enableVertexAttribArray(globals.defaultShader.aVertexPosition);
    gl.enableVertexAttribArray(globals.defaultShader.colorAttribute);
    gl.enableVertexAttribArray(globals.defaultShader.aTextureCoord);
};

exports.activatePrimitiveShader = function activatePrimitiveShader()
{
    var gl = globals.gl;

    gl.useProgram(globals.primitiveShader.program);

    gl.disableVertexAttribArray(globals.defaultShader.aVertexPosition);
    gl.disableVertexAttribArray(globals.defaultShader.colorAttribute);
    gl.disableVertexAttribArray(globals.defaultShader.aTextureCoord);

    gl.enableVertexAttribArray(globals.primitiveShader.aVertexPosition);
    gl.enableVertexAttribArray(globals.primitiveShader.colorAttribute);
};

exports.deactivatePrimitiveShader = function deactivatePrimitiveShader()
{
    var gl = globals.gl;

    gl.useProgram(globals.defaultShader.program);

    gl.disableVertexAttribArray(globals.primitiveShader.aVertexPosition);
    gl.disableVertexAttribArray(globals.primitiveShader.colorAttribute);

    gl.enableVertexAttribArray(globals.defaultShader.aVertexPosition);
    gl.enableVertexAttribArray(globals.defaultShader.colorAttribute);
    gl.enableVertexAttribArray(globals.defaultShader.aTextureCoord);
};

exports.activateStripShader = function activateStripShader()
{
    var gl = globals.gl;

    gl.useProgram(globals.stripShader.program);
 // gl.disableVertexAttribArray(globals.defaultShader.aTextureCoord);
};

exports.deactivateStripShader = function deactivateStripShader()
{
    var gl = globals.gl;

    gl.useProgram(globals.defaultShader.program);
    //gl.enableVertexAttribArray(globals.defaultShader.aTextureCoord);
};

},{"../../core/globals":2,"./PixiShader":49,"./PrimitiveShader":50,"./StripShader":51}],59:[function(require,module,exports){
/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var DisplayObjectContainer = require('../display/DisplayObjectContainer');
var Sprite = require('../display/Sprite');
var Point = require('../geom/Point');

/**
 * A Text Object will create a line(s) of text using bitmap font. To split a line you can use '\n', '\r' or '\r\n'
 * You can generate the fnt files using
 * http://www.angelcode.com/products/bmfont/ for windows or
 * http://www.bmglyph.com/ for mac.
 *
 * @class BitmapText
 * @extends DisplayObjectContainer
 * @constructor
 * @param text {String} The copy that you would like the text to display
 * @param style {Object} The style parameters
 * @param style.font {String} The size (optional) and bitmap font id (required) eq 'Arial' or '20px Arial' (must have loaded previously)
 * @param [style.align='left'] {String} An alignment of the multiline text ('left', 'center' or 'right')
 */
function BitmapText(text, style)
{
    DisplayObjectContainer.call(this);

    this.setText(text);
    this.setStyle(style);
    this.updateText();
    this.dirty = false;
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
    this.text = text || ' ';
    this.dirty = true;
};

/**
 * Set the style of the text
 *
 * @method setStyle
 * @param style {Object} The style parameters
 * @param style.font {String} The size (optional) and bitmap font id (required) eq 'Arial' or '20px Arial' (must have loaded previously)
 * @param [style.align='left'] {String} An alignment of the multiline text ('left', 'center' or 'right')
 */
proto.setStyle = function setStyle(style)
{
    style = style || {};
    style.align = style.align || 'left';
    this.style = style;

    var font = style.font.split(' ');
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
        if(this.style.align === 'right')
        {
            alignOffset = maxLineWidth - lineWidths[i];
        }
        else if(this.style.align === 'center')
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

    this.width = maxLineWidth * scale;
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

},{"../display/DisplayObjectContainer":4,"../display/Sprite":6,"../geom/Point":34}],60:[function(require,module,exports){
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
 * A Text Object will create a line(s) of text to split a line you can use '\n'
 *
 * @class Text
 * @extends Sprite
 * @constructor
 * @param text {String} The copy that you would like the text to display
 * @param [style] {Object} The style parameters
 * @param [style.font] {String} default 'bold 20pt Arial' The style and size of the font
 * @param [style.fill='black'] {Object} A canvas fillstyle that will be used on the text eg 'red', '#00FF00'
 * @param [style.align='left'] {String} An alignment of the multiline text ('left', 'center' or 'right')
 * @param [style.stroke] {String} A canvas fillstyle that will be used on the text stroke eg 'blue', '#FCFF00'
 * @param [style.strokeThickness=0] {Number} A number that represents the thickness of the stroke. Default is 0 (no stroke)
 * @param [style.wordWrap=false] {Boolean} Indicates if word wrap should be used
 * @param [style.wordWrapWidth=100] {Number} The width at which text will wrap
 */
function Text(text, style)
{
    this.canvas = platform.createCanvas();
    this.context = this.canvas.getContext('2d');
    Sprite.call(this, Texture.fromCanvas(this.canvas));

    this.setText(text);
    this.setStyle(style);

    this.updateText();
    this.dirty = false;
}

var proto = Text.prototype = Object.create(Sprite.prototype, {
    constructor: {value: Text}
});

/**
 * Set the style of the text
 *
 * @method setStyle
 * @param [style] {Object} The style parameters
 * @param [style.font='bold 20pt Arial'] {String} The style and size of the font
 * @param [style.fill='black'] {Object} A canvas fillstyle that will be used on the text eg 'red', '#00FF00'
 * @param [style.align='left'] {String} An alignment of the multiline text ('left', 'center' or 'right')
 * @param [style.stroke='black'] {String} A canvas fillstyle that will be used on the text stroke eg 'blue', '#FCFF00'
 * @param [style.strokeThickness=0] {Number} A number that represents the thickness of the stroke. Default is 0 (no stroke)
 * @param [style.wordWrap=false] {Boolean} Indicates if word wrap should be used
 * @param [style.wordWrapWidth=100] {Number} The width at which text will wrap
 */
proto.setStyle = function setStyle(style)
{
    style = style || {};
    style.font = style.font || 'bold 20pt Arial';
    style.fill = style.fill || 'black';
    style.align = style.align || 'left';
    style.stroke = style.stroke || 'black'; //provide a default, see: https://github.com/GoodBoyDigital/pixi.js/issues/136
    style.strokeThickness = style.strokeThickness || 0;
    style.wordWrap = style.wordWrap || false;
    style.wordWrapWidth = style.wordWrapWidth || 100;
    this.style = style;
    this.dirty = true;
};

/**
 * Set the copy for the text object. To split a line you can use '\n'
 *
 * @method setText
 * @param {String} text The copy that you would like the text to display
 */
proto.setText = function setText(text)
{
    this.text = text.toString() || ' ';
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
    var lineHeight = this.determineFontHeight('font: ' + this.style.font  + ';') + this.style.strokeThickness;
    this.canvas.height = lineHeight * lines.length;

    //set canvas text styles
    this.context.fillStyle = this.style.fill;
    this.context.font = this.style.font;

    this.context.strokeStyle = this.style.stroke;
    this.context.lineWidth = this.style.strokeThickness;

    this.context.textBaseline = 'top';

    //draw lines line by line
    for (i = 0; i < lines.length; i++)
    {
        var linePosition = new Point(this.style.strokeThickness / 2, this.style.strokeThickness / 2 + i * lineHeight);

        if(this.style.align === 'right')
        {
            linePosition.x += maxLineWidth - lineWidths[i];
        }
        else if(this.style.align === 'center')
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
        var body = platform.document.getElementsByTagName('body')[0];
        var dummy = platform.document.createElement('div');
        var dummyText = platform.document.createTextNode('M');
        dummy.appendChild(dummyText);
        dummy.setAttribute('style', fontStyle + ';position:absolute;top:0;left:0');
        body.appendChild(dummy);

        result = dummy.offsetHeight;
        Text.heightCache[fontStyle] = result;

        body.removeChild(dummy);
    }

    return result;
};

/**
 * Applies newlines to a string to have it optimally fit into the horizontal
 * bounds set by the Text object's wordWrapWidth property.
 *
 * @method wordWrap
 * @param text {String}
 * @private
 */
proto.wordWrap = function wordWrap(text)
{
    // Greedy wrapping algorithm that will wrap words as the line grows longer
    // than its horizontal bounds.
    var result = '';
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++)
    {
        var spaceLeft = this.style.wordWrapWidth;
        var words = lines[i].split(' ');
        for (var j = 0; j < words.length; j++)
        {
            var wordWidth = this.context.measureText(words[j]).width;
            var wordWidthWithSpace = wordWidth + this.context.measureText(' ').width;
            if(wordWidthWithSpace > spaceLeft)
            {
                // Skip printing the newline if it's the first word of the line that is
                // greater than the word wrap width.
                if(j > 0)
                {
                    result += '\n';
                }
                result += words[j] + ' ';
                spaceLeft = this.style.wordWrapWidth - wordWidth;
            }
            else
            {
                spaceLeft -= wordWidthWithSpace;
                result += words[j] + ' ';
            }
        }
        result += '\n';
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

},{"../core/globals":2,"../display/Sprite":6,"../geom/Point":34,"../platform":45,"../textures/Texture":63}],61:[function(require,module,exports){
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
function BaseTexture(source, scaleMode)
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
     * The scale mode to apply when scaling this texture
     * @property scaleMode
     * @type PIXI.BaseTexture.SCALE_MODE
     * @default PIXI.BaseTexture.SCALE_MODE.LINEAR
     */
    this.scaleMode = scaleMode || BaseTexture.SCALE_MODE.DEFAULT;

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
            this.source.onload = function() {

                scope.hasLoaded = true;
                scope.width = scope.source.width;
                scope.height = scope.source.height;

                // add it to somewhere...
                globals.texturesToUpdate.push(scope);
                scope.dispatchEvent( { type: 'loaded', content: scope } );
            };
            //this.image.src = imageUrl;
        }
    }
    else
    {
        this.hasLoaded = true;
        this.width = this.source.width;
        this.height = this.source.height;

        globals.texturesToUpdate.push(this);
    }

    this.imageUrl = null;
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
        if (this.imageUrl in baseTextureCache)
            delete baseTextureCache[this.imageUrl];
        this.imageUrl = null;
        this.source.src = null;
    }
    this.source = null;
    globals.texturesToDestroy.push(this);
};

/**
 *
 *
 * @method destroy
 */
proto.updateSourceImage = function updateSourceImage(newSrc)
{
    this.hasLoaded = false;
    this.source.src = null;
    this.source.src = newSrc;
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
BaseTexture.fromImage = function fromImage(imageUrl, crossorigin, scaleMode)
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
        baseTexture = new BaseTexture(image, scaleMode);
        baseTexture.imageUrl = imageUrl;
        baseTextureCache[imageUrl] = baseTexture;
    }

    return baseTexture;
};

BaseTexture.SCALE_MODE = {
    DEFAULT: 0, //default to LINEAR
    LINEAR: 0,
    NEAREST: 1
};

module.exports = BaseTexture;

},{"../core/globals":2,"../events/EventTarget":9,"../platform":45}],62:[function(require,module,exports){
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
    this.projection = new Point(this.width/2 , -this.height/2);

    // set the correct render function..
    this.render = this.renderWebGL;
};

proto.resize = function resize(width, height)
{

    this.width = width;
    this.height = height;

    if(globals.gl)
    {
        this.projection.x = this.width / 2;
        this.projection.y = -this.height / 2;

        var gl = globals.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.baseTexture._glTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,  this.width,  this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    else
    {

        this.frame.width = this.width;
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
    displayObject.worldTransform[5] = this.projection.y * -2;

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
        if(displayObject === renderGroup.root)
        {
            renderGroup.render(this.projection, this.glFramebuffer);
        }
        else
        {
            renderGroup.renderSpecific(displayObject, this.projection, this.glFramebuffer);
        }
    }
    else
    {
        if(!this.renderGroup)this.renderGroup = new WebGLRenderGroup(gl);
        this.renderGroup.setRenderable(displayObject);
        this.renderGroup.render(this.projection, this.glFramebuffer);
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


    for(var i = 0, j = children.length; i < j; i++)
    {
        children[i].updateTransform();
    }

    if(clear) this.renderer.context.clearRect(0,0, this.width, this.height);

    this.renderer.renderDisplayObject(displayObject);

    this.renderer.context.setTransform(1,0,0,1,0,0);

    //globals.texturesToUpdate.push(this.baseTexture);
};

module.exports = RenderTexture;

},{"../core/globals":2,"../events/EventTarget":9,"../geom/Point":34,"../geom/Rectangle":36,"../geom/matrix":37,"../renderers/canvas/CanvasRenderer":47,"../renderers/webgl/WebGLRenderGroup":54,"./BaseTexture":61,"./Texture":63}],63:[function(require,module,exports){
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
        baseTexture.addEventListener('loaded', function(){ scope.onBaseTextureLoaded(); });
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
proto.onBaseTextureLoaded = function onBaseTextureLoaded()/*(event)*/
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
    if(destroyBase) this.baseTexture.destroy();
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
        throw new Error('Texture Error: frame does not fit inside the base Texture dimensions ' + this);
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
Texture.fromImage = function fromImage(imageUrl, crossorigin, scaleMode)
{
    var texture = Texture.cache[imageUrl];

    if(!texture)
    {
        texture = new Texture(BaseTexture.fromImage(imageUrl, crossorigin, scaleMode));
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
    if(!texture) throw new Error('The frameId "' + frameId + '" does not exist in the texture cache ' + this);
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
Texture.fromCanvas = function fromCanvas(canvas, scaleMode)
{
    var baseTexture = new BaseTexture(canvas, scaleMode);
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
    var texture = Texture.cache[id];
    Texture.cache[id] = null;
    return texture;
};

Texture.cache = {};
// this is more for webGL.. it contains updated frames..
Texture.frameUpdates = [];
Texture.SCALE_MODE = BaseTexture.SCALE_MODE;

module.exports = Texture;

},{"../events/EventTarget":9,"../geom/Point":34,"../geom/Rectangle":36,"./BaseTexture":61}],64:[function(require,module,exports){
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
    return ((ay-by)*(cx-bx) + (bx-ax)*(cy-by) >= 0) === sign;
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

    var n = p.length >> 1;
    if(n < 3) return [];

    var tgs = [];
    var avl = [];
    for(var i = 0; i < n; i++) avl.push(i);

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
            for(var j = 0; j < al; j++)
            {
                var vi = avl[j];
                if(vi === i0 || vi === i1 || vi === i2) continue;

                if(pointInTriangle(p[2*vi], p[2*vi+1], ax, ay, bx, by, cx, cy)) {
                    earFound = false;
                    break;
                }
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
                for(i = 0; i < n; i++) avl.push(i);

                i = 0;
                al = n;

                sign = false;
            }
            else
            {
                platform.console.warn('PIXI Warning: shape too complex to fill');
                return [];
            }
        }
    }

    tgs.push(avl[0], avl[1], avl[2]);
    return tgs;
};

},{"../platform":45}],65:[function(require,module,exports){
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

    if(webgl && platform.navigator)
    {
        var ie =  (platform.navigator.userAgent.toLowerCase().indexOf('trident') !== -1);
        webgl = !ie;
    }

    //console.log(webgl);
    if( webgl )
    {
        return new WebGLRenderer(width, height, view, transparent, antialias);
    }

    return new CanvasRenderer(width, height, view, transparent);
};

},{"../platform":45,"../renderers/canvas/CanvasRenderer":47,"../renderers/webgl/WebGLRenderer":55}],66:[function(require,module,exports){
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

},{}],67:[function(require,module,exports){
/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
'use strict';

var platform = require('../platform');

function logGroup(name) {
    var console = platform.console;
    if (console.groupCollapsed) {
        console.groupCollapsed(name);
    } else if (console.group) {
        console.group(name);
    } else {
        console.log(name + ' >>>>>>>>>');
    }
}

function logGroupEnd(name) {
    var console = platform.console;
    if (console.groupEnd) {
        console.groupEnd(name);
    } else {
        console.log(name + ' _________');
    }
}

exports.runList = function runList(item, name)
{
    var safe = 0;
    var tmp = item.first;

    name = 'pixi.runList' + (name ? '(' + name + ')' : '');
    logGroup(name);
    platform.console.log(tmp);

    while(tmp._iNext)
    {
        safe++;
        tmp = tmp._iNext;
        platform.console.log(tmp);

        if(safe > 100)
        {
            platform.console.log('BREAK');
            break;
        }
    }
    logGroupEnd(name);
};

},{"../platform":45}],68:[function(require,module,exports){
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
    for(var i = 0; i < vendors.length && !global.requestAnimationFrame; ++i) {
        global.requestAnimationFrame = global[vendors[i] + 'RequestAnimationFrame'];
        global.cancelAnimationFrame = global[vendors[i] + 'CancelAnimationFrame'] ||
            global[vendors[i] + 'CancelRequestAnimationFrame'];
    }

    if (!global.requestAnimationFrame) {
        global.requestAnimationFrame = function(callback) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = global.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!global.cancelAnimationFrame) {
        global.cancelAnimationFrame = function(id) {
            global.clearTimeout(id);
        };
    }

    return global.requestAnimationFrame;

}());

},{}],69:[function(require,module,exports){
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

},{}],70:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};// --------------------------------------------
// THIS MODULE IS COPIED TO THE BUILD DIRECTORY
// --------------------------------------------
// Which is where the 'pixi' package should
// have also been installed.

// These globals are shims to mimic the Pixi API.
// They are only available when using the bundles
// made with this module.

global.PIXI = require('pixi');
global.requestAnimFrame = require('pixi/utils/raf');

},{"pixi":38,"pixi/utils/raf":68}]},{},[70])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9JbnRlcmFjdGlvbk1hbmFnZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9jb3JlL2dsb2JhbHMuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L0Rpc3BsYXlPYmplY3QuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L01vdmllQ2xpcC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2Rpc3BsYXkvU3ByaXRlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZGlzcGxheS9TdGFnZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2Rpc3BsYXkvYmxlbmRNb2Rlcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2V2ZW50cy9FdmVudFRhcmdldC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2V4dHJhcy9DdXN0b21SZW5kZXJhYmxlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZXh0cmFzL1JvcGUuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvU3BpbmUuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvU3RyaXAuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvVGlsaW5nU3ByaXRlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9BYnN0cmFjdEZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvQmx1ckZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvQmx1clhGaWx0ZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL0JsdXJZRmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9Db2xvck1hdHJpeEZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvQ29sb3JTdGVwRmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9Dcm9zc0hhdGNoRmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9EaXNwbGFjZW1lbnRGaWx0ZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL0RvdFNjcmVlbkZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvRmlsdGVyQmxvY2suanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL0dyYXlGaWx0ZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL0ludmVydEZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvUGl4ZWxhdGVGaWx0ZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL1JHQlNwbGl0RmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9TZXBpYUZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvU21hcnRCbHVyRmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9Ud2lzdEZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vQ2lyY2xlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9FbGxpcHNlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9Qb2ludC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vUG9seWdvbi5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vUmVjdGFuZ2xlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9tYXRyaXguanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9pbmRleC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2xvYWRlcnMvQXNzZXRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9sb2FkZXJzL0JpdG1hcEZvbnRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9sb2FkZXJzL0ltYWdlTG9hZGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvbG9hZGVycy9Kc29uTG9hZGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvbG9hZGVycy9TcGluZUxvYWRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2xvYWRlcnMvU3ByaXRlU2hlZXRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9wbGF0Zm9ybS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3ByaW1pdGl2ZXMvR3JhcGhpY3MuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9yZW5kZXJlcnMvY2FudmFzL0NhbnZhc1JlbmRlcmVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL2NhbnZhcy9ncmFwaGljcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9QaXhpU2hhZGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL3dlYmdsL1ByaW1pdGl2ZVNoYWRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9TdHJpcFNoYWRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9XZWJHTEJhdGNoLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL3dlYmdsL1dlYkdMRmlsdGVyTWFuYWdlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9XZWJHTFJlbmRlckdyb3VwLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL3dlYmdsL1dlYkdMUmVuZGVyZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9yZW5kZXJlcnMvd2ViZ2wvY29tcGlsZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9ncmFwaGljcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9zaGFkZXJzLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dC9CaXRtYXBUZXh0LmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dC9UZXh0LmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dHVyZXMvQmFzZVRleHR1cmUuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS90ZXh0dXJlcy9SZW5kZXJUZXh0dXJlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dHVyZXMvVGV4dHVyZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3V0aWxzL1BvbHlrLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdXRpbHMvYXV0b0RldGVjdFJlbmRlcmVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdXRpbHMvY29sb3IuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS91dGlscy9kZWJ1Zy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3V0aWxzL3JhZi5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3V0aWxzL3NwaW5lLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvcGl4aS1kZWJ1Zy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2tCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDemdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsbUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3gwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4vZ2VvbS9Qb2ludCcpO1xudmFyIFNwcml0ZSA9IHJlcXVpcmUoJy4vZGlzcGxheS9TcHJpdGUnKTtcbnZhciBwbGF0Zm9ybSA9IHJlcXVpcmUoJy4vcGxhdGZvcm0nKTtcblxuLyoqXG4gKiBIb2xkcyBhbGwgaW5mb3JtYXRpb24gcmVsYXRlZCB0byBhbiBJbnRlcmFjdGlvbiBldmVudFxuICpcbiAqIEBjbGFzcyBJbnRlcmFjdGlvbkRhdGFcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBJbnRlcmFjdGlvbkRhdGEoKVxue1xuICAgIC8qKlxuICAgICAqIFRoaXMgcG9pbnQgc3RvcmVzIHRoZSB3b3JsZCBjb29yZHMgb2Ygd2hlcmUgdGhlIHRvdWNoL21vdXNlIGV2ZW50IGhhcHBlbmVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZ2xvYmFsXG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLmdsb2JhbCA9IG5ldyBQb2ludCgpO1xuXG4gICAgLy8gdGhpcyBpcyBoZXJlIGZvciBsZWdhY3kuLi4gYnV0IHdpbGwgcmVtb3ZlXG4gICAgdGhpcy5sb2NhbCA9IG5ldyBQb2ludCgpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRhcmdldCBTcHJpdGUgdGhhdCB3YXMgaW50ZXJhY3RlZCB3aXRoXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdGFyZ2V0XG4gICAgICogQHR5cGUgU3ByaXRlXG4gICAgICovXG4gICAgdGhpcy50YXJnZXQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogV2hlbiBwYXNzZWQgdG8gYW4gZXZlbnQgaGFuZGxlciwgdGhpcyB3aWxsIGJlIHRoZSBvcmlnaW5hbCBET00gRXZlbnQgdGhhdCB3YXMgY2FwdHVyZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBvcmlnaW5hbEV2ZW50XG4gICAgICogQHR5cGUgRXZlbnRcbiAgICAgKi9cbiAgICB0aGlzLm9yaWdpbmFsRXZlbnQgPSBudWxsO1xufVxuXG4vKipcbiAqIFRoaXMgd2lsbCByZXR1cm4gdGhlIGxvY2FsIGNvb3JkcyBvZiB0aGUgc3BlY2lmaWVkIGRpc3BsYXlPYmplY3QgZm9yIHRoaXMgSW50ZXJhY3Rpb25EYXRhXG4gKlxuICogQG1ldGhvZCBnZXRMb2NhbFBvc2l0aW9uXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gVGhlIERpc3BsYXlPYmplY3QgdGhhdCB5b3Ugd291bGQgbGlrZSB0aGUgbG9jYWwgY29vcmRzIG9mZlxuICogQHJldHVybiB7UG9pbnR9IEEgcG9pbnQgY29udGFpbmluZyB0aGUgY29vcmRzIG9mIHRoZSBJbnRlcmFjdGlvbkRhdGEgcG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIERpc3BsYXlPYmplY3RcbiAqL1xuSW50ZXJhY3Rpb25EYXRhLnByb3RvdHlwZS5nZXRMb2NhbFBvc2l0aW9uID0gZnVuY3Rpb24gZ2V0TG9jYWxQb3NpdGlvbihkaXNwbGF5T2JqZWN0KVxue1xuICAgIHZhciB3b3JsZFRyYW5zZm9ybSA9IGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm07XG4gICAgdmFyIHdvcmxkID0gdGhpcy5nbG9iYWw7XG5cbiAgICAvLyBkbyBhIGNoZWVreSB0cmFuc2Zvcm0gdG8gZ2V0IHRoZSBtb3VzZSBjb29yZHM7XG4gICAgdmFyIGEwMCA9IHdvcmxkVHJhbnNmb3JtWzBdLCBhMDEgPSB3b3JsZFRyYW5zZm9ybVsxXSwgYTAyID0gd29ybGRUcmFuc2Zvcm1bMl0sXG4gICAgICAgIGExMCA9IHdvcmxkVHJhbnNmb3JtWzNdLCBhMTEgPSB3b3JsZFRyYW5zZm9ybVs0XSwgYTEyID0gd29ybGRUcmFuc2Zvcm1bNV0sXG4gICAgICAgIGlkID0gMSAvIChhMDAgKiBhMTEgKyBhMDEgKiAtYTEwKTtcbiAgICAvLyBzZXQgdGhlIG1vdXNlIGNvb3Jkcy4uLlxuICAgIHJldHVybiBuZXcgUG9pbnQoYTExICogaWQgKiB3b3JsZC54ICsgLWEwMSAqIGlkICogd29ybGQueSArIChhMTIgKiBhMDEgLSBhMDIgKiBhMTEpICogaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYTAwICogaWQgKiB3b3JsZC55ICsgLWExMCAqIGlkICogd29ybGQueCArICgtYTEyICogYTAwICsgYTAyICogYTEwKSAqIGlkKTtcbn07XG5cbiAvKipcbiAqIFRoZSBpbnRlcmFjdGlvbiBtYW5hZ2VyIGRlYWxzIHdpdGggbW91c2UgYW5kIHRvdWNoIGV2ZW50cy4gQW55IERpc3BsYXlPYmplY3QgY2FuIGJlIGludGVyYWN0aXZlXG4gKiBUaGlzIG1hbmFnZXIgYWxzbyBzdXBwb3J0cyBtdWx0aXRvdWNoLlxuICpcbiAqIEBjbGFzcyBJbnRlcmFjdGlvbk1hbmFnZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHN0YWdlIHtTdGFnZX0gVGhlIHN0YWdlIHRvIGhhbmRsZSBpbnRlcmFjdGlvbnNcbiAqL1xuZnVuY3Rpb24gSW50ZXJhY3Rpb25NYW5hZ2VyKHN0YWdlKVxue1xuICAgIC8qKlxuICAgICAqIGEgcmVmZmVyZW5jZSB0byB0aGUgc3RhZ2VcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBzdGFnZVxuICAgICAqIEB0eXBlIFN0YWdlXG4gICAgICovXG4gICAgdGhpcy5zdGFnZSA9IHN0YWdlO1xuXG4gICAgLyoqXG4gICAgICogdGhlIG1vdXNlIGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBtb3VzZVxuICAgICAqIEB0eXBlIEludGVyYWN0aW9uRGF0YVxuICAgICAqL1xuICAgIHRoaXMubW91c2UgPSBuZXcgSW50ZXJhY3Rpb25EYXRhKCk7XG5cbiAgICAvKipcbiAgICAgKiBhbiBvYmplY3QgdGhhdCBzdG9yZXMgY3VycmVudCB0b3VjaGVzIChJbnRlcmFjdGlvbkRhdGEpIGJ5IGlkIHJlZmVyZW5jZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRvdWNoc1xuICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAqL1xuICAgIHRoaXMudG91Y2hzID0ge307XG5cbiAgICAvLyBoZWxwZXJzXG4gICAgdGhpcy50ZW1wUG9pbnQgPSBuZXcgUG9pbnQoKTtcbiAgICAvL3RoaXMudGVtcE1hdHJpeCA9ICBtYXQzLmNyZWF0ZSgpO1xuXG4gICAgdGhpcy5tb3VzZW92ZXJFbmFibGVkID0gdHJ1ZTtcblxuICAgIC8vdGlueSBsaXR0bGUgaW50ZXJhY3RpdmVEYXRhIHBvb2whXG4gICAgdGhpcy5wb29sID0gW107XG5cbiAgICB0aGlzLmludGVyYWN0aXZlSXRlbXMgPSBbXTtcbiAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudCA9IG51bGw7XG5cbiAgICB0aGlzLmxhc3QgPSAwO1xufVxuXG52YXIgcHJvdG8gPSBJbnRlcmFjdGlvbk1hbmFnZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIEV2ZW50TGlzdGVuZXIgaW50ZXJmYWNlXG4gKi9cbnByb3RvLmhhbmRsZUV2ZW50ID0gZnVuY3Rpb24gaGFuZGxlRXZlbnQoZXZlbnQpXG57XG4gICAgLypqc2hpbnQgLVcwMTUqL1xuICAgIHN3aXRjaCAoZXZlbnQudHlwZSkge1xuICAgIGNhc2UgJ21vdXNlZG93bicgOiB0aGlzLm9uTW91c2VEb3duKGV2ZW50KTsgYnJlYWs7XG4gICAgY2FzZSAnbW91c2Vtb3ZlJyA6IHRoaXMub25Nb3VzZU1vdmUoZXZlbnQpOyBicmVhaztcbiAgICBjYXNlICdtb3VzZXVwJyAgIDogdGhpcy5vbk1vdXNlVXAoZXZlbnQpOyAgIGJyZWFrO1xuICAgIGNhc2UgJ21vdXNlb3V0JyAgOiB0aGlzLm9uTW91c2VPdXQoZXZlbnQpOyAgYnJlYWs7XG5cbiAgICBjYXNlICd0b3VjaHN0YXJ0JyA6IHRoaXMub25Ub3VjaFN0YXJ0KGV2ZW50KTsgYnJlYWs7XG4gICAgY2FzZSAndG91Y2htb3ZlJyAgOiB0aGlzLm9uVG91Y2hNb3ZlKGV2ZW50KTsgIGJyZWFrO1xuICAgIGNhc2UgJ3RvdWNoZW5kJyAgIDogdGhpcy5vblRvdWNoRW5kKGV2ZW50KTsgICBicmVhaztcbiAgICB9XG59O1xuXG4vKipcbiAqIENvbGxlY3RzIGFuIGludGVyYWN0aXZlIHNwcml0ZSByZWN1cnNpdmVseSB0byBoYXZlIHRoZWlyIGludGVyYWN0aW9ucyBtYW5hZ2VkXG4gKlxuICogQG1ldGhvZCBjb2xsZWN0SW50ZXJhY3RpdmVTcHJpdGVcbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fSB0aGUgZGlzcGxheU9iamVjdCB0byBjb2xsZWN0XG4gKiBAcGFyYW0gaVBhcmVudCB7RGlzcGxheU9iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmNvbGxlY3RJbnRlcmFjdGl2ZVNwcml0ZSA9IGZ1bmN0aW9uIGNvbGxlY3RJbnRlcmFjdGl2ZVNwcml0ZShkaXNwbGF5T2JqZWN0LCBpUGFyZW50KVxue1xuICAgIHZhciBjaGlsZHJlbiA9IGRpc3BsYXlPYmplY3QuY2hpbGRyZW47XG5cbiAgICAvLy8gbWFrZSBhbiBpbnRlcmFjdGlvbiB0cmVlLi4uIHtpdGVtLl9faW50ZXJhY3RpdmVQYXJlbnR9XG4gICAgZm9yICh2YXIgaSA9IGNoaWxkcmVuLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKVxuICAgIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV07XG5cbi8vICAgICAgaWYoY2hpbGQudmlzaWJsZSkge1xuICAgICAgICAvLyBwdXNoIGFsbCBpbnRlcmFjdGl2ZSBiaXRzXG4gICAgICAgIGlmKGNoaWxkLmludGVyYWN0aXZlKVxuICAgICAgICB7XG4gICAgICAgICAgICBpUGFyZW50LmludGVyYWN0aXZlQ2hpbGRyZW4gPSB0cnVlO1xuICAgICAgICAgICAgLy9jaGlsZC5fX2lQYXJlbnQgPSBpUGFyZW50O1xuICAgICAgICAgICAgdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLnB1c2goY2hpbGQpO1xuXG4gICAgICAgICAgICBpZihjaGlsZC5jaGlsZHJlbi5sZW5ndGggPiAwKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRoaXMuY29sbGVjdEludGVyYWN0aXZlU3ByaXRlKGNoaWxkLCBjaGlsZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBjaGlsZC5fX2lQYXJlbnQgPSBudWxsO1xuXG4gICAgICAgICAgICBpZihjaGlsZC5jaGlsZHJlbi5sZW5ndGggPiAwKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRoaXMuY29sbGVjdEludGVyYWN0aXZlU3ByaXRlKGNoaWxkLCBpUGFyZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuLy8gICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBTZXRzIHRoZSB0YXJnZXQgZm9yIGV2ZW50IGRlbGVnYXRpb25cbiAqXG4gKiBAbWV0aG9kIHNldFRhcmdldFxuICogQHBhcmFtIHRhcmdldCB7V2ViR0xSZW5kZXJlcnxDYW52YXNSZW5kZXJlcn0gdGhlIHJlbmRlcmVyIHRvIGJpbmQgZXZlbnRzIHRvXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5zZXRUYXJnZXQgPSBmdW5jdGlvbiBzZXRUYXJnZXQodGFyZ2V0KVxue1xuICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgIGlmICh0aGlzLnRhcmdldCAhPT0gbnVsbCkgcGxhdGZvcm0ud2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50ID09PSBudWxsKSB7XG4gICAgICAgIHRoaXMuc2V0VGFyZ2V0RG9tRWxlbWVudCggdGFyZ2V0LnZpZXcgKTtcbiAgICB9XG5cbiAgICBwbGF0Zm9ybS53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMsIHRydWUpO1xuICAgIHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xufTtcblxuLyoqXG4gKiBTZXRzIHRoZSBkb20gZWxlbWVudCB3aGljaCB3aWxsIHJlY2VpdmUgbW91c2UvdG91Y2ggZXZlbnRzLiBUaGlzIGlzIHVzZWZ1bCBmb3Igd2hlbiB5b3UgaGF2ZSBvdGhlciBET01cbiAqIGVsZW1lbnRzIG9udG9wIG9mIHRoZSByZW5kZXJlcnMgQ2FudmFzIGVsZW1lbnQuIFdpdGggdGhpcyB5b3UnbGwgYmUgYWJsZSB0byBkZWxlZ2F0ZSBhbm90aGVyIGRvbSBlbGVtZW50XG4gKiB0byByZWNlaXZlIHRob3NlIGV2ZW50c1xuICpcbiAqIEBtZXRob2Qgc2V0VGFyZ2V0RG9tRWxlbWVudFxuICogQHBhcmFtIGRvbUVsZW1lbnQge0RPTUVsZW1lbnR9IHRoZSBkb20gZWxlbWVudCB3aGljaCB3aWxsIHJlY2VpdmUgbW91c2UgYW5kIHRvdWNoIGV2ZW50c1xuICogQHByaXZhdGVcbiAqL1xucHJvdG8uc2V0VGFyZ2V0RG9tRWxlbWVudCA9IGZ1bmN0aW9uIHNldFRhcmdldERvbUVsZW1lbnQoZG9tRWxlbWVudClcbntcbiAgICAvL3JlbW92ZSBwcmV2aW91c2UgbGlzdGVuZXJzXG4gICAgaWYgKHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50ICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnN0eWxlWyctbXMtY29udGVudC16b29taW5nJ10gPSAnJztcbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuc3R5bGVbJy1tcy10b3VjaC1hY3Rpb24nXSA9ICcnO1xuXG4gICAgICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMsIHRydWUpO1xuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLCB0cnVlKTtcbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VvdXQnLCB0aGlzLCB0cnVlKTtcbiAgICAgICAgLy8gYWludCBubyBtdWx0aSB0b3VjaCBqdXN0IHlldCFcbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMsIHRydWUpO1xuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMsIHRydWUpO1xuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLCB0cnVlKTtcbiAgICB9XG5cbiAgICB2YXIgbmF2aWdhdG9yID0gcGxhdGZvcm0ubmF2aWdhdG9yO1xuICAgIGlmIChuYXZpZ2F0b3IgJiYgbmF2aWdhdG9yLm1zUG9pbnRlckVuYWJsZWQpIHtcbiAgICAgICAgLy8gdGltZSB0byByZW1vdmUgc29tZSBvZiB0aGF0IHpvb20gaW4gamEuLlxuICAgICAgICBkb21FbGVtZW50LnN0eWxlWyctbXMtY29udGVudC16b29taW5nJ10gPSAnbm9uZSc7XG4gICAgICAgIGRvbUVsZW1lbnQuc3R5bGVbJy1tcy10b3VjaC1hY3Rpb24nXSA9ICdub25lJztcbiAgICAgICAgLy8gRE8gc29tZSB3aW5kb3cgc3BlY2lmaWMgdG91Y2ghXG4gICAgfVxuXG4gICAgZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLCB0cnVlKTtcbiAgICBkb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMsIHRydWUpO1xuICAgIGRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdXQnLCB0aGlzLCB0cnVlKTtcbiAgICAvLyBhaW50IG5vIG11bHRpIHRvdWNoIGp1c3QgeWV0IVxuICAgIGRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMsIHRydWUpO1xuICAgIGRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0aGlzLCB0cnVlKTtcbiAgICBkb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMsIHRydWUpO1xuXG4gICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQgPSBkb21FbGVtZW50O1xufTtcblxuXG4vKipcbiAqIHVwZGF0ZXMgdGhlIHN0YXRlIG9mIGludGVyYWN0aXZlIG9iamVjdHNcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8udXBkYXRlID0gZnVuY3Rpb24gdXBkYXRlKClcbntcbiAgICBpZighdGhpcy50YXJnZXQpcmV0dXJuO1xuXG4gICAgLy8gZnJlcXVlbmN5IG9mIDMwZnBzPz9cbiAgICB2YXIgbm93ID0gRGF0ZS5ub3coKTtcbiAgICB2YXIgZGlmZiA9IG5vdyAtIHRoaXMubGFzdDtcbiAgICBkaWZmID0gKGRpZmYgKiAzMCkgLyAxMDAwO1xuICAgIGlmIChkaWZmIDwgMSkgcmV0dXJuO1xuICAgIHRoaXMubGFzdCA9IG5vdztcbiAgICAvL1xuXG4gICAgdmFyIGksIGw7XG5cbiAgICAvLyBvay4uIHNvIG1vdXNlIGV2ZW50cz8/XG4gICAgLy8geWVzIGZvciBub3cgOilcbiAgICAvLyBPUFRJTVNFIC0gaG93IG9mdGVuIHRvIGNoZWNrPz9cbiAgICBpZih0aGlzLmRpcnR5KVxuICAgIHtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIGZvciAoaSA9IDAsIGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmludGVyYWN0aXZlSXRlbXNbaV0uaW50ZXJhY3RpdmVDaGlsZHJlbiA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zID0gW107XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhZ2UuaW50ZXJhY3RpdmUpIHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5wdXNoKHRoaXMuc3RhZ2UpO1xuICAgICAgICAvLyBnbyB0aHJvdWdoIGFuZCBjb2xsZWN0IGFsbCB0aGUgb2JqZWN0cyB0aGF0IGFyZSBpbnRlcmFjdGl2ZS4uXG4gICAgICAgIHRoaXMuY29sbGVjdEludGVyYWN0aXZlU3ByaXRlKHRoaXMuc3RhZ2UsIHRoaXMuc3RhZ2UpO1xuICAgIH1cblxuICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnN0eWxlLmN1cnNvciA9ICdpbmhlcml0JztcblxuICAgIC8vIGxvb3AgdGhyb3VnaCBpbnRlcmFjdGl2ZSBvYmplY3RzIVxuICAgIGZvciAoaSA9IDAsIGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGl0ZW0gPSB0aGlzLmludGVyYWN0aXZlSXRlbXNbaV07XG5cblxuICAgICAgICAvL2lmKCFpdGVtLnZpc2libGUpY29udGludWU7XG5cbiAgICAgICAgLy8gT1BUSU1JU0FUSU9OIC0gb25seSBjYWxjdWxhdGUgZXZlcnkgdGltZSBpZiB0aGUgbW91c2Vtb3ZlIGZ1bmN0aW9uIGV4aXN0cy4uXG4gICAgICAgIC8vIE9LIHNvLi4gZG9lcyB0aGUgb2JqZWN0IGhhdmUgYW55IG90aGVyIGludGVyYWN0aXZlIGZ1bmN0aW9ucz9cbiAgICAgICAgLy8gaGl0LXRlc3QgdGhlIGNsaXAhXG5cblxuICAgICAgICBpZihpdGVtLm1vdXNlb3ZlciB8fCBpdGVtLm1vdXNlb3V0IHx8IGl0ZW0uYnV0dG9uTW9kZSlcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gb2sgc28gdGhlcmUgYXJlIHNvbWUgZnVuY3Rpb25zIHNvIGxldHMgaGl0IHRlc3QgaXQuLlxuICAgICAgICAgICAgaXRlbS5fX2hpdCA9IHRoaXMuaGl0VGVzdChpdGVtLCB0aGlzLm1vdXNlKTtcbiAgICAgICAgICAgIHRoaXMubW91c2UudGFyZ2V0ID0gaXRlbTtcbiAgICAgICAgICAgIC8vIG9rIHNvIGRlYWwgd2l0aCBpbnRlcmFjdGlvbnMuLlxuICAgICAgICAgICAgLy8gbG9rcyBsaWtlIHRoZXJlIHdhcyBhIGhpdCFcbiAgICAgICAgICAgIGlmKGl0ZW0uX19oaXQpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWYoaXRlbS5idXR0b25Nb2RlKSB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5zdHlsZS5jdXJzb3IgPSBpdGVtLmRlZmF1bHRDdXJzb3I7XG5cbiAgICAgICAgICAgICAgICBpZighaXRlbS5fX2lzT3ZlcilcbiAgICAgICAgICAgICAgICB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5tb3VzZW92ZXIpaXRlbS5tb3VzZW92ZXIodGhpcy5tb3VzZSk7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uX19pc092ZXIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtLl9faXNPdmVyKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcm9sbCBvdXQhXG4gICAgICAgICAgICAgICAgICAgIGlmKGl0ZW0ubW91c2VvdXQpaXRlbS5tb3VzZW91dCh0aGlzLm1vdXNlKTtcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5fX2lzT3ZlciA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAtLS0+XG4gICAgfVxufTtcblxuLyoqXG4gKiBJcyBjYWxsZWQgd2hlbiB0aGUgbW91c2UgbW92ZXMgYWNjcm9zcyB0aGUgcmVuZGVyZXIgZWxlbWVudFxuICpcbiAqIEBtZXRob2Qgb25Nb3VzZU1vdmVcbiAqIEBwYXJhbSBldmVudCB7RXZlbnR9IFRoZSBET00gZXZlbnQgb2YgdGhlIG1vdXNlIG1vdmluZ1xuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Nb3VzZU1vdmUgPSBmdW5jdGlvbiBvbk1vdXNlTW92ZShldmVudClcbntcbiAgICB0aGlzLm1vdXNlLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcbiAgICAvLyBUT0RPIG9wdGltaXplIGJ5IG5vdCBjaGVjayBFVkVSWSBUSU1FISBtYXliZSBoYWxmIGFzIG9mdGVuPyAvL1xuICAgIHZhciByZWN0ID0gdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICB0aGlzLm1vdXNlLmdsb2JhbC54ID0gKGV2ZW50LmNsaWVudFggLSByZWN0LmxlZnQpICogKHRoaXMudGFyZ2V0LndpZHRoIC8gcmVjdC53aWR0aCk7XG4gICAgdGhpcy5tb3VzZS5nbG9iYWwueSA9IChldmVudC5jbGllbnRZIC0gcmVjdC50b3ApICogKCB0aGlzLnRhcmdldC5oZWlnaHQgLyByZWN0LmhlaWdodCk7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcbiAgICAgICAgaWYgKGl0ZW0ubW91c2Vtb3ZlKSB7XG4gICAgICAgICAgICAvL2NhbGwgdGhlIGZ1bmN0aW9uIVxuICAgICAgICAgICAgaXRlbS5tb3VzZW1vdmUodGhpcy5tb3VzZSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIElzIGNhbGxlZCB3aGVuIHRoZSBtb3VzZSBidXR0b24gaXMgcHJlc3NlZCBkb3duIG9uIHRoZSByZW5kZXJlciBlbGVtZW50XG4gKlxuICogQG1ldGhvZCBvbk1vdXNlRG93blxuICogQHBhcmFtIGV2ZW50IHtFdmVudH0gVGhlIERPTSBldmVudCBvZiBhIG1vdXNlIGJ1dHRvbiBiZWluZyBwcmVzc2VkIGRvd25cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uTW91c2VEb3duID0gZnVuY3Rpb24gb25Nb3VzZURvd24oZXZlbnQpXG57XG4gICAgdGhpcy5tb3VzZS5vcmlnaW5hbEV2ZW50ID0gZXZlbnQ7XG5cbiAgICAvLyBsb29wIHRocm91Z2ggaW50ZWFjdGlvbiB0cmVlLi4uXG4gICAgLy8gaGl0IHRlc3QgZWFjaCBpdGVtISAtPlxuICAgIC8vIGdldCBpbnRlcmFjdGl2ZSBpdGVtcyB1bmRlciBwb2ludD8/XG4gICAgLy9zdGFnZS5fX2lcblxuICAgIC8vIHdoaWxlXG4gICAgLy8gaGl0IHRlc3RcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcblxuICAgICAgICBpZihpdGVtLm1vdXNlZG93biB8fCBpdGVtLmNsaWNrKVxuICAgICAgICB7XG4gICAgICAgICAgICBpdGVtLl9fbW91c2VJc0Rvd24gPSB0cnVlO1xuICAgICAgICAgICAgaXRlbS5fX2hpdCA9IHRoaXMuaGl0VGVzdChpdGVtLCB0aGlzLm1vdXNlKTtcblxuICAgICAgICAgICAgaWYoaXRlbS5fX2hpdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvL2NhbGwgdGhlIGZ1bmN0aW9uIVxuICAgICAgICAgICAgICAgIGlmKGl0ZW0ubW91c2Vkb3duKWl0ZW0ubW91c2Vkb3duKHRoaXMubW91c2UpO1xuICAgICAgICAgICAgICAgIGl0ZW0uX19pc0Rvd24gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgLy8ganVzdCB0aGUgb25lIVxuICAgICAgICAgICAgICAgIGlmKCFpdGVtLmludGVyYWN0aXZlQ2hpbGRyZW4pYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5wcm90by5vbk1vdXNlT3V0ID0gZnVuY3Rpb24gb25Nb3VzZU91dCgpXG57XG4gICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuc3R5bGUuY3Vyc29yID0gJ2luaGVyaXQnO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGl0ZW0gPSB0aGlzLmludGVyYWN0aXZlSXRlbXNbaV07XG5cbiAgICAgICAgaWYoaXRlbS5fX2lzT3ZlcilcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5tb3VzZS50YXJnZXQgPSBpdGVtO1xuICAgICAgICAgICAgaWYoaXRlbS5tb3VzZW91dClpdGVtLm1vdXNlb3V0KHRoaXMubW91c2UpO1xuICAgICAgICAgICAgaXRlbS5fX2lzT3ZlciA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBJcyBjYWxsZWQgd2hlbiB0aGUgbW91c2UgYnV0dG9uIGlzIHJlbGVhc2VkIG9uIHRoZSByZW5kZXJlciBlbGVtZW50XG4gKlxuICogQG1ldGhvZCBvbk1vdXNlVXBcbiAqIEBwYXJhbSBldmVudCB7RXZlbnR9IFRoZSBET00gZXZlbnQgb2YgYSBtb3VzZSBidXR0b24gYmVpbmcgcmVsZWFzZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uTW91c2VVcCA9IGZ1bmN0aW9uIG9uTW91c2VVcChldmVudClcbntcbiAgICB0aGlzLm1vdXNlLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcblxuICAgIHZhciB1cCA9IGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGl0ZW0gPSB0aGlzLmludGVyYWN0aXZlSXRlbXNbaV07XG5cbiAgICAgICAgaWYoaXRlbS5tb3VzZXVwIHx8IGl0ZW0ubW91c2V1cG91dHNpZGUgfHwgaXRlbS5jbGljaylcbiAgICAgICAge1xuICAgICAgICAgICAgaXRlbS5fX2hpdCA9IHRoaXMuaGl0VGVzdChpdGVtLCB0aGlzLm1vdXNlKTtcblxuICAgICAgICAgICAgaWYoaXRlbS5fX2hpdCAmJiAhdXApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy9jYWxsIHRoZSBmdW5jdGlvbiFcbiAgICAgICAgICAgICAgICBpZihpdGVtLm1vdXNldXApXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpdGVtLm1vdXNldXAodGhpcy5tb3VzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmKGl0ZW0uX19pc0Rvd24pXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZihpdGVtLmNsaWNrKWl0ZW0uY2xpY2sodGhpcy5tb3VzZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFpdGVtLmludGVyYWN0aXZlQ2hpbGRyZW4pIHVwID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtLl9faXNEb3duKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5tb3VzZXVwb3V0c2lkZSlpdGVtLm1vdXNldXBvdXRzaWRlKHRoaXMubW91c2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaXRlbS5fX2lzRG93biA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBUZXN0cyBpZiB0aGUgY3VycmVudCBtb3VzZSBjb29yZHMgaGl0IGEgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBoaXRUZXN0XG4gKiBAcGFyYW0gaXRlbSB7RGlzcGxheU9iamVjdH0gVGhlIGRpc3BsYXlPYmplY3QgdG8gdGVzdCBmb3IgYSBoaXRcbiAqIEBwYXJhbSBpbnRlcmFjdGlvbkRhdGEge0ludGVyYWN0aW9uRGF0YX0gVGhlIGludGVyYWN0aW9uZGF0YSBvYmplY3QgdG8gdXBkYXRlIGluIHRoZSBjYXNlIG9mIGEgaGl0XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5oaXRUZXN0ID0gZnVuY3Rpb24gaGl0VGVzdChpdGVtLCBpbnRlcmFjdGlvbkRhdGEpXG57XG4gICAgdmFyIHdvcmxkID0gaW50ZXJhY3Rpb25EYXRhLmdsb2JhbDtcblxuICAgIGlmKGl0ZW0udmNvdW50ICE9PSBnbG9iYWxzLnZpc2libGVDb3VudClyZXR1cm4gZmFsc2U7XG5cbiAgICB2YXIgaXNTcHJpdGUgPSAoaXRlbSBpbnN0YW5jZW9mIFNwcml0ZSksXG4gICAgICAgIHdvcmxkVHJhbnNmb3JtID0gaXRlbS53b3JsZFRyYW5zZm9ybSxcbiAgICAgICAgYTAwID0gd29ybGRUcmFuc2Zvcm1bMF0sIGEwMSA9IHdvcmxkVHJhbnNmb3JtWzFdLCBhMDIgPSB3b3JsZFRyYW5zZm9ybVsyXSxcbiAgICAgICAgYTEwID0gd29ybGRUcmFuc2Zvcm1bM10sIGExMSA9IHdvcmxkVHJhbnNmb3JtWzRdLCBhMTIgPSB3b3JsZFRyYW5zZm9ybVs1XSxcbiAgICAgICAgaWQgPSAxIC8gKGEwMCAqIGExMSArIGEwMSAqIC1hMTApLFxuICAgICAgICB4ID0gYTExICogaWQgKiB3b3JsZC54ICsgLWEwMSAqIGlkICogd29ybGQueSArIChhMTIgKiBhMDEgLSBhMDIgKiBhMTEpICogaWQsXG4gICAgICAgIHkgPSBhMDAgKiBpZCAqIHdvcmxkLnkgKyAtYTEwICogaWQgKiB3b3JsZC54ICsgKC1hMTIgKiBhMDAgKyBhMDIgKiBhMTApICogaWQ7XG5cbiAgICBpbnRlcmFjdGlvbkRhdGEudGFyZ2V0ID0gaXRlbTtcblxuICAgIC8vYSBzcHJpdGUgb3IgZGlzcGxheSBvYmplY3Qgd2l0aCBhIGhpdCBhcmVhIGRlZmluZWRcbiAgICBpZihpdGVtLmhpdEFyZWEgJiYgaXRlbS5oaXRBcmVhLmNvbnRhaW5zKSB7XG4gICAgICAgIGlmKGl0ZW0uaGl0QXJlYS5jb250YWlucyh4LCB5KSkge1xuICAgICAgICAgICAgLy9pZihpc1Nwcml0ZSlcbiAgICAgICAgICAgIGludGVyYWN0aW9uRGF0YS50YXJnZXQgPSBpdGVtO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gYSBzcHJpdGUgd2l0aCBubyBoaXRhcmVhIGRlZmluZWRcbiAgICBlbHNlIGlmKGlzU3ByaXRlKVxuICAgIHtcbiAgICAgICAgdmFyIHdpZHRoID0gaXRlbS50ZXh0dXJlLmZyYW1lLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0ID0gaXRlbS50ZXh0dXJlLmZyYW1lLmhlaWdodCxcbiAgICAgICAgICAgIHgxID0gLXdpZHRoICogaXRlbS5hbmNob3IueCxcbiAgICAgICAgICAgIHkxO1xuXG4gICAgICAgIGlmKHggPiB4MSAmJiB4IDwgeDEgKyB3aWR0aClcbiAgICAgICAge1xuICAgICAgICAgICAgeTEgPSAtaGVpZ2h0ICogaXRlbS5hbmNob3IueTtcblxuICAgICAgICAgICAgaWYoeSA+IHkxICYmIHkgPCB5MSArIGhlaWdodClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIHRhcmdldCBwcm9wZXJ0eSBpZiBhIGhpdCBpcyB0cnVlIVxuICAgICAgICAgICAgICAgIGludGVyYWN0aW9uRGF0YS50YXJnZXQgPSBpdGVtO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBpdGVtLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciB0ZW1wSXRlbSA9IGl0ZW0uY2hpbGRyZW5baV07XG4gICAgICAgIHZhciBoaXQgPSB0aGlzLmhpdFRlc3QodGVtcEl0ZW0sIGludGVyYWN0aW9uRGF0YSk7XG4gICAgICAgIGlmKGhpdClcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gaG1tLi4gVE9ETyBTRVQgQ09SUkVDVCBUQVJHRVQ/XG4gICAgICAgICAgICBpbnRlcmFjdGlvbkRhdGEudGFyZ2V0ID0gaXRlbTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxuLyoqXG4gKiBJcyBjYWxsZWQgd2hlbiBhIHRvdWNoIGlzIG1vdmVkIGFjY3Jvc3MgdGhlIHJlbmRlcmVyIGVsZW1lbnRcbiAqXG4gKiBAbWV0aG9kIG9uVG91Y2hNb3ZlXG4gKiBAcGFyYW0gZXZlbnQge0V2ZW50fSBUaGUgRE9NIGV2ZW50IG9mIGEgdG91Y2ggbW92aW5nIGFjY3Jvc3MgdGhlIHJlbmRlcmVyIHZpZXdcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uVG91Y2hNb3ZlID0gZnVuY3Rpb24gb25Ub3VjaE1vdmUoZXZlbnQpXG57XG4gICAgdmFyIHJlY3QgPSB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgY2hhbmdlZFRvdWNoZXMgPSBldmVudC5jaGFuZ2VkVG91Y2hlcyxcbiAgICAgICAgaSwgbCwgdG91Y2hFdmVudCwgdG91Y2hEYXRhLCBpaSwgbGwsIGl0ZW07XG5cbiAgICBmb3IgKGkgPSAwLCBsID0gY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdG91Y2hFdmVudCA9IGNoYW5nZWRUb3VjaGVzW2ldO1xuICAgICAgICB0b3VjaERhdGEgPSB0aGlzLnRvdWNoc1t0b3VjaEV2ZW50LmlkZW50aWZpZXJdO1xuICAgICAgICB0b3VjaERhdGEub3JpZ2luYWxFdmVudCA9IGV2ZW50O1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgdG91Y2ggcG9zaXRpb25cbiAgICAgICAgdG91Y2hEYXRhLmdsb2JhbC54ID0gKHRvdWNoRXZlbnQuY2xpZW50WCAtIHJlY3QubGVmdCkgKiAodGhpcy50YXJnZXQud2lkdGggLyByZWN0LndpZHRoKTtcbiAgICAgICAgdG91Y2hEYXRhLmdsb2JhbC55ID0gKHRvdWNoRXZlbnQuY2xpZW50WSAtIHJlY3QudG9wKSAgKiAodGhpcy50YXJnZXQuaGVpZ2h0IC8gcmVjdC5oZWlnaHQpO1xuXG4gICAgICAgIGZvciAoaWkgPSAwLCBsbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGlpIDwgbGw7IGlpKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0ZW0gPSB0aGlzLmludGVyYWN0aXZlSXRlbXNbaV07XG4gICAgICAgICAgICBpZiAoaXRlbS50b3VjaG1vdmUpIGl0ZW0udG91Y2htb3ZlKHRvdWNoRGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIElzIGNhbGxlZCB3aGVuIGEgdG91Y2ggaXMgc3RhcnRlZCBvbiB0aGUgcmVuZGVyZXIgZWxlbWVudFxuICpcbiAqIEBtZXRob2Qgb25Ub3VjaFN0YXJ0XG4gKiBAcGFyYW0gZXZlbnQge0V2ZW50fSBUaGUgRE9NIGV2ZW50IG9mIGEgdG91Y2ggc3RhcnRpbmcgb24gdGhlIHJlbmRlcmVyIHZpZXdcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uVG91Y2hTdGFydCA9IGZ1bmN0aW9uIG9uVG91Y2hTdGFydChldmVudClcbntcbiAgICB2YXIgcmVjdCA9IHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuICAgICAgICBjaGFuZ2VkVG91Y2hlcyA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgdG91Y2hFdmVudCA9IGNoYW5nZWRUb3VjaGVzW2ldO1xuXG4gICAgICAgIHZhciB0b3VjaERhdGEgPSB0aGlzLnBvb2wucG9wKCk7XG4gICAgICAgIGlmICghdG91Y2hEYXRhKSB0b3VjaERhdGEgPSBuZXcgSW50ZXJhY3Rpb25EYXRhKCk7XG5cbiAgICAgICAgdG91Y2hEYXRhLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcblxuICAgICAgICB0aGlzLnRvdWNoc1t0b3VjaEV2ZW50LmlkZW50aWZpZXJdID0gdG91Y2hEYXRhO1xuICAgICAgICB0b3VjaERhdGEuZ2xvYmFsLnggPSAodG91Y2hFdmVudC5jbGllbnRYIC0gcmVjdC5sZWZ0KSAqICh0aGlzLnRhcmdldC53aWR0aCAvIHJlY3Qud2lkdGgpO1xuICAgICAgICB0b3VjaERhdGEuZ2xvYmFsLnkgPSAodG91Y2hFdmVudC5jbGllbnRZIC0gcmVjdC50b3ApICAqICh0aGlzLnRhcmdldC5oZWlnaHQgLyByZWN0LmhlaWdodCk7XG5cbiAgICAgICAgZm9yICh2YXIgaWkgPSAwLCBsbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGlpIDwgbGw7IGlpKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciBpdGVtID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2lpXTtcblxuICAgICAgICAgICAgaWYgKGl0ZW0udG91Y2hzdGFydCB8fCBpdGVtLnRhcClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpdGVtLl9faGl0ID0gdGhpcy5oaXRUZXN0KGl0ZW0sIHRvdWNoRGF0YSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoaXRlbS5fX2hpdClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIC8vY2FsbCB0aGUgZnVuY3Rpb24hXG4gICAgICAgICAgICAgICAgICAgIGlmIChpdGVtLnRvdWNoc3RhcnQpIGl0ZW0udG91Y2hzdGFydCh0b3VjaERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpdGVtLl9faXNEb3duID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5fX3RvdWNoRGF0YSA9IHRvdWNoRGF0YTtcblxuICAgICAgICAgICAgICAgICAgICBpZighaXRlbS5pbnRlcmFjdGl2ZUNoaWxkcmVuKWJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogSXMgY2FsbGVkIHdoZW4gYSB0b3VjaCBpcyBlbmRlZCBvbiB0aGUgcmVuZGVyZXIgZWxlbWVudFxuICpcbiAqIEBtZXRob2Qgb25Ub3VjaEVuZFxuICogQHBhcmFtIGV2ZW50IHtFdmVudH0gVGhlIERPTSBldmVudCBvZiBhIHRvdWNoIGVuZGluZyBvbiB0aGUgcmVuZGVyZXIgdmlld1xuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Ub3VjaEVuZCA9IGZ1bmN0aW9uIG9uVG91Y2hFbmQoZXZlbnQpXG57XG4gICAgLy90aGlzLm1vdXNlLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcbiAgICB2YXIgcmVjdCA9IHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuICAgICAgICBjaGFuZ2VkVG91Y2hlcyA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgdG91Y2hFdmVudCA9IGNoYW5nZWRUb3VjaGVzW2ldO1xuICAgICAgICB2YXIgdG91Y2hEYXRhID0gdGhpcy50b3VjaHNbdG91Y2hFdmVudC5pZGVudGlmaWVyXTtcbiAgICAgICAgdmFyIHVwID0gZmFsc2U7XG4gICAgICAgIHRvdWNoRGF0YS5nbG9iYWwueCA9ICh0b3VjaEV2ZW50LmNsaWVudFggLSByZWN0LmxlZnQpICogKHRoaXMudGFyZ2V0LndpZHRoIC8gcmVjdC53aWR0aCk7XG4gICAgICAgIHRvdWNoRGF0YS5nbG9iYWwueSA9ICh0b3VjaEV2ZW50LmNsaWVudFkgLSByZWN0LnRvcCkgICogKHRoaXMudGFyZ2V0LmhlaWdodCAvIHJlY3QuaGVpZ2h0KTtcblxuICAgICAgICBmb3IgKHZhciBpaSA9IDAsIGxsID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aDsgaWkgPCBsbDsgaWkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIGl0ZW0gPSB0aGlzLmludGVyYWN0aXZlSXRlbXNbaWldO1xuICAgICAgICAgICAgdmFyIGl0ZW1Ub3VjaERhdGEgPSBpdGVtLl9fdG91Y2hEYXRhOyAvLyA8LS0gSGVyZSFcbiAgICAgICAgICAgIGl0ZW0uX19oaXQgPSB0aGlzLmhpdFRlc3QoaXRlbSwgdG91Y2hEYXRhKTtcblxuICAgICAgICAgICAgaWYoaXRlbVRvdWNoRGF0YSA9PT0gdG91Y2hEYXRhKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIHNvIHRoaXMgb25lIFdBUyBkb3duLi4uXG4gICAgICAgICAgICAgICAgdG91Y2hEYXRhLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcbiAgICAgICAgICAgICAgICAvLyBoaXRUZXN0Pz9cblxuICAgICAgICAgICAgICAgIGlmKGl0ZW0udG91Y2hlbmQgfHwgaXRlbS50YXApXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZihpdGVtLl9faGl0ICYmICF1cClcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS50b3VjaGVuZClpdGVtLnRvdWNoZW5kKHRvdWNoRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihpdGVtLl9faXNEb3duKVxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGl0ZW0udGFwKWl0ZW0udGFwKHRvdWNoRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFpdGVtLmludGVyYWN0aXZlQ2hpbGRyZW4pdXAgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5fX2lzRG93bilcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpdGVtLnRvdWNoZW5kb3V0c2lkZSlpdGVtLnRvdWNoZW5kb3V0c2lkZSh0b3VjaERhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaXRlbS5fX2lzRG93biA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGl0ZW0uX190b3VjaERhdGEgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbW92ZSB0aGUgdG91Y2guLlxuICAgICAgICB0aGlzLnBvb2wucHVzaCh0b3VjaERhdGEpO1xuICAgICAgICB0aGlzLnRvdWNoc1t0b3VjaEV2ZW50LmlkZW50aWZpZXJdID0gbnVsbDtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEludGVyYWN0aW9uTWFuYWdlcjtcbiIsIi8qKlxuICogQGF1dGhvciBEci4gS2liaXR6IDxpbmZvQGRya2liaXR6LmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAvLyBhdXRvRGV0ZWN0ZWQ6IGZhbHNlLFxuXG4gICAgZ2w6IG51bGwsXG4gICAgcHJpbWl0aXZlU2hhZGVyOiBudWxsLFxuICAgIHN0cmlwU2hhZGVyOiBudWxsLFxuICAgIGRlZmF1bHRTaGFkZXI6IG51bGwsXG5cbiAgICBvZmZzZXQ6IG51bGwsXG4gICAgcHJvamVjdGlvbjpudWxsLFxuXG4gICAgdGV4dHVyZXNUb1VwZGF0ZTogW10sXG4gICAgdGV4dHVyZXNUb0Rlc3Ryb3k6IFtdLFxuICAgIHZpc2libGVDb3VudDogMFxufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cblxudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBtYXQzID0gcmVxdWlyZSgnLi4vZ2VvbS9tYXRyaXgnKS5tYXQzO1xuXG52YXIgRmlsdGVyQmxvY2sgPSByZXF1aXJlKCcuLi9maWx0ZXJzL0ZpbHRlckJsb2NrJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi9nZW9tL1BvaW50Jyk7XG52YXIgUmVjdGFuZ2xlID0gcmVxdWlyZSgnLi4vZ2VvbS9SZWN0YW5nbGUnKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBjbGFzcyBmb3IgYWxsIG9iamVjdHMgdGhhdCBhcmUgcmVuZGVyZWQgb24gdGhlIHNjcmVlbi5cbiAqXG4gKiBAY2xhc3MgRGlzcGxheU9iamVjdFxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERpc3BsYXlPYmplY3QoKVxue1xuICAgIHRoaXMubGFzdCA9IHRoaXM7XG4gICAgdGhpcy5maXJzdCA9IHRoaXM7XG4gICAgLyoqXG4gICAgICogVGhlIGNvb3JkaW5hdGUgb2YgdGhlIG9iamVjdCByZWxhdGl2ZSB0byB0aGUgbG9jYWwgY29vcmRpbmF0ZXMgb2YgdGhlIHBhcmVudC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBwb3NpdGlvblxuICAgICAqIEB0eXBlIFBvaW50XG4gICAgICovXG4gICAgdGhpcy5wb3NpdGlvbiA9IG5ldyBQb2ludCgpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNjYWxlIGZhY3RvciBvZiB0aGUgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHNjYWxlXG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLnNjYWxlID0gbmV3IFBvaW50KDEsMSk7Ly97eDoxLCB5OjF9O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHBpdm90IHBvaW50IG9mIHRoZSBkaXNwbGF5T2JqZWN0IHRoYXQgaXQgcm90YXRlcyBhcm91bmRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBwaXZvdFxuICAgICAqIEB0eXBlIFBvaW50XG4gICAgICovXG4gICAgdGhpcy5waXZvdCA9IG5ldyBQb2ludCgwLDApO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJvdGF0aW9uIG9mIHRoZSBvYmplY3QgaW4gcmFkaWFucy5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSByb3RhdGlvblxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHRoaXMucm90YXRpb24gPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG9wYWNpdHkgb2YgdGhlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBhbHBoYVxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHRoaXMuYWxwaGEgPSAxO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZpc2liaWxpdHkgb2YgdGhlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB2aXNpYmxlXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMudmlzaWJsZSA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGlzIHRoZSBkZWZpbmVkIGFyZWEgdGhhdCB3aWxsIHBpY2sgdXAgbW91c2UgLyB0b3VjaCBldmVudHMuIEl0IGlzIG51bGwgYnkgZGVmYXVsdC5cbiAgICAgKiBTZXR0aW5nIGl0IGlzIGEgbmVhdCB3YXkgb2Ygb3B0aW1pc2luZyB0aGUgaGl0VGVzdCBmdW5jdGlvbiB0aGF0IHRoZSBpbnRlcmFjdGlvbk1hbmFnZXIgd2lsbCB1c2UgKGFzIGl0IHdpbGwgbm90IG5lZWQgdG8gaGl0IHRlc3QgYWxsIHRoZSBjaGlsZHJlbilcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBoaXRBcmVhXG4gICAgICogQHR5cGUgUmVjdGFuZ2xlfENpcmNsZXxFbGxpcHNlfFBvbHlnb25cbiAgICAgKi9cbiAgICB0aGlzLmhpdEFyZWEgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhpcyBpcyB1c2VkIHRvIGluZGljYXRlIGlmIHRoZSBkaXNwbGF5T2JqZWN0IHNob3VsZCBkaXNwbGF5IGEgbW91c2UgaGFuZCBjdXJzb3Igb24gcm9sbG92ZXJcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBidXR0b25Nb2RlXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMuYnV0dG9uTW9kZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQ2FuIHRoaXMgb2JqZWN0IGJlIHJlbmRlcmVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgcmVuZGVyYWJsZVxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLnJlbmRlcmFibGUgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBkaXNwbGF5IG9iamVjdCBjb250YWluZXIgdGhhdCBjb250YWlucyB0aGlzIGRpc3BsYXkgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHBhcmVudFxuICAgICAqIEB0eXBlIERpc3BsYXlPYmplY3RDb250YWluZXJcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLnBhcmVudCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgc3RhZ2UgdGhlIGRpc3BsYXkgb2JqZWN0IGlzIGNvbm5lY3RlZCB0bywgb3IgdW5kZWZpbmVkIGlmIGl0IGlzIG5vdCBjb25uZWN0ZWQgdG8gdGhlIHN0YWdlLlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHN0YWdlXG4gICAgICogQHR5cGUgU3RhZ2VcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLnN0YWdlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBtdWx0aXBsaWVkIGFscGhhIG9mIHRoZSBkaXNwbGF5b2JqZWN0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgd29ybGRBbHBoYVxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMud29ybGRBbHBoYSA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBXaGV0aGVyIG9yIG5vdCB0aGUgb2JqZWN0IGlzIGludGVyYWN0aXZlLCBkbyBub3QgdG9nZ2xlIGRpcmVjdGx5ISB1c2UgdGhlIGBpbnRlcmFjdGl2ZWAgcHJvcGVydHlcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBfaW50ZXJhY3RpdmVcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICogQHJlYWRPbmx5XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl9pbnRlcmFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgdGhpcy5kZWZhdWx0Q3Vyc29yID0gJ3BvaW50ZXInO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gQ3VycmVudCB0cmFuc2Zvcm0gb2YgdGhlIG9iamVjdCBiYXNlZCBvbiB3b3JsZCAocGFyZW50KSBmYWN0b3JzXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgd29ybGRUcmFuc2Zvcm1cbiAgICAgKiBAdHlwZSBNYXQzXG4gICAgICogQHJlYWRPbmx5XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLndvcmxkVHJhbnNmb3JtID0gbWF0My5jcmVhdGUoKTsvL21hdDMuaWRlbnRpdHkoKTtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIEN1cnJlbnQgdHJhbnNmb3JtIG9mIHRoZSBvYmplY3QgbG9jYWxseVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGxvY2FsVHJhbnNmb3JtXG4gICAgICogQHR5cGUgTWF0M1xuICAgICAqIEByZWFkT25seVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5sb2NhbFRyYW5zZm9ybSA9IG1hdDMuY3JlYXRlKCk7Ly9tYXQzLmlkZW50aXR5KCk7XG5cbiAgICAvKipcbiAgICAgKiBbTllJXSBVbmtvd25cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjb2xvclxuICAgICAqIEB0eXBlIEFycmF5PD5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuY29sb3IgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIFtOWUldIEhvbGRzIHdoZXRoZXIgb3Igbm90IHRoaXMgb2JqZWN0IGlzIGR5bmFtaWMsIGZvciByZW5kZXJpbmcgb3B0aW1pemF0aW9uXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZHluYW1pY1xuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuZHluYW1pYyA9IHRydWU7XG5cbiAgICAvLyBjaGFjaCB0aGF0IHB1cHB5IVxuICAgIHRoaXMuX3NyID0gMDtcbiAgICB0aGlzLl9jciA9IDE7XG5cblxuICAgIHRoaXMuZmlsdGVyQXJlYSA9IG5ldyBSZWN0YW5nbGUoMCwwLDEsMSk7XG5cbiAgICAvKlxuICAgICAqIE1PVVNFIENhbGxiYWNrc1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlcnMgY2xpY2tzIG9uIHRoZSBkaXNwbGF5T2JqZWN0IHdpdGggdGhlaXIgbW91c2VcbiAgICAgKiBAbWV0aG9kIGNsaWNrXG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlciBjbGlja3MgdGhlIG1vdXNlIGRvd24gb3ZlciB0aGUgc3ByaXRlXG4gICAgICogQG1ldGhvZCBtb3VzZWRvd25cbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIHJlbGVhc2VzIHRoZSBtb3VzZSB0aGF0IHdhcyBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0XG4gICAgICogZm9yIHRoaXMgY2FsbGJhY2sgdG8gYmUgZmlyZWQgdGhlIG1vdXNlIG11c3QgaGF2ZSBiZWVuIHByZXNzZWQgZG93biBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0XG4gICAgICogQG1ldGhvZCBtb3VzZXVwXG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlciByZWxlYXNlcyB0aGUgbW91c2UgdGhhdCB3YXMgb3ZlciB0aGUgZGlzcGxheU9iamVjdCBidXQgaXMgbm8gbG9uZ2VyIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBmb3IgdGhpcyBjYWxsYmFjayB0byBiZSBmaXJlZCwgVGhlIHRvdWNoIG11c3QgaGF2ZSBzdGFydGVkIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBAbWV0aG9kIG1vdXNldXBvdXRzaWRlXG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlcnMgbW91c2Ugcm9sbHMgb3ZlciB0aGUgZGlzcGxheU9iamVjdFxuICAgICAqIEBtZXRob2QgbW91c2VvdmVyXG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlcnMgbW91c2UgbGVhdmVzIHRoZSBkaXNwbGF5T2JqZWN0XG4gICAgICogQG1ldGhvZCBtb3VzZW91dFxuICAgICAqIEBwYXJhbSBpbnRlcmFjdGlvbkRhdGEge0ludGVyYWN0aW9uRGF0YX1cbiAgICAgKi9cblxuXG4gICAgLypcbiAgICAgKiBUT1VDSCBDYWxsYmFja3NcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEEgY2FsbGJhY2sgdGhhdCBpcyB1c2VkIHdoZW4gdGhlIHVzZXJzIHRhcHMgb24gdGhlIHNwcml0ZSB3aXRoIHRoZWlyIGZpbmdlclxuICAgICAqIGJhc2ljYWxseSBhIHRvdWNoIHZlcnNpb24gb2YgY2xpY2tcbiAgICAgKiBAbWV0aG9kIHRhcFxuICAgICAqIEBwYXJhbSBpbnRlcmFjdGlvbkRhdGEge0ludGVyYWN0aW9uRGF0YX1cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEEgY2FsbGJhY2sgdGhhdCBpcyB1c2VkIHdoZW4gdGhlIHVzZXIgdG91Y2gncyBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0XG4gICAgICogQG1ldGhvZCB0b3VjaHN0YXJ0XG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlciByZWxlYXNlcyBhIHRvdWNoIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBAbWV0aG9kIHRvdWNoZW5kXG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlciByZWxlYXNlcyB0aGUgdG91Y2ggdGhhdCB3YXMgb3ZlciB0aGUgZGlzcGxheU9iamVjdFxuICAgICAqIGZvciB0aGlzIGNhbGxiYWNrIHRvIGJlIGZpcmVkLCBUaGUgdG91Y2ggbXVzdCBoYXZlIHN0YXJ0ZWQgb3ZlciB0aGUgc3ByaXRlXG4gICAgICogQG1ldGhvZCB0b3VjaGVuZG91dHNpZGVcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG59XG52YXIgcHJvdG8gPSBEaXNwbGF5T2JqZWN0LnByb3RvdHlwZTtcblxuLyoqXG4gKiBbRGVwcmVjYXRlZF0gSW5kaWNhdGVzIGlmIHRoZSBzcHJpdGUgd2lsbCBoYXZlIHRvdWNoIGFuZCBtb3VzZSBpbnRlcmFjdGl2aXR5LiBJdCBpcyBmYWxzZSBieSBkZWZhdWx0XG4gKiBJbnN0ZWFkIG9mIHVzaW5nIHRoaXMgZnVuY3Rpb24geW91IGNhbiBub3cgc2ltcGx5IHNldCB0aGUgaW50ZXJhY3RpdmUgcHJvcGVydHkgdG8gdHJ1ZSBvciBmYWxzZVxuICpcbiAqIEBtZXRob2Qgc2V0SW50ZXJhY3RpdmVcbiAqIEBwYXJhbSBpbnRlcmFjdGl2ZSB7Qm9vbGVhbn1cbiAqIEBkZXByZWNhdGVkIFNpbXBseSBzZXQgdGhlIGBpbnRlcmFjdGl2ZWAgcHJvcGVydHkgZGlyZWN0bHlcbiAqL1xucHJvdG8uc2V0SW50ZXJhY3RpdmUgPSBmdW5jdGlvbihpbnRlcmFjdGl2ZSlcbntcbiAgICB0aGlzLmludGVyYWN0aXZlID0gaW50ZXJhY3RpdmU7XG59O1xuXG4vKipcbiAqIEluZGljYXRlcyBpZiB0aGUgc3ByaXRlIHdpbGwgaGF2ZSB0b3VjaCBhbmQgbW91c2UgaW50ZXJhY3Rpdml0eS4gSXQgaXMgZmFsc2UgYnkgZGVmYXVsdFxuICpcbiAqIEBwcm9wZXJ0eSBpbnRlcmFjdGl2ZVxuICogQHR5cGUgQm9vbGVhblxuICogQGRlZmF1bHQgZmFsc2VcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnaW50ZXJhY3RpdmUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludGVyYWN0aXZlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9pbnRlcmFjdGl2ZSA9IHZhbHVlO1xuXG4gICAgICAgIC8vIFRPRE8gbW9yZSB0byBiZSBkb25lIGhlcmUuLlxuICAgICAgICAvLyBuZWVkIHRvIHNvcnQgb3V0IGEgcmUtY3Jhd2whXG4gICAgICAgIGlmKHRoaXMuc3RhZ2UpdGhpcy5zdGFnZS5kaXJ0eSA9IHRydWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogU2V0cyBhIG1hc2sgZm9yIHRoZSBkaXNwbGF5T2JqZWN0LiBBIG1hc2sgaXMgYW4gb2JqZWN0IHRoYXQgbGltaXRzIHRoZSB2aXNpYmlsaXR5IG9mIGFuIG9iamVjdCB0byB0aGUgc2hhcGUgb2YgdGhlIG1hc2sgYXBwbGllZCB0byBpdC5cbiAqIEluIFBpeGkgYSByZWd1bGFyIG1hc2sgbXVzdCBiZSBhIEdyYXBoaWNzIG9iamVjdC4gVGhpcyBhbGxvd3MgZm9yIG11Y2ggZmFzdGVyIG1hc2tpbmcgaW4gY2FudmFzIGFzIGl0IHV0aWxpc2VzIHNoYXBlIGNsaXBwaW5nLlxuICogVG8gcmVtb3ZlIGEgbWFzaywgc2V0IHRoaXMgcHJvcGVydHkgdG8gbnVsbC5cbiAqXG4gKiBAcHJvcGVydHkgbWFza1xuICogQHR5cGUgR3JhcGhpY3NcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnbWFzaycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFzaztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcblxuXG4gICAgICAgIGlmKHZhbHVlKVxuICAgICAgICB7XG4gICAgICAgICAgICBpZih0aGlzLl9tYXNrKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHZhbHVlLnN0YXJ0ID0gdGhpcy5fbWFzay5zdGFydDtcbiAgICAgICAgICAgICAgICB2YWx1ZS5lbmQgPSB0aGlzLl9tYXNrLmVuZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZEZpbHRlcih2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdmFsdWUucmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVGaWx0ZXIodGhpcy5fbWFzayk7XG4gICAgICAgICAgICB0aGlzLl9tYXNrLnJlbmRlcmFibGUgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWFzayA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG4vKipcbiAqIFNldHMgdGhlIGZpbHRlcnMgZm9yIHRoZSBkaXNwbGF5T2JqZWN0LlxuICogKiBJTVBPUlRBTlQ6IFRoaXMgaXMgYSB3ZWJHTCBvbmx5IGZlYXR1cmUgYW5kIHdpbGwgYmUgaWdub3JlZCBieSB0aGUgY2FudmFzIHJlbmRlcmVyLlxuICogVG8gcmVtb3ZlIGZpbHRlcnMgc2ltcGx5IHNldCB0aGlzIHByb3BlcnR5IHRvICdudWxsJ1xuICogQHByb3BlcnR5IGZpbHRlcnNcbiAqIEB0eXBlIEFycmF5IEFuIGFycmF5IG9mIGZpbHRlcnNcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnZmlsdGVycycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmlsdGVycztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcblxuICAgICAgICBpZih2YWx1ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgaWYodGhpcy5fZmlsdGVycyl0aGlzLnJlbW92ZUZpbHRlcih0aGlzLl9maWx0ZXJzKTtcbiAgICAgICAgICAgIHRoaXMuYWRkRmlsdGVyKHZhbHVlKTtcblxuICAgICAgICAgICAgLy8gbm93IHB1dCBhbGwgdGhlIHBhc3NlcyBpbiBvbmUgcGxhY2UuLlxuICAgICAgICAgICAgdmFyIHBhc3NlcyA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2YXIgZmlsdGVyUGFzc2VzID0gdmFsdWVbaV0ucGFzc2VzO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZmlsdGVyUGFzc2VzLmxlbmd0aDsgaisrKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgcGFzc2VzLnB1c2goZmlsdGVyUGFzc2VzW2pdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhbHVlLnN0YXJ0LmZpbHRlclBhc3NlcyA9IHBhc3NlcztcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKHRoaXMuX2ZpbHRlcnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUZpbHRlcih0aGlzLl9maWx0ZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2ZpbHRlcnMgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuLypcbiAqIEFkZHMgYSBmaWx0ZXIgdG8gdGhpcyBkaXNwbGF5T2JqZWN0XG4gKlxuICogQG1ldGhvZCBhZGRGaWx0ZXJcbiAqIEBwYXJhbSBtYXNrIHtHcmFwaGljc30gdGhlIGdyYXBoaWNzIG9iamVjdCB0byB1c2UgYXMgYSBmaWx0ZXJcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmFkZEZpbHRlciA9IGZ1bmN0aW9uIGFkZEZpbHRlcihkYXRhKVxue1xuICAgIC8vaWYodGhpcy5maWx0ZXIpcmV0dXJuO1xuICAgIC8vdGhpcy5maWx0ZXIgPSB0cnVlO1xuLy8gIGRhdGFbMF0udGFyZ2V0ID0gdGhpcztcblxuXG4gICAgLy8gaW5zZXJ0IGEgZmlsdGVyIGJsb2NrLi5cbiAgICAvLyBUT0RPIE9uamVjdCBwb29sIHRoZXNlIGJhZCBib3lzLi5cbiAgICB2YXIgc3RhcnQgPSBuZXcgRmlsdGVyQmxvY2soKTtcbiAgICB2YXIgZW5kID0gbmV3IEZpbHRlckJsb2NrKCk7XG5cbiAgICBkYXRhLnN0YXJ0ID0gc3RhcnQ7XG4gICAgZGF0YS5lbmQgPSBlbmQ7XG5cbiAgICBzdGFydC5kYXRhID0gZGF0YTtcbiAgICBlbmQuZGF0YSA9IGRhdGE7XG5cbiAgICBzdGFydC5maXJzdCA9IHN0YXJ0Lmxhc3QgPSAgdGhpcztcbiAgICBlbmQuZmlyc3QgPSBlbmQubGFzdCA9IHRoaXM7XG5cbiAgICBzdGFydC5vcGVuID0gdHJ1ZTtcblxuICAgIHN0YXJ0LnRhcmdldCA9IHRoaXM7XG5cbiAgICAvKlxuICAgICAqIGluc2VydCBzdGFydFxuICAgICAqL1xuXG4gICAgdmFyIGNoaWxkRmlyc3QgPSBzdGFydDtcbiAgICB2YXIgY2hpbGRMYXN0ID0gc3RhcnQ7XG4gICAgdmFyIG5leHRPYmplY3Q7XG4gICAgdmFyIHByZXZpb3VzT2JqZWN0O1xuXG4gICAgcHJldmlvdXNPYmplY3QgPSB0aGlzLmZpcnN0Ll9pUHJldjtcblxuICAgIGlmKHByZXZpb3VzT2JqZWN0KVxuICAgIHtcbiAgICAgICAgbmV4dE9iamVjdCA9IHByZXZpb3VzT2JqZWN0Ll9pTmV4dDtcbiAgICAgICAgY2hpbGRGaXJzdC5faVByZXYgPSBwcmV2aW91c09iamVjdDtcbiAgICAgICAgcHJldmlvdXNPYmplY3QuX2lOZXh0ID0gY2hpbGRGaXJzdDtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgbmV4dE9iamVjdCA9IHRoaXM7XG4gICAgfVxuXG4gICAgaWYobmV4dE9iamVjdClcbiAgICB7XG4gICAgICAgIG5leHRPYmplY3QuX2lQcmV2ID0gY2hpbGRMYXN0O1xuICAgICAgICBjaGlsZExhc3QuX2lOZXh0ID0gbmV4dE9iamVjdDtcbiAgICB9XG5cbiAgICAvLyBub3cgaW5zZXJ0IHRoZSBlbmQgZmlsdGVyIGJsb2NrLi5cblxuICAgIC8qXG4gICAgICogaW5zZXJ0IGVuZCBmaWx0ZXJcbiAgICAgKi9cbiAgICBjaGlsZEZpcnN0ID0gZW5kO1xuICAgIGNoaWxkTGFzdCA9IGVuZDtcbiAgICBuZXh0T2JqZWN0ID0gbnVsbDtcbiAgICBwcmV2aW91c09iamVjdCA9IG51bGw7XG5cbiAgICBwcmV2aW91c09iamVjdCA9IHRoaXMubGFzdDtcbiAgICBuZXh0T2JqZWN0ID0gcHJldmlvdXNPYmplY3QuX2lOZXh0O1xuXG4gICAgaWYobmV4dE9iamVjdClcbiAgICB7XG4gICAgICAgIG5leHRPYmplY3QuX2lQcmV2ID0gY2hpbGRMYXN0O1xuICAgICAgICBjaGlsZExhc3QuX2lOZXh0ID0gbmV4dE9iamVjdDtcbiAgICB9XG5cbiAgICBjaGlsZEZpcnN0Ll9pUHJldiA9IHByZXZpb3VzT2JqZWN0O1xuICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IGNoaWxkRmlyc3Q7XG5cbiAgICB2YXIgdXBkYXRlTGFzdCA9IHRoaXM7XG5cbiAgICB2YXIgcHJldkxhc3QgPSB0aGlzLmxhc3Q7XG4gICAgd2hpbGUodXBkYXRlTGFzdClcbiAgICB7XG4gICAgICAgIGlmKHVwZGF0ZUxhc3QubGFzdCA9PT0gcHJldkxhc3QpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHVwZGF0ZUxhc3QubGFzdCA9IGVuZDtcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVMYXN0ID0gdXBkYXRlTGFzdC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgdGhpcy5maXJzdCA9IHN0YXJ0O1xuXG4gICAgLy8gaWYgd2ViR0wuLi5cbiAgICBpZih0aGlzLl9fcmVuZGVyR3JvdXApXG4gICAge1xuICAgICAgICB0aGlzLl9fcmVuZGVyR3JvdXAuYWRkRmlsdGVyQmxvY2tzKHN0YXJ0LCBlbmQpO1xuICAgIH1cbn07XG5cbi8qXG4gKiBSZW1vdmVzIHRoZSBmaWx0ZXIgdG8gdGhpcyBkaXNwbGF5T2JqZWN0XG4gKlxuICogQG1ldGhvZCByZW1vdmVGaWx0ZXJcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbW92ZUZpbHRlciA9IGZ1bmN0aW9uIHJlbW92ZUZpbHRlcihkYXRhKVxue1xuICAgIC8vaWYoIXRoaXMuZmlsdGVyKXJldHVybjtcbiAgICAvL3RoaXMuZmlsdGVyID0gZmFsc2U7XG4gICAgLy8gY29uc29sZS5sb2coJ1lVT0lPJylcbiAgICAvLyBtb2RpZnkgdGhlIGxpc3QuLlxuICAgIHZhciBzdGFydEJsb2NrID0gZGF0YS5zdGFydDtcblxuXG4gICAgdmFyIG5leHRPYmplY3QgPSBzdGFydEJsb2NrLl9pTmV4dDtcbiAgICB2YXIgcHJldmlvdXNPYmplY3QgPSBzdGFydEJsb2NrLl9pUHJldjtcblxuICAgIGlmKG5leHRPYmplY3QpbmV4dE9iamVjdC5faVByZXYgPSBwcmV2aW91c09iamVjdDtcbiAgICBpZihwcmV2aW91c09iamVjdClwcmV2aW91c09iamVjdC5faU5leHQgPSBuZXh0T2JqZWN0O1xuXG4gICAgdGhpcy5maXJzdCA9IHN0YXJ0QmxvY2suX2lOZXh0O1xuXG4gICAgLy8gcmVtb3ZlIHRoZSBlbmQgZmlsdGVyXG4gICAgdmFyIGxhc3RCbG9jayA9IGRhdGEuZW5kO1xuXG4gICAgbmV4dE9iamVjdCA9IGxhc3RCbG9jay5faU5leHQ7XG4gICAgcHJldmlvdXNPYmplY3QgPSBsYXN0QmxvY2suX2lQcmV2O1xuXG4gICAgaWYobmV4dE9iamVjdCluZXh0T2JqZWN0Ll9pUHJldiA9IHByZXZpb3VzT2JqZWN0O1xuICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IG5leHRPYmplY3Q7XG5cbiAgICAvLyB0aGlzIGlzIGFsd2F5cyB0cnVlIHRvbyFcbiAgICB2YXIgdGVtcExhc3QgPSAgbGFzdEJsb2NrLl9pUHJldjtcbiAgICAvLyBuZWVkIHRvIG1ha2Ugc3VyZSB0aGUgcGFyZW50cyBsYXN0IGlzIHVwZGF0ZWQgdG9vXG4gICAgdmFyIHVwZGF0ZUxhc3QgPSB0aGlzO1xuICAgIHdoaWxlKHVwZGF0ZUxhc3QubGFzdCA9PT0gbGFzdEJsb2NrKVxuICAgIHtcbiAgICAgICAgdXBkYXRlTGFzdC5sYXN0ID0gdGVtcExhc3Q7XG4gICAgICAgIHVwZGF0ZUxhc3QgPSB1cGRhdGVMYXN0LnBhcmVudDtcbiAgICAgICAgaWYoIXVwZGF0ZUxhc3QpYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gaWYgd2ViR0wuLi5cbiAgICBpZih0aGlzLl9fcmVuZGVyR3JvdXApXG4gICAge1xuICAgICAgICB0aGlzLl9fcmVuZGVyR3JvdXAucmVtb3ZlRmlsdGVyQmxvY2tzKHN0YXJ0QmxvY2ssIGxhc3RCbG9jayk7XG4gICAgfVxufTtcblxuLypcbiAqIFVwZGF0ZXMgdGhlIG9iamVjdCB0cmFuc2Zvcm0gZm9yIHJlbmRlcmluZ1xuICpcbiAqIEBtZXRob2QgdXBkYXRlVHJhbnNmb3JtXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUcmFuc2Zvcm0gPSBmdW5jdGlvbiB1cGRhdGVUcmFuc2Zvcm0oKVxue1xuICAgIC8vIFRPRE8gT1BUSU1JWkUgVEhJUyEhIHdpdGggZGlydHlcbiAgICBpZih0aGlzLnJvdGF0aW9uICE9PSB0aGlzLnJvdGF0aW9uQ2FjaGUpXG4gICAge1xuICAgICAgICB0aGlzLnJvdGF0aW9uQ2FjaGUgPSB0aGlzLnJvdGF0aW9uO1xuICAgICAgICB0aGlzLl9zciA9ICBNYXRoLnNpbih0aGlzLnJvdGF0aW9uKTtcbiAgICAgICAgdGhpcy5fY3IgPSAgTWF0aC5jb3ModGhpcy5yb3RhdGlvbik7XG4gICAgfVxuXG4gICAgdmFyIGxvY2FsVHJhbnNmb3JtID0gdGhpcy5sb2NhbFRyYW5zZm9ybTtcbiAgICB2YXIgcGFyZW50VHJhbnNmb3JtID0gdGhpcy5wYXJlbnQud29ybGRUcmFuc2Zvcm07XG4gICAgdmFyIHdvcmxkVHJhbnNmb3JtID0gdGhpcy53b3JsZFRyYW5zZm9ybTtcbiAgICAvL2NvbnNvbGUubG9nKGxvY2FsVHJhbnNmb3JtKVxuICAgIGxvY2FsVHJhbnNmb3JtWzBdID0gdGhpcy5fY3IgKiB0aGlzLnNjYWxlLng7XG4gICAgbG9jYWxUcmFuc2Zvcm1bMV0gPSAtdGhpcy5fc3IgKiB0aGlzLnNjYWxlLnk7XG4gICAgbG9jYWxUcmFuc2Zvcm1bM10gPSB0aGlzLl9zciAqIHRoaXMuc2NhbGUueDtcbiAgICBsb2NhbFRyYW5zZm9ybVs0XSA9IHRoaXMuX2NyICogdGhpcy5zY2FsZS55O1xuXG4gICAgLy8gVE9ETyAtLT4gZG8gd2UgZXZlbiBuZWVkIGEgbG9jYWwgbWF0cml4Pz8/XG5cbiAgICB2YXIgcHggPSB0aGlzLnBpdm90Lng7XG4gICAgdmFyIHB5ID0gdGhpcy5waXZvdC55O1xuXG4gICAgLy8gQ2FjaGUgdGhlIG1hdHJpeCB2YWx1ZXMgKG1ha2VzIGZvciBodWdlIHNwZWVkIGluY3JlYXNlcyEpXG4gICAgdmFyIGEwMCA9IGxvY2FsVHJhbnNmb3JtWzBdLCBhMDEgPSBsb2NhbFRyYW5zZm9ybVsxXSwgYTAyID0gdGhpcy5wb3NpdGlvbi54IC0gbG9jYWxUcmFuc2Zvcm1bMF0gKiBweCAtIHB5ICogbG9jYWxUcmFuc2Zvcm1bMV0sXG4gICAgICAgIGExMCA9IGxvY2FsVHJhbnNmb3JtWzNdLCBhMTEgPSBsb2NhbFRyYW5zZm9ybVs0XSwgYTEyID0gdGhpcy5wb3NpdGlvbi55IC0gbG9jYWxUcmFuc2Zvcm1bNF0gKiBweSAtIHB4ICogbG9jYWxUcmFuc2Zvcm1bM10sXG5cbiAgICAgICAgYjAwID0gcGFyZW50VHJhbnNmb3JtWzBdLCBiMDEgPSBwYXJlbnRUcmFuc2Zvcm1bMV0sIGIwMiA9IHBhcmVudFRyYW5zZm9ybVsyXSxcbiAgICAgICAgYjEwID0gcGFyZW50VHJhbnNmb3JtWzNdLCBiMTEgPSBwYXJlbnRUcmFuc2Zvcm1bNF0sIGIxMiA9IHBhcmVudFRyYW5zZm9ybVs1XTtcblxuICAgIGxvY2FsVHJhbnNmb3JtWzJdID0gYTAyO1xuICAgIGxvY2FsVHJhbnNmb3JtWzVdID0gYTEyO1xuXG4gICAgd29ybGRUcmFuc2Zvcm1bMF0gPSBiMDAgKiBhMDAgKyBiMDEgKiBhMTA7XG4gICAgd29ybGRUcmFuc2Zvcm1bMV0gPSBiMDAgKiBhMDEgKyBiMDEgKiBhMTE7XG4gICAgd29ybGRUcmFuc2Zvcm1bMl0gPSBiMDAgKiBhMDIgKyBiMDEgKiBhMTIgKyBiMDI7XG5cbiAgICB3b3JsZFRyYW5zZm9ybVszXSA9IGIxMCAqIGEwMCArIGIxMSAqIGExMDtcbiAgICB3b3JsZFRyYW5zZm9ybVs0XSA9IGIxMCAqIGEwMSArIGIxMSAqIGExMTtcbiAgICB3b3JsZFRyYW5zZm9ybVs1XSA9IGIxMCAqIGEwMiArIGIxMSAqIGExMiArIGIxMjtcblxuICAgIC8vIGJlY2F1c2Ugd2UgYXJlIHVzaW5nIGFmZmluZSB0cmFuc2Zvcm1hdGlvbiwgd2UgY2FuIG9wdGltaXNlIHRoZSBtYXRyaXggY29uY2F0ZW5hdGlvbiBwcm9jZXNzLi4gd29vbyFcbiAgICAvLyBtYXQzLm11bHRpcGx5KHRoaXMubG9jYWxUcmFuc2Zvcm0sIHRoaXMucGFyZW50LndvcmxkVHJhbnNmb3JtLCB0aGlzLndvcmxkVHJhbnNmb3JtKTtcbiAgICB0aGlzLndvcmxkQWxwaGEgPSB0aGlzLmFscGhhICogdGhpcy5wYXJlbnQud29ybGRBbHBoYTtcblxuICAgIHRoaXMudmNvdW50ID0gZ2xvYmFscy52aXNpYmxlQ291bnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERpc3BsYXlPYmplY3Q7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBEaXNwbGF5T2JqZWN0ID0gcmVxdWlyZSgnLi9EaXNwbGF5T2JqZWN0Jyk7XG5cbi8qKlxuICogQSBEaXNwbGF5T2JqZWN0Q29udGFpbmVyIHJlcHJlc2VudHMgYSBjb2xsZWN0aW9uIG9mIGRpc3BsYXkgb2JqZWN0cy5cbiAqIEl0IGlzIHRoZSBiYXNlIGNsYXNzIG9mIGFsbCBkaXNwbGF5IG9iamVjdHMgdGhhdCBhY3QgYXMgYSBjb250YWluZXIgZm9yIG90aGVyIG9iamVjdHMuXG4gKlxuICogQGNsYXNzIERpc3BsYXlPYmplY3RDb250YWluZXJcbiAqIEBleHRlbmRzIERpc3BsYXlPYmplY3RcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBEaXNwbGF5T2JqZWN0Q29udGFpbmVyKClcbntcbiAgICBEaXNwbGF5T2JqZWN0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgb2YgY2hpbGRyZW4gb2YgdGhpcyBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgY2hpbGRyZW5cbiAgICAgKiBAdHlwZSBBcnJheTxEaXNwbGF5T2JqZWN0PlxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbn1cblxudmFyIHByb3RvID0gRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3QucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogRGlzcGxheU9iamVjdENvbnRhaW5lcn1cbn0pO1xuXG4vKipcbiAqIEFkZHMgYSBjaGlsZCB0byB0aGUgY29udGFpbmVyLlxuICpcbiAqIEBtZXRob2QgYWRkQ2hpbGRcbiAqIEBwYXJhbSBjaGlsZCB7RGlzcGxheU9iamVjdH0gVGhlIERpc3BsYXlPYmplY3QgdG8gYWRkIHRvIHRoZSBjb250YWluZXJcbiAqL1xucHJvdG8uYWRkQ2hpbGQgPSBmdW5jdGlvbiBhZGRDaGlsZChjaGlsZClcbntcbiAgICBpZihjaGlsZC5wYXJlbnQgJiYgY2hpbGQucGFyZW50ICE9PSB0aGlzKVxuICAgIHtcbiAgICAgICAgLy8vLyBDT1VMRCBCRSBUSElTPz8/XG4gICAgICAgIGNoaWxkLnBhcmVudC5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgLy8gIHJldHVybjtcbiAgICB9XG5cbiAgICBjaGlsZC5wYXJlbnQgPSB0aGlzO1xuXG4gICAgdGhpcy5jaGlsZHJlbi5wdXNoKGNoaWxkKTtcblxuICAgIC8vIHVwZGF0ZSB0aGUgc3RhZ2UgcmVmZmVyZW5jZS4uXG5cbiAgICBpZih0aGlzLnN0YWdlKVxuICAgIHtcbiAgICAgICAgdmFyIHRtcENoaWxkID0gY2hpbGQ7XG4gICAgICAgIGRvXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKHRtcENoaWxkLmludGVyYWN0aXZlKXRoaXMuc3RhZ2UuZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgdG1wQ2hpbGQuc3RhZ2UgPSB0aGlzLnN0YWdlO1xuICAgICAgICAgICAgdG1wQ2hpbGQgPSB0bXBDaGlsZC5faU5leHQ7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUodG1wQ2hpbGQpO1xuICAgIH1cblxuICAgIC8vIExJTktFRCBMSVNUIC8vXG5cbiAgICAvLyBtb2RpZnkgdGhlIGxpc3QuLlxuICAgIHZhciBjaGlsZEZpcnN0ID0gY2hpbGQuZmlyc3Q7XG4gICAgdmFyIGNoaWxkTGFzdCA9IGNoaWxkLmxhc3Q7XG4gICAgdmFyIG5leHRPYmplY3Q7XG4gICAgdmFyIHByZXZpb3VzT2JqZWN0O1xuXG4gICAgLy8gdGhpcyBjb3VsZCBiZSB3cm9uZyBpZiB0aGVyZSBpcyBhIGZpbHRlcj8/XG4gICAgaWYodGhpcy5fZmlsdGVycyB8fCB0aGlzLl9tYXNrKVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNPYmplY3QgPSAgdGhpcy5sYXN0Ll9pUHJldjtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNPYmplY3QgPSB0aGlzLmxhc3Q7XG4gICAgfVxuXG4gICAgbmV4dE9iamVjdCA9IHByZXZpb3VzT2JqZWN0Ll9pTmV4dDtcblxuICAgIC8vIGFsd2F5cyB0cnVlIGluIHRoaXMgY2FzZVxuICAgIC8vIG5lZWQgdG8gbWFrZSBzdXJlIHRoZSBwYXJlbnRzIGxhc3QgaXMgdXBkYXRlZCB0b29cbiAgICB2YXIgdXBkYXRlTGFzdCA9IHRoaXM7XG4gICAgdmFyIHByZXZMYXN0ID0gcHJldmlvdXNPYmplY3Q7XG5cbiAgICB3aGlsZSh1cGRhdGVMYXN0KVxuICAgIHtcbiAgICAgICAgaWYodXBkYXRlTGFzdC5sYXN0ID09PSBwcmV2TGFzdClcbiAgICAgICAge1xuICAgICAgICAgICAgdXBkYXRlTGFzdC5sYXN0ID0gY2hpbGQubGFzdDtcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVMYXN0ID0gdXBkYXRlTGFzdC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgaWYobmV4dE9iamVjdClcbiAgICB7XG4gICAgICAgIG5leHRPYmplY3QuX2lQcmV2ID0gY2hpbGRMYXN0O1xuICAgICAgICBjaGlsZExhc3QuX2lOZXh0ID0gbmV4dE9iamVjdDtcbiAgICB9XG5cbiAgICBjaGlsZEZpcnN0Ll9pUHJldiA9IHByZXZpb3VzT2JqZWN0O1xuICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IGNoaWxkRmlyc3Q7XG5cbiAgICAvLyBuZWVkIHRvIHJlbW92ZSBhbnkgcmVuZGVyIGdyb3Vwcy4uXG4gICAgaWYodGhpcy5fX3JlbmRlckdyb3VwKVxuICAgIHtcbiAgICAgICAgLy8gYmVpbmcgdXNlZCBieSBhIHJlbmRlclRleHR1cmUuLiBpZiBpdCBleGlzdHMgdGhlbiBpdCBtdXN0IGJlIGZyb20gYSByZW5kZXIgdGV4dHVyZTtcbiAgICAgICAgaWYoY2hpbGQuX19yZW5kZXJHcm91cCljaGlsZC5fX3JlbmRlckdyb3VwLnJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihjaGlsZCk7XG4gICAgICAgIC8vIGFkZCB0aGVtIHRvIHRoZSBuZXcgcmVuZGVyIGdyb3VwLi5cbiAgICAgICAgdGhpcy5fX3JlbmRlckdyb3VwLmFkZERpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihjaGlsZCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBBZGRzIGEgY2hpbGQgdG8gdGhlIGNvbnRhaW5lciBhdCBhIHNwZWNpZmllZCBpbmRleC4gSWYgdGhlIGluZGV4IGlzIG91dCBvZiBib3VuZHMgYW4gZXJyb3Igd2lsbCBiZSB0aHJvd25cbiAqXG4gKiBAbWV0aG9kIGFkZENoaWxkQXRcbiAqIEBwYXJhbSBjaGlsZCB7RGlzcGxheU9iamVjdH0gVGhlIGNoaWxkIHRvIGFkZFxuICogQHBhcmFtIGluZGV4IHtOdW1iZXJ9IFRoZSBpbmRleCB0byBwbGFjZSB0aGUgY2hpbGQgaW5cbiAqL1xucHJvdG8uYWRkQ2hpbGRBdCA9IGZ1bmN0aW9uIGFkZENoaWxkQXQoY2hpbGQsIGluZGV4KVxue1xuICAgIGlmKGluZGV4ID49IDAgJiYgaW5kZXggPD0gdGhpcy5jaGlsZHJlbi5sZW5ndGgpXG4gICAge1xuICAgICAgICBpZihjaGlsZC5wYXJlbnQgIT09IHVuZGVmaW5lZClcbiAgICAgICAge1xuICAgICAgICAgICAgY2hpbGQucGFyZW50LnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNoaWxkLnBhcmVudCA9IHRoaXM7XG5cbiAgICAgICAgaWYodGhpcy5zdGFnZSlcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIHRtcENoaWxkID0gY2hpbGQ7XG4gICAgICAgICAgICBkb1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlmKHRtcENoaWxkLmludGVyYWN0aXZlKXRoaXMuc3RhZ2UuZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRtcENoaWxkLnN0YWdlID0gdGhpcy5zdGFnZTtcbiAgICAgICAgICAgICAgICB0bXBDaGlsZCA9IHRtcENoaWxkLl9pTmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlKHRtcENoaWxkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1vZGlmeSB0aGUgbGlzdC4uXG4gICAgICAgIHZhciBjaGlsZEZpcnN0ID0gY2hpbGQuZmlyc3Q7XG4gICAgICAgIHZhciBjaGlsZExhc3QgPSBjaGlsZC5sYXN0O1xuICAgICAgICB2YXIgbmV4dE9iamVjdDtcbiAgICAgICAgdmFyIHByZXZpb3VzT2JqZWN0O1xuXG4gICAgICAgIGlmKGluZGV4ID09PSB0aGlzLmNoaWxkcmVuLmxlbmd0aClcbiAgICAgICAge1xuICAgICAgICAgICAgcHJldmlvdXNPYmplY3QgPSAgdGhpcy5sYXN0O1xuICAgICAgICAgICAgdmFyIHVwZGF0ZUxhc3QgPSB0aGlzO1xuICAgICAgICAgICAgdmFyIHByZXZMYXN0ID0gdGhpcy5sYXN0O1xuICAgICAgICAgICAgd2hpbGUodXBkYXRlTGFzdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZih1cGRhdGVMYXN0Lmxhc3QgPT09IHByZXZMYXN0KVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlTGFzdC5sYXN0ID0gY2hpbGQubGFzdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdXBkYXRlTGFzdCA9IHVwZGF0ZUxhc3QucGFyZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoaW5kZXggPT09IDApXG4gICAgICAgIHtcbiAgICAgICAgICAgIHByZXZpb3VzT2JqZWN0ID0gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHByZXZpb3VzT2JqZWN0ID0gdGhpcy5jaGlsZHJlbltpbmRleC0xXS5sYXN0O1xuICAgICAgICB9XG5cbiAgICAgICAgbmV4dE9iamVjdCA9IHByZXZpb3VzT2JqZWN0Ll9pTmV4dDtcblxuICAgICAgICAvLyBhbHdheXMgdHJ1ZSBpbiB0aGlzIGNhc2VcbiAgICAgICAgaWYobmV4dE9iamVjdClcbiAgICAgICAge1xuICAgICAgICAgICAgbmV4dE9iamVjdC5faVByZXYgPSBjaGlsZExhc3Q7XG4gICAgICAgICAgICBjaGlsZExhc3QuX2lOZXh0ID0gbmV4dE9iamVjdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNoaWxkRmlyc3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IGNoaWxkRmlyc3Q7XG5cbiAgICAgICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDAsIGNoaWxkKTtcbiAgICAgICAgLy8gbmVlZCB0byByZW1vdmUgYW55IHJlbmRlciBncm91cHMuLlxuICAgICAgICBpZih0aGlzLl9fcmVuZGVyR3JvdXApXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIGJlaW5nIHVzZWQgYnkgYSByZW5kZXJUZXh0dXJlLi4gaWYgaXQgZXhpc3RzIHRoZW4gaXQgbXVzdCBiZSBmcm9tIGEgcmVuZGVyIHRleHR1cmU7XG4gICAgICAgICAgICBpZihjaGlsZC5fX3JlbmRlckdyb3VwKWNoaWxkLl9fcmVuZGVyR3JvdXAucmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGNoaWxkKTtcbiAgICAgICAgICAgIC8vIGFkZCB0aGVtIHRvIHRoZSBuZXcgcmVuZGVyIGdyb3VwLi5cbiAgICAgICAgICAgIHRoaXMuX19yZW5kZXJHcm91cC5hZGREaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4oY2hpbGQpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGNoaWxkICsgJyBUaGUgaW5kZXggJysgaW5kZXggKycgc3VwcGxpZWQgaXMgb3V0IG9mIGJvdW5kcyAnICsgdGhpcy5jaGlsZHJlbi5sZW5ndGgpO1xuICAgIH1cbn07XG5cbi8qKlxuICogW05ZSV0gU3dhcHMgdGhlIGRlcHRoIG9mIDIgZGlzcGxheU9iamVjdHNcbiAqXG4gKiBAbWV0aG9kIHN3YXBDaGlsZHJlblxuICogQHBhcmFtIGNoaWxkIHtEaXNwbGF5T2JqZWN0fVxuICogQHBhcmFtIGNoaWxkMiB7RGlzcGxheU9iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnN3YXBDaGlsZHJlbiA9IGZ1bmN0aW9uIHN3YXBDaGlsZHJlbihjaGlsZCwgY2hpbGQyKVxue1xuICAgIGlmKGNoaWxkID09PSBjaGlsZDIpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBpbmRleDEgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoY2hpbGQpO1xuICAgIHZhciBpbmRleDIgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoY2hpbGQyKTtcblxuICAgIGlmKGluZGV4MSA8IDAgfHwgaW5kZXgyIDwgMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3N3YXBDaGlsZHJlbjogQm90aCB0aGUgc3VwcGxpZWQgRGlzcGxheU9iamVjdHMgbXVzdCBiZSBhIGNoaWxkIG9mIHRoZSBjYWxsZXIuJyk7XG4gICAgfVxuXG4gICAgdGhpcy5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgdGhpcy5yZW1vdmVDaGlsZChjaGlsZDIpO1xuXG4gICAgaWYoaW5kZXgxIDwgaW5kZXgyKVxuICAgIHtcbiAgICAgICAgdGhpcy5hZGRDaGlsZEF0KGNoaWxkMiwgaW5kZXgxKTtcbiAgICAgICAgdGhpcy5hZGRDaGlsZEF0KGNoaWxkLCBpbmRleDIpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLmFkZENoaWxkQXQoY2hpbGQsIGluZGV4Mik7XG4gICAgICAgIHRoaXMuYWRkQ2hpbGRBdChjaGlsZDIsIGluZGV4MSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBDaGlsZCBhdCB0aGUgc3BlY2lmaWVkIGluZGV4XG4gKlxuICogQG1ldGhvZCBnZXRDaGlsZEF0XG4gKiBAcGFyYW0gaW5kZXgge051bWJlcn0gVGhlIGluZGV4IHRvIGdldCB0aGUgY2hpbGQgZnJvbVxuICovXG5wcm90by5nZXRDaGlsZEF0ID0gZnVuY3Rpb24gZ2V0Q2hpbGRBdChpbmRleClcbntcbiAgICBpZihpbmRleCA+PSAwICYmIGluZGV4IDwgdGhpcy5jaGlsZHJlbi5sZW5ndGgpXG4gICAge1xuICAgICAgICByZXR1cm4gdGhpcy5jaGlsZHJlbltpbmRleF07XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQm90aCB0aGUgc3VwcGxpZWQgRGlzcGxheU9iamVjdHMgbXVzdCBiZSBhIGNoaWxkIG9mIHRoZSBjYWxsZXIgJyArIHRoaXMpO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhIGNoaWxkIGZyb20gdGhlIGNvbnRhaW5lci5cbiAqXG4gKiBAbWV0aG9kIHJlbW92ZUNoaWxkXG4gKiBAcGFyYW0gY2hpbGQge0Rpc3BsYXlPYmplY3R9IFRoZSBEaXNwbGF5T2JqZWN0IHRvIHJlbW92ZVxuICovXG5wcm90by5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uIHJlbW92ZUNoaWxkKGNoaWxkKVxue1xuICAgIHZhciBpbmRleCA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZiggY2hpbGQgKTtcbiAgICBpZiAoIGluZGV4ICE9PSAtMSApXG4gICAge1xuICAgICAgICAvLyB1bmxpbmsgLy9cbiAgICAgICAgLy8gbW9kaWZ5IHRoZSBsaXN0Li5cbiAgICAgICAgdmFyIGNoaWxkRmlyc3QgPSBjaGlsZC5maXJzdDtcbiAgICAgICAgdmFyIGNoaWxkTGFzdCA9IGNoaWxkLmxhc3Q7XG5cbiAgICAgICAgdmFyIG5leHRPYmplY3QgPSBjaGlsZExhc3QuX2lOZXh0O1xuICAgICAgICB2YXIgcHJldmlvdXNPYmplY3QgPSBjaGlsZEZpcnN0Ll9pUHJldjtcblxuICAgICAgICBpZihuZXh0T2JqZWN0KW5leHRPYmplY3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgICAgIHByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IG5leHRPYmplY3Q7XG5cbiAgICAgICAgaWYodGhpcy5sYXN0ID09PSBjaGlsZExhc3QpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciB0ZW1wTGFzdCA9IGNoaWxkRmlyc3QuX2lQcmV2O1xuICAgICAgICAgICAgLy8gbmVlZCB0byBtYWtlIHN1cmUgdGhlIHBhcmVudHMgbGFzdCBpcyB1cGRhdGVkIHRvb1xuICAgICAgICAgICAgdmFyIHVwZGF0ZUxhc3QgPSB0aGlzO1xuXG4gICAgICAgICAgICB3aGlsZSh1cGRhdGVMYXN0Lmxhc3QgPT09IGNoaWxkTGFzdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1cGRhdGVMYXN0Lmxhc3QgPSB0ZW1wTGFzdDtcbiAgICAgICAgICAgICAgICB1cGRhdGVMYXN0ID0gdXBkYXRlTGFzdC5wYXJlbnQ7XG4gICAgICAgICAgICAgICAgaWYoIXVwZGF0ZUxhc3QpYnJlYWs7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNoaWxkTGFzdC5faU5leHQgPSBudWxsO1xuICAgICAgICBjaGlsZEZpcnN0Ll9pUHJldiA9IG51bGw7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSBzdGFnZSByZWZlcmVuY2UuLlxuICAgICAgICBpZih0aGlzLnN0YWdlKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgdG1wQ2hpbGQgPSBjaGlsZDtcbiAgICAgICAgICAgIGRvXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWYodG1wQ2hpbGQuaW50ZXJhY3RpdmUpdGhpcy5zdGFnZS5kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdG1wQ2hpbGQuc3RhZ2UgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRtcENoaWxkID0gdG1wQ2hpbGQuX2lOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUodG1wQ2hpbGQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2ViR0wgdHJpbVxuICAgICAgICBpZihjaGlsZC5fX3JlbmRlckdyb3VwKVxuICAgICAgICB7XG4gICAgICAgICAgICBjaGlsZC5fX3JlbmRlckdyb3VwLnJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihjaGlsZCk7XG4gICAgICAgIH1cblxuICAgICAgICBjaGlsZC5wYXJlbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4uc3BsaWNlKCBpbmRleCwgMSApO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoY2hpbGQgKyAnIFRoZSBzdXBwbGllZCBEaXNwbGF5T2JqZWN0IG11c3QgYmUgYSBjaGlsZCBvZiB0aGUgY2FsbGVyICcgKyB0aGlzKTtcbiAgICB9XG59O1xuXG4vKlxuICogVXBkYXRlcyB0aGUgY29udGFpbmVyJ3MgY2hpbGRyZW4ncyB0cmFuc2Zvcm0gZm9yIHJlbmRlcmluZ1xuICpcbiAqIEBtZXRob2QgdXBkYXRlVHJhbnNmb3JtXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUcmFuc2Zvcm0gPSBmdW5jdGlvbiB1cGRhdGVUcmFuc2Zvcm0oKVxue1xuICAgIGlmKCF0aGlzLnZpc2libGUpcmV0dXJuO1xuXG4gICAgRGlzcGxheU9iamVjdC5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwoIHRoaXMgKTtcblxuICAgIGZvcih2YXIgaT0wLGo9dGhpcy5jaGlsZHJlbi5sZW5ndGg7IGk8ajsgaSsrKVxuICAgIHtcbiAgICAgICAgdGhpcy5jaGlsZHJlbltpXS51cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERpc3BsYXlPYmplY3RDb250YWluZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBTcHJpdGUgPSByZXF1aXJlKCcuL1Nwcml0ZScpO1xuXG4vKipcbiAqIEEgTW92aWVDbGlwIGlzIGEgc2ltcGxlIHdheSB0byBkaXNwbGF5IGFuIGFuaW1hdGlvbiBkZXBpY3RlZCBieSBhIGxpc3Qgb2YgdGV4dHVyZXMuXG4gKlxuICogQGNsYXNzIE1vdmllQ2xpcFxuICogQGV4dGVuZHMgU3ByaXRlXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB0ZXh0dXJlcyB7QXJyYXk8VGV4dHVyZT59IGFuIGFycmF5IG9mIHtUZXh0dXJlfSBvYmplY3RzIHRoYXQgbWFrZSB1cCB0aGUgYW5pbWF0aW9uXG4gKi9cbmZ1bmN0aW9uIE1vdmllQ2xpcCh0ZXh0dXJlcylcbntcbiAgICBTcHJpdGUuY2FsbCh0aGlzLCB0ZXh0dXJlc1swXSk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXJyYXkgb2YgdGV4dHVyZXMgdGhhdCBtYWtlIHVwIHRoZSBhbmltYXRpb25cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0ZXh0dXJlc1xuICAgICAqIEB0eXBlIEFycmF5XG4gICAgICovXG4gICAgdGhpcy50ZXh0dXJlcyA9IHRleHR1cmVzO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNwZWVkIHRoYXQgdGhlIE1vdmllQ2xpcCB3aWxsIHBsYXkgYXQuIEhpZ2hlciBpcyBmYXN0ZXIsIGxvd2VyIGlzIHNsb3dlclxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGFuaW1hdGlvblNwZWVkXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMVxuICAgICAqL1xuICAgIHRoaXMuYW5pbWF0aW9uU3BlZWQgPSAxO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciBvciBub3QgdGhlIG1vdmllIGNsaXAgcmVwZWF0cyBhZnRlciBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGxvb3BcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxuICAgICAqL1xuICAgIHRoaXMubG9vcCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB0byBjYWxsIHdoZW4gYSBNb3ZpZUNsaXAgZmluaXNoZXMgcGxheWluZ1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IG9uQ29tcGxldGVcbiAgICAgKiBAdHlwZSBGdW5jdGlvblxuICAgICAqL1xuICAgIHRoaXMub25Db21wbGV0ZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgaW5kZXggTW92aWVDbGlwcyBjdXJyZW50IGZyYW1lICh0aGlzIG1heSBub3QgaGF2ZSB0byBiZSBhIHdob2xlIG51bWJlcilcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjdXJyZW50RnJhbWVcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5jdXJyZW50RnJhbWUgPSAwO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gSW5kaWNhdGVzIGlmIHRoZSBNb3ZpZUNsaXAgaXMgY3VycmVudGx5IHBsYXlpbmdcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBwbGF5aW5nXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xufVxuXG52YXIgcHJvdG8gPSBNb3ZpZUNsaXAucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTcHJpdGUucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogTW92aWVDbGlwfVxufSk7XG5cbi8qKlxuKiBbcmVhZC1vbmx5XSB0b3RhbEZyYW1lcyBpcyB0aGUgdG90YWwgbnVtYmVyIG9mIGZyYW1lcyBpbiB0aGUgTW92aWVDbGlwLiBUaGlzIGlzIHRoZSBzYW1lIGFzIG51bWJlciBvZiB0ZXh0dXJlc1xuKiBhc3NpZ25lZCB0byB0aGUgTW92aWVDbGlwLlxuKlxuKiBAcHJvcGVydHkgdG90YWxGcmFtZXNcbiogQHR5cGUgTnVtYmVyXG4qIEBkZWZhdWx0IDBcbiogQHJlYWRPbmx5XG4qL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAndG90YWxGcmFtZXMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGV4dHVyZXMubGVuZ3RoO1xuICAgIH1cbn0pO1xuXG5cbi8qKlxuICogU3RvcHMgdGhlIE1vdmllQ2xpcFxuICpcbiAqIEBtZXRob2Qgc3RvcFxuICovXG5wcm90by5zdG9wID0gZnVuY3Rpb24oKVxue1xuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xufTtcblxuLyoqXG4gKiBQbGF5cyB0aGUgTW92aWVDbGlwXG4gKlxuICogQG1ldGhvZCBwbGF5XG4gKi9cbnByb3RvLnBsYXkgPSBmdW5jdGlvbigpXG57XG4gICAgdGhpcy5wbGF5aW5nID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogU3RvcHMgdGhlIE1vdmllQ2xpcCBhbmQgZ29lcyB0byBhIHNwZWNpZmljIGZyYW1lXG4gKlxuICogQG1ldGhvZCBnb3RvQW5kU3RvcFxuICogQHBhcmFtIGZyYW1lTnVtYmVyIHtOdW1iZXJ9IGZyYW1lIGluZGV4IHRvIHN0b3AgYXRcbiAqL1xucHJvdG8uZ290b0FuZFN0b3AgPSBmdW5jdGlvbihmcmFtZU51bWJlcilcbntcbiAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmN1cnJlbnRGcmFtZSA9IGZyYW1lTnVtYmVyO1xuICAgIHZhciByb3VuZCA9ICh0aGlzLmN1cnJlbnRGcmFtZSArIDAuNSkgfCAwO1xuICAgIHRoaXMuc2V0VGV4dHVyZSh0aGlzLnRleHR1cmVzW3JvdW5kICUgdGhpcy50ZXh0dXJlcy5sZW5ndGhdKTtcbn07XG5cbi8qKlxuICogR29lcyB0byBhIHNwZWNpZmljIGZyYW1lIGFuZCBiZWdpbnMgcGxheWluZyB0aGUgTW92aWVDbGlwXG4gKlxuICogQG1ldGhvZCBnb3RvQW5kUGxheVxuICogQHBhcmFtIGZyYW1lTnVtYmVyIHtOdW1iZXJ9IGZyYW1lIGluZGV4IHRvIHN0YXJ0IGF0XG4gKi9cbnByb3RvLmdvdG9BbmRQbGF5ID0gZnVuY3Rpb24gZ290b0FuZFBsYXkoZnJhbWVOdW1iZXIpXG57XG4gICAgdGhpcy5jdXJyZW50RnJhbWUgPSBmcmFtZU51bWJlcjtcbiAgICB0aGlzLnBsYXlpbmcgPSB0cnVlO1xufTtcblxuLypcbiAqIFVwZGF0ZXMgdGhlIG9iamVjdCB0cmFuc2Zvcm0gZm9yIHJlbmRlcmluZ1xuICpcbiAqIEBtZXRob2QgdXBkYXRlVHJhbnNmb3JtXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUcmFuc2Zvcm0gPSBmdW5jdGlvbiB1cGRhdGVUcmFuc2Zvcm0oKVxue1xuICAgIFNwcml0ZS5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyk7XG5cbiAgICBpZighdGhpcy5wbGF5aW5nKXJldHVybjtcblxuICAgIHRoaXMuY3VycmVudEZyYW1lICs9IHRoaXMuYW5pbWF0aW9uU3BlZWQ7XG5cbiAgICB2YXIgcm91bmQgPSAodGhpcy5jdXJyZW50RnJhbWUgKyAwLjUpIHwgMDtcblxuICAgIGlmKHRoaXMubG9vcCB8fCByb3VuZCA8IHRoaXMudGV4dHVyZXMubGVuZ3RoKVxuICAgIHtcbiAgICAgICAgdGhpcy5zZXRUZXh0dXJlKHRoaXMudGV4dHVyZXNbcm91bmQgJSB0aGlzLnRleHR1cmVzLmxlbmd0aF0pO1xuICAgIH1cbiAgICBlbHNlIGlmKHJvdW5kID49IHRoaXMudGV4dHVyZXMubGVuZ3RoKVxuICAgIHtcbiAgICAgICAgdGhpcy5nb3RvQW5kU3RvcCh0aGlzLnRleHR1cmVzLmxlbmd0aCAtIDEpO1xuICAgICAgICBpZih0aGlzLm9uQ29tcGxldGUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZSgpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNb3ZpZUNsaXA7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBibGVuZE1vZGVzID0gcmVxdWlyZSgnLi9ibGVuZE1vZGVzJyk7XG52YXIgRGlzcGxheU9iamVjdENvbnRhaW5lciA9IHJlcXVpcmUoJy4vRGlzcGxheU9iamVjdENvbnRhaW5lcicpO1xudmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vZ2VvbS9Qb2ludCcpO1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuLi90ZXh0dXJlcy9UZXh0dXJlJyk7XG5cbi8qKlxuICogVGhlIFNQcml0ZSBvYmplY3QgaXMgdGhlIGJhc2UgZm9yIGFsbCB0ZXh0dXJlZCBvYmplY3RzIHRoYXQgYXJlIHJlbmRlcmVkIHRvIHRoZSBzY3JlZW5cbiAqXG4gKiBAY2xhc3MgU3ByaXRlXG4gKiBAZXh0ZW5kcyBEaXNwbGF5T2JqZWN0Q29udGFpbmVyXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB0ZXh0dXJlIHtUZXh0dXJlfSBUaGUgdGV4dHVyZSBmb3IgdGhpcyBzcHJpdGVcbiAqIEB0eXBlIFN0cmluZ1xuICovXG5mdW5jdGlvbiBTcHJpdGUodGV4dHVyZSlcbntcbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYW5jaG9yIHNldHMgdGhlIG9yaWdpbiBwb2ludCBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKiBUaGUgZGVmYXVsdCBpcyAwLDAgdGhpcyBtZWFucyB0aGUgdGV4dHVyZXMgb3JpZ2luIGlzIHRoZSB0b3AgbGVmdFxuICAgICAqIFNldHRpbmcgdGhhbiBhbmNob3IgdG8gMC41LDAuNSBtZWFucyB0aGUgdGV4dHVyZXMgb3JpZ2luIGlzIGNlbnRlcmVkXG4gICAgICogU2V0dGluZyB0aGUgYW5jaG9yIHRvIDEsMSB3b3VsZCBtZWFuIHRoZSB0ZXh0dXJlcyBvcmlnaW4gcG9pbnRzIHdpbGwgYmUgdGhlIGJvdHRvbSByaWdodFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGFuY2hvclxuICAgICAqIEB0eXBlIFBvaW50XG4gICAgICovXG4gICAgdGhpcy5hbmNob3IgPSBuZXcgUG9pbnQoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0ZXh0dXJlIHRoYXQgdGhlIHNwcml0ZSBpcyB1c2luZ1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRleHR1cmVcbiAgICAgKiBAdHlwZSBUZXh0dXJlXG4gICAgICovXG4gICAgdGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBibGVuZCBtb2RlIG9mIHNwcml0ZS5cbiAgICAgKiBjdXJyZW50bHkgc3VwcG9ydHMgYmxlbmRNb2Rlcy5OT1JNQUwgYW5kIGJsZW5kTW9kZXMuU0NSRUVOXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYmxlbmRNb2RlXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgdGhpcy5ibGVuZE1vZGUgPSBibGVuZE1vZGVzLk5PUk1BTDtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgc3ByaXRlICh0aGlzIGlzIGluaXRpYWxseSBzZXQgYnkgdGhlIHRleHR1cmUpXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgX3dpZHRoXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl93aWR0aCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBzcHJpdGUgKHRoaXMgaXMgaW5pdGlhbGx5IHNldCBieSB0aGUgdGV4dHVyZSlcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBfaGVpZ2h0XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl9oZWlnaHQgPSAwO1xuXG4gICAgaWYodGV4dHVyZS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQpXG4gICAge1xuICAgICAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgICAgICB0aGlzLnRleHR1cmUuYWRkRXZlbnRMaXN0ZW5lciggJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoYXQub25UZXh0dXJlVXBkYXRlKCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMucmVuZGVyYWJsZSA9IHRydWU7XG59XG5cbnZhciBwcm90byA9IFNwcml0ZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogU3ByaXRlfVxufSk7XG5cbi8qKlxuICogVGhlIHdpZHRoIG9mIHRoZSBzcHJpdGUsIHNldHRpbmcgdGhpcyB3aWxsIGFjdHVhbGx5IG1vZGlmeSB0aGUgc2NhbGUgdG8gYWNoZWl2ZSB0aGUgdmFsdWUgc2V0XG4gKlxuICogQHByb3BlcnR5IHdpZHRoXG4gKiBAdHlwZSBOdW1iZXJcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnd2lkdGgnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhbGUueCAqIHRoaXMudGV4dHVyZS5mcmFtZS53aWR0aDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5zY2FsZS54ID0gdmFsdWUgLyB0aGlzLnRleHR1cmUuZnJhbWUud2lkdGg7XG4gICAgICAgIHRoaXMuX3dpZHRoID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogVGhlIGhlaWdodCBvZiB0aGUgc3ByaXRlLCBzZXR0aW5nIHRoaXMgd2lsbCBhY3R1YWxseSBtb2RpZnkgdGhlIHNjYWxlIHRvIGFjaGVpdmUgdGhlIHZhbHVlIHNldFxuICpcbiAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAqIEB0eXBlIE51bWJlclxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdoZWlnaHQnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICB0aGlzLnNjYWxlLnkgKiB0aGlzLnRleHR1cmUuZnJhbWUuaGVpZ2h0O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLnNjYWxlLnkgPSB2YWx1ZSAvIHRoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQ7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG4vKipcbiAqIFNldHMgdGhlIHRleHR1cmUgb2YgdGhlIHNwcml0ZVxuICpcbiAqIEBtZXRob2Qgc2V0VGV4dHVyZVxuICogQHBhcmFtIHRleHR1cmUge1RleHR1cmV9IFRoZSB0ZXh0dXJlIHRoYXQgaXMgZGlzcGxheWVkIGJ5IHRoZSBzcHJpdGVcbiAqL1xucHJvdG8uc2V0VGV4dHVyZSA9IGZ1bmN0aW9uIHNldFRleHR1cmUodGV4dHVyZSlcbntcbiAgICAvLyBzdG9wIGN1cnJlbnQgdGV4dHVyZTtcbiAgICBpZih0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUgIT09IHRleHR1cmUuYmFzZVRleHR1cmUpXG4gICAge1xuICAgICAgICB0aGlzLnRleHR1cmVDaGFuZ2UgPSB0cnVlO1xuICAgICAgICB0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuXG4gICAgICAgIGlmKHRoaXMuX19yZW5kZXJHcm91cClcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5fX3JlbmRlckdyb3VwLnVwZGF0ZVRleHR1cmUodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogV2hlbiB0aGUgdGV4dHVyZSBpcyB1cGRhdGVkLCB0aGlzIGV2ZW50IHdpbGwgZmlyZSB0byB1cGRhdGUgdGhlIHNjYWxlIGFuZCBmcmFtZVxuICpcbiAqIEBtZXRob2Qgb25UZXh0dXJlVXBkYXRlXG4gKiBAcGFyYW0gZXZlbnRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uVGV4dHVyZVVwZGF0ZSA9IGZ1bmN0aW9uIG9uVGV4dHVyZVVwZGF0ZSgpXG57XG4gICAgLy8gc28gaWYgX3dpZHRoIGlzIDAgdGhlbiB3aWR0aCB3YXMgbm90IHNldC4uXG4gICAgaWYodGhpcy5fd2lkdGgpdGhpcy5zY2FsZS54ID0gdGhpcy5fd2lkdGggLyB0aGlzLnRleHR1cmUuZnJhbWUud2lkdGg7XG4gICAgaWYodGhpcy5faGVpZ2h0KXRoaXMuc2NhbGUueSA9IHRoaXMuX2hlaWdodCAvIHRoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQ7XG5cbiAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbn07XG5cbi8vIHNvbWUgaGVscGVyIGZ1bmN0aW9ucy4uXG5cbi8qKlxuICpcbiAqIEhlbHBlciBmdW5jdGlvbiB0aGF0IGNyZWF0ZXMgYSBzcHJpdGUgdGhhdCB3aWxsIGNvbnRhaW4gYSB0ZXh0dXJlIGZyb20gdGhlIFRleHR1cmVDYWNoZSBiYXNlZCBvbiB0aGUgZnJhbWVJZFxuICogVGhlIGZyYW1lIGlkcyBhcmUgY3JlYXRlZCB3aGVuIGEgVGV4dHVyZSBwYWNrZXIgZmlsZSBoYXMgYmVlbiBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIGZyb21GcmFtZVxuICogQHN0YXRpY1xuICogQHBhcmFtIGZyYW1lSWQge1N0cmluZ30gVGhlIGZyYW1lIElkIG9mIHRoZSB0ZXh0dXJlIGluIHRoZSBjYWNoZVxuICogQHJldHVybiB7U3ByaXRlfSBBIG5ldyBTcHJpdGUgdXNpbmcgYSB0ZXh0dXJlIGZyb20gdGhlIHRleHR1cmUgY2FjaGUgbWF0Y2hpbmcgdGhlIGZyYW1lSWRcbiAqL1xuU3ByaXRlLmZyb21GcmFtZSA9IGZ1bmN0aW9uIGZyb21GcmFtZShmcmFtZUlkKVxue1xuICAgIHZhciB0ZXh0dXJlID0gVGV4dHVyZS5jYWNoZVtmcmFtZUlkXTtcbiAgICBpZighdGV4dHVyZSkgdGhyb3cgbmV3IEVycm9yKCdUaGUgZnJhbWVJZCBcIicgKyBmcmFtZUlkICsgJ1wiIGRvZXMgbm90IGV4aXN0IGluIHRoZSB0ZXh0dXJlIGNhY2hlJyArIHRoaXMpO1xuICAgIHJldHVybiBuZXcgU3ByaXRlKHRleHR1cmUpO1xufTtcblxuLyoqXG4gKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyBhIHNwcml0ZSB0aGF0IHdpbGwgY29udGFpbiBhIHRleHR1cmUgYmFzZWQgb24gYW4gaW1hZ2UgdXJsXG4gKiBJZiB0aGUgaW1hZ2UgaXMgbm90IGluIHRoZSB0ZXh0dXJlIGNhY2hlIGl0IHdpbGwgYmUgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBmcm9tSW1hZ2VcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSBpbWFnZUlkIHtTdHJpbmd9IFRoZSBpbWFnZSB1cmwgb2YgdGhlIHRleHR1cmVcbiAqIEByZXR1cm4ge1Nwcml0ZX0gQSBuZXcgU3ByaXRlIHVzaW5nIGEgdGV4dHVyZSBmcm9tIHRoZSB0ZXh0dXJlIGNhY2hlIG1hdGNoaW5nIHRoZSBpbWFnZSBpZFxuICovXG5TcHJpdGUuZnJvbUltYWdlID0gZnVuY3Rpb24gZnJvbUltYWdlKGltYWdlSWQpXG57XG4gICAgdmFyIHRleHR1cmUgPSBUZXh0dXJlLmZyb21JbWFnZShpbWFnZUlkKTtcbiAgICByZXR1cm4gbmV3IFNwcml0ZSh0ZXh0dXJlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3ByaXRlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uL2NvcmUvZ2xvYmFscycpO1xudmFyIG1hdDMgPSByZXF1aXJlKCcuLi9nZW9tL21hdHJpeCcpLm1hdDM7XG52YXIgaGV4MnJnYiA9IHJlcXVpcmUoJy4uL3V0aWxzL2NvbG9yJykuaGV4MnJnYjtcblxudmFyIERpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuL0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcbnZhciBJbnRlcmFjdGlvbk1hbmFnZXIgPSByZXF1aXJlKCcuLi9JbnRlcmFjdGlvbk1hbmFnZXInKTtcbnZhciBSZWN0YW5nbGUgPSByZXF1aXJlKCcuLi9nZW9tL1JlY3RhbmdsZScpO1xuXG4vKipcbiAqIEEgU3RhZ2UgcmVwcmVzZW50cyB0aGUgcm9vdCBvZiB0aGUgZGlzcGxheSB0cmVlLiBFdmVyeXRoaW5nIGNvbm5lY3RlZCB0byB0aGUgc3RhZ2UgaXMgcmVuZGVyZWRcbiAqXG4gKiBAY2xhc3MgU3RhZ2VcbiAqIEBleHRlbmRzIERpc3BsYXlPYmplY3RDb250YWluZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIGJhY2tncm91bmRDb2xvciB7TnVtYmVyfSB0aGUgYmFja2dyb3VuZCBjb2xvciBvZiB0aGUgc3RhZ2UsIGVhc2llc3Qgd2F5IHRvIHBhc3MgdGhpcyBpbiBpcyBpbiBoZXggZm9ybWF0XG4gKiAgICAgIGxpa2U6IDB4RkZGRkZGIGZvciB3aGl0ZVxuICovXG5mdW5jdGlvbiBTdGFnZShiYWNrZ3JvdW5kQ29sb3IpXG57XG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gQ3VycmVudCB0cmFuc2Zvcm0gb2YgdGhlIG9iamVjdCBiYXNlZCBvbiB3b3JsZCAocGFyZW50KSBmYWN0b3JzXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgd29ybGRUcmFuc2Zvcm1cbiAgICAgKiBAdHlwZSBNYXQzXG4gICAgICogQHJlYWRPbmx5XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLndvcmxkVHJhbnNmb3JtID0gbWF0My5jcmVhdGUoKTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgb3Igbm90IHRoZSBzdGFnZSBpcyBpbnRlcmFjdGl2ZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGludGVyYWN0aXZlXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMuaW50ZXJhY3RpdmUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGludGVyYWN0aW9uIG1hbmFnZSBmb3IgdGhpcyBzdGFnZSwgbWFuYWdlcyBhbGwgaW50ZXJhY3RpdmUgYWN0aXZpdHkgb24gdGhlIHN0YWdlXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgaW50ZXJhY3RpdmVcbiAgICAgKiBAdHlwZSBJbnRlcmFjdGlvbk1hbmFnZXJcbiAgICAgKi9cbiAgICB0aGlzLmludGVyYWN0aW9uTWFuYWdlciA9IG5ldyBJbnRlcmFjdGlvbk1hbmFnZXIodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSBzdGFnZSBpcyBkaXJ0eSBhbmQgbmVlZHMgdG8gaGF2ZSBpbnRlcmFjdGlvbnMgdXBkYXRlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGRpcnR5XG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG5cbiAgICB0aGlzLl9fY2hpbGRyZW5BZGRlZCA9IFtdO1xuICAgIHRoaXMuX19jaGlsZHJlblJlbW92ZWQgPSBbXTtcblxuICAgIC8vdGhlIHN0YWdlIGlzIGl0J3Mgb3duIHN0YWdlXG4gICAgdGhpcy5zdGFnZSA9IHRoaXM7XG5cbiAgICAvL29wdGltaXplIGhpdCBkZXRlY3Rpb24gYSBiaXRcbiAgICB0aGlzLnN0YWdlLmhpdEFyZWEgPSBuZXcgUmVjdGFuZ2xlKDAsMCwxMDAwMDAsIDEwMDAwMCk7XG5cbiAgICB0aGlzLnNldEJhY2tncm91bmRDb2xvcihiYWNrZ3JvdW5kQ29sb3IpO1xuICAgIHRoaXMud29ybGRWaXNpYmxlID0gdHJ1ZTtcbn1cblxudmFyIHByb3RvID0gU3RhZ2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFN0YWdlfVxufSk7XG5cbi8qKlxuICogU2V0cyBhbm90aGVyIERPTSBlbGVtZW50IHdoaWNoIGNhbiByZWNlaXZlIG1vdXNlL3RvdWNoIGludGVyYWN0aW9ucyBpbnN0ZWFkIG9mIHRoZSBkZWZhdWx0IENhbnZhcyBlbGVtZW50LlxuICogVGhpcyBpcyB1c2VmdWwgZm9yIHdoZW4geW91IGhhdmUgb3RoZXIgRE9NIGVsZW1lbnRzIG9udG9wIG9mIHRoZSBDYW52YXMgZWxlbWVudC5cbiAqXG4gKiBAbWV0aG9kIHNldEludGVyYWN0aW9uRGVsZWdhdGVcbiAqIEBwYXJhbSBkb21FbGVtZW50IHtET01FbGVtZW50fSBUaGlzIG5ldyBkb21FbGVtZW50IHdoaWNoIHdpbGwgcmVjZWl2ZSBtb3VzZS90b3VjaCBldmVudHNcbiAqL1xucHJvdG8uc2V0SW50ZXJhY3Rpb25EZWxlZ2F0ZSA9IGZ1bmN0aW9uIHNldEludGVyYWN0aW9uRGVsZWdhdGUoZG9tRWxlbWVudClcbntcbiAgICB0aGlzLmludGVyYWN0aW9uTWFuYWdlci5zZXRUYXJnZXREb21FbGVtZW50KCBkb21FbGVtZW50ICk7XG59O1xuXG4vKlxuICogVXBkYXRlcyB0aGUgb2JqZWN0IHRyYW5zZm9ybSBmb3IgcmVuZGVyaW5nXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgdGhpcy53b3JsZEFscGhhID0gMTtcbiAgICB0aGlzLnZjb3VudCA9IGdsb2JhbHMudmlzaWJsZUNvdW50O1xuXG4gICAgZm9yKHZhciBpPTAsaj10aGlzLmNoaWxkcmVuLmxlbmd0aDsgaTxqOyBpKyspXG4gICAge1xuICAgICAgICB0aGlzLmNoaWxkcmVuW2ldLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgIH1cblxuICAgIGlmKHRoaXMuZGlydHkpXG4gICAge1xuICAgICAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgIC8vIHVwZGF0ZSBpbnRlcmFjdGl2ZSFcbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbk1hbmFnZXIuZGlydHkgPSB0cnVlO1xuICAgIH1cblxuXG4gICAgaWYodGhpcy5pbnRlcmFjdGl2ZSl0aGlzLmludGVyYWN0aW9uTWFuYWdlci51cGRhdGUoKTtcbn07XG5cbi8qKlxuICogU2V0cyB0aGUgYmFja2dyb3VuZCBjb2xvciBmb3IgdGhlIHN0YWdlXG4gKlxuICogQG1ldGhvZCBzZXRCYWNrZ3JvdW5kQ29sb3JcbiAqIEBwYXJhbSBiYWNrZ3JvdW5kQ29sb3Ige051bWJlcn0gdGhlIGNvbG9yIG9mIHRoZSBiYWNrZ3JvdW5kLCBlYXNpZXN0IHdheSB0byBwYXNzIHRoaXMgaW4gaXMgaW4gaGV4IGZvcm1hdFxuICogICAgICBsaWtlOiAweEZGRkZGRiBmb3Igd2hpdGVcbiAqL1xucHJvdG8uc2V0QmFja2dyb3VuZENvbG9yID0gZnVuY3Rpb24gc2V0QmFja2dyb3VuZENvbG9yKGJhY2tncm91bmRDb2xvcilcbntcbiAgICB0aGlzLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmRDb2xvciB8fCAweDAwMDAwMDtcbiAgICB0aGlzLmJhY2tncm91bmRDb2xvclNwbGl0ID0gaGV4MnJnYih0aGlzLmJhY2tncm91bmRDb2xvcik7XG4gICAgdmFyIGhleCA9IHRoaXMuYmFja2dyb3VuZENvbG9yLnRvU3RyaW5nKDE2KTtcbiAgICBoZXggPSAnMDAwMDAwJy5zdWJzdHIoMCwgNiAtIGhleC5sZW5ndGgpICsgaGV4O1xuICAgIHRoaXMuYmFja2dyb3VuZENvbG9yU3RyaW5nID0gJyMnICsgaGV4O1xufTtcblxuLyoqXG4gKiBUaGlzIHdpbGwgcmV0dXJuIHRoZSBwb2ludCBjb250YWluaW5nIGdsb2JhbCBjb29yZHMgb2YgdGhlIG1vdXNlLlxuICpcbiAqIEBtZXRob2QgZ2V0TW91c2VQb3NpdGlvblxuICogQHJldHVybiB7UG9pbnR9IFRoZSBwb2ludCBjb250YWluaW5nIHRoZSBjb29yZHMgb2YgdGhlIGdsb2JhbCBJbnRlcmFjdGlvbkRhdGEgcG9zaXRpb24uXG4gKi9cbnByb3RvLmdldE1vdXNlUG9zaXRpb24gPSBmdW5jdGlvbiBnZXRNb3VzZVBvc2l0aW9uKClcbntcbiAgICByZXR1cm4gdGhpcy5pbnRlcmFjdGlvbk1hbmFnZXIubW91c2UuZ2xvYmFsO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGFnZTtcbiIsIi8qKlxuICogQGF1dGhvciBEci4gS2liaXR6IDxpbmZvQGRya2liaXR6LmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0Tk9STUFMOiAwLFxuXHRTQ1JFRU46IDFcbn07XG4iLCIvKipcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvZXZlbnR0YXJnZXQuanMvXG4gKiBUSGFua1MgbXIgRE9vYiFcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvZXZlbnR0YXJnZXQuanMvXG4gKiBUSGFua1MgbXIgRE9vYiFcbiAqL1xuXG4vKipcbiAqIEFkZHMgZXZlbnQgZW1pdHRlciBmdW5jdGlvbmFsaXR5IHRvIGEgY2xhc3NcbiAqXG4gKiBAY2xhc3MgRXZlbnRUYXJnZXRcbiAqIEBleGFtcGxlXG4gKiAgICAgIGZ1bmN0aW9uIE15RW1pdHRlcigpIHtcbiAqICAgICAgICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7IC8vbWl4ZXMgaW4gZXZlbnQgdGFyZ2V0IHN0dWZmXG4gKiAgICAgIH1cbiAqXG4gKiAgICAgIHZhciBlbSA9IG5ldyBNeUVtaXR0ZXIoKTtcbiAqICAgICAgZW0uZW1pdCh7IHR5cGU6ICdldmVudE5hbWUnLCBkYXRhOiAnc29tZSBkYXRhJyB9KTtcbiAqL1xuZnVuY3Rpb24gRXZlbnRUYXJnZXQoKSB7XG5cbiAgICB2YXIgbGlzdGVuZXJzID0ge307XG5cbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIgPSB0aGlzLm9uID0gZnVuY3Rpb24gKCB0eXBlLCBsaXN0ZW5lciApIHtcblxuXG4gICAgICAgIGlmICggbGlzdGVuZXJzWyB0eXBlIF0gPT09IHVuZGVmaW5lZCApIHtcblxuICAgICAgICAgICAgbGlzdGVuZXJzWyB0eXBlIF0gPSBbXTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBsaXN0ZW5lcnNbIHR5cGUgXS5pbmRleE9mKCBsaXN0ZW5lciApID09PSAtIDEgKSB7XG5cbiAgICAgICAgICAgIGxpc3RlbmVyc1sgdHlwZSBdLnB1c2goIGxpc3RlbmVyICk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQgPSB0aGlzLmVtaXQgPSBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXG4gICAgICAgIGlmICggIWxpc3RlbmVyc1sgZXZlbnQudHlwZSBdIHx8ICFsaXN0ZW5lcnNbIGV2ZW50LnR5cGUgXS5sZW5ndGggKSB7XG5cbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB9XG5cbiAgICAgICAgZm9yKHZhciBpID0gMCwgbCA9IGxpc3RlbmVyc1sgZXZlbnQudHlwZSBdLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXG4gICAgICAgICAgICBsaXN0ZW5lcnNbIGV2ZW50LnR5cGUgXVsgaSBdKCBldmVudCApO1xuXG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSB0aGlzLm9mZiA9IGZ1bmN0aW9uICggdHlwZSwgbGlzdGVuZXIgKSB7XG5cbiAgICAgICAgdmFyIGluZGV4ID0gbGlzdGVuZXJzWyB0eXBlIF0uaW5kZXhPZiggbGlzdGVuZXIgKTtcblxuICAgICAgICBpZiAoIGluZGV4ICE9PSAtIDEgKSB7XG5cbiAgICAgICAgICAgIGxpc3RlbmVyc1sgdHlwZSBdLnNwbGljZSggaW5kZXgsIDEgKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgdGhpcy5yZW1vdmVBbGxFdmVudExpc3RlbmVycyA9IGZ1bmN0aW9uKCB0eXBlICkge1xuICAgICAgICB2YXIgYSA9IGxpc3RlbmVyc1t0eXBlXTtcbiAgICAgICAgaWYgKGEpXG4gICAgICAgICAgICBhLmxlbmd0aCA9IDA7XG4gICAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudFRhcmdldDtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIERpc3BsYXlPYmplY3QgPSByZXF1aXJlKCcuLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3QnKTtcblxuLyoqXG4gKiBUaGlzIG9iamVjdCBpcyBvbmUgdGhhdCB3aWxsIGFsbG93IHlvdSB0byBzcGVjaWZ5IGN1c3RvbSByZW5kZXJpbmcgZnVuY3Rpb25zIGJhc2VkIG9uIHJlbmRlciB0eXBlXG4gKlxuICogQGNsYXNzIEN1c3RvbVJlbmRlcmFibGVcbiAqIEBleHRlbmRzIERpc3BsYXlPYmplY3RcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDdXN0b21SZW5kZXJhYmxlKClcbntcbiAgICBEaXNwbGF5T2JqZWN0LmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnJlbmRlcmFibGUgPSB0cnVlO1xufVxuXG52YXIgcHJvdG8gPSBDdXN0b21SZW5kZXJhYmxlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGlzcGxheU9iamVjdC5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBDdXN0b21SZW5kZXJhYmxlfVxufSk7XG5cbi8qKlxuICogSWYgdGhpcyBvYmplY3QgaXMgYmVpbmcgcmVuZGVyZWQgYnkgYSBDYW52YXNSZW5kZXJlciBpdCB3aWxsIGNhbGwgdGhpcyBjYWxsYmFja1xuICpcbiAqIEBtZXRob2QgcmVuZGVyQ2FudmFzXG4gKiBAcGFyYW0gcmVuZGVyZXIge0NhbnZhc1JlbmRlcmVyfSBUaGUgcmVuZGVyZXIgaW5zdGFuY2VcbiAqL1xucHJvdG8ucmVuZGVyQ2FudmFzID0gZnVuY3Rpb24gcmVuZGVyQ2FudmFzKClcbntcbiAgICAvLyBvdmVycmlkZSFcbn07XG5cbi8qKlxuICogSWYgdGhpcyBvYmplY3QgaXMgYmVpbmcgcmVuZGVyZWQgYnkgYSBXZWJHTFJlbmRlcmVyIGl0IHdpbGwgY2FsbCB0aGlzIGNhbGxiYWNrIHRvIGluaXRpYWxpemVcbiAqXG4gKiBAbWV0aG9kIGluaXRXZWJHTFxuICogQHBhcmFtIHJlbmRlcmVyIHtXZWJHTFJlbmRlcmVyfSBUaGUgcmVuZGVyZXIgaW5zdGFuY2VcbiAqL1xucHJvdG8uaW5pdFdlYkdMID0gZnVuY3Rpb24gaW5pdFdlYkdMKClcbntcbiAgICAvLyBvdmVycmlkZSFcbn07XG5cbi8qKlxuICogSWYgdGhpcyBvYmplY3QgaXMgYmVpbmcgcmVuZGVyZWQgYnkgYSBXZWJHTFJlbmRlcmVyIGl0IHdpbGwgY2FsbCB0aGlzIGNhbGxiYWNrXG4gKlxuICogQG1ldGhvZCByZW5kZXJXZWJHTFxuICogQHBhcmFtIHJlbmRlckdyb3VwIHtXZWJHTFJlbmRlckdyb3VwfSBUaGUgcmVuZGVyZXIgZ3JvdXAgaW5zdGFuY2VcbiAqIEBwYXJhbSBwcm9qZWN0aW9uTWF0cml4IHtNYXRyaXh9IFRoZSBvYmplY3QncyBwcm9qZWN0aW9uIG1hdHJpeFxuICovXG5wcm90by5yZW5kZXJXZWJHTCA9IGZ1bmN0aW9uIHJlbmRlcldlYkdMKClcbntcbiAgICAvLyBub3Qgc3VyZSBpZiBib3RoIG5lZWRlZD8gYnV0IHlhIGhhdmUgZm9yIG5vdyFcbiAgICAvLyBvdmVycmlkZSFcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ3VzdG9tUmVuZGVyYWJsZTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tL1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBTdHJpcCA9IHJlcXVpcmUoJy4vU3RyaXAnKTtcbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG5cbmZ1bmN0aW9uIFJvcGUodGV4dHVyZSwgcG9pbnRzKVxue1xuICAgIFN0cmlwLmNhbGwodGhpcywgdGV4dHVyZSk7XG4gICAgdGhpcy5wb2ludHMgPSBwb2ludHM7XG5cbiAgICB0cnlcbiAgICB7XG4gICAgICAgIHRoaXMudmVydGljaWVzID0gbmV3IEZsb2F0MzJBcnJheShwb2ludHMubGVuZ3RoICogNCk7XG4gICAgICAgIHRoaXMudXZzID0gbmV3IEZsb2F0MzJBcnJheShwb2ludHMubGVuZ3RoICogNCk7XG4gICAgICAgIHRoaXMuY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheShwb2ludHMubGVuZ3RoICogMik7XG4gICAgICAgIHRoaXMuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShwb2ludHMubGVuZ3RoICogMik7XG4gICAgfVxuICAgIGNhdGNoKGVycm9yKVxuICAgIHtcbiAgICAgICAgdGhpcy52ZXJ0aWNpZXMgPSBuZXcgQXJyYXkocG9pbnRzLmxlbmd0aCAqIDQpO1xuICAgICAgICB0aGlzLnV2cyA9IG5ldyBBcnJheShwb2ludHMubGVuZ3RoICogNCk7XG4gICAgICAgIHRoaXMuY29sb3JzID0gbmV3IEFycmF5KHBvaW50cy5sZW5ndGggKiAyKTtcbiAgICAgICAgdGhpcy5pbmRpY2VzID0gbmV3IEFycmF5KHBvaW50cy5sZW5ndGggKiAyKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlZnJlc2goKTtcbn1cblxudmFyIHByb3RvID0gUm9wZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0cmlwLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFJvcGV9XG59KTtcblxucHJvdG8ucmVmcmVzaCA9IGZ1bmN0aW9uIHJlZnJlc2goKVxue1xuICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50cztcbiAgICBpZihwb2ludHMubGVuZ3RoIDwgMSkgcmV0dXJuO1xuXG4gICAgdmFyIHV2cyA9IHRoaXMudXZzO1xuXG4gICAgdmFyIGxhc3RQb2ludCA9IHBvaW50c1swXTtcbiAgICB2YXIgaW5kaWNlcyA9IHRoaXMuaW5kaWNlcztcbiAgICB2YXIgY29sb3JzID0gdGhpcy5jb2xvcnM7XG5cbiAgICB0aGlzLmNvdW50LT0wLjI7XG5cblxuICAgIHV2c1swXSA9IDA7XG4gICAgdXZzWzFdID0gMTtcbiAgICB1dnNbMl0gPSAwO1xuICAgIHV2c1szXSA9IDE7XG5cbiAgICBjb2xvcnNbMF0gPSAxO1xuICAgIGNvbG9yc1sxXSA9IDE7XG5cbiAgICBpbmRpY2VzWzBdID0gMDtcbiAgICBpbmRpY2VzWzFdID0gMTtcblxuICAgIHZhciB0b3RhbCA9IHBvaW50cy5sZW5ndGgsXG4gICAgICAgIHBvaW50LCBpbmRleCwgYW1vdW50O1xuXG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCB0b3RhbDsgaSsrKVxuICAgIHtcblxuICAgICAgICBwb2ludCA9IHBvaW50c1tpXTtcbiAgICAgICAgaW5kZXggPSBpICogNDtcbiAgICAgICAgLy8gdGltZSB0byBkbyBzb21lIHNtYXJ0IGRyYXdpbmchXG4gICAgICAgIGFtb3VudCA9IGkgLyAodG90YWwtMSk7XG5cbiAgICAgICAgaWYoaSUyKVxuICAgICAgICB7XG4gICAgICAgICAgICB1dnNbaW5kZXhdID0gYW1vdW50O1xuICAgICAgICAgICAgdXZzW2luZGV4KzFdID0gMDtcblxuICAgICAgICAgICAgdXZzW2luZGV4KzJdID0gYW1vdW50O1xuICAgICAgICAgICAgdXZzW2luZGV4KzNdID0gMTtcblxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgdXZzW2luZGV4XSA9IGFtb3VudDtcbiAgICAgICAgICAgIHV2c1tpbmRleCsxXSA9IDA7XG5cbiAgICAgICAgICAgIHV2c1tpbmRleCsyXSA9IGFtb3VudDtcbiAgICAgICAgICAgIHV2c1tpbmRleCszXSA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICBpbmRleCA9IGkgKiAyO1xuICAgICAgICBjb2xvcnNbaW5kZXhdID0gMTtcbiAgICAgICAgY29sb3JzW2luZGV4KzFdID0gMTtcblxuICAgICAgICBpbmRleCA9IGkgKiAyO1xuICAgICAgICBpbmRpY2VzW2luZGV4XSA9IGluZGV4O1xuICAgICAgICBpbmRpY2VzW2luZGV4ICsgMV0gPSBpbmRleCArIDE7XG5cbiAgICAgICAgbGFzdFBvaW50ID0gcG9pbnQ7XG4gICAgfVxufTtcblxucHJvdG8udXBkYXRlVHJhbnNmb3JtID0gZnVuY3Rpb24gdXBkYXRlVHJhbnNmb3JtKClcbntcblxuICAgIHZhciBwb2ludHMgPSB0aGlzLnBvaW50cztcbiAgICBpZihwb2ludHMubGVuZ3RoIDwgMSlyZXR1cm47XG5cbiAgICB2YXIgbGFzdFBvaW50ID0gcG9pbnRzWzBdO1xuICAgIHZhciBuZXh0UG9pbnQ7XG4gICAgdmFyIHBlcnAgPSB7eDowLCB5OjB9O1xuXG4gICAgdGhpcy5jb3VudC09MC4yO1xuXG4gICAgdmFyIHZlcnRpY2llcyA9IHRoaXMudmVydGljaWVzO1xuICAgIHZlcnRpY2llc1swXSA9IGxhc3RQb2ludC54ICsgcGVycC54O1xuICAgIHZlcnRpY2llc1sxXSA9IGxhc3RQb2ludC55ICsgcGVycC55OyAvLysgMjAwXG4gICAgdmVydGljaWVzWzJdID0gbGFzdFBvaW50LnggLSBwZXJwLng7XG4gICAgdmVydGljaWVzWzNdID0gbGFzdFBvaW50LnkgLSBwZXJwLnk7Ly8rMjAwXG4gICAgLy8gdGltZSB0byBkbyBzb21lIHNtYXJ0IGRyYXdpbmchXG5cbiAgICB2YXIgdG90YWwgPSBwb2ludHMubGVuZ3RoLFxuICAgICAgICBwb2ludCwgaW5kZXgsIHJhdGlvLCBwZXJwTGVuZ3RoLCBudW07XG5cbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IHRvdGFsOyBpKyspXG4gICAge1xuICAgICAgICBwb2ludCA9IHBvaW50c1tpXTtcbiAgICAgICAgaW5kZXggPSBpICogNDtcblxuICAgICAgICBpZihpIDwgcG9pbnRzLmxlbmd0aC0xKVxuICAgICAgICB7XG4gICAgICAgICAgICBuZXh0UG9pbnQgPSBwb2ludHNbaSsxXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5leHRQb2ludCA9IHBvaW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcGVycC55ID0gLShuZXh0UG9pbnQueCAtIGxhc3RQb2ludC54KTtcbiAgICAgICAgcGVycC54ID0gbmV4dFBvaW50LnkgLSBsYXN0UG9pbnQueTtcblxuICAgICAgICByYXRpbyA9ICgxIC0gKGkgLyAodG90YWwtMSkpKSAqIDEwO1xuXG4gICAgICAgIGlmKHJhdGlvID4gMSkgcmF0aW8gPSAxO1xuXG4gICAgICAgIHBlcnBMZW5ndGggPSBNYXRoLnNxcnQocGVycC54ICogcGVycC54ICsgcGVycC55ICogcGVycC55KTtcbiAgICAgICAgbnVtID0gdGhpcy50ZXh0dXJlLmhlaWdodCAvIDI7IC8vKDIwICsgTWF0aC5hYnMoTWF0aC5zaW4oKGkgKyB0aGlzLmNvdW50KSAqIDAuMykgKiA1MCkgKSogcmF0aW87XG4gICAgICAgIHBlcnAueCAvPSBwZXJwTGVuZ3RoO1xuICAgICAgICBwZXJwLnkgLz0gcGVycExlbmd0aDtcblxuICAgICAgICBwZXJwLnggKj0gbnVtO1xuICAgICAgICBwZXJwLnkgKj0gbnVtO1xuXG4gICAgICAgIHZlcnRpY2llc1tpbmRleF0gPSBwb2ludC54ICsgcGVycC54O1xuICAgICAgICB2ZXJ0aWNpZXNbaW5kZXgrMV0gPSBwb2ludC55ICsgcGVycC55O1xuICAgICAgICB2ZXJ0aWNpZXNbaW5kZXgrMl0gPSBwb2ludC54IC0gcGVycC54O1xuICAgICAgICB2ZXJ0aWNpZXNbaW5kZXgrM10gPSBwb2ludC55IC0gcGVycC55O1xuXG4gICAgICAgIGxhc3RQb2ludCA9IHBvaW50O1xuICAgIH1cblxuICAgIERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLnVwZGF0ZVRyYW5zZm9ybS5jYWxsKCB0aGlzICk7XG59O1xuXG5wcm90by5zZXRUZXh0dXJlID0gZnVuY3Rpb24gc2V0VGV4dHVyZSh0ZXh0dXJlKVxue1xuICAgIC8vIHN0b3AgY3VycmVudCB0ZXh0dXJlXG4gICAgdGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcbiAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUm9wZTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKiBiYXNlZCBvbiBwaXhpIGltcGFjdCBzcGluZSBpbXBsZW1lbnRhdGlvbiBtYWRlIGJ5IEVlbWVsaSBLZWxva29ycGkgKEBla2Vsb2tvcnBpKSBodHRwczovL2dpdGh1Yi5jb20vZWtlbG9rb3JwaVxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzcGluZSA9IHJlcXVpcmUoJy4uL3V0aWxzL3NwaW5lJyk7XG52YXIgRGlzcGxheU9iamVjdENvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2Rpc3BsYXkvRGlzcGxheU9iamVjdENvbnRhaW5lcicpO1xudmFyIFNwcml0ZSA9IHJlcXVpcmUoJy4uL2Rpc3BsYXkvU3ByaXRlJyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uL3RleHR1cmVzL1RleHR1cmUnKTtcblxuLyoqXG4gKiBBIGNsYXNzIHRoYXQgZW5hYmxlcyB0aGUgeW91IHRvIGltcG9ydCBhbmQgcnVuIHlvdXIgc3BpbmUgYW5pbWF0aW9ucyBpbiBwaXhpLlxuICogU3BpbmUgYW5pbWF0aW9uIGRhdGEgbmVlZHMgdG8gYmUgbG9hZGVkIHVzaW5nIHRoZSBBc3NldExvYWRlciBvciBTcGluZUxvYWRlciBiZWZvcmUgaXQgY2FuIGJlIHVzZWQgYnkgdGhpcyBjbGFzc1xuICogU2VlIGV4YW1wbGUgMTIgKGh0dHA6Ly93d3cuZ29vZGJveWRpZ2l0YWwuY29tL3BpeGlqcy9leGFtcGxlcy8xMi8pIHRvIHNlZSBhIHdvcmtpbmcgZXhhbXBsZSBhbmQgY2hlY2sgb3V0IHRoZSBzb3VyY2VcbiAqXG4gKiBAY2xhc3MgU3BpbmVcbiAqIEBleHRlbmRzIERpc3BsYXlPYmplY3RDb250YWluZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHVybCB7U3RyaW5nfSBUaGUgdXJsIG9mIHRoZSBzcGluZSBhbmltIGZpbGUgdG8gYmUgdXNlZFxuICovXG5mdW5jdGlvbiBTcGluZSh1cmwpIHtcbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnNwaW5lRGF0YSA9IFNwaW5lLmFuaW1DYWNoZVt1cmxdO1xuXG4gICAgaWYgKCF0aGlzLnNwaW5lRGF0YSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NwaW5lIGRhdGEgbXVzdCBiZSBwcmVsb2FkZWQgdXNpbmcgU3BpbmVMb2FkZXIgb3IgQXNzZXRMb2FkZXI6ICcgKyB1cmwpO1xuICAgIH1cblxuICAgIHRoaXMuc2tlbGV0b24gPSBuZXcgc3BpbmUuU2tlbGV0b24odGhpcy5zcGluZURhdGEpO1xuICAgIHRoaXMuc2tlbGV0b24udXBkYXRlV29ybGRUcmFuc2Zvcm0oKTtcblxuICAgIHRoaXMuc3RhdGVEYXRhID0gbmV3IHNwaW5lLkFuaW1hdGlvblN0YXRlRGF0YSh0aGlzLnNwaW5lRGF0YSk7XG4gICAgdGhpcy5zdGF0ZSA9IG5ldyBzcGluZS5BbmltYXRpb25TdGF0ZSh0aGlzLnN0YXRlRGF0YSk7XG5cbiAgICB0aGlzLnNsb3RDb250YWluZXJzID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbiA9IHRoaXMuc2tlbGV0b24uZHJhd09yZGVyLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICB2YXIgc2xvdCA9IHRoaXMuc2tlbGV0b24uZHJhd09yZGVyW2ldO1xuICAgICAgICB2YXIgYXR0YWNobWVudCA9IHNsb3QuYXR0YWNobWVudDtcbiAgICAgICAgdmFyIHNsb3RDb250YWluZXIgPSBuZXcgRGlzcGxheU9iamVjdENvbnRhaW5lcigpO1xuICAgICAgICB0aGlzLnNsb3RDb250YWluZXJzLnB1c2goc2xvdENvbnRhaW5lcik7XG4gICAgICAgIHRoaXMuYWRkQ2hpbGQoc2xvdENvbnRhaW5lcik7XG4gICAgICAgIGlmICghKGF0dGFjaG1lbnQgaW5zdGFuY2VvZiBzcGluZS5SZWdpb25BdHRhY2htZW50KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHNwcml0ZU5hbWUgPSBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0Lm5hbWU7XG4gICAgICAgIHZhciBzcHJpdGUgPSB0aGlzLmNyZWF0ZVNwcml0ZShzbG90LCBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0KTtcbiAgICAgICAgc2xvdC5jdXJyZW50U3ByaXRlID0gc3ByaXRlO1xuICAgICAgICBzbG90LmN1cnJlbnRTcHJpdGVOYW1lID0gc3ByaXRlTmFtZTtcbiAgICAgICAgc2xvdENvbnRhaW5lci5hZGRDaGlsZChzcHJpdGUpO1xuICAgIH1cbn1cblxudmFyIHByb3RvID0gU3BpbmUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFNwaW5lfVxufSk7XG5cbi8qXG4gKiBVcGRhdGVzIHRoZSBvYmplY3QgdHJhbnNmb3JtIGZvciByZW5kZXJpbmdcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRyYW5zZm9ybVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8udXBkYXRlVHJhbnNmb3JtID0gZnVuY3Rpb24gdXBkYXRlVHJhbnNmb3JtKCkge1xuICAgIHRoaXMubGFzdFRpbWUgPSB0aGlzLmxhc3RUaW1lIHx8IERhdGUubm93KCk7XG4gICAgdmFyIHRpbWVEZWx0YSA9IChEYXRlLm5vdygpIC0gdGhpcy5sYXN0VGltZSkgKiAwLjAwMTtcbiAgICB0aGlzLmxhc3RUaW1lID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnN0YXRlLnVwZGF0ZSh0aW1lRGVsdGEpO1xuICAgIHRoaXMuc3RhdGUuYXBwbHkodGhpcy5za2VsZXRvbik7XG4gICAgdGhpcy5za2VsZXRvbi51cGRhdGVXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgdmFyIGRyYXdPcmRlciA9IHRoaXMuc2tlbGV0b24uZHJhd09yZGVyO1xuICAgIGZvciAodmFyIGkgPSAwLCBuID0gZHJhd09yZGVyLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICB2YXIgc2xvdCA9IGRyYXdPcmRlcltpXTtcbiAgICAgICAgdmFyIGF0dGFjaG1lbnQgPSBzbG90LmF0dGFjaG1lbnQ7XG4gICAgICAgIHZhciBzbG90Q29udGFpbmVyID0gdGhpcy5zbG90Q29udGFpbmVyc1tpXTtcbiAgICAgICAgaWYgKCEoYXR0YWNobWVudCBpbnN0YW5jZW9mIHNwaW5lLlJlZ2lvbkF0dGFjaG1lbnQpKSB7XG4gICAgICAgICAgICBzbG90Q29udGFpbmVyLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QpIHtcbiAgICAgICAgICAgIGlmICghc2xvdC5jdXJyZW50U3ByaXRlTmFtZSB8fCBzbG90LmN1cnJlbnRTcHJpdGVOYW1lICE9PSBhdHRhY2htZW50Lm5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3ByaXRlTmFtZSA9IGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QubmFtZTtcbiAgICAgICAgICAgICAgICBpZiAoc2xvdC5jdXJyZW50U3ByaXRlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2xvdC5jdXJyZW50U3ByaXRlLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2xvdC5zcHJpdGVzID0gc2xvdC5zcHJpdGVzIHx8IHt9O1xuICAgICAgICAgICAgICAgIGlmIChzbG90LnNwcml0ZXNbc3ByaXRlTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBzbG90LnNwcml0ZXNbc3ByaXRlTmFtZV0udmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNwcml0ZSA9IHRoaXMuY3JlYXRlU3ByaXRlKHNsb3QsIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QpO1xuICAgICAgICAgICAgICAgICAgICBzbG90Q29udGFpbmVyLmFkZENoaWxkKHNwcml0ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNsb3QuY3VycmVudFNwcml0ZSA9IHNsb3Quc3ByaXRlc1tzcHJpdGVOYW1lXTtcbiAgICAgICAgICAgICAgICBzbG90LmN1cnJlbnRTcHJpdGVOYW1lID0gc3ByaXRlTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzbG90Q29udGFpbmVyLnZpc2libGUgPSB0cnVlO1xuXG4gICAgICAgIHZhciBib25lID0gc2xvdC5ib25lO1xuXG4gICAgICAgIHNsb3RDb250YWluZXIucG9zaXRpb24ueCA9IGJvbmUud29ybGRYICsgYXR0YWNobWVudC54ICogYm9uZS5tMDAgKyBhdHRhY2htZW50LnkgKiBib25lLm0wMTtcbiAgICAgICAgc2xvdENvbnRhaW5lci5wb3NpdGlvbi55ID0gYm9uZS53b3JsZFkgKyBhdHRhY2htZW50LnggKiBib25lLm0xMCArIGF0dGFjaG1lbnQueSAqIGJvbmUubTExO1xuICAgICAgICBzbG90Q29udGFpbmVyLnNjYWxlLnggPSBib25lLndvcmxkU2NhbGVYO1xuICAgICAgICBzbG90Q29udGFpbmVyLnNjYWxlLnkgPSBib25lLndvcmxkU2NhbGVZO1xuXG4gICAgICAgIHNsb3RDb250YWluZXIucm90YXRpb24gPSAtKHNsb3QuYm9uZS53b3JsZFJvdGF0aW9uICogTWF0aC5QSSAvIDE4MCk7XG4gICAgfVxuXG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyk7XG59O1xuXG5wcm90by5jcmVhdGVTcHJpdGUgPSBmdW5jdGlvbiBjcmVhdGVTcHJpdGUoc2xvdCwgZGVzY3JpcHRvcikge1xuICAgIHZhciBuYW1lID0gVGV4dHVyZS5jYWNoZVtkZXNjcmlwdG9yLm5hbWVdID8gZGVzY3JpcHRvci5uYW1lIDogZGVzY3JpcHRvci5uYW1lICsgJy5wbmcnO1xuICAgIHZhciBzcHJpdGUgPSBuZXcgU3ByaXRlKFRleHR1cmUuZnJvbUZyYW1lKG5hbWUpKTtcbiAgICBzcHJpdGUuc2NhbGUgPSBkZXNjcmlwdG9yLnNjYWxlO1xuICAgIHNwcml0ZS5yb3RhdGlvbiA9IGRlc2NyaXB0b3Iucm90YXRpb247XG4gICAgc3ByaXRlLmFuY2hvci54ID0gc3ByaXRlLmFuY2hvci55ID0gMC41O1xuXG4gICAgc2xvdC5zcHJpdGVzID0gc2xvdC5zcHJpdGVzIHx8IHt9O1xuICAgIHNsb3Quc3ByaXRlc1tkZXNjcmlwdG9yLm5hbWVdID0gc3ByaXRlO1xuICAgIHJldHVybiBzcHJpdGU7XG59O1xuXG5TcGluZS5hbmltQ2FjaGUgPSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBTcGluZTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tL1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBibGVuZE1vZGVzID0gcmVxdWlyZSgnLi4vZGlzcGxheS9ibGVuZE1vZGVzJyk7XG52YXIgRGlzcGxheU9iamVjdENvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2Rpc3BsYXkvRGlzcGxheU9iamVjdENvbnRhaW5lcicpO1xuXG5mdW5jdGlvbiBTdHJpcCh0ZXh0dXJlLCB3aWR0aCwgaGVpZ2h0KVxue1xuICAgIERpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCggdGhpcyApO1xuICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG4gICAgdGhpcy5ibGVuZE1vZGUgPSBibGVuZE1vZGVzLk5PUk1BTDtcblxuICAgIHRyeVxuICAgIHtcbiAgICAgICAgdGhpcy51dnMgPSBuZXcgRmxvYXQzMkFycmF5KFswLCAxLFxuICAgICAgICAgICAgICAgIDEsIDEsXG4gICAgICAgICAgICAgICAgMSwgMCwgMCwxXSk7XG5cbiAgICAgICAgdGhpcy52ZXJ0aWNpZXMgPSBuZXcgRmxvYXQzMkFycmF5KFswLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAwLDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgMCwgMF0pO1xuXG4gICAgICAgIHRoaXMuY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMSwgMV0pO1xuXG4gICAgICAgIHRoaXMuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShbMCwgMSwgMiwgM10pO1xuICAgIH1cbiAgICBjYXRjaChlcnJvcilcbiAgICB7XG4gICAgICAgIHRoaXMudXZzID0gWzAsIDEsXG4gICAgICAgICAgICAgICAgMSwgMSxcbiAgICAgICAgICAgICAgICAxLCAwLCAwLDFdO1xuXG4gICAgICAgIHRoaXMudmVydGljaWVzID0gWzAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAwXTtcblxuICAgICAgICB0aGlzLmNvbG9ycyA9IFsxLCAxLCAxLCAxXTtcblxuICAgICAgICB0aGlzLmluZGljZXMgPSBbMCwgMSwgMiwgM107XG4gICAgfVxuXG5cbiAgICAvKlxuICAgIHRoaXMudXZzID0gbmV3IEZsb2F0MzJBcnJheSgpXG4gICAgdGhpcy52ZXJ0aWNpZXMgPSBuZXcgRmxvYXQzMkFycmF5KClcbiAgICB0aGlzLmNvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoKVxuICAgIHRoaXMuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheSgpXG4gICAgKi9cbiAgICB0aGlzLndpZHRoID0gd2lkdGg7XG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICAvLyBsb2FkIHRoZSB0ZXh0dXJlIVxuICAgIGlmKHRleHR1cmUuYmFzZVRleHR1cmUuaGFzTG9hZGVkKVxuICAgIHtcbiAgICAgICAgdGhpcy53aWR0aCAgID0gdGhpcy50ZXh0dXJlLmZyYW1lLndpZHRoO1xuICAgICAgICB0aGlzLmhlaWdodCAgPSB0aGlzLnRleHR1cmUuZnJhbWUuaGVpZ2h0O1xuICAgICAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgICAgICB0aGlzLnRleHR1cmUuYWRkRXZlbnRMaXN0ZW5lciggJ3VwZGF0ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoYXQub25UZXh0dXJlVXBkYXRlKCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMucmVuZGVyYWJsZSA9IHRydWU7XG59XG5cbnZhciBwcm90byA9IFN0cmlwLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBTdHJpcH1cbn0pO1xuXG5wcm90by5zZXRUZXh0dXJlID0gZnVuY3Rpb24gc2V0VGV4dHVyZSh0ZXh0dXJlKVxue1xuICAgIC8vVE9ETyBTRVQgVEhFIFRFWFRVUkVTXG4gICAgLy9UT0RPIFZJU0lCSUxJVFlcblxuICAgIC8vIHN0b3AgY3VycmVudCB0ZXh0dXJlXG4gICAgdGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcbiAgICB0aGlzLndpZHRoICAgPSB0ZXh0dXJlLmZyYW1lLndpZHRoO1xuICAgIHRoaXMuaGVpZ2h0ICA9IHRleHR1cmUuZnJhbWUuaGVpZ2h0O1xuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcblxucHJvdG8ub25UZXh0dXJlVXBkYXRlID0gZnVuY3Rpb24gb25UZXh0dXJlVXBkYXRlKClcbntcbiAgICB0aGlzLnVwZGF0ZUZyYW1lID0gdHJ1ZTtcbn07XG4vLyBzb21lIGhlbHBlciBmdW5jdGlvbnMuLlxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0cmlwO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGJsZW5kTW9kZXMgPSByZXF1aXJlKCcuLi9kaXNwbGF5L2JsZW5kTW9kZXMnKTtcbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi9nZW9tL1BvaW50Jyk7XG5cbi8qKlxuICogQSB0aWxpbmcgc3ByaXRlIGlzIGEgZmFzdCB3YXkgb2YgcmVuZGVyaW5nIGEgdGlsaW5nIGltYWdlXG4gKlxuICogQGNsYXNzIFRpbGluZ1Nwcml0ZVxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX0gdGhlIHRleHR1cmUgb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSAgdGhlIHdpZHRoIG9mIHRoZSB0aWxpbmcgc3ByaXRlXG4gKiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9IHRoZSBoZWlnaHQgb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAqL1xuZnVuY3Rpb24gVGlsaW5nU3ByaXRlKHRleHR1cmUsIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKCB0aGlzICk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGV4dHVyZSB0aGF0IHRoZSBzcHJpdGUgaXMgdXNpbmdcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0ZXh0dXJlXG4gICAgICogQHR5cGUgVGV4dHVyZVxuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSB3aWR0aDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzY2FsaW5nIG9mIHRoZSBpbWFnZSB0aGF0IGlzIGJlaW5nIHRpbGVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdGlsZVNjYWxlXG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLnRpbGVTY2FsZSA9IG5ldyBQb2ludCgxLDEpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG9mZnNldCBwb3NpdGlvbiBvZiB0aGUgaW1hZ2UgdGhhdCBpcyBiZWluZyB0aWxlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRpbGVQb3NpdGlvblxuICAgICAqIEB0eXBlIFBvaW50XG4gICAgICovXG4gICAgdGhpcy50aWxlUG9zaXRpb24gPSBuZXcgUG9pbnQoMCwwKTtcblxuICAgIHRoaXMucmVuZGVyYWJsZSA9IHRydWU7XG5cbiAgICB0aGlzLmJsZW5kTW9kZSA9IGJsZW5kTW9kZXMuTk9STUFMO1xufVxuXG52YXIgcHJvdG8gPSBUaWxpbmdTcHJpdGUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFRpbGluZ1Nwcml0ZX1cbn0pO1xuXG4vKipcbiAqIFNldHMgdGhlIHRleHR1cmUgb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIHNldFRleHR1cmVcbiAqIEBwYXJhbSB0ZXh0dXJlIHtUZXh0dXJlfSBUaGUgdGV4dHVyZSB0aGF0IGlzIGRpc3BsYXllZCBieSB0aGUgc3ByaXRlXG4gKi9cbnByb3RvLnNldFRleHR1cmUgPSBmdW5jdGlvbiBzZXRUZXh0dXJlKHRleHR1cmUpXG57XG4gICAgLy9UT0RPIFNFVCBUSEUgVEVYVFVSRVNcbiAgICAvL1RPRE8gVklTSUJJTElUWVxuXG4gICAgLy8gc3RvcCBjdXJyZW50IHRleHR1cmVcbiAgICB0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBXaGVuIHRoZSB0ZXh0dXJlIGlzIHVwZGF0ZWQsIHRoaXMgZXZlbnQgd2lsbCBmaXJlIHRvIHVwZGF0ZSB0aGUgZnJhbWVcbiAqXG4gKiBAbWV0aG9kIG9uVGV4dHVyZVVwZGF0ZVxuICogQHBhcmFtIGV2ZW50XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vblRleHR1cmVVcGRhdGUgPSBmdW5jdGlvbiBvblRleHR1cmVVcGRhdGUoKVxue1xuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUaWxpbmdTcHJpdGU7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVGhpcyBpcyB0aGUgYmFzZSBjbGFzcyBmb3IgIGNyZWF0aW5nIGEgcGl4aS5qcyBmaWx0ZXIuIEN1cnJlbnRseSBvbmx5IHdlYkdMIHN1cHBvcnRzIGZpbHRlcnMuXG4gKiBJZiB5b3Ugd2FudCB0byBtYWtlIGEgY3VzdG9tIGZpbHRlciB0aGlzIHNob3VsZCBiZSB5b3VyIGJhc2UgY2xhc3MuXG4gKiBAY2xhc3MgQWJzdHJhY3RGaWx0ZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIGZyYWdtZW50U3JjXG4gKiBAcGFyYW0gdW5pZm9ybXNcbiAqL1xuZnVuY3Rpb24gQWJzdHJhY3RGaWx0ZXIoZnJhZ21lbnRTcmMsIHVuaWZvcm1zKVxue1xuICAgIC8qKlxuICAgICogQW4gYXJyYXkgb2YgcGFzc2VzIC0gc29tZSBmaWx0ZXJzIGNvbnRhaW4gYSBmZXcgc3RlcHMgdGhpcyBhcnJheSBzaW1wbHkgc3RvcmVzIHRoZSBzdGVwcyBpbiBhIGxpbmllYXIgZmFzaGlvbi5cbiAgICAqIEZvciBleGFtcGxlIHRoZSBibHVyIGZpbHRlciBoYXMgdHdvIHBhc3NlcyBibHVyWCBhbmQgYmx1clkuXG4gICAgKiBAcHJvcGVydHkgcGFzc2VzXG4gICAgKiBAdHlwZSBBcnJheSBhbiBhcnJheSBvZiBmaWx0ZXIgb2JqZWN0c1xuICAgICogQHByaXZhdGVcbiAgICAqL1xuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG5cbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICB0aGlzLnBhZGRpbmcgPSAwO1xuXG4gICAgLyoqXG4gICAgQHByb3BlcnR5IHVuaWZvcm1zXG4gICAgQHByaXZhdGVcbiAgICAqL1xuICAgIHRoaXMudW5pZm9ybXMgPSB1bmlmb3JtcyB8fCB7fTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBmcmFnbWVudFNyYyB8fCBbXTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdEZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEJsdXJYRmlsdGVyID0gcmVxdWlyZSgnLi9CbHVyWEZpbHRlcicpO1xudmFyIEJsdXJZRmlsdGVyID0gcmVxdWlyZSgnLi9CbHVyWUZpbHRlcicpO1xuXG4vKipcbiAqXG4gKiBUaGUgQmx1ckZpbHRlciBhcHBsaWVzIGEgR2F1c3NpYW4gYmx1ciB0byBhbiBvYmplY3QuXG4gKiBUaGUgc3RyZW5ndGggb2YgdGhlIGJsdXIgY2FuIGJlIHNldCBmb3IgeC0gYW5kIHktYXhpcyBzZXBhcmF0ZWx5IChhbHdheXMgcmVsYXRpdmUgdG8gdGhlIHN0YWdlKS5cbiAqXG4gKiBAY2xhc3MgQmx1ckZpbHRlclxuICogQGNvbnRydWN0b3JcbiAqL1xuZnVuY3Rpb24gQmx1ckZpbHRlcigpXG57XG4gICAgdGhpcy5ibHVyWEZpbHRlciA9IG5ldyBCbHVyWEZpbHRlcigpO1xuICAgIHRoaXMuYmx1cllGaWx0ZXIgPSBuZXcgQmx1cllGaWx0ZXIoKTtcblxuICAgIHRoaXMucGFzc2VzID1bdGhpcy5ibHVyWEZpbHRlciwgdGhpcy5ibHVyWUZpbHRlcl07XG59XG5cbnZhciBwcm90byA9IEJsdXJGaWx0ZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIFNldHMgdGhlIHN0cmVuZ3RoIG9mIGJvdGggdGhlIGJsdXJYIGFuZCBibHVyWSBwcm9wZXJ0aWVzIHNpbXVsdGFuZW91c2x5XG4gKlxuICogQHByb3BlcnR5IGJsdXJcbiAqIEB0eXBlIE51bWJlciB0aGUgc3RyZW5ndGggb2YgdGhlIGJsdXJcbiAqIEBkZWZhdWx0IDJcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnYmx1cicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ibHVyWEZpbHRlci5ibHVyO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLmJsdXJYRmlsdGVyLmJsdXIgPSB0aGlzLmJsdXJZRmlsdGVyLmJsdXIgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuLyoqXG4gKiBTZXRzIHRoZSBzdHJlbmd0aCBvZiB0aGUgYmx1clggcHJvcGVydHkgc2ltdWx0YW5lb3VzbHlcbiAqXG4gKiBAcHJvcGVydHkgYmx1clhcbiAqIEB0eXBlIE51bWJlciB0aGUgc3RyZW5ndGggb2YgdGhlIGJsdXJYXG4gKiBAZGVmYXVsdCAyXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2JsdXJYJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsdXJYRmlsdGVyLmJsdXI7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuYmx1clhGaWx0ZXIuYmx1ciA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG4vKipcbiAqIFNldHMgdGhlIHN0cmVuZ3RoIG9mIHRoZSBibHVyWCBwcm9wZXJ0eSBzaW11bHRhbmVvdXNseVxuICpcbiAqIEBwcm9wZXJ0eSBibHVyWVxuICogQHR5cGUgTnVtYmVyIHRoZSBzdHJlbmd0aCBvZiB0aGUgYmx1cllcbiAqIEBkZWZhdWx0IDJcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnYmx1clknLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmx1cllGaWx0ZXIuYmx1cjtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5ibHVyWUZpbHRlci5ibHVyID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQmx1ckZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG5mdW5jdGlvbiBCbHVyWEZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgYmx1cjoge3R5cGU6ICcxZicsIHZhbHVlOiAxLzUxMn0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGJsdXI7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIHZlYzQgc3VtID0gdmVjNCgwLjApOycsXG5cbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54IC0gNC4wKmJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4wNTsnLFxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLnggLSAzLjAqYmx1ciwgdlRleHR1cmVDb29yZC55KSkgKiAwLjA5OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCAtIDIuMCpibHVyLCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMTI7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54IC0gYmx1ciwgdlRleHR1cmVDb29yZC55KSkgKiAwLjE1OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55KSkgKiAwLjE2OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCArIGJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4xNTsnLFxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLnggKyAyLjAqYmx1ciwgdlRleHR1cmVDb29yZC55KSkgKiAwLjEyOycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCArIDMuMCpibHVyLCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMDk7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54ICsgNC4wKmJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4wNTsnLFxuXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSBzdW07JyxcbiAgICAgICAgJ30nXG4gICAgXTtcbn1cblxudmFyIHByb3RvID0gQmx1clhGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShBYnN0cmFjdEZpbHRlci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBCbHVyWEZpbHRlcn1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdibHVyJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUgLyAoMS83MDAwKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcblxuICAgICAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5ibHVyLnZhbHVlID0gKDEvNzAwMCkgKiB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBCbHVyWEZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG5mdW5jdGlvbiBCbHVyWUZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgYmx1cjoge3R5cGU6ICcxZicsIHZhbHVlOiAxLzUxMn0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGJsdXI7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIHZlYzQgc3VtID0gdmVjNCgwLjApOycsXG5cbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkgLSA0LjAqYmx1cikpICogMC4wNTsnLFxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSAtIDMuMCpibHVyKSkgKiAwLjA5OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55IC0gMi4wKmJsdXIpKSAqIDAuMTI7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkgLSBibHVyKSkgKiAwLjE1OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55KSkgKiAwLjE2OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55ICsgYmx1cikpICogMC4xNTsnLFxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSArIDIuMCpibHVyKSkgKiAwLjEyOycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55ICsgMy4wKmJsdXIpKSAqIDAuMDk7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkgKyA0LjAqYmx1cikpICogMC4wNTsnLFxuXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSBzdW07JyxcbiAgICAgICAgJ30nXG4gICAgXTtcbn1cblxudmFyIHByb3RvID0gQmx1cllGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShBYnN0cmFjdEZpbHRlci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBCbHVyWUZpbHRlcn1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdibHVyJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUgLyAoMS83MDAwKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgLy90aGlzLnBhZGRpbmcgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5ibHVyLnZhbHVlID0gKDEvNzAwMCkgKiB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBCbHVyWUZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG4vKipcbiAqXG4gKiBUaGUgQ29sb3JNYXRyaXhGaWx0ZXIgY2xhc3MgbGV0cyB5b3UgYXBwbHkgYSA0eDQgbWF0cml4IHRyYW5zZm9ybWF0aW9uIG9uIHRoZSBSR0JBXG4gKiBjb2xvciBhbmQgYWxwaGEgdmFsdWVzIG9mIGV2ZXJ5IHBpeGVsIG9uIHlvdXIgZGlzcGxheU9iamVjdCB0byBwcm9kdWNlIGEgcmVzdWx0XG4gKiB3aXRoIGEgbmV3IHNldCBvZiBSR0JBIGNvbG9yIGFuZCBhbHBoYSB2YWx1ZXMuIEl0cyBwcmV0dHkgcG93ZXJmdWwhXG4gKiBAY2xhc3MgQ29sb3JNYXRyaXhGaWx0ZXJcbiAqIEBjb250cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIENvbG9yTWF0cml4RmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBtYXRyaXg6IHt0eXBlOiAnbWF0NCcsIHZhbHVlOiBbMSwwLDAsMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsMSwwLDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLDAsMSwwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLDAsMV19LFxuICAgIH07XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSBmbG9hdCBpbnZlcnQ7JyxcbiAgICAgICAgJ3VuaWZvcm0gbWF0NCBtYXRyaXg7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCkgKiBtYXRyaXg7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IGdsX0ZyYWdDb2xvciAqIHZDb2xvcjsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBDb2xvck1hdHJpeEZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IENvbG9yTWF0cml4RmlsdGVyfVxufSk7XG5cbi8qKlxuICogU2V0cyB0aGUgbWF0cml4IG9mIHRoZSBjb2xvciBtYXRyaXggZmlsdGVyXG4gKlxuICogQHByb3BlcnR5IG1hdHJpeFxuICogQHR5cGUgQXJyYXkgYW5kIGFycmF5IG9mIDI2IG51bWJlcnNcbiAqIEBkZWZhdWx0IFsxLDAsMCwwLDAsMSwwLDAsMCwwLDEsMCwwLDAsMCwxXVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdtYXRyaXgnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMubWF0cml4LnZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLnVuaWZvcm1zLm1hdHJpeC52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbG9yTWF0cml4RmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbi8qKlxuICpcbiAqIFRoaXMgdHVybnMgeW91ciBkaXNwbGF5T2JqZWN0cyB0byBibGFjayBhbmQgd2hpdGUuXG4gKiBAY2xhc3MgQ29sb3JTdGVwRmlsdGVyXG4gKiBAY29udHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDb2xvclN0ZXBGaWx0ZXIoKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIHN0ZXA6IHt0eXBlOiAnMWYnLCB2YWx1ZTogNX0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuICAgICAgICAndW5pZm9ybSBmbG9hdCBzdGVwOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIHZlYzQgY29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQpOycsXG4gICAgICAgICcgICBjb2xvciA9IGZsb29yKGNvbG9yICogc3RlcCkgLyBzdGVwOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSBjb2xvciAqIHZDb2xvcjsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBDb2xvclN0ZXBGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShBYnN0cmFjdEZpbHRlci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBDb2xvclN0ZXBGaWx0ZXJ9XG59KTtcblxuLyoqXG5UaGUgbnVtYmVyIG9mIHN0ZXBzLlxuQHByb3BlcnR5IHN0ZXBcbiovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdzdGVwJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnN0ZXAudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMuc3RlcC52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbG9yU3RlcEZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG5mdW5jdGlvbiBDcm9zc0hhdGNoRmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBibHVyOiB7dHlwZTogJzFmJywgdmFsdWU6IDEgLyA1MTJ9LFxuICAgIH07XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSBmbG9hdCBibHVyOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICAgZmxvYXQgbHVtID0gbGVuZ3RoKHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZC54eSkucmdiKTsnLFxuXG4gICAgICAgICcgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgxLjAsIDEuMCwgMS4wLCAxLjApOycsXG5cbiAgICAgICAgJyAgICBpZiAobHVtIDwgMS4wMCkgeycsXG4gICAgICAgICcgICAgICAgIGlmIChtb2QoZ2xfRnJhZ0Nvb3JkLnggKyBnbF9GcmFnQ29vcmQueSwgMTAuMCkgPT0gMC4wKSB7JyxcbiAgICAgICAgJyAgICAgICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMS4wKTsnLFxuICAgICAgICAnICAgICAgICB9JyxcbiAgICAgICAgJyAgICB9JyxcblxuICAgICAgICAnICAgIGlmIChsdW0gPCAwLjc1KSB7JyxcbiAgICAgICAgJyAgICAgICAgaWYgKG1vZChnbF9GcmFnQ29vcmQueCAtIGdsX0ZyYWdDb29yZC55LCAxMC4wKSA9PSAwLjApIHsnLFxuICAgICAgICAnICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAxLjApOycsXG4gICAgICAgICcgICAgICAgIH0nLFxuICAgICAgICAnICAgIH0nLFxuXG4gICAgICAgICcgICAgaWYgKGx1bSA8IDAuNTApIHsnLFxuICAgICAgICAnICAgICAgICBpZiAobW9kKGdsX0ZyYWdDb29yZC54ICsgZ2xfRnJhZ0Nvb3JkLnkgLSA1LjAsIDEwLjApID09IDAuMCkgeycsXG4gICAgICAgICcgICAgICAgICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDEuMCk7JyxcbiAgICAgICAgJyAgICAgICAgfScsXG4gICAgICAgICcgICAgfScsXG5cbiAgICAgICAgJyAgICBpZiAobHVtIDwgMC4zKSB7JyxcbiAgICAgICAgJyAgICAgICAgaWYgKG1vZChnbF9GcmFnQ29vcmQueCAtIGdsX0ZyYWdDb29yZC55IC0gNS4wLCAxMC4wKSA9PSAwLjApIHsnLFxuICAgICAgICAnICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAxLjApOycsXG4gICAgICAgICcgICAgICAgIH0nLFxuICAgICAgICAnICAgIH0nLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBDcm9zc0hhdGNoRmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogQ3Jvc3NIYXRjaEZpbHRlcn1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdibHVyJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUgLyAoMS83MDAwKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgLy90aGlzLnBhZGRpbmcgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5ibHVyLnZhbHVlID0gKDEvNzAwMCkgKiB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDcm9zc0hhdGNoRmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbi8qKlxuICpcbiAqIFRoZSBEaXNwbGFjZW1lbnRGaWx0ZXIgY2xhc3MgdXNlcyB0aGUgcGl4ZWwgdmFsdWVzIGZyb20gdGhlIHNwZWNpZmllZCB0ZXh0dXJlIChjYWxsZWQgdGhlIGRpc3BsYWNlbWVudCBtYXApIHRvIHBlcmZvcm0gYSBkaXNwbGFjZW1lbnQgb2YgYW4gb2JqZWN0LlxuICogWW91IGNhbiB1c2UgdGhpcyBmaWx0ZXIgdG8gYXBwbHkgYWxsIG1hbm9yIG9mIGNyYXp5IHdhcnBpbmcgZWZmZWN0c1xuICogQ3VycmVudGx5IHRoZSByIHByb3BlcnR5IG9mIHRoZSB0ZXh0dXJlIGlzIHVzZWQgb2Zmc2V0IHRoZSB4IGFuZCB0aGUgZyBwcm9wZXJ5IG9mIHRoZSB0ZXh0dXJlIGlzIHVzZWQgdG8gb2Zmc2V0IHRoZSB5LlxuICogQGNsYXNzIERpc3BsYWNlbWVudEZpbHRlclxuICogQGNvbnRydWN0b3JcbiAqIEBwYXJhbSB0ZXh0dXJlIHtUZXh0dXJlfSBUaGUgdGV4dHVyZSB1c2VkIGZvciB0aGUgZGlzcGxhY2VtdGVudCBtYXAgKiBtdXN0IGJlIHBvd2VyIG9mIDIgdGV4dHVyZSBhdCB0aGUgbW9tZW50XG4gKi9cbmZ1bmN0aW9uIERpc3BsYWNlbWVudEZpbHRlcih0ZXh0dXJlKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuICAgIHRleHR1cmUuYmFzZVRleHR1cmUuX3Bvd2VyT2YyID0gdHJ1ZTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICAvL2NvbnNvbGUubG9nKClcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBkaXNwbGFjZW1lbnRNYXA6IHt0eXBlOiAnc2FtcGxlcjJEJywgdmFsdWU6dGV4dHVyZX0sXG4gICAgICAgIHNjYWxlOiAgICAgICAgICAge3R5cGU6ICcyZicsIHZhbHVlOnt4OjMwLCB5OjMwfX0sXG4gICAgICAgIG9mZnNldDogICAgICAgICAge3R5cGU6ICcyZicsIHZhbHVlOnt4OjAsIHk6MH19LFxuICAgICAgICBtYXBEaW1lbnNpb25zOiAgIHt0eXBlOiAnMmYnLCB2YWx1ZTp7eDoxLCB5OjUxMTJ9fSxcbiAgICAgICAgZGltZW5zaW9uczogICB7dHlwZTogJzRmdicsIHZhbHVlOlswLDAsMCwwXX1cbiAgICB9O1xuXG4gICAgaWYodGV4dHVyZS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQpXG4gICAge1xuICAgICAgICB0aGlzLnVuaWZvcm1zLm1hcERpbWVuc2lvbnMudmFsdWUueCA9IHRleHR1cmUud2lkdGg7XG4gICAgICAgIHRoaXMudW5pZm9ybXMubWFwRGltZW5zaW9ucy52YWx1ZS55ID0gdGV4dHVyZS5oZWlnaHQ7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMuYm91bmRMb2FkZWRGdW5jdGlvbiA9IHRoaXMub25UZXh0dXJlTG9hZGVkLmJpbmQodGhpcyk7XG5cbiAgICAgICAgdGV4dHVyZS5iYXNlVGV4dHVyZS5vbignbG9hZGVkJywgdGhpcy5ib3VuZExvYWRlZEZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgZGlzcGxhY2VtZW50TWFwOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIHNjYWxlOycsXG4gICAgICAgICd1bmlmb3JtIHZlYzIgb2Zmc2V0OycsXG4gICAgICAgICd1bmlmb3JtIHZlYzQgZGltZW5zaW9uczsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIG1hcERpbWVuc2lvbnM7JywvLyA9IHZlYzIoMjU2LjAsIDI1Ni4wKTsnLFxuICAgICAgICAvLyAnY29uc3QgdmVjMiB0ZXh0dXJlRGltZW5zaW9ucyA9IHZlYzIoNzUwLjAsIDc1MC4wKTsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICB2ZWMyIG1hcENvcmRzID0gdlRleHR1cmVDb29yZC54eTsnLFxuICAgICAgICAvLycgICBtYXBDb3JkcyAtPSA7JyxcbiAgICAgICAgJyAgIG1hcENvcmRzICs9IChkaW1lbnNpb25zLnp3ICsgb2Zmc2V0KS8gZGltZW5zaW9ucy54eSA7JyxcbiAgICAgICAgJyAgIG1hcENvcmRzLnkgKj0gLTEuMDsnLFxuICAgICAgICAnICAgbWFwQ29yZHMueSArPSAxLjA7JyxcbiAgICAgICAgJyAgIHZlYzIgbWF0U2FtcGxlID0gdGV4dHVyZTJEKGRpc3BsYWNlbWVudE1hcCwgbWFwQ29yZHMpLnh5OycsXG4gICAgICAgICcgICBtYXRTYW1wbGUgLT0gMC41OycsXG4gICAgICAgICcgICBtYXRTYW1wbGUgKj0gc2NhbGU7JyxcbiAgICAgICAgJyAgIG1hdFNhbXBsZSAvPSBtYXBEaW1lbnNpb25zOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54ICsgbWF0U2FtcGxlLngsIHZUZXh0dXJlQ29vcmQueSArIG1hdFNhbXBsZS55KSk7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBtaXgoIGdsX0ZyYWdDb2xvci5yZ2IsIGdsX0ZyYWdDb2xvci5yZ2IsIDEuMCk7JyxcbiAgICAgICAgJyAgIHZlYzIgY29yZCA9IHZUZXh0dXJlQ29vcmQ7JyxcblxuICAgICAgICAvLycgICBnbF9GcmFnQ29sb3IgPSAgdGV4dHVyZTJEKGRpc3BsYWNlbWVudE1hcCwgY29yZCk7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IGdsX0ZyYWdDb2xvciAqIHZDb2xvcjsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBEaXNwbGFjZW1lbnRGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShBYnN0cmFjdEZpbHRlci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBEaXNwbGFjZW1lbnRGaWx0ZXJ9XG59KTtcblxucHJvdG8ub25UZXh0dXJlTG9hZGVkID0gZnVuY3Rpb24oKVxue1xuICAgIHRoaXMudW5pZm9ybXMubWFwRGltZW5zaW9ucy52YWx1ZS54ID0gdGhpcy51bmlmb3Jtcy5kaXNwbGFjZW1lbnRNYXAudmFsdWUud2lkdGg7XG4gICAgdGhpcy51bmlmb3Jtcy5tYXBEaW1lbnNpb25zLnZhbHVlLnkgPSB0aGlzLnVuaWZvcm1zLmRpc3BsYWNlbWVudE1hcC52YWx1ZS5oZWlnaHQ7XG5cbiAgICB0aGlzLnVuaWZvcm1zLmRpc3BsYWNlbWVudE1hcC52YWx1ZS5iYXNlVGV4dHVyZS5vZmYoJ2xvYWRlZCcsIHRoaXMuYm91bmRMb2FkZWRGdW5jdGlvbik7XG59O1xuXG4vKipcbiAqIFRoZSB0ZXh0dXJlIHVzZWQgZm9yIHRoZSBkaXNwbGFjZW10ZW50IG1hcCAqIG11c3QgYmUgcG93ZXIgb2YgMiB0ZXh0dXJlIGF0IHRoZSBtb21lbnRcbiAqXG4gKiBAcHJvcGVydHkgbWFwXG4gKiBAdHlwZSBUZXh0dXJlXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ21hcCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5kaXNwbGFjZW1lbnRNYXAudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMuZGlzcGxhY2VtZW50TWFwLnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogVGhlIG11bHRpcGxpZXIgdXNlZCB0byBzY2FsZSB0aGUgZGlzcGxhY2VtZW50IHJlc3VsdCBmcm9tIHRoZSBtYXAgY2FsY3VsYXRpb24uXG4gKlxuICogQHByb3BlcnR5IHNjYWxlXG4gKiBAdHlwZSBQb2ludFxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdzY2FsZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5zY2FsZS52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5zY2FsZS52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG4vKipcbiAqIFRoZSBvZmZzZXQgdXNlZCB0byBtb3ZlIHRoZSBkaXNwbGFjZW1lbnQgbWFwLlxuICpcbiAqIEBwcm9wZXJ0eSBvZmZzZXRcbiAqIEB0eXBlIFBvaW50XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ29mZnNldCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5vZmZzZXQudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMub2Zmc2V0LnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRGlzcGxhY2VtZW50RmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqIG9yaWdpbmFsIGZpbHRlcjogaHR0cHM6Ly9naXRodWIuY29tL2V2YW53L2dsZnguanMvYmxvYi9tYXN0ZXIvc3JjL2ZpbHRlcnMvZnVuL2RvdHNjcmVlbi5qc1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBYnN0cmFjdEZpbHRlciA9IHJlcXVpcmUoJy4vQWJzdHJhY3RGaWx0ZXInKTtcblxuLyoqXG4gKlxuICogVGhpcyBmaWx0ZXIgYXBwbGllcyBhIHBpeGxhdGUgZWZmZWN0IG1ha2luZyBkaXNwbGF5IG9iamVjdHMgYXBwZWFyICdibG9ja3knXG4gKiBAY2xhc3MgUGl4ZWxhdGVGaWx0ZXJcbiAqIEBjb250cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERvdFNjcmVlbkZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgc2NhbGU6IHt0eXBlOiAnMWYnLCB2YWx1ZToxfSxcbiAgICAgICAgYW5nbGU6IHt0eXBlOiAnMWYnLCB2YWx1ZTo1fSxcbiAgICAgICAgZGltZW5zaW9uczogICB7dHlwZTogJzRmdicsIHZhbHVlOlswLDAsMCwwXX1cbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjNCBkaW1lbnNpb25zOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGFuZ2xlOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IHNjYWxlOycsXG5cbiAgICAgICAgJ2Zsb2F0IHBhdHRlcm4oKSB7JyxcbiAgICAgICAgJyAgIGZsb2F0IHMgPSBzaW4oYW5nbGUpLCBjID0gY29zKGFuZ2xlKTsnLFxuICAgICAgICAnICAgdmVjMiB0ZXggPSB2VGV4dHVyZUNvb3JkICogZGltZW5zaW9ucy54eTsnLFxuICAgICAgICAnICAgdmVjMiBwb2ludCA9IHZlYzIoJyxcbiAgICAgICAgJyAgICAgICBjICogdGV4LnggLSBzICogdGV4LnksJyxcbiAgICAgICAgJyAgICAgICBzICogdGV4LnggKyBjICogdGV4LnknLFxuICAgICAgICAnICAgKSAqIHNjYWxlOycsXG4gICAgICAgICcgICByZXR1cm4gKHNpbihwb2ludC54KSAqIHNpbihwb2ludC55KSkgKiA0LjA7JyxcbiAgICAgICAgJ30nLFxuXG4gICAgICAgICd2b2lkIG1haW4oKSB7JyxcbiAgICAgICAgJyAgIHZlYzQgY29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQpOycsXG4gICAgICAgICcgICBmbG9hdCBhdmVyYWdlID0gKGNvbG9yLnIgKyBjb2xvci5nICsgY29sb3IuYikgLyAzLjA7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHZlYzQodmVjMyhhdmVyYWdlICogMTAuMCAtIDUuMCArIHBhdHRlcm4oKSksIGNvbG9yLmEpOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IERvdFNjcmVlbkZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IERvdFNjcmVlbkZpbHRlcn1cbn0pO1xuXG4vKipcbiAqXG4gKiBUaGlzIGRlc2NyaWJlcyB0aGUgdGhlIHNjYWxlXG4gKiBAcHJvcGVydHkgc2NhbGVcbiAqIEB0eXBlIE51bWJlclxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdzY2FsZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5zY2FsZS52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMudW5pZm9ybXMuc2NhbGUudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuLyoqXG4gKlxuICogVGhpcyByYWRpdXMgZGVzY3JpYmVzIGFuZ2xlXG4gKiBAcHJvcGVydHkgYW5nbGVcbiAqIEB0eXBlIE51bWJlclxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdhbmdsZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5hbmdsZS52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMudW5pZm9ybXMuYW5nbGUudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBEb3RTY3JlZW5GaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIEZpbHRlckJsb2NrKClcbntcbiAgICB0aGlzLnZpc2libGUgPSB0cnVlO1xuICAgIHRoaXMucmVuZGVyYWJsZSA9IHRydWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVyQmxvY2s7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBYnN0cmFjdEZpbHRlciA9IHJlcXVpcmUoJy4vQWJzdHJhY3RGaWx0ZXInKTtcblxuLyoqXG4gKlxuICogVGhpcyB0dXJucyB5b3VyIGRpc3BsYXlPYmplY3RzIHRvIGJsYWNrIGFuZCB3aGl0ZS5cbiAqIEBjbGFzcyBHcmF5RmlsdGVyXG4gKiBAY29udHJ1Y3RvclxuICovXG5mdW5jdGlvbiBHcmF5RmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBncmF5OiB7dHlwZTogJzFmJywgdmFsdWU6IDF9LFxuICAgIH07XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgZ3JheTsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQpOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IucmdiID0gbWl4KGdsX0ZyYWdDb2xvci5yZ2IsIHZlYzMoMC4yMTI2KmdsX0ZyYWdDb2xvci5yICsgMC43MTUyKmdsX0ZyYWdDb2xvci5nICsgMC4wNzIyKmdsX0ZyYWdDb2xvci5iKSwgZ3JheSk7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IGdsX0ZyYWdDb2xvciAqIHZDb2xvcjsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBHcmF5RmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogR3JheUZpbHRlcn1cbn0pO1xuXG4vKipcblRoZSBzdHJlbmd0aCBvZiB0aGUgZ3JheS4gMSB3aWxsIG1ha2UgdGhlIG9iamVjdCBibGFjayBhbmQgd2hpdGUsIDAgd2lsbCBtYWtlIHRoZSBvYmplY3QgaXRzIG5vcm1hbCBjb2xvclxuQHByb3BlcnR5IGdyYXlcbiovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdncmF5Jywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmdyYXkudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMuZ3JheS52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdyYXlGaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBYnN0cmFjdEZpbHRlciA9IHJlcXVpcmUoJy4vQWJzdHJhY3RGaWx0ZXInKTtcblxuLyoqXG4gKlxuICogVGhpcyBpbnZlcnRzIHlvdXIgZGlzcGxheU9iamVjdHMgY29sb3JzLlxuICogQGNsYXNzIEludmVydEZpbHRlclxuICogQGNvbnRydWN0b3JcbiAqL1xuZnVuY3Rpb24gSW52ZXJ0RmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBpbnZlcnQ6IHt0eXBlOiAnMWYnLCB2YWx1ZTogMX0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGludmVydDsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IG1peCggKHZlYzMoMSktZ2xfRnJhZ0NvbG9yLnJnYikgKiBnbF9GcmFnQ29sb3IuYSwgZ2xfRnJhZ0NvbG9yLnJnYiwgMS4wIC0gaW52ZXJ0KTsnLFxuICAgICAgICAvLycgICBnbF9GcmFnQ29sb3IucmdiID0gZ2xfRnJhZ0NvbG9yLnJnYiAgKiBnbF9GcmFnQ29sb3IuYTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gZ2xfRnJhZ0NvbG9yICogdkNvbG9yOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IEludmVydEZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IEludmVydEZpbHRlcn1cbn0pO1xuXG4vKipcblRoZSBzdHJlbmd0aCBvZiB0aGUgaW52ZXJ0LiAxIHdpbGwgZnVsbHkgaW52ZXJ0IHRoZSBjb2xvcnMsIDAgd2lsbCBtYWtlIHRoZSBvYmplY3QgaXRzIG5vcm1hbCBjb2xvclxuQHByb3BlcnR5IGludmVydFxuKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2ludmVydCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5pbnZlcnQudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMuaW52ZXJ0LnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSW52ZXJ0RmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbi8qKlxuICpcbiAqIFRoaXMgZmlsdGVyIGFwcGxpZXMgYSBwaXhsYXRlIGVmZmVjdCBtYWtpbmcgZGlzcGxheSBvYmplY3RzIGFwcGVhciAnYmxvY2t5J1xuICogQGNsYXNzIFBpeGVsYXRlRmlsdGVyXG4gKiBAY29udHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQaXhlbGF0ZUZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgaW52ZXJ0OiB7dHlwZTogJzFmJywgdmFsdWU6IDB9LFxuICAgICAgICBkaW1lbnNpb25zOiB7dHlwZTogJzRmdicsIHZhbHVlOm5ldyBGbG9hdDMyQXJyYXkoWzEwMDAwLCAxMDAsIDEwLCAxMF0pfSxcbiAgICAgICAgcGl4ZWxTaXplOiB7dHlwZTogJzJmJywgdmFsdWU6e3g6MTAsIHk6MTB9fSxcbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjMiB0ZXN0RGltOycsXG4gICAgICAgICd1bmlmb3JtIHZlYzQgZGltZW5zaW9uczsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIHBpeGVsU2l6ZTsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgdmVjMiBjb29yZCA9IHZUZXh0dXJlQ29vcmQ7JyxcblxuICAgICAgICAnICAgdmVjMiBzaXplID0gZGltZW5zaW9ucy54eS9waXhlbFNpemU7JyxcblxuICAgICAgICAnICAgdmVjMiBjb2xvciA9IGZsb29yKCAoIHZUZXh0dXJlQ29vcmQgKiBzaXplICkgKSAvIHNpemUgKyBwaXhlbFNpemUvZGltZW5zaW9ucy54eSAqIDAuNTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCBjb2xvcik7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcbn1cblxudmFyIHByb3RvID0gUGl4ZWxhdGVGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShBYnN0cmFjdEZpbHRlci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBQaXhlbGF0ZUZpbHRlcn1cbn0pO1xuXG4vKipcbiAqXG4gKiBUaGlzIGEgcG9pbnQgdGhhdCBkZXNjcmliZXMgdGhlIHNpemUgb2YgdGhlIGJsb2NzLiB4IGlzIHRoZSB3aWR0aCBvZiB0aGUgYmxvY2sgYW5kIHkgaXMgdGhlIHRoZSBoZWlnaHRcbiAqIEBwcm9wZXJ0eSBzaXplXG4gKiBAdHlwZSBQb2ludFxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdzaXplJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnBpeGVsU2l6ZS52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMudW5pZm9ybXMucGl4ZWxTaXplLnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUGl4ZWxhdGVGaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBYnN0cmFjdEZpbHRlciA9IHJlcXVpcmUoJy4vQWJzdHJhY3RGaWx0ZXInKTtcblxuZnVuY3Rpb24gUkdCU3BsaXRGaWx0ZXIoKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIHJlZDoge3R5cGU6ICcyZicsIHZhbHVlOiB7eDoyMCwgeToyMH19LFxuICAgICAgICBncmVlbjoge3R5cGU6ICcyZicsIHZhbHVlOiB7eDotMjAsIHk6MjB9fSxcbiAgICAgICAgYmx1ZToge3R5cGU6ICcyZicsIHZhbHVlOiB7eDoyMCwgeTotMjB9fSxcbiAgICAgICAgZGltZW5zaW9uczogICB7dHlwZTogJzRmdicsIHZhbHVlOlswLDAsMCwwXX1cbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjMiByZWQ7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjMiBncmVlbjsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIGJsdWU7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjNCBkaW1lbnNpb25zOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IuciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCArIHJlZC9kaW1lbnNpb25zLnh5KS5yOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IuZyA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCArIGdyZWVuL2RpbWVuc2lvbnMueHkpLmc7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvci5iID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkICsgYmx1ZS9kaW1lbnNpb25zLnh5KS5iOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IuYSA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCkuYTsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBSR0JTcGxpdEZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFJHQlNwbGl0RmlsdGVyfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2FuZ2xlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUgLyAoMS83MDAwKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgLy90aGlzLnBhZGRpbmcgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5ibHVyLnZhbHVlID0gKDEvNzAwMCkgKiB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBSR0JTcGxpdEZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG4vKipcbiAqXG4gKiBUaGlzIGFwcGxpZXMgYSBzZXBpYSBlZmZlY3QgdG8geW91ciBkaXNwbGF5T2JqZWN0cy5cbiAqIEBjbGFzcyBTZXBpYUZpbHRlclxuICogQGNvbnRydWN0b3JcbiAqL1xuZnVuY3Rpb24gU2VwaWFGaWx0ZXIoKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIHNlcGlhOiB7dHlwZTogJzFmJywgdmFsdWU6IDF9LFxuICAgIH07XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSBmbG9hdCBzZXBpYTsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcblxuICAgICAgICAnY29uc3QgbWF0MyBzZXBpYU1hdHJpeCA9IG1hdDMoMC4zNTg4LCAwLjcwNDQsIDAuMTM2OCwgMC4yOTkwLCAwLjU4NzAsIDAuMTE0MCwgMC4yMzkyLCAwLjQ2OTYsIDAuMDkxMik7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IG1peCggZ2xfRnJhZ0NvbG9yLnJnYiwgZ2xfRnJhZ0NvbG9yLnJnYiAqIHNlcGlhTWF0cml4LCBzZXBpYSk7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IGdsX0ZyYWdDb2xvciAqIHZDb2xvcjsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBTZXBpYUZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFNlcGlhRmlsdGVyfVxufSk7XG5cbi8qKlxuVGhlIHN0cmVuZ3RoIG9mIHRoZSBzZXBpYS4gMSB3aWxsIGFwcGx5IHRoZSBmdWxsIHNlcGlhIGVmZmVjdCwgMCB3aWxsIG1ha2UgdGhlIG9iamVjdCBpdHMgbm9ybWFsIGNvbG9yXG5AcHJvcGVydHkgc2VwaWFcbiovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdzZXBpYScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5zZXBpYS52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5zZXBpYS52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNlcGlhRmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbmZ1bmN0aW9uIFNtYXJ0Qmx1ckZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgYmx1cjoge3R5cGU6ICcxZicsIHZhbHVlOiAxLzUxMn0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG4gICAgICAgIC8vJ3VuaWZvcm0gdmVjMiBkZWx0YTsnLFxuICAgICAgICAnY29uc3QgdmVjMiBkZWx0YSA9IHZlYzIoMS4wLzEwLjAsIDAuMCk7JyxcbiAgICAgICAgLy8ndW5pZm9ybSBmbG9hdCBkYXJrbmVzczsnLFxuXG4gICAgICAgICdmbG9hdCByYW5kb20odmVjMyBzY2FsZSwgZmxvYXQgc2VlZCkgeycsXG4gICAgICAgICcgICByZXR1cm4gZnJhY3Qoc2luKGRvdChnbF9GcmFnQ29vcmQueHl6ICsgc2VlZCwgc2NhbGUpKSAqIDQzNzU4LjU0NTMgKyBzZWVkKTsnLFxuICAgICAgICAnfScsXG5cblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgdmVjNCBjb2xvciA9IHZlYzQoMC4wKTsnLFxuICAgICAgICAnICAgZmxvYXQgdG90YWwgPSAwLjA7JyxcblxuICAgICAgICAnICAgZmxvYXQgb2Zmc2V0ID0gcmFuZG9tKHZlYzMoMTIuOTg5OCwgNzguMjMzLCAxNTEuNzE4MiksIDAuMCk7JyxcblxuICAgICAgICAnICAgZm9yIChmbG9hdCB0ID0gLTMwLjA7IHQgPD0gMzAuMDsgdCsrKSB7JyxcbiAgICAgICAgJyAgICAgICBmbG9hdCBwZXJjZW50ID0gKHQgKyBvZmZzZXQgLSAwLjUpIC8gMzAuMDsnLFxuICAgICAgICAnICAgICAgIGZsb2F0IHdlaWdodCA9IDEuMCAtIGFicyhwZXJjZW50KTsnLFxuICAgICAgICAnICAgICAgIHZlYzQgc2FtcGxlID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkICsgZGVsdGEgKiBwZXJjZW50KTsnLFxuICAgICAgICAnICAgICAgIHNhbXBsZS5yZ2IgKj0gc2FtcGxlLmE7JyxcbiAgICAgICAgJyAgICAgICBjb2xvciArPSBzYW1wbGUgKiB3ZWlnaHQ7JyxcbiAgICAgICAgJyAgICAgICB0b3RhbCArPSB3ZWlnaHQ7JyxcbiAgICAgICAgJyAgIH0nLFxuXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSBjb2xvciAvIHRvdGFsOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IucmdiIC89IGdsX0ZyYWdDb2xvci5hICsgMC4wMDAwMTsnLFxuICAgICAgICAvLycgICBnbF9GcmFnQ29sb3IucmdiICo9IGRhcmtuZXNzOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IFNtYXJ0Qmx1ckZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFNtYXJ0Qmx1ckZpbHRlcn1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdibHVyJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMuYmx1ci52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNtYXJ0Qmx1ckZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG4vKipcbiAqXG4gKiBUaGlzIGZpbHRlciBhcHBsaWVzIGEgcGl4bGF0ZSBlZmZlY3QgbWFraW5nIGRpc3BsYXkgb2JqZWN0cyBhcHBlYXIgJ2Jsb2NreSdcbiAqIEBjbGFzcyBQaXhlbGF0ZUZpbHRlclxuICogQGNvbnRydWN0b3JcbiAqL1xuZnVuY3Rpb24gVHdpc3RGaWx0ZXIoKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIHJhZGl1czoge3R5cGU6ICcxZicsIHZhbHVlOjAuNX0sXG4gICAgICAgIGFuZ2xlOiB7dHlwZTogJzFmJywgdmFsdWU6NX0sXG4gICAgICAgIG9mZnNldDoge3R5cGU6ICcyZicsIHZhbHVlOnt4OjAuNSwgeTowLjV9fSxcbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjNCBkaW1lbnNpb25zOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IHJhZGl1czsnLFxuICAgICAgICAndW5pZm9ybSBmbG9hdCBhbmdsZTsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIG9mZnNldDsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICB2ZWMyIGNvb3JkID0gdlRleHR1cmVDb29yZCAtIG9mZnNldDsnLFxuICAgICAgICAnICAgZmxvYXQgZGlzdGFuY2UgPSBsZW5ndGgoY29vcmQpOycsXG5cbiAgICAgICAgJyAgIGlmIChkaXN0YW5jZSA8IHJhZGl1cykgeycsXG4gICAgICAgICcgICAgICAgZmxvYXQgcmF0aW8gPSAocmFkaXVzIC0gZGlzdGFuY2UpIC8gcmFkaXVzOycsXG4gICAgICAgICcgICAgICAgZmxvYXQgYW5nbGVNb2QgPSByYXRpbyAqIHJhdGlvICogYW5nbGU7JyxcbiAgICAgICAgJyAgICAgICBmbG9hdCBzID0gc2luKGFuZ2xlTW9kKTsnLFxuICAgICAgICAnICAgICAgIGZsb2F0IGMgPSBjb3MoYW5nbGVNb2QpOycsXG4gICAgICAgICcgICAgICAgY29vcmQgPSB2ZWMyKGNvb3JkLnggKiBjIC0gY29vcmQueSAqIHMsIGNvb3JkLnggKiBzICsgY29vcmQueSAqIGMpOycsXG4gICAgICAgICcgICB9JyxcblxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCBjb29yZCtvZmZzZXQpOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IFR3aXN0RmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogVHdpc3RGaWx0ZXJ9XG59KTtcblxuLyoqXG4gKlxuICogVGhpcyBwb2ludCBkZXNjcmliZXMgdGhlIHRoZSBvZmZzZXQgb2YgdGhlIHR3aXN0XG4gKiBAcHJvcGVydHkgc2l6ZVxuICogQHR5cGUgUG9pbnRcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnb2Zmc2V0Jywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm9mZnNldC52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMudW5pZm9ybXMub2Zmc2V0LnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICpcbiAqIFRoaXMgcmFkaXVzIGRlc2NyaWJlcyBzaXplIG9mIHRoZSB0d2lzdFxuICogQHByb3BlcnR5IHNpemVcbiAqIEB0eXBlIE51bWJlclxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdyYWRpdXMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMucmFkaXVzLnZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5yYWRpdXMudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuLyoqXG4gKlxuICogVGhpcyByYWRpdXMgZGVzY3JpYmVzIGFuZ2xlIG9mIHRoZSB0d2lzdFxuICogQHByb3BlcnR5IGFuZ2xlXG4gKiBAdHlwZSBOdW1iZXJcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnYW5nbGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuYW5nbGUudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLnVuaWZvcm1zLmFuZ2xlLnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVHdpc3RGaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgQ2hhZCBFbmdsZXIgPGNoYWRAcGFudGhlcmRldi5jb20+XG4gKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBUaGUgQ2lyY2xlIG9iamVjdCBjYW4gYmUgdXNlZCB0byBzcGVjaWZ5IGEgaGl0IGFyZWEgZm9yIGRpc3BsYXlvYmplY3RzXG4gKlxuICogQGNsYXNzIENpcmNsZVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0geCB7TnVtYmVyfSBUaGUgWCBjb29yZCBvZiB0aGUgdXBwZXItbGVmdCBjb3JuZXIgb2YgdGhlIGZyYW1pbmcgcmVjdGFuZ2xlIG9mIHRoaXMgY2lyY2xlXG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgdXBwZXItbGVmdCBjb3JuZXIgb2YgdGhlIGZyYW1pbmcgcmVjdGFuZ2xlIG9mIHRoaXMgY2lyY2xlXG4gKiBAcGFyYW0gcmFkaXVzIHtOdW1iZXJ9IFRoZSByYWRpdXMgb2YgdGhlIGNpcmNsZVxuICovXG5mdW5jdGlvbiBDaXJjbGUoeCwgeSwgcmFkaXVzKVxue1xuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB4XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueCA9IHggfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB5XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueSA9IHkgfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSByYWRpdXNcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy5yYWRpdXMgPSByYWRpdXMgfHwgMDtcbn1cblxudmFyIHByb3RvID0gQ2lyY2xlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgY2xvbmUgb2YgdGhpcyBDaXJjbGUgaW5zdGFuY2VcbiAqXG4gKiBAbWV0aG9kIGNsb25lXG4gKiBAcmV0dXJuIHtDaXJjbGV9IGEgY29weSBvZiB0aGUgcG9seWdvblxuICovXG5wcm90by5jbG9uZSA9IGZ1bmN0aW9uIGNsb25lKClcbntcbiAgICByZXR1cm4gbmV3IENpcmNsZSh0aGlzLngsIHRoaXMueSwgdGhpcy5yYWRpdXMpO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIHgsIGFuZCB5IGNvb3JkcyBwYXNzZWQgdG8gdGhpcyBmdW5jdGlvbiBhcmUgY29udGFpbmVkIHdpdGhpbiB0aGlzIGNpcmNsZVxuICpcbiAqIEBtZXRob2QgY29udGFpbnNcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgcG9pbnQgdG8gdGVzdFxuICogQHJldHVybiB7Qm9vbGVhbn0gaWYgdGhlIHgveSBjb29yZHMgYXJlIHdpdGhpbiB0aGlzIHBvbHlnb25cbiAqL1xucHJvdG8uY29udGFpbnMgPSBmdW5jdGlvbiBjb250YWlucyh4LCB5KVxue1xuICAgIGlmKHRoaXMucmFkaXVzIDw9IDApXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIHZhciBkeCA9ICh0aGlzLnggLSB4KSxcbiAgICAgICAgZHkgPSAodGhpcy55IC0geSksXG4gICAgICAgIHIyID0gdGhpcy5yYWRpdXMgKiB0aGlzLnJhZGl1cztcblxuICAgIGR4ICo9IGR4O1xuICAgIGR5ICo9IGR5O1xuXG4gICAgcmV0dXJuIChkeCArIGR5IDw9IHIyKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2lyY2xlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIENoYWQgRW5nbGVyIDxjaGFkQHBhbnRoZXJkZXYuY29tPlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBSZWN0YW5nbGUgPSByZXF1aXJlKCcuL1JlY3RhbmdsZScpO1xuXG4vKipcbiAqIFRoZSBFbGxpcHNlIG9iamVjdCBjYW4gYmUgdXNlZCB0byBzcGVjaWZ5IGEgaGl0IGFyZWEgZm9yIGRpc3BsYXlvYmplY3RzXG4gKlxuICogQGNsYXNzIEVsbGlwc2VcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHVwcGVyLWxlZnQgY29ybmVyIG9mIHRoZSBmcmFtaW5nIHJlY3RhbmdsZSBvZiB0aGlzIGVsbGlwc2VcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSB1cHBlci1sZWZ0IGNvcm5lciBvZiB0aGUgZnJhbWluZyByZWN0YW5nbGUgb2YgdGhpcyBlbGxpcHNlXG4gKiBAcGFyYW0gd2lkdGgge051bWJlcn0gVGhlIG92ZXJhbGwgd2lkdGggb2YgdGhpcyBlbGxpcHNlXG4gKiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9IFRoZSBvdmVyYWxsIGhlaWdodCBvZiB0aGlzIGVsbGlwc2VcbiAqL1xuZnVuY3Rpb24gRWxsaXBzZSh4LCB5LCB3aWR0aCwgaGVpZ2h0KVxue1xuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB4XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueCA9IHggfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB5XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueSA9IHkgfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLndpZHRoID0gd2lkdGggfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQgfHwgMDtcbn1cblxudmFyIHByb3RvID0gRWxsaXBzZS5wcm90b3R5cGU7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGNsb25lIG9mIHRoaXMgRWxsaXBzZSBpbnN0YW5jZVxuICpcbiAqIEBtZXRob2QgY2xvbmVcbiAqIEByZXR1cm4ge0VsbGlwc2V9IGEgY29weSBvZiB0aGUgZWxsaXBzZVxuICovXG5wcm90by5jbG9uZSA9IGZ1bmN0aW9uIGNsb25lKClcbntcbiAgICByZXR1cm4gbmV3IEVsbGlwc2UodGhpcy54LCB0aGlzLnksIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbn07XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSB4LCBhbmQgeSBjb29yZHMgcGFzc2VkIHRvIHRoaXMgZnVuY3Rpb24gYXJlIGNvbnRhaW5lZCB3aXRoaW4gdGhpcyBlbGxpcHNlXG4gKlxuICogQG1ldGhvZCBjb250YWluc1xuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHBvaW50IHRvIHRlc3RcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSBpZiB0aGUgeC95IGNvb3JkcyBhcmUgd2l0aGluIHRoaXMgZWxsaXBzZVxuICovXG5wcm90by5jb250YWlucyA9IGZ1bmN0aW9uIGNvbnRhaW5zKHgsIHkpXG57XG4gICAgaWYodGhpcy53aWR0aCA8PSAwIHx8IHRoaXMuaGVpZ2h0IDw9IDApXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIC8vbm9ybWFsaXplIHRoZSBjb29yZHMgdG8gYW4gZWxsaXBzZSB3aXRoIGNlbnRlciAwLDBcbiAgICAvL2FuZCBhIHJhZGl1cyBvZiAwLjVcbiAgICB2YXIgbm9ybXggPSAoKHggLSB0aGlzLngpIC8gdGhpcy53aWR0aCkgLSAwLjUsXG4gICAgICAgIG5vcm15ID0gKCh5IC0gdGhpcy55KSAvIHRoaXMuaGVpZ2h0KSAtIDAuNTtcblxuICAgIG5vcm14ICo9IG5vcm14O1xuICAgIG5vcm15ICo9IG5vcm15O1xuXG4gICAgcmV0dXJuIChub3JteCArIG5vcm15IDwgMC4yNSk7XG59O1xuXG5wcm90by5nZXRCb3VuZHMgPSBmdW5jdGlvbiBnZXRCb3VuZHMoKVxue1xuICAgIHJldHVybiBuZXcgUmVjdGFuZ2xlKHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVsbGlwc2U7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVGhlIFBvaW50IG9iamVjdCByZXByZXNlbnRzIGEgbG9jYXRpb24gaW4gYSB0d28tZGltZW5zaW9uYWwgY29vcmRpbmF0ZSBzeXN0ZW0sIHdoZXJlIHggcmVwcmVzZW50cyB0aGUgaG9yaXpvbnRhbCBheGlzIGFuZCB5IHJlcHJlc2VudHMgdGhlIHZlcnRpY2FsIGF4aXMuXG4gKlxuICogQGNsYXNzIFBvaW50XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IHBvc2l0aW9uIG9mIHRoZSBwb2ludFxuICogQHBhcmFtIHkge051bWJlcn0gcG9zaXRpb24gb2YgdGhlIHBvaW50XG4gKi9cbmZ1bmN0aW9uIFBvaW50KHgsIHkpXG57XG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHhcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy54ID0geCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHlcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy55ID0geSB8fCAwO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBjbG9uZSBvZiB0aGlzIHBvaW50XG4gKlxuICogQG1ldGhvZCBjbG9uZVxuICogQHJldHVybiB7UG9pbnR9IGEgY29weSBvZiB0aGUgcG9pbnRcbiAqL1xuUG9pbnQucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKVxue1xuICAgIHJldHVybiBuZXcgUG9pbnQodGhpcy54LCB0aGlzLnkpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQb2ludDtcbiIsIi8qKlxuICogQGF1dGhvciBBZHJpZW4gQnJhdWx0IDxhZHJpZW4uYnJhdWx0QGdtYWlsLmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUG9pbnQgPSByZXF1aXJlKCcuL1BvaW50Jyk7XG5cbi8qKlxuICogQGNsYXNzIFBvbHlnb25cbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHBvaW50cyoge0FycmF5PFBvaW50PnxBcnJheTxOdW1iZXI+fFBvaW50Li4ufE51bWJlci4uLn0gVGhpcyBjYW4gYmUgYW4gYXJyYXkgb2YgUG9pbnRzIHRoYXQgZm9ybSB0aGUgcG9seWdvbixcbiAqICAgICAgYSBmbGF0IGFycmF5IG9mIG51bWJlcnMgdGhhdCB3aWxsIGJlIGludGVycHJldGVkIGFzIFt4LHksIHgseSwgLi4uXSwgb3IgdGhlIGFydWdtZW50cyBwYXNzZWQgY2FuIGJlXG4gKiAgICAgIGFsbCB0aGUgcG9pbnRzIG9mIHRoZSBwb2x5Z29uIGUuZy4gYG5ldyBQb2x5Z29uKG5ldyBQb2ludCgpLCBuZXcgUG9pbnQoKSwgLi4uKWAsIG9yIHRoZVxuICogICAgICBhcmd1bWVudHMgcGFzc2VkIGNhbiBiZSBmbGF0IHgseSB2YWx1ZXMgZS5nLiBgbmV3IFBvbHlnb24oeCx5LCB4LHksIHgseSwgLi4uKWAgd2hlcmUgYHhgIGFuZCBgeWAgYXJlXG4gKiAgICAgIE51bWJlcnMuXG4gKi9cbmZ1bmN0aW9uIFBvbHlnb24ocG9pbnRzKVxue1xuICAgIC8vaWYgcG9pbnRzIGlzbid0IGFuIGFycmF5LCB1c2UgYXJndW1lbnRzIGFzIHRoZSBhcnJheVxuICAgIGlmKCEocG9pbnRzIGluc3RhbmNlb2YgQXJyYXkpKVxuICAgICAgICBwb2ludHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgLy9pZiB0aGlzIGlzIGEgZmxhdCBhcnJheSBvZiBudW1iZXJzLCBjb252ZXJ0IGl0IHRvIHBvaW50c1xuICAgIGlmKHR5cGVvZiBwb2ludHNbMF0gPT09ICdudW1iZXInKSB7XG4gICAgICAgIHZhciBwID0gW107XG4gICAgICAgIGZvcih2YXIgaSA9IDAsIGlsID0gcG9pbnRzLmxlbmd0aDsgaSA8IGlsOyBpKz0yKSB7XG4gICAgICAgICAgICBwLnB1c2goXG4gICAgICAgICAgICAgICAgbmV3IFBvaW50KHBvaW50c1tpXSwgcG9pbnRzW2kgKyAxXSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBwb2ludHMgPSBwO1xuICAgIH1cblxuICAgIHRoaXMucG9pbnRzID0gcG9pbnRzO1xufVxuXG52YXIgcHJvdG8gPSBQb2x5Z29uLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgY2xvbmUgb2YgdGhpcyBwb2x5Z29uXG4gKlxuICogQG1ldGhvZCBjbG9uZVxuICogQHJldHVybiB7UG9seWdvbn0gYSBjb3B5IG9mIHRoZSBwb2x5Z29uXG4gKi9cbnByb3RvLmNsb25lID0gZnVuY3Rpb24oKVxue1xuICAgIHZhciBwb2ludHMgPSBbXTtcbiAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcG9pbnRzLnB1c2godGhpcy5wb2ludHNbaV0uY2xvbmUoKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQb2x5Z29uKHBvaW50cyk7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgeCwgYW5kIHkgY29vcmRzIHBhc3NlZCB0byB0aGlzIGZ1bmN0aW9uIGFyZSBjb250YWluZWQgd2l0aGluIHRoaXMgcG9seWdvblxuICpcbiAqIEBtZXRob2QgY29udGFpbnNcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgcG9pbnQgdG8gdGVzdFxuICogQHJldHVybiB7Qm9vbGVhbn0gaWYgdGhlIHgveSBjb29yZHMgYXJlIHdpdGhpbiB0aGlzIHBvbHlnb25cbiAqL1xucHJvdG8uY29udGFpbnMgPSBmdW5jdGlvbih4LCB5KVxue1xuICAgIHZhciBpbnNpZGUgPSBmYWxzZTtcblxuICAgIC8vIHVzZSBzb21lIHJheWNhc3RpbmcgdG8gdGVzdCBoaXRzXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3N1YnN0YWNrL3BvaW50LWluLXBvbHlnb24vYmxvYi9tYXN0ZXIvaW5kZXguanNcbiAgICBmb3IodmFyIGkgPSAwLCBqID0gdGhpcy5wb2ludHMubGVuZ3RoIC0gMTsgaSA8IHRoaXMucG9pbnRzLmxlbmd0aDsgaiA9IGkrKykge1xuICAgICAgICB2YXIgeGkgPSB0aGlzLnBvaW50c1tpXS54LCB5aSA9IHRoaXMucG9pbnRzW2ldLnksXG4gICAgICAgICAgICB4aiA9IHRoaXMucG9pbnRzW2pdLngsIHlqID0gdGhpcy5wb2ludHNbal0ueSxcbiAgICAgICAgICAgIGludGVyc2VjdCA9ICgoeWkgPiB5KSAhPT0gKHlqID4geSkpICYmICh4IDwgKHhqIC0geGkpICogKHkgLSB5aSkgLyAoeWogLSB5aSkgKyB4aSk7XG5cbiAgICAgICAgaWYoaW50ZXJzZWN0KSBpbnNpZGUgPSAhaW5zaWRlO1xuICAgIH1cblxuICAgIHJldHVybiBpbnNpZGU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvbHlnb247XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS9cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIHRoZSBSZWN0YW5nbGUgb2JqZWN0IGlzIGFuIGFyZWEgZGVmaW5lZCBieSBpdHMgcG9zaXRpb24sIGFzIGluZGljYXRlZCBieSBpdHMgdG9wLWxlZnQgY29ybmVyIHBvaW50ICh4LCB5KSBhbmQgYnkgaXRzIHdpZHRoIGFuZCBpdHMgaGVpZ2h0LlxuICpcbiAqIEBjbGFzcyBSZWN0YW5nbGVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHVwcGVyLWxlZnQgY29ybmVyIG9mIHRoZSByZWN0YW5nbGVcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSB1cHBlci1sZWZ0IGNvcm5lciBvZiB0aGUgcmVjdGFuZ2xlXG4gKiBAcGFyYW0gd2lkdGgge051bWJlcn0gVGhlIG92ZXJhbGwgd2lkdGggb2YgdGhpcyByZWN0YW5nbGVcbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn0gVGhlIG92ZXJhbGwgaGVpZ2h0IG9mIHRoaXMgcmVjdGFuZ2xlXG4gKi9cbmZ1bmN0aW9uIFJlY3RhbmdsZSh4LCB5LCB3aWR0aCwgaGVpZ2h0KVxue1xuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB4XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueCA9IHggfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB5XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMueSA9IHkgfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLndpZHRoID0gd2lkdGggfHwgMDtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQgfHwgMDtcbn1cblxudmFyIHByb3RvID0gUmVjdGFuZ2xlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgY2xvbmUgb2YgdGhpcyBSZWN0YW5nbGVcbiAqXG4gKiBAbWV0aG9kIGNsb25lXG4gKiBAcmV0dXJuIHtSZWN0YW5nbGV9IGEgY29weSBvZiB0aGUgcmVjdGFuZ2xlXG4gKi9cbnByb3RvLmNsb25lID0gZnVuY3Rpb24oKVxue1xuICAgIHJldHVybiBuZXcgUmVjdGFuZ2xlKHRoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgeCwgYW5kIHkgY29vcmRzIHBhc3NlZCB0byB0aGlzIGZ1bmN0aW9uIGFyZSBjb250YWluZWQgd2l0aGluIHRoaXMgUmVjdGFuZ2xlXG4gKlxuICogQG1ldGhvZCBjb250YWluc1xuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHBvaW50IHRvIHRlc3RcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSBpZiB0aGUgeC95IGNvb3JkcyBhcmUgd2l0aGluIHRoaXMgUmVjdGFuZ2xlXG4gKi9cbnByb3RvLmNvbnRhaW5zID0gZnVuY3Rpb24oeCwgeSlcbntcbiAgICBpZiAodGhpcy53aWR0aCA8PSAwIHx8IHRoaXMuaGVpZ2h0IDw9IDApXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIHZhciB4MSA9IHRoaXMueDtcbiAgICBpZiAoeCA+PSB4MSAmJiB4IDw9IHgxICsgdGhpcy53aWR0aClcbiAgICB7XG4gICAgICAgIHZhciB5MSA9IHRoaXMueTtcblxuICAgICAgICBpZiAoeSA+PSB5MSAmJiB5IDw9IHkxICsgdGhpcy5oZWlnaHQpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZWN0YW5nbGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qXG4gKiBBIGxpZ2h0ZXIgdmVyc2lvbiBvZiB0aGUgcmFkIGdsLW1hdHJpeCBjcmVhdGVkIGJ5IEJyYW5kb24gSm9uZXMsIENvbGluIE1hY0tlbnppZSBJVlxuICogeW91IGJvdGggcm9jayFcbiAqL1xuXG52YXIgTWF0cml4ID0gZXhwb3J0cy5NYXRyaXggPSAodHlwZW9mIEZsb2F0MzJBcnJheSAhPT0gJ3VuZGVmaW5lZCcpID8gRmxvYXQzMkFycmF5IDogQXJyYXk7XG52YXIgbWF0MyAgID0gZXhwb3J0cy5tYXQzID0ge307XG52YXIgbWF0NCAgID0gZXhwb3J0cy5tYXQ0ID0ge307XG5cbm1hdDMuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKClcbntcbiAgICB2YXIgbWF0cml4ID0gbmV3IE1hdHJpeCg5KTtcblxuICAgIG1hdHJpeFswXSA9IDE7XG4gICAgbWF0cml4WzFdID0gMDtcbiAgICBtYXRyaXhbMl0gPSAwO1xuICAgIG1hdHJpeFszXSA9IDA7XG4gICAgbWF0cml4WzRdID0gMTtcbiAgICBtYXRyaXhbNV0gPSAwO1xuICAgIG1hdHJpeFs2XSA9IDA7XG4gICAgbWF0cml4WzddID0gMDtcbiAgICBtYXRyaXhbOF0gPSAxO1xuXG4gICAgcmV0dXJuIG1hdHJpeDtcbn07XG5cbm1hdDMuaWRlbnRpdHkgPSBmdW5jdGlvbiBpZGVudGl0eShtYXRyaXgpXG57XG4gICAgbWF0cml4WzBdID0gMTtcbiAgICBtYXRyaXhbMV0gPSAwO1xuICAgIG1hdHJpeFsyXSA9IDA7XG4gICAgbWF0cml4WzNdID0gMDtcbiAgICBtYXRyaXhbNF0gPSAxO1xuICAgIG1hdHJpeFs1XSA9IDA7XG4gICAgbWF0cml4WzZdID0gMDtcbiAgICBtYXRyaXhbN10gPSAwO1xuICAgIG1hdHJpeFs4XSA9IDE7XG5cbiAgICByZXR1cm4gbWF0cml4O1xufTtcblxubWF0NC5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoKVxue1xuICAgIHZhciBtYXRyaXggPSBuZXcgTWF0cml4KDE2KTtcblxuICAgIG1hdHJpeFswXSA9IDE7XG4gICAgbWF0cml4WzFdID0gMDtcbiAgICBtYXRyaXhbMl0gPSAwO1xuICAgIG1hdHJpeFszXSA9IDA7XG4gICAgbWF0cml4WzRdID0gMDtcbiAgICBtYXRyaXhbNV0gPSAxO1xuICAgIG1hdHJpeFs2XSA9IDA7XG4gICAgbWF0cml4WzddID0gMDtcbiAgICBtYXRyaXhbOF0gPSAwO1xuICAgIG1hdHJpeFs5XSA9IDA7XG4gICAgbWF0cml4WzEwXSA9IDE7XG4gICAgbWF0cml4WzExXSA9IDA7XG4gICAgbWF0cml4WzEyXSA9IDA7XG4gICAgbWF0cml4WzEzXSA9IDA7XG4gICAgbWF0cml4WzE0XSA9IDA7XG4gICAgbWF0cml4WzE1XSA9IDE7XG5cbiAgICByZXR1cm4gbWF0cml4O1xufTtcblxubWF0My5tdWx0aXBseSA9IGZ1bmN0aW9uIG11bHRpcGx5KG1hdCwgbWF0MiwgZGVzdClcbntcbiAgICBpZiAoIWRlc3QpIHsgZGVzdCA9IG1hdDsgfVxuXG4gICAgLy8gQ2FjaGUgdGhlIG1hdHJpeCB2YWx1ZXMgKG1ha2VzIGZvciBodWdlIHNwZWVkIGluY3JlYXNlcyEpXG4gICAgdmFyIGEwMCA9IG1hdFswXSwgYTAxID0gbWF0WzFdLCBhMDIgPSBtYXRbMl0sXG4gICAgICAgIGExMCA9IG1hdFszXSwgYTExID0gbWF0WzRdLCBhMTIgPSBtYXRbNV0sXG4gICAgICAgIGEyMCA9IG1hdFs2XSwgYTIxID0gbWF0WzddLCBhMjIgPSBtYXRbOF0sXG5cbiAgICAgICAgYjAwID0gbWF0MlswXSwgYjAxID0gbWF0MlsxXSwgYjAyID0gbWF0MlsyXSxcbiAgICAgICAgYjEwID0gbWF0MlszXSwgYjExID0gbWF0Mls0XSwgYjEyID0gbWF0Mls1XSxcbiAgICAgICAgYjIwID0gbWF0Mls2XSwgYjIxID0gbWF0Mls3XSwgYjIyID0gbWF0Mls4XTtcblxuICAgIGRlc3RbMF0gPSBiMDAgKiBhMDAgKyBiMDEgKiBhMTAgKyBiMDIgKiBhMjA7XG4gICAgZGVzdFsxXSA9IGIwMCAqIGEwMSArIGIwMSAqIGExMSArIGIwMiAqIGEyMTtcbiAgICBkZXN0WzJdID0gYjAwICogYTAyICsgYjAxICogYTEyICsgYjAyICogYTIyO1xuXG4gICAgZGVzdFszXSA9IGIxMCAqIGEwMCArIGIxMSAqIGExMCArIGIxMiAqIGEyMDtcbiAgICBkZXN0WzRdID0gYjEwICogYTAxICsgYjExICogYTExICsgYjEyICogYTIxO1xuICAgIGRlc3RbNV0gPSBiMTAgKiBhMDIgKyBiMTEgKiBhMTIgKyBiMTIgKiBhMjI7XG5cbiAgICBkZXN0WzZdID0gYjIwICogYTAwICsgYjIxICogYTEwICsgYjIyICogYTIwO1xuICAgIGRlc3RbN10gPSBiMjAgKiBhMDEgKyBiMjEgKiBhMTEgKyBiMjIgKiBhMjE7XG4gICAgZGVzdFs4XSA9IGIyMCAqIGEwMiArIGIyMSAqIGExMiArIGIyMiAqIGEyMjtcblxuICAgIHJldHVybiBkZXN0O1xufTtcblxubWF0My5jbG9uZSA9IGZ1bmN0aW9uIGNsb25lKG1hdClcbntcbiAgICB2YXIgbWF0cml4ID0gbmV3IE1hdHJpeCg5KTtcblxuICAgIG1hdHJpeFswXSA9IG1hdFswXTtcbiAgICBtYXRyaXhbMV0gPSBtYXRbMV07XG4gICAgbWF0cml4WzJdID0gbWF0WzJdO1xuICAgIG1hdHJpeFszXSA9IG1hdFszXTtcbiAgICBtYXRyaXhbNF0gPSBtYXRbNF07XG4gICAgbWF0cml4WzVdID0gbWF0WzVdO1xuICAgIG1hdHJpeFs2XSA9IG1hdFs2XTtcbiAgICBtYXRyaXhbN10gPSBtYXRbN107XG4gICAgbWF0cml4WzhdID0gbWF0WzhdO1xuXG4gICAgcmV0dXJuIG1hdHJpeDtcbn07XG5cbm1hdDMudHJhbnNwb3NlID0gZnVuY3Rpb24gdHJhbnNwb3NlKG1hdCwgZGVzdClcbntcbiAgICAvLyBJZiB3ZSBhcmUgdHJhbnNwb3Npbmcgb3Vyc2VsdmVzIHdlIGNhbiBza2lwIGEgZmV3IHN0ZXBzIGJ1dCBoYXZlIHRvIGNhY2hlIHNvbWUgdmFsdWVzXG4gICAgaWYgKCFkZXN0IHx8IG1hdCA9PT0gZGVzdCkge1xuICAgICAgICB2YXIgYTAxID0gbWF0WzFdLCBhMDIgPSBtYXRbMl0sXG4gICAgICAgICAgICBhMTIgPSBtYXRbNV07XG5cbiAgICAgICAgbWF0WzFdID0gbWF0WzNdO1xuICAgICAgICBtYXRbMl0gPSBtYXRbNl07XG4gICAgICAgIG1hdFszXSA9IGEwMTtcbiAgICAgICAgbWF0WzVdID0gbWF0WzddO1xuICAgICAgICBtYXRbNl0gPSBhMDI7XG4gICAgICAgIG1hdFs3XSA9IGExMjtcbiAgICAgICAgcmV0dXJuIG1hdDtcbiAgICB9XG5cbiAgICBkZXN0WzBdID0gbWF0WzBdO1xuICAgIGRlc3RbMV0gPSBtYXRbM107XG4gICAgZGVzdFsyXSA9IG1hdFs2XTtcbiAgICBkZXN0WzNdID0gbWF0WzFdO1xuICAgIGRlc3RbNF0gPSBtYXRbNF07XG4gICAgZGVzdFs1XSA9IG1hdFs3XTtcbiAgICBkZXN0WzZdID0gbWF0WzJdO1xuICAgIGRlc3RbN10gPSBtYXRbNV07XG4gICAgZGVzdFs4XSA9IG1hdFs4XTtcbiAgICByZXR1cm4gZGVzdDtcbn07XG5cbm1hdDMudG9NYXQ0ID0gZnVuY3Rpb24gdG9NYXQ0KG1hdCwgZGVzdClcbntcbiAgICBpZiAoIWRlc3QpIHsgZGVzdCA9IG1hdDQuY3JlYXRlKCk7IH1cblxuICAgIGRlc3RbMTVdID0gMTtcbiAgICBkZXN0WzE0XSA9IDA7XG4gICAgZGVzdFsxM10gPSAwO1xuICAgIGRlc3RbMTJdID0gMDtcblxuICAgIGRlc3RbMTFdID0gMDtcbiAgICBkZXN0WzEwXSA9IG1hdFs4XTtcbiAgICBkZXN0WzldID0gbWF0WzddO1xuICAgIGRlc3RbOF0gPSBtYXRbNl07XG5cbiAgICBkZXN0WzddID0gMDtcbiAgICBkZXN0WzZdID0gbWF0WzVdO1xuICAgIGRlc3RbNV0gPSBtYXRbNF07XG4gICAgZGVzdFs0XSA9IG1hdFszXTtcblxuICAgIGRlc3RbM10gPSAwO1xuICAgIGRlc3RbMl0gPSBtYXRbMl07XG4gICAgZGVzdFsxXSA9IG1hdFsxXTtcbiAgICBkZXN0WzBdID0gbWF0WzBdO1xuXG4gICAgcmV0dXJuIGRlc3Q7XG59O1xuXG5cbi8vLy8vXG5cblxubWF0NC5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoKVxue1xuICAgIHZhciBtYXRyaXggPSBuZXcgTWF0cml4KDE2KTtcblxuICAgIG1hdHJpeFswXSA9IDE7XG4gICAgbWF0cml4WzFdID0gMDtcbiAgICBtYXRyaXhbMl0gPSAwO1xuICAgIG1hdHJpeFszXSA9IDA7XG4gICAgbWF0cml4WzRdID0gMDtcbiAgICBtYXRyaXhbNV0gPSAxO1xuICAgIG1hdHJpeFs2XSA9IDA7XG4gICAgbWF0cml4WzddID0gMDtcbiAgICBtYXRyaXhbOF0gPSAwO1xuICAgIG1hdHJpeFs5XSA9IDA7XG4gICAgbWF0cml4WzEwXSA9IDE7XG4gICAgbWF0cml4WzExXSA9IDA7XG4gICAgbWF0cml4WzEyXSA9IDA7XG4gICAgbWF0cml4WzEzXSA9IDA7XG4gICAgbWF0cml4WzE0XSA9IDA7XG4gICAgbWF0cml4WzE1XSA9IDE7XG5cbiAgICByZXR1cm4gbWF0cml4O1xufTtcblxubWF0NC50cmFuc3Bvc2UgPSBmdW5jdGlvbiB0cmFuc3Bvc2UobWF0LCBkZXN0KVxue1xuICAgIC8vIElmIHdlIGFyZSB0cmFuc3Bvc2luZyBvdXJzZWx2ZXMgd2UgY2FuIHNraXAgYSBmZXcgc3RlcHMgYnV0IGhhdmUgdG8gY2FjaGUgc29tZSB2YWx1ZXNcbiAgICBpZiAoIWRlc3QgfHwgbWF0ID09PSBkZXN0KVxuICAgIHtcbiAgICAgICAgdmFyIGEwMSA9IG1hdFsxXSwgYTAyID0gbWF0WzJdLCBhMDMgPSBtYXRbM10sXG4gICAgICAgICAgICBhMTIgPSBtYXRbNl0sIGExMyA9IG1hdFs3XSxcbiAgICAgICAgICAgIGEyMyA9IG1hdFsxMV07XG5cbiAgICAgICAgbWF0WzFdID0gbWF0WzRdO1xuICAgICAgICBtYXRbMl0gPSBtYXRbOF07XG4gICAgICAgIG1hdFszXSA9IG1hdFsxMl07XG4gICAgICAgIG1hdFs0XSA9IGEwMTtcbiAgICAgICAgbWF0WzZdID0gbWF0WzldO1xuICAgICAgICBtYXRbN10gPSBtYXRbMTNdO1xuICAgICAgICBtYXRbOF0gPSBhMDI7XG4gICAgICAgIG1hdFs5XSA9IGExMjtcbiAgICAgICAgbWF0WzExXSA9IG1hdFsxNF07XG4gICAgICAgIG1hdFsxMl0gPSBhMDM7XG4gICAgICAgIG1hdFsxM10gPSBhMTM7XG4gICAgICAgIG1hdFsxNF0gPSBhMjM7XG4gICAgICAgIHJldHVybiBtYXQ7XG4gICAgfVxuXG4gICAgZGVzdFswXSA9IG1hdFswXTtcbiAgICBkZXN0WzFdID0gbWF0WzRdO1xuICAgIGRlc3RbMl0gPSBtYXRbOF07XG4gICAgZGVzdFszXSA9IG1hdFsxMl07XG4gICAgZGVzdFs0XSA9IG1hdFsxXTtcbiAgICBkZXN0WzVdID0gbWF0WzVdO1xuICAgIGRlc3RbNl0gPSBtYXRbOV07XG4gICAgZGVzdFs3XSA9IG1hdFsxM107XG4gICAgZGVzdFs4XSA9IG1hdFsyXTtcbiAgICBkZXN0WzldID0gbWF0WzZdO1xuICAgIGRlc3RbMTBdID0gbWF0WzEwXTtcbiAgICBkZXN0WzExXSA9IG1hdFsxNF07XG4gICAgZGVzdFsxMl0gPSBtYXRbM107XG4gICAgZGVzdFsxM10gPSBtYXRbN107XG4gICAgZGVzdFsxNF0gPSBtYXRbMTFdO1xuICAgIGRlc3RbMTVdID0gbWF0WzE1XTtcbiAgICByZXR1cm4gZGVzdDtcbn07XG5cbm1hdDQubXVsdGlwbHkgPSBmdW5jdGlvbiBtdWx0aXBseShtYXQsIG1hdDIsIGRlc3QpXG57XG4gICAgaWYgKCFkZXN0KSB7IGRlc3QgPSBtYXQ7IH1cblxuICAgIC8vIENhY2hlIHRoZSBtYXRyaXggdmFsdWVzIChtYWtlcyBmb3IgaHVnZSBzcGVlZCBpbmNyZWFzZXMhKVxuICAgIHZhciBhMDAgPSBtYXRbIDBdLCBhMDEgPSBtYXRbIDFdLCBhMDIgPSBtYXRbIDJdLCBhMDMgPSBtYXRbM107XG4gICAgdmFyIGExMCA9IG1hdFsgNF0sIGExMSA9IG1hdFsgNV0sIGExMiA9IG1hdFsgNl0sIGExMyA9IG1hdFs3XTtcbiAgICB2YXIgYTIwID0gbWF0WyA4XSwgYTIxID0gbWF0WyA5XSwgYTIyID0gbWF0WzEwXSwgYTIzID0gbWF0WzExXTtcbiAgICB2YXIgYTMwID0gbWF0WzEyXSwgYTMxID0gbWF0WzEzXSwgYTMyID0gbWF0WzE0XSwgYTMzID0gbWF0WzE1XTtcblxuICAgIC8vIENhY2hlIG9ubHkgdGhlIGN1cnJlbnQgbGluZSBvZiB0aGUgc2Vjb25kIG1hdHJpeFxuICAgIHZhciBiMCAgPSBtYXQyWzBdLCBiMSA9IG1hdDJbMV0sIGIyID0gbWF0MlsyXSwgYjMgPSBtYXQyWzNdO1xuICAgIGRlc3RbMF0gPSBiMCphMDAgKyBiMSphMTAgKyBiMiphMjAgKyBiMyphMzA7XG4gICAgZGVzdFsxXSA9IGIwKmEwMSArIGIxKmExMSArIGIyKmEyMSArIGIzKmEzMTtcbiAgICBkZXN0WzJdID0gYjAqYTAyICsgYjEqYTEyICsgYjIqYTIyICsgYjMqYTMyO1xuICAgIGRlc3RbM10gPSBiMCphMDMgKyBiMSphMTMgKyBiMiphMjMgKyBiMyphMzM7XG5cbiAgICBiMCA9IG1hdDJbNF07XG4gICAgYjEgPSBtYXQyWzVdO1xuICAgIGIyID0gbWF0Mls2XTtcbiAgICBiMyA9IG1hdDJbN107XG4gICAgZGVzdFs0XSA9IGIwKmEwMCArIGIxKmExMCArIGIyKmEyMCArIGIzKmEzMDtcbiAgICBkZXN0WzVdID0gYjAqYTAxICsgYjEqYTExICsgYjIqYTIxICsgYjMqYTMxO1xuICAgIGRlc3RbNl0gPSBiMCphMDIgKyBiMSphMTIgKyBiMiphMjIgKyBiMyphMzI7XG4gICAgZGVzdFs3XSA9IGIwKmEwMyArIGIxKmExMyArIGIyKmEyMyArIGIzKmEzMztcblxuICAgIGIwID0gbWF0Mls4XTtcbiAgICBiMSA9IG1hdDJbOV07XG4gICAgYjIgPSBtYXQyWzEwXTtcbiAgICBiMyA9IG1hdDJbMTFdO1xuICAgIGRlc3RbOF0gPSBiMCphMDAgKyBiMSphMTAgKyBiMiphMjAgKyBiMyphMzA7XG4gICAgZGVzdFs5XSA9IGIwKmEwMSArIGIxKmExMSArIGIyKmEyMSArIGIzKmEzMTtcbiAgICBkZXN0WzEwXSA9IGIwKmEwMiArIGIxKmExMiArIGIyKmEyMiArIGIzKmEzMjtcbiAgICBkZXN0WzExXSA9IGIwKmEwMyArIGIxKmExMyArIGIyKmEyMyArIGIzKmEzMztcblxuICAgIGIwID0gbWF0MlsxMl07XG4gICAgYjEgPSBtYXQyWzEzXTtcbiAgICBiMiA9IG1hdDJbMTRdO1xuICAgIGIzID0gbWF0MlsxNV07XG4gICAgZGVzdFsxMl0gPSBiMCphMDAgKyBiMSphMTAgKyBiMiphMjAgKyBiMyphMzA7XG4gICAgZGVzdFsxM10gPSBiMCphMDEgKyBiMSphMTEgKyBiMiphMjEgKyBiMyphMzE7XG4gICAgZGVzdFsxNF0gPSBiMCphMDIgKyBiMSphMTIgKyBiMiphMjIgKyBiMyphMzI7XG4gICAgZGVzdFsxNV0gPSBiMCphMDMgKyBiMSphMTMgKyBiMiphMjMgKyBiMyphMzM7XG5cbiAgICByZXR1cm4gZGVzdDtcbn07XG4iLCIvKipcbiAqIEBhdXRob3IgRHIuIEtpYml0eiA8aW5mb0BkcmtpYml0ei5jb20+XG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGdsb2JhbHMgID0gcmVxdWlyZSgnLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBzaGFkZXJzICA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzL3dlYmdsL3NoYWRlcnMnKTtcbnZhciBtYXRyaXggICA9IHJlcXVpcmUoJy4vZ2VvbS9tYXRyaXgnKTtcblxudmFyIHBpeGkgPSBtb2R1bGUuZXhwb3J0cyA9IE9iamVjdC5jcmVhdGUoZ2xvYmFscyk7XG5cbnBpeGkuUG9pbnQgICAgID0gcmVxdWlyZSgnLi9nZW9tL1BvaW50Jyk7XG5waXhpLlJlY3RhbmdsZSA9IHJlcXVpcmUoJy4vZ2VvbS9SZWN0YW5nbGUnKTtcbnBpeGkuUG9seWdvbiAgID0gcmVxdWlyZSgnLi9nZW9tL1BvbHlnb24nKTtcbnBpeGkuQ2lyY2xlICAgID0gcmVxdWlyZSgnLi9nZW9tL0NpcmNsZScpO1xucGl4aS5FbGxpcHNlICAgPSByZXF1aXJlKCcuL2dlb20vRWxsaXBzZScpO1xucGl4aS5NYXRyaXggICAgPSBtYXRyaXguTWF0cml4O1xucGl4aS5tYXQzICAgICAgPSBtYXRyaXgubWF0MztcbnBpeGkubWF0NCAgICAgID0gbWF0cml4Lm1hdDQ7XG5cbnBpeGkuYmxlbmRNb2RlcyAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vZGlzcGxheS9ibGVuZE1vZGVzJyk7XG5waXhpLkRpc3BsYXlPYmplY3QgICAgICAgICAgPSByZXF1aXJlKCcuL2Rpc3BsYXkvRGlzcGxheU9iamVjdCcpO1xucGl4aS5EaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcbnBpeGkuU3ByaXRlICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vZGlzcGxheS9TcHJpdGUnKTtcbnBpeGkuTW92aWVDbGlwICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vZGlzcGxheS9Nb3ZpZUNsaXAnKTtcblxucGl4aS5BYnN0cmFjdEZpbHRlciAgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvQWJzdHJhY3RGaWx0ZXInKTtcbnBpeGkuQmx1ckZpbHRlciAgICAgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL0JsdXJGaWx0ZXInKTtcbnBpeGkuQmx1clhGaWx0ZXIgICAgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL0JsdXJYRmlsdGVyJyk7XG5waXhpLkJsdXJZRmlsdGVyICAgICAgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9CbHVyWUZpbHRlcicpO1xucGl4aS5Db2xvck1hdHJpeEZpbHRlciAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvQ29sb3JNYXRyaXhGaWx0ZXInKTtcbnBpeGkuQ29sb3JTdGVwRmlsdGVyICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL0NvbG9yU3RlcEZpbHRlcicpO1xucGl4aS5Dcm9zc0hhdGNoRmlsdGVyICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvQ3Jvc3NIYXRjaEZpbHRlcicpO1xucGl4aS5EaXNwbGFjZW1lbnRGaWx0ZXIgPSByZXF1aXJlKCcuL2ZpbHRlcnMvRGlzcGxhY2VtZW50RmlsdGVyJyk7XG5waXhpLkRvdFNjcmVlbkZpbHRlciAgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9Eb3RTY3JlZW5GaWx0ZXInKTtcbnBpeGkuRmlsdGVyQmxvY2sgICAgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL0ZpbHRlckJsb2NrJyk7XG5waXhpLkdyYXlGaWx0ZXIgICAgICAgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9HcmF5RmlsdGVyJyk7XG5waXhpLkludmVydEZpbHRlciAgICAgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9JbnZlcnRGaWx0ZXInKTtcbnBpeGkuUGl4ZWxhdGVGaWx0ZXIgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL1BpeGVsYXRlRmlsdGVyJyk7XG5waXhpLlJHQlNwbGl0RmlsdGVyICAgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9SR0JTcGxpdEZpbHRlcicpO1xucGl4aS5TZXBpYUZpbHRlciAgICAgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvU2VwaWFGaWx0ZXInKTtcbnBpeGkuU21hcnRCbHVyRmlsdGVyICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL1NtYXJ0Qmx1ckZpbHRlcicpO1xucGl4aS5Ud2lzdEZpbHRlciAgICAgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvVHdpc3RGaWx0ZXInKTtcblxucGl4aS5UZXh0ICAgICAgID0gcmVxdWlyZSgnLi90ZXh0L1RleHQnKTtcbnBpeGkuQml0bWFwVGV4dCA9IHJlcXVpcmUoJy4vdGV4dC9CaXRtYXBUZXh0Jyk7XG5cbnBpeGkuSW50ZXJhY3Rpb25NYW5hZ2VyID0gcmVxdWlyZSgnLi9JbnRlcmFjdGlvbk1hbmFnZXInKTtcbnBpeGkuU3RhZ2UgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9kaXNwbGF5L1N0YWdlJyk7XG5cbnBpeGkuRXZlbnRUYXJnZXQgICAgICAgID0gcmVxdWlyZSgnLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcblxucGl4aS5hdXRvRGV0ZWN0UmVuZGVyZXIgPSByZXF1aXJlKCcuL3V0aWxzL2F1dG9EZXRlY3RSZW5kZXJlcicpO1xucGl4aS5Qb2x5SyAgICAgICAgICAgICAgPSByZXF1aXJlKCcuL3V0aWxzL1BvbHlrJyk7XG5cbnBpeGkuV2ViR0xHcmFwaGljcyAgICA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzL3dlYmdsL2dyYXBoaWNzJyk7XG5waXhpLldlYkdMUmVuZGVyZXIgICAgPSByZXF1aXJlKCcuL3JlbmRlcmVycy93ZWJnbC9XZWJHTFJlbmRlcmVyJyk7XG5waXhpLldlYkdMQmF0Y2ggICAgICAgPSByZXF1aXJlKCcuL3JlbmRlcmVycy93ZWJnbC9XZWJHTEJhdGNoJyk7XG5waXhpLldlYkdMUmVuZGVyR3JvdXAgPSByZXF1aXJlKCcuL3JlbmRlcmVycy93ZWJnbC9XZWJHTFJlbmRlckdyb3VwJyk7XG5waXhpLkNhbnZhc1JlbmRlcmVyICAgPSByZXF1aXJlKCcuL3JlbmRlcmVycy9jYW52YXMvQ2FudmFzUmVuZGVyZXInKTtcbnBpeGkuQ2FudmFzR3JhcGhpY3MgICA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzL2NhbnZhcy9ncmFwaGljcycpO1xuXG5waXhpLkdyYXBoaWNzID0gcmVxdWlyZSgnLi9wcmltaXRpdmVzL0dyYXBoaWNzJyk7XG5cbnBpeGkuU3RyaXAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vZXh0cmFzL1N0cmlwJyk7XG5waXhpLlJvcGUgICAgICAgICAgICAgPSByZXF1aXJlKCcuL2V4dHJhcy9Sb3BlJyk7XG5waXhpLlRpbGluZ1Nwcml0ZSAgICAgPSByZXF1aXJlKCcuL2V4dHJhcy9UaWxpbmdTcHJpdGUnKTtcbnBpeGkuU3BpbmUgICAgICAgICAgICA9IHJlcXVpcmUoJy4vZXh0cmFzL1NwaW5lJyk7XG5waXhpLkN1c3RvbVJlbmRlcmFibGUgPSByZXF1aXJlKCcuL2V4dHJhcy9DdXN0b21SZW5kZXJhYmxlJyk7XG5cbnBpeGkuQmFzZVRleHR1cmUgICA9IHJlcXVpcmUoJy4vdGV4dHVyZXMvQmFzZVRleHR1cmUnKTtcbnBpeGkuVGV4dHVyZSAgICAgICA9IHJlcXVpcmUoJy4vdGV4dHVyZXMvVGV4dHVyZScpO1xucGl4aS5SZW5kZXJUZXh0dXJlID0gcmVxdWlyZSgnLi90ZXh0dXJlcy9SZW5kZXJUZXh0dXJlJyk7XG5cbnBpeGkuQXNzZXRMb2FkZXIgICAgICAgPSByZXF1aXJlKCcuL2xvYWRlcnMvQXNzZXRMb2FkZXInKTtcbnBpeGkuSnNvbkxvYWRlciAgICAgICAgPSByZXF1aXJlKCcuL2xvYWRlcnMvSnNvbkxvYWRlcicpO1xucGl4aS5TcHJpdGVTaGVldExvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVycy9TcHJpdGVTaGVldExvYWRlcicpO1xucGl4aS5JbWFnZUxvYWRlciAgICAgICA9IHJlcXVpcmUoJy4vbG9hZGVycy9JbWFnZUxvYWRlcicpO1xucGl4aS5CaXRtYXBGb250TG9hZGVyICA9IHJlcXVpcmUoJy4vbG9hZGVycy9CaXRtYXBGb250TG9hZGVyJyk7XG5waXhpLlNwaW5lTG9hZGVyICAgICAgID0gcmVxdWlyZSgnLi9sb2FkZXJzL1NwaW5lTG9hZGVyJyk7XG5cbnBpeGkuaW5pdERlZmF1bHRTaGFkZXJzICAgICAgICA9IHNoYWRlcnMuaW5pdERlZmF1bHRTaGFkZXJzO1xucGl4aS5hY3RpdmF0ZVByaW1pdGl2ZVNoYWRlciAgID0gc2hhZGVycy5hY3RpdmF0ZVByaW1pdGl2ZVNoYWRlcjtcbnBpeGkuZGVhY3RpdmF0ZVByaW1pdGl2ZVNoYWRlciA9IHNoYWRlcnMuZGVhY3RpdmF0ZVByaW1pdGl2ZVNoYWRlcjtcbnBpeGkuYWN0aXZhdGVTdHJpcFNoYWRlciAgICAgICA9IHNoYWRlcnMuYWN0aXZhdGVTdHJpcFNoYWRlcjtcbnBpeGkuZGVhY3RpdmF0ZVN0cmlwU2hhZGVyICAgICA9IHNoYWRlcnMuZGVhY3RpdmF0ZVN0cmlwU2hhZGVyO1xuXG4vLyBERUJVR0dJTkcgT05MWVxuLy8gVE9ETzogcHJlcHJvY2VzcyBtYWNyb3NcbnZhciBkZWJ1ZyAgPSByZXF1aXJlKCcuL3V0aWxzL2RlYnVnJyk7XG5waXhpLnJ1bkxpc3QgPSBkZWJ1Zy5ydW5MaXN0O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcblxuLyoqXG4gKiBNYXBzIGZpbGUgZXh0ZW5zaW9uIHRvIGxvYWRlciB0eXBlc1xuICpcbiAqIEBwcm9wZXJ0eSBsb2FkZXJzQnlUeXBlXG4gKiBAdHlwZSBPYmplY3RcbiAqL1xudmFyIGxvYWRlcnNCeVR5cGUgPSB7fTtcblxuZnVuY3Rpb24gZ2V0RGF0YVR5cGUoc3RyKVxue1xuICAgIHZhciB0ZXN0ID0gJ2RhdGE6JztcbiAgICAvL3N0YXJ0cyB3aXRoICdkYXRhOidcbiAgICB2YXIgc3RhcnQgPSBzdHIuc2xpY2UoMCwgdGVzdC5sZW5ndGgpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKHN0YXJ0ID09PSB0ZXN0KSB7XG4gICAgICAgIHZhciBkYXRhID0gc3RyLnNsaWNlKHRlc3QubGVuZ3RoKTtcblxuICAgICAgICB2YXIgc2VwSWR4ID0gZGF0YS5pbmRleE9mKCcsJyk7XG4gICAgICAgIGlmIChzZXBJZHggPT09IC0xKSAvL21hbGZvcm1lZCBkYXRhIFVSSSBzY2hlbWVcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIC8vZS5nLiAnaW1hZ2UvZ2lmO2Jhc2U2NCcgPT4gJ2ltYWdlL2dpZidcbiAgICAgICAgdmFyIGluZm8gPSBkYXRhLnNsaWNlKDAsIHNlcElkeCkuc3BsaXQoJzsnKVswXTtcblxuICAgICAgICAvL1dlIG1pZ2h0IG5lZWQgdG8gaGFuZGxlIHNvbWUgc3BlY2lhbCBjYXNlcyBoZXJlLi4uXG4gICAgICAgIC8vc3RhbmRhcmRpemUgdGV4dC9wbGFpbiB0byAndHh0JyBmaWxlIGV4dGVuc2lvblxuICAgICAgICBpZiAoIWluZm8gfHwgaW5mby50b0xvd2VyQ2FzZSgpID09PSAndGV4dC9wbGFpbicpXG4gICAgICAgICAgICByZXR1cm4gJ3R4dCc7XG5cbiAgICAgICAgLy9Vc2VyIHNwZWNpZmllZCBtaW1lIHR5cGUsIHRyeSBzcGxpdHRpbmcgaXQgYnkgJy8nXG4gICAgICAgIHJldHVybiBpbmZvLnNwbGl0KCcvJykucG9wKCkudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBBIENsYXNzIHRoYXQgbG9hZHMgYSBidW5jaCBvZiBpbWFnZXMgLyBzcHJpdGUgc2hlZXQgLyBiaXRtYXAgZm9udCBmaWxlcy4gT25jZSB0aGVcbiAqIGFzc2V0cyBoYXZlIGJlZW4gbG9hZGVkIHRoZXkgYXJlIGFkZGVkIHRvIHRoZSBUZXh0dXJlIGNhY2hlIGFuZCBjYW4gYmUgYWNjZXNzZWRcbiAqIGVhc2lseSB0aHJvdWdoIFRleHR1cmUuZnJvbUltYWdlKCkgYW5kIFNwcml0ZS5mcm9tSW1hZ2UoKVxuICogV2hlbiBhbGwgaXRlbXMgaGF2ZSBiZWVuIGxvYWRlZCB0aGlzIGNsYXNzIHdpbGwgZGlzcGF0Y2ggYSBcIm9uTG9hZGVkXCIgZXZlbnRcbiAqIEFzIGVhY2ggaW5kaXZpZHVhbCBpdGVtIGlzIGxvYWRlZCB0aGlzIGNsYXNzIHdpbGwgZGlzcGF0Y2ggYSBcIm9uUHJvZ3Jlc3NcIiBldmVudFxuICpcbiAqIEBjbGFzcyBBc3NldExvYWRlclxuICogQGNvbnN0cnVjdG9yXG4gKiBAdXNlcyBFdmVudFRhcmdldFxuICogQHBhcmFtIHtBcnJheTxTdHJpbmc+fSBhc3NldFVSTHMgYW4gYXJyYXkgb2YgaW1hZ2Uvc3ByaXRlIHNoZWV0IHVybHMgdGhhdCB5b3Ugd291bGQgbGlrZSBsb2FkZWRcbiAqICAgICAgc3VwcG9ydGVkLiBTdXBwb3J0ZWQgaW1hZ2UgZm9ybWF0cyBpbmNsdWRlICdqcGVnJywgJ2pwZycsICdwbmcnLCAnZ2lmJy4gU3VwcG9ydGVkXG4gKiAgICAgIHNwcml0ZSBzaGVldCBkYXRhIGZvcm1hdHMgb25seSBpbmNsdWRlICdKU09OJyBhdCB0aGlzIHRpbWUuIFN1cHBvcnRlZCBiaXRtYXAgZm9udFxuICogICAgICBkYXRhIGZvcm1hdHMgaW5jbHVkZSAneG1sJyBhbmQgJ2ZudCcuXG4gKiBAcGFyYW0gY3Jvc3NvcmlnaW4ge0Jvb2xlYW59IFdoZXRoZXIgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3NvcmlnaW5cbiAqL1xuZnVuY3Rpb24gQXNzZXRMb2FkZXIoYXNzZXRVUkxzLCBjcm9zc29yaWdpbilcbntcbiAgICBFdmVudFRhcmdldC5jYWxsKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGFycmF5IG9mIGFzc2V0IFVSTHMgdGhhdCBhcmUgZ29pbmcgdG8gYmUgbG9hZGVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYXNzZXRVUkxzXG4gICAgICogQHR5cGUgQXJyYXk8U3RyaW5nPlxuICAgICAqL1xuICAgIHRoaXMuYXNzZXRVUkxzID0gYXNzZXRVUkxzO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3Mgb3JpZ2luXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgY3Jvc3NvcmlnaW5cbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICovXG4gICAgdGhpcy5jcm9zc29yaWdpbiA9IGNyb3Nzb3JpZ2luO1xufVxuXG52YXIgcHJvdG8gPSBBc3NldExvYWRlci5wcm90b3R5cGU7XG5cbi8qKlxuICogRmlyZWQgd2hlbiBhbiBpdGVtIGhhcyBsb2FkZWRcbiAqIEBldmVudCBvblByb2dyZXNzXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIGFsbCB0aGUgYXNzZXRzIGhhdmUgbG9hZGVkXG4gKiBAZXZlbnQgb25Db21wbGV0ZVxuICovXG5cbi8qKlxuICogU3RhcnRzIGxvYWRpbmcgdGhlIGFzc2V0cyBzZXF1ZW50aWFsbHlcbiAqXG4gKiBAbWV0aG9kIGxvYWRcbiAqL1xucHJvdG8ubG9hZCA9IGZ1bmN0aW9uIGxvYWQoKVxue1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiBvbkxvYWQoKSB7XG4gICAgICAgIHNjb3BlLm9uQXNzZXRMb2FkZWQoKTtcbiAgICB9XG5cbiAgICB0aGlzLmxvYWRDb3VudCA9IHRoaXMuYXNzZXRVUkxzLmxlbmd0aDtcblxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5hc3NldFVSTHMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGZpbGVOYW1lID0gdGhpcy5hc3NldFVSTHNbaV07XG4gICAgICAgIC8vZmlyc3Qgc2VlIGlmIHdlIGhhdmUgYSBkYXRhIFVSSSBzY2hlbWUuLlxuICAgICAgICB2YXIgZmlsZVR5cGUgPSBnZXREYXRhVHlwZShmaWxlTmFtZSk7XG5cbiAgICAgICAgLy9pZiBub3QsIGFzc3VtZSBpdCdzIGEgZmlsZSBVUklcbiAgICAgICAgaWYgKCFmaWxlVHlwZSlcbiAgICAgICAgICAgIGZpbGVUeXBlID0gZmlsZU5hbWUuc3BsaXQoJz8nKS5zaGlmdCgpLnNwbGl0KCcuJykucG9wKCkudG9Mb3dlckNhc2UoKTtcblxuICAgICAgICB2YXIgQ29uc3RydWN0b3IgPSBsb2FkZXJzQnlUeXBlW2ZpbGVUeXBlXTtcbiAgICAgICAgaWYoIUNvbnN0cnVjdG9yKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZpbGVUeXBlICsgJyBpcyBhbiB1bnN1cHBvcnRlZCBmaWxlIHR5cGUnKTtcblxuICAgICAgICB2YXIgbG9hZGVyID0gbmV3IENvbnN0cnVjdG9yKGZpbGVOYW1lLCB0aGlzLmNyb3Nzb3JpZ2luKTtcblxuICAgICAgICBsb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgb25Mb2FkKTtcbiAgICAgICAgbG9hZGVyLmxvYWQoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEludm9rZWQgYWZ0ZXIgZWFjaCBmaWxlIGlzIGxvYWRlZFxuICpcbiAqIEBtZXRob2Qgb25Bc3NldExvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Bc3NldExvYWRlZCA9IGZ1bmN0aW9uIG9uQXNzZXRMb2FkZWQoKVxue1xuICAgIHRoaXMubG9hZENvdW50LS07XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiAnb25Qcm9ncmVzcycsIGNvbnRlbnQ6IHRoaXN9KTtcbiAgICBpZiAodGhpcy5vblByb2dyZXNzKSB0aGlzLm9uUHJvZ3Jlc3MoKTtcblxuICAgIGlmICghdGhpcy5sb2FkQ291bnQpXG4gICAge1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6ICdvbkNvbXBsZXRlJywgY29udGVudDogdGhpc30pO1xuICAgICAgICBpZih0aGlzLm9uQ29tcGxldGUpIHRoaXMub25Db21wbGV0ZSgpO1xuICAgIH1cbn07XG5cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSA9IGZ1bmN0aW9uIHJlZ2lzdGVyTG9hZGVyVHlwZSh0eXBlLCBjb25zdHJ1Y3RvcilcbntcbiAgICBsb2FkZXJzQnlUeXBlW3R5cGVdID0gY29uc3RydWN0b3I7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFzc2V0TG9hZGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXNzZXRMb2FkZXIgPSByZXF1aXJlKCcuL0Fzc2V0TG9hZGVyJyk7XG52YXIgSW1hZ2VMb2FkZXIgPSByZXF1aXJlKCcuL0ltYWdlTG9hZGVyJyk7XG52YXIgUmVjdGFuZ2xlID0gcmVxdWlyZSgnLi4vZ2VvbS9SZWN0YW5nbGUnKTtcbnZhciBFdmVudFRhcmdldCA9IHJlcXVpcmUoJy4uL2V2ZW50cy9FdmVudFRhcmdldCcpO1xudmFyIEJpdG1hcFRleHQgPSByZXF1aXJlKCcuLi90ZXh0L0JpdG1hcFRleHQnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vcGxhdGZvcm0nKTtcblxuLyoqXG4gKiBUaGUgeG1sIGxvYWRlciBpcyB1c2VkIHRvIGxvYWQgaW4gWE1MIGJpdG1hcCBmb250IGRhdGEgKCd4bWwnIG9yICdmbnQnKVxuICogVG8gZ2VuZXJhdGUgdGhlIGRhdGEgeW91IGNhbiB1c2UgaHR0cDovL3d3dy5hbmdlbGNvZGUuY29tL3Byb2R1Y3RzL2JtZm9udC9cbiAqIFRoaXMgbG9hZGVyIHdpbGwgYWxzbyBsb2FkIHRoZSBpbWFnZSBmaWxlIGFzIHRoZSBkYXRhLlxuICogV2hlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgJ2xvYWRlZCcgZXZlbnRcbiAqXG4gKiBAY2xhc3MgQml0bWFwRm9udExvYWRlclxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHVybCB7U3RyaW5nfSBUaGUgdXJsIG9mIHRoZSBzcHJpdGUgc2hlZXQgSlNPTiBmaWxlXG4gKiBAcGFyYW0gY3Jvc3NvcmlnaW4ge0Jvb2xlYW59IFdoZXRoZXIgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3NvcmlnaW5cbiAqL1xuZnVuY3Rpb24gQml0bWFwRm9udExvYWRlcih1cmwsIGNyb3Nzb3JpZ2luKVxue1xuICAgIC8qXG4gICAgICogaSB1c2UgdGV4dHVyZSBwYWNrZXIgdG8gbG9hZCB0aGUgYXNzZXRzLi5cbiAgICAgKiBodHRwOi8vd3d3LmNvZGVhbmR3ZWIuY29tL3RleHR1cmVwYWNrZXJcbiAgICAgKiBtYWtlIHN1cmUgdG8gc2V0IHRoZSBmb3JtYXQgYXMgJ0pTT04nXG4gICAgICovXG4gICAgRXZlbnRUYXJnZXQuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB1cmwgb2YgdGhlIGJpdG1hcCBmb250IGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB1cmxcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICB0aGlzLnVybCA9IHVybDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3NzIG9yaWdpblxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGNyb3Nzb3JpZ2luXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMuY3Jvc3NvcmlnaW4gPSBjcm9zc29yaWdpbjtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBiYXNlIHVybCBvZiB0aGUgYml0bWFwIGZvbnQgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGJhc2VVcmxcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLmJhc2VVcmwgPSB1cmwucmVwbGFjZSgvW15cXC9dKiQvLCAnJyk7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgdGV4dHVyZSBvZiB0aGUgYml0bWFwIGZvbnRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBiYXNlVXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy50ZXh0dXJlID0gbnVsbDtcbn1cblxudmFyIHByb3RvID0gQml0bWFwRm9udExvYWRlci5wcm90b3R5cGU7XG5cbnByb3RvLmhhbmRsZUV2ZW50ID0gZnVuY3Rpb24gaGFuZGxlRXZlbnQoZXZlbnQpIHtcbiAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcbiAgICBjYXNlICdsb2FkJzpcbiAgICAgICAgdGhpcy5vblhNTExvYWRlZCgpO1xuICAgICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLm9uRXJyb3IoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxuLyoqXG4gKiBMb2FkcyB0aGUgWE1MIGZvbnQgZGF0YVxuICpcbiAqIEBtZXRob2QgbG9hZFxuICovXG5wcm90by5sb2FkID0gZnVuY3Rpb24gbG9hZCgpXG57XG4gICAgdGhpcy5yZXF1ZXN0ID0gcGxhdGZvcm0uY3JlYXRlUmVxdWVzdCgpO1xuICAgIHRoaXMucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcyk7XG4gICAgdGhpcy5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcyk7XG5cbiAgICB0aGlzLnJlcXVlc3Qub3BlbignR0VUJywgdGhpcy51cmwsIHRydWUpO1xuICAgIGlmICh0aGlzLnJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSkgdGhpcy5yZXF1ZXN0Lm92ZXJyaWRlTWltZVR5cGUoJ2FwcGxpY2F0aW9uL3htbCcpO1xuICAgIHRoaXMucmVxdWVzdC5zZW5kKG51bGwpO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gWE1MIGZpbGUgaXMgbG9hZGVkLCBwYXJzZXMgdGhlIGRhdGFcbiAqXG4gKiBAbWV0aG9kIG9uWE1MTG9hZGVkXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vblhNTExvYWRlZCA9IGZ1bmN0aW9uIG9uWE1MTG9hZGVkKClcbntcbiAgICB2YXIgdGV4dHVyZVVybCA9IHRoaXMuYmFzZVVybCArIHRoaXMucmVxdWVzdC5yZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZSgncGFnZScpWzBdLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCdmaWxlJykubm9kZVZhbHVlO1xuICAgIHZhciBpbWFnZSA9IG5ldyBJbWFnZUxvYWRlcih0ZXh0dXJlVXJsLCB0aGlzLmNyb3Nzb3JpZ2luKTtcbiAgICB0aGlzLnRleHR1cmUgPSBpbWFnZS50ZXh0dXJlLmJhc2VUZXh0dXJlO1xuXG4gICAgdmFyIGRhdGEgPSB7fTtcbiAgICB2YXIgaW5mbyA9IHRoaXMucmVxdWVzdC5yZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaW5mbycpWzBdO1xuICAgIHZhciBjb21tb24gPSB0aGlzLnJlcXVlc3QucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2NvbW1vbicpWzBdO1xuICAgIGRhdGEuZm9udCA9IGluZm8uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ2ZhY2UnKS5ub2RlVmFsdWU7XG4gICAgZGF0YS5zaXplID0gcGFyc2VJbnQoaW5mby5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgnc2l6ZScpLm5vZGVWYWx1ZSwgMTApO1xuICAgIGRhdGEubGluZUhlaWdodCA9IHBhcnNlSW50KGNvbW1vbi5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgnbGluZUhlaWdodCcpLm5vZGVWYWx1ZSwgMTApO1xuICAgIGRhdGEuY2hhcnMgPSB7fTtcblxuICAgIC8vcGFyc2UgbGV0dGVyc1xuICAgIHZhciBsZXR0ZXJzID0gdGhpcy5yZXF1ZXN0LnJlc3BvbnNlWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdjaGFyJyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxldHRlcnMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgY2hhckNvZGUgPSBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCdpZCcpLm5vZGVWYWx1ZSwgMTApO1xuXG4gICAgICAgIHZhciB0ZXh0dXJlUmVjdCA9IG5ldyBSZWN0YW5nbGUoXG4gICAgICAgICAgICBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCd4Jykubm9kZVZhbHVlLCAxMCksXG4gICAgICAgICAgICBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCd5Jykubm9kZVZhbHVlLCAxMCksXG4gICAgICAgICAgICBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCd3aWR0aCcpLm5vZGVWYWx1ZSwgMTApLFxuICAgICAgICAgICAgcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgnaGVpZ2h0Jykubm9kZVZhbHVlLCAxMClcbiAgICAgICAgKTtcblxuICAgICAgICBkYXRhLmNoYXJzW2NoYXJDb2RlXSA9IHtcbiAgICAgICAgICAgIHhPZmZzZXQ6IHBhcnNlSW50KGxldHRlcnNbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ3hvZmZzZXQnKS5ub2RlVmFsdWUsIDEwKSxcbiAgICAgICAgICAgIHlPZmZzZXQ6IHBhcnNlSW50KGxldHRlcnNbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ3lvZmZzZXQnKS5ub2RlVmFsdWUsIDEwKSxcbiAgICAgICAgICAgIHhBZHZhbmNlOiBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCd4YWR2YW5jZScpLm5vZGVWYWx1ZSwgMTApLFxuICAgICAgICAgICAga2VybmluZzoge30sXG4gICAgICAgICAgICB0ZXh0dXJlOiBUZXh0dXJlLmNhY2hlW2NoYXJDb2RlXSA9IG5ldyBUZXh0dXJlKHRoaXMudGV4dHVyZSwgdGV4dHVyZVJlY3QpXG5cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvL3BhcnNlIGtlcm5pbmdzXG4gICAgdmFyIGtlcm5pbmdzID0gdGhpcy5yZXF1ZXN0LnJlc3BvbnNlWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdrZXJuaW5nJyk7XG4gICAgZm9yIChpID0gMDsgaSA8IGtlcm5pbmdzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGZpcnN0ID0gcGFyc2VJbnQoa2VybmluZ3NbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ2ZpcnN0Jykubm9kZVZhbHVlLCAxMCk7XG4gICAgICAgIHZhciBzZWNvbmQgPSBwYXJzZUludChrZXJuaW5nc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgnc2Vjb25kJykubm9kZVZhbHVlLCAxMCk7XG4gICAgICAgIHZhciBhbW91bnQgPSBwYXJzZUludChrZXJuaW5nc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgnYW1vdW50Jykubm9kZVZhbHVlLCAxMCk7XG5cbiAgICAgICAgZGF0YS5jaGFyc1tzZWNvbmRdLmtlcm5pbmdbZmlyc3RdID0gYW1vdW50O1xuXG4gICAgfVxuXG4gICAgQml0bWFwVGV4dC5mb250c1tkYXRhLmZvbnRdID0gZGF0YTtcblxuICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgaW1hZ2UuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHNjb3BlLm9uTG9hZGVkKCk7XG4gICAgfSk7XG4gICAgaW1hZ2UubG9hZCgpO1xufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gYWxsIGZpbGVzIGFyZSBsb2FkZWQgKHhtbC9mbnQgYW5kIHRleHR1cmUpXG4gKlxuICogQG1ldGhvZCBvbkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Mb2FkZWQgPSBmdW5jdGlvbiBvbkxvYWRlZCgpXG57XG4gICAgdGhpcy5sb2FkZWQgPSB0cnVlO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogJ2xvYWRlZCcsIGNvbnRlbnQ6IHRoaXN9KTtcbn07XG5cbi8qKlxuICogSW52b2tlIHdoZW4gZXJyb3Igb2NjdXJlZFxuICpcbiAqIEBtZXRob2Qgb25FcnJvclxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25FcnJvciA9IGZ1bmN0aW9uIG9uRXJyb3IoKVxue1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogJ2Vycm9yJywgY29udGVudDogdGhpc30pO1xufTtcblxuQXNzZXRMb2FkZXIucmVnaXN0ZXJMb2FkZXJUeXBlKCd4bWwnLCBCaXRtYXBGb250TG9hZGVyKTtcbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgnZm50JywgQml0bWFwRm9udExvYWRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gQml0bWFwRm9udExvYWRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFzc2V0TG9hZGVyID0gcmVxdWlyZSgnLi9Bc3NldExvYWRlcicpO1xudmFyIEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uL3RleHR1cmVzL1RleHR1cmUnKTtcblxuLyoqXG4gKiBUaGUgaW1hZ2UgbG9hZGVyIGNsYXNzIGlzIHJlc3BvbnNpYmxlIGZvciBsb2FkaW5nIGltYWdlcyBmaWxlIGZvcm1hdHMgKFwianBlZ1wiLCBcImpwZ1wiLCBcInBuZ1wiIGFuZCBcImdpZlwiKVxuICogT25jZSB0aGUgaW1hZ2UgaGFzIGJlZW4gbG9hZGVkIGl0IGlzIHN0b3JlZCBpbiB0aGUgdGV4dHVyZSBjYWNoZSBhbmQgY2FuIGJlIGFjY2Vzc2VkIHRob3VnaCBUZXh0dXJlLmZyb21GcmFtZUlkKCkgYW5kIFNwcml0ZS5mcm9tRnJvbWVJZCgpXG4gKiBXaGVuIGxvYWRlZCB0aGlzIGNsYXNzIHdpbGwgZGlzcGF0Y2ggYSAnbG9hZGVkJyBldmVudFxuICpcbiAqIEBjbGFzcyBJbWFnZUxvYWRlclxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHVybCB7U3RyaW5nfSBUaGUgdXJsIG9mIHRoZSBpbWFnZVxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKi9cbmZ1bmN0aW9uIEltYWdlTG9hZGVyKHVybCwgY3Jvc3NvcmlnaW4pXG57XG4gICAgRXZlbnRUYXJnZXQuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0ZXh0dXJlIGJlaW5nIGxvYWRlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRleHR1cmVcbiAgICAgKiBAdHlwZSBUZXh0dXJlXG4gICAgICovXG4gICAgdGhpcy50ZXh0dXJlID0gVGV4dHVyZS5mcm9tSW1hZ2UodXJsLCBjcm9zc29yaWdpbik7XG5cbiAgICAvKipcbiAgICAgKiBpZiB0aGUgaW1hZ2UgaXMgbG9hZGVkIHdpdGggbG9hZEZyYW1lZFNwcml0ZVNoZWV0XG4gICAgICogZnJhbWVzIHdpbGwgY29udGFpbiB0aGUgc3ByaXRlIHNoZWV0IGZyYW1lc1xuICAgICAqXG4gICAgICovXG4gICAgdGhpcy5mcmFtZXMgPSBbXTtcbn1cblxudmFyIHByb3RvID0gSW1hZ2VMb2FkZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIExvYWRzIGltYWdlIG9yIHRha2VzIGl0IGZyb20gY2FjaGVcbiAqXG4gKiBAbWV0aG9kIGxvYWRcbiAqL1xucHJvdG8ubG9hZCA9IGZ1bmN0aW9uIGxvYWQoKVxue1xuICAgIGlmKCF0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUuaGFzTG9hZGVkKVxuICAgIHtcbiAgICAgICAgdmFyIHNjb3BlID0gdGhpcztcbiAgICAgICAgdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZCcsIGZ1bmN0aW9uKClcbiAgICAgICAge1xuICAgICAgICAgICAgc2NvcGUub25Mb2FkZWQoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMub25Mb2FkZWQoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEludm9rZWQgd2hlbiBpbWFnZSBmaWxlIGlzIGxvYWRlZCBvciBpdCBpcyBhbHJlYWR5IGNhY2hlZCBhbmQgcmVhZHkgdG8gdXNlXG4gKlxuICogQG1ldGhvZCBvbkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Mb2FkZWQgPSBmdW5jdGlvbiBvbkxvYWRlZCgpXG57XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiAnbG9hZGVkJywgY29udGVudDogdGhpc30pO1xufTtcblxuLyoqXG4gKiBMb2FkcyBpbWFnZSBhbmQgc3BsaXQgaXQgdG8gdW5pZm9ybSBzaXplZCBmcmFtZXNcbiAqXG4gKlxuICogQG1ldGhvZCBsb2FkRnJhbWVkU3ByaXRlU2hlZXRcbiAqIEBwYXJhbSBmcmFtZVdpZHRoIHtOdW1iZXJ9IHdpdGggb2YgZWFjaCBmcmFtZVxuICogQHBhcmFtIGZyYW1lSGVpZ2h0IHtOdW1iZXJ9IGhlaWdodCBvZiBlYWNoIGZyYW1lXG4gKiBAcGFyYW0gdGV4dHVyZU5hbWUge1N0cmluZ30gaWYgZ2l2ZW4sIHRoZSBmcmFtZXMgd2lsbCBiZSBjYWNoZWQgaW4gPHRleHR1cmVOYW1lPi08b3JkPiBmb3JtYXRcbiAqL1xucHJvdG8ubG9hZEZyYW1lZFNwcml0ZVNoZWV0ID0gZnVuY3Rpb24oZnJhbWVXaWR0aCwgZnJhbWVIZWlnaHQsIHRleHR1cmVOYW1lKVxue1xuICAgIHRoaXMuZnJhbWVzID0gW107XG4gICAgdmFyIGNvbHMgPSBNYXRoLmZsb29yKHRoaXMudGV4dHVyZS53aWR0aCAvIGZyYW1lV2lkdGgpO1xuICAgIHZhciByb3dzID0gTWF0aC5mbG9vcih0aGlzLnRleHR1cmUuaGVpZ2h0IC8gZnJhbWVIZWlnaHQpO1xuXG4gICAgdmFyIGk9MDtcbiAgICBmb3IgKHZhciB5PTA7IHk8cm93czsgeSsrKVxuICAgIHtcbiAgICAgICAgZm9yICh2YXIgeD0wOyB4PGNvbHM7IHgrKyxpKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciB0ZXh0dXJlID0gbmV3IFRleHR1cmUodGhpcy50ZXh0dXJlLCB7XG4gICAgICAgICAgICAgICAgeDogeCpmcmFtZVdpZHRoLFxuICAgICAgICAgICAgICAgIHk6IHkqZnJhbWVIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IGZyYW1lV2lkdGgsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBmcmFtZUhlaWdodFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZnJhbWVzLnB1c2godGV4dHVyZSk7XG4gICAgICAgICAgICBpZiAodGV4dHVyZU5hbWUpIFRleHR1cmUuY2FjaGVbdGV4dHVyZU5hbWUgKyAnLScgKyBpXSA9IHRleHR1cmU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZighdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgICAgIHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNjb3BlLm9uTG9hZGVkKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLm9uTG9hZGVkKCk7XG4gICAgfVxufTtcblxuQXNzZXRMb2FkZXIucmVnaXN0ZXJMb2FkZXJUeXBlKCdqcGcnLCBJbWFnZUxvYWRlcik7XG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUoJ2pwZWcnLCBJbWFnZUxvYWRlcik7XG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUoJ3BuZycsIEltYWdlTG9hZGVyKTtcbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgnZ2lmJywgSW1hZ2VMb2FkZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEltYWdlTG9hZGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXNzZXRMb2FkZXIgPSByZXF1aXJlKCcuL0Fzc2V0TG9hZGVyJyk7XG52YXIgSW1hZ2VMb2FkZXIgPSByZXF1aXJlKCcuL0ltYWdlTG9hZGVyJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xudmFyIFNwaW5lID0gcmVxdWlyZSgnLi4vZXh0cmFzL1NwaW5lJyk7XG52YXIgU2tlbGV0b25Kc29uID0gcmVxdWlyZSgnLi4vdXRpbHMvc3BpbmUnKS5Ta2VsZXRvbkpzb247XG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xuXG4vKipcbiAqIFRoZSBqc29uIGZpbGUgbG9hZGVyIGlzIHVzZWQgdG8gbG9hZCBpbiBKU09OIGRhdGEgYW5kIHBhcnNpbmcgaXRcbiAqIFdoZW4gbG9hZGVkIHRoaXMgY2xhc3Mgd2lsbCBkaXNwYXRjaCBhICdsb2FkZWQnIGV2ZW50XG4gKiBJZiBsb2FkIGZhaWxlZCB0aGlzIGNsYXNzIHdpbGwgZGlzcGF0Y2ggYSAnZXJyb3InIGV2ZW50XG4gKlxuICogQGNsYXNzIEpzb25Mb2FkZXJcbiAqIEB1c2VzIEV2ZW50VGFyZ2V0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB1cmwge1N0cmluZ30gVGhlIHVybCBvZiB0aGUgSlNPTiBmaWxlXG4gKiBAcGFyYW0gY3Jvc3NvcmlnaW4ge0Jvb2xlYW59IFdoZXRoZXIgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3NvcmlnaW5cbiAqL1xuZnVuY3Rpb24gSnNvbkxvYWRlcih1cmwsIGNyb3Nzb3JpZ2luKSB7XG4gICAgRXZlbnRUYXJnZXQuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB1cmwgb2YgdGhlIGJpdG1hcCBmb250IGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB1cmxcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICB0aGlzLnVybCA9IHVybDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3NzIG9yaWdpblxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGNyb3Nzb3JpZ2luXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMuY3Jvc3NvcmlnaW4gPSBjcm9zc29yaWdpbjtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBiYXNlIHVybCBvZiB0aGUgYml0bWFwIGZvbnQgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGJhc2VVcmxcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLmJhc2VVcmwgPSB1cmwucmVwbGFjZSgvW15cXC9dKiQvLCAnJyk7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBXaGV0aGVyIHRoZSBkYXRhIGhhcyBsb2FkZWQgeWV0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbG9hZGVkXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IEpzb25Mb2FkZXIucHJvdG90eXBlO1xuXG5wcm90by5oYW5kbGVFdmVudCA9IGZ1bmN0aW9uIGhhbmRsZUV2ZW50KGV2ZW50KVxue1xuICAgIHN3aXRjaCAoZXZlbnQudHlwZSkge1xuICAgIGNhc2UgJ2xvYWQnOlxuICAgICAgICB0aGlzLm9uSlNPTkxvYWRlZCgpO1xuICAgICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLm9uRXJyb3IoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxuLyoqXG4gKiBMb2FkcyB0aGUgSlNPTiBkYXRhXG4gKlxuICogQG1ldGhvZCBsb2FkXG4gKi9cbnByb3RvLmxvYWQgPSBmdW5jdGlvbiBsb2FkKClcbntcbiAgICB0aGlzLnJlcXVlc3QgPSBwbGF0Zm9ybS5jcmVhdGVSZXF1ZXN0KCk7XG4gICAgdGhpcy5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB0aGlzKTtcbiAgICB0aGlzLnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzKTtcblxuICAgIHRoaXMucmVxdWVzdC5vcGVuKCdHRVQnLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgaWYgKHRoaXMucmVxdWVzdC5vdmVycmlkZU1pbWVUeXBlKSB0aGlzLnJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSgnYXBwbGljYXRpb24vanNvbicpO1xuICAgIHRoaXMucmVxdWVzdC5zZW5kKG51bGwpO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBKU09OIGZpbGUgaXMgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBvbkpTT05Mb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uSlNPTkxvYWRlZCA9IGZ1bmN0aW9uIG9uSlNPTkxvYWRlZCgpXG57XG4gICAgdGhpcy5qc29uID0gSlNPTi5wYXJzZSh0aGlzLnJlcXVlc3QucmVzcG9uc2VUZXh0KTtcblxuICAgIGlmKHRoaXMuanNvbi5mcmFtZXMpXG4gICAge1xuICAgICAgICAvLyBzcHJpdGUgc2hlZXRcbiAgICAgICAgdmFyIHNjb3BlID0gdGhpcztcbiAgICAgICAgdmFyIHRleHR1cmVVcmwgPSB0aGlzLmJhc2VVcmwgKyB0aGlzLmpzb24ubWV0YS5pbWFnZTtcbiAgICAgICAgdmFyIGltYWdlID0gbmV3IEltYWdlTG9hZGVyKHRleHR1cmVVcmwsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuICAgICAgICB2YXIgZnJhbWVEYXRhID0gdGhpcy5qc29uLmZyYW1lcztcblxuICAgICAgICB0aGlzLnRleHR1cmUgPSBpbWFnZS50ZXh0dXJlLmJhc2VUZXh0dXJlO1xuICAgICAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNjb3BlLm9uTG9hZGVkKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAodmFyIGkgaW4gZnJhbWVEYXRhKSB7XG4gICAgICAgICAgICB2YXIgcmVjdCA9IGZyYW1lRGF0YVtpXS5mcmFtZTtcbiAgICAgICAgICAgIGlmIChyZWN0KSB7XG4gICAgICAgICAgICAgICAgVGV4dHVyZS5jYWNoZVtpXSA9IG5ldyBUZXh0dXJlKHRoaXMudGV4dHVyZSwge1xuICAgICAgICAgICAgICAgICAgICB4OiByZWN0LngsXG4gICAgICAgICAgICAgICAgICAgIHk6IHJlY3QueSxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IHJlY3QudyxcbiAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiByZWN0LmhcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWVEYXRhW2ldLnRyaW1tZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy92YXIgcmVhbFNpemUgPSBmcmFtZURhdGFbaV0uc3ByaXRlU291cmNlU2l6ZTtcbiAgICAgICAgICAgICAgICAgICAgVGV4dHVyZS5jYWNoZVtpXS5yZWFsU2l6ZSA9IGZyYW1lRGF0YVtpXS5zcHJpdGVTb3VyY2VTaXplO1xuICAgICAgICAgICAgICAgICAgICBUZXh0dXJlLmNhY2hlW2ldLnRyaW0ueCA9IDA7IC8vIChyZWFsU2l6ZS54IC8gcmVjdC53KVxuICAgICAgICAgICAgICAgICAgICAvLyBjYWxjdWxhdGUgdGhlIG9mZnNldCFcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpbWFnZS5sb2FkKCk7XG5cbiAgICB9XG4gICAgZWxzZSBpZih0aGlzLmpzb24uYm9uZXMpXG4gICAge1xuICAgICAgICAvLyBzcGluZSBhbmltYXRpb25cbiAgICAgICAgdmFyIHNwaW5lSnNvblBhcnNlciA9IG5ldyBTa2VsZXRvbkpzb24oKTtcbiAgICAgICAgdmFyIHNrZWxldG9uRGF0YSA9IHNwaW5lSnNvblBhcnNlci5yZWFkU2tlbGV0b25EYXRhKHRoaXMuanNvbik7XG4gICAgICAgIFNwaW5lLmFuaW1DYWNoZVt0aGlzLnVybF0gPSBza2VsZXRvbkRhdGE7XG4gICAgICAgIHRoaXMub25Mb2FkZWQoKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5vbkxvYWRlZCgpO1xuICAgIH1cbn07XG5cbi8qKlxuICogSW52b2tlIHdoZW4ganNvbiBmaWxlIGxvYWRlZFxuICpcbiAqIEBtZXRob2Qgb25Mb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uTG9hZGVkID0gZnVuY3Rpb24gb25Mb2FkZWQoKVxue1xuICAgIHRoaXMubG9hZGVkID0gdHJ1ZTtcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6ICdsb2FkZWQnLCBjb250ZW50OiB0aGlzfSk7XG59O1xuXG4vKipcbiAqIEludm9rZSB3aGVuIGVycm9yIG9jY3VyZWRcbiAqXG4gKiBAbWV0aG9kIG9uRXJyb3JcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uRXJyb3IgPSBmdW5jdGlvbiBvbkVycm9yKClcbntcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6ICdlcnJvcicsIGNvbnRlbnQ6IHRoaXN9KTtcbn07XG5cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgnanNvbicsIEpzb25Mb2FkZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEpzb25Mb2FkZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICogYmFzZWQgb24gcGl4aSBpbXBhY3Qgc3BpbmUgaW1wbGVtZW50YXRpb24gbWFkZSBieSBFZW1lbGkgS2Vsb2tvcnBpIChAZWtlbG9rb3JwaSkgaHR0cHM6Ly9naXRodWIuY29tL2VrZWxva29ycGlcbiAqXG4gKiBBd2Vzb21lIEpTIHJ1biB0aW1lIHByb3ZpZGVkIGJ5IEVzb3RlcmljU29mdHdhcmVcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc290ZXJpY1NvZnR3YXJlL3NwaW5lLXJ1bnRpbWVzXG4gKlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBc3NldExvYWRlciA9IHJlcXVpcmUoJy4vQXNzZXRMb2FkZXInKTtcbnZhciBKc29uTG9hZGVyID0gcmVxdWlyZSgnLi9Kc29uTG9hZGVyJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBTcGluZSA9IHJlcXVpcmUoJy4uL2V4dHJhcy9TcGluZScpO1xudmFyIFNrZWxldG9uSnNvbiA9IHJlcXVpcmUoJy4uL3V0aWxzL3NwaW5lJykuU2tlbGV0b25Kc29uO1xuXG4vKipcbiAqIFRoZSBTcGluZSBsb2FkZXIgaXMgdXNlZCB0byBsb2FkIGluIEpTT04gc3BpbmUgZGF0YVxuICogVG8gZ2VuZXJhdGUgdGhlIGRhdGEgeW91IG5lZWQgdG8gdXNlIGh0dHA6Ly9lc290ZXJpY3NvZnR3YXJlLmNvbS8gYW5kIGV4cG9ydCB0aGUgXCJKU09OXCIgZm9ybWF0XG4gKiBEdWUgdG8gYSBjbGFzaCBvZiBuYW1lcyAgWW91IHdpbGwgbmVlZCB0byBjaGFuZ2UgdGhlIGV4dGVuc2lvbiBvZiB0aGUgc3BpbmUgZmlsZSBmcm9tICouanNvbiB0byAqLmFuaW0gZm9yIGl0IHRvIGxvYWRcbiAqIFNlZSBleGFtcGxlIDEyIChodHRwOi8vd3d3Lmdvb2Rib3lkaWdpdGFsLmNvbS9waXhpanMvZXhhbXBsZXMvMTIvKSB0byBzZWUgYSB3b3JraW5nIGV4YW1wbGUgYW5kIGNoZWNrIG91dCB0aGUgc291cmNlXG4gKiBZb3Ugd2lsbCBuZWVkIHRvIGdlbmVyYXRlIGEgc3ByaXRlIHNoZWV0IHRvIGFjY29tcGFueSB0aGUgc3BpbmUgZGF0YVxuICogV2hlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgXCJsb2FkZWRcIiBldmVudFxuICpcbiAqIEBjbGFzcyBTcGluZVxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHVybCB7U3RyaW5nfSBUaGUgdXJsIG9mIHRoZSBKU09OIGZpbGVcbiAqIEBwYXJhbSBjcm9zc29yaWdpbiB7Qm9vbGVhbn0gV2hldGhlciByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zc29yaWdpblxuICovXG5mdW5jdGlvbiBTcGluZUxvYWRlcih1cmwsIGNyb3Nzb3JpZ2luKVxue1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdXJsIG9mIHRoZSBiaXRtYXAgZm9udCBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zcyBvcmlnaW5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjcm9zc29yaWdpblxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLmNyb3Nzb3JpZ2luID0gY3Jvc3NvcmlnaW47XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBXaGV0aGVyIHRoZSBkYXRhIGhhcyBsb2FkZWQgeWV0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbG9hZGVkXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IFNwaW5lTG9hZGVyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBMb2FkcyB0aGUgSlNPTiBkYXRhXG4gKlxuICogQG1ldGhvZCBsb2FkXG4gKi9cbnByb3RvLmxvYWQgPSBmdW5jdGlvbiBsb2FkKClcbntcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHZhciBqc29uTG9hZGVyID0gbmV3IEpzb25Mb2FkZXIodGhpcy51cmwsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuICAgIGpzb25Mb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHNjb3BlLmpzb24gPSBldmVudC5jb250ZW50Lmpzb247XG4gICAgICAgIHNjb3BlLm9uSlNPTkxvYWRlZCgpO1xuICAgIH0pO1xuICAgIGpzb25Mb2FkZXIubG9hZCgpO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBKU09OIGZpbGUgaXMgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBvbkpTT05Mb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uSlNPTkxvYWRlZCA9IGZ1bmN0aW9uIG9uSlNPTkxvYWRlZCgpXG57XG4gICAgdmFyIHNwaW5lSnNvblBhcnNlciA9IG5ldyBTa2VsZXRvbkpzb24oKTtcbiAgICB2YXIgc2tlbGV0b25EYXRhID0gc3BpbmVKc29uUGFyc2VyLnJlYWRTa2VsZXRvbkRhdGEodGhpcy5qc29uKTtcblxuICAgIFNwaW5lLmFuaW1DYWNoZVt0aGlzLnVybF0gPSBza2VsZXRvbkRhdGE7XG5cbiAgICB0aGlzLm9uTG9hZGVkKCk7XG59O1xuXG4vKipcbiAqIEludm9rZSB3aGVuIEpTT04gZmlsZSBpcyBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIG9uTG9hZGVkXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkxvYWRlZCA9IGZ1bmN0aW9uIG9uTG9hZGVkKClcbntcbiAgICB0aGlzLmxvYWRlZCA9IHRydWU7XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiAnbG9hZGVkJywgY29udGVudDogdGhpc30pO1xufTtcblxuQXNzZXRMb2FkZXIucmVnaXN0ZXJMb2FkZXJUeXBlKCdhbmltJywgU3BpbmVMb2FkZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNwaW5lTG9hZGVyO1xuXG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBKc29uTG9hZGVyID0gcmVxdWlyZSgnLi9Kc29uTG9hZGVyJyk7XG52YXIgSW1hZ2VMb2FkZXIgPSByZXF1aXJlKCcuL0ltYWdlTG9hZGVyJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xuXG4vKipcbiAqIFRoZSBzcHJpdGUgc2hlZXQgbG9hZGVyIGlzIHVzZWQgdG8gbG9hZCBpbiBKU09OIHNwcml0ZSBzaGVldCBkYXRhXG4gKiBUbyBnZW5lcmF0ZSB0aGUgZGF0YSB5b3UgY2FuIHVzZSBodHRwOi8vd3d3LmNvZGVhbmR3ZWIuY29tL3RleHR1cmVwYWNrZXIgYW5kIHB1Ymxpc2ggdGhlICdKU09OJyBmb3JtYXRcbiAqIFRoZXJlIGlzIGEgZnJlZSB2ZXJzaW9uIHNvIHRoYXRzIG5pY2UsIGFsdGhvdWdoIHRoZSBwYWlkIHZlcnNpb24gaXMgZ3JlYXQgdmFsdWUgZm9yIG1vbmV5LlxuICogSXQgaXMgaGlnaGx5IHJlY29tbWVuZGVkIHRvIHVzZSBTcHJpdGUgc2hlZXRzIChhbHNvIGtub3cgYXMgdGV4dHVyZSBhdGxhcycpIGFzIGl0IG1lYW5zIHNwcml0ZSdzIGNhbiBiZSBiYXRjaGVkIGFuZCBkcmF3biB0b2dldGhlciBmb3IgaGlnaGx5IGluY3JlYXNlZCByZW5kZXJpbmcgc3BlZWQuXG4gKiBPbmNlIHRoZSBkYXRhIGhhcyBiZWVuIGxvYWRlZCB0aGUgZnJhbWVzIGFyZSBzdG9yZWQgaW4gdGhlIHRleHR1cmUgY2FjaGUgYW5kIGNhbiBiZSBhY2Nlc3NlZCB0aG91Z2ggVGV4dHVyZS5mcm9tRnJhbWVJZCgpIGFuZCBTcHJpdGUuZnJvbUZyb21lSWQoKVxuICogVGhpcyBsb2FkZXIgd2lsbCBhbHNvIGxvYWQgdGhlIGltYWdlIGZpbGUgdGhhdCB0aGUgU3ByaXRlc2hlZXQgcG9pbnRzIHRvIGFzIHdlbGwgYXMgdGhlIGRhdGEuXG4gKiBXaGVuIGxvYWRlZCB0aGlzIGNsYXNzIHdpbGwgZGlzcGF0Y2ggYSAnbG9hZGVkJyBldmVudFxuICpcbiAqIEBjbGFzcyBTcHJpdGVTaGVldExvYWRlclxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHVybCB7U3RyaW5nfSBUaGUgdXJsIG9mIHRoZSBzcHJpdGUgc2hlZXQgSlNPTiBmaWxlXG4gKiBAcGFyYW0gY3Jvc3NvcmlnaW4ge0Jvb2xlYW59IFdoZXRoZXIgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3NvcmlnaW5cbiAqL1xuZnVuY3Rpb24gU3ByaXRlU2hlZXRMb2FkZXIodXJsLCBjcm9zc29yaWdpbikge1xuICAgIC8qXG4gICAgICogaSB1c2UgdGV4dHVyZSBwYWNrZXIgdG8gbG9hZCB0aGUgYXNzZXRzLi5cbiAgICAgKiBodHRwOi8vd3d3LmNvZGVhbmR3ZWIuY29tL3RleHR1cmVwYWNrZXJcbiAgICAgKiBtYWtlIHN1cmUgdG8gc2V0IHRoZSBmb3JtYXQgYXMgJ0pTT04nXG4gICAgICovXG4gICAgRXZlbnRUYXJnZXQuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB1cmwgb2YgdGhlIGJpdG1hcCBmb250IGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB1cmxcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICB0aGlzLnVybCA9IHVybDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3NzIG9yaWdpblxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGNyb3Nzb3JpZ2luXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMuY3Jvc3NvcmlnaW4gPSBjcm9zc29yaWdpbjtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBiYXNlIHVybCBvZiB0aGUgYml0bWFwIGZvbnQgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGJhc2VVcmxcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLmJhc2VVcmwgPSB1cmwucmVwbGFjZSgvW15cXC9dKiQvLCAnJyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGV4dHVyZSBiZWluZyBsb2FkZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0ZXh0dXJlXG4gICAgICogQHR5cGUgVGV4dHVyZVxuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnJhbWVzIG9mIHRoZSBzcHJpdGUgc2hlZXRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBmcmFtZXNcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKi9cbiAgICB0aGlzLmZyYW1lcyA9IHt9O1xufVxuXG52YXIgcHJvdG8gPSBTcHJpdGVTaGVldExvYWRlci5wcm90b3R5cGU7XG5cbi8qKlxuICogVGhpcyB3aWxsIGJlZ2luIGxvYWRpbmcgdGhlIEpTT04gZmlsZVxuICpcbiAqIEBtZXRob2QgbG9hZFxuICovXG5wcm90by5sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgdmFyIGpzb25Mb2FkZXIgPSBuZXcgSnNvbkxvYWRlcih0aGlzLnVybCwgdGhpcy5jcm9zc29yaWdpbik7XG4gICAganNvbkxvYWRlci5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWQnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgc2NvcGUuanNvbiA9IGV2ZW50LmNvbnRlbnQuanNvbjtcbiAgICAgICAgc2NvcGUub25KU09OTG9hZGVkKCk7XG4gICAgfSk7XG4gICAganNvbkxvYWRlci5sb2FkKCk7XG59O1xuXG4vKipcbiAqIEludm9rZSB3aGVuIEpTT04gZmlsZSBpcyBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIG9uSlNPTkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25KU09OTG9hZGVkID0gZnVuY3Rpb24gb25KU09OTG9hZGVkKClcbntcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHZhciB0ZXh0dXJlVXJsID0gdGhpcy5iYXNlVXJsICsgdGhpcy5qc29uLm1ldGEuaW1hZ2U7XG4gICAgdmFyIGltYWdlID0gbmV3IEltYWdlTG9hZGVyKHRleHR1cmVVcmwsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuICAgIHZhciBmcmFtZURhdGEgPSB0aGlzLmpzb24uZnJhbWVzO1xuXG4gICAgdGhpcy50ZXh0dXJlID0gaW1hZ2UudGV4dHVyZS5iYXNlVGV4dHVyZTtcbiAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNjb3BlLm9uTG9hZGVkKCk7XG4gICAgfSk7XG5cbiAgICBmb3IgKHZhciBpIGluIGZyYW1lRGF0YSkge1xuICAgICAgICB2YXIgcmVjdCA9IGZyYW1lRGF0YVtpXS5mcmFtZTtcbiAgICAgICAgaWYgKHJlY3QpIHtcbiAgICAgICAgICAgIFRleHR1cmUuY2FjaGVbaV0gPSBuZXcgVGV4dHVyZSh0aGlzLnRleHR1cmUsIHtcbiAgICAgICAgICAgICAgICB4OiByZWN0LngsXG4gICAgICAgICAgICAgICAgeTogcmVjdC55LFxuICAgICAgICAgICAgICAgIHdpZHRoOiByZWN0LncsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiByZWN0LmhcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGZyYW1lRGF0YVtpXS50cmltbWVkKSB7XG4gICAgICAgICAgICAgICAgLy92YXIgcmVhbFNpemUgPSBmcmFtZURhdGFbaV0uc3ByaXRlU291cmNlU2l6ZTtcbiAgICAgICAgICAgICAgICBUZXh0dXJlLmNhY2hlW2ldLnJlYWxTaXplID0gZnJhbWVEYXRhW2ldLnNwcml0ZVNvdXJjZVNpemU7XG4gICAgICAgICAgICAgICAgVGV4dHVyZS5jYWNoZVtpXS50cmltLnggPSAwOyAvLyAocmVhbFNpemUueCAvIHJlY3QudylcbiAgICAgICAgICAgICAgICAvLyBjYWxjdWxhdGUgdGhlIG9mZnNldCFcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGltYWdlLmxvYWQoKTtcbn07XG5cbi8qKlxuICogSW52b2tlIHdoZW4gYWxsIGZpbGVzIGFyZSBsb2FkZWQgKGpzb24gYW5kIHRleHR1cmUpXG4gKlxuICogQG1ldGhvZCBvbkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Mb2FkZWQgPSBmdW5jdGlvbiBvbkxvYWRlZCgpXG57XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHtcbiAgICAgICAgdHlwZTogJ2xvYWRlZCcsXG4gICAgICAgIGNvbnRlbnQ6IHRoaXNcbiAgICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3ByaXRlU2hlZXRMb2FkZXI7XG4iLCJ2YXIgZ2xvYmFsPXR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fTsvKipcbiAqIEBhdXRob3IgRHIuIEtpYml0eiA8aW5mb0BkcmtpYml0ei5jb20+XG4gKi9cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgY29uc29sZTogICBnbG9iYWwuY29uc29sZSxcbiAgICBkb2N1bWVudDogIGdsb2JhbC5kb2N1bWVudCxcbiAgICBsb2NhdGlvbjogIGdsb2JhbC5sb2NhdGlvbixcbiAgICBuYXZpZ2F0b3I6IGdsb2JhbC5uYXZpZ2F0b3IsXG4gICAgd2luZG93OiAgICBnbG9iYWwud2luZG93LFxuXG4gICAgY3JlYXRlQ2FudmFzOiBmdW5jdGlvbiBjcmVhdGVDYW52YXMoKSB7XG4gICAgICAgIHJldHVybiBnbG9iYWwuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgfSxcblxuICAgIGNyZWF0ZUltYWdlOiBmdW5jdGlvbiBjcmVhdGVJbWFnZSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBnbG9iYWwuSW1hZ2UoKTtcbiAgICB9LFxuXG4gICAgY3JlYXRlUmVxdWVzdDogZnVuY3Rpb24gY3JlYXRlUmVxdWVzdCgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBnbG9iYWwuWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB9XG59O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGlzcGxheU9iamVjdENvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2Rpc3BsYXkvRGlzcGxheU9iamVjdENvbnRhaW5lcicpO1xudmFyIFJlY3RhbmdsZSA9IHJlcXVpcmUoJy4uL2dlb20vUmVjdGFuZ2xlJyk7XG5cbi8qKlxuICogVGhlIEdyYXBoaWNzIGNsYXNzIGNvbnRhaW5zIGEgc2V0IG9mIG1ldGhvZHMgdGhhdCB5b3UgY2FuIHVzZSB0byBjcmVhdGUgcHJpbWl0aXZlIHNoYXBlcyBhbmQgbGluZXMuXG4gKiBJdCBpcyBpbXBvcnRhbnQgdG8ga25vdyB0aGF0IHdpdGggdGhlIHdlYkdMIHJlbmRlcmVyIG9ubHkgc2ltcGxlIHBvbHlzIGNhbiBiZSBmaWxsZWQgYXQgdGhpcyBzdGFnZVxuICogQ29tcGxleCBwb2x5cyB3aWxsIG5vdCBiZSBmaWxsZWQuIEhlcmVzIGFuIGV4YW1wbGUgb2YgYSBjb21wbGV4IHBvbHk6IGh0dHA6Ly93d3cuZ29vZGJveWRpZ2l0YWwuY29tL3dwLWNvbnRlbnQvdXBsb2Fkcy8yMDEzLzA2L2NvbXBsZXhQb2x5Z29uLnBuZ1xuICpcbiAqIEBjbGFzcyBHcmFwaGljc1xuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEdyYXBoaWNzKClcbntcbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLnJlbmRlcmFibGUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGFscGhhIG9mIHRoZSBmaWxsIG9mIHRoaXMgZ3JhcGhpY3Mgb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZmlsbEFscGhhXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgdGhpcy5maWxsQWxwaGEgPSAxO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHdpZHRoIG9mIGFueSBsaW5lcyBkcmF3blxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGxpbmVXaWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHRoaXMubGluZVdpZHRoID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xvciBvZiBhbnkgbGluZXMgZHJhd25cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBsaW5lQ29sb3JcbiAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgKi9cbiAgICB0aGlzLmxpbmVDb2xvciA9ICdibGFjayc7XG5cbiAgICAvKipcbiAgICAgKiBHcmFwaGljcyBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZ3JhcGhpY3NEYXRhXG4gICAgICogQHR5cGUgQXJyYXlcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuZ3JhcGhpY3NEYXRhID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDdXJyZW50IHBhdGhcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjdXJyZW50UGF0aFxuICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHtwb2ludHM6W119O1xufVxuXG52YXIgcHJvdG8gPSBHcmFwaGljcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogR3JhcGhpY3N9XG59KTtcblxuLyoqXG4gKiBTcGVjaWZpZXMgYSBsaW5lIHN0eWxlIHVzZWQgZm9yIHN1YnNlcXVlbnQgY2FsbHMgdG8gR3JhcGhpY3MgbWV0aG9kcyBzdWNoIGFzIHRoZSBsaW5lVG8oKSBtZXRob2Qgb3IgdGhlIGRyYXdDaXJjbGUoKSBtZXRob2QuXG4gKlxuICogQG1ldGhvZCBsaW5lU3R5bGVcbiAqIEBwYXJhbSBsaW5lV2lkdGgge051bWJlcn0gd2lkdGggb2YgdGhlIGxpbmUgdG8gZHJhdywgd2lsbCB1cGRhdGUgdGhlIG9iamVjdCdzIHN0b3JlZCBzdHlsZVxuICogQHBhcmFtIGNvbG9yIHtOdW1iZXJ9IGNvbG9yIG9mIHRoZSBsaW5lIHRvIGRyYXcsIHdpbGwgdXBkYXRlIHRoZSBvYmplY3QncyBzdG9yZWQgc3R5bGVcbiAqIEBwYXJhbSBhbHBoYSB7TnVtYmVyfSBhbHBoYSBvZiB0aGUgbGluZSB0byBkcmF3LCB3aWxsIHVwZGF0ZSB0aGUgb2JqZWN0J3Mgc3RvcmVkIHN0eWxlXG4gKi9cbnByb3RvLmxpbmVTdHlsZSA9IGZ1bmN0aW9uIGxpbmVTdHlsZShsaW5lV2lkdGgsIGNvbG9yLCBhbHBoYSlcbntcbiAgICBpZiAoIXRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aCkgdGhpcy5ncmFwaGljc0RhdGEucG9wKCk7XG5cbiAgICB0aGlzLmxpbmVXaWR0aCA9IGxpbmVXaWR0aCB8fCAwO1xuICAgIHRoaXMubGluZUNvbG9yID0gY29sb3IgfHwgMDtcbiAgICB0aGlzLmxpbmVBbHBoYSA9IChhcmd1bWVudHMubGVuZ3RoIDwgMykgPyAxIDogYWxwaGE7XG5cbiAgICB0aGlzLmN1cnJlbnRQYXRoID0ge2xpbmVXaWR0aDp0aGlzLmxpbmVXaWR0aCwgbGluZUNvbG9yOnRoaXMubGluZUNvbG9yLCBsaW5lQWxwaGE6dGhpcy5saW5lQWxwaGEsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxsQ29sb3I6dGhpcy5maWxsQ29sb3IsIGZpbGxBbHBoYTp0aGlzLmZpbGxBbHBoYSwgZmlsbDp0aGlzLmZpbGxpbmcsIHBvaW50czpbXSwgdHlwZTogR3JhcGhpY3MuUE9MWX07XG5cbiAgICB0aGlzLmdyYXBoaWNzRGF0YS5wdXNoKHRoaXMuY3VycmVudFBhdGgpO1xufTtcblxuLyoqXG4gKiBNb3ZlcyB0aGUgY3VycmVudCBkcmF3aW5nIHBvc2l0aW9uIHRvICh4LCB5KS5cbiAqXG4gKiBAbWV0aG9kIG1vdmVUb1xuICogQHBhcmFtIHgge051bWJlcn0gdGhlIFggY29vcmQgdG8gbW92ZSB0b1xuICogQHBhcmFtIHkge051bWJlcn0gdGhlIFkgY29vcmQgdG8gbW92ZSB0b1xuICovXG5wcm90by5tb3ZlVG8gPSBmdW5jdGlvbiBtb3ZlVG8oeCwgeSlcbntcbiAgICBpZiAoIXRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aCkgdGhpcy5ncmFwaGljc0RhdGEucG9wKCk7XG5cbiAgICB0aGlzLmN1cnJlbnRQYXRoID0gdGhpcy5jdXJyZW50UGF0aCA9IHtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsIGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvciwgbGluZUFscGhhOnRoaXMubGluZUFscGhhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLCBmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsIGZpbGw6dGhpcy5maWxsaW5nLCBwb2ludHM6W10sIHR5cGU6IEdyYXBoaWNzLlBPTFl9O1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aC5wb2ludHMucHVzaCh4LCB5KTtcblxuICAgIHRoaXMuZ3JhcGhpY3NEYXRhLnB1c2godGhpcy5jdXJyZW50UGF0aCk7XG59O1xuXG4vKipcbiAqIERyYXdzIGEgbGluZSB1c2luZyB0aGUgY3VycmVudCBsaW5lIHN0eWxlIGZyb20gdGhlIGN1cnJlbnQgZHJhd2luZyBwb3NpdGlvbiB0byAoeCwgeSk7XG4gKiB0aGUgY3VycmVudCBkcmF3aW5nIHBvc2l0aW9uIGlzIHRoZW4gc2V0IHRvICh4LCB5KS5cbiAqXG4gKiBAbWV0aG9kIGxpbmVUb1xuICogQHBhcmFtIHgge051bWJlcn0gdGhlIFggY29vcmQgdG8gZHJhdyB0b1xuICogQHBhcmFtIHkge051bWJlcn0gdGhlIFkgY29vcmQgdG8gZHJhdyB0b1xuICovXG5wcm90by5saW5lVG8gPSBmdW5jdGlvbiBsaW5lVG8oeCwgeSlcbntcbiAgICB0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5wdXNoKHgsIHkpO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBTcGVjaWZpZXMgYSBzaW1wbGUgb25lLWNvbG9yIGZpbGwgdGhhdCBzdWJzZXF1ZW50IGNhbGxzIHRvIG90aGVyIEdyYXBoaWNzIG1ldGhvZHNcbiAqIChzdWNoIGFzIGxpbmVUbygpIG9yIGRyYXdDaXJjbGUoKSkgdXNlIHdoZW4gZHJhd2luZy5cbiAqXG4gKiBAbWV0aG9kIGJlZ2luRmlsbFxuICogQHBhcmFtIGNvbG9yIHt1aW50fSB0aGUgY29sb3Igb2YgdGhlIGZpbGxcbiAqIEBwYXJhbSBhbHBoYSB7TnVtYmVyfSB0aGUgYWxwaGFcbiAqL1xucHJvdG8uYmVnaW5GaWxsID0gZnVuY3Rpb24gYmVnaW5GaWxsKGNvbG9yLCBhbHBoYSlcbntcbiAgICB0aGlzLmZpbGxpbmcgPSB0cnVlO1xuICAgIHRoaXMuZmlsbENvbG9yID0gY29sb3IgfHwgMDtcbiAgICB0aGlzLmZpbGxBbHBoYSA9IChhcmd1bWVudHMubGVuZ3RoIDwgMikgPyAxIDogYWxwaGE7XG59O1xuXG4vKipcbiAqIEFwcGxpZXMgYSBmaWxsIHRvIHRoZSBsaW5lcyBhbmQgc2hhcGVzIHRoYXQgd2VyZSBhZGRlZCBzaW5jZSB0aGUgbGFzdCBjYWxsIHRvIHRoZSBiZWdpbkZpbGwoKSBtZXRob2QuXG4gKlxuICogQG1ldGhvZCBlbmRGaWxsXG4gKi9cbnByb3RvLmVuZEZpbGwgPSBmdW5jdGlvbiBlbmRGaWxsKClcbntcbiAgICB0aGlzLmZpbGxpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmZpbGxDb2xvciA9IG51bGw7XG4gICAgdGhpcy5maWxsQWxwaGEgPSAxO1xufTtcblxuLyoqXG4gKiBAbWV0aG9kIGRyYXdSZWN0XG4gKlxuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHRvcC1sZWZ0IG9mIHRoZSByZWN0YW5nbGVcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSB0b3AtbGVmdCBvZiB0aGUgcmVjdGFuZ2xlXG4gKiBAcGFyYW0gd2lkdGgge051bWJlcn0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGVcbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlXG4gKi9cbnByb3RvLmRyYXdSZWN0ID0gZnVuY3Rpb24gZHJhd1JlY3QoeCwgeSwgd2lkdGgsIGhlaWdodClcbntcbiAgICBpZiAoIXRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aCkgdGhpcy5ncmFwaGljc0RhdGEucG9wKCk7XG5cbiAgICB0aGlzLmN1cnJlbnRQYXRoID0ge2xpbmVXaWR0aDp0aGlzLmxpbmVXaWR0aCwgbGluZUNvbG9yOnRoaXMubGluZUNvbG9yLCBsaW5lQWxwaGE6dGhpcy5saW5lQWxwaGEsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxsQ29sb3I6dGhpcy5maWxsQ29sb3IsIGZpbGxBbHBoYTp0aGlzLmZpbGxBbHBoYSwgZmlsbDp0aGlzLmZpbGxpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludHM6W3gsIHksIHdpZHRoLCBoZWlnaHRdLCB0eXBlOiBHcmFwaGljcy5SRUNUfTtcblxuICAgIHRoaXMuZ3JhcGhpY3NEYXRhLnB1c2godGhpcy5jdXJyZW50UGF0aCk7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG59O1xuXG4vKipcbiAqIERyYXdzIGEgY2lyY2xlLlxuICpcbiAqIEBtZXRob2QgZHJhd0NpcmNsZVxuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIGNlbnRlciBvZiB0aGUgY2lyY2xlXG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgY2VudGVyIG9mIHRoZSBjaXJjbGVcbiAqIEBwYXJhbSByYWRpdXMge051bWJlcn0gVGhlIHJhZGl1cyBvZiB0aGUgY2lyY2xlXG4gKi9cbnByb3RvLmRyYXdDaXJjbGUgPSBmdW5jdGlvbiBkcmF3Q2lyY2xlKHgsIHksIHJhZGl1cylcbntcbiAgICBpZiAoIXRoaXMuY3VycmVudFBhdGgucG9pbnRzLmxlbmd0aCkgdGhpcy5ncmFwaGljc0RhdGEucG9wKCk7XG5cbiAgICB0aGlzLmN1cnJlbnRQYXRoID0ge2xpbmVXaWR0aDp0aGlzLmxpbmVXaWR0aCwgbGluZUNvbG9yOnRoaXMubGluZUNvbG9yLCBsaW5lQWxwaGE6dGhpcy5saW5lQWxwaGEsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxsQ29sb3I6dGhpcy5maWxsQ29sb3IsIGZpbGxBbHBoYTp0aGlzLmZpbGxBbHBoYSwgZmlsbDp0aGlzLmZpbGxpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludHM6W3gsIHksIHJhZGl1cywgcmFkaXVzXSwgdHlwZTogR3JhcGhpY3MuQ0lSQ307XG5cbiAgICB0aGlzLmdyYXBoaWNzRGF0YS5wdXNoKHRoaXMuY3VycmVudFBhdGgpO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBEcmF3cyBhbiBlbGxpcHNlLlxuICpcbiAqIEBtZXRob2QgZHJhd0VsbGlwc2VcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9XG4gKiBAcGFyYW0geSB7TnVtYmVyfVxuICogQHBhcmFtIHdpZHRoIHtOdW1iZXJ9XG4gKiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9XG4gKi9cbnByb3RvLmRyYXdFbGlwc2UgPSBmdW5jdGlvbiBkcmF3RWxpcHNlKHgsIHksIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsIGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvciwgbGluZUFscGhhOnRoaXMubGluZUFscGhhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLCBmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsIGZpbGw6dGhpcy5maWxsaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRzOlt4LCB5LCB3aWR0aCwgaGVpZ2h0XSwgdHlwZTogR3JhcGhpY3MuRUxJUH07XG5cbiAgICB0aGlzLmdyYXBoaWNzRGF0YS5wdXNoKHRoaXMuY3VycmVudFBhdGgpO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBDbGVhcnMgdGhlIGdyYXBoaWNzIHRoYXQgd2VyZSBkcmF3biB0byB0aGlzIEdyYXBoaWNzIG9iamVjdCwgYW5kIHJlc2V0cyBmaWxsIGFuZCBsaW5lIHN0eWxlIHNldHRpbmdzLlxuICpcbiAqIEBtZXRob2QgY2xlYXJcbiAqL1xucHJvdG8uY2xlYXIgPSBmdW5jdGlvbiBjbGVhcigpXG57XG4gICAgdGhpcy5saW5lV2lkdGggPSAwO1xuICAgIHRoaXMuZmlsbGluZyA9IGZhbHNlO1xuXG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgdGhpcy5jbGVhckRpcnR5ID0gdHJ1ZTtcbiAgICB0aGlzLmdyYXBoaWNzRGF0YSA9IFtdO1xuXG4gICAgdGhpcy5ib3VuZHMgPSBudWxsOyAvL25ldyBSZWN0YW5nbGUoKTtcbn07XG5cblxucHJvdG8udXBkYXRlRmlsdGVyQm91bmRzID0gZnVuY3Rpb24gdXBkYXRlRmlsdGVyQm91bmRzKClcbntcbiAgICBpZighdGhpcy5ib3VuZHMpXG4gICAge1xuICAgICAgICB2YXIgbWluWCA9IEluZmluaXR5O1xuICAgICAgICB2YXIgbWF4WCA9IC1JbmZpbml0eTtcblxuICAgICAgICB2YXIgbWluWSA9IEluZmluaXR5O1xuICAgICAgICB2YXIgbWF4WSA9IC1JbmZpbml0eTtcblxuICAgICAgICB2YXIgcG9pbnRzLCB4LCB5O1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5ncmFwaGljc0RhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gdGhpcy5ncmFwaGljc0RhdGFbaV07XG4gICAgICAgICAgICB2YXIgdHlwZSA9IGRhdGEudHlwZTtcbiAgICAgICAgICAgIHZhciBsaW5lV2lkdGggPSBkYXRhLmxpbmVXaWR0aDtcblxuICAgICAgICAgICAgcG9pbnRzID0gZGF0YS5wb2ludHM7XG5cbiAgICAgICAgICAgIGlmKHR5cGUgPT09IEdyYXBoaWNzLlJFQ1QpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgeCA9IHBvaW50cy54IC0gbGluZVdpZHRoLzI7XG4gICAgICAgICAgICAgICAgeSA9IHBvaW50cy55IC0gbGluZVdpZHRoLzI7XG4gICAgICAgICAgICAgICAgdmFyIHdpZHRoID0gcG9pbnRzLndpZHRoICsgbGluZVdpZHRoO1xuICAgICAgICAgICAgICAgIHZhciBoZWlnaHQgPSBwb2ludHMuaGVpZ2h0ICsgbGluZVdpZHRoO1xuXG4gICAgICAgICAgICAgICAgbWluWCA9IHggPCBtaW5YID8geCA6IG1pblg7XG4gICAgICAgICAgICAgICAgbWF4WCA9IHggKyB3aWR0aCA+IG1heFggPyB4ICsgd2lkdGggOiBtYXhYO1xuXG4gICAgICAgICAgICAgICAgbWluWSA9IHkgPCBtaW5ZID8geCA6IG1pblk7XG4gICAgICAgICAgICAgICAgbWF4WSA9IHkgKyBoZWlnaHQgPiBtYXhZID8geSArIGhlaWdodCA6IG1heFk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmKHR5cGUgPT09IEdyYXBoaWNzLkNJUkMgfHwgdHlwZSA9PT0gR3JhcGhpY3MuRUxJUClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB4ID0gcG9pbnRzLng7XG4gICAgICAgICAgICAgICAgeSA9IHBvaW50cy55O1xuICAgICAgICAgICAgICAgIHZhciByYWRpdXMgPSBwb2ludHMucmFkaXVzICsgbGluZVdpZHRoLzI7XG5cbiAgICAgICAgICAgICAgICBtaW5YID0geCAtIHJhZGl1cyA8IG1pblggPyB4IC0gcmFkaXVzIDogbWluWDtcbiAgICAgICAgICAgICAgICBtYXhYID0geCArIHJhZGl1cyA+IG1heFggPyB4ICsgcmFkaXVzIDogbWF4WDtcblxuICAgICAgICAgICAgICAgIG1pblkgPSB5IC0gcmFkaXVzIDwgbWluWSA/IHkgLSByYWRpdXMgOiBtaW5ZO1xuICAgICAgICAgICAgICAgIG1heFkgPSB5ICsgcmFkaXVzID4gbWF4WSA/IHkgKyByYWRpdXMgOiBtYXhZO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIFBPTFlcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHBvaW50cy5sZW5ndGg7IGorPTIpXG4gICAgICAgICAgICAgICAge1xuXG4gICAgICAgICAgICAgICAgICAgIHggPSBwb2ludHNbal07XG4gICAgICAgICAgICAgICAgICAgIHkgPSBwb2ludHNbaisxXTtcblxuICAgICAgICAgICAgICAgICAgICBtaW5YID0geC1saW5lV2lkdGggPCBtaW5YID8geC1saW5lV2lkdGggOiBtaW5YO1xuICAgICAgICAgICAgICAgICAgICBtYXhYID0geCtsaW5lV2lkdGggPiBtYXhYID8geCtsaW5lV2lkdGggOiBtYXhYO1xuXG4gICAgICAgICAgICAgICAgICAgIG1pblkgPSB5LWxpbmVXaWR0aCA8IG1pblkgPyB5LWxpbmVXaWR0aCA6IG1pblk7XG4gICAgICAgICAgICAgICAgICAgIG1heFkgPSB5K2xpbmVXaWR0aCA+IG1heFkgPyB5K2xpbmVXaWR0aCA6IG1heFk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5ib3VuZHMgPSBuZXcgUmVjdGFuZ2xlKG1pblgsIG1pblksIG1heFggLSBtaW5YLCBtYXhZIC0gbWluWSk7XG4gICAgfVxuLy8gIGNvbnNvbGUubG9nKHRoaXMuYm91bmRzKTtcbn07XG5cbi8vIFNPTUUgVFlQRVM6XG5HcmFwaGljcy5QT0xZID0gMDtcbkdyYXBoaWNzLlJFQ1QgPSAxO1xuR3JhcGhpY3MuQ0lSQyA9IDI7XG5HcmFwaGljcy5FTElQID0gMztcblxubW9kdWxlLmV4cG9ydHMgPSBHcmFwaGljcztcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vLi4vcGxhdGZvcm0nKTtcbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG5cbnZhciBjYW52YXNHcmFwaGljcyA9IHJlcXVpcmUoJy4vZ3JhcGhpY3MnKTtcbnZhciBCYXNlVGV4dHVyZSA9IHJlcXVpcmUoJy4uLy4uL3RleHR1cmVzL0Jhc2VUZXh0dXJlJyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uLy4uL3RleHR1cmVzL1RleHR1cmUnKTtcblxudmFyIFNwcml0ZSA9IHJlcXVpcmUoJy4uLy4uL2Rpc3BsYXkvU3ByaXRlJyk7XG52YXIgVGlsaW5nU3ByaXRlID0gcmVxdWlyZSgnLi4vLi4vZXh0cmFzL1RpbGluZ1Nwcml0ZScpO1xudmFyIFN0cmlwID0gcmVxdWlyZSgnLi4vLi4vZXh0cmFzL1N0cmlwJyk7XG52YXIgQ3VzdG9tUmVuZGVyYWJsZSA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9DdXN0b21SZW5kZXJhYmxlJyk7XG52YXIgR3JhcGhpY3MgPSByZXF1aXJlKCcuLi8uLi9wcmltaXRpdmVzL0dyYXBoaWNzJyk7XG52YXIgRmlsdGVyQmxvY2sgPSByZXF1aXJlKCcuLi8uLi9maWx0ZXJzL0ZpbHRlckJsb2NrJyk7XG5cbi8qKlxuICogdGhlIENhbnZhc1JlbmRlcmVyIGRyYXdzIHRoZSBzdGFnZSBhbmQgYWxsIGl0cyBjb250ZW50IG9udG8gYSAyZCBjYW52YXMuIFRoaXMgcmVuZGVyZXIgc2hvdWxkIGJlIHVzZWQgZm9yIGJyb3dzZXJzIHRoYXQgZG8gbm90IHN1cHBvcnQgd2ViR0wuXG4gKiBEb250IGZvcmdldCB0byBhZGQgdGhlIHZpZXcgdG8geW91ciBET00gb3IgeW91IHdpbGwgbm90IHNlZSBhbnl0aGluZyA6KVxuICpcbiAqIEBjbGFzcyBDYW52YXNSZW5kZXJlclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gd2lkdGg9MCB7TnVtYmVyfSB0aGUgd2lkdGggb2YgdGhlIGNhbnZhcyB2aWV3XG4gKiBAcGFyYW0gaGVpZ2h0PTAge051bWJlcn0gdGhlIGhlaWdodCBvZiB0aGUgY2FudmFzIHZpZXdcbiAqIEBwYXJhbSB2aWV3IHtDYW52YXN9IHRoZSBjYW52YXMgdG8gdXNlIGFzIGEgdmlldywgb3B0aW9uYWxcbiAqIEBwYXJhbSB0cmFuc3BhcmVudD1mYWxzZSB7Qm9vbGVhbn0gdGhlIHRyYW5zcGFyZW5jeSBvZiB0aGUgcmVuZGVyIHZpZXcsIGRlZmF1bHQgZmFsc2VcbiAqL1xuZnVuY3Rpb24gQ2FudmFzUmVuZGVyZXIod2lkdGgsIGhlaWdodCwgdmlldywgdHJhbnNwYXJlbnQpXG57XG4gICAgdGhpcy50cmFuc3BhcmVudCA9IHRyYW5zcGFyZW50O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHdpZHRoIG9mIHRoZSBjYW52YXMgdmlld1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHdpZHRoXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgODAwXG4gICAgICovXG4gICAgdGhpcy53aWR0aCA9IHdpZHRoIHx8IDgwMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyB2aWV3XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgaGVpZ2h0XG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgNjAwXG4gICAgICovXG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQgfHwgNjAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNhbnZhcyBlbGVtZW50IHRoYXQgdGhlIGV2ZXJ5dGhpbmcgaXMgZHJhd24gdG9cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB2aWV3XG4gICAgICogQHR5cGUgQ2FudmFzXG4gICAgICovXG4gICAgdGhpcy52aWV3ID0gdmlldyB8fCBwbGF0Zm9ybS5jcmVhdGVDYW52YXMoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYW52YXMgY29udGV4dCB0aGF0IHRoZSBldmVyeXRoaW5nIGlzIGRyYXduIHRvXG4gICAgICogQHByb3BlcnR5IGNvbnRleHRcbiAgICAgKiBAdHlwZSBDYW52YXMgMmQgQ29udGV4dFxuICAgICAqL1xuICAgIHRoaXMuY29udGV4dCA9IHRoaXMudmlldy5nZXRDb250ZXh0KCAnMmQnICk7XG5cbiAgICAvL3NvbWUgZmlsdGVyIHZhcmlhYmxlc1xuICAgIHRoaXMuc21vb3RoUHJvcGVydHkgPSBudWxsO1xuXG4gICAgaWYoJ2ltYWdlU21vb3RoaW5nRW5hYmxlZCcgaW4gdGhpcy5jb250ZXh0KVxuICAgICAgICB0aGlzLnNtb290aFByb3BlcnR5ID0gJ2ltYWdlU21vb3RoaW5nRW5hYmxlZCc7XG4gICAgZWxzZSBpZignd2Via2l0SW1hZ2VTbW9vdGhpbmdFbmFibGVkJyBpbiB0aGlzLmNvbnRleHQpXG4gICAgICAgIHRoaXMuc21vb3RoUHJvcGVydHkgPSAnd2Via2l0SW1hZ2VTbW9vdGhpbmdFbmFibGVkJztcbiAgICBlbHNlIGlmKCdtb3pJbWFnZVNtb290aGluZ0VuYWJsZWQnIGluIHRoaXMuY29udGV4dClcbiAgICAgICAgdGhpcy5zbW9vdGhQcm9wZXJ0eSA9ICdtb3pJbWFnZVNtb290aGluZ0VuYWJsZWQnO1xuICAgIGVsc2UgaWYoJ29JbWFnZVNtb290aGluZ0VuYWJsZWQnIGluIHRoaXMuY29udGV4dClcbiAgICAgICAgdGhpcy5zbW9vdGhQcm9wZXJ0eSA9ICdvSW1hZ2VTbW9vdGhpbmdFbmFibGVkJztcblxuICAgIHRoaXMuc2NhbGVNb2RlID0gbnVsbDtcblxuICAgIHRoaXMucmVmcmVzaCA9IHRydWU7XG4gICAgLy8gaGFjayB0byBlbmFibGUgc29tZSBoYXJkd2FyZSBhY2NlbGVyYXRpb24hXG4gICAgLy90aGlzLnZpZXcuc3R5bGVbXCJ0cmFuc2Zvcm1cIl0gPSBcInRyYW5zbGF0ZXooMClcIjtcblxuICAgIHRoaXMudmlldy53aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgdGhpcy52aWV3LmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuICAgIHRoaXMuY291bnQgPSAwO1xufVxuXG52YXIgcHJvdG8gPSBDYW52YXNSZW5kZXJlci5wcm90b3R5cGU7XG5cbi8qKlxuICogUmVuZGVycyB0aGUgc3RhZ2UgdG8gaXRzIGNhbnZhcyB2aWV3XG4gKlxuICogQG1ldGhvZCByZW5kZXJcbiAqIEBwYXJhbSBzdGFnZSB7U3RhZ2V9IHRoZSBTdGFnZSBlbGVtZW50IHRvIGJlIHJlbmRlcmVkXG4gKi9cbnByb3RvLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcihzdGFnZSlcbntcbiAgICAvL3N0YWdlLl9fY2hpbGRyZW5BZGRlZCA9IFtdO1xuICAgIC8vc3RhZ2UuX19jaGlsZHJlblJlbW92ZWQgPSBbXTtcblxuICAgIC8vIHVwZGF0ZSB0ZXh0dXJlcyBpZiBuZWVkIGJlXG4gICAgZ2xvYmFscy50ZXh0dXJlc1RvVXBkYXRlID0gW107XG4gICAgZ2xvYmFscy50ZXh0dXJlc1RvRGVzdHJveSA9IFtdO1xuXG4gICAgZ2xvYmFscy52aXNpYmxlQ291bnQrKztcbiAgICBzdGFnZS51cGRhdGVUcmFuc2Zvcm0oKTtcblxuICAgIC8vIHVwZGF0ZSB0aGUgYmFja2dyb3VuZCBjb2xvclxuICAgIGlmKHRoaXMudmlldy5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgIT09IHN0YWdlLmJhY2tncm91bmRDb2xvclN0cmluZyAmJiAhdGhpcy50cmFuc3BhcmVudClcbiAgICAgICAgdGhpcy52aWV3LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHN0YWdlLmJhY2tncm91bmRDb2xvclN0cmluZztcblxuICAgIHRoaXMuY29udGV4dC5zZXRUcmFuc2Zvcm0oMSwwLDAsMSwwLDApO1xuICAgIHRoaXMuY29udGV4dC5jbGVhclJlY3QoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuICAgIHRoaXMucmVuZGVyRGlzcGxheU9iamVjdChzdGFnZSk7XG4gICAgLy9hc1xuXG4gICAgLy8gcnVuIGludGVyYWN0aW9uIVxuICAgIGlmKHN0YWdlLmludGVyYWN0aXZlKVxuICAgIHtcbiAgICAgICAgLy9uZWVkIHRvIGFkZCBzb21lIGV2ZW50cyFcbiAgICAgICAgaWYoIXN0YWdlLl9pbnRlcmFjdGl2ZUV2ZW50c0FkZGVkKVxuICAgICAgICB7XG4gICAgICAgICAgICBzdGFnZS5faW50ZXJhY3RpdmVFdmVudHNBZGRlZCA9IHRydWU7XG4gICAgICAgICAgICBzdGFnZS5pbnRlcmFjdGlvbk1hbmFnZXIuc2V0VGFyZ2V0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlIGZyYW1lIHVwZGF0ZXMuLlxuICAgIGlmKFRleHR1cmUuZnJhbWVVcGRhdGVzLmxlbmd0aCA+IDApXG4gICAge1xuICAgICAgICBUZXh0dXJlLmZyYW1lVXBkYXRlcyA9IFtdO1xuICAgIH1cbn07XG5cbi8qKlxuICogcmVzaXplcyB0aGUgY2FudmFzIHZpZXcgdG8gdGhlIHNwZWNpZmllZCB3aWR0aCBhbmQgaGVpZ2h0XG4gKlxuICogQG1ldGhvZCByZXNpemVcbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSB0aGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMgdmlld1xuICogQHBhcmFtIGhlaWdodCB7TnVtYmVyfSB0aGUgbmV3IGhlaWdodCBvZiB0aGUgY2FudmFzIHZpZXdcbiAqL1xucHJvdG8ucmVzaXplID0gZnVuY3Rpb24gcmVzaXplKHdpZHRoLCBoZWlnaHQpXG57XG4gICAgdGhpcy53aWR0aCA9IHdpZHRoO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgdGhpcy52aWV3LndpZHRoID0gd2lkdGg7XG4gICAgdGhpcy52aWV3LmhlaWdodCA9IGhlaWdodDtcbn07XG5cbi8qKlxuICogUmVuZGVycyBhIGRpc3BsYXkgb2JqZWN0XG4gKlxuICogQG1ldGhvZCByZW5kZXJEaXNwbGF5T2JqZWN0XG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gVGhlIGRpc3BsYXlPYmplY3QgdG8gcmVuZGVyXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJEaXNwbGF5T2JqZWN0ID0gZnVuY3Rpb24gcmVuZGVyRGlzcGxheU9iamVjdChkaXNwbGF5T2JqZWN0KVxue1xuICAgIC8vIG5vIGxvZ2VyIHJlY3VycnNpdmUhXG4gICAgdmFyIHRyYW5zZm9ybTtcbiAgICB2YXIgY29udGV4dCA9IHRoaXMuY29udGV4dDtcblxuICAgIGNvbnRleHQuZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gJ3NvdXJjZS1vdmVyJztcblxuICAgIC8vIG9uZSB0aGUgZGlzcGxheSBvYmplY3QgaGl0cyB0aGlzLiB3ZSBjYW4gYnJlYWsgdGhlIGxvb3BcbiAgICB2YXIgdGVzdE9iamVjdCA9IGRpc3BsYXlPYmplY3QubGFzdC5faU5leHQ7XG4gICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QuZmlyc3Q7XG5cbiAgICBkb1xuICAgIHtcbiAgICAgICAgdHJhbnNmb3JtID0gZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybTtcblxuICAgICAgICBpZighZGlzcGxheU9iamVjdC52aXNpYmxlKVxuICAgICAgICB7XG4gICAgICAgICAgICBkaXNwbGF5T2JqZWN0ID0gZGlzcGxheU9iamVjdC5sYXN0Ll9pTmV4dDtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIWRpc3BsYXlPYmplY3QucmVuZGVyYWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QuX2lOZXh0O1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3ByaXRlKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIHZhciBmcmFtZSA9IGRpc3BsYXlPYmplY3QudGV4dHVyZS5mcmFtZTtcblxuICAgICAgICAgICAgLy9pZ25vcmUgbnVsbCBzb3VyY2VzXG4gICAgICAgICAgICBpZihmcmFtZSAmJiBmcmFtZS53aWR0aCAmJiBmcmFtZS5oZWlnaHQgJiYgZGlzcGxheU9iamVjdC50ZXh0dXJlLmJhc2VUZXh0dXJlLnNvdXJjZSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGlzcGxheU9iamVjdC53b3JsZEFscGhhO1xuXG4gICAgICAgICAgICAgICAgY29udGV4dC5zZXRUcmFuc2Zvcm0odHJhbnNmb3JtWzBdLCB0cmFuc2Zvcm1bM10sIHRyYW5zZm9ybVsxXSwgdHJhbnNmb3JtWzRdLCB0cmFuc2Zvcm1bMl0sIHRyYW5zZm9ybVs1XSk7XG5cbiAgICAgICAgICAgICAgICAvL2lmIHNtb290aGluZ0VuYWJsZWQgaXMgc3VwcG9ydGVkIGFuZCB3ZSBuZWVkIHRvIGNoYW5nZSB0aGUgc21vb3RoaW5nIHByb3BlcnR5IGZvciB0aGlzIHRleHR1cmVcbiAgICAgICAgICAgICAgICBpZih0aGlzLnNtb290aFByb3BlcnR5ICYmIHRoaXMuc2NhbGVNb2RlICE9PSBkaXNwbGF5T2JqZWN0LnRleHR1cmUuYmFzZVRleHR1cmUuc2NhbGVNb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NhbGVNb2RlID0gZGlzcGxheU9iamVjdC50ZXh0dXJlLmJhc2VUZXh0dXJlLnNjYWxlTW9kZTtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dFt0aGlzLnNtb290aFByb3BlcnR5XSA9ICh0aGlzLnNjYWxlTW9kZSA9PT0gQmFzZVRleHR1cmUuU0NBTEVfTU9ERS5MSU5FQVIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKGRpc3BsYXlPYmplY3QudGV4dHVyZS5iYXNlVGV4dHVyZS5zb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLngsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZS5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkaXNwbGF5T2JqZWN0LmFuY2hvci54KSAqIC1mcmFtZS53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRpc3BsYXlPYmplY3QuYW5jaG9yLnkpICogLWZyYW1lLmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWUud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLmhlaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3RyaXApXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2V0VHJhbnNmb3JtKHRyYW5zZm9ybVswXSwgdHJhbnNmb3JtWzNdLCB0cmFuc2Zvcm1bMV0sIHRyYW5zZm9ybVs0XSwgdHJhbnNmb3JtWzJdLCB0cmFuc2Zvcm1bNV0pO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTdHJpcChkaXNwbGF5T2JqZWN0KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRpc3BsYXlPYmplY3QgaW5zdGFuY2VvZiBUaWxpbmdTcHJpdGUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2V0VHJhbnNmb3JtKHRyYW5zZm9ybVswXSwgdHJhbnNmb3JtWzNdLCB0cmFuc2Zvcm1bMV0sIHRyYW5zZm9ybVs0XSwgdHJhbnNmb3JtWzJdLCB0cmFuc2Zvcm1bNV0pO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJUaWxpbmdTcHJpdGUoZGlzcGxheU9iamVjdCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgQ3VzdG9tUmVuZGVyYWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgY29udGV4dC5zZXRUcmFuc2Zvcm0odHJhbnNmb3JtWzBdLCB0cmFuc2Zvcm1bM10sIHRyYW5zZm9ybVsxXSwgdHJhbnNmb3JtWzRdLCB0cmFuc2Zvcm1bMl0sIHRyYW5zZm9ybVs1XSk7XG4gICAgICAgICAgICBkaXNwbGF5T2JqZWN0LnJlbmRlckNhbnZhcyh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRpc3BsYXlPYmplY3QgaW5zdGFuY2VvZiBHcmFwaGljcylcbiAgICAgICAge1xuICAgICAgICAgICAgY29udGV4dC5zZXRUcmFuc2Zvcm0odHJhbnNmb3JtWzBdLCB0cmFuc2Zvcm1bM10sIHRyYW5zZm9ybVsxXSwgdHJhbnNmb3JtWzRdLCB0cmFuc2Zvcm1bMl0sIHRyYW5zZm9ybVs1XSk7XG4gICAgICAgICAgICBjYW52YXNHcmFwaGljcy5yZW5kZXJHcmFwaGljcyhkaXNwbGF5T2JqZWN0LCBjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRpc3BsYXlPYmplY3QgaW5zdGFuY2VvZiBGaWx0ZXJCbG9jaylcbiAgICAgICAge1xuICAgICAgICAgICAgaWYoZGlzcGxheU9iamVjdC5kYXRhIGluc3RhbmNlb2YgR3JhcGhpY3MpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmFyIG1hc2sgPSBkaXNwbGF5T2JqZWN0LmRhdGE7XG5cbiAgICAgICAgICAgICAgICBpZihkaXNwbGF5T2JqZWN0Lm9wZW4pXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnNhdmUoKTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgY2FjaGVBbHBoYSA9IG1hc2suYWxwaGE7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXNrVHJhbnNmb3JtID0gbWFzay53b3JsZFRyYW5zZm9ybTtcblxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnNldFRyYW5zZm9ybShtYXNrVHJhbnNmb3JtWzBdLCBtYXNrVHJhbnNmb3JtWzNdLCBtYXNrVHJhbnNmb3JtWzFdLCBtYXNrVHJhbnNmb3JtWzRdLCBtYXNrVHJhbnNmb3JtWzJdLCBtYXNrVHJhbnNmb3JtWzVdKTtcblxuICAgICAgICAgICAgICAgICAgICBtYXNrLndvcmxkQWxwaGEgPSAwLjU7XG5cbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC53b3JsZEFscGhhID0gMDtcblxuICAgICAgICAgICAgICAgICAgICBjYW52YXNHcmFwaGljcy5yZW5kZXJHcmFwaGljc01hc2sobWFzaywgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQuY2xpcCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIG1hc2sud29ybGRBbHBoYSA9IGNhY2hlQWxwaGE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQucmVzdG9yZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL2NvdW50KytcbiAgICAgICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QuX2lOZXh0O1xuICAgIH1cbiAgICB3aGlsZShkaXNwbGF5T2JqZWN0ICE9PSB0ZXN0T2JqZWN0KTtcbn07XG5cbi8qKlxuICogUmVuZGVycyBhIGZsYXQgc3RyaXBcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclN0cmlwRmxhdFxuICogQHBhcmFtIHN0cmlwIHtTdHJpcH0gVGhlIFN0cmlwIHRvIHJlbmRlclxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyU3RyaXBGbGF0ID0gZnVuY3Rpb24gcmVuZGVyU3RyaXBGbGF0KHN0cmlwKVxue1xuICAgIHZhciBjb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuICAgIHZhciB2ZXJ0aWNpZXMgPSBzdHJpcC52ZXJ0aWNpZXM7XG5cbiAgICB2YXIgbGVuZ3RoID0gdmVydGljaWVzLmxlbmd0aC8yO1xuICAgIHRoaXMuY291bnQrKztcblxuICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG4gICAgZm9yICh2YXIgaT0xOyBpIDwgbGVuZ3RoLTI7IGkrKylcbiAgICB7XG4gICAgICAgIC8vIGRyYXcgc29tZSB0cmlhbmdsZXMhXG4gICAgICAgIHZhciBpbmRleCA9IGkqMjtcblxuICAgICAgICB2YXIgeDAgPSB2ZXJ0aWNpZXNbaW5kZXhdLCAgIHgxID0gdmVydGljaWVzW2luZGV4KzJdLCB4MiA9IHZlcnRpY2llc1tpbmRleCs0XTtcbiAgICAgICAgdmFyIHkwID0gdmVydGljaWVzW2luZGV4KzFdLCB5MSA9IHZlcnRpY2llc1tpbmRleCszXSwgeTIgPSB2ZXJ0aWNpZXNbaW5kZXgrNV07XG5cbiAgICAgICAgY29udGV4dC5tb3ZlVG8oeDAsIHkwKTtcbiAgICAgICAgY29udGV4dC5saW5lVG8oeDEsIHkxKTtcbiAgICAgICAgY29udGV4dC5saW5lVG8oeDIsIHkyKTtcbiAgICB9XG5cbiAgICBjb250ZXh0LmZpbGxTdHlsZSA9ICcjRkYwMDAwJztcbiAgICBjb250ZXh0LmZpbGwoKTtcbiAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xufTtcblxuLyoqXG4gKiBSZW5kZXJzIGEgdGlsaW5nIHNwcml0ZVxuICpcbiAqIEBtZXRob2QgcmVuZGVyVGlsaW5nU3ByaXRlXG4gKiBAcGFyYW0gc3ByaXRlIHtUaWxpbmdTcHJpdGV9IFRoZSB0aWxpbmdzcHJpdGUgdG8gcmVuZGVyXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJUaWxpbmdTcHJpdGUgPSBmdW5jdGlvbiByZW5kZXJUaWxpbmdTcHJpdGUoc3ByaXRlKVxue1xuICAgIHZhciBjb250ZXh0ID0gdGhpcy5jb250ZXh0O1xuXG4gICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IHNwcml0ZS53b3JsZEFscGhhO1xuXG4gICAgaWYoIXNwcml0ZS5fX3RpbGVQYXR0ZXJuKVxuICAgICAgICBzcHJpdGUuX190aWxlUGF0dGVybiA9IGNvbnRleHQuY3JlYXRlUGF0dGVybihzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5zb3VyY2UsICdyZXBlYXQnKTtcblxuICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG5cbiAgICB2YXIgdGlsZVBvc2l0aW9uID0gc3ByaXRlLnRpbGVQb3NpdGlvbjtcbiAgICB2YXIgdGlsZVNjYWxlID0gc3ByaXRlLnRpbGVTY2FsZTtcblxuICAgIC8vIG9mZnNldFxuICAgIGNvbnRleHQuc2NhbGUodGlsZVNjYWxlLngsdGlsZVNjYWxlLnkpO1xuICAgIGNvbnRleHQudHJhbnNsYXRlKHRpbGVQb3NpdGlvbi54LCB0aWxlUG9zaXRpb24ueSk7XG5cbiAgICBjb250ZXh0LmZpbGxTdHlsZSA9IHNwcml0ZS5fX3RpbGVQYXR0ZXJuO1xuICAgIGNvbnRleHQuZmlsbFJlY3QoLXRpbGVQb3NpdGlvbi54LC10aWxlUG9zaXRpb24ueSxzcHJpdGUud2lkdGggLyB0aWxlU2NhbGUueCwgc3ByaXRlLmhlaWdodCAvIHRpbGVTY2FsZS55KTtcblxuICAgIGNvbnRleHQuc2NhbGUoMS90aWxlU2NhbGUueCwgMS90aWxlU2NhbGUueSk7XG4gICAgY29udGV4dC50cmFuc2xhdGUoLXRpbGVQb3NpdGlvbi54LCAtdGlsZVBvc2l0aW9uLnkpO1xuXG4gICAgY29udGV4dC5jbG9zZVBhdGgoKTtcbn07XG5cbi8qKlxuICogUmVuZGVycyBhIHN0cmlwXG4gKlxuICogQG1ldGhvZCByZW5kZXJTdHJpcFxuICogQHBhcmFtIHN0cmlwIHtTdHJpcH0gVGhlIFN0cmlwIHRvIHJlbmRlclxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyU3RyaXAgPSBmdW5jdGlvbiByZW5kZXJTdHJpcChzdHJpcClcbntcbiAgICB2YXIgY29udGV4dCA9IHRoaXMuY29udGV4dDtcblxuICAgIC8vIGRyYXcgdHJpYW5nbGVzISFcbiAgICB2YXIgdmVydGljaWVzID0gc3RyaXAudmVydGljaWVzO1xuICAgIHZhciB1dnMgPSBzdHJpcC51dnM7XG5cbiAgICB2YXIgbGVuZ3RoID0gdmVydGljaWVzLmxlbmd0aC8yO1xuICAgIHRoaXMuY291bnQrKztcblxuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbGVuZ3RoLTI7IGkrKylcbiAgICB7XG4gICAgICAgIC8vIGRyYXcgc29tZSB0cmlhbmdsZXMhXG4gICAgICAgIHZhciBpbmRleCA9IGkqMjtcblxuICAgICAgICB2YXIgeDAgPSB2ZXJ0aWNpZXNbaW5kZXhdLCAgIHgxID0gdmVydGljaWVzW2luZGV4KzJdLCB4MiA9IHZlcnRpY2llc1tpbmRleCs0XTtcbiAgICAgICAgdmFyIHkwID0gdmVydGljaWVzW2luZGV4KzFdLCB5MSA9IHZlcnRpY2llc1tpbmRleCszXSwgeTIgPSB2ZXJ0aWNpZXNbaW5kZXgrNV07XG5cbiAgICAgICAgdmFyIHUwID0gdXZzW2luZGV4XSAqIHN0cmlwLnRleHR1cmUud2lkdGgsICAgdTEgPSB1dnNbaW5kZXgrMl0gKiBzdHJpcC50ZXh0dXJlLndpZHRoLCB1MiA9IHV2c1tpbmRleCs0XSogc3RyaXAudGV4dHVyZS53aWR0aDtcbiAgICAgICAgdmFyIHYwID0gdXZzW2luZGV4KzFdKiBzdHJpcC50ZXh0dXJlLmhlaWdodCwgdjEgPSB1dnNbaW5kZXgrM10gKiBzdHJpcC50ZXh0dXJlLmhlaWdodCwgdjIgPSB1dnNbaW5kZXgrNV0qIHN0cmlwLnRleHR1cmUuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnRleHQuc2F2ZSgpO1xuICAgICAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuICAgICAgICBjb250ZXh0Lm1vdmVUbyh4MCwgeTApO1xuICAgICAgICBjb250ZXh0LmxpbmVUbyh4MSwgeTEpO1xuICAgICAgICBjb250ZXh0LmxpbmVUbyh4MiwgeTIpO1xuICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuXG4gICAgICAgIGNvbnRleHQuY2xpcCgpO1xuXG4gICAgICAgIC8vIENvbXB1dGUgbWF0cml4IHRyYW5zZm9ybVxuICAgICAgICB2YXIgZGVsdGEgPSB1MCp2MSArIHYwKnUyICsgdTEqdjIgLSB2MSp1MiAtIHYwKnUxIC0gdTAqdjI7XG4gICAgICAgIHZhciBkZWx0YUEgPSB4MCp2MSArIHYwKngyICsgeDEqdjIgLSB2MSp4MiAtIHYwKngxIC0geDAqdjI7XG4gICAgICAgIHZhciBkZWx0YUIgPSB1MCp4MSArIHgwKnUyICsgdTEqeDIgLSB4MSp1MiAtIHgwKnUxIC0gdTAqeDI7XG4gICAgICAgIHZhciBkZWx0YUMgPSB1MCp2MSp4MiArIHYwKngxKnUyICsgeDAqdTEqdjIgLSB4MCp2MSp1MiAtIHYwKnUxKngyIC0gdTAqeDEqdjI7XG4gICAgICAgIHZhciBkZWx0YUQgPSB5MCp2MSArIHYwKnkyICsgeTEqdjIgLSB2MSp5MiAtIHYwKnkxIC0geTAqdjI7XG4gICAgICAgIHZhciBkZWx0YUUgPSB1MCp5MSArIHkwKnUyICsgdTEqeTIgLSB5MSp1MiAtIHkwKnUxIC0gdTAqeTI7XG4gICAgICAgIHZhciBkZWx0YUYgPSB1MCp2MSp5MiArIHYwKnkxKnUyICsgeTAqdTEqdjIgLSB5MCp2MSp1MiAtIHYwKnUxKnkyIC0gdTAqeTEqdjI7XG5cbiAgICAgICAgY29udGV4dC50cmFuc2Zvcm0oZGVsdGFBIC8gZGVsdGEsIGRlbHRhRCAvIGRlbHRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbHRhQiAvIGRlbHRhLCBkZWx0YUUgLyBkZWx0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWx0YUMgLyBkZWx0YSwgZGVsdGFGIC8gZGVsdGEpO1xuXG4gICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKHN0cmlwLnRleHR1cmUuYmFzZVRleHR1cmUuc291cmNlLCAwLCAwKTtcbiAgICAgICAgY29udGV4dC5yZXN0b3JlKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW52YXNSZW5kZXJlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vLi4vcGxhdGZvcm0nKTtcbnZhciBHcmFwaGljcyA9IHJlcXVpcmUoJy4uLy4uL3ByaW1pdGl2ZXMvR3JhcGhpY3MnKTtcblxuLyoqXG4gKiBBIHNldCBvZiBmdW5jdGlvbnMgdXNlZCBieSB0aGUgY2FudmFzIHJlbmRlcmVyIHRvIGRyYXcgdGhlIHByaW1pdGl2ZSBncmFwaGljcyBkYXRhXG4gKlxuICogQG1vZHVsZSByZW5kZXJlcnMvY2FudmFzL2dyYXBoaWNzXG4gKi9cblxuLypcbiAqIFJlbmRlcnMgdGhlIGdyYXBoaWNzIG9iamVjdFxuICpcbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIHJlbmRlckdyYXBoaWNzXG4gKiBAcGFyYW0gZ3JhcGhpY3Mge0dyYXBoaWNzfVxuICogQHBhcmFtIGNvbnRleHQge0NvbnRleHQyRH1cbiAqL1xuZXhwb3J0cy5yZW5kZXJHcmFwaGljcyA9IGZ1bmN0aW9uIHJlbmRlckdyYXBoaWNzKGdyYXBoaWNzLCBjb250ZXh0KVxue1xuICAgIHZhciB3b3JsZEFscGhhID0gZ3JhcGhpY3Mud29ybGRBbHBoYSxcbiAgICAgICAgY29sb3IgPSAnJyxcbiAgICAgICAgZGF0YSwgcG9pbnRzLCBpaSwgbGw7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGdyYXBoaWNzLmdyYXBoaWNzRGF0YS5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICBkYXRhID0gZ3JhcGhpY3MuZ3JhcGhpY3NEYXRhW2ldO1xuICAgICAgICBwb2ludHMgPSBkYXRhLnBvaW50cztcblxuICAgICAgICBjb2xvciA9IGNvbnRleHQuc3Ryb2tlU3R5bGUgPSAnIycgKyAoJzAwMDAwJyArICggZGF0YS5saW5lQ29sb3IgfCAwKS50b1N0cmluZygxNikpLnN1YnN0cigtNik7XG5cbiAgICAgICAgY29udGV4dC5saW5lV2lkdGggPSBkYXRhLmxpbmVXaWR0aDtcblxuICAgICAgICBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLlBPTFkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgICAgIGNvbnRleHQubW92ZVRvKHBvaW50c1swXSwgcG9pbnRzWzFdKTtcblxuICAgICAgICAgICAgZm9yIChpaSA9IDEsIGxsID0gcG9pbnRzLmxlbmd0aCAvIDI7IGlpIDwgbGw7IGlpKyspXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5saW5lVG8ocG9pbnRzW2lpICogMl0sIHBvaW50c1tpaSAqIDIgKyAxXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBmaXJzdCBhbmQgbGFzdCBwb2ludCBhcmUgdGhlIHNhbWUgY2xvc2UgdGhlIHBhdGggLSBtdWNoIG5lYXRlciA6KVxuICAgICAgICAgICAgaWYocG9pbnRzWzBdID09PSBwb2ludHNbcG9pbnRzLmxlbmd0aC0yXSAmJiBwb2ludHNbMV0gPT09IHBvaW50c1twb2ludHMubGVuZ3RoLTFdKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuY2xvc2VQYXRoKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGRhdGEuZmlsbClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5maWxsQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbFN0eWxlID0gY29sb3IgPSAnIycgKyAoJzAwMDAwJyArICggZGF0YS5maWxsQ29sb3IgfCAwKS50b1N0cmluZygxNikpLnN1YnN0cigtNik7XG4gICAgICAgICAgICAgICAgY29udGV4dC5maWxsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihkYXRhLmxpbmVXaWR0aClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5saW5lQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuc3Ryb2tlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLlJFQ1QpXG4gICAgICAgIHtcblxuICAgICAgICAgICAgaWYoZGF0YS5maWxsQ29sb3IgfHwgZGF0YS5maWxsQ29sb3IgPT09IDApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRhdGEuZmlsbEFscGhhICogd29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmZpbGxTdHlsZSA9IGNvbG9yID0gJyMnICsgKCcwMDAwMCcgKyAoIGRhdGEuZmlsbENvbG9yIHwgMCkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTYpO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbFJlY3QocG9pbnRzWzBdLCBwb2ludHNbMV0sIHBvaW50c1syXSwgcG9pbnRzWzNdKTtcblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoZGF0YS5saW5lV2lkdGgpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRhdGEubGluZUFscGhhICogd29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LnN0cm9rZVJlY3QocG9pbnRzWzBdLCBwb2ludHNbMV0sIHBvaW50c1syXSwgcG9pbnRzWzNdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5DSVJDKVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBUT0RPIC0gbmVlZCB0byBiZSBVbmRlZmluZWQhXG4gICAgICAgICAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuICAgICAgICAgICAgY29udGV4dC5hcmMocG9pbnRzWzBdLCBwb2ludHNbMV0sIHBvaW50c1syXSwwLDIqTWF0aC5QSSk7XG4gICAgICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuXG4gICAgICAgICAgICBpZihkYXRhLmZpbGwpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRhdGEuZmlsbEFscGhhICogd29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmZpbGxTdHlsZSA9IGNvbG9yID0gJyMnICsgKCcwMDAwMCcgKyAoIGRhdGEuZmlsbENvbG9yIHwgMCkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTYpO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoZGF0YS5saW5lV2lkdGgpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRhdGEubGluZUFscGhhICogd29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LnN0cm9rZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5FTElQKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIC8vIGVsbGlwc2UgY29kZSB0YWtlbiBmcm9tOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzIxNzI3OTgvaG93LXRvLWRyYXctYW4tb3ZhbC1pbi1odG1sNS1jYW52YXNcblxuICAgICAgICAgICAgdmFyIGVsbGlwc2VEYXRhID0gIGRhdGEucG9pbnRzO1xuXG4gICAgICAgICAgICB2YXIgdyA9IGVsbGlwc2VEYXRhWzJdICogMjtcbiAgICAgICAgICAgIHZhciBoID0gZWxsaXBzZURhdGFbM10gKiAyO1xuXG4gICAgICAgICAgICB2YXIgeCA9IGVsbGlwc2VEYXRhWzBdIC0gdy8yO1xuICAgICAgICAgICAgdmFyIHkgPSBlbGxpcHNlRGF0YVsxXSAtIGgvMjtcblxuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcblxuICAgICAgICAgICAgdmFyIGthcHBhID0gMC41NTIyODQ4LFxuICAgICAgICAgICAgICAgIG94ID0gKHcgLyAyKSAqIGthcHBhLCAvLyBjb250cm9sIHBvaW50IG9mZnNldCBob3Jpem9udGFsXG4gICAgICAgICAgICAgICAgb3kgPSAoaCAvIDIpICoga2FwcGEsIC8vIGNvbnRyb2wgcG9pbnQgb2Zmc2V0IHZlcnRpY2FsXG4gICAgICAgICAgICAgICAgeGUgPSB4ICsgdywgICAgICAgICAgIC8vIHgtZW5kXG4gICAgICAgICAgICAgICAgeWUgPSB5ICsgaCwgICAgICAgICAgIC8vIHktZW5kXG4gICAgICAgICAgICAgICAgeG0gPSB4ICsgdyAvIDIsICAgICAgIC8vIHgtbWlkZGxlXG4gICAgICAgICAgICAgICAgeW0gPSB5ICsgaCAvIDI7ICAgICAgIC8vIHktbWlkZGxlXG5cbiAgICAgICAgICAgIGNvbnRleHQubW92ZVRvKHgsIHltKTtcbiAgICAgICAgICAgIGNvbnRleHQuYmV6aWVyQ3VydmVUbyh4LCB5bSAtIG95LCB4bSAtIG94LCB5LCB4bSwgeSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeG0gKyBveCwgeSwgeGUsIHltIC0gb3ksIHhlLCB5bSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeGUsIHltICsgb3ksIHhtICsgb3gsIHllLCB4bSwgeWUpO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhtIC0gb3gsIHllLCB4LCB5bSArIG95LCB4LCB5bSk7XG5cbiAgICAgICAgICAgIGNvbnRleHQuY2xvc2VQYXRoKCk7XG5cbiAgICAgICAgICAgIGlmKGRhdGEuZmlsbClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5maWxsQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbFN0eWxlID0gY29sb3IgPSAnIycgKyAoJzAwMDAwJyArICggZGF0YS5maWxsQ29sb3IgfCAwKS50b1N0cmluZygxNikpLnN1YnN0cigtNik7XG4gICAgICAgICAgICAgICAgY29udGV4dC5maWxsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihkYXRhLmxpbmVXaWR0aClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gZGF0YS5saW5lQWxwaGEgKiB3b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuc3Ryb2tlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKlxuICogUmVuZGVycyBhIGdyYXBoaWNzIG1hc2tcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCByZW5kZXJHcmFwaGljc01hc2tcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gY29udGV4dCB7Q29udGV4dDJEfVxuICovXG5leHBvcnRzLnJlbmRlckdyYXBoaWNzTWFzayA9IGZ1bmN0aW9uIHJlbmRlckdyYXBoaWNzTWFzayhncmFwaGljcywgY29udGV4dClcbntcbiAgICB2YXIgbGVuID0gZ3JhcGhpY3MuZ3JhcGhpY3NEYXRhLmxlbmd0aDtcblxuICAgIGlmKGxlbiA9PT0gMCkgcmV0dXJuO1xuXG4gICAgaWYobGVuID4gMSlcbiAgICB7XG4gICAgICAgIGxlbiA9IDE7XG4gICAgICAgIHBsYXRmb3JtLmNvbnNvbGUud2FybignUGl4aS5qcyB3YXJuaW5nOiBtYXNrcyBpbiBjYW52YXMgY2FuIG9ubHkgbWFzayB1c2luZyB0aGUgZmlyc3QgcGF0aCBpbiB0aGUgZ3JhcGhpY3Mgb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCAxOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgZGF0YSA9IGdyYXBoaWNzLmdyYXBoaWNzRGF0YVtpXTtcbiAgICAgICAgdmFyIHBvaW50cyA9IGRhdGEucG9pbnRzO1xuXG4gICAgICAgIGlmKGRhdGEudHlwZSA9PT0gR3JhcGhpY3MuUE9MWSlcbiAgICAgICAge1xuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcbiAgICAgICAgICAgIGNvbnRleHQubW92ZVRvKHBvaW50c1swXSwgcG9pbnRzWzFdKTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaj0xOyBqIDwgcG9pbnRzLmxlbmd0aC8yOyBqKyspXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5saW5lVG8ocG9pbnRzW2ogKiAyXSwgcG9pbnRzW2ogKiAyICsgMV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGUgZmlyc3QgYW5kIGxhc3QgcG9pbnQgYXJlIHRoZSBzYW1lIGNsb3NlIHRoZSBwYXRoIC0gbXVjaCBuZWF0ZXIgOilcbiAgICAgICAgICAgIGlmKHBvaW50c1swXSA9PT0gcG9pbnRzW3BvaW50cy5sZW5ndGgtMl0gJiYgcG9pbnRzWzFdID09PSBwb2ludHNbcG9pbnRzLmxlbmd0aC0xXSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLlJFQ1QpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG4gICAgICAgICAgICBjb250ZXh0LnJlY3QocG9pbnRzWzBdLCBwb2ludHNbMV0sIHBvaW50c1syXSwgcG9pbnRzWzNdKTtcbiAgICAgICAgICAgIGNvbnRleHQuY2xvc2VQYXRoKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLkNJUkMpXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIFRPRE8gLSBuZWVkIHRvIGJlIFVuZGVmaW5lZCFcbiAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG4gICAgICAgICAgICBjb250ZXh0LmFyYyhwb2ludHNbMF0sIHBvaW50c1sxXSwgcG9pbnRzWzJdLDAsMipNYXRoLlBJKTtcbiAgICAgICAgICAgIGNvbnRleHQuY2xvc2VQYXRoKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLkVMSVApXG4gICAgICAgIHtcblxuICAgICAgICAgICAgLy8gZWxsaXBzZSBjb2RlIHRha2VuIGZyb206IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjE3Mjc5OC9ob3ctdG8tZHJhdy1hbi1vdmFsLWluLWh0bWw1LWNhbnZhc1xuICAgICAgICAgICAgdmFyIGVsbGlwc2VEYXRhID0gIGRhdGEucG9pbnRzO1xuXG4gICAgICAgICAgICB2YXIgdyA9IGVsbGlwc2VEYXRhWzJdICogMjtcbiAgICAgICAgICAgIHZhciBoID0gZWxsaXBzZURhdGFbM10gKiAyO1xuXG4gICAgICAgICAgICB2YXIgeCA9IGVsbGlwc2VEYXRhWzBdIC0gdy8yO1xuICAgICAgICAgICAgdmFyIHkgPSBlbGxpcHNlRGF0YVsxXSAtIGgvMjtcblxuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcblxuICAgICAgICAgICAgdmFyIGthcHBhID0gMC41NTIyODQ4LFxuICAgICAgICAgICAgICAgIG94ID0gKHcgLyAyKSAqIGthcHBhLCAvLyBjb250cm9sIHBvaW50IG9mZnNldCBob3Jpem9udGFsXG4gICAgICAgICAgICAgICAgb3kgPSAoaCAvIDIpICoga2FwcGEsIC8vIGNvbnRyb2wgcG9pbnQgb2Zmc2V0IHZlcnRpY2FsXG4gICAgICAgICAgICAgICAgeGUgPSB4ICsgdywgICAgICAgICAgIC8vIHgtZW5kXG4gICAgICAgICAgICAgICAgeWUgPSB5ICsgaCwgICAgICAgICAgIC8vIHktZW5kXG4gICAgICAgICAgICAgICAgeG0gPSB4ICsgdyAvIDIsICAgICAgIC8vIHgtbWlkZGxlXG4gICAgICAgICAgICAgICAgeW0gPSB5ICsgaCAvIDI7ICAgICAgIC8vIHktbWlkZGxlXG5cbiAgICAgICAgICAgIGNvbnRleHQubW92ZVRvKHgsIHltKTtcbiAgICAgICAgICAgIGNvbnRleHQuYmV6aWVyQ3VydmVUbyh4LCB5bSAtIG95LCB4bSAtIG94LCB5LCB4bSwgeSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeG0gKyBveCwgeSwgeGUsIHltIC0gb3ksIHhlLCB5bSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeGUsIHltICsgb3ksIHhtICsgb3gsIHllLCB4bSwgeWUpO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhtIC0gb3gsIHllLCB4LCB5bSArIG95LCB4LCB5bSk7XG4gICAgICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuICAgICAgICB9XG4gICAgfVxufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKiBAYXV0aG9yIFJpY2hhcmQgRGF2ZXkgaHR0cDovL3d3dy5waG90b25zdG9ybS5jb20gQHBob3RvbnN0b3JtXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGNvbXBpbGUgPSByZXF1aXJlKCcuL2NvbXBpbGUnKTtcbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFBpeGlTaGFkZXIoKVxue1xuICAgIC8qKlxuICAgICogQHByb3BlcnR5IHthbnl9IHByb2dyYW0gLSBUaGUgV2ViR0wgcHJvZ3JhbS5cbiAgICAqL1xuICAgIHRoaXMucHJvZ3JhbSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAqIEBwcm9wZXJ0eSB7YXJyYXl9IGZyYWdtZW50U3JjIC0gVGhlIGZyYWdtZW50IHNoYWRlci5cbiAgICAqL1xuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbG93cCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKSAqIHZDb2xvcjsnLFxuICAgICAgICAnfSdcbiAgICBdO1xuXG4gICAgLyoqXG4gICAgKiBAcHJvcGVydHkge251bWJlcn0gdGV4dHVyZUNvdW50IC0gQSBsb2NhbCB0ZXh0dXJlIGNvdW50ZXIgZm9yIG11bHRpLXRleHR1cmUgc2hhZGVycy5cbiAgICAqL1xuICAgIHRoaXMudGV4dHVyZUNvdW50ID0gMDtcbn1cblxudmFyIHByb3RvID0gUGl4aVNoYWRlci5wcm90b3R5cGU7XG5cbnByb3RvLmluaXQgPSBmdW5jdGlvbiBpbml0KClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuICAgIHZhciBwcm9ncmFtID0gY29tcGlsZS5wcm9ncmFtKGdsLCB0aGlzLnZlcnRleFNyYyB8fCBQaXhpU2hhZGVyLmRlZmF1bHRWZXJ0ZXhTcmMsIHRoaXMuZnJhZ21lbnRTcmMpO1xuXG4gICAgZ2wudXNlUHJvZ3JhbShwcm9ncmFtKTtcblxuICAgIC8vIGdldCBhbmQgc3RvcmUgdGhlIHVuaWZvcm1zIGZvciB0aGUgc2hhZGVyXG4gICAgdGhpcy51U2FtcGxlciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAndVNhbXBsZXInKTtcbiAgICB0aGlzLnByb2plY3Rpb25WZWN0b3IgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgJ3Byb2plY3Rpb25WZWN0b3InKTtcbiAgICB0aGlzLm9mZnNldFZlY3RvciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAnb2Zmc2V0VmVjdG9yJyk7XG4gICAgdGhpcy5kaW1lbnNpb25zID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICdkaW1lbnNpb25zJyk7XG5cbiAgICAvLyBnZXQgYW5kIHN0b3JlIHRoZSBhdHRyaWJ1dGVzXG4gICAgdGhpcy5hVmVydGV4UG9zaXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCAnYVZlcnRleFBvc2l0aW9uJyk7XG4gICAgdGhpcy5jb2xvckF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sICdhQ29sb3InKTtcbiAgICB0aGlzLmFUZXh0dXJlQ29vcmQgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCAnYVRleHR1cmVDb29yZCcpO1xuXG4gICAgLy8gYWRkIHRob3NlIGN1c3RvbSBzaGFkZXJzIVxuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLnVuaWZvcm1zKVxuICAgIHtcbiAgICAgICAgLy8gZ2V0IHRoZSB1bmlmb3JtIGxvY2F0aW9ucy4uXG4gICAgICAgIHRoaXMudW5pZm9ybXNba2V5XS51bmlmb3JtTG9jYXRpb24gPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwga2V5KTtcbiAgICB9XG5cbiAgICB0aGlzLmluaXRVbmlmb3JtcygpO1xuXG4gICAgdGhpcy5wcm9ncmFtID0gcHJvZ3JhbTtcbn07XG5cbi8qKlxuICogSW5pdGlhbGlzZXMgdGhlIHNoYWRlciB1bmlmb3JtIHZhbHVlcy5cbiAqIFVuaWZvcm1zIGFyZSBzcGVjaWZpZWQgaW4gdGhlIEdMU0xfRVMgU3BlY2lmaWNhdGlvbjogaHR0cDovL3d3dy5raHJvbm9zLm9yZy9yZWdpc3RyeS93ZWJnbC9zcGVjcy9sYXRlc3QvMS4wL1xuICogaHR0cDovL3d3dy5raHJvbm9zLm9yZy9yZWdpc3RyeS9nbGVzL3NwZWNzLzIuMC9HTFNMX0VTX1NwZWNpZmljYXRpb25fMS4wLjE3LnBkZlxuICovXG5wcm90by5pbml0VW5pZm9ybXMgPSBmdW5jdGlvbiBpbml0VW5pZm9ybXMoKVxue1xuICAgIHRoaXMudGV4dHVyZUNvdW50ID0gMTtcblxuICAgIHZhciB1bmlmb3JtO1xuXG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMudW5pZm9ybXMpXG4gICAge1xuICAgICAgICB1bmlmb3JtID0gdGhpcy51bmlmb3Jtc1trZXldO1xuXG4gICAgICAgIHZhciB0eXBlID0gdW5pZm9ybS50eXBlO1xuXG4gICAgICAgIGlmICh0eXBlID09PSAnc2FtcGxlcjJEJylcbiAgICAgICAge1xuICAgICAgICAgICAgdW5pZm9ybS5faW5pdCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAodW5pZm9ybS52YWx1ZSAhPT0gbnVsbClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluaXRTYW1wbGVyMkQodW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZSA9PT0gJ21hdDInIHx8IHR5cGUgPT09ICdtYXQzJyB8fCB0eXBlID09PSAnbWF0NCcpXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vICBUaGVzZSByZXF1aXJlIHNwZWNpYWwgaGFuZGxpbmdcbiAgICAgICAgICAgIHVuaWZvcm0uZ2xNYXRyaXggPSB0cnVlO1xuICAgICAgICAgICAgdW5pZm9ybS5nbFZhbHVlTGVuZ3RoID0gMTtcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdtYXQyJylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLmdsRnVuYyA9IGdsb2JhbHMuZ2wudW5pZm9ybU1hdHJpeDJmdjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICdtYXQzJylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLmdsRnVuYyA9IGdsb2JhbHMuZ2wudW5pZm9ybU1hdHJpeDNmdjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICdtYXQ0JylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLmdsRnVuYyA9IGdsb2JhbHMuZ2wudW5pZm9ybU1hdHJpeDRmdjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vICBHTCBmdW5jdGlvbiByZWZlcmVuY2VcbiAgICAgICAgICAgIHVuaWZvcm0uZ2xGdW5jID0gZ2xvYmFscy5nbFsndW5pZm9ybScgKyB0eXBlXTtcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICcyZicgfHwgdHlwZSA9PT0gJzJpJylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLmdsVmFsdWVMZW5ndGggPSAyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZSA9PT0gJzNmJyB8fCB0eXBlID09PSAnM2knKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVuaWZvcm0uZ2xWYWx1ZUxlbmd0aCA9IDM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlID09PSAnNGYnIHx8IHR5cGUgPT09ICc0aScpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS5nbFZhbHVlTGVuZ3RoID0gNDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLmdsVmFsdWVMZW5ndGggPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG59O1xuXG4vKipcbiAqIEluaXRpYWxpc2VzIGEgU2FtcGxlcjJEIHVuaWZvcm1cbiAqICh3aGljaCBtYXkgb25seSBiZSBhdmFpbGFibGUgbGF0ZXIgb24gYWZ0ZXIgaW5pdFVuaWZvcm1zIG9uY2UgdGhlIHRleHR1cmUgaXMgaGFzIGxvYWRlZClcbiAqL1xucHJvdG8uaW5pdFNhbXBsZXIyRCA9IGZ1bmN0aW9uIGluaXRTYW1wbGVyMkQodW5pZm9ybSlcbntcbiAgICBpZiAoIXVuaWZvcm0udmFsdWUgfHwgIXVuaWZvcm0udmFsdWUuYmFzZVRleHR1cmUgfHwgIXVuaWZvcm0udmFsdWUuYmFzZVRleHR1cmUuaGFzTG9hZGVkKVxuICAgIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdsb2JhbHMuZ2wuYWN0aXZlVGV4dHVyZShnbG9iYWxzLmdsWydURVhUVVJFJyArIHRoaXMudGV4dHVyZUNvdW50XSk7XG4gICAgZ2xvYmFscy5nbC5iaW5kVGV4dHVyZShnbG9iYWxzLmdsLlRFWFRVUkVfMkQsIHVuaWZvcm0udmFsdWUuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSk7XG5cbiAgICAvLyAgRXh0ZW5kZWQgdGV4dHVyZSBkYXRhXG4gICAgaWYgKHVuaWZvcm0udGV4dHVyZURhdGEpXG4gICAge1xuICAgICAgICB2YXIgZGF0YSA9IHVuaWZvcm0udGV4dHVyZURhdGE7XG5cbiAgICAgICAgLy8gR0xUZXh0dXJlID0gbWFnIGxpbmVhciwgbWluIGxpbmVhcl9taXBtYXBfbGluZWFyLCB3cmFwIHJlcGVhdCArIGdsLmdlbmVyYXRlTWlwbWFwKGdsLlRFWFRVUkVfMkQpO1xuICAgICAgICAvLyBHTFRleHR1cmVMaW5lYXIgPSBtYWcvbWluIGxpbmVhciwgd3JhcCBjbGFtcFxuICAgICAgICAvLyBHTFRleHR1cmVOZWFyZXN0UmVwZWF0ID0gbWFnL21pbiBORUFSRVNULCB3cmFwIHJlcGVhdFxuICAgICAgICAvLyBHTFRleHR1cmVOZWFyZXN0ID0gbWFnL21pbiBuZWFyZXN0LCB3cmFwIGNsYW1wXG4gICAgICAgIC8vIEF1ZGlvVGV4dHVyZSA9IHdoYXRldmVyICsgbHVtaW5hbmNlICsgd2lkdGggNTEyLCBoZWlnaHQgMiwgYm9yZGVyIDBcbiAgICAgICAgLy8gS2V5VGV4dHVyZSA9IHdoYXRldmVyICsgbHVtaW5hbmNlICsgd2lkdGggMjU2LCBoZWlnaHQgMiwgYm9yZGVyIDBcblxuICAgICAgICAvLyAgbWFnRmlsdGVyIGNhbiBiZTogZ2wuTElORUFSLCBnbC5MSU5FQVJfTUlQTUFQX0xJTkVBUiBvciBnbC5ORUFSRVNUXG4gICAgICAgIC8vICB3cmFwUy9UIGNhbiBiZTogZ2wuQ0xBTVBfVE9fRURHRSBvciBnbC5SRVBFQVRcblxuICAgICAgICB2YXIgbWFnRmlsdGVyID0gKGRhdGEubWFnRmlsdGVyKSA/IGRhdGEubWFnRmlsdGVyIDogZ2xvYmFscy5nbC5MSU5FQVI7XG4gICAgICAgIHZhciBtaW5GaWx0ZXIgPSAoZGF0YS5taW5GaWx0ZXIpID8gZGF0YS5taW5GaWx0ZXIgOiBnbG9iYWxzLmdsLkxJTkVBUjtcbiAgICAgICAgdmFyIHdyYXBTID0gKGRhdGEud3JhcFMpID8gZGF0YS53cmFwUyA6IGdsb2JhbHMuZ2wuQ0xBTVBfVE9fRURHRTtcbiAgICAgICAgdmFyIHdyYXBUID0gKGRhdGEud3JhcFQpID8gZGF0YS53cmFwVCA6IGdsb2JhbHMuZ2wuQ0xBTVBfVE9fRURHRTtcbiAgICAgICAgdmFyIGZvcm1hdCA9IChkYXRhLmx1bWluYW5jZSkgPyBnbG9iYWxzLmdsLkxVTUlOQU5DRSA6IGdsb2JhbHMuZ2wuUkdCQTtcblxuICAgICAgICBpZiAoZGF0YS5yZXBlYXQpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHdyYXBTID0gZ2xvYmFscy5nbC5SRVBFQVQ7XG4gICAgICAgICAgICB3cmFwVCA9IGdsb2JhbHMuZ2wuUkVQRUFUO1xuICAgICAgICB9XG5cbiAgICAgICAgZ2xvYmFscy5nbC5waXhlbFN0b3JlaShnbG9iYWxzLmdsLlVOUEFDS19GTElQX1lfV0VCR0wsIGZhbHNlKTtcblxuICAgICAgICBpZiAoZGF0YS53aWR0aClcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIHdpZHRoID0gKGRhdGEud2lkdGgpID8gZGF0YS53aWR0aCA6IDUxMjtcbiAgICAgICAgICAgIHZhciBoZWlnaHQgPSAoZGF0YS5oZWlnaHQpID8gZGF0YS5oZWlnaHQgOiAyO1xuICAgICAgICAgICAgdmFyIGJvcmRlciA9IChkYXRhLmJvcmRlcikgPyBkYXRhLmJvcmRlciA6IDA7XG5cbiAgICAgICAgICAgIC8vIHZvaWQgdGV4SW1hZ2UyRChHTGVudW0gdGFyZ2V0LCBHTGludCBsZXZlbCwgR0xlbnVtIGludGVybmFsZm9ybWF0LCBHTHNpemVpIHdpZHRoLCBHTHNpemVpIGhlaWdodCwgR0xpbnQgYm9yZGVyLCBHTGVudW0gZm9ybWF0LCBHTGVudW0gdHlwZSwgQXJyYXlCdWZmZXJWaWV3PyBwaXhlbHMpO1xuICAgICAgICAgICAgZ2xvYmFscy5nbC50ZXhJbWFnZTJEKGdsb2JhbHMuZ2wuVEVYVFVSRV8yRCwgMCwgZm9ybWF0LCB3aWR0aCwgaGVpZ2h0LCBib3JkZXIsIGZvcm1hdCwgZ2xvYmFscy5nbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vICB2b2lkIHRleEltYWdlMkQoR0xlbnVtIHRhcmdldCwgR0xpbnQgbGV2ZWwsIEdMZW51bSBpbnRlcm5hbGZvcm1hdCwgR0xlbnVtIGZvcm1hdCwgR0xlbnVtIHR5cGUsIEltYWdlRGF0YT8gcGl4ZWxzKTtcbiAgICAgICAgICAgIGdsb2JhbHMuZ2wudGV4SW1hZ2UyRChnbG9iYWxzLmdsLlRFWFRVUkVfMkQsIDAsIGZvcm1hdCwgZ2xvYmFscy5nbC5SR0JBLCBnbG9iYWxzLmdsLlVOU0lHTkVEX0JZVEUsIHVuaWZvcm0udmFsdWUuYmFzZVRleHR1cmUuc291cmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGdsb2JhbHMuZ2wudGV4UGFyYW1ldGVyaShnbG9iYWxzLmdsLlRFWFRVUkVfMkQsIGdsb2JhbHMuZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBtYWdGaWx0ZXIpO1xuICAgICAgICBnbG9iYWxzLmdsLnRleFBhcmFtZXRlcmkoZ2xvYmFscy5nbC5URVhUVVJFXzJELCBnbG9iYWxzLmdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgbWluRmlsdGVyKTtcbiAgICAgICAgZ2xvYmFscy5nbC50ZXhQYXJhbWV0ZXJpKGdsb2JhbHMuZ2wuVEVYVFVSRV8yRCwgZ2xvYmFscy5nbC5URVhUVVJFX1dSQVBfUywgd3JhcFMpO1xuICAgICAgICBnbG9iYWxzLmdsLnRleFBhcmFtZXRlcmkoZ2xvYmFscy5nbC5URVhUVVJFXzJELCBnbG9iYWxzLmdsLlRFWFRVUkVfV1JBUF9ULCB3cmFwVCk7XG4gICAgfVxuXG4gICAgZ2xvYmFscy5nbC51bmlmb3JtMWkodW5pZm9ybS51bmlmb3JtTG9jYXRpb24sIHRoaXMudGV4dHVyZUNvdW50KTtcblxuICAgIHVuaWZvcm0uX2luaXQgPSB0cnVlO1xuXG4gICAgdGhpcy50ZXh0dXJlQ291bnQrKztcblxufTtcblxuLyoqXG4gKiBVcGRhdGVzIHRoZSBzaGFkZXIgdW5pZm9ybSB2YWx1ZXMuXG4gKi9cbnByb3RvLnN5bmNVbmlmb3JtcyA9IGZ1bmN0aW9uIHN5bmNVbmlmb3JtcygpXG57XG4gICAgdGhpcy50ZXh0dXJlQ291bnQgPSAxO1xuICAgIHZhciB1bmlmb3JtO1xuXG4gICAgLy8gIFRoaXMgd291bGQgcHJvYmFibHkgYmUgZmFzdGVyIGluIGFuIGFycmF5IGFuZCBpdCB3b3VsZCBndWFyYW50ZWUga2V5IG9yZGVyXG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMudW5pZm9ybXMpXG4gICAge1xuXG4gICAgICAgIHVuaWZvcm0gPSB0aGlzLnVuaWZvcm1zW2tleV07XG5cbiAgICAgICAgaWYgKHVuaWZvcm0uZ2xWYWx1ZUxlbmd0aCA9PT0gMSlcbiAgICAgICAge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0uZ2xNYXRyaXggPT09IHRydWUpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS5nbEZ1bmMuY2FsbChnbG9iYWxzLmdsLCB1bmlmb3JtLnVuaWZvcm1Mb2NhdGlvbiwgdW5pZm9ybS50cmFuc3Bvc2UsIHVuaWZvcm0udmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVuaWZvcm0uZ2xGdW5jLmNhbGwoZ2xvYmFscy5nbCwgdW5pZm9ybS51bmlmb3JtTG9jYXRpb24sIHVuaWZvcm0udmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuaWZvcm0uZ2xWYWx1ZUxlbmd0aCA9PT0gMilcbiAgICAgICAge1xuICAgICAgICAgICAgdW5pZm9ybS5nbEZ1bmMuY2FsbChnbG9iYWxzLmdsLCB1bmlmb3JtLnVuaWZvcm1Mb2NhdGlvbiwgdW5pZm9ybS52YWx1ZS54LCB1bmlmb3JtLnZhbHVlLnkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuaWZvcm0uZ2xWYWx1ZUxlbmd0aCA9PT0gMylcbiAgICAgICAge1xuICAgICAgICAgICAgdW5pZm9ybS5nbEZ1bmMuY2FsbChnbG9iYWxzLmdsLCB1bmlmb3JtLnVuaWZvcm1Mb2NhdGlvbiwgdW5pZm9ybS52YWx1ZS54LCB1bmlmb3JtLnZhbHVlLnksIHVuaWZvcm0udmFsdWUueik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodW5pZm9ybS5nbFZhbHVlTGVuZ3RoID09PSA0KVxuICAgICAgICB7XG4gICAgICAgICAgICB1bmlmb3JtLmdsRnVuYy5jYWxsKGdsb2JhbHMuZ2wsIHVuaWZvcm0udW5pZm9ybUxvY2F0aW9uLCB1bmlmb3JtLnZhbHVlLngsIHVuaWZvcm0udmFsdWUueSwgdW5pZm9ybS52YWx1ZS56LCB1bmlmb3JtLnZhbHVlLncpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuaWZvcm0udHlwZSA9PT0gJ3NhbXBsZXIyRCcpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtLl9pbml0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGdsb2JhbHMuZ2wuYWN0aXZlVGV4dHVyZShnbG9iYWxzLmdsWydURVhUVVJFJyArIHRoaXMudGV4dHVyZUNvdW50XSk7XG4gICAgICAgICAgICAgICAgZ2xvYmFscy5nbC5iaW5kVGV4dHVyZShnbG9iYWxzLmdsLlRFWFRVUkVfMkQsIHVuaWZvcm0udmFsdWUuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgZ2xvYmFscy5nbC51bmlmb3JtMWkodW5pZm9ybS51bmlmb3JtTG9jYXRpb24sIHRoaXMudGV4dHVyZUNvdW50KTtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVDb3VudCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5pdFNhbXBsZXIyRCh1bmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxufTtcblxuUGl4aVNoYWRlci5kZWZhdWx0VmVydGV4U3JjID0gW1xuICAgICdhdHRyaWJ1dGUgdmVjMiBhVmVydGV4UG9zaXRpb247JyxcbiAgICAnYXR0cmlidXRlIHZlYzIgYVRleHR1cmVDb29yZDsnLFxuICAgICdhdHRyaWJ1dGUgZmxvYXQgYUNvbG9yOycsXG5cbiAgICAndW5pZm9ybSB2ZWMyIHByb2plY3Rpb25WZWN0b3I7JyxcbiAgICAndW5pZm9ybSB2ZWMyIG9mZnNldFZlY3RvcjsnLFxuICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuXG4gICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG5cbiAgICAnY29uc3QgdmVjMiBjZW50ZXIgPSB2ZWMyKC0xLjAsIDEuMCk7JyxcblxuICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgJyAgIGdsX1Bvc2l0aW9uID0gdmVjNCggKChhVmVydGV4UG9zaXRpb24gKyBvZmZzZXRWZWN0b3IpIC8gcHJvamVjdGlvblZlY3RvcikgKyBjZW50ZXIgLCAwLjAsIDEuMCk7JyxcbiAgICAnICAgdlRleHR1cmVDb29yZCA9IGFUZXh0dXJlQ29vcmQ7JyxcbiAgICAnICAgdkNvbG9yID0gYUNvbG9yOycsXG4gICAgJ30nXG5dO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBpeGlTaGFkZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBjb21waWxlID0gcmVxdWlyZSgnLi9jb21waWxlJyk7XG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xuXG5mdW5jdGlvbiBQcmltaXRpdmVTaGFkZXIoKVxue1xuICAgIC8vIHRoZSB3ZWJHTCBwcm9ncmFtLi5cbiAgICB0aGlzLnByb2dyYW0gPSBudWxsO1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzQgdkNvbG9yOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHZDb2xvcjsnLFxuICAgICAgICAnfSdcbiAgICBdO1xuXG4gICAgdGhpcy52ZXJ0ZXhTcmMgID0gW1xuICAgICAgICAnYXR0cmlidXRlIHZlYzIgYVZlcnRleFBvc2l0aW9uOycsXG4gICAgICAgICdhdHRyaWJ1dGUgdmVjNCBhQ29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gbWF0MyB0cmFuc2xhdGlvbk1hdHJpeDsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIHByb2plY3Rpb25WZWN0b3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjMiBvZmZzZXRWZWN0b3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgYWxwaGE7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjNCB2Q29sb3I7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgdmVjMyB2ID0gdHJhbnNsYXRpb25NYXRyaXggKiB2ZWMzKGFWZXJ0ZXhQb3NpdGlvbiAsIDEuMCk7JyxcbiAgICAgICAgJyAgIHYgLT0gb2Zmc2V0VmVjdG9yLnh5eDsnLFxuICAgICAgICAnICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCB2LnggLyBwcm9qZWN0aW9uVmVjdG9yLnggLTEuMCwgdi55IC8gLXByb2plY3Rpb25WZWN0b3IueSArIDEuMCAsIDAuMCwgMS4wKTsnLFxuICAgICAgICAnICAgdkNvbG9yID0gYUNvbG9yICAqIGFscGhhOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cblByaW1pdGl2ZVNoYWRlci5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uIGluaXQoKVxue1xuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG4gICAgdmFyIHByb2dyYW0gPSBjb21waWxlLnByb2dyYW0oZ2wsIHRoaXMudmVydGV4U3JjLCB0aGlzLmZyYWdtZW50U3JjKTtcblxuICAgIGdsLnVzZVByb2dyYW0ocHJvZ3JhbSk7XG5cbiAgICAvLyBnZXQgYW5kIHN0b3JlIHRoZSB1bmlmb3JtcyBmb3IgdGhlIHNoYWRlclxuICAgIHRoaXMucHJvamVjdGlvblZlY3RvciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAncHJvamVjdGlvblZlY3RvcicpO1xuICAgIHRoaXMub2Zmc2V0VmVjdG9yID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICdvZmZzZXRWZWN0b3InKTtcblxuICAgIC8vIGdldCBhbmQgc3RvcmUgdGhlIGF0dHJpYnV0ZXNcbiAgICB0aGlzLmFWZXJ0ZXhQb3NpdGlvbiA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sICdhVmVydGV4UG9zaXRpb24nKTtcbiAgICB0aGlzLmNvbG9yQXR0cmlidXRlID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgJ2FDb2xvcicpO1xuXG4gICAgdGhpcy50cmFuc2xhdGlvbk1hdHJpeCA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAndHJhbnNsYXRpb25NYXRyaXgnKTtcbiAgICB0aGlzLmFscGhhID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICdhbHBoYScpO1xuXG4gICAgdGhpcy5wcm9ncmFtID0gcHJvZ3JhbTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUHJpbWl0aXZlU2hhZGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgY29tcGlsZSA9IHJlcXVpcmUoJy4vY29tcGlsZScpO1xudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi8uLi9jb3JlL2dsb2JhbHMnKTtcblxuZnVuY3Rpb24gU3RyaXBTaGFkZXIoKVxue1xuICAgIC8vIHRoZSB3ZWJHTCBwcm9ncmFtLi5cbiAgICB0aGlzLnByb2dyYW0gPSBudWxsO1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgYWxwaGE7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSkpOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSBnbF9GcmFnQ29sb3IgKiBhbHBoYTsnLFxuICAgICAgICAnfSdcbiAgICBdO1xuXG4gICAgdGhpcy52ZXJ0ZXhTcmMgPSBbXG4gICAgICAgICdhdHRyaWJ1dGUgdmVjMiBhVmVydGV4UG9zaXRpb247JyxcbiAgICAgICAgJ2F0dHJpYnV0ZSB2ZWMyIGFUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ2F0dHJpYnV0ZSBmbG9hdCBhQ29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gbWF0MyB0cmFuc2xhdGlvbk1hdHJpeDsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIHByb2plY3Rpb25WZWN0b3I7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgb2Zmc2V0VmVjdG9yOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICB2ZWMzIHYgPSB0cmFuc2xhdGlvbk1hdHJpeCAqIHZlYzMoYVZlcnRleFBvc2l0aW9uLCAxLjApOycsXG4gICAgICAgICcgICB2IC09IG9mZnNldFZlY3Rvci54eXg7JyxcbiAgICAgICAgJyAgIGdsX1Bvc2l0aW9uID0gdmVjNCggdi54IC8gcHJvamVjdGlvblZlY3Rvci54IC0xLjAsIHYueSAvIHByb2plY3Rpb25WZWN0b3IueSArIDEuMCAsIDAuMCwgMS4wKTsnLFxuICAgICAgICAnICAgdlRleHR1cmVDb29yZCA9IGFUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJyAgIHZDb2xvciA9IGFDb2xvcjsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG5TdHJpcFNoYWRlci5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uIGluaXQoKVxue1xuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG4gICAgdmFyIHByb2dyYW0gPSBjb21waWxlLnByb2dyYW0oZ2wsIHRoaXMudmVydGV4U3JjLCB0aGlzLmZyYWdtZW50U3JjKTtcblxuICAgIGdsLnVzZVByb2dyYW0ocHJvZ3JhbSk7XG5cbiAgICAvLyBnZXQgYW5kIHN0b3JlIHRoZSB1bmlmb3JtcyBmb3IgdGhlIHNoYWRlclxuICAgIHRoaXMudVNhbXBsZXIgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgJ3VTYW1wbGVyJyk7XG4gICAgdGhpcy5wcm9qZWN0aW9uVmVjdG9yID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICdwcm9qZWN0aW9uVmVjdG9yJyk7XG4gICAgdGhpcy5vZmZzZXRWZWN0b3IgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgJ29mZnNldFZlY3RvcicpO1xuICAgIHRoaXMuY29sb3JBdHRyaWJ1dGUgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCAnYUNvbG9yJyk7XG4gICAgLy90aGlzLmRpbWVuc2lvbnMgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24odGhpcy5wcm9ncmFtLCAnZGltZW5zaW9ucycpO1xuXG4gICAgLy8gZ2V0IGFuZCBzdG9yZSB0aGUgYXR0cmlidXRlc1xuICAgIHRoaXMuYVZlcnRleFBvc2l0aW9uID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgJ2FWZXJ0ZXhQb3NpdGlvbicpO1xuICAgIHRoaXMuYVRleHR1cmVDb29yZCA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sICdhVGV4dHVyZUNvb3JkJyk7XG5cbiAgICB0aGlzLnRyYW5zbGF0aW9uTWF0cml4ID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICd0cmFuc2xhdGlvbk1hdHJpeCcpO1xuICAgIHRoaXMuYWxwaGEgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgJ2FscGhhJyk7XG5cbiAgICB0aGlzLnByb2dyYW0gPSBwcm9ncmFtO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdHJpcFNoYWRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi8uLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBibGVuZE1vZGVzID0gcmVxdWlyZSgnLi4vLi4vZGlzcGxheS9ibGVuZE1vZGVzJyk7XG5cbi8qKlxuICogQSBXZWJHTEJhdGNoIEVuYWJsZXMgYSBncm91cCBvZiBzcHJpdGVzIHRvIGJlIGRyYXduIHVzaW5nIHRoZSBzYW1lIHNldHRpbmdzLlxuICogaWYgYSBncm91cCBvZiBzcHJpdGVzIGFsbCBoYXZlIHRoZSBzYW1lIGJhc2VUZXh0dXJlIGFuZCBibGVuZE1vZGUgdGhlbiB0aGV5IGNhbiBiZSBncm91cGVkIGludG8gYSBiYXRjaC5cbiAqIEFsbCB0aGUgc3ByaXRlcyBpbiBhIGJhdGNoIGNhbiB0aGVuIGJlIGRyYXduIGluIG9uZSBnbyBieSB0aGUgR1BVIHdoaWNoIGlzIGh1Z2VseSBlZmZpY2llbnQuIEFMTCBzcHJpdGVzXG4gKiBpbiB0aGUgd2ViR0wgcmVuZGVyZXIgYXJlIGFkZGVkIHRvIGEgYmF0Y2ggZXZlbiBpZiB0aGUgYmF0Y2ggb25seSBjb250YWlucyBvbmUgc3ByaXRlLiBCYXRjaGluZyBpcyBoYW5kbGVkXG4gKiBhdXRvbWF0aWNhbGx5IGJ5IHRoZSB3ZWJHTCByZW5kZXJlci4gQSBnb29kIHRpcCBpczogdGhlIHNtYWxsZXIgdGhlIG51bWJlciBvZiBiYXRjaHMgdGhlcmUgYXJlLCB0aGUgZmFzdGVyXG4gKiB0aGUgd2ViR0wgcmVuZGVyZXIgd2lsbCBydW4uXG4gKlxuICogQGNsYXNzIFdlYkdMQmF0Y2hcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIGdsIHtXZWJHTENvbnRleHR9IGFuIGluc3RhbmNlIG9mIHRoZSB3ZWJHTCBjb250ZXh0XG4gKi9cbmZ1bmN0aW9uIFdlYkdMQmF0Y2goZ2wpXG57XG4gICAgdGhpcy5nbCA9IGdsO1xuXG4gICAgdGhpcy5zaXplID0gMDtcblxuICAgIHRoaXMudmVydGV4QnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMuaW5kZXhCdWZmZXIgPSAgZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdGhpcy51dkJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmNvbG9yQnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMuYmxlbmRNb2RlID0gYmxlbmRNb2Rlcy5OT1JNQUw7XG4gICAgdGhpcy5keW5hbWljU2l6ZSA9IDE7XG59XG5cbnZhciBwcm90byA9IFdlYkdMQmF0Y2gucHJvdG90eXBlO1xuXG4vKipcbiAqIENsZWFucyB0aGUgYmF0Y2ggc28gdGhhdCBpcyBjYW4gYmUgcmV0dXJuZWQgdG8gYW4gb2JqZWN0IHBvb2wgYW5kIHJldXNlZFxuICpcbiAqIEBtZXRob2QgY2xlYW5cbiAqL1xucHJvdG8uY2xlYW4gPSBmdW5jdGlvbiBjbGVhbigpXG57XG4gICAgdGhpcy52ZXJ0aWNpZXMgPSBbXTtcbiAgICB0aGlzLnV2cyA9IFtdO1xuICAgIHRoaXMuaW5kaWNlcyA9IFtdO1xuICAgIHRoaXMuY29sb3JzID0gW107XG4gICAgdGhpcy5keW5hbWljU2l6ZSA9IDE7XG4gICAgdGhpcy50ZXh0dXJlID0gbnVsbDtcbiAgICB0aGlzLmxhc3QgPSBudWxsO1xuICAgIHRoaXMuc2l6ZSA9IDA7XG4gICAgdGhpcy5oZWFkID0gbnVsbDtcbiAgICB0aGlzLnRhaWwgPSBudWxsO1xufTtcblxuLyoqXG4gKiBSZWNyZWF0ZXMgdGhlIGJ1ZmZlcnMgaW4gdGhlIGV2ZW50IG9mIGEgY29udGV4dCBsb3NzXG4gKlxuICogQG1ldGhvZCByZXN0b3JlTG9zdENvbnRleHRcbiAqIEBwYXJhbSBnbCB7V2ViR0xDb250ZXh0fVxuICovXG5wcm90by5yZXN0b3JlTG9zdENvbnRleHQgPSBmdW5jdGlvbiByZXN0b3JlTG9zdENvbnRleHQoZ2wpXG57XG4gICAgdGhpcy5nbCA9IGdsO1xuICAgIHRoaXMudmVydGV4QnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMuaW5kZXhCdWZmZXIgPSAgZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdGhpcy51dkJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmNvbG9yQnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xufTtcblxuLyoqXG4gKiBpbml0cyB0aGUgYmF0Y2gncyB0ZXh0dXJlIGFuZCBibGVuZCBtb2RlIGJhc2VkIGlmIHRoZSBzdXBwbGllZCBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIGluaXRcbiAqIEBwYXJhbSBzcHJpdGUge1Nwcml0ZX0gdGhlIGZpcnN0IHNwcml0ZSB0byBiZSBhZGRlZCB0byB0aGUgYmF0Y2guIE9ubHkgc3ByaXRlcyB3aXRoXG4gKiAgICAgIHRoZSBzYW1lIGJhc2UgdGV4dHVyZSBhbmQgYmxlbmQgbW9kZSB3aWxsIGJlIGFsbG93ZWQgdG8gYmUgYWRkZWQgdG8gdGhpcyBiYXRjaFxuICovXG5wcm90by5pbml0ID0gZnVuY3Rpb24gaW5pdChzcHJpdGUpXG57XG4gICAgc3ByaXRlLmJhdGNoID0gdGhpcztcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICB0aGlzLmJsZW5kTW9kZSA9IHNwcml0ZS5ibGVuZE1vZGU7XG4gICAgdGhpcy50ZXh0dXJlID0gc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmU7XG4gICAgdGhpcy5oZWFkID0gc3ByaXRlO1xuICAgIHRoaXMudGFpbCA9IHNwcml0ZTtcbiAgICB0aGlzLnNpemUgPSAxO1xuXG4gICAgdGhpcy5ncm93QmF0Y2goKTtcbn07XG5cbi8qKlxuICogaW5zZXJ0cyBhIHNwcml0ZSBiZWZvcmUgdGhlIHNwZWNpZmllZCBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIGluc2VydEJlZm9yZVxuICogQHBhcmFtIHNwcml0ZSB7U3ByaXRlfSB0aGUgc3ByaXRlIHRvIGJlIGFkZGVkXG4gKiBAcGFyYW0gbmV4dFNwcml0ZSB7bmV4dFNwcml0ZX0gdGhlIGZpcnN0IHNwcml0ZSB3aWxsIGJlIGluc2VydGVkIGJlZm9yZSB0aGlzIHNwcml0ZVxuICovXG5wcm90by5pbnNlcnRCZWZvcmUgPSBmdW5jdGlvbiBpbnNlcnRCZWZvcmUoc3ByaXRlLCBuZXh0U3ByaXRlKVxue1xuICAgIHRoaXMuc2l6ZSsrO1xuXG4gICAgc3ByaXRlLmJhdGNoID0gdGhpcztcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICB2YXIgdGVtcFByZXYgPSBuZXh0U3ByaXRlLl9fcHJldjtcbiAgICBuZXh0U3ByaXRlLl9fcHJldiA9IHNwcml0ZTtcbiAgICBzcHJpdGUuX19uZXh0ID0gbmV4dFNwcml0ZTtcblxuICAgIGlmKHRlbXBQcmV2KVxuICAgIHtcbiAgICAgICAgc3ByaXRlLl9fcHJldiA9IHRlbXBQcmV2O1xuICAgICAgICB0ZW1wUHJldi5fX25leHQgPSBzcHJpdGU7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMuaGVhZCA9IHNwcml0ZTtcbiAgICB9XG59O1xuXG4vKipcbiAqIGluc2VydHMgYSBzcHJpdGUgYWZ0ZXIgdGhlIHNwZWNpZmllZCBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIGluc2VydEFmdGVyXG4gKiBAcGFyYW0gc3ByaXRlIHtTcHJpdGV9IHRoZSBzcHJpdGUgdG8gYmUgYWRkZWRcbiAqIEBwYXJhbSAgcHJldmlvdXNTcHJpdGUge1Nwcml0ZX0gdGhlIGZpcnN0IHNwcml0ZSB3aWxsIGJlIGluc2VydGVkIGFmdGVyIHRoaXMgc3ByaXRlXG4gKi9cbnByb3RvLmluc2VydEFmdGVyID0gZnVuY3Rpb24gaW5zZXJ0QWZ0ZXIoc3ByaXRlLCBwcmV2aW91c1Nwcml0ZSlcbntcbiAgICB0aGlzLnNpemUrKztcblxuICAgIHNwcml0ZS5iYXRjaCA9IHRoaXM7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG5cbiAgICB2YXIgdGVtcE5leHQgPSBwcmV2aW91c1Nwcml0ZS5fX25leHQ7XG4gICAgcHJldmlvdXNTcHJpdGUuX19uZXh0ID0gc3ByaXRlO1xuICAgIHNwcml0ZS5fX3ByZXYgPSBwcmV2aW91c1Nwcml0ZTtcblxuICAgIGlmKHRlbXBOZXh0KVxuICAgIHtcbiAgICAgICAgc3ByaXRlLl9fbmV4dCA9IHRlbXBOZXh0O1xuICAgICAgICB0ZW1wTmV4dC5fX3ByZXYgPSBzcHJpdGU7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMudGFpbCA9IHNwcml0ZTtcbiAgICB9XG59O1xuXG4vKipcbiAqIHJlbW92ZXMgYSBzcHJpdGUgZnJvbSB0aGUgYmF0Y2hcbiAqXG4gKiBAbWV0aG9kIHJlbW92ZVxuICogQHBhcmFtIHNwcml0ZSB7U3ByaXRlfSB0aGUgc3ByaXRlIHRvIGJlIHJlbW92ZWRcbiAqL1xucHJvdG8ucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKHNwcml0ZSlcbntcbiAgICB0aGlzLnNpemUtLTtcblxuICAgIGlmICghdGhpcy5zaXplKVxuICAgIHtcbiAgICAgICAgc3ByaXRlLmJhdGNoID0gbnVsbDtcbiAgICAgICAgc3ByaXRlLl9fcHJldiA9IG51bGw7XG4gICAgICAgIHNwcml0ZS5fX25leHQgPSBudWxsO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoc3ByaXRlLl9fcHJldilcbiAgICB7XG4gICAgICAgIHNwcml0ZS5fX3ByZXYuX19uZXh0ID0gc3ByaXRlLl9fbmV4dDtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5oZWFkID0gc3ByaXRlLl9fbmV4dDtcbiAgICAgICAgdGhpcy5oZWFkLl9fcHJldiA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYoc3ByaXRlLl9fbmV4dClcbiAgICB7XG4gICAgICAgIHNwcml0ZS5fX25leHQuX19wcmV2ID0gc3ByaXRlLl9fcHJldjtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy50YWlsID0gc3ByaXRlLl9fcHJldjtcbiAgICAgICAgdGhpcy50YWlsLl9fbmV4dCA9IG51bGw7XG4gICAgfVxuXG4gICAgc3ByaXRlLmJhdGNoID0gbnVsbDtcbiAgICBzcHJpdGUuX19uZXh0ID0gbnVsbDtcbiAgICBzcHJpdGUuX19wcmV2ID0gbnVsbDtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogU3BsaXRzIHRoZSBiYXRjaCBpbnRvIHR3byB3aXRoIHRoZSBzcGVjaWZpZWQgc3ByaXRlIGJlaW5nIHRoZSBzdGFydCBvZiB0aGUgbmV3IGJhdGNoLlxuICpcbiAqIEBtZXRob2Qgc3BsaXRcbiAqIEBwYXJhbSBzcHJpdGUge1Nwcml0ZX0gdGhlIHNwcml0ZSB0aGF0IGluZGljYXRlcyB3aGVyZSB0aGUgYmF0Y2ggc2hvdWxkIGJlIHNwbGl0XG4gKiBAcmV0dXJuIHtXZWJHTEJhdGNofSB0aGUgbmV3IGJhdGNoXG4gKi9cbnByb3RvLnNwbGl0ID0gZnVuY3Rpb24gc3BsaXQoc3ByaXRlKVxue1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuXG4gICAgdmFyIGJhdGNoID0gbmV3IFdlYkdMQmF0Y2godGhpcy5nbCk7XG4gICAgYmF0Y2guaW5pdChzcHJpdGUpO1xuICAgIGJhdGNoLnRleHR1cmUgPSB0aGlzLnRleHR1cmU7XG4gICAgYmF0Y2gudGFpbCA9IHRoaXMudGFpbDtcblxuICAgIHRoaXMudGFpbCA9IHNwcml0ZS5fX3ByZXY7XG4gICAgdGhpcy50YWlsLl9fbmV4dCA9IG51bGw7XG5cbiAgICBzcHJpdGUuX19wcmV2ID0gbnVsbDtcbiAgICAvLyByZXR1cm4gYSBzcGxpdGUgYmF0Y2ghXG5cbiAgICAvLyBUT0RPIHRoaXMgc2l6ZSBpcyB3cm9uZyFcbiAgICAvLyBuZWVkIHRvIHJlY2FsY3VsYXRlIDovIHByb2JsZW0gd2l0aCBhIGxpbmtlZCBsaXN0IVxuICAgIC8vIHVubGVzcyBpdCBnZXRzIGNhbGN1bGF0ZWQgaW4gdGhlIFwiY2xlYW5cIj9cblxuICAgIC8vIG5lZWQgdG8gbG9vcCB0aHJvdWdoIGl0ZW1zIGFzIHRoZXJlIGlzIG5vIHdheSB0byBrbm93IHRoZSBsZW5ndGggb24gYSBsaW5rZWQgbGlzdCA6L1xuICAgIHZhciB0ZW1wU2l6ZSA9IDA7XG4gICAgd2hpbGUoc3ByaXRlKVxuICAgIHtcbiAgICAgICAgdGVtcFNpemUrKztcbiAgICAgICAgc3ByaXRlLmJhdGNoID0gYmF0Y2g7XG4gICAgICAgIHNwcml0ZSA9IHNwcml0ZS5fX25leHQ7XG4gICAgfVxuXG4gICAgYmF0Y2guc2l6ZSA9IHRlbXBTaXplO1xuICAgIHRoaXMuc2l6ZSAtPSB0ZW1wU2l6ZTtcblxuICAgIHJldHVybiBiYXRjaDtcbn07XG5cbi8qKlxuICogTWVyZ2VzIHR3byBiYXRjaHMgdG9nZXRoZXJcbiAqXG4gKiBAbWV0aG9kIG1lcmdlXG4gKiBAcGFyYW0gYmF0Y2gge1dlYkdMQmF0Y2h9IHRoZSBiYXRjaCB0aGF0IHdpbGwgYmUgbWVyZ2VkXG4gKi9cbnByb3RvLm1lcmdlID0gZnVuY3Rpb24gbWVyZ2UoYmF0Y2gpXG57XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG5cbiAgICB0aGlzLnRhaWwuX19uZXh0ID0gYmF0Y2guaGVhZDtcbiAgICBiYXRjaC5oZWFkLl9fcHJldiA9IHRoaXMudGFpbDtcblxuICAgIHRoaXMuc2l6ZSArPSBiYXRjaC5zaXplO1xuXG4gICAgdGhpcy50YWlsID0gYmF0Y2gudGFpbDtcblxuICAgIHZhciBzcHJpdGUgPSBiYXRjaC5oZWFkO1xuICAgIHdoaWxlKHNwcml0ZSlcbiAgICB7XG4gICAgICAgIHNwcml0ZS5iYXRjaCA9IHRoaXM7XG4gICAgICAgIHNwcml0ZSA9IHNwcml0ZS5fX25leHQ7XG4gICAgfVxufTtcblxuLyoqXG4gKiBHcm93cyB0aGUgc2l6ZSBvZiB0aGUgYmF0Y2guIEFzIHRoZSBlbGVtZW50cyBpbiB0aGUgYmF0Y2ggY2Fubm90IGhhdmUgYSBkeW5hbWljIHNpemUgdGhpc1xuICogZnVuY3Rpb24gaXMgdXNlZCB0byBpbmNyZWFzZSB0aGUgc2l6ZSBvZiB0aGUgYmF0Y2guIEl0IGFsc28gY3JlYXRlcyBhIGxpdHRsZSBleHRyYSByb29tIHNvXG4gKiB0aGF0IHRoZSBiYXRjaCBkb2VzIG5vdCBuZWVkIHRvIGJlIHJlc2l6ZWQgZXZlcnkgdGltZSBhIHNwcml0ZSBpcyBhZGRlZFxuICpcbiAqIEBtZXRob2QgZ3Jvd0JhdGNoXG4gKi9cbnByb3RvLmdyb3dCYXRjaCA9IGZ1bmN0aW9uIGdyb3dCYXRjaCgpXG57XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcbiAgICBpZiggdGhpcy5zaXplID09PSAxKVxuICAgIHtcbiAgICAgICAgdGhpcy5keW5hbWljU2l6ZSA9IDE7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMuZHluYW1pY1NpemUgPSB0aGlzLnNpemUgKiAxLjU7XG4gICAgfVxuXG4gICAgLy8gZ3JvdyB2ZXJ0c1xuICAgIHRoaXMudmVydGljaWVzID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLmR5bmFtaWNTaXplICogOCk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLHRoaXMudmVydGljaWVzICwgZ2wuRFlOQU1JQ19EUkFXKTtcblxuICAgIHRoaXMudXZzICA9IG5ldyBGbG9hdDMyQXJyYXkoIHRoaXMuZHluYW1pY1NpemUgKiA4ICk7XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudXZCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnV2cyAsIGdsLkRZTkFNSUNfRFJBVyk7XG5cbiAgICB0aGlzLmRpcnR5VVZTID0gdHJ1ZTtcblxuICAgIHRoaXMuY29sb3JzICA9IG5ldyBGbG9hdDMyQXJyYXkoIHRoaXMuZHluYW1pY1NpemUgKiA0ICk7XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMuY29sb3JCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLmNvbG9ycyAsIGdsLkRZTkFNSUNfRFJBVyk7XG5cbiAgICB0aGlzLmRpcnR5Q29sb3JzID0gdHJ1ZTtcblxuICAgIHRoaXMuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheSh0aGlzLmR5bmFtaWNTaXplICogNik7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuaW5kaWNlcy5sZW5ndGgvNjsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBpbmRleDIgPSBpICogNjtcbiAgICAgICAgdmFyIGluZGV4MyA9IGkgKiA0O1xuICAgICAgICB0aGlzLmluZGljZXNbaW5kZXgyICsgMF0gPSBpbmRleDMgKyAwO1xuICAgICAgICB0aGlzLmluZGljZXNbaW5kZXgyICsgMV0gPSBpbmRleDMgKyAxO1xuICAgICAgICB0aGlzLmluZGljZXNbaW5kZXgyICsgMl0gPSBpbmRleDMgKyAyO1xuICAgICAgICB0aGlzLmluZGljZXNbaW5kZXgyICsgM10gPSBpbmRleDMgKyAwO1xuICAgICAgICB0aGlzLmluZGljZXNbaW5kZXgyICsgNF0gPSBpbmRleDMgKyAyO1xuICAgICAgICB0aGlzLmluZGljZXNbaW5kZXgyICsgNV0gPSBpbmRleDMgKyAzO1xuICAgIH1cblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHRoaXMuaW5kZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHRoaXMuaW5kaWNlcywgZ2wuU1RBVElDX0RSQVcpO1xufTtcblxuLyoqXG4gKiBSZWZyZXNoJ3MgYWxsIHRoZSBkYXRhIGluIHRoZSBiYXRjaCBhbmQgc3luYydzIGl0IHdpdGggdGhlIHdlYkdMIGJ1ZmZlcnNcbiAqXG4gKiBAbWV0aG9kIHJlZnJlc2hcbiAqL1xucHJvdG8ucmVmcmVzaCA9IGZ1bmN0aW9uIHJlZnJlc2goKVxue1xuICAgIGlmICh0aGlzLmR5bmFtaWNTaXplIDwgdGhpcy5zaXplKVxuICAgIHtcbiAgICAgICAgdGhpcy5ncm93QmF0Y2goKTtcbiAgICB9XG5cbiAgICB2YXIgaW5kZXhSdW4gPSAwO1xuICAgIHZhciBpbmRleCwgY29sb3JJbmRleDtcblxuICAgIHZhciBkaXNwbGF5T2JqZWN0ID0gdGhpcy5oZWFkO1xuXG4gICAgd2hpbGUoZGlzcGxheU9iamVjdClcbiAgICB7XG4gICAgICAgIGluZGV4ID0gaW5kZXhSdW4gKiA4O1xuXG4gICAgICAgIHZhciB0ZXh0dXJlID0gZGlzcGxheU9iamVjdC50ZXh0dXJlO1xuXG4gICAgICAgIHZhciBmcmFtZSA9IHRleHR1cmUuZnJhbWU7XG4gICAgICAgIHZhciB0dyA9IHRleHR1cmUuYmFzZVRleHR1cmUud2lkdGg7XG4gICAgICAgIHZhciB0aCA9IHRleHR1cmUuYmFzZVRleHR1cmUuaGVpZ2h0O1xuXG4gICAgICAgIHRoaXMudXZzW2luZGV4ICsgMF0gPSBmcmFtZS54IC8gdHc7XG4gICAgICAgIHRoaXMudXZzW2luZGV4ICsxXSA9IGZyYW1lLnkgLyB0aDtcblxuICAgICAgICB0aGlzLnV2c1tpbmRleCArMl0gPSAoZnJhbWUueCArIGZyYW1lLndpZHRoKSAvIHR3O1xuICAgICAgICB0aGlzLnV2c1tpbmRleCArM10gPSBmcmFtZS55IC8gdGg7XG5cbiAgICAgICAgdGhpcy51dnNbaW5kZXggKzRdID0gKGZyYW1lLnggKyBmcmFtZS53aWR0aCkgLyB0dztcbiAgICAgICAgdGhpcy51dnNbaW5kZXggKzVdID0gKGZyYW1lLnkgKyBmcmFtZS5oZWlnaHQpIC8gdGg7XG5cbiAgICAgICAgdGhpcy51dnNbaW5kZXggKzZdID0gZnJhbWUueCAvIHR3O1xuICAgICAgICB0aGlzLnV2c1tpbmRleCArN10gPSAoZnJhbWUueSArIGZyYW1lLmhlaWdodCkgLyB0aDtcblxuICAgICAgICBkaXNwbGF5T2JqZWN0LnVwZGF0ZUZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgY29sb3JJbmRleCA9IGluZGV4UnVuICogNDtcbiAgICAgICAgdGhpcy5jb2xvcnNbY29sb3JJbmRleF0gPSB0aGlzLmNvbG9yc1tjb2xvckluZGV4ICsgMV0gPSB0aGlzLmNvbG9yc1tjb2xvckluZGV4ICsgMl0gPSB0aGlzLmNvbG9yc1tjb2xvckluZGV4ICsgM10gPSBkaXNwbGF5T2JqZWN0LndvcmxkQWxwaGE7XG5cbiAgICAgICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QuX19uZXh0O1xuXG4gICAgICAgIGluZGV4UnVuKys7XG4gICAgfVxuXG4gICAgdGhpcy5kaXJ0eVVWUyA9IHRydWU7XG4gICAgdGhpcy5kaXJ0eUNvbG9ycyA9IHRydWU7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgYWxsIHRoZSByZWxldmFudCBnZW9tZXRyeSBhbmQgdXBsb2FkcyB0aGUgZGF0YSB0byB0aGUgR1BVXG4gKlxuICogQG1ldGhvZCB1cGRhdGVcbiAqL1xucHJvdG8udXBkYXRlID0gZnVuY3Rpb24gdXBkYXRlKClcbntcbiAgICB2YXIgd29ybGRUcmFuc2Zvcm0sIHdpZHRoLCBoZWlnaHQsIGFYLCBhWSwgdzAsIHcxLCBoMCwgaDEsIGluZGV4O1xuXG4gICAgdmFyIGEsIGIsIGMsIGQsIHR4LCB0eTtcblxuICAgIHZhciBpbmRleFJ1biA9IDA7XG5cbiAgICB2YXIgZGlzcGxheU9iamVjdCA9IHRoaXMuaGVhZDtcbiAgICB2YXIgdmVydGljaWVzID0gdGhpcy52ZXJ0aWNpZXM7XG4gICAgdmFyIHV2cyA9IHRoaXMudXZzO1xuICAgIHZhciBjb2xvcnMgPSB0aGlzLmNvbG9ycztcblxuICAgIHdoaWxlKGRpc3BsYXlPYmplY3QpXG4gICAge1xuICAgICAgICBpZihkaXNwbGF5T2JqZWN0LnZjb3VudCA9PT0gZ2xvYmFscy52aXNpYmxlQ291bnQpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHdpZHRoID0gZGlzcGxheU9iamVjdC50ZXh0dXJlLmZyYW1lLndpZHRoO1xuICAgICAgICAgICAgaGVpZ2h0ID0gZGlzcGxheU9iamVjdC50ZXh0dXJlLmZyYW1lLmhlaWdodDtcblxuICAgICAgICAgICAgLy8gVE9ETyB0cmltPz9cbiAgICAgICAgICAgIGFYID0gZGlzcGxheU9iamVjdC5hbmNob3IueDsvLyAtIGRpc3BsYXlPYmplY3QudGV4dHVyZS50cmltLnhcbiAgICAgICAgICAgIGFZID0gZGlzcGxheU9iamVjdC5hbmNob3IueTsgLy8tIGRpc3BsYXlPYmplY3QudGV4dHVyZS50cmltLnlcbiAgICAgICAgICAgIHcwID0gd2lkdGggKiAoMS1hWCk7XG4gICAgICAgICAgICB3MSA9IHdpZHRoICogLWFYO1xuXG4gICAgICAgICAgICBoMCA9IGhlaWdodCAqICgxLWFZKTtcbiAgICAgICAgICAgIGgxID0gaGVpZ2h0ICogLWFZO1xuXG4gICAgICAgICAgICBpbmRleCA9IGluZGV4UnVuICogODtcblxuICAgICAgICAgICAgd29ybGRUcmFuc2Zvcm0gPSBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtO1xuXG4gICAgICAgICAgICBhID0gd29ybGRUcmFuc2Zvcm1bMF07XG4gICAgICAgICAgICBiID0gd29ybGRUcmFuc2Zvcm1bM107XG4gICAgICAgICAgICBjID0gd29ybGRUcmFuc2Zvcm1bMV07XG4gICAgICAgICAgICBkID0gd29ybGRUcmFuc2Zvcm1bNF07XG4gICAgICAgICAgICB0eCA9IHdvcmxkVHJhbnNmb3JtWzJdO1xuICAgICAgICAgICAgdHkgPSB3b3JsZFRyYW5zZm9ybVs1XTtcblxuICAgICAgICAgICAgdmVydGljaWVzW2luZGV4ICsgMCBdID0gYSAqIHcxICsgYyAqIGgxICsgdHg7XG4gICAgICAgICAgICB2ZXJ0aWNpZXNbaW5kZXggKyAxIF0gPSBkICogaDEgKyBiICogdzEgKyB0eTtcblxuICAgICAgICAgICAgdmVydGljaWVzW2luZGV4ICsgMiBdID0gYSAqIHcwICsgYyAqIGgxICsgdHg7XG4gICAgICAgICAgICB2ZXJ0aWNpZXNbaW5kZXggKyAzIF0gPSBkICogaDEgKyBiICogdzAgKyB0eTtcblxuICAgICAgICAgICAgdmVydGljaWVzW2luZGV4ICsgNCBdID0gYSAqIHcwICsgYyAqIGgwICsgdHg7XG4gICAgICAgICAgICB2ZXJ0aWNpZXNbaW5kZXggKyA1IF0gPSBkICogaDAgKyBiICogdzAgKyB0eTtcblxuICAgICAgICAgICAgdmVydGljaWVzW2luZGV4ICsgNl0gPSAgYSAqIHcxICsgYyAqIGgwICsgdHg7XG4gICAgICAgICAgICB2ZXJ0aWNpZXNbaW5kZXggKyA3XSA9ICBkICogaDAgKyBiICogdzEgKyB0eTtcblxuICAgICAgICAgICAgaWYoZGlzcGxheU9iamVjdC51cGRhdGVGcmFtZSB8fCBkaXNwbGF5T2JqZWN0LnRleHR1cmUudXBkYXRlRnJhbWUpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGhpcy5kaXJ0eVVWUyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB2YXIgdGV4dHVyZSA9IGRpc3BsYXlPYmplY3QudGV4dHVyZTtcblxuICAgICAgICAgICAgICAgIHZhciBmcmFtZSA9IHRleHR1cmUuZnJhbWU7XG4gICAgICAgICAgICAgICAgdmFyIHR3ID0gdGV4dHVyZS5iYXNlVGV4dHVyZS53aWR0aDtcbiAgICAgICAgICAgICAgICB2YXIgdGggPSB0ZXh0dXJlLmJhc2VUZXh0dXJlLmhlaWdodDtcblxuICAgICAgICAgICAgICAgIHV2c1tpbmRleCArIDBdID0gZnJhbWUueCAvIHR3O1xuICAgICAgICAgICAgICAgIHV2c1tpbmRleCArMV0gPSBmcmFtZS55IC8gdGg7XG5cbiAgICAgICAgICAgICAgICB1dnNbaW5kZXggKzJdID0gKGZyYW1lLnggKyBmcmFtZS53aWR0aCkgLyB0dztcbiAgICAgICAgICAgICAgICB1dnNbaW5kZXggKzNdID0gZnJhbWUueSAvIHRoO1xuXG4gICAgICAgICAgICAgICAgdXZzW2luZGV4ICs0XSA9IChmcmFtZS54ICsgZnJhbWUud2lkdGgpIC8gdHc7XG4gICAgICAgICAgICAgICAgdXZzW2luZGV4ICs1XSA9IChmcmFtZS55ICsgZnJhbWUuaGVpZ2h0KSAvIHRoO1xuXG4gICAgICAgICAgICAgICAgdXZzW2luZGV4ICs2XSA9IGZyYW1lLnggLyB0dztcbiAgICAgICAgICAgICAgICB1dnNbaW5kZXggKzddID0gKGZyYW1lLnkgKyBmcmFtZS5oZWlnaHQpIC8gdGg7XG5cbiAgICAgICAgICAgICAgICBkaXNwbGF5T2JqZWN0LnVwZGF0ZUZyYW1lID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRPRE8gdGhpcyBwcm9iYWJseSBjb3VsZCBkbyB3aXRoIHNvbWUgb3B0aW1pc2F0aW9uLi4uLlxuICAgICAgICAgICAgaWYoZGlzcGxheU9iamVjdC5jYWNoZUFscGhhICE9PSBkaXNwbGF5T2JqZWN0LndvcmxkQWxwaGEpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGlzcGxheU9iamVjdC5jYWNoZUFscGhhID0gZGlzcGxheU9iamVjdC53b3JsZEFscGhhO1xuXG4gICAgICAgICAgICAgICAgdmFyIGNvbG9ySW5kZXggPSBpbmRleFJ1biAqIDQ7XG4gICAgICAgICAgICAgICAgY29sb3JzW2NvbG9ySW5kZXhdID0gY29sb3JzW2NvbG9ySW5kZXggKyAxXSA9IGNvbG9yc1tjb2xvckluZGV4ICsgMl0gPSBjb2xvcnNbY29sb3JJbmRleCArIDNdID0gZGlzcGxheU9iamVjdC53b3JsZEFscGhhO1xuICAgICAgICAgICAgICAgIHRoaXMuZGlydHlDb2xvcnMgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgaW5kZXggPSBpbmRleFJ1biAqIDg7XG5cbiAgICAgICAgICAgIHZlcnRpY2llc1tpbmRleCArIDAgXSA9IHZlcnRpY2llc1tpbmRleCArIDEgXSA9IHZlcnRpY2llc1tpbmRleCArIDIgXSA9IHZlcnRpY2llc1tpbmRleCArIDMgXSA9IHZlcnRpY2llc1tpbmRleCArIDQgXSA9IHZlcnRpY2llc1tpbmRleCArIDUgXSA9IHZlcnRpY2llc1tpbmRleCArIDZdID0gIHZlcnRpY2llc1tpbmRleCArIDddID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGluZGV4UnVuKys7XG4gICAgICAgIGRpc3BsYXlPYmplY3QgPSBkaXNwbGF5T2JqZWN0Ll9fbmV4dDtcbiAgICB9XG59O1xuXG4vKipcbiAqIERyYXdzIHRoZSBiYXRjaCB0byB0aGUgZnJhbWUgYnVmZmVyXG4gKlxuICogQG1ldGhvZCByZW5kZXJcbiAqL1xucHJvdG8ucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyKHN0YXJ0LCBlbmQpXG57XG4gICAgc3RhcnQgPSBzdGFydCB8fCAwO1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSBlbmQgPSB0aGlzLnNpemU7XG5cbiAgICBpZih0aGlzLmRpcnR5KVxuICAgIHtcbiAgICAgICAgdGhpcy5yZWZyZXNoKCk7XG4gICAgICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuc2l6ZSkgcmV0dXJuO1xuXG4gICAgdGhpcy51cGRhdGUoKTtcbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuXG4gICAgLy9UT0RPIG9wdGltaXplIHRoaXMhXG5cbiAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IGdsb2JhbHMuZGVmYXVsdFNoYWRlcjtcblxuICAgIC8vZ2wudXNlUHJvZ3JhbShzaGFkZXJQcm9ncmFtKTtcblxuICAgIC8vIHVwZGF0ZSB0aGUgdmVydHMuLlxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnZlcnRleEJ1ZmZlcik7XG4gICAgLy8gb2suLlxuICAgIGdsLmJ1ZmZlclN1YkRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAwLCB0aGlzLnZlcnRpY2llcyk7XG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXJQcm9ncmFtLmFWZXJ0ZXhQb3NpdGlvbiwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcbiAgICAvLyB1cGRhdGUgdGhlIHV2c1xuICAgIC8vdmFyIGlzRGVmYXVsdCA9IChzaGFkZXJQcm9ncmFtID09IGdsb2JhbHMuc2hhZGVyUHJvZ3JhbSlcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnV2QnVmZmVyKTtcblxuICAgIGlmKHRoaXMuZGlydHlVVlMpXG4gICAge1xuICAgICAgICB0aGlzLmRpcnR5VVZTID0gZmFsc2U7XG4gICAgICAgIGdsLmJ1ZmZlclN1YkRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAgMCwgdGhpcy51dnMpO1xuICAgIH1cblxuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyUHJvZ3JhbS5hVGV4dHVyZUNvb3JkLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgZ2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy50ZXh0dXJlLl9nbFRleHR1cmUpO1xuXG4gICAgLy8gdXBkYXRlIGNvbG9yIVxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLmNvbG9yQnVmZmVyKTtcblxuICAgIGlmKHRoaXMuZGlydHlDb2xvcnMpXG4gICAge1xuICAgICAgICB0aGlzLmRpcnR5Q29sb3JzID0gZmFsc2U7XG4gICAgICAgIGdsLmJ1ZmZlclN1YkRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAwLCB0aGlzLmNvbG9ycyk7XG4gICAgfVxuXG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXJQcm9ncmFtLmNvbG9yQXR0cmlidXRlLCAxLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuICAgIC8vIGRvbnQgbmVlZCB0byB1cGxvYWQhXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgdGhpcy5pbmRleEJ1ZmZlcik7XG5cbiAgICB2YXIgbGVuID0gZW5kIC0gc3RhcnQ7XG5cbiAgICAvLyBEUkFXIFRIQVQgdGhpcyFcbiAgICBnbC5kcmF3RWxlbWVudHMoZ2wuVFJJQU5HTEVTLCBsZW4gKiA2LCBnbC5VTlNJR05FRF9TSE9SVCwgc3RhcnQgKiAyICogNiApO1xufTtcblxuLyoqXG4gKiBJbnRlcm5hbCBXZWJHTEJhdGNoIHBvb2xcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG52YXIgYmF0Y2hlcyA9IFtdO1xuXG4vKipcbiAqIENhbGwgd2hlbiByZXN0b3JpbmcgYSBsb3N0IGNvbnRleHRcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHJlc3RvcmVCYXRjaGVzXG4gKiBAcmV0dXJuIHZvaWRcbiAqL1xuV2ViR0xCYXRjaC5yZXN0b3JlQmF0Y2hlcyA9IGZ1bmN0aW9uIHJlc3RvcmVCYXRjaGVzKGdsKVxue1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gYmF0Y2hlcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICBiYXRjaGVzW2ldLnJlc3RvcmVMb3N0Q29udGV4dChnbCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBHZXRzIGEgbmV3IFdlYkdMQmF0Y2ggZnJvbSB0aGUgcG9vbFxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZ2V0QmF0Y2hcbiAqIEByZXR1cm4ge1dlYkdMQmF0Y2h9XG4gKi9cbldlYkdMQmF0Y2guZ2V0QmF0Y2ggPSBmdW5jdGlvbiBnZXRCYXRjaCgpXG57XG4gICAgaWYgKCFiYXRjaGVzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYkdMQmF0Y2goZ2xvYmFscy5nbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGJhdGNoZXMucG9wKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBQdXRzIGEgYmF0Y2ggYmFjayBpbnRvIHRoZSBwb29sXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCByZXR1cm5CYXRjaFxuICogQHBhcmFtIGJhdGNoIHtXZWJHTEJhdGNofSBUaGUgYmF0Y2ggdG8gcmV0dXJuXG4gKi9cbldlYkdMQmF0Y2gucmV0dXJuQmF0Y2ggPSBmdW5jdGlvbiByZXR1cm5CYXRjaChiYXRjaClcbntcbiAgICBiYXRjaC5jbGVhbigpO1xuICAgIGJhdGNoZXMucHVzaChiYXRjaCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkdMQmF0Y2g7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgU3ByaXRlID0gcmVxdWlyZSgnLi4vLi4vZGlzcGxheS9TcHJpdGUnKTtcbnZhciBHcmFwaGljcyA9IHJlcXVpcmUoJy4uLy4uL3ByaW1pdGl2ZXMvR3JhcGhpY3MnKTtcbnZhciBQaXhpU2hhZGVyID0gcmVxdWlyZSgnLi9QaXhpU2hhZGVyJyk7XG5cbmZ1bmN0aW9uIEZpbHRlclRleHR1cmUod2lkdGgsIGhlaWdodClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgLy8gbmV4dCB0aW1lIHRvIGNyZWF0ZSBhIGZyYW1lIGJ1ZmZlciBhbmQgdGV4dHVyZVxuICAgIHRoaXMuZnJhbWVCdWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgIHRoaXMudGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcblxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsICB0aGlzLnRleHR1cmUpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5MSU5FQVIpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5mcmFtZWJ1ZmZlciApO1xuXG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmZyYW1lQnVmZmVyICk7XG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCB0aGlzLnRleHR1cmUsIDApO1xuXG4gICAgdGhpcy5yZXNpemUod2lkdGgsIGhlaWdodCk7XG59XG5cbkZpbHRlclRleHR1cmUucHJvdG90eXBlLnJlc2l6ZSA9IGZ1bmN0aW9uIHJlc2l6ZSh3aWR0aCwgaGVpZ2h0KVxue1xuICAgIGlmKHRoaXMud2lkdGggPT09IHdpZHRoICYmIHRoaXMuaGVpZ2h0ID09PSBoZWlnaHQpIHJldHVybjtcblxuICAgIHRoaXMud2lkdGggPSB3aWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG5cbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCAgdGhpcy50ZXh0dXJlKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsICB3aWR0aCwgaGVpZ2h0LCAwLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcblxufTtcblxuZnVuY3Rpb24gV2ViR0xGaWx0ZXJNYW5hZ2VyKHRyYW5zcGFyZW50KVxue1xuICAgIHRoaXMudHJhbnNwYXJlbnQgPSB0cmFuc3BhcmVudDtcblxuICAgIHRoaXMuZmlsdGVyU3RhY2sgPSBbXTtcbiAgICB0aGlzLnRleHR1cmVQb29sID0gW107XG5cbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG5cbiAgICB0aGlzLmluaXRTaGFkZXJCdWZmZXJzKCk7XG59XG5cbnZhciBwcm90byA9IFdlYkdMRmlsdGVyTWFuYWdlci5wcm90b3R5cGU7XG5cbi8vIEFQSVxuXG5wcm90by5iZWdpbiA9IGZ1bmN0aW9uIGJlZ2luKHByb2plY3Rpb24sIGJ1ZmZlcilcbntcbiAgICB0aGlzLndpZHRoID0gcHJvamVjdGlvbi54ICogMjtcbiAgICB0aGlzLmhlaWdodCA9IC1wcm9qZWN0aW9uLnkgKiAyO1xuICAgIHRoaXMuYnVmZmVyID0gYnVmZmVyO1xufTtcblxucHJvdG8ucHVzaEZpbHRlciA9IGZ1bmN0aW9uIHB1c2hGaWx0ZXIoZmlsdGVyQmxvY2spXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIC8vIGZpbHRlciBwcm9ncmFtXG4gICAgLy8gT1BUSU1JU0FUSU9OIC0gdGhlIGZpcnN0IGZpbHRlciBpcyBmcmVlIGlmIGl0cyBhIHNpbXBsZSBjb2xvciBjaGFuZ2U/XG4gICAgdGhpcy5maWx0ZXJTdGFjay5wdXNoKGZpbHRlckJsb2NrKTtcblxuICAgIHZhciBmaWx0ZXIgPSBmaWx0ZXJCbG9jay5maWx0ZXJQYXNzZXNbMF07XG5cbiAgICB0aGlzLm9mZnNldFggKz0gZmlsdGVyQmxvY2sudGFyZ2V0LmZpbHRlckFyZWEueDtcbiAgICB0aGlzLm9mZnNldFkgKz0gZmlsdGVyQmxvY2sudGFyZ2V0LmZpbHRlckFyZWEueTtcblxuICAgIHZhciB0ZXh0dXJlID0gdGhpcy50ZXh0dXJlUG9vbC5wb3AoKTtcbiAgICBpZighdGV4dHVyZSlcbiAgICB7XG4gICAgICAgIHRleHR1cmUgPSBuZXcgRmlsdGVyVGV4dHVyZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRleHR1cmUucmVzaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgICB9XG5cbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCAgdGV4dHVyZS50ZXh0dXJlKTtcblxuICAgIHRoaXMuZ2V0Qm91bmRzKGZpbHRlckJsb2NrLnRhcmdldCk7XG5cbiAgICAvLyBhZGRwYWRkaW5nP1xuICAgIC8vZGlzcGxheU9iamVjdC5maWx0ZXJBcmVhLnhcblxuICAgIHZhciBmaWx0ZXJBcmVhID0gZmlsdGVyQmxvY2sudGFyZ2V0LmZpbHRlckFyZWE7XG5cbiAgICB2YXIgcGFkaWRuZyA9IGZpbHRlci5wYWRkaW5nO1xuICAgIGZpbHRlckFyZWEueCAtPSBwYWRpZG5nO1xuICAgIGZpbHRlckFyZWEueSAtPSBwYWRpZG5nO1xuICAgIGZpbHRlckFyZWEud2lkdGggKz0gcGFkaWRuZyAqIDI7XG4gICAgZmlsdGVyQXJlYS5oZWlnaHQgKz0gcGFkaWRuZyAqIDI7XG5cbiAgICAvLyBjYXAgZmlsdGVyIHRvIHNjcmVlbiBzaXplLi5cbiAgICBpZihmaWx0ZXJBcmVhLnggPCAwKWZpbHRlckFyZWEueCA9IDA7XG4gICAgaWYoZmlsdGVyQXJlYS53aWR0aCA+IHRoaXMud2lkdGgpZmlsdGVyQXJlYS53aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgaWYoZmlsdGVyQXJlYS55IDwgMClmaWx0ZXJBcmVhLnkgPSAwO1xuICAgIGlmKGZpbHRlckFyZWEuaGVpZ2h0ID4gdGhpcy5oZWlnaHQpZmlsdGVyQXJlYS5oZWlnaHQgPSB0aGlzLmhlaWdodDtcblxuICAgIC8vZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAgZmlsdGVyQXJlYS53aWR0aCwgZmlsdGVyQXJlYS5oZWlnaHQsIDAsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG51bGwpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGV4dHVyZS5mcmFtZUJ1ZmZlcik7XG5cbiAgICAvL2NvbnNvbGUubG9nKGZpbHRlckFyZWEpXG4gICAgLy8gc2V0IHZpZXcgcG9ydFxuICAgIGdsLnZpZXdwb3J0KDAsIDAsIGZpbHRlckFyZWEud2lkdGgsIGZpbHRlckFyZWEuaGVpZ2h0KTtcblxuICAgIC8vIFRPRE8gbmVlZCB0byByZW1vdmUgdGhlc2UgZ2xvYmFsIGVsZW1lbnRzLi5cbiAgICBnbG9iYWxzLnByb2plY3Rpb24ueCA9IGZpbHRlckFyZWEud2lkdGgvMjtcbiAgICBnbG9iYWxzLnByb2plY3Rpb24ueSA9IC1maWx0ZXJBcmVhLmhlaWdodC8yO1xuXG4gICAgZ2xvYmFscy5vZmZzZXQueCA9IC1maWx0ZXJBcmVhLng7XG4gICAgZ2xvYmFscy5vZmZzZXQueSA9IC1maWx0ZXJBcmVhLnk7XG5cbiAgICAvL2NvbnNvbGUubG9nKGdsb2JhbHMuZGVmYXVsdFNoYWRlci5wcm9qZWN0aW9uVmVjdG9yKVxuICAgIC8vIHVwZGF0ZSBwcm9qZWN0aW9uXG4gICAgZ2wudW5pZm9ybTJmKGdsb2JhbHMuZGVmYXVsdFNoYWRlci5wcm9qZWN0aW9uVmVjdG9yLCBmaWx0ZXJBcmVhLndpZHRoLzIsIC1maWx0ZXJBcmVhLmhlaWdodC8yKTtcbiAgICBnbC51bmlmb3JtMmYoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLm9mZnNldFZlY3RvciwgLWZpbHRlckFyZWEueCwgLWZpbHRlckFyZWEueSk7XG4gICAgLy9nbG9iYWxzLnByaW1pdGl2ZVByb2dyYW1cblxuICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICBnbC5jbGVhckNvbG9yKDAsMCwwLCAwKTtcbiAgICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUKTtcblxuICAgIC8vZmlsdGVyLnRleHR1cmUgPSB0ZXh0dXJlO1xuICAgIGZpbHRlckJsb2NrLl9nbEZpbHRlclRleHR1cmUgPSB0ZXh0dXJlO1xuXG4gICAgLy9jb25zb2xlLmxvZyhcIlBVU0hcIilcbn07XG5cblxucHJvdG8ucG9wRmlsdGVyID0gZnVuY3Rpb24gcG9wRmlsdGVyKClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuICAgIHZhciBmaWx0ZXJCbG9jayA9IHRoaXMuZmlsdGVyU3RhY2sucG9wKCk7XG4gICAgdmFyIGZpbHRlckFyZWEgPSBmaWx0ZXJCbG9jay50YXJnZXQuZmlsdGVyQXJlYTtcbiAgICB2YXIgdGV4dHVyZSA9IGZpbHRlckJsb2NrLl9nbEZpbHRlclRleHR1cmU7XG5cbiAgICBpZihmaWx0ZXJCbG9jay5maWx0ZXJQYXNzZXMubGVuZ3RoID4gMSlcbiAgICB7XG4gICAgICAgIGdsLnZpZXdwb3J0KDAsIDAsIGZpbHRlckFyZWEud2lkdGgsIGZpbHRlckFyZWEuaGVpZ2h0KTtcblxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuXG4gICAgICAgIHRoaXMudmVydGV4QXJyYXlbMF0gPSAwO1xuICAgICAgICB0aGlzLnZlcnRleEFycmF5WzFdID0gZmlsdGVyQXJlYS5oZWlnaHQ7XG5cbiAgICAgICAgdGhpcy52ZXJ0ZXhBcnJheVsyXSA9IGZpbHRlckFyZWEud2lkdGg7XG4gICAgICAgIHRoaXMudmVydGV4QXJyYXlbM10gPSBmaWx0ZXJBcmVhLmhlaWdodDtcblxuICAgICAgICB0aGlzLnZlcnRleEFycmF5WzRdID0gMDtcbiAgICAgICAgdGhpcy52ZXJ0ZXhBcnJheVs1XSA9IDA7XG5cbiAgICAgICAgdGhpcy52ZXJ0ZXhBcnJheVs2XSA9IGZpbHRlckFyZWEud2lkdGg7XG4gICAgICAgIHRoaXMudmVydGV4QXJyYXlbN10gPSAwO1xuXG4gICAgICAgIGdsLmJ1ZmZlclN1YkRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAwLCB0aGlzLnZlcnRleEFycmF5KTtcblxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy51dkJ1ZmZlcik7XG4gICAgICAgIC8vIG5ub3cgc2V0IHRoZSB1dnMuLlxuICAgICAgICB0aGlzLnV2QXJyYXlbMl0gPSBmaWx0ZXJBcmVhLndpZHRoL3RoaXMud2lkdGg7XG4gICAgICAgIHRoaXMudXZBcnJheVs1XSA9IGZpbHRlckFyZWEuaGVpZ2h0L3RoaXMuaGVpZ2h0O1xuICAgICAgICB0aGlzLnV2QXJyYXlbNl0gPSBmaWx0ZXJBcmVhLndpZHRoL3RoaXMud2lkdGg7XG4gICAgICAgIHRoaXMudXZBcnJheVs3XSA9IGZpbHRlckFyZWEuaGVpZ2h0L3RoaXMuaGVpZ2h0O1xuXG4gICAgICAgIGdsLmJ1ZmZlclN1YkRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAwLCB0aGlzLnV2QXJyYXkpO1xuXG4gICAgICAgIHZhciBpbnB1dFRleHR1cmUgPSB0ZXh0dXJlO1xuICAgICAgICB2YXIgb3V0cHV0VGV4dHVyZSA9IHRoaXMudGV4dHVyZVBvb2wucG9wKCk7XG4gICAgICAgIGlmKCFvdXRwdXRUZXh0dXJlKW91dHB1dFRleHR1cmUgPSBuZXcgRmlsdGVyVGV4dHVyZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICAgICAgLy8gbmVlZCB0byBjbGVhciB0aGlzIEZCTyBhcyBpdCBtYXkgaGF2ZSBzb21lIGxlZnQgb3ZlciBlbGVtZW50cyBmcm9tIGEgcHJ2aW91cyBmaWx0ZXIuXG4gICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgb3V0cHV0VGV4dHVyZS5mcmFtZUJ1ZmZlciApO1xuICAgICAgICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUKTtcblxuICAgICAgICBnbC5kaXNhYmxlKGdsLkJMRU5EKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpbHRlckJsb2NrLmZpbHRlclBhc3Nlcy5sZW5ndGgtMTsgaSsrKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgZmlsdGVyUGFzcyA9IGZpbHRlckJsb2NrLmZpbHRlclBhc3Nlc1tpXTtcblxuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBvdXRwdXRUZXh0dXJlLmZyYW1lQnVmZmVyICk7XG5cbiAgICAgICAgICAgIC8vIHNldCB0ZXh0dXJlXG4gICAgICAgICAgICBnbC5hY3RpdmVUZXh0dXJlKGdsLlRFWFRVUkUwKTtcbiAgICAgICAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIGlucHV0VGV4dHVyZS50ZXh0dXJlKTtcblxuICAgICAgICAgICAgLy8gZHJhdyB0ZXh0dXJlLi5cbiAgICAgICAgICAgIC8vZmlsdGVyUGFzcy5hcHBseUZpbHRlclBhc3MoZmlsdGVyQXJlYS53aWR0aCwgZmlsdGVyQXJlYS5oZWlnaHQpO1xuICAgICAgICAgICAgdGhpcy5hcHBseUZpbHRlclBhc3MoZmlsdGVyUGFzcywgZmlsdGVyQXJlYSwgZmlsdGVyQXJlYS53aWR0aCwgZmlsdGVyQXJlYS5oZWlnaHQpO1xuXG4gICAgICAgICAgICAvLyBzd2FwIHRoZSB0ZXh0dXJlcy4uXG4gICAgICAgICAgICB2YXIgdGVtcCA9IGlucHV0VGV4dHVyZTtcbiAgICAgICAgICAgIGlucHV0VGV4dHVyZSA9IG91dHB1dFRleHR1cmU7XG4gICAgICAgICAgICBvdXRwdXRUZXh0dXJlID0gdGVtcDtcbiAgICAgICAgfVxuXG4gICAgICAgIGdsLmVuYWJsZShnbC5CTEVORCk7XG5cbiAgICAgICAgdGV4dHVyZSA9IGlucHV0VGV4dHVyZTtcbiAgICAgICAgdGhpcy50ZXh0dXJlUG9vbC5wdXNoKG91dHB1dFRleHR1cmUpO1xuICAgIH1cblxuICAgIHZhciBmaWx0ZXIgPSBmaWx0ZXJCbG9jay5maWx0ZXJQYXNzZXNbZmlsdGVyQmxvY2suZmlsdGVyUGFzc2VzLmxlbmd0aC0xXTtcblxuICAgIHRoaXMub2Zmc2V0WCAtPSBmaWx0ZXJBcmVhLng7XG4gICAgdGhpcy5vZmZzZXRZIC09IGZpbHRlckFyZWEueTtcblxuXG4gICAgdmFyIHNpemVYID0gdGhpcy53aWR0aDtcbiAgICB2YXIgc2l6ZVkgPSB0aGlzLmhlaWdodDtcblxuICAgIHZhciBvZmZzZXRYID0gMDtcbiAgICB2YXIgb2Zmc2V0WSA9IDA7XG5cbiAgICB2YXIgYnVmZmVyID0gdGhpcy5idWZmZXI7XG5cbiAgICAvLyB0aW1lIHRvIHJlbmRlciB0aGUgZmlsdGVycyB0ZXh0dXJlIHRvIHRoZSBwcmV2aW91cyBzY2VuZVxuICAgIGlmKHRoaXMuZmlsdGVyU3RhY2subGVuZ3RoID09PSAwKVxuICAgIHtcbiAgICAgICAgZ2wuY29sb3JNYXNrKHRydWUsIHRydWUsIHRydWUsIHRoaXMudHJhbnNwYXJlbnQpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB2YXIgY3VycmVudEZpbHRlciA9IHRoaXMuZmlsdGVyU3RhY2tbdGhpcy5maWx0ZXJTdGFjay5sZW5ndGgtMV07XG4gICAgICAgIGZpbHRlckFyZWEgPSBjdXJyZW50RmlsdGVyLnRhcmdldC5maWx0ZXJBcmVhO1xuXG4gICAgICAgIHNpemVYID0gZmlsdGVyQXJlYS53aWR0aDtcbiAgICAgICAgc2l6ZVkgPSBmaWx0ZXJBcmVhLmhlaWdodDtcblxuICAgICAgICBvZmZzZXRYID0gZmlsdGVyQXJlYS54O1xuICAgICAgICBvZmZzZXRZID0gZmlsdGVyQXJlYS55O1xuXG4gICAgICAgIGJ1ZmZlciA9ICBjdXJyZW50RmlsdGVyLl9nbEZpbHRlclRleHR1cmUuZnJhbWVCdWZmZXI7XG4gICAgfVxuXG5cblxuICAgIC8vIFRPRE8gbmVlZCB0byByZW1vdmUgdGhlc2UgZ2xvYmFsIGVsZW1lbnRzLi5cbiAgICBnbG9iYWxzLnByb2plY3Rpb24ueCA9IHNpemVYLzI7XG4gICAgZ2xvYmFscy5wcm9qZWN0aW9uLnkgPSAtc2l6ZVkvMjtcblxuICAgIGdsb2JhbHMub2Zmc2V0LnggPSBvZmZzZXRYO1xuICAgIGdsb2JhbHMub2Zmc2V0LnkgPSBvZmZzZXRZO1xuXG4gICAgZmlsdGVyQXJlYSA9IGZpbHRlckJsb2NrLnRhcmdldC5maWx0ZXJBcmVhO1xuXG4gICAgdmFyIHggPSBmaWx0ZXJBcmVhLngtb2Zmc2V0WDtcbiAgICB2YXIgeSA9IGZpbHRlckFyZWEueS1vZmZzZXRZO1xuXG4gICAgLy8gdXBkYXRlIHRoZSBidWZmZXJzLi5cbiAgICAvLyBtYWtlIHN1cmUgdG8gZmxpcCB0aGUgeSFcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuXG4gICAgdGhpcy52ZXJ0ZXhBcnJheVswXSA9IHg7XG4gICAgdGhpcy52ZXJ0ZXhBcnJheVsxXSA9IHkgKyBmaWx0ZXJBcmVhLmhlaWdodDtcblxuICAgIHRoaXMudmVydGV4QXJyYXlbMl0gPSB4ICsgZmlsdGVyQXJlYS53aWR0aDtcbiAgICB0aGlzLnZlcnRleEFycmF5WzNdID0geSArIGZpbHRlckFyZWEuaGVpZ2h0O1xuXG4gICAgdGhpcy52ZXJ0ZXhBcnJheVs0XSA9IHg7XG4gICAgdGhpcy52ZXJ0ZXhBcnJheVs1XSA9IHk7XG5cbiAgICB0aGlzLnZlcnRleEFycmF5WzZdID0geCArIGZpbHRlckFyZWEud2lkdGg7XG4gICAgdGhpcy52ZXJ0ZXhBcnJheVs3XSA9IHk7XG5cbiAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdGhpcy52ZXJ0ZXhBcnJheSk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy51dkJ1ZmZlcik7XG5cbiAgICB0aGlzLnV2QXJyYXlbMl0gPSBmaWx0ZXJBcmVhLndpZHRoL3RoaXMud2lkdGg7XG4gICAgdGhpcy51dkFycmF5WzVdID0gZmlsdGVyQXJlYS5oZWlnaHQvdGhpcy5oZWlnaHQ7XG4gICAgdGhpcy51dkFycmF5WzZdID0gZmlsdGVyQXJlYS53aWR0aC90aGlzLndpZHRoO1xuICAgIHRoaXMudXZBcnJheVs3XSA9IGZpbHRlckFyZWEuaGVpZ2h0L3RoaXMuaGVpZ2h0O1xuXG4gICAgZ2wuYnVmZmVyU3ViRGF0YShnbC5BUlJBWV9CVUZGRVIsIDAsIHRoaXMudXZBcnJheSk7XG5cbiAgICBnbC52aWV3cG9ydCgwLCAwLCBzaXplWCwgc2l6ZVkpO1xuICAgIC8vIGJpbmQgdGhlIGJ1ZmZlclxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgYnVmZmVyICk7XG5cbiAgICAvLyBzZXQgdGV4dHVyZVxuICAgIGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTApO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRleHR1cmUudGV4dHVyZSk7XG5cbiAgICAvLyBhcHBseSFcbiAgICAvL2ZpbHRlci5hcHBseUZpbHRlclBhc3Moc2l6ZVgsIHNpemVZKTtcbiAgICB0aGlzLmFwcGx5RmlsdGVyUGFzcyhmaWx0ZXIsIGZpbHRlckFyZWEsIHNpemVYLCBzaXplWSk7XG5cbiAgICAvLyBub3cgcmVzdG9yZSB0aGUgcmVndWxhciBzaGFkZXIuLlxuICAgIGdsLnVzZVByb2dyYW0oZ2xvYmFscy5kZWZhdWx0U2hhZGVyLnByb2dyYW0pO1xuICAgIGdsLnVuaWZvcm0yZihnbG9iYWxzLmRlZmF1bHRTaGFkZXIucHJvamVjdGlvblZlY3Rvciwgc2l6ZVgvMiwgLXNpemVZLzIpO1xuICAgIGdsLnVuaWZvcm0yZihnbG9iYWxzLmRlZmF1bHRTaGFkZXIub2Zmc2V0VmVjdG9yLCAtb2Zmc2V0WCwgLW9mZnNldFkpO1xuXG4gICAgLy8gcmV0dXJuIHRoZSB0ZXh0dXJlIHRvIHRoZSBwb29sXG4gICAgdGhpcy50ZXh0dXJlUG9vbC5wdXNoKHRleHR1cmUpO1xuICAgIGZpbHRlckJsb2NrLl9nbEZpbHRlclRleHR1cmUgPSBudWxsO1xufTtcblxucHJvdG8uYXBwbHlGaWx0ZXJQYXNzID0gZnVuY3Rpb24gYXBwbHlGaWx0ZXJQYXNzKGZpbHRlciwgZmlsdGVyQXJlYSwgd2lkdGgsIGhlaWdodClcbntcbiAgICAvLyB1c2UgcHJvZ3JhbVxuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG4gICAgdmFyIHNoYWRlciA9IGZpbHRlci5zaGFkZXI7XG5cbiAgICBpZighc2hhZGVyKVxuICAgIHtcbiAgICAgICAgc2hhZGVyID0gbmV3IFBpeGlTaGFkZXIoKTtcblxuICAgICAgICBzaGFkZXIuZnJhZ21lbnRTcmMgPSBmaWx0ZXIuZnJhZ21lbnRTcmM7XG4gICAgICAgIHNoYWRlci51bmlmb3JtcyA9IGZpbHRlci51bmlmb3JtcztcbiAgICAgICAgc2hhZGVyLmluaXQoKTtcblxuICAgICAgICBmaWx0ZXIuc2hhZGVyID0gc2hhZGVyO1xuICAgIH1cblxuICAgIC8vIHNldCB0aGUgc2hhZGVyXG4gICAgZ2wudXNlUHJvZ3JhbShzaGFkZXIucHJvZ3JhbSk7XG5cbiAgICBnbC51bmlmb3JtMmYoc2hhZGVyLnByb2plY3Rpb25WZWN0b3IsIHdpZHRoLzIsIC1oZWlnaHQvMik7XG4gICAgZ2wudW5pZm9ybTJmKHNoYWRlci5vZmZzZXRWZWN0b3IsIDAsMCk7XG5cbiAgICBpZihmaWx0ZXIudW5pZm9ybXMuZGltZW5zaW9ucylcbiAgICB7XG4gICAgICAgIC8vY29uc29sZS5sb2coZmlsdGVyLnVuaWZvcm1zLmRpbWVuc2lvbnMpXG4gICAgICAgIGZpbHRlci51bmlmb3Jtcy5kaW1lbnNpb25zLnZhbHVlWzBdID0gdGhpcy53aWR0aDsvL3dpZHRoO1xuICAgICAgICBmaWx0ZXIudW5pZm9ybXMuZGltZW5zaW9ucy52YWx1ZVsxXSA9IHRoaXMuaGVpZ2h0Oy8vaGVpZ2h0O1xuICAgICAgICBmaWx0ZXIudW5pZm9ybXMuZGltZW5zaW9ucy52YWx1ZVsyXSA9IHRoaXMudmVydGV4QXJyYXlbMF07XG4gICAgICAgIGZpbHRlci51bmlmb3Jtcy5kaW1lbnNpb25zLnZhbHVlWzNdID0gdGhpcy52ZXJ0ZXhBcnJheVs1XTsvL2ZpbHRlckFyZWEuaGVpZ2h0O1xuICAgIC8vICBjb25zb2xlLmxvZyh0aGlzLnZlcnRleEFycmF5WzVdKVxuICAgIH1cblxuICAgIHNoYWRlci5zeW5jVW5pZm9ybXMoKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnZlcnRleEJ1ZmZlcik7XG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXIuYVZlcnRleFBvc2l0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudXZCdWZmZXIpO1xuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyLmFUZXh0dXJlQ29vcmQsIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGV4QnVmZmVyKTtcblxuICAgIC8vIGRyYXcgdGhlIGZpbHRlci4uLlxuICAgIGdsLmRyYXdFbGVtZW50cyhnbC5UUklBTkdMRVMsIDYsIGdsLlVOU0lHTkVEX1NIT1JULCAwICk7XG59O1xuXG5wcm90by5pbml0U2hhZGVyQnVmZmVycyA9IGZ1bmN0aW9uIGluaXRTaGFkZXJCdWZmZXJzKClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgLy8gY3JlYXRlIHNvbWUgYnVmZmVyc1xuICAgIHRoaXMudmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdGhpcy51dkJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMuaW5kZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcblxuICAgIC8vIGJpbmQgYW5kIHVwbG9hZCB0aGUgdmVydGV4cy4uXG4gICAgLy8ga2VlcCBhIHJlZmZlcmFuY2UgdG8gdGhlIHZlcnRleEZsb2F0RGF0YS4uXG4gICAgdGhpcy52ZXJ0ZXhBcnJheSA9IG5ldyBGbG9hdDMyQXJyYXkoWzAuMCwgMC4wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLjAsIDAuMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMC4wLCAxLjAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEuMCwgMS4wXSk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoXG4gICAgZ2wuQVJSQVlfQlVGRkVSLFxuICAgIHRoaXMudmVydGV4QXJyYXksXG4gICAgZ2wuU1RBVElDX0RSQVcpO1xuXG5cbiAgICAvLyBiaW5kIGFuZCB1cGxvYWQgdGhlIHV2IGJ1ZmZlclxuICAgIHRoaXMudXZBcnJheSA9IG5ldyBGbG9hdDMyQXJyYXkoWzAuMCwgMC4wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEuMCwgMC4wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAuMCwgMS4wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEuMCwgMS4wXSk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy51dkJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShcbiAgICBnbC5BUlJBWV9CVUZGRVIsXG4gICAgdGhpcy51dkFycmF5LFxuICAgIGdsLlNUQVRJQ19EUkFXKTtcblxuICAgIC8vIGJpbmQgYW5kIHVwbG9hZCB0aGUgaW5kZXhcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKFxuICAgIGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLFxuICAgIG5ldyBVaW50MTZBcnJheShbMCwgMSwgMiwgMSwgMywgMl0pLFxuICAgIGdsLlNUQVRJQ19EUkFXKTtcbn07XG5cbnByb3RvLmdldEJvdW5kcyA9IGZ1bmN0aW9uIGdldEJvdW5kcyhkaXNwbGF5T2JqZWN0KVxue1xuICAgIC8vIHRpbWUgdG8gZ2V0IHRoZSB3aWR0aCBhbmQgaGVpZ2h0IG9mIHRoZSBvYmplY3QhXG4gICAgdmFyIHdvcmxkVHJhbnNmb3JtLCB3aWR0aCwgaGVpZ2h0LCBhWCwgYVksIHcwLCB3MSwgaDAsIGgxLCBkb1Rlc3Q7XG4gICAgdmFyIGEsIGIsIGMsIGQsIHR4LCB0eSwgeDEsIHgyLCB4MywgeDQsIHkxLCB5MiwgeTMsIHk0O1xuXG4gICAgdmFyIHRlbXBPYmplY3QgPSBkaXNwbGF5T2JqZWN0LmZpcnN0O1xuICAgIHZhciB0ZXN0T2JqZWN0ID0gZGlzcGxheU9iamVjdC5sYXN0Ll9pTmV4dDtcblxuICAgIHZhciBtYXhYID0gLUluZmluaXR5O1xuICAgIHZhciBtYXhZID0gLUluZmluaXR5O1xuXG4gICAgdmFyIG1pblggPSBJbmZpbml0eTtcbiAgICB2YXIgbWluWSA9IEluZmluaXR5O1xuXG4gICAgZG9cbiAgICB7XG4gICAgICAgIC8vIFRPRE8gY2FuIGJlIG9wdGltaXplZCEgLSB3aGF0IGlmIHRoZXJlIGlzIG5vIHNjYWxlIC8gcm90YXRpb24/XG5cbiAgICAgICAgaWYodGVtcE9iamVjdC52aXNpYmxlKVxuICAgICAgICB7XG4gICAgICAgICAgICBpZih0ZW1wT2JqZWN0IGluc3RhbmNlb2YgU3ByaXRlKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHdpZHRoID0gdGVtcE9iamVjdC50ZXh0dXJlLmZyYW1lLndpZHRoO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHRlbXBPYmplY3QudGV4dHVyZS5mcmFtZS5oZWlnaHQ7XG5cbiAgICAgICAgICAgICAgICAvLyBUT0RPIHRyaW0/P1xuICAgICAgICAgICAgICAgIGFYID0gdGVtcE9iamVjdC5hbmNob3IueDtcbiAgICAgICAgICAgICAgICBhWSA9IHRlbXBPYmplY3QuYW5jaG9yLnk7XG4gICAgICAgICAgICAgICAgdzAgPSB3aWR0aCAqICgxLWFYKTtcbiAgICAgICAgICAgICAgICB3MSA9IHdpZHRoICogLWFYO1xuXG4gICAgICAgICAgICAgICAgaDAgPSBoZWlnaHQgKiAoMS1hWSk7XG4gICAgICAgICAgICAgICAgaDEgPSBoZWlnaHQgKiAtYVk7XG5cbiAgICAgICAgICAgICAgICBkb1Rlc3QgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0ZW1wT2JqZWN0IGluc3RhbmNlb2YgR3JhcGhpY3MpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGVtcE9iamVjdC51cGRhdGVGaWx0ZXJCb3VuZHMoKTtcblxuICAgICAgICAgICAgICAgIHZhciBib3VuZHMgPSB0ZW1wT2JqZWN0LmJvdW5kcztcblxuICAgICAgICAgICAgICAgIHdpZHRoID0gYm91bmRzLndpZHRoO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IGJvdW5kcy5oZWlnaHQ7XG5cbiAgICAgICAgICAgICAgICB3MCA9IGJvdW5kcy54O1xuICAgICAgICAgICAgICAgIHcxID0gYm91bmRzLnggKyBib3VuZHMud2lkdGg7XG5cbiAgICAgICAgICAgICAgICBoMCA9IGJvdW5kcy55O1xuICAgICAgICAgICAgICAgIGgxID0gYm91bmRzLnkgKyBib3VuZHMuaGVpZ2h0O1xuXG4gICAgICAgICAgICAgICAgZG9UZXN0ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGRvVGVzdClcbiAgICAgICAge1xuICAgICAgICAgICAgd29ybGRUcmFuc2Zvcm0gPSB0ZW1wT2JqZWN0LndvcmxkVHJhbnNmb3JtO1xuXG4gICAgICAgICAgICBhID0gd29ybGRUcmFuc2Zvcm1bMF07XG4gICAgICAgICAgICBiID0gd29ybGRUcmFuc2Zvcm1bM107XG4gICAgICAgICAgICBjID0gd29ybGRUcmFuc2Zvcm1bMV07XG4gICAgICAgICAgICBkID0gd29ybGRUcmFuc2Zvcm1bNF07XG4gICAgICAgICAgICB0eCA9IHdvcmxkVHJhbnNmb3JtWzJdO1xuICAgICAgICAgICAgdHkgPSB3b3JsZFRyYW5zZm9ybVs1XTtcblxuICAgICAgICAgICAgeDEgPSBhICogdzEgKyBjICogaDEgKyB0eDtcbiAgICAgICAgICAgIHkxID0gZCAqIGgxICsgYiAqIHcxICsgdHk7XG5cbiAgICAgICAgICAgIHgyID0gYSAqIHcwICsgYyAqIGgxICsgdHg7XG4gICAgICAgICAgICB5MiA9IGQgKiBoMSArIGIgKiB3MCArIHR5O1xuXG4gICAgICAgICAgICB4MyA9IGEgKiB3MCArIGMgKiBoMCArIHR4O1xuICAgICAgICAgICAgeTMgPSBkICogaDAgKyBiICogdzAgKyB0eTtcblxuICAgICAgICAgICAgeDQgPSAgYSAqIHcxICsgYyAqIGgwICsgdHg7XG4gICAgICAgICAgICB5NCA9ICBkICogaDAgKyBiICogdzEgKyB0eTtcblxuICAgICAgICAgICAgbWluWCA9IHgxIDwgbWluWCA/IHgxIDogbWluWDtcbiAgICAgICAgICAgIG1pblggPSB4MiA8IG1pblggPyB4MiA6IG1pblg7XG4gICAgICAgICAgICBtaW5YID0geDMgPCBtaW5YID8geDMgOiBtaW5YO1xuICAgICAgICAgICAgbWluWCA9IHg0IDwgbWluWCA/IHg0IDogbWluWDtcblxuICAgICAgICAgICAgbWluWSA9IHkxIDwgbWluWSA/IHkxIDogbWluWTtcbiAgICAgICAgICAgIG1pblkgPSB5MiA8IG1pblkgPyB5MiA6IG1pblk7XG4gICAgICAgICAgICBtaW5ZID0geTMgPCBtaW5ZID8geTMgOiBtaW5ZO1xuICAgICAgICAgICAgbWluWSA9IHk0IDwgbWluWSA/IHk0IDogbWluWTtcblxuICAgICAgICAgICAgbWF4WCA9IHgxID4gbWF4WCA/IHgxIDogbWF4WDtcbiAgICAgICAgICAgIG1heFggPSB4MiA+IG1heFggPyB4MiA6IG1heFg7XG4gICAgICAgICAgICBtYXhYID0geDMgPiBtYXhYID8geDMgOiBtYXhYO1xuICAgICAgICAgICAgbWF4WCA9IHg0ID4gbWF4WCA/IHg0IDogbWF4WDtcblxuICAgICAgICAgICAgbWF4WSA9IHkxID4gbWF4WSA/IHkxIDogbWF4WTtcbiAgICAgICAgICAgIG1heFkgPSB5MiA+IG1heFkgPyB5MiA6IG1heFk7XG4gICAgICAgICAgICBtYXhZID0geTMgPiBtYXhZID8geTMgOiBtYXhZO1xuICAgICAgICAgICAgbWF4WSA9IHk0ID4gbWF4WSA/IHk0IDogbWF4WTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRvVGVzdCA9IGZhbHNlO1xuICAgICAgICB0ZW1wT2JqZWN0ID0gdGVtcE9iamVjdC5faU5leHQ7XG5cbiAgICB9XG4gICAgd2hpbGUodGVtcE9iamVjdCAhPT0gdGVzdE9iamVjdCk7XG5cbiAgICAvLyBtYXhpbXVtIGJvdW5kcyBpcyB0aGUgc2l6ZSBvZiB0aGUgc2NyZWVuLi5cbiAgICAvL21pblggPSBtaW5YID4gMCA/IG1pblggOiAwO1xuICAgIC8vbWluWSA9IG1pblkgPiAwID8gbWluWSA6IDA7XG5cbiAgICBkaXNwbGF5T2JqZWN0LmZpbHRlckFyZWEueCA9IG1pblg7XG4gICAgZGlzcGxheU9iamVjdC5maWx0ZXJBcmVhLnkgPSBtaW5ZO1xuXG4vLyAgY29uc29sZS5sb2cobWF4WCsgXCIgOiBcIiArIG1pblgpXG4gICAgZGlzcGxheU9iamVjdC5maWx0ZXJBcmVhLndpZHRoID0gbWF4WCAtIG1pblg7XG4gICAgZGlzcGxheU9iamVjdC5maWx0ZXJBcmVhLmhlaWdodCA9IG1heFkgLSBtaW5ZO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBXZWJHTEZpbHRlck1hbmFnZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgc2hhZGVycyA9IHJlcXVpcmUoJy4vc2hhZGVycycpO1xudmFyIHdlYmdsR3JhcGhpY3MgPSByZXF1aXJlKCcuL2dyYXBoaWNzJyk7XG52YXIgV2ViR0xCYXRjaCA9IHJlcXVpcmUoJy4vV2ViR0xCYXRjaCcpO1xudmFyIFdlYkdMRmlsdGVyTWFuYWdlciA9IHJlcXVpcmUoJy4vV2ViR0xGaWx0ZXJNYW5hZ2VyJyk7XG52YXIgbWF0MyA9IHJlcXVpcmUoJy4uLy4uL2dlb20vbWF0cml4JykubWF0MztcblxudmFyIEJhc2VUZXh0dXJlID0gcmVxdWlyZSgnLi4vLi4vdGV4dHVyZXMvQmFzZVRleHR1cmUnKTtcblxudmFyIFRpbGluZ1Nwcml0ZSA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9UaWxpbmdTcHJpdGUnKTtcbnZhciBTdHJpcCA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9TdHJpcCcpO1xudmFyIEdyYXBoaWNzID0gcmVxdWlyZSgnLi4vLi4vcHJpbWl0aXZlcy9HcmFwaGljcycpO1xudmFyIEZpbHRlckJsb2NrID0gcmVxdWlyZSgnLi4vLi4vZmlsdGVycy9GaWx0ZXJCbG9jaycpO1xudmFyIFNwcml0ZSA9IHJlcXVpcmUoJy4uLy4uL2Rpc3BsYXkvU3ByaXRlJyk7XG52YXIgQ3VzdG9tUmVuZGVyYWJsZSA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9DdXN0b21SZW5kZXJhYmxlJyk7XG5cbi8qKlxuICogQSBXZWJHTEJhdGNoIEVuYWJsZXMgYSBncm91cCBvZiBzcHJpdGVzIHRvIGJlIGRyYXduIHVzaW5nIHRoZSBzYW1lIHNldHRpbmdzLlxuICogaWYgYSBncm91cCBvZiBzcHJpdGVzIGFsbCBoYXZlIHRoZSBzYW1lIGJhc2VUZXh0dXJlIGFuZCBibGVuZE1vZGUgdGhlbiB0aGV5IGNhbiBiZVxuICogZ3JvdXBlZCBpbnRvIGEgYmF0Y2guIEFsbCB0aGUgc3ByaXRlcyBpbiBhIGJhdGNoIGNhbiB0aGVuIGJlIGRyYXduIGluIG9uZSBnbyBieSB0aGVcbiAqIEdQVSB3aGljaCBpcyBodWdlbHkgZWZmaWNpZW50LiBBTEwgc3ByaXRlcyBpbiB0aGUgd2ViR0wgcmVuZGVyZXIgYXJlIGFkZGVkIHRvIGEgYmF0Y2hcbiAqIGV2ZW4gaWYgdGhlIGJhdGNoIG9ubHkgY29udGFpbnMgb25lIHNwcml0ZS4gQmF0Y2hpbmcgaXMgaGFuZGxlZCBhdXRvbWF0aWNhbGx5IGJ5IHRoZVxuICogd2ViR0wgcmVuZGVyZXIuIEEgZ29vZCB0aXAgaXM6IHRoZSBzbWFsbGVyIHRoZSBudW1iZXIgb2YgYmF0Y2hzIHRoZXJlIGFyZSwgdGhlIGZhc3RlclxuICogdGhlIHdlYkdMIHJlbmRlcmVyIHdpbGwgcnVuLlxuICpcbiAqIEBjbGFzcyBXZWJHTEJhdGNoXG4gKiBAY29udHJ1Y3RvclxuICogQHBhcmFtIGdsIHtXZWJHTENvbnRleHR9IEFuIGluc3RhbmNlIG9mIHRoZSB3ZWJHTCBjb250ZXh0XG4gKi9cbmZ1bmN0aW9uIFdlYkdMUmVuZGVyR3JvdXAoZ2wsIHRyYW5zcGFyZW50KVxue1xuICAgIHRoaXMuZ2wgPSBnbDtcbiAgICB0aGlzLnJvb3QgPSBudWxsO1xuXG4gICAgdGhpcy5iYWNrZ3JvdW5kQ29sb3IgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy50cmFuc3BhcmVudCA9IHRyYW5zcGFyZW50ID09PSB1bmRlZmluZWQgPyB0cnVlIDogdHJhbnNwYXJlbnQ7XG5cbiAgICB0aGlzLmJhdGNocyA9IFtdO1xuICAgIHRoaXMudG9SZW1vdmUgPSBbXTtcbiAgICAvL2NvbnNvbGUubG9nKHRoaXMudHJhbnNwYXJlbnQpO1xuICAgIHRoaXMuZmlsdGVyTWFuYWdlciA9IG5ldyBXZWJHTEZpbHRlck1hbmFnZXIodGhpcy50cmFuc3BhcmVudCk7XG59XG5cbnZhciBwcm90byA9IFdlYkdMUmVuZGVyR3JvdXAucHJvdG90eXBlO1xuXG4vKipcbiAqIEFkZCBhIGRpc3BsYXkgb2JqZWN0IHRvIHRoZSB3ZWJnbCByZW5kZXJlclxuICpcbiAqIEBtZXRob2Qgc2V0UmVuZGVyYWJsZVxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5zZXRSZW5kZXJhYmxlID0gZnVuY3Rpb24gc2V0UmVuZGVyYWJsZShkaXNwbGF5T2JqZWN0KVxue1xuICAgIC8vIGhhcyB0aGlzIGNoYW5nZWQ/P1xuICAgIGlmKHRoaXMucm9vdCl0aGlzLnJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlbih0aGlzLnJvb3QpO1xuXG4gICAgZGlzcGxheU9iamVjdC53b3JsZFZpc2libGUgPSBkaXNwbGF5T2JqZWN0LnZpc2libGU7XG5cbiAgICAvLyBzb29vb29vIC8vXG4gICAgLy8gdG8gY2hlY2sgaWYgYW55IGJhdGNocyBleGlzdCBhbHJlYWR5Pz9cblxuICAgIC8vIFRPRE8gd2hhdCBpZiBpdHMgYWxyZWFkeSBoYXMgYW4gb2JqZWN0PyBzaG91bGQgcmVtb3ZlIGl0XG4gICAgdGhpcy5yb290ID0gZGlzcGxheU9iamVjdDtcbiAgICB0aGlzLmFkZERpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihkaXNwbGF5T2JqZWN0KTtcbn07XG5cbi8qKlxuICogUmVuZGVycyB0aGUgc3RhZ2UgdG8gaXRzIHdlYmdsIHZpZXdcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclxuICogQHBhcmFtIHByb2plY3Rpb24ge09iamVjdH1cbiAqL1xucHJvdG8ucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyKHByb2plY3Rpb24sIGJ1ZmZlcilcbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuXG4gICAgV2ViR0xSZW5kZXJHcm91cC51cGRhdGVUZXh0dXJlcyhnbCk7XG5cbiAgICBnbC51bmlmb3JtMmYoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLnByb2plY3Rpb25WZWN0b3IsIHByb2plY3Rpb24ueCwgcHJvamVjdGlvbi55KTtcblxuICAgIHRoaXMuZmlsdGVyTWFuYWdlci5iZWdpbihwcm9qZWN0aW9uLCBidWZmZXIpO1xuXG5cbiAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBKTtcbiAgICAvLyB3aWxsIHJlbmRlciBhbGwgdGhlIGVsZW1lbnRzIGluIHRoZSBncm91cFxuICAgIHZhciByZW5kZXJhYmxlO1xuXG4gICAgZm9yICh2YXIgaT0wOyBpIDwgdGhpcy5iYXRjaHMubGVuZ3RoOyBpKyspXG4gICAge1xuXG4gICAgICAgIHJlbmRlcmFibGUgPSB0aGlzLmJhdGNoc1tpXTtcbiAgICAgICAgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuYmF0Y2hzW2ldLnJlbmRlcigpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW5kZXIgc3BlY2lhbFxuICAgICAgICB0aGlzLnJlbmRlclNwZWNpYWwocmVuZGVyYWJsZSwgcHJvamVjdGlvbik7XG4gICAgfVxufTtcblxuLyoqXG4gKiBSZW5kZXJzIHRoZSBzdGFnZSB0byBpdHMgd2ViZ2wgdmlld1xuICpcbiAqIEBtZXRob2QgaGFuZGxlRmlsdGVyXG4gKiBAcGFyYW0gZmlsdGVyIHtGaWx0ZXJCbG9ja31cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmhhbmRsZUZpbHRlciA9IGZ1bmN0aW9uIGhhbmRsZUZpbHRlcigpLyooZmlsdGVyLCBwcm9qZWN0aW9uKSovXG57XG5cbn07XG5cbi8qKlxuICogUmVuZGVycyBhIHNwZWNpZmljIGRpc3BsYXlPYmplY3RcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclNwZWNpZmljXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH1cbiAqIEBwYXJhbSBwcm9qZWN0aW9uIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJTcGVjaWZpYyA9IGZ1bmN0aW9uIHJlbmRlclNwZWNpZmljKGRpc3BsYXlPYmplY3QsIHByb2plY3Rpb24sIGJ1ZmZlcilcbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuXG4gICAgV2ViR0xSZW5kZXJHcm91cC51cGRhdGVUZXh0dXJlcyhnbCk7XG5cbiAgICBnbC51bmlmb3JtMmYoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLnByb2plY3Rpb25WZWN0b3IsIHByb2plY3Rpb24ueCwgcHJvamVjdGlvbi55KTtcblxuICAgIHRoaXMuZmlsdGVyTWFuYWdlci5iZWdpbihwcm9qZWN0aW9uLCBidWZmZXIpO1xuXG4gICAgLy8gdG8gZG8hXG4gICAgLy8gcmVuZGVyIHBhcnQgb2YgdGhlIHNjZW5lLi4uXG5cbiAgICB2YXIgc3RhcnRJbmRleDtcbiAgICB2YXIgc3RhcnRCYXRjaEluZGV4O1xuXG4gICAgdmFyIGVuZEluZGV4O1xuICAgIHZhciBlbmRCYXRjaEluZGV4O1xuICAgIHZhciBlbmRCYXRjaDtcblxuICAgIHZhciBoZWFkO1xuXG4gICAgLypcbiAgICAgKiAgTE9PSyBGT1IgVEhFIE5FWFQgU1BSSVRFXG4gICAgICogIFRoaXMgcGFydCBsb29rcyBmb3IgdGhlIGNsb3Nlc3QgbmV4dCBzcHJpdGUgdGhhdCBjYW4gZ28gaW50byBhIGJhdGNoXG4gICAgICogIGl0IGtlZXBzIGxvb2tpbmcgdW50aWwgaXQgZmluZHMgYSBzcHJpdGUgb3IgZ2V0cyB0byB0aGUgZW5kIG9mIHRoZSBkaXNwbGF5XG4gICAgICogIHNjZW5lIGdyYXBoXG4gICAgICovXG4gICAgdmFyIG5leHRSZW5kZXJhYmxlID0gZGlzcGxheU9iamVjdC5maXJzdDtcbiAgICB3aGlsZShuZXh0UmVuZGVyYWJsZS5faU5leHQpXG4gICAge1xuICAgICAgICBpZihuZXh0UmVuZGVyYWJsZS5yZW5kZXJhYmxlICYmIG5leHRSZW5kZXJhYmxlLl9fcmVuZGVyR3JvdXApYnJlYWs7XG4gICAgICAgIG5leHRSZW5kZXJhYmxlID0gbmV4dFJlbmRlcmFibGUuX2lOZXh0O1xuICAgIH1cbiAgICB2YXIgc3RhcnRCYXRjaCA9IG5leHRSZW5kZXJhYmxlLmJhdGNoO1xuXG4gICAgaWYobmV4dFJlbmRlcmFibGUgaW5zdGFuY2VvZiBTcHJpdGUpXG4gICAge1xuICAgICAgICBzdGFydEJhdGNoID0gbmV4dFJlbmRlcmFibGUuYmF0Y2g7XG5cbiAgICAgICAgaGVhZCA9IHN0YXJ0QmF0Y2guaGVhZDtcblxuICAgICAgICAvLyBvayBub3cgd2UgaGF2ZSB0aGUgYmF0Y2guLiBuZWVkIHRvIGZpbmQgdGhlIHN0YXJ0IGluZGV4IVxuICAgICAgICBpZihoZWFkID09PSBuZXh0UmVuZGVyYWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhcnRJbmRleCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBzdGFydEluZGV4ID0gMTtcblxuICAgICAgICAgICAgd2hpbGUoaGVhZC5fX25leHQgIT09IG5leHRSZW5kZXJhYmxlKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHN0YXJ0SW5kZXgrKztcbiAgICAgICAgICAgICAgICBoZWFkID0gaGVhZC5fX25leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgc3RhcnRCYXRjaCA9IG5leHRSZW5kZXJhYmxlO1xuICAgIH1cblxuICAgIC8vIEdldCB0aGUgTEFTVCByZW5kZXJhYmxlIG9iamVjdFxuICAgIHZhciBsYXN0UmVuZGVyYWJsZSA9IGRpc3BsYXlPYmplY3QubGFzdDtcbiAgICB3aGlsZShsYXN0UmVuZGVyYWJsZS5faVByZXYpXG4gICAge1xuICAgICAgICBpZihsYXN0UmVuZGVyYWJsZS5yZW5kZXJhYmxlICYmIGxhc3RSZW5kZXJhYmxlLl9fcmVuZGVyR3JvdXApYnJlYWs7XG4gICAgICAgIGxhc3RSZW5kZXJhYmxlID0gbGFzdFJlbmRlcmFibGUuX2lOZXh0O1xuICAgIH1cblxuICAgIGlmKGxhc3RSZW5kZXJhYmxlIGluc3RhbmNlb2YgU3ByaXRlKVxuICAgIHtcbiAgICAgICAgZW5kQmF0Y2ggPSBsYXN0UmVuZGVyYWJsZS5iYXRjaDtcblxuICAgICAgICBoZWFkID0gZW5kQmF0Y2guaGVhZDtcblxuICAgICAgICBpZihoZWFkID09PSBsYXN0UmVuZGVyYWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgZW5kSW5kZXggPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgZW5kSW5kZXggPSAxO1xuXG4gICAgICAgICAgICB3aGlsZShoZWFkLl9fbmV4dCAhPT0gbGFzdFJlbmRlcmFibGUpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZW5kSW5kZXgrKztcbiAgICAgICAgICAgICAgICBoZWFkID0gaGVhZC5fX25leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgZW5kQmF0Y2ggPSBsYXN0UmVuZGVyYWJsZTtcbiAgICB9XG5cbiAgICAvLyBUT0RPIC0gbmVlZCB0byBmb2xkIHRoaXMgdXAgYSBiaXQhXG5cbiAgICBpZihzdGFydEJhdGNoID09PSBlbmRCYXRjaClcbiAgICB7XG4gICAgICAgIGlmKHN0YXJ0QmF0Y2ggaW5zdGFuY2VvZiBXZWJHTEJhdGNoKVxuICAgICAgICB7XG4gICAgICAgICAgICBzdGFydEJhdGNoLnJlbmRlcihzdGFydEluZGV4LCBlbmRJbmRleCsxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyU3BlY2lhbChzdGFydEJhdGNoLCBwcm9qZWN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gbm93IHdlIGhhdmUgZmlyc3QgYW5kIGxhc3QhXG4gICAgc3RhcnRCYXRjaEluZGV4ID0gdGhpcy5iYXRjaHMuaW5kZXhPZihzdGFydEJhdGNoKTtcbiAgICBlbmRCYXRjaEluZGV4ID0gdGhpcy5iYXRjaHMuaW5kZXhPZihlbmRCYXRjaCk7XG5cbiAgICAvLyBETyB0aGUgZmlyc3QgYmF0Y2hcbiAgICBpZihzdGFydEJhdGNoIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICB7XG4gICAgICAgIHN0YXJ0QmF0Y2gucmVuZGVyKHN0YXJ0SW5kZXgpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLnJlbmRlclNwZWNpYWwoc3RhcnRCYXRjaCwgcHJvamVjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gRE8gdGhlIG1pZGRsZSBiYXRjaHMuLlxuICAgIHZhciByZW5kZXJhYmxlO1xuICAgIGZvciAodmFyIGkgPSBzdGFydEJhdGNoSW5kZXgrMTsgaSA8IGVuZEJhdGNoSW5kZXg7IGkrKylcbiAgICB7XG4gICAgICAgIHJlbmRlcmFibGUgPSB0aGlzLmJhdGNoc1tpXTtcblxuICAgICAgICBpZihyZW5kZXJhYmxlIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5iYXRjaHNbaV0ucmVuZGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclNwZWNpYWwocmVuZGVyYWJsZSwgcHJvamVjdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBETyB0aGUgbGFzdCBiYXRjaC4uXG4gICAgaWYoZW5kQmF0Y2ggaW5zdGFuY2VvZiBXZWJHTEJhdGNoKVxuICAgIHtcbiAgICAgICAgZW5kQmF0Y2gucmVuZGVyKDAsIGVuZEluZGV4KzEpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLnJlbmRlclNwZWNpYWwoZW5kQmF0Y2gsIHByb2plY3Rpb24pO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmVuZGVycyBhIHNwZWNpZmljIHJlbmRlcmFibGVcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclNwZWNpYWxcbiAqIEBwYXJhbSByZW5kZXJhYmxlIHtEaXNwbGF5T2JqZWN0fVxuICogQHBhcmFtIHByb2plY3Rpb24ge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbmRlclNwZWNpYWwgPSBmdW5jdGlvbiByZW5kZXJTcGVjaWFsKHJlbmRlcmFibGUsIHByb2plY3Rpb24pXG57XG4gICAgdmFyIHdvcmxkVmlzaWJsZSA9IHJlbmRlcmFibGUudmNvdW50ID09PSBnbG9iYWxzLnZpc2libGVDb3VudDtcblxuICAgIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBUaWxpbmdTcHJpdGUpXG4gICAge1xuICAgICAgICBpZih3b3JsZFZpc2libGUpdGhpcy5yZW5kZXJUaWxpbmdTcHJpdGUocmVuZGVyYWJsZSwgcHJvamVjdGlvbik7XG4gICAgfVxuICAgIGVsc2UgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIFN0cmlwKVxuICAgIHtcbiAgICAgICAgaWYod29ybGRWaXNpYmxlKXRoaXMucmVuZGVyU3RyaXAocmVuZGVyYWJsZSwgcHJvamVjdGlvbik7XG4gICAgfVxuICAgIGVsc2UgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIEN1c3RvbVJlbmRlcmFibGUpXG4gICAge1xuICAgICAgICBpZih3b3JsZFZpc2libGUpIHJlbmRlcmFibGUucmVuZGVyV2ViR0wodGhpcywgcHJvamVjdGlvbik7XG4gICAgfVxuICAgIGVsc2UgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIEdyYXBoaWNzKVxuICAgIHtcbiAgICAgICAgaWYod29ybGRWaXNpYmxlICYmIHJlbmRlcmFibGUucmVuZGVyYWJsZSkgd2ViZ2xHcmFwaGljcy5yZW5kZXJHcmFwaGljcyhyZW5kZXJhYmxlLCBwcm9qZWN0aW9uKTtcbiAgICB9XG4gICAgZWxzZSBpZihyZW5kZXJhYmxlIGluc3RhbmNlb2YgRmlsdGVyQmxvY2spXG4gICAge1xuICAgICAgICB0aGlzLmhhbmRsZUZpbHRlckJsb2NrKHJlbmRlcmFibGUsIHByb2plY3Rpb24pO1xuICAgIH1cbn07XG5cbnZhciBtYXNrU3RhY2sgPSBbXTtcblxucHJvdG8uaGFuZGxlRmlsdGVyQmxvY2sgPSBmdW5jdGlvbiBoYW5kbGVGaWx0ZXJCbG9jayhmaWx0ZXJCbG9jaywgcHJvamVjdGlvbilcbntcbiAgICAvKlxuICAgICAqIGZvciBub3cgb25seSBtYXNrcyBhcmUgc3VwcG9ydGVkLi5cbiAgICAgKi9cbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgaWYoZmlsdGVyQmxvY2sub3BlbilcbiAgICB7XG4gICAgICAgIGlmKGZpbHRlckJsb2NrLmRhdGEgaW5zdGFuY2VvZiBBcnJheSlcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5maWx0ZXJNYW5hZ2VyLnB1c2hGaWx0ZXIoZmlsdGVyQmxvY2spO1xuICAgICAgICAgICAgLy8gb2sgc28uLlxuXG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBtYXNrU3RhY2sucHVzaChmaWx0ZXJCbG9jayk7XG5cbiAgICAgICAgICAgIGdsLmVuYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuXG4gICAgICAgICAgICBnbC5jb2xvck1hc2soZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuYyhnbC5BTFdBWVMsMSwxKTtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxPcChnbC5LRUVQLGdsLktFRVAsZ2wuSU5DUik7XG5cbiAgICAgICAgICAgIHdlYmdsR3JhcGhpY3MucmVuZGVyR3JhcGhpY3MoZmlsdGVyQmxvY2suZGF0YSwgcHJvamVjdGlvbik7XG5cbiAgICAgICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jKGdsLk5PVEVRVUFMLDAsbWFza1N0YWNrLmxlbmd0aCk7XG4gICAgICAgICAgICBnbC5zdGVuY2lsT3AoZ2wuS0VFUCxnbC5LRUVQLGdsLktFRVApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIGlmKGZpbHRlckJsb2NrLmRhdGEgaW5zdGFuY2VvZiBBcnJheSlcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5maWx0ZXJNYW5hZ2VyLnBvcEZpbHRlcigpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIG1hc2tEYXRhID0gbWFza1N0YWNrLnBvcChmaWx0ZXJCbG9jayk7XG5cbiAgICAgICAgICAgIGlmKG1hc2tEYXRhKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGdsLmNvbG9yTWFzayhmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cbiAgICAgICAgICAgICAgICBnbC5zdGVuY2lsRnVuYyhnbC5BTFdBWVMsMSwxKTtcbiAgICAgICAgICAgICAgICBnbC5zdGVuY2lsT3AoZ2wuS0VFUCxnbC5LRUVQLGdsLkRFQ1IpO1xuXG4gICAgICAgICAgICAgICAgd2ViZ2xHcmFwaGljcy5yZW5kZXJHcmFwaGljcyhtYXNrRGF0YS5kYXRhLCBwcm9qZWN0aW9uKTtcblxuICAgICAgICAgICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICBnbC5zdGVuY2lsRnVuYyhnbC5OT1RFUVVBTCwwLG1hc2tTdGFjay5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIGdsLnN0ZW5jaWxPcChnbC5LRUVQLGdsLktFRVAsZ2wuS0VFUCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuU1RFTkNJTF9URVNUKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogVXBkYXRlcyBhIHdlYmdsIHRleHR1cmVcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRleHR1cmVcbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8udXBkYXRlVGV4dHVyZSA9IGZ1bmN0aW9uIHVwZGF0ZVRleHR1cmUoZGlzcGxheU9iamVjdClcbntcblxuICAgIC8vIFRPRE8gZGVmaW5pdGVseSBjYW4gb3B0aW1zZSB0aGlzIGZ1bmN0aW9uLi5cblxuICAgIHRoaXMucmVtb3ZlT2JqZWN0KGRpc3BsYXlPYmplY3QpO1xuXG4gICAgLypcbiAgICAgKiAgTE9PSyBGT1IgVEhFIFBSRVZJT1VTIFJFTkRFUkFCTEVcbiAgICAgKiAgVGhpcyBwYXJ0IGxvb2tzIGZvciB0aGUgY2xvc2VzdCBwcmV2aW91cyBzcHJpdGUgdGhhdCBjYW4gZ28gaW50byBhIGJhdGNoXG4gICAgICogIEl0IGtlZXBzIGdvaW5nIGJhY2sgdW50aWwgaXQgZmluZHMgYSBzcHJpdGUgb3IgdGhlIHN0YWdlXG4gICAgICovXG4gICAgdmFyIHByZXZpb3VzUmVuZGVyYWJsZSA9IGRpc3BsYXlPYmplY3QuZmlyc3Q7XG4gICAgd2hpbGUocHJldmlvdXNSZW5kZXJhYmxlICE9PSB0aGlzLnJvb3QpXG4gICAge1xuICAgICAgICBwcmV2aW91c1JlbmRlcmFibGUgPSBwcmV2aW91c1JlbmRlcmFibGUuX2lQcmV2O1xuICAgICAgICBpZihwcmV2aW91c1JlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBwcmV2aW91c1JlbmRlcmFibGUuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG5cbiAgICAvKlxuICAgICAqICBMT09LIEZPUiBUSEUgTkVYVCBTUFJJVEVcbiAgICAgKiAgVGhpcyBwYXJ0IGxvb2tzIGZvciB0aGUgY2xvc2VzdCBuZXh0IHNwcml0ZSB0aGF0IGNhbiBnbyBpbnRvIGEgYmF0Y2hcbiAgICAgKiAgaXQga2VlcHMgbG9va2luZyB1bnRpbCBpdCBmaW5kcyBhIHNwcml0ZSBvciBnZXRzIHRvIHRoZSBlbmQgb2YgdGhlIGRpc3BsYXlcbiAgICAgKiAgc2NlbmUgZ3JhcGhcbiAgICAgKi9cbiAgICB2YXIgbmV4dFJlbmRlcmFibGUgPSBkaXNwbGF5T2JqZWN0Lmxhc3Q7XG4gICAgd2hpbGUobmV4dFJlbmRlcmFibGUuX2lOZXh0KVxuICAgIHtcbiAgICAgICAgbmV4dFJlbmRlcmFibGUgPSBuZXh0UmVuZGVyYWJsZS5faU5leHQ7XG4gICAgICAgIGlmKG5leHRSZW5kZXJhYmxlLnJlbmRlcmFibGUgJiYgbmV4dFJlbmRlcmFibGUuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG5cbiAgICB0aGlzLmluc2VydE9iamVjdChkaXNwbGF5T2JqZWN0LCBwcmV2aW91c1JlbmRlcmFibGUsIG5leHRSZW5kZXJhYmxlKTtcbn07XG5cbi8qKlxuICogQWRkcyBmaWx0ZXIgYmxvY2tzXG4gKlxuICogQG1ldGhvZCBhZGRGaWx0ZXJCbG9ja3NcbiAqIEBwYXJhbSBzdGFydCB7RmlsdGVyQmxvY2t9XG4gKiBAcGFyYW0gZW5kIHtGaWx0ZXJCbG9ja31cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmFkZEZpbHRlckJsb2NrcyA9IGZ1bmN0aW9uIGFkZEZpbHRlckJsb2NrcyhzdGFydCwgZW5kKVxue1xuICAgIHN0YXJ0Ll9fcmVuZGVyR3JvdXAgPSB0aGlzO1xuICAgIGVuZC5fX3JlbmRlckdyb3VwID0gdGhpcztcbiAgICAvKlxuICAgICAqICBMT09LIEZPUiBUSEUgUFJFVklPVVMgUkVOREVSQUJMRVxuICAgICAqICBUaGlzIHBhcnQgbG9va3MgZm9yIHRoZSBjbG9zZXN0IHByZXZpb3VzIHNwcml0ZSB0aGF0IGNhbiBnbyBpbnRvIGEgYmF0Y2hcbiAgICAgKiAgSXQga2VlcHMgZ29pbmcgYmFjayB1bnRpbCBpdCBmaW5kcyBhIHNwcml0ZSBvciB0aGUgc3RhZ2VcbiAgICAgKi9cbiAgICB2YXIgcHJldmlvdXNSZW5kZXJhYmxlID0gc3RhcnQ7XG4gICAgd2hpbGUocHJldmlvdXNSZW5kZXJhYmxlICE9PSB0aGlzLnJvb3QuZmlyc3QpXG4gICAge1xuICAgICAgICBwcmV2aW91c1JlbmRlcmFibGUgPSBwcmV2aW91c1JlbmRlcmFibGUuX2lQcmV2O1xuICAgICAgICBpZihwcmV2aW91c1JlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBwcmV2aW91c1JlbmRlcmFibGUuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG4gICAgdGhpcy5pbnNlcnRBZnRlcihzdGFydCwgcHJldmlvdXNSZW5kZXJhYmxlKTtcblxuICAgIC8qXG4gICAgICogIExPT0sgRk9SIFRIRSBORVhUIFNQUklURVxuICAgICAqICBUaGlzIHBhcnQgbG9va3MgZm9yIHRoZSBjbG9zZXN0IG5leHQgc3ByaXRlIHRoYXQgY2FuIGdvIGludG8gYSBiYXRjaFxuICAgICAqICBpdCBrZWVwcyBsb29raW5nIHVudGlsIGl0IGZpbmRzIGEgc3ByaXRlIG9yIGdldHMgdG8gdGhlIGVuZCBvZiB0aGUgZGlzcGxheVxuICAgICAqICBzY2VuZSBncmFwaFxuICAgICAqL1xuICAgIHZhciBwcmV2aW91c1JlbmRlcmFibGUyID0gZW5kO1xuICAgIHdoaWxlKHByZXZpb3VzUmVuZGVyYWJsZTIgIT09IHRoaXMucm9vdC5maXJzdClcbiAgICB7XG4gICAgICAgIHByZXZpb3VzUmVuZGVyYWJsZTIgPSBwcmV2aW91c1JlbmRlcmFibGUyLl9pUHJldjtcbiAgICAgICAgaWYocHJldmlvdXNSZW5kZXJhYmxlMi5yZW5kZXJhYmxlICYmIHByZXZpb3VzUmVuZGVyYWJsZTIuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG4gICAgdGhpcy5pbnNlcnRBZnRlcihlbmQsIHByZXZpb3VzUmVuZGVyYWJsZTIpO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgZmlsdGVyIGJsb2Nrc1xuICpcbiAqIEBtZXRob2QgcmVtb3ZlRmlsdGVyQmxvY2tzXG4gKiBAcGFyYW0gc3RhcnQge0ZpbHRlckJsb2NrfVxuICogQHBhcmFtIGVuZCB7RmlsdGVyQmxvY2t9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW1vdmVGaWx0ZXJCbG9ja3MgPSBmdW5jdGlvbiByZW1vdmVGaWx0ZXJCbG9ja3Moc3RhcnQsIGVuZClcbntcbiAgICB0aGlzLnJlbW92ZU9iamVjdChzdGFydCk7XG4gICAgdGhpcy5yZW1vdmVPYmplY3QoZW5kKTtcbn07XG5cbi8qKlxuICogQWRkcyBhIGRpc3BsYXkgb2JqZWN0IGFuZCBjaGlsZHJlbiB0byB0aGUgd2ViZ2wgY29udGV4dFxuICpcbiAqIEBtZXRob2QgYWRkRGlzcGxheU9iamVjdEFuZENoaWxkcmVuXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmFkZERpc3BsYXlPYmplY3RBbmRDaGlsZHJlbiA9IGZ1bmN0aW9uIGFkZERpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihkaXNwbGF5T2JqZWN0KVxue1xuICAgIGlmKGRpc3BsYXlPYmplY3QuX19yZW5kZXJHcm91cClkaXNwbGF5T2JqZWN0Ll9fcmVuZGVyR3JvdXAucmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGRpc3BsYXlPYmplY3QpO1xuXG4gICAgLypcbiAgICAgKiAgTE9PSyBGT1IgVEhFIFBSRVZJT1VTIFJFTkRFUkFCTEVcbiAgICAgKiAgVGhpcyBwYXJ0IGxvb2tzIGZvciB0aGUgY2xvc2VzdCBwcmV2aW91cyBzcHJpdGUgdGhhdCBjYW4gZ28gaW50byBhIGJhdGNoXG4gICAgICogIEl0IGtlZXBzIGdvaW5nIGJhY2sgdW50aWwgaXQgZmluZHMgYSBzcHJpdGUgb3IgdGhlIHN0YWdlXG4gICAgICovXG5cbiAgICB2YXIgcHJldmlvdXNSZW5kZXJhYmxlID0gZGlzcGxheU9iamVjdC5maXJzdDtcbiAgICB3aGlsZShwcmV2aW91c1JlbmRlcmFibGUgIT09IHRoaXMucm9vdC5maXJzdClcbiAgICB7XG4gICAgICAgIHByZXZpb3VzUmVuZGVyYWJsZSA9IHByZXZpb3VzUmVuZGVyYWJsZS5faVByZXY7XG4gICAgICAgIGlmKHByZXZpb3VzUmVuZGVyYWJsZS5yZW5kZXJhYmxlICYmIHByZXZpb3VzUmVuZGVyYWJsZS5fX3JlbmRlckdyb3VwKWJyZWFrO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogIExPT0sgRk9SIFRIRSBORVhUIFNQUklURVxuICAgICAqICBUaGlzIHBhcnQgbG9va3MgZm9yIHRoZSBjbG9zZXN0IG5leHQgc3ByaXRlIHRoYXQgY2FuIGdvIGludG8gYSBiYXRjaFxuICAgICAqICBpdCBrZWVwcyBsb29raW5nIHVudGlsIGl0IGZpbmRzIGEgc3ByaXRlIG9yIGdldHMgdG8gdGhlIGVuZCBvZiB0aGUgZGlzcGxheVxuICAgICAqICBzY2VuZSBncmFwaFxuICAgICAqL1xuICAgIHZhciBuZXh0UmVuZGVyYWJsZSA9IGRpc3BsYXlPYmplY3QubGFzdDtcbiAgICB3aGlsZShuZXh0UmVuZGVyYWJsZS5faU5leHQpXG4gICAge1xuICAgICAgICBuZXh0UmVuZGVyYWJsZSA9IG5leHRSZW5kZXJhYmxlLl9pTmV4dDtcbiAgICAgICAgaWYobmV4dFJlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBuZXh0UmVuZGVyYWJsZS5fX3JlbmRlckdyb3VwKWJyZWFrO1xuICAgIH1cblxuICAgIC8vIG9uZSB0aGUgZGlzcGxheSBvYmplY3QgaGl0cyB0aGlzLiB3ZSBjYW4gYnJlYWsgdGhlIGxvb3BcblxuICAgIHZhciB0ZW1wT2JqZWN0ID0gZGlzcGxheU9iamVjdC5maXJzdDtcbiAgICB2YXIgdGVzdE9iamVjdCA9IGRpc3BsYXlPYmplY3QubGFzdC5faU5leHQ7XG5cbiAgICBkb1xuICAgIHtcbiAgICAgICAgdGVtcE9iamVjdC5fX3JlbmRlckdyb3VwID0gdGhpcztcblxuICAgICAgICBpZih0ZW1wT2JqZWN0LnJlbmRlcmFibGUpXG4gICAgICAgIHtcblxuICAgICAgICAgICAgdGhpcy5pbnNlcnRPYmplY3QodGVtcE9iamVjdCwgcHJldmlvdXNSZW5kZXJhYmxlLCBuZXh0UmVuZGVyYWJsZSk7XG4gICAgICAgICAgICBwcmV2aW91c1JlbmRlcmFibGUgPSB0ZW1wT2JqZWN0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGVtcE9iamVjdCA9IHRlbXBPYmplY3QuX2lOZXh0O1xuICAgIH1cbiAgICB3aGlsZSh0ZW1wT2JqZWN0ICE9PSB0ZXN0T2JqZWN0KTtcbn07XG5cbi8qKlxuICogUmVtb3ZlcyBhIGRpc3BsYXkgb2JqZWN0IGFuZCBjaGlsZHJlbiB0byB0aGUgd2ViZ2wgY29udGV4dFxuICpcbiAqIEBtZXRob2QgcmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlbiA9IGZ1bmN0aW9uIHJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihkaXNwbGF5T2JqZWN0KVxue1xuICAgIGlmKGRpc3BsYXlPYmplY3QuX19yZW5kZXJHcm91cCAhPT0gdGhpcykgcmV0dXJuO1xuXG4gICAgZG9cbiAgICB7XG4gICAgICAgIGRpc3BsYXlPYmplY3QuX19yZW5kZXJHcm91cCA9IG51bGw7XG4gICAgICAgIGlmKGRpc3BsYXlPYmplY3QucmVuZGVyYWJsZSl0aGlzLnJlbW92ZU9iamVjdChkaXNwbGF5T2JqZWN0KTtcbiAgICAgICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QuX2lOZXh0O1xuICAgIH1cbiAgICB3aGlsZShkaXNwbGF5T2JqZWN0KTtcbn07XG5cbi8qKlxuICogSW5zZXJ0cyBhIGRpc3BsYXlPYmplY3QgaW50byB0aGUgbGlua2VkIGxpc3RcbiAqXG4gKiBAbWV0aG9kIGluc2VydE9iamVjdFxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcGFyYW0gcHJldmlvdXNPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcGFyYW0gbmV4dE9iamVjdCB7RGlzcGxheU9iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmluc2VydE9iamVjdCA9IGZ1bmN0aW9uIGluc2VydE9iamVjdChkaXNwbGF5T2JqZWN0LCBwcmV2aW91c09iamVjdCwgbmV4dE9iamVjdClcbntcbiAgICAvLyB3aGlsZSBsb29waW5nIGJlbG93IFRIRSBPQkpFQ1QgTUFZIE5PVCBIQVZFIEJFRU4gQURERURcbiAgICB2YXIgcHJldmlvdXNTcHJpdGUgPSBwcmV2aW91c09iamVjdCxcbiAgICAgICAgbmV4dFNwcml0ZSA9IG5leHRPYmplY3QsXG4gICAgICAgIGJhdGNoLCBpbmRleDtcblxuICAgIC8qXG4gICAgICogc28gbm93IHdlIGhhdmUgdGhlIG5leHQgcmVuZGVyYWJsZSBhbmQgdGhlIHByZXZpb3VzIHJlbmRlcmFibGVcbiAgICAgKlxuICAgICAqL1xuICAgIGlmKGRpc3BsYXlPYmplY3QgaW5zdGFuY2VvZiBTcHJpdGUpXG4gICAge1xuICAgICAgICB2YXIgcHJldmlvdXNCYXRjaCwgbmV4dEJhdGNoO1xuXG4gICAgICAgIGlmKHByZXZpb3VzU3ByaXRlIGluc3RhbmNlb2YgU3ByaXRlKVxuICAgICAgICB7XG4gICAgICAgICAgICBwcmV2aW91c0JhdGNoID0gcHJldmlvdXNTcHJpdGUuYmF0Y2g7XG4gICAgICAgICAgICBpZihwcmV2aW91c0JhdGNoKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlmKHByZXZpb3VzQmF0Y2gudGV4dHVyZSA9PT0gZGlzcGxheU9iamVjdC50ZXh0dXJlLmJhc2VUZXh0dXJlICYmIHByZXZpb3VzQmF0Y2guYmxlbmRNb2RlID09PSBkaXNwbGF5T2JqZWN0LmJsZW5kTW9kZSlcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzQmF0Y2guaW5zZXJ0QWZ0ZXIoZGlzcGxheU9iamVjdCwgcHJldmlvdXNTcHJpdGUpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gVE9ETyByZXdvcmQhXG4gICAgICAgICAgICBwcmV2aW91c0JhdGNoID0gcHJldmlvdXNTcHJpdGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZihuZXh0U3ByaXRlKVxuICAgICAgICB7XG4gICAgICAgICAgICBpZihuZXh0U3ByaXRlIGluc3RhbmNlb2YgU3ByaXRlKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5leHRCYXRjaCA9IG5leHRTcHJpdGUuYmF0Y2g7XG5cbiAgICAgICAgICAgICAgICAvL2JhdGNoIG1heSBub3QgZXhpc3QgaWYgaXRlbSB3YXMgYWRkZWQgdG8gdGhlIGRpc3BsYXkgbGlzdCBidXQgbm90IHRvIHRoZSB3ZWJHTFxuICAgICAgICAgICAgICAgIGlmKG5leHRCYXRjaClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlmKG5leHRCYXRjaC50ZXh0dXJlID09PSBkaXNwbGF5T2JqZWN0LnRleHR1cmUuYmFzZVRleHR1cmUgJiYgbmV4dEJhdGNoLmJsZW5kTW9kZSA9PT0gZGlzcGxheU9iamVjdC5ibGVuZE1vZGUpXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHRCYXRjaC5pbnNlcnRCZWZvcmUoZGlzcGxheU9iamVjdCwgbmV4dFNwcml0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihuZXh0QmF0Y2ggPT09IHByZXZpb3VzQmF0Y2gpXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVEhFUkUgSVMgQSBTUExJVCBJTiBUSElTIEJBVENIISAvL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzcGxpdEJhdGNoID0gcHJldmlvdXNCYXRjaC5zcGxpdChuZXh0U3ByaXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDT09MIVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCBpdCBiYWNrIGludG8gdGhlIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKiBPT1BTIVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqIHNlZW1zIHRoZSBuZXcgc3ByaXRlIGlzIGluIHRoZSBtaWRkbGUgb2YgYSBiYXRjaFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqIGxldHMgc3BsaXQgaXQuLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhdGNoID0gV2ViR0xCYXRjaC5nZXRCYXRjaCgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSB0aGlzLmJhdGNocy5pbmRleE9mKCBwcmV2aW91c0JhdGNoICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmF0Y2guaW5pdChkaXNwbGF5T2JqZWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXggKyAxLCAwLCBiYXRjaCwgc3BsaXRCYXRjaCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETyByZS13b3JkIVxuXG4gICAgICAgICAgICAgICAgbmV4dEJhdGNoID0gbmV4dFNwcml0ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qXG4gICAgICAgICAqIGxvb2tzIGxpa2UgaXQgZG9lcyBub3QgYmVsb25nIHRvIGFueSBiYXRjaCFcbiAgICAgICAgICogYnV0IGlzIGFsc28gbm90IGludGVyc2VjdGluZyBvbmUuLlxuICAgICAgICAgKiB0aW1lIHRvIGNyZWF0ZSBhbmV3IG9uZSFcbiAgICAgICAgICovXG5cbiAgICAgICAgYmF0Y2ggPSBXZWJHTEJhdGNoLmdldEJhdGNoKCk7XG4gICAgICAgIGJhdGNoLmluaXQoZGlzcGxheU9iamVjdCk7XG5cbiAgICAgICAgaWYocHJldmlvdXNCYXRjaCkgLy8gaWYgdGhpcyBpcyBpbnZhbGlkIGl0IG1lYW5zXG4gICAgICAgIHtcbiAgICAgICAgICAgIGluZGV4ID0gdGhpcy5iYXRjaHMuaW5kZXhPZiggcHJldmlvdXNCYXRjaCApO1xuICAgICAgICAgICAgdGhpcy5iYXRjaHMuc3BsaWNlKGluZGV4ICsgMSwgMCwgYmF0Y2gpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5iYXRjaHMucHVzaChiYXRjaCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGVsc2UgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIFRpbGluZ1Nwcml0ZSlcbiAgICB7XG5cbiAgICAgICAgLy8gYWRkIHRvIGEgYmF0Y2ghIVxuICAgICAgICB0aGlzLmluaXRUaWxpbmdTcHJpdGUoZGlzcGxheU9iamVjdCk7XG4gICAgLy8gIHRoaXMuYmF0Y2hzLnB1c2goZGlzcGxheU9iamVjdCk7XG5cbiAgICB9XG4gICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3RyaXApXG4gICAge1xuICAgICAgICAvLyBhZGQgdG8gYSBiYXRjaCEhXG4gICAgICAgIHRoaXMuaW5pdFN0cmlwKGRpc3BsYXlPYmplY3QpO1xuICAgIC8vICB0aGlzLmJhdGNocy5wdXNoKGRpc3BsYXlPYmplY3QpO1xuICAgIH1cbiAgICAvKlxuICAgIGVsc2UgaWYoZGlzcGxheU9iamVjdCkvLyBpbnN0YW5jZW9mIEdyYXBoaWNzKVxuICAgIHtcbiAgICAgICAgLy9kaXNwbGF5T2JqZWN0LmluaXRXZWJHTCh0aGlzKTtcblxuICAgICAgICAvLyBhZGQgdG8gYSBiYXRjaCEhXG4gICAgICAgIC8vdGhpcy5pbml0U3RyaXAoZGlzcGxheU9iamVjdCk7XG4gICAgICAgIC8vdGhpcy5iYXRjaHMucHVzaChkaXNwbGF5T2JqZWN0KTtcbiAgICB9XG4gICAgKi9cblxuICAgIHRoaXMuaW5zZXJ0QWZ0ZXIoZGlzcGxheU9iamVjdCwgcHJldmlvdXNTcHJpdGUpO1xuXG4gICAgLy8gaW5zZXJ0IGFuZCBTUExJVCFcbn07XG5cbi8qKlxuICogSW5zZXJ0cyBhIGRpc3BsYXlPYmplY3QgaW50byB0aGUgbGlua2VkIGxpc3RcbiAqXG4gKiBAbWV0aG9kIGluc2VydEFmdGVyXG4gKiBAcGFyYW0gaXRlbSB7RGlzcGxheU9iamVjdH1cbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fSBUaGUgb2JqZWN0IHRvIGluc2VydFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uaW5zZXJ0QWZ0ZXIgPSBmdW5jdGlvbiBpbnNlcnRBZnRlcihpdGVtLCBkaXNwbGF5T2JqZWN0KVxue1xuICAgIHZhciBwcmV2aW91c0JhdGNoLCBzcGxpdEJhdGNoLCBpbmRleDtcblxuICAgIGlmKGRpc3BsYXlPYmplY3QgaW5zdGFuY2VvZiBTcHJpdGUpXG4gICAge1xuICAgICAgICBwcmV2aW91c0JhdGNoID0gZGlzcGxheU9iamVjdC5iYXRjaDtcblxuICAgICAgICBpZihwcmV2aW91c0JhdGNoKVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBzbyB0aGlzIG9iamVjdCBpcyBpbiBhIGJhdGNoIVxuXG4gICAgICAgICAgICAvLyBpcyBpdCBub3Q/IG5lZWQgdG8gc3BsaXQgdGhlIGJhdGNoXG4gICAgICAgICAgICBpZihwcmV2aW91c0JhdGNoLnRhaWwgPT09IGRpc3BsYXlPYmplY3QpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gaXMgaXQgdGFpbD8gaW5zZXJ0IGluIHRvIGJhdGNoc1xuICAgICAgICAgICAgICAgIGluZGV4ID0gdGhpcy5iYXRjaHMuaW5kZXhPZiggcHJldmlvdXNCYXRjaCApO1xuICAgICAgICAgICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCsxLCAwLCBpdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBUT0RPIE1PRElGWSBBREQgLyBSRU1PVkUgQ0hJTEQgVE8gQUNDT1VOVCBGT1IgRklMVEVSUyAoYWxzbyBnZXQgcHJldiBhbmQgbmV4dCkgLy9cblxuICAgICAgICAgICAgICAgIC8vIFRIRVJFIElTIEEgU1BMSVQgSU4gVEhJUyBCQVRDSCEgLy9cbiAgICAgICAgICAgICAgICBzcGxpdEJhdGNoID0gcHJldmlvdXNCYXRjaC5zcGxpdChkaXNwbGF5T2JqZWN0Ll9fbmV4dCk7XG5cbiAgICAgICAgICAgICAgICAvLyBDT09MIVxuICAgICAgICAgICAgICAgIC8vIGFkZCBpdCBiYWNrIGludG8gdGhlIGFycmF5XG4gICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgKiBPT1BTIVxuICAgICAgICAgICAgICAgICAqIHNlZW1zIHRoZSBuZXcgc3ByaXRlIGlzIGluIHRoZSBtaWRkbGUgb2YgYSBiYXRjaFxuICAgICAgICAgICAgICAgICAqIGxldHMgc3BsaXQgaXQuLlxuICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGluZGV4ID0gdGhpcy5iYXRjaHMuaW5kZXhPZiggcHJldmlvdXNCYXRjaCApO1xuICAgICAgICAgICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCsxLCAwLCBpdGVtLCBzcGxpdEJhdGNoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuYmF0Y2hzLnB1c2goaXRlbSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgaW5kZXggPSB0aGlzLmJhdGNocy5pbmRleE9mKCBkaXNwbGF5T2JqZWN0ICk7XG4gICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCsxLCAwLCBpdGVtKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFJlbW92ZXMgYSBkaXNwbGF5T2JqZWN0IGZyb20gdGhlIGxpbmtlZCBsaXN0XG4gKlxuICogQG1ldGhvZCByZW1vdmVPYmplY3RcbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fSBUaGUgb2JqZWN0IHRvIHJlbW92ZVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVtb3ZlT2JqZWN0ID0gZnVuY3Rpb24gcmVtb3ZlT2JqZWN0KGRpc3BsYXlPYmplY3QpXG57XG4gICAgLy8gbG9vcCB0aHJvdWdoIGNoaWxkcmVuLi5cbiAgICAvLyBkaXNwbGF5IG9iamVjdCAvL1xuXG4gICAgLy8gYWRkIGEgY2hpbGQgZnJvbSB0aGUgcmVuZGVyIGdyb3VwLi5cbiAgICAvLyByZW1vdmUgaXQgYW5kIGFsbCBpdHMgY2hpbGRyZW4hXG4gICAgLy9kaXNwbGF5T2JqZWN0LmNhY2hlVmlzaWJsZSA9IGZhbHNlOy8vZGlzcGxheU9iamVjdC52aXNpYmxlO1xuXG4gICAgLypcbiAgICAgKiByZW1vdmluZyBpcyBhIGxvdCBxdWlja2VyLi5cbiAgICAgKlxuICAgICAqL1xuICAgIHZhciBiYXRjaFRvUmVtb3ZlLCBpbmRleDtcblxuICAgIGlmIChkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3ByaXRlKVxuICAgIHtcbiAgICAgICAgLy8gc2hvdWxkIGFsd2F5cyBoYXZlIGEgYmF0Y2ghXG4gICAgICAgIHZhciBiYXRjaCA9IGRpc3BsYXlPYmplY3QuYmF0Y2g7XG4gICAgICAgIGlmKCFiYXRjaClyZXR1cm47IC8vIHRoaXMgbWVhbnMgdGhlIGRpc3BsYXkgbGlzdCBoYXMgYmVlbiBhbHRlcmVkIGJlZnJlIHJlbmRlcmluZ1xuXG4gICAgICAgIGJhdGNoLnJlbW92ZShkaXNwbGF5T2JqZWN0KTtcblxuICAgICAgICBpZiAoIWJhdGNoLnNpemUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGJhdGNoVG9SZW1vdmUgPSBiYXRjaDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBiYXRjaFRvUmVtb3ZlID0gZGlzcGxheU9iamVjdDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqIExvb2tzIGxpa2UgdGhlcmUgaXMgc29tdGhpbmcgdGhhdCBuZWVkcyByZW1vdmluZyFcbiAgICAgKi9cbiAgICBpZihiYXRjaFRvUmVtb3ZlKVxuICAgIHtcbiAgICAgICAgaW5kZXggPSB0aGlzLmJhdGNocy5pbmRleE9mKCBiYXRjaFRvUmVtb3ZlICk7XG4gICAgICAgIGlmKGluZGV4ID09PSAtMSlyZXR1cm47Ly8gdGhpcyBtZWFucyBpdCB3YXMgYWRkZWQgdGhlbiByZW1vdmVkIGJlZm9yZSByZW5kZXJlZFxuXG4gICAgICAgIC8vIG9rIHNvLi4gY2hlY2sgdG8gc2VlIGlmIHlvdSBhZGphY2VudCBiYXRjaHMgc2hvdWxkIGJlIGpvaW5lZC5cbiAgICAgICAgLy8gVE9ETyBtYXkgb3B0aW1pc2U/XG4gICAgICAgIGlmKGluZGV4ID09PSAwIHx8IGluZGV4ID09PSB0aGlzLmJhdGNocy5sZW5ndGgtMSlcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gd2hhIC0gZXZhISBqdXN0IGdldCBvZiB0aGUgZW1wdHkgYmF0Y2ghXG4gICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgaWYoYmF0Y2hUb1JlbW92ZSBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpV2ViR0xCYXRjaC5yZXR1cm5CYXRjaChiYXRjaFRvUmVtb3ZlKTtcblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5iYXRjaHNbaW5kZXgtMV0gaW5zdGFuY2VvZiBXZWJHTEJhdGNoICYmIHRoaXMuYmF0Y2hzW2luZGV4KzFdIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICAgICAge1xuICAgICAgICAgICAgaWYodGhpcy5iYXRjaHNbaW5kZXgtMV0udGV4dHVyZSA9PT0gdGhpcy5iYXRjaHNbaW5kZXgrMV0udGV4dHVyZSAmJiB0aGlzLmJhdGNoc1tpbmRleC0xXS5ibGVuZE1vZGUgPT09IHRoaXMuYmF0Y2hzW2luZGV4KzFdLmJsZW5kTW9kZSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiTUVSR0VcIilcbiAgICAgICAgICAgICAgICB0aGlzLmJhdGNoc1tpbmRleC0xXS5tZXJnZSh0aGlzLmJhdGNoc1tpbmRleCsxXSk7XG5cbiAgICAgICAgICAgICAgICBpZihiYXRjaFRvUmVtb3ZlIGluc3RhbmNlb2YgV2ViR0xCYXRjaClXZWJHTEJhdGNoLnJldHVybkJhdGNoKGJhdGNoVG9SZW1vdmUpO1xuICAgICAgICAgICAgICAgIFdlYkdMQmF0Y2gucmV0dXJuQmF0Y2godGhpcy5iYXRjaHNbaW5kZXgrMV0pO1xuICAgICAgICAgICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCwgMik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5iYXRjaHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaWYoYmF0Y2hUb1JlbW92ZSBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpV2ViR0xCYXRjaC5yZXR1cm5CYXRjaChiYXRjaFRvUmVtb3ZlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEluaXRpYWxpemVzIGEgdGlsaW5nIHNwcml0ZVxuICpcbiAqIEBtZXRob2QgaW5pdFRpbGluZ1Nwcml0ZVxuICogQHBhcmFtIHNwcml0ZSB7VGlsaW5nU3ByaXRlfSBUaGUgdGlsaW5nIHNwcml0ZSB0byBpbml0aWFsaXplXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5pbml0VGlsaW5nU3ByaXRlID0gZnVuY3Rpb24gaW5pdFRpbGluZ1Nwcml0ZShzcHJpdGUpXG57XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIC8vIG1ha2UgdGhlIHRleHR1cmUgdGlsYWJsZS4uXG5cbiAgICBzcHJpdGUudmVydGljaWVzID0gbmV3IEZsb2F0MzJBcnJheShbMCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwcml0ZS53aWR0aCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwcml0ZS53aWR0aCwgIHNwcml0ZS5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsICBzcHJpdGUuaGVpZ2h0XSk7XG5cbiAgICBzcHJpdGUudXZzID0gbmV3IEZsb2F0MzJBcnJheShbMCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLCAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwgMV0pO1xuXG4gICAgc3ByaXRlLmNvbG9ycyA9IG5ldyBGbG9hdDMyQXJyYXkoWzEsMSwxLDFdKTtcblxuICAgIHNwcml0ZS5pbmRpY2VzID0gIG5ldyBVaW50MTZBcnJheShbMCwgMSwgMywyXSk7IC8vLCAyXSk7XG5cbiAgICBzcHJpdGUuX3ZlcnRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHNwcml0ZS5faW5kZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzcHJpdGUuX3V2QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgc3ByaXRlLl9jb2xvckJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHNwcml0ZS5fdmVydGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgc3ByaXRlLnZlcnRpY2llcywgZ2wuU1RBVElDX0RSQVcpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHNwcml0ZS5fdXZCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAgc3ByaXRlLnV2cywgZ2wuRFlOQU1JQ19EUkFXKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzcHJpdGUuX2NvbG9yQnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgc3ByaXRlLmNvbG9ycywgZ2wuU1RBVElDX0RSQVcpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc3ByaXRlLl9pbmRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc3ByaXRlLmluZGljZXMsIGdsLlNUQVRJQ19EUkFXKTtcblxuLy8gICAgcmV0dXJuICggKHggPiAwKSAmJiAoKHggJiAoeCAtIDEpKSA9PSAwKSApO1xuXG4gICAgaWYoc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSlcbiAgICB7XG4gICAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHNwcml0ZS50ZXh0dXJlLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUpO1xuICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5SRVBFQVQpO1xuICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5SRVBFQVQpO1xuICAgICAgICBzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5fcG93ZXJPZjIgPSB0cnVlO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5fcG93ZXJPZjIgPSB0cnVlO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmVuZGVycyBhIFN0cmlwXG4gKlxuICogQG1ldGhvZCByZW5kZXJTdHJpcFxuICogQHBhcmFtIHN0cmlwIHtTdHJpcH0gVGhlIHN0cmlwIHRvIHJlbmRlclxuICogQHBhcmFtIHByb2plY3Rpb24ge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbmRlclN0cmlwID0gZnVuY3Rpb24gcmVuZGVyU3RyaXAoc3RyaXAsIHByb2plY3Rpb24pXG57XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIHNoYWRlcnMuYWN0aXZhdGVTdHJpcFNoYWRlcigpO1xuXG4gICAgdmFyIHNoYWRlciA9IGdsb2JhbHMuc3RyaXBTaGFkZXI7XG5cbiAgICB2YXIgbSA9IG1hdDMuY2xvbmUoc3RyaXAud29ybGRUcmFuc2Zvcm0pO1xuXG4gICAgbWF0My50cmFuc3Bvc2UobSk7XG5cbiAgICAvLyBzZXQgdGhlIG1hdHJpeCB0cmFuc2Zvcm0gZm9yIHRoZVxuICAgIGdsLnVuaWZvcm1NYXRyaXgzZnYoc2hhZGVyLnRyYW5zbGF0aW9uTWF0cml4LCBmYWxzZSwgbSk7XG4gICAgZ2wudW5pZm9ybTJmKHNoYWRlci5wcm9qZWN0aW9uVmVjdG9yLCBwcm9qZWN0aW9uLngsIHByb2plY3Rpb24ueSk7XG4gICAgZ2wudW5pZm9ybTJmKHNoYWRlci5vZmZzZXRWZWN0b3IsIC1nbG9iYWxzLm9mZnNldC54LCAtZ2xvYmFscy5vZmZzZXQueSk7XG5cbiAgICBnbC51bmlmb3JtMWYoc2hhZGVyLmFscGhhLCBzdHJpcC53b3JsZEFscGhhKTtcblxuICAgIC8qXG4gICAgaWYoc3RyaXAuYmxlbmRNb2RlID09IGJsZW5kTW9kZXMuTk9STUFMKVxuICAgIHtcbiAgICAgICAgZ2wuYmxlbmRGdW5jKGdsLk9ORSwgZ2wuT05FX01JTlVTX1NSQ19BTFBIQSk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIGdsLmJsZW5kRnVuYyhnbC5PTkUsIGdsLk9ORV9NSU5VU19TUkNfQ09MT1IpO1xuICAgIH1cbiAgICAqL1xuXG5cbiAgICBpZighc3RyaXAuZGlydHkpXG4gICAge1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAuX3ZlcnRleEJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlclN1YkRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAwLCBzdHJpcC52ZXJ0aWNpZXMpO1xuICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlci5hVmVydGV4UG9zaXRpb24sIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSB1dnNcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl91dkJ1ZmZlcik7XG4gICAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyLmFUZXh0dXJlQ29vcmQsIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgZ2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCk7XG4gICAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHN0cmlwLnRleHR1cmUuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSk7XG5cbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl9jb2xvckJ1ZmZlcik7XG4gICAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyLmNvbG9yQXR0cmlidXRlLCAxLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgICAgIC8vIGRvbnQgbmVlZCB0byB1cGxvYWQhXG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHN0cmlwLl9pbmRleEJ1ZmZlcik7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHN0cmlwLmRpcnR5ID0gZmFsc2U7XG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fdmVydGV4QnVmZmVyKTtcbiAgICAgICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLnZlcnRpY2llcywgZ2wuU1RBVElDX0RSQVcpO1xuICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlci5hVmVydGV4UG9zaXRpb24sIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSB1dnNcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl91dkJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC51dnMsIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXIuYVRleHR1cmVDb29yZCwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgICAgICBnbC5hY3RpdmVUZXh0dXJlKGdsLlRFWFRVUkUwKTtcbiAgICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgc3RyaXAudGV4dHVyZS5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlKTtcblxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAuX2NvbG9yQnVmZmVyKTtcbiAgICAgICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLmNvbG9ycywgZ2wuU1RBVElDX0RSQVcpO1xuICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlci5jb2xvckF0dHJpYnV0ZSwgMSwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgICAgICAvLyBkb250IG5lZWQgdG8gdXBsb2FkIVxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzdHJpcC5faW5kZXhCdWZmZXIpO1xuICAgICAgICBnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzdHJpcC5pbmRpY2VzLCBnbC5TVEFUSUNfRFJBVyk7XG5cbiAgICB9XG5cbiAgICBnbC5kcmF3RWxlbWVudHMoZ2wuVFJJQU5HTEVfU1RSSVAsIHN0cmlwLmluZGljZXMubGVuZ3RoLCBnbC5VTlNJR05FRF9TSE9SVCwgMCk7XG5cbiAgICBzaGFkZXJzLmRlYWN0aXZhdGVTdHJpcFNoYWRlcigpO1xufTtcblxuLyoqXG4gKiBSZW5kZXJzIGEgVGlsaW5nU3ByaXRlXG4gKlxuICogQG1ldGhvZCByZW5kZXJUaWxpbmdTcHJpdGVcbiAqIEBwYXJhbSBzcHJpdGUge1RpbGluZ1Nwcml0ZX0gVGhlIHRpbGluZyBzcHJpdGUgdG8gcmVuZGVyXG4gKiBAcGFyYW0gcHJvamVjdGlvbk1hdHJpeCB7T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyVGlsaW5nU3ByaXRlID0gZnVuY3Rpb24gcmVuZGVyVGlsaW5nU3ByaXRlKHNwcml0ZSwgcHJvamVjdGlvbk1hdHJpeClcbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuXG4gICAgdmFyIHRpbGVQb3NpdGlvbiA9IHNwcml0ZS50aWxlUG9zaXRpb247XG4gICAgdmFyIHRpbGVTY2FsZSA9IHNwcml0ZS50aWxlU2NhbGU7XG5cbiAgICB2YXIgb2Zmc2V0WCA9ICB0aWxlUG9zaXRpb24ueC9zcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS53aWR0aDtcbiAgICB2YXIgb2Zmc2V0WSA9ICB0aWxlUG9zaXRpb24ueS9zcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5oZWlnaHQ7XG5cbiAgICB2YXIgc2NhbGVYID0gIChzcHJpdGUud2lkdGggLyBzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS53aWR0aCkgIC8gdGlsZVNjYWxlLng7XG4gICAgdmFyIHNjYWxlWSA9ICAoc3ByaXRlLmhlaWdodCAvIHNwcml0ZS50ZXh0dXJlLmJhc2VUZXh0dXJlLmhlaWdodCkgLyB0aWxlU2NhbGUueTtcblxuICAgIHNwcml0ZS51dnNbMF0gPSAwIC0gb2Zmc2V0WDtcbiAgICBzcHJpdGUudXZzWzFdID0gMCAtIG9mZnNldFk7XG5cbiAgICBzcHJpdGUudXZzWzJdID0gKDEgKiBzY2FsZVgpICAtb2Zmc2V0WDtcbiAgICBzcHJpdGUudXZzWzNdID0gMCAtIG9mZnNldFk7XG5cbiAgICBzcHJpdGUudXZzWzRdID0gKDEgKnNjYWxlWCkgLSBvZmZzZXRYO1xuICAgIHNwcml0ZS51dnNbNV0gPSAoMSAqc2NhbGVZKSAtIG9mZnNldFk7XG5cbiAgICBzcHJpdGUudXZzWzZdID0gMCAtIG9mZnNldFg7XG4gICAgc3ByaXRlLnV2c1s3XSA9ICgxICpzY2FsZVkpIC0gb2Zmc2V0WTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzcHJpdGUuX3V2QnVmZmVyKTtcbiAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgc3ByaXRlLnV2cyk7XG5cbiAgICB0aGlzLnJlbmRlclN0cmlwKHNwcml0ZSwgcHJvamVjdGlvbk1hdHJpeCk7XG59O1xuXG4vKipcbiAqIEluaXRpYWxpemVzIGEgc3RyaXAgdG8gYmUgcmVuZGVyZWRcbiAqXG4gKiBAbWV0aG9kIGluaXRTdHJpcFxuICogQHBhcmFtIHN0cmlwIHtTdHJpcH0gVGhlIHN0cmlwIHRvIGluaXRpYWxpemVcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmluaXRTdHJpcCA9IGZ1bmN0aW9uIGluaXRTdHJpcChzdHJpcClcbntcbiAgICAvLyBidWlsZCB0aGUgc3RyaXAhXG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIHN0cmlwLl92ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzdHJpcC5faW5kZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzdHJpcC5fdXZCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzdHJpcC5fY29sb3JCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fdmVydGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAudmVydGljaWVzLCBnbC5EWU5BTUlDX0RSQVcpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl91dkJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsICBzdHJpcC51dnMsIGdsLlNUQVRJQ19EUkFXKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fY29sb3JCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5jb2xvcnMsIGdsLlNUQVRJQ19EUkFXKTtcblxuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc3RyaXAuX2luZGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzdHJpcC5pbmRpY2VzLCBnbC5TVEFUSUNfRFJBVyk7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgYSBsb2FkZWQgd2ViZ2wgdGV4dHVyZVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgdXBkYXRlVGV4dHVyZVxuICogQHBhcmFtIGdsIHtXZWJHTENvbnRleHR9IEFuIGluc3RhbmNlIG9mIHRoZSB3ZWJHTCBjb250ZXh0XG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX0gVGhlIHRleHR1cmUgdG8gdXBkYXRlXG4gKi9cbldlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZSA9IGZ1bmN0aW9uIHVwZGF0ZVRleHR1cmUoZ2wsIHRleHR1cmUpXG57XG4gICAgLy9UT0RPIGJyZWFrIHRoaXMgb3V0IGludG8gYSB0ZXh0dXJlIG1hbmFnZXIuLi5cbiAgICBpZighdGV4dHVyZS5fZ2xUZXh0dXJlKVxuICAgIHtcbiAgICAgICAgdGV4dHVyZS5fZ2xUZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgIH1cblxuICAgIGlmKHRleHR1cmUuaGFzTG9hZGVkKVxuICAgIHtcbiAgICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZS5fZ2xUZXh0dXJlKTtcbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCB0cnVlKTtcblxuICAgICAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIHRleHR1cmUuc291cmNlKTtcbiAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIHRleHR1cmUuc2NhbGVNb2RlID09PSBCYXNlVGV4dHVyZS5TQ0FMRV9NT0RFLkxJTkVBUiA/IGdsLkxJTkVBUiA6IGdsLk5FQVJFU1QpO1xuICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgdGV4dHVyZS5zY2FsZU1vZGUgPT09IEJhc2VUZXh0dXJlLlNDQUxFX01PREUuTElORUFSID8gZ2wuTElORUFSIDogZ2wuTkVBUkVTVCk7XG5cbiAgICAgICAgLy8gcmVndWxlci4uLlxuXG4gICAgICAgIGlmKCF0ZXh0dXJlLl9wb3dlck9mMilcbiAgICAgICAge1xuICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLlJFUEVBVCk7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5SRVBFQVQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBEZXN0cm95cyBhIGxvYWRlZCB3ZWJnbCB0ZXh0dXJlXG4gKlxuICogQG1ldGhvZCBkZXN0cm95VGV4dHVyZVxuICogQHBhcmFtIGdsIHtXZWJHTENvbnRleHR9IEFuIGluc3RhbmNlIG9mIHRoZSB3ZWJHTCBjb250ZXh0XG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX0gVGhlIHRleHR1cmUgdG8gdXBkYXRlXG4gKi9cbldlYkdMUmVuZGVyR3JvdXAuZGVzdHJveVRleHR1cmUgPSBmdW5jdGlvbiBkZXN0cm95VGV4dHVyZShnbCwgdGV4dHVyZSlcbntcbiAgICAvL1RPRE8gYnJlYWsgdGhpcyBvdXQgaW50byBhIHRleHR1cmUgbWFuYWdlci4uLlxuICAgIGlmKHRleHR1cmUuX2dsVGV4dHVyZSlcbiAgICB7XG4gICAgICAgIHRleHR1cmUuX2dsVGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICAgICAgZ2wuZGVsZXRlVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlLl9nbFRleHR1cmUpO1xuICAgIH1cbn07XG5cbi8qKlxuICogVXBkYXRlcyB0aGUgdGV4dHVyZXMgbG9hZGVkIGludG8gdGhpcyB3ZWJnbCByZW5kZXJlclxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgdXBkYXRlVGV4dHVyZXNcbiAqIEBwYXJhbSBnbCB7V2ViR0xDb250ZXh0fSBBbiBpbnN0YW5jZSBvZiB0aGUgd2ViR0wgY29udGV4dFxuICovXG5XZWJHTFJlbmRlckdyb3VwLnVwZGF0ZVRleHR1cmVzID0gZnVuY3Rpb24gdXBkYXRlVGV4dHVyZXMoZ2wpXG57XG4gICAgLy9UT0RPIGJyZWFrIHRoaXMgb3V0IGludG8gYSB0ZXh0dXJlIG1hbmFnZXIuLi5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZS5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAgICAgIFdlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZShnbCwgZ2xvYmFscy50ZXh0dXJlc1RvVXBkYXRlW2ldKTtcbiAgICBmb3IgKGkgPSAwLCBsID0gZ2xvYmFscy50ZXh0dXJlc1RvRGVzdHJveS5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAgICAgIFdlYkdMUmVuZGVyR3JvdXAuZGVzdHJveVRleHR1cmUoZ2wsIGdsb2JhbHMudGV4dHVyZXNUb0Rlc3Ryb3lbaV0pO1xuICAgIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZSA9IFtdO1xuICAgIGdsb2JhbHMudGV4dHVyZXNUb0Rlc3Ryb3kgPSBbXTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2ViR0xSZW5kZXJHcm91cDtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vLi4vcGxhdGZvcm0nKTtcbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgc2hhZGVycyA9IHJlcXVpcmUoJy4vc2hhZGVycycpO1xuXG52YXIgV2ViR0xCYXRjaCA9IHJlcXVpcmUoJy4vV2ViR0xCYXRjaCcpO1xudmFyIFdlYkdMUmVuZGVyR3JvdXAgPSByZXF1aXJlKCcuL1dlYkdMUmVuZGVyR3JvdXAnKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uLy4uL2dlb20vUG9pbnQnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xuXG4vKipcbiAqIHRoZSBXZWJHTFJlbmRlcmVyIGlzIGRyYXdzIHRoZSBzdGFnZSBhbmQgYWxsIGl0cyBjb250ZW50IG9udG8gYSB3ZWJHTCBlbmFibGVkIGNhbnZhcy4gVGhpcyByZW5kZXJlclxuICogc2hvdWxkIGJlIHVzZWQgZm9yIGJyb3dzZXJzIHN1cHBvcnQgd2ViR0wuIFRoaXMgUmVuZGVyIHdvcmtzIGJ5IGF1dG9tYXRpY2FsbHkgbWFuYWdpbmcgd2ViR0xCYXRjaHMuXG4gKiBTbyBubyBuZWVkIGZvciBTcHJpdGUgQmF0Y2gncyBvciBTcHJpdGUgQ2xvdWQnc1xuICogRG9udCBmb3JnZXQgdG8gYWRkIHRoZSB2aWV3IHRvIHlvdXIgRE9NIG9yIHlvdSB3aWxsIG5vdCBzZWUgYW55dGhpbmcgOilcbiAqXG4gKiBAY2xhc3MgV2ViR0xSZW5kZXJlclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gd2lkdGg9MCB7TnVtYmVyfSB0aGUgd2lkdGggb2YgdGhlIGNhbnZhcyB2aWV3XG4gKiBAcGFyYW0gaGVpZ2h0PTAge051bWJlcn0gdGhlIGhlaWdodCBvZiB0aGUgY2FudmFzIHZpZXdcbiAqIEBwYXJhbSB2aWV3IHtDYW52YXN9IHRoZSBjYW52YXMgdG8gdXNlIGFzIGEgdmlldywgb3B0aW9uYWxcbiAqIEBwYXJhbSB0cmFuc3BhcmVudD1mYWxzZSB7Qm9vbGVhbn0gdGhlIHRyYW5zcGFyZW5jeSBvZiB0aGUgcmVuZGVyIHZpZXcsIGRlZmF1bHQgZmFsc2VcbiAqIEBwYXJhbSBhbnRpYWxpYXM9ZmFsc2Uge0Jvb2xlYW59IHNldHMgYW50aWFsaWFzIChvbmx5IGFwcGxpY2FibGUgaW4gY2hyb21lIGF0IHRoZSBtb21lbnQpXG4gKlxuICovXG5mdW5jdGlvbiBXZWJHTFJlbmRlcmVyKHdpZHRoLCBoZWlnaHQsIHZpZXcsIHRyYW5zcGFyZW50LCBhbnRpYWxpYXMpXG57XG4gICAgdmFyIGdsO1xuXG4gICAgdGhpcy50cmFuc3BhcmVudCA9ICEhdHJhbnNwYXJlbnQ7XG5cbiAgICB0aGlzLndpZHRoID0gd2lkdGggfHwgODAwO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0IHx8IDYwMDtcblxuICAgIHRoaXMudmlldyA9IHZpZXcgfHwgcGxhdGZvcm0uY3JlYXRlQ2FudmFzKCk7XG4gICAgdGhpcy52aWV3LndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLnZpZXcuaGVpZ2h0ID0gdGhpcy5oZWlnaHQ7XG5cbiAgICAvLyBkZWFsIHdpdGggbG9zaW5nIGNvbnRleHQuLlxuICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgdGhpcy52aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmdsY29udGV4dGxvc3QnLCBmdW5jdGlvbihldmVudCkgeyBzY29wZS5oYW5kbGVDb250ZXh0TG9zdChldmVudCk7IH0sIGZhbHNlKTtcbiAgICB0aGlzLnZpZXcuYWRkRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0cmVzdG9yZWQnLCBmdW5jdGlvbihldmVudCkgeyBzY29wZS5oYW5kbGVDb250ZXh0UmVzdG9yZWQoZXZlbnQpOyB9LCBmYWxzZSk7XG5cbiAgICB0aGlzLmJhdGNocyA9IFtdO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgIGFscGhhOiB0aGlzLnRyYW5zcGFyZW50LFxuICAgICAgICBhbnRpYWxpYXM6ISFhbnRpYWxpYXMsIC8vIFNQRUVEIFVQPz9cbiAgICAgICAgcHJlbXVsdGlwbGllZEFscGhhOmZhbHNlLFxuICAgICAgICBzdGVuY2lsOnRydWVcbiAgICB9O1xuXG4gICAgLy8gZG8gYSBjYXRjaC4uIG9ubHkgMSB3ZWJHTCByZW5kZXJlci4uXG4gICAgLy90cnkgJ2V4cGVyaW1lbnRhbC13ZWJnbCdcbiAgICB0cnkge1xuICAgICAgICBnbCA9IHRoaXMudmlldy5nZXRDb250ZXh0KCdleHBlcmltZW50YWwtd2ViZ2wnLCAgb3B0aW9ucyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvL3RyeSAnd2ViZ2wnXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBnbCA9IHRoaXMudmlldy5nZXRDb250ZXh0KCd3ZWJnbCcsICBvcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZTIpIHtcbiAgICAgICAgICAgIC8vIGZhaWwsIG5vdCBhYmxlIHRvIGdldCBhIGNvbnRleHRcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignIFRoaXMgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHdlYkdMLiBUcnkgdXNpbmcgdGhlIGNhbnZhcyByZW5kZXJlcicgKyB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBUT0RPIHJlbW92ZSB0aGlzIGdsb2JhbC4uXG4gICAgdGhpcy5nbCA9IGdsb2JhbHMuZ2wgPSBnbDtcblxuICAgIHNoYWRlcnMuaW5pdERlZmF1bHRTaGFkZXJzKCk7XG5cbiAgICBnbC51c2VQcm9ncmFtKGdsb2JhbHMuZGVmYXVsdFNoYWRlci5wcm9ncmFtKTtcblxuICAgIHRoaXMuYmF0Y2ggPSBuZXcgV2ViR0xCYXRjaChnbCk7XG4gICAgZ2wuZGlzYWJsZShnbC5ERVBUSF9URVNUKTtcbiAgICBnbC5kaXNhYmxlKGdsLkNVTExfRkFDRSk7XG5cbiAgICBnbC5lbmFibGUoZ2wuQkxFTkQpO1xuICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0aGlzLnRyYW5zcGFyZW50KTtcblxuICAgIC8vIFRPRE8gcmVtb3ZlIHRoZXNlIGdsb2JhbHMuLlxuICAgIHRoaXMucHJvamVjdGlvbiA9IGdsb2JhbHMucHJvamVjdGlvbiA9IG5ldyBQb2ludCg0MDAsIDMwMCk7XG4gICAgdGhpcy5vZmZzZXQgPSBnbG9iYWxzLm9mZnNldCA9IG5ldyBQb2ludCgwLCAwKTtcblxuICAgIHRoaXMucmVzaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgICB0aGlzLmNvbnRleHRMb3N0ID0gZmFsc2U7XG5cbiAgICB0aGlzLnN0YWdlUmVuZGVyR3JvdXAgPSBuZXcgV2ViR0xSZW5kZXJHcm91cCh0aGlzLmdsLCB0aGlzLnRyYW5zcGFyZW50KTtcbn1cblxudmFyIHByb3RvID0gV2ViR0xSZW5kZXJlci5wcm90b3R5cGU7XG5cbi8qKlxuICogUmVuZGVycyB0aGUgc3RhZ2UgdG8gaXRzIHdlYkdMIHZpZXdcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclxuICogQHBhcmFtIHN0YWdlIHtTdGFnZX0gdGhlIFN0YWdlIGVsZW1lbnQgdG8gYmUgcmVuZGVyZWRcbiAqL1xucHJvdG8ucmVuZGVyID0gZnVuY3Rpb24gcmVuZGVyKHN0YWdlKVxue1xuICAgIGlmKHRoaXMuY29udGV4dExvc3QpcmV0dXJuO1xuXG5cbiAgICAvLyBpZiByZW5kZXJpbmcgYSBuZXcgc3RhZ2UgY2xlYXIgdGhlIGJhdGNocy4uXG4gICAgaWYodGhpcy5fX3N0YWdlICE9PSBzdGFnZSlcbiAgICB7XG4gICAgICAgIC8vIFRPRE8gbWFrZSB0aGlzIHdvcmtcbiAgICAgICAgLy8gZG9udCB0aGluayB0aGlzIGlzIG5lZWRlZCBhbnkgbW9yZT9cbiAgICAgICAgdGhpcy5fX3N0YWdlID0gc3RhZ2U7XG4gICAgICAgIHRoaXMuc3RhZ2VSZW5kZXJHcm91cC5zZXRSZW5kZXJhYmxlKHN0YWdlKTtcbiAgICB9XG5cbiAgICB2YXIgZ2wgPSB0aGlzLmdsO1xuXG4gICAgLy8gdXBkYXRlIGFueSB0ZXh0dXJlc1xuICAgIFdlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZXMoZ2wpO1xuXG4gICAgLy8gdXBkYXRlIHRoZSBzY2VuZSBncmFwaFxuICAgIGdsb2JhbHMudmlzaWJsZUNvdW50Kys7XG4gICAgc3RhZ2UudXBkYXRlVHJhbnNmb3JtKCk7XG5cbiAgICAvLyAtLSBEb2VzIHRoaXMgbmVlZCB0byBiZSBzZXQgZXZlcnkgZnJhbWU/IC0tIC8vXG4gICAgZ2wuY29sb3JNYXNrKHRydWUsIHRydWUsIHRydWUsIHRoaXMudHJhbnNwYXJlbnQpO1xuICAgIGdsLnZpZXdwb3J0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG5cbiAgICBnbC5jbGVhckNvbG9yKHN0YWdlLmJhY2tncm91bmRDb2xvclNwbGl0WzBdLHN0YWdlLmJhY2tncm91bmRDb2xvclNwbGl0WzFdLHN0YWdlLmJhY2tncm91bmRDb2xvclNwbGl0WzJdLCAhdGhpcy50cmFuc3BhcmVudCk7XG4gICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG5cbiAgICAvLyBIQUNLIFRPIFRFU1RcblxuICAgIHRoaXMuc3RhZ2VSZW5kZXJHcm91cC5iYWNrZ3JvdW5kQ29sb3IgPSBzdGFnZS5iYWNrZ3JvdW5kQ29sb3JTcGxpdDtcblxuICAgIHRoaXMucHJvamVjdGlvbi54ID0gIHRoaXMud2lkdGgvMjtcbiAgICB0aGlzLnByb2plY3Rpb24ueSA9ICAtdGhpcy5oZWlnaHQvMjtcblxuICAgIHRoaXMuc3RhZ2VSZW5kZXJHcm91cC5yZW5kZXIodGhpcy5wcm9qZWN0aW9uKTtcblxuICAgIC8vIGludGVyYWN0aW9uXG4gICAgLy8gcnVuIGludGVyYWN0aW9uIVxuICAgIGlmKHN0YWdlLmludGVyYWN0aXZlKVxuICAgIHtcbiAgICAgICAgLy9uZWVkIHRvIGFkZCBzb21lIGV2ZW50cyFcbiAgICAgICAgaWYoIXN0YWdlLl9pbnRlcmFjdGl2ZUV2ZW50c0FkZGVkKVxuICAgICAgICB7XG4gICAgICAgICAgICBzdGFnZS5faW50ZXJhY3RpdmVFdmVudHNBZGRlZCA9IHRydWU7XG4gICAgICAgICAgICBzdGFnZS5pbnRlcmFjdGlvbk1hbmFnZXIuc2V0VGFyZ2V0KHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYWZ0ZXIgcmVuZGVyaW5nIGxldHMgY29uZmlybSBhbGwgZnJhbWVzIHRoYXQgaGF2ZSBiZWVuIHVvZGF0ZWQuLlxuICAgIGlmKFRleHR1cmUuZnJhbWVVcGRhdGVzLmxlbmd0aCA+IDApXG4gICAge1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IFRleHR1cmUuZnJhbWVVcGRhdGVzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgVGV4dHVyZS5mcmFtZVVwZGF0ZXNbaV0udXBkYXRlRnJhbWUgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIFRleHR1cmUuZnJhbWVVcGRhdGVzID0gW107XG4gICAgfVxufTtcblxuLyoqXG4gKiByZXNpemVzIHRoZSB3ZWJHTCB2aWV3IHRvIHRoZSBzcGVjaWZpZWQgd2lkdGggYW5kIGhlaWdodFxuICpcbiAqIEBtZXRob2QgcmVzaXplXG4gKiBAcGFyYW0gd2lkdGgge051bWJlcn0gdGhlIG5ldyB3aWR0aCBvZiB0aGUgd2ViR0wgdmlld1xuICogQHBhcmFtIGhlaWdodCB7TnVtYmVyfSB0aGUgbmV3IGhlaWdodCBvZiB0aGUgd2ViR0wgdmlld1xuICovXG5wcm90by5yZXNpemUgPSBmdW5jdGlvbiByZXNpemUod2lkdGgsIGhlaWdodClcbntcbiAgICB0aGlzLndpZHRoID0gd2lkdGg7XG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICB0aGlzLnZpZXcud2lkdGggPSB3aWR0aDtcbiAgICB0aGlzLnZpZXcuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgdGhpcy5nbC52aWV3cG9ydCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICAvL3ZhciBwcm9qZWN0aW9uTWF0cml4ID0gdGhpcy5wcm9qZWN0aW9uTWF0cml4O1xuXG4gICAgdGhpcy5wcm9qZWN0aW9uLnggPSAgdGhpcy53aWR0aC8yO1xuICAgIHRoaXMucHJvamVjdGlvbi55ID0gIC10aGlzLmhlaWdodC8yO1xuXG4vLyAgcHJvamVjdGlvbk1hdHJpeFswXSA9IDIvdGhpcy53aWR0aDtcbi8vICBwcm9qZWN0aW9uTWF0cml4WzVdID0gLTIvdGhpcy5oZWlnaHQ7XG4vLyAgcHJvamVjdGlvbk1hdHJpeFsxMl0gPSAtMTtcbi8vICBwcm9qZWN0aW9uTWF0cml4WzEzXSA9IDE7XG59O1xuXG4vKipcbiAqIEhhbmRsZXMgYSBsb3N0IHdlYmdsIGNvbnRleHRcbiAqXG4gKiBAbWV0aG9kIGhhbmRsZUNvbnRleHRMb3N0XG4gKiBAcGFyYW0gZXZlbnQge0V2ZW50fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uaGFuZGxlQ29udGV4dExvc3QgPSBmdW5jdGlvbiBoYW5kbGVDb250ZXh0TG9zdChldmVudClcbntcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuY29udGV4dExvc3QgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBIYW5kbGVzIGEgcmVzdG9yZWQgd2ViZ2wgY29udGV4dFxuICpcbiAqIEBtZXRob2QgaGFuZGxlQ29udGV4dFJlc3RvcmVkXG4gKiBAcGFyYW0gZXZlbnQge0V2ZW50fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uaGFuZGxlQ29udGV4dFJlc3RvcmVkID0gZnVuY3Rpb24gaGFuZGxlQ29udGV4dFJlc3RvcmVkKCkvKihldmVudCkqL1xue1xuICAgIHZhciBnbCA9IHRoaXMuZ2wgPSB0aGlzLnZpZXcuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJywgIHtcbiAgICAgICAgYWxwaGE6IHRydWVcbiAgICB9KTtcblxuICAgIHRoaXMuaW5pdFNoYWRlcnMoKTtcblxuICAgIGZvcih2YXIga2V5IGluIFRleHR1cmUuY2FjaGUpXG4gICAge1xuICAgICAgICB2YXIgdGV4dHVyZSA9IFRleHR1cmUuY2FjaGVba2V5XS5iYXNlVGV4dHVyZTtcbiAgICAgICAgdGV4dHVyZS5fZ2xUZXh0dXJlID0gbnVsbDtcbiAgICAgICAgV2ViR0xSZW5kZXJHcm91cC51cGRhdGVUZXh0dXJlKGdsLCB0ZXh0dXJlKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuYmF0Y2hzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHRoaXMuYmF0Y2hzW2ldLnJlc3RvcmVMb3N0Q29udGV4dChnbCk7XG4gICAgICAgIHRoaXMuYmF0Y2hzW2ldLmRpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBXZWJHTEJhdGNoLnJlc3RvcmVCYXRjaGVzKGdsKTtcblxuICAgIHRoaXMuY29udGV4dExvc3QgPSBmYWxzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2ViR0xSZW5kZXJlcjtcbiIsIi8qKlxuICogQGF1dGhvciBEci4gS2liaXR6IDxpbmZvQGRya2liaXR6LmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi8uLi9wbGF0Zm9ybScpO1xuXG5leHBvcnRzLnNoYWRlciA9IGZ1bmN0aW9uIGNvbXBpbGVTaGFkZXIoZ2wsIHNoYWRlclNyYywgc2hhZGVyVHlwZSlcbntcbiAgICB2YXIgc3JjID0gc2hhZGVyU3JjLmpvaW4oJ1xcbicpO1xuICAgIHZhciBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoc2hhZGVyVHlwZSk7XG4gICAgZ2wuc2hhZGVyU291cmNlKHNoYWRlciwgc3JjKTtcbiAgICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cbiAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgICBpZiAocGxhdGZvcm0uY29uc29sZSkgcGxhdGZvcm0uY29uc29sZS5lcnJvcihnbC5nZXRTaGFkZXJJbmZvTG9nKHNoYWRlcikpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gc2hhZGVyO1xufTtcblxuZXhwb3J0cy5wcm9ncmFtID0gZnVuY3Rpb24gY29tcGlsZVByb2dyYW0oZ2wsIHZlcnRleFNyYywgZnJhZ21lbnRTcmMpXG57XG4gICAgdmFyIGZyYWdtZW50U2hhZGVyID0gZXhwb3J0cy5zaGFkZXIoZ2wsIGZyYWdtZW50U3JjLCBnbC5GUkFHTUVOVF9TSEFERVIpO1xuICAgIHZhciB2ZXJ0ZXhTaGFkZXIgPSBleHBvcnRzLnNoYWRlcihnbCwgdmVydGV4U3JjLCBnbC5WRVJURVhfU0hBREVSKTtcblxuICAgIHZhciBzaGFkZXJQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuXG4gICAgZ2wuYXR0YWNoU2hhZGVyKHNoYWRlclByb2dyYW0sIHZlcnRleFNoYWRlcik7XG4gICAgZ2wuYXR0YWNoU2hhZGVyKHNoYWRlclByb2dyYW0sIGZyYWdtZW50U2hhZGVyKTtcbiAgICBnbC5saW5rUHJvZ3JhbShzaGFkZXJQcm9ncmFtKTtcblxuICAgIGlmICghZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihzaGFkZXJQcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcbiAgICAgICAgaWYgKHBsYXRmb3JtLmNvbnNvbGUpIHBsYXRmb3JtLmNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBpbml0aWFsaXNlIHNoYWRlcnMnKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNoYWRlclByb2dyYW07XG59O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc2hhZGVycyA9IHJlcXVpcmUoJy4vc2hhZGVycycpO1xudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi8uLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBtYXQzID0gcmVxdWlyZSgnLi4vLi4vZ2VvbS9tYXRyaXgnKS5tYXQzO1xudmFyIGhleDJyZ2IgPSByZXF1aXJlKCcuLi8uLi91dGlscy9jb2xvcicpLmhleDJyZ2I7XG52YXIgdHJpYW5ndWxhdGUgPSByZXF1aXJlKCcuLi8uLi91dGlscy9Qb2x5aycpLnRyaWFuZ3VsYXRlO1xuXG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi8uLi9nZW9tL1BvaW50Jyk7XG52YXIgR3JhcGhpY3MgPSByZXF1aXJlKCcuLi8uLi9wcmltaXRpdmVzL0dyYXBoaWNzJyk7XG5cbi8qKlxuICogQSBzZXQgb2YgZnVuY3Rpb25zIHVzZWQgYnkgdGhlIHdlYkdMIHJlbmRlcmVyIHRvIGRyYXcgdGhlIHByaW1pdGl2ZSBncmFwaGljcyBkYXRhXG4gKlxuICogQG1vZHVsZSByZW5kZXJlcnMvd2ViZ2wvZ3JhcGhpY3NcbiAqL1xuXG4vKipcbiAqIFJlbmRlcnMgdGhlIGdyYXBoaWNzIG9iamVjdFxuICpcbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIHJlbmRlckdyYXBoaWNzXG4gKiBAcGFyYW0gZ3JhcGhpY3Mge0dyYXBoaWNzfVxuICogQHBhcmFtIHByb2plY3Rpb24ge09iamVjdH1cbiAqL1xuZXhwb3J0cy5yZW5kZXJHcmFwaGljcyA9IGZ1bmN0aW9uIHJlbmRlckdyYXBoaWNzKGdyYXBoaWNzLCBwcm9qZWN0aW9uKVxue1xuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG5cbiAgICBpZighZ3JhcGhpY3MuX3dlYkdMKWdyYXBoaWNzLl93ZWJHTCA9IHtwb2ludHM6W10sIGluZGljZXM6W10sIGxhc3RJbmRleDowLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlcjpnbC5jcmVhdGVCdWZmZXIoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleEJ1ZmZlcjpnbC5jcmVhdGVCdWZmZXIoKX07XG5cbiAgICBpZihncmFwaGljcy5kaXJ0eSlcbiAgICB7XG4gICAgICAgIGdyYXBoaWNzLmRpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgaWYoZ3JhcGhpY3MuY2xlYXJEaXJ0eSlcbiAgICAgICAge1xuICAgICAgICAgICAgZ3JhcGhpY3MuY2xlYXJEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgICAgICBncmFwaGljcy5fd2ViR0wubGFzdEluZGV4ID0gMDtcbiAgICAgICAgICAgIGdyYXBoaWNzLl93ZWJHTC5wb2ludHMgPSBbXTtcbiAgICAgICAgICAgIGdyYXBoaWNzLl93ZWJHTC5pbmRpY2VzID0gW107XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGV4cG9ydHMudXBkYXRlR3JhcGhpY3MoZ3JhcGhpY3MpO1xuICAgIH1cblxuICAgIHNoYWRlcnMuYWN0aXZhdGVQcmltaXRpdmVTaGFkZXIoKTtcblxuICAgIC8vIFRoaXMgIGNvdWxkIGJlIHNwZWVkZWQgdXAgZm8gc3VyZSFcbiAgICB2YXIgbSA9IG1hdDMuY2xvbmUoZ3JhcGhpY3Mud29ybGRUcmFuc2Zvcm0pO1xuXG4gICAgbWF0My50cmFuc3Bvc2UobSk7XG5cbiAgICAvLyBzZXQgdGhlIG1hdHJpeCB0cmFuc2Zvcm0gZm9yIHRoZVxuICAgIGdsLmJsZW5kRnVuYyhnbC5PTkUsIGdsLk9ORV9NSU5VU19TUkNfQUxQSEEpO1xuXG4gICAgZ2wudW5pZm9ybU1hdHJpeDNmdihnbG9iYWxzLnByaW1pdGl2ZVNoYWRlci50cmFuc2xhdGlvbk1hdHJpeCwgZmFsc2UsIG0pO1xuXG4gICAgZ2wudW5pZm9ybTJmKGdsb2JhbHMucHJpbWl0aXZlU2hhZGVyLnByb2plY3Rpb25WZWN0b3IsIHByb2plY3Rpb24ueCwgLXByb2plY3Rpb24ueSk7XG4gICAgZ2wudW5pZm9ybTJmKGdsb2JhbHMucHJpbWl0aXZlU2hhZGVyLm9mZnNldFZlY3RvciwgLWdsb2JhbHMub2Zmc2V0LngsIC1nbG9iYWxzLm9mZnNldC55KTtcblxuICAgIGdsLnVuaWZvcm0xZihnbG9iYWxzLnByaW1pdGl2ZVNoYWRlci5hbHBoYSwgZ3JhcGhpY3Mud29ybGRBbHBoYSk7XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIGdyYXBoaWNzLl93ZWJHTC5idWZmZXIpO1xuXG4gICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihnbG9iYWxzLnByaW1pdGl2ZVNoYWRlci5hVmVydGV4UG9zaXRpb24sIDIsIGdsLkZMT0FULCBmYWxzZSwgNCAqIDYsIDApO1xuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIuY29sb3JBdHRyaWJ1dGUsIDQsIGdsLkZMT0FULCBmYWxzZSw0ICogNiwgMiAqIDQpO1xuXG4gICAgLy8gc2V0IHRoZSBpbmRleCBidWZmZXIhXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgZ3JhcGhpY3MuX3dlYkdMLmluZGV4QnVmZmVyKTtcblxuXG4gICAgZ2wuZHJhd0VsZW1lbnRzKGdsLlRSSUFOR0xFX1NUUklQLCAgZ3JhcGhpY3MuX3dlYkdMLmluZGljZXMubGVuZ3RoLCBnbC5VTlNJR05FRF9TSE9SVCwgMCApO1xuXG4gICAgc2hhZGVycy5kZWFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyKCk7XG5cbiAgICAvLyByZXR1cm4gdG8gZGVmYXVsdCBzaGFkZXIuLi5cbi8vICBzaGFkZXJzLmFjdGl2YXRlU2hhZGVyKGdsb2JhbHMuZGVmYXVsdFNoYWRlcik7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGhlIGdyYXBoaWNzIG9iamVjdFxuICpcbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIHVwZGF0ZUdyYXBoaWNzXG4gKiBAcGFyYW0gZ3JhcGhpY3Mge0dyYXBoaWNzfVxuICovXG5leHBvcnRzLnVwZGF0ZUdyYXBoaWNzID0gZnVuY3Rpb24gdXBkYXRlR3JhcGhpY3MoZ3JhcGhpY3MpXG57XG4gICAgZm9yICh2YXIgaSA9IGdyYXBoaWNzLl93ZWJHTC5sYXN0SW5kZXg7IGkgPCBncmFwaGljcy5ncmFwaGljc0RhdGEubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgZGF0YSA9IGdyYXBoaWNzLmdyYXBoaWNzRGF0YVtpXTtcblxuICAgICAgICBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLlBPTFkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKGRhdGEuZmlsbClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihkYXRhLnBvaW50cy5sZW5ndGg+MylcbiAgICAgICAgICAgICAgICAgICAgZXhwb3J0cy5idWlsZFBvbHkoZGF0YSwgZ3JhcGhpY3MuX3dlYkdMKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoZGF0YS5saW5lV2lkdGggPiAwKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGV4cG9ydHMuYnVpbGRMaW5lKGRhdGEsIGdyYXBoaWNzLl93ZWJHTCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLlJFQ1QpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGV4cG9ydHMuYnVpbGRSZWN0YW5nbGUoZGF0YSwgZ3JhcGhpY3MuX3dlYkdMKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRhdGEudHlwZSA9PT0gR3JhcGhpY3MuQ0lSQyB8fCBkYXRhLnR5cGUgPT09IEdyYXBoaWNzLkVMSVApO1xuICAgICAgICB7XG4gICAgICAgICAgICBleHBvcnRzLmJ1aWxkQ2lyY2xlKGRhdGEsIGdyYXBoaWNzLl93ZWJHTCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBncmFwaGljcy5fd2ViR0wubGFzdEluZGV4ID0gZ3JhcGhpY3MuZ3JhcGhpY3NEYXRhLmxlbmd0aDtcblxuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG5cbiAgICBncmFwaGljcy5fd2ViR0wuZ2xQb2ludHMgPSBuZXcgRmxvYXQzMkFycmF5KGdyYXBoaWNzLl93ZWJHTC5wb2ludHMpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIGdyYXBoaWNzLl93ZWJHTC5idWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBncmFwaGljcy5fd2ViR0wuZ2xQb2ludHMsIGdsLlNUQVRJQ19EUkFXKTtcblxuICAgIGdyYXBoaWNzLl93ZWJHTC5nbEluZGljaWVzID0gbmV3IFVpbnQxNkFycmF5KGdyYXBoaWNzLl93ZWJHTC5pbmRpY2VzKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIGdyYXBoaWNzLl93ZWJHTC5pbmRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgZ3JhcGhpY3MuX3dlYkdMLmdsSW5kaWNpZXMsIGdsLlNUQVRJQ19EUkFXKTtcbn07XG5cbi8qKlxuICogQnVpbGRzIGEgcmVjdGFuZ2xlIHRvIGRyYXdcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBidWlsZFJlY3RhbmdsZVxuICogQHBhcmFtIGdyYXBoaWNzIHtHcmFwaGljc31cbiAqIEBwYXJhbSB3ZWJHTERhdGEge09iamVjdH1cbiAqL1xuZXhwb3J0cy5idWlsZFJlY3RhbmdsZSA9IGZ1bmN0aW9uIGJ1aWxkUmVjdGFuZ2xlKGdyYXBoaWNzRGF0YSwgd2ViR0xEYXRhKVxue1xuICAgIC8vIC0tLSAvL1xuICAgIC8vIG5lZWQgdG8gY29udmVydCBwb2ludHMgdG8gYSBuaWNlIHJlZ3VsYXIgZGF0YVxuICAgIC8vXG4gICAgdmFyIHJlY3REYXRhID0gZ3JhcGhpY3NEYXRhLnBvaW50cztcbiAgICB2YXIgeCA9IHJlY3REYXRhWzBdO1xuICAgIHZhciB5ID0gcmVjdERhdGFbMV07XG4gICAgdmFyIHdpZHRoID0gcmVjdERhdGFbMl07XG4gICAgdmFyIGhlaWdodCA9IHJlY3REYXRhWzNdO1xuXG5cbiAgICBpZihncmFwaGljc0RhdGEuZmlsbClcbiAgICB7XG4gICAgICAgIHZhciBjb2xvciA9IGhleDJyZ2IoZ3JhcGhpY3NEYXRhLmZpbGxDb2xvcik7XG4gICAgICAgIHZhciBhbHBoYSA9IGdyYXBoaWNzRGF0YS5maWxsQWxwaGE7XG5cbiAgICAgICAgdmFyIHIgPSBjb2xvclswXSAqIGFscGhhO1xuICAgICAgICB2YXIgZyA9IGNvbG9yWzFdICogYWxwaGE7XG4gICAgICAgIHZhciBiID0gY29sb3JbMl0gKiBhbHBoYTtcblxuICAgICAgICB2YXIgdmVydHMgPSB3ZWJHTERhdGEucG9pbnRzO1xuICAgICAgICB2YXIgaW5kaWNlcyA9IHdlYkdMRGF0YS5pbmRpY2VzO1xuXG4gICAgICAgIHZhciB2ZXJ0UG9zID0gdmVydHMubGVuZ3RoLzY7XG5cbiAgICAgICAgLy8gc3RhcnRcbiAgICAgICAgdmVydHMucHVzaCh4LCB5KTtcbiAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgdmVydHMucHVzaCh4ICsgd2lkdGgsIHkpO1xuICAgICAgICB2ZXJ0cy5wdXNoKHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICB2ZXJ0cy5wdXNoKHggLCB5ICsgaGVpZ2h0KTtcbiAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgdmVydHMucHVzaCh4ICsgd2lkdGgsIHkgKyBoZWlnaHQpO1xuICAgICAgICB2ZXJ0cy5wdXNoKHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAvLyBpbnNlcnQgMiBkZWFkIHRyaWFuZ2xlcy4uXG4gICAgICAgIGluZGljZXMucHVzaCh2ZXJ0UG9zLCB2ZXJ0UG9zLCB2ZXJ0UG9zKzEsIHZlcnRQb3MrMiwgdmVydFBvcyszLCB2ZXJ0UG9zKzMpO1xuICAgIH1cblxuICAgIGlmKGdyYXBoaWNzRGF0YS5saW5lV2lkdGgpXG4gICAge1xuICAgICAgICBncmFwaGljc0RhdGEucG9pbnRzID0gW3gsIHksXG4gICAgICAgICAgICAgICAgICB4ICsgd2lkdGgsIHksXG4gICAgICAgICAgICAgICAgICB4ICsgd2lkdGgsIHkgKyBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICB4LCB5ICsgaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgeCwgeV07XG5cbiAgICAgICAgZXhwb3J0cy5idWlsZExpbmUoZ3JhcGhpY3NEYXRhLCB3ZWJHTERhdGEpO1xuICAgIH1cbn07XG5cbi8qKlxuICogQnVpbGRzIGEgY2lyY2xlIHRvIGRyYXdcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBidWlsZENpcmNsZVxuICogQHBhcmFtIGdyYXBoaWNzIHtHcmFwaGljc31cbiAqIEBwYXJhbSB3ZWJHTERhdGEge09iamVjdH1cbiAqL1xuZXhwb3J0cy5idWlsZENpcmNsZSA9IGZ1bmN0aW9uIGJ1aWxkQ2lyY2xlKGdyYXBoaWNzRGF0YSwgd2ViR0xEYXRhKVxue1xuICAgIC8vIC0tLSAvL1xuICAgIC8vIG5lZWQgdG8gY29udmVydCBwb2ludHMgdG8gYSBuaWNlIHJlZ3VsYXIgZGF0YVxuICAgIC8vXG4gICAgdmFyIHJlY3REYXRhID0gZ3JhcGhpY3NEYXRhLnBvaW50cztcbiAgICB2YXIgeCA9IHJlY3REYXRhWzBdO1xuICAgIHZhciB5ID0gcmVjdERhdGFbMV07XG4gICAgdmFyIHdpZHRoID0gcmVjdERhdGFbMl07XG4gICAgdmFyIGhlaWdodCA9IHJlY3REYXRhWzNdO1xuXG4gICAgdmFyIHRvdGFsU2VncyA9IDQwO1xuICAgIHZhciBzZWcgPSAoTWF0aC5QSSAqIDIpIC8gdG90YWxTZWdzIDtcblxuICAgIHZhciBpID0gMDtcblxuICAgIGlmKGdyYXBoaWNzRGF0YS5maWxsKVxuICAgIHtcbiAgICAgICAgdmFyIGNvbG9yID0gaGV4MnJnYihncmFwaGljc0RhdGEuZmlsbENvbG9yKTtcbiAgICAgICAgdmFyIGFscGhhID0gZ3JhcGhpY3NEYXRhLmZpbGxBbHBoYTtcblxuICAgICAgICB2YXIgciA9IGNvbG9yWzBdICogYWxwaGE7XG4gICAgICAgIHZhciBnID0gY29sb3JbMV0gKiBhbHBoYTtcbiAgICAgICAgdmFyIGIgPSBjb2xvclsyXSAqIGFscGhhO1xuXG4gICAgICAgIHZhciB2ZXJ0cyA9IHdlYkdMRGF0YS5wb2ludHM7XG4gICAgICAgIHZhciBpbmRpY2VzID0gd2ViR0xEYXRhLmluZGljZXM7XG5cbiAgICAgICAgdmFyIHZlY1BvcyA9IHZlcnRzLmxlbmd0aC82O1xuXG4gICAgICAgIGluZGljZXMucHVzaCh2ZWNQb3MpO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0b3RhbFNlZ3MgKyAxIDsgaSsrKVxuICAgICAgICB7XG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHgseSwgciwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHggKyBNYXRoLnNpbihzZWcgKiBpKSAqIHdpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICB5ICsgTWF0aC5jb3Moc2VnICogaSkgKiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgIHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgaW5kaWNlcy5wdXNoKHZlY1BvcysrLCB2ZWNQb3MrKyk7XG4gICAgICAgIH1cblxuICAgICAgICBpbmRpY2VzLnB1c2godmVjUG9zLTEpO1xuICAgIH1cblxuICAgIGlmKGdyYXBoaWNzRGF0YS5saW5lV2lkdGgpXG4gICAge1xuICAgICAgICBncmFwaGljc0RhdGEucG9pbnRzID0gW107XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHRvdGFsU2VncyArIDE7IGkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgZ3JhcGhpY3NEYXRhLnBvaW50cy5wdXNoKHggKyBNYXRoLnNpbihzZWcgKiBpKSAqIHdpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHkgKyBNYXRoLmNvcyhzZWcgKiBpKSAqIGhlaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICBleHBvcnRzLmJ1aWxkTGluZShncmFwaGljc0RhdGEsIHdlYkdMRGF0YSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBCdWlsZHMgYSBsaW5lIHRvIGRyYXdcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBidWlsZExpbmVcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gd2ViR0xEYXRhIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYnVpbGRMaW5lID0gZnVuY3Rpb24gYnVpbGRMaW5lKGdyYXBoaWNzRGF0YSwgd2ViR0xEYXRhKVxue1xuICAgIC8vIFRPRE8gT1BUSU1JU0UhXG4gICAgdmFyIGkgPSAwO1xuXG4gICAgdmFyIHBvaW50cyA9IGdyYXBoaWNzRGF0YS5wb2ludHM7XG4gICAgaWYocG9pbnRzLmxlbmd0aCA9PT0gMClyZXR1cm47XG5cbiAgICAvLyBpZiB0aGUgbGluZSB3aWR0aCBpcyBhbiBvZGQgbnVtYmVyIGFkZCAwLjUgdG8gYWxpZ24gdG8gYSB3aG9sZSBwaXhlbFxuICAgIGlmKGdyYXBoaWNzRGF0YS5saW5lV2lkdGglMilcbiAgICB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHBvaW50c1tpXSArPSAwLjU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBnZXQgZmlyc3QgYW5kIGxhc3QgcG9pbnQuLiBmaWd1cmUgb3V0IHRoZSBtaWRkbGUhXG4gICAgdmFyIGZpcnN0UG9pbnQgPSBuZXcgUG9pbnQoIHBvaW50c1swXSwgcG9pbnRzWzFdICk7XG4gICAgdmFyIGxhc3RQb2ludCA9IG5ldyBQb2ludCggcG9pbnRzW3BvaW50cy5sZW5ndGggLSAyXSwgcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXSApO1xuXG4gICAgLy8gaWYgdGhlIGZpcnN0IHBvaW50IGlzIHRoZSBsYXN0IHBvaW50IC0gZ29vbmEgaGF2ZSBpc3N1ZXMgOilcbiAgICBpZihmaXJzdFBvaW50LnggPT09IGxhc3RQb2ludC54ICYmIGZpcnN0UG9pbnQueSA9PT0gbGFzdFBvaW50LnkpXG4gICAge1xuICAgICAgICBwb2ludHMucG9wKCk7XG4gICAgICAgIHBvaW50cy5wb3AoKTtcblxuICAgICAgICBsYXN0UG9pbnQgPSBuZXcgUG9pbnQoIHBvaW50c1twb2ludHMubGVuZ3RoIC0gMl0sIHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0gKTtcblxuICAgICAgICB2YXIgbWlkUG9pbnRYID0gbGFzdFBvaW50LnggKyAoZmlyc3RQb2ludC54IC0gbGFzdFBvaW50LngpICowLjU7XG4gICAgICAgIHZhciBtaWRQb2ludFkgPSBsYXN0UG9pbnQueSArIChmaXJzdFBvaW50LnkgLSBsYXN0UG9pbnQueSkgKjAuNTtcblxuICAgICAgICBwb2ludHMudW5zaGlmdChtaWRQb2ludFgsIG1pZFBvaW50WSk7XG4gICAgICAgIHBvaW50cy5wdXNoKG1pZFBvaW50WCwgbWlkUG9pbnRZKTtcbiAgICB9XG5cbiAgICB2YXIgdmVydHMgPSB3ZWJHTERhdGEucG9pbnRzO1xuICAgIHZhciBpbmRpY2VzID0gd2ViR0xEYXRhLmluZGljZXM7XG4gICAgdmFyIGxlbmd0aCA9IHBvaW50cy5sZW5ndGggLyAyO1xuICAgIHZhciBpbmRleENvdW50ID0gcG9pbnRzLmxlbmd0aDtcbiAgICB2YXIgaW5kZXhTdGFydCA9IHZlcnRzLmxlbmd0aC82O1xuXG4gICAgLy8gRFJBVyB0aGUgTGluZVxuICAgIHZhciB3aWR0aCA9IGdyYXBoaWNzRGF0YS5saW5lV2lkdGggLyAyO1xuXG4gICAgLy8gc29ydCBjb2xvclxuICAgIHZhciBjb2xvciA9IGhleDJyZ2IoZ3JhcGhpY3NEYXRhLmxpbmVDb2xvcik7XG4gICAgdmFyIGFscGhhID0gZ3JhcGhpY3NEYXRhLmxpbmVBbHBoYTtcbiAgICB2YXIgciA9IGNvbG9yWzBdICogYWxwaGE7XG4gICAgdmFyIGcgPSBjb2xvclsxXSAqIGFscGhhO1xuICAgIHZhciBiID0gY29sb3JbMl0gKiBhbHBoYTtcblxuICAgIHZhciBweCwgcHksIHAxeCwgcDF5LCBwMngsIHAyeSwgcDN4LCBwM3k7XG4gICAgdmFyIHBlcnB4LCBwZXJweSwgcGVycDJ4LCBwZXJwMnksIHBlcnAzeCwgcGVycDN5O1xuICAgIHZhciBhMSwgYjEsIGMxLCBhMiwgYjIsIGMyO1xuICAgIHZhciBkZW5vbSwgcGRpc3QsIGRpc3Q7XG5cbiAgICBwMXggPSBwb2ludHNbMF07XG4gICAgcDF5ID0gcG9pbnRzWzFdO1xuXG4gICAgcDJ4ID0gcG9pbnRzWzJdO1xuICAgIHAyeSA9IHBvaW50c1szXTtcblxuICAgIHBlcnB4ID0gLShwMXkgLSBwMnkpO1xuICAgIHBlcnB5ID0gIHAxeCAtIHAyeDtcblxuICAgIGRpc3QgPSBNYXRoLnNxcnQocGVycHgqcGVycHggKyBwZXJweSpwZXJweSk7XG5cbiAgICBwZXJweCAvPSBkaXN0O1xuICAgIHBlcnB5IC89IGRpc3Q7XG4gICAgcGVycHggKj0gd2lkdGg7XG4gICAgcGVycHkgKj0gd2lkdGg7XG5cbiAgICAvLyBzdGFydFxuICAgIHZlcnRzLnB1c2gocDF4IC0gcGVycHggLCBwMXkgLSBwZXJweSxcbiAgICAgICAgICAgICAgICByLCBnLCBiLCBhbHBoYSk7XG5cbiAgICB2ZXJ0cy5wdXNoKHAxeCArIHBlcnB4ICwgcDF5ICsgcGVycHksXG4gICAgICAgICAgICAgICAgciwgZywgYiwgYWxwaGEpO1xuXG4gICAgZm9yIChpID0gMTsgaSA8IGxlbmd0aC0xOyBpKyspXG4gICAge1xuICAgICAgICBwMXggPSBwb2ludHNbKGktMSkqMl07XG4gICAgICAgIHAxeSA9IHBvaW50c1soaS0xKSoyICsgMV07XG5cbiAgICAgICAgcDJ4ID0gcG9pbnRzWyhpKSoyXTtcbiAgICAgICAgcDJ5ID0gcG9pbnRzWyhpKSoyICsgMV07XG5cbiAgICAgICAgcDN4ID0gcG9pbnRzWyhpKzEpKjJdO1xuICAgICAgICBwM3kgPSBwb2ludHNbKGkrMSkqMiArIDFdO1xuXG4gICAgICAgIHBlcnB4ID0gLShwMXkgLSBwMnkpO1xuICAgICAgICBwZXJweSA9IHAxeCAtIHAyeDtcblxuICAgICAgICBkaXN0ID0gTWF0aC5zcXJ0KHBlcnB4KnBlcnB4ICsgcGVycHkqcGVycHkpO1xuICAgICAgICBwZXJweCAvPSBkaXN0O1xuICAgICAgICBwZXJweSAvPSBkaXN0O1xuICAgICAgICBwZXJweCAqPSB3aWR0aDtcbiAgICAgICAgcGVycHkgKj0gd2lkdGg7XG5cbiAgICAgICAgcGVycDJ4ID0gLShwMnkgLSBwM3kpO1xuICAgICAgICBwZXJwMnkgPSBwMnggLSBwM3g7XG5cbiAgICAgICAgZGlzdCA9IE1hdGguc3FydChwZXJwMngqcGVycDJ4ICsgcGVycDJ5KnBlcnAyeSk7XG4gICAgICAgIHBlcnAyeCAvPSBkaXN0O1xuICAgICAgICBwZXJwMnkgLz0gZGlzdDtcbiAgICAgICAgcGVycDJ4ICo9IHdpZHRoO1xuICAgICAgICBwZXJwMnkgKj0gd2lkdGg7XG5cbiAgICAgICAgYTEgPSAoLXBlcnB5ICsgcDF5KSAtICgtcGVycHkgKyBwMnkpO1xuICAgICAgICBiMSA9ICgtcGVycHggKyBwMngpIC0gKC1wZXJweCArIHAxeCk7XG4gICAgICAgIGMxID0gKC1wZXJweCArIHAxeCkgKiAoLXBlcnB5ICsgcDJ5KSAtICgtcGVycHggKyBwMngpICogKC1wZXJweSArIHAxeSk7XG4gICAgICAgIGEyID0gKC1wZXJwMnkgKyBwM3kpIC0gKC1wZXJwMnkgKyBwMnkpO1xuICAgICAgICBiMiA9ICgtcGVycDJ4ICsgcDJ4KSAtICgtcGVycDJ4ICsgcDN4KTtcbiAgICAgICAgYzIgPSAoLXBlcnAyeCArIHAzeCkgKiAoLXBlcnAyeSArIHAyeSkgLSAoLXBlcnAyeCArIHAyeCkgKiAoLXBlcnAyeSArIHAzeSk7XG5cbiAgICAgICAgZGVub20gPSBhMSpiMiAtIGEyKmIxO1xuXG4gICAgICAgIGlmKE1hdGguYWJzKGRlbm9tKSA8IDAuMSApXG4gICAgICAgIHtcblxuICAgICAgICAgICAgZGVub20rPTEwLjE7XG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHAyeCAtIHBlcnB4ICwgcDJ5IC0gcGVycHksXG4gICAgICAgICAgICAgICAgciwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHAyeCArIHBlcnB4ICwgcDJ5ICsgcGVycHksXG4gICAgICAgICAgICAgICAgciwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHB4ID0gKGIxKmMyIC0gYjIqYzEpL2Rlbm9tO1xuICAgICAgICBweSA9IChhMipjMSAtIGExKmMyKS9kZW5vbTtcblxuXG4gICAgICAgIHBkaXN0ID0gKHB4IC1wMngpICogKHB4IC1wMngpICsgKHB5IC1wMnkpICsgKHB5IC1wMnkpO1xuXG5cbiAgICAgICAgaWYocGRpc3QgPiAxNDAgKiAxNDApXG4gICAgICAgIHtcbiAgICAgICAgICAgIHBlcnAzeCA9IHBlcnB4IC0gcGVycDJ4O1xuICAgICAgICAgICAgcGVycDN5ID0gcGVycHkgLSBwZXJwMnk7XG5cbiAgICAgICAgICAgIGRpc3QgPSBNYXRoLnNxcnQocGVycDN4KnBlcnAzeCArIHBlcnAzeSpwZXJwM3kpO1xuICAgICAgICAgICAgcGVycDN4IC89IGRpc3Q7XG4gICAgICAgICAgICBwZXJwM3kgLz0gZGlzdDtcbiAgICAgICAgICAgIHBlcnAzeCAqPSB3aWR0aDtcbiAgICAgICAgICAgIHBlcnAzeSAqPSB3aWR0aDtcblxuICAgICAgICAgICAgdmVydHMucHVzaChwMnggLSBwZXJwM3gsIHAyeSAtcGVycDN5KTtcbiAgICAgICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHAyeCArIHBlcnAzeCwgcDJ5ICtwZXJwM3kpO1xuICAgICAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgICAgIHZlcnRzLnB1c2gocDJ4IC0gcGVycDN4LCBwMnkgLXBlcnAzeSk7XG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgaW5kZXhDb3VudCsrO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuXG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHB4ICwgcHkpO1xuICAgICAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgICAgIHZlcnRzLnB1c2gocDJ4IC0gKHB4LXAyeCksIHAyeSAtIChweSAtIHAyeSkpO1xuICAgICAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwMXggPSBwb2ludHNbKGxlbmd0aC0yKSoyXTtcbiAgICBwMXkgPSBwb2ludHNbKGxlbmd0aC0yKSoyICsgMV07XG5cbiAgICBwMnggPSBwb2ludHNbKGxlbmd0aC0xKSoyXTtcbiAgICBwMnkgPSBwb2ludHNbKGxlbmd0aC0xKSoyICsgMV07XG5cbiAgICBwZXJweCA9IC0ocDF5IC0gcDJ5KTtcbiAgICBwZXJweSA9IHAxeCAtIHAyeDtcblxuICAgIGRpc3QgPSBNYXRoLnNxcnQocGVycHgqcGVycHggKyBwZXJweSpwZXJweSk7XG4gICAgcGVycHggLz0gZGlzdDtcbiAgICBwZXJweSAvPSBkaXN0O1xuICAgIHBlcnB4ICo9IHdpZHRoO1xuICAgIHBlcnB5ICo9IHdpZHRoO1xuXG4gICAgdmVydHMucHVzaChwMnggLSBwZXJweCAsIHAyeSAtIHBlcnB5KTtcbiAgICB2ZXJ0cy5wdXNoKHIsIGcsIGIsIGFscGhhKTtcblxuICAgIHZlcnRzLnB1c2gocDJ4ICsgcGVycHggLCBwMnkgKyBwZXJweSk7XG4gICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICBpbmRpY2VzLnB1c2goaW5kZXhTdGFydCk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgaW5kZXhDb3VudDsgaSsrKVxuICAgIHtcbiAgICAgICAgaW5kaWNlcy5wdXNoKGluZGV4U3RhcnQrKyk7XG4gICAgfVxuXG4gICAgaW5kaWNlcy5wdXNoKGluZGV4U3RhcnQtMSk7XG59O1xuXG4vKipcbiAqIEJ1aWxkcyBhIHBvbHlnb24gdG8gZHJhd1xuICpcbiAqIEBzdGF0aWNcbiAqIEBwcml2YXRlXG4gKiBAbWV0aG9kIGJ1aWxkUG9seVxuICogQHBhcmFtIGdyYXBoaWNzIHtHcmFwaGljc31cbiAqIEBwYXJhbSB3ZWJHTERhdGEge09iamVjdH1cbiAqL1xuZXhwb3J0cy5idWlsZFBvbHkgPSBmdW5jdGlvbiBidWlsZFBvbHkoZ3JhcGhpY3NEYXRhLCB3ZWJHTERhdGEpXG57XG4gICAgdmFyIHBvaW50cyA9IGdyYXBoaWNzRGF0YS5wb2ludHM7XG4gICAgaWYocG9pbnRzLmxlbmd0aCA8IDYpcmV0dXJuO1xuXG4gICAgLy8gZ2V0IGZpcnN0IGFuZCBsYXN0IHBvaW50Li4gZmlndXJlIG91dCB0aGUgbWlkZGxlIVxuICAgIHZhciB2ZXJ0cyA9IHdlYkdMRGF0YS5wb2ludHM7XG4gICAgdmFyIGluZGljZXMgPSB3ZWJHTERhdGEuaW5kaWNlcztcblxuICAgIHZhciBsZW5ndGggPSBwb2ludHMubGVuZ3RoIC8gMjtcblxuICAgIC8vIHNvcnQgY29sb3JcbiAgICB2YXIgY29sb3IgPSBoZXgycmdiKGdyYXBoaWNzRGF0YS5maWxsQ29sb3IpO1xuICAgIHZhciBhbHBoYSA9IGdyYXBoaWNzRGF0YS5maWxsQWxwaGE7XG4gICAgdmFyIHIgPSBjb2xvclswXSAqIGFscGhhO1xuICAgIHZhciBnID0gY29sb3JbMV0gKiBhbHBoYTtcbiAgICB2YXIgYiA9IGNvbG9yWzJdICogYWxwaGE7XG5cbiAgICB2YXIgdHJpYW5nbGVzID0gdHJpYW5ndWxhdGUocG9pbnRzKTtcblxuICAgIHZhciB2ZXJ0UG9zID0gdmVydHMubGVuZ3RoIC8gNjtcblxuICAgIHZhciBpID0gMDtcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0cmlhbmdsZXMubGVuZ3RoOyBpKz0zKVxuICAgIHtcbiAgICAgICAgaW5kaWNlcy5wdXNoKHRyaWFuZ2xlc1tpXSArIHZlcnRQb3MpO1xuICAgICAgICBpbmRpY2VzLnB1c2godHJpYW5nbGVzW2ldICsgdmVydFBvcyk7XG4gICAgICAgIGluZGljZXMucHVzaCh0cmlhbmdsZXNbaSsxXSArIHZlcnRQb3MpO1xuICAgICAgICBpbmRpY2VzLnB1c2godHJpYW5nbGVzW2krMl0gK3ZlcnRQb3MpO1xuICAgICAgICBpbmRpY2VzLnB1c2godHJpYW5nbGVzW2krMl0gKyB2ZXJ0UG9zKTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgICB2ZXJ0cy5wdXNoKHBvaW50c1tpICogMl0sIHBvaW50c1tpICogMiArIDFdLFxuICAgICAgICAgICAgICAgICAgIHIsIGcsIGIsIGFscGhhKTtcbiAgICB9XG59O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xudmFyIFByaW1pdGl2ZVNoYWRlciA9IHJlcXVpcmUoJy4vUHJpbWl0aXZlU2hhZGVyJyk7XG52YXIgU3RyaXBTaGFkZXIgPSByZXF1aXJlKCcuL1N0cmlwU2hhZGVyJyk7XG52YXIgUGl4aVNoYWRlciA9IHJlcXVpcmUoJy4vUGl4aVNoYWRlcicpO1xuXG5leHBvcnRzLmluaXREZWZhdWx0U2hhZGVycyA9IGZ1bmN0aW9uIGluaXREZWZhdWx0U2hhZGVycygpXG57XG4gICAgZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIgPSBuZXcgUHJpbWl0aXZlU2hhZGVyKCk7XG4gICAgZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIuaW5pdCgpO1xuXG4gICAgZ2xvYmFscy5zdHJpcFNoYWRlciA9IG5ldyBTdHJpcFNoYWRlcigpO1xuICAgIGdsb2JhbHMuc3RyaXBTaGFkZXIuaW5pdCgpO1xuXG4gICAgZ2xvYmFscy5kZWZhdWx0U2hhZGVyID0gbmV3IFBpeGlTaGFkZXIoKTtcbiAgICBnbG9iYWxzLmRlZmF1bHRTaGFkZXIuaW5pdCgpO1xuXG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcbiAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IGdsb2JhbHMuZGVmYXVsdFNoYWRlci5wcm9ncmFtO1xuXG4gICAgZ2wudXNlUHJvZ3JhbShzaGFkZXJQcm9ncmFtKTtcblxuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMuZGVmYXVsdFNoYWRlci5hVmVydGV4UG9zaXRpb24pO1xuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMuZGVmYXVsdFNoYWRlci5jb2xvckF0dHJpYnV0ZSk7XG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmFUZXh0dXJlQ29vcmQpO1xufTtcblxuZXhwb3J0cy5hY3RpdmF0ZVByaW1pdGl2ZVNoYWRlciA9IGZ1bmN0aW9uIGFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyKClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgZ2wudXNlUHJvZ3JhbShnbG9iYWxzLnByaW1pdGl2ZVNoYWRlci5wcm9ncmFtKTtcblxuICAgIGdsLmRpc2FibGVWZXJ0ZXhBdHRyaWJBcnJheShnbG9iYWxzLmRlZmF1bHRTaGFkZXIuYVZlcnRleFBvc2l0aW9uKTtcbiAgICBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmNvbG9yQXR0cmlidXRlKTtcbiAgICBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmFUZXh0dXJlQ29vcmQpO1xuXG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIuYVZlcnRleFBvc2l0aW9uKTtcbiAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShnbG9iYWxzLnByaW1pdGl2ZVNoYWRlci5jb2xvckF0dHJpYnV0ZSk7XG59O1xuXG5leHBvcnRzLmRlYWN0aXZhdGVQcmltaXRpdmVTaGFkZXIgPSBmdW5jdGlvbiBkZWFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyKClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgZ2wudXNlUHJvZ3JhbShnbG9iYWxzLmRlZmF1bHRTaGFkZXIucHJvZ3JhbSk7XG5cbiAgICBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIuYVZlcnRleFBvc2l0aW9uKTtcbiAgICBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIuY29sb3JBdHRyaWJ1dGUpO1xuXG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmFWZXJ0ZXhQb3NpdGlvbik7XG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmNvbG9yQXR0cmlidXRlKTtcbiAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShnbG9iYWxzLmRlZmF1bHRTaGFkZXIuYVRleHR1cmVDb29yZCk7XG59O1xuXG5leHBvcnRzLmFjdGl2YXRlU3RyaXBTaGFkZXIgPSBmdW5jdGlvbiBhY3RpdmF0ZVN0cmlwU2hhZGVyKClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgZ2wudXNlUHJvZ3JhbShnbG9iYWxzLnN0cmlwU2hhZGVyLnByb2dyYW0pO1xuIC8vIGdsLmRpc2FibGVWZXJ0ZXhBdHRyaWJBcnJheShnbG9iYWxzLmRlZmF1bHRTaGFkZXIuYVRleHR1cmVDb29yZCk7XG59O1xuXG5leHBvcnRzLmRlYWN0aXZhdGVTdHJpcFNoYWRlciA9IGZ1bmN0aW9uIGRlYWN0aXZhdGVTdHJpcFNoYWRlcigpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIGdsLnVzZVByb2dyYW0oZ2xvYmFscy5kZWZhdWx0U2hhZGVyLnByb2dyYW0pO1xuICAgIC8vZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmFUZXh0dXJlQ29vcmQpO1xufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIERpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcbnZhciBTcHJpdGUgPSByZXF1aXJlKCcuLi9kaXNwbGF5L1Nwcml0ZScpO1xudmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vZ2VvbS9Qb2ludCcpO1xuXG4vKipcbiAqIEEgVGV4dCBPYmplY3Qgd2lsbCBjcmVhdGUgYSBsaW5lKHMpIG9mIHRleHQgdXNpbmcgYml0bWFwIGZvbnQuIFRvIHNwbGl0IGEgbGluZSB5b3UgY2FuIHVzZSAnXFxuJywgJ1xccicgb3IgJ1xcclxcbidcbiAqIFlvdSBjYW4gZ2VuZXJhdGUgdGhlIGZudCBmaWxlcyB1c2luZ1xuICogaHR0cDovL3d3dy5hbmdlbGNvZGUuY29tL3Byb2R1Y3RzL2JtZm9udC8gZm9yIHdpbmRvd3Mgb3JcbiAqIGh0dHA6Ly93d3cuYm1nbHlwaC5jb20vIGZvciBtYWMuXG4gKlxuICogQGNsYXNzIEJpdG1hcFRleHRcbiAqIEBleHRlbmRzIERpc3BsYXlPYmplY3RDb250YWluZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHRleHQge1N0cmluZ30gVGhlIGNvcHkgdGhhdCB5b3Ugd291bGQgbGlrZSB0aGUgdGV4dCB0byBkaXNwbGF5XG4gKiBAcGFyYW0gc3R5bGUge09iamVjdH0gVGhlIHN0eWxlIHBhcmFtZXRlcnNcbiAqIEBwYXJhbSBzdHlsZS5mb250IHtTdHJpbmd9IFRoZSBzaXplIChvcHRpb25hbCkgYW5kIGJpdG1hcCBmb250IGlkIChyZXF1aXJlZCkgZXEgJ0FyaWFsJyBvciAnMjBweCBBcmlhbCcgKG11c3QgaGF2ZSBsb2FkZWQgcHJldmlvdXNseSlcbiAqIEBwYXJhbSBbc3R5bGUuYWxpZ249J2xlZnQnXSB7U3RyaW5nfSBBbiBhbGlnbm1lbnQgb2YgdGhlIG11bHRpbGluZSB0ZXh0ICgnbGVmdCcsICdjZW50ZXInIG9yICdyaWdodCcpXG4gKi9cbmZ1bmN0aW9uIEJpdG1hcFRleHQodGV4dCwgc3R5bGUpXG57XG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5zZXRUZXh0KHRleHQpO1xuICAgIHRoaXMuc2V0U3R5bGUoc3R5bGUpO1xuICAgIHRoaXMudXBkYXRlVGV4dCgpO1xuICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcbn1cblxudmFyIHByb3RvID0gQml0bWFwVGV4dC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogQml0bWFwVGV4dH1cbn0pO1xuXG4vKipcbiAqIFNldCB0aGUgY29weSBmb3IgdGhlIHRleHQgb2JqZWN0XG4gKlxuICogQG1ldGhvZCBzZXRUZXh0XG4gKiBAcGFyYW0gdGV4dCB7U3RyaW5nfSBUaGUgY29weSB0aGF0IHlvdSB3b3VsZCBsaWtlIHRoZSB0ZXh0IHRvIGRpc3BsYXlcbiAqL1xucHJvdG8uc2V0VGV4dCA9IGZ1bmN0aW9uIHNldFRleHQodGV4dClcbntcbiAgICB0aGlzLnRleHQgPSB0ZXh0IHx8ICcgJztcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogU2V0IHRoZSBzdHlsZSBvZiB0aGUgdGV4dFxuICpcbiAqIEBtZXRob2Qgc2V0U3R5bGVcbiAqIEBwYXJhbSBzdHlsZSB7T2JqZWN0fSBUaGUgc3R5bGUgcGFyYW1ldGVyc1xuICogQHBhcmFtIHN0eWxlLmZvbnQge1N0cmluZ30gVGhlIHNpemUgKG9wdGlvbmFsKSBhbmQgYml0bWFwIGZvbnQgaWQgKHJlcXVpcmVkKSBlcSAnQXJpYWwnIG9yICcyMHB4IEFyaWFsJyAobXVzdCBoYXZlIGxvYWRlZCBwcmV2aW91c2x5KVxuICogQHBhcmFtIFtzdHlsZS5hbGlnbj0nbGVmdCddIHtTdHJpbmd9IEFuIGFsaWdubWVudCBvZiB0aGUgbXVsdGlsaW5lIHRleHQgKCdsZWZ0JywgJ2NlbnRlcicgb3IgJ3JpZ2h0JylcbiAqL1xucHJvdG8uc2V0U3R5bGUgPSBmdW5jdGlvbiBzZXRTdHlsZShzdHlsZSlcbntcbiAgICBzdHlsZSA9IHN0eWxlIHx8IHt9O1xuICAgIHN0eWxlLmFsaWduID0gc3R5bGUuYWxpZ24gfHwgJ2xlZnQnO1xuICAgIHRoaXMuc3R5bGUgPSBzdHlsZTtcblxuICAgIHZhciBmb250ID0gc3R5bGUuZm9udC5zcGxpdCgnICcpO1xuICAgIHRoaXMuZm9udE5hbWUgPSBmb250W2ZvbnQubGVuZ3RoIC0gMV07XG4gICAgdGhpcy5mb250U2l6ZSA9IGZvbnQubGVuZ3RoID49IDIgPyBwYXJzZUludChmb250W2ZvbnQubGVuZ3RoIC0gMl0sIDEwKSA6IEJpdG1hcFRleHQuZm9udHNbdGhpcy5mb250TmFtZV0uc2l6ZTtcblxuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBSZW5kZXJzIHRleHRcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRleHRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRleHQgPSBmdW5jdGlvbiB1cGRhdGVUZXh0KClcbntcbiAgICB2YXIgZGF0YSA9IEJpdG1hcFRleHQuZm9udHNbdGhpcy5mb250TmFtZV07XG4gICAgdmFyIHBvcyA9IG5ldyBQb2ludCgpO1xuICAgIHZhciBwcmV2Q2hhckNvZGUgPSBudWxsO1xuICAgIHZhciBjaGFycyA9IFtdO1xuICAgIHZhciBtYXhMaW5lV2lkdGggPSAwO1xuICAgIHZhciBsaW5lV2lkdGhzID0gW107XG4gICAgdmFyIGxpbmUgPSAwO1xuICAgIHZhciBzY2FsZSA9IHRoaXMuZm9udFNpemUgLyBkYXRhLnNpemU7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHRoaXMudGV4dC5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBjaGFyQ29kZSA9IHRoaXMudGV4dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICBpZigvKD86XFxyXFxufFxccnxcXG4pLy50ZXN0KHRoaXMudGV4dC5jaGFyQXQoaSkpKVxuICAgICAgICB7XG4gICAgICAgICAgICBsaW5lV2lkdGhzLnB1c2gocG9zLngpO1xuICAgICAgICAgICAgbWF4TGluZVdpZHRoID0gTWF0aC5tYXgobWF4TGluZVdpZHRoLCBwb3MueCk7XG4gICAgICAgICAgICBsaW5lKys7XG5cbiAgICAgICAgICAgIHBvcy54ID0gMDtcbiAgICAgICAgICAgIHBvcy55ICs9IGRhdGEubGluZUhlaWdodDtcbiAgICAgICAgICAgIHByZXZDaGFyQ29kZSA9IG51bGw7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjaGFyRGF0YSA9IGRhdGEuY2hhcnNbY2hhckNvZGVdO1xuICAgICAgICBpZighY2hhckRhdGEpIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmKHByZXZDaGFyQ29kZSAmJiBjaGFyRGF0YVtwcmV2Q2hhckNvZGVdKVxuICAgICAgICB7XG4gICAgICAgICAgICBwb3MueCArPSBjaGFyRGF0YS5rZXJuaW5nW3ByZXZDaGFyQ29kZV07XG4gICAgICAgIH1cbiAgICAgICAgY2hhcnMucHVzaCh7dGV4dHVyZTpjaGFyRGF0YS50ZXh0dXJlLCBsaW5lOiBsaW5lLCBjaGFyQ29kZTogY2hhckNvZGUsIHBvc2l0aW9uOiBuZXcgUG9pbnQocG9zLnggKyBjaGFyRGF0YS54T2Zmc2V0LCBwb3MueSArIGNoYXJEYXRhLnlPZmZzZXQpfSk7XG4gICAgICAgIHBvcy54ICs9IGNoYXJEYXRhLnhBZHZhbmNlO1xuXG4gICAgICAgIHByZXZDaGFyQ29kZSA9IGNoYXJDb2RlO1xuICAgIH1cblxuICAgIGxpbmVXaWR0aHMucHVzaChwb3MueCk7XG4gICAgbWF4TGluZVdpZHRoID0gTWF0aC5tYXgobWF4TGluZVdpZHRoLCBwb3MueCk7XG5cbiAgICB2YXIgbGluZUFsaWduT2Zmc2V0cyA9IFtdO1xuICAgIGZvcihpID0gMDsgaSA8PSBsaW5lOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgYWxpZ25PZmZzZXQgPSAwO1xuICAgICAgICBpZih0aGlzLnN0eWxlLmFsaWduID09PSAncmlnaHQnKVxuICAgICAgICB7XG4gICAgICAgICAgICBhbGlnbk9mZnNldCA9IG1heExpbmVXaWR0aCAtIGxpbmVXaWR0aHNbaV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZih0aGlzLnN0eWxlLmFsaWduID09PSAnY2VudGVyJylcbiAgICAgICAge1xuICAgICAgICAgICAgYWxpZ25PZmZzZXQgPSAobWF4TGluZVdpZHRoIC0gbGluZVdpZHRoc1tpXSkgLyAyO1xuICAgICAgICB9XG4gICAgICAgIGxpbmVBbGlnbk9mZnNldHMucHVzaChhbGlnbk9mZnNldCk7XG4gICAgfVxuXG4gICAgZm9yKGkgPSAwOyBpIDwgY2hhcnMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgYyA9IG5ldyBTcHJpdGUoY2hhcnNbaV0udGV4dHVyZSk7IC8vU3ByaXRlLmZyb21GcmFtZShjaGFyc1tpXS5jaGFyQ29kZSk7XG4gICAgICAgIGMucG9zaXRpb24ueCA9IChjaGFyc1tpXS5wb3NpdGlvbi54ICsgbGluZUFsaWduT2Zmc2V0c1tjaGFyc1tpXS5saW5lXSkgKiBzY2FsZTtcbiAgICAgICAgYy5wb3NpdGlvbi55ID0gY2hhcnNbaV0ucG9zaXRpb24ueSAqIHNjYWxlO1xuICAgICAgICBjLnNjYWxlLnggPSBjLnNjYWxlLnkgPSBzY2FsZTtcbiAgICAgICAgdGhpcy5hZGRDaGlsZChjKTtcbiAgICB9XG5cbiAgICB0aGlzLndpZHRoID0gbWF4TGluZVdpZHRoICogc2NhbGU7XG4gICAgdGhpcy5oZWlnaHQgPSAocG9zLnkgKyBkYXRhLmxpbmVIZWlnaHQpICogc2NhbGU7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGhlIHRyYW5zZm9yIG9mIHRoaXMgb2JqZWN0XG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgaWYodGhpcy5kaXJ0eSlcbiAgICB7XG4gICAgICAgIHdoaWxlKHRoaXMuY2hpbGRyZW4ubGVuZ3RoID4gMClcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVDaGlsZCh0aGlzLmdldENoaWxkQXQoMCkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlVGV4dCgpO1xuXG4gICAgICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbCh0aGlzKTtcbn07XG5cbkJpdG1hcFRleHQuZm9udHMgPSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBCaXRtYXBUZXh0O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcbnZhciBTcHJpdGUgPSByZXF1aXJlKCcuLi9kaXNwbGF5L1Nwcml0ZScpO1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuLi90ZXh0dXJlcy9UZXh0dXJlJyk7XG5cbi8qKlxuICogQSBUZXh0IE9iamVjdCB3aWxsIGNyZWF0ZSBhIGxpbmUocykgb2YgdGV4dCB0byBzcGxpdCBhIGxpbmUgeW91IGNhbiB1c2UgJ1xcbidcbiAqXG4gKiBAY2xhc3MgVGV4dFxuICogQGV4dGVuZHMgU3ByaXRlXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB0ZXh0IHtTdHJpbmd9IFRoZSBjb3B5IHRoYXQgeW91IHdvdWxkIGxpa2UgdGhlIHRleHQgdG8gZGlzcGxheVxuICogQHBhcmFtIFtzdHlsZV0ge09iamVjdH0gVGhlIHN0eWxlIHBhcmFtZXRlcnNcbiAqIEBwYXJhbSBbc3R5bGUuZm9udF0ge1N0cmluZ30gZGVmYXVsdCAnYm9sZCAyMHB0IEFyaWFsJyBUaGUgc3R5bGUgYW5kIHNpemUgb2YgdGhlIGZvbnRcbiAqIEBwYXJhbSBbc3R5bGUuZmlsbD0nYmxhY2snXSB7T2JqZWN0fSBBIGNhbnZhcyBmaWxsc3R5bGUgdGhhdCB3aWxsIGJlIHVzZWQgb24gdGhlIHRleHQgZWcgJ3JlZCcsICcjMDBGRjAwJ1xuICogQHBhcmFtIFtzdHlsZS5hbGlnbj0nbGVmdCddIHtTdHJpbmd9IEFuIGFsaWdubWVudCBvZiB0aGUgbXVsdGlsaW5lIHRleHQgKCdsZWZ0JywgJ2NlbnRlcicgb3IgJ3JpZ2h0JylcbiAqIEBwYXJhbSBbc3R5bGUuc3Ryb2tlXSB7U3RyaW5nfSBBIGNhbnZhcyBmaWxsc3R5bGUgdGhhdCB3aWxsIGJlIHVzZWQgb24gdGhlIHRleHQgc3Ryb2tlIGVnICdibHVlJywgJyNGQ0ZGMDAnXG4gKiBAcGFyYW0gW3N0eWxlLnN0cm9rZVRoaWNrbmVzcz0wXSB7TnVtYmVyfSBBIG51bWJlciB0aGF0IHJlcHJlc2VudHMgdGhlIHRoaWNrbmVzcyBvZiB0aGUgc3Ryb2tlLiBEZWZhdWx0IGlzIDAgKG5vIHN0cm9rZSlcbiAqIEBwYXJhbSBbc3R5bGUud29yZFdyYXA9ZmFsc2VdIHtCb29sZWFufSBJbmRpY2F0ZXMgaWYgd29yZCB3cmFwIHNob3VsZCBiZSB1c2VkXG4gKiBAcGFyYW0gW3N0eWxlLndvcmRXcmFwV2lkdGg9MTAwXSB7TnVtYmVyfSBUaGUgd2lkdGggYXQgd2hpY2ggdGV4dCB3aWxsIHdyYXBcbiAqL1xuZnVuY3Rpb24gVGV4dCh0ZXh0LCBzdHlsZSlcbntcbiAgICB0aGlzLmNhbnZhcyA9IHBsYXRmb3JtLmNyZWF0ZUNhbnZhcygpO1xuICAgIHRoaXMuY29udGV4dCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgU3ByaXRlLmNhbGwodGhpcywgVGV4dHVyZS5mcm9tQ2FudmFzKHRoaXMuY2FudmFzKSk7XG5cbiAgICB0aGlzLnNldFRleHQodGV4dCk7XG4gICAgdGhpcy5zZXRTdHlsZShzdHlsZSk7XG5cbiAgICB0aGlzLnVwZGF0ZVRleHQoKTtcbiAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IFRleHQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTcHJpdGUucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogVGV4dH1cbn0pO1xuXG4vKipcbiAqIFNldCB0aGUgc3R5bGUgb2YgdGhlIHRleHRcbiAqXG4gKiBAbWV0aG9kIHNldFN0eWxlXG4gKiBAcGFyYW0gW3N0eWxlXSB7T2JqZWN0fSBUaGUgc3R5bGUgcGFyYW1ldGVyc1xuICogQHBhcmFtIFtzdHlsZS5mb250PSdib2xkIDIwcHQgQXJpYWwnXSB7U3RyaW5nfSBUaGUgc3R5bGUgYW5kIHNpemUgb2YgdGhlIGZvbnRcbiAqIEBwYXJhbSBbc3R5bGUuZmlsbD0nYmxhY2snXSB7T2JqZWN0fSBBIGNhbnZhcyBmaWxsc3R5bGUgdGhhdCB3aWxsIGJlIHVzZWQgb24gdGhlIHRleHQgZWcgJ3JlZCcsICcjMDBGRjAwJ1xuICogQHBhcmFtIFtzdHlsZS5hbGlnbj0nbGVmdCddIHtTdHJpbmd9IEFuIGFsaWdubWVudCBvZiB0aGUgbXVsdGlsaW5lIHRleHQgKCdsZWZ0JywgJ2NlbnRlcicgb3IgJ3JpZ2h0JylcbiAqIEBwYXJhbSBbc3R5bGUuc3Ryb2tlPSdibGFjayddIHtTdHJpbmd9IEEgY2FudmFzIGZpbGxzdHlsZSB0aGF0IHdpbGwgYmUgdXNlZCBvbiB0aGUgdGV4dCBzdHJva2UgZWcgJ2JsdWUnLCAnI0ZDRkYwMCdcbiAqIEBwYXJhbSBbc3R5bGUuc3Ryb2tlVGhpY2tuZXNzPTBdIHtOdW1iZXJ9IEEgbnVtYmVyIHRoYXQgcmVwcmVzZW50cyB0aGUgdGhpY2tuZXNzIG9mIHRoZSBzdHJva2UuIERlZmF1bHQgaXMgMCAobm8gc3Ryb2tlKVxuICogQHBhcmFtIFtzdHlsZS53b3JkV3JhcD1mYWxzZV0ge0Jvb2xlYW59IEluZGljYXRlcyBpZiB3b3JkIHdyYXAgc2hvdWxkIGJlIHVzZWRcbiAqIEBwYXJhbSBbc3R5bGUud29yZFdyYXBXaWR0aD0xMDBdIHtOdW1iZXJ9IFRoZSB3aWR0aCBhdCB3aGljaCB0ZXh0IHdpbGwgd3JhcFxuICovXG5wcm90by5zZXRTdHlsZSA9IGZ1bmN0aW9uIHNldFN0eWxlKHN0eWxlKVxue1xuICAgIHN0eWxlID0gc3R5bGUgfHwge307XG4gICAgc3R5bGUuZm9udCA9IHN0eWxlLmZvbnQgfHwgJ2JvbGQgMjBwdCBBcmlhbCc7XG4gICAgc3R5bGUuZmlsbCA9IHN0eWxlLmZpbGwgfHwgJ2JsYWNrJztcbiAgICBzdHlsZS5hbGlnbiA9IHN0eWxlLmFsaWduIHx8ICdsZWZ0JztcbiAgICBzdHlsZS5zdHJva2UgPSBzdHlsZS5zdHJva2UgfHwgJ2JsYWNrJzsgLy9wcm92aWRlIGEgZGVmYXVsdCwgc2VlOiBodHRwczovL2dpdGh1Yi5jb20vR29vZEJveURpZ2l0YWwvcGl4aS5qcy9pc3N1ZXMvMTM2XG4gICAgc3R5bGUuc3Ryb2tlVGhpY2tuZXNzID0gc3R5bGUuc3Ryb2tlVGhpY2tuZXNzIHx8IDA7XG4gICAgc3R5bGUud29yZFdyYXAgPSBzdHlsZS53b3JkV3JhcCB8fCBmYWxzZTtcbiAgICBzdHlsZS53b3JkV3JhcFdpZHRoID0gc3R5bGUud29yZFdyYXBXaWR0aCB8fCAxMDA7XG4gICAgdGhpcy5zdHlsZSA9IHN0eWxlO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBTZXQgdGhlIGNvcHkgZm9yIHRoZSB0ZXh0IG9iamVjdC4gVG8gc3BsaXQgYSBsaW5lIHlvdSBjYW4gdXNlICdcXG4nXG4gKlxuICogQG1ldGhvZCBzZXRUZXh0XG4gKiBAcGFyYW0ge1N0cmluZ30gdGV4dCBUaGUgY29weSB0aGF0IHlvdSB3b3VsZCBsaWtlIHRoZSB0ZXh0IHRvIGRpc3BsYXlcbiAqL1xucHJvdG8uc2V0VGV4dCA9IGZ1bmN0aW9uIHNldFRleHQodGV4dClcbntcbiAgICB0aGlzLnRleHQgPSB0ZXh0LnRvU3RyaW5nKCkgfHwgJyAnO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBSZW5kZXJzIHRleHRcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRleHRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRleHQgPSBmdW5jdGlvbiB1cGRhdGVUZXh0KClcbntcbiAgICB0aGlzLmNvbnRleHQuZm9udCA9IHRoaXMuc3R5bGUuZm9udDtcblxuICAgIHZhciBvdXRwdXRUZXh0ID0gdGhpcy50ZXh0O1xuXG4gICAgLy8gd29yZCB3cmFwXG4gICAgLy8gcHJlc2VydmUgb3JpZ2luYWwgdGV4dFxuICAgIGlmKHRoaXMuc3R5bGUud29yZFdyYXApb3V0cHV0VGV4dCA9IHRoaXMud29yZFdyYXAodGhpcy50ZXh0KTtcblxuICAgIC8vc3BsaXQgdGV4dCBpbnRvIGxpbmVzXG4gICAgdmFyIGxpbmVzID0gb3V0cHV0VGV4dC5zcGxpdCgvKD86XFxyXFxufFxccnxcXG4pLyk7XG5cbiAgICAvL2NhbGN1bGF0ZSB0ZXh0IHdpZHRoXG4gICAgdmFyIGxpbmVXaWR0aHMgPSBbXTtcbiAgICB2YXIgbWF4TGluZVdpZHRoID0gMDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGxpbmVXaWR0aCA9IHRoaXMuY29udGV4dC5tZWFzdXJlVGV4dChsaW5lc1tpXSkud2lkdGg7XG4gICAgICAgIGxpbmVXaWR0aHNbaV0gPSBsaW5lV2lkdGg7XG4gICAgICAgIG1heExpbmVXaWR0aCA9IE1hdGgubWF4KG1heExpbmVXaWR0aCwgbGluZVdpZHRoKTtcbiAgICB9XG4gICAgdGhpcy5jYW52YXMud2lkdGggPSBtYXhMaW5lV2lkdGggKyB0aGlzLnN0eWxlLnN0cm9rZVRoaWNrbmVzcztcblxuICAgIC8vY2FsY3VsYXRlIHRleHQgaGVpZ2h0XG4gICAgdmFyIGxpbmVIZWlnaHQgPSB0aGlzLmRldGVybWluZUZvbnRIZWlnaHQoJ2ZvbnQ6ICcgKyB0aGlzLnN0eWxlLmZvbnQgICsgJzsnKSArIHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzO1xuICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IGxpbmVIZWlnaHQgKiBsaW5lcy5sZW5ndGg7XG5cbiAgICAvL3NldCBjYW52YXMgdGV4dCBzdHlsZXNcbiAgICB0aGlzLmNvbnRleHQuZmlsbFN0eWxlID0gdGhpcy5zdHlsZS5maWxsO1xuICAgIHRoaXMuY29udGV4dC5mb250ID0gdGhpcy5zdHlsZS5mb250O1xuXG4gICAgdGhpcy5jb250ZXh0LnN0cm9rZVN0eWxlID0gdGhpcy5zdHlsZS5zdHJva2U7XG4gICAgdGhpcy5jb250ZXh0LmxpbmVXaWR0aCA9IHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzO1xuXG4gICAgdGhpcy5jb250ZXh0LnRleHRCYXNlbGluZSA9ICd0b3AnO1xuXG4gICAgLy9kcmF3IGxpbmVzIGxpbmUgYnkgbGluZVxuICAgIGZvciAoaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBsaW5lUG9zaXRpb24gPSBuZXcgUG9pbnQodGhpcy5zdHlsZS5zdHJva2VUaGlja25lc3MgLyAyLCB0aGlzLnN0eWxlLnN0cm9rZVRoaWNrbmVzcyAvIDIgKyBpICogbGluZUhlaWdodCk7XG5cbiAgICAgICAgaWYodGhpcy5zdHlsZS5hbGlnbiA9PT0gJ3JpZ2h0JylcbiAgICAgICAge1xuICAgICAgICAgICAgbGluZVBvc2l0aW9uLnggKz0gbWF4TGluZVdpZHRoIC0gbGluZVdpZHRoc1tpXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKHRoaXMuc3R5bGUuYWxpZ24gPT09ICdjZW50ZXInKVxuICAgICAgICB7XG4gICAgICAgICAgICBsaW5lUG9zaXRpb24ueCArPSAobWF4TGluZVdpZHRoIC0gbGluZVdpZHRoc1tpXSkgLyAyO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5zdHlsZS5zdHJva2UgJiYgdGhpcy5zdHlsZS5zdHJva2VUaGlja25lc3MpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5zdHJva2VUZXh0KGxpbmVzW2ldLCBsaW5lUG9zaXRpb24ueCwgbGluZVBvc2l0aW9uLnkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5zdHlsZS5maWxsKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQuZmlsbFRleHQobGluZXNbaV0sIGxpbmVQb3NpdGlvbi54LCBsaW5lUG9zaXRpb24ueSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnVwZGF0ZVRleHR1cmUoKTtcbn07XG5cbi8qKlxuICogVXBkYXRlcyB0ZXh0dXJlIHNpemUgYmFzZWQgb24gY2FudmFzIHNpemVcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRleHR1cmVcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRleHR1cmUgPSBmdW5jdGlvbiB1cGRhdGVUZXh0dXJlKClcbntcbiAgICB0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUud2lkdGggPSB0aGlzLmNhbnZhcy53aWR0aDtcbiAgICB0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUuaGVpZ2h0ID0gdGhpcy5jYW52YXMuaGVpZ2h0O1xuICAgIHRoaXMudGV4dHVyZS5mcmFtZS53aWR0aCA9IHRoaXMuY2FudmFzLndpZHRoO1xuICAgIHRoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQgPSB0aGlzLmNhbnZhcy5oZWlnaHQ7XG5cbiAgICB0aGlzLl93aWR0aCA9IHRoaXMuY2FudmFzLndpZHRoO1xuICAgIHRoaXMuX2hlaWdodCA9IHRoaXMuY2FudmFzLmhlaWdodDtcblxuICAgIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZS5wdXNoKHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZSk7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGhlIHRyYW5zZm9yIG9mIHRoaXMgb2JqZWN0XG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgaWYodGhpcy5kaXJ0eSlcbiAgICB7XG4gICAgICAgIHRoaXMudXBkYXRlVGV4dCgpO1xuICAgICAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgU3ByaXRlLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbCh0aGlzKTtcbn07XG5cbi8qXG4gKiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vdXNlcnMvMzQ0NDEvZWxsaXNiYmVuXG4gKiBncmVhdCBzb2x1dGlvbiB0byB0aGUgcHJvYmxlbSFcbiAqXG4gKiBAbWV0aG9kIGRldGVybWluZUZvbnRIZWlnaHRcbiAqIEBwYXJhbSBmb250U3R5bGUge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmRldGVybWluZUZvbnRIZWlnaHQgPSBmdW5jdGlvbiBkZXRlcm1pbmVGb250SGVpZ2h0KGZvbnRTdHlsZSlcbntcbiAgICAvLyBidWlsZCBhIGxpdHRsZSByZWZlcmVuY2UgZGljdGlvbmFyeSBzbyBpZiB0aGUgZm9udCBzdHlsZSBoYXMgYmVlbiB1c2VkIHJldHVybiBhXG4gICAgLy8gY2FjaGVkIHZlcnNpb24uLi5cbiAgICB2YXIgcmVzdWx0ID0gVGV4dC5oZWlnaHRDYWNoZVtmb250U3R5bGVdO1xuXG4gICAgaWYoIXJlc3VsdClcbiAgICB7XG4gICAgICAgIHZhciBib2R5ID0gcGxhdGZvcm0uZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2JvZHknKVswXTtcbiAgICAgICAgdmFyIGR1bW15ID0gcGxhdGZvcm0uZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHZhciBkdW1teVRleHQgPSBwbGF0Zm9ybS5kb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnTScpO1xuICAgICAgICBkdW1teS5hcHBlbmRDaGlsZChkdW1teVRleHQpO1xuICAgICAgICBkdW1teS5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgZm9udFN0eWxlICsgJztwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0OjAnKTtcbiAgICAgICAgYm9keS5hcHBlbmRDaGlsZChkdW1teSk7XG5cbiAgICAgICAgcmVzdWx0ID0gZHVtbXkub2Zmc2V0SGVpZ2h0O1xuICAgICAgICBUZXh0LmhlaWdodENhY2hlW2ZvbnRTdHlsZV0gPSByZXN1bHQ7XG5cbiAgICAgICAgYm9keS5yZW1vdmVDaGlsZChkdW1teSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogQXBwbGllcyBuZXdsaW5lcyB0byBhIHN0cmluZyB0byBoYXZlIGl0IG9wdGltYWxseSBmaXQgaW50byB0aGUgaG9yaXpvbnRhbFxuICogYm91bmRzIHNldCBieSB0aGUgVGV4dCBvYmplY3QncyB3b3JkV3JhcFdpZHRoIHByb3BlcnR5LlxuICpcbiAqIEBtZXRob2Qgd29yZFdyYXBcbiAqIEBwYXJhbSB0ZXh0IHtTdHJpbmd9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by53b3JkV3JhcCA9IGZ1bmN0aW9uIHdvcmRXcmFwKHRleHQpXG57XG4gICAgLy8gR3JlZWR5IHdyYXBwaW5nIGFsZ29yaXRobSB0aGF0IHdpbGwgd3JhcCB3b3JkcyBhcyB0aGUgbGluZSBncm93cyBsb25nZXJcbiAgICAvLyB0aGFuIGl0cyBob3Jpem9udGFsIGJvdW5kcy5cbiAgICB2YXIgcmVzdWx0ID0gJyc7XG4gICAgdmFyIGxpbmVzID0gdGV4dC5zcGxpdCgnXFxuJyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBzcGFjZUxlZnQgPSB0aGlzLnN0eWxlLndvcmRXcmFwV2lkdGg7XG4gICAgICAgIHZhciB3b3JkcyA9IGxpbmVzW2ldLnNwbGl0KCcgJyk7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgd29yZHMubGVuZ3RoOyBqKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciB3b3JkV2lkdGggPSB0aGlzLmNvbnRleHQubWVhc3VyZVRleHQod29yZHNbal0pLndpZHRoO1xuICAgICAgICAgICAgdmFyIHdvcmRXaWR0aFdpdGhTcGFjZSA9IHdvcmRXaWR0aCArIHRoaXMuY29udGV4dC5tZWFzdXJlVGV4dCgnICcpLndpZHRoO1xuICAgICAgICAgICAgaWYod29yZFdpZHRoV2l0aFNwYWNlID4gc3BhY2VMZWZ0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIFNraXAgcHJpbnRpbmcgdGhlIG5ld2xpbmUgaWYgaXQncyB0aGUgZmlyc3Qgd29yZCBvZiB0aGUgbGluZSB0aGF0IGlzXG4gICAgICAgICAgICAgICAgLy8gZ3JlYXRlciB0aGFuIHRoZSB3b3JkIHdyYXAgd2lkdGguXG4gICAgICAgICAgICAgICAgaWYoaiA+IDApXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gJ1xcbic7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc3VsdCArPSB3b3Jkc1tqXSArICcgJztcbiAgICAgICAgICAgICAgICBzcGFjZUxlZnQgPSB0aGlzLnN0eWxlLndvcmRXcmFwV2lkdGggLSB3b3JkV2lkdGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgc3BhY2VMZWZ0IC09IHdvcmRXaWR0aFdpdGhTcGFjZTtcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gd29yZHNbal0gKyAnICc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0ICs9ICdcXG4nO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBEZXN0cm95cyB0aGlzIHRleHQgb2JqZWN0XG4gKlxuICogQG1ldGhvZCBkZXN0cm95XG4gKiBAcGFyYW0gZGVzdHJveVRleHR1cmUge0Jvb2xlYW59XG4gKi9cbnByb3RvLmRlc3Ryb3kgPSBmdW5jdGlvbiBkZXN0cm95KGRlc3Ryb3lUZXh0dXJlKVxue1xuICAgIGlmKGRlc3Ryb3lUZXh0dXJlKVxuICAgIHtcbiAgICAgICAgdGhpcy50ZXh0dXJlLmRlc3Ryb3koKTtcbiAgICB9XG5cbn07XG5cblRleHQuaGVpZ2h0Q2FjaGUgPSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBFdmVudFRhcmdldCA9IHJlcXVpcmUoJy4uL2V2ZW50cy9FdmVudFRhcmdldCcpO1xudmFyIGJhc2VUZXh0dXJlQ2FjaGUgPSB7fTtcblxuLyoqXG4gKiBBIHRleHR1cmUgc3RvcmVzIHRoZSBpbmZvcm1hdGlvbiB0aGF0IHJlcHJlc2VudHMgYW4gaW1hZ2UuIEFsbCB0ZXh0dXJlcyBoYXZlIGEgYmFzZSB0ZXh0dXJlXG4gKlxuICogQGNsYXNzIEJhc2VUZXh0dXJlXG4gKiBAdXNlcyBFdmVudFRhcmdldFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gc291cmNlIHtTdHJpbmd9IHRoZSBzb3VyY2Ugb2JqZWN0IChpbWFnZSBvciBjYW52YXMpXG4gKi9cbmZ1bmN0aW9uIEJhc2VUZXh0dXJlKHNvdXJjZSwgc2NhbGVNb2RlKVxue1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgd2lkdGggb2YgdGhlIGJhc2UgdGV4dHVyZSBzZXQgd2hlbiB0aGUgaW1hZ2UgaGFzIGxvYWRlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHdpZHRoXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy53aWR0aCA9IDEwMDtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBoZWlnaHQgb2YgdGhlIGJhc2UgdGV4dHVyZSBzZXQgd2hlbiB0aGUgaW1hZ2UgaGFzIGxvYWRlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGhlaWdodFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMuaGVpZ2h0ID0gMTAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNjYWxlIG1vZGUgdG8gYXBwbHkgd2hlbiBzY2FsaW5nIHRoaXMgdGV4dHVyZVxuICAgICAqIEBwcm9wZXJ0eSBzY2FsZU1vZGVcbiAgICAgKiBAdHlwZSBQSVhJLkJhc2VUZXh0dXJlLlNDQUxFX01PREVcbiAgICAgKiBAZGVmYXVsdCBQSVhJLkJhc2VUZXh0dXJlLlNDQUxFX01PREUuTElORUFSXG4gICAgICovXG4gICAgdGhpcy5zY2FsZU1vZGUgPSBzY2FsZU1vZGUgfHwgQmFzZVRleHR1cmUuU0NBTEVfTU9ERS5ERUZBVUxUO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gRGVzY3JpYmVzIGlmIHRoZSBiYXNlIHRleHR1cmUgaGFzIGxvYWRlZCBvciBub3RcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBoYXNMb2FkZWRcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5oYXNMb2FkZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzb3VyY2UgdGhhdCBpcyBsb2FkZWQgdG8gY3JlYXRlIHRoZSB0ZXh0dXJlXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgc291cmNlXG4gICAgICogQHR5cGUgSW1hZ2VcbiAgICAgKi9cbiAgICB0aGlzLnNvdXJjZSA9IHNvdXJjZTtcblxuICAgIGlmKCFzb3VyY2UpcmV0dXJuO1xuXG4gICAgaWYoJ2NvbXBsZXRlJyBpbiB0aGlzLnNvdXJjZSlcbiAgICB7XG4gICAgICAgIGlmKHRoaXMuc291cmNlLmNvbXBsZXRlKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmhhc0xvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLndpZHRoID0gdGhpcy5zb3VyY2Uud2lkdGg7XG4gICAgICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuc291cmNlLmhlaWdodDtcblxuICAgICAgICAgICAgZ2xvYmFscy50ZXh0dXJlc1RvVXBkYXRlLnB1c2godGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgIHNjb3BlLmhhc0xvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgc2NvcGUud2lkdGggPSBzY29wZS5zb3VyY2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgc2NvcGUuaGVpZ2h0ID0gc2NvcGUuc291cmNlLmhlaWdodDtcblxuICAgICAgICAgICAgICAgIC8vIGFkZCBpdCB0byBzb21ld2hlcmUuLi5cbiAgICAgICAgICAgICAgICBnbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUucHVzaChzY29wZSk7XG4gICAgICAgICAgICAgICAgc2NvcGUuZGlzcGF0Y2hFdmVudCggeyB0eXBlOiAnbG9hZGVkJywgY29udGVudDogc2NvcGUgfSApO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vdGhpcy5pbWFnZS5zcmMgPSBpbWFnZVVybDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLmhhc0xvYWRlZCA9IHRydWU7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLnNvdXJjZS53aWR0aDtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLnNvdXJjZS5oZWlnaHQ7XG5cbiAgICAgICAgZ2xvYmFscy50ZXh0dXJlc1RvVXBkYXRlLnB1c2godGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy5pbWFnZVVybCA9IG51bGw7XG4gICAgdGhpcy5fcG93ZXJPZjIgPSBmYWxzZTtcbn1cblxudmFyIHByb3RvID0gQmFzZVRleHR1cmUucHJvdG90eXBlO1xuXG4vKipcbiAqIERlc3Ryb3lzIHRoaXMgYmFzZSB0ZXh0dXJlXG4gKlxuICogQG1ldGhvZCBkZXN0cm95XG4gKi9cbnByb3RvLmRlc3Ryb3kgPSBmdW5jdGlvbiBkZXN0cm95KClcbntcbiAgICBpZih0aGlzLnNvdXJjZS5zcmMpXG4gICAge1xuICAgICAgICBpZiAodGhpcy5pbWFnZVVybCBpbiBiYXNlVGV4dHVyZUNhY2hlKVxuICAgICAgICAgICAgZGVsZXRlIGJhc2VUZXh0dXJlQ2FjaGVbdGhpcy5pbWFnZVVybF07XG4gICAgICAgIHRoaXMuaW1hZ2VVcmwgPSBudWxsO1xuICAgICAgICB0aGlzLnNvdXJjZS5zcmMgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG4gICAgZ2xvYmFscy50ZXh0dXJlc1RvRGVzdHJveS5wdXNoKHRoaXMpO1xufTtcblxuLyoqXG4gKlxuICpcbiAqIEBtZXRob2QgZGVzdHJveVxuICovXG5wcm90by51cGRhdGVTb3VyY2VJbWFnZSA9IGZ1bmN0aW9uIHVwZGF0ZVNvdXJjZUltYWdlKG5ld1NyYylcbntcbiAgICB0aGlzLmhhc0xvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuc291cmNlLnNyYyA9IG51bGw7XG4gICAgdGhpcy5zb3VyY2Uuc3JjID0gbmV3U3JjO1xufTtcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgYmFzZSB0ZXh0dXJlIGJhc2VkIG9uIGFuIGltYWdlIHVybFxuICogSWYgdGhlIGltYWdlIGlzIG5vdCBpbiB0aGUgYmFzZSB0ZXh0dXJlIGNhY2hlIGl0IHdpbGwgYmUgIGNyZWF0ZWQgYW5kIGxvYWRlZFxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZnJvbUltYWdlXG4gKiBAcGFyYW0gaW1hZ2VVcmwge1N0cmluZ30gVGhlIGltYWdlIHVybCBvZiB0aGUgdGV4dHVyZVxuICogQHJldHVybiBCYXNlVGV4dHVyZVxuICovXG5CYXNlVGV4dHVyZS5mcm9tSW1hZ2UgPSBmdW5jdGlvbiBmcm9tSW1hZ2UoaW1hZ2VVcmwsIGNyb3Nzb3JpZ2luLCBzY2FsZU1vZGUpXG57XG4gICAgdmFyIGJhc2VUZXh0dXJlID0gYmFzZVRleHR1cmVDYWNoZVtpbWFnZVVybF07XG4gICAgaWYoIWJhc2VUZXh0dXJlKVxuICAgIHtcbiAgICAgICAgdmFyIGltYWdlID0gbmV3IHBsYXRmb3JtLmNyZWF0ZUltYWdlKCk7XG4gICAgICAgIGlmIChjcm9zc29yaWdpbilcbiAgICAgICAge1xuICAgICAgICAgICAgaW1hZ2UuY3Jvc3NPcmlnaW4gPSAnJztcbiAgICAgICAgfVxuICAgICAgICBpbWFnZS5zcmMgPSBpbWFnZVVybDtcbiAgICAgICAgYmFzZVRleHR1cmUgPSBuZXcgQmFzZVRleHR1cmUoaW1hZ2UsIHNjYWxlTW9kZSk7XG4gICAgICAgIGJhc2VUZXh0dXJlLmltYWdlVXJsID0gaW1hZ2VVcmw7XG4gICAgICAgIGJhc2VUZXh0dXJlQ2FjaGVbaW1hZ2VVcmxdID0gYmFzZVRleHR1cmU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJhc2VUZXh0dXJlO1xufTtcblxuQmFzZVRleHR1cmUuU0NBTEVfTU9ERSA9IHtcbiAgICBERUZBVUxUOiAwLCAvL2RlZmF1bHQgdG8gTElORUFSXG4gICAgTElORUFSOiAwLFxuICAgIE5FQVJFU1Q6IDFcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQmFzZVRleHR1cmU7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgbWF0MyA9IHJlcXVpcmUoJy4uL2dlb20vbWF0cml4JykubWF0MztcblxudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuL1RleHR1cmUnKTtcbnZhciBCYXNlVGV4dHVyZSA9IHJlcXVpcmUoJy4vQmFzZVRleHR1cmUnKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcbnZhciBSZWN0YW5nbGUgPSByZXF1aXJlKCcuLi9nZW9tL1JlY3RhbmdsZScpO1xudmFyIEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG52YXIgQ2FudmFzUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlcnMvY2FudmFzL0NhbnZhc1JlbmRlcmVyJyk7XG52YXIgV2ViR0xSZW5kZXJHcm91cCA9IHJlcXVpcmUoJy4uL3JlbmRlcmVycy93ZWJnbC9XZWJHTFJlbmRlckdyb3VwJyk7XG5cbi8qKlxuIEEgUmVuZGVyVGV4dHVyZSBpcyBhIHNwZWNpYWwgdGV4dHVyZSB0aGF0IGFsbG93cyBhbnkgcGl4aSBkaXNwbGF5T2JqZWN0IHRvIGJlIHJlbmRlcmVkIHRvIGl0LlxuXG4gX19IaW50X186IEFsbCBEaXNwbGF5T2JqZWN0cyAoZXhtcGwuIFNwcml0ZXMpIHRoYXQgcmVuZGVycyBvbiBSZW5kZXJUZXh0dXJlIHNob3VsZCBiZSBwcmVsb2FkZWQuXG4gT3RoZXJ3aXNlIGJsYWNrIHJlY3RhbmdsZXMgd2lsbCBiZSBkcmF3biBpbnN0ZWFkLlxuXG4gUmVuZGVyVGV4dHVyZSB0YWtlcyBzbmFwc2hvdCBvZiBEaXNwbGF5T2JqZWN0IHBhc3NlZCB0byByZW5kZXIgbWV0aG9kLiBJZiBEaXNwbGF5T2JqZWN0IGlzIHBhc3NlZCB0byByZW5kZXIgbWV0aG9kLCBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgaXQgd2lsbCBiZSBpZ25vcmVkLiBGb3IgZXhhbXBsZTpcblxuICAgIHZhciByZW5kZXJUZXh0dXJlID0gbmV3IFJlbmRlclRleHR1cmUoODAwLCA2MDApO1xuICAgIHZhciBzcHJpdGUgPSBTcHJpdGUuZnJvbUltYWdlKFwic3Bpbk9ial8wMS5wbmdcIik7XG4gICAgc3ByaXRlLnBvc2l0aW9uLnggPSA4MDAvMjtcbiAgICBzcHJpdGUucG9zaXRpb24ueSA9IDYwMC8yO1xuICAgIHNwcml0ZS5hbmNob3IueCA9IDAuNTtcbiAgICBzcHJpdGUuYW5jaG9yLnkgPSAwLjU7XG4gICAgcmVuZGVyVGV4dHVyZS5yZW5kZXIoc3ByaXRlKTtcblxuIFNwcml0ZSBpbiB0aGlzIGNhc2Ugd2lsbCBiZSByZW5kZXJlZCB0byAwLDAgcG9zaXRpb24uIFRvIHJlbmRlciB0aGlzIHNwcml0ZSBhdCBjZW50ZXIgRGlzcGxheU9iamVjdENvbnRhaW5lciBzaG91bGQgYmUgdXNlZDpcblxuICAgIHZhciBkb2MgPSBuZXcgRGlzcGxheU9iamVjdENvbnRhaW5lcigpO1xuICAgIGRvYy5hZGRDaGlsZChzcHJpdGUpO1xuICAgIHJlbmRlclRleHR1cmUucmVuZGVyKGRvYyk7ICAvLyBSZW5kZXJzIHRvIGNlbnRlciBvZiByZW5kZXJUZXh0dXJlXG5cbiBAY2xhc3MgUmVuZGVyVGV4dHVyZVxuIEBleHRlbmRzIFRleHR1cmVcbiBAY29uc3RydWN0b3JcbiBAcGFyYW0gd2lkdGgge051bWJlcn0gVGhlIHdpZHRoIG9mIHRoZSByZW5kZXIgdGV4dHVyZVxuIEBwYXJhbSBoZWlnaHQge051bWJlcn0gVGhlIGhlaWdodCBvZiB0aGUgcmVuZGVyIHRleHR1cmVcbiAqL1xuZnVuY3Rpb24gUmVuZGVyVGV4dHVyZSh3aWR0aCwgaGVpZ2h0KVxue1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMud2lkdGggPSB3aWR0aCB8fCAxMDA7XG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQgfHwgMTAwO1xuXG4gICAgdGhpcy5pZGVudGl0eU1hdHJpeCA9IG1hdDMuY3JlYXRlKCk7XG5cbiAgICB0aGlzLmZyYW1lID0gbmV3IFJlY3RhbmdsZSgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICBpZihnbG9iYWxzLmdsKVxuICAgIHtcbiAgICAgICAgdGhpcy5pbml0V2ViR0woKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5pbml0Q2FudmFzKCk7XG4gICAgfVxufVxuXG52YXIgcHJvdG8gPSBSZW5kZXJUZXh0dXJlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoVGV4dHVyZS5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBSZW5kZXJUZXh0dXJlfVxufSk7XG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIHdlYmdsIGRhdGEgZm9yIHRoaXMgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgaW5pdFdlYkdMXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5pbml0V2ViR0wgPSBmdW5jdGlvbiBpbml0V2ViR0woKVxue1xuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG4gICAgdGhpcy5nbEZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcblxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5nbEZyYW1lYnVmZmVyICk7XG5cbiAgICB0aGlzLmdsRnJhbWVidWZmZXIud2lkdGggPSB0aGlzLndpZHRoO1xuICAgIHRoaXMuZ2xGcmFtZWJ1ZmZlci5oZWlnaHQgPSB0aGlzLmhlaWdodDtcblxuICAgIHRoaXMuYmFzZVRleHR1cmUgPSBuZXcgQmFzZVRleHR1cmUoKTtcblxuICAgIHRoaXMuYmFzZVRleHR1cmUud2lkdGggPSB0aGlzLndpZHRoO1xuICAgIHRoaXMuYmFzZVRleHR1cmUuaGVpZ2h0ID0gdGhpcy5oZWlnaHQ7XG5cbiAgICB0aGlzLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlKTtcblxuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgIHRoaXMud2lkdGgsICB0aGlzLmhlaWdodCwgMCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgbnVsbCk7XG5cbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcblxuICAgIHRoaXMuYmFzZVRleHR1cmUuaXNSZW5kZXIgPSB0cnVlO1xuXG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmdsRnJhbWVidWZmZXIgKTtcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHRoaXMuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSwgMCk7XG5cbiAgICAvLyBjcmVhdGUgYSBwcm9qZWN0aW9uIG1hdHJpeC4uXG4gICAgdGhpcy5wcm9qZWN0aW9uID0gbmV3IFBvaW50KHRoaXMud2lkdGgvMiAsIC10aGlzLmhlaWdodC8yKTtcblxuICAgIC8vIHNldCB0aGUgY29ycmVjdCByZW5kZXIgZnVuY3Rpb24uLlxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXJXZWJHTDtcbn07XG5cbnByb3RvLnJlc2l6ZSA9IGZ1bmN0aW9uIHJlc2l6ZSh3aWR0aCwgaGVpZ2h0KVxue1xuXG4gICAgdGhpcy53aWR0aCA9IHdpZHRoO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgaWYoZ2xvYmFscy5nbClcbiAgICB7XG4gICAgICAgIHRoaXMucHJvamVjdGlvbi54ID0gdGhpcy53aWR0aCAvIDI7XG4gICAgICAgIHRoaXMucHJvamVjdGlvbi55ID0gLXRoaXMuaGVpZ2h0IC8gMjtcblxuICAgICAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0aGlzLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUpO1xuICAgICAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsICB0aGlzLndpZHRoLCAgdGhpcy5oZWlnaHQsIDAsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG51bGwpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuXG4gICAgICAgIHRoaXMuZnJhbWUud2lkdGggPSB0aGlzLndpZHRoO1xuICAgICAgICB0aGlzLmZyYW1lLmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyB0aGUgY2FudmFzIGRhdGEgZm9yIHRoaXMgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgaW5pdENhbnZhc1xuICogQHByaXZhdGVcbiAqL1xucHJvdG8uaW5pdENhbnZhcyA9IGZ1bmN0aW9uIGluaXRDYW52YXMoKVxue1xuICAgIHRoaXMucmVuZGVyZXIgPSBuZXcgQ2FudmFzUmVuZGVyZXIodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQsIG51bGwsIDApO1xuXG4gICAgdGhpcy5iYXNlVGV4dHVyZSA9IG5ldyBCYXNlVGV4dHVyZSh0aGlzLnJlbmRlcmVyLnZpZXcpO1xuICAgIHRoaXMuZnJhbWUgPSBuZXcgUmVjdGFuZ2xlKDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuICAgIHRoaXMucmVuZGVyID0gdGhpcy5yZW5kZXJDYW52YXM7XG59O1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBkcmF3IHRoZSBkaXNwbGF5IG9iamVjdCB0byB0aGUgdGV4dHVyZS5cbiAqXG4gKiBAbWV0aG9kIHJlbmRlcldlYkdMXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gVGhlIGRpc3BsYXkgb2JqZWN0IHRvIHJlbmRlciB0aGlzIHRleHR1cmUgb25cbiAqIEBwYXJhbSBjbGVhciB7Qm9vbGVhbn0gSWYgdHJ1ZSB0aGUgdGV4dHVyZSB3aWxsIGJlIGNsZWFyZWQgYmVmb3JlIHRoZSBkaXNwbGF5T2JqZWN0IGlzIGRyYXduXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJXZWJHTCA9IGZ1bmN0aW9uIHJlbmRlcldlYkdMKGRpc3BsYXlPYmplY3QsIHBvc2l0aW9uLCBjbGVhcilcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgLy8gZW5hYmxlIHRoZSBhbHBoYSBjb2xvciBtYXNrLi5cbiAgICBnbC5jb2xvck1hc2sodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG5cbiAgICBnbC52aWV3cG9ydCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZ2xGcmFtZWJ1ZmZlciApO1xuXG4gICAgaWYoY2xlYXIpXG4gICAge1xuICAgICAgICBnbC5jbGVhckNvbG9yKDAsMCwwLCAwKTtcbiAgICAgICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG4gICAgfVxuXG4gICAgLy8gVEhJUyBXSUxMIE1FU1MgV0lUSCBISVQgVEVTVElORyFcbiAgICB2YXIgY2hpbGRyZW4gPSBkaXNwbGF5T2JqZWN0LmNoaWxkcmVuO1xuXG4gICAgLy9UT0RPIC0/IGNyZWF0ZSBhIG5ldyBvbmU/Pz8gZG9udCB0aGluayBzbyFcbiAgICB2YXIgb3JpZ2luYWxXb3JsZFRyYW5zZm9ybSA9IGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm07XG4gICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybSA9IG1hdDMuY3JlYXRlKCk7Ly9zdGhpcy5pZGVudGl0eU1hdHJpeDtcbiAgICAvLyBtb2RpZnkgdG8gZmxpcC4uLlxuICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm1bNF0gPSAtMTtcbiAgICBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtWzVdID0gdGhpcy5wcm9qZWN0aW9uLnkgKiAtMjtcblxuICAgIGlmKHBvc2l0aW9uKVxuICAgIHtcbiAgICAgICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybVsyXSA9IHBvc2l0aW9uLng7XG4gICAgICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm1bNV0gLT0gcG9zaXRpb24ueTtcbiAgICB9XG5cbiAgICBnbG9iYWxzLnZpc2libGVDb3VudCsrO1xuICAgIGRpc3BsYXlPYmplY3QudmNvdW50ID0gZ2xvYmFscy52aXNpYmxlQ291bnQ7XG5cbiAgICBmb3IodmFyIGk9MCxqPWNoaWxkcmVuLmxlbmd0aDsgaTxqOyBpKyspXG4gICAge1xuICAgICAgICBjaGlsZHJlbltpXS51cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICB2YXIgcmVuZGVyR3JvdXAgPSBkaXNwbGF5T2JqZWN0Ll9fcmVuZGVyR3JvdXA7XG5cbiAgICBpZihyZW5kZXJHcm91cClcbiAgICB7XG4gICAgICAgIGlmKGRpc3BsYXlPYmplY3QgPT09IHJlbmRlckdyb3VwLnJvb3QpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHJlbmRlckdyb3VwLnJlbmRlcih0aGlzLnByb2plY3Rpb24sIHRoaXMuZ2xGcmFtZWJ1ZmZlcik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICByZW5kZXJHcm91cC5yZW5kZXJTcGVjaWZpYyhkaXNwbGF5T2JqZWN0LCB0aGlzLnByb2plY3Rpb24sIHRoaXMuZ2xGcmFtZWJ1ZmZlcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgaWYoIXRoaXMucmVuZGVyR3JvdXApdGhpcy5yZW5kZXJHcm91cCA9IG5ldyBXZWJHTFJlbmRlckdyb3VwKGdsKTtcbiAgICAgICAgdGhpcy5yZW5kZXJHcm91cC5zZXRSZW5kZXJhYmxlKGRpc3BsYXlPYmplY3QpO1xuICAgICAgICB0aGlzLnJlbmRlckdyb3VwLnJlbmRlcih0aGlzLnByb2plY3Rpb24sIHRoaXMuZ2xGcmFtZWJ1ZmZlcik7XG4gICAgfVxuXG4gICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybSA9IG9yaWdpbmFsV29ybGRUcmFuc2Zvcm07XG59O1xuXG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGRyYXcgdGhlIGRpc3BsYXkgb2JqZWN0IHRvIHRoZSB0ZXh0dXJlLlxuICpcbiAqIEBtZXRob2QgcmVuZGVyQ2FudmFzXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gVGhlIGRpc3BsYXkgb2JqZWN0IHRvIHJlbmRlciB0aGlzIHRleHR1cmUgb25cbiAqIEBwYXJhbSBjbGVhciB7Qm9vbGVhbn0gSWYgdHJ1ZSB0aGUgdGV4dHVyZSB3aWxsIGJlIGNsZWFyZWQgYmVmb3JlIHRoZSBkaXNwbGF5T2JqZWN0IGlzIGRyYXduXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJDYW52YXMgPSBmdW5jdGlvbiByZW5kZXJDYW52YXMoZGlzcGxheU9iamVjdCwgcG9zaXRpb24sIGNsZWFyKVxue1xuICAgIHZhciBjaGlsZHJlbiA9IGRpc3BsYXlPYmplY3QuY2hpbGRyZW47XG5cbiAgICBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtID0gbWF0My5jcmVhdGUoKTtcblxuICAgIGlmKHBvc2l0aW9uKVxuICAgIHtcbiAgICAgICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybVsyXSA9IHBvc2l0aW9uLng7XG4gICAgICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm1bNV0gPSBwb3NpdGlvbi55O1xuICAgIH1cblxuXG4gICAgZm9yKHZhciBpID0gMCwgaiA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGo7IGkrKylcbiAgICB7XG4gICAgICAgIGNoaWxkcmVuW2ldLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgIH1cblxuICAgIGlmKGNsZWFyKSB0aGlzLnJlbmRlcmVyLmNvbnRleHQuY2xlYXJSZWN0KDAsMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXG4gICAgdGhpcy5yZW5kZXJlci5yZW5kZXJEaXNwbGF5T2JqZWN0KGRpc3BsYXlPYmplY3QpO1xuXG4gICAgdGhpcy5yZW5kZXJlci5jb250ZXh0LnNldFRyYW5zZm9ybSgxLDAsMCwxLDAsMCk7XG5cbiAgICAvL2dsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZS5wdXNoKHRoaXMuYmFzZVRleHR1cmUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSZW5kZXJUZXh0dXJlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQmFzZVRleHR1cmUgPSByZXF1aXJlKCcuL0Jhc2VUZXh0dXJlJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi9nZW9tL1BvaW50Jyk7XG52YXIgUmVjdGFuZ2xlID0gcmVxdWlyZSgnLi4vZ2VvbS9SZWN0YW5nbGUnKTtcbnZhciBFdmVudFRhcmdldCA9IHJlcXVpcmUoJy4uL2V2ZW50cy9FdmVudFRhcmdldCcpO1xuXG4vKipcbiAqIEEgdGV4dHVyZSBzdG9yZXMgdGhlIGluZm9ybWF0aW9uIHRoYXQgcmVwcmVzZW50cyBhbiBpbWFnZSBvciBwYXJ0IG9mIGFuIGltYWdlLiBJdCBjYW5ub3QgYmUgYWRkZWRcbiAqIHRvIHRoZSBkaXNwbGF5IGxpc3QgZGlyZWN0bHkuIFRvIGRvIHRoaXMgdXNlIFNwcml0ZS4gSWYgbm8gZnJhbWUgaXMgcHJvdmlkZWQgdGhlbiB0aGUgd2hvbGUgaW1hZ2UgaXMgdXNlZFxuICpcbiAqIEBjbGFzcyBUZXh0dXJlXG4gKiBAdXNlcyBFdmVudFRhcmdldFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gYmFzZVRleHR1cmUge0Jhc2VUZXh0dXJlfSBUaGUgYmFzZSB0ZXh0dXJlIHNvdXJjZSB0byBjcmVhdGUgdGhlIHRleHR1cmUgZnJvbVxuICogQHBhcmFtIGZyYW1lIHtSZWN0YW5nbGV9IFRoZSByZWN0YW5nbGUgZnJhbWUgb2YgdGhlIHRleHR1cmUgdG8gc2hvd1xuICovXG5mdW5jdGlvbiBUZXh0dXJlKGJhc2VUZXh0dXJlLCBmcmFtZSlcbntcbiAgICBFdmVudFRhcmdldC5jYWxsKCB0aGlzICk7XG5cbiAgICBpZighZnJhbWUpXG4gICAge1xuICAgICAgICB0aGlzLm5vRnJhbWUgPSB0cnVlO1xuICAgICAgICBmcmFtZSA9IG5ldyBSZWN0YW5nbGUoMCwwLDEsMSk7XG4gICAgfVxuXG4gICAgaWYoYmFzZVRleHR1cmUgaW5zdGFuY2VvZiBUZXh0dXJlKVxuICAgICAgICBiYXNlVGV4dHVyZSA9IGJhc2VUZXh0dXJlLmJhc2VUZXh0dXJlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGJhc2UgdGV4dHVyZSBvZiB0aGlzIHRleHR1cmVcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBiYXNlVGV4dHVyZVxuICAgICAqIEB0eXBlIEJhc2VUZXh0dXJlXG4gICAgICovXG4gICAgdGhpcy5iYXNlVGV4dHVyZSA9IGJhc2VUZXh0dXJlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZyYW1lIHNwZWNpZmllcyB0aGUgcmVnaW9uIG9mIHRoZSBiYXNlIHRleHR1cmUgdGhhdCB0aGlzIHRleHR1cmUgdXNlc1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IGZyYW1lXG4gICAgICogQHR5cGUgUmVjdGFuZ2xlXG4gICAgICovXG4gICAgdGhpcy5mcmFtZSA9IGZyYW1lO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRyaW0gcG9pbnRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0cmltXG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLnRyaW0gPSBuZXcgUG9pbnQoKTtcblxuICAgIHRoaXMuc2NvcGUgPSB0aGlzO1xuXG4gICAgaWYoYmFzZVRleHR1cmUuaGFzTG9hZGVkKVxuICAgIHtcbiAgICAgICAgaWYodGhpcy5ub0ZyYW1lKWZyYW1lID0gbmV3IFJlY3RhbmdsZSgwLDAsIGJhc2VUZXh0dXJlLndpZHRoLCBiYXNlVGV4dHVyZS5oZWlnaHQpO1xuICAgICAgICAvL2NvbnNvbGUubG9nKGZyYW1lKVxuXG4gICAgICAgIHRoaXMuc2V0RnJhbWUoZnJhbWUpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgICAgICBiYXNlVGV4dHVyZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWQnLCBmdW5jdGlvbigpeyBzY29wZS5vbkJhc2VUZXh0dXJlTG9hZGVkKCk7IH0pO1xuICAgIH1cbn1cblxudmFyIHByb3RvID0gVGV4dHVyZS5wcm90b3R5cGU7XG5cbi8qKlxuICogQ2FsbGVkIHdoZW4gdGhlIGJhc2UgdGV4dHVyZSBpcyBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIG9uQmFzZVRleHR1cmVMb2FkZWRcbiAqIEBwYXJhbSBldmVudFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25CYXNlVGV4dHVyZUxvYWRlZCA9IGZ1bmN0aW9uIG9uQmFzZVRleHR1cmVMb2FkZWQoKS8qKGV2ZW50KSovXG57XG4gICAgdmFyIGJhc2VUZXh0dXJlID0gdGhpcy5iYXNlVGV4dHVyZTtcbiAgICBiYXNlVGV4dHVyZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnbG9hZGVkJywgdGhpcy5vbkxvYWRlZCApO1xuXG4gICAgaWYodGhpcy5ub0ZyYW1lKXRoaXMuZnJhbWUgPSBuZXcgUmVjdGFuZ2xlKDAsMCwgYmFzZVRleHR1cmUud2lkdGgsIGJhc2VUZXh0dXJlLmhlaWdodCk7XG4gICAgdGhpcy5ub0ZyYW1lID0gZmFsc2U7XG4gICAgdGhpcy53aWR0aCA9IHRoaXMuZnJhbWUud2lkdGg7XG4gICAgdGhpcy5oZWlnaHQgPSB0aGlzLmZyYW1lLmhlaWdodDtcblxuICAgIHRoaXMuc2NvcGUuZGlzcGF0Y2hFdmVudCggeyB0eXBlOiAndXBkYXRlJywgY29udGVudDogdGhpcyB9ICk7XG59O1xuXG4vKipcbiAqIERlc3Ryb3lzIHRoaXMgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgZGVzdHJveVxuICogQHBhcmFtIGRlc3Ryb3lCYXNlIHtCb29sZWFufSBXaGV0aGVyIHRvIGRlc3Ryb3kgdGhlIGJhc2UgdGV4dHVyZSBhcyB3ZWxsXG4gKi9cbnByb3RvLmRlc3Ryb3kgPSBmdW5jdGlvbiBkZXN0cm95KGRlc3Ryb3lCYXNlKVxue1xuICAgIGlmKGRlc3Ryb3lCYXNlKSB0aGlzLmJhc2VUZXh0dXJlLmRlc3Ryb3koKTtcbn07XG5cbi8qKlxuICogU3BlY2lmaWVzIHRoZSByZWN0YW5nbGUgcmVnaW9uIG9mIHRoZSBiYXNlVGV4dHVyZVxuICpcbiAqIEBtZXRob2Qgc2V0RnJhbWVcbiAqIEBwYXJhbSBmcmFtZSB7UmVjdGFuZ2xlfSBUaGUgZnJhbWUgb2YgdGhlIHRleHR1cmUgdG8gc2V0IGl0IHRvXG4gKi9cbnByb3RvLnNldEZyYW1lID0gZnVuY3Rpb24gc2V0RnJhbWUoZnJhbWUpXG57XG4gICAgdGhpcy5mcmFtZSA9IGZyYW1lO1xuICAgIHRoaXMud2lkdGggPSBmcmFtZS53aWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IGZyYW1lLmhlaWdodDtcblxuICAgIGlmKGZyYW1lLnggKyBmcmFtZS53aWR0aCA+IHRoaXMuYmFzZVRleHR1cmUud2lkdGggfHwgZnJhbWUueSArIGZyYW1lLmhlaWdodCA+IHRoaXMuYmFzZVRleHR1cmUuaGVpZ2h0KVxuICAgIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUZXh0dXJlIEVycm9yOiBmcmFtZSBkb2VzIG5vdCBmaXQgaW5zaWRlIHRoZSBiYXNlIFRleHR1cmUgZGltZW5zaW9ucyAnICsgdGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG5cbiAgICBUZXh0dXJlLmZyYW1lVXBkYXRlcy5wdXNoKHRoaXMpO1xuICAgIC8vdGhpcy5kaXNwYXRjaEV2ZW50KCB7IHR5cGU6ICd1cGRhdGUnLCBjb250ZW50OiB0aGlzIH0gKTtcbn07XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHRleHR1cmUgYmFzZWQgb24gYW4gaW1hZ2UgdXJsXG4gKiBJZiB0aGUgaW1hZ2UgaXMgbm90IGluIHRoZSB0ZXh0dXJlIGNhY2hlIGl0IHdpbGwgYmUgIGNyZWF0ZWQgYW5kIGxvYWRlZFxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZnJvbUltYWdlXG4gKiBAcGFyYW0gaW1hZ2VVcmwge1N0cmluZ30gVGhlIGltYWdlIHVybCBvZiB0aGUgdGV4dHVyZVxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKiBAcmV0dXJuIFRleHR1cmVcbiAqL1xuVGV4dHVyZS5mcm9tSW1hZ2UgPSBmdW5jdGlvbiBmcm9tSW1hZ2UoaW1hZ2VVcmwsIGNyb3Nzb3JpZ2luLCBzY2FsZU1vZGUpXG57XG4gICAgdmFyIHRleHR1cmUgPSBUZXh0dXJlLmNhY2hlW2ltYWdlVXJsXTtcblxuICAgIGlmKCF0ZXh0dXJlKVxuICAgIHtcbiAgICAgICAgdGV4dHVyZSA9IG5ldyBUZXh0dXJlKEJhc2VUZXh0dXJlLmZyb21JbWFnZShpbWFnZVVybCwgY3Jvc3NvcmlnaW4sIHNjYWxlTW9kZSkpO1xuICAgICAgICBUZXh0dXJlLmNhY2hlW2ltYWdlVXJsXSA9IHRleHR1cmU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRleHR1cmU7XG59O1xuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSB0ZXh0dXJlIGJhc2VkIG9uIGEgZnJhbWUgaWRcbiAqIElmIHRoZSBmcmFtZSBpZCBpcyBub3QgaW4gdGhlIHRleHR1cmUgY2FjaGUgYW4gZXJyb3Igd2lsbCBiZSB0aHJvd25cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGZyb21GcmFtZVxuICogQHBhcmFtIGZyYW1lSWQge1N0cmluZ30gVGhlIGZyYW1lIGlkIG9mIHRoZSB0ZXh0dXJlXG4gKiBAcmV0dXJuIFRleHR1cmVcbiAqL1xuVGV4dHVyZS5mcm9tRnJhbWUgPSBmdW5jdGlvbiBmcm9tRnJhbWUoZnJhbWVJZClcbntcbiAgICB2YXIgdGV4dHVyZSA9IFRleHR1cmUuY2FjaGVbZnJhbWVJZF07XG4gICAgaWYoIXRleHR1cmUpIHRocm93IG5ldyBFcnJvcignVGhlIGZyYW1lSWQgXCInICsgZnJhbWVJZCArICdcIiBkb2VzIG5vdCBleGlzdCBpbiB0aGUgdGV4dHVyZSBjYWNoZSAnICsgdGhpcyk7XG4gICAgcmV0dXJuIHRleHR1cmU7XG59O1xuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSB0ZXh0dXJlIGJhc2VkIG9uIGEgY2FudmFzIGVsZW1lbnRcbiAqIElmIHRoZSBjYW52YXMgaXMgbm90IGluIHRoZSB0ZXh0dXJlIGNhY2hlIGl0IHdpbGwgYmUgIGNyZWF0ZWQgYW5kIGxvYWRlZFxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgZnJvbUNhbnZhc1xuICogQHBhcmFtIGNhbnZhcyB7Q2FudmFzfSBUaGUgY2FudmFzIGVsZW1lbnQgc291cmNlIG9mIHRoZSB0ZXh0dXJlXG4gKiBAcmV0dXJuIFRleHR1cmVcbiAqL1xuVGV4dHVyZS5mcm9tQ2FudmFzID0gZnVuY3Rpb24gZnJvbUNhbnZhcyhjYW52YXMsIHNjYWxlTW9kZSlcbntcbiAgICB2YXIgYmFzZVRleHR1cmUgPSBuZXcgQmFzZVRleHR1cmUoY2FudmFzLCBzY2FsZU1vZGUpO1xuICAgIHJldHVybiBuZXcgVGV4dHVyZShiYXNlVGV4dHVyZSk7XG59O1xuXG5cbi8qKlxuICogQWRkcyBhIHRleHR1cmUgdG8gdGhlIHRleHR1cmVDYWNoZS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGFkZFRleHR1cmVUb0NhY2hlXG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX1cbiAqIEBwYXJhbSBpZCB7U3RyaW5nfSB0aGUgaWQgdGhhdCB0aGUgdGV4dHVyZSB3aWxsIGJlIHN0b3JlZCBhZ2FpbnN0LlxuICovXG5UZXh0dXJlLmFkZFRleHR1cmVUb0NhY2hlID0gZnVuY3Rpb24gYWRkVGV4dHVyZVRvQ2FjaGUodGV4dHVyZSwgaWQpXG57XG4gICAgVGV4dHVyZS5jYWNoZVtpZF0gPSB0ZXh0dXJlO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgYSB0ZXh0dXJlIGZyb20gdGhlIHRleHR1cmVDYWNoZS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHJlbW92ZVRleHR1cmVGcm9tQ2FjaGVcbiAqIEBwYXJhbSBpZCB7U3RyaW5nfSB0aGUgaWQgb2YgdGhlIHRleHR1cmUgdG8gYmUgcmVtb3ZlZFxuICogQHJldHVybiB7VGV4dHVyZX0gdGhlIHRleHR1cmUgdGhhdCB3YXMgcmVtb3ZlZFxuICovXG5UZXh0dXJlLnJlbW92ZVRleHR1cmVGcm9tQ2FjaGUgPSBmdW5jdGlvbiByZW1vdmVUZXh0dXJlRnJvbUNhY2hlKGlkKVxue1xuICAgIHZhciB0ZXh0dXJlID0gVGV4dHVyZS5jYWNoZVtpZF07XG4gICAgVGV4dHVyZS5jYWNoZVtpZF0gPSBudWxsO1xuICAgIHJldHVybiB0ZXh0dXJlO1xufTtcblxuVGV4dHVyZS5jYWNoZSA9IHt9O1xuLy8gdGhpcyBpcyBtb3JlIGZvciB3ZWJHTC4uIGl0IGNvbnRhaW5zIHVwZGF0ZWQgZnJhbWVzLi5cblRleHR1cmUuZnJhbWVVcGRhdGVzID0gW107XG5UZXh0dXJlLlNDQUxFX01PREUgPSBCYXNlVGV4dHVyZS5TQ0FMRV9NT0RFO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRleHR1cmU7XG4iLCIvKlxuICAgIFBvbHlLIGxpYnJhcnlcbiAgICB1cmw6IGh0dHA6Ly9wb2x5ay5pdmFuay5uZXRcbiAgICBSZWxlYXNlZCB1bmRlciBNSVQgbGljZW5jZS5cblxuICAgIENvcHlyaWdodCAoYykgMjAxMiBJdmFuIEt1Y2tpclxuXG4gICAgUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb25cbiAgICBvYnRhaW5pbmcgYSBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvblxuICAgIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dFxuICAgIHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLFxuICAgIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gICAgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlXG4gICAgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmdcbiAgICBjb25kaXRpb25zOlxuXG4gICAgVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmVcbiAgICBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cblxuICAgIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsXG4gICAgRVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTXG4gICAgT0YgTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkRcbiAgICBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVFxuICAgIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLFxuICAgIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lOR1xuICAgIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1JcbiAgICBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbiAgICBUaGlzIGlzIGFuIGFtYXppbmcgbGliIVxuXG4gICAgc2xpZ2h0bHkgbW9kaWZpZWQgYnkgbWF0IGdyb3ZlcyAobWF0Z3JvdmVzLmNvbSk7XG4qL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBhIHBvaW50IGlzIHdpdGhpbiBhIHRyaWFuZ2xlXG4gKlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gcG9pbnRJblRyaWFuZ2xlKHB4LCBweSwgYXgsIGF5LCBieCwgYnksIGN4LCBjeSlcbntcbiAgICB2YXIgdjB4ID0gY3gtYXg7XG4gICAgdmFyIHYweSA9IGN5LWF5O1xuICAgIHZhciB2MXggPSBieC1heDtcbiAgICB2YXIgdjF5ID0gYnktYXk7XG4gICAgdmFyIHYyeCA9IHB4LWF4O1xuICAgIHZhciB2MnkgPSBweS1heTtcblxuICAgIHZhciBkb3QwMCA9IHYweCp2MHgrdjB5KnYweTtcbiAgICB2YXIgZG90MDEgPSB2MHgqdjF4K3YweSp2MXk7XG4gICAgdmFyIGRvdDAyID0gdjB4KnYyeCt2MHkqdjJ5O1xuICAgIHZhciBkb3QxMSA9IHYxeCp2MXgrdjF5KnYxeTtcbiAgICB2YXIgZG90MTIgPSB2MXgqdjJ4K3YxeSp2Mnk7XG5cbiAgICB2YXIgaW52RGVub20gPSAxIC8gKGRvdDAwICogZG90MTEgLSBkb3QwMSAqIGRvdDAxKTtcbiAgICB2YXIgdSA9IChkb3QxMSAqIGRvdDAyIC0gZG90MDEgKiBkb3QxMikgKiBpbnZEZW5vbTtcbiAgICB2YXIgdiA9IChkb3QwMCAqIGRvdDEyIC0gZG90MDEgKiBkb3QwMikgKiBpbnZEZW5vbTtcblxuICAgIC8vIENoZWNrIGlmIHBvaW50IGlzIGluIHRyaWFuZ2xlXG4gICAgcmV0dXJuICh1ID49IDApICYmICh2ID49IDApICYmICh1ICsgdiA8IDEpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBhIHNoYXBlIGlzIGNvbnZleFxuICpcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGNvbnZleChheCwgYXksIGJ4LCBieSwgY3gsIGN5LCBzaWduKVxue1xuICAgIHJldHVybiAoKGF5LWJ5KSooY3gtYngpICsgKGJ4LWF4KSooY3ktYnkpID49IDApID09PSBzaWduO1xufVxuXG4vKipcbiAqIFRyaWFuZ3VsYXRlcyBzaGFwZXMgZm9yIHdlYkdMIGdyYXBoaWMgZmlsbHNcbiAqXG4gKiBAbmFtZXNwYWNlIFBvbHlLXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZXhwb3J0cy50cmlhbmd1bGF0ZSA9IGZ1bmN0aW9uKHApXG57XG4gICAgdmFyIHNpZ24gPSB0cnVlO1xuXG4gICAgdmFyIG4gPSBwLmxlbmd0aCA+PiAxO1xuICAgIGlmKG4gPCAzKSByZXR1cm4gW107XG5cbiAgICB2YXIgdGdzID0gW107XG4gICAgdmFyIGF2bCA9IFtdO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGF2bC5wdXNoKGkpO1xuXG4gICAgaSA9IDA7XG4gICAgdmFyIGFsID0gbjtcbiAgICB3aGlsZShhbCA+IDMpXG4gICAge1xuICAgICAgICB2YXIgaTAgPSBhdmxbKGkrMCklYWxdO1xuICAgICAgICB2YXIgaTEgPSBhdmxbKGkrMSklYWxdO1xuICAgICAgICB2YXIgaTIgPSBhdmxbKGkrMiklYWxdO1xuXG4gICAgICAgIHZhciBheCA9IHBbMippMF0sICBheSA9IHBbMippMCsxXTtcbiAgICAgICAgdmFyIGJ4ID0gcFsyKmkxXSwgIGJ5ID0gcFsyKmkxKzFdO1xuICAgICAgICB2YXIgY3ggPSBwWzIqaTJdLCAgY3kgPSBwWzIqaTIrMV07XG5cbiAgICAgICAgdmFyIGVhckZvdW5kID0gZmFsc2U7XG4gICAgICAgIGlmKGNvbnZleChheCwgYXksIGJ4LCBieSwgY3gsIGN5LCBzaWduKSlcbiAgICAgICAge1xuICAgICAgICAgICAgZWFyRm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgZm9yKHZhciBqID0gMDsgaiA8IGFsOyBqKyspXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmFyIHZpID0gYXZsW2pdO1xuICAgICAgICAgICAgICAgIGlmKHZpID09PSBpMCB8fCB2aSA9PT0gaTEgfHwgdmkgPT09IGkyKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmKHBvaW50SW5UcmlhbmdsZShwWzIqdmldLCBwWzIqdmkrMV0sIGF4LCBheSwgYngsIGJ5LCBjeCwgY3kpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVhckZvdW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGVhckZvdW5kKVxuICAgICAgICB7XG4gICAgICAgICAgICB0Z3MucHVzaChpMCwgaTEsIGkyKTtcbiAgICAgICAgICAgIGF2bC5zcGxpY2UoKGkrMSklYWwsIDEpO1xuICAgICAgICAgICAgYWwtLTtcbiAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoaSsrID4gMyphbClcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gbmVlZCB0byBmbGlwIGZsaXAgcmV2ZXJzZSBpdCFcbiAgICAgICAgICAgIC8vIHJlc2V0IVxuICAgICAgICAgICAgaWYoc2lnbilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0Z3MgPSBbXTtcbiAgICAgICAgICAgICAgICBhdmwgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IoaSA9IDA7IGkgPCBuOyBpKyspIGF2bC5wdXNoKGkpO1xuXG4gICAgICAgICAgICAgICAgaSA9IDA7XG4gICAgICAgICAgICAgICAgYWwgPSBuO1xuXG4gICAgICAgICAgICAgICAgc2lnbiA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHBsYXRmb3JtLmNvbnNvbGUud2FybignUElYSSBXYXJuaW5nOiBzaGFwZSB0b28gY29tcGxleCB0byBmaWxsJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGdzLnB1c2goYXZsWzBdLCBhdmxbMV0sIGF2bFsyXSk7XG4gICAgcmV0dXJuIHRncztcbn07XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwbGF0Zm9ybSA9IHJlcXVpcmUoJy4uL3BsYXRmb3JtJyk7XG52YXIgQ2FudmFzUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlcnMvY2FudmFzL0NhbnZhc1JlbmRlcmVyJyk7XG52YXIgV2ViR0xSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVycy93ZWJnbC9XZWJHTFJlbmRlcmVyJyk7XG5cbi8qKlxuICogVGhpcyBoZWxwZXIgZnVuY3Rpb24gd2lsbCBhdXRvbWF0aWNhbGx5IGRldGVjdCB3aGljaCByZW5kZXJlciB5b3Ugc2hvdWxkIGJlIHVzaW5nLlxuICogV2ViR0wgaXMgdGhlIHByZWZlcnJlZCByZW5kZXJlciBhcyBpdCBpcyBhIGxvdCBmYXN0ZXN0LiBJZiB3ZWJHTCBpcyBub3Qgc3VwcG9ydGVkIGJ5XG4gKiB0aGUgYnJvd3NlciB0aGVuIHRoaXMgZnVuY3Rpb24gd2lsbCByZXR1cm4gYSBjYW52YXMgcmVuZGVyZXJcbiAqXG4gKiBAbWV0aG9kIGF1dG9EZXRlY3RSZW5kZXJlclxuICogQHN0YXRpY1xuICogQHBhcmFtIHdpZHRoIHtOdW1iZXJ9IHRoZSB3aWR0aCBvZiB0aGUgcmVuZGVyZXJzIHZpZXdcbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn0gdGhlIGhlaWdodCBvZiB0aGUgcmVuZGVyZXJzIHZpZXdcbiAqIEBwYXJhbSB2aWV3IHtDYW52YXN9IHRoZSBjYW52YXMgdG8gdXNlIGFzIGEgdmlldywgb3B0aW9uYWxcbiAqIEBwYXJhbSB0cmFuc3BhcmVudD1mYWxzZSB7Qm9vbGVhbn0gdGhlIHRyYW5zcGFyZW5jeSBvZiB0aGUgcmVuZGVyIHZpZXcsIGRlZmF1bHQgZmFsc2VcbiAqIEBwYXJhbSBhbnRpYWxpYXM9ZmFsc2Uge0Jvb2xlYW59IHNldHMgYW50aWFsaWFzIChvbmx5IGFwcGxpY2FibGUgaW4gd2ViR0wgY2hyb21lIGF0IHRoZSBtb21lbnQpXG4gKlxuICogYW50aWFsaWFzXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYXV0b0RldGVjdFJlbmRlcmVyKHdpZHRoLCBoZWlnaHQsIHZpZXcsIHRyYW5zcGFyZW50LCBhbnRpYWxpYXMpXG57XG4gICAgaWYoIXdpZHRoKXdpZHRoID0gODAwO1xuICAgIGlmKCFoZWlnaHQpaGVpZ2h0ID0gNjAwO1xuXG4gICAgLy8gQk9SUk9XRUQgZnJvbSBNciBEb29iIChtcmRvb2IuY29tKVxuICAgIHZhciB3ZWJnbCA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgY2FudmFzID0gcGxhdGZvcm0uY3JlYXRlQ2FudmFzKCk7XG4gICAgICAgICAgICByZXR1cm4gISEgcGxhdGZvcm0ud2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCAmJiAoY2FudmFzLmdldENvbnRleHQoJ3dlYmdsJykgfHwgY2FudmFzLmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcpKTtcbiAgICAgICAgfSBjYXRjaCggZSApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0oKSk7XG5cbiAgICBpZih3ZWJnbCAmJiBwbGF0Zm9ybS5uYXZpZ2F0b3IpXG4gICAge1xuICAgICAgICB2YXIgaWUgPSAgKHBsYXRmb3JtLm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCd0cmlkZW50JykgIT09IC0xKTtcbiAgICAgICAgd2ViZ2wgPSAhaWU7XG4gICAgfVxuXG4gICAgLy9jb25zb2xlLmxvZyh3ZWJnbCk7XG4gICAgaWYoIHdlYmdsIClcbiAgICB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViR0xSZW5kZXJlcih3aWR0aCwgaGVpZ2h0LCB2aWV3LCB0cmFuc3BhcmVudCwgYW50aWFsaWFzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IENhbnZhc1JlbmRlcmVyKHdpZHRoLCBoZWlnaHQsIHZpZXcsIHRyYW5zcGFyZW50KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQ29udmVydHMgYSBoZXggY29sb3IgbnVtYmVyIHRvIGFuIFtSLCBHLCBCXSBhcnJheVxuICpcbiAqIEBwYXJhbSBoZXgge051bWJlcn1cbiAqL1xuZXhwb3J0cy5oZXgycmdiID0gZnVuY3Rpb24gaGV4MnJnYihoZXgpXG57XG4gICAgcmV0dXJuIFsoaGV4ID4+IDE2ICYgMHhGRikgLyAyNTUsICggaGV4ID4+IDggJiAweEZGKSAvIDI1NSwgKGhleCAmIDB4RkYpLyAyNTVdO1xufTtcbiIsIi8qKlxuICogQGF1dGhvciBEci4gS2liaXR6IDxpbmZvQGRya2liaXR6LmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xuXG5mdW5jdGlvbiBsb2dHcm91cChuYW1lKSB7XG4gICAgdmFyIGNvbnNvbGUgPSBwbGF0Zm9ybS5jb25zb2xlO1xuICAgIGlmIChjb25zb2xlLmdyb3VwQ29sbGFwc2VkKSB7XG4gICAgICAgIGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQobmFtZSk7XG4gICAgfSBlbHNlIGlmIChjb25zb2xlLmdyb3VwKSB7XG4gICAgICAgIGNvbnNvbGUuZ3JvdXAobmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2cobmFtZSArICcgPj4+Pj4+Pj4+Jyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBsb2dHcm91cEVuZChuYW1lKSB7XG4gICAgdmFyIGNvbnNvbGUgPSBwbGF0Zm9ybS5jb25zb2xlO1xuICAgIGlmIChjb25zb2xlLmdyb3VwRW5kKSB7XG4gICAgICAgIGNvbnNvbGUuZ3JvdXBFbmQobmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2cobmFtZSArICcgX19fX19fX19fJyk7XG4gICAgfVxufVxuXG5leHBvcnRzLnJ1bkxpc3QgPSBmdW5jdGlvbiBydW5MaXN0KGl0ZW0sIG5hbWUpXG57XG4gICAgdmFyIHNhZmUgPSAwO1xuICAgIHZhciB0bXAgPSBpdGVtLmZpcnN0O1xuXG4gICAgbmFtZSA9ICdwaXhpLnJ1bkxpc3QnICsgKG5hbWUgPyAnKCcgKyBuYW1lICsgJyknIDogJycpO1xuICAgIGxvZ0dyb3VwKG5hbWUpO1xuICAgIHBsYXRmb3JtLmNvbnNvbGUubG9nKHRtcCk7XG5cbiAgICB3aGlsZSh0bXAuX2lOZXh0KVxuICAgIHtcbiAgICAgICAgc2FmZSsrO1xuICAgICAgICB0bXAgPSB0bXAuX2lOZXh0O1xuICAgICAgICBwbGF0Zm9ybS5jb25zb2xlLmxvZyh0bXApO1xuXG4gICAgICAgIGlmKHNhZmUgPiAxMDApXG4gICAgICAgIHtcbiAgICAgICAgICAgIHBsYXRmb3JtLmNvbnNvbGUubG9nKCdCUkVBSycpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgbG9nR3JvdXBFbmQobmFtZSk7XG59O1xuIiwidmFyIGdsb2JhbD10eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge307Ly8gaHR0cDovL3BhdWxpcmlzaC5jb20vMjAxMS9yZXF1ZXN0YW5pbWF0aW9uZnJhbWUtZm9yLXNtYXJ0LWFuaW1hdGluZy9cbi8vIGh0dHA6Ly9teS5vcGVyYS5jb20vZW1vbGxlci9ibG9nLzIwMTEvMTIvMjAvcmVxdWVzdGFuaW1hdGlvbmZyYW1lLWZvci1zbWFydC1lci1hbmltYXRpbmdcblxuLy8gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHBvbHlmaWxsIGJ5IEVyaWsgTcO2bGxlci4gZml4ZXMgZnJvbSBQYXVsIElyaXNoIGFuZCBUaW5vIFppamRlbFxuXG4vLyBNSVQgbGljZW5zZVxubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8qKlxuICAgICAqIEEgcG9seWZpbGwgZm9yIHJlcXVlc3RBbmltYXRpb25GcmFtZVxuICAgICAqXG4gICAgICogQG1ldGhvZCByZXF1ZXN0QW5pbWF0aW9uRnJhbWVcbiAgICAgKi9cbiAgICAvKipcbiAgICAgKiBBIHBvbHlmaWxsIGZvciBjYW5jZWxBbmltYXRpb25GcmFtZVxuICAgICAqXG4gICAgICogQG1ldGhvZCBjYW5jZWxBbmltYXRpb25GcmFtZVxuICAgICAqL1xuICAgIHZhciBsYXN0VGltZSA9IDA7XG4gICAgdmFyIHZlbmRvcnMgPSBbJ21zJywgJ21veicsICd3ZWJraXQnLCAnbyddO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCB2ZW5kb3JzLmxlbmd0aCAmJiAhZ2xvYmFsLnJlcXVlc3RBbmltYXRpb25GcmFtZTsgKytpKSB7XG4gICAgICAgIGdsb2JhbC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBnbG9iYWxbdmVuZG9yc1tpXSArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcbiAgICAgICAgZ2xvYmFsLmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gZ2xvYmFsW3ZlbmRvcnNbaV0gKyAnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXSB8fFxuICAgICAgICAgICAgZ2xvYmFsW3ZlbmRvcnNbaV0gKyAnQ2FuY2VsUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XG4gICAgfVxuXG4gICAgaWYgKCFnbG9iYWwucmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XG4gICAgICAgIGdsb2JhbC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICAgICAgdmFyIGN1cnJUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgICAgICB2YXIgdGltZVRvQ2FsbCA9IE1hdGgubWF4KDAsIDE2IC0gKGN1cnJUaW1lIC0gbGFzdFRpbWUpKTtcbiAgICAgICAgICAgIHZhciBpZCA9IGdsb2JhbC5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBjYWxsYmFjayhjdXJyVGltZSArIHRpbWVUb0NhbGwpOyB9LCB0aW1lVG9DYWxsKTtcbiAgICAgICAgICAgIGxhc3RUaW1lID0gY3VyclRpbWUgKyB0aW1lVG9DYWxsO1xuICAgICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmICghZ2xvYmFsLmNhbmNlbEFuaW1hdGlvbkZyYW1lKSB7XG4gICAgICAgIGdsb2JhbC5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgICBnbG9iYWwuY2xlYXJUaW1lb3V0KGlkKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZ2xvYmFsLnJlcXVlc3RBbmltYXRpb25GcmFtZTtcblxufSgpKTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKiBiYXNlZCBvbiBwaXhpIGltcGFjdCBzcGluZSBpbXBsZW1lbnRhdGlvbiBtYWRlIGJ5IEVlbWVsaSBLZWxva29ycGkgKEBla2Vsb2tvcnBpKSBodHRwczovL2dpdGh1Yi5jb20vZWtlbG9rb3JwaVxuICpcbiAqIEF3ZXNvbWUgSlMgcnVuIHRpbWUgcHJvdmlkZWQgYnkgRXNvdGVyaWNTb2Z0d2FyZVxuICogaHR0cHM6Ly9naXRodWIuY29tL0Vzb3RlcmljU29mdHdhcmUvc3BpbmUtcnVudGltZXNcbiAqXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuLypcbiAqIEF3ZXNvbWUgSlMgcnVuIHRpbWUgcHJvdmlkZWQgYnkgRXNvdGVyaWNTb2Z0d2FyZVxuICpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9Fc290ZXJpY1NvZnR3YXJlL3NwaW5lLXJ1bnRpbWVzXG4gKlxuICovXG5cbnZhciBzcGluZSA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnNwaW5lLkJvbmVEYXRhID0gZnVuY3Rpb24gKG5hbWUsIHBhcmVudCkge1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG59O1xuc3BpbmUuQm9uZURhdGEucHJvdG90eXBlID0ge1xuICAgIGxlbmd0aDogMCxcbiAgICB4OiAwLCB5OiAwLFxuICAgIHJvdGF0aW9uOiAwLFxuICAgIHNjYWxlWDogMSwgc2NhbGVZOiAxXG59O1xuXG5zcGluZS5TbG90RGF0YSA9IGZ1bmN0aW9uIChuYW1lLCBib25lRGF0YSkge1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5ib25lRGF0YSA9IGJvbmVEYXRhO1xufTtcbnNwaW5lLlNsb3REYXRhLnByb3RvdHlwZSA9IHtcbiAgICByOiAxLCBnOiAxLCBiOiAxLCBhOiAxLFxuICAgIGF0dGFjaG1lbnROYW1lOiBudWxsXG59O1xuXG5zcGluZS5Cb25lID0gZnVuY3Rpb24gKGJvbmVEYXRhLCBwYXJlbnQpIHtcbiAgICB0aGlzLmRhdGEgPSBib25lRGF0YTtcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICB0aGlzLnNldFRvU2V0dXBQb3NlKCk7XG59O1xuc3BpbmUuQm9uZS55RG93biA9IGZhbHNlO1xuc3BpbmUuQm9uZS5wcm90b3R5cGUgPSB7XG4gICAgeDogMCwgeTogMCxcbiAgICByb3RhdGlvbjogMCxcbiAgICBzY2FsZVg6IDEsIHNjYWxlWTogMSxcbiAgICBtMDA6IDAsIG0wMTogMCwgd29ybGRYOiAwLCAvLyBhIGIgeFxuICAgIG0xMDogMCwgbTExOiAwLCB3b3JsZFk6IDAsIC8vIGMgZCB5XG4gICAgd29ybGRSb3RhdGlvbjogMCxcbiAgICB3b3JsZFNjYWxlWDogMSwgd29ybGRTY2FsZVk6IDEsXG4gICAgdXBkYXRlV29ybGRUcmFuc2Zvcm06IGZ1bmN0aW9uIChmbGlwWCwgZmxpcFkpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IHRoaXMucGFyZW50O1xuICAgICAgICBpZiAocGFyZW50ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRYID0gdGhpcy54ICogcGFyZW50Lm0wMCArIHRoaXMueSAqIHBhcmVudC5tMDEgKyBwYXJlbnQud29ybGRYO1xuICAgICAgICAgICAgdGhpcy53b3JsZFkgPSB0aGlzLnggKiBwYXJlbnQubTEwICsgdGhpcy55ICogcGFyZW50Lm0xMSArIHBhcmVudC53b3JsZFk7XG4gICAgICAgICAgICB0aGlzLndvcmxkU2NhbGVYID0gcGFyZW50LndvcmxkU2NhbGVYICogdGhpcy5zY2FsZVg7XG4gICAgICAgICAgICB0aGlzLndvcmxkU2NhbGVZID0gcGFyZW50LndvcmxkU2NhbGVZICogdGhpcy5zY2FsZVk7XG4gICAgICAgICAgICB0aGlzLndvcmxkUm90YXRpb24gPSBwYXJlbnQud29ybGRSb3RhdGlvbiArIHRoaXMucm90YXRpb247XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLndvcmxkWCA9IHRoaXMueDtcbiAgICAgICAgICAgIHRoaXMud29ybGRZID0gdGhpcy55O1xuICAgICAgICAgICAgdGhpcy53b3JsZFNjYWxlWCA9IHRoaXMuc2NhbGVYO1xuICAgICAgICAgICAgdGhpcy53b3JsZFNjYWxlWSA9IHRoaXMuc2NhbGVZO1xuICAgICAgICAgICAgdGhpcy53b3JsZFJvdGF0aW9uID0gdGhpcy5yb3RhdGlvbjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmFkaWFucyA9IHRoaXMud29ybGRSb3RhdGlvbiAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIHZhciBjb3MgPSBNYXRoLmNvcyhyYWRpYW5zKTtcbiAgICAgICAgdmFyIHNpbiA9IE1hdGguc2luKHJhZGlhbnMpO1xuICAgICAgICB0aGlzLm0wMCA9IGNvcyAqIHRoaXMud29ybGRTY2FsZVg7XG4gICAgICAgIHRoaXMubTEwID0gc2luICogdGhpcy53b3JsZFNjYWxlWDtcbiAgICAgICAgdGhpcy5tMDEgPSAtc2luICogdGhpcy53b3JsZFNjYWxlWTtcbiAgICAgICAgdGhpcy5tMTEgPSBjb3MgKiB0aGlzLndvcmxkU2NhbGVZO1xuICAgICAgICBpZiAoZmxpcFgpIHtcbiAgICAgICAgICAgIHRoaXMubTAwID0gLXRoaXMubTAwO1xuICAgICAgICAgICAgdGhpcy5tMDEgPSAtdGhpcy5tMDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsaXBZKSB7XG4gICAgICAgICAgICB0aGlzLm0xMCA9IC10aGlzLm0xMDtcbiAgICAgICAgICAgIHRoaXMubTExID0gLXRoaXMubTExO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzcGluZS5Cb25lLnlEb3duKSB7XG4gICAgICAgICAgICB0aGlzLm0xMCA9IC10aGlzLm0xMDtcbiAgICAgICAgICAgIHRoaXMubTExID0gLXRoaXMubTExO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzZXRUb1NldHVwUG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICAgICAgdGhpcy54ID0gZGF0YS54O1xuICAgICAgICB0aGlzLnkgPSBkYXRhLnk7XG4gICAgICAgIHRoaXMucm90YXRpb24gPSBkYXRhLnJvdGF0aW9uO1xuICAgICAgICB0aGlzLnNjYWxlWCA9IGRhdGEuc2NhbGVYO1xuICAgICAgICB0aGlzLnNjYWxlWSA9IGRhdGEuc2NhbGVZO1xuICAgIH1cbn07XG5cbnNwaW5lLlNsb3QgPSBmdW5jdGlvbiAoc2xvdERhdGEsIHNrZWxldG9uLCBib25lKSB7XG4gICAgdGhpcy5kYXRhID0gc2xvdERhdGE7XG4gICAgdGhpcy5za2VsZXRvbiA9IHNrZWxldG9uO1xuICAgIHRoaXMuYm9uZSA9IGJvbmU7XG4gICAgdGhpcy5zZXRUb1NldHVwUG9zZSgpO1xufTtcbnNwaW5lLlNsb3QucHJvdG90eXBlID0ge1xuICAgIHI6IDEsIGc6IDEsIGI6IDEsIGE6IDEsXG4gICAgX2F0dGFjaG1lbnRUaW1lOiAwLFxuICAgIGF0dGFjaG1lbnQ6IG51bGwsXG4gICAgc2V0QXR0YWNobWVudDogZnVuY3Rpb24gKGF0dGFjaG1lbnQpIHtcbiAgICAgICAgdGhpcy5hdHRhY2htZW50ID0gYXR0YWNobWVudDtcbiAgICAgICAgdGhpcy5fYXR0YWNobWVudFRpbWUgPSB0aGlzLnNrZWxldG9uLnRpbWU7XG4gICAgfSxcbiAgICBzZXRBdHRhY2htZW50VGltZTogZnVuY3Rpb24gKHRpbWUpIHtcbiAgICAgICAgdGhpcy5fYXR0YWNobWVudFRpbWUgPSB0aGlzLnNrZWxldG9uLnRpbWUgLSB0aW1lO1xuICAgIH0sXG4gICAgZ2V0QXR0YWNobWVudFRpbWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2tlbGV0b24udGltZSAtIHRoaXMuX2F0dGFjaG1lbnRUaW1lO1xuICAgIH0sXG4gICAgc2V0VG9TZXR1cFBvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGRhdGEgPSB0aGlzLmRhdGE7XG4gICAgICAgIHRoaXMuciA9IGRhdGEucjtcbiAgICAgICAgdGhpcy5nID0gZGF0YS5nO1xuICAgICAgICB0aGlzLmIgPSBkYXRhLmI7XG4gICAgICAgIHRoaXMuYSA9IGRhdGEuYTtcblxuICAgICAgICB2YXIgc2xvdERhdGFzID0gdGhpcy5za2VsZXRvbi5kYXRhLnNsb3RzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNsb3REYXRhcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChzbG90RGF0YXNbaV0gPT0gZGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0QXR0YWNobWVudCghZGF0YS5hdHRhY2htZW50TmFtZSA/IG51bGwgOiB0aGlzLnNrZWxldG9uLmdldEF0dGFjaG1lbnRCeVNsb3RJbmRleChpLCBkYXRhLmF0dGFjaG1lbnROYW1lKSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zcGluZS5Ta2luID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYXR0YWNobWVudHMgPSB7fTtcbn07XG5zcGluZS5Ta2luLnByb3RvdHlwZSA9IHtcbiAgICBhZGRBdHRhY2htZW50OiBmdW5jdGlvbiAoc2xvdEluZGV4LCBuYW1lLCBhdHRhY2htZW50KSB7XG4gICAgICAgIHRoaXMuYXR0YWNobWVudHNbc2xvdEluZGV4ICsgXCI6XCIgKyBuYW1lXSA9IGF0dGFjaG1lbnQ7XG4gICAgfSxcbiAgICBnZXRBdHRhY2htZW50OiBmdW5jdGlvbiAoc2xvdEluZGV4LCBuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmF0dGFjaG1lbnRzW3Nsb3RJbmRleCArIFwiOlwiICsgbmFtZV07XG4gICAgfSxcbiAgICBfYXR0YWNoQWxsOiBmdW5jdGlvbiAoc2tlbGV0b24sIG9sZFNraW4pIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9sZFNraW4uYXR0YWNobWVudHMpIHtcbiAgICAgICAgICAgIHZhciBjb2xvbiA9IGtleS5pbmRleE9mKFwiOlwiKTtcbiAgICAgICAgICAgIHZhciBzbG90SW5kZXggPSBwYXJzZUludChrZXkuc3Vic3RyaW5nKDAsIGNvbG9uKSwgMTApO1xuICAgICAgICAgICAgdmFyIG5hbWUgPSBrZXkuc3Vic3RyaW5nKGNvbG9uICsgMSk7XG4gICAgICAgICAgICB2YXIgc2xvdCA9IHNrZWxldG9uLnNsb3RzW3Nsb3RJbmRleF07XG4gICAgICAgICAgICBpZiAoc2xvdC5hdHRhY2htZW50ICYmIHNsb3QuYXR0YWNobWVudC5uYW1lID09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXR0YWNobWVudCA9IHRoaXMuZ2V0QXR0YWNobWVudChzbG90SW5kZXgsIG5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChhdHRhY2htZW50KSBzbG90LnNldEF0dGFjaG1lbnQoYXR0YWNobWVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zcGluZS5BbmltYXRpb24gPSBmdW5jdGlvbiAobmFtZSwgdGltZWxpbmVzLCBkdXJhdGlvbikge1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy50aW1lbGluZXMgPSB0aW1lbGluZXM7XG4gICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xufTtcbnNwaW5lLkFuaW1hdGlvbi5wcm90b3R5cGUgPSB7XG4gICAgYXBwbHk6IGZ1bmN0aW9uIChza2VsZXRvbiwgdGltZSwgbG9vcCkge1xuICAgICAgICBpZiAobG9vcCAmJiB0aGlzLmR1cmF0aW9uKSB0aW1lICU9IHRoaXMuZHVyYXRpb247XG4gICAgICAgIHZhciB0aW1lbGluZXMgPSB0aGlzLnRpbWVsaW5lcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSB0aW1lbGluZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgdGltZWxpbmVzW2ldLmFwcGx5KHNrZWxldG9uLCB0aW1lLCAxKTtcbiAgICB9LFxuICAgIG1peDogZnVuY3Rpb24gKHNrZWxldG9uLCB0aW1lLCBsb29wLCBhbHBoYSkge1xuICAgICAgICBpZiAobG9vcCAmJiB0aGlzLmR1cmF0aW9uKSB0aW1lICU9IHRoaXMuZHVyYXRpb247XG4gICAgICAgIHZhciB0aW1lbGluZXMgPSB0aGlzLnRpbWVsaW5lcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSB0aW1lbGluZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgdGltZWxpbmVzW2ldLmFwcGx5KHNrZWxldG9uLCB0aW1lLCBhbHBoYSk7XG4gICAgfVxufTtcblxuc3BpbmUuYmluYXJ5U2VhcmNoID0gZnVuY3Rpb24gKHZhbHVlcywgdGFyZ2V0LCBzdGVwKSB7XG4gICAgdmFyIGxvdyA9IDA7XG4gICAgdmFyIGhpZ2ggPSBNYXRoLmZsb29yKHZhbHVlcy5sZW5ndGggLyBzdGVwKSAtIDI7XG4gICAgaWYgKCFoaWdoKSByZXR1cm4gc3RlcDtcbiAgICB2YXIgY3VycmVudCA9IGhpZ2ggPj4+IDE7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgaWYgKHZhbHVlc1soY3VycmVudCArIDEpICogc3RlcF0gPD0gdGFyZ2V0KVxuICAgICAgICAgICAgbG93ID0gY3VycmVudCArIDE7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIGhpZ2ggPSBjdXJyZW50O1xuICAgICAgICBpZiAobG93ID09IGhpZ2gpIHJldHVybiAobG93ICsgMSkgKiBzdGVwO1xuICAgICAgICBjdXJyZW50ID0gKGxvdyArIGhpZ2gpID4+PiAxO1xuICAgIH1cbn07XG5zcGluZS5saW5lYXJTZWFyY2ggPSBmdW5jdGlvbiAodmFsdWVzLCB0YXJnZXQsIHN0ZXApIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbGFzdCA9IHZhbHVlcy5sZW5ndGggLSBzdGVwOyBpIDw9IGxhc3Q7IGkgKz0gc3RlcClcbiAgICAgICAgaWYgKHZhbHVlc1tpXSA+IHRhcmdldCkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xufTtcblxuc3BpbmUuQ3VydmVzID0gZnVuY3Rpb24gKGZyYW1lQ291bnQpIHtcbiAgICB0aGlzLmN1cnZlcyA9IFtdOyAvLyBkZngsIGRmeSwgZGRmeCwgZGRmeSwgZGRkZngsIGRkZGZ5LCAuLi5cbiAgICB0aGlzLmN1cnZlcy5sZW5ndGggPSAoZnJhbWVDb3VudCAtIDEpICogNjtcbn07XG5zcGluZS5DdXJ2ZXMucHJvdG90eXBlID0ge1xuICAgIHNldExpbmVhcjogZnVuY3Rpb24gKGZyYW1lSW5kZXgpIHtcbiAgICAgICAgdGhpcy5jdXJ2ZXNbZnJhbWVJbmRleCAqIDZdID0gMC8qTElORUFSKi87XG4gICAgfSxcbiAgICBzZXRTdGVwcGVkOiBmdW5jdGlvbiAoZnJhbWVJbmRleCkge1xuICAgICAgICB0aGlzLmN1cnZlc1tmcmFtZUluZGV4ICogNl0gPSAtMS8qU1RFUFBFRCovO1xuICAgIH0sXG4gICAgLyoqIFNldHMgdGhlIGNvbnRyb2wgaGFuZGxlIHBvc2l0aW9ucyBmb3IgYW4gaW50ZXJwb2xhdGlvbiBiZXppZXIgY3VydmUgdXNlZCB0byB0cmFuc2l0aW9uIGZyb20gdGhpcyBrZXlmcmFtZSB0byB0aGUgbmV4dC5cbiAgICAgKiBjeDEgYW5kIGN4MiBhcmUgZnJvbSAwIHRvIDEsIHJlcHJlc2VudGluZyB0aGUgcGVyY2VudCBvZiB0aW1lIGJldHdlZW4gdGhlIHR3byBrZXlmcmFtZXMuIGN5MSBhbmQgY3kyIGFyZSB0aGUgcGVyY2VudCBvZlxuICAgICAqIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIGtleWZyYW1lJ3MgdmFsdWVzLiAqL1xuICAgIHNldEN1cnZlOiBmdW5jdGlvbiAoZnJhbWVJbmRleCwgY3gxLCBjeTEsIGN4MiwgY3kyKSB7XG4gICAgICAgIHZhciBzdWJkaXZfc3RlcCA9IDEgLyAxMC8qQkVaSUVSX1NFR01FTlRTKi87XG4gICAgICAgIHZhciBzdWJkaXZfc3RlcDIgPSBzdWJkaXZfc3RlcCAqIHN1YmRpdl9zdGVwO1xuICAgICAgICB2YXIgc3ViZGl2X3N0ZXAzID0gc3ViZGl2X3N0ZXAyICogc3ViZGl2X3N0ZXA7XG4gICAgICAgIHZhciBwcmUxID0gMyAqIHN1YmRpdl9zdGVwO1xuICAgICAgICB2YXIgcHJlMiA9IDMgKiBzdWJkaXZfc3RlcDI7XG4gICAgICAgIHZhciBwcmU0ID0gNiAqIHN1YmRpdl9zdGVwMjtcbiAgICAgICAgdmFyIHByZTUgPSA2ICogc3ViZGl2X3N0ZXAzO1xuICAgICAgICB2YXIgdG1wMXggPSAtY3gxICogMiArIGN4MjtcbiAgICAgICAgdmFyIHRtcDF5ID0gLWN5MSAqIDIgKyBjeTI7XG4gICAgICAgIHZhciB0bXAyeCA9IChjeDEgLSBjeDIpICogMyArIDE7XG4gICAgICAgIHZhciB0bXAyeSA9IChjeTEgLSBjeTIpICogMyArIDE7XG4gICAgICAgIHZhciBpID0gZnJhbWVJbmRleCAqIDY7XG4gICAgICAgIHZhciBjdXJ2ZXMgPSB0aGlzLmN1cnZlcztcbiAgICAgICAgY3VydmVzW2ldID0gY3gxICogcHJlMSArIHRtcDF4ICogcHJlMiArIHRtcDJ4ICogc3ViZGl2X3N0ZXAzO1xuICAgICAgICBjdXJ2ZXNbaSArIDFdID0gY3kxICogcHJlMSArIHRtcDF5ICogcHJlMiArIHRtcDJ5ICogc3ViZGl2X3N0ZXAzO1xuICAgICAgICBjdXJ2ZXNbaSArIDJdID0gdG1wMXggKiBwcmU0ICsgdG1wMnggKiBwcmU1O1xuICAgICAgICBjdXJ2ZXNbaSArIDNdID0gdG1wMXkgKiBwcmU0ICsgdG1wMnkgKiBwcmU1O1xuICAgICAgICBjdXJ2ZXNbaSArIDRdID0gdG1wMnggKiBwcmU1O1xuICAgICAgICBjdXJ2ZXNbaSArIDVdID0gdG1wMnkgKiBwcmU1O1xuICAgIH0sXG4gICAgZ2V0Q3VydmVQZXJjZW50OiBmdW5jdGlvbiAoZnJhbWVJbmRleCwgcGVyY2VudCkge1xuICAgICAgICBwZXJjZW50ID0gcGVyY2VudCA8IDAgPyAwIDogKHBlcmNlbnQgPiAxID8gMSA6IHBlcmNlbnQpO1xuICAgICAgICB2YXIgY3VydmVJbmRleCA9IGZyYW1lSW5kZXggKiA2O1xuICAgICAgICB2YXIgY3VydmVzID0gdGhpcy5jdXJ2ZXM7XG4gICAgICAgIHZhciBkZnggPSBjdXJ2ZXNbY3VydmVJbmRleF07XG4gICAgICAgIGlmICghZGZ4LypMSU5FQVIqLykgcmV0dXJuIHBlcmNlbnQ7XG4gICAgICAgIGlmIChkZnggPT0gLTEvKlNURVBQRUQqLykgcmV0dXJuIDA7XG4gICAgICAgIHZhciBkZnkgPSBjdXJ2ZXNbY3VydmVJbmRleCArIDFdO1xuICAgICAgICB2YXIgZGRmeCA9IGN1cnZlc1tjdXJ2ZUluZGV4ICsgMl07XG4gICAgICAgIHZhciBkZGZ5ID0gY3VydmVzW2N1cnZlSW5kZXggKyAzXTtcbiAgICAgICAgdmFyIGRkZGZ4ID0gY3VydmVzW2N1cnZlSW5kZXggKyA0XTtcbiAgICAgICAgdmFyIGRkZGZ5ID0gY3VydmVzW2N1cnZlSW5kZXggKyA1XTtcbiAgICAgICAgdmFyIHggPSBkZngsIHkgPSBkZnk7XG4gICAgICAgIHZhciBpID0gMTAvKkJFWklFUl9TRUdNRU5UUyovIC0gMjtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGlmICh4ID49IHBlcmNlbnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgbGFzdFggPSB4IC0gZGZ4O1xuICAgICAgICAgICAgICAgIHZhciBsYXN0WSA9IHkgLSBkZnk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxhc3RZICsgKHkgLSBsYXN0WSkgKiAocGVyY2VudCAtIGxhc3RYKSAvICh4IC0gbGFzdFgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFpKSBicmVhaztcbiAgICAgICAgICAgIGktLTtcbiAgICAgICAgICAgIGRmeCArPSBkZGZ4O1xuICAgICAgICAgICAgZGZ5ICs9IGRkZnk7XG4gICAgICAgICAgICBkZGZ4ICs9IGRkZGZ4O1xuICAgICAgICAgICAgZGRmeSArPSBkZGRmeTtcbiAgICAgICAgICAgIHggKz0gZGZ4O1xuICAgICAgICAgICAgeSArPSBkZnk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHkgKyAoMSAtIHkpICogKHBlcmNlbnQgLSB4KSAvICgxIC0geCk7IC8vIExhc3QgcG9pbnQgaXMgMSwxLlxuICAgIH1cbn07XG5cbnNwaW5lLlJvdGF0ZVRpbWVsaW5lID0gZnVuY3Rpb24gKGZyYW1lQ291bnQpIHtcbiAgICB0aGlzLmN1cnZlcyA9IG5ldyBzcGluZS5DdXJ2ZXMoZnJhbWVDb3VudCk7XG4gICAgdGhpcy5mcmFtZXMgPSBbXTsgLy8gdGltZSwgYW5nbGUsIC4uLlxuICAgIHRoaXMuZnJhbWVzLmxlbmd0aCA9IGZyYW1lQ291bnQgKiAyO1xufTtcbnNwaW5lLlJvdGF0ZVRpbWVsaW5lLnByb3RvdHlwZSA9IHtcbiAgICBib25lSW5kZXg6IDAsXG4gICAgZ2V0RnJhbWVDb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcmFtZXMubGVuZ3RoIC8gMjtcbiAgICB9LFxuICAgIHNldEZyYW1lOiBmdW5jdGlvbiAoZnJhbWVJbmRleCwgdGltZSwgYW5nbGUpIHtcbiAgICAgICAgZnJhbWVJbmRleCAqPSAyO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4XSA9IHRpbWU7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyAxXSA9IGFuZ2xlO1xuICAgIH0sXG4gICAgYXBwbHk6IGZ1bmN0aW9uIChza2VsZXRvbiwgdGltZSwgYWxwaGEpIHtcbiAgICAgICAgdmFyIGZyYW1lcyA9IHRoaXMuZnJhbWVzLFxuICAgICAgICAgICAgYW1vdW50O1xuXG4gICAgICAgIGlmICh0aW1lIDwgZnJhbWVzWzBdKSByZXR1cm47IC8vIFRpbWUgaXMgYmVmb3JlIGZpcnN0IGZyYW1lLlxuXG4gICAgICAgIHZhciBib25lID0gc2tlbGV0b24uYm9uZXNbdGhpcy5ib25lSW5kZXhdO1xuXG4gICAgICAgIGlmICh0aW1lID49IGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gMl0pIHsgLy8gVGltZSBpcyBhZnRlciBsYXN0IGZyYW1lLlxuICAgICAgICAgICAgYW1vdW50ID0gYm9uZS5kYXRhLnJvdGF0aW9uICsgZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAxXSAtIGJvbmUucm90YXRpb247XG4gICAgICAgICAgICB3aGlsZSAoYW1vdW50ID4gMTgwKVxuICAgICAgICAgICAgICAgIGFtb3VudCAtPSAzNjA7XG4gICAgICAgICAgICB3aGlsZSAoYW1vdW50IDwgLTE4MClcbiAgICAgICAgICAgICAgICBhbW91bnQgKz0gMzYwO1xuICAgICAgICAgICAgYm9uZS5yb3RhdGlvbiArPSBhbW91bnQgKiBhbHBoYTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEludGVycG9sYXRlIGJldHdlZW4gdGhlIGxhc3QgZnJhbWUgYW5kIHRoZSBjdXJyZW50IGZyYW1lLlxuICAgICAgICB2YXIgZnJhbWVJbmRleCA9IHNwaW5lLmJpbmFyeVNlYXJjaChmcmFtZXMsIHRpbWUsIDIpO1xuICAgICAgICB2YXIgbGFzdEZyYW1lVmFsdWUgPSBmcmFtZXNbZnJhbWVJbmRleCAtIDFdO1xuICAgICAgICB2YXIgZnJhbWVUaW1lID0gZnJhbWVzW2ZyYW1lSW5kZXhdO1xuICAgICAgICB2YXIgcGVyY2VudCA9IDEgLSAodGltZSAtIGZyYW1lVGltZSkgLyAoZnJhbWVzW2ZyYW1lSW5kZXggLSAyLypMQVNUX0ZSQU1FX1RJTUUqL10gLSBmcmFtZVRpbWUpO1xuICAgICAgICBwZXJjZW50ID0gdGhpcy5jdXJ2ZXMuZ2V0Q3VydmVQZXJjZW50KGZyYW1lSW5kZXggLyAyIC0gMSwgcGVyY2VudCk7XG5cbiAgICAgICAgYW1vdW50ID0gZnJhbWVzW2ZyYW1lSW5kZXggKyAxLypGUkFNRV9WQUxVRSovXSAtIGxhc3RGcmFtZVZhbHVlO1xuICAgICAgICB3aGlsZSAoYW1vdW50ID4gMTgwKVxuICAgICAgICAgICAgYW1vdW50IC09IDM2MDtcbiAgICAgICAgd2hpbGUgKGFtb3VudCA8IC0xODApXG4gICAgICAgICAgICBhbW91bnQgKz0gMzYwO1xuICAgICAgICBhbW91bnQgPSBib25lLmRhdGEucm90YXRpb24gKyAobGFzdEZyYW1lVmFsdWUgKyBhbW91bnQgKiBwZXJjZW50KSAtIGJvbmUucm90YXRpb247XG4gICAgICAgIHdoaWxlIChhbW91bnQgPiAxODApXG4gICAgICAgICAgICBhbW91bnQgLT0gMzYwO1xuICAgICAgICB3aGlsZSAoYW1vdW50IDwgLTE4MClcbiAgICAgICAgICAgIGFtb3VudCArPSAzNjA7XG4gICAgICAgIGJvbmUucm90YXRpb24gKz0gYW1vdW50ICogYWxwaGE7XG4gICAgfVxufTtcblxuc3BpbmUuVHJhbnNsYXRlVGltZWxpbmUgPSBmdW5jdGlvbiAoZnJhbWVDb3VudCkge1xuICAgIHRoaXMuY3VydmVzID0gbmV3IHNwaW5lLkN1cnZlcyhmcmFtZUNvdW50KTtcbiAgICB0aGlzLmZyYW1lcyA9IFtdOyAvLyB0aW1lLCB4LCB5LCAuLi5cbiAgICB0aGlzLmZyYW1lcy5sZW5ndGggPSBmcmFtZUNvdW50ICogMztcbn07XG5zcGluZS5UcmFuc2xhdGVUaW1lbGluZS5wcm90b3R5cGUgPSB7XG4gICAgYm9uZUluZGV4OiAwLFxuICAgIGdldEZyYW1lQ291bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnJhbWVzLmxlbmd0aCAvIDM7XG4gICAgfSxcbiAgICBzZXRGcmFtZTogZnVuY3Rpb24gKGZyYW1lSW5kZXgsIHRpbWUsIHgsIHkpIHtcbiAgICAgICAgZnJhbWVJbmRleCAqPSAzO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4XSA9IHRpbWU7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyAxXSA9IHg7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyAyXSA9IHk7XG4gICAgfSxcbiAgICBhcHBseTogZnVuY3Rpb24gKHNrZWxldG9uLCB0aW1lLCBhbHBoYSkge1xuICAgICAgICB2YXIgZnJhbWVzID0gdGhpcy5mcmFtZXM7XG4gICAgICAgIGlmICh0aW1lIDwgZnJhbWVzWzBdKSByZXR1cm47IC8vIFRpbWUgaXMgYmVmb3JlIGZpcnN0IGZyYW1lLlxuXG4gICAgICAgIHZhciBib25lID0gc2tlbGV0b24uYm9uZXNbdGhpcy5ib25lSW5kZXhdO1xuXG4gICAgICAgIGlmICh0aW1lID49IGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gM10pIHsgLy8gVGltZSBpcyBhZnRlciBsYXN0IGZyYW1lLlxuICAgICAgICAgICAgYm9uZS54ICs9IChib25lLmRhdGEueCArIGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gMl0gLSBib25lLngpICogYWxwaGE7XG4gICAgICAgICAgICBib25lLnkgKz0gKGJvbmUuZGF0YS55ICsgZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAxXSAtIGJvbmUueSkgKiBhbHBoYTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEludGVycG9sYXRlIGJldHdlZW4gdGhlIGxhc3QgZnJhbWUgYW5kIHRoZSBjdXJyZW50IGZyYW1lLlxuICAgICAgICB2YXIgZnJhbWVJbmRleCA9IHNwaW5lLmJpbmFyeVNlYXJjaChmcmFtZXMsIHRpbWUsIDMpO1xuICAgICAgICB2YXIgbGFzdEZyYW1lWCA9IGZyYW1lc1tmcmFtZUluZGV4IC0gMl07XG4gICAgICAgIHZhciBsYXN0RnJhbWVZID0gZnJhbWVzW2ZyYW1lSW5kZXggLSAxXTtcbiAgICAgICAgdmFyIGZyYW1lVGltZSA9IGZyYW1lc1tmcmFtZUluZGV4XTtcbiAgICAgICAgdmFyIHBlcmNlbnQgPSAxIC0gKHRpbWUgLSBmcmFtZVRpbWUpIC8gKGZyYW1lc1tmcmFtZUluZGV4ICsgLTMvKkxBU1RfRlJBTUVfVElNRSovXSAtIGZyYW1lVGltZSk7XG4gICAgICAgIHBlcmNlbnQgPSB0aGlzLmN1cnZlcy5nZXRDdXJ2ZVBlcmNlbnQoZnJhbWVJbmRleCAvIDMgLSAxLCBwZXJjZW50KTtcblxuICAgICAgICBib25lLnggKz0gKGJvbmUuZGF0YS54ICsgbGFzdEZyYW1lWCArIChmcmFtZXNbZnJhbWVJbmRleCArIDEvKkZSQU1FX1gqL10gLSBsYXN0RnJhbWVYKSAqIHBlcmNlbnQgLSBib25lLngpICogYWxwaGE7XG4gICAgICAgIGJvbmUueSArPSAoYm9uZS5kYXRhLnkgKyBsYXN0RnJhbWVZICsgKGZyYW1lc1tmcmFtZUluZGV4ICsgMi8qRlJBTUVfWSovXSAtIGxhc3RGcmFtZVkpICogcGVyY2VudCAtIGJvbmUueSkgKiBhbHBoYTtcbiAgICB9XG59O1xuXG5zcGluZS5TY2FsZVRpbWVsaW5lID0gZnVuY3Rpb24gKGZyYW1lQ291bnQpIHtcbiAgICB0aGlzLmN1cnZlcyA9IG5ldyBzcGluZS5DdXJ2ZXMoZnJhbWVDb3VudCk7XG4gICAgdGhpcy5mcmFtZXMgPSBbXTsgLy8gdGltZSwgeCwgeSwgLi4uXG4gICAgdGhpcy5mcmFtZXMubGVuZ3RoID0gZnJhbWVDb3VudCAqIDM7XG59O1xuc3BpbmUuU2NhbGVUaW1lbGluZS5wcm90b3R5cGUgPSB7XG4gICAgYm9uZUluZGV4OiAwLFxuICAgIGdldEZyYW1lQ291bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnJhbWVzLmxlbmd0aCAvIDM7XG4gICAgfSxcbiAgICBzZXRGcmFtZTogZnVuY3Rpb24gKGZyYW1lSW5kZXgsIHRpbWUsIHgsIHkpIHtcbiAgICAgICAgZnJhbWVJbmRleCAqPSAzO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4XSA9IHRpbWU7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyAxXSA9IHg7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyAyXSA9IHk7XG4gICAgfSxcbiAgICBhcHBseTogZnVuY3Rpb24gKHNrZWxldG9uLCB0aW1lLCBhbHBoYSkge1xuICAgICAgICB2YXIgZnJhbWVzID0gdGhpcy5mcmFtZXM7XG4gICAgICAgIGlmICh0aW1lIDwgZnJhbWVzWzBdKSByZXR1cm47IC8vIFRpbWUgaXMgYmVmb3JlIGZpcnN0IGZyYW1lLlxuXG4gICAgICAgIHZhciBib25lID0gc2tlbGV0b24uYm9uZXNbdGhpcy5ib25lSW5kZXhdO1xuXG4gICAgICAgIGlmICh0aW1lID49IGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gM10pIHsgLy8gVGltZSBpcyBhZnRlciBsYXN0IGZyYW1lLlxuICAgICAgICAgICAgYm9uZS5zY2FsZVggKz0gKGJvbmUuZGF0YS5zY2FsZVggLSAxICsgZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAyXSAtIGJvbmUuc2NhbGVYKSAqIGFscGhhO1xuICAgICAgICAgICAgYm9uZS5zY2FsZVkgKz0gKGJvbmUuZGF0YS5zY2FsZVkgLSAxICsgZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAxXSAtIGJvbmUuc2NhbGVZKSAqIGFscGhhO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW50ZXJwb2xhdGUgYmV0d2VlbiB0aGUgbGFzdCBmcmFtZSBhbmQgdGhlIGN1cnJlbnQgZnJhbWUuXG4gICAgICAgIHZhciBmcmFtZUluZGV4ID0gc3BpbmUuYmluYXJ5U2VhcmNoKGZyYW1lcywgdGltZSwgMyk7XG4gICAgICAgIHZhciBsYXN0RnJhbWVYID0gZnJhbWVzW2ZyYW1lSW5kZXggLSAyXTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZVkgPSBmcmFtZXNbZnJhbWVJbmRleCAtIDFdO1xuICAgICAgICB2YXIgZnJhbWVUaW1lID0gZnJhbWVzW2ZyYW1lSW5kZXhdO1xuICAgICAgICB2YXIgcGVyY2VudCA9IDEgLSAodGltZSAtIGZyYW1lVGltZSkgLyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAtMy8qTEFTVF9GUkFNRV9USU1FKi9dIC0gZnJhbWVUaW1lKTtcbiAgICAgICAgcGVyY2VudCA9IHRoaXMuY3VydmVzLmdldEN1cnZlUGVyY2VudChmcmFtZUluZGV4IC8gMyAtIDEsIHBlcmNlbnQpO1xuXG4gICAgICAgIGJvbmUuc2NhbGVYICs9IChib25lLmRhdGEuc2NhbGVYIC0gMSArIGxhc3RGcmFtZVggKyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAxLypGUkFNRV9YKi9dIC0gbGFzdEZyYW1lWCkgKiBwZXJjZW50IC0gYm9uZS5zY2FsZVgpICogYWxwaGE7XG4gICAgICAgIGJvbmUuc2NhbGVZICs9IChib25lLmRhdGEuc2NhbGVZIC0gMSArIGxhc3RGcmFtZVkgKyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAyLypGUkFNRV9ZKi9dIC0gbGFzdEZyYW1lWSkgKiBwZXJjZW50IC0gYm9uZS5zY2FsZVkpICogYWxwaGE7XG4gICAgfVxufTtcblxuc3BpbmUuQ29sb3JUaW1lbGluZSA9IGZ1bmN0aW9uIChmcmFtZUNvdW50KSB7XG4gICAgdGhpcy5jdXJ2ZXMgPSBuZXcgc3BpbmUuQ3VydmVzKGZyYW1lQ291bnQpO1xuICAgIHRoaXMuZnJhbWVzID0gW107IC8vIHRpbWUsIHIsIGcsIGIsIGEsIC4uLlxuICAgIHRoaXMuZnJhbWVzLmxlbmd0aCA9IGZyYW1lQ291bnQgKiA1O1xufTtcbnNwaW5lLkNvbG9yVGltZWxpbmUucHJvdG90eXBlID0ge1xuICAgIHNsb3RJbmRleDogMCxcbiAgICBnZXRGcmFtZUNvdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZyYW1lcy5sZW5ndGggLyAyO1xuICAgIH0sXG4gICAgc2V0RnJhbWU6IGZ1bmN0aW9uIChmcmFtZUluZGV4LCB0aW1lLCByLCBnLCBiLCBhKSB7XG4gICAgICAgIGZyYW1lSW5kZXggKj0gNTtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleF0gPSB0aW1lO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgMV0gPSByO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgMl0gPSBnO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgM10gPSBiO1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4ICsgNF0gPSBhO1xuICAgIH0sXG4gICAgYXBwbHk6IGZ1bmN0aW9uIChza2VsZXRvbiwgdGltZSwgYWxwaGEpIHtcbiAgICAgICAgdmFyIGZyYW1lcyA9IHRoaXMuZnJhbWVzO1xuICAgICAgICBpZiAodGltZSA8IGZyYW1lc1swXSkgcmV0dXJuOyAvLyBUaW1lIGlzIGJlZm9yZSBmaXJzdCBmcmFtZS5cblxuICAgICAgICB2YXIgc2xvdCA9IHNrZWxldG9uLnNsb3RzW3RoaXMuc2xvdEluZGV4XTtcblxuICAgICAgICBpZiAodGltZSA+PSBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDVdKSB7IC8vIFRpbWUgaXMgYWZ0ZXIgbGFzdCBmcmFtZS5cbiAgICAgICAgICAgIHZhciBpID0gZnJhbWVzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICBzbG90LnIgPSBmcmFtZXNbaSAtIDNdO1xuICAgICAgICAgICAgc2xvdC5nID0gZnJhbWVzW2kgLSAyXTtcbiAgICAgICAgICAgIHNsb3QuYiA9IGZyYW1lc1tpIC0gMV07XG4gICAgICAgICAgICBzbG90LmEgPSBmcmFtZXNbaV07XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbnRlcnBvbGF0ZSBiZXR3ZWVuIHRoZSBsYXN0IGZyYW1lIGFuZCB0aGUgY3VycmVudCBmcmFtZS5cbiAgICAgICAgdmFyIGZyYW1lSW5kZXggPSBzcGluZS5iaW5hcnlTZWFyY2goZnJhbWVzLCB0aW1lLCA1KTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZVIgPSBmcmFtZXNbZnJhbWVJbmRleCAtIDRdO1xuICAgICAgICB2YXIgbGFzdEZyYW1lRyA9IGZyYW1lc1tmcmFtZUluZGV4IC0gM107XG4gICAgICAgIHZhciBsYXN0RnJhbWVCID0gZnJhbWVzW2ZyYW1lSW5kZXggLSAyXTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZUEgPSBmcmFtZXNbZnJhbWVJbmRleCAtIDFdO1xuICAgICAgICB2YXIgZnJhbWVUaW1lID0gZnJhbWVzW2ZyYW1lSW5kZXhdO1xuICAgICAgICB2YXIgcGVyY2VudCA9IDEgLSAodGltZSAtIGZyYW1lVGltZSkgLyAoZnJhbWVzW2ZyYW1lSW5kZXggLSA1LypMQVNUX0ZSQU1FX1RJTUUqL10gLSBmcmFtZVRpbWUpO1xuICAgICAgICBwZXJjZW50ID0gdGhpcy5jdXJ2ZXMuZ2V0Q3VydmVQZXJjZW50KGZyYW1lSW5kZXggLyA1IC0gMSwgcGVyY2VudCk7XG5cbiAgICAgICAgdmFyIHIgPSBsYXN0RnJhbWVSICsgKGZyYW1lc1tmcmFtZUluZGV4ICsgMS8qRlJBTUVfUiovXSAtIGxhc3RGcmFtZVIpICogcGVyY2VudDtcbiAgICAgICAgdmFyIGcgPSBsYXN0RnJhbWVHICsgKGZyYW1lc1tmcmFtZUluZGV4ICsgMi8qRlJBTUVfRyovXSAtIGxhc3RGcmFtZUcpICogcGVyY2VudDtcbiAgICAgICAgdmFyIGIgPSBsYXN0RnJhbWVCICsgKGZyYW1lc1tmcmFtZUluZGV4ICsgMy8qRlJBTUVfQiovXSAtIGxhc3RGcmFtZUIpICogcGVyY2VudDtcbiAgICAgICAgdmFyIGEgPSBsYXN0RnJhbWVBICsgKGZyYW1lc1tmcmFtZUluZGV4ICsgNC8qRlJBTUVfQSovXSAtIGxhc3RGcmFtZUEpICogcGVyY2VudDtcbiAgICAgICAgaWYgKGFscGhhIDwgMSkge1xuICAgICAgICAgICAgc2xvdC5yICs9IChyIC0gc2xvdC5yKSAqIGFscGhhO1xuICAgICAgICAgICAgc2xvdC5nICs9IChnIC0gc2xvdC5nKSAqIGFscGhhO1xuICAgICAgICAgICAgc2xvdC5iICs9IChiIC0gc2xvdC5iKSAqIGFscGhhO1xuICAgICAgICAgICAgc2xvdC5hICs9IChhIC0gc2xvdC5hKSAqIGFscGhhO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2xvdC5yID0gcjtcbiAgICAgICAgICAgIHNsb3QuZyA9IGc7XG4gICAgICAgICAgICBzbG90LmIgPSBiO1xuICAgICAgICAgICAgc2xvdC5hID0gYTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnNwaW5lLkF0dGFjaG1lbnRUaW1lbGluZSA9IGZ1bmN0aW9uIChmcmFtZUNvdW50KSB7XG4gICAgdGhpcy5jdXJ2ZXMgPSBuZXcgc3BpbmUuQ3VydmVzKGZyYW1lQ291bnQpO1xuICAgIHRoaXMuZnJhbWVzID0gW107IC8vIHRpbWUsIC4uLlxuICAgIHRoaXMuZnJhbWVzLmxlbmd0aCA9IGZyYW1lQ291bnQ7XG4gICAgdGhpcy5hdHRhY2htZW50TmFtZXMgPSBbXTsgLy8gdGltZSwgLi4uXG4gICAgdGhpcy5hdHRhY2htZW50TmFtZXMubGVuZ3RoID0gZnJhbWVDb3VudDtcbn07XG5zcGluZS5BdHRhY2htZW50VGltZWxpbmUucHJvdG90eXBlID0ge1xuICAgIHNsb3RJbmRleDogMCxcbiAgICBnZXRGcmFtZUNvdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mcmFtZXMubGVuZ3RoO1xuICAgIH0sXG4gICAgc2V0RnJhbWU6IGZ1bmN0aW9uIChmcmFtZUluZGV4LCB0aW1lLCBhdHRhY2htZW50TmFtZSkge1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4XSA9IHRpbWU7XG4gICAgICAgIHRoaXMuYXR0YWNobWVudE5hbWVzW2ZyYW1lSW5kZXhdID0gYXR0YWNobWVudE5hbWU7XG4gICAgfSxcbiAgICBhcHBseTogZnVuY3Rpb24gKHNrZWxldG9uLCB0aW1lLCBhbHBoYSkge1xuICAgICAgICB2YXIgZnJhbWVzID0gdGhpcy5mcmFtZXM7XG4gICAgICAgIGlmICh0aW1lIDwgZnJhbWVzWzBdKSByZXR1cm47IC8vIFRpbWUgaXMgYmVmb3JlIGZpcnN0IGZyYW1lLlxuXG4gICAgICAgIHZhciBmcmFtZUluZGV4O1xuICAgICAgICBpZiAodGltZSA+PSBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDFdKSAvLyBUaW1lIGlzIGFmdGVyIGxhc3QgZnJhbWUuXG4gICAgICAgICAgICBmcmFtZUluZGV4ID0gZnJhbWVzLmxlbmd0aCAtIDE7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIGZyYW1lSW5kZXggPSBzcGluZS5iaW5hcnlTZWFyY2goZnJhbWVzLCB0aW1lLCAxKSAtIDE7XG5cbiAgICAgICAgdmFyIGF0dGFjaG1lbnROYW1lID0gdGhpcy5hdHRhY2htZW50TmFtZXNbZnJhbWVJbmRleF07XG4gICAgICAgIHNrZWxldG9uLnNsb3RzW3RoaXMuc2xvdEluZGV4XS5zZXRBdHRhY2htZW50KCFhdHRhY2htZW50TmFtZSA/IG51bGwgOiBza2VsZXRvbi5nZXRBdHRhY2htZW50QnlTbG90SW5kZXgodGhpcy5zbG90SW5kZXgsIGF0dGFjaG1lbnROYW1lKSk7XG4gICAgfVxufTtcblxuc3BpbmUuU2tlbGV0b25EYXRhID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuYm9uZXMgPSBbXTtcbiAgICB0aGlzLnNsb3RzID0gW107XG4gICAgdGhpcy5za2lucyA9IFtdO1xuICAgIHRoaXMuYW5pbWF0aW9ucyA9IFtdO1xufTtcbnNwaW5lLlNrZWxldG9uRGF0YS5wcm90b3R5cGUgPSB7XG4gICAgZGVmYXVsdFNraW46IG51bGwsXG4gICAgLyoqIEByZXR1cm4gTWF5IGJlIG51bGwuICovXG4gICAgZmluZEJvbmU6IGZ1bmN0aW9uIChib25lTmFtZSkge1xuICAgICAgICB2YXIgYm9uZXMgPSB0aGlzLmJvbmVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGJvbmVzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChib25lc1tpXS5uYW1lID09IGJvbmVOYW1lKSByZXR1cm4gYm9uZXNbaV07XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gLTEgaWYgdGhlIGJvbmUgd2FzIG5vdCBmb3VuZC4gKi9cbiAgICBmaW5kQm9uZUluZGV4OiBmdW5jdGlvbiAoYm9uZU5hbWUpIHtcbiAgICAgICAgdmFyIGJvbmVzID0gdGhpcy5ib25lcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBib25lcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoYm9uZXNbaV0ubmFtZSA9PSBib25lTmFtZSkgcmV0dXJuIGk7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIE1heSBiZSBudWxsLiAqL1xuICAgIGZpbmRTbG90OiBmdW5jdGlvbiAoc2xvdE5hbWUpIHtcbiAgICAgICAgdmFyIHNsb3RzID0gdGhpcy5zbG90cztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBzbG90cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChzbG90c1tpXS5uYW1lID09IHNsb3ROYW1lKSByZXR1cm4gc2xvdHNbaV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiAtMSBpZiB0aGUgYm9uZSB3YXMgbm90IGZvdW5kLiAqL1xuICAgIGZpbmRTbG90SW5kZXg6IGZ1bmN0aW9uIChzbG90TmFtZSkge1xuICAgICAgICB2YXIgc2xvdHMgPSB0aGlzLnNsb3RzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNsb3RzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChzbG90c1tpXS5uYW1lID09IHNsb3ROYW1lKSByZXR1cm4gaTtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gTWF5IGJlIG51bGwuICovXG4gICAgZmluZFNraW46IGZ1bmN0aW9uIChza2luTmFtZSkge1xuICAgICAgICB2YXIgc2tpbnMgPSB0aGlzLnNraW5zO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNraW5zLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChza2luc1tpXS5uYW1lID09IHNraW5OYW1lKSByZXR1cm4gc2tpbnNbaV07XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gTWF5IGJlIG51bGwuICovXG4gICAgZmluZEFuaW1hdGlvbjogZnVuY3Rpb24gKGFuaW1hdGlvbk5hbWUpIHtcbiAgICAgICAgdmFyIGFuaW1hdGlvbnMgPSB0aGlzLmFuaW1hdGlvbnM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYW5pbWF0aW9ucy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoYW5pbWF0aW9uc1tpXS5uYW1lID09IGFuaW1hdGlvbk5hbWUpIHJldHVybiBhbmltYXRpb25zW2ldO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG5zcGluZS5Ta2VsZXRvbiA9IGZ1bmN0aW9uIChza2VsZXRvbkRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBza2VsZXRvbkRhdGE7XG5cbiAgICB0aGlzLmJvbmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDAsIG4gPSBza2VsZXRvbkRhdGEuYm9uZXMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgIHZhciBib25lRGF0YSA9IHNrZWxldG9uRGF0YS5ib25lc1tpXTtcbiAgICAgICAgdmFyIHBhcmVudCA9ICFib25lRGF0YS5wYXJlbnQgPyBudWxsIDogdGhpcy5ib25lc1tza2VsZXRvbkRhdGEuYm9uZXMuaW5kZXhPZihib25lRGF0YS5wYXJlbnQpXTtcbiAgICAgICAgdGhpcy5ib25lcy5wdXNoKG5ldyBzcGluZS5Cb25lKGJvbmVEYXRhLCBwYXJlbnQpKTtcbiAgICB9XG5cbiAgICB0aGlzLnNsb3RzID0gW107XG4gICAgdGhpcy5kcmF3T3JkZXIgPSBbXTtcbiAgICBmb3IgKGkgPSAwLCBuID0gc2tlbGV0b25EYXRhLnNsb3RzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICB2YXIgc2xvdERhdGEgPSBza2VsZXRvbkRhdGEuc2xvdHNbaV07XG4gICAgICAgIHZhciBib25lID0gdGhpcy5ib25lc1tza2VsZXRvbkRhdGEuYm9uZXMuaW5kZXhPZihzbG90RGF0YS5ib25lRGF0YSldO1xuICAgICAgICB2YXIgc2xvdCA9IG5ldyBzcGluZS5TbG90KHNsb3REYXRhLCB0aGlzLCBib25lKTtcbiAgICAgICAgdGhpcy5zbG90cy5wdXNoKHNsb3QpO1xuICAgICAgICB0aGlzLmRyYXdPcmRlci5wdXNoKHNsb3QpO1xuICAgIH1cbn07XG5zcGluZS5Ta2VsZXRvbi5wcm90b3R5cGUgPSB7XG4gICAgeDogMCwgeTogMCxcbiAgICBza2luOiBudWxsLFxuICAgIHI6IDEsIGc6IDEsIGI6IDEsIGE6IDEsXG4gICAgdGltZTogMCxcbiAgICBmbGlwWDogZmFsc2UsIGZsaXBZOiBmYWxzZSxcbiAgICAvKiogVXBkYXRlcyB0aGUgd29ybGQgdHJhbnNmb3JtIGZvciBlYWNoIGJvbmUuICovXG4gICAgdXBkYXRlV29ybGRUcmFuc2Zvcm06IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsaXBYID0gdGhpcy5mbGlwWDtcbiAgICAgICAgdmFyIGZsaXBZID0gdGhpcy5mbGlwWTtcbiAgICAgICAgdmFyIGJvbmVzID0gdGhpcy5ib25lcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBib25lcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBib25lc1tpXS51cGRhdGVXb3JsZFRyYW5zZm9ybShmbGlwWCwgZmxpcFkpO1xuICAgIH0sXG4gICAgLyoqIFNldHMgdGhlIGJvbmVzIGFuZCBzbG90cyB0byB0aGVpciBzZXR1cCBwb3NlIHZhbHVlcy4gKi9cbiAgICBzZXRUb1NldHVwUG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldEJvbmVzVG9TZXR1cFBvc2UoKTtcbiAgICAgICAgdGhpcy5zZXRTbG90c1RvU2V0dXBQb3NlKCk7XG4gICAgfSxcbiAgICBzZXRCb25lc1RvU2V0dXBQb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBib25lcyA9IHRoaXMuYm9uZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYm9uZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgYm9uZXNbaV0uc2V0VG9TZXR1cFBvc2UoKTtcbiAgICB9LFxuICAgIHNldFNsb3RzVG9TZXR1cFBvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNsb3RzID0gdGhpcy5zbG90cztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBzbG90cy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBzbG90c1tpXS5zZXRUb1NldHVwUG9zZShpKTtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIE1heSByZXR1cm4gbnVsbC4gKi9cbiAgICBnZXRSb290Qm9uZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ib25lcy5sZW5ndGggPyB0aGlzLmJvbmVzWzBdIDogbnVsbDtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIE1heSBiZSBudWxsLiAqL1xuICAgIGZpbmRCb25lOiBmdW5jdGlvbiAoYm9uZU5hbWUpIHtcbiAgICAgICAgdmFyIGJvbmVzID0gdGhpcy5ib25lcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBib25lcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoYm9uZXNbaV0uZGF0YS5uYW1lID09IGJvbmVOYW1lKSByZXR1cm4gYm9uZXNbaV07XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gLTEgaWYgdGhlIGJvbmUgd2FzIG5vdCBmb3VuZC4gKi9cbiAgICBmaW5kQm9uZUluZGV4OiBmdW5jdGlvbiAoYm9uZU5hbWUpIHtcbiAgICAgICAgdmFyIGJvbmVzID0gdGhpcy5ib25lcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBib25lcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAoYm9uZXNbaV0uZGF0YS5uYW1lID09IGJvbmVOYW1lKSByZXR1cm4gaTtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gTWF5IGJlIG51bGwuICovXG4gICAgZmluZFNsb3Q6IGZ1bmN0aW9uIChzbG90TmFtZSkge1xuICAgICAgICB2YXIgc2xvdHMgPSB0aGlzLnNsb3RzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNsb3RzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChzbG90c1tpXS5kYXRhLm5hbWUgPT0gc2xvdE5hbWUpIHJldHVybiBzbG90c1tpXTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiAtMSBpZiB0aGUgYm9uZSB3YXMgbm90IGZvdW5kLiAqL1xuICAgIGZpbmRTbG90SW5kZXg6IGZ1bmN0aW9uIChzbG90TmFtZSkge1xuICAgICAgICB2YXIgc2xvdHMgPSB0aGlzLnNsb3RzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNsb3RzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChzbG90c1tpXS5kYXRhLm5hbWUgPT0gc2xvdE5hbWUpIHJldHVybiBpO1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgfSxcbiAgICBzZXRTa2luQnlOYW1lOiBmdW5jdGlvbiAoc2tpbk5hbWUpIHtcbiAgICAgICAgdmFyIHNraW4gPSB0aGlzLmRhdGEuZmluZFNraW4oc2tpbk5hbWUpO1xuICAgICAgICBpZiAoIXNraW4pIHRocm93IFwiU2tpbiBub3QgZm91bmQ6IFwiICsgc2tpbk5hbWU7XG4gICAgICAgIHRoaXMuc2V0U2tpbihza2luKTtcbiAgICB9LFxuICAgIC8qKiBTZXRzIHRoZSBza2luIHVzZWQgdG8gbG9vayB1cCBhdHRhY2htZW50cyBub3QgZm91bmQgaW4gdGhlIHtAbGluayBTa2VsZXRvbkRhdGEjZ2V0RGVmYXVsdFNraW4oKSBkZWZhdWx0IHNraW59LiBBdHRhY2htZW50c1xuICAgICAqIGZyb20gdGhlIG5ldyBza2luIGFyZSBhdHRhY2hlZCBpZiB0aGUgY29ycmVzcG9uZGluZyBhdHRhY2htZW50IGZyb20gdGhlIG9sZCBza2luIHdhcyBhdHRhY2hlZC5cbiAgICAgKiBAcGFyYW0gbmV3U2tpbiBNYXkgYmUgbnVsbC4gKi9cbiAgICBzZXRTa2luOiBmdW5jdGlvbiAobmV3U2tpbikge1xuICAgICAgICBpZiAodGhpcy5za2luICYmIG5ld1NraW4pIG5ld1NraW4uX2F0dGFjaEFsbCh0aGlzLCB0aGlzLnNraW4pO1xuICAgICAgICB0aGlzLnNraW4gPSBuZXdTa2luO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gTWF5IGJlIG51bGwuICovXG4gICAgZ2V0QXR0YWNobWVudEJ5U2xvdE5hbWU6IGZ1bmN0aW9uIChzbG90TmFtZSwgYXR0YWNobWVudE5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QXR0YWNobWVudEJ5U2xvdEluZGV4KHRoaXMuZGF0YS5maW5kU2xvdEluZGV4KHNsb3ROYW1lKSwgYXR0YWNobWVudE5hbWUpO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gTWF5IGJlIG51bGwuICovXG4gICAgZ2V0QXR0YWNobWVudEJ5U2xvdEluZGV4OiBmdW5jdGlvbiAoc2xvdEluZGV4LCBhdHRhY2htZW50TmFtZSkge1xuICAgICAgICBpZiAodGhpcy5za2luKSB7XG4gICAgICAgICAgICB2YXIgYXR0YWNobWVudCA9IHRoaXMuc2tpbi5nZXRBdHRhY2htZW50KHNsb3RJbmRleCwgYXR0YWNobWVudE5hbWUpO1xuICAgICAgICAgICAgaWYgKGF0dGFjaG1lbnQpIHJldHVybiBhdHRhY2htZW50O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmRhdGEuZGVmYXVsdFNraW4pIHJldHVybiB0aGlzLmRhdGEuZGVmYXVsdFNraW4uZ2V0QXR0YWNobWVudChzbG90SW5kZXgsIGF0dGFjaG1lbnROYW1lKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICAvKiogQHBhcmFtIGF0dGFjaG1lbnROYW1lIE1heSBiZSBudWxsLiAqL1xuICAgIHNldEF0dGFjaG1lbnQ6IGZ1bmN0aW9uIChzbG90TmFtZSwgYXR0YWNobWVudE5hbWUpIHtcbiAgICAgICAgdmFyIHNsb3RzID0gdGhpcy5zbG90cztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBzbG90cy5zaXplOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgc2xvdCA9IHNsb3RzW2ldO1xuICAgICAgICAgICAgaWYgKHNsb3QuZGF0YS5uYW1lID09IHNsb3ROYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIGF0dGFjaG1lbnQgPSBudWxsO1xuICAgICAgICAgICAgICAgIGlmIChhdHRhY2htZW50TmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50ID0gdGhpcy5nZXRBdHRhY2htZW50KGksIGF0dGFjaG1lbnROYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dGFjaG1lbnQgPT0gbnVsbCkgdGhyb3cgXCJBdHRhY2htZW50IG5vdCBmb3VuZDogXCIgKyBhdHRhY2htZW50TmFtZSArIFwiLCBmb3Igc2xvdDogXCIgKyBzbG90TmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2xvdC5zZXRBdHRhY2htZW50KGF0dGFjaG1lbnQpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBcIlNsb3Qgbm90IGZvdW5kOiBcIiArIHNsb3ROYW1lO1xuICAgIH0sXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGVsdGEpIHtcbiAgICAgICAgdGhpcy50aW1lICs9IGRlbHRhO1xuICAgIH1cbn07XG5cbnNwaW5lLkF0dGFjaG1lbnRUeXBlID0ge1xuICAgIHJlZ2lvbjogMFxufTtcblxuc3BpbmUuUmVnaW9uQXR0YWNobWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLm9mZnNldCA9IFtdO1xuICAgIHRoaXMub2Zmc2V0Lmxlbmd0aCA9IDg7XG4gICAgdGhpcy51dnMgPSBbXTtcbiAgICB0aGlzLnV2cy5sZW5ndGggPSA4O1xufTtcbnNwaW5lLlJlZ2lvbkF0dGFjaG1lbnQucHJvdG90eXBlID0ge1xuICAgIHg6IDAsIHk6IDAsXG4gICAgcm90YXRpb246IDAsXG4gICAgc2NhbGVYOiAxLCBzY2FsZVk6IDEsXG4gICAgd2lkdGg6IDAsIGhlaWdodDogMCxcbiAgICByZW5kZXJlck9iamVjdDogbnVsbCxcbiAgICByZWdpb25PZmZzZXRYOiAwLCByZWdpb25PZmZzZXRZOiAwLFxuICAgIHJlZ2lvbldpZHRoOiAwLCByZWdpb25IZWlnaHQ6IDAsXG4gICAgcmVnaW9uT3JpZ2luYWxXaWR0aDogMCwgcmVnaW9uT3JpZ2luYWxIZWlnaHQ6IDAsXG4gICAgc2V0VVZzOiBmdW5jdGlvbiAodSwgdiwgdTIsIHYyLCByb3RhdGUpIHtcbiAgICAgICAgdmFyIHV2cyA9IHRoaXMudXZzO1xuICAgICAgICBpZiAocm90YXRlKSB7XG4gICAgICAgICAgICB1dnNbMi8qWDIqL10gPSB1O1xuICAgICAgICAgICAgdXZzWzMvKlkyKi9dID0gdjI7XG4gICAgICAgICAgICB1dnNbNC8qWDMqL10gPSB1O1xuICAgICAgICAgICAgdXZzWzUvKlkzKi9dID0gdjtcbiAgICAgICAgICAgIHV2c1s2LypYNCovXSA9IHUyO1xuICAgICAgICAgICAgdXZzWzcvKlk0Ki9dID0gdjtcbiAgICAgICAgICAgIHV2c1swLypYMSovXSA9IHUyO1xuICAgICAgICAgICAgdXZzWzEvKlkxKi9dID0gdjI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1dnNbMC8qWDEqL10gPSB1O1xuICAgICAgICAgICAgdXZzWzEvKlkxKi9dID0gdjI7XG4gICAgICAgICAgICB1dnNbMi8qWDIqL10gPSB1O1xuICAgICAgICAgICAgdXZzWzMvKlkyKi9dID0gdjtcbiAgICAgICAgICAgIHV2c1s0LypYMyovXSA9IHUyO1xuICAgICAgICAgICAgdXZzWzUvKlkzKi9dID0gdjtcbiAgICAgICAgICAgIHV2c1s2LypYNCovXSA9IHUyO1xuICAgICAgICAgICAgdXZzWzcvKlk0Ki9dID0gdjI7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHVwZGF0ZU9mZnNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVnaW9uU2NhbGVYID0gdGhpcy53aWR0aCAvIHRoaXMucmVnaW9uT3JpZ2luYWxXaWR0aCAqIHRoaXMuc2NhbGVYO1xuICAgICAgICB2YXIgcmVnaW9uU2NhbGVZID0gdGhpcy5oZWlnaHQgLyB0aGlzLnJlZ2lvbk9yaWdpbmFsSGVpZ2h0ICogdGhpcy5zY2FsZVk7XG4gICAgICAgIHZhciBsb2NhbFggPSAtdGhpcy53aWR0aCAvIDIgKiB0aGlzLnNjYWxlWCArIHRoaXMucmVnaW9uT2Zmc2V0WCAqIHJlZ2lvblNjYWxlWDtcbiAgICAgICAgdmFyIGxvY2FsWSA9IC10aGlzLmhlaWdodCAvIDIgKiB0aGlzLnNjYWxlWSArIHRoaXMucmVnaW9uT2Zmc2V0WSAqIHJlZ2lvblNjYWxlWTtcbiAgICAgICAgdmFyIGxvY2FsWDIgPSBsb2NhbFggKyB0aGlzLnJlZ2lvbldpZHRoICogcmVnaW9uU2NhbGVYO1xuICAgICAgICB2YXIgbG9jYWxZMiA9IGxvY2FsWSArIHRoaXMucmVnaW9uSGVpZ2h0ICogcmVnaW9uU2NhbGVZO1xuICAgICAgICB2YXIgcmFkaWFucyA9IHRoaXMucm90YXRpb24gKiBNYXRoLlBJIC8gMTgwO1xuICAgICAgICB2YXIgY29zID0gTWF0aC5jb3MocmFkaWFucyk7XG4gICAgICAgIHZhciBzaW4gPSBNYXRoLnNpbihyYWRpYW5zKTtcbiAgICAgICAgdmFyIGxvY2FsWENvcyA9IGxvY2FsWCAqIGNvcyArIHRoaXMueDtcbiAgICAgICAgdmFyIGxvY2FsWFNpbiA9IGxvY2FsWCAqIHNpbjtcbiAgICAgICAgdmFyIGxvY2FsWUNvcyA9IGxvY2FsWSAqIGNvcyArIHRoaXMueTtcbiAgICAgICAgdmFyIGxvY2FsWVNpbiA9IGxvY2FsWSAqIHNpbjtcbiAgICAgICAgdmFyIGxvY2FsWDJDb3MgPSBsb2NhbFgyICogY29zICsgdGhpcy54O1xuICAgICAgICB2YXIgbG9jYWxYMlNpbiA9IGxvY2FsWDIgKiBzaW47XG4gICAgICAgIHZhciBsb2NhbFkyQ29zID0gbG9jYWxZMiAqIGNvcyArIHRoaXMueTtcbiAgICAgICAgdmFyIGxvY2FsWTJTaW4gPSBsb2NhbFkyICogc2luO1xuICAgICAgICB2YXIgb2Zmc2V0ID0gdGhpcy5vZmZzZXQ7XG4gICAgICAgIG9mZnNldFswLypYMSovXSA9IGxvY2FsWENvcyAtIGxvY2FsWVNpbjtcbiAgICAgICAgb2Zmc2V0WzEvKlkxKi9dID0gbG9jYWxZQ29zICsgbG9jYWxYU2luO1xuICAgICAgICBvZmZzZXRbMi8qWDIqL10gPSBsb2NhbFhDb3MgLSBsb2NhbFkyU2luO1xuICAgICAgICBvZmZzZXRbMy8qWTIqL10gPSBsb2NhbFkyQ29zICsgbG9jYWxYU2luO1xuICAgICAgICBvZmZzZXRbNC8qWDMqL10gPSBsb2NhbFgyQ29zIC0gbG9jYWxZMlNpbjtcbiAgICAgICAgb2Zmc2V0WzUvKlkzKi9dID0gbG9jYWxZMkNvcyArIGxvY2FsWDJTaW47XG4gICAgICAgIG9mZnNldFs2LypYNCovXSA9IGxvY2FsWDJDb3MgLSBsb2NhbFlTaW47XG4gICAgICAgIG9mZnNldFs3LypZNCovXSA9IGxvY2FsWUNvcyArIGxvY2FsWDJTaW47XG4gICAgfSxcbiAgICBjb21wdXRlVmVydGljZXM6IGZ1bmN0aW9uICh4LCB5LCBib25lLCB2ZXJ0aWNlcykge1xuICAgICAgICB4ICs9IGJvbmUud29ybGRYO1xuICAgICAgICB5ICs9IGJvbmUud29ybGRZO1xuICAgICAgICB2YXIgbTAwID0gYm9uZS5tMDA7XG4gICAgICAgIHZhciBtMDEgPSBib25lLm0wMTtcbiAgICAgICAgdmFyIG0xMCA9IGJvbmUubTEwO1xuICAgICAgICB2YXIgbTExID0gYm9uZS5tMTE7XG4gICAgICAgIHZhciBvZmZzZXQgPSB0aGlzLm9mZnNldDtcbiAgICAgICAgdmVydGljZXNbMC8qWDEqL10gPSBvZmZzZXRbMC8qWDEqL10gKiBtMDAgKyBvZmZzZXRbMS8qWTEqL10gKiBtMDEgKyB4O1xuICAgICAgICB2ZXJ0aWNlc1sxLypZMSovXSA9IG9mZnNldFswLypYMSovXSAqIG0xMCArIG9mZnNldFsxLypZMSovXSAqIG0xMSArIHk7XG4gICAgICAgIHZlcnRpY2VzWzIvKlgyKi9dID0gb2Zmc2V0WzIvKlgyKi9dICogbTAwICsgb2Zmc2V0WzMvKlkyKi9dICogbTAxICsgeDtcbiAgICAgICAgdmVydGljZXNbMy8qWTIqL10gPSBvZmZzZXRbMi8qWDIqL10gKiBtMTAgKyBvZmZzZXRbMy8qWTIqL10gKiBtMTEgKyB5O1xuICAgICAgICB2ZXJ0aWNlc1s0LypYMyovXSA9IG9mZnNldFs0LypYMyovXSAqIG0wMCArIG9mZnNldFs1LypYMyovXSAqIG0wMSArIHg7XG4gICAgICAgIHZlcnRpY2VzWzUvKlgzKi9dID0gb2Zmc2V0WzQvKlgzKi9dICogbTEwICsgb2Zmc2V0WzUvKlgzKi9dICogbTExICsgeTtcbiAgICAgICAgdmVydGljZXNbNi8qWDQqL10gPSBvZmZzZXRbNi8qWDQqL10gKiBtMDAgKyBvZmZzZXRbNy8qWTQqL10gKiBtMDEgKyB4O1xuICAgICAgICB2ZXJ0aWNlc1s3LypZNCovXSA9IG9mZnNldFs2LypYNCovXSAqIG0xMCArIG9mZnNldFs3LypZNCovXSAqIG0xMSArIHk7XG4gICAgfVxufVxuXG5zcGluZS5BbmltYXRpb25TdGF0ZURhdGEgPSBmdW5jdGlvbiAoc2tlbGV0b25EYXRhKSB7XG4gICAgdGhpcy5za2VsZXRvbkRhdGEgPSBza2VsZXRvbkRhdGE7XG4gICAgdGhpcy5hbmltYXRpb25Ub01peFRpbWUgPSB7fTtcbn07XG5zcGluZS5BbmltYXRpb25TdGF0ZURhdGEucHJvdG90eXBlID0ge1xuICAgICAgICBkZWZhdWx0TWl4OiAwLFxuICAgIHNldE1peEJ5TmFtZTogZnVuY3Rpb24gKGZyb21OYW1lLCB0b05hbWUsIGR1cmF0aW9uKSB7XG4gICAgICAgIHZhciBmcm9tID0gdGhpcy5za2VsZXRvbkRhdGEuZmluZEFuaW1hdGlvbihmcm9tTmFtZSk7XG4gICAgICAgIGlmICghZnJvbSkgdGhyb3cgXCJBbmltYXRpb24gbm90IGZvdW5kOiBcIiArIGZyb21OYW1lO1xuICAgICAgICB2YXIgdG8gPSB0aGlzLnNrZWxldG9uRGF0YS5maW5kQW5pbWF0aW9uKHRvTmFtZSk7XG4gICAgICAgIGlmICghdG8pIHRocm93IFwiQW5pbWF0aW9uIG5vdCBmb3VuZDogXCIgKyB0b05hbWU7XG4gICAgICAgIHRoaXMuc2V0TWl4KGZyb20sIHRvLCBkdXJhdGlvbik7XG4gICAgfSxcbiAgICBzZXRNaXg6IGZ1bmN0aW9uIChmcm9tLCB0bywgZHVyYXRpb24pIHtcbiAgICAgICAgdGhpcy5hbmltYXRpb25Ub01peFRpbWVbZnJvbS5uYW1lICsgXCI6XCIgKyB0by5uYW1lXSA9IGR1cmF0aW9uO1xuICAgIH0sXG4gICAgZ2V0TWl4OiBmdW5jdGlvbiAoZnJvbSwgdG8pIHtcbiAgICAgICAgdmFyIHRpbWUgPSB0aGlzLmFuaW1hdGlvblRvTWl4VGltZVtmcm9tLm5hbWUgKyBcIjpcIiArIHRvLm5hbWVdO1xuICAgICAgICAgICAgcmV0dXJuIHRpbWUgPyB0aW1lIDogdGhpcy5kZWZhdWx0TWl4O1xuICAgIH1cbn07XG5cbnNwaW5lLkFuaW1hdGlvblN0YXRlID0gZnVuY3Rpb24gKHN0YXRlRGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IHN0YXRlRGF0YTtcbiAgICB0aGlzLnF1ZXVlID0gW107XG59O1xuc3BpbmUuQW5pbWF0aW9uU3RhdGUucHJvdG90eXBlID0ge1xuICAgIGN1cnJlbnQ6IG51bGwsXG4gICAgcHJldmlvdXM6IG51bGwsXG4gICAgY3VycmVudFRpbWU6IDAsXG4gICAgcHJldmlvdXNUaW1lOiAwLFxuICAgIGN1cnJlbnRMb29wOiBmYWxzZSxcbiAgICBwcmV2aW91c0xvb3A6IGZhbHNlLFxuICAgIG1peFRpbWU6IDAsXG4gICAgbWl4RHVyYXRpb246IDAsXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGVsdGEpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50VGltZSArPSBkZWx0YTtcbiAgICAgICAgdGhpcy5wcmV2aW91c1RpbWUgKz0gZGVsdGE7XG4gICAgICAgIHRoaXMubWl4VGltZSArPSBkZWx0YTtcblxuICAgICAgICBpZiAodGhpcy5xdWV1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnF1ZXVlWzBdO1xuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudFRpbWUgPj0gZW50cnkuZGVsYXkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRBbmltYXRpb24oZW50cnkuYW5pbWF0aW9uLCBlbnRyeS5sb29wKTtcbiAgICAgICAgICAgICAgICB0aGlzLnF1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGFwcGx5OiBmdW5jdGlvbiAoc2tlbGV0b24pIHtcbiAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnQpIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMucHJldmlvdXMpIHtcbiAgICAgICAgICAgIHRoaXMucHJldmlvdXMuYXBwbHkoc2tlbGV0b24sIHRoaXMucHJldmlvdXNUaW1lLCB0aGlzLnByZXZpb3VzTG9vcCk7XG4gICAgICAgICAgICB2YXIgYWxwaGEgPSB0aGlzLm1peFRpbWUgLyB0aGlzLm1peER1cmF0aW9uO1xuICAgICAgICAgICAgaWYgKGFscGhhID49IDEpIHtcbiAgICAgICAgICAgICAgICBhbHBoYSA9IDE7XG4gICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91cyA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnQubWl4KHNrZWxldG9uLCB0aGlzLmN1cnJlbnRUaW1lLCB0aGlzLmN1cnJlbnRMb29wLCBhbHBoYSk7XG4gICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50LmFwcGx5KHNrZWxldG9uLCB0aGlzLmN1cnJlbnRUaW1lLCB0aGlzLmN1cnJlbnRMb29wKTtcbiAgICB9LFxuICAgIGNsZWFyQW5pbWF0aW9uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucHJldmlvdXMgPSBudWxsO1xuICAgICAgICB0aGlzLmN1cnJlbnQgPSBudWxsO1xuICAgICAgICB0aGlzLnF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgfSxcbiAgICBfc2V0QW5pbWF0aW9uOiBmdW5jdGlvbiAoYW5pbWF0aW9uLCBsb29wKSB7XG4gICAgICAgIHRoaXMucHJldmlvdXMgPSBudWxsO1xuICAgICAgICBpZiAoYW5pbWF0aW9uICYmIHRoaXMuY3VycmVudCkge1xuICAgICAgICAgICAgdGhpcy5taXhEdXJhdGlvbiA9IHRoaXMuZGF0YS5nZXRNaXgodGhpcy5jdXJyZW50LCBhbmltYXRpb24pO1xuICAgICAgICAgICAgaWYgKHRoaXMubWl4RHVyYXRpb24gPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5taXhUaW1lID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXZpb3VzID0gdGhpcy5jdXJyZW50O1xuICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXNUaW1lID0gdGhpcy5jdXJyZW50VGltZTtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXZpb3VzTG9vcCA9IHRoaXMuY3VycmVudExvb3A7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jdXJyZW50ID0gYW5pbWF0aW9uO1xuICAgICAgICB0aGlzLmN1cnJlbnRMb29wID0gbG9vcDtcbiAgICAgICAgdGhpcy5jdXJyZW50VGltZSA9IDA7XG4gICAgfSxcbiAgICAvKiogQHNlZSAjc2V0QW5pbWF0aW9uKEFuaW1hdGlvbiwgQm9vbGVhbikgKi9cbiAgICBzZXRBbmltYXRpb25CeU5hbWU6IGZ1bmN0aW9uIChhbmltYXRpb25OYW1lLCBsb29wKSB7XG4gICAgICAgIHZhciBhbmltYXRpb24gPSB0aGlzLmRhdGEuc2tlbGV0b25EYXRhLmZpbmRBbmltYXRpb24oYW5pbWF0aW9uTmFtZSk7XG4gICAgICAgIGlmICghYW5pbWF0aW9uKSB0aHJvdyBcIkFuaW1hdGlvbiBub3QgZm91bmQ6IFwiICsgYW5pbWF0aW9uTmFtZTtcbiAgICAgICAgdGhpcy5zZXRBbmltYXRpb24oYW5pbWF0aW9uLCBsb29wKTtcbiAgICB9LFxuICAgIC8qKiBTZXQgdGhlIGN1cnJlbnQgYW5pbWF0aW9uLiBBbnkgcXVldWVkIGFuaW1hdGlvbnMgYXJlIGNsZWFyZWQgYW5kIHRoZSBjdXJyZW50IGFuaW1hdGlvbiB0aW1lIGlzIHNldCB0byAwLlxuICAgICAqIEBwYXJhbSBhbmltYXRpb24gTWF5IGJlIG51bGwuICovXG4gICAgc2V0QW5pbWF0aW9uOiBmdW5jdGlvbiAoYW5pbWF0aW9uLCBsb29wKSB7XG4gICAgICAgIHRoaXMucXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fc2V0QW5pbWF0aW9uKGFuaW1hdGlvbiwgbG9vcCk7XG4gICAgfSxcbiAgICAvKiogQHNlZSAjYWRkQW5pbWF0aW9uKEFuaW1hdGlvbiwgQm9vbGVhbiwgTnVtYmVyKSAqL1xuICAgIGFkZEFuaW1hdGlvbkJ5TmFtZTogZnVuY3Rpb24gKGFuaW1hdGlvbk5hbWUsIGxvb3AsIGRlbGF5KSB7XG4gICAgICAgIHZhciBhbmltYXRpb24gPSB0aGlzLmRhdGEuc2tlbGV0b25EYXRhLmZpbmRBbmltYXRpb24oYW5pbWF0aW9uTmFtZSk7XG4gICAgICAgIGlmICghYW5pbWF0aW9uKSB0aHJvdyBcIkFuaW1hdGlvbiBub3QgZm91bmQ6IFwiICsgYW5pbWF0aW9uTmFtZTtcbiAgICAgICAgdGhpcy5hZGRBbmltYXRpb24oYW5pbWF0aW9uLCBsb29wLCBkZWxheSk7XG4gICAgfSxcbiAgICAvKiogQWRkcyBhbiBhbmltYXRpb24gdG8gYmUgcGxheWVkIGRlbGF5IHNlY29uZHMgYWZ0ZXIgdGhlIGN1cnJlbnQgb3IgbGFzdCBxdWV1ZWQgYW5pbWF0aW9uLlxuICAgICAqIEBwYXJhbSBkZWxheSBNYXkgYmUgPD0gMCB0byB1c2UgZHVyYXRpb24gb2YgcHJldmlvdXMgYW5pbWF0aW9uIG1pbnVzIGFueSBtaXggZHVyYXRpb24gcGx1cyB0aGUgbmVnYXRpdmUgZGVsYXkuICovXG4gICAgYWRkQW5pbWF0aW9uOiBmdW5jdGlvbiAoYW5pbWF0aW9uLCBsb29wLCBkZWxheSkge1xuICAgICAgICB2YXIgZW50cnkgPSB7fTtcbiAgICAgICAgZW50cnkuYW5pbWF0aW9uID0gYW5pbWF0aW9uO1xuICAgICAgICBlbnRyeS5sb29wID0gbG9vcDtcblxuICAgICAgICBpZiAoIWRlbGF5IHx8IGRlbGF5IDw9IDApIHtcbiAgICAgICAgICAgIHZhciBwcmV2aW91c0FuaW1hdGlvbiA9IHRoaXMucXVldWUubGVuZ3RoID8gdGhpcy5xdWV1ZVt0aGlzLnF1ZXVlLmxlbmd0aCAtIDFdLmFuaW1hdGlvbiA6IHRoaXMuY3VycmVudDtcbiAgICAgICAgICAgIGlmIChwcmV2aW91c0FuaW1hdGlvbiAhPSBudWxsKVxuICAgICAgICAgICAgICAgIGRlbGF5ID0gcHJldmlvdXNBbmltYXRpb24uZHVyYXRpb24gLSB0aGlzLmRhdGEuZ2V0TWl4KHByZXZpb3VzQW5pbWF0aW9uLCBhbmltYXRpb24pICsgKGRlbGF5IHx8IDApO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGRlbGF5ID0gMDtcbiAgICAgICAgfVxuICAgICAgICBlbnRyeS5kZWxheSA9IGRlbGF5O1xuXG4gICAgICAgIHRoaXMucXVldWUucHVzaChlbnRyeSk7XG4gICAgfSxcbiAgICAvKiogUmV0dXJucyB0cnVlIGlmIG5vIGFuaW1hdGlvbiBpcyBzZXQgb3IgaWYgdGhlIGN1cnJlbnQgdGltZSBpcyBncmVhdGVyIHRoYW4gdGhlIGFuaW1hdGlvbiBkdXJhdGlvbiwgcmVnYXJkbGVzcyBvZiBsb29waW5nLiAqL1xuICAgIGlzQ29tcGxldGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLmN1cnJlbnQgfHwgdGhpcy5jdXJyZW50VGltZSA+PSB0aGlzLmN1cnJlbnQuZHVyYXRpb247XG4gICAgfVxufTtcblxuc3BpbmUuU2tlbGV0b25Kc29uID0gZnVuY3Rpb24gKGF0dGFjaG1lbnRMb2FkZXIpIHtcbiAgICB0aGlzLmF0dGFjaG1lbnRMb2FkZXIgPSBhdHRhY2htZW50TG9hZGVyO1xufTtcbnNwaW5lLlNrZWxldG9uSnNvbi5wcm90b3R5cGUgPSB7XG4gICAgc2NhbGU6IDEsXG4gICAgcmVhZFNrZWxldG9uRGF0YTogZnVuY3Rpb24gKHJvb3QpIHtcbiAgICAgICAgLypqc2hpbnQgLVcwNjkqL1xuICAgICAgICB2YXIgc2tlbGV0b25EYXRhID0gbmV3IHNwaW5lLlNrZWxldG9uRGF0YSgpLFxuICAgICAgICAgICAgYm9uZURhdGE7XG5cbiAgICAgICAgLy8gQm9uZXMuXG4gICAgICAgIHZhciBib25lcyA9IHJvb3RbXCJib25lc1wiXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBib25lcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBib25lTWFwID0gYm9uZXNbaV07XG4gICAgICAgICAgICB2YXIgcGFyZW50ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChib25lTWFwW1wicGFyZW50XCJdKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50ID0gc2tlbGV0b25EYXRhLmZpbmRCb25lKGJvbmVNYXBbXCJwYXJlbnRcIl0pO1xuICAgICAgICAgICAgICAgIGlmICghcGFyZW50KSB0aHJvdyBcIlBhcmVudCBib25lIG5vdCBmb3VuZDogXCIgKyBib25lTWFwW1wicGFyZW50XCJdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYm9uZURhdGEgPSBuZXcgc3BpbmUuQm9uZURhdGEoYm9uZU1hcFtcIm5hbWVcIl0sIHBhcmVudCk7XG4gICAgICAgICAgICBib25lRGF0YS5sZW5ndGggPSAoYm9uZU1hcFtcImxlbmd0aFwiXSB8fCAwKSAqIHRoaXMuc2NhbGU7XG4gICAgICAgICAgICBib25lRGF0YS54ID0gKGJvbmVNYXBbXCJ4XCJdIHx8IDApICogdGhpcy5zY2FsZTtcbiAgICAgICAgICAgIGJvbmVEYXRhLnkgPSAoYm9uZU1hcFtcInlcIl0gfHwgMCkgKiB0aGlzLnNjYWxlO1xuICAgICAgICAgICAgYm9uZURhdGEucm90YXRpb24gPSAoYm9uZU1hcFtcInJvdGF0aW9uXCJdIHx8IDApO1xuICAgICAgICAgICAgYm9uZURhdGEuc2NhbGVYID0gYm9uZU1hcFtcInNjYWxlWFwiXSB8fCAxO1xuICAgICAgICAgICAgYm9uZURhdGEuc2NhbGVZID0gYm9uZU1hcFtcInNjYWxlWVwiXSB8fCAxO1xuICAgICAgICAgICAgc2tlbGV0b25EYXRhLmJvbmVzLnB1c2goYm9uZURhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2xvdHMuXG4gICAgICAgIHZhciBzbG90cyA9IHJvb3RbXCJzbG90c1wiXTtcbiAgICAgICAgZm9yIChpID0gMCwgbiA9IHNsb3RzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgdmFyIHNsb3RNYXAgPSBzbG90c1tpXTtcbiAgICAgICAgICAgIGJvbmVEYXRhID0gc2tlbGV0b25EYXRhLmZpbmRCb25lKHNsb3RNYXBbXCJib25lXCJdKTtcbiAgICAgICAgICAgIGlmICghYm9uZURhdGEpIHRocm93IFwiU2xvdCBib25lIG5vdCBmb3VuZDogXCIgKyBzbG90TWFwW1wiYm9uZVwiXTtcbiAgICAgICAgICAgIHZhciBzbG90RGF0YSA9IG5ldyBzcGluZS5TbG90RGF0YShzbG90TWFwW1wibmFtZVwiXSwgYm9uZURhdGEpO1xuXG4gICAgICAgICAgICB2YXIgY29sb3IgPSBzbG90TWFwW1wiY29sb3JcIl07XG4gICAgICAgICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgICAgICAgICBzbG90RGF0YS5yID0gc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IoY29sb3IsIDApO1xuICAgICAgICAgICAgICAgIHNsb3REYXRhLmcgPSBzcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvcihjb2xvciwgMSk7XG4gICAgICAgICAgICAgICAgc2xvdERhdGEuYiA9IHNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yKGNvbG9yLCAyKTtcbiAgICAgICAgICAgICAgICBzbG90RGF0YS5hID0gc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IoY29sb3IsIDMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzbG90RGF0YS5hdHRhY2htZW50TmFtZSA9IHNsb3RNYXBbXCJhdHRhY2htZW50XCJdO1xuXG4gICAgICAgICAgICBza2VsZXRvbkRhdGEuc2xvdHMucHVzaChzbG90RGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTa2lucy5cbiAgICAgICAgdmFyIHNraW5zID0gcm9vdFtcInNraW5zXCJdO1xuICAgICAgICBmb3IgKHZhciBza2luTmFtZSBpbiBza2lucykge1xuICAgICAgICAgICAgaWYgKCFza2lucy5oYXNPd25Qcm9wZXJ0eShza2luTmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdmFyIHNraW5NYXAgPSBza2luc1tza2luTmFtZV07XG4gICAgICAgICAgICB2YXIgc2tpbiA9IG5ldyBzcGluZS5Ta2luKHNraW5OYW1lKTtcbiAgICAgICAgICAgIGZvciAodmFyIHNsb3ROYW1lIGluIHNraW5NYXApIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNraW5NYXAuaGFzT3duUHJvcGVydHkoc2xvdE5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB2YXIgc2xvdEluZGV4ID0gc2tlbGV0b25EYXRhLmZpbmRTbG90SW5kZXgoc2xvdE5hbWUpO1xuICAgICAgICAgICAgICAgIHZhciBzbG90RW50cnkgPSBza2luTWFwW3Nsb3ROYW1lXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBhdHRhY2htZW50TmFtZSBpbiBzbG90RW50cnkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFzbG90RW50cnkuaGFzT3duUHJvcGVydHkoYXR0YWNobWVudE5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGF0dGFjaG1lbnQgPSB0aGlzLnJlYWRBdHRhY2htZW50KHNraW4sIGF0dGFjaG1lbnROYW1lLCBzbG90RW50cnlbYXR0YWNobWVudE5hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dGFjaG1lbnQgIT0gbnVsbCkgc2tpbi5hZGRBdHRhY2htZW50KHNsb3RJbmRleCwgYXR0YWNobWVudE5hbWUsIGF0dGFjaG1lbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNrZWxldG9uRGF0YS5za2lucy5wdXNoKHNraW4pO1xuICAgICAgICAgICAgaWYgKHNraW4ubmFtZSA9PSBcImRlZmF1bHRcIikgc2tlbGV0b25EYXRhLmRlZmF1bHRTa2luID0gc2tpbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFuaW1hdGlvbnMuXG4gICAgICAgIHZhciBhbmltYXRpb25zID0gcm9vdFtcImFuaW1hdGlvbnNcIl07XG4gICAgICAgIGZvciAodmFyIGFuaW1hdGlvbk5hbWUgaW4gYW5pbWF0aW9ucykge1xuICAgICAgICAgICAgaWYgKCFhbmltYXRpb25zLmhhc093blByb3BlcnR5KGFuaW1hdGlvbk5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHRoaXMucmVhZEFuaW1hdGlvbihhbmltYXRpb25OYW1lLCBhbmltYXRpb25zW2FuaW1hdGlvbk5hbWVdLCBza2VsZXRvbkRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNrZWxldG9uRGF0YTtcbiAgICB9LFxuICAgIHJlYWRBdHRhY2htZW50OiBmdW5jdGlvbiAoc2tpbiwgbmFtZSwgbWFwKSB7XG4gICAgICAgIC8qanNoaW50IC1XMDY5Ki9cbiAgICAgICAgbmFtZSA9IG1hcFtcIm5hbWVcIl0gfHwgbmFtZTtcblxuICAgICAgICB2YXIgdHlwZSA9IHNwaW5lLkF0dGFjaG1lbnRUeXBlW21hcFtcInR5cGVcIl0gfHwgXCJyZWdpb25cIl07XG5cbiAgICAgICAgaWYgKHR5cGUgPT0gc3BpbmUuQXR0YWNobWVudFR5cGUucmVnaW9uKSB7XG4gICAgICAgICAgICB2YXIgYXR0YWNobWVudCA9IG5ldyBzcGluZS5SZWdpb25BdHRhY2htZW50KCk7XG4gICAgICAgICAgICBhdHRhY2htZW50LnggPSAobWFwW1wieFwiXSB8fCAwKSAqIHRoaXMuc2NhbGU7XG4gICAgICAgICAgICBhdHRhY2htZW50LnkgPSAobWFwW1wieVwiXSB8fCAwKSAqIHRoaXMuc2NhbGU7XG4gICAgICAgICAgICBhdHRhY2htZW50LnNjYWxlWCA9IG1hcFtcInNjYWxlWFwiXSB8fCAxO1xuICAgICAgICAgICAgYXR0YWNobWVudC5zY2FsZVkgPSBtYXBbXCJzY2FsZVlcIl0gfHwgMTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucm90YXRpb24gPSBtYXBbXCJyb3RhdGlvblwiXSB8fCAwO1xuICAgICAgICAgICAgYXR0YWNobWVudC53aWR0aCA9IChtYXBbXCJ3aWR0aFwiXSB8fCAzMikgKiB0aGlzLnNjYWxlO1xuICAgICAgICAgICAgYXR0YWNobWVudC5oZWlnaHQgPSAobWFwW1wiaGVpZ2h0XCJdIHx8IDMyKSAqIHRoaXMuc2NhbGU7XG4gICAgICAgICAgICBhdHRhY2htZW50LnVwZGF0ZU9mZnNldCgpO1xuXG4gICAgICAgICAgICBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0ID0ge307XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0Lm5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdC5zY2FsZSA9IHt9O1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdC5zY2FsZS54ID0gYXR0YWNobWVudC5zY2FsZVg7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0LnNjYWxlLnkgPSBhdHRhY2htZW50LnNjYWxlWTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3Qucm90YXRpb24gPSAtYXR0YWNobWVudC5yb3RhdGlvbiAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgICAgICByZXR1cm4gYXR0YWNobWVudDtcbiAgICAgICAgfVxuXG4gICAgICAgICAgICB0aHJvdyBcIlVua25vd24gYXR0YWNobWVudCB0eXBlOiBcIiArIHR5cGU7XG4gICAgfSxcblxuICAgIHJlYWRBbmltYXRpb246IGZ1bmN0aW9uIChuYW1lLCBtYXAsIHNrZWxldG9uRGF0YSkge1xuICAgICAgICAvKmpzaGludCAtVzA2OSovXG4gICAgICAgIHZhciB0aW1lbGluZXMgPSBbXTtcbiAgICAgICAgdmFyIGR1cmF0aW9uID0gMDtcbiAgICAgICAgdmFyIGZyYW1lSW5kZXgsIHRpbWVsaW5lLCB0aW1lbGluZU5hbWUsIHZhbHVlTWFwLCB2YWx1ZXMsXG4gICAgICAgICAgICBpLCBuO1xuXG4gICAgICAgIHZhciBib25lcyA9IG1hcFtcImJvbmVzXCJdO1xuICAgICAgICBmb3IgKHZhciBib25lTmFtZSBpbiBib25lcykge1xuICAgICAgICAgICAgaWYgKCFib25lcy5oYXNPd25Qcm9wZXJ0eShib25lTmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdmFyIGJvbmVJbmRleCA9IHNrZWxldG9uRGF0YS5maW5kQm9uZUluZGV4KGJvbmVOYW1lKTtcbiAgICAgICAgICAgIGlmIChib25lSW5kZXggPT0gLTEpIHRocm93IFwiQm9uZSBub3QgZm91bmQ6IFwiICsgYm9uZU5hbWU7XG4gICAgICAgICAgICB2YXIgYm9uZU1hcCA9IGJvbmVzW2JvbmVOYW1lXTtcblxuICAgICAgICAgICAgZm9yICh0aW1lbGluZU5hbWUgaW4gYm9uZU1hcCkge1xuICAgICAgICAgICAgICAgIGlmICghYm9uZU1hcC5oYXNPd25Qcm9wZXJ0eSh0aW1lbGluZU5hbWUpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBib25lTWFwW3RpbWVsaW5lTmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKHRpbWVsaW5lTmFtZSA9PSBcInJvdGF0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lID0gbmV3IHNwaW5lLlJvdGF0ZVRpbWVsaW5lKHZhbHVlcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZS5ib25lSW5kZXggPSBib25lSW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgZnJhbWVJbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDAsIG4gPSB2YWx1ZXMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZU1hcCA9IHZhbHVlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lLnNldEZyYW1lKGZyYW1lSW5kZXgsIHZhbHVlTWFwW1widGltZVwiXSwgdmFsdWVNYXBbXCJhbmdsZVwiXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGluZS5Ta2VsZXRvbkpzb24ucmVhZEN1cnZlKHRpbWVsaW5lLCBmcmFtZUluZGV4LCB2YWx1ZU1hcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmVzLnB1c2godGltZWxpbmUpO1xuICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbiA9IE1hdGgubWF4KGR1cmF0aW9uLCB0aW1lbGluZS5mcmFtZXNbdGltZWxpbmUuZ2V0RnJhbWVDb3VudCgpICogMiAtIDJdKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGltZWxpbmVOYW1lID09IFwidHJhbnNsYXRlXCIgfHwgdGltZWxpbmVOYW1lID09IFwic2NhbGVcIikge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdGltZWxpbmVTY2FsZSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aW1lbGluZU5hbWUgPT0gXCJzY2FsZVwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUgPSBuZXcgc3BpbmUuU2NhbGVUaW1lbGluZSh2YWx1ZXMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lbGluZSA9IG5ldyBzcGluZS5UcmFuc2xhdGVUaW1lbGluZSh2YWx1ZXMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lU2NhbGUgPSB0aGlzLnNjYWxlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lLmJvbmVJbmRleCA9IGJvbmVJbmRleDtcblxuICAgICAgICAgICAgICAgICAgICBmcmFtZUluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMCwgbiA9IHZhbHVlcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlTWFwID0gdmFsdWVzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHggPSAodmFsdWVNYXBbXCJ4XCJdIHx8IDApICogdGltZWxpbmVTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB5ID0gKHZhbHVlTWFwW1wieVwiXSB8fCAwKSAqIHRpbWVsaW5lU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lbGluZS5zZXRGcmFtZShmcmFtZUluZGV4LCB2YWx1ZU1hcFtcInRpbWVcIl0sIHgsIHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3BpbmUuU2tlbGV0b25Kc29uLnJlYWRDdXJ2ZSh0aW1lbGluZSwgZnJhbWVJbmRleCwgdmFsdWVNYXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVJbmRleCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lcy5wdXNoKHRpbWVsaW5lKTtcbiAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgdGltZWxpbmUuZnJhbWVzW3RpbWVsaW5lLmdldEZyYW1lQ291bnQoKSAqIDMgLSAzXSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgXCJJbnZhbGlkIHRpbWVsaW5lIHR5cGUgZm9yIGEgYm9uZTogXCIgKyB0aW1lbGluZU5hbWUgKyBcIiAoXCIgKyBib25lTmFtZSArIFwiKVwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBzbG90cyA9IG1hcFtcInNsb3RzXCJdO1xuICAgICAgICBmb3IgKHZhciBzbG90TmFtZSBpbiBzbG90cykge1xuICAgICAgICAgICAgaWYgKCFzbG90cy5oYXNPd25Qcm9wZXJ0eShzbG90TmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdmFyIHNsb3RNYXAgPSBzbG90c1tzbG90TmFtZV07XG4gICAgICAgICAgICB2YXIgc2xvdEluZGV4ID0gc2tlbGV0b25EYXRhLmZpbmRTbG90SW5kZXgoc2xvdE5hbWUpO1xuXG4gICAgICAgICAgICBmb3IgKHRpbWVsaW5lTmFtZSBpbiBzbG90TWFwKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzbG90TWFwLmhhc093blByb3BlcnR5KHRpbWVsaW5lTmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IHNsb3RNYXBbdGltZWxpbmVOYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAodGltZWxpbmVOYW1lID09IFwiY29sb3JcIikge1xuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZSA9IG5ldyBzcGluZS5Db2xvclRpbWVsaW5lKHZhbHVlcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZS5zbG90SW5kZXggPSBzbG90SW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgZnJhbWVJbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDAsIG4gPSB2YWx1ZXMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZU1hcCA9IHZhbHVlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2xvciA9IHZhbHVlTWFwW1wiY29sb3JcIl07XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgciA9IHNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yKGNvbG9yLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnID0gc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IoY29sb3IsIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSBzcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvcihjb2xvciwgMik7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYSA9IHNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yKGNvbG9yLCAzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lLnNldEZyYW1lKGZyYW1lSW5kZXgsIHZhbHVlTWFwW1widGltZVwiXSwgciwgZywgYiwgYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGluZS5Ta2VsZXRvbkpzb24ucmVhZEN1cnZlKHRpbWVsaW5lLCBmcmFtZUluZGV4LCB2YWx1ZU1hcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmVzLnB1c2godGltZWxpbmUpO1xuICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbiA9IE1hdGgubWF4KGR1cmF0aW9uLCB0aW1lbGluZS5mcmFtZXNbdGltZWxpbmUuZ2V0RnJhbWVDb3VudCgpICogNSAtIDVdKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGltZWxpbmVOYW1lID09IFwiYXR0YWNobWVudFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lID0gbmV3IHNwaW5lLkF0dGFjaG1lbnRUaW1lbGluZSh2YWx1ZXMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUuc2xvdEluZGV4ID0gc2xvdEluZGV4O1xuXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lSW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBuID0gdmFsdWVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVNYXAgPSB2YWx1ZXNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lbGluZS5zZXRGcmFtZShmcmFtZUluZGV4KyssIHZhbHVlTWFwW1widGltZVwiXSwgdmFsdWVNYXBbXCJuYW1lXCJdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZXMucHVzaCh0aW1lbGluZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbiA9IE1hdGgubWF4KGR1cmF0aW9uLCB0aW1lbGluZS5mcmFtZXNbdGltZWxpbmUuZ2V0RnJhbWVDb3VudCgpIC0gMV0pO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCB0aW1lbGluZSB0eXBlIGZvciBhIHNsb3Q6IFwiICsgdGltZWxpbmVOYW1lICsgXCIgKFwiICsgc2xvdE5hbWUgKyBcIilcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBza2VsZXRvbkRhdGEuYW5pbWF0aW9ucy5wdXNoKG5ldyBzcGluZS5BbmltYXRpb24obmFtZSwgdGltZWxpbmVzLCBkdXJhdGlvbikpO1xuICAgIH1cbn07XG5zcGluZS5Ta2VsZXRvbkpzb24ucmVhZEN1cnZlID0gZnVuY3Rpb24gKHRpbWVsaW5lLCBmcmFtZUluZGV4LCB2YWx1ZU1hcCkge1xuICAgIC8qanNoaW50IC1XMDY5Ki9cbiAgICB2YXIgY3VydmUgPSB2YWx1ZU1hcFtcImN1cnZlXCJdO1xuICAgIGlmICghY3VydmUpIHJldHVybjtcbiAgICBpZiAoY3VydmUgPT0gXCJzdGVwcGVkXCIpXG4gICAgICAgIHRpbWVsaW5lLmN1cnZlcy5zZXRTdGVwcGVkKGZyYW1lSW5kZXgpO1xuICAgIGVsc2UgaWYgKGN1cnZlIGluc3RhbmNlb2YgQXJyYXkpXG4gICAgICAgIHRpbWVsaW5lLmN1cnZlcy5zZXRDdXJ2ZShmcmFtZUluZGV4LCBjdXJ2ZVswXSwgY3VydmVbMV0sIGN1cnZlWzJdLCBjdXJ2ZVszXSk7XG59O1xuc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IgPSBmdW5jdGlvbiAoaGV4U3RyaW5nLCBjb2xvckluZGV4KSB7XG4gICAgaWYgKGhleFN0cmluZy5sZW5ndGggIT0gOCkgdGhyb3cgXCJDb2xvciBoZXhpZGVjaW1hbCBsZW5ndGggbXVzdCBiZSA4LCByZWNpZXZlZDogXCIgKyBoZXhTdHJpbmc7XG4gICAgcmV0dXJuIHBhcnNlSW50KGhleFN0cmluZy5zdWJzdHJpbmcoY29sb3JJbmRleCAqIDIsIDIpLCAxNikgLyAyNTU7XG59O1xuXG5zcGluZS5BdGxhcyA9IGZ1bmN0aW9uIChhdGxhc1RleHQsIHRleHR1cmVMb2FkZXIpIHtcbiAgICB0aGlzLnRleHR1cmVMb2FkZXIgPSB0ZXh0dXJlTG9hZGVyO1xuICAgIHRoaXMucGFnZXMgPSBbXTtcbiAgICB0aGlzLnJlZ2lvbnMgPSBbXTtcblxuICAgIHZhciByZWFkZXIgPSBuZXcgc3BpbmUuQXRsYXNSZWFkZXIoYXRsYXNUZXh0KTtcbiAgICB2YXIgdHVwbGUgPSBbXTtcbiAgICB0dXBsZS5sZW5ndGggPSA0O1xuICAgIHZhciBwYWdlID0gbnVsbDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICB2YXIgbGluZSA9IHJlYWRlci5yZWFkTGluZSgpO1xuICAgICAgICBpZiAobGluZSA9PSBudWxsKSBicmVhaztcbiAgICAgICAgbGluZSA9IHJlYWRlci50cmltKGxpbmUpO1xuICAgICAgICBpZiAoIWxpbmUubGVuZ3RoKVxuICAgICAgICAgICAgcGFnZSA9IG51bGw7XG4gICAgICAgIGVsc2UgaWYgKCFwYWdlKSB7XG4gICAgICAgICAgICBwYWdlID0gbmV3IHNwaW5lLkF0bGFzUGFnZSgpO1xuICAgICAgICAgICAgcGFnZS5uYW1lID0gbGluZTtcblxuICAgICAgICAgICAgcGFnZS5mb3JtYXQgPSBzcGluZS5BdGxhcy5Gb3JtYXRbcmVhZGVyLnJlYWRWYWx1ZSgpXTtcblxuICAgICAgICAgICAgcmVhZGVyLnJlYWRUdXBsZSh0dXBsZSk7XG4gICAgICAgICAgICBwYWdlLm1pbkZpbHRlciA9IHNwaW5lLkF0bGFzLlRleHR1cmVGaWx0ZXJbdHVwbGVbMF1dO1xuICAgICAgICAgICAgcGFnZS5tYWdGaWx0ZXIgPSBzcGluZS5BdGxhcy5UZXh0dXJlRmlsdGVyW3R1cGxlWzFdXTtcblxuICAgICAgICAgICAgdmFyIGRpcmVjdGlvbiA9IHJlYWRlci5yZWFkVmFsdWUoKTtcbiAgICAgICAgICAgIHBhZ2UudVdyYXAgPSBzcGluZS5BdGxhcy5UZXh0dXJlV3JhcC5jbGFtcFRvRWRnZTtcbiAgICAgICAgICAgIHBhZ2UudldyYXAgPSBzcGluZS5BdGxhcy5UZXh0dXJlV3JhcC5jbGFtcFRvRWRnZTtcbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb24gPT0gXCJ4XCIpXG4gICAgICAgICAgICAgICAgcGFnZS51V3JhcCA9IHNwaW5lLkF0bGFzLlRleHR1cmVXcmFwLnJlcGVhdDtcbiAgICAgICAgICAgIGVsc2UgaWYgKGRpcmVjdGlvbiA9PSBcInlcIilcbiAgICAgICAgICAgICAgICBwYWdlLnZXcmFwID0gc3BpbmUuQXRsYXMuVGV4dHVyZVdyYXAucmVwZWF0O1xuICAgICAgICAgICAgZWxzZSBpZiAoZGlyZWN0aW9uID09IFwieHlcIilcbiAgICAgICAgICAgICAgICBwYWdlLnVXcmFwID0gcGFnZS52V3JhcCA9IHNwaW5lLkF0bGFzLlRleHR1cmVXcmFwLnJlcGVhdDtcblxuICAgICAgICAgICAgdGV4dHVyZUxvYWRlci5sb2FkKHBhZ2UsIGxpbmUpO1xuXG4gICAgICAgICAgICB0aGlzLnBhZ2VzLnB1c2gocGFnZSk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciByZWdpb24gPSBuZXcgc3BpbmUuQXRsYXNSZWdpb24oKTtcbiAgICAgICAgICAgIHJlZ2lvbi5uYW1lID0gbGluZTtcbiAgICAgICAgICAgIHJlZ2lvbi5wYWdlID0gcGFnZTtcblxuICAgICAgICAgICAgcmVnaW9uLnJvdGF0ZSA9IHJlYWRlci5yZWFkVmFsdWUoKSA9PSBcInRydWVcIjtcblxuICAgICAgICAgICAgcmVhZGVyLnJlYWRUdXBsZSh0dXBsZSk7XG4gICAgICAgICAgICB2YXIgeCA9IHBhcnNlSW50KHR1cGxlWzBdLCAxMCk7XG4gICAgICAgICAgICB2YXIgeSA9IHBhcnNlSW50KHR1cGxlWzFdLCAxMCk7XG5cbiAgICAgICAgICAgIHJlYWRlci5yZWFkVHVwbGUodHVwbGUpO1xuICAgICAgICAgICAgdmFyIHdpZHRoID0gcGFyc2VJbnQodHVwbGVbMF0sIDEwKTtcbiAgICAgICAgICAgIHZhciBoZWlnaHQgPSBwYXJzZUludCh0dXBsZVsxXSwgMTApO1xuXG4gICAgICAgICAgICByZWdpb24udSA9IHggLyBwYWdlLndpZHRoO1xuICAgICAgICAgICAgcmVnaW9uLnYgPSB5IC8gcGFnZS5oZWlnaHQ7XG4gICAgICAgICAgICBpZiAocmVnaW9uLnJvdGF0ZSkge1xuICAgICAgICAgICAgICAgIHJlZ2lvbi51MiA9ICh4ICsgaGVpZ2h0KSAvIHBhZ2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgcmVnaW9uLnYyID0gKHkgKyB3aWR0aCkgLyBwYWdlLmhlaWdodDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVnaW9uLnUyID0gKHggKyB3aWR0aCkgLyBwYWdlLndpZHRoO1xuICAgICAgICAgICAgICAgIHJlZ2lvbi52MiA9ICh5ICsgaGVpZ2h0KSAvIHBhZ2UuaGVpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVnaW9uLnggPSB4O1xuICAgICAgICAgICAgcmVnaW9uLnkgPSB5O1xuICAgICAgICAgICAgcmVnaW9uLndpZHRoID0gTWF0aC5hYnMod2lkdGgpO1xuICAgICAgICAgICAgcmVnaW9uLmhlaWdodCA9IE1hdGguYWJzKGhlaWdodCk7XG5cbiAgICAgICAgICAgIGlmIChyZWFkZXIucmVhZFR1cGxlKHR1cGxlKSA9PSA0KSB7IC8vIHNwbGl0IGlzIG9wdGlvbmFsXG4gICAgICAgICAgICAgICAgcmVnaW9uLnNwbGl0cyA9IFtwYXJzZUludCh0dXBsZVswXSwgMTApLCBwYXJzZUludCh0dXBsZVsxXSwgMTApLCBwYXJzZUludCh0dXBsZVsyXSwgMTApLCBwYXJzZUludCh0dXBsZVszXSwgMTApXTtcblxuICAgICAgICAgICAgICAgIGlmIChyZWFkZXIucmVhZFR1cGxlKHR1cGxlKSA9PSA0KSB7IC8vIHBhZCBpcyBvcHRpb25hbCwgYnV0IG9ubHkgcHJlc2VudCB3aXRoIHNwbGl0c1xuICAgICAgICAgICAgICAgICAgICByZWdpb24ucGFkcyA9IFtwYXJzZUludCh0dXBsZVswXSwgMTApLCBwYXJzZUludCh0dXBsZVsxXSwgMTApLCBwYXJzZUludCh0dXBsZVsyXSwgMTApLCBwYXJzZUludCh0dXBsZVszXSwgMTApXTtcblxuICAgICAgICAgICAgICAgICAgICByZWFkZXIucmVhZFR1cGxlKHR1cGxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlZ2lvbi5vcmlnaW5hbFdpZHRoID0gcGFyc2VJbnQodHVwbGVbMF0sIDEwKTtcbiAgICAgICAgICAgIHJlZ2lvbi5vcmlnaW5hbEhlaWdodCA9IHBhcnNlSW50KHR1cGxlWzFdLCAxMCk7XG5cbiAgICAgICAgICAgIHJlYWRlci5yZWFkVHVwbGUodHVwbGUpO1xuICAgICAgICAgICAgcmVnaW9uLm9mZnNldFggPSBwYXJzZUludCh0dXBsZVswXSwgMTApO1xuICAgICAgICAgICAgcmVnaW9uLm9mZnNldFkgPSBwYXJzZUludCh0dXBsZVsxXSwgMTApO1xuXG4gICAgICAgICAgICByZWdpb24uaW5kZXggPSBwYXJzZUludChyZWFkZXIucmVhZFZhbHVlKCksIDEwKTtcblxuICAgICAgICAgICAgdGhpcy5yZWdpb25zLnB1c2gocmVnaW9uKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5zcGluZS5BdGxhcy5wcm90b3R5cGUgPSB7XG4gICAgZmluZFJlZ2lvbjogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgdmFyIHJlZ2lvbnMgPSB0aGlzLnJlZ2lvbnM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gcmVnaW9ucy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBpZiAocmVnaW9uc1tpXS5uYW1lID09IG5hbWUpIHJldHVybiByZWdpb25zW2ldO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIGRpc3Bvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHBhZ2VzID0gdGhpcy5wYWdlcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBwYWdlcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICB0aGlzLnRleHR1cmVMb2FkZXIudW5sb2FkKHBhZ2VzW2ldLnJlbmRlcmVyT2JqZWN0KTtcbiAgICB9LFxuICAgIHVwZGF0ZVVWczogZnVuY3Rpb24gKHBhZ2UpIHtcbiAgICAgICAgdmFyIHJlZ2lvbnMgPSB0aGlzLnJlZ2lvbnM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gcmVnaW9ucy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciByZWdpb24gPSByZWdpb25zW2ldO1xuICAgICAgICAgICAgaWYgKHJlZ2lvbi5wYWdlICE9IHBhZ2UpIGNvbnRpbnVlO1xuICAgICAgICAgICAgcmVnaW9uLnUgPSByZWdpb24ueCAvIHBhZ2Uud2lkdGg7XG4gICAgICAgICAgICByZWdpb24udiA9IHJlZ2lvbi55IC8gcGFnZS5oZWlnaHQ7XG4gICAgICAgICAgICBpZiAocmVnaW9uLnJvdGF0ZSkge1xuICAgICAgICAgICAgICAgIHJlZ2lvbi51MiA9IChyZWdpb24ueCArIHJlZ2lvbi5oZWlnaHQpIC8gcGFnZS53aWR0aDtcbiAgICAgICAgICAgICAgICByZWdpb24udjIgPSAocmVnaW9uLnkgKyByZWdpb24ud2lkdGgpIC8gcGFnZS5oZWlnaHQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlZ2lvbi51MiA9IChyZWdpb24ueCArIHJlZ2lvbi53aWR0aCkgLyBwYWdlLndpZHRoO1xuICAgICAgICAgICAgICAgIHJlZ2lvbi52MiA9IChyZWdpb24ueSArIHJlZ2lvbi5oZWlnaHQpIC8gcGFnZS5oZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zcGluZS5BdGxhcy5Gb3JtYXQgPSB7XG4gICAgYWxwaGE6IDAsXG4gICAgaW50ZW5zaXR5OiAxLFxuICAgIGx1bWluYW5jZUFscGhhOiAyLFxuICAgIHJnYjU2NTogMyxcbiAgICByZ2JhNDQ0NDogNCxcbiAgICByZ2I4ODg6IDUsXG4gICAgcmdiYTg4ODg6IDZcbn07XG5cbnNwaW5lLkF0bGFzLlRleHR1cmVGaWx0ZXIgPSB7XG4gICAgbmVhcmVzdDogMCxcbiAgICBsaW5lYXI6IDEsXG4gICAgbWlwTWFwOiAyLFxuICAgIG1pcE1hcE5lYXJlc3ROZWFyZXN0OiAzLFxuICAgIG1pcE1hcExpbmVhck5lYXJlc3Q6IDQsXG4gICAgbWlwTWFwTmVhcmVzdExpbmVhcjogNSxcbiAgICBtaXBNYXBMaW5lYXJMaW5lYXI6IDZcbn07XG5cbnNwaW5lLkF0bGFzLlRleHR1cmVXcmFwID0ge1xuICAgIG1pcnJvcmVkUmVwZWF0OiAwLFxuICAgIGNsYW1wVG9FZGdlOiAxLFxuICAgIHJlcGVhdDogMlxufTtcblxuc3BpbmUuQXRsYXNQYWdlID0gZnVuY3Rpb24gKCkge307XG5zcGluZS5BdGxhc1BhZ2UucHJvdG90eXBlID0ge1xuICAgIG5hbWU6IG51bGwsXG4gICAgZm9ybWF0OiBudWxsLFxuICAgIG1pbkZpbHRlcjogbnVsbCxcbiAgICBtYWdGaWx0ZXI6IG51bGwsXG4gICAgdVdyYXA6IG51bGwsXG4gICAgdldyYXA6IG51bGwsXG4gICAgcmVuZGVyZXJPYmplY3Q6IG51bGwsXG4gICAgd2lkdGg6IDAsXG4gICAgaGVpZ2h0OiAwXG59O1xuXG5zcGluZS5BdGxhc1JlZ2lvbiA9IGZ1bmN0aW9uICgpIHt9O1xuc3BpbmUuQXRsYXNSZWdpb24ucHJvdG90eXBlID0ge1xuICAgIHBhZ2U6IG51bGwsXG4gICAgbmFtZTogbnVsbCxcbiAgICB4OiAwLCB5OiAwLFxuICAgIHdpZHRoOiAwLCBoZWlnaHQ6IDAsXG4gICAgdTogMCwgdjogMCwgdTI6IDAsIHYyOiAwLFxuICAgIG9mZnNldFg6IDAsIG9mZnNldFk6IDAsXG4gICAgb3JpZ2luYWxXaWR0aDogMCwgb3JpZ2luYWxIZWlnaHQ6IDAsXG4gICAgaW5kZXg6IDAsXG4gICAgcm90YXRlOiBmYWxzZSxcbiAgICBzcGxpdHM6IG51bGwsXG4gICAgcGFkczogbnVsbCxcbn07XG5cbnNwaW5lLkF0bGFzUmVhZGVyID0gZnVuY3Rpb24gKHRleHQpIHtcbiAgICB0aGlzLmxpbmVzID0gdGV4dC5zcGxpdCgvXFxyXFxufFxccnxcXG4vKTtcbn07XG5zcGluZS5BdGxhc1JlYWRlci5wcm90b3R5cGUgPSB7XG4gICAgaW5kZXg6IDAsXG4gICAgdHJpbTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCBcIlwiKTtcbiAgICB9LFxuICAgIHJlYWRMaW5lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLmluZGV4ID49IHRoaXMubGluZXMubGVuZ3RoKSByZXR1cm4gbnVsbDtcbiAgICAgICAgcmV0dXJuIHRoaXMubGluZXNbdGhpcy5pbmRleCsrXTtcbiAgICB9LFxuICAgIHJlYWRWYWx1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbGluZSA9IHRoaXMucmVhZExpbmUoKTtcbiAgICAgICAgdmFyIGNvbG9uID0gbGluZS5pbmRleE9mKFwiOlwiKTtcbiAgICAgICAgaWYgKGNvbG9uID09IC0xKSB0aHJvdyBcIkludmFsaWQgbGluZTogXCIgKyBsaW5lO1xuICAgICAgICByZXR1cm4gdGhpcy50cmltKGxpbmUuc3Vic3RyaW5nKGNvbG9uICsgMSkpO1xuICAgIH0sXG4gICAgLyoqIFJldHVybnMgdGhlIG51bWJlciBvZiB0dXBsZSB2YWx1ZXMgcmVhZCAoMiBvciA0KS4gKi9cbiAgICByZWFkVHVwbGU6IGZ1bmN0aW9uICh0dXBsZSkge1xuICAgICAgICB2YXIgbGluZSA9IHRoaXMucmVhZExpbmUoKTtcbiAgICAgICAgdmFyIGNvbG9uID0gbGluZS5pbmRleE9mKFwiOlwiKTtcbiAgICAgICAgaWYgKGNvbG9uID09IC0xKSB0aHJvdyBcIkludmFsaWQgbGluZTogXCIgKyBsaW5lO1xuICAgICAgICB2YXIgaSA9IDAsIGxhc3RNYXRjaD0gY29sb24gKyAxO1xuICAgICAgICBmb3IgKDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgdmFyIGNvbW1hID0gbGluZS5pbmRleE9mKFwiLFwiLCBsYXN0TWF0Y2gpO1xuICAgICAgICAgICAgaWYgKGNvbW1hID09IC0xKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFpKSB0aHJvdyBcIkludmFsaWQgbGluZTogXCIgKyBsaW5lO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHVwbGVbaV0gPSB0aGlzLnRyaW0obGluZS5zdWJzdHIobGFzdE1hdGNoLCBjb21tYSAtIGxhc3RNYXRjaCkpO1xuICAgICAgICAgICAgbGFzdE1hdGNoID0gY29tbWEgKyAxO1xuICAgICAgICB9XG4gICAgICAgIHR1cGxlW2ldID0gdGhpcy50cmltKGxpbmUuc3Vic3RyaW5nKGxhc3RNYXRjaCkpO1xuICAgICAgICByZXR1cm4gaSArIDE7XG4gICAgfVxufVxuXG5zcGluZS5BdGxhc0F0dGFjaG1lbnRMb2FkZXIgPSBmdW5jdGlvbiAoYXRsYXMpIHtcbiAgICB0aGlzLmF0bGFzID0gYXRsYXM7XG59XG5zcGluZS5BdGxhc0F0dGFjaG1lbnRMb2FkZXIucHJvdG90eXBlID0ge1xuICAgIG5ld0F0dGFjaG1lbnQ6IGZ1bmN0aW9uIChza2luLCB0eXBlLCBuYW1lKSB7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIHNwaW5lLkF0dGFjaG1lbnRUeXBlLnJlZ2lvbjpcbiAgICAgICAgICAgIHZhciByZWdpb24gPSB0aGlzLmF0bGFzLmZpbmRSZWdpb24obmFtZSk7XG4gICAgICAgICAgICBpZiAoIXJlZ2lvbikgdGhyb3cgXCJSZWdpb24gbm90IGZvdW5kIGluIGF0bGFzOiBcIiArIG5hbWUgKyBcIiAoXCIgKyB0eXBlICsgXCIpXCI7XG4gICAgICAgICAgICB2YXIgYXR0YWNobWVudCA9IG5ldyBzcGluZS5SZWdpb25BdHRhY2htZW50KG5hbWUpO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdCA9IHJlZ2lvbjtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQuc2V0VVZzKHJlZ2lvbi51LCByZWdpb24udiwgcmVnaW9uLnUyLCByZWdpb24udjIsIHJlZ2lvbi5yb3RhdGUpO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZWdpb25PZmZzZXRYID0gcmVnaW9uLm9mZnNldFg7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlZ2lvbk9mZnNldFkgPSByZWdpb24ub2Zmc2V0WTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVnaW9uV2lkdGggPSByZWdpb24ud2lkdGg7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlZ2lvbkhlaWdodCA9IHJlZ2lvbi5oZWlnaHQ7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlZ2lvbk9yaWdpbmFsV2lkdGggPSByZWdpb24ub3JpZ2luYWxXaWR0aDtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVnaW9uT3JpZ2luYWxIZWlnaHQgPSByZWdpb24ub3JpZ2luYWxIZWlnaHQ7XG4gICAgICAgICAgICByZXR1cm4gYXR0YWNobWVudDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBcIlVua25vd24gYXR0YWNobWVudCB0eXBlOiBcIiArIHR5cGU7XG4gICAgfVxufVxuXG5zcGluZS5Cb25lLnlEb3duID0gdHJ1ZTtcbiIsInZhciBnbG9iYWw9dHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9Oy8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBUSElTIE1PRFVMRSBJUyBDT1BJRUQgVE8gVEhFIEJVSUxEIERJUkVDVE9SWVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFdoaWNoIGlzIHdoZXJlIHRoZSAncGl4aScgcGFja2FnZSBzaG91bGRcbi8vIGhhdmUgYWxzbyBiZWVuIGluc3RhbGxlZC5cblxuLy8gVGhlc2UgZ2xvYmFscyBhcmUgc2hpbXMgdG8gbWltaWMgdGhlIFBpeGkgQVBJLlxuLy8gVGhleSBhcmUgb25seSBhdmFpbGFibGUgd2hlbiB1c2luZyB0aGUgYnVuZGxlc1xuLy8gbWFkZSB3aXRoIHRoaXMgbW9kdWxlLlxuXG5nbG9iYWwuUElYSSA9IHJlcXVpcmUoJ3BpeGknKTtcbmdsb2JhbC5yZXF1ZXN0QW5pbUZyYW1lID0gcmVxdWlyZSgncGl4aS91dGlscy9yYWYnKTtcbiJdfQ==
