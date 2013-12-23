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

},{"../display/DisplayObjectContainer":4,"../display/Sprite":6,"../textures/Texture":63,"../utils/spine":68}],13:[function(require,module,exports){
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

var platform = require('./platform');
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

/*
 * DEBUGGING ONLY
 */
pixi.runList = function(item)
{
    platform.console.log('>>>>>>>>>');
    platform.console.log('_');
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
            platform.console.log('BREAK');
            break;
        }
    }
};

},{"./InteractionManager":1,"./core/globals":2,"./display/DisplayObject":3,"./display/DisplayObjectContainer":4,"./display/MovieClip":5,"./display/Sprite":6,"./display/Stage":7,"./display/blendModes":8,"./events/EventTarget":9,"./extras/CustomRenderable":10,"./extras/Rope":11,"./extras/Spine":12,"./extras/Strip":13,"./extras/TilingSprite":14,"./filters/AbstractFilter":15,"./filters/BlurFilter":16,"./filters/BlurXFilter":17,"./filters/BlurYFilter":18,"./filters/ColorMatrixFilter":19,"./filters/ColorStepFilter":20,"./filters/CrossHatchFilter":21,"./filters/DisplacementFilter":22,"./filters/DotScreenFilter":23,"./filters/FilterBlock":24,"./filters/GrayFilter":25,"./filters/InvertFilter":26,"./filters/PixelateFilter":27,"./filters/RGBSplitFilter":28,"./filters/SepiaFilter":29,"./filters/SmartBlurFilter":30,"./filters/TwistFilter":31,"./geom/Circle":32,"./geom/Ellipse":33,"./geom/Point":34,"./geom/Polygon":35,"./geom/Rectangle":36,"./geom/matrix":37,"./loaders/AssetLoader":39,"./loaders/BitmapFontLoader":40,"./loaders/ImageLoader":41,"./loaders/JsonLoader":42,"./loaders/SpineLoader":43,"./loaders/SpriteSheetLoader":44,"./platform":45,"./primitives/Graphics":46,"./renderers/canvas/CanvasRenderer":47,"./renderers/canvas/graphics":48,"./renderers/webgl/WebGLBatch":52,"./renderers/webgl/WebGLRenderGroup":54,"./renderers/webgl/WebGLRenderer":55,"./renderers/webgl/graphics":57,"./renderers/webgl/shaders":58,"./text/BitmapText":59,"./text/Text":60,"./textures/BaseTexture":61,"./textures/RenderTexture":62,"./textures/Texture":63,"./utils/Polyk":64,"./utils/autoDetectRenderer":65}],39:[function(require,module,exports){
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

},{"../events/EventTarget":9,"../extras/Spine":12,"../platform":45,"../textures/Texture":63,"../utils/spine":68,"./AssetLoader":39,"./ImageLoader":41}],43:[function(require,module,exports){
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


},{"../events/EventTarget":9,"../extras/Spine":12,"../utils/spine":68,"./AssetLoader":39,"./JsonLoader":42}],44:[function(require,module,exports){
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

},{}],68:[function(require,module,exports){
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

},{}],69:[function(require,module,exports){
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

},{"pixi":38,"pixi/utils/raf":67}]},{},[69])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9JbnRlcmFjdGlvbk1hbmFnZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9jb3JlL2dsb2JhbHMuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L0Rpc3BsYXlPYmplY3QuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9kaXNwbGF5L01vdmllQ2xpcC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2Rpc3BsYXkvU3ByaXRlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZGlzcGxheS9TdGFnZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2Rpc3BsYXkvYmxlbmRNb2Rlcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2V2ZW50cy9FdmVudFRhcmdldC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2V4dHJhcy9DdXN0b21SZW5kZXJhYmxlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZXh0cmFzL1JvcGUuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvU3BpbmUuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvU3RyaXAuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9leHRyYXMvVGlsaW5nU3ByaXRlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9BYnN0cmFjdEZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvQmx1ckZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvQmx1clhGaWx0ZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL0JsdXJZRmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9Db2xvck1hdHJpeEZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvQ29sb3JTdGVwRmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9Dcm9zc0hhdGNoRmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9EaXNwbGFjZW1lbnRGaWx0ZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL0RvdFNjcmVlbkZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvRmlsdGVyQmxvY2suanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL0dyYXlGaWx0ZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL0ludmVydEZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvUGl4ZWxhdGVGaWx0ZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9maWx0ZXJzL1JHQlNwbGl0RmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9TZXBpYUZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2ZpbHRlcnMvU21hcnRCbHVyRmlsdGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZmlsdGVycy9Ud2lzdEZpbHRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vQ2lyY2xlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9FbGxpcHNlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9Qb2ludC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vUG9seWdvbi5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2dlb20vUmVjdGFuZ2xlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvZ2VvbS9tYXRyaXguanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9pbmRleC5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2xvYWRlcnMvQXNzZXRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9sb2FkZXJzL0JpdG1hcEZvbnRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9sb2FkZXJzL0ltYWdlTG9hZGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvbG9hZGVycy9Kc29uTG9hZGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvbG9hZGVycy9TcGluZUxvYWRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL2xvYWRlcnMvU3ByaXRlU2hlZXRMb2FkZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9wbGF0Zm9ybS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3ByaW1pdGl2ZXMvR3JhcGhpY3MuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9yZW5kZXJlcnMvY2FudmFzL0NhbnZhc1JlbmRlcmVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL2NhbnZhcy9ncmFwaGljcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9QaXhpU2hhZGVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL3dlYmdsL1ByaW1pdGl2ZVNoYWRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9TdHJpcFNoYWRlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9XZWJHTEJhdGNoLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL3dlYmdsL1dlYkdMRmlsdGVyTWFuYWdlci5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9XZWJHTFJlbmRlckdyb3VwLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvcmVuZGVyZXJzL3dlYmdsL1dlYkdMUmVuZGVyZXIuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS9yZW5kZXJlcnMvd2ViZ2wvY29tcGlsZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9ncmFwaGljcy5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3JlbmRlcmVycy93ZWJnbC9zaGFkZXJzLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dC9CaXRtYXBUZXh0LmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dC9UZXh0LmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dHVyZXMvQmFzZVRleHR1cmUuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS90ZXh0dXJlcy9SZW5kZXJUZXh0dXJlLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdGV4dHVyZXMvVGV4dHVyZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL25vZGVfbW9kdWxlcy9waXhpL3V0aWxzL1BvbHlrLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdXRpbHMvYXV0b0RldGVjdFJlbmRlcmVyLmpzIiwiL1VzZXJzL2ppc2FhY3MvRGV2ZWxvcG1lbnQvaG9tZS9ub2RlLXBpeGkvYnVpbGQvbm9kZV9tb2R1bGVzL3BpeGkvdXRpbHMvY29sb3IuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS91dGlscy9yYWYuanMiLCIvVXNlcnMvamlzYWFjcy9EZXZlbG9wbWVudC9ob21lL25vZGUtcGl4aS9idWlsZC9ub2RlX21vZHVsZXMvcGl4aS91dGlscy9zcGluZS5qcyIsIi9Vc2Vycy9qaXNhYWNzL0RldmVsb3BtZW50L2hvbWUvbm9kZS1waXhpL2J1aWxkL3BpeGktZGVidWcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNscUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9qQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1UkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pnQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbG1DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeDBDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuL2NvcmUvZ2xvYmFscycpO1xudmFyIFBvaW50ID0gcmVxdWlyZSgnLi9nZW9tL1BvaW50Jyk7XG52YXIgU3ByaXRlID0gcmVxdWlyZSgnLi9kaXNwbGF5L1Nwcml0ZScpO1xudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi9wbGF0Zm9ybScpO1xuXG4vKipcbiAqIEhvbGRzIGFsbCBpbmZvcm1hdGlvbiByZWxhdGVkIHRvIGFuIEludGVyYWN0aW9uIGV2ZW50XG4gKlxuICogQGNsYXNzIEludGVyYWN0aW9uRGF0YVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEludGVyYWN0aW9uRGF0YSgpXG57XG4gICAgLyoqXG4gICAgICogVGhpcyBwb2ludCBzdG9yZXMgdGhlIHdvcmxkIGNvb3JkcyBvZiB3aGVyZSB0aGUgdG91Y2gvbW91c2UgZXZlbnQgaGFwcGVuZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBnbG9iYWxcbiAgICAgKiBAdHlwZSBQb2ludFxuICAgICAqL1xuICAgIHRoaXMuZ2xvYmFsID0gbmV3IFBvaW50KCk7XG5cbiAgICAvLyB0aGlzIGlzIGhlcmUgZm9yIGxlZ2FjeS4uLiBidXQgd2lsbCByZW1vdmVcbiAgICB0aGlzLmxvY2FsID0gbmV3IFBvaW50KCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGFyZ2V0IFNwcml0ZSB0aGF0IHdhcyBpbnRlcmFjdGVkIHdpdGhcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0YXJnZXRcbiAgICAgKiBAdHlwZSBTcHJpdGVcbiAgICAgKi9cbiAgICB0aGlzLnRhcmdldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBXaGVuIHBhc3NlZCB0byBhbiBldmVudCBoYW5kbGVyLCB0aGlzIHdpbGwgYmUgdGhlIG9yaWdpbmFsIERPTSBFdmVudCB0aGF0IHdhcyBjYXB0dXJlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IG9yaWdpbmFsRXZlbnRcbiAgICAgKiBAdHlwZSBFdmVudFxuICAgICAqL1xuICAgIHRoaXMub3JpZ2luYWxFdmVudCA9IG51bGw7XG59XG5cbi8qKlxuICogVGhpcyB3aWxsIHJldHVybiB0aGUgbG9jYWwgY29vcmRzIG9mIHRoZSBzcGVjaWZpZWQgZGlzcGxheU9iamVjdCBmb3IgdGhpcyBJbnRlcmFjdGlvbkRhdGFcbiAqXG4gKiBAbWV0aG9kIGdldExvY2FsUG9zaXRpb25cbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fSBUaGUgRGlzcGxheU9iamVjdCB0aGF0IHlvdSB3b3VsZCBsaWtlIHRoZSBsb2NhbCBjb29yZHMgb2ZmXG4gKiBAcmV0dXJuIHtQb2ludH0gQSBwb2ludCBjb250YWluaW5nIHRoZSBjb29yZHMgb2YgdGhlIEludGVyYWN0aW9uRGF0YSBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgRGlzcGxheU9iamVjdFxuICovXG5JbnRlcmFjdGlvbkRhdGEucHJvdG90eXBlLmdldExvY2FsUG9zaXRpb24gPSBmdW5jdGlvbiBnZXRMb2NhbFBvc2l0aW9uKGRpc3BsYXlPYmplY3QpXG57XG4gICAgdmFyIHdvcmxkVHJhbnNmb3JtID0gZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybTtcbiAgICB2YXIgd29ybGQgPSB0aGlzLmdsb2JhbDtcblxuICAgIC8vIGRvIGEgY2hlZWt5IHRyYW5zZm9ybSB0byBnZXQgdGhlIG1vdXNlIGNvb3JkcztcbiAgICB2YXIgYTAwID0gd29ybGRUcmFuc2Zvcm1bMF0sIGEwMSA9IHdvcmxkVHJhbnNmb3JtWzFdLCBhMDIgPSB3b3JsZFRyYW5zZm9ybVsyXSxcbiAgICAgICAgYTEwID0gd29ybGRUcmFuc2Zvcm1bM10sIGExMSA9IHdvcmxkVHJhbnNmb3JtWzRdLCBhMTIgPSB3b3JsZFRyYW5zZm9ybVs1XSxcbiAgICAgICAgaWQgPSAxIC8gKGEwMCAqIGExMSArIGEwMSAqIC1hMTApO1xuICAgIC8vIHNldCB0aGUgbW91c2UgY29vcmRzLi4uXG4gICAgcmV0dXJuIG5ldyBQb2ludChhMTEgKiBpZCAqIHdvcmxkLnggKyAtYTAxICogaWQgKiB3b3JsZC55ICsgKGExMiAqIGEwMSAtIGEwMiAqIGExMSkgKiBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhMDAgKiBpZCAqIHdvcmxkLnkgKyAtYTEwICogaWQgKiB3b3JsZC54ICsgKC1hMTIgKiBhMDAgKyBhMDIgKiBhMTApICogaWQpO1xufTtcblxuIC8qKlxuICogVGhlIGludGVyYWN0aW9uIG1hbmFnZXIgZGVhbHMgd2l0aCBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzLiBBbnkgRGlzcGxheU9iamVjdCBjYW4gYmUgaW50ZXJhY3RpdmVcbiAqIFRoaXMgbWFuYWdlciBhbHNvIHN1cHBvcnRzIG11bHRpdG91Y2guXG4gKlxuICogQGNsYXNzIEludGVyYWN0aW9uTWFuYWdlclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gc3RhZ2Uge1N0YWdlfSBUaGUgc3RhZ2UgdG8gaGFuZGxlIGludGVyYWN0aW9uc1xuICovXG5mdW5jdGlvbiBJbnRlcmFjdGlvbk1hbmFnZXIoc3RhZ2UpXG57XG4gICAgLyoqXG4gICAgICogYSByZWZmZXJlbmNlIHRvIHRoZSBzdGFnZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHN0YWdlXG4gICAgICogQHR5cGUgU3RhZ2VcbiAgICAgKi9cbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG5cbiAgICAvKipcbiAgICAgKiB0aGUgbW91c2UgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IG1vdXNlXG4gICAgICogQHR5cGUgSW50ZXJhY3Rpb25EYXRhXG4gICAgICovXG4gICAgdGhpcy5tb3VzZSA9IG5ldyBJbnRlcmFjdGlvbkRhdGEoKTtcblxuICAgIC8qKlxuICAgICAqIGFuIG9iamVjdCB0aGF0IHN0b3JlcyBjdXJyZW50IHRvdWNoZXMgKEludGVyYWN0aW9uRGF0YSkgYnkgaWQgcmVmZXJlbmNlXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdG91Y2hzXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgdGhpcy50b3VjaHMgPSB7fTtcblxuICAgIC8vIGhlbHBlcnNcbiAgICB0aGlzLnRlbXBQb2ludCA9IG5ldyBQb2ludCgpO1xuICAgIC8vdGhpcy50ZW1wTWF0cml4ID0gIG1hdDMuY3JlYXRlKCk7XG5cbiAgICB0aGlzLm1vdXNlb3ZlckVuYWJsZWQgPSB0cnVlO1xuXG4gICAgLy90aW55IGxpdHRsZSBpbnRlcmFjdGl2ZURhdGEgcG9vbCFcbiAgICB0aGlzLnBvb2wgPSBbXTtcblxuICAgIHRoaXMuaW50ZXJhY3RpdmVJdGVtcyA9IFtdO1xuICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50ID0gbnVsbDtcblxuICAgIHRoaXMubGFzdCA9IDA7XG59XG5cbnZhciBwcm90byA9IEludGVyYWN0aW9uTWFuYWdlci5wcm90b3R5cGU7XG5cbi8qKlxuICogRXZlbnRMaXN0ZW5lciBpbnRlcmZhY2VcbiAqL1xucHJvdG8uaGFuZGxlRXZlbnQgPSBmdW5jdGlvbiBoYW5kbGVFdmVudChldmVudClcbntcbiAgICAvKmpzaGludCAtVzAxNSovXG4gICAgc3dpdGNoIChldmVudC50eXBlKSB7XG4gICAgY2FzZSAnbW91c2Vkb3duJyA6IHRoaXMub25Nb3VzZURvd24oZXZlbnQpOyBicmVhaztcbiAgICBjYXNlICdtb3VzZW1vdmUnIDogdGhpcy5vbk1vdXNlTW92ZShldmVudCk7IGJyZWFrO1xuICAgIGNhc2UgJ21vdXNldXAnICAgOiB0aGlzLm9uTW91c2VVcChldmVudCk7ICAgYnJlYWs7XG4gICAgY2FzZSAnbW91c2VvdXQnICA6IHRoaXMub25Nb3VzZU91dChldmVudCk7ICBicmVhaztcblxuICAgIGNhc2UgJ3RvdWNoc3RhcnQnIDogdGhpcy5vblRvdWNoU3RhcnQoZXZlbnQpOyBicmVhaztcbiAgICBjYXNlICd0b3VjaG1vdmUnICA6IHRoaXMub25Ub3VjaE1vdmUoZXZlbnQpOyAgYnJlYWs7XG4gICAgY2FzZSAndG91Y2hlbmQnICAgOiB0aGlzLm9uVG91Y2hFbmQoZXZlbnQpOyAgIGJyZWFrO1xuICAgIH1cbn07XG5cbi8qKlxuICogQ29sbGVjdHMgYW4gaW50ZXJhY3RpdmUgc3ByaXRlIHJlY3Vyc2l2ZWx5IHRvIGhhdmUgdGhlaXIgaW50ZXJhY3Rpb25zIG1hbmFnZWRcbiAqXG4gKiBAbWV0aG9kIGNvbGxlY3RJbnRlcmFjdGl2ZVNwcml0ZVxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9IHRoZSBkaXNwbGF5T2JqZWN0IHRvIGNvbGxlY3RcbiAqIEBwYXJhbSBpUGFyZW50IHtEaXNwbGF5T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uY29sbGVjdEludGVyYWN0aXZlU3ByaXRlID0gZnVuY3Rpb24gY29sbGVjdEludGVyYWN0aXZlU3ByaXRlKGRpc3BsYXlPYmplY3QsIGlQYXJlbnQpXG57XG4gICAgdmFyIGNoaWxkcmVuID0gZGlzcGxheU9iamVjdC5jaGlsZHJlbjtcblxuICAgIC8vLyBtYWtlIGFuIGludGVyYWN0aW9uIHRyZWUuLi4ge2l0ZW0uX19pbnRlcmFjdGl2ZVBhcmVudH1cbiAgICBmb3IgKHZhciBpID0gY2hpbGRyZW4ubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pXG4gICAge1xuICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXTtcblxuLy8gICAgICBpZihjaGlsZC52aXNpYmxlKSB7XG4gICAgICAgIC8vIHB1c2ggYWxsIGludGVyYWN0aXZlIGJpdHNcbiAgICAgICAgaWYoY2hpbGQuaW50ZXJhY3RpdmUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlQYXJlbnQuaW50ZXJhY3RpdmVDaGlsZHJlbiA9IHRydWU7XG4gICAgICAgICAgICAvL2NoaWxkLl9faVBhcmVudCA9IGlQYXJlbnQ7XG4gICAgICAgICAgICB0aGlzLmludGVyYWN0aXZlSXRlbXMucHVzaChjaGlsZCk7XG5cbiAgICAgICAgICAgIGlmKGNoaWxkLmNoaWxkcmVuLmxlbmd0aCA+IDApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb2xsZWN0SW50ZXJhY3RpdmVTcHJpdGUoY2hpbGQsIGNoaWxkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNoaWxkLl9faVBhcmVudCA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmKGNoaWxkLmNoaWxkcmVuLmxlbmd0aCA+IDApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb2xsZWN0SW50ZXJhY3RpdmVTcHJpdGUoY2hpbGQsIGlQYXJlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4vLyAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIFNldHMgdGhlIHRhcmdldCBmb3IgZXZlbnQgZGVsZWdhdGlvblxuICpcbiAqIEBtZXRob2Qgc2V0VGFyZ2V0XG4gKiBAcGFyYW0gdGFyZ2V0IHtXZWJHTFJlbmRlcmVyfENhbnZhc1JlbmRlcmVyfSB0aGUgcmVuZGVyZXIgdG8gYmluZCBldmVudHMgdG9cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnNldFRhcmdldCA9IGZ1bmN0aW9uIHNldFRhcmdldCh0YXJnZXQpXG57XG4gICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0ICE9PSBudWxsKSBwbGF0Zm9ybS53aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQgPT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5zZXRUYXJnZXREb21FbGVtZW50KCB0YXJnZXQudmlldyApO1xuICAgIH1cblxuICAgIHBsYXRmb3JtLndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcywgdHJ1ZSk7XG4gICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG59O1xuXG4vKipcbiAqIFNldHMgdGhlIGRvbSBlbGVtZW50IHdoaWNoIHdpbGwgcmVjZWl2ZSBtb3VzZS90b3VjaCBldmVudHMuIFRoaXMgaXMgdXNlZnVsIGZvciB3aGVuIHlvdSBoYXZlIG90aGVyIERPTVxuICogZWxlbWVudHMgb250b3Agb2YgdGhlIHJlbmRlcmVycyBDYW52YXMgZWxlbWVudC4gV2l0aCB0aGlzIHlvdSdsbCBiZSBhYmxlIHRvIGRlbGVnYXRlIGFub3RoZXIgZG9tIGVsZW1lbnRcbiAqIHRvIHJlY2VpdmUgdGhvc2UgZXZlbnRzXG4gKlxuICogQG1ldGhvZCBzZXRUYXJnZXREb21FbGVtZW50XG4gKiBAcGFyYW0gZG9tRWxlbWVudCB7RE9NRWxlbWVudH0gdGhlIGRvbSBlbGVtZW50IHdoaWNoIHdpbGwgcmVjZWl2ZSBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5zZXRUYXJnZXREb21FbGVtZW50ID0gZnVuY3Rpb24gc2V0VGFyZ2V0RG9tRWxlbWVudChkb21FbGVtZW50KVxue1xuICAgIC8vcmVtb3ZlIHByZXZpb3VzZSBsaXN0ZW5lcnNcbiAgICBpZiAodGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuc3R5bGVbJy1tcy1jb250ZW50LXpvb21pbmcnXSA9ICcnO1xuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5zdHlsZVsnLW1zLXRvdWNoLWFjdGlvbiddID0gJyc7XG5cbiAgICAgICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcywgdHJ1ZSk7XG4gICAgICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMsIHRydWUpO1xuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW91dCcsIHRoaXMsIHRydWUpO1xuICAgICAgICAvLyBhaW50IG5vIG11bHRpIHRvdWNoIGp1c3QgeWV0IVxuICAgICAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcywgdHJ1ZSk7XG4gICAgICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcywgdHJ1ZSk7XG4gICAgICAgIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMsIHRydWUpO1xuICAgIH1cblxuICAgIHZhciBuYXZpZ2F0b3IgPSBwbGF0Zm9ybS5uYXZpZ2F0b3I7XG4gICAgaWYgKG5hdmlnYXRvciAmJiBuYXZpZ2F0b3IubXNQb2ludGVyRW5hYmxlZCkge1xuICAgICAgICAvLyB0aW1lIHRvIHJlbW92ZSBzb21lIG9mIHRoYXQgem9vbSBpbiBqYS4uXG4gICAgICAgIGRvbUVsZW1lbnQuc3R5bGVbJy1tcy1jb250ZW50LXpvb21pbmcnXSA9ICdub25lJztcbiAgICAgICAgZG9tRWxlbWVudC5zdHlsZVsnLW1zLXRvdWNoLWFjdGlvbiddID0gJ25vbmUnO1xuICAgICAgICAvLyBETyBzb21lIHdpbmRvdyBzcGVjaWZpYyB0b3VjaCFcbiAgICB9XG5cbiAgICBkb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMsIHRydWUpO1xuICAgIGRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcywgdHJ1ZSk7XG4gICAgZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW91dCcsIHRoaXMsIHRydWUpO1xuICAgIC8vIGFpbnQgbm8gbXVsdGkgdG91Y2gganVzdCB5ZXQhXG4gICAgZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcywgdHJ1ZSk7XG4gICAgZG9tRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMsIHRydWUpO1xuICAgIGRvbUVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcywgdHJ1ZSk7XG5cbiAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudCA9IGRvbUVsZW1lbnQ7XG59O1xuXG5cbi8qKlxuICogdXBkYXRlcyB0aGUgc3RhdGUgb2YgaW50ZXJhY3RpdmUgb2JqZWN0c1xuICpcbiAqIEBtZXRob2QgdXBkYXRlXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGUgPSBmdW5jdGlvbiB1cGRhdGUoKVxue1xuICAgIGlmKCF0aGlzLnRhcmdldClyZXR1cm47XG5cbiAgICAvLyBmcmVxdWVuY3kgb2YgMzBmcHM/P1xuICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xuICAgIHZhciBkaWZmID0gbm93IC0gdGhpcy5sYXN0O1xuICAgIGRpZmYgPSAoZGlmZiAqIDMwKSAvIDEwMDA7XG4gICAgaWYgKGRpZmYgPCAxKSByZXR1cm47XG4gICAgdGhpcy5sYXN0ID0gbm93O1xuICAgIC8vXG5cbiAgICB2YXIgaSwgbDtcblxuICAgIC8vIG9rLi4gc28gbW91c2UgZXZlbnRzPz9cbiAgICAvLyB5ZXMgZm9yIG5vdyA6KVxuICAgIC8vIE9QVElNU0UgLSBob3cgb2Z0ZW4gdG8gY2hlY2s/P1xuICAgIGlmKHRoaXMuZGlydHkpXG4gICAge1xuICAgICAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgZm9yIChpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXS5pbnRlcmFjdGl2ZUNoaWxkcmVuID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmludGVyYWN0aXZlSXRlbXMgPSBbXTtcblxuICAgICAgICBpZiAodGhpcy5zdGFnZS5pbnRlcmFjdGl2ZSkgdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLnB1c2godGhpcy5zdGFnZSk7XG4gICAgICAgIC8vIGdvIHRocm91Z2ggYW5kIGNvbGxlY3QgYWxsIHRoZSBvYmplY3RzIHRoYXQgYXJlIGludGVyYWN0aXZlLi5cbiAgICAgICAgdGhpcy5jb2xsZWN0SW50ZXJhY3RpdmVTcHJpdGUodGhpcy5zdGFnZSwgdGhpcy5zdGFnZSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuc3R5bGUuY3Vyc29yID0gJ2luaGVyaXQnO1xuXG4gICAgLy8gbG9vcCB0aHJvdWdoIGludGVyYWN0aXZlIG9iamVjdHMhXG4gICAgZm9yIChpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcblxuXG4gICAgICAgIC8vaWYoIWl0ZW0udmlzaWJsZSljb250aW51ZTtcblxuICAgICAgICAvLyBPUFRJTUlTQVRJT04gLSBvbmx5IGNhbGN1bGF0ZSBldmVyeSB0aW1lIGlmIHRoZSBtb3VzZW1vdmUgZnVuY3Rpb24gZXhpc3RzLi5cbiAgICAgICAgLy8gT0sgc28uLiBkb2VzIHRoZSBvYmplY3QgaGF2ZSBhbnkgb3RoZXIgaW50ZXJhY3RpdmUgZnVuY3Rpb25zP1xuICAgICAgICAvLyBoaXQtdGVzdCB0aGUgY2xpcCFcblxuXG4gICAgICAgIGlmKGl0ZW0ubW91c2VvdmVyIHx8IGl0ZW0ubW91c2VvdXQgfHwgaXRlbS5idXR0b25Nb2RlKVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBvayBzbyB0aGVyZSBhcmUgc29tZSBmdW5jdGlvbnMgc28gbGV0cyBoaXQgdGVzdCBpdC4uXG4gICAgICAgICAgICBpdGVtLl9faGl0ID0gdGhpcy5oaXRUZXN0KGl0ZW0sIHRoaXMubW91c2UpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZS50YXJnZXQgPSBpdGVtO1xuICAgICAgICAgICAgLy8gb2sgc28gZGVhbCB3aXRoIGludGVyYWN0aW9ucy4uXG4gICAgICAgICAgICAvLyBsb2tzIGxpa2UgdGhlcmUgd2FzIGEgaGl0IVxuICAgICAgICAgICAgaWYoaXRlbS5fX2hpdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihpdGVtLmJ1dHRvbk1vZGUpIHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LnN0eWxlLmN1cnNvciA9IGl0ZW0uZGVmYXVsdEN1cnNvcjtcblxuICAgICAgICAgICAgICAgIGlmKCFpdGVtLl9faXNPdmVyKVxuICAgICAgICAgICAgICAgIHtcblxuICAgICAgICAgICAgICAgICAgICBpZihpdGVtLm1vdXNlb3ZlcilpdGVtLm1vdXNlb3Zlcih0aGlzLm1vdXNlKTtcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5fX2lzT3ZlciA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0uX19pc092ZXIpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAvLyByb2xsIG91dCFcbiAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS5tb3VzZW91dClpdGVtLm1vdXNlb3V0KHRoaXMubW91c2UpO1xuICAgICAgICAgICAgICAgICAgICBpdGVtLl9faXNPdmVyID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIC0tLT5cbiAgICB9XG59O1xuXG4vKipcbiAqIElzIGNhbGxlZCB3aGVuIHRoZSBtb3VzZSBtb3ZlcyBhY2Nyb3NzIHRoZSByZW5kZXJlciBlbGVtZW50XG4gKlxuICogQG1ldGhvZCBvbk1vdXNlTW92ZVxuICogQHBhcmFtIGV2ZW50IHtFdmVudH0gVGhlIERPTSBldmVudCBvZiB0aGUgbW91c2UgbW92aW5nXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbk1vdXNlTW92ZSA9IGZ1bmN0aW9uIG9uTW91c2VNb3ZlKGV2ZW50KVxue1xuICAgIHRoaXMubW91c2Uub3JpZ2luYWxFdmVudCA9IGV2ZW50O1xuICAgIC8vIFRPRE8gb3B0aW1pemUgYnkgbm90IGNoZWNrIEVWRVJZIFRJTUUhIG1heWJlIGhhbGYgYXMgb2Z0ZW4/IC8vXG4gICAgdmFyIHJlY3QgPSB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgIHRoaXMubW91c2UuZ2xvYmFsLnggPSAoZXZlbnQuY2xpZW50WCAtIHJlY3QubGVmdCkgKiAodGhpcy50YXJnZXQud2lkdGggLyByZWN0LndpZHRoKTtcbiAgICB0aGlzLm1vdXNlLmdsb2JhbC55ID0gKGV2ZW50LmNsaWVudFkgLSByZWN0LnRvcCkgKiAoIHRoaXMudGFyZ2V0LmhlaWdodCAvIHJlY3QuaGVpZ2h0KTtcblxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBpdGVtID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2ldO1xuICAgICAgICBpZiAoaXRlbS5tb3VzZW1vdmUpIHtcbiAgICAgICAgICAgIC8vY2FsbCB0aGUgZnVuY3Rpb24hXG4gICAgICAgICAgICBpdGVtLm1vdXNlbW92ZSh0aGlzLm1vdXNlKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogSXMgY2FsbGVkIHdoZW4gdGhlIG1vdXNlIGJ1dHRvbiBpcyBwcmVzc2VkIGRvd24gb24gdGhlIHJlbmRlcmVyIGVsZW1lbnRcbiAqXG4gKiBAbWV0aG9kIG9uTW91c2VEb3duXG4gKiBAcGFyYW0gZXZlbnQge0V2ZW50fSBUaGUgRE9NIGV2ZW50IG9mIGEgbW91c2UgYnV0dG9uIGJlaW5nIHByZXNzZWQgZG93blxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Nb3VzZURvd24gPSBmdW5jdGlvbiBvbk1vdXNlRG93bihldmVudClcbntcbiAgICB0aGlzLm1vdXNlLm9yaWdpbmFsRXZlbnQgPSBldmVudDtcblxuICAgIC8vIGxvb3AgdGhyb3VnaCBpbnRlYWN0aW9uIHRyZWUuLi5cbiAgICAvLyBoaXQgdGVzdCBlYWNoIGl0ZW0hIC0+XG4gICAgLy8gZ2V0IGludGVyYWN0aXZlIGl0ZW1zIHVuZGVyIHBvaW50Pz9cbiAgICAvL3N0YWdlLl9faVxuXG4gICAgLy8gd2hpbGVcbiAgICAvLyBoaXQgdGVzdFxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBpdGVtID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zW2ldO1xuXG4gICAgICAgIGlmKGl0ZW0ubW91c2Vkb3duIHx8IGl0ZW0uY2xpY2spXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0ZW0uX19tb3VzZUlzRG93biA9IHRydWU7XG4gICAgICAgICAgICBpdGVtLl9faGl0ID0gdGhpcy5oaXRUZXN0KGl0ZW0sIHRoaXMubW91c2UpO1xuXG4gICAgICAgICAgICBpZihpdGVtLl9faGl0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vY2FsbCB0aGUgZnVuY3Rpb24hXG4gICAgICAgICAgICAgICAgaWYoaXRlbS5tb3VzZWRvd24paXRlbS5tb3VzZWRvd24odGhpcy5tb3VzZSk7XG4gICAgICAgICAgICAgICAgaXRlbS5fX2lzRG93biA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAvLyBqdXN0IHRoZSBvbmUhXG4gICAgICAgICAgICAgICAgaWYoIWl0ZW0uaW50ZXJhY3RpdmVDaGlsZHJlbilicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnByb3RvLm9uTW91c2VPdXQgPSBmdW5jdGlvbiBvbk1vdXNlT3V0KClcbntcbiAgICB0aGlzLmludGVyYWN0aW9uRE9NRWxlbWVudC5zdHlsZS5jdXJzb3IgPSAnaW5oZXJpdCc7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcblxuICAgICAgICBpZihpdGVtLl9faXNPdmVyKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLnRhcmdldCA9IGl0ZW07XG4gICAgICAgICAgICBpZihpdGVtLm1vdXNlb3V0KWl0ZW0ubW91c2VvdXQodGhpcy5tb3VzZSk7XG4gICAgICAgICAgICBpdGVtLl9faXNPdmVyID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIElzIGNhbGxlZCB3aGVuIHRoZSBtb3VzZSBidXR0b24gaXMgcmVsZWFzZWQgb24gdGhlIHJlbmRlcmVyIGVsZW1lbnRcbiAqXG4gKiBAbWV0aG9kIG9uTW91c2VVcFxuICogQHBhcmFtIGV2ZW50IHtFdmVudH0gVGhlIERPTSBldmVudCBvZiBhIG1vdXNlIGJ1dHRvbiBiZWluZyByZWxlYXNlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Nb3VzZVVwID0gZnVuY3Rpb24gb25Nb3VzZVVwKGV2ZW50KVxue1xuICAgIHRoaXMubW91c2Uub3JpZ2luYWxFdmVudCA9IGV2ZW50O1xuXG4gICAgdmFyIHVwID0gZmFsc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcblxuICAgICAgICBpZihpdGVtLm1vdXNldXAgfHwgaXRlbS5tb3VzZXVwb3V0c2lkZSB8fCBpdGVtLmNsaWNrKVxuICAgICAgICB7XG4gICAgICAgICAgICBpdGVtLl9faGl0ID0gdGhpcy5oaXRUZXN0KGl0ZW0sIHRoaXMubW91c2UpO1xuXG4gICAgICAgICAgICBpZihpdGVtLl9faGl0ICYmICF1cClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvL2NhbGwgdGhlIGZ1bmN0aW9uIVxuICAgICAgICAgICAgICAgIGlmKGl0ZW0ubW91c2V1cClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW0ubW91c2V1cCh0aGlzLm1vdXNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYoaXRlbS5fX2lzRG93bilcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlmKGl0ZW0uY2xpY2spaXRlbS5jbGljayh0aGlzLm1vdXNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWl0ZW0uaW50ZXJhY3RpdmVDaGlsZHJlbikgdXAgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0uX19pc0Rvd24pXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZihpdGVtLm1vdXNldXBvdXRzaWRlKWl0ZW0ubW91c2V1cG91dHNpZGUodGhpcy5tb3VzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpdGVtLl9faXNEb3duID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIFRlc3RzIGlmIHRoZSBjdXJyZW50IG1vdXNlIGNvb3JkcyBoaXQgYSBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIGhpdFRlc3RcbiAqIEBwYXJhbSBpdGVtIHtEaXNwbGF5T2JqZWN0fSBUaGUgZGlzcGxheU9iamVjdCB0byB0ZXN0IGZvciBhIGhpdFxuICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfSBUaGUgaW50ZXJhY3Rpb25kYXRhIG9iamVjdCB0byB1cGRhdGUgaW4gdGhlIGNhc2Ugb2YgYSBoaXRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmhpdFRlc3QgPSBmdW5jdGlvbiBoaXRUZXN0KGl0ZW0sIGludGVyYWN0aW9uRGF0YSlcbntcbiAgICB2YXIgd29ybGQgPSBpbnRlcmFjdGlvbkRhdGEuZ2xvYmFsO1xuXG4gICAgaWYoaXRlbS52Y291bnQgIT09IGdsb2JhbHMudmlzaWJsZUNvdW50KXJldHVybiBmYWxzZTtcblxuICAgIHZhciBpc1Nwcml0ZSA9IChpdGVtIGluc3RhbmNlb2YgU3ByaXRlKSxcbiAgICAgICAgd29ybGRUcmFuc2Zvcm0gPSBpdGVtLndvcmxkVHJhbnNmb3JtLFxuICAgICAgICBhMDAgPSB3b3JsZFRyYW5zZm9ybVswXSwgYTAxID0gd29ybGRUcmFuc2Zvcm1bMV0sIGEwMiA9IHdvcmxkVHJhbnNmb3JtWzJdLFxuICAgICAgICBhMTAgPSB3b3JsZFRyYW5zZm9ybVszXSwgYTExID0gd29ybGRUcmFuc2Zvcm1bNF0sIGExMiA9IHdvcmxkVHJhbnNmb3JtWzVdLFxuICAgICAgICBpZCA9IDEgLyAoYTAwICogYTExICsgYTAxICogLWExMCksXG4gICAgICAgIHggPSBhMTEgKiBpZCAqIHdvcmxkLnggKyAtYTAxICogaWQgKiB3b3JsZC55ICsgKGExMiAqIGEwMSAtIGEwMiAqIGExMSkgKiBpZCxcbiAgICAgICAgeSA9IGEwMCAqIGlkICogd29ybGQueSArIC1hMTAgKiBpZCAqIHdvcmxkLnggKyAoLWExMiAqIGEwMCArIGEwMiAqIGExMCkgKiBpZDtcblxuICAgIGludGVyYWN0aW9uRGF0YS50YXJnZXQgPSBpdGVtO1xuXG4gICAgLy9hIHNwcml0ZSBvciBkaXNwbGF5IG9iamVjdCB3aXRoIGEgaGl0IGFyZWEgZGVmaW5lZFxuICAgIGlmKGl0ZW0uaGl0QXJlYSAmJiBpdGVtLmhpdEFyZWEuY29udGFpbnMpIHtcbiAgICAgICAgaWYoaXRlbS5oaXRBcmVhLmNvbnRhaW5zKHgsIHkpKSB7XG4gICAgICAgICAgICAvL2lmKGlzU3ByaXRlKVxuICAgICAgICAgICAgaW50ZXJhY3Rpb25EYXRhLnRhcmdldCA9IGl0ZW07XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBhIHNwcml0ZSB3aXRoIG5vIGhpdGFyZWEgZGVmaW5lZFxuICAgIGVsc2UgaWYoaXNTcHJpdGUpXG4gICAge1xuICAgICAgICB2YXIgd2lkdGggPSBpdGVtLnRleHR1cmUuZnJhbWUud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQgPSBpdGVtLnRleHR1cmUuZnJhbWUuaGVpZ2h0LFxuICAgICAgICAgICAgeDEgPSAtd2lkdGggKiBpdGVtLmFuY2hvci54LFxuICAgICAgICAgICAgeTE7XG5cbiAgICAgICAgaWYoeCA+IHgxICYmIHggPCB4MSArIHdpZHRoKVxuICAgICAgICB7XG4gICAgICAgICAgICB5MSA9IC1oZWlnaHQgKiBpdGVtLmFuY2hvci55O1xuXG4gICAgICAgICAgICBpZih5ID4geTEgJiYgeSA8IHkxICsgaGVpZ2h0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIHNldCB0aGUgdGFyZ2V0IHByb3BlcnR5IGlmIGEgaGl0IGlzIHRydWUhXG4gICAgICAgICAgICAgICAgaW50ZXJhY3Rpb25EYXRhLnRhcmdldCA9IGl0ZW07XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGl0ZW0uY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIHRlbXBJdGVtID0gaXRlbS5jaGlsZHJlbltpXTtcbiAgICAgICAgdmFyIGhpdCA9IHRoaXMuaGl0VGVzdCh0ZW1wSXRlbSwgaW50ZXJhY3Rpb25EYXRhKTtcbiAgICAgICAgaWYoaGl0KVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBobW0uLiBUT0RPIFNFVCBDT1JSRUNUIFRBUkdFVD9cbiAgICAgICAgICAgIGludGVyYWN0aW9uRGF0YS50YXJnZXQgPSBpdGVtO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG4vKipcbiAqIElzIGNhbGxlZCB3aGVuIGEgdG91Y2ggaXMgbW92ZWQgYWNjcm9zcyB0aGUgcmVuZGVyZXIgZWxlbWVudFxuICpcbiAqIEBtZXRob2Qgb25Ub3VjaE1vdmVcbiAqIEBwYXJhbSBldmVudCB7RXZlbnR9IFRoZSBET00gZXZlbnQgb2YgYSB0b3VjaCBtb3ZpbmcgYWNjcm9zcyB0aGUgcmVuZGVyZXIgdmlld1xuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Ub3VjaE1vdmUgPSBmdW5jdGlvbiBvblRvdWNoTW92ZShldmVudClcbntcbiAgICB2YXIgcmVjdCA9IHRoaXMuaW50ZXJhY3Rpb25ET01FbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuICAgICAgICBjaGFuZ2VkVG91Y2hlcyA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLFxuICAgICAgICBpLCBsLCB0b3VjaEV2ZW50LCB0b3VjaERhdGEsIGlpLCBsbCwgaXRlbTtcblxuICAgIGZvciAoaSA9IDAsIGwgPSBjaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB0b3VjaEV2ZW50ID0gY2hhbmdlZFRvdWNoZXNbaV07XG4gICAgICAgIHRvdWNoRGF0YSA9IHRoaXMudG91Y2hzW3RvdWNoRXZlbnQuaWRlbnRpZmllcl07XG4gICAgICAgIHRvdWNoRGF0YS5vcmlnaW5hbEV2ZW50ID0gZXZlbnQ7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRoZSB0b3VjaCBwb3NpdGlvblxuICAgICAgICB0b3VjaERhdGEuZ2xvYmFsLnggPSAodG91Y2hFdmVudC5jbGllbnRYIC0gcmVjdC5sZWZ0KSAqICh0aGlzLnRhcmdldC53aWR0aCAvIHJlY3Qud2lkdGgpO1xuICAgICAgICB0b3VjaERhdGEuZ2xvYmFsLnkgPSAodG91Y2hFdmVudC5jbGllbnRZIC0gcmVjdC50b3ApICAqICh0aGlzLnRhcmdldC5oZWlnaHQgLyByZWN0LmhlaWdodCk7XG5cbiAgICAgICAgZm9yIChpaSA9IDAsIGxsID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aDsgaWkgPCBsbDsgaWkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpXTtcbiAgICAgICAgICAgIGlmIChpdGVtLnRvdWNobW92ZSkgaXRlbS50b3VjaG1vdmUodG91Y2hEYXRhKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbi8qKlxuICogSXMgY2FsbGVkIHdoZW4gYSB0b3VjaCBpcyBzdGFydGVkIG9uIHRoZSByZW5kZXJlciBlbGVtZW50XG4gKlxuICogQG1ldGhvZCBvblRvdWNoU3RhcnRcbiAqIEBwYXJhbSBldmVudCB7RXZlbnR9IFRoZSBET00gZXZlbnQgb2YgYSB0b3VjaCBzdGFydGluZyBvbiB0aGUgcmVuZGVyZXIgdmlld1xuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Ub3VjaFN0YXJ0ID0gZnVuY3Rpb24gb25Ub3VjaFN0YXJ0KGV2ZW50KVxue1xuICAgIHZhciByZWN0ID0gdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICAgIGNoYW5nZWRUb3VjaGVzID0gZXZlbnQuY2hhbmdlZFRvdWNoZXM7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciB0b3VjaEV2ZW50ID0gY2hhbmdlZFRvdWNoZXNbaV07XG5cbiAgICAgICAgdmFyIHRvdWNoRGF0YSA9IHRoaXMucG9vbC5wb3AoKTtcbiAgICAgICAgaWYgKCF0b3VjaERhdGEpIHRvdWNoRGF0YSA9IG5ldyBJbnRlcmFjdGlvbkRhdGEoKTtcblxuICAgICAgICB0b3VjaERhdGEub3JpZ2luYWxFdmVudCA9IGV2ZW50O1xuXG4gICAgICAgIHRoaXMudG91Y2hzW3RvdWNoRXZlbnQuaWRlbnRpZmllcl0gPSB0b3VjaERhdGE7XG4gICAgICAgIHRvdWNoRGF0YS5nbG9iYWwueCA9ICh0b3VjaEV2ZW50LmNsaWVudFggLSByZWN0LmxlZnQpICogKHRoaXMudGFyZ2V0LndpZHRoIC8gcmVjdC53aWR0aCk7XG4gICAgICAgIHRvdWNoRGF0YS5nbG9iYWwueSA9ICh0b3VjaEV2ZW50LmNsaWVudFkgLSByZWN0LnRvcCkgICogKHRoaXMudGFyZ2V0LmhlaWdodCAvIHJlY3QuaGVpZ2h0KTtcblxuICAgICAgICBmb3IgKHZhciBpaSA9IDAsIGxsID0gdGhpcy5pbnRlcmFjdGl2ZUl0ZW1zLmxlbmd0aDsgaWkgPCBsbDsgaWkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIGl0ZW0gPSB0aGlzLmludGVyYWN0aXZlSXRlbXNbaWldO1xuXG4gICAgICAgICAgICBpZiAoaXRlbS50b3VjaHN0YXJ0IHx8IGl0ZW0udGFwKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGl0ZW0uX19oaXQgPSB0aGlzLmhpdFRlc3QoaXRlbSwgdG91Y2hEYXRhKTtcblxuICAgICAgICAgICAgICAgIGlmIChpdGVtLl9faGl0KVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgLy9jYWxsIHRoZSBmdW5jdGlvbiFcbiAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW0udG91Y2hzdGFydCkgaXRlbS50b3VjaHN0YXJ0KHRvdWNoRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uX19pc0Rvd24gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBpdGVtLl9fdG91Y2hEYXRhID0gdG91Y2hEYXRhO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmKCFpdGVtLmludGVyYWN0aXZlQ2hpbGRyZW4pYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuLyoqXG4gKiBJcyBjYWxsZWQgd2hlbiBhIHRvdWNoIGlzIGVuZGVkIG9uIHRoZSByZW5kZXJlciBlbGVtZW50XG4gKlxuICogQG1ldGhvZCBvblRvdWNoRW5kXG4gKiBAcGFyYW0gZXZlbnQge0V2ZW50fSBUaGUgRE9NIGV2ZW50IG9mIGEgdG91Y2ggZW5kaW5nIG9uIHRoZSByZW5kZXJlciB2aWV3XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vblRvdWNoRW5kID0gZnVuY3Rpb24gb25Ub3VjaEVuZChldmVudClcbntcbiAgICAvL3RoaXMubW91c2Uub3JpZ2luYWxFdmVudCA9IGV2ZW50O1xuICAgIHZhciByZWN0ID0gdGhpcy5pbnRlcmFjdGlvbkRPTUVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICAgIGNoYW5nZWRUb3VjaGVzID0gZXZlbnQuY2hhbmdlZFRvdWNoZXM7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciB0b3VjaEV2ZW50ID0gY2hhbmdlZFRvdWNoZXNbaV07XG4gICAgICAgIHZhciB0b3VjaERhdGEgPSB0aGlzLnRvdWNoc1t0b3VjaEV2ZW50LmlkZW50aWZpZXJdO1xuICAgICAgICB2YXIgdXAgPSBmYWxzZTtcbiAgICAgICAgdG91Y2hEYXRhLmdsb2JhbC54ID0gKHRvdWNoRXZlbnQuY2xpZW50WCAtIHJlY3QubGVmdCkgKiAodGhpcy50YXJnZXQud2lkdGggLyByZWN0LndpZHRoKTtcbiAgICAgICAgdG91Y2hEYXRhLmdsb2JhbC55ID0gKHRvdWNoRXZlbnQuY2xpZW50WSAtIHJlY3QudG9wKSAgKiAodGhpcy50YXJnZXQuaGVpZ2h0IC8gcmVjdC5oZWlnaHQpO1xuXG4gICAgICAgIGZvciAodmFyIGlpID0gMCwgbGwgPSB0aGlzLmludGVyYWN0aXZlSXRlbXMubGVuZ3RoOyBpaSA8IGxsOyBpaSsrKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgaXRlbSA9IHRoaXMuaW50ZXJhY3RpdmVJdGVtc1tpaV07XG4gICAgICAgICAgICB2YXIgaXRlbVRvdWNoRGF0YSA9IGl0ZW0uX190b3VjaERhdGE7IC8vIDwtLSBIZXJlIVxuICAgICAgICAgICAgaXRlbS5fX2hpdCA9IHRoaXMuaGl0VGVzdChpdGVtLCB0b3VjaERhdGEpO1xuXG4gICAgICAgICAgICBpZihpdGVtVG91Y2hEYXRhID09PSB0b3VjaERhdGEpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gc28gdGhpcyBvbmUgV0FTIGRvd24uLi5cbiAgICAgICAgICAgICAgICB0b3VjaERhdGEub3JpZ2luYWxFdmVudCA9IGV2ZW50O1xuICAgICAgICAgICAgICAgIC8vIGhpdFRlc3Q/P1xuXG4gICAgICAgICAgICAgICAgaWYoaXRlbS50b3VjaGVuZCB8fCBpdGVtLnRhcClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlmKGl0ZW0uX19oaXQgJiYgIXVwKVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihpdGVtLnRvdWNoZW5kKWl0ZW0udG91Y2hlbmQodG91Y2hEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGl0ZW0uX19pc0Rvd24pXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXRlbS50YXApaXRlbS50YXAodG91Y2hEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIWl0ZW0uaW50ZXJhY3RpdmVDaGlsZHJlbil1cCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihpdGVtLl9faXNEb3duKVxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGl0ZW0udG91Y2hlbmRvdXRzaWRlKWl0ZW0udG91Y2hlbmRvdXRzaWRlKHRvdWNoRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpdGVtLl9faXNEb3duID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaXRlbS5fX3RvdWNoRGF0YSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtb3ZlIHRoZSB0b3VjaC4uXG4gICAgICAgIHRoaXMucG9vbC5wdXNoKHRvdWNoRGF0YSk7XG4gICAgICAgIHRoaXMudG91Y2hzW3RvdWNoRXZlbnQuaWRlbnRpZmllcl0gPSBudWxsO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJhY3Rpb25NYW5hZ2VyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIERyLiBLaWJpdHogPGluZm9AZHJraWJpdHouY29tPlxuICovXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIC8vIGF1dG9EZXRlY3RlZDogZmFsc2UsXG5cbiAgICBnbDogbnVsbCxcbiAgICBwcmltaXRpdmVTaGFkZXI6IG51bGwsXG4gICAgc3RyaXBTaGFkZXI6IG51bGwsXG4gICAgZGVmYXVsdFNoYWRlcjogbnVsbCxcblxuICAgIG9mZnNldDogbnVsbCxcbiAgICBwcm9qZWN0aW9uOm51bGwsXG5cbiAgICB0ZXh0dXJlc1RvVXBkYXRlOiBbXSxcbiAgICB0ZXh0dXJlc1RvRGVzdHJveTogW10sXG4gICAgdmlzaWJsZUNvdW50OiAwXG59O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuXG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uL2NvcmUvZ2xvYmFscycpO1xudmFyIG1hdDMgPSByZXF1aXJlKCcuLi9nZW9tL21hdHJpeCcpLm1hdDM7XG5cbnZhciBGaWx0ZXJCbG9jayA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMvRmlsdGVyQmxvY2snKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcbnZhciBSZWN0YW5nbGUgPSByZXF1aXJlKCcuLi9nZW9tL1JlY3RhbmdsZScpO1xuXG4vKipcbiAqIFRoZSBiYXNlIGNsYXNzIGZvciBhbGwgb2JqZWN0cyB0aGF0IGFyZSByZW5kZXJlZCBvbiB0aGUgc2NyZWVuLlxuICpcbiAqIEBjbGFzcyBEaXNwbGF5T2JqZWN0XG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRGlzcGxheU9iamVjdCgpXG57XG4gICAgdGhpcy5sYXN0ID0gdGhpcztcbiAgICB0aGlzLmZpcnN0ID0gdGhpcztcbiAgICAvKipcbiAgICAgKiBUaGUgY29vcmRpbmF0ZSBvZiB0aGUgb2JqZWN0IHJlbGF0aXZlIHRvIHRoZSBsb2NhbCBjb29yZGluYXRlcyBvZiB0aGUgcGFyZW50LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHBvc2l0aW9uXG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLnBvc2l0aW9uID0gbmV3IFBvaW50KCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc2NhbGUgZmFjdG9yIG9mIHRoZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgc2NhbGVcbiAgICAgKiBAdHlwZSBQb2ludFxuICAgICAqL1xuICAgIHRoaXMuc2NhbGUgPSBuZXcgUG9pbnQoMSwxKTsvL3t4OjEsIHk6MX07XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGl2b3QgcG9pbnQgb2YgdGhlIGRpc3BsYXlPYmplY3QgdGhhdCBpdCByb3RhdGVzIGFyb3VuZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHBpdm90XG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLnBpdm90ID0gbmV3IFBvaW50KDAsMCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcm90YXRpb24gb2YgdGhlIG9iamVjdCBpbiByYWRpYW5zLlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHJvdGF0aW9uXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgdGhpcy5yb3RhdGlvbiA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgb3BhY2l0eSBvZiB0aGUgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGFscGhhXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgdGhpcy5hbHBoYSA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdmlzaWJpbGl0eSBvZiB0aGUgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHZpc2libGVcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICovXG4gICAgdGhpcy52aXNpYmxlID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFRoaXMgaXMgdGhlIGRlZmluZWQgYXJlYSB0aGF0IHdpbGwgcGljayB1cCBtb3VzZSAvIHRvdWNoIGV2ZW50cy4gSXQgaXMgbnVsbCBieSBkZWZhdWx0LlxuICAgICAqIFNldHRpbmcgaXQgaXMgYSBuZWF0IHdheSBvZiBvcHRpbWlzaW5nIHRoZSBoaXRUZXN0IGZ1bmN0aW9uIHRoYXQgdGhlIGludGVyYWN0aW9uTWFuYWdlciB3aWxsIHVzZSAoYXMgaXQgd2lsbCBub3QgbmVlZCB0byBoaXQgdGVzdCBhbGwgdGhlIGNoaWxkcmVuKVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGhpdEFyZWFcbiAgICAgKiBAdHlwZSBSZWN0YW5nbGV8Q2lyY2xlfEVsbGlwc2V8UG9seWdvblxuICAgICAqL1xuICAgIHRoaXMuaGl0QXJlYSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGlzIHVzZWQgdG8gaW5kaWNhdGUgaWYgdGhlIGRpc3BsYXlPYmplY3Qgc2hvdWxkIGRpc3BsYXkgYSBtb3VzZSBoYW5kIGN1cnNvciBvbiByb2xsb3ZlclxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGJ1dHRvbk1vZGVcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICovXG4gICAgdGhpcy5idXR0b25Nb2RlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDYW4gdGhpcyBvYmplY3QgYmUgcmVuZGVyZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSByZW5kZXJhYmxlXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMucmVuZGVyYWJsZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gVGhlIGRpc3BsYXkgb2JqZWN0IGNvbnRhaW5lciB0aGF0IGNvbnRhaW5zIHRoaXMgZGlzcGxheSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgcGFyZW50XG4gICAgICogQHR5cGUgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMucGFyZW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBzdGFnZSB0aGUgZGlzcGxheSBvYmplY3QgaXMgY29ubmVjdGVkIHRvLCBvciB1bmRlZmluZWQgaWYgaXQgaXMgbm90IGNvbm5lY3RlZCB0byB0aGUgc3RhZ2UuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgc3RhZ2VcbiAgICAgKiBAdHlwZSBTdGFnZVxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMuc3RhZ2UgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gVGhlIG11bHRpcGxpZWQgYWxwaGEgb2YgdGhlIGRpc3BsYXlvYmplY3RcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3b3JsZEFscGhhXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy53b3JsZEFscGhhID0gMTtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFdoZXRoZXIgb3Igbm90IHRoZSBvYmplY3QgaXMgaW50ZXJhY3RpdmUsIGRvIG5vdCB0b2dnbGUgZGlyZWN0bHkhIHVzZSB0aGUgYGludGVyYWN0aXZlYCBwcm9wZXJ0eVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IF9pbnRlcmFjdGl2ZVxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuX2ludGVyYWN0aXZlID0gZmFsc2U7XG5cbiAgICB0aGlzLmRlZmF1bHRDdXJzb3IgPSAncG9pbnRlcic7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBDdXJyZW50IHRyYW5zZm9ybSBvZiB0aGUgb2JqZWN0IGJhc2VkIG9uIHdvcmxkIChwYXJlbnQpIGZhY3RvcnNcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3b3JsZFRyYW5zZm9ybVxuICAgICAqIEB0eXBlIE1hdDNcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMud29ybGRUcmFuc2Zvcm0gPSBtYXQzLmNyZWF0ZSgpOy8vbWF0My5pZGVudGl0eSgpO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gQ3VycmVudCB0cmFuc2Zvcm0gb2YgdGhlIG9iamVjdCBsb2NhbGx5XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbG9jYWxUcmFuc2Zvcm1cbiAgICAgKiBAdHlwZSBNYXQzXG4gICAgICogQHJlYWRPbmx5XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLmxvY2FsVHJhbnNmb3JtID0gbWF0My5jcmVhdGUoKTsvL21hdDMuaWRlbnRpdHkoKTtcblxuICAgIC8qKlxuICAgICAqIFtOWUldIFVua293blxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGNvbG9yXG4gICAgICogQHR5cGUgQXJyYXk8PlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5jb2xvciA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogW05ZSV0gSG9sZHMgd2hldGhlciBvciBub3QgdGhpcyBvYmplY3QgaXMgZHluYW1pYywgZm9yIHJlbmRlcmluZyBvcHRpbWl6YXRpb25cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBkeW5hbWljXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5keW5hbWljID0gdHJ1ZTtcblxuICAgIC8vIGNoYWNoIHRoYXQgcHVwcHkhXG4gICAgdGhpcy5fc3IgPSAwO1xuICAgIHRoaXMuX2NyID0gMTtcblxuXG4gICAgdGhpcy5maWx0ZXJBcmVhID0gbmV3IFJlY3RhbmdsZSgwLDAsMSwxKTtcblxuICAgIC8qXG4gICAgICogTU9VU0UgQ2FsbGJhY2tzXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VycyBjbGlja3Mgb24gdGhlIGRpc3BsYXlPYmplY3Qgd2l0aCB0aGVpciBtb3VzZVxuICAgICAqIEBtZXRob2QgY2xpY2tcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIGNsaWNrcyB0aGUgbW91c2UgZG93biBvdmVyIHRoZSBzcHJpdGVcbiAgICAgKiBAbWV0aG9kIG1vdXNlZG93blxuICAgICAqIEBwYXJhbSBpbnRlcmFjdGlvbkRhdGEge0ludGVyYWN0aW9uRGF0YX1cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEEgY2FsbGJhY2sgdGhhdCBpcyB1c2VkIHdoZW4gdGhlIHVzZXIgcmVsZWFzZXMgdGhlIG1vdXNlIHRoYXQgd2FzIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBmb3IgdGhpcyBjYWxsYmFjayB0byBiZSBmaXJlZCB0aGUgbW91c2UgbXVzdCBoYXZlIGJlZW4gcHJlc3NlZCBkb3duIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBAbWV0aG9kIG1vdXNldXBcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIHJlbGVhc2VzIHRoZSBtb3VzZSB0aGF0IHdhcyBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0IGJ1dCBpcyBubyBsb25nZXIgb3ZlciB0aGUgZGlzcGxheU9iamVjdFxuICAgICAqIGZvciB0aGlzIGNhbGxiYWNrIHRvIGJlIGZpcmVkLCBUaGUgdG91Y2ggbXVzdCBoYXZlIHN0YXJ0ZWQgb3ZlciB0aGUgZGlzcGxheU9iamVjdFxuICAgICAqIEBtZXRob2QgbW91c2V1cG91dHNpZGVcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VycyBtb3VzZSByb2xscyBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0XG4gICAgICogQG1ldGhvZCBtb3VzZW92ZXJcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VycyBtb3VzZSBsZWF2ZXMgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBAbWV0aG9kIG1vdXNlb3V0XG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG5cbiAgICAvKlxuICAgICAqIFRPVUNIIENhbGxiYWNrc1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlcnMgdGFwcyBvbiB0aGUgc3ByaXRlIHdpdGggdGhlaXIgZmluZ2VyXG4gICAgICogYmFzaWNhbGx5IGEgdG91Y2ggdmVyc2lvbiBvZiBjbGlja1xuICAgICAqIEBtZXRob2QgdGFwXG4gICAgICogQHBhcmFtIGludGVyYWN0aW9uRGF0YSB7SW50ZXJhY3Rpb25EYXRhfVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQSBjYWxsYmFjayB0aGF0IGlzIHVzZWQgd2hlbiB0aGUgdXNlciB0b3VjaCdzIG92ZXIgdGhlIGRpc3BsYXlPYmplY3RcbiAgICAgKiBAbWV0aG9kIHRvdWNoc3RhcnRcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIHJlbGVhc2VzIGEgdG91Y2ggb3ZlciB0aGUgZGlzcGxheU9iamVjdFxuICAgICAqIEBtZXRob2QgdG91Y2hlbmRcbiAgICAgKiBAcGFyYW0gaW50ZXJhY3Rpb25EYXRhIHtJbnRlcmFjdGlvbkRhdGF9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBBIGNhbGxiYWNrIHRoYXQgaXMgdXNlZCB3aGVuIHRoZSB1c2VyIHJlbGVhc2VzIHRoZSB0b3VjaCB0aGF0IHdhcyBvdmVyIHRoZSBkaXNwbGF5T2JqZWN0XG4gICAgICogZm9yIHRoaXMgY2FsbGJhY2sgdG8gYmUgZmlyZWQsIFRoZSB0b3VjaCBtdXN0IGhhdmUgc3RhcnRlZCBvdmVyIHRoZSBzcHJpdGVcbiAgICAgKiBAbWV0aG9kIHRvdWNoZW5kb3V0c2lkZVxuICAgICAqIEBwYXJhbSBpbnRlcmFjdGlvbkRhdGEge0ludGVyYWN0aW9uRGF0YX1cbiAgICAgKi9cbn1cbnZhciBwcm90byA9IERpc3BsYXlPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFtEZXByZWNhdGVkXSBJbmRpY2F0ZXMgaWYgdGhlIHNwcml0ZSB3aWxsIGhhdmUgdG91Y2ggYW5kIG1vdXNlIGludGVyYWN0aXZpdHkuIEl0IGlzIGZhbHNlIGJ5IGRlZmF1bHRcbiAqIEluc3RlYWQgb2YgdXNpbmcgdGhpcyBmdW5jdGlvbiB5b3UgY2FuIG5vdyBzaW1wbHkgc2V0IHRoZSBpbnRlcmFjdGl2ZSBwcm9wZXJ0eSB0byB0cnVlIG9yIGZhbHNlXG4gKlxuICogQG1ldGhvZCBzZXRJbnRlcmFjdGl2ZVxuICogQHBhcmFtIGludGVyYWN0aXZlIHtCb29sZWFufVxuICogQGRlcHJlY2F0ZWQgU2ltcGx5IHNldCB0aGUgYGludGVyYWN0aXZlYCBwcm9wZXJ0eSBkaXJlY3RseVxuICovXG5wcm90by5zZXRJbnRlcmFjdGl2ZSA9IGZ1bmN0aW9uKGludGVyYWN0aXZlKVxue1xuICAgIHRoaXMuaW50ZXJhY3RpdmUgPSBpbnRlcmFjdGl2ZTtcbn07XG5cbi8qKlxuICogSW5kaWNhdGVzIGlmIHRoZSBzcHJpdGUgd2lsbCBoYXZlIHRvdWNoIGFuZCBtb3VzZSBpbnRlcmFjdGl2aXR5LiBJdCBpcyBmYWxzZSBieSBkZWZhdWx0XG4gKlxuICogQHByb3BlcnR5IGludGVyYWN0aXZlXG4gKiBAdHlwZSBCb29sZWFuXG4gKiBAZGVmYXVsdCBmYWxzZVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdpbnRlcmFjdGl2ZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faW50ZXJhY3RpdmU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2ludGVyYWN0aXZlID0gdmFsdWU7XG5cbiAgICAgICAgLy8gVE9ETyBtb3JlIHRvIGJlIGRvbmUgaGVyZS4uXG4gICAgICAgIC8vIG5lZWQgdG8gc29ydCBvdXQgYSByZS1jcmF3bCFcbiAgICAgICAgaWYodGhpcy5zdGFnZSl0aGlzLnN0YWdlLmRpcnR5ID0gdHJ1ZTtcbiAgICB9XG59KTtcblxuLyoqXG4gKiBTZXRzIGEgbWFzayBmb3IgdGhlIGRpc3BsYXlPYmplY3QuIEEgbWFzayBpcyBhbiBvYmplY3QgdGhhdCBsaW1pdHMgdGhlIHZpc2liaWxpdHkgb2YgYW4gb2JqZWN0IHRvIHRoZSBzaGFwZSBvZiB0aGUgbWFzayBhcHBsaWVkIHRvIGl0LlxuICogSW4gUGl4aSBhIHJlZ3VsYXIgbWFzayBtdXN0IGJlIGEgR3JhcGhpY3Mgb2JqZWN0LiBUaGlzIGFsbG93cyBmb3IgbXVjaCBmYXN0ZXIgbWFza2luZyBpbiBjYW52YXMgYXMgaXQgdXRpbGlzZXMgc2hhcGUgY2xpcHBpbmcuXG4gKiBUbyByZW1vdmUgYSBtYXNrLCBzZXQgdGhpcyBwcm9wZXJ0eSB0byBudWxsLlxuICpcbiAqIEBwcm9wZXJ0eSBtYXNrXG4gKiBAdHlwZSBHcmFwaGljc1xuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdtYXNrJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuXG5cbiAgICAgICAgaWYodmFsdWUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKHRoaXMuX21hc2spXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmFsdWUuc3RhcnQgPSB0aGlzLl9tYXNrLnN0YXJ0O1xuICAgICAgICAgICAgICAgIHZhbHVlLmVuZCA9IHRoaXMuX21hc2suZW5kO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkRmlsdGVyKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB2YWx1ZS5yZW5kZXJhYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZpbHRlcih0aGlzLl9tYXNrKTtcbiAgICAgICAgICAgIHRoaXMuX21hc2sucmVuZGVyYWJsZSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tYXNrID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogU2V0cyB0aGUgZmlsdGVycyBmb3IgdGhlIGRpc3BsYXlPYmplY3QuXG4gKiAqIElNUE9SVEFOVDogVGhpcyBpcyBhIHdlYkdMIG9ubHkgZmVhdHVyZSBhbmQgd2lsbCBiZSBpZ25vcmVkIGJ5IHRoZSBjYW52YXMgcmVuZGVyZXIuXG4gKiBUbyByZW1vdmUgZmlsdGVycyBzaW1wbHkgc2V0IHRoaXMgcHJvcGVydHkgdG8gJ251bGwnXG4gKiBAcHJvcGVydHkgZmlsdGVyc1xuICogQHR5cGUgQXJyYXkgQW4gYXJyYXkgb2YgZmlsdGVyc1xuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdmaWx0ZXJzJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9maWx0ZXJzO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuXG4gICAgICAgIGlmKHZhbHVlKVxuICAgICAgICB7XG4gICAgICAgICAgICBpZih0aGlzLl9maWx0ZXJzKXRoaXMucmVtb3ZlRmlsdGVyKHRoaXMuX2ZpbHRlcnMpO1xuICAgICAgICAgICAgdGhpcy5hZGRGaWx0ZXIodmFsdWUpO1xuXG4gICAgICAgICAgICAvLyBub3cgcHV0IGFsbCB0aGUgcGFzc2VzIGluIG9uZSBwbGFjZS4uXG4gICAgICAgICAgICB2YXIgcGFzc2VzID0gW107XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHZhciBmaWx0ZXJQYXNzZXMgPSB2YWx1ZVtpXS5wYXNzZXM7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBmaWx0ZXJQYXNzZXMubGVuZ3RoOyBqKyspXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBwYXNzZXMucHVzaChmaWx0ZXJQYXNzZXNbal0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFsdWUuc3RhcnQuZmlsdGVyUGFzc2VzID0gcGFzc2VzO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgaWYodGhpcy5fZmlsdGVycykge1xuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlRmlsdGVyKHRoaXMuX2ZpbHRlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZmlsdGVycyA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG4vKlxuICogQWRkcyBhIGZpbHRlciB0byB0aGlzIGRpc3BsYXlPYmplY3RcbiAqXG4gKiBAbWV0aG9kIGFkZEZpbHRlclxuICogQHBhcmFtIG1hc2sge0dyYXBoaWNzfSB0aGUgZ3JhcGhpY3Mgb2JqZWN0IHRvIHVzZSBhcyBhIGZpbHRlclxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uYWRkRmlsdGVyID0gZnVuY3Rpb24gYWRkRmlsdGVyKGRhdGEpXG57XG4gICAgLy9pZih0aGlzLmZpbHRlcilyZXR1cm47XG4gICAgLy90aGlzLmZpbHRlciA9IHRydWU7XG4vLyAgZGF0YVswXS50YXJnZXQgPSB0aGlzO1xuXG5cbiAgICAvLyBpbnNlcnQgYSBmaWx0ZXIgYmxvY2suLlxuICAgIC8vIFRPRE8gT25qZWN0IHBvb2wgdGhlc2UgYmFkIGJveXMuLlxuICAgIHZhciBzdGFydCA9IG5ldyBGaWx0ZXJCbG9jaygpO1xuICAgIHZhciBlbmQgPSBuZXcgRmlsdGVyQmxvY2soKTtcblxuICAgIGRhdGEuc3RhcnQgPSBzdGFydDtcbiAgICBkYXRhLmVuZCA9IGVuZDtcblxuICAgIHN0YXJ0LmRhdGEgPSBkYXRhO1xuICAgIGVuZC5kYXRhID0gZGF0YTtcblxuICAgIHN0YXJ0LmZpcnN0ID0gc3RhcnQubGFzdCA9ICB0aGlzO1xuICAgIGVuZC5maXJzdCA9IGVuZC5sYXN0ID0gdGhpcztcblxuICAgIHN0YXJ0Lm9wZW4gPSB0cnVlO1xuXG4gICAgc3RhcnQudGFyZ2V0ID0gdGhpcztcblxuICAgIC8qXG4gICAgICogaW5zZXJ0IHN0YXJ0XG4gICAgICovXG5cbiAgICB2YXIgY2hpbGRGaXJzdCA9IHN0YXJ0O1xuICAgIHZhciBjaGlsZExhc3QgPSBzdGFydDtcbiAgICB2YXIgbmV4dE9iamVjdDtcbiAgICB2YXIgcHJldmlvdXNPYmplY3Q7XG5cbiAgICBwcmV2aW91c09iamVjdCA9IHRoaXMuZmlyc3QuX2lQcmV2O1xuXG4gICAgaWYocHJldmlvdXNPYmplY3QpXG4gICAge1xuICAgICAgICBuZXh0T2JqZWN0ID0gcHJldmlvdXNPYmplY3QuX2lOZXh0O1xuICAgICAgICBjaGlsZEZpcnN0Ll9pUHJldiA9IHByZXZpb3VzT2JqZWN0O1xuICAgICAgICBwcmV2aW91c09iamVjdC5faU5leHQgPSBjaGlsZEZpcnN0O1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBuZXh0T2JqZWN0ID0gdGhpcztcbiAgICB9XG5cbiAgICBpZihuZXh0T2JqZWN0KVxuICAgIHtcbiAgICAgICAgbmV4dE9iamVjdC5faVByZXYgPSBjaGlsZExhc3Q7XG4gICAgICAgIGNoaWxkTGFzdC5faU5leHQgPSBuZXh0T2JqZWN0O1xuICAgIH1cblxuICAgIC8vIG5vdyBpbnNlcnQgdGhlIGVuZCBmaWx0ZXIgYmxvY2suLlxuXG4gICAgLypcbiAgICAgKiBpbnNlcnQgZW5kIGZpbHRlclxuICAgICAqL1xuICAgIGNoaWxkRmlyc3QgPSBlbmQ7XG4gICAgY2hpbGRMYXN0ID0gZW5kO1xuICAgIG5leHRPYmplY3QgPSBudWxsO1xuICAgIHByZXZpb3VzT2JqZWN0ID0gbnVsbDtcblxuICAgIHByZXZpb3VzT2JqZWN0ID0gdGhpcy5sYXN0O1xuICAgIG5leHRPYmplY3QgPSBwcmV2aW91c09iamVjdC5faU5leHQ7XG5cbiAgICBpZihuZXh0T2JqZWN0KVxuICAgIHtcbiAgICAgICAgbmV4dE9iamVjdC5faVByZXYgPSBjaGlsZExhc3Q7XG4gICAgICAgIGNoaWxkTGFzdC5faU5leHQgPSBuZXh0T2JqZWN0O1xuICAgIH1cblxuICAgIGNoaWxkRmlyc3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgcHJldmlvdXNPYmplY3QuX2lOZXh0ID0gY2hpbGRGaXJzdDtcblxuICAgIHZhciB1cGRhdGVMYXN0ID0gdGhpcztcblxuICAgIHZhciBwcmV2TGFzdCA9IHRoaXMubGFzdDtcbiAgICB3aGlsZSh1cGRhdGVMYXN0KVxuICAgIHtcbiAgICAgICAgaWYodXBkYXRlTGFzdC5sYXN0ID09PSBwcmV2TGFzdClcbiAgICAgICAge1xuICAgICAgICAgICAgdXBkYXRlTGFzdC5sYXN0ID0gZW5kO1xuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZUxhc3QgPSB1cGRhdGVMYXN0LnBhcmVudDtcbiAgICB9XG5cbiAgICB0aGlzLmZpcnN0ID0gc3RhcnQ7XG5cbiAgICAvLyBpZiB3ZWJHTC4uLlxuICAgIGlmKHRoaXMuX19yZW5kZXJHcm91cClcbiAgICB7XG4gICAgICAgIHRoaXMuX19yZW5kZXJHcm91cC5hZGRGaWx0ZXJCbG9ja3Moc3RhcnQsIGVuZCk7XG4gICAgfVxufTtcblxuLypcbiAqIFJlbW92ZXMgdGhlIGZpbHRlciB0byB0aGlzIGRpc3BsYXlPYmplY3RcbiAqXG4gKiBAbWV0aG9kIHJlbW92ZUZpbHRlclxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVtb3ZlRmlsdGVyID0gZnVuY3Rpb24gcmVtb3ZlRmlsdGVyKGRhdGEpXG57XG4gICAgLy9pZighdGhpcy5maWx0ZXIpcmV0dXJuO1xuICAgIC8vdGhpcy5maWx0ZXIgPSBmYWxzZTtcbiAgICAvLyBjb25zb2xlLmxvZygnWVVPSU8nKVxuICAgIC8vIG1vZGlmeSB0aGUgbGlzdC4uXG4gICAgdmFyIHN0YXJ0QmxvY2sgPSBkYXRhLnN0YXJ0O1xuXG5cbiAgICB2YXIgbmV4dE9iamVjdCA9IHN0YXJ0QmxvY2suX2lOZXh0O1xuICAgIHZhciBwcmV2aW91c09iamVjdCA9IHN0YXJ0QmxvY2suX2lQcmV2O1xuXG4gICAgaWYobmV4dE9iamVjdCluZXh0T2JqZWN0Ll9pUHJldiA9IHByZXZpb3VzT2JqZWN0O1xuICAgIGlmKHByZXZpb3VzT2JqZWN0KXByZXZpb3VzT2JqZWN0Ll9pTmV4dCA9IG5leHRPYmplY3Q7XG5cbiAgICB0aGlzLmZpcnN0ID0gc3RhcnRCbG9jay5faU5leHQ7XG5cbiAgICAvLyByZW1vdmUgdGhlIGVuZCBmaWx0ZXJcbiAgICB2YXIgbGFzdEJsb2NrID0gZGF0YS5lbmQ7XG5cbiAgICBuZXh0T2JqZWN0ID0gbGFzdEJsb2NrLl9pTmV4dDtcbiAgICBwcmV2aW91c09iamVjdCA9IGxhc3RCbG9jay5faVByZXY7XG5cbiAgICBpZihuZXh0T2JqZWN0KW5leHRPYmplY3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgcHJldmlvdXNPYmplY3QuX2lOZXh0ID0gbmV4dE9iamVjdDtcblxuICAgIC8vIHRoaXMgaXMgYWx3YXlzIHRydWUgdG9vIVxuICAgIHZhciB0ZW1wTGFzdCA9ICBsYXN0QmxvY2suX2lQcmV2O1xuICAgIC8vIG5lZWQgdG8gbWFrZSBzdXJlIHRoZSBwYXJlbnRzIGxhc3QgaXMgdXBkYXRlZCB0b29cbiAgICB2YXIgdXBkYXRlTGFzdCA9IHRoaXM7XG4gICAgd2hpbGUodXBkYXRlTGFzdC5sYXN0ID09PSBsYXN0QmxvY2spXG4gICAge1xuICAgICAgICB1cGRhdGVMYXN0Lmxhc3QgPSB0ZW1wTGFzdDtcbiAgICAgICAgdXBkYXRlTGFzdCA9IHVwZGF0ZUxhc3QucGFyZW50O1xuICAgICAgICBpZighdXBkYXRlTGFzdClicmVhaztcbiAgICB9XG5cbiAgICAvLyBpZiB3ZWJHTC4uLlxuICAgIGlmKHRoaXMuX19yZW5kZXJHcm91cClcbiAgICB7XG4gICAgICAgIHRoaXMuX19yZW5kZXJHcm91cC5yZW1vdmVGaWx0ZXJCbG9ja3Moc3RhcnRCbG9jaywgbGFzdEJsb2NrKTtcbiAgICB9XG59O1xuXG4vKlxuICogVXBkYXRlcyB0aGUgb2JqZWN0IHRyYW5zZm9ybSBmb3IgcmVuZGVyaW5nXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgLy8gVE9ETyBPUFRJTUlaRSBUSElTISEgd2l0aCBkaXJ0eVxuICAgIGlmKHRoaXMucm90YXRpb24gIT09IHRoaXMucm90YXRpb25DYWNoZSlcbiAgICB7XG4gICAgICAgIHRoaXMucm90YXRpb25DYWNoZSA9IHRoaXMucm90YXRpb247XG4gICAgICAgIHRoaXMuX3NyID0gIE1hdGguc2luKHRoaXMucm90YXRpb24pO1xuICAgICAgICB0aGlzLl9jciA9ICBNYXRoLmNvcyh0aGlzLnJvdGF0aW9uKTtcbiAgICB9XG5cbiAgICB2YXIgbG9jYWxUcmFuc2Zvcm0gPSB0aGlzLmxvY2FsVHJhbnNmb3JtO1xuICAgIHZhciBwYXJlbnRUcmFuc2Zvcm0gPSB0aGlzLnBhcmVudC53b3JsZFRyYW5zZm9ybTtcbiAgICB2YXIgd29ybGRUcmFuc2Zvcm0gPSB0aGlzLndvcmxkVHJhbnNmb3JtO1xuICAgIC8vY29uc29sZS5sb2cobG9jYWxUcmFuc2Zvcm0pXG4gICAgbG9jYWxUcmFuc2Zvcm1bMF0gPSB0aGlzLl9jciAqIHRoaXMuc2NhbGUueDtcbiAgICBsb2NhbFRyYW5zZm9ybVsxXSA9IC10aGlzLl9zciAqIHRoaXMuc2NhbGUueTtcbiAgICBsb2NhbFRyYW5zZm9ybVszXSA9IHRoaXMuX3NyICogdGhpcy5zY2FsZS54O1xuICAgIGxvY2FsVHJhbnNmb3JtWzRdID0gdGhpcy5fY3IgKiB0aGlzLnNjYWxlLnk7XG5cbiAgICAvLyBUT0RPIC0tPiBkbyB3ZSBldmVuIG5lZWQgYSBsb2NhbCBtYXRyaXg/Pz9cblxuICAgIHZhciBweCA9IHRoaXMucGl2b3QueDtcbiAgICB2YXIgcHkgPSB0aGlzLnBpdm90Lnk7XG5cbiAgICAvLyBDYWNoZSB0aGUgbWF0cml4IHZhbHVlcyAobWFrZXMgZm9yIGh1Z2Ugc3BlZWQgaW5jcmVhc2VzISlcbiAgICB2YXIgYTAwID0gbG9jYWxUcmFuc2Zvcm1bMF0sIGEwMSA9IGxvY2FsVHJhbnNmb3JtWzFdLCBhMDIgPSB0aGlzLnBvc2l0aW9uLnggLSBsb2NhbFRyYW5zZm9ybVswXSAqIHB4IC0gcHkgKiBsb2NhbFRyYW5zZm9ybVsxXSxcbiAgICAgICAgYTEwID0gbG9jYWxUcmFuc2Zvcm1bM10sIGExMSA9IGxvY2FsVHJhbnNmb3JtWzRdLCBhMTIgPSB0aGlzLnBvc2l0aW9uLnkgLSBsb2NhbFRyYW5zZm9ybVs0XSAqIHB5IC0gcHggKiBsb2NhbFRyYW5zZm9ybVszXSxcblxuICAgICAgICBiMDAgPSBwYXJlbnRUcmFuc2Zvcm1bMF0sIGIwMSA9IHBhcmVudFRyYW5zZm9ybVsxXSwgYjAyID0gcGFyZW50VHJhbnNmb3JtWzJdLFxuICAgICAgICBiMTAgPSBwYXJlbnRUcmFuc2Zvcm1bM10sIGIxMSA9IHBhcmVudFRyYW5zZm9ybVs0XSwgYjEyID0gcGFyZW50VHJhbnNmb3JtWzVdO1xuXG4gICAgbG9jYWxUcmFuc2Zvcm1bMl0gPSBhMDI7XG4gICAgbG9jYWxUcmFuc2Zvcm1bNV0gPSBhMTI7XG5cbiAgICB3b3JsZFRyYW5zZm9ybVswXSA9IGIwMCAqIGEwMCArIGIwMSAqIGExMDtcbiAgICB3b3JsZFRyYW5zZm9ybVsxXSA9IGIwMCAqIGEwMSArIGIwMSAqIGExMTtcbiAgICB3b3JsZFRyYW5zZm9ybVsyXSA9IGIwMCAqIGEwMiArIGIwMSAqIGExMiArIGIwMjtcblxuICAgIHdvcmxkVHJhbnNmb3JtWzNdID0gYjEwICogYTAwICsgYjExICogYTEwO1xuICAgIHdvcmxkVHJhbnNmb3JtWzRdID0gYjEwICogYTAxICsgYjExICogYTExO1xuICAgIHdvcmxkVHJhbnNmb3JtWzVdID0gYjEwICogYTAyICsgYjExICogYTEyICsgYjEyO1xuXG4gICAgLy8gYmVjYXVzZSB3ZSBhcmUgdXNpbmcgYWZmaW5lIHRyYW5zZm9ybWF0aW9uLCB3ZSBjYW4gb3B0aW1pc2UgdGhlIG1hdHJpeCBjb25jYXRlbmF0aW9uIHByb2Nlc3MuLiB3b29vIVxuICAgIC8vIG1hdDMubXVsdGlwbHkodGhpcy5sb2NhbFRyYW5zZm9ybSwgdGhpcy5wYXJlbnQud29ybGRUcmFuc2Zvcm0sIHRoaXMud29ybGRUcmFuc2Zvcm0pO1xuICAgIHRoaXMud29ybGRBbHBoYSA9IHRoaXMuYWxwaGEgKiB0aGlzLnBhcmVudC53b3JsZEFscGhhO1xuXG4gICAgdGhpcy52Y291bnQgPSBnbG9iYWxzLnZpc2libGVDb3VudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGlzcGxheU9iamVjdDtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIERpc3BsYXlPYmplY3QgPSByZXF1aXJlKCcuL0Rpc3BsYXlPYmplY3QnKTtcblxuLyoqXG4gKiBBIERpc3BsYXlPYmplY3RDb250YWluZXIgcmVwcmVzZW50cyBhIGNvbGxlY3Rpb24gb2YgZGlzcGxheSBvYmplY3RzLlxuICogSXQgaXMgdGhlIGJhc2UgY2xhc3Mgb2YgYWxsIGRpc3BsYXkgb2JqZWN0cyB0aGF0IGFjdCBhcyBhIGNvbnRhaW5lciBmb3Igb3RoZXIgb2JqZWN0cy5cbiAqXG4gKiBAY2xhc3MgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdFxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIERpc3BsYXlPYmplY3RDb250YWluZXIoKVxue1xuICAgIERpc3BsYXlPYmplY3QuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBvZiBjaGlsZHJlbiBvZiB0aGlzIGNvbnRhaW5lci5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjaGlsZHJlblxuICAgICAqIEB0eXBlIEFycmF5PERpc3BsYXlPYmplY3Q+XG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xufVxuXG52YXIgcHJvdG8gPSBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGlzcGxheU9iamVjdC5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBEaXNwbGF5T2JqZWN0Q29udGFpbmVyfVxufSk7XG5cbi8qKlxuICogQWRkcyBhIGNoaWxkIHRvIHRoZSBjb250YWluZXIuXG4gKlxuICogQG1ldGhvZCBhZGRDaGlsZFxuICogQHBhcmFtIGNoaWxkIHtEaXNwbGF5T2JqZWN0fSBUaGUgRGlzcGxheU9iamVjdCB0byBhZGQgdG8gdGhlIGNvbnRhaW5lclxuICovXG5wcm90by5hZGRDaGlsZCA9IGZ1bmN0aW9uIGFkZENoaWxkKGNoaWxkKVxue1xuICAgIGlmKGNoaWxkLnBhcmVudCAmJiBjaGlsZC5wYXJlbnQgIT09IHRoaXMpXG4gICAge1xuICAgICAgICAvLy8vIENPVUxEIEJFIFRISVM/Pz9cbiAgICAgICAgY2hpbGQucGFyZW50LnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICAvLyAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNoaWxkLnBhcmVudCA9IHRoaXM7XG5cbiAgICB0aGlzLmNoaWxkcmVuLnB1c2goY2hpbGQpO1xuXG4gICAgLy8gdXBkYXRlIHRoZSBzdGFnZSByZWZmZXJlbmNlLi5cblxuICAgIGlmKHRoaXMuc3RhZ2UpXG4gICAge1xuICAgICAgICB2YXIgdG1wQ2hpbGQgPSBjaGlsZDtcbiAgICAgICAgZG9cbiAgICAgICAge1xuICAgICAgICAgICAgaWYodG1wQ2hpbGQuaW50ZXJhY3RpdmUpdGhpcy5zdGFnZS5kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB0bXBDaGlsZC5zdGFnZSA9IHRoaXMuc3RhZ2U7XG4gICAgICAgICAgICB0bXBDaGlsZCA9IHRtcENoaWxkLl9pTmV4dDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSh0bXBDaGlsZCk7XG4gICAgfVxuXG4gICAgLy8gTElOS0VEIExJU1QgLy9cblxuICAgIC8vIG1vZGlmeSB0aGUgbGlzdC4uXG4gICAgdmFyIGNoaWxkRmlyc3QgPSBjaGlsZC5maXJzdDtcbiAgICB2YXIgY2hpbGRMYXN0ID0gY2hpbGQubGFzdDtcbiAgICB2YXIgbmV4dE9iamVjdDtcbiAgICB2YXIgcHJldmlvdXNPYmplY3Q7XG5cbiAgICAvLyB0aGlzIGNvdWxkIGJlIHdyb25nIGlmIHRoZXJlIGlzIGEgZmlsdGVyPz9cbiAgICBpZih0aGlzLl9maWx0ZXJzIHx8IHRoaXMuX21hc2spXG4gICAge1xuICAgICAgICBwcmV2aW91c09iamVjdCA9ICB0aGlzLmxhc3QuX2lQcmV2O1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBwcmV2aW91c09iamVjdCA9IHRoaXMubGFzdDtcbiAgICB9XG5cbiAgICBuZXh0T2JqZWN0ID0gcHJldmlvdXNPYmplY3QuX2lOZXh0O1xuXG4gICAgLy8gYWx3YXlzIHRydWUgaW4gdGhpcyBjYXNlXG4gICAgLy8gbmVlZCB0byBtYWtlIHN1cmUgdGhlIHBhcmVudHMgbGFzdCBpcyB1cGRhdGVkIHRvb1xuICAgIHZhciB1cGRhdGVMYXN0ID0gdGhpcztcbiAgICB2YXIgcHJldkxhc3QgPSBwcmV2aW91c09iamVjdDtcblxuICAgIHdoaWxlKHVwZGF0ZUxhc3QpXG4gICAge1xuICAgICAgICBpZih1cGRhdGVMYXN0Lmxhc3QgPT09IHByZXZMYXN0KVxuICAgICAgICB7XG4gICAgICAgICAgICB1cGRhdGVMYXN0Lmxhc3QgPSBjaGlsZC5sYXN0O1xuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZUxhc3QgPSB1cGRhdGVMYXN0LnBhcmVudDtcbiAgICB9XG5cbiAgICBpZihuZXh0T2JqZWN0KVxuICAgIHtcbiAgICAgICAgbmV4dE9iamVjdC5faVByZXYgPSBjaGlsZExhc3Q7XG4gICAgICAgIGNoaWxkTGFzdC5faU5leHQgPSBuZXh0T2JqZWN0O1xuICAgIH1cblxuICAgIGNoaWxkRmlyc3QuX2lQcmV2ID0gcHJldmlvdXNPYmplY3Q7XG4gICAgcHJldmlvdXNPYmplY3QuX2lOZXh0ID0gY2hpbGRGaXJzdDtcblxuICAgIC8vIG5lZWQgdG8gcmVtb3ZlIGFueSByZW5kZXIgZ3JvdXBzLi5cbiAgICBpZih0aGlzLl9fcmVuZGVyR3JvdXApXG4gICAge1xuICAgICAgICAvLyBiZWluZyB1c2VkIGJ5IGEgcmVuZGVyVGV4dHVyZS4uIGlmIGl0IGV4aXN0cyB0aGVuIGl0IG11c3QgYmUgZnJvbSBhIHJlbmRlciB0ZXh0dXJlO1xuICAgICAgICBpZihjaGlsZC5fX3JlbmRlckdyb3VwKWNoaWxkLl9fcmVuZGVyR3JvdXAucmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGNoaWxkKTtcbiAgICAgICAgLy8gYWRkIHRoZW0gdG8gdGhlIG5ldyByZW5kZXIgZ3JvdXAuLlxuICAgICAgICB0aGlzLl9fcmVuZGVyR3JvdXAuYWRkRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGNoaWxkKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEFkZHMgYSBjaGlsZCB0byB0aGUgY29udGFpbmVyIGF0IGEgc3BlY2lmaWVkIGluZGV4LiBJZiB0aGUgaW5kZXggaXMgb3V0IG9mIGJvdW5kcyBhbiBlcnJvciB3aWxsIGJlIHRocm93blxuICpcbiAqIEBtZXRob2QgYWRkQ2hpbGRBdFxuICogQHBhcmFtIGNoaWxkIHtEaXNwbGF5T2JqZWN0fSBUaGUgY2hpbGQgdG8gYWRkXG4gKiBAcGFyYW0gaW5kZXgge051bWJlcn0gVGhlIGluZGV4IHRvIHBsYWNlIHRoZSBjaGlsZCBpblxuICovXG5wcm90by5hZGRDaGlsZEF0ID0gZnVuY3Rpb24gYWRkQ2hpbGRBdChjaGlsZCwgaW5kZXgpXG57XG4gICAgaWYoaW5kZXggPj0gMCAmJiBpbmRleCA8PSB0aGlzLmNoaWxkcmVuLmxlbmd0aClcbiAgICB7XG4gICAgICAgIGlmKGNoaWxkLnBhcmVudCAhPT0gdW5kZWZpbmVkKVxuICAgICAgICB7XG4gICAgICAgICAgICBjaGlsZC5wYXJlbnQucmVtb3ZlQ2hpbGQoY2hpbGQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2hpbGQucGFyZW50ID0gdGhpcztcblxuICAgICAgICBpZih0aGlzLnN0YWdlKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgdG1wQ2hpbGQgPSBjaGlsZDtcbiAgICAgICAgICAgIGRvXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWYodG1wQ2hpbGQuaW50ZXJhY3RpdmUpdGhpcy5zdGFnZS5kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdG1wQ2hpbGQuc3RhZ2UgPSB0aGlzLnN0YWdlO1xuICAgICAgICAgICAgICAgIHRtcENoaWxkID0gdG1wQ2hpbGQuX2lOZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUodG1wQ2hpbGQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbW9kaWZ5IHRoZSBsaXN0Li5cbiAgICAgICAgdmFyIGNoaWxkRmlyc3QgPSBjaGlsZC5maXJzdDtcbiAgICAgICAgdmFyIGNoaWxkTGFzdCA9IGNoaWxkLmxhc3Q7XG4gICAgICAgIHZhciBuZXh0T2JqZWN0O1xuICAgICAgICB2YXIgcHJldmlvdXNPYmplY3Q7XG5cbiAgICAgICAgaWYoaW5kZXggPT09IHRoaXMuY2hpbGRyZW4ubGVuZ3RoKVxuICAgICAgICB7XG4gICAgICAgICAgICBwcmV2aW91c09iamVjdCA9ICB0aGlzLmxhc3Q7XG4gICAgICAgICAgICB2YXIgdXBkYXRlTGFzdCA9IHRoaXM7XG4gICAgICAgICAgICB2YXIgcHJldkxhc3QgPSB0aGlzLmxhc3Q7XG4gICAgICAgICAgICB3aGlsZSh1cGRhdGVMYXN0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlmKHVwZGF0ZUxhc3QubGFzdCA9PT0gcHJldkxhc3QpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVMYXN0Lmxhc3QgPSBjaGlsZC5sYXN0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB1cGRhdGVMYXN0ID0gdXBkYXRlTGFzdC5wYXJlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihpbmRleCA9PT0gMClcbiAgICAgICAge1xuICAgICAgICAgICAgcHJldmlvdXNPYmplY3QgPSB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgcHJldmlvdXNPYmplY3QgPSB0aGlzLmNoaWxkcmVuW2luZGV4LTFdLmxhc3Q7XG4gICAgICAgIH1cblxuICAgICAgICBuZXh0T2JqZWN0ID0gcHJldmlvdXNPYmplY3QuX2lOZXh0O1xuXG4gICAgICAgIC8vIGFsd2F5cyB0cnVlIGluIHRoaXMgY2FzZVxuICAgICAgICBpZihuZXh0T2JqZWN0KVxuICAgICAgICB7XG4gICAgICAgICAgICBuZXh0T2JqZWN0Ll9pUHJldiA9IGNoaWxkTGFzdDtcbiAgICAgICAgICAgIGNoaWxkTGFzdC5faU5leHQgPSBuZXh0T2JqZWN0O1xuICAgICAgICB9XG5cbiAgICAgICAgY2hpbGRGaXJzdC5faVByZXYgPSBwcmV2aW91c09iamVjdDtcbiAgICAgICAgcHJldmlvdXNPYmplY3QuX2lOZXh0ID0gY2hpbGRGaXJzdDtcblxuICAgICAgICB0aGlzLmNoaWxkcmVuLnNwbGljZShpbmRleCwgMCwgY2hpbGQpO1xuICAgICAgICAvLyBuZWVkIHRvIHJlbW92ZSBhbnkgcmVuZGVyIGdyb3Vwcy4uXG4gICAgICAgIGlmKHRoaXMuX19yZW5kZXJHcm91cClcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gYmVpbmcgdXNlZCBieSBhIHJlbmRlclRleHR1cmUuLiBpZiBpdCBleGlzdHMgdGhlbiBpdCBtdXN0IGJlIGZyb20gYSByZW5kZXIgdGV4dHVyZTtcbiAgICAgICAgICAgIGlmKGNoaWxkLl9fcmVuZGVyR3JvdXApY2hpbGQuX19yZW5kZXJHcm91cC5yZW1vdmVEaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4oY2hpbGQpO1xuICAgICAgICAgICAgLy8gYWRkIHRoZW0gdG8gdGhlIG5ldyByZW5kZXIgZ3JvdXAuLlxuICAgICAgICAgICAgdGhpcy5fX3JlbmRlckdyb3VwLmFkZERpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihjaGlsZCk7XG4gICAgICAgIH1cblxuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoY2hpbGQgKyAnIFRoZSBpbmRleCAnKyBpbmRleCArJyBzdXBwbGllZCBpcyBvdXQgb2YgYm91bmRzICcgKyB0aGlzLmNoaWxkcmVuLmxlbmd0aCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBbTllJXSBTd2FwcyB0aGUgZGVwdGggb2YgMiBkaXNwbGF5T2JqZWN0c1xuICpcbiAqIEBtZXRob2Qgc3dhcENoaWxkcmVuXG4gKiBAcGFyYW0gY2hpbGQge0Rpc3BsYXlPYmplY3R9XG4gKiBAcGFyYW0gY2hpbGQyIHtEaXNwbGF5T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uc3dhcENoaWxkcmVuID0gZnVuY3Rpb24gc3dhcENoaWxkcmVuKGNoaWxkLCBjaGlsZDIpXG57XG4gICAgaWYoY2hpbGQgPT09IGNoaWxkMikge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluZGV4MSA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZihjaGlsZCk7XG4gICAgdmFyIGluZGV4MiA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZihjaGlsZDIpO1xuXG4gICAgaWYoaW5kZXgxIDwgMCB8fCBpbmRleDIgPCAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignc3dhcENoaWxkcmVuOiBCb3RoIHRoZSBzdXBwbGllZCBEaXNwbGF5T2JqZWN0cyBtdXN0IGJlIGEgY2hpbGQgb2YgdGhlIGNhbGxlci4nKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgICB0aGlzLnJlbW92ZUNoaWxkKGNoaWxkMik7XG5cbiAgICBpZihpbmRleDEgPCBpbmRleDIpXG4gICAge1xuICAgICAgICB0aGlzLmFkZENoaWxkQXQoY2hpbGQyLCBpbmRleDEpO1xuICAgICAgICB0aGlzLmFkZENoaWxkQXQoY2hpbGQsIGluZGV4Mik7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMuYWRkQ2hpbGRBdChjaGlsZCwgaW5kZXgyKTtcbiAgICAgICAgdGhpcy5hZGRDaGlsZEF0KGNoaWxkMiwgaW5kZXgxKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIENoaWxkIGF0IHRoZSBzcGVjaWZpZWQgaW5kZXhcbiAqXG4gKiBAbWV0aG9kIGdldENoaWxkQXRcbiAqIEBwYXJhbSBpbmRleCB7TnVtYmVyfSBUaGUgaW5kZXggdG8gZ2V0IHRoZSBjaGlsZCBmcm9tXG4gKi9cbnByb3RvLmdldENoaWxkQXQgPSBmdW5jdGlvbiBnZXRDaGlsZEF0KGluZGV4KVxue1xuICAgIGlmKGluZGV4ID49IDAgJiYgaW5kZXggPCB0aGlzLmNoaWxkcmVuLmxlbmd0aClcbiAgICB7XG4gICAgICAgIHJldHVybiB0aGlzLmNoaWxkcmVuW2luZGV4XTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdCb3RoIHRoZSBzdXBwbGllZCBEaXNwbGF5T2JqZWN0cyBtdXN0IGJlIGEgY2hpbGQgb2YgdGhlIGNhbGxlciAnICsgdGhpcyk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBSZW1vdmVzIGEgY2hpbGQgZnJvbSB0aGUgY29udGFpbmVyLlxuICpcbiAqIEBtZXRob2QgcmVtb3ZlQ2hpbGRcbiAqIEBwYXJhbSBjaGlsZCB7RGlzcGxheU9iamVjdH0gVGhlIERpc3BsYXlPYmplY3QgdG8gcmVtb3ZlXG4gKi9cbnByb3RvLnJlbW92ZUNoaWxkID0gZnVuY3Rpb24gcmVtb3ZlQ2hpbGQoY2hpbGQpXG57XG4gICAgdmFyIGluZGV4ID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKCBjaGlsZCApO1xuICAgIGlmICggaW5kZXggIT09IC0xIClcbiAgICB7XG4gICAgICAgIC8vIHVubGluayAvL1xuICAgICAgICAvLyBtb2RpZnkgdGhlIGxpc3QuLlxuICAgICAgICB2YXIgY2hpbGRGaXJzdCA9IGNoaWxkLmZpcnN0O1xuICAgICAgICB2YXIgY2hpbGRMYXN0ID0gY2hpbGQubGFzdDtcblxuICAgICAgICB2YXIgbmV4dE9iamVjdCA9IGNoaWxkTGFzdC5faU5leHQ7XG4gICAgICAgIHZhciBwcmV2aW91c09iamVjdCA9IGNoaWxkRmlyc3QuX2lQcmV2O1xuXG4gICAgICAgIGlmKG5leHRPYmplY3QpbmV4dE9iamVjdC5faVByZXYgPSBwcmV2aW91c09iamVjdDtcbiAgICAgICAgcHJldmlvdXNPYmplY3QuX2lOZXh0ID0gbmV4dE9iamVjdDtcblxuICAgICAgICBpZih0aGlzLmxhc3QgPT09IGNoaWxkTGFzdClcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIHRlbXBMYXN0ID0gY2hpbGRGaXJzdC5faVByZXY7XG4gICAgICAgICAgICAvLyBuZWVkIHRvIG1ha2Ugc3VyZSB0aGUgcGFyZW50cyBsYXN0IGlzIHVwZGF0ZWQgdG9vXG4gICAgICAgICAgICB2YXIgdXBkYXRlTGFzdCA9IHRoaXM7XG5cbiAgICAgICAgICAgIHdoaWxlKHVwZGF0ZUxhc3QubGFzdCA9PT0gY2hpbGRMYXN0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxhc3QubGFzdCA9IHRlbXBMYXN0O1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxhc3QgPSB1cGRhdGVMYXN0LnBhcmVudDtcbiAgICAgICAgICAgICAgICBpZighdXBkYXRlTGFzdClicmVhaztcblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2hpbGRMYXN0Ll9pTmV4dCA9IG51bGw7XG4gICAgICAgIGNoaWxkRmlyc3QuX2lQcmV2ID0gbnVsbDtcblxuICAgICAgICAvLyB1cGRhdGUgdGhlIHN0YWdlIHJlZmVyZW5jZS4uXG4gICAgICAgIGlmKHRoaXMuc3RhZ2UpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciB0bXBDaGlsZCA9IGNoaWxkO1xuICAgICAgICAgICAgZG9cbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZih0bXBDaGlsZC5pbnRlcmFjdGl2ZSl0aGlzLnN0YWdlLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0bXBDaGlsZC5zdGFnZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgdG1wQ2hpbGQgPSB0bXBDaGlsZC5faU5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSh0bXBDaGlsZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3ZWJHTCB0cmltXG4gICAgICAgIGlmKGNoaWxkLl9fcmVuZGVyR3JvdXApXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNoaWxkLl9fcmVuZGVyR3JvdXAucmVtb3ZlRGlzcGxheU9iamVjdEFuZENoaWxkcmVuKGNoaWxkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNoaWxkLnBhcmVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoIGluZGV4LCAxICk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihjaGlsZCArICcgVGhlIHN1cHBsaWVkIERpc3BsYXlPYmplY3QgbXVzdCBiZSBhIGNoaWxkIG9mIHRoZSBjYWxsZXIgJyArIHRoaXMpO1xuICAgIH1cbn07XG5cbi8qXG4gKiBVcGRhdGVzIHRoZSBjb250YWluZXIncyBjaGlsZHJlbidzIHRyYW5zZm9ybSBmb3IgcmVuZGVyaW5nXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgaWYoIXRoaXMudmlzaWJsZSlyZXR1cm47XG5cbiAgICBEaXNwbGF5T2JqZWN0LnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbCggdGhpcyApO1xuXG4gICAgZm9yKHZhciBpPTAsaj10aGlzLmNoaWxkcmVuLmxlbmd0aDsgaTxqOyBpKyspXG4gICAge1xuICAgICAgICB0aGlzLmNoaWxkcmVuW2ldLnVwZGF0ZVRyYW5zZm9ybSgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGlzcGxheU9iamVjdENvbnRhaW5lcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIFNwcml0ZSA9IHJlcXVpcmUoJy4vU3ByaXRlJyk7XG5cbi8qKlxuICogQSBNb3ZpZUNsaXAgaXMgYSBzaW1wbGUgd2F5IHRvIGRpc3BsYXkgYW4gYW5pbWF0aW9uIGRlcGljdGVkIGJ5IGEgbGlzdCBvZiB0ZXh0dXJlcy5cbiAqXG4gKiBAY2xhc3MgTW92aWVDbGlwXG4gKiBAZXh0ZW5kcyBTcHJpdGVcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHRleHR1cmVzIHtBcnJheTxUZXh0dXJlPn0gYW4gYXJyYXkgb2Yge1RleHR1cmV9IG9iamVjdHMgdGhhdCBtYWtlIHVwIHRoZSBhbmltYXRpb25cbiAqL1xuZnVuY3Rpb24gTW92aWVDbGlwKHRleHR1cmVzKVxue1xuICAgIFNwcml0ZS5jYWxsKHRoaXMsIHRleHR1cmVzWzBdKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBhcnJheSBvZiB0ZXh0dXJlcyB0aGF0IG1ha2UgdXAgdGhlIGFuaW1hdGlvblxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRleHR1cmVzXG4gICAgICogQHR5cGUgQXJyYXlcbiAgICAgKi9cbiAgICB0aGlzLnRleHR1cmVzID0gdGV4dHVyZXM7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3BlZWQgdGhhdCB0aGUgTW92aWVDbGlwIHdpbGwgcGxheSBhdC4gSGlnaGVyIGlzIGZhc3RlciwgbG93ZXIgaXMgc2xvd2VyXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYW5pbWF0aW9uU3BlZWRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAxXG4gICAgICovXG4gICAgdGhpcy5hbmltYXRpb25TcGVlZCA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgbW92aWUgY2xpcCByZXBlYXRzIGFmdGVyIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbG9vcFxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKiBAZGVmYXVsdCB0cnVlXG4gICAgICovXG4gICAgdGhpcy5sb29wID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIE1vdmllQ2xpcCBmaW5pc2hlcyBwbGF5aW5nXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgb25Db21wbGV0ZVxuICAgICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAgICovXG4gICAgdGhpcy5vbkNvbXBsZXRlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIFRoZSBpbmRleCBNb3ZpZUNsaXBzIGN1cnJlbnQgZnJhbWUgKHRoaXMgbWF5IG5vdCBoYXZlIHRvIGJlIGEgd2hvbGUgbnVtYmVyKVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGN1cnJlbnRGcmFtZVxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLmN1cnJlbnRGcmFtZSA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBJbmRpY2F0ZXMgaWYgdGhlIE1vdmllQ2xpcCBpcyBjdXJyZW50bHkgcGxheWluZ1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHBsYXlpbmdcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IE1vdmllQ2xpcC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFNwcml0ZS5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBNb3ZpZUNsaXB9XG59KTtcblxuLyoqXG4qIFtyZWFkLW9ubHldIHRvdGFsRnJhbWVzIGlzIHRoZSB0b3RhbCBudW1iZXIgb2YgZnJhbWVzIGluIHRoZSBNb3ZpZUNsaXAuIFRoaXMgaXMgdGhlIHNhbWUgYXMgbnVtYmVyIG9mIHRleHR1cmVzXG4qIGFzc2lnbmVkIHRvIHRoZSBNb3ZpZUNsaXAuXG4qXG4qIEBwcm9wZXJ0eSB0b3RhbEZyYW1lc1xuKiBAdHlwZSBOdW1iZXJcbiogQGRlZmF1bHQgMFxuKiBAcmVhZE9ubHlcbiovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICd0b3RhbEZyYW1lcycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50ZXh0dXJlcy5sZW5ndGg7XG4gICAgfVxufSk7XG5cblxuLyoqXG4gKiBTdG9wcyB0aGUgTW92aWVDbGlwXG4gKlxuICogQG1ldGhvZCBzdG9wXG4gKi9cbnByb3RvLnN0b3AgPSBmdW5jdGlvbigpXG57XG4gICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG59O1xuXG4vKipcbiAqIFBsYXlzIHRoZSBNb3ZpZUNsaXBcbiAqXG4gKiBAbWV0aG9kIHBsYXlcbiAqL1xucHJvdG8ucGxheSA9IGZ1bmN0aW9uKClcbntcbiAgICB0aGlzLnBsYXlpbmcgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBTdG9wcyB0aGUgTW92aWVDbGlwIGFuZCBnb2VzIHRvIGEgc3BlY2lmaWMgZnJhbWVcbiAqXG4gKiBAbWV0aG9kIGdvdG9BbmRTdG9wXG4gKiBAcGFyYW0gZnJhbWVOdW1iZXIge051bWJlcn0gZnJhbWUgaW5kZXggdG8gc3RvcCBhdFxuICovXG5wcm90by5nb3RvQW5kU3RvcCA9IGZ1bmN0aW9uKGZyYW1lTnVtYmVyKVxue1xuICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuICAgIHRoaXMuY3VycmVudEZyYW1lID0gZnJhbWVOdW1iZXI7XG4gICAgdmFyIHJvdW5kID0gKHRoaXMuY3VycmVudEZyYW1lICsgMC41KSB8IDA7XG4gICAgdGhpcy5zZXRUZXh0dXJlKHRoaXMudGV4dHVyZXNbcm91bmQgJSB0aGlzLnRleHR1cmVzLmxlbmd0aF0pO1xufTtcblxuLyoqXG4gKiBHb2VzIHRvIGEgc3BlY2lmaWMgZnJhbWUgYW5kIGJlZ2lucyBwbGF5aW5nIHRoZSBNb3ZpZUNsaXBcbiAqXG4gKiBAbWV0aG9kIGdvdG9BbmRQbGF5XG4gKiBAcGFyYW0gZnJhbWVOdW1iZXIge051bWJlcn0gZnJhbWUgaW5kZXggdG8gc3RhcnQgYXRcbiAqL1xucHJvdG8uZ290b0FuZFBsYXkgPSBmdW5jdGlvbiBnb3RvQW5kUGxheShmcmFtZU51bWJlcilcbntcbiAgICB0aGlzLmN1cnJlbnRGcmFtZSA9IGZyYW1lTnVtYmVyO1xuICAgIHRoaXMucGxheWluZyA9IHRydWU7XG59O1xuXG4vKlxuICogVXBkYXRlcyB0aGUgb2JqZWN0IHRyYW5zZm9ybSBmb3IgcmVuZGVyaW5nXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUcmFuc2Zvcm1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIHVwZGF0ZVRyYW5zZm9ybSgpXG57XG4gICAgU3ByaXRlLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbCh0aGlzKTtcblxuICAgIGlmKCF0aGlzLnBsYXlpbmcpcmV0dXJuO1xuXG4gICAgdGhpcy5jdXJyZW50RnJhbWUgKz0gdGhpcy5hbmltYXRpb25TcGVlZDtcblxuICAgIHZhciByb3VuZCA9ICh0aGlzLmN1cnJlbnRGcmFtZSArIDAuNSkgfCAwO1xuXG4gICAgaWYodGhpcy5sb29wIHx8IHJvdW5kIDwgdGhpcy50ZXh0dXJlcy5sZW5ndGgpXG4gICAge1xuICAgICAgICB0aGlzLnNldFRleHR1cmUodGhpcy50ZXh0dXJlc1tyb3VuZCAlIHRoaXMudGV4dHVyZXMubGVuZ3RoXSk7XG4gICAgfVxuICAgIGVsc2UgaWYocm91bmQgPj0gdGhpcy50ZXh0dXJlcy5sZW5ndGgpXG4gICAge1xuICAgICAgICB0aGlzLmdvdG9BbmRTdG9wKHRoaXMudGV4dHVyZXMubGVuZ3RoIC0gMSk7XG4gICAgICAgIGlmKHRoaXMub25Db21wbGV0ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5vbkNvbXBsZXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1vdmllQ2xpcDtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGJsZW5kTW9kZXMgPSByZXF1aXJlKCcuL2JsZW5kTW9kZXMnKTtcbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi9nZW9tL1BvaW50Jyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uL3RleHR1cmVzL1RleHR1cmUnKTtcblxuLyoqXG4gKiBUaGUgU1ByaXRlIG9iamVjdCBpcyB0aGUgYmFzZSBmb3IgYWxsIHRleHR1cmVkIG9iamVjdHMgdGhhdCBhcmUgcmVuZGVyZWQgdG8gdGhlIHNjcmVlblxuICpcbiAqIEBjbGFzcyBTcHJpdGVcbiAqIEBleHRlbmRzIERpc3BsYXlPYmplY3RDb250YWluZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHRleHR1cmUge1RleHR1cmV9IFRoZSB0ZXh0dXJlIGZvciB0aGlzIHNwcml0ZVxuICogQHR5cGUgU3RyaW5nXG4gKi9cbmZ1bmN0aW9uIFNwcml0ZSh0ZXh0dXJlKVxue1xuICAgIERpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBhbmNob3Igc2V0cyB0aGUgb3JpZ2luIHBvaW50IG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFRoZSBkZWZhdWx0IGlzIDAsMCB0aGlzIG1lYW5zIHRoZSB0ZXh0dXJlcyBvcmlnaW4gaXMgdGhlIHRvcCBsZWZ0XG4gICAgICogU2V0dGluZyB0aGFuIGFuY2hvciB0byAwLjUsMC41IG1lYW5zIHRoZSB0ZXh0dXJlcyBvcmlnaW4gaXMgY2VudGVyZWRcbiAgICAgKiBTZXR0aW5nIHRoZSBhbmNob3IgdG8gMSwxIHdvdWxkIG1lYW4gdGhlIHRleHR1cmVzIG9yaWdpbiBwb2ludHMgd2lsbCBiZSB0aGUgYm90dG9tIHJpZ2h0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYW5jaG9yXG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLmFuY2hvciA9IG5ldyBQb2ludCgpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRleHR1cmUgdGhhdCB0aGUgc3ByaXRlIGlzIHVzaW5nXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdGV4dHVyZVxuICAgICAqIEB0eXBlIFRleHR1cmVcbiAgICAgKi9cbiAgICB0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGJsZW5kIG1vZGUgb2Ygc3ByaXRlLlxuICAgICAqIGN1cnJlbnRseSBzdXBwb3J0cyBibGVuZE1vZGVzLk5PUk1BTCBhbmQgYmxlbmRNb2Rlcy5TQ1JFRU5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBibGVuZE1vZGVcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICB0aGlzLmJsZW5kTW9kZSA9IGJsZW5kTW9kZXMuTk9STUFMO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHdpZHRoIG9mIHRoZSBzcHJpdGUgKHRoaXMgaXMgaW5pdGlhbGx5IHNldCBieSB0aGUgdGV4dHVyZSlcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBfd2lkdGhcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuX3dpZHRoID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIHNwcml0ZSAodGhpcyBpcyBpbml0aWFsbHkgc2V0IGJ5IHRoZSB0ZXh0dXJlKVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IF9oZWlnaHRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuX2hlaWdodCA9IDA7XG5cbiAgICBpZih0ZXh0dXJlLmJhc2VUZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgIHRoaXMudGV4dHVyZS5hZGRFdmVudExpc3RlbmVyKCAndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhhdC5vblRleHR1cmVVcGRhdGUoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5yZW5kZXJhYmxlID0gdHJ1ZTtcbn1cblxudmFyIHByb3RvID0gU3ByaXRlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBTcHJpdGV9XG59KTtcblxuLyoqXG4gKiBUaGUgd2lkdGggb2YgdGhlIHNwcml0ZSwgc2V0dGluZyB0aGlzIHdpbGwgYWN0dWFsbHkgbW9kaWZ5IHRoZSBzY2FsZSB0byBhY2hlaXZlIHRoZSB2YWx1ZSBzZXRcbiAqXG4gKiBAcHJvcGVydHkgd2lkdGhcbiAqIEB0eXBlIE51bWJlclxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICd3aWR0aCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zY2FsZS54ICogdGhpcy50ZXh0dXJlLmZyYW1lLndpZHRoO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLnNjYWxlLnggPSB2YWx1ZSAvIHRoaXMudGV4dHVyZS5mcmFtZS53aWR0aDtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuLyoqXG4gKiBUaGUgaGVpZ2h0IG9mIHRoZSBzcHJpdGUsIHNldHRpbmcgdGhpcyB3aWxsIGFjdHVhbGx5IG1vZGlmeSB0aGUgc2NhbGUgdG8gYWNoZWl2ZSB0aGUgdmFsdWUgc2V0XG4gKlxuICogQHByb3BlcnR5IGhlaWdodFxuICogQHR5cGUgTnVtYmVyXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2hlaWdodCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gIHRoaXMuc2NhbGUueSAqIHRoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQ7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuc2NhbGUueSA9IHZhbHVlIC8gdGhpcy50ZXh0dXJlLmZyYW1lLmhlaWdodDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogU2V0cyB0aGUgdGV4dHVyZSBvZiB0aGUgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBzZXRUZXh0dXJlXG4gKiBAcGFyYW0gdGV4dHVyZSB7VGV4dHVyZX0gVGhlIHRleHR1cmUgdGhhdCBpcyBkaXNwbGF5ZWQgYnkgdGhlIHNwcml0ZVxuICovXG5wcm90by5zZXRUZXh0dXJlID0gZnVuY3Rpb24gc2V0VGV4dHVyZSh0ZXh0dXJlKVxue1xuICAgIC8vIHN0b3AgY3VycmVudCB0ZXh0dXJlO1xuICAgIGlmKHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZSAhPT0gdGV4dHVyZS5iYXNlVGV4dHVyZSlcbiAgICB7XG4gICAgICAgIHRoaXMudGV4dHVyZUNoYW5nZSA9IHRydWU7XG4gICAgICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cbiAgICAgICAgaWYodGhpcy5fX3JlbmRlckdyb3VwKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLl9fcmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZSh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBXaGVuIHRoZSB0ZXh0dXJlIGlzIHVwZGF0ZWQsIHRoaXMgZXZlbnQgd2lsbCBmaXJlIHRvIHVwZGF0ZSB0aGUgc2NhbGUgYW5kIGZyYW1lXG4gKlxuICogQG1ldGhvZCBvblRleHR1cmVVcGRhdGVcbiAqIEBwYXJhbSBldmVudFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25UZXh0dXJlVXBkYXRlID0gZnVuY3Rpb24gb25UZXh0dXJlVXBkYXRlKClcbntcbiAgICAvLyBzbyBpZiBfd2lkdGggaXMgMCB0aGVuIHdpZHRoIHdhcyBub3Qgc2V0Li5cbiAgICBpZih0aGlzLl93aWR0aCl0aGlzLnNjYWxlLnggPSB0aGlzLl93aWR0aCAvIHRoaXMudGV4dHVyZS5mcmFtZS53aWR0aDtcbiAgICBpZih0aGlzLl9oZWlnaHQpdGhpcy5zY2FsZS55ID0gdGhpcy5faGVpZ2h0IC8gdGhpcy50ZXh0dXJlLmZyYW1lLmhlaWdodDtcblxuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcblxuLy8gc29tZSBoZWxwZXIgZnVuY3Rpb25zLi5cblxuLyoqXG4gKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgY3JlYXRlcyBhIHNwcml0ZSB0aGF0IHdpbGwgY29udGFpbiBhIHRleHR1cmUgZnJvbSB0aGUgVGV4dHVyZUNhY2hlIGJhc2VkIG9uIHRoZSBmcmFtZUlkXG4gKiBUaGUgZnJhbWUgaWRzIGFyZSBjcmVhdGVkIHdoZW4gYSBUZXh0dXJlIHBhY2tlciBmaWxlIGhhcyBiZWVuIGxvYWRlZFxuICpcbiAqIEBtZXRob2QgZnJvbUZyYW1lXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0gZnJhbWVJZCB7U3RyaW5nfSBUaGUgZnJhbWUgSWQgb2YgdGhlIHRleHR1cmUgaW4gdGhlIGNhY2hlXG4gKiBAcmV0dXJuIHtTcHJpdGV9IEEgbmV3IFNwcml0ZSB1c2luZyBhIHRleHR1cmUgZnJvbSB0aGUgdGV4dHVyZSBjYWNoZSBtYXRjaGluZyB0aGUgZnJhbWVJZFxuICovXG5TcHJpdGUuZnJvbUZyYW1lID0gZnVuY3Rpb24gZnJvbUZyYW1lKGZyYW1lSWQpXG57XG4gICAgdmFyIHRleHR1cmUgPSBUZXh0dXJlLmNhY2hlW2ZyYW1lSWRdO1xuICAgIGlmKCF0ZXh0dXJlKSB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBmcmFtZUlkIFwiJyArIGZyYW1lSWQgKyAnXCIgZG9lcyBub3QgZXhpc3QgaW4gdGhlIHRleHR1cmUgY2FjaGUnICsgdGhpcyk7XG4gICAgcmV0dXJuIG5ldyBTcHJpdGUodGV4dHVyZSk7XG59O1xuXG4vKipcbiAqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCBjcmVhdGVzIGEgc3ByaXRlIHRoYXQgd2lsbCBjb250YWluIGEgdGV4dHVyZSBiYXNlZCBvbiBhbiBpbWFnZSB1cmxcbiAqIElmIHRoZSBpbWFnZSBpcyBub3QgaW4gdGhlIHRleHR1cmUgY2FjaGUgaXQgd2lsbCBiZSBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIGZyb21JbWFnZVxuICogQHN0YXRpY1xuICogQHBhcmFtIGltYWdlSWQge1N0cmluZ30gVGhlIGltYWdlIHVybCBvZiB0aGUgdGV4dHVyZVxuICogQHJldHVybiB7U3ByaXRlfSBBIG5ldyBTcHJpdGUgdXNpbmcgYSB0ZXh0dXJlIGZyb20gdGhlIHRleHR1cmUgY2FjaGUgbWF0Y2hpbmcgdGhlIGltYWdlIGlkXG4gKi9cblNwcml0ZS5mcm9tSW1hZ2UgPSBmdW5jdGlvbiBmcm9tSW1hZ2UoaW1hZ2VJZClcbntcbiAgICB2YXIgdGV4dHVyZSA9IFRleHR1cmUuZnJvbUltYWdlKGltYWdlSWQpO1xuICAgIHJldHVybiBuZXcgU3ByaXRlKHRleHR1cmUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTcHJpdGU7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgbWF0MyA9IHJlcXVpcmUoJy4uL2dlb20vbWF0cml4JykubWF0MztcbnZhciBoZXgycmdiID0gcmVxdWlyZSgnLi4vdXRpbHMvY29sb3InKS5oZXgycmdiO1xuXG52YXIgRGlzcGxheU9iamVjdENvbnRhaW5lciA9IHJlcXVpcmUoJy4vRGlzcGxheU9iamVjdENvbnRhaW5lcicpO1xudmFyIEludGVyYWN0aW9uTWFuYWdlciA9IHJlcXVpcmUoJy4uL0ludGVyYWN0aW9uTWFuYWdlcicpO1xudmFyIFJlY3RhbmdsZSA9IHJlcXVpcmUoJy4uL2dlb20vUmVjdGFuZ2xlJyk7XG5cbi8qKlxuICogQSBTdGFnZSByZXByZXNlbnRzIHRoZSByb290IG9mIHRoZSBkaXNwbGF5IHRyZWUuIEV2ZXJ5dGhpbmcgY29ubmVjdGVkIHRvIHRoZSBzdGFnZSBpcyByZW5kZXJlZFxuICpcbiAqIEBjbGFzcyBTdGFnZVxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gYmFja2dyb3VuZENvbG9yIHtOdW1iZXJ9IHRoZSBiYWNrZ3JvdW5kIGNvbG9yIG9mIHRoZSBzdGFnZSwgZWFzaWVzdCB3YXkgdG8gcGFzcyB0aGlzIGluIGlzIGluIGhleCBmb3JtYXRcbiAqICAgICAgbGlrZTogMHhGRkZGRkYgZm9yIHdoaXRlXG4gKi9cbmZ1bmN0aW9uIFN0YWdlKGJhY2tncm91bmRDb2xvcilcbntcbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBDdXJyZW50IHRyYW5zZm9ybSBvZiB0aGUgb2JqZWN0IGJhc2VkIG9uIHdvcmxkIChwYXJlbnQpIGZhY3RvcnNcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3b3JsZFRyYW5zZm9ybVxuICAgICAqIEB0eXBlIE1hdDNcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMud29ybGRUcmFuc2Zvcm0gPSBtYXQzLmNyZWF0ZSgpO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciBvciBub3QgdGhlIHN0YWdlIGlzIGludGVyYWN0aXZlXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgaW50ZXJhY3RpdmVcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICovXG4gICAgdGhpcy5pbnRlcmFjdGl2ZSA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaW50ZXJhY3Rpb24gbWFuYWdlIGZvciB0aGlzIHN0YWdlLCBtYW5hZ2VzIGFsbCBpbnRlcmFjdGl2ZSBhY3Rpdml0eSBvbiB0aGUgc3RhZ2VcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBpbnRlcmFjdGl2ZVxuICAgICAqIEB0eXBlIEludGVyYWN0aW9uTWFuYWdlclxuICAgICAqL1xuICAgIHRoaXMuaW50ZXJhY3Rpb25NYW5hZ2VyID0gbmV3IEludGVyYWN0aW9uTWFuYWdlcih0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHN0YWdlIGlzIGRpcnR5IGFuZCBuZWVkcyB0byBoYXZlIGludGVyYWN0aW9ucyB1cGRhdGVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZGlydHlcbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcblxuICAgIHRoaXMuX19jaGlsZHJlbkFkZGVkID0gW107XG4gICAgdGhpcy5fX2NoaWxkcmVuUmVtb3ZlZCA9IFtdO1xuXG4gICAgLy90aGUgc3RhZ2UgaXMgaXQncyBvd24gc3RhZ2VcbiAgICB0aGlzLnN0YWdlID0gdGhpcztcblxuICAgIC8vb3B0aW1pemUgaGl0IGRldGVjdGlvbiBhIGJpdFxuICAgIHRoaXMuc3RhZ2UuaGl0QXJlYSA9IG5ldyBSZWN0YW5nbGUoMCwwLDEwMDAwMCwgMTAwMDAwKTtcblxuICAgIHRoaXMuc2V0QmFja2dyb3VuZENvbG9yKGJhY2tncm91bmRDb2xvcik7XG4gICAgdGhpcy53b3JsZFZpc2libGUgPSB0cnVlO1xufVxuXG52YXIgcHJvdG8gPSBTdGFnZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogU3RhZ2V9XG59KTtcblxuLyoqXG4gKiBTZXRzIGFub3RoZXIgRE9NIGVsZW1lbnQgd2hpY2ggY2FuIHJlY2VpdmUgbW91c2UvdG91Y2ggaW50ZXJhY3Rpb25zIGluc3RlYWQgb2YgdGhlIGRlZmF1bHQgQ2FudmFzIGVsZW1lbnQuXG4gKiBUaGlzIGlzIHVzZWZ1bCBmb3Igd2hlbiB5b3UgaGF2ZSBvdGhlciBET00gZWxlbWVudHMgb250b3Agb2YgdGhlIENhbnZhcyBlbGVtZW50LlxuICpcbiAqIEBtZXRob2Qgc2V0SW50ZXJhY3Rpb25EZWxlZ2F0ZVxuICogQHBhcmFtIGRvbUVsZW1lbnQge0RPTUVsZW1lbnR9IFRoaXMgbmV3IGRvbUVsZW1lbnQgd2hpY2ggd2lsbCByZWNlaXZlIG1vdXNlL3RvdWNoIGV2ZW50c1xuICovXG5wcm90by5zZXRJbnRlcmFjdGlvbkRlbGVnYXRlID0gZnVuY3Rpb24gc2V0SW50ZXJhY3Rpb25EZWxlZ2F0ZShkb21FbGVtZW50KVxue1xuICAgIHRoaXMuaW50ZXJhY3Rpb25NYW5hZ2VyLnNldFRhcmdldERvbUVsZW1lbnQoIGRvbUVsZW1lbnQgKTtcbn07XG5cbi8qXG4gKiBVcGRhdGVzIHRoZSBvYmplY3QgdHJhbnNmb3JtIGZvciByZW5kZXJpbmdcbiAqXG4gKiBAbWV0aG9kIHVwZGF0ZVRyYW5zZm9ybVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8udXBkYXRlVHJhbnNmb3JtID0gZnVuY3Rpb24gdXBkYXRlVHJhbnNmb3JtKClcbntcbiAgICB0aGlzLndvcmxkQWxwaGEgPSAxO1xuICAgIHRoaXMudmNvdW50ID0gZ2xvYmFscy52aXNpYmxlQ291bnQ7XG5cbiAgICBmb3IodmFyIGk9MCxqPXRoaXMuY2hpbGRyZW4ubGVuZ3RoOyBpPGo7IGkrKylcbiAgICB7XG4gICAgICAgIHRoaXMuY2hpbGRyZW5baV0udXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5kaXJ0eSlcbiAgICB7XG4gICAgICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcbiAgICAgICAgLy8gdXBkYXRlIGludGVyYWN0aXZlIVxuICAgICAgICB0aGlzLmludGVyYWN0aW9uTWFuYWdlci5kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG5cbiAgICBpZih0aGlzLmludGVyYWN0aXZlKXRoaXMuaW50ZXJhY3Rpb25NYW5hZ2VyLnVwZGF0ZSgpO1xufTtcblxuLyoqXG4gKiBTZXRzIHRoZSBiYWNrZ3JvdW5kIGNvbG9yIGZvciB0aGUgc3RhZ2VcbiAqXG4gKiBAbWV0aG9kIHNldEJhY2tncm91bmRDb2xvclxuICogQHBhcmFtIGJhY2tncm91bmRDb2xvciB7TnVtYmVyfSB0aGUgY29sb3Igb2YgdGhlIGJhY2tncm91bmQsIGVhc2llc3Qgd2F5IHRvIHBhc3MgdGhpcyBpbiBpcyBpbiBoZXggZm9ybWF0XG4gKiAgICAgIGxpa2U6IDB4RkZGRkZGIGZvciB3aGl0ZVxuICovXG5wcm90by5zZXRCYWNrZ3JvdW5kQ29sb3IgPSBmdW5jdGlvbiBzZXRCYWNrZ3JvdW5kQ29sb3IoYmFja2dyb3VuZENvbG9yKVxue1xuICAgIHRoaXMuYmFja2dyb3VuZENvbG9yID0gYmFja2dyb3VuZENvbG9yIHx8IDB4MDAwMDAwO1xuICAgIHRoaXMuYmFja2dyb3VuZENvbG9yU3BsaXQgPSBoZXgycmdiKHRoaXMuYmFja2dyb3VuZENvbG9yKTtcbiAgICB2YXIgaGV4ID0gdGhpcy5iYWNrZ3JvdW5kQ29sb3IudG9TdHJpbmcoMTYpO1xuICAgIGhleCA9ICcwMDAwMDAnLnN1YnN0cigwLCA2IC0gaGV4Lmxlbmd0aCkgKyBoZXg7XG4gICAgdGhpcy5iYWNrZ3JvdW5kQ29sb3JTdHJpbmcgPSAnIycgKyBoZXg7XG59O1xuXG4vKipcbiAqIFRoaXMgd2lsbCByZXR1cm4gdGhlIHBvaW50IGNvbnRhaW5pbmcgZ2xvYmFsIGNvb3JkcyBvZiB0aGUgbW91c2UuXG4gKlxuICogQG1ldGhvZCBnZXRNb3VzZVBvc2l0aW9uXG4gKiBAcmV0dXJuIHtQb2ludH0gVGhlIHBvaW50IGNvbnRhaW5pbmcgdGhlIGNvb3JkcyBvZiB0aGUgZ2xvYmFsIEludGVyYWN0aW9uRGF0YSBwb3NpdGlvbi5cbiAqL1xucHJvdG8uZ2V0TW91c2VQb3NpdGlvbiA9IGZ1bmN0aW9uIGdldE1vdXNlUG9zaXRpb24oKVxue1xuICAgIHJldHVybiB0aGlzLmludGVyYWN0aW9uTWFuYWdlci5tb3VzZS5nbG9iYWw7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YWdlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIERyLiBLaWJpdHogPGluZm9AZHJraWJpdHouY29tPlxuICovXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHROT1JNQUw6IDAsXG5cdFNDUkVFTjogMVxufTtcbiIsIi8qKlxuICogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi9ldmVudHRhcmdldC5qcy9cbiAqIFRIYW5rUyBtciBET29iIVxuICovXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi9ldmVudHRhcmdldC5qcy9cbiAqIFRIYW5rUyBtciBET29iIVxuICovXG5cbi8qKlxuICogQWRkcyBldmVudCBlbWl0dGVyIGZ1bmN0aW9uYWxpdHkgdG8gYSBjbGFzc1xuICpcbiAqIEBjbGFzcyBFdmVudFRhcmdldFxuICogQGV4YW1wbGVcbiAqICAgICAgZnVuY3Rpb24gTXlFbWl0dGVyKCkge1xuICogICAgICAgICAgRXZlbnRUYXJnZXQuY2FsbCh0aGlzKTsgLy9taXhlcyBpbiBldmVudCB0YXJnZXQgc3R1ZmZcbiAqICAgICAgfVxuICpcbiAqICAgICAgdmFyIGVtID0gbmV3IE15RW1pdHRlcigpO1xuICogICAgICBlbS5lbWl0KHsgdHlwZTogJ2V2ZW50TmFtZScsIGRhdGE6ICdzb21lIGRhdGEnIH0pO1xuICovXG5mdW5jdGlvbiBFdmVudFRhcmdldCgpIHtcblxuICAgIHZhciBsaXN0ZW5lcnMgPSB7fTtcblxuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lciA9IHRoaXMub24gPSBmdW5jdGlvbiAoIHR5cGUsIGxpc3RlbmVyICkge1xuXG5cbiAgICAgICAgaWYgKCBsaXN0ZW5lcnNbIHR5cGUgXSA9PT0gdW5kZWZpbmVkICkge1xuXG4gICAgICAgICAgICBsaXN0ZW5lcnNbIHR5cGUgXSA9IFtdO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGxpc3RlbmVyc1sgdHlwZSBdLmluZGV4T2YoIGxpc3RlbmVyICkgPT09IC0gMSApIHtcblxuICAgICAgICAgICAgbGlzdGVuZXJzWyB0eXBlIF0ucHVzaCggbGlzdGVuZXIgKTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCA9IHRoaXMuZW1pdCA9IGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cbiAgICAgICAgaWYgKCAhbGlzdGVuZXJzWyBldmVudC50eXBlIF0gfHwgIWxpc3RlbmVyc1sgZXZlbnQudHlwZSBdLmxlbmd0aCApIHtcblxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIH1cblxuICAgICAgICBmb3IodmFyIGkgPSAwLCBsID0gbGlzdGVuZXJzWyBldmVudC50eXBlIF0ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGxpc3RlbmVyc1sgZXZlbnQudHlwZSBdWyBpIF0oIGV2ZW50ICk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IHRoaXMub2ZmID0gZnVuY3Rpb24gKCB0eXBlLCBsaXN0ZW5lciApIHtcblxuICAgICAgICB2YXIgaW5kZXggPSBsaXN0ZW5lcnNbIHR5cGUgXS5pbmRleE9mKCBsaXN0ZW5lciApO1xuXG4gICAgICAgIGlmICggaW5kZXggIT09IC0gMSApIHtcblxuICAgICAgICAgICAgbGlzdGVuZXJzWyB0eXBlIF0uc3BsaWNlKCBpbmRleCwgMSApO1xuXG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICB0aGlzLnJlbW92ZUFsbEV2ZW50TGlzdGVuZXJzID0gZnVuY3Rpb24oIHR5cGUgKSB7XG4gICAgICAgIHZhciBhID0gbGlzdGVuZXJzW3R5cGVdO1xuICAgICAgICBpZiAoYSlcbiAgICAgICAgICAgIGEubGVuZ3RoID0gMDtcbiAgICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50VGFyZ2V0O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGlzcGxheU9iamVjdCA9IHJlcXVpcmUoJy4uL2Rpc3BsYXkvRGlzcGxheU9iamVjdCcpO1xuXG4vKipcbiAqIFRoaXMgb2JqZWN0IGlzIG9uZSB0aGF0IHdpbGwgYWxsb3cgeW91IHRvIHNwZWNpZnkgY3VzdG9tIHJlbmRlcmluZyBmdW5jdGlvbnMgYmFzZWQgb24gcmVuZGVyIHR5cGVcbiAqXG4gKiBAY2xhc3MgQ3VzdG9tUmVuZGVyYWJsZVxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdFxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEN1c3RvbVJlbmRlcmFibGUoKVxue1xuICAgIERpc3BsYXlPYmplY3QuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMucmVuZGVyYWJsZSA9IHRydWU7XG59XG5cbnZhciBwcm90byA9IEN1c3RvbVJlbmRlcmFibGUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0LnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IEN1c3RvbVJlbmRlcmFibGV9XG59KTtcblxuLyoqXG4gKiBJZiB0aGlzIG9iamVjdCBpcyBiZWluZyByZW5kZXJlZCBieSBhIENhbnZhc1JlbmRlcmVyIGl0IHdpbGwgY2FsbCB0aGlzIGNhbGxiYWNrXG4gKlxuICogQG1ldGhvZCByZW5kZXJDYW52YXNcbiAqIEBwYXJhbSByZW5kZXJlciB7Q2FudmFzUmVuZGVyZXJ9IFRoZSByZW5kZXJlciBpbnN0YW5jZVxuICovXG5wcm90by5yZW5kZXJDYW52YXMgPSBmdW5jdGlvbiByZW5kZXJDYW52YXMoKVxue1xuICAgIC8vIG92ZXJyaWRlIVxufTtcblxuLyoqXG4gKiBJZiB0aGlzIG9iamVjdCBpcyBiZWluZyByZW5kZXJlZCBieSBhIFdlYkdMUmVuZGVyZXIgaXQgd2lsbCBjYWxsIHRoaXMgY2FsbGJhY2sgdG8gaW5pdGlhbGl6ZVxuICpcbiAqIEBtZXRob2QgaW5pdFdlYkdMXG4gKiBAcGFyYW0gcmVuZGVyZXIge1dlYkdMUmVuZGVyZXJ9IFRoZSByZW5kZXJlciBpbnN0YW5jZVxuICovXG5wcm90by5pbml0V2ViR0wgPSBmdW5jdGlvbiBpbml0V2ViR0woKVxue1xuICAgIC8vIG92ZXJyaWRlIVxufTtcblxuLyoqXG4gKiBJZiB0aGlzIG9iamVjdCBpcyBiZWluZyByZW5kZXJlZCBieSBhIFdlYkdMUmVuZGVyZXIgaXQgd2lsbCBjYWxsIHRoaXMgY2FsbGJhY2tcbiAqXG4gKiBAbWV0aG9kIHJlbmRlcldlYkdMXG4gKiBAcGFyYW0gcmVuZGVyR3JvdXAge1dlYkdMUmVuZGVyR3JvdXB9IFRoZSByZW5kZXJlciBncm91cCBpbnN0YW5jZVxuICogQHBhcmFtIHByb2plY3Rpb25NYXRyaXgge01hdHJpeH0gVGhlIG9iamVjdCdzIHByb2plY3Rpb24gbWF0cml4XG4gKi9cbnByb3RvLnJlbmRlcldlYkdMID0gZnVuY3Rpb24gcmVuZGVyV2ViR0woKVxue1xuICAgIC8vIG5vdCBzdXJlIGlmIGJvdGggbmVlZGVkPyBidXQgeWEgaGF2ZSBmb3Igbm93IVxuICAgIC8vIG92ZXJyaWRlIVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDdXN0b21SZW5kZXJhYmxlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIFN0cmlwID0gcmVxdWlyZSgnLi9TdHJpcCcpO1xudmFyIERpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcblxuZnVuY3Rpb24gUm9wZSh0ZXh0dXJlLCBwb2ludHMpXG57XG4gICAgU3RyaXAuY2FsbCh0aGlzLCB0ZXh0dXJlKTtcbiAgICB0aGlzLnBvaW50cyA9IHBvaW50cztcblxuICAgIHRyeVxuICAgIHtcbiAgICAgICAgdGhpcy52ZXJ0aWNpZXMgPSBuZXcgRmxvYXQzMkFycmF5KHBvaW50cy5sZW5ndGggKiA0KTtcbiAgICAgICAgdGhpcy51dnMgPSBuZXcgRmxvYXQzMkFycmF5KHBvaW50cy5sZW5ndGggKiA0KTtcbiAgICAgICAgdGhpcy5jb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KHBvaW50cy5sZW5ndGggKiAyKTtcbiAgICAgICAgdGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KHBvaW50cy5sZW5ndGggKiAyKTtcbiAgICB9XG4gICAgY2F0Y2goZXJyb3IpXG4gICAge1xuICAgICAgICB0aGlzLnZlcnRpY2llcyA9IG5ldyBBcnJheShwb2ludHMubGVuZ3RoICogNCk7XG4gICAgICAgIHRoaXMudXZzID0gbmV3IEFycmF5KHBvaW50cy5sZW5ndGggKiA0KTtcbiAgICAgICAgdGhpcy5jb2xvcnMgPSBuZXcgQXJyYXkocG9pbnRzLmxlbmd0aCAqIDIpO1xuICAgICAgICB0aGlzLmluZGljZXMgPSBuZXcgQXJyYXkocG9pbnRzLmxlbmd0aCAqIDIpO1xuICAgIH1cblxuICAgIHRoaXMucmVmcmVzaCgpO1xufVxuXG52YXIgcHJvdG8gPSBSb3BlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RyaXAucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogUm9wZX1cbn0pO1xuXG5wcm90by5yZWZyZXNoID0gZnVuY3Rpb24gcmVmcmVzaCgpXG57XG4gICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzO1xuICAgIGlmKHBvaW50cy5sZW5ndGggPCAxKSByZXR1cm47XG5cbiAgICB2YXIgdXZzID0gdGhpcy51dnM7XG5cbiAgICB2YXIgbGFzdFBvaW50ID0gcG9pbnRzWzBdO1xuICAgIHZhciBpbmRpY2VzID0gdGhpcy5pbmRpY2VzO1xuICAgIHZhciBjb2xvcnMgPSB0aGlzLmNvbG9ycztcblxuICAgIHRoaXMuY291bnQtPTAuMjtcblxuXG4gICAgdXZzWzBdID0gMDtcbiAgICB1dnNbMV0gPSAxO1xuICAgIHV2c1syXSA9IDA7XG4gICAgdXZzWzNdID0gMTtcblxuICAgIGNvbG9yc1swXSA9IDE7XG4gICAgY29sb3JzWzFdID0gMTtcblxuICAgIGluZGljZXNbMF0gPSAwO1xuICAgIGluZGljZXNbMV0gPSAxO1xuXG4gICAgdmFyIHRvdGFsID0gcG9pbnRzLmxlbmd0aCxcbiAgICAgICAgcG9pbnQsIGluZGV4LCBhbW91bnQ7XG5cbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IHRvdGFsOyBpKyspXG4gICAge1xuXG4gICAgICAgIHBvaW50ID0gcG9pbnRzW2ldO1xuICAgICAgICBpbmRleCA9IGkgKiA0O1xuICAgICAgICAvLyB0aW1lIHRvIGRvIHNvbWUgc21hcnQgZHJhd2luZyFcbiAgICAgICAgYW1vdW50ID0gaSAvICh0b3RhbC0xKTtcblxuICAgICAgICBpZihpJTIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHV2c1tpbmRleF0gPSBhbW91bnQ7XG4gICAgICAgICAgICB1dnNbaW5kZXgrMV0gPSAwO1xuXG4gICAgICAgICAgICB1dnNbaW5kZXgrMl0gPSBhbW91bnQ7XG4gICAgICAgICAgICB1dnNbaW5kZXgrM10gPSAxO1xuXG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICB1dnNbaW5kZXhdID0gYW1vdW50O1xuICAgICAgICAgICAgdXZzW2luZGV4KzFdID0gMDtcblxuICAgICAgICAgICAgdXZzW2luZGV4KzJdID0gYW1vdW50O1xuICAgICAgICAgICAgdXZzW2luZGV4KzNdID0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluZGV4ID0gaSAqIDI7XG4gICAgICAgIGNvbG9yc1tpbmRleF0gPSAxO1xuICAgICAgICBjb2xvcnNbaW5kZXgrMV0gPSAxO1xuXG4gICAgICAgIGluZGV4ID0gaSAqIDI7XG4gICAgICAgIGluZGljZXNbaW5kZXhdID0gaW5kZXg7XG4gICAgICAgIGluZGljZXNbaW5kZXggKyAxXSA9IGluZGV4ICsgMTtcblxuICAgICAgICBsYXN0UG9pbnQgPSBwb2ludDtcbiAgICB9XG59O1xuXG5wcm90by51cGRhdGVUcmFuc2Zvcm0gPSBmdW5jdGlvbiB1cGRhdGVUcmFuc2Zvcm0oKVxue1xuXG4gICAgdmFyIHBvaW50cyA9IHRoaXMucG9pbnRzO1xuICAgIGlmKHBvaW50cy5sZW5ndGggPCAxKXJldHVybjtcblxuICAgIHZhciBsYXN0UG9pbnQgPSBwb2ludHNbMF07XG4gICAgdmFyIG5leHRQb2ludDtcbiAgICB2YXIgcGVycCA9IHt4OjAsIHk6MH07XG5cbiAgICB0aGlzLmNvdW50LT0wLjI7XG5cbiAgICB2YXIgdmVydGljaWVzID0gdGhpcy52ZXJ0aWNpZXM7XG4gICAgdmVydGljaWVzWzBdID0gbGFzdFBvaW50LnggKyBwZXJwLng7XG4gICAgdmVydGljaWVzWzFdID0gbGFzdFBvaW50LnkgKyBwZXJwLnk7IC8vKyAyMDBcbiAgICB2ZXJ0aWNpZXNbMl0gPSBsYXN0UG9pbnQueCAtIHBlcnAueDtcbiAgICB2ZXJ0aWNpZXNbM10gPSBsYXN0UG9pbnQueSAtIHBlcnAueTsvLysyMDBcbiAgICAvLyB0aW1lIHRvIGRvIHNvbWUgc21hcnQgZHJhd2luZyFcblxuICAgIHZhciB0b3RhbCA9IHBvaW50cy5sZW5ndGgsXG4gICAgICAgIHBvaW50LCBpbmRleCwgcmF0aW8sIHBlcnBMZW5ndGgsIG51bTtcblxuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgdG90YWw7IGkrKylcbiAgICB7XG4gICAgICAgIHBvaW50ID0gcG9pbnRzW2ldO1xuICAgICAgICBpbmRleCA9IGkgKiA0O1xuXG4gICAgICAgIGlmKGkgPCBwb2ludHMubGVuZ3RoLTEpXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5leHRQb2ludCA9IHBvaW50c1tpKzFdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgbmV4dFBvaW50ID0gcG9pbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBwZXJwLnkgPSAtKG5leHRQb2ludC54IC0gbGFzdFBvaW50LngpO1xuICAgICAgICBwZXJwLnggPSBuZXh0UG9pbnQueSAtIGxhc3RQb2ludC55O1xuXG4gICAgICAgIHJhdGlvID0gKDEgLSAoaSAvICh0b3RhbC0xKSkpICogMTA7XG5cbiAgICAgICAgaWYocmF0aW8gPiAxKSByYXRpbyA9IDE7XG5cbiAgICAgICAgcGVycExlbmd0aCA9IE1hdGguc3FydChwZXJwLnggKiBwZXJwLnggKyBwZXJwLnkgKiBwZXJwLnkpO1xuICAgICAgICBudW0gPSB0aGlzLnRleHR1cmUuaGVpZ2h0IC8gMjsgLy8oMjAgKyBNYXRoLmFicyhNYXRoLnNpbigoaSArIHRoaXMuY291bnQpICogMC4zKSAqIDUwKSApKiByYXRpbztcbiAgICAgICAgcGVycC54IC89IHBlcnBMZW5ndGg7XG4gICAgICAgIHBlcnAueSAvPSBwZXJwTGVuZ3RoO1xuXG4gICAgICAgIHBlcnAueCAqPSBudW07XG4gICAgICAgIHBlcnAueSAqPSBudW07XG5cbiAgICAgICAgdmVydGljaWVzW2luZGV4XSA9IHBvaW50LnggKyBwZXJwLng7XG4gICAgICAgIHZlcnRpY2llc1tpbmRleCsxXSA9IHBvaW50LnkgKyBwZXJwLnk7XG4gICAgICAgIHZlcnRpY2llc1tpbmRleCsyXSA9IHBvaW50LnggLSBwZXJwLng7XG4gICAgICAgIHZlcnRpY2llc1tpbmRleCszXSA9IHBvaW50LnkgLSBwZXJwLnk7XG5cbiAgICAgICAgbGFzdFBvaW50ID0gcG9pbnQ7XG4gICAgfVxuXG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwoIHRoaXMgKTtcbn07XG5cbnByb3RvLnNldFRleHR1cmUgPSBmdW5jdGlvbiBzZXRUZXh0dXJlKHRleHR1cmUpXG57XG4gICAgLy8gc3RvcCBjdXJyZW50IHRleHR1cmVcbiAgICB0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSb3BlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqIGJhc2VkIG9uIHBpeGkgaW1wYWN0IHNwaW5lIGltcGxlbWVudGF0aW9uIG1hZGUgYnkgRWVtZWxpIEtlbG9rb3JwaSAoQGVrZWxva29ycGkpIGh0dHBzOi8vZ2l0aHViLmNvbS9la2Vsb2tvcnBpXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHNwaW5lID0gcmVxdWlyZSgnLi4vdXRpbHMvc3BpbmUnKTtcbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG52YXIgU3ByaXRlID0gcmVxdWlyZSgnLi4vZGlzcGxheS9TcHJpdGUnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xuXG4vKipcbiAqIEEgY2xhc3MgdGhhdCBlbmFibGVzIHRoZSB5b3UgdG8gaW1wb3J0IGFuZCBydW4geW91ciBzcGluZSBhbmltYXRpb25zIGluIHBpeGkuXG4gKiBTcGluZSBhbmltYXRpb24gZGF0YSBuZWVkcyB0byBiZSBsb2FkZWQgdXNpbmcgdGhlIEFzc2V0TG9hZGVyIG9yIFNwaW5lTG9hZGVyIGJlZm9yZSBpdCBjYW4gYmUgdXNlZCBieSB0aGlzIGNsYXNzXG4gKiBTZWUgZXhhbXBsZSAxMiAoaHR0cDovL3d3dy5nb29kYm95ZGlnaXRhbC5jb20vcGl4aWpzL2V4YW1wbGVzLzEyLykgdG8gc2VlIGEgd29ya2luZyBleGFtcGxlIGFuZCBjaGVjayBvdXQgdGhlIHNvdXJjZVxuICpcbiAqIEBjbGFzcyBTcGluZVxuICogQGV4dGVuZHMgRGlzcGxheU9iamVjdENvbnRhaW5lclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdXJsIHtTdHJpbmd9IFRoZSB1cmwgb2YgdGhlIHNwaW5lIGFuaW0gZmlsZSB0byBiZSB1c2VkXG4gKi9cbmZ1bmN0aW9uIFNwaW5lKHVybCkge1xuICAgIERpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMuc3BpbmVEYXRhID0gU3BpbmUuYW5pbUNhY2hlW3VybF07XG5cbiAgICBpZiAoIXRoaXMuc3BpbmVEYXRhKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3BpbmUgZGF0YSBtdXN0IGJlIHByZWxvYWRlZCB1c2luZyBTcGluZUxvYWRlciBvciBBc3NldExvYWRlcjogJyArIHVybCk7XG4gICAgfVxuXG4gICAgdGhpcy5za2VsZXRvbiA9IG5ldyBzcGluZS5Ta2VsZXRvbih0aGlzLnNwaW5lRGF0YSk7XG4gICAgdGhpcy5za2VsZXRvbi51cGRhdGVXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgdGhpcy5zdGF0ZURhdGEgPSBuZXcgc3BpbmUuQW5pbWF0aW9uU3RhdGVEYXRhKHRoaXMuc3BpbmVEYXRhKTtcbiAgICB0aGlzLnN0YXRlID0gbmV3IHNwaW5lLkFuaW1hdGlvblN0YXRlKHRoaXMuc3RhdGVEYXRhKTtcblxuICAgIHRoaXMuc2xvdENvbnRhaW5lcnMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwLCBuID0gdGhpcy5za2VsZXRvbi5kcmF3T3JkZXIubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgIHZhciBzbG90ID0gdGhpcy5za2VsZXRvbi5kcmF3T3JkZXJbaV07XG4gICAgICAgIHZhciBhdHRhY2htZW50ID0gc2xvdC5hdHRhY2htZW50O1xuICAgICAgICB2YXIgc2xvdENvbnRhaW5lciA9IG5ldyBEaXNwbGF5T2JqZWN0Q29udGFpbmVyKCk7XG4gICAgICAgIHRoaXMuc2xvdENvbnRhaW5lcnMucHVzaChzbG90Q29udGFpbmVyKTtcbiAgICAgICAgdGhpcy5hZGRDaGlsZChzbG90Q29udGFpbmVyKTtcbiAgICAgICAgaWYgKCEoYXR0YWNobWVudCBpbnN0YW5jZW9mIHNwaW5lLlJlZ2lvbkF0dGFjaG1lbnQpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgc3ByaXRlTmFtZSA9IGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QubmFtZTtcbiAgICAgICAgdmFyIHNwcml0ZSA9IHRoaXMuY3JlYXRlU3ByaXRlKHNsb3QsIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QpO1xuICAgICAgICBzbG90LmN1cnJlbnRTcHJpdGUgPSBzcHJpdGU7XG4gICAgICAgIHNsb3QuY3VycmVudFNwcml0ZU5hbWUgPSBzcHJpdGVOYW1lO1xuICAgICAgICBzbG90Q29udGFpbmVyLmFkZENoaWxkKHNwcml0ZSk7XG4gICAgfVxufVxuXG52YXIgcHJvdG8gPSBTcGluZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogU3BpbmV9XG59KTtcblxuLypcbiAqIFVwZGF0ZXMgdGhlIG9iamVjdCB0cmFuc2Zvcm0gZm9yIHJlbmRlcmluZ1xuICpcbiAqIEBtZXRob2QgdXBkYXRlVHJhbnNmb3JtXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUcmFuc2Zvcm0gPSBmdW5jdGlvbiB1cGRhdGVUcmFuc2Zvcm0oKSB7XG4gICAgdGhpcy5sYXN0VGltZSA9IHRoaXMubGFzdFRpbWUgfHwgRGF0ZS5ub3coKTtcbiAgICB2YXIgdGltZURlbHRhID0gKERhdGUubm93KCkgLSB0aGlzLmxhc3RUaW1lKSAqIDAuMDAxO1xuICAgIHRoaXMubGFzdFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuc3RhdGUudXBkYXRlKHRpbWVEZWx0YSk7XG4gICAgdGhpcy5zdGF0ZS5hcHBseSh0aGlzLnNrZWxldG9uKTtcbiAgICB0aGlzLnNrZWxldG9uLnVwZGF0ZVdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICB2YXIgZHJhd09yZGVyID0gdGhpcy5za2VsZXRvbi5kcmF3T3JkZXI7XG4gICAgZm9yICh2YXIgaSA9IDAsIG4gPSBkcmF3T3JkZXIubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgIHZhciBzbG90ID0gZHJhd09yZGVyW2ldO1xuICAgICAgICB2YXIgYXR0YWNobWVudCA9IHNsb3QuYXR0YWNobWVudDtcbiAgICAgICAgdmFyIHNsb3RDb250YWluZXIgPSB0aGlzLnNsb3RDb250YWluZXJzW2ldO1xuICAgICAgICBpZiAoIShhdHRhY2htZW50IGluc3RhbmNlb2Ygc3BpbmUuUmVnaW9uQXR0YWNobWVudCkpIHtcbiAgICAgICAgICAgIHNsb3RDb250YWluZXIudmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXR0YWNobWVudC5yZW5kZXJlck9iamVjdCkge1xuICAgICAgICAgICAgaWYgKCFzbG90LmN1cnJlbnRTcHJpdGVOYW1lIHx8IHNsb3QuY3VycmVudFNwcml0ZU5hbWUgIT09IGF0dGFjaG1lbnQubmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBzcHJpdGVOYW1lID0gYXR0YWNobWVudC5yZW5kZXJlck9iamVjdC5uYW1lO1xuICAgICAgICAgICAgICAgIGlmIChzbG90LmN1cnJlbnRTcHJpdGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBzbG90LmN1cnJlbnRTcHJpdGUudmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzbG90LnNwcml0ZXMgPSBzbG90LnNwcml0ZXMgfHwge307XG4gICAgICAgICAgICAgICAgaWYgKHNsb3Quc3ByaXRlc1tzcHJpdGVOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNsb3Quc3ByaXRlc1tzcHJpdGVOYW1lXS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3ByaXRlID0gdGhpcy5jcmVhdGVTcHJpdGUoc2xvdCwgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgIHNsb3RDb250YWluZXIuYWRkQ2hpbGQoc3ByaXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2xvdC5jdXJyZW50U3ByaXRlID0gc2xvdC5zcHJpdGVzW3Nwcml0ZU5hbWVdO1xuICAgICAgICAgICAgICAgIHNsb3QuY3VycmVudFNwcml0ZU5hbWUgPSBzcHJpdGVOYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNsb3RDb250YWluZXIudmlzaWJsZSA9IHRydWU7XG5cbiAgICAgICAgdmFyIGJvbmUgPSBzbG90LmJvbmU7XG5cbiAgICAgICAgc2xvdENvbnRhaW5lci5wb3NpdGlvbi54ID0gYm9uZS53b3JsZFggKyBhdHRhY2htZW50LnggKiBib25lLm0wMCArIGF0dGFjaG1lbnQueSAqIGJvbmUubTAxO1xuICAgICAgICBzbG90Q29udGFpbmVyLnBvc2l0aW9uLnkgPSBib25lLndvcmxkWSArIGF0dGFjaG1lbnQueCAqIGJvbmUubTEwICsgYXR0YWNobWVudC55ICogYm9uZS5tMTE7XG4gICAgICAgIHNsb3RDb250YWluZXIuc2NhbGUueCA9IGJvbmUud29ybGRTY2FsZVg7XG4gICAgICAgIHNsb3RDb250YWluZXIuc2NhbGUueSA9IGJvbmUud29ybGRTY2FsZVk7XG5cbiAgICAgICAgc2xvdENvbnRhaW5lci5yb3RhdGlvbiA9IC0oc2xvdC5ib25lLndvcmxkUm90YXRpb24gKiBNYXRoLlBJIC8gMTgwKTtcbiAgICB9XG5cbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZS51cGRhdGVUcmFuc2Zvcm0uY2FsbCh0aGlzKTtcbn07XG5cbnByb3RvLmNyZWF0ZVNwcml0ZSA9IGZ1bmN0aW9uIGNyZWF0ZVNwcml0ZShzbG90LCBkZXNjcmlwdG9yKSB7XG4gICAgdmFyIG5hbWUgPSBUZXh0dXJlLmNhY2hlW2Rlc2NyaXB0b3IubmFtZV0gPyBkZXNjcmlwdG9yLm5hbWUgOiBkZXNjcmlwdG9yLm5hbWUgKyAnLnBuZyc7XG4gICAgdmFyIHNwcml0ZSA9IG5ldyBTcHJpdGUoVGV4dHVyZS5mcm9tRnJhbWUobmFtZSkpO1xuICAgIHNwcml0ZS5zY2FsZSA9IGRlc2NyaXB0b3Iuc2NhbGU7XG4gICAgc3ByaXRlLnJvdGF0aW9uID0gZGVzY3JpcHRvci5yb3RhdGlvbjtcbiAgICBzcHJpdGUuYW5jaG9yLnggPSBzcHJpdGUuYW5jaG9yLnkgPSAwLjU7XG5cbiAgICBzbG90LnNwcml0ZXMgPSBzbG90LnNwcml0ZXMgfHwge307XG4gICAgc2xvdC5zcHJpdGVzW2Rlc2NyaXB0b3IubmFtZV0gPSBzcHJpdGU7XG4gICAgcmV0dXJuIHNwcml0ZTtcbn07XG5cblNwaW5lLmFuaW1DYWNoZSA9IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNwaW5lO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGJsZW5kTW9kZXMgPSByZXF1aXJlKCcuLi9kaXNwbGF5L2JsZW5kTW9kZXMnKTtcbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG5cbmZ1bmN0aW9uIFN0cmlwKHRleHR1cmUsIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKCB0aGlzICk7XG4gICAgdGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcbiAgICB0aGlzLmJsZW5kTW9kZSA9IGJsZW5kTW9kZXMuTk9STUFMO1xuXG4gICAgdHJ5XG4gICAge1xuICAgICAgICB0aGlzLnV2cyA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDEsXG4gICAgICAgICAgICAgICAgMSwgMSxcbiAgICAgICAgICAgICAgICAxLCAwLCAwLDFdKTtcblxuICAgICAgICB0aGlzLnZlcnRpY2llcyA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAwXSk7XG5cbiAgICAgICAgdGhpcy5jb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KFsxLCAxLCAxLCAxXSk7XG5cbiAgICAgICAgdGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KFswLCAxLCAyLCAzXSk7XG4gICAgfVxuICAgIGNhdGNoKGVycm9yKVxuICAgIHtcbiAgICAgICAgdGhpcy51dnMgPSBbMCwgMSxcbiAgICAgICAgICAgICAgICAxLCAxLFxuICAgICAgICAgICAgICAgIDEsIDAsIDAsMV07XG5cbiAgICAgICAgdGhpcy52ZXJ0aWNpZXMgPSBbMCwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgMCwwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAwLDAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDBdO1xuXG4gICAgICAgIHRoaXMuY29sb3JzID0gWzEsIDEsIDEsIDFdO1xuXG4gICAgICAgIHRoaXMuaW5kaWNlcyA9IFswLCAxLCAyLCAzXTtcbiAgICB9XG5cblxuICAgIC8qXG4gICAgdGhpcy51dnMgPSBuZXcgRmxvYXQzMkFycmF5KClcbiAgICB0aGlzLnZlcnRpY2llcyA9IG5ldyBGbG9hdDMyQXJyYXkoKVxuICAgIHRoaXMuY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheSgpXG4gICAgdGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KClcbiAgICAqL1xuICAgIHRoaXMud2lkdGggPSB3aWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuICAgIC8vIGxvYWQgdGhlIHRleHR1cmUhXG4gICAgaWYodGV4dHVyZS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQpXG4gICAge1xuICAgICAgICB0aGlzLndpZHRoICAgPSB0aGlzLnRleHR1cmUuZnJhbWUud2lkdGg7XG4gICAgICAgIHRoaXMuaGVpZ2h0ICA9IHRoaXMudGV4dHVyZS5mcmFtZS5oZWlnaHQ7XG4gICAgICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICAgIHRoaXMudGV4dHVyZS5hZGRFdmVudExpc3RlbmVyKCAndXBkYXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhhdC5vblRleHR1cmVVcGRhdGUoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5yZW5kZXJhYmxlID0gdHJ1ZTtcbn1cblxudmFyIHByb3RvID0gU3RyaXAucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFN0cmlwfVxufSk7XG5cbnByb3RvLnNldFRleHR1cmUgPSBmdW5jdGlvbiBzZXRUZXh0dXJlKHRleHR1cmUpXG57XG4gICAgLy9UT0RPIFNFVCBUSEUgVEVYVFVSRVNcbiAgICAvL1RPRE8gVklTSUJJTElUWVxuXG4gICAgLy8gc3RvcCBjdXJyZW50IHRleHR1cmVcbiAgICB0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuICAgIHRoaXMud2lkdGggICA9IHRleHR1cmUuZnJhbWUud2lkdGg7XG4gICAgdGhpcy5oZWlnaHQgID0gdGV4dHVyZS5mcmFtZS5oZWlnaHQ7XG4gICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG59O1xuXG5wcm90by5vblRleHR1cmVVcGRhdGUgPSBmdW5jdGlvbiBvblRleHR1cmVVcGRhdGUoKVxue1xuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xufTtcbi8vIHNvbWUgaGVscGVyIGZ1bmN0aW9ucy4uXG5cbm1vZHVsZS5leHBvcnRzID0gU3RyaXA7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS9cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYmxlbmRNb2RlcyA9IHJlcXVpcmUoJy4uL2Rpc3BsYXkvYmxlbmRNb2RlcycpO1xudmFyIERpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcblxuLyoqXG4gKiBBIHRpbGluZyBzcHJpdGUgaXMgYSBmYXN0IHdheSBvZiByZW5kZXJpbmcgYSB0aWxpbmcgaW1hZ2VcbiAqXG4gKiBAY2xhc3MgVGlsaW5nU3ByaXRlXG4gKiBAZXh0ZW5kcyBEaXNwbGF5T2JqZWN0Q29udGFpbmVyXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB0ZXh0dXJlIHtUZXh0dXJlfSB0aGUgdGV4dHVyZSBvZiB0aGUgdGlsaW5nIHNwcml0ZVxuICogQHBhcmFtIHdpZHRoIHtOdW1iZXJ9ICB0aGUgd2lkdGggb2YgdGhlIHRpbGluZyBzcHJpdGVcbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn0gdGhlIGhlaWdodCBvZiB0aGUgdGlsaW5nIHNwcml0ZVxuICovXG5mdW5jdGlvbiBUaWxpbmdTcHJpdGUodGV4dHVyZSwgd2lkdGgsIGhlaWdodClcbntcbiAgICBEaXNwbGF5T2JqZWN0Q29udGFpbmVyLmNhbGwoIHRoaXMgKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0ZXh0dXJlIHRoYXQgdGhlIHNwcml0ZSBpcyB1c2luZ1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IHRleHR1cmVcbiAgICAgKiBAdHlwZSBUZXh0dXJlXG4gICAgICovXG4gICAgdGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgdGlsaW5nIHNwcml0ZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHdpZHRoXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICovXG4gICAgdGhpcy53aWR0aCA9IHdpZHRoO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgdGlsaW5nIHNwcml0ZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGhlaWdodFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNjYWxpbmcgb2YgdGhlIGltYWdlIHRoYXQgaXMgYmVpbmcgdGlsZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0aWxlU2NhbGVcbiAgICAgKiBAdHlwZSBQb2ludFxuICAgICAqL1xuICAgIHRoaXMudGlsZVNjYWxlID0gbmV3IFBvaW50KDEsMSk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgb2Zmc2V0IHBvc2l0aW9uIG9mIHRoZSBpbWFnZSB0aGF0IGlzIGJlaW5nIHRpbGVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdGlsZVBvc2l0aW9uXG4gICAgICogQHR5cGUgUG9pbnRcbiAgICAgKi9cbiAgICB0aGlzLnRpbGVQb3NpdGlvbiA9IG5ldyBQb2ludCgwLDApO1xuXG4gICAgdGhpcy5yZW5kZXJhYmxlID0gdHJ1ZTtcblxuICAgIHRoaXMuYmxlbmRNb2RlID0gYmxlbmRNb2Rlcy5OT1JNQUw7XG59XG5cbnZhciBwcm90byA9IFRpbGluZ1Nwcml0ZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKERpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogVGlsaW5nU3ByaXRlfVxufSk7XG5cbi8qKlxuICogU2V0cyB0aGUgdGV4dHVyZSBvZiB0aGUgdGlsaW5nIHNwcml0ZVxuICpcbiAqIEBtZXRob2Qgc2V0VGV4dHVyZVxuICogQHBhcmFtIHRleHR1cmUge1RleHR1cmV9IFRoZSB0ZXh0dXJlIHRoYXQgaXMgZGlzcGxheWVkIGJ5IHRoZSBzcHJpdGVcbiAqL1xucHJvdG8uc2V0VGV4dHVyZSA9IGZ1bmN0aW9uIHNldFRleHR1cmUodGV4dHVyZSlcbntcbiAgICAvL1RPRE8gU0VUIFRIRSBURVhUVVJFU1xuICAgIC8vVE9ETyBWSVNJQklMSVRZXG5cbiAgICAvLyBzdG9wIGN1cnJlbnQgdGV4dHVyZVxuICAgIHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG4gICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG59O1xuXG4vKipcbiAqIFdoZW4gdGhlIHRleHR1cmUgaXMgdXBkYXRlZCwgdGhpcyBldmVudCB3aWxsIGZpcmUgdG8gdXBkYXRlIHRoZSBmcmFtZVxuICpcbiAqIEBtZXRob2Qgb25UZXh0dXJlVXBkYXRlXG4gKiBAcGFyYW0gZXZlbnRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uVGV4dHVyZVVwZGF0ZSA9IGZ1bmN0aW9uIG9uVGV4dHVyZVVwZGF0ZSgpXG57XG4gICAgdGhpcy51cGRhdGVGcmFtZSA9IHRydWU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRpbGluZ1Nwcml0ZTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBiYXNlIGNsYXNzIGZvciAgY3JlYXRpbmcgYSBwaXhpLmpzIGZpbHRlci4gQ3VycmVudGx5IG9ubHkgd2ViR0wgc3VwcG9ydHMgZmlsdGVycy5cbiAqIElmIHlvdSB3YW50IHRvIG1ha2UgYSBjdXN0b20gZmlsdGVyIHRoaXMgc2hvdWxkIGJlIHlvdXIgYmFzZSBjbGFzcy5cbiAqIEBjbGFzcyBBYnN0cmFjdEZpbHRlclxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gZnJhZ21lbnRTcmNcbiAqIEBwYXJhbSB1bmlmb3Jtc1xuICovXG5mdW5jdGlvbiBBYnN0cmFjdEZpbHRlcihmcmFnbWVudFNyYywgdW5pZm9ybXMpXG57XG4gICAgLyoqXG4gICAgKiBBbiBhcnJheSBvZiBwYXNzZXMgLSBzb21lIGZpbHRlcnMgY29udGFpbiBhIGZldyBzdGVwcyB0aGlzIGFycmF5IHNpbXBseSBzdG9yZXMgdGhlIHN0ZXBzIGluIGEgbGluaWVhciBmYXNoaW9uLlxuICAgICogRm9yIGV4YW1wbGUgdGhlIGJsdXIgZmlsdGVyIGhhcyB0d28gcGFzc2VzIGJsdXJYIGFuZCBibHVyWS5cbiAgICAqIEBwcm9wZXJ0eSBwYXNzZXNcbiAgICAqIEB0eXBlIEFycmF5IGFuIGFycmF5IG9mIGZpbHRlciBvYmplY3RzXG4gICAgKiBAcHJpdmF0ZVxuICAgICovXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cblxuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuICAgIHRoaXMucGFkZGluZyA9IDA7XG5cbiAgICAvKipcbiAgICBAcHJvcGVydHkgdW5pZm9ybXNcbiAgICBAcHJpdmF0ZVxuICAgICovXG4gICAgdGhpcy51bmlmb3JtcyA9IHVuaWZvcm1zIHx8IHt9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IGZyYWdtZW50U3JjIHx8IFtdO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0RmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQmx1clhGaWx0ZXIgPSByZXF1aXJlKCcuL0JsdXJYRmlsdGVyJyk7XG52YXIgQmx1cllGaWx0ZXIgPSByZXF1aXJlKCcuL0JsdXJZRmlsdGVyJyk7XG5cbi8qKlxuICpcbiAqIFRoZSBCbHVyRmlsdGVyIGFwcGxpZXMgYSBHYXVzc2lhbiBibHVyIHRvIGFuIG9iamVjdC5cbiAqIFRoZSBzdHJlbmd0aCBvZiB0aGUgYmx1ciBjYW4gYmUgc2V0IGZvciB4LSBhbmQgeS1heGlzIHNlcGFyYXRlbHkgKGFsd2F5cyByZWxhdGl2ZSB0byB0aGUgc3RhZ2UpLlxuICpcbiAqIEBjbGFzcyBCbHVyRmlsdGVyXG4gKiBAY29udHJ1Y3RvclxuICovXG5mdW5jdGlvbiBCbHVyRmlsdGVyKClcbntcbiAgICB0aGlzLmJsdXJYRmlsdGVyID0gbmV3IEJsdXJYRmlsdGVyKCk7XG4gICAgdGhpcy5ibHVyWUZpbHRlciA9IG5ldyBCbHVyWUZpbHRlcigpO1xuXG4gICAgdGhpcy5wYXNzZXMgPVt0aGlzLmJsdXJYRmlsdGVyLCB0aGlzLmJsdXJZRmlsdGVyXTtcbn1cblxudmFyIHByb3RvID0gQmx1ckZpbHRlci5wcm90b3R5cGU7XG5cbi8qKlxuICogU2V0cyB0aGUgc3RyZW5ndGggb2YgYm90aCB0aGUgYmx1clggYW5kIGJsdXJZIHByb3BlcnRpZXMgc2ltdWx0YW5lb3VzbHlcbiAqXG4gKiBAcHJvcGVydHkgYmx1clxuICogQHR5cGUgTnVtYmVyIHRoZSBzdHJlbmd0aCBvZiB0aGUgYmx1clxuICogQGRlZmF1bHQgMlxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdibHVyJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsdXJYRmlsdGVyLmJsdXI7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuYmx1clhGaWx0ZXIuYmx1ciA9IHRoaXMuYmx1cllGaWx0ZXIuYmx1ciA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG4vKipcbiAqIFNldHMgdGhlIHN0cmVuZ3RoIG9mIHRoZSBibHVyWCBwcm9wZXJ0eSBzaW11bHRhbmVvdXNseVxuICpcbiAqIEBwcm9wZXJ0eSBibHVyWFxuICogQHR5cGUgTnVtYmVyIHRoZSBzdHJlbmd0aCBvZiB0aGUgYmx1clhcbiAqIEBkZWZhdWx0IDJcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnYmx1clgnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmx1clhGaWx0ZXIuYmx1cjtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5ibHVyWEZpbHRlci5ibHVyID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogU2V0cyB0aGUgc3RyZW5ndGggb2YgdGhlIGJsdXJYIHByb3BlcnR5IHNpbXVsdGFuZW91c2x5XG4gKlxuICogQHByb3BlcnR5IGJsdXJZXG4gKiBAdHlwZSBOdW1iZXIgdGhlIHN0cmVuZ3RoIG9mIHRoZSBibHVyWVxuICogQGRlZmF1bHQgMlxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdibHVyWScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ibHVyWUZpbHRlci5ibHVyO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLmJsdXJZRmlsdGVyLmJsdXIgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBCbHVyRmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbmZ1bmN0aW9uIEJsdXJYRmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBibHVyOiB7dHlwZTogJzFmJywgdmFsdWU6IDEvNTEyfSxcbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgYmx1cjsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgdmVjNCBzdW0gPSB2ZWM0KDAuMCk7JyxcblxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLnggLSA0LjAqYmx1ciwgdlRleHR1cmVDb29yZC55KSkgKiAwLjA1OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCAtIDMuMCpibHVyLCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMDk7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54IC0gMi4wKmJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4xMjsnLFxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLnggLSBibHVyLCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMTU7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMTY7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54ICsgYmx1ciwgdlRleHR1cmVDb29yZC55KSkgKiAwLjE1OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCArIDIuMCpibHVyLCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMTI7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54ICsgMy4wKmJsdXIsIHZUZXh0dXJlQ29vcmQueSkpICogMC4wOTsnLFxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLnggKyA0LjAqYmx1ciwgdlRleHR1cmVDb29yZC55KSkgKiAwLjA1OycsXG5cbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHN1bTsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBCbHVyWEZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IEJsdXJYRmlsdGVyfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2JsdXInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuYmx1ci52YWx1ZSAvICgxLzcwMDApO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuXG4gICAgICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUgPSAoMS83MDAwKSAqIHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJsdXJYRmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbmZ1bmN0aW9uIEJsdXJZRmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBibHVyOiB7dHlwZTogJzFmJywgdmFsdWU6IDEvNTEyfSxcbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgYmx1cjsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgdmVjNCBzdW0gPSB2ZWM0KDAuMCk7JyxcblxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSAtIDQuMCpibHVyKSkgKiAwLjA1OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55IC0gMy4wKmJsdXIpKSAqIDAuMDk7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkgLSAyLjAqYmx1cikpICogMC4xMjsnLFxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSAtIGJsdXIpKSAqIDAuMTU7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkpKSAqIDAuMTY7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkgKyBibHVyKSkgKiAwLjE1OycsXG4gICAgICAgICcgICBzdW0gKz0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2ZWMyKHZUZXh0dXJlQ29vcmQueCwgdlRleHR1cmVDb29yZC55ICsgMi4wKmJsdXIpKSAqIDAuMTI7JyxcbiAgICAgICAgJyAgIHN1bSArPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkgKyAzLjAqYmx1cikpICogMC4wOTsnLFxuICAgICAgICAnICAgc3VtICs9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLngsIHZUZXh0dXJlQ29vcmQueSArIDQuMCpibHVyKSkgKiAwLjA1OycsXG5cbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHN1bTsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBCbHVyWUZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IEJsdXJZRmlsdGVyfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2JsdXInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuYmx1ci52YWx1ZSAvICgxLzcwMDApO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAvL3RoaXMucGFkZGluZyA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUgPSAoMS83MDAwKSAqIHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJsdXJZRmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbi8qKlxuICpcbiAqIFRoZSBDb2xvck1hdHJpeEZpbHRlciBjbGFzcyBsZXRzIHlvdSBhcHBseSBhIDR4NCBtYXRyaXggdHJhbnNmb3JtYXRpb24gb24gdGhlIFJHQkFcbiAqIGNvbG9yIGFuZCBhbHBoYSB2YWx1ZXMgb2YgZXZlcnkgcGl4ZWwgb24geW91ciBkaXNwbGF5T2JqZWN0IHRvIHByb2R1Y2UgYSByZXN1bHRcbiAqIHdpdGggYSBuZXcgc2V0IG9mIFJHQkEgY29sb3IgYW5kIGFscGhhIHZhbHVlcy4gSXRzIHByZXR0eSBwb3dlcmZ1bCFcbiAqIEBjbGFzcyBDb2xvck1hdHJpeEZpbHRlclxuICogQGNvbnRydWN0b3JcbiAqL1xuZnVuY3Rpb24gQ29sb3JNYXRyaXhGaWx0ZXIoKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIG1hdHJpeDoge3R5cGU6ICdtYXQ0JywgdmFsdWU6IFsxLDAsMCwwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwxLDAsMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsMCwxLDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLDAsMCwxXX0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGludmVydDsnLFxuICAgICAgICAndW5pZm9ybSBtYXQ0IG1hdHJpeDsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKSAqIG1hdHJpeDsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gZ2xfRnJhZ0NvbG9yICogdkNvbG9yOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IENvbG9yTWF0cml4RmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogQ29sb3JNYXRyaXhGaWx0ZXJ9XG59KTtcblxuLyoqXG4gKiBTZXRzIHRoZSBtYXRyaXggb2YgdGhlIGNvbG9yIG1hdHJpeCBmaWx0ZXJcbiAqXG4gKiBAcHJvcGVydHkgbWF0cml4XG4gKiBAdHlwZSBBcnJheSBhbmQgYXJyYXkgb2YgMjYgbnVtYmVyc1xuICogQGRlZmF1bHQgWzEsMCwwLDAsMCwxLDAsMCwwLDAsMSwwLDAsMCwwLDFdXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ21hdHJpeCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5tYXRyaXgudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMubWF0cml4LnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sb3JNYXRyaXhGaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBYnN0cmFjdEZpbHRlciA9IHJlcXVpcmUoJy4vQWJzdHJhY3RGaWx0ZXInKTtcblxuLyoqXG4gKlxuICogVGhpcyB0dXJucyB5b3VyIGRpc3BsYXlPYmplY3RzIHRvIGJsYWNrIGFuZCB3aGl0ZS5cbiAqIEBjbGFzcyBDb2xvclN0ZXBGaWx0ZXJcbiAqIEBjb250cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIENvbG9yU3RlcEZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgc3RlcDoge3R5cGU6ICcxZicsIHZhbHVlOiA1fSxcbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IHN0ZXA7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgdmVjNCBjb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCk7JyxcbiAgICAgICAgJyAgIGNvbG9yID0gZmxvb3IoY29sb3IgKiBzdGVwKSAvIHN0ZXA7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IGNvbG9yICogdkNvbG9yOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IENvbG9yU3RlcEZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IENvbG9yU3RlcEZpbHRlcn1cbn0pO1xuXG4vKipcblRoZSBudW1iZXIgb2Ygc3RlcHMuXG5AcHJvcGVydHkgc3RlcFxuKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ3N0ZXAnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuc3RlcC52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5zdGVwLnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sb3JTdGVwRmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbmZ1bmN0aW9uIENyb3NzSGF0Y2hGaWx0ZXIoKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIGJsdXI6IHt0eXBlOiAnMWYnLCB2YWx1ZTogMSAvIDUxMn0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGJsdXI7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgICBmbG9hdCBsdW0gPSBsZW5ndGgodGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkLnh5KS5yZ2IpOycsXG5cbiAgICAgICAgJyAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDEuMCwgMS4wLCAxLjAsIDEuMCk7JyxcblxuICAgICAgICAnICAgIGlmIChsdW0gPCAxLjAwKSB7JyxcbiAgICAgICAgJyAgICAgICAgaWYgKG1vZChnbF9GcmFnQ29vcmQueCArIGdsX0ZyYWdDb29yZC55LCAxMC4wKSA9PSAwLjApIHsnLFxuICAgICAgICAnICAgICAgICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgwLjAsIDAuMCwgMC4wLCAxLjApOycsXG4gICAgICAgICcgICAgICAgIH0nLFxuICAgICAgICAnICAgIH0nLFxuXG4gICAgICAgICcgICAgaWYgKGx1bSA8IDAuNzUpIHsnLFxuICAgICAgICAnICAgICAgICBpZiAobW9kKGdsX0ZyYWdDb29yZC54IC0gZ2xfRnJhZ0Nvb3JkLnksIDEwLjApID09IDAuMCkgeycsXG4gICAgICAgICcgICAgICAgICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDEuMCk7JyxcbiAgICAgICAgJyAgICAgICAgfScsXG4gICAgICAgICcgICAgfScsXG5cbiAgICAgICAgJyAgICBpZiAobHVtIDwgMC41MCkgeycsXG4gICAgICAgICcgICAgICAgIGlmIChtb2QoZ2xfRnJhZ0Nvb3JkLnggKyBnbF9GcmFnQ29vcmQueSAtIDUuMCwgMTAuMCkgPT0gMC4wKSB7JyxcbiAgICAgICAgJyAgICAgICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMS4wKTsnLFxuICAgICAgICAnICAgICAgICB9JyxcbiAgICAgICAgJyAgICB9JyxcblxuICAgICAgICAnICAgIGlmIChsdW0gPCAwLjMpIHsnLFxuICAgICAgICAnICAgICAgICBpZiAobW9kKGdsX0ZyYWdDb29yZC54IC0gZ2xfRnJhZ0Nvb3JkLnkgLSA1LjAsIDEwLjApID09IDAuMCkgeycsXG4gICAgICAgICcgICAgICAgICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDAuMCwgMC4wLCAwLjAsIDEuMCk7JyxcbiAgICAgICAgJyAgICAgICAgfScsXG4gICAgICAgICcgICAgfScsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IENyb3NzSGF0Y2hGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShBYnN0cmFjdEZpbHRlci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBDcm9zc0hhdGNoRmlsdGVyfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2JsdXInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuYmx1ci52YWx1ZSAvICgxLzcwMDApO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAvL3RoaXMucGFkZGluZyA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUgPSAoMS83MDAwKSAqIHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENyb3NzSGF0Y2hGaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBYnN0cmFjdEZpbHRlciA9IHJlcXVpcmUoJy4vQWJzdHJhY3RGaWx0ZXInKTtcblxuLyoqXG4gKlxuICogVGhlIERpc3BsYWNlbWVudEZpbHRlciBjbGFzcyB1c2VzIHRoZSBwaXhlbCB2YWx1ZXMgZnJvbSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgKGNhbGxlZCB0aGUgZGlzcGxhY2VtZW50IG1hcCkgdG8gcGVyZm9ybSBhIGRpc3BsYWNlbWVudCBvZiBhbiBvYmplY3QuXG4gKiBZb3UgY2FuIHVzZSB0aGlzIGZpbHRlciB0byBhcHBseSBhbGwgbWFub3Igb2YgY3Jhenkgd2FycGluZyBlZmZlY3RzXG4gKiBDdXJyZW50bHkgdGhlIHIgcHJvcGVydHkgb2YgdGhlIHRleHR1cmUgaXMgdXNlZCBvZmZzZXQgdGhlIHggYW5kIHRoZSBnIHByb3Blcnkgb2YgdGhlIHRleHR1cmUgaXMgdXNlZCB0byBvZmZzZXQgdGhlIHkuXG4gKiBAY2xhc3MgRGlzcGxhY2VtZW50RmlsdGVyXG4gKiBAY29udHJ1Y3RvclxuICogQHBhcmFtIHRleHR1cmUge1RleHR1cmV9IFRoZSB0ZXh0dXJlIHVzZWQgZm9yIHRoZSBkaXNwbGFjZW10ZW50IG1hcCAqIG11c3QgYmUgcG93ZXIgb2YgMiB0ZXh0dXJlIGF0IHRoZSBtb21lbnRcbiAqL1xuZnVuY3Rpb24gRGlzcGxhY2VtZW50RmlsdGVyKHRleHR1cmUpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG4gICAgdGV4dHVyZS5iYXNlVGV4dHVyZS5fcG93ZXJPZjIgPSB0cnVlO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIC8vY29uc29sZS5sb2coKVxuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIGRpc3BsYWNlbWVudE1hcDoge3R5cGU6ICdzYW1wbGVyMkQnLCB2YWx1ZTp0ZXh0dXJlfSxcbiAgICAgICAgc2NhbGU6ICAgICAgICAgICB7dHlwZTogJzJmJywgdmFsdWU6e3g6MzAsIHk6MzB9fSxcbiAgICAgICAgb2Zmc2V0OiAgICAgICAgICB7dHlwZTogJzJmJywgdmFsdWU6e3g6MCwgeTowfX0sXG4gICAgICAgIG1hcERpbWVuc2lvbnM6ICAge3R5cGU6ICcyZicsIHZhbHVlOnt4OjEsIHk6NTExMn19LFxuICAgICAgICBkaW1lbnNpb25zOiAgIHt0eXBlOiAnNGZ2JywgdmFsdWU6WzAsMCwwLDBdfVxuICAgIH07XG5cbiAgICBpZih0ZXh0dXJlLmJhc2VUZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMubWFwRGltZW5zaW9ucy52YWx1ZS54ID0gdGV4dHVyZS53aWR0aDtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5tYXBEaW1lbnNpb25zLnZhbHVlLnkgPSB0ZXh0dXJlLmhlaWdodDtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5ib3VuZExvYWRlZEZ1bmN0aW9uID0gdGhpcy5vblRleHR1cmVMb2FkZWQuYmluZCh0aGlzKTtcblxuICAgICAgICB0ZXh0dXJlLmJhc2VUZXh0dXJlLm9uKCdsb2FkZWQnLCB0aGlzLmJvdW5kTG9hZGVkRnVuY3Rpb24pO1xuICAgIH1cblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCBkaXNwbGFjZW1lbnRNYXA7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG4gICAgICAgICd1bmlmb3JtIHZlYzIgc2NhbGU7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjMiBvZmZzZXQ7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjNCBkaW1lbnNpb25zOycsXG4gICAgICAgICd1bmlmb3JtIHZlYzIgbWFwRGltZW5zaW9uczsnLC8vID0gdmVjMigyNTYuMCwgMjU2LjApOycsXG4gICAgICAgIC8vICdjb25zdCB2ZWMyIHRleHR1cmVEaW1lbnNpb25zID0gdmVjMig3NTAuMCwgNzUwLjApOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIHZlYzIgbWFwQ29yZHMgPSB2VGV4dHVyZUNvb3JkLnh5OycsXG4gICAgICAgIC8vJyAgIG1hcENvcmRzIC09IDsnLFxuICAgICAgICAnICAgbWFwQ29yZHMgKz0gKGRpbWVuc2lvbnMuencgKyBvZmZzZXQpLyBkaW1lbnNpb25zLnh5IDsnLFxuICAgICAgICAnICAgbWFwQ29yZHMueSAqPSAtMS4wOycsXG4gICAgICAgICcgICBtYXBDb3Jkcy55ICs9IDEuMDsnLFxuICAgICAgICAnICAgdmVjMiBtYXRTYW1wbGUgPSB0ZXh0dXJlMkQoZGlzcGxhY2VtZW50TWFwLCBtYXBDb3JkcykueHk7JyxcbiAgICAgICAgJyAgIG1hdFNhbXBsZSAtPSAwLjU7JyxcbiAgICAgICAgJyAgIG1hdFNhbXBsZSAqPSBzY2FsZTsnLFxuICAgICAgICAnICAgbWF0U2FtcGxlIC89IG1hcERpbWVuc2lvbnM7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdmVjMih2VGV4dHVyZUNvb3JkLnggKyBtYXRTYW1wbGUueCwgdlRleHR1cmVDb29yZC55ICsgbWF0U2FtcGxlLnkpKTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yLnJnYiA9IG1peCggZ2xfRnJhZ0NvbG9yLnJnYiwgZ2xfRnJhZ0NvbG9yLnJnYiwgMS4wKTsnLFxuICAgICAgICAnICAgdmVjMiBjb3JkID0gdlRleHR1cmVDb29yZDsnLFxuXG4gICAgICAgIC8vJyAgIGdsX0ZyYWdDb2xvciA9ICB0ZXh0dXJlMkQoZGlzcGxhY2VtZW50TWFwLCBjb3JkKTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gZ2xfRnJhZ0NvbG9yICogdkNvbG9yOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IERpc3BsYWNlbWVudEZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IERpc3BsYWNlbWVudEZpbHRlcn1cbn0pO1xuXG5wcm90by5vblRleHR1cmVMb2FkZWQgPSBmdW5jdGlvbigpXG57XG4gICAgdGhpcy51bmlmb3Jtcy5tYXBEaW1lbnNpb25zLnZhbHVlLnggPSB0aGlzLnVuaWZvcm1zLmRpc3BsYWNlbWVudE1hcC52YWx1ZS53aWR0aDtcbiAgICB0aGlzLnVuaWZvcm1zLm1hcERpbWVuc2lvbnMudmFsdWUueSA9IHRoaXMudW5pZm9ybXMuZGlzcGxhY2VtZW50TWFwLnZhbHVlLmhlaWdodDtcblxuICAgIHRoaXMudW5pZm9ybXMuZGlzcGxhY2VtZW50TWFwLnZhbHVlLmJhc2VUZXh0dXJlLm9mZignbG9hZGVkJywgdGhpcy5ib3VuZExvYWRlZEZ1bmN0aW9uKTtcbn07XG5cbi8qKlxuICogVGhlIHRleHR1cmUgdXNlZCBmb3IgdGhlIGRpc3BsYWNlbXRlbnQgbWFwICogbXVzdCBiZSBwb3dlciBvZiAyIHRleHR1cmUgYXQgdGhlIG1vbWVudFxuICpcbiAqIEBwcm9wZXJ0eSBtYXBcbiAqIEB0eXBlIFRleHR1cmVcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnbWFwJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmRpc3BsYWNlbWVudE1hcC52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5kaXNwbGFjZW1lbnRNYXAudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuLyoqXG4gKiBUaGUgbXVsdGlwbGllciB1c2VkIHRvIHNjYWxlIHRoZSBkaXNwbGFjZW1lbnQgcmVzdWx0IGZyb20gdGhlIG1hcCBjYWxjdWxhdGlvbi5cbiAqXG4gKiBAcHJvcGVydHkgc2NhbGVcbiAqIEB0eXBlIFBvaW50XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ3NjYWxlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnNjYWxlLnZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLnVuaWZvcm1zLnNjYWxlLnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbi8qKlxuICogVGhlIG9mZnNldCB1c2VkIHRvIG1vdmUgdGhlIGRpc3BsYWNlbWVudCBtYXAuXG4gKlxuICogQHByb3BlcnR5IG9mZnNldFxuICogQHR5cGUgUG9pbnRcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnb2Zmc2V0Jywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm9mZnNldC52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5vZmZzZXQudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaXNwbGFjZW1lbnRGaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICogb3JpZ2luYWwgZmlsdGVyOiBodHRwczovL2dpdGh1Yi5jb20vZXZhbncvZ2xmeC5qcy9ibG9iL21hc3Rlci9zcmMvZmlsdGVycy9mdW4vZG90c2NyZWVuLmpzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG4vKipcbiAqXG4gKiBUaGlzIGZpbHRlciBhcHBsaWVzIGEgcGl4bGF0ZSBlZmZlY3QgbWFraW5nIGRpc3BsYXkgb2JqZWN0cyBhcHBlYXIgJ2Jsb2NreSdcbiAqIEBjbGFzcyBQaXhlbGF0ZUZpbHRlclxuICogQGNvbnRydWN0b3JcbiAqL1xuZnVuY3Rpb24gRG90U2NyZWVuRmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBzY2FsZToge3R5cGU6ICcxZicsIHZhbHVlOjF9LFxuICAgICAgICBhbmdsZToge3R5cGU6ICcxZicsIHZhbHVlOjV9LFxuICAgICAgICBkaW1lbnNpb25zOiAgIHt0eXBlOiAnNGZ2JywgdmFsdWU6WzAsMCwwLDBdfVxuICAgIH07XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSB2ZWM0IGRpbWVuc2lvbnM7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG5cbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgYW5nbGU7JyxcbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgc2NhbGU7JyxcblxuICAgICAgICAnZmxvYXQgcGF0dGVybigpIHsnLFxuICAgICAgICAnICAgZmxvYXQgcyA9IHNpbihhbmdsZSksIGMgPSBjb3MoYW5nbGUpOycsXG4gICAgICAgICcgICB2ZWMyIHRleCA9IHZUZXh0dXJlQ29vcmQgKiBkaW1lbnNpb25zLnh5OycsXG4gICAgICAgICcgICB2ZWMyIHBvaW50ID0gdmVjMignLFxuICAgICAgICAnICAgICAgIGMgKiB0ZXgueCAtIHMgKiB0ZXgueSwnLFxuICAgICAgICAnICAgICAgIHMgKiB0ZXgueCArIGMgKiB0ZXgueScsXG4gICAgICAgICcgICApICogc2NhbGU7JyxcbiAgICAgICAgJyAgIHJldHVybiAoc2luKHBvaW50LngpICogc2luKHBvaW50LnkpKSAqIDQuMDsnLFxuICAgICAgICAnfScsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbigpIHsnLFxuICAgICAgICAnICAgdmVjNCBjb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCk7JyxcbiAgICAgICAgJyAgIGZsb2F0IGF2ZXJhZ2UgPSAoY29sb3IuciArIGNvbG9yLmcgKyBjb2xvci5iKSAvIDMuMDsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCh2ZWMzKGF2ZXJhZ2UgKiAxMC4wIC0gNS4wICsgcGF0dGVybigpKSwgY29sb3IuYSk7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcbn1cblxudmFyIHByb3RvID0gRG90U2NyZWVuRmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogRG90U2NyZWVuRmlsdGVyfVxufSk7XG5cbi8qKlxuICpcbiAqIFRoaXMgZGVzY3JpYmVzIHRoZSB0aGUgc2NhbGVcbiAqIEBwcm9wZXJ0eSBzY2FsZVxuICogQHR5cGUgTnVtYmVyXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ3NjYWxlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnNjYWxlLnZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5zY2FsZS52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG4vKipcbiAqXG4gKiBUaGlzIHJhZGl1cyBkZXNjcmliZXMgYW5nbGVcbiAqIEBwcm9wZXJ0eSBhbmdsZVxuICogQHR5cGUgTnVtYmVyXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2FuZ2xlJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmFuZ2xlLnZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5hbmdsZS52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IERvdFNjcmVlbkZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gRmlsdGVyQmxvY2soKVxue1xuICAgIHRoaXMudmlzaWJsZSA9IHRydWU7XG4gICAgdGhpcy5yZW5kZXJhYmxlID0gdHJ1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBGaWx0ZXJCbG9jaztcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG4vKipcbiAqXG4gKiBUaGlzIHR1cm5zIHlvdXIgZGlzcGxheU9iamVjdHMgdG8gYmxhY2sgYW5kIHdoaXRlLlxuICogQGNsYXNzIEdyYXlGaWx0ZXJcbiAqIEBjb250cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEdyYXlGaWx0ZXIoKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIGdyYXk6IHt0eXBlOiAnMWYnLCB2YWx1ZTogMX0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuICAgICAgICAndW5pZm9ybSBmbG9hdCBncmF5OycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCk7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBtaXgoZ2xfRnJhZ0NvbG9yLnJnYiwgdmVjMygwLjIxMjYqZ2xfRnJhZ0NvbG9yLnIgKyAwLjcxNTIqZ2xfRnJhZ0NvbG9yLmcgKyAwLjA3MjIqZ2xfRnJhZ0NvbG9yLmIpLCBncmF5KTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gZ2xfRnJhZ0NvbG9yICogdkNvbG9yOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IEdyYXlGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShBYnN0cmFjdEZpbHRlci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBHcmF5RmlsdGVyfVxufSk7XG5cbi8qKlxuVGhlIHN0cmVuZ3RoIG9mIHRoZSBncmF5LiAxIHdpbGwgbWFrZSB0aGUgb2JqZWN0IGJsYWNrIGFuZCB3aGl0ZSwgMCB3aWxsIG1ha2UgdGhlIG9iamVjdCBpdHMgbm9ybWFsIGNvbG9yXG5AcHJvcGVydHkgZ3JheVxuKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2dyYXknLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuZ3JheS52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5ncmF5LnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gR3JheUZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG4vKipcbiAqXG4gKiBUaGlzIGludmVydHMgeW91ciBkaXNwbGF5T2JqZWN0cyBjb2xvcnMuXG4gKiBAY2xhc3MgSW52ZXJ0RmlsdGVyXG4gKiBAY29udHJ1Y3RvclxuICovXG5mdW5jdGlvbiBJbnZlcnRGaWx0ZXIoKVxue1xuICAgIEFic3RyYWN0RmlsdGVyLmNhbGwoIHRoaXMgKTtcblxuICAgIHRoaXMucGFzc2VzID0gW3RoaXNdO1xuXG4gICAgLy8gc2V0IHRoZSB1bmlmb3Jtc1xuICAgIHRoaXMudW5pZm9ybXMgPSB7XG4gICAgICAgIGludmVydDoge3R5cGU6ICcxZicsIHZhbHVlOiAxfSxcbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgaW52ZXJ0OycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQpOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IucmdiID0gbWl4KCAodmVjMygxKS1nbF9GcmFnQ29sb3IucmdiKSAqIGdsX0ZyYWdDb2xvci5hLCBnbF9GcmFnQ29sb3IucmdiLCAxLjAgLSBpbnZlcnQpOycsXG4gICAgICAgIC8vJyAgIGdsX0ZyYWdDb2xvci5yZ2IgPSBnbF9GcmFnQ29sb3IucmdiICAqIGdsX0ZyYWdDb2xvci5hOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSBnbF9GcmFnQ29sb3IgKiB2Q29sb3I7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcbn1cblxudmFyIHByb3RvID0gSW52ZXJ0RmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogSW52ZXJ0RmlsdGVyfVxufSk7XG5cbi8qKlxuVGhlIHN0cmVuZ3RoIG9mIHRoZSBpbnZlcnQuIDEgd2lsbCBmdWxseSBpbnZlcnQgdGhlIGNvbG9ycywgMCB3aWxsIG1ha2UgdGhlIG9iamVjdCBpdHMgbm9ybWFsIGNvbG9yXG5AcHJvcGVydHkgaW52ZXJ0XG4qL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnaW52ZXJ0Jywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmludmVydC52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5pbnZlcnQudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbnZlcnRGaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBYnN0cmFjdEZpbHRlciA9IHJlcXVpcmUoJy4vQWJzdHJhY3RGaWx0ZXInKTtcblxuLyoqXG4gKlxuICogVGhpcyBmaWx0ZXIgYXBwbGllcyBhIHBpeGxhdGUgZWZmZWN0IG1ha2luZyBkaXNwbGF5IG9iamVjdHMgYXBwZWFyICdibG9ja3knXG4gKiBAY2xhc3MgUGl4ZWxhdGVGaWx0ZXJcbiAqIEBjb250cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFBpeGVsYXRlRmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBpbnZlcnQ6IHt0eXBlOiAnMWYnLCB2YWx1ZTogMH0sXG4gICAgICAgIGRpbWVuc2lvbnM6IHt0eXBlOiAnNGZ2JywgdmFsdWU6bmV3IEZsb2F0MzJBcnJheShbMTAwMDAsIDEwMCwgMTAsIDEwXSl9LFxuICAgICAgICBwaXhlbFNpemU6IHt0eXBlOiAnMmYnLCB2YWx1ZTp7eDoxMCwgeToxMH19LFxuICAgIH07XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIHRlc3REaW07JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjNCBkaW1lbnNpb25zOycsXG4gICAgICAgICd1bmlmb3JtIHZlYzIgcGl4ZWxTaXplOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICB2ZWMyIGNvb3JkID0gdlRleHR1cmVDb29yZDsnLFxuXG4gICAgICAgICcgICB2ZWMyIHNpemUgPSBkaW1lbnNpb25zLnh5L3BpeGVsU2l6ZTsnLFxuXG4gICAgICAgICcgICB2ZWMyIGNvbG9yID0gZmxvb3IoICggdlRleHR1cmVDb29yZCAqIHNpemUgKSApIC8gc2l6ZSArIHBpeGVsU2l6ZS9kaW1lbnNpb25zLnh5ICogMC41OycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIGNvbG9yKTsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG52YXIgcHJvdG8gPSBQaXhlbGF0ZUZpbHRlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEFic3RyYWN0RmlsdGVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFBpeGVsYXRlRmlsdGVyfVxufSk7XG5cbi8qKlxuICpcbiAqIFRoaXMgYSBwb2ludCB0aGF0IGRlc2NyaWJlcyB0aGUgc2l6ZSBvZiB0aGUgYmxvY3MuIHggaXMgdGhlIHdpZHRoIG9mIHRoZSBibG9jayBhbmQgeSBpcyB0aGUgdGhlIGhlaWdodFxuICogQHByb3BlcnR5IHNpemVcbiAqIEB0eXBlIFBvaW50XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ3NpemUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMucGl4ZWxTaXplLnZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5waXhlbFNpemUudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBQaXhlbGF0ZUZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFic3RyYWN0RmlsdGVyID0gcmVxdWlyZSgnLi9BYnN0cmFjdEZpbHRlcicpO1xuXG5mdW5jdGlvbiBSR0JTcGxpdEZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgcmVkOiB7dHlwZTogJzJmJywgdmFsdWU6IHt4OjIwLCB5OjIwfX0sXG4gICAgICAgIGdyZWVuOiB7dHlwZTogJzJmJywgdmFsdWU6IHt4Oi0yMCwgeToyMH19LFxuICAgICAgICBibHVlOiB7dHlwZTogJzJmJywgdmFsdWU6IHt4OjIwLCB5Oi0yMH19LFxuICAgICAgICBkaW1lbnNpb25zOiAgIHt0eXBlOiAnNGZ2JywgdmFsdWU6WzAsMCwwLDBdfVxuICAgIH07XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIHJlZDsnLFxuICAgICAgICAndW5pZm9ybSB2ZWMyIGdyZWVuOycsXG4gICAgICAgICd1bmlmb3JtIHZlYzIgYmx1ZTsnLFxuICAgICAgICAndW5pZm9ybSB2ZWM0IGRpbWVuc2lvbnM7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvci5yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkICsgcmVkL2RpbWVuc2lvbnMueHkpLnI7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvci5nID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkICsgZ3JlZW4vZGltZW5zaW9ucy54eSkuZzsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yLmIgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQgKyBibHVlL2RpbWVuc2lvbnMueHkpLmI7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvci5hID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKS5hOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IFJHQlNwbGl0RmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogUkdCU3BsaXRGaWx0ZXJ9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvLCAnYW5nbGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuYmx1ci52YWx1ZSAvICgxLzcwMDApO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAvL3RoaXMucGFkZGluZyA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVuaWZvcm1zLmJsdXIudmFsdWUgPSAoMS83MDAwKSAqIHZhbHVlO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJHQlNwbGl0RmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbi8qKlxuICpcbiAqIFRoaXMgYXBwbGllcyBhIHNlcGlhIGVmZmVjdCB0byB5b3VyIGRpc3BsYXlPYmplY3RzLlxuICogQGNsYXNzIFNlcGlhRmlsdGVyXG4gKiBAY29udHJ1Y3RvclxuICovXG5mdW5jdGlvbiBTZXBpYUZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgc2VwaWE6IHt0eXBlOiAnMWYnLCB2YWx1ZTogMX0sXG4gICAgfTtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IHNlcGlhOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuXG4gICAgICAgICdjb25zdCBtYXQzIHNlcGlhTWF0cml4ID0gbWF0MygwLjM1ODgsIDAuNzA0NCwgMC4xMzY4LCAwLjI5OTAsIDAuNTg3MCwgMC4xMTQwLCAwLjIzOTIsIDAuNDY5NiwgMC4wOTEyKTsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQpOycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IucmdiID0gbWl4KCBnbF9GcmFnQ29sb3IucmdiLCBnbF9GcmFnQ29sb3IucmdiICogc2VwaWFNYXRyaXgsIHNlcGlhKTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gZ2xfRnJhZ0NvbG9yICogdkNvbG9yOycsXG4gICAgICAgICd9J1xuICAgIF07XG59XG5cbnZhciBwcm90byA9IFNlcGlhRmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogU2VwaWFGaWx0ZXJ9XG59KTtcblxuLyoqXG5UaGUgc3RyZW5ndGggb2YgdGhlIHNlcGlhLiAxIHdpbGwgYXBwbHkgdGhlIGZ1bGwgc2VwaWEgZWZmZWN0LCAwIHdpbGwgbWFrZSB0aGUgb2JqZWN0IGl0cyBub3JtYWwgY29sb3JcbkBwcm9wZXJ0eSBzZXBpYVxuKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ3NlcGlhJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnNlcGlhLnZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLnVuaWZvcm1zLnNlcGlhLnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gU2VwaWFGaWx0ZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBYnN0cmFjdEZpbHRlciA9IHJlcXVpcmUoJy4vQWJzdHJhY3RGaWx0ZXInKTtcblxuZnVuY3Rpb24gU21hcnRCbHVyRmlsdGVyKClcbntcbiAgICBBYnN0cmFjdEZpbHRlci5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLnBhc3NlcyA9IFt0aGlzXTtcblxuICAgIC8vIHNldCB0aGUgdW5pZm9ybXNcbiAgICB0aGlzLnVuaWZvcm1zID0ge1xuICAgICAgICBibHVyOiB7dHlwZTogJzFmJywgdmFsdWU6IDEvNTEyfSxcbiAgICB9O1xuXG4gICAgdGhpcy5mcmFnbWVudFNyYyA9IFtcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcbiAgICAgICAgLy8ndW5pZm9ybSB2ZWMyIGRlbHRhOycsXG4gICAgICAgICdjb25zdCB2ZWMyIGRlbHRhID0gdmVjMigxLjAvMTAuMCwgMC4wKTsnLFxuICAgICAgICAvLyd1bmlmb3JtIGZsb2F0IGRhcmtuZXNzOycsXG5cbiAgICAgICAgJ2Zsb2F0IHJhbmRvbSh2ZWMzIHNjYWxlLCBmbG9hdCBzZWVkKSB7JyxcbiAgICAgICAgJyAgIHJldHVybiBmcmFjdChzaW4oZG90KGdsX0ZyYWdDb29yZC54eXogKyBzZWVkLCBzY2FsZSkpICogNDM3NTguNTQ1MyArIHNlZWQpOycsXG4gICAgICAgICd9JyxcblxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICB2ZWM0IGNvbG9yID0gdmVjNCgwLjApOycsXG4gICAgICAgICcgICBmbG9hdCB0b3RhbCA9IDAuMDsnLFxuXG4gICAgICAgICcgICBmbG9hdCBvZmZzZXQgPSByYW5kb20odmVjMygxMi45ODk4LCA3OC4yMzMsIDE1MS43MTgyKSwgMC4wKTsnLFxuXG4gICAgICAgICcgICBmb3IgKGZsb2F0IHQgPSAtMzAuMDsgdCA8PSAzMC4wOyB0KyspIHsnLFxuICAgICAgICAnICAgICAgIGZsb2F0IHBlcmNlbnQgPSAodCArIG9mZnNldCAtIDAuNSkgLyAzMC4wOycsXG4gICAgICAgICcgICAgICAgZmxvYXQgd2VpZ2h0ID0gMS4wIC0gYWJzKHBlcmNlbnQpOycsXG4gICAgICAgICcgICAgICAgdmVjNCBzYW1wbGUgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZUZXh0dXJlQ29vcmQgKyBkZWx0YSAqIHBlcmNlbnQpOycsXG4gICAgICAgICcgICAgICAgc2FtcGxlLnJnYiAqPSBzYW1wbGUuYTsnLFxuICAgICAgICAnICAgICAgIGNvbG9yICs9IHNhbXBsZSAqIHdlaWdodDsnLFxuICAgICAgICAnICAgICAgIHRvdGFsICs9IHdlaWdodDsnLFxuICAgICAgICAnICAgfScsXG5cbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IGNvbG9yIC8gdG90YWw7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvci5yZ2IgLz0gZ2xfRnJhZ0NvbG9yLmEgKyAwLjAwMDAxOycsXG4gICAgICAgIC8vJyAgIGdsX0ZyYWdDb2xvci5yZ2IgKj0gZGFya25lc3M7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcbn1cblxudmFyIHByb3RvID0gU21hcnRCbHVyRmlsdGVyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQWJzdHJhY3RGaWx0ZXIucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogU21hcnRCbHVyRmlsdGVyfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ2JsdXInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuYmx1ci52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5ibHVyLnZhbHVlID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gU21hcnRCbHVyRmlsdGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQWJzdHJhY3RGaWx0ZXIgPSByZXF1aXJlKCcuL0Fic3RyYWN0RmlsdGVyJyk7XG5cbi8qKlxuICpcbiAqIFRoaXMgZmlsdGVyIGFwcGxpZXMgYSBwaXhsYXRlIGVmZmVjdCBtYWtpbmcgZGlzcGxheSBvYmplY3RzIGFwcGVhciAnYmxvY2t5J1xuICogQGNsYXNzIFBpeGVsYXRlRmlsdGVyXG4gKiBAY29udHJ1Y3RvclxuICovXG5mdW5jdGlvbiBUd2lzdEZpbHRlcigpXG57XG4gICAgQWJzdHJhY3RGaWx0ZXIuY2FsbCggdGhpcyApO1xuXG4gICAgdGhpcy5wYXNzZXMgPSBbdGhpc107XG5cbiAgICAvLyBzZXQgdGhlIHVuaWZvcm1zXG4gICAgdGhpcy51bmlmb3JtcyA9IHtcbiAgICAgICAgcmFkaXVzOiB7dHlwZTogJzFmJywgdmFsdWU6MC41fSxcbiAgICAgICAgYW5nbGU6IHt0eXBlOiAnMWYnLCB2YWx1ZTo1fSxcbiAgICAgICAgb2Zmc2V0OiB7dHlwZTogJzJmJywgdmFsdWU6e3g6MC41LCB5OjAuNX19LFxuICAgIH07XG5cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSB2ZWM0IGRpbWVuc2lvbnM7JyxcbiAgICAgICAgJ3VuaWZvcm0gc2FtcGxlcjJEIHVTYW1wbGVyOycsXG5cbiAgICAgICAgJ3VuaWZvcm0gZmxvYXQgcmFkaXVzOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGFuZ2xlOycsXG4gICAgICAgICd1bmlmb3JtIHZlYzIgb2Zmc2V0OycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIHZlYzIgY29vcmQgPSB2VGV4dHVyZUNvb3JkIC0gb2Zmc2V0OycsXG4gICAgICAgICcgICBmbG9hdCBkaXN0YW5jZSA9IGxlbmd0aChjb29yZCk7JyxcblxuICAgICAgICAnICAgaWYgKGRpc3RhbmNlIDwgcmFkaXVzKSB7JyxcbiAgICAgICAgJyAgICAgICBmbG9hdCByYXRpbyA9IChyYWRpdXMgLSBkaXN0YW5jZSkgLyByYWRpdXM7JyxcbiAgICAgICAgJyAgICAgICBmbG9hdCBhbmdsZU1vZCA9IHJhdGlvICogcmF0aW8gKiBhbmdsZTsnLFxuICAgICAgICAnICAgICAgIGZsb2F0IHMgPSBzaW4oYW5nbGVNb2QpOycsXG4gICAgICAgICcgICAgICAgZmxvYXQgYyA9IGNvcyhhbmdsZU1vZCk7JyxcbiAgICAgICAgJyAgICAgICBjb29yZCA9IHZlYzIoY29vcmQueCAqIGMgLSBjb29yZC55ICogcywgY29vcmQueCAqIHMgKyBjb29yZC55ICogYyk7JyxcbiAgICAgICAgJyAgIH0nLFxuXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIGNvb3JkK29mZnNldCk7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcbn1cblxudmFyIHByb3RvID0gVHdpc3RGaWx0ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShBYnN0cmFjdEZpbHRlci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge3ZhbHVlOiBUd2lzdEZpbHRlcn1cbn0pO1xuXG4vKipcbiAqXG4gKiBUaGlzIHBvaW50IGRlc2NyaWJlcyB0aGUgdGhlIG9mZnNldCBvZiB0aGUgdHdpc3RcbiAqIEBwcm9wZXJ0eSBzaXplXG4gKiBAdHlwZSBQb2ludFxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdvZmZzZXQnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudW5pZm9ybXMub2Zmc2V0LnZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy51bmlmb3Jtcy5vZmZzZXQudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuLyoqXG4gKlxuICogVGhpcyByYWRpdXMgZGVzY3JpYmVzIHNpemUgb2YgdGhlIHR3aXN0XG4gKiBAcHJvcGVydHkgc2l6ZVxuICogQHR5cGUgTnVtYmVyXG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm90bywgJ3JhZGl1cycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5yYWRpdXMudmFsdWU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLnVuaWZvcm1zLnJhZGl1cy52YWx1ZSA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG4vKipcbiAqXG4gKiBUaGlzIHJhZGl1cyBkZXNjcmliZXMgYW5nbGUgb2YgdGhlIHR3aXN0XG4gKiBAcHJvcGVydHkgYW5nbGVcbiAqIEB0eXBlIE51bWJlclxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG8sICdhbmdsZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5hbmdsZS52YWx1ZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMudW5pZm9ybXMuYW5nbGUudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBUd2lzdEZpbHRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBDaGFkIEVuZ2xlciA8Y2hhZEBwYW50aGVyZGV2LmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFRoZSBDaXJjbGUgb2JqZWN0IGNhbiBiZSB1c2VkIHRvIHNwZWNpZnkgYSBoaXQgYXJlYSBmb3IgZGlzcGxheW9iamVjdHNcbiAqXG4gKiBAY2xhc3MgQ2lyY2xlXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSB1cHBlci1sZWZ0IGNvcm5lciBvZiB0aGUgZnJhbWluZyByZWN0YW5nbGUgb2YgdGhpcyBjaXJjbGVcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSB1cHBlci1sZWZ0IGNvcm5lciBvZiB0aGUgZnJhbWluZyByZWN0YW5nbGUgb2YgdGhpcyBjaXJjbGVcbiAqIEBwYXJhbSByYWRpdXMge051bWJlcn0gVGhlIHJhZGl1cyBvZiB0aGUgY2lyY2xlXG4gKi9cbmZ1bmN0aW9uIENpcmNsZSh4LCB5LCByYWRpdXMpXG57XG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHhcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy54ID0geCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHlcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy55ID0geSB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHJhZGl1c1xuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cyB8fCAwO1xufVxuXG52YXIgcHJvdG8gPSBDaXJjbGUucHJvdG90eXBlO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBjbG9uZSBvZiB0aGlzIENpcmNsZSBpbnN0YW5jZVxuICpcbiAqIEBtZXRob2QgY2xvbmVcbiAqIEByZXR1cm4ge0NpcmNsZX0gYSBjb3B5IG9mIHRoZSBwb2x5Z29uXG4gKi9cbnByb3RvLmNsb25lID0gZnVuY3Rpb24gY2xvbmUoKVxue1xuICAgIHJldHVybiBuZXcgQ2lyY2xlKHRoaXMueCwgdGhpcy55LCB0aGlzLnJhZGl1cyk7XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgeCwgYW5kIHkgY29vcmRzIHBhc3NlZCB0byB0aGlzIGZ1bmN0aW9uIGFyZSBjb250YWluZWQgd2l0aGluIHRoaXMgY2lyY2xlXG4gKlxuICogQG1ldGhvZCBjb250YWluc1xuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHBvaW50IHRvIHRlc3RcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSBpZiB0aGUgeC95IGNvb3JkcyBhcmUgd2l0aGluIHRoaXMgcG9seWdvblxuICovXG5wcm90by5jb250YWlucyA9IGZ1bmN0aW9uIGNvbnRhaW5zKHgsIHkpXG57XG4gICAgaWYodGhpcy5yYWRpdXMgPD0gMClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgdmFyIGR4ID0gKHRoaXMueCAtIHgpLFxuICAgICAgICBkeSA9ICh0aGlzLnkgLSB5KSxcbiAgICAgICAgcjIgPSB0aGlzLnJhZGl1cyAqIHRoaXMucmFkaXVzO1xuXG4gICAgZHggKj0gZHg7XG4gICAgZHkgKj0gZHk7XG5cbiAgICByZXR1cm4gKGR4ICsgZHkgPD0gcjIpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDaXJjbGU7XG4iLCIvKipcbiAqIEBhdXRob3IgQ2hhZCBFbmdsZXIgPGNoYWRAcGFudGhlcmRldi5jb20+XG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIFJlY3RhbmdsZSA9IHJlcXVpcmUoJy4vUmVjdGFuZ2xlJyk7XG5cbi8qKlxuICogVGhlIEVsbGlwc2Ugb2JqZWN0IGNhbiBiZSB1c2VkIHRvIHNwZWNpZnkgYSBoaXQgYXJlYSBmb3IgZGlzcGxheW9iamVjdHNcbiAqXG4gKiBAY2xhc3MgRWxsaXBzZVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0geCB7TnVtYmVyfSBUaGUgWCBjb29yZCBvZiB0aGUgdXBwZXItbGVmdCBjb3JuZXIgb2YgdGhlIGZyYW1pbmcgcmVjdGFuZ2xlIG9mIHRoaXMgZWxsaXBzZVxuICogQHBhcmFtIHkge051bWJlcn0gVGhlIFkgY29vcmQgb2YgdGhlIHVwcGVyLWxlZnQgY29ybmVyIG9mIHRoZSBmcmFtaW5nIHJlY3RhbmdsZSBvZiB0aGlzIGVsbGlwc2VcbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSBUaGUgb3ZlcmFsbCB3aWR0aCBvZiB0aGlzIGVsbGlwc2VcbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn0gVGhlIG92ZXJhbGwgaGVpZ2h0IG9mIHRoaXMgZWxsaXBzZVxuICovXG5mdW5jdGlvbiBFbGxpcHNlKHgsIHksIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHhcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy54ID0geCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHlcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy55ID0geSB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHdpZHRoXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSB3aWR0aCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IGhlaWdodFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodCB8fCAwO1xufVxuXG52YXIgcHJvdG8gPSBFbGxpcHNlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgY2xvbmUgb2YgdGhpcyBFbGxpcHNlIGluc3RhbmNlXG4gKlxuICogQG1ldGhvZCBjbG9uZVxuICogQHJldHVybiB7RWxsaXBzZX0gYSBjb3B5IG9mIHRoZSBlbGxpcHNlXG4gKi9cbnByb3RvLmNsb25lID0gZnVuY3Rpb24gY2xvbmUoKVxue1xuICAgIHJldHVybiBuZXcgRWxsaXBzZSh0aGlzLngsIHRoaXMueSwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xufTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIHgsIGFuZCB5IGNvb3JkcyBwYXNzZWQgdG8gdGhpcyBmdW5jdGlvbiBhcmUgY29udGFpbmVkIHdpdGhpbiB0aGlzIGVsbGlwc2VcbiAqXG4gKiBAbWV0aG9kIGNvbnRhaW5zXG4gKiBAcGFyYW0geCB7TnVtYmVyfSBUaGUgWCBjb29yZCBvZiB0aGUgcG9pbnQgdG8gdGVzdFxuICogQHBhcmFtIHkge051bWJlcn0gVGhlIFkgY29vcmQgb2YgdGhlIHBvaW50IHRvIHRlc3RcbiAqIEByZXR1cm4ge0Jvb2xlYW59IGlmIHRoZSB4L3kgY29vcmRzIGFyZSB3aXRoaW4gdGhpcyBlbGxpcHNlXG4gKi9cbnByb3RvLmNvbnRhaW5zID0gZnVuY3Rpb24gY29udGFpbnMoeCwgeSlcbntcbiAgICBpZih0aGlzLndpZHRoIDw9IDAgfHwgdGhpcy5oZWlnaHQgPD0gMClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy9ub3JtYWxpemUgdGhlIGNvb3JkcyB0byBhbiBlbGxpcHNlIHdpdGggY2VudGVyIDAsMFxuICAgIC8vYW5kIGEgcmFkaXVzIG9mIDAuNVxuICAgIHZhciBub3JteCA9ICgoeCAtIHRoaXMueCkgLyB0aGlzLndpZHRoKSAtIDAuNSxcbiAgICAgICAgbm9ybXkgPSAoKHkgLSB0aGlzLnkpIC8gdGhpcy5oZWlnaHQpIC0gMC41O1xuXG4gICAgbm9ybXggKj0gbm9ybXg7XG4gICAgbm9ybXkgKj0gbm9ybXk7XG5cbiAgICByZXR1cm4gKG5vcm14ICsgbm9ybXkgPCAwLjI1KTtcbn07XG5cbnByb3RvLmdldEJvdW5kcyA9IGZ1bmN0aW9uIGdldEJvdW5kcygpXG57XG4gICAgcmV0dXJuIG5ldyBSZWN0YW5nbGUodGhpcy54LCB0aGlzLnksIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRWxsaXBzZTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBUaGUgUG9pbnQgb2JqZWN0IHJlcHJlc2VudHMgYSBsb2NhdGlvbiBpbiBhIHR3by1kaW1lbnNpb25hbCBjb29yZGluYXRlIHN5c3RlbSwgd2hlcmUgeCByZXByZXNlbnRzIHRoZSBob3Jpem9udGFsIGF4aXMgYW5kIHkgcmVwcmVzZW50cyB0aGUgdmVydGljYWwgYXhpcy5cbiAqXG4gKiBAY2xhc3MgUG9pbnRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHgge051bWJlcn0gcG9zaXRpb24gb2YgdGhlIHBvaW50XG4gKiBAcGFyYW0geSB7TnVtYmVyfSBwb3NpdGlvbiBvZiB0aGUgcG9pbnRcbiAqL1xuZnVuY3Rpb24gUG9pbnQoeCwgeSlcbntcbiAgICAvKipcbiAgICAgKiBAcHJvcGVydHkgeFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLnggPSB4IHx8IDA7XG5cbiAgICAvKipcbiAgICAgKiBAcHJvcGVydHkgeVxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLnkgPSB5IHx8IDA7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIGNsb25lIG9mIHRoaXMgcG9pbnRcbiAqXG4gKiBAbWV0aG9kIGNsb25lXG4gKiBAcmV0dXJuIHtQb2ludH0gYSBjb3B5IG9mIHRoZSBwb2ludFxuICovXG5Qb2ludC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpXG57XG4gICAgcmV0dXJuIG5ldyBQb2ludCh0aGlzLngsIHRoaXMueSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvaW50O1xuIiwiLyoqXG4gKiBAYXV0aG9yIEFkcmllbiBCcmF1bHQgPGFkcmllbi5icmF1bHRAZ21haWwuY29tPlxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBQb2ludCA9IHJlcXVpcmUoJy4vUG9pbnQnKTtcblxuLyoqXG4gKiBAY2xhc3MgUG9seWdvblxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gcG9pbnRzKiB7QXJyYXk8UG9pbnQ+fEFycmF5PE51bWJlcj58UG9pbnQuLi58TnVtYmVyLi4ufSBUaGlzIGNhbiBiZSBhbiBhcnJheSBvZiBQb2ludHMgdGhhdCBmb3JtIHRoZSBwb2x5Z29uLFxuICogICAgICBhIGZsYXQgYXJyYXkgb2YgbnVtYmVycyB0aGF0IHdpbGwgYmUgaW50ZXJwcmV0ZWQgYXMgW3gseSwgeCx5LCAuLi5dLCBvciB0aGUgYXJ1Z21lbnRzIHBhc3NlZCBjYW4gYmVcbiAqICAgICAgYWxsIHRoZSBwb2ludHMgb2YgdGhlIHBvbHlnb24gZS5nLiBgbmV3IFBvbHlnb24obmV3IFBvaW50KCksIG5ldyBQb2ludCgpLCAuLi4pYCwgb3IgdGhlXG4gKiAgICAgIGFyZ3VtZW50cyBwYXNzZWQgY2FuIGJlIGZsYXQgeCx5IHZhbHVlcyBlLmcuIGBuZXcgUG9seWdvbih4LHksIHgseSwgeCx5LCAuLi4pYCB3aGVyZSBgeGAgYW5kIGB5YCBhcmVcbiAqICAgICAgTnVtYmVycy5cbiAqL1xuZnVuY3Rpb24gUG9seWdvbihwb2ludHMpXG57XG4gICAgLy9pZiBwb2ludHMgaXNuJ3QgYW4gYXJyYXksIHVzZSBhcmd1bWVudHMgYXMgdGhlIGFycmF5XG4gICAgaWYoIShwb2ludHMgaW5zdGFuY2VvZiBBcnJheSkpXG4gICAgICAgIHBvaW50cyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAvL2lmIHRoaXMgaXMgYSBmbGF0IGFycmF5IG9mIG51bWJlcnMsIGNvbnZlcnQgaXQgdG8gcG9pbnRzXG4gICAgaWYodHlwZW9mIHBvaW50c1swXSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdmFyIHAgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpID0gMCwgaWwgPSBwb2ludHMubGVuZ3RoOyBpIDwgaWw7IGkrPTIpIHtcbiAgICAgICAgICAgIHAucHVzaChcbiAgICAgICAgICAgICAgICBuZXcgUG9pbnQocG9pbnRzW2ldLCBwb2ludHNbaSArIDFdKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvaW50cyA9IHA7XG4gICAgfVxuXG4gICAgdGhpcy5wb2ludHMgPSBwb2ludHM7XG59XG5cbnZhciBwcm90byA9IFBvbHlnb24ucHJvdG90eXBlO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBjbG9uZSBvZiB0aGlzIHBvbHlnb25cbiAqXG4gKiBAbWV0aG9kIGNsb25lXG4gKiBAcmV0dXJuIHtQb2x5Z29ufSBhIGNvcHkgb2YgdGhlIHBvbHlnb25cbiAqL1xucHJvdG8uY2xvbmUgPSBmdW5jdGlvbigpXG57XG4gICAgdmFyIHBvaW50cyA9IFtdO1xuICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwb2ludHMucHVzaCh0aGlzLnBvaW50c1tpXS5jbG9uZSgpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFBvbHlnb24ocG9pbnRzKTtcbn07XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSB4LCBhbmQgeSBjb29yZHMgcGFzc2VkIHRvIHRoaXMgZnVuY3Rpb24gYXJlIGNvbnRhaW5lZCB3aXRoaW4gdGhpcyBwb2x5Z29uXG4gKlxuICogQG1ldGhvZCBjb250YWluc1xuICogQHBhcmFtIHgge051bWJlcn0gVGhlIFggY29vcmQgb2YgdGhlIHBvaW50IHRvIHRlc3RcbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IFRoZSBZIGNvb3JkIG9mIHRoZSBwb2ludCB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSBpZiB0aGUgeC95IGNvb3JkcyBhcmUgd2l0aGluIHRoaXMgcG9seWdvblxuICovXG5wcm90by5jb250YWlucyA9IGZ1bmN0aW9uKHgsIHkpXG57XG4gICAgdmFyIGluc2lkZSA9IGZhbHNlO1xuXG4gICAgLy8gdXNlIHNvbWUgcmF5Y2FzdGluZyB0byB0ZXN0IGhpdHNcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc3Vic3RhY2svcG9pbnQtaW4tcG9seWdvbi9ibG9iL21hc3Rlci9pbmRleC5qc1xuICAgIGZvcih2YXIgaSA9IDAsIGogPSB0aGlzLnBvaW50cy5sZW5ndGggLSAxOyBpIDwgdGhpcy5wb2ludHMubGVuZ3RoOyBqID0gaSsrKSB7XG4gICAgICAgIHZhciB4aSA9IHRoaXMucG9pbnRzW2ldLngsIHlpID0gdGhpcy5wb2ludHNbaV0ueSxcbiAgICAgICAgICAgIHhqID0gdGhpcy5wb2ludHNbal0ueCwgeWogPSB0aGlzLnBvaW50c1tqXS55LFxuICAgICAgICAgICAgaW50ZXJzZWN0ID0gKCh5aSA+IHkpICE9PSAoeWogPiB5KSkgJiYgKHggPCAoeGogLSB4aSkgKiAoeSAtIHlpKSAvICh5aiAtIHlpKSArIHhpKTtcblxuICAgICAgICBpZihpbnRlcnNlY3QpIGluc2lkZSA9ICFpbnNpZGU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGluc2lkZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUG9seWdvbjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tL1xuICovXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogdGhlIFJlY3RhbmdsZSBvYmplY3QgaXMgYW4gYXJlYSBkZWZpbmVkIGJ5IGl0cyBwb3NpdGlvbiwgYXMgaW5kaWNhdGVkIGJ5IGl0cyB0b3AtbGVmdCBjb3JuZXIgcG9pbnQgKHgsIHkpIGFuZCBieSBpdHMgd2lkdGggYW5kIGl0cyBoZWlnaHQuXG4gKlxuICogQGNsYXNzIFJlY3RhbmdsZVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0geCB7TnVtYmVyfSBUaGUgWCBjb29yZCBvZiB0aGUgdXBwZXItbGVmdCBjb3JuZXIgb2YgdGhlIHJlY3RhbmdsZVxuICogQHBhcmFtIHkge051bWJlcn0gVGhlIFkgY29vcmQgb2YgdGhlIHVwcGVyLWxlZnQgY29ybmVyIG9mIHRoZSByZWN0YW5nbGVcbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSBUaGUgb3ZlcmFsbCB3aWR0aCBvZiB0aGlzIHJlY3RhbmdsZVxuICogQHBhcmFtIGhlaWdodCB7TnVtYmVyfSBUaGUgb3ZlcmFsbCBoZWlnaHQgb2YgdGhpcyByZWN0YW5nbGVcbiAqL1xuZnVuY3Rpb24gUmVjdGFuZ2xlKHgsIHksIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHhcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy54ID0geCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHlcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy55ID0geSB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHdpZHRoXG4gICAgICogQHR5cGUgTnVtYmVyXG4gICAgICogQGRlZmF1bHQgMFxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSB3aWR0aCB8fCAwO1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IGhlaWdodFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDBcbiAgICAgKi9cbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodCB8fCAwO1xufVxuXG52YXIgcHJvdG8gPSBSZWN0YW5nbGUucHJvdG90eXBlO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBjbG9uZSBvZiB0aGlzIFJlY3RhbmdsZVxuICpcbiAqIEBtZXRob2QgY2xvbmVcbiAqIEByZXR1cm4ge1JlY3RhbmdsZX0gYSBjb3B5IG9mIHRoZSByZWN0YW5nbGVcbiAqL1xucHJvdG8uY2xvbmUgPSBmdW5jdGlvbigpXG57XG4gICAgcmV0dXJuIG5ldyBSZWN0YW5nbGUodGhpcy54LCB0aGlzLnksIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbn07XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSB4LCBhbmQgeSBjb29yZHMgcGFzc2VkIHRvIHRoaXMgZnVuY3Rpb24gYXJlIGNvbnRhaW5lZCB3aXRoaW4gdGhpcyBSZWN0YW5nbGVcbiAqXG4gKiBAbWV0aG9kIGNvbnRhaW5zXG4gKiBAcGFyYW0geCB7TnVtYmVyfSBUaGUgWCBjb29yZCBvZiB0aGUgcG9pbnQgdG8gdGVzdFxuICogQHBhcmFtIHkge051bWJlcn0gVGhlIFkgY29vcmQgb2YgdGhlIHBvaW50IHRvIHRlc3RcbiAqIEByZXR1cm4ge0Jvb2xlYW59IGlmIHRoZSB4L3kgY29vcmRzIGFyZSB3aXRoaW4gdGhpcyBSZWN0YW5nbGVcbiAqL1xucHJvdG8uY29udGFpbnMgPSBmdW5jdGlvbih4LCB5KVxue1xuICAgIGlmICh0aGlzLndpZHRoIDw9IDAgfHwgdGhpcy5oZWlnaHQgPD0gMClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgdmFyIHgxID0gdGhpcy54O1xuICAgIGlmICh4ID49IHgxICYmIHggPD0geDEgKyB0aGlzLndpZHRoKVxuICAgIHtcbiAgICAgICAgdmFyIHkxID0gdGhpcy55O1xuXG4gICAgICAgIGlmICh5ID49IHkxICYmIHkgPD0geTEgKyB0aGlzLmhlaWdodClcbiAgICAgICAge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJlY3RhbmdsZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLypcbiAqIEEgbGlnaHRlciB2ZXJzaW9uIG9mIHRoZSByYWQgZ2wtbWF0cml4IGNyZWF0ZWQgYnkgQnJhbmRvbiBKb25lcywgQ29saW4gTWFjS2VuemllIElWXG4gKiB5b3UgYm90aCByb2NrIVxuICovXG5cbnZhciBNYXRyaXggPSBleHBvcnRzLk1hdHJpeCA9ICh0eXBlb2YgRmxvYXQzMkFycmF5ICE9PSAndW5kZWZpbmVkJykgPyBGbG9hdDMyQXJyYXkgOiBBcnJheTtcbnZhciBtYXQzICAgPSBleHBvcnRzLm1hdDMgPSB7fTtcbnZhciBtYXQ0ICAgPSBleHBvcnRzLm1hdDQgPSB7fTtcblxubWF0My5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoKVxue1xuICAgIHZhciBtYXRyaXggPSBuZXcgTWF0cml4KDkpO1xuXG4gICAgbWF0cml4WzBdID0gMTtcbiAgICBtYXRyaXhbMV0gPSAwO1xuICAgIG1hdHJpeFsyXSA9IDA7XG4gICAgbWF0cml4WzNdID0gMDtcbiAgICBtYXRyaXhbNF0gPSAxO1xuICAgIG1hdHJpeFs1XSA9IDA7XG4gICAgbWF0cml4WzZdID0gMDtcbiAgICBtYXRyaXhbN10gPSAwO1xuICAgIG1hdHJpeFs4XSA9IDE7XG5cbiAgICByZXR1cm4gbWF0cml4O1xufTtcblxubWF0My5pZGVudGl0eSA9IGZ1bmN0aW9uIGlkZW50aXR5KG1hdHJpeClcbntcbiAgICBtYXRyaXhbMF0gPSAxO1xuICAgIG1hdHJpeFsxXSA9IDA7XG4gICAgbWF0cml4WzJdID0gMDtcbiAgICBtYXRyaXhbM10gPSAwO1xuICAgIG1hdHJpeFs0XSA9IDE7XG4gICAgbWF0cml4WzVdID0gMDtcbiAgICBtYXRyaXhbNl0gPSAwO1xuICAgIG1hdHJpeFs3XSA9IDA7XG4gICAgbWF0cml4WzhdID0gMTtcblxuICAgIHJldHVybiBtYXRyaXg7XG59O1xuXG5tYXQ0LmNyZWF0ZSA9IGZ1bmN0aW9uIGNyZWF0ZSgpXG57XG4gICAgdmFyIG1hdHJpeCA9IG5ldyBNYXRyaXgoMTYpO1xuXG4gICAgbWF0cml4WzBdID0gMTtcbiAgICBtYXRyaXhbMV0gPSAwO1xuICAgIG1hdHJpeFsyXSA9IDA7XG4gICAgbWF0cml4WzNdID0gMDtcbiAgICBtYXRyaXhbNF0gPSAwO1xuICAgIG1hdHJpeFs1XSA9IDE7XG4gICAgbWF0cml4WzZdID0gMDtcbiAgICBtYXRyaXhbN10gPSAwO1xuICAgIG1hdHJpeFs4XSA9IDA7XG4gICAgbWF0cml4WzldID0gMDtcbiAgICBtYXRyaXhbMTBdID0gMTtcbiAgICBtYXRyaXhbMTFdID0gMDtcbiAgICBtYXRyaXhbMTJdID0gMDtcbiAgICBtYXRyaXhbMTNdID0gMDtcbiAgICBtYXRyaXhbMTRdID0gMDtcbiAgICBtYXRyaXhbMTVdID0gMTtcblxuICAgIHJldHVybiBtYXRyaXg7XG59O1xuXG5tYXQzLm11bHRpcGx5ID0gZnVuY3Rpb24gbXVsdGlwbHkobWF0LCBtYXQyLCBkZXN0KVxue1xuICAgIGlmICghZGVzdCkgeyBkZXN0ID0gbWF0OyB9XG5cbiAgICAvLyBDYWNoZSB0aGUgbWF0cml4IHZhbHVlcyAobWFrZXMgZm9yIGh1Z2Ugc3BlZWQgaW5jcmVhc2VzISlcbiAgICB2YXIgYTAwID0gbWF0WzBdLCBhMDEgPSBtYXRbMV0sIGEwMiA9IG1hdFsyXSxcbiAgICAgICAgYTEwID0gbWF0WzNdLCBhMTEgPSBtYXRbNF0sIGExMiA9IG1hdFs1XSxcbiAgICAgICAgYTIwID0gbWF0WzZdLCBhMjEgPSBtYXRbN10sIGEyMiA9IG1hdFs4XSxcblxuICAgICAgICBiMDAgPSBtYXQyWzBdLCBiMDEgPSBtYXQyWzFdLCBiMDIgPSBtYXQyWzJdLFxuICAgICAgICBiMTAgPSBtYXQyWzNdLCBiMTEgPSBtYXQyWzRdLCBiMTIgPSBtYXQyWzVdLFxuICAgICAgICBiMjAgPSBtYXQyWzZdLCBiMjEgPSBtYXQyWzddLCBiMjIgPSBtYXQyWzhdO1xuXG4gICAgZGVzdFswXSA9IGIwMCAqIGEwMCArIGIwMSAqIGExMCArIGIwMiAqIGEyMDtcbiAgICBkZXN0WzFdID0gYjAwICogYTAxICsgYjAxICogYTExICsgYjAyICogYTIxO1xuICAgIGRlc3RbMl0gPSBiMDAgKiBhMDIgKyBiMDEgKiBhMTIgKyBiMDIgKiBhMjI7XG5cbiAgICBkZXN0WzNdID0gYjEwICogYTAwICsgYjExICogYTEwICsgYjEyICogYTIwO1xuICAgIGRlc3RbNF0gPSBiMTAgKiBhMDEgKyBiMTEgKiBhMTEgKyBiMTIgKiBhMjE7XG4gICAgZGVzdFs1XSA9IGIxMCAqIGEwMiArIGIxMSAqIGExMiArIGIxMiAqIGEyMjtcblxuICAgIGRlc3RbNl0gPSBiMjAgKiBhMDAgKyBiMjEgKiBhMTAgKyBiMjIgKiBhMjA7XG4gICAgZGVzdFs3XSA9IGIyMCAqIGEwMSArIGIyMSAqIGExMSArIGIyMiAqIGEyMTtcbiAgICBkZXN0WzhdID0gYjIwICogYTAyICsgYjIxICogYTEyICsgYjIyICogYTIyO1xuXG4gICAgcmV0dXJuIGRlc3Q7XG59O1xuXG5tYXQzLmNsb25lID0gZnVuY3Rpb24gY2xvbmUobWF0KVxue1xuICAgIHZhciBtYXRyaXggPSBuZXcgTWF0cml4KDkpO1xuXG4gICAgbWF0cml4WzBdID0gbWF0WzBdO1xuICAgIG1hdHJpeFsxXSA9IG1hdFsxXTtcbiAgICBtYXRyaXhbMl0gPSBtYXRbMl07XG4gICAgbWF0cml4WzNdID0gbWF0WzNdO1xuICAgIG1hdHJpeFs0XSA9IG1hdFs0XTtcbiAgICBtYXRyaXhbNV0gPSBtYXRbNV07XG4gICAgbWF0cml4WzZdID0gbWF0WzZdO1xuICAgIG1hdHJpeFs3XSA9IG1hdFs3XTtcbiAgICBtYXRyaXhbOF0gPSBtYXRbOF07XG5cbiAgICByZXR1cm4gbWF0cml4O1xufTtcblxubWF0My50cmFuc3Bvc2UgPSBmdW5jdGlvbiB0cmFuc3Bvc2UobWF0LCBkZXN0KVxue1xuICAgIC8vIElmIHdlIGFyZSB0cmFuc3Bvc2luZyBvdXJzZWx2ZXMgd2UgY2FuIHNraXAgYSBmZXcgc3RlcHMgYnV0IGhhdmUgdG8gY2FjaGUgc29tZSB2YWx1ZXNcbiAgICBpZiAoIWRlc3QgfHwgbWF0ID09PSBkZXN0KSB7XG4gICAgICAgIHZhciBhMDEgPSBtYXRbMV0sIGEwMiA9IG1hdFsyXSxcbiAgICAgICAgICAgIGExMiA9IG1hdFs1XTtcblxuICAgICAgICBtYXRbMV0gPSBtYXRbM107XG4gICAgICAgIG1hdFsyXSA9IG1hdFs2XTtcbiAgICAgICAgbWF0WzNdID0gYTAxO1xuICAgICAgICBtYXRbNV0gPSBtYXRbN107XG4gICAgICAgIG1hdFs2XSA9IGEwMjtcbiAgICAgICAgbWF0WzddID0gYTEyO1xuICAgICAgICByZXR1cm4gbWF0O1xuICAgIH1cblxuICAgIGRlc3RbMF0gPSBtYXRbMF07XG4gICAgZGVzdFsxXSA9IG1hdFszXTtcbiAgICBkZXN0WzJdID0gbWF0WzZdO1xuICAgIGRlc3RbM10gPSBtYXRbMV07XG4gICAgZGVzdFs0XSA9IG1hdFs0XTtcbiAgICBkZXN0WzVdID0gbWF0WzddO1xuICAgIGRlc3RbNl0gPSBtYXRbMl07XG4gICAgZGVzdFs3XSA9IG1hdFs1XTtcbiAgICBkZXN0WzhdID0gbWF0WzhdO1xuICAgIHJldHVybiBkZXN0O1xufTtcblxubWF0My50b01hdDQgPSBmdW5jdGlvbiB0b01hdDQobWF0LCBkZXN0KVxue1xuICAgIGlmICghZGVzdCkgeyBkZXN0ID0gbWF0NC5jcmVhdGUoKTsgfVxuXG4gICAgZGVzdFsxNV0gPSAxO1xuICAgIGRlc3RbMTRdID0gMDtcbiAgICBkZXN0WzEzXSA9IDA7XG4gICAgZGVzdFsxMl0gPSAwO1xuXG4gICAgZGVzdFsxMV0gPSAwO1xuICAgIGRlc3RbMTBdID0gbWF0WzhdO1xuICAgIGRlc3RbOV0gPSBtYXRbN107XG4gICAgZGVzdFs4XSA9IG1hdFs2XTtcblxuICAgIGRlc3RbN10gPSAwO1xuICAgIGRlc3RbNl0gPSBtYXRbNV07XG4gICAgZGVzdFs1XSA9IG1hdFs0XTtcbiAgICBkZXN0WzRdID0gbWF0WzNdO1xuXG4gICAgZGVzdFszXSA9IDA7XG4gICAgZGVzdFsyXSA9IG1hdFsyXTtcbiAgICBkZXN0WzFdID0gbWF0WzFdO1xuICAgIGRlc3RbMF0gPSBtYXRbMF07XG5cbiAgICByZXR1cm4gZGVzdDtcbn07XG5cblxuLy8vLy9cblxuXG5tYXQ0LmNyZWF0ZSA9IGZ1bmN0aW9uIGNyZWF0ZSgpXG57XG4gICAgdmFyIG1hdHJpeCA9IG5ldyBNYXRyaXgoMTYpO1xuXG4gICAgbWF0cml4WzBdID0gMTtcbiAgICBtYXRyaXhbMV0gPSAwO1xuICAgIG1hdHJpeFsyXSA9IDA7XG4gICAgbWF0cml4WzNdID0gMDtcbiAgICBtYXRyaXhbNF0gPSAwO1xuICAgIG1hdHJpeFs1XSA9IDE7XG4gICAgbWF0cml4WzZdID0gMDtcbiAgICBtYXRyaXhbN10gPSAwO1xuICAgIG1hdHJpeFs4XSA9IDA7XG4gICAgbWF0cml4WzldID0gMDtcbiAgICBtYXRyaXhbMTBdID0gMTtcbiAgICBtYXRyaXhbMTFdID0gMDtcbiAgICBtYXRyaXhbMTJdID0gMDtcbiAgICBtYXRyaXhbMTNdID0gMDtcbiAgICBtYXRyaXhbMTRdID0gMDtcbiAgICBtYXRyaXhbMTVdID0gMTtcblxuICAgIHJldHVybiBtYXRyaXg7XG59O1xuXG5tYXQ0LnRyYW5zcG9zZSA9IGZ1bmN0aW9uIHRyYW5zcG9zZShtYXQsIGRlc3QpXG57XG4gICAgLy8gSWYgd2UgYXJlIHRyYW5zcG9zaW5nIG91cnNlbHZlcyB3ZSBjYW4gc2tpcCBhIGZldyBzdGVwcyBidXQgaGF2ZSB0byBjYWNoZSBzb21lIHZhbHVlc1xuICAgIGlmICghZGVzdCB8fCBtYXQgPT09IGRlc3QpXG4gICAge1xuICAgICAgICB2YXIgYTAxID0gbWF0WzFdLCBhMDIgPSBtYXRbMl0sIGEwMyA9IG1hdFszXSxcbiAgICAgICAgICAgIGExMiA9IG1hdFs2XSwgYTEzID0gbWF0WzddLFxuICAgICAgICAgICAgYTIzID0gbWF0WzExXTtcblxuICAgICAgICBtYXRbMV0gPSBtYXRbNF07XG4gICAgICAgIG1hdFsyXSA9IG1hdFs4XTtcbiAgICAgICAgbWF0WzNdID0gbWF0WzEyXTtcbiAgICAgICAgbWF0WzRdID0gYTAxO1xuICAgICAgICBtYXRbNl0gPSBtYXRbOV07XG4gICAgICAgIG1hdFs3XSA9IG1hdFsxM107XG4gICAgICAgIG1hdFs4XSA9IGEwMjtcbiAgICAgICAgbWF0WzldID0gYTEyO1xuICAgICAgICBtYXRbMTFdID0gbWF0WzE0XTtcbiAgICAgICAgbWF0WzEyXSA9IGEwMztcbiAgICAgICAgbWF0WzEzXSA9IGExMztcbiAgICAgICAgbWF0WzE0XSA9IGEyMztcbiAgICAgICAgcmV0dXJuIG1hdDtcbiAgICB9XG5cbiAgICBkZXN0WzBdID0gbWF0WzBdO1xuICAgIGRlc3RbMV0gPSBtYXRbNF07XG4gICAgZGVzdFsyXSA9IG1hdFs4XTtcbiAgICBkZXN0WzNdID0gbWF0WzEyXTtcbiAgICBkZXN0WzRdID0gbWF0WzFdO1xuICAgIGRlc3RbNV0gPSBtYXRbNV07XG4gICAgZGVzdFs2XSA9IG1hdFs5XTtcbiAgICBkZXN0WzddID0gbWF0WzEzXTtcbiAgICBkZXN0WzhdID0gbWF0WzJdO1xuICAgIGRlc3RbOV0gPSBtYXRbNl07XG4gICAgZGVzdFsxMF0gPSBtYXRbMTBdO1xuICAgIGRlc3RbMTFdID0gbWF0WzE0XTtcbiAgICBkZXN0WzEyXSA9IG1hdFszXTtcbiAgICBkZXN0WzEzXSA9IG1hdFs3XTtcbiAgICBkZXN0WzE0XSA9IG1hdFsxMV07XG4gICAgZGVzdFsxNV0gPSBtYXRbMTVdO1xuICAgIHJldHVybiBkZXN0O1xufTtcblxubWF0NC5tdWx0aXBseSA9IGZ1bmN0aW9uIG11bHRpcGx5KG1hdCwgbWF0MiwgZGVzdClcbntcbiAgICBpZiAoIWRlc3QpIHsgZGVzdCA9IG1hdDsgfVxuXG4gICAgLy8gQ2FjaGUgdGhlIG1hdHJpeCB2YWx1ZXMgKG1ha2VzIGZvciBodWdlIHNwZWVkIGluY3JlYXNlcyEpXG4gICAgdmFyIGEwMCA9IG1hdFsgMF0sIGEwMSA9IG1hdFsgMV0sIGEwMiA9IG1hdFsgMl0sIGEwMyA9IG1hdFszXTtcbiAgICB2YXIgYTEwID0gbWF0WyA0XSwgYTExID0gbWF0WyA1XSwgYTEyID0gbWF0WyA2XSwgYTEzID0gbWF0WzddO1xuICAgIHZhciBhMjAgPSBtYXRbIDhdLCBhMjEgPSBtYXRbIDldLCBhMjIgPSBtYXRbMTBdLCBhMjMgPSBtYXRbMTFdO1xuICAgIHZhciBhMzAgPSBtYXRbMTJdLCBhMzEgPSBtYXRbMTNdLCBhMzIgPSBtYXRbMTRdLCBhMzMgPSBtYXRbMTVdO1xuXG4gICAgLy8gQ2FjaGUgb25seSB0aGUgY3VycmVudCBsaW5lIG9mIHRoZSBzZWNvbmQgbWF0cml4XG4gICAgdmFyIGIwICA9IG1hdDJbMF0sIGIxID0gbWF0MlsxXSwgYjIgPSBtYXQyWzJdLCBiMyA9IG1hdDJbM107XG4gICAgZGVzdFswXSA9IGIwKmEwMCArIGIxKmExMCArIGIyKmEyMCArIGIzKmEzMDtcbiAgICBkZXN0WzFdID0gYjAqYTAxICsgYjEqYTExICsgYjIqYTIxICsgYjMqYTMxO1xuICAgIGRlc3RbMl0gPSBiMCphMDIgKyBiMSphMTIgKyBiMiphMjIgKyBiMyphMzI7XG4gICAgZGVzdFszXSA9IGIwKmEwMyArIGIxKmExMyArIGIyKmEyMyArIGIzKmEzMztcblxuICAgIGIwID0gbWF0Mls0XTtcbiAgICBiMSA9IG1hdDJbNV07XG4gICAgYjIgPSBtYXQyWzZdO1xuICAgIGIzID0gbWF0Mls3XTtcbiAgICBkZXN0WzRdID0gYjAqYTAwICsgYjEqYTEwICsgYjIqYTIwICsgYjMqYTMwO1xuICAgIGRlc3RbNV0gPSBiMCphMDEgKyBiMSphMTEgKyBiMiphMjEgKyBiMyphMzE7XG4gICAgZGVzdFs2XSA9IGIwKmEwMiArIGIxKmExMiArIGIyKmEyMiArIGIzKmEzMjtcbiAgICBkZXN0WzddID0gYjAqYTAzICsgYjEqYTEzICsgYjIqYTIzICsgYjMqYTMzO1xuXG4gICAgYjAgPSBtYXQyWzhdO1xuICAgIGIxID0gbWF0Mls5XTtcbiAgICBiMiA9IG1hdDJbMTBdO1xuICAgIGIzID0gbWF0MlsxMV07XG4gICAgZGVzdFs4XSA9IGIwKmEwMCArIGIxKmExMCArIGIyKmEyMCArIGIzKmEzMDtcbiAgICBkZXN0WzldID0gYjAqYTAxICsgYjEqYTExICsgYjIqYTIxICsgYjMqYTMxO1xuICAgIGRlc3RbMTBdID0gYjAqYTAyICsgYjEqYTEyICsgYjIqYTIyICsgYjMqYTMyO1xuICAgIGRlc3RbMTFdID0gYjAqYTAzICsgYjEqYTEzICsgYjIqYTIzICsgYjMqYTMzO1xuXG4gICAgYjAgPSBtYXQyWzEyXTtcbiAgICBiMSA9IG1hdDJbMTNdO1xuICAgIGIyID0gbWF0MlsxNF07XG4gICAgYjMgPSBtYXQyWzE1XTtcbiAgICBkZXN0WzEyXSA9IGIwKmEwMCArIGIxKmExMCArIGIyKmEyMCArIGIzKmEzMDtcbiAgICBkZXN0WzEzXSA9IGIwKmEwMSArIGIxKmExMSArIGIyKmEyMSArIGIzKmEzMTtcbiAgICBkZXN0WzE0XSA9IGIwKmEwMiArIGIxKmExMiArIGIyKmEyMiArIGIzKmEzMjtcbiAgICBkZXN0WzE1XSA9IGIwKmEwMyArIGIxKmExMyArIGIyKmEyMyArIGIzKmEzMztcblxuICAgIHJldHVybiBkZXN0O1xufTtcbiIsIi8qKlxuICogQGF1dGhvciBEci4gS2liaXR6IDxpbmZvQGRya2liaXR6LmNvbT5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuL3BsYXRmb3JtJyk7XG52YXIgZ2xvYmFscyAgPSByZXF1aXJlKCcuL2NvcmUvZ2xvYmFscycpO1xudmFyIHNoYWRlcnMgID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMvd2ViZ2wvc2hhZGVycycpO1xudmFyIG1hdHJpeCAgID0gcmVxdWlyZSgnLi9nZW9tL21hdHJpeCcpO1xuXG52YXIgcGl4aSA9IG1vZHVsZS5leHBvcnRzID0gT2JqZWN0LmNyZWF0ZShnbG9iYWxzKTtcblxucGl4aS5Qb2ludCAgICAgPSByZXF1aXJlKCcuL2dlb20vUG9pbnQnKTtcbnBpeGkuUmVjdGFuZ2xlID0gcmVxdWlyZSgnLi9nZW9tL1JlY3RhbmdsZScpO1xucGl4aS5Qb2x5Z29uICAgPSByZXF1aXJlKCcuL2dlb20vUG9seWdvbicpO1xucGl4aS5DaXJjbGUgICAgPSByZXF1aXJlKCcuL2dlb20vQ2lyY2xlJyk7XG5waXhpLkVsbGlwc2UgICA9IHJlcXVpcmUoJy4vZ2VvbS9FbGxpcHNlJyk7XG5waXhpLk1hdHJpeCAgICA9IG1hdHJpeC5NYXRyaXg7XG5waXhpLm1hdDMgICAgICA9IG1hdHJpeC5tYXQzO1xucGl4aS5tYXQ0ICAgICAgPSBtYXRyaXgubWF0NDtcblxucGl4aS5ibGVuZE1vZGVzICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9kaXNwbGF5L2JsZW5kTW9kZXMnKTtcbnBpeGkuRGlzcGxheU9iamVjdCAgICAgICAgICA9IHJlcXVpcmUoJy4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Jyk7XG5waXhpLkRpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuL2Rpc3BsYXkvRGlzcGxheU9iamVjdENvbnRhaW5lcicpO1xucGl4aS5TcHJpdGUgICAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9kaXNwbGF5L1Nwcml0ZScpO1xucGl4aS5Nb3ZpZUNsaXAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9kaXNwbGF5L01vdmllQ2xpcCcpO1xuXG5waXhpLkFic3RyYWN0RmlsdGVyICAgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9BYnN0cmFjdEZpbHRlcicpO1xucGl4aS5CbHVyRmlsdGVyICAgICAgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvQmx1ckZpbHRlcicpO1xucGl4aS5CbHVyWEZpbHRlciAgICAgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvQmx1clhGaWx0ZXInKTtcbnBpeGkuQmx1cllGaWx0ZXIgICAgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL0JsdXJZRmlsdGVyJyk7XG5waXhpLkNvbG9yTWF0cml4RmlsdGVyICA9IHJlcXVpcmUoJy4vZmlsdGVycy9Db2xvck1hdHJpeEZpbHRlcicpO1xucGl4aS5Db2xvclN0ZXBGaWx0ZXIgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvQ29sb3JTdGVwRmlsdGVyJyk7XG5waXhpLkNyb3NzSGF0Y2hGaWx0ZXIgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9Dcm9zc0hhdGNoRmlsdGVyJyk7XG5waXhpLkRpc3BsYWNlbWVudEZpbHRlciA9IHJlcXVpcmUoJy4vZmlsdGVycy9EaXNwbGFjZW1lbnRGaWx0ZXInKTtcbnBpeGkuRG90U2NyZWVuRmlsdGVyICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL0RvdFNjcmVlbkZpbHRlcicpO1xucGl4aS5GaWx0ZXJCbG9jayAgICAgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvRmlsdGVyQmxvY2snKTtcbnBpeGkuR3JheUZpbHRlciAgICAgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL0dyYXlGaWx0ZXInKTtcbnBpeGkuSW52ZXJ0RmlsdGVyICAgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL0ludmVydEZpbHRlcicpO1xucGl4aS5QaXhlbGF0ZUZpbHRlciAgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvUGl4ZWxhdGVGaWx0ZXInKTtcbnBpeGkuUkdCU3BsaXRGaWx0ZXIgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzL1JHQlNwbGl0RmlsdGVyJyk7XG5waXhpLlNlcGlhRmlsdGVyICAgICAgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9TZXBpYUZpbHRlcicpO1xucGl4aS5TbWFydEJsdXJGaWx0ZXIgICAgPSByZXF1aXJlKCcuL2ZpbHRlcnMvU21hcnRCbHVyRmlsdGVyJyk7XG5waXhpLlR3aXN0RmlsdGVyICAgICAgICA9IHJlcXVpcmUoJy4vZmlsdGVycy9Ud2lzdEZpbHRlcicpO1xuXG5waXhpLlRleHQgICAgICAgPSByZXF1aXJlKCcuL3RleHQvVGV4dCcpO1xucGl4aS5CaXRtYXBUZXh0ID0gcmVxdWlyZSgnLi90ZXh0L0JpdG1hcFRleHQnKTtcblxucGl4aS5JbnRlcmFjdGlvbk1hbmFnZXIgPSByZXF1aXJlKCcuL0ludGVyYWN0aW9uTWFuYWdlcicpO1xucGl4aS5TdGFnZSAgICAgICAgICAgICAgPSByZXF1aXJlKCcuL2Rpc3BsYXkvU3RhZ2UnKTtcblxucGl4aS5FdmVudFRhcmdldCAgICAgICAgPSByZXF1aXJlKCcuL2V2ZW50cy9FdmVudFRhcmdldCcpO1xuXG5waXhpLmF1dG9EZXRlY3RSZW5kZXJlciA9IHJlcXVpcmUoJy4vdXRpbHMvYXV0b0RldGVjdFJlbmRlcmVyJyk7XG5waXhpLlBvbHlLICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vdXRpbHMvUG9seWsnKTtcblxucGl4aS5XZWJHTEdyYXBoaWNzICAgID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMvd2ViZ2wvZ3JhcGhpY3MnKTtcbnBpeGkuV2ViR0xSZW5kZXJlciAgICA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzL3dlYmdsL1dlYkdMUmVuZGVyZXInKTtcbnBpeGkuV2ViR0xCYXRjaCAgICAgICA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzL3dlYmdsL1dlYkdMQmF0Y2gnKTtcbnBpeGkuV2ViR0xSZW5kZXJHcm91cCA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzL3dlYmdsL1dlYkdMUmVuZGVyR3JvdXAnKTtcbnBpeGkuQ2FudmFzUmVuZGVyZXIgICA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzL2NhbnZhcy9DYW52YXNSZW5kZXJlcicpO1xucGl4aS5DYW52YXNHcmFwaGljcyAgID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMvY2FudmFzL2dyYXBoaWNzJyk7XG5cbnBpeGkuR3JhcGhpY3MgPSByZXF1aXJlKCcuL3ByaW1pdGl2ZXMvR3JhcGhpY3MnKTtcblxucGl4aS5TdHJpcCAgICAgICAgICAgID0gcmVxdWlyZSgnLi9leHRyYXMvU3RyaXAnKTtcbnBpeGkuUm9wZSAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vZXh0cmFzL1JvcGUnKTtcbnBpeGkuVGlsaW5nU3ByaXRlICAgICA9IHJlcXVpcmUoJy4vZXh0cmFzL1RpbGluZ1Nwcml0ZScpO1xucGl4aS5TcGluZSAgICAgICAgICAgID0gcmVxdWlyZSgnLi9leHRyYXMvU3BpbmUnKTtcbnBpeGkuQ3VzdG9tUmVuZGVyYWJsZSA9IHJlcXVpcmUoJy4vZXh0cmFzL0N1c3RvbVJlbmRlcmFibGUnKTtcblxucGl4aS5CYXNlVGV4dHVyZSAgID0gcmVxdWlyZSgnLi90ZXh0dXJlcy9CYXNlVGV4dHVyZScpO1xucGl4aS5UZXh0dXJlICAgICAgID0gcmVxdWlyZSgnLi90ZXh0dXJlcy9UZXh0dXJlJyk7XG5waXhpLlJlbmRlclRleHR1cmUgPSByZXF1aXJlKCcuL3RleHR1cmVzL1JlbmRlclRleHR1cmUnKTtcblxucGl4aS5Bc3NldExvYWRlciAgICAgICA9IHJlcXVpcmUoJy4vbG9hZGVycy9Bc3NldExvYWRlcicpO1xucGl4aS5Kc29uTG9hZGVyICAgICAgICA9IHJlcXVpcmUoJy4vbG9hZGVycy9Kc29uTG9hZGVyJyk7XG5waXhpLlNwcml0ZVNoZWV0TG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXJzL1Nwcml0ZVNoZWV0TG9hZGVyJyk7XG5waXhpLkltYWdlTG9hZGVyICAgICAgID0gcmVxdWlyZSgnLi9sb2FkZXJzL0ltYWdlTG9hZGVyJyk7XG5waXhpLkJpdG1hcEZvbnRMb2FkZXIgID0gcmVxdWlyZSgnLi9sb2FkZXJzL0JpdG1hcEZvbnRMb2FkZXInKTtcbnBpeGkuU3BpbmVMb2FkZXIgICAgICAgPSByZXF1aXJlKCcuL2xvYWRlcnMvU3BpbmVMb2FkZXInKTtcblxucGl4aS5pbml0RGVmYXVsdFNoYWRlcnMgICAgICAgID0gc2hhZGVycy5pbml0RGVmYXVsdFNoYWRlcnM7XG5waXhpLmFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyICAgPSBzaGFkZXJzLmFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyO1xucGl4aS5kZWFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyID0gc2hhZGVycy5kZWFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyO1xucGl4aS5hY3RpdmF0ZVN0cmlwU2hhZGVyICAgICAgID0gc2hhZGVycy5hY3RpdmF0ZVN0cmlwU2hhZGVyO1xucGl4aS5kZWFjdGl2YXRlU3RyaXBTaGFkZXIgICAgID0gc2hhZGVycy5kZWFjdGl2YXRlU3RyaXBTaGFkZXI7XG5cbi8qXG4gKiBERUJVR0dJTkcgT05MWVxuICovXG5waXhpLnJ1bkxpc3QgPSBmdW5jdGlvbihpdGVtKVxue1xuICAgIHBsYXRmb3JtLmNvbnNvbGUubG9nKCc+Pj4+Pj4+Pj4nKTtcbiAgICBwbGF0Zm9ybS5jb25zb2xlLmxvZygnXycpO1xuICAgIHZhciBzYWZlID0gMDtcbiAgICB2YXIgdG1wID0gaXRlbS5maXJzdDtcbiAgICBwbGF0Zm9ybS5jb25zb2xlLmxvZyh0bXApO1xuXG4gICAgd2hpbGUodG1wLl9pTmV4dClcbiAgICB7XG4gICAgICAgIHNhZmUrKztcbiAgICAgICAgdG1wID0gdG1wLl9pTmV4dDtcbiAgICAgICAgcGxhdGZvcm0uY29uc29sZS5sb2codG1wKTtcblxuICAgICAgICBpZihzYWZlID4gMTAwKVxuICAgICAgICB7XG4gICAgICAgICAgICBwbGF0Zm9ybS5jb25zb2xlLmxvZygnQlJFQUsnKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG5cbi8qKlxuICogTWFwcyBmaWxlIGV4dGVuc2lvbiB0byBsb2FkZXIgdHlwZXNcbiAqXG4gKiBAcHJvcGVydHkgbG9hZGVyc0J5VHlwZVxuICogQHR5cGUgT2JqZWN0XG4gKi9cbnZhciBsb2FkZXJzQnlUeXBlID0ge307XG5cbmZ1bmN0aW9uIGdldERhdGFUeXBlKHN0cilcbntcbiAgICB2YXIgdGVzdCA9ICdkYXRhOic7XG4gICAgLy9zdGFydHMgd2l0aCAnZGF0YTonXG4gICAgdmFyIHN0YXJ0ID0gc3RyLnNsaWNlKDAsIHRlc3QubGVuZ3RoKS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChzdGFydCA9PT0gdGVzdCkge1xuICAgICAgICB2YXIgZGF0YSA9IHN0ci5zbGljZSh0ZXN0Lmxlbmd0aCk7XG5cbiAgICAgICAgdmFyIHNlcElkeCA9IGRhdGEuaW5kZXhPZignLCcpO1xuICAgICAgICBpZiAoc2VwSWR4ID09PSAtMSkgLy9tYWxmb3JtZWQgZGF0YSBVUkkgc2NoZW1lXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICAvL2UuZy4gJ2ltYWdlL2dpZjtiYXNlNjQnID0+ICdpbWFnZS9naWYnXG4gICAgICAgIHZhciBpbmZvID0gZGF0YS5zbGljZSgwLCBzZXBJZHgpLnNwbGl0KCc7JylbMF07XG5cbiAgICAgICAgLy9XZSBtaWdodCBuZWVkIHRvIGhhbmRsZSBzb21lIHNwZWNpYWwgY2FzZXMgaGVyZS4uLlxuICAgICAgICAvL3N0YW5kYXJkaXplIHRleHQvcGxhaW4gdG8gJ3R4dCcgZmlsZSBleHRlbnNpb25cbiAgICAgICAgaWYgKCFpbmZvIHx8IGluZm8udG9Mb3dlckNhc2UoKSA9PT0gJ3RleHQvcGxhaW4nKVxuICAgICAgICAgICAgcmV0dXJuICd0eHQnO1xuXG4gICAgICAgIC8vVXNlciBzcGVjaWZpZWQgbWltZSB0eXBlLCB0cnkgc3BsaXR0aW5nIGl0IGJ5ICcvJ1xuICAgICAgICByZXR1cm4gaW5mby5zcGxpdCgnLycpLnBvcCgpLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogQSBDbGFzcyB0aGF0IGxvYWRzIGEgYnVuY2ggb2YgaW1hZ2VzIC8gc3ByaXRlIHNoZWV0IC8gYml0bWFwIGZvbnQgZmlsZXMuIE9uY2UgdGhlXG4gKiBhc3NldHMgaGF2ZSBiZWVuIGxvYWRlZCB0aGV5IGFyZSBhZGRlZCB0byB0aGUgVGV4dHVyZSBjYWNoZSBhbmQgY2FuIGJlIGFjY2Vzc2VkXG4gKiBlYXNpbHkgdGhyb3VnaCBUZXh0dXJlLmZyb21JbWFnZSgpIGFuZCBTcHJpdGUuZnJvbUltYWdlKClcbiAqIFdoZW4gYWxsIGl0ZW1zIGhhdmUgYmVlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgXCJvbkxvYWRlZFwiIGV2ZW50XG4gKiBBcyBlYWNoIGluZGl2aWR1YWwgaXRlbSBpcyBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgXCJvblByb2dyZXNzXCIgZXZlbnRcbiAqXG4gKiBAY2xhc3MgQXNzZXRMb2FkZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBwYXJhbSB7QXJyYXk8U3RyaW5nPn0gYXNzZXRVUkxzIGFuIGFycmF5IG9mIGltYWdlL3Nwcml0ZSBzaGVldCB1cmxzIHRoYXQgeW91IHdvdWxkIGxpa2UgbG9hZGVkXG4gKiAgICAgIHN1cHBvcnRlZC4gU3VwcG9ydGVkIGltYWdlIGZvcm1hdHMgaW5jbHVkZSAnanBlZycsICdqcGcnLCAncG5nJywgJ2dpZicuIFN1cHBvcnRlZFxuICogICAgICBzcHJpdGUgc2hlZXQgZGF0YSBmb3JtYXRzIG9ubHkgaW5jbHVkZSAnSlNPTicgYXQgdGhpcyB0aW1lLiBTdXBwb3J0ZWQgYml0bWFwIGZvbnRcbiAqICAgICAgZGF0YSBmb3JtYXRzIGluY2x1ZGUgJ3htbCcgYW5kICdmbnQnLlxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKi9cbmZ1bmN0aW9uIEFzc2V0TG9hZGVyKGFzc2V0VVJMcywgY3Jvc3NvcmlnaW4pXG57XG4gICAgRXZlbnRUYXJnZXQuY2FsbCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBhcnJheSBvZiBhc3NldCBVUkxzIHRoYXQgYXJlIGdvaW5nIHRvIGJlIGxvYWRlZFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGFzc2V0VVJMc1xuICAgICAqIEB0eXBlIEFycmF5PFN0cmluZz5cbiAgICAgKi9cbiAgICB0aGlzLmFzc2V0VVJMcyA9IGFzc2V0VVJMcztcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3NzIG9yaWdpblxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGNyb3Nzb3JpZ2luXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqL1xuICAgIHRoaXMuY3Jvc3NvcmlnaW4gPSBjcm9zc29yaWdpbjtcbn1cblxudmFyIHByb3RvID0gQXNzZXRMb2FkZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gYW4gaXRlbSBoYXMgbG9hZGVkXG4gKiBAZXZlbnQgb25Qcm9ncmVzc1xuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiBhbGwgdGhlIGFzc2V0cyBoYXZlIGxvYWRlZFxuICogQGV2ZW50IG9uQ29tcGxldGVcbiAqL1xuXG4vKipcbiAqIFN0YXJ0cyBsb2FkaW5nIHRoZSBhc3NldHMgc2VxdWVudGlhbGx5XG4gKlxuICogQG1ldGhvZCBsb2FkXG4gKi9cbnByb3RvLmxvYWQgPSBmdW5jdGlvbiBsb2FkKClcbntcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gb25Mb2FkKCkge1xuICAgICAgICBzY29wZS5vbkFzc2V0TG9hZGVkKCk7XG4gICAgfVxuXG4gICAgdGhpcy5sb2FkQ291bnQgPSB0aGlzLmFzc2V0VVJMcy5sZW5ndGg7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuYXNzZXRVUkxzLmxlbmd0aDsgaSA8IGw7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBmaWxlTmFtZSA9IHRoaXMuYXNzZXRVUkxzW2ldO1xuICAgICAgICAvL2ZpcnN0IHNlZSBpZiB3ZSBoYXZlIGEgZGF0YSBVUkkgc2NoZW1lLi5cbiAgICAgICAgdmFyIGZpbGVUeXBlID0gZ2V0RGF0YVR5cGUoZmlsZU5hbWUpO1xuXG4gICAgICAgIC8vaWYgbm90LCBhc3N1bWUgaXQncyBhIGZpbGUgVVJJXG4gICAgICAgIGlmICghZmlsZVR5cGUpXG4gICAgICAgICAgICBmaWxlVHlwZSA9IGZpbGVOYW1lLnNwbGl0KCc/Jykuc2hpZnQoKS5zcGxpdCgnLicpLnBvcCgpLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgICAgdmFyIENvbnN0cnVjdG9yID0gbG9hZGVyc0J5VHlwZVtmaWxlVHlwZV07XG4gICAgICAgIGlmKCFDb25zdHJ1Y3RvcilcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihmaWxlVHlwZSArICcgaXMgYW4gdW5zdXBwb3J0ZWQgZmlsZSB0eXBlJyk7XG5cbiAgICAgICAgdmFyIGxvYWRlciA9IG5ldyBDb25zdHJ1Y3RvcihmaWxlTmFtZSwgdGhpcy5jcm9zc29yaWdpbik7XG5cbiAgICAgICAgbG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZCcsIG9uTG9hZCk7XG4gICAgICAgIGxvYWRlci5sb2FkKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbnZva2VkIGFmdGVyIGVhY2ggZmlsZSBpcyBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIG9uQXNzZXRMb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uQXNzZXRMb2FkZWQgPSBmdW5jdGlvbiBvbkFzc2V0TG9hZGVkKClcbntcbiAgICB0aGlzLmxvYWRDb3VudC0tO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogJ29uUHJvZ3Jlc3MnLCBjb250ZW50OiB0aGlzfSk7XG4gICAgaWYgKHRoaXMub25Qcm9ncmVzcykgdGhpcy5vblByb2dyZXNzKCk7XG5cbiAgICBpZiAoIXRoaXMubG9hZENvdW50KVxuICAgIHtcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiAnb25Db21wbGV0ZScsIGNvbnRlbnQ6IHRoaXN9KTtcbiAgICAgICAgaWYodGhpcy5vbkNvbXBsZXRlKSB0aGlzLm9uQ29tcGxldGUoKTtcbiAgICB9XG59O1xuXG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUgPSBmdW5jdGlvbiByZWdpc3RlckxvYWRlclR5cGUodHlwZSwgY29uc3RydWN0b3IpXG57XG4gICAgbG9hZGVyc0J5VHlwZVt0eXBlXSA9IGNvbnN0cnVjdG9yO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBc3NldExvYWRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFzc2V0TG9hZGVyID0gcmVxdWlyZSgnLi9Bc3NldExvYWRlcicpO1xudmFyIEltYWdlTG9hZGVyID0gcmVxdWlyZSgnLi9JbWFnZUxvYWRlcicpO1xudmFyIFJlY3RhbmdsZSA9IHJlcXVpcmUoJy4uL2dlb20vUmVjdGFuZ2xlJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBCaXRtYXBUZXh0ID0gcmVxdWlyZSgnLi4vdGV4dC9CaXRtYXBUZXh0Jyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uL3RleHR1cmVzL1RleHR1cmUnKTtcbnZhciBwbGF0Zm9ybSA9IHJlcXVpcmUoJy4uL3BsYXRmb3JtJyk7XG5cbi8qKlxuICogVGhlIHhtbCBsb2FkZXIgaXMgdXNlZCB0byBsb2FkIGluIFhNTCBiaXRtYXAgZm9udCBkYXRhICgneG1sJyBvciAnZm50JylcbiAqIFRvIGdlbmVyYXRlIHRoZSBkYXRhIHlvdSBjYW4gdXNlIGh0dHA6Ly93d3cuYW5nZWxjb2RlLmNvbS9wcm9kdWN0cy9ibWZvbnQvXG4gKiBUaGlzIGxvYWRlciB3aWxsIGFsc28gbG9hZCB0aGUgaW1hZ2UgZmlsZSBhcyB0aGUgZGF0YS5cbiAqIFdoZW4gbG9hZGVkIHRoaXMgY2xhc3Mgd2lsbCBkaXNwYXRjaCBhICdsb2FkZWQnIGV2ZW50XG4gKlxuICogQGNsYXNzIEJpdG1hcEZvbnRMb2FkZXJcbiAqIEB1c2VzIEV2ZW50VGFyZ2V0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB1cmwge1N0cmluZ30gVGhlIHVybCBvZiB0aGUgc3ByaXRlIHNoZWV0IEpTT04gZmlsZVxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKi9cbmZ1bmN0aW9uIEJpdG1hcEZvbnRMb2FkZXIodXJsLCBjcm9zc29yaWdpbilcbntcbiAgICAvKlxuICAgICAqIGkgdXNlIHRleHR1cmUgcGFja2VyIHRvIGxvYWQgdGhlIGFzc2V0cy4uXG4gICAgICogaHR0cDovL3d3dy5jb2RlYW5kd2ViLmNvbS90ZXh0dXJlcGFja2VyXG4gICAgICogbWFrZSBzdXJlIHRvIHNldCB0aGUgZm9ybWF0IGFzICdKU09OJ1xuICAgICAqL1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdXJsIG9mIHRoZSBiaXRtYXAgZm9udCBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zcyBvcmlnaW5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjcm9zc29yaWdpblxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLmNyb3Nzb3JpZ2luID0gY3Jvc3NvcmlnaW47XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgYmFzZSB1cmwgb2YgdGhlIGJpdG1hcCBmb250IGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBiYXNlVXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5iYXNlVXJsID0gdXJsLnJlcGxhY2UoL1teXFwvXSokLywgJycpO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gVGhlIHRleHR1cmUgb2YgdGhlIGJpdG1hcCBmb250XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYmFzZVVybFxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZSA9IG51bGw7XG59XG5cbnZhciBwcm90byA9IEJpdG1hcEZvbnRMb2FkZXIucHJvdG90eXBlO1xuXG5wcm90by5oYW5kbGVFdmVudCA9IGZ1bmN0aW9uIGhhbmRsZUV2ZW50KGV2ZW50KSB7XG4gICAgc3dpdGNoIChldmVudC50eXBlKSB7XG4gICAgY2FzZSAnbG9hZCc6XG4gICAgICAgIHRoaXMub25YTUxMb2FkZWQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgICAgdGhpcy5vbkVycm9yKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbn07XG5cbi8qKlxuICogTG9hZHMgdGhlIFhNTCBmb250IGRhdGFcbiAqXG4gKiBAbWV0aG9kIGxvYWRcbiAqL1xucHJvdG8ubG9hZCA9IGZ1bmN0aW9uIGxvYWQoKVxue1xuICAgIHRoaXMucmVxdWVzdCA9IHBsYXRmb3JtLmNyZWF0ZVJlcXVlc3QoKTtcbiAgICB0aGlzLnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIHRoaXMpO1xuICAgIHRoaXMucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMpO1xuXG4gICAgdGhpcy5yZXF1ZXN0Lm9wZW4oJ0dFVCcsIHRoaXMudXJsLCB0cnVlKTtcbiAgICBpZiAodGhpcy5yZXF1ZXN0Lm92ZXJyaWRlTWltZVR5cGUpIHRoaXMucmVxdWVzdC5vdmVycmlkZU1pbWVUeXBlKCdhcHBsaWNhdGlvbi94bWwnKTtcbiAgICB0aGlzLnJlcXVlc3Quc2VuZChudWxsKTtcbn07XG5cbi8qKlxuICogSW52b2tlZCB3aGVuIFhNTCBmaWxlIGlzIGxvYWRlZCwgcGFyc2VzIHRoZSBkYXRhXG4gKlxuICogQG1ldGhvZCBvblhNTExvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25YTUxMb2FkZWQgPSBmdW5jdGlvbiBvblhNTExvYWRlZCgpXG57XG4gICAgdmFyIHRleHR1cmVVcmwgPSB0aGlzLmJhc2VVcmwgKyB0aGlzLnJlcXVlc3QucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3BhZ2UnKVswXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgnZmlsZScpLm5vZGVWYWx1ZTtcbiAgICB2YXIgaW1hZ2UgPSBuZXcgSW1hZ2VMb2FkZXIodGV4dHVyZVVybCwgdGhpcy5jcm9zc29yaWdpbik7XG4gICAgdGhpcy50ZXh0dXJlID0gaW1hZ2UudGV4dHVyZS5iYXNlVGV4dHVyZTtcblxuICAgIHZhciBkYXRhID0ge307XG4gICAgdmFyIGluZm8gPSB0aGlzLnJlcXVlc3QucmVzcG9uc2VYTUwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2luZm8nKVswXTtcbiAgICB2YXIgY29tbW9uID0gdGhpcy5yZXF1ZXN0LnJlc3BvbnNlWE1MLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdjb21tb24nKVswXTtcbiAgICBkYXRhLmZvbnQgPSBpbmZvLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCdmYWNlJykubm9kZVZhbHVlO1xuICAgIGRhdGEuc2l6ZSA9IHBhcnNlSW50KGluZm8uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ3NpemUnKS5ub2RlVmFsdWUsIDEwKTtcbiAgICBkYXRhLmxpbmVIZWlnaHQgPSBwYXJzZUludChjb21tb24uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ2xpbmVIZWlnaHQnKS5ub2RlVmFsdWUsIDEwKTtcbiAgICBkYXRhLmNoYXJzID0ge307XG5cbiAgICAvL3BhcnNlIGxldHRlcnNcbiAgICB2YXIgbGV0dGVycyA9IHRoaXMucmVxdWVzdC5yZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnY2hhcicpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZXR0ZXJzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGNoYXJDb2RlID0gcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgnaWQnKS5ub2RlVmFsdWUsIDEwKTtcblxuICAgICAgICB2YXIgdGV4dHVyZVJlY3QgPSBuZXcgUmVjdGFuZ2xlKFxuICAgICAgICAgICAgcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgneCcpLm5vZGVWYWx1ZSwgMTApLFxuICAgICAgICAgICAgcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgneScpLm5vZGVWYWx1ZSwgMTApLFxuICAgICAgICAgICAgcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgnd2lkdGgnKS5ub2RlVmFsdWUsIDEwKSxcbiAgICAgICAgICAgIHBhcnNlSW50KGxldHRlcnNbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ2hlaWdodCcpLm5vZGVWYWx1ZSwgMTApXG4gICAgICAgICk7XG5cbiAgICAgICAgZGF0YS5jaGFyc1tjaGFyQ29kZV0gPSB7XG4gICAgICAgICAgICB4T2Zmc2V0OiBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCd4b2Zmc2V0Jykubm9kZVZhbHVlLCAxMCksXG4gICAgICAgICAgICB5T2Zmc2V0OiBwYXJzZUludChsZXR0ZXJzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCd5b2Zmc2V0Jykubm9kZVZhbHVlLCAxMCksXG4gICAgICAgICAgICB4QWR2YW5jZTogcGFyc2VJbnQobGV0dGVyc1tpXS5hdHRyaWJ1dGVzLmdldE5hbWVkSXRlbSgneGFkdmFuY2UnKS5ub2RlVmFsdWUsIDEwKSxcbiAgICAgICAgICAgIGtlcm5pbmc6IHt9LFxuICAgICAgICAgICAgdGV4dHVyZTogVGV4dHVyZS5jYWNoZVtjaGFyQ29kZV0gPSBuZXcgVGV4dHVyZSh0aGlzLnRleHR1cmUsIHRleHR1cmVSZWN0KVxuXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy9wYXJzZSBrZXJuaW5nc1xuICAgIHZhciBrZXJuaW5ncyA9IHRoaXMucmVxdWVzdC5yZXNwb25zZVhNTC5nZXRFbGVtZW50c0J5VGFnTmFtZSgna2VybmluZycpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBrZXJuaW5ncy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBmaXJzdCA9IHBhcnNlSW50KGtlcm5pbmdzW2ldLmF0dHJpYnV0ZXMuZ2V0TmFtZWRJdGVtKCdmaXJzdCcpLm5vZGVWYWx1ZSwgMTApO1xuICAgICAgICB2YXIgc2Vjb25kID0gcGFyc2VJbnQoa2VybmluZ3NbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ3NlY29uZCcpLm5vZGVWYWx1ZSwgMTApO1xuICAgICAgICB2YXIgYW1vdW50ID0gcGFyc2VJbnQoa2VybmluZ3NbaV0uYXR0cmlidXRlcy5nZXROYW1lZEl0ZW0oJ2Ftb3VudCcpLm5vZGVWYWx1ZSwgMTApO1xuXG4gICAgICAgIGRhdGEuY2hhcnNbc2Vjb25kXS5rZXJuaW5nW2ZpcnN0XSA9IGFtb3VudDtcblxuICAgIH1cblxuICAgIEJpdG1hcFRleHQuZm9udHNbZGF0YS5mb250XSA9IGRhdGE7XG5cbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIGltYWdlLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBzY29wZS5vbkxvYWRlZCgpO1xuICAgIH0pO1xuICAgIGltYWdlLmxvYWQoKTtcbn07XG5cbi8qKlxuICogSW52b2tlZCB3aGVuIGFsbCBmaWxlcyBhcmUgbG9hZGVkICh4bWwvZm50IGFuZCB0ZXh0dXJlKVxuICpcbiAqIEBtZXRob2Qgb25Mb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uTG9hZGVkID0gZnVuY3Rpb24gb25Mb2FkZWQoKVxue1xuICAgIHRoaXMubG9hZGVkID0gdHJ1ZTtcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6ICdsb2FkZWQnLCBjb250ZW50OiB0aGlzfSk7XG59O1xuXG4vKipcbiAqIEludm9rZSB3aGVuIGVycm9yIG9jY3VyZWRcbiAqXG4gKiBAbWV0aG9kIG9uRXJyb3JcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uRXJyb3IgPSBmdW5jdGlvbiBvbkVycm9yKClcbntcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoe3R5cGU6ICdlcnJvcicsIGNvbnRlbnQ6IHRoaXN9KTtcbn07XG5cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgneG1sJywgQml0bWFwRm9udExvYWRlcik7XG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUoJ2ZudCcsIEJpdG1hcEZvbnRMb2FkZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJpdG1hcEZvbnRMb2FkZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBBc3NldExvYWRlciA9IHJlcXVpcmUoJy4vQXNzZXRMb2FkZXInKTtcbnZhciBFdmVudFRhcmdldCA9IHJlcXVpcmUoJy4uL2V2ZW50cy9FdmVudFRhcmdldCcpO1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuLi90ZXh0dXJlcy9UZXh0dXJlJyk7XG5cbi8qKlxuICogVGhlIGltYWdlIGxvYWRlciBjbGFzcyBpcyByZXNwb25zaWJsZSBmb3IgbG9hZGluZyBpbWFnZXMgZmlsZSBmb3JtYXRzIChcImpwZWdcIiwgXCJqcGdcIiwgXCJwbmdcIiBhbmQgXCJnaWZcIilcbiAqIE9uY2UgdGhlIGltYWdlIGhhcyBiZWVuIGxvYWRlZCBpdCBpcyBzdG9yZWQgaW4gdGhlIHRleHR1cmUgY2FjaGUgYW5kIGNhbiBiZSBhY2Nlc3NlZCB0aG91Z2ggVGV4dHVyZS5mcm9tRnJhbWVJZCgpIGFuZCBTcHJpdGUuZnJvbUZyb21lSWQoKVxuICogV2hlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgJ2xvYWRlZCcgZXZlbnRcbiAqXG4gKiBAY2xhc3MgSW1hZ2VMb2FkZXJcbiAqIEB1c2VzIEV2ZW50VGFyZ2V0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB1cmwge1N0cmluZ30gVGhlIHVybCBvZiB0aGUgaW1hZ2VcbiAqIEBwYXJhbSBjcm9zc29yaWdpbiB7Qm9vbGVhbn0gV2hldGhlciByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zc29yaWdpblxuICovXG5mdW5jdGlvbiBJbWFnZUxvYWRlcih1cmwsIGNyb3Nzb3JpZ2luKVxue1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGV4dHVyZSBiZWluZyBsb2FkZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB0ZXh0dXJlXG4gICAgICogQHR5cGUgVGV4dHVyZVxuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZSA9IFRleHR1cmUuZnJvbUltYWdlKHVybCwgY3Jvc3NvcmlnaW4pO1xuXG4gICAgLyoqXG4gICAgICogaWYgdGhlIGltYWdlIGlzIGxvYWRlZCB3aXRoIGxvYWRGcmFtZWRTcHJpdGVTaGVldFxuICAgICAqIGZyYW1lcyB3aWxsIGNvbnRhaW4gdGhlIHNwcml0ZSBzaGVldCBmcmFtZXNcbiAgICAgKlxuICAgICAqL1xuICAgIHRoaXMuZnJhbWVzID0gW107XG59XG5cbnZhciBwcm90byA9IEltYWdlTG9hZGVyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBMb2FkcyBpbWFnZSBvciB0YWtlcyBpdCBmcm9tIGNhY2hlXG4gKlxuICogQG1ldGhvZCBsb2FkXG4gKi9cbnByb3RvLmxvYWQgPSBmdW5jdGlvbiBsb2FkKClcbntcbiAgICBpZighdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgICAgIHRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWQnLCBmdW5jdGlvbigpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHNjb3BlLm9uTG9hZGVkKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLm9uTG9hZGVkKCk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbnZva2VkIHdoZW4gaW1hZ2UgZmlsZSBpcyBsb2FkZWQgb3IgaXQgaXMgYWxyZWFkeSBjYWNoZWQgYW5kIHJlYWR5IHRvIHVzZVxuICpcbiAqIEBtZXRob2Qgb25Mb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uTG9hZGVkID0gZnVuY3Rpb24gb25Mb2FkZWQoKVxue1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogJ2xvYWRlZCcsIGNvbnRlbnQ6IHRoaXN9KTtcbn07XG5cbi8qKlxuICogTG9hZHMgaW1hZ2UgYW5kIHNwbGl0IGl0IHRvIHVuaWZvcm0gc2l6ZWQgZnJhbWVzXG4gKlxuICpcbiAqIEBtZXRob2QgbG9hZEZyYW1lZFNwcml0ZVNoZWV0XG4gKiBAcGFyYW0gZnJhbWVXaWR0aCB7TnVtYmVyfSB3aXRoIG9mIGVhY2ggZnJhbWVcbiAqIEBwYXJhbSBmcmFtZUhlaWdodCB7TnVtYmVyfSBoZWlnaHQgb2YgZWFjaCBmcmFtZVxuICogQHBhcmFtIHRleHR1cmVOYW1lIHtTdHJpbmd9IGlmIGdpdmVuLCB0aGUgZnJhbWVzIHdpbGwgYmUgY2FjaGVkIGluIDx0ZXh0dXJlTmFtZT4tPG9yZD4gZm9ybWF0XG4gKi9cbnByb3RvLmxvYWRGcmFtZWRTcHJpdGVTaGVldCA9IGZ1bmN0aW9uKGZyYW1lV2lkdGgsIGZyYW1lSGVpZ2h0LCB0ZXh0dXJlTmFtZSlcbntcbiAgICB0aGlzLmZyYW1lcyA9IFtdO1xuICAgIHZhciBjb2xzID0gTWF0aC5mbG9vcih0aGlzLnRleHR1cmUud2lkdGggLyBmcmFtZVdpZHRoKTtcbiAgICB2YXIgcm93cyA9IE1hdGguZmxvb3IodGhpcy50ZXh0dXJlLmhlaWdodCAvIGZyYW1lSGVpZ2h0KTtcblxuICAgIHZhciBpPTA7XG4gICAgZm9yICh2YXIgeT0wOyB5PHJvd3M7IHkrKylcbiAgICB7XG4gICAgICAgIGZvciAodmFyIHg9MDsgeDxjb2xzOyB4KyssaSsrKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgdGV4dHVyZSA9IG5ldyBUZXh0dXJlKHRoaXMudGV4dHVyZSwge1xuICAgICAgICAgICAgICAgIHg6IHgqZnJhbWVXaWR0aCxcbiAgICAgICAgICAgICAgICB5OiB5KmZyYW1lSGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiBmcmFtZVdpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogZnJhbWVIZWlnaHRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmZyYW1lcy5wdXNoKHRleHR1cmUpO1xuICAgICAgICAgICAgaWYgKHRleHR1cmVOYW1lKSBUZXh0dXJlLmNhY2hlW3RleHR1cmVOYW1lICsgJy0nICsgaV0gPSB0ZXh0dXJlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoIXRoaXMudGV4dHVyZS5iYXNlVGV4dHVyZS5oYXNMb2FkZWQpXG4gICAge1xuICAgICAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgICAgICB0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzY29wZS5vbkxvYWRlZCgpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5vbkxvYWRlZCgpO1xuICAgIH1cbn07XG5cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgnanBnJywgSW1hZ2VMb2FkZXIpO1xuQXNzZXRMb2FkZXIucmVnaXN0ZXJMb2FkZXJUeXBlKCdqcGVnJywgSW1hZ2VMb2FkZXIpO1xuQXNzZXRMb2FkZXIucmVnaXN0ZXJMb2FkZXJUeXBlKCdwbmcnLCBJbWFnZUxvYWRlcik7XG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUoJ2dpZicsIEltYWdlTG9hZGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbWFnZUxvYWRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEFzc2V0TG9hZGVyID0gcmVxdWlyZSgnLi9Bc3NldExvYWRlcicpO1xudmFyIEltYWdlTG9hZGVyID0gcmVxdWlyZSgnLi9JbWFnZUxvYWRlcicpO1xudmFyIEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uL3RleHR1cmVzL1RleHR1cmUnKTtcbnZhciBTcGluZSA9IHJlcXVpcmUoJy4uL2V4dHJhcy9TcGluZScpO1xudmFyIFNrZWxldG9uSnNvbiA9IHJlcXVpcmUoJy4uL3V0aWxzL3NwaW5lJykuU2tlbGV0b25Kc29uO1xudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vcGxhdGZvcm0nKTtcblxuLyoqXG4gKiBUaGUganNvbiBmaWxlIGxvYWRlciBpcyB1c2VkIHRvIGxvYWQgaW4gSlNPTiBkYXRhIGFuZCBwYXJzaW5nIGl0XG4gKiBXaGVuIGxvYWRlZCB0aGlzIGNsYXNzIHdpbGwgZGlzcGF0Y2ggYSAnbG9hZGVkJyBldmVudFxuICogSWYgbG9hZCBmYWlsZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgJ2Vycm9yJyBldmVudFxuICpcbiAqIEBjbGFzcyBKc29uTG9hZGVyXG4gKiBAdXNlcyBFdmVudFRhcmdldFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdXJsIHtTdHJpbmd9IFRoZSB1cmwgb2YgdGhlIEpTT04gZmlsZVxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKi9cbmZ1bmN0aW9uIEpzb25Mb2FkZXIodXJsLCBjcm9zc29yaWdpbikge1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdXJsIG9mIHRoZSBiaXRtYXAgZm9udCBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zcyBvcmlnaW5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjcm9zc29yaWdpblxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLmNyb3Nzb3JpZ2luID0gY3Jvc3NvcmlnaW47XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgYmFzZSB1cmwgb2YgdGhlIGJpdG1hcCBmb250IGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBiYXNlVXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5iYXNlVXJsID0gdXJsLnJlcGxhY2UoL1teXFwvXSokLywgJycpO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gV2hldGhlciB0aGUgZGF0YSBoYXMgbG9hZGVkIHlldFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGxvYWRlZFxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLmxvYWRlZCA9IGZhbHNlO1xufVxuXG52YXIgcHJvdG8gPSBKc29uTG9hZGVyLnByb3RvdHlwZTtcblxucHJvdG8uaGFuZGxlRXZlbnQgPSBmdW5jdGlvbiBoYW5kbGVFdmVudChldmVudClcbntcbiAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcbiAgICBjYXNlICdsb2FkJzpcbiAgICAgICAgdGhpcy5vbkpTT05Mb2FkZWQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgICAgdGhpcy5vbkVycm9yKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbn07XG5cbi8qKlxuICogTG9hZHMgdGhlIEpTT04gZGF0YVxuICpcbiAqIEBtZXRob2QgbG9hZFxuICovXG5wcm90by5sb2FkID0gZnVuY3Rpb24gbG9hZCgpXG57XG4gICAgdGhpcy5yZXF1ZXN0ID0gcGxhdGZvcm0uY3JlYXRlUmVxdWVzdCgpO1xuICAgIHRoaXMucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgdGhpcyk7XG4gICAgdGhpcy5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcyk7XG5cbiAgICB0aGlzLnJlcXVlc3Qub3BlbignR0VUJywgdGhpcy51cmwsIHRydWUpO1xuICAgIGlmICh0aGlzLnJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZSkgdGhpcy5yZXF1ZXN0Lm92ZXJyaWRlTWltZVR5cGUoJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICB0aGlzLnJlcXVlc3Quc2VuZChudWxsKTtcbn07XG5cbi8qKlxuICogSW52b2tlIHdoZW4gSlNPTiBmaWxlIGlzIGxvYWRlZFxuICpcbiAqIEBtZXRob2Qgb25KU09OTG9hZGVkXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkpTT05Mb2FkZWQgPSBmdW5jdGlvbiBvbkpTT05Mb2FkZWQoKVxue1xuICAgIHRoaXMuanNvbiA9IEpTT04ucGFyc2UodGhpcy5yZXF1ZXN0LnJlc3BvbnNlVGV4dCk7XG5cbiAgICBpZih0aGlzLmpzb24uZnJhbWVzKVxuICAgIHtcbiAgICAgICAgLy8gc3ByaXRlIHNoZWV0XG4gICAgICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgICAgIHZhciB0ZXh0dXJlVXJsID0gdGhpcy5iYXNlVXJsICsgdGhpcy5qc29uLm1ldGEuaW1hZ2U7XG4gICAgICAgIHZhciBpbWFnZSA9IG5ldyBJbWFnZUxvYWRlcih0ZXh0dXJlVXJsLCB0aGlzLmNyb3Nzb3JpZ2luKTtcbiAgICAgICAgdmFyIGZyYW1lRGF0YSA9IHRoaXMuanNvbi5mcmFtZXM7XG5cbiAgICAgICAgdGhpcy50ZXh0dXJlID0gaW1hZ2UudGV4dHVyZS5iYXNlVGV4dHVyZTtcbiAgICAgICAgaW1hZ2UuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzY29wZS5vbkxvYWRlZCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKHZhciBpIGluIGZyYW1lRGF0YSkge1xuICAgICAgICAgICAgdmFyIHJlY3QgPSBmcmFtZURhdGFbaV0uZnJhbWU7XG4gICAgICAgICAgICBpZiAocmVjdCkge1xuICAgICAgICAgICAgICAgIFRleHR1cmUuY2FjaGVbaV0gPSBuZXcgVGV4dHVyZSh0aGlzLnRleHR1cmUsIHtcbiAgICAgICAgICAgICAgICAgICAgeDogcmVjdC54LFxuICAgICAgICAgICAgICAgICAgICB5OiByZWN0LnksXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoOiByZWN0LncsXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogcmVjdC5oXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lRGF0YVtpXS50cmltbWVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vdmFyIHJlYWxTaXplID0gZnJhbWVEYXRhW2ldLnNwcml0ZVNvdXJjZVNpemU7XG4gICAgICAgICAgICAgICAgICAgIFRleHR1cmUuY2FjaGVbaV0ucmVhbFNpemUgPSBmcmFtZURhdGFbaV0uc3ByaXRlU291cmNlU2l6ZTtcbiAgICAgICAgICAgICAgICAgICAgVGV4dHVyZS5jYWNoZVtpXS50cmltLnggPSAwOyAvLyAocmVhbFNpemUueCAvIHJlY3QudylcbiAgICAgICAgICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHRoZSBvZmZzZXQhXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaW1hZ2UubG9hZCgpO1xuXG4gICAgfVxuICAgIGVsc2UgaWYodGhpcy5qc29uLmJvbmVzKVxuICAgIHtcbiAgICAgICAgLy8gc3BpbmUgYW5pbWF0aW9uXG4gICAgICAgIHZhciBzcGluZUpzb25QYXJzZXIgPSBuZXcgU2tlbGV0b25Kc29uKCk7XG4gICAgICAgIHZhciBza2VsZXRvbkRhdGEgPSBzcGluZUpzb25QYXJzZXIucmVhZFNrZWxldG9uRGF0YSh0aGlzLmpzb24pO1xuICAgICAgICBTcGluZS5hbmltQ2FjaGVbdGhpcy51cmxdID0gc2tlbGV0b25EYXRhO1xuICAgICAgICB0aGlzLm9uTG9hZGVkKCk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMub25Mb2FkZWQoKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEludm9rZSB3aGVuIGpzb24gZmlsZSBsb2FkZWRcbiAqXG4gKiBAbWV0aG9kIG9uTG9hZGVkXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkxvYWRlZCA9IGZ1bmN0aW9uIG9uTG9hZGVkKClcbntcbiAgICB0aGlzLmxvYWRlZCA9IHRydWU7XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiAnbG9hZGVkJywgY29udGVudDogdGhpc30pO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBlcnJvciBvY2N1cmVkXG4gKlxuICogQG1ldGhvZCBvbkVycm9yXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkVycm9yID0gZnVuY3Rpb24gb25FcnJvcigpXG57XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KHt0eXBlOiAnZXJyb3InLCBjb250ZW50OiB0aGlzfSk7XG59O1xuXG5Bc3NldExvYWRlci5yZWdpc3RlckxvYWRlclR5cGUoJ2pzb24nLCBKc29uTG9hZGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBKc29uTG9hZGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqIGJhc2VkIG9uIHBpeGkgaW1wYWN0IHNwaW5lIGltcGxlbWVudGF0aW9uIG1hZGUgYnkgRWVtZWxpIEtlbG9rb3JwaSAoQGVrZWxva29ycGkpIGh0dHBzOi8vZ2l0aHViLmNvbS9la2Vsb2tvcnBpXG4gKlxuICogQXdlc29tZSBKUyBydW4gdGltZSBwcm92aWRlZCBieSBFc290ZXJpY1NvZnR3YXJlXG4gKiBodHRwczovL2dpdGh1Yi5jb20vRXNvdGVyaWNTb2Z0d2FyZS9zcGluZS1ydW50aW1lc1xuICpcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXNzZXRMb2FkZXIgPSByZXF1aXJlKCcuL0Fzc2V0TG9hZGVyJyk7XG52YXIgSnNvbkxvYWRlciA9IHJlcXVpcmUoJy4vSnNvbkxvYWRlcicpO1xudmFyIEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG52YXIgU3BpbmUgPSByZXF1aXJlKCcuLi9leHRyYXMvU3BpbmUnKTtcbnZhciBTa2VsZXRvbkpzb24gPSByZXF1aXJlKCcuLi91dGlscy9zcGluZScpLlNrZWxldG9uSnNvbjtcblxuLyoqXG4gKiBUaGUgU3BpbmUgbG9hZGVyIGlzIHVzZWQgdG8gbG9hZCBpbiBKU09OIHNwaW5lIGRhdGFcbiAqIFRvIGdlbmVyYXRlIHRoZSBkYXRhIHlvdSBuZWVkIHRvIHVzZSBodHRwOi8vZXNvdGVyaWNzb2Z0d2FyZS5jb20vIGFuZCBleHBvcnQgdGhlIFwiSlNPTlwiIGZvcm1hdFxuICogRHVlIHRvIGEgY2xhc2ggb2YgbmFtZXMgIFlvdSB3aWxsIG5lZWQgdG8gY2hhbmdlIHRoZSBleHRlbnNpb24gb2YgdGhlIHNwaW5lIGZpbGUgZnJvbSAqLmpzb24gdG8gKi5hbmltIGZvciBpdCB0byBsb2FkXG4gKiBTZWUgZXhhbXBsZSAxMiAoaHR0cDovL3d3dy5nb29kYm95ZGlnaXRhbC5jb20vcGl4aWpzL2V4YW1wbGVzLzEyLykgdG8gc2VlIGEgd29ya2luZyBleGFtcGxlIGFuZCBjaGVjayBvdXQgdGhlIHNvdXJjZVxuICogWW91IHdpbGwgbmVlZCB0byBnZW5lcmF0ZSBhIHNwcml0ZSBzaGVldCB0byBhY2NvbXBhbnkgdGhlIHNwaW5lIGRhdGFcbiAqIFdoZW4gbG9hZGVkIHRoaXMgY2xhc3Mgd2lsbCBkaXNwYXRjaCBhIFwibG9hZGVkXCIgZXZlbnRcbiAqXG4gKiBAY2xhc3MgU3BpbmVcbiAqIEB1c2VzIEV2ZW50VGFyZ2V0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB1cmwge1N0cmluZ30gVGhlIHVybCBvZiB0aGUgSlNPTiBmaWxlXG4gKiBAcGFyYW0gY3Jvc3NvcmlnaW4ge0Jvb2xlYW59IFdoZXRoZXIgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3NvcmlnaW5cbiAqL1xuZnVuY3Rpb24gU3BpbmVMb2FkZXIodXJsLCBjcm9zc29yaWdpbilcbntcbiAgICBFdmVudFRhcmdldC5jYWxsKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHVybCBvZiB0aGUgYml0bWFwIGZvbnQgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHVybFxuICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAqL1xuICAgIHRoaXMudXJsID0gdXJsO1xuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgcmVxdWVzdHMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgY3Jvc3Mgb3JpZ2luXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgY3Jvc3NvcmlnaW5cbiAgICAgKiBAdHlwZSBCb29sZWFuXG4gICAgICovXG4gICAgdGhpcy5jcm9zc29yaWdpbiA9IGNyb3Nzb3JpZ2luO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gV2hldGhlciB0aGUgZGF0YSBoYXMgbG9hZGVkIHlldFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGxvYWRlZFxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLmxvYWRlZCA9IGZhbHNlO1xufVxuXG52YXIgcHJvdG8gPSBTcGluZUxvYWRlci5wcm90b3R5cGU7XG5cbi8qKlxuICogTG9hZHMgdGhlIEpTT04gZGF0YVxuICpcbiAqIEBtZXRob2QgbG9hZFxuICovXG5wcm90by5sb2FkID0gZnVuY3Rpb24gbG9hZCgpXG57XG4gICAgdmFyIHNjb3BlID0gdGhpcztcbiAgICB2YXIganNvbkxvYWRlciA9IG5ldyBKc29uTG9hZGVyKHRoaXMudXJsLCB0aGlzLmNyb3Nzb3JpZ2luKTtcbiAgICBqc29uTG9hZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZCcsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBzY29wZS5qc29uID0gZXZlbnQuY29udGVudC5qc29uO1xuICAgICAgICBzY29wZS5vbkpTT05Mb2FkZWQoKTtcbiAgICB9KTtcbiAgICBqc29uTG9hZGVyLmxvYWQoKTtcbn07XG5cbi8qKlxuICogSW52b2tlIHdoZW4gSlNPTiBmaWxlIGlzIGxvYWRlZFxuICpcbiAqIEBtZXRob2Qgb25KU09OTG9hZGVkXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5vbkpTT05Mb2FkZWQgPSBmdW5jdGlvbiBvbkpTT05Mb2FkZWQoKVxue1xuICAgIHZhciBzcGluZUpzb25QYXJzZXIgPSBuZXcgU2tlbGV0b25Kc29uKCk7XG4gICAgdmFyIHNrZWxldG9uRGF0YSA9IHNwaW5lSnNvblBhcnNlci5yZWFkU2tlbGV0b25EYXRhKHRoaXMuanNvbik7XG5cbiAgICBTcGluZS5hbmltQ2FjaGVbdGhpcy51cmxdID0gc2tlbGV0b25EYXRhO1xuXG4gICAgdGhpcy5vbkxvYWRlZCgpO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBKU09OIGZpbGUgaXMgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBvbkxvYWRlZFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ub25Mb2FkZWQgPSBmdW5jdGlvbiBvbkxvYWRlZCgpXG57XG4gICAgdGhpcy5sb2FkZWQgPSB0cnVlO1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7dHlwZTogJ2xvYWRlZCcsIGNvbnRlbnQ6IHRoaXN9KTtcbn07XG5cbkFzc2V0TG9hZGVyLnJlZ2lzdGVyTG9hZGVyVHlwZSgnYW5pbScsIFNwaW5lTG9hZGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTcGluZUxvYWRlcjtcblxuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgSnNvbkxvYWRlciA9IHJlcXVpcmUoJy4vSnNvbkxvYWRlcicpO1xudmFyIEltYWdlTG9hZGVyID0gcmVxdWlyZSgnLi9JbWFnZUxvYWRlcicpO1xudmFyIEV2ZW50VGFyZ2V0ID0gcmVxdWlyZSgnLi4vZXZlbnRzL0V2ZW50VGFyZ2V0Jyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uL3RleHR1cmVzL1RleHR1cmUnKTtcblxuLyoqXG4gKiBUaGUgc3ByaXRlIHNoZWV0IGxvYWRlciBpcyB1c2VkIHRvIGxvYWQgaW4gSlNPTiBzcHJpdGUgc2hlZXQgZGF0YVxuICogVG8gZ2VuZXJhdGUgdGhlIGRhdGEgeW91IGNhbiB1c2UgaHR0cDovL3d3dy5jb2RlYW5kd2ViLmNvbS90ZXh0dXJlcGFja2VyIGFuZCBwdWJsaXNoIHRoZSAnSlNPTicgZm9ybWF0XG4gKiBUaGVyZSBpcyBhIGZyZWUgdmVyc2lvbiBzbyB0aGF0cyBuaWNlLCBhbHRob3VnaCB0aGUgcGFpZCB2ZXJzaW9uIGlzIGdyZWF0IHZhbHVlIGZvciBtb25leS5cbiAqIEl0IGlzIGhpZ2hseSByZWNvbW1lbmRlZCB0byB1c2UgU3ByaXRlIHNoZWV0cyAoYWxzbyBrbm93IGFzIHRleHR1cmUgYXRsYXMnKSBhcyBpdCBtZWFucyBzcHJpdGUncyBjYW4gYmUgYmF0Y2hlZCBhbmQgZHJhd24gdG9nZXRoZXIgZm9yIGhpZ2hseSBpbmNyZWFzZWQgcmVuZGVyaW5nIHNwZWVkLlxuICogT25jZSB0aGUgZGF0YSBoYXMgYmVlbiBsb2FkZWQgdGhlIGZyYW1lcyBhcmUgc3RvcmVkIGluIHRoZSB0ZXh0dXJlIGNhY2hlIGFuZCBjYW4gYmUgYWNjZXNzZWQgdGhvdWdoIFRleHR1cmUuZnJvbUZyYW1lSWQoKSBhbmQgU3ByaXRlLmZyb21Gcm9tZUlkKClcbiAqIFRoaXMgbG9hZGVyIHdpbGwgYWxzbyBsb2FkIHRoZSBpbWFnZSBmaWxlIHRoYXQgdGhlIFNwcml0ZXNoZWV0IHBvaW50cyB0byBhcyB3ZWxsIGFzIHRoZSBkYXRhLlxuICogV2hlbiBsb2FkZWQgdGhpcyBjbGFzcyB3aWxsIGRpc3BhdGNoIGEgJ2xvYWRlZCcgZXZlbnRcbiAqXG4gKiBAY2xhc3MgU3ByaXRlU2hlZXRMb2FkZXJcbiAqIEB1c2VzIEV2ZW50VGFyZ2V0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB1cmwge1N0cmluZ30gVGhlIHVybCBvZiB0aGUgc3ByaXRlIHNoZWV0IEpTT04gZmlsZVxuICogQHBhcmFtIGNyb3Nzb3JpZ2luIHtCb29sZWFufSBXaGV0aGVyIHJlcXVlc3RzIHNob3VsZCBiZSB0cmVhdGVkIGFzIGNyb3Nzb3JpZ2luXG4gKi9cbmZ1bmN0aW9uIFNwcml0ZVNoZWV0TG9hZGVyKHVybCwgY3Jvc3NvcmlnaW4pIHtcbiAgICAvKlxuICAgICAqIGkgdXNlIHRleHR1cmUgcGFja2VyIHRvIGxvYWQgdGhlIGFzc2V0cy4uXG4gICAgICogaHR0cDovL3d3dy5jb2RlYW5kd2ViLmNvbS90ZXh0dXJlcGFja2VyXG4gICAgICogbWFrZSBzdXJlIHRvIHNldCB0aGUgZm9ybWF0IGFzICdKU09OJ1xuICAgICAqL1xuICAgIEV2ZW50VGFyZ2V0LmNhbGwodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdXJsIG9mIHRoZSBiaXRtYXAgZm9udCBkYXRhXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zcyBvcmlnaW5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBjcm9zc29yaWdpblxuICAgICAqIEB0eXBlIEJvb2xlYW5cbiAgICAgKi9cbiAgICB0aGlzLmNyb3Nzb3JpZ2luID0gY3Jvc3NvcmlnaW47XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgYmFzZSB1cmwgb2YgdGhlIGJpdG1hcCBmb250IGRhdGFcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBiYXNlVXJsXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICogQHJlYWRPbmx5XG4gICAgICovXG4gICAgdGhpcy5iYXNlVXJsID0gdXJsLnJlcGxhY2UoL1teXFwvXSokLywgJycpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHRleHR1cmUgYmVpbmcgbG9hZGVkXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdGV4dHVyZVxuICAgICAqIEB0eXBlIFRleHR1cmVcbiAgICAgKi9cbiAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGZyYW1lcyBvZiB0aGUgc3ByaXRlIHNoZWV0XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgZnJhbWVzXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgdGhpcy5mcmFtZXMgPSB7fTtcbn1cblxudmFyIHByb3RvID0gU3ByaXRlU2hlZXRMb2FkZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIFRoaXMgd2lsbCBiZWdpbiBsb2FkaW5nIHRoZSBKU09OIGZpbGVcbiAqXG4gKiBAbWV0aG9kIGxvYWRcbiAqL1xucHJvdG8ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHZhciBqc29uTG9hZGVyID0gbmV3IEpzb25Mb2FkZXIodGhpcy51cmwsIHRoaXMuY3Jvc3NvcmlnaW4pO1xuICAgIGpzb25Mb2FkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHNjb3BlLmpzb24gPSBldmVudC5jb250ZW50Lmpzb247XG4gICAgICAgIHNjb3BlLm9uSlNPTkxvYWRlZCgpO1xuICAgIH0pO1xuICAgIGpzb25Mb2FkZXIubG9hZCgpO1xufTtcblxuLyoqXG4gKiBJbnZva2Ugd2hlbiBKU09OIGZpbGUgaXMgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBvbkpTT05Mb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uSlNPTkxvYWRlZCA9IGZ1bmN0aW9uIG9uSlNPTkxvYWRlZCgpXG57XG4gICAgdmFyIHNjb3BlID0gdGhpcztcbiAgICB2YXIgdGV4dHVyZVVybCA9IHRoaXMuYmFzZVVybCArIHRoaXMuanNvbi5tZXRhLmltYWdlO1xuICAgIHZhciBpbWFnZSA9IG5ldyBJbWFnZUxvYWRlcih0ZXh0dXJlVXJsLCB0aGlzLmNyb3Nzb3JpZ2luKTtcbiAgICB2YXIgZnJhbWVEYXRhID0gdGhpcy5qc29uLmZyYW1lcztcblxuICAgIHRoaXMudGV4dHVyZSA9IGltYWdlLnRleHR1cmUuYmFzZVRleHR1cmU7XG4gICAgaW1hZ2UuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzY29wZS5vbkxvYWRlZCgpO1xuICAgIH0pO1xuXG4gICAgZm9yICh2YXIgaSBpbiBmcmFtZURhdGEpIHtcbiAgICAgICAgdmFyIHJlY3QgPSBmcmFtZURhdGFbaV0uZnJhbWU7XG4gICAgICAgIGlmIChyZWN0KSB7XG4gICAgICAgICAgICBUZXh0dXJlLmNhY2hlW2ldID0gbmV3IFRleHR1cmUodGhpcy50ZXh0dXJlLCB7XG4gICAgICAgICAgICAgICAgeDogcmVjdC54LFxuICAgICAgICAgICAgICAgIHk6IHJlY3QueSxcbiAgICAgICAgICAgICAgICB3aWR0aDogcmVjdC53LFxuICAgICAgICAgICAgICAgIGhlaWdodDogcmVjdC5oXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChmcmFtZURhdGFbaV0udHJpbW1lZCkge1xuICAgICAgICAgICAgICAgIC8vdmFyIHJlYWxTaXplID0gZnJhbWVEYXRhW2ldLnNwcml0ZVNvdXJjZVNpemU7XG4gICAgICAgICAgICAgICAgVGV4dHVyZS5jYWNoZVtpXS5yZWFsU2l6ZSA9IGZyYW1lRGF0YVtpXS5zcHJpdGVTb3VyY2VTaXplO1xuICAgICAgICAgICAgICAgIFRleHR1cmUuY2FjaGVbaV0udHJpbS54ID0gMDsgLy8gKHJlYWxTaXplLnggLyByZWN0LncpXG4gICAgICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHRoZSBvZmZzZXQhXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpbWFnZS5sb2FkKCk7XG59O1xuXG4vKipcbiAqIEludm9rZSB3aGVuIGFsbCBmaWxlcyBhcmUgbG9hZGVkIChqc29uIGFuZCB0ZXh0dXJlKVxuICpcbiAqIEBtZXRob2Qgb25Mb2FkZWRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uTG9hZGVkID0gZnVuY3Rpb24gb25Mb2FkZWQoKVxue1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh7XG4gICAgICAgIHR5cGU6ICdsb2FkZWQnLFxuICAgICAgICBjb250ZW50OiB0aGlzXG4gICAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNwcml0ZVNoZWV0TG9hZGVyO1xuIiwidmFyIGdsb2JhbD10eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge307LyoqXG4gKiBAYXV0aG9yIERyLiBLaWJpdHogPGluZm9AZHJraWJpdHouY29tPlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIGNvbnNvbGU6ICAgZ2xvYmFsLmNvbnNvbGUsXG4gICAgZG9jdW1lbnQ6ICBnbG9iYWwuZG9jdW1lbnQsXG4gICAgbG9jYXRpb246ICBnbG9iYWwubG9jYXRpb24sXG4gICAgbmF2aWdhdG9yOiBnbG9iYWwubmF2aWdhdG9yLFxuICAgIHdpbmRvdzogICAgZ2xvYmFsLndpbmRvdyxcblxuICAgIGNyZWF0ZUNhbnZhczogZnVuY3Rpb24gY3JlYXRlQ2FudmFzKCkge1xuICAgICAgICByZXR1cm4gZ2xvYmFsLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIH0sXG5cbiAgICBjcmVhdGVJbWFnZTogZnVuY3Rpb24gY3JlYXRlSW1hZ2UoKSB7XG4gICAgICAgIHJldHVybiBuZXcgZ2xvYmFsLkltYWdlKCk7XG4gICAgfSxcblxuICAgIGNyZWF0ZVJlcXVlc3Q6IGZ1bmN0aW9uIGNyZWF0ZVJlcXVlc3QoKSB7XG4gICAgICAgIHJldHVybiBuZXcgZ2xvYmFsLlhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgfVxufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIERpc3BsYXlPYmplY3RDb250YWluZXIgPSByZXF1aXJlKCcuLi9kaXNwbGF5L0Rpc3BsYXlPYmplY3RDb250YWluZXInKTtcbnZhciBSZWN0YW5nbGUgPSByZXF1aXJlKCcuLi9nZW9tL1JlY3RhbmdsZScpO1xuXG4vKipcbiAqIFRoZSBHcmFwaGljcyBjbGFzcyBjb250YWlucyBhIHNldCBvZiBtZXRob2RzIHRoYXQgeW91IGNhbiB1c2UgdG8gY3JlYXRlIHByaW1pdGl2ZSBzaGFwZXMgYW5kIGxpbmVzLlxuICogSXQgaXMgaW1wb3J0YW50IHRvIGtub3cgdGhhdCB3aXRoIHRoZSB3ZWJHTCByZW5kZXJlciBvbmx5IHNpbXBsZSBwb2x5cyBjYW4gYmUgZmlsbGVkIGF0IHRoaXMgc3RhZ2VcbiAqIENvbXBsZXggcG9seXMgd2lsbCBub3QgYmUgZmlsbGVkLiBIZXJlcyBhbiBleGFtcGxlIG9mIGEgY29tcGxleCBwb2x5OiBodHRwOi8vd3d3Lmdvb2Rib3lkaWdpdGFsLmNvbS93cC1jb250ZW50L3VwbG9hZHMvMjAxMy8wNi9jb21wbGV4UG9seWdvbi5wbmdcbiAqXG4gKiBAY2xhc3MgR3JhcGhpY3NcbiAqIEBleHRlbmRzIERpc3BsYXlPYmplY3RDb250YWluZXJcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBHcmFwaGljcygpXG57XG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5yZW5kZXJhYmxlID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBhbHBoYSBvZiB0aGUgZmlsbCBvZiB0aGlzIGdyYXBoaWNzIG9iamVjdFxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGZpbGxBbHBoYVxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHRoaXMuZmlsbEFscGhhID0gMTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiBhbnkgbGluZXMgZHJhd25cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBsaW5lV2lkdGhcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKi9cbiAgICB0aGlzLmxpbmVXaWR0aCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sb3Igb2YgYW55IGxpbmVzIGRyYXduXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgbGluZUNvbG9yXG4gICAgICogQHR5cGUgU3RyaW5nXG4gICAgICovXG4gICAgdGhpcy5saW5lQ29sb3IgPSAnYmxhY2snO1xuXG4gICAgLyoqXG4gICAgICogR3JhcGhpY3MgZGF0YVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IGdyYXBoaWNzRGF0YVxuICAgICAqIEB0eXBlIEFycmF5XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLmdyYXBoaWNzRGF0YSA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3VycmVudCBwYXRoXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgY3VycmVudFBhdGhcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuY3VycmVudFBhdGggPSB7cG9pbnRzOltdfTtcbn1cblxudmFyIHByb3RvID0gR3JhcGhpY3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IEdyYXBoaWNzfVxufSk7XG5cbi8qKlxuICogU3BlY2lmaWVzIGEgbGluZSBzdHlsZSB1c2VkIGZvciBzdWJzZXF1ZW50IGNhbGxzIHRvIEdyYXBoaWNzIG1ldGhvZHMgc3VjaCBhcyB0aGUgbGluZVRvKCkgbWV0aG9kIG9yIHRoZSBkcmF3Q2lyY2xlKCkgbWV0aG9kLlxuICpcbiAqIEBtZXRob2QgbGluZVN0eWxlXG4gKiBAcGFyYW0gbGluZVdpZHRoIHtOdW1iZXJ9IHdpZHRoIG9mIHRoZSBsaW5lIHRvIGRyYXcsIHdpbGwgdXBkYXRlIHRoZSBvYmplY3QncyBzdG9yZWQgc3R5bGVcbiAqIEBwYXJhbSBjb2xvciB7TnVtYmVyfSBjb2xvciBvZiB0aGUgbGluZSB0byBkcmF3LCB3aWxsIHVwZGF0ZSB0aGUgb2JqZWN0J3Mgc3RvcmVkIHN0eWxlXG4gKiBAcGFyYW0gYWxwaGEge051bWJlcn0gYWxwaGEgb2YgdGhlIGxpbmUgdG8gZHJhdywgd2lsbCB1cGRhdGUgdGhlIG9iamVjdCdzIHN0b3JlZCBzdHlsZVxuICovXG5wcm90by5saW5lU3R5bGUgPSBmdW5jdGlvbiBsaW5lU3R5bGUobGluZVdpZHRoLCBjb2xvciwgYWxwaGEpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5saW5lV2lkdGggPSBsaW5lV2lkdGggfHwgMDtcbiAgICB0aGlzLmxpbmVDb2xvciA9IGNvbG9yIHx8IDA7XG4gICAgdGhpcy5saW5lQWxwaGEgPSAoYXJndW1lbnRzLmxlbmd0aCA8IDMpID8gMSA6IGFscGhhO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsIGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvciwgbGluZUFscGhhOnRoaXMubGluZUFscGhhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLCBmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsIGZpbGw6dGhpcy5maWxsaW5nLCBwb2ludHM6W10sIHR5cGU6IEdyYXBoaWNzLlBPTFl9O1xuXG4gICAgdGhpcy5ncmFwaGljc0RhdGEucHVzaCh0aGlzLmN1cnJlbnRQYXRoKTtcbn07XG5cbi8qKlxuICogTW92ZXMgdGhlIGN1cnJlbnQgZHJhd2luZyBwb3NpdGlvbiB0byAoeCwgeSkuXG4gKlxuICogQG1ldGhvZCBtb3ZlVG9cbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IHRoZSBYIGNvb3JkIHRvIG1vdmUgdG9cbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IHRoZSBZIGNvb3JkIHRvIG1vdmUgdG9cbiAqL1xucHJvdG8ubW92ZVRvID0gZnVuY3Rpb24gbW92ZVRvKHgsIHkpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHRoaXMuY3VycmVudFBhdGggPSB7bGluZVdpZHRoOnRoaXMubGluZVdpZHRoLCBsaW5lQ29sb3I6dGhpcy5saW5lQ29sb3IsIGxpbmVBbHBoYTp0aGlzLmxpbmVBbHBoYSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGxDb2xvcjp0aGlzLmZpbGxDb2xvciwgZmlsbEFscGhhOnRoaXMuZmlsbEFscGhhLCBmaWxsOnRoaXMuZmlsbGluZywgcG9pbnRzOltdLCB0eXBlOiBHcmFwaGljcy5QT0xZfTtcblxuICAgIHRoaXMuY3VycmVudFBhdGgucG9pbnRzLnB1c2goeCwgeSk7XG5cbiAgICB0aGlzLmdyYXBoaWNzRGF0YS5wdXNoKHRoaXMuY3VycmVudFBhdGgpO1xufTtcblxuLyoqXG4gKiBEcmF3cyBhIGxpbmUgdXNpbmcgdGhlIGN1cnJlbnQgbGluZSBzdHlsZSBmcm9tIHRoZSBjdXJyZW50IGRyYXdpbmcgcG9zaXRpb24gdG8gKHgsIHkpO1xuICogdGhlIGN1cnJlbnQgZHJhd2luZyBwb3NpdGlvbiBpcyB0aGVuIHNldCB0byAoeCwgeSkuXG4gKlxuICogQG1ldGhvZCBsaW5lVG9cbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IHRoZSBYIGNvb3JkIHRvIGRyYXcgdG9cbiAqIEBwYXJhbSB5IHtOdW1iZXJ9IHRoZSBZIGNvb3JkIHRvIGRyYXcgdG9cbiAqL1xucHJvdG8ubGluZVRvID0gZnVuY3Rpb24gbGluZVRvKHgsIHkpXG57XG4gICAgdGhpcy5jdXJyZW50UGF0aC5wb2ludHMucHVzaCh4LCB5KTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogU3BlY2lmaWVzIGEgc2ltcGxlIG9uZS1jb2xvciBmaWxsIHRoYXQgc3Vic2VxdWVudCBjYWxscyB0byBvdGhlciBHcmFwaGljcyBtZXRob2RzXG4gKiAoc3VjaCBhcyBsaW5lVG8oKSBvciBkcmF3Q2lyY2xlKCkpIHVzZSB3aGVuIGRyYXdpbmcuXG4gKlxuICogQG1ldGhvZCBiZWdpbkZpbGxcbiAqIEBwYXJhbSBjb2xvciB7dWludH0gdGhlIGNvbG9yIG9mIHRoZSBmaWxsXG4gKiBAcGFyYW0gYWxwaGEge051bWJlcn0gdGhlIGFscGhhXG4gKi9cbnByb3RvLmJlZ2luRmlsbCA9IGZ1bmN0aW9uIGJlZ2luRmlsbChjb2xvciwgYWxwaGEpXG57XG4gICAgdGhpcy5maWxsaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmZpbGxDb2xvciA9IGNvbG9yIHx8IDA7XG4gICAgdGhpcy5maWxsQWxwaGEgPSAoYXJndW1lbnRzLmxlbmd0aCA8IDIpID8gMSA6IGFscGhhO1xufTtcblxuLyoqXG4gKiBBcHBsaWVzIGEgZmlsbCB0byB0aGUgbGluZXMgYW5kIHNoYXBlcyB0aGF0IHdlcmUgYWRkZWQgc2luY2UgdGhlIGxhc3QgY2FsbCB0byB0aGUgYmVnaW5GaWxsKCkgbWV0aG9kLlxuICpcbiAqIEBtZXRob2QgZW5kRmlsbFxuICovXG5wcm90by5lbmRGaWxsID0gZnVuY3Rpb24gZW5kRmlsbCgpXG57XG4gICAgdGhpcy5maWxsaW5nID0gZmFsc2U7XG4gICAgdGhpcy5maWxsQ29sb3IgPSBudWxsO1xuICAgIHRoaXMuZmlsbEFscGhhID0gMTtcbn07XG5cbi8qKlxuICogQG1ldGhvZCBkcmF3UmVjdFxuICpcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSB0b3AtbGVmdCBvZiB0aGUgcmVjdGFuZ2xlXG4gKiBAcGFyYW0geSB7TnVtYmVyfSBUaGUgWSBjb29yZCBvZiB0aGUgdG9wLWxlZnQgb2YgdGhlIHJlY3RhbmdsZVxuICogQHBhcmFtIHdpZHRoIHtOdW1iZXJ9IFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlXG4gKiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9IFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZVxuICovXG5wcm90by5kcmF3UmVjdCA9IGZ1bmN0aW9uIGRyYXdSZWN0KHgsIHksIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsIGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvciwgbGluZUFscGhhOnRoaXMubGluZUFscGhhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLCBmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsIGZpbGw6dGhpcy5maWxsaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRzOlt4LCB5LCB3aWR0aCwgaGVpZ2h0XSwgdHlwZTogR3JhcGhpY3MuUkVDVH07XG5cbiAgICB0aGlzLmdyYXBoaWNzRGF0YS5wdXNoKHRoaXMuY3VycmVudFBhdGgpO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBEcmF3cyBhIGNpcmNsZS5cbiAqXG4gKiBAbWV0aG9kIGRyYXdDaXJjbGVcbiAqIEBwYXJhbSB4IHtOdW1iZXJ9IFRoZSBYIGNvb3JkIG9mIHRoZSBjZW50ZXIgb2YgdGhlIGNpcmNsZVxuICogQHBhcmFtIHkge051bWJlcn0gVGhlIFkgY29vcmQgb2YgdGhlIGNlbnRlciBvZiB0aGUgY2lyY2xlXG4gKiBAcGFyYW0gcmFkaXVzIHtOdW1iZXJ9IFRoZSByYWRpdXMgb2YgdGhlIGNpcmNsZVxuICovXG5wcm90by5kcmF3Q2lyY2xlID0gZnVuY3Rpb24gZHJhd0NpcmNsZSh4LCB5LCByYWRpdXMpXG57XG4gICAgaWYgKCF0aGlzLmN1cnJlbnRQYXRoLnBvaW50cy5sZW5ndGgpIHRoaXMuZ3JhcGhpY3NEYXRhLnBvcCgpO1xuXG4gICAgdGhpcy5jdXJyZW50UGF0aCA9IHtsaW5lV2lkdGg6dGhpcy5saW5lV2lkdGgsIGxpbmVDb2xvcjp0aGlzLmxpbmVDb2xvciwgbGluZUFscGhhOnRoaXMubGluZUFscGhhLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsbENvbG9yOnRoaXMuZmlsbENvbG9yLCBmaWxsQWxwaGE6dGhpcy5maWxsQWxwaGEsIGZpbGw6dGhpcy5maWxsaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9pbnRzOlt4LCB5LCByYWRpdXMsIHJhZGl1c10sIHR5cGU6IEdyYXBoaWNzLkNJUkN9O1xuXG4gICAgdGhpcy5ncmFwaGljc0RhdGEucHVzaCh0aGlzLmN1cnJlbnRQYXRoKTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogRHJhd3MgYW4gZWxsaXBzZS5cbiAqXG4gKiBAbWV0aG9kIGRyYXdFbGxpcHNlXG4gKiBAcGFyYW0geCB7TnVtYmVyfVxuICogQHBhcmFtIHkge051bWJlcn1cbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfVxuICogQHBhcmFtIGhlaWdodCB7TnVtYmVyfVxuICovXG5wcm90by5kcmF3RWxpcHNlID0gZnVuY3Rpb24gZHJhd0VsaXBzZSh4LCB5LCB3aWR0aCwgaGVpZ2h0KVxue1xuICAgIGlmICghdGhpcy5jdXJyZW50UGF0aC5wb2ludHMubGVuZ3RoKSB0aGlzLmdyYXBoaWNzRGF0YS5wb3AoKTtcblxuICAgIHRoaXMuY3VycmVudFBhdGggPSB7bGluZVdpZHRoOnRoaXMubGluZVdpZHRoLCBsaW5lQ29sb3I6dGhpcy5saW5lQ29sb3IsIGxpbmVBbHBoYTp0aGlzLmxpbmVBbHBoYSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGxDb2xvcjp0aGlzLmZpbGxDb2xvciwgZmlsbEFscGhhOnRoaXMuZmlsbEFscGhhLCBmaWxsOnRoaXMuZmlsbGluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvaW50czpbeCwgeSwgd2lkdGgsIGhlaWdodF0sIHR5cGU6IEdyYXBoaWNzLkVMSVB9O1xuXG4gICAgdGhpcy5ncmFwaGljc0RhdGEucHVzaCh0aGlzLmN1cnJlbnRQYXRoKTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogQ2xlYXJzIHRoZSBncmFwaGljcyB0aGF0IHdlcmUgZHJhd24gdG8gdGhpcyBHcmFwaGljcyBvYmplY3QsIGFuZCByZXNldHMgZmlsbCBhbmQgbGluZSBzdHlsZSBzZXR0aW5ncy5cbiAqXG4gKiBAbWV0aG9kIGNsZWFyXG4gKi9cbnByb3RvLmNsZWFyID0gZnVuY3Rpb24gY2xlYXIoKVxue1xuICAgIHRoaXMubGluZVdpZHRoID0gMDtcbiAgICB0aGlzLmZpbGxpbmcgPSBmYWxzZTtcblxuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuICAgIHRoaXMuY2xlYXJEaXJ0eSA9IHRydWU7XG4gICAgdGhpcy5ncmFwaGljc0RhdGEgPSBbXTtcblxuICAgIHRoaXMuYm91bmRzID0gbnVsbDsgLy9uZXcgUmVjdGFuZ2xlKCk7XG59O1xuXG5cbnByb3RvLnVwZGF0ZUZpbHRlckJvdW5kcyA9IGZ1bmN0aW9uIHVwZGF0ZUZpbHRlckJvdW5kcygpXG57XG4gICAgaWYoIXRoaXMuYm91bmRzKVxuICAgIHtcbiAgICAgICAgdmFyIG1pblggPSBJbmZpbml0eTtcbiAgICAgICAgdmFyIG1heFggPSAtSW5maW5pdHk7XG5cbiAgICAgICAgdmFyIG1pblkgPSBJbmZpbml0eTtcbiAgICAgICAgdmFyIG1heFkgPSAtSW5maW5pdHk7XG5cbiAgICAgICAgdmFyIHBvaW50cywgeCwgeTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuZ3JhcGhpY3NEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IHRoaXMuZ3JhcGhpY3NEYXRhW2ldO1xuICAgICAgICAgICAgdmFyIHR5cGUgPSBkYXRhLnR5cGU7XG4gICAgICAgICAgICB2YXIgbGluZVdpZHRoID0gZGF0YS5saW5lV2lkdGg7XG5cbiAgICAgICAgICAgIHBvaW50cyA9IGRhdGEucG9pbnRzO1xuXG4gICAgICAgICAgICBpZih0eXBlID09PSBHcmFwaGljcy5SRUNUKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHggPSBwb2ludHMueCAtIGxpbmVXaWR0aC8yO1xuICAgICAgICAgICAgICAgIHkgPSBwb2ludHMueSAtIGxpbmVXaWR0aC8yO1xuICAgICAgICAgICAgICAgIHZhciB3aWR0aCA9IHBvaW50cy53aWR0aCArIGxpbmVXaWR0aDtcbiAgICAgICAgICAgICAgICB2YXIgaGVpZ2h0ID0gcG9pbnRzLmhlaWdodCArIGxpbmVXaWR0aDtcblxuICAgICAgICAgICAgICAgIG1pblggPSB4IDwgbWluWCA/IHggOiBtaW5YO1xuICAgICAgICAgICAgICAgIG1heFggPSB4ICsgd2lkdGggPiBtYXhYID8geCArIHdpZHRoIDogbWF4WDtcblxuICAgICAgICAgICAgICAgIG1pblkgPSB5IDwgbWluWSA/IHggOiBtaW5ZO1xuICAgICAgICAgICAgICAgIG1heFkgPSB5ICsgaGVpZ2h0ID4gbWF4WSA/IHkgKyBoZWlnaHQgOiBtYXhZO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0eXBlID09PSBHcmFwaGljcy5DSVJDIHx8IHR5cGUgPT09IEdyYXBoaWNzLkVMSVApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgeCA9IHBvaW50cy54O1xuICAgICAgICAgICAgICAgIHkgPSBwb2ludHMueTtcbiAgICAgICAgICAgICAgICB2YXIgcmFkaXVzID0gcG9pbnRzLnJhZGl1cyArIGxpbmVXaWR0aC8yO1xuXG4gICAgICAgICAgICAgICAgbWluWCA9IHggLSByYWRpdXMgPCBtaW5YID8geCAtIHJhZGl1cyA6IG1pblg7XG4gICAgICAgICAgICAgICAgbWF4WCA9IHggKyByYWRpdXMgPiBtYXhYID8geCArIHJhZGl1cyA6IG1heFg7XG5cbiAgICAgICAgICAgICAgICBtaW5ZID0geSAtIHJhZGl1cyA8IG1pblkgPyB5IC0gcmFkaXVzIDogbWluWTtcbiAgICAgICAgICAgICAgICBtYXhZID0geSArIHJhZGl1cyA+IG1heFkgPyB5ICsgcmFkaXVzIDogbWF4WTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBQT0xZXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBwb2ludHMubGVuZ3RoOyBqKz0yKVxuICAgICAgICAgICAgICAgIHtcblxuICAgICAgICAgICAgICAgICAgICB4ID0gcG9pbnRzW2pdO1xuICAgICAgICAgICAgICAgICAgICB5ID0gcG9pbnRzW2orMV07XG5cbiAgICAgICAgICAgICAgICAgICAgbWluWCA9IHgtbGluZVdpZHRoIDwgbWluWCA/IHgtbGluZVdpZHRoIDogbWluWDtcbiAgICAgICAgICAgICAgICAgICAgbWF4WCA9IHgrbGluZVdpZHRoID4gbWF4WCA/IHgrbGluZVdpZHRoIDogbWF4WDtcblxuICAgICAgICAgICAgICAgICAgICBtaW5ZID0geS1saW5lV2lkdGggPCBtaW5ZID8geS1saW5lV2lkdGggOiBtaW5ZO1xuICAgICAgICAgICAgICAgICAgICBtYXhZID0geStsaW5lV2lkdGggPiBtYXhZID8geStsaW5lV2lkdGggOiBtYXhZO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYm91bmRzID0gbmV3IFJlY3RhbmdsZShtaW5YLCBtaW5ZLCBtYXhYIC0gbWluWCwgbWF4WSAtIG1pblkpO1xuICAgIH1cbi8vICBjb25zb2xlLmxvZyh0aGlzLmJvdW5kcyk7XG59O1xuXG4vLyBTT01FIFRZUEVTOlxuR3JhcGhpY3MuUE9MWSA9IDA7XG5HcmFwaGljcy5SRUNUID0gMTtcbkdyYXBoaWNzLkNJUkMgPSAyO1xuR3JhcGhpY3MuRUxJUCA9IDM7XG5cbm1vZHVsZS5leHBvcnRzID0gR3JhcGhpY3M7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwbGF0Zm9ybSA9IHJlcXVpcmUoJy4uLy4uL3BsYXRmb3JtJyk7XG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xuXG52YXIgY2FudmFzR3JhcGhpY3MgPSByZXF1aXJlKCcuL2dyYXBoaWNzJyk7XG52YXIgQmFzZVRleHR1cmUgPSByZXF1aXJlKCcuLi8uLi90ZXh0dXJlcy9CYXNlVGV4dHVyZScpO1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCcuLi8uLi90ZXh0dXJlcy9UZXh0dXJlJyk7XG5cbnZhciBTcHJpdGUgPSByZXF1aXJlKCcuLi8uLi9kaXNwbGF5L1Nwcml0ZScpO1xudmFyIFRpbGluZ1Nwcml0ZSA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9UaWxpbmdTcHJpdGUnKTtcbnZhciBTdHJpcCA9IHJlcXVpcmUoJy4uLy4uL2V4dHJhcy9TdHJpcCcpO1xudmFyIEN1c3RvbVJlbmRlcmFibGUgPSByZXF1aXJlKCcuLi8uLi9leHRyYXMvQ3VzdG9tUmVuZGVyYWJsZScpO1xudmFyIEdyYXBoaWNzID0gcmVxdWlyZSgnLi4vLi4vcHJpbWl0aXZlcy9HcmFwaGljcycpO1xudmFyIEZpbHRlckJsb2NrID0gcmVxdWlyZSgnLi4vLi4vZmlsdGVycy9GaWx0ZXJCbG9jaycpO1xuXG4vKipcbiAqIHRoZSBDYW52YXNSZW5kZXJlciBkcmF3cyB0aGUgc3RhZ2UgYW5kIGFsbCBpdHMgY29udGVudCBvbnRvIGEgMmQgY2FudmFzLiBUaGlzIHJlbmRlcmVyIHNob3VsZCBiZSB1c2VkIGZvciBicm93c2VycyB0aGF0IGRvIG5vdCBzdXBwb3J0IHdlYkdMLlxuICogRG9udCBmb3JnZXQgdG8gYWRkIHRoZSB2aWV3IHRvIHlvdXIgRE9NIG9yIHlvdSB3aWxsIG5vdCBzZWUgYW55dGhpbmcgOilcbiAqXG4gKiBAY2xhc3MgQ2FudmFzUmVuZGVyZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHdpZHRoPTAge051bWJlcn0gdGhlIHdpZHRoIG9mIHRoZSBjYW52YXMgdmlld1xuICogQHBhcmFtIGhlaWdodD0wIHtOdW1iZXJ9IHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyB2aWV3XG4gKiBAcGFyYW0gdmlldyB7Q2FudmFzfSB0aGUgY2FudmFzIHRvIHVzZSBhcyBhIHZpZXcsIG9wdGlvbmFsXG4gKiBAcGFyYW0gdHJhbnNwYXJlbnQ9ZmFsc2Uge0Jvb2xlYW59IHRoZSB0cmFuc3BhcmVuY3kgb2YgdGhlIHJlbmRlciB2aWV3LCBkZWZhdWx0IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIENhbnZhc1JlbmRlcmVyKHdpZHRoLCBoZWlnaHQsIHZpZXcsIHRyYW5zcGFyZW50KVxue1xuICAgIHRoaXMudHJhbnNwYXJlbnQgPSB0cmFuc3BhcmVudDtcblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgY2FudmFzIHZpZXdcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDgwMFxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSB3aWR0aCB8fCA4MDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBjYW52YXMgdmlld1xuICAgICAqXG4gICAgICogQHByb3BlcnR5IGhlaWdodFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEBkZWZhdWx0IDYwMFxuICAgICAqL1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0IHx8IDYwMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjYW52YXMgZWxlbWVudCB0aGF0IHRoZSBldmVyeXRoaW5nIGlzIGRyYXduIHRvXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdmlld1xuICAgICAqIEB0eXBlIENhbnZhc1xuICAgICAqL1xuICAgIHRoaXMudmlldyA9IHZpZXcgfHwgcGxhdGZvcm0uY3JlYXRlQ2FudmFzKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY2FudmFzIGNvbnRleHQgdGhhdCB0aGUgZXZlcnl0aGluZyBpcyBkcmF3biB0b1xuICAgICAqIEBwcm9wZXJ0eSBjb250ZXh0XG4gICAgICogQHR5cGUgQ2FudmFzIDJkIENvbnRleHRcbiAgICAgKi9cbiAgICB0aGlzLmNvbnRleHQgPSB0aGlzLnZpZXcuZ2V0Q29udGV4dCggJzJkJyApO1xuXG4gICAgLy9zb21lIGZpbHRlciB2YXJpYWJsZXNcbiAgICB0aGlzLnNtb290aFByb3BlcnR5ID0gbnVsbDtcblxuICAgIGlmKCdpbWFnZVNtb290aGluZ0VuYWJsZWQnIGluIHRoaXMuY29udGV4dClcbiAgICAgICAgdGhpcy5zbW9vdGhQcm9wZXJ0eSA9ICdpbWFnZVNtb290aGluZ0VuYWJsZWQnO1xuICAgIGVsc2UgaWYoJ3dlYmtpdEltYWdlU21vb3RoaW5nRW5hYmxlZCcgaW4gdGhpcy5jb250ZXh0KVxuICAgICAgICB0aGlzLnNtb290aFByb3BlcnR5ID0gJ3dlYmtpdEltYWdlU21vb3RoaW5nRW5hYmxlZCc7XG4gICAgZWxzZSBpZignbW96SW1hZ2VTbW9vdGhpbmdFbmFibGVkJyBpbiB0aGlzLmNvbnRleHQpXG4gICAgICAgIHRoaXMuc21vb3RoUHJvcGVydHkgPSAnbW96SW1hZ2VTbW9vdGhpbmdFbmFibGVkJztcbiAgICBlbHNlIGlmKCdvSW1hZ2VTbW9vdGhpbmdFbmFibGVkJyBpbiB0aGlzLmNvbnRleHQpXG4gICAgICAgIHRoaXMuc21vb3RoUHJvcGVydHkgPSAnb0ltYWdlU21vb3RoaW5nRW5hYmxlZCc7XG5cbiAgICB0aGlzLnNjYWxlTW9kZSA9IG51bGw7XG5cbiAgICB0aGlzLnJlZnJlc2ggPSB0cnVlO1xuICAgIC8vIGhhY2sgdG8gZW5hYmxlIHNvbWUgaGFyZHdhcmUgYWNjZWxlcmF0aW9uIVxuICAgIC8vdGhpcy52aWV3LnN0eWxlW1widHJhbnNmb3JtXCJdID0gXCJ0cmFuc2xhdGV6KDApXCI7XG5cbiAgICB0aGlzLnZpZXcud2lkdGggPSB0aGlzLndpZHRoO1xuICAgIHRoaXMudmlldy5oZWlnaHQgPSB0aGlzLmhlaWdodDtcbiAgICB0aGlzLmNvdW50ID0gMDtcbn1cblxudmFyIHByb3RvID0gQ2FudmFzUmVuZGVyZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIFJlbmRlcnMgdGhlIHN0YWdlIHRvIGl0cyBjYW52YXMgdmlld1xuICpcbiAqIEBtZXRob2QgcmVuZGVyXG4gKiBAcGFyYW0gc3RhZ2Uge1N0YWdlfSB0aGUgU3RhZ2UgZWxlbWVudCB0byBiZSByZW5kZXJlZFxuICovXG5wcm90by5yZW5kZXIgPSBmdW5jdGlvbiByZW5kZXIoc3RhZ2UpXG57XG4gICAgLy9zdGFnZS5fX2NoaWxkcmVuQWRkZWQgPSBbXTtcbiAgICAvL3N0YWdlLl9fY2hpbGRyZW5SZW1vdmVkID0gW107XG5cbiAgICAvLyB1cGRhdGUgdGV4dHVyZXMgaWYgbmVlZCBiZVxuICAgIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZSA9IFtdO1xuICAgIGdsb2JhbHMudGV4dHVyZXNUb0Rlc3Ryb3kgPSBbXTtcblxuICAgIGdsb2JhbHMudmlzaWJsZUNvdW50Kys7XG4gICAgc3RhZ2UudXBkYXRlVHJhbnNmb3JtKCk7XG5cbiAgICAvLyB1cGRhdGUgdGhlIGJhY2tncm91bmQgY29sb3JcbiAgICBpZih0aGlzLnZpZXcuc3R5bGUuYmFja2dyb3VuZENvbG9yICE9PSBzdGFnZS5iYWNrZ3JvdW5kQ29sb3JTdHJpbmcgJiYgIXRoaXMudHJhbnNwYXJlbnQpXG4gICAgICAgIHRoaXMudmlldy5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBzdGFnZS5iYWNrZ3JvdW5kQ29sb3JTdHJpbmc7XG5cbiAgICB0aGlzLmNvbnRleHQuc2V0VHJhbnNmb3JtKDEsMCwwLDEsMCwwKTtcbiAgICB0aGlzLmNvbnRleHQuY2xlYXJSZWN0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgICB0aGlzLnJlbmRlckRpc3BsYXlPYmplY3Qoc3RhZ2UpO1xuICAgIC8vYXNcblxuICAgIC8vIHJ1biBpbnRlcmFjdGlvbiFcbiAgICBpZihzdGFnZS5pbnRlcmFjdGl2ZSlcbiAgICB7XG4gICAgICAgIC8vbmVlZCB0byBhZGQgc29tZSBldmVudHMhXG4gICAgICAgIGlmKCFzdGFnZS5faW50ZXJhY3RpdmVFdmVudHNBZGRlZClcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhZ2UuX2ludGVyYWN0aXZlRXZlbnRzQWRkZWQgPSB0cnVlO1xuICAgICAgICAgICAgc3RhZ2UuaW50ZXJhY3Rpb25NYW5hZ2VyLnNldFRhcmdldCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlbW92ZSBmcmFtZSB1cGRhdGVzLi5cbiAgICBpZihUZXh0dXJlLmZyYW1lVXBkYXRlcy5sZW5ndGggPiAwKVxuICAgIHtcbiAgICAgICAgVGV4dHVyZS5mcmFtZVVwZGF0ZXMgPSBbXTtcbiAgICB9XG59O1xuXG4vKipcbiAqIHJlc2l6ZXMgdGhlIGNhbnZhcyB2aWV3IHRvIHRoZSBzcGVjaWZpZWQgd2lkdGggYW5kIGhlaWdodFxuICpcbiAqIEBtZXRob2QgcmVzaXplXG4gKiBAcGFyYW0gd2lkdGgge051bWJlcn0gdGhlIG5ldyB3aWR0aCBvZiB0aGUgY2FudmFzIHZpZXdcbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn0gdGhlIG5ldyBoZWlnaHQgb2YgdGhlIGNhbnZhcyB2aWV3XG4gKi9cbnByb3RvLnJlc2l6ZSA9IGZ1bmN0aW9uIHJlc2l6ZSh3aWR0aCwgaGVpZ2h0KVxue1xuICAgIHRoaXMud2lkdGggPSB3aWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuICAgIHRoaXMudmlldy53aWR0aCA9IHdpZHRoO1xuICAgIHRoaXMudmlldy5oZWlnaHQgPSBoZWlnaHQ7XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgYSBkaXNwbGF5IG9iamVjdFxuICpcbiAqIEBtZXRob2QgcmVuZGVyRGlzcGxheU9iamVjdFxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9IFRoZSBkaXNwbGF5T2JqZWN0IHRvIHJlbmRlclxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyRGlzcGxheU9iamVjdCA9IGZ1bmN0aW9uIHJlbmRlckRpc3BsYXlPYmplY3QoZGlzcGxheU9iamVjdClcbntcbiAgICAvLyBubyBsb2dlciByZWN1cnJzaXZlIVxuICAgIHZhciB0cmFuc2Zvcm07XG4gICAgdmFyIGNvbnRleHQgPSB0aGlzLmNvbnRleHQ7XG5cbiAgICBjb250ZXh0Lmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9ICdzb3VyY2Utb3Zlcic7XG5cbiAgICAvLyBvbmUgdGhlIGRpc3BsYXkgb2JqZWN0IGhpdHMgdGhpcy4gd2UgY2FuIGJyZWFrIHRoZSBsb29wXG4gICAgdmFyIHRlc3RPYmplY3QgPSBkaXNwbGF5T2JqZWN0Lmxhc3QuX2lOZXh0O1xuICAgIGRpc3BsYXlPYmplY3QgPSBkaXNwbGF5T2JqZWN0LmZpcnN0O1xuXG4gICAgZG9cbiAgICB7XG4gICAgICAgIHRyYW5zZm9ybSA9IGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm07XG5cbiAgICAgICAgaWYoIWRpc3BsYXlPYmplY3QudmlzaWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgZGlzcGxheU9iamVjdCA9IGRpc3BsYXlPYmplY3QubGFzdC5faU5leHQ7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCFkaXNwbGF5T2JqZWN0LnJlbmRlcmFibGUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGRpc3BsYXlPYmplY3QgPSBkaXNwbGF5T2JqZWN0Ll9pTmV4dDtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICAgICAge1xuXG4gICAgICAgICAgICB2YXIgZnJhbWUgPSBkaXNwbGF5T2JqZWN0LnRleHR1cmUuZnJhbWU7XG5cbiAgICAgICAgICAgIC8vaWdub3JlIG51bGwgc291cmNlc1xuICAgICAgICAgICAgaWYoZnJhbWUgJiYgZnJhbWUud2lkdGggJiYgZnJhbWUuaGVpZ2h0ICYmIGRpc3BsYXlPYmplY3QudGV4dHVyZS5iYXNlVGV4dHVyZS5zb3VyY2UpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRpc3BsYXlPYmplY3Qud29ybGRBbHBoYTtcblxuICAgICAgICAgICAgICAgIGNvbnRleHQuc2V0VHJhbnNmb3JtKHRyYW5zZm9ybVswXSwgdHJhbnNmb3JtWzNdLCB0cmFuc2Zvcm1bMV0sIHRyYW5zZm9ybVs0XSwgdHJhbnNmb3JtWzJdLCB0cmFuc2Zvcm1bNV0pO1xuXG4gICAgICAgICAgICAgICAgLy9pZiBzbW9vdGhpbmdFbmFibGVkIGlzIHN1cHBvcnRlZCBhbmQgd2UgbmVlZCB0byBjaGFuZ2UgdGhlIHNtb290aGluZyBwcm9wZXJ0eSBmb3IgdGhpcyB0ZXh0dXJlXG4gICAgICAgICAgICAgICAgaWYodGhpcy5zbW9vdGhQcm9wZXJ0eSAmJiB0aGlzLnNjYWxlTW9kZSAhPT0gZGlzcGxheU9iamVjdC50ZXh0dXJlLmJhc2VUZXh0dXJlLnNjYWxlTW9kZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNjYWxlTW9kZSA9IGRpc3BsYXlPYmplY3QudGV4dHVyZS5iYXNlVGV4dHVyZS5zY2FsZU1vZGU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHRbdGhpcy5zbW9vdGhQcm9wZXJ0eV0gPSAodGhpcy5zY2FsZU1vZGUgPT09IEJhc2VUZXh0dXJlLlNDQUxFX01PREUuTElORUFSKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShkaXNwbGF5T2JqZWN0LnRleHR1cmUuYmFzZVRleHR1cmUuc291cmNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZS54LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZS55LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZS53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWUuaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGlzcGxheU9iamVjdC5hbmNob3IueCkgKiAtZnJhbWUud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkaXNwbGF5T2JqZWN0LmFuY2hvci55KSAqIC1mcmFtZS5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZS5oZWlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIFN0cmlwKVxuICAgICAgICB7XG4gICAgICAgICAgICBjb250ZXh0LnNldFRyYW5zZm9ybSh0cmFuc2Zvcm1bMF0sIHRyYW5zZm9ybVszXSwgdHJhbnNmb3JtWzFdLCB0cmFuc2Zvcm1bNF0sIHRyYW5zZm9ybVsyXSwgdHJhbnNmb3JtWzVdKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyU3RyaXAoZGlzcGxheU9iamVjdCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgVGlsaW5nU3ByaXRlKVxuICAgICAgICB7XG4gICAgICAgICAgICBjb250ZXh0LnNldFRyYW5zZm9ybSh0cmFuc2Zvcm1bMF0sIHRyYW5zZm9ybVszXSwgdHJhbnNmb3JtWzFdLCB0cmFuc2Zvcm1bNF0sIHRyYW5zZm9ybVsyXSwgdHJhbnNmb3JtWzVdKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGlsaW5nU3ByaXRlKGRpc3BsYXlPYmplY3QpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIEN1c3RvbVJlbmRlcmFibGUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2V0VHJhbnNmb3JtKHRyYW5zZm9ybVswXSwgdHJhbnNmb3JtWzNdLCB0cmFuc2Zvcm1bMV0sIHRyYW5zZm9ybVs0XSwgdHJhbnNmb3JtWzJdLCB0cmFuc2Zvcm1bNV0pO1xuICAgICAgICAgICAgZGlzcGxheU9iamVjdC5yZW5kZXJDYW52YXModGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgR3JhcGhpY3MpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2V0VHJhbnNmb3JtKHRyYW5zZm9ybVswXSwgdHJhbnNmb3JtWzNdLCB0cmFuc2Zvcm1bMV0sIHRyYW5zZm9ybVs0XSwgdHJhbnNmb3JtWzJdLCB0cmFuc2Zvcm1bNV0pO1xuICAgICAgICAgICAgY2FudmFzR3JhcGhpY3MucmVuZGVyR3JhcGhpY3MoZGlzcGxheU9iamVjdCwgY29udGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgRmlsdGVyQmxvY2spXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKGRpc3BsYXlPYmplY3QuZGF0YSBpbnN0YW5jZW9mIEdyYXBoaWNzKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHZhciBtYXNrID0gZGlzcGxheU9iamVjdC5kYXRhO1xuXG4gICAgICAgICAgICAgICAgaWYoZGlzcGxheU9iamVjdC5vcGVuKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC5zYXZlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGNhY2hlQWxwaGEgPSBtYXNrLmFscGhhO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWFza1RyYW5zZm9ybSA9IG1hc2sud29ybGRUcmFuc2Zvcm07XG5cbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC5zZXRUcmFuc2Zvcm0obWFza1RyYW5zZm9ybVswXSwgbWFza1RyYW5zZm9ybVszXSwgbWFza1RyYW5zZm9ybVsxXSwgbWFza1RyYW5zZm9ybVs0XSwgbWFza1RyYW5zZm9ybVsyXSwgbWFza1RyYW5zZm9ybVs1XSk7XG5cbiAgICAgICAgICAgICAgICAgICAgbWFzay53b3JsZEFscGhhID0gMC41O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQud29ybGRBbHBoYSA9IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FudmFzR3JhcGhpY3MucmVuZGVyR3JhcGhpY3NNYXNrKG1hc2ssIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmNsaXAoKTtcblxuICAgICAgICAgICAgICAgICAgICBtYXNrLndvcmxkQWxwaGEgPSBjYWNoZUFscGhhO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnJlc3RvcmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9jb3VudCsrXG4gICAgICAgIGRpc3BsYXlPYmplY3QgPSBkaXNwbGF5T2JqZWN0Ll9pTmV4dDtcbiAgICB9XG4gICAgd2hpbGUoZGlzcGxheU9iamVjdCAhPT0gdGVzdE9iamVjdCk7XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgYSBmbGF0IHN0cmlwXG4gKlxuICogQG1ldGhvZCByZW5kZXJTdHJpcEZsYXRcbiAqIEBwYXJhbSBzdHJpcCB7U3RyaXB9IFRoZSBTdHJpcCB0byByZW5kZXJcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbmRlclN0cmlwRmxhdCA9IGZ1bmN0aW9uIHJlbmRlclN0cmlwRmxhdChzdHJpcClcbntcbiAgICB2YXIgY29udGV4dCA9IHRoaXMuY29udGV4dDtcbiAgICB2YXIgdmVydGljaWVzID0gc3RyaXAudmVydGljaWVzO1xuXG4gICAgdmFyIGxlbmd0aCA9IHZlcnRpY2llcy5sZW5ndGgvMjtcbiAgICB0aGlzLmNvdW50Kys7XG5cbiAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuICAgIGZvciAodmFyIGk9MTsgaSA8IGxlbmd0aC0yOyBpKyspXG4gICAge1xuICAgICAgICAvLyBkcmF3IHNvbWUgdHJpYW5nbGVzIVxuICAgICAgICB2YXIgaW5kZXggPSBpKjI7XG5cbiAgICAgICAgdmFyIHgwID0gdmVydGljaWVzW2luZGV4XSwgICB4MSA9IHZlcnRpY2llc1tpbmRleCsyXSwgeDIgPSB2ZXJ0aWNpZXNbaW5kZXgrNF07XG4gICAgICAgIHZhciB5MCA9IHZlcnRpY2llc1tpbmRleCsxXSwgeTEgPSB2ZXJ0aWNpZXNbaW5kZXgrM10sIHkyID0gdmVydGljaWVzW2luZGV4KzVdO1xuXG4gICAgICAgIGNvbnRleHQubW92ZVRvKHgwLCB5MCk7XG4gICAgICAgIGNvbnRleHQubGluZVRvKHgxLCB5MSk7XG4gICAgICAgIGNvbnRleHQubGluZVRvKHgyLCB5Mik7XG4gICAgfVxuXG4gICAgY29udGV4dC5maWxsU3R5bGUgPSAnI0ZGMDAwMCc7XG4gICAgY29udGV4dC5maWxsKCk7XG4gICAgY29udGV4dC5jbG9zZVBhdGgoKTtcbn07XG5cbi8qKlxuICogUmVuZGVycyBhIHRpbGluZyBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIHJlbmRlclRpbGluZ1Nwcml0ZVxuICogQHBhcmFtIHNwcml0ZSB7VGlsaW5nU3ByaXRlfSBUaGUgdGlsaW5nc3ByaXRlIHRvIHJlbmRlclxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyVGlsaW5nU3ByaXRlID0gZnVuY3Rpb24gcmVuZGVyVGlsaW5nU3ByaXRlKHNwcml0ZSlcbntcbiAgICB2YXIgY29udGV4dCA9IHRoaXMuY29udGV4dDtcblxuICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBzcHJpdGUud29ybGRBbHBoYTtcblxuICAgIGlmKCFzcHJpdGUuX190aWxlUGF0dGVybilcbiAgICAgICAgc3ByaXRlLl9fdGlsZVBhdHRlcm4gPSBjb250ZXh0LmNyZWF0ZVBhdHRlcm4oc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUuc291cmNlLCAncmVwZWF0Jyk7XG5cbiAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuXG4gICAgdmFyIHRpbGVQb3NpdGlvbiA9IHNwcml0ZS50aWxlUG9zaXRpb247XG4gICAgdmFyIHRpbGVTY2FsZSA9IHNwcml0ZS50aWxlU2NhbGU7XG5cbiAgICAvLyBvZmZzZXRcbiAgICBjb250ZXh0LnNjYWxlKHRpbGVTY2FsZS54LHRpbGVTY2FsZS55KTtcbiAgICBjb250ZXh0LnRyYW5zbGF0ZSh0aWxlUG9zaXRpb24ueCwgdGlsZVBvc2l0aW9uLnkpO1xuXG4gICAgY29udGV4dC5maWxsU3R5bGUgPSBzcHJpdGUuX190aWxlUGF0dGVybjtcbiAgICBjb250ZXh0LmZpbGxSZWN0KC10aWxlUG9zaXRpb24ueCwtdGlsZVBvc2l0aW9uLnksc3ByaXRlLndpZHRoIC8gdGlsZVNjYWxlLngsIHNwcml0ZS5oZWlnaHQgLyB0aWxlU2NhbGUueSk7XG5cbiAgICBjb250ZXh0LnNjYWxlKDEvdGlsZVNjYWxlLngsIDEvdGlsZVNjYWxlLnkpO1xuICAgIGNvbnRleHQudHJhbnNsYXRlKC10aWxlUG9zaXRpb24ueCwgLXRpbGVQb3NpdGlvbi55KTtcblxuICAgIGNvbnRleHQuY2xvc2VQYXRoKCk7XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgYSBzdHJpcFxuICpcbiAqIEBtZXRob2QgcmVuZGVyU3RyaXBcbiAqIEBwYXJhbSBzdHJpcCB7U3RyaXB9IFRoZSBTdHJpcCB0byByZW5kZXJcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbmRlclN0cmlwID0gZnVuY3Rpb24gcmVuZGVyU3RyaXAoc3RyaXApXG57XG4gICAgdmFyIGNvbnRleHQgPSB0aGlzLmNvbnRleHQ7XG5cbiAgICAvLyBkcmF3IHRyaWFuZ2xlcyEhXG4gICAgdmFyIHZlcnRpY2llcyA9IHN0cmlwLnZlcnRpY2llcztcbiAgICB2YXIgdXZzID0gc3RyaXAudXZzO1xuXG4gICAgdmFyIGxlbmd0aCA9IHZlcnRpY2llcy5sZW5ndGgvMjtcbiAgICB0aGlzLmNvdW50Kys7XG5cbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IGxlbmd0aC0yOyBpKyspXG4gICAge1xuICAgICAgICAvLyBkcmF3IHNvbWUgdHJpYW5nbGVzIVxuICAgICAgICB2YXIgaW5kZXggPSBpKjI7XG5cbiAgICAgICAgdmFyIHgwID0gdmVydGljaWVzW2luZGV4XSwgICB4MSA9IHZlcnRpY2llc1tpbmRleCsyXSwgeDIgPSB2ZXJ0aWNpZXNbaW5kZXgrNF07XG4gICAgICAgIHZhciB5MCA9IHZlcnRpY2llc1tpbmRleCsxXSwgeTEgPSB2ZXJ0aWNpZXNbaW5kZXgrM10sIHkyID0gdmVydGljaWVzW2luZGV4KzVdO1xuXG4gICAgICAgIHZhciB1MCA9IHV2c1tpbmRleF0gKiBzdHJpcC50ZXh0dXJlLndpZHRoLCAgIHUxID0gdXZzW2luZGV4KzJdICogc3RyaXAudGV4dHVyZS53aWR0aCwgdTIgPSB1dnNbaW5kZXgrNF0qIHN0cmlwLnRleHR1cmUud2lkdGg7XG4gICAgICAgIHZhciB2MCA9IHV2c1tpbmRleCsxXSogc3RyaXAudGV4dHVyZS5oZWlnaHQsIHYxID0gdXZzW2luZGV4KzNdICogc3RyaXAudGV4dHVyZS5oZWlnaHQsIHYyID0gdXZzW2luZGV4KzVdKiBzdHJpcC50ZXh0dXJlLmhlaWdodDtcblxuICAgICAgICBjb250ZXh0LnNhdmUoKTtcbiAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcbiAgICAgICAgY29udGV4dC5tb3ZlVG8oeDAsIHkwKTtcbiAgICAgICAgY29udGV4dC5saW5lVG8oeDEsIHkxKTtcbiAgICAgICAgY29udGV4dC5saW5lVG8oeDIsIHkyKTtcbiAgICAgICAgY29udGV4dC5jbG9zZVBhdGgoKTtcblxuICAgICAgICBjb250ZXh0LmNsaXAoKTtcblxuICAgICAgICAvLyBDb21wdXRlIG1hdHJpeCB0cmFuc2Zvcm1cbiAgICAgICAgdmFyIGRlbHRhID0gdTAqdjEgKyB2MCp1MiArIHUxKnYyIC0gdjEqdTIgLSB2MCp1MSAtIHUwKnYyO1xuICAgICAgICB2YXIgZGVsdGFBID0geDAqdjEgKyB2MCp4MiArIHgxKnYyIC0gdjEqeDIgLSB2MCp4MSAtIHgwKnYyO1xuICAgICAgICB2YXIgZGVsdGFCID0gdTAqeDEgKyB4MCp1MiArIHUxKngyIC0geDEqdTIgLSB4MCp1MSAtIHUwKngyO1xuICAgICAgICB2YXIgZGVsdGFDID0gdTAqdjEqeDIgKyB2MCp4MSp1MiArIHgwKnUxKnYyIC0geDAqdjEqdTIgLSB2MCp1MSp4MiAtIHUwKngxKnYyO1xuICAgICAgICB2YXIgZGVsdGFEID0geTAqdjEgKyB2MCp5MiArIHkxKnYyIC0gdjEqeTIgLSB2MCp5MSAtIHkwKnYyO1xuICAgICAgICB2YXIgZGVsdGFFID0gdTAqeTEgKyB5MCp1MiArIHUxKnkyIC0geTEqdTIgLSB5MCp1MSAtIHUwKnkyO1xuICAgICAgICB2YXIgZGVsdGFGID0gdTAqdjEqeTIgKyB2MCp5MSp1MiArIHkwKnUxKnYyIC0geTAqdjEqdTIgLSB2MCp1MSp5MiAtIHUwKnkxKnYyO1xuXG4gICAgICAgIGNvbnRleHQudHJhbnNmb3JtKGRlbHRhQSAvIGRlbHRhLCBkZWx0YUQgLyBkZWx0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWx0YUIgLyBkZWx0YSwgZGVsdGFFIC8gZGVsdGEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsdGFDIC8gZGVsdGEsIGRlbHRhRiAvIGRlbHRhKTtcblxuICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShzdHJpcC50ZXh0dXJlLmJhc2VUZXh0dXJlLnNvdXJjZSwgMCwgMCk7XG4gICAgICAgIGNvbnRleHQucmVzdG9yZSgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FudmFzUmVuZGVyZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwbGF0Zm9ybSA9IHJlcXVpcmUoJy4uLy4uL3BsYXRmb3JtJyk7XG52YXIgR3JhcGhpY3MgPSByZXF1aXJlKCcuLi8uLi9wcmltaXRpdmVzL0dyYXBoaWNzJyk7XG5cbi8qKlxuICogQSBzZXQgb2YgZnVuY3Rpb25zIHVzZWQgYnkgdGhlIGNhbnZhcyByZW5kZXJlciB0byBkcmF3IHRoZSBwcmltaXRpdmUgZ3JhcGhpY3MgZGF0YVxuICpcbiAqIEBtb2R1bGUgcmVuZGVyZXJzL2NhbnZhcy9ncmFwaGljc1xuICovXG5cbi8qXG4gKiBSZW5kZXJzIHRoZSBncmFwaGljcyBvYmplY3RcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCByZW5kZXJHcmFwaGljc1xuICogQHBhcmFtIGdyYXBoaWNzIHtHcmFwaGljc31cbiAqIEBwYXJhbSBjb250ZXh0IHtDb250ZXh0MkR9XG4gKi9cbmV4cG9ydHMucmVuZGVyR3JhcGhpY3MgPSBmdW5jdGlvbiByZW5kZXJHcmFwaGljcyhncmFwaGljcywgY29udGV4dClcbntcbiAgICB2YXIgd29ybGRBbHBoYSA9IGdyYXBoaWNzLndvcmxkQWxwaGEsXG4gICAgICAgIGNvbG9yID0gJycsXG4gICAgICAgIGRhdGEsIHBvaW50cywgaWksIGxsO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBncmFwaGljcy5ncmFwaGljc0RhdGEubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgZGF0YSA9IGdyYXBoaWNzLmdyYXBoaWNzRGF0YVtpXTtcbiAgICAgICAgcG9pbnRzID0gZGF0YS5wb2ludHM7XG5cbiAgICAgICAgY29sb3IgPSBjb250ZXh0LnN0cm9rZVN0eWxlID0gJyMnICsgKCcwMDAwMCcgKyAoIGRhdGEubGluZUNvbG9yIHwgMCkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTYpO1xuXG4gICAgICAgIGNvbnRleHQubGluZVdpZHRoID0gZGF0YS5saW5lV2lkdGg7XG5cbiAgICAgICAgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5QT0xZKVxuICAgICAgICB7XG4gICAgICAgICAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuXG4gICAgICAgICAgICBjb250ZXh0Lm1vdmVUbyhwb2ludHNbMF0sIHBvaW50c1sxXSk7XG5cbiAgICAgICAgICAgIGZvciAoaWkgPSAxLCBsbCA9IHBvaW50cy5sZW5ndGggLyAyOyBpaSA8IGxsOyBpaSsrKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQubGluZVRvKHBvaW50c1tpaSAqIDJdLCBwb2ludHNbaWkgKiAyICsgMV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGUgZmlyc3QgYW5kIGxhc3QgcG9pbnQgYXJlIHRoZSBzYW1lIGNsb3NlIHRoZSBwYXRoIC0gbXVjaCBuZWF0ZXIgOilcbiAgICAgICAgICAgIGlmKHBvaW50c1swXSA9PT0gcG9pbnRzW3BvaW50cy5sZW5ndGgtMl0gJiYgcG9pbnRzWzFdID09PSBwb2ludHNbcG9pbnRzLmxlbmd0aC0xXSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihkYXRhLmZpbGwpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRhdGEuZmlsbEFscGhhICogd29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmZpbGxTdHlsZSA9IGNvbG9yID0gJyMnICsgKCcwMDAwMCcgKyAoIGRhdGEuZmlsbENvbG9yIHwgMCkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTYpO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoZGF0YS5saW5lV2lkdGgpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRhdGEubGluZUFscGhhICogd29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LnN0cm9rZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5SRUNUKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIGlmKGRhdGEuZmlsbENvbG9yIHx8IGRhdGEuZmlsbENvbG9yID09PSAwKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBkYXRhLmZpbGxBbHBoYSAqIHdvcmxkQWxwaGE7XG4gICAgICAgICAgICAgICAgY29udGV4dC5maWxsU3R5bGUgPSBjb2xvciA9ICcjJyArICgnMDAwMDAnICsgKCBkYXRhLmZpbGxDb2xvciB8IDApLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC02KTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmZpbGxSZWN0KHBvaW50c1swXSwgcG9pbnRzWzFdLCBwb2ludHNbMl0sIHBvaW50c1szXSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKGRhdGEubGluZVdpZHRoKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBkYXRhLmxpbmVBbHBoYSAqIHdvcmxkQWxwaGE7XG4gICAgICAgICAgICAgICAgY29udGV4dC5zdHJva2VSZWN0KHBvaW50c1swXSwgcG9pbnRzWzFdLCBwb2ludHNbMl0sIHBvaW50c1szXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRhdGEudHlwZSA9PT0gR3JhcGhpY3MuQ0lSQylcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gVE9ETyAtIG5lZWQgdG8gYmUgVW5kZWZpbmVkIVxuICAgICAgICAgICAgY29udGV4dC5iZWdpblBhdGgoKTtcbiAgICAgICAgICAgIGNvbnRleHQuYXJjKHBvaW50c1swXSwgcG9pbnRzWzFdLCBwb2ludHNbMl0sMCwyKk1hdGguUEkpO1xuICAgICAgICAgICAgY29udGV4dC5jbG9zZVBhdGgoKTtcblxuICAgICAgICAgICAgaWYoZGF0YS5maWxsKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBkYXRhLmZpbGxBbHBoYSAqIHdvcmxkQWxwaGE7XG4gICAgICAgICAgICAgICAgY29udGV4dC5maWxsU3R5bGUgPSBjb2xvciA9ICcjJyArICgnMDAwMDAnICsgKCBkYXRhLmZpbGxDb2xvciB8IDApLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC02KTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmZpbGwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKGRhdGEubGluZVdpZHRoKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZ2xvYmFsQWxwaGEgPSBkYXRhLmxpbmVBbHBoYSAqIHdvcmxkQWxwaGE7XG4gICAgICAgICAgICAgICAgY29udGV4dC5zdHJva2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGRhdGEudHlwZSA9PT0gR3JhcGhpY3MuRUxJUClcbiAgICAgICAge1xuXG4gICAgICAgICAgICAvLyBlbGxpcHNlIGNvZGUgdGFrZW4gZnJvbTogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8yMTcyNzk4L2hvdy10by1kcmF3LWFuLW92YWwtaW4taHRtbDUtY2FudmFzXG5cbiAgICAgICAgICAgIHZhciBlbGxpcHNlRGF0YSA9ICBkYXRhLnBvaW50cztcblxuICAgICAgICAgICAgdmFyIHcgPSBlbGxpcHNlRGF0YVsyXSAqIDI7XG4gICAgICAgICAgICB2YXIgaCA9IGVsbGlwc2VEYXRhWzNdICogMjtcblxuICAgICAgICAgICAgdmFyIHggPSBlbGxpcHNlRGF0YVswXSAtIHcvMjtcbiAgICAgICAgICAgIHZhciB5ID0gZWxsaXBzZURhdGFbMV0gLSBoLzI7XG5cbiAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgICAgIHZhciBrYXBwYSA9IDAuNTUyMjg0OCxcbiAgICAgICAgICAgICAgICBveCA9ICh3IC8gMikgKiBrYXBwYSwgLy8gY29udHJvbCBwb2ludCBvZmZzZXQgaG9yaXpvbnRhbFxuICAgICAgICAgICAgICAgIG95ID0gKGggLyAyKSAqIGthcHBhLCAvLyBjb250cm9sIHBvaW50IG9mZnNldCB2ZXJ0aWNhbFxuICAgICAgICAgICAgICAgIHhlID0geCArIHcsICAgICAgICAgICAvLyB4LWVuZFxuICAgICAgICAgICAgICAgIHllID0geSArIGgsICAgICAgICAgICAvLyB5LWVuZFxuICAgICAgICAgICAgICAgIHhtID0geCArIHcgLyAyLCAgICAgICAvLyB4LW1pZGRsZVxuICAgICAgICAgICAgICAgIHltID0geSArIGggLyAyOyAgICAgICAvLyB5LW1pZGRsZVxuXG4gICAgICAgICAgICBjb250ZXh0Lm1vdmVUbyh4LCB5bSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeCwgeW0gLSBveSwgeG0gLSBveCwgeSwgeG0sIHkpO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhtICsgb3gsIHksIHhlLCB5bSAtIG95LCB4ZSwgeW0pO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhlLCB5bSArIG95LCB4bSArIG94LCB5ZSwgeG0sIHllKTtcbiAgICAgICAgICAgIGNvbnRleHQuYmV6aWVyQ3VydmVUbyh4bSAtIG94LCB5ZSwgeCwgeW0gKyBveSwgeCwgeW0pO1xuXG4gICAgICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuXG4gICAgICAgICAgICBpZihkYXRhLmZpbGwpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRhdGEuZmlsbEFscGhhICogd29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmZpbGxTdHlsZSA9IGNvbG9yID0gJyMnICsgKCcwMDAwMCcgKyAoIGRhdGEuZmlsbENvbG9yIHwgMCkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTYpO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZmlsbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoZGF0YS5saW5lV2lkdGgpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IGRhdGEubGluZUFscGhhICogd29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LnN0cm9rZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuLypcbiAqIFJlbmRlcnMgYSBncmFwaGljcyBtYXNrXG4gKlxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqIEBtZXRob2QgcmVuZGVyR3JhcGhpY3NNYXNrXG4gKiBAcGFyYW0gZ3JhcGhpY3Mge0dyYXBoaWNzfVxuICogQHBhcmFtIGNvbnRleHQge0NvbnRleHQyRH1cbiAqL1xuZXhwb3J0cy5yZW5kZXJHcmFwaGljc01hc2sgPSBmdW5jdGlvbiByZW5kZXJHcmFwaGljc01hc2soZ3JhcGhpY3MsIGNvbnRleHQpXG57XG4gICAgdmFyIGxlbiA9IGdyYXBoaWNzLmdyYXBoaWNzRGF0YS5sZW5ndGg7XG5cbiAgICBpZihsZW4gPT09IDApIHJldHVybjtcblxuICAgIGlmKGxlbiA+IDEpXG4gICAge1xuICAgICAgICBsZW4gPSAxO1xuICAgICAgICBwbGF0Zm9ybS5jb25zb2xlLndhcm4oJ1BpeGkuanMgd2FybmluZzogbWFza3MgaW4gY2FudmFzIGNhbiBvbmx5IG1hc2sgdXNpbmcgdGhlIGZpcnN0IHBhdGggaW4gdGhlIGdyYXBoaWNzIG9iamVjdCcpO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMTsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGRhdGEgPSBncmFwaGljcy5ncmFwaGljc0RhdGFbaV07XG4gICAgICAgIHZhciBwb2ludHMgPSBkYXRhLnBvaW50cztcblxuICAgICAgICBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLlBPTFkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG4gICAgICAgICAgICBjb250ZXh0Lm1vdmVUbyhwb2ludHNbMF0sIHBvaW50c1sxXSk7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGo9MTsgaiA8IHBvaW50cy5sZW5ndGgvMjsgaisrKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnRleHQubGluZVRvKHBvaW50c1tqICogMl0sIHBvaW50c1tqICogMiArIDFdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlIGZpcnN0IGFuZCBsYXN0IHBvaW50IGFyZSB0aGUgc2FtZSBjbG9zZSB0aGUgcGF0aCAtIG11Y2ggbmVhdGVyIDopXG4gICAgICAgICAgICBpZihwb2ludHNbMF0gPT09IHBvaW50c1twb2ludHMubGVuZ3RoLTJdICYmIHBvaW50c1sxXSA9PT0gcG9pbnRzW3BvaW50cy5sZW5ndGgtMV0pXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5jbG9zZVBhdGgoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5SRUNUKVxuICAgICAgICB7XG4gICAgICAgICAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuICAgICAgICAgICAgY29udGV4dC5yZWN0KHBvaW50c1swXSwgcG9pbnRzWzFdLCBwb2ludHNbMl0sIHBvaW50c1szXSk7XG4gICAgICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5DSVJDKVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyBUT0RPIC0gbmVlZCB0byBiZSBVbmRlZmluZWQhXG4gICAgICAgICAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuICAgICAgICAgICAgY29udGV4dC5hcmMocG9pbnRzWzBdLCBwb2ludHNbMV0sIHBvaW50c1syXSwwLDIqTWF0aC5QSSk7XG4gICAgICAgICAgICBjb250ZXh0LmNsb3NlUGF0aCgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5FTElQKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIC8vIGVsbGlwc2UgY29kZSB0YWtlbiBmcm9tOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzIxNzI3OTgvaG93LXRvLWRyYXctYW4tb3ZhbC1pbi1odG1sNS1jYW52YXNcbiAgICAgICAgICAgIHZhciBlbGxpcHNlRGF0YSA9ICBkYXRhLnBvaW50cztcblxuICAgICAgICAgICAgdmFyIHcgPSBlbGxpcHNlRGF0YVsyXSAqIDI7XG4gICAgICAgICAgICB2YXIgaCA9IGVsbGlwc2VEYXRhWzNdICogMjtcblxuICAgICAgICAgICAgdmFyIHggPSBlbGxpcHNlRGF0YVswXSAtIHcvMjtcbiAgICAgICAgICAgIHZhciB5ID0gZWxsaXBzZURhdGFbMV0gLSBoLzI7XG5cbiAgICAgICAgICAgIGNvbnRleHQuYmVnaW5QYXRoKCk7XG5cbiAgICAgICAgICAgIHZhciBrYXBwYSA9IDAuNTUyMjg0OCxcbiAgICAgICAgICAgICAgICBveCA9ICh3IC8gMikgKiBrYXBwYSwgLy8gY29udHJvbCBwb2ludCBvZmZzZXQgaG9yaXpvbnRhbFxuICAgICAgICAgICAgICAgIG95ID0gKGggLyAyKSAqIGthcHBhLCAvLyBjb250cm9sIHBvaW50IG9mZnNldCB2ZXJ0aWNhbFxuICAgICAgICAgICAgICAgIHhlID0geCArIHcsICAgICAgICAgICAvLyB4LWVuZFxuICAgICAgICAgICAgICAgIHllID0geSArIGgsICAgICAgICAgICAvLyB5LWVuZFxuICAgICAgICAgICAgICAgIHhtID0geCArIHcgLyAyLCAgICAgICAvLyB4LW1pZGRsZVxuICAgICAgICAgICAgICAgIHltID0geSArIGggLyAyOyAgICAgICAvLyB5LW1pZGRsZVxuXG4gICAgICAgICAgICBjb250ZXh0Lm1vdmVUbyh4LCB5bSk7XG4gICAgICAgICAgICBjb250ZXh0LmJlemllckN1cnZlVG8oeCwgeW0gLSBveSwgeG0gLSBveCwgeSwgeG0sIHkpO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhtICsgb3gsIHksIHhlLCB5bSAtIG95LCB4ZSwgeW0pO1xuICAgICAgICAgICAgY29udGV4dC5iZXppZXJDdXJ2ZVRvKHhlLCB5bSArIG95LCB4bSArIG94LCB5ZSwgeG0sIHllKTtcbiAgICAgICAgICAgIGNvbnRleHQuYmV6aWVyQ3VydmVUbyh4bSAtIG94LCB5ZSwgeCwgeW0gKyBveSwgeCwgeW0pO1xuICAgICAgICAgICAgY29udGV4dC5jbG9zZVBhdGgoKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICogQGF1dGhvciBSaWNoYXJkIERhdmV5IGh0dHA6Ly93d3cucGhvdG9uc3Rvcm0uY29tIEBwaG90b25zdG9ybVxuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBjb21waWxlID0gcmVxdWlyZSgnLi9jb21waWxlJyk7XG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBQaXhpU2hhZGVyKClcbntcbiAgICAvKipcbiAgICAqIEBwcm9wZXJ0eSB7YW55fSBwcm9ncmFtIC0gVGhlIFdlYkdMIHByb2dyYW0uXG4gICAgKi9cbiAgICB0aGlzLnByb2dyYW0gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgKiBAcHJvcGVydHkge2FycmF5fSBmcmFnbWVudFNyYyAtIFRoZSBmcmFnbWVudCBzaGFkZXIuXG4gICAgKi9cbiAgICB0aGlzLmZyYWdtZW50U3JjID0gW1xuICAgICAgICAncHJlY2lzaW9uIGxvd3AgZmxvYXQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXG4gICAgICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1U2FtcGxlciwgdlRleHR1cmVDb29yZCkgKiB2Q29sb3I7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcblxuICAgIC8qKlxuICAgICogQHByb3BlcnR5IHtudW1iZXJ9IHRleHR1cmVDb3VudCAtIEEgbG9jYWwgdGV4dHVyZSBjb3VudGVyIGZvciBtdWx0aS10ZXh0dXJlIHNoYWRlcnMuXG4gICAgKi9cbiAgICB0aGlzLnRleHR1cmVDb3VudCA9IDA7XG59XG5cbnZhciBwcm90byA9IFBpeGlTaGFkZXIucHJvdG90eXBlO1xuXG5wcm90by5pbml0ID0gZnVuY3Rpb24gaW5pdCgpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcbiAgICB2YXIgcHJvZ3JhbSA9IGNvbXBpbGUucHJvZ3JhbShnbCwgdGhpcy52ZXJ0ZXhTcmMgfHwgUGl4aVNoYWRlci5kZWZhdWx0VmVydGV4U3JjLCB0aGlzLmZyYWdtZW50U3JjKTtcblxuICAgIGdsLnVzZVByb2dyYW0ocHJvZ3JhbSk7XG5cbiAgICAvLyBnZXQgYW5kIHN0b3JlIHRoZSB1bmlmb3JtcyBmb3IgdGhlIHNoYWRlclxuICAgIHRoaXMudVNhbXBsZXIgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgJ3VTYW1wbGVyJyk7XG4gICAgdGhpcy5wcm9qZWN0aW9uVmVjdG9yID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICdwcm9qZWN0aW9uVmVjdG9yJyk7XG4gICAgdGhpcy5vZmZzZXRWZWN0b3IgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgJ29mZnNldFZlY3RvcicpO1xuICAgIHRoaXMuZGltZW5zaW9ucyA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAnZGltZW5zaW9ucycpO1xuXG4gICAgLy8gZ2V0IGFuZCBzdG9yZSB0aGUgYXR0cmlidXRlc1xuICAgIHRoaXMuYVZlcnRleFBvc2l0aW9uID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgJ2FWZXJ0ZXhQb3NpdGlvbicpO1xuICAgIHRoaXMuY29sb3JBdHRyaWJ1dGUgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCAnYUNvbG9yJyk7XG4gICAgdGhpcy5hVGV4dHVyZUNvb3JkID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgJ2FUZXh0dXJlQ29vcmQnKTtcblxuICAgIC8vIGFkZCB0aG9zZSBjdXN0b20gc2hhZGVycyFcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy51bmlmb3JtcylcbiAgICB7XG4gICAgICAgIC8vIGdldCB0aGUgdW5pZm9ybSBsb2NhdGlvbnMuLlxuICAgICAgICB0aGlzLnVuaWZvcm1zW2tleV0udW5pZm9ybUxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIGtleSk7XG4gICAgfVxuXG4gICAgdGhpcy5pbml0VW5pZm9ybXMoKTtcblxuICAgIHRoaXMucHJvZ3JhbSA9IHByb2dyYW07XG59O1xuXG4vKipcbiAqIEluaXRpYWxpc2VzIHRoZSBzaGFkZXIgdW5pZm9ybSB2YWx1ZXMuXG4gKiBVbmlmb3JtcyBhcmUgc3BlY2lmaWVkIGluIHRoZSBHTFNMX0VTIFNwZWNpZmljYXRpb246IGh0dHA6Ly93d3cua2hyb25vcy5vcmcvcmVnaXN0cnkvd2ViZ2wvc3BlY3MvbGF0ZXN0LzEuMC9cbiAqIGh0dHA6Ly93d3cua2hyb25vcy5vcmcvcmVnaXN0cnkvZ2xlcy9zcGVjcy8yLjAvR0xTTF9FU19TcGVjaWZpY2F0aW9uXzEuMC4xNy5wZGZcbiAqL1xucHJvdG8uaW5pdFVuaWZvcm1zID0gZnVuY3Rpb24gaW5pdFVuaWZvcm1zKClcbntcbiAgICB0aGlzLnRleHR1cmVDb3VudCA9IDE7XG5cbiAgICB2YXIgdW5pZm9ybTtcblxuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLnVuaWZvcm1zKVxuICAgIHtcbiAgICAgICAgdW5pZm9ybSA9IHRoaXMudW5pZm9ybXNba2V5XTtcblxuICAgICAgICB2YXIgdHlwZSA9IHVuaWZvcm0udHlwZTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gJ3NhbXBsZXIyRCcpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHVuaWZvcm0uX2luaXQgPSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgIT09IG51bGwpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbml0U2FtcGxlcjJEKHVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICdtYXQyJyB8fCB0eXBlID09PSAnbWF0MycgfHwgdHlwZSA9PT0gJ21hdDQnKVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyAgVGhlc2UgcmVxdWlyZSBzcGVjaWFsIGhhbmRsaW5nXG4gICAgICAgICAgICB1bmlmb3JtLmdsTWF0cml4ID0gdHJ1ZTtcbiAgICAgICAgICAgIHVuaWZvcm0uZ2xWYWx1ZUxlbmd0aCA9IDE7XG5cbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnbWF0MicpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS5nbEZ1bmMgPSBnbG9iYWxzLmdsLnVuaWZvcm1NYXRyaXgyZnY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlID09PSAnbWF0MycpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS5nbEZ1bmMgPSBnbG9iYWxzLmdsLnVuaWZvcm1NYXRyaXgzZnY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlID09PSAnbWF0NCcpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS5nbEZ1bmMgPSBnbG9iYWxzLmdsLnVuaWZvcm1NYXRyaXg0ZnY7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyAgR0wgZnVuY3Rpb24gcmVmZXJlbmNlXG4gICAgICAgICAgICB1bmlmb3JtLmdsRnVuYyA9IGdsb2JhbHMuZ2xbJ3VuaWZvcm0nICsgdHlwZV07XG5cbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnMmYnIHx8IHR5cGUgPT09ICcyaScpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS5nbFZhbHVlTGVuZ3RoID0gMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICczZicgfHwgdHlwZSA9PT0gJzNpJylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLmdsVmFsdWVMZW5ndGggPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZSA9PT0gJzRmJyB8fCB0eXBlID09PSAnNGknKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVuaWZvcm0uZ2xWYWx1ZUxlbmd0aCA9IDQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS5nbFZhbHVlTGVuZ3RoID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxufTtcblxuLyoqXG4gKiBJbml0aWFsaXNlcyBhIFNhbXBsZXIyRCB1bmlmb3JtXG4gKiAod2hpY2ggbWF5IG9ubHkgYmUgYXZhaWxhYmxlIGxhdGVyIG9uIGFmdGVyIGluaXRVbmlmb3JtcyBvbmNlIHRoZSB0ZXh0dXJlIGlzIGhhcyBsb2FkZWQpXG4gKi9cbnByb3RvLmluaXRTYW1wbGVyMkQgPSBmdW5jdGlvbiBpbml0U2FtcGxlcjJEKHVuaWZvcm0pXG57XG4gICAgaWYgKCF1bmlmb3JtLnZhbHVlIHx8ICF1bmlmb3JtLnZhbHVlLmJhc2VUZXh0dXJlIHx8ICF1bmlmb3JtLnZhbHVlLmJhc2VUZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBnbG9iYWxzLmdsLmFjdGl2ZVRleHR1cmUoZ2xvYmFscy5nbFsnVEVYVFVSRScgKyB0aGlzLnRleHR1cmVDb3VudF0pO1xuICAgIGdsb2JhbHMuZ2wuYmluZFRleHR1cmUoZ2xvYmFscy5nbC5URVhUVVJFXzJELCB1bmlmb3JtLnZhbHVlLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUpO1xuXG4gICAgLy8gIEV4dGVuZGVkIHRleHR1cmUgZGF0YVxuICAgIGlmICh1bmlmb3JtLnRleHR1cmVEYXRhKVxuICAgIHtcbiAgICAgICAgdmFyIGRhdGEgPSB1bmlmb3JtLnRleHR1cmVEYXRhO1xuXG4gICAgICAgIC8vIEdMVGV4dHVyZSA9IG1hZyBsaW5lYXIsIG1pbiBsaW5lYXJfbWlwbWFwX2xpbmVhciwgd3JhcCByZXBlYXQgKyBnbC5nZW5lcmF0ZU1pcG1hcChnbC5URVhUVVJFXzJEKTtcbiAgICAgICAgLy8gR0xUZXh0dXJlTGluZWFyID0gbWFnL21pbiBsaW5lYXIsIHdyYXAgY2xhbXBcbiAgICAgICAgLy8gR0xUZXh0dXJlTmVhcmVzdFJlcGVhdCA9IG1hZy9taW4gTkVBUkVTVCwgd3JhcCByZXBlYXRcbiAgICAgICAgLy8gR0xUZXh0dXJlTmVhcmVzdCA9IG1hZy9taW4gbmVhcmVzdCwgd3JhcCBjbGFtcFxuICAgICAgICAvLyBBdWRpb1RleHR1cmUgPSB3aGF0ZXZlciArIGx1bWluYW5jZSArIHdpZHRoIDUxMiwgaGVpZ2h0IDIsIGJvcmRlciAwXG4gICAgICAgIC8vIEtleVRleHR1cmUgPSB3aGF0ZXZlciArIGx1bWluYW5jZSArIHdpZHRoIDI1NiwgaGVpZ2h0IDIsIGJvcmRlciAwXG5cbiAgICAgICAgLy8gIG1hZ0ZpbHRlciBjYW4gYmU6IGdsLkxJTkVBUiwgZ2wuTElORUFSX01JUE1BUF9MSU5FQVIgb3IgZ2wuTkVBUkVTVFxuICAgICAgICAvLyAgd3JhcFMvVCBjYW4gYmU6IGdsLkNMQU1QX1RPX0VER0Ugb3IgZ2wuUkVQRUFUXG5cbiAgICAgICAgdmFyIG1hZ0ZpbHRlciA9IChkYXRhLm1hZ0ZpbHRlcikgPyBkYXRhLm1hZ0ZpbHRlciA6IGdsb2JhbHMuZ2wuTElORUFSO1xuICAgICAgICB2YXIgbWluRmlsdGVyID0gKGRhdGEubWluRmlsdGVyKSA/IGRhdGEubWluRmlsdGVyIDogZ2xvYmFscy5nbC5MSU5FQVI7XG4gICAgICAgIHZhciB3cmFwUyA9IChkYXRhLndyYXBTKSA/IGRhdGEud3JhcFMgOiBnbG9iYWxzLmdsLkNMQU1QX1RPX0VER0U7XG4gICAgICAgIHZhciB3cmFwVCA9IChkYXRhLndyYXBUKSA/IGRhdGEud3JhcFQgOiBnbG9iYWxzLmdsLkNMQU1QX1RPX0VER0U7XG4gICAgICAgIHZhciBmb3JtYXQgPSAoZGF0YS5sdW1pbmFuY2UpID8gZ2xvYmFscy5nbC5MVU1JTkFOQ0UgOiBnbG9iYWxzLmdsLlJHQkE7XG5cbiAgICAgICAgaWYgKGRhdGEucmVwZWF0KVxuICAgICAgICB7XG4gICAgICAgICAgICB3cmFwUyA9IGdsb2JhbHMuZ2wuUkVQRUFUO1xuICAgICAgICAgICAgd3JhcFQgPSBnbG9iYWxzLmdsLlJFUEVBVDtcbiAgICAgICAgfVxuXG4gICAgICAgIGdsb2JhbHMuZ2wucGl4ZWxTdG9yZWkoZ2xvYmFscy5nbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmYWxzZSk7XG5cbiAgICAgICAgaWYgKGRhdGEud2lkdGgpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciB3aWR0aCA9IChkYXRhLndpZHRoKSA/IGRhdGEud2lkdGggOiA1MTI7XG4gICAgICAgICAgICB2YXIgaGVpZ2h0ID0gKGRhdGEuaGVpZ2h0KSA/IGRhdGEuaGVpZ2h0IDogMjtcbiAgICAgICAgICAgIHZhciBib3JkZXIgPSAoZGF0YS5ib3JkZXIpID8gZGF0YS5ib3JkZXIgOiAwO1xuXG4gICAgICAgICAgICAvLyB2b2lkIHRleEltYWdlMkQoR0xlbnVtIHRhcmdldCwgR0xpbnQgbGV2ZWwsIEdMZW51bSBpbnRlcm5hbGZvcm1hdCwgR0xzaXplaSB3aWR0aCwgR0xzaXplaSBoZWlnaHQsIEdMaW50IGJvcmRlciwgR0xlbnVtIGZvcm1hdCwgR0xlbnVtIHR5cGUsIEFycmF5QnVmZmVyVmlldz8gcGl4ZWxzKTtcbiAgICAgICAgICAgIGdsb2JhbHMuZ2wudGV4SW1hZ2UyRChnbG9iYWxzLmdsLlRFWFRVUkVfMkQsIDAsIGZvcm1hdCwgd2lkdGgsIGhlaWdodCwgYm9yZGVyLCBmb3JtYXQsIGdsb2JhbHMuZ2wuVU5TSUdORURfQllURSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICAvLyAgdm9pZCB0ZXhJbWFnZTJEKEdMZW51bSB0YXJnZXQsIEdMaW50IGxldmVsLCBHTGVudW0gaW50ZXJuYWxmb3JtYXQsIEdMZW51bSBmb3JtYXQsIEdMZW51bSB0eXBlLCBJbWFnZURhdGE/IHBpeGVscyk7XG4gICAgICAgICAgICBnbG9iYWxzLmdsLnRleEltYWdlMkQoZ2xvYmFscy5nbC5URVhUVVJFXzJELCAwLCBmb3JtYXQsIGdsb2JhbHMuZ2wuUkdCQSwgZ2xvYmFscy5nbC5VTlNJR05FRF9CWVRFLCB1bmlmb3JtLnZhbHVlLmJhc2VUZXh0dXJlLnNvdXJjZSk7XG4gICAgICAgIH1cblxuICAgICAgICBnbG9iYWxzLmdsLnRleFBhcmFtZXRlcmkoZ2xvYmFscy5nbC5URVhUVVJFXzJELCBnbG9iYWxzLmdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgbWFnRmlsdGVyKTtcbiAgICAgICAgZ2xvYmFscy5nbC50ZXhQYXJhbWV0ZXJpKGdsb2JhbHMuZ2wuVEVYVFVSRV8yRCwgZ2xvYmFscy5nbC5URVhUVVJFX01JTl9GSUxURVIsIG1pbkZpbHRlcik7XG4gICAgICAgIGdsb2JhbHMuZ2wudGV4UGFyYW1ldGVyaShnbG9iYWxzLmdsLlRFWFRVUkVfMkQsIGdsb2JhbHMuZ2wuVEVYVFVSRV9XUkFQX1MsIHdyYXBTKTtcbiAgICAgICAgZ2xvYmFscy5nbC50ZXhQYXJhbWV0ZXJpKGdsb2JhbHMuZ2wuVEVYVFVSRV8yRCwgZ2xvYmFscy5nbC5URVhUVVJFX1dSQVBfVCwgd3JhcFQpO1xuICAgIH1cblxuICAgIGdsb2JhbHMuZ2wudW5pZm9ybTFpKHVuaWZvcm0udW5pZm9ybUxvY2F0aW9uLCB0aGlzLnRleHR1cmVDb3VudCk7XG5cbiAgICB1bmlmb3JtLl9pbml0ID0gdHJ1ZTtcblxuICAgIHRoaXMudGV4dHVyZUNvdW50Kys7XG5cbn07XG5cbi8qKlxuICogVXBkYXRlcyB0aGUgc2hhZGVyIHVuaWZvcm0gdmFsdWVzLlxuICovXG5wcm90by5zeW5jVW5pZm9ybXMgPSBmdW5jdGlvbiBzeW5jVW5pZm9ybXMoKVxue1xuICAgIHRoaXMudGV4dHVyZUNvdW50ID0gMTtcbiAgICB2YXIgdW5pZm9ybTtcblxuICAgIC8vICBUaGlzIHdvdWxkIHByb2JhYmx5IGJlIGZhc3RlciBpbiBhbiBhcnJheSBhbmQgaXQgd291bGQgZ3VhcmFudGVlIGtleSBvcmRlclxuICAgIGZvciAodmFyIGtleSBpbiB0aGlzLnVuaWZvcm1zKVxuICAgIHtcblxuICAgICAgICB1bmlmb3JtID0gdGhpcy51bmlmb3Jtc1trZXldO1xuXG4gICAgICAgIGlmICh1bmlmb3JtLmdsVmFsdWVMZW5ndGggPT09IDEpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtLmdsTWF0cml4ID09PSB0cnVlKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVuaWZvcm0uZ2xGdW5jLmNhbGwoZ2xvYmFscy5nbCwgdW5pZm9ybS51bmlmb3JtTG9jYXRpb24sIHVuaWZvcm0udHJhbnNwb3NlLCB1bmlmb3JtLnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLmdsRnVuYy5jYWxsKGdsb2JhbHMuZ2wsIHVuaWZvcm0udW5pZm9ybUxvY2F0aW9uLCB1bmlmb3JtLnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1bmlmb3JtLmdsVmFsdWVMZW5ndGggPT09IDIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHVuaWZvcm0uZ2xGdW5jLmNhbGwoZ2xvYmFscy5nbCwgdW5pZm9ybS51bmlmb3JtTG9jYXRpb24sIHVuaWZvcm0udmFsdWUueCwgdW5pZm9ybS52YWx1ZS55KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1bmlmb3JtLmdsVmFsdWVMZW5ndGggPT09IDMpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHVuaWZvcm0uZ2xGdW5jLmNhbGwoZ2xvYmFscy5nbCwgdW5pZm9ybS51bmlmb3JtTG9jYXRpb24sIHVuaWZvcm0udmFsdWUueCwgdW5pZm9ybS52YWx1ZS55LCB1bmlmb3JtLnZhbHVlLnopO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuaWZvcm0uZ2xWYWx1ZUxlbmd0aCA9PT0gNClcbiAgICAgICAge1xuICAgICAgICAgICAgdW5pZm9ybS5nbEZ1bmMuY2FsbChnbG9iYWxzLmdsLCB1bmlmb3JtLnVuaWZvcm1Mb2NhdGlvbiwgdW5pZm9ybS52YWx1ZS54LCB1bmlmb3JtLnZhbHVlLnksIHVuaWZvcm0udmFsdWUueiwgdW5pZm9ybS52YWx1ZS53KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1bmlmb3JtLnR5cGUgPT09ICdzYW1wbGVyMkQnKVxuICAgICAgICB7XG4gICAgICAgICAgICBpZiAodW5pZm9ybS5faW5pdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBnbG9iYWxzLmdsLmFjdGl2ZVRleHR1cmUoZ2xvYmFscy5nbFsnVEVYVFVSRScgKyB0aGlzLnRleHR1cmVDb3VudF0pO1xuICAgICAgICAgICAgICAgIGdsb2JhbHMuZ2wuYmluZFRleHR1cmUoZ2xvYmFscy5nbC5URVhUVVJFXzJELCB1bmlmb3JtLnZhbHVlLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUpO1xuICAgICAgICAgICAgICAgIGdsb2JhbHMuZ2wudW5pZm9ybTFpKHVuaWZvcm0udW5pZm9ybUxvY2F0aW9uLCB0aGlzLnRleHR1cmVDb3VudCk7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlQ291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluaXRTYW1wbGVyMkQodW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbn07XG5cblBpeGlTaGFkZXIuZGVmYXVsdFZlcnRleFNyYyA9IFtcbiAgICAnYXR0cmlidXRlIHZlYzIgYVZlcnRleFBvc2l0aW9uOycsXG4gICAgJ2F0dHJpYnV0ZSB2ZWMyIGFUZXh0dXJlQ29vcmQ7JyxcbiAgICAnYXR0cmlidXRlIGZsb2F0IGFDb2xvcjsnLFxuXG4gICAgJ3VuaWZvcm0gdmVjMiBwcm9qZWN0aW9uVmVjdG9yOycsXG4gICAgJ3VuaWZvcm0gdmVjMiBvZmZzZXRWZWN0b3I7JyxcbiAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcblxuICAgICd2YXJ5aW5nIGZsb2F0IHZDb2xvcjsnLFxuXG4gICAgJ2NvbnN0IHZlYzIgY2VudGVyID0gdmVjMigtMS4wLCAxLjApOycsXG5cbiAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICcgICBnbF9Qb3NpdGlvbiA9IHZlYzQoICgoYVZlcnRleFBvc2l0aW9uICsgb2Zmc2V0VmVjdG9yKSAvIHByb2plY3Rpb25WZWN0b3IpICsgY2VudGVyICwgMC4wLCAxLjApOycsXG4gICAgJyAgIHZUZXh0dXJlQ29vcmQgPSBhVGV4dHVyZUNvb3JkOycsXG4gICAgJyAgIHZDb2xvciA9IGFDb2xvcjsnLFxuICAgICd9J1xuXTtcblxubW9kdWxlLmV4cG9ydHMgPSBQaXhpU2hhZGVyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgY29tcGlsZSA9IHJlcXVpcmUoJy4vY29tcGlsZScpO1xudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi8uLi9jb3JlL2dsb2JhbHMnKTtcblxuZnVuY3Rpb24gUHJpbWl0aXZlU2hhZGVyKClcbntcbiAgICAvLyB0aGUgd2ViR0wgcHJvZ3JhbS4uXG4gICAgdGhpcy5wcm9ncmFtID0gbnVsbDtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWM0IHZDb2xvcjsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSB2Q29sb3I7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcblxuICAgIHRoaXMudmVydGV4U3JjICA9IFtcbiAgICAgICAgJ2F0dHJpYnV0ZSB2ZWMyIGFWZXJ0ZXhQb3NpdGlvbjsnLFxuICAgICAgICAnYXR0cmlidXRlIHZlYzQgYUNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIG1hdDMgdHJhbnNsYXRpb25NYXRyaXg7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjMiBwcm9qZWN0aW9uVmVjdG9yOycsXG4gICAgICAgICd1bmlmb3JtIHZlYzIgb2Zmc2V0VmVjdG9yOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGFscGhhOycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzQgdkNvbG9yOycsXG5cbiAgICAgICAgJ3ZvaWQgbWFpbih2b2lkKSB7JyxcbiAgICAgICAgJyAgIHZlYzMgdiA9IHRyYW5zbGF0aW9uTWF0cml4ICogdmVjMyhhVmVydGV4UG9zaXRpb24gLCAxLjApOycsXG4gICAgICAgICcgICB2IC09IG9mZnNldFZlY3Rvci54eXg7JyxcbiAgICAgICAgJyAgIGdsX1Bvc2l0aW9uID0gdmVjNCggdi54IC8gcHJvamVjdGlvblZlY3Rvci54IC0xLjAsIHYueSAvIC1wcm9qZWN0aW9uVmVjdG9yLnkgKyAxLjAgLCAwLjAsIDEuMCk7JyxcbiAgICAgICAgJyAgIHZDb2xvciA9IGFDb2xvciAgKiBhbHBoYTsnLFxuICAgICAgICAnfSdcbiAgICBdO1xufVxuXG5QcmltaXRpdmVTaGFkZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiBpbml0KClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuICAgIHZhciBwcm9ncmFtID0gY29tcGlsZS5wcm9ncmFtKGdsLCB0aGlzLnZlcnRleFNyYywgdGhpcy5mcmFnbWVudFNyYyk7XG5cbiAgICBnbC51c2VQcm9ncmFtKHByb2dyYW0pO1xuXG4gICAgLy8gZ2V0IGFuZCBzdG9yZSB0aGUgdW5pZm9ybXMgZm9yIHRoZSBzaGFkZXJcbiAgICB0aGlzLnByb2plY3Rpb25WZWN0b3IgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgJ3Byb2plY3Rpb25WZWN0b3InKTtcbiAgICB0aGlzLm9mZnNldFZlY3RvciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAnb2Zmc2V0VmVjdG9yJyk7XG5cbiAgICAvLyBnZXQgYW5kIHN0b3JlIHRoZSBhdHRyaWJ1dGVzXG4gICAgdGhpcy5hVmVydGV4UG9zaXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCAnYVZlcnRleFBvc2l0aW9uJyk7XG4gICAgdGhpcy5jb2xvckF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sICdhQ29sb3InKTtcblxuICAgIHRoaXMudHJhbnNsYXRpb25NYXRyaXggPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgJ3RyYW5zbGF0aW9uTWF0cml4Jyk7XG4gICAgdGhpcy5hbHBoYSA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAnYWxwaGEnKTtcblxuICAgIHRoaXMucHJvZ3JhbSA9IHByb2dyYW07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFByaW1pdGl2ZVNoYWRlcjtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGNvbXBpbGUgPSByZXF1aXJlKCcuL2NvbXBpbGUnKTtcbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG5cbmZ1bmN0aW9uIFN0cmlwU2hhZGVyKClcbntcbiAgICAvLyB0aGUgd2ViR0wgcHJvZ3JhbS4uXG4gICAgdGhpcy5wcm9ncmFtID0gbnVsbDtcblxuICAgIHRoaXMuZnJhZ21lbnRTcmMgPSBbXG4gICAgICAgICdwcmVjaXNpb24gbWVkaXVtcCBmbG9hdDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIHZUZXh0dXJlQ29vcmQ7JyxcbiAgICAgICAgJ3ZhcnlpbmcgZmxvYXQgdkNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IGFscGhhOycsXG4gICAgICAgICd1bmlmb3JtIHNhbXBsZXIyRCB1U2FtcGxlcjsnLFxuXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXG4gICAgICAgICcgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodVNhbXBsZXIsIHZlYzIodlRleHR1cmVDb29yZC54LCB2VGV4dHVyZUNvb3JkLnkpKTsnLFxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gZ2xfRnJhZ0NvbG9yICogYWxwaGE7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcblxuICAgIHRoaXMudmVydGV4U3JjID0gW1xuICAgICAgICAnYXR0cmlidXRlIHZlYzIgYVZlcnRleFBvc2l0aW9uOycsXG4gICAgICAgICdhdHRyaWJ1dGUgdmVjMiBhVGV4dHVyZUNvb3JkOycsXG4gICAgICAgICdhdHRyaWJ1dGUgZmxvYXQgYUNvbG9yOycsXG4gICAgICAgICd1bmlmb3JtIG1hdDMgdHJhbnNsYXRpb25NYXRyaXg7JyxcbiAgICAgICAgJ3VuaWZvcm0gdmVjMiBwcm9qZWN0aW9uVmVjdG9yOycsXG4gICAgICAgICd2YXJ5aW5nIHZlYzIgdlRleHR1cmVDb29yZDsnLFxuICAgICAgICAndmFyeWluZyB2ZWMyIG9mZnNldFZlY3RvcjsnLFxuICAgICAgICAndmFyeWluZyBmbG9hdCB2Q29sb3I7JyxcblxuICAgICAgICAndm9pZCBtYWluKHZvaWQpIHsnLFxuICAgICAgICAnICAgdmVjMyB2ID0gdHJhbnNsYXRpb25NYXRyaXggKiB2ZWMzKGFWZXJ0ZXhQb3NpdGlvbiwgMS4wKTsnLFxuICAgICAgICAnICAgdiAtPSBvZmZzZXRWZWN0b3IueHl4OycsXG4gICAgICAgICcgICBnbF9Qb3NpdGlvbiA9IHZlYzQoIHYueCAvIHByb2plY3Rpb25WZWN0b3IueCAtMS4wLCB2LnkgLyBwcm9qZWN0aW9uVmVjdG9yLnkgKyAxLjAgLCAwLjAsIDEuMCk7JyxcbiAgICAgICAgJyAgIHZUZXh0dXJlQ29vcmQgPSBhVGV4dHVyZUNvb3JkOycsXG4gICAgICAgICcgICB2Q29sb3IgPSBhQ29sb3I7JyxcbiAgICAgICAgJ30nXG4gICAgXTtcbn1cblxuU3RyaXBTaGFkZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiBpbml0KClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuICAgIHZhciBwcm9ncmFtID0gY29tcGlsZS5wcm9ncmFtKGdsLCB0aGlzLnZlcnRleFNyYywgdGhpcy5mcmFnbWVudFNyYyk7XG5cbiAgICBnbC51c2VQcm9ncmFtKHByb2dyYW0pO1xuXG4gICAgLy8gZ2V0IGFuZCBzdG9yZSB0aGUgdW5pZm9ybXMgZm9yIHRoZSBzaGFkZXJcbiAgICB0aGlzLnVTYW1wbGVyID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICd1U2FtcGxlcicpO1xuICAgIHRoaXMucHJvamVjdGlvblZlY3RvciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAncHJvamVjdGlvblZlY3RvcicpO1xuICAgIHRoaXMub2Zmc2V0VmVjdG9yID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICdvZmZzZXRWZWN0b3InKTtcbiAgICB0aGlzLmNvbG9yQXR0cmlidXRlID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgJ2FDb2xvcicpO1xuICAgIC8vdGhpcy5kaW1lbnNpb25zID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgJ2RpbWVuc2lvbnMnKTtcblxuICAgIC8vIGdldCBhbmQgc3RvcmUgdGhlIGF0dHJpYnV0ZXNcbiAgICB0aGlzLmFWZXJ0ZXhQb3NpdGlvbiA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sICdhVmVydGV4UG9zaXRpb24nKTtcbiAgICB0aGlzLmFUZXh0dXJlQ29vcmQgPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihwcm9ncmFtLCAnYVRleHR1cmVDb29yZCcpO1xuXG4gICAgdGhpcy50cmFuc2xhdGlvbk1hdHJpeCA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCAndHJhbnNsYXRpb25NYXRyaXgnKTtcbiAgICB0aGlzLmFscGhhID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sICdhbHBoYScpO1xuXG4gICAgdGhpcy5wcm9ncmFtID0gcHJvZ3JhbTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RyaXBTaGFkZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgYmxlbmRNb2RlcyA9IHJlcXVpcmUoJy4uLy4uL2Rpc3BsYXkvYmxlbmRNb2RlcycpO1xuXG4vKipcbiAqIEEgV2ViR0xCYXRjaCBFbmFibGVzIGEgZ3JvdXAgb2Ygc3ByaXRlcyB0byBiZSBkcmF3biB1c2luZyB0aGUgc2FtZSBzZXR0aW5ncy5cbiAqIGlmIGEgZ3JvdXAgb2Ygc3ByaXRlcyBhbGwgaGF2ZSB0aGUgc2FtZSBiYXNlVGV4dHVyZSBhbmQgYmxlbmRNb2RlIHRoZW4gdGhleSBjYW4gYmUgZ3JvdXBlZCBpbnRvIGEgYmF0Y2guXG4gKiBBbGwgdGhlIHNwcml0ZXMgaW4gYSBiYXRjaCBjYW4gdGhlbiBiZSBkcmF3biBpbiBvbmUgZ28gYnkgdGhlIEdQVSB3aGljaCBpcyBodWdlbHkgZWZmaWNpZW50LiBBTEwgc3ByaXRlc1xuICogaW4gdGhlIHdlYkdMIHJlbmRlcmVyIGFyZSBhZGRlZCB0byBhIGJhdGNoIGV2ZW4gaWYgdGhlIGJhdGNoIG9ubHkgY29udGFpbnMgb25lIHNwcml0ZS4gQmF0Y2hpbmcgaXMgaGFuZGxlZFxuICogYXV0b21hdGljYWxseSBieSB0aGUgd2ViR0wgcmVuZGVyZXIuIEEgZ29vZCB0aXAgaXM6IHRoZSBzbWFsbGVyIHRoZSBudW1iZXIgb2YgYmF0Y2hzIHRoZXJlIGFyZSwgdGhlIGZhc3RlclxuICogdGhlIHdlYkdMIHJlbmRlcmVyIHdpbGwgcnVuLlxuICpcbiAqIEBjbGFzcyBXZWJHTEJhdGNoXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSBnbCB7V2ViR0xDb250ZXh0fSBhbiBpbnN0YW5jZSBvZiB0aGUgd2ViR0wgY29udGV4dFxuICovXG5mdW5jdGlvbiBXZWJHTEJhdGNoKGdsKVxue1xuICAgIHRoaXMuZ2wgPSBnbDtcblxuICAgIHRoaXMuc2l6ZSA9IDA7XG5cbiAgICB0aGlzLnZlcnRleEJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmluZGV4QnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMudXZCdWZmZXIgPSAgZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdGhpcy5jb2xvckJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmJsZW5kTW9kZSA9IGJsZW5kTW9kZXMuTk9STUFMO1xuICAgIHRoaXMuZHluYW1pY1NpemUgPSAxO1xufVxuXG52YXIgcHJvdG8gPSBXZWJHTEJhdGNoLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDbGVhbnMgdGhlIGJhdGNoIHNvIHRoYXQgaXMgY2FuIGJlIHJldHVybmVkIHRvIGFuIG9iamVjdCBwb29sIGFuZCByZXVzZWRcbiAqXG4gKiBAbWV0aG9kIGNsZWFuXG4gKi9cbnByb3RvLmNsZWFuID0gZnVuY3Rpb24gY2xlYW4oKVxue1xuICAgIHRoaXMudmVydGljaWVzID0gW107XG4gICAgdGhpcy51dnMgPSBbXTtcbiAgICB0aGlzLmluZGljZXMgPSBbXTtcbiAgICB0aGlzLmNvbG9ycyA9IFtdO1xuICAgIHRoaXMuZHluYW1pY1NpemUgPSAxO1xuICAgIHRoaXMudGV4dHVyZSA9IG51bGw7XG4gICAgdGhpcy5sYXN0ID0gbnVsbDtcbiAgICB0aGlzLnNpemUgPSAwO1xuICAgIHRoaXMuaGVhZCA9IG51bGw7XG4gICAgdGhpcy50YWlsID0gbnVsbDtcbn07XG5cbi8qKlxuICogUmVjcmVhdGVzIHRoZSBidWZmZXJzIGluIHRoZSBldmVudCBvZiBhIGNvbnRleHQgbG9zc1xuICpcbiAqIEBtZXRob2QgcmVzdG9yZUxvc3RDb250ZXh0XG4gKiBAcGFyYW0gZ2wge1dlYkdMQ29udGV4dH1cbiAqL1xucHJvdG8ucmVzdG9yZUxvc3RDb250ZXh0ID0gZnVuY3Rpb24gcmVzdG9yZUxvc3RDb250ZXh0KGdsKVxue1xuICAgIHRoaXMuZ2wgPSBnbDtcbiAgICB0aGlzLnZlcnRleEJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmluZGV4QnVmZmVyID0gIGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMudXZCdWZmZXIgPSAgZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgdGhpcy5jb2xvckJ1ZmZlciA9ICBnbC5jcmVhdGVCdWZmZXIoKTtcbn07XG5cbi8qKlxuICogaW5pdHMgdGhlIGJhdGNoJ3MgdGV4dHVyZSBhbmQgYmxlbmQgbW9kZSBiYXNlZCBpZiB0aGUgc3VwcGxpZWQgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBpbml0XG4gKiBAcGFyYW0gc3ByaXRlIHtTcHJpdGV9IHRoZSBmaXJzdCBzcHJpdGUgdG8gYmUgYWRkZWQgdG8gdGhlIGJhdGNoLiBPbmx5IHNwcml0ZXMgd2l0aFxuICogICAgICB0aGUgc2FtZSBiYXNlIHRleHR1cmUgYW5kIGJsZW5kIG1vZGUgd2lsbCBiZSBhbGxvd2VkIHRvIGJlIGFkZGVkIHRvIHRoaXMgYmF0Y2hcbiAqL1xucHJvdG8uaW5pdCA9IGZ1bmN0aW9uIGluaXQoc3ByaXRlKVxue1xuICAgIHNwcml0ZS5iYXRjaCA9IHRoaXM7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgdGhpcy5ibGVuZE1vZGUgPSBzcHJpdGUuYmxlbmRNb2RlO1xuICAgIHRoaXMudGV4dHVyZSA9IHNwcml0ZS50ZXh0dXJlLmJhc2VUZXh0dXJlO1xuICAgIHRoaXMuaGVhZCA9IHNwcml0ZTtcbiAgICB0aGlzLnRhaWwgPSBzcHJpdGU7XG4gICAgdGhpcy5zaXplID0gMTtcblxuICAgIHRoaXMuZ3Jvd0JhdGNoKCk7XG59O1xuXG4vKipcbiAqIGluc2VydHMgYSBzcHJpdGUgYmVmb3JlIHRoZSBzcGVjaWZpZWQgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBpbnNlcnRCZWZvcmVcbiAqIEBwYXJhbSBzcHJpdGUge1Nwcml0ZX0gdGhlIHNwcml0ZSB0byBiZSBhZGRlZFxuICogQHBhcmFtIG5leHRTcHJpdGUge25leHRTcHJpdGV9IHRoZSBmaXJzdCBzcHJpdGUgd2lsbCBiZSBpbnNlcnRlZCBiZWZvcmUgdGhpcyBzcHJpdGVcbiAqL1xucHJvdG8uaW5zZXJ0QmVmb3JlID0gZnVuY3Rpb24gaW5zZXJ0QmVmb3JlKHNwcml0ZSwgbmV4dFNwcml0ZSlcbntcbiAgICB0aGlzLnNpemUrKztcblxuICAgIHNwcml0ZS5iYXRjaCA9IHRoaXM7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgdmFyIHRlbXBQcmV2ID0gbmV4dFNwcml0ZS5fX3ByZXY7XG4gICAgbmV4dFNwcml0ZS5fX3ByZXYgPSBzcHJpdGU7XG4gICAgc3ByaXRlLl9fbmV4dCA9IG5leHRTcHJpdGU7XG5cbiAgICBpZih0ZW1wUHJldilcbiAgICB7XG4gICAgICAgIHNwcml0ZS5fX3ByZXYgPSB0ZW1wUHJldjtcbiAgICAgICAgdGVtcFByZXYuX19uZXh0ID0gc3ByaXRlO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLmhlYWQgPSBzcHJpdGU7XG4gICAgfVxufTtcblxuLyoqXG4gKiBpbnNlcnRzIGEgc3ByaXRlIGFmdGVyIHRoZSBzcGVjaWZpZWQgc3ByaXRlXG4gKlxuICogQG1ldGhvZCBpbnNlcnRBZnRlclxuICogQHBhcmFtIHNwcml0ZSB7U3ByaXRlfSB0aGUgc3ByaXRlIHRvIGJlIGFkZGVkXG4gKiBAcGFyYW0gIHByZXZpb3VzU3ByaXRlIHtTcHJpdGV9IHRoZSBmaXJzdCBzcHJpdGUgd2lsbCBiZSBpbnNlcnRlZCBhZnRlciB0aGlzIHNwcml0ZVxuICovXG5wcm90by5pbnNlcnRBZnRlciA9IGZ1bmN0aW9uIGluc2VydEFmdGVyKHNwcml0ZSwgcHJldmlvdXNTcHJpdGUpXG57XG4gICAgdGhpcy5zaXplKys7XG5cbiAgICBzcHJpdGUuYmF0Y2ggPSB0aGlzO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuXG4gICAgdmFyIHRlbXBOZXh0ID0gcHJldmlvdXNTcHJpdGUuX19uZXh0O1xuICAgIHByZXZpb3VzU3ByaXRlLl9fbmV4dCA9IHNwcml0ZTtcbiAgICBzcHJpdGUuX19wcmV2ID0gcHJldmlvdXNTcHJpdGU7XG5cbiAgICBpZih0ZW1wTmV4dClcbiAgICB7XG4gICAgICAgIHNwcml0ZS5fX25leHQgPSB0ZW1wTmV4dDtcbiAgICAgICAgdGVtcE5leHQuX19wcmV2ID0gc3ByaXRlO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLnRhaWwgPSBzcHJpdGU7XG4gICAgfVxufTtcblxuLyoqXG4gKiByZW1vdmVzIGEgc3ByaXRlIGZyb20gdGhlIGJhdGNoXG4gKlxuICogQG1ldGhvZCByZW1vdmVcbiAqIEBwYXJhbSBzcHJpdGUge1Nwcml0ZX0gdGhlIHNwcml0ZSB0byBiZSByZW1vdmVkXG4gKi9cbnByb3RvLnJlbW92ZSA9IGZ1bmN0aW9uIHJlbW92ZShzcHJpdGUpXG57XG4gICAgdGhpcy5zaXplLS07XG5cbiAgICBpZiAoIXRoaXMuc2l6ZSlcbiAgICB7XG4gICAgICAgIHNwcml0ZS5iYXRjaCA9IG51bGw7XG4gICAgICAgIHNwcml0ZS5fX3ByZXYgPSBudWxsO1xuICAgICAgICBzcHJpdGUuX19uZXh0ID0gbnVsbDtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKHNwcml0ZS5fX3ByZXYpXG4gICAge1xuICAgICAgICBzcHJpdGUuX19wcmV2Ll9fbmV4dCA9IHNwcml0ZS5fX25leHQ7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMuaGVhZCA9IHNwcml0ZS5fX25leHQ7XG4gICAgICAgIHRoaXMuaGVhZC5fX3ByZXYgPSBudWxsO1xuICAgIH1cblxuICAgIGlmKHNwcml0ZS5fX25leHQpXG4gICAge1xuICAgICAgICBzcHJpdGUuX19uZXh0Ll9fcHJldiA9IHNwcml0ZS5fX3ByZXY7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMudGFpbCA9IHNwcml0ZS5fX3ByZXY7XG4gICAgICAgIHRoaXMudGFpbC5fX25leHQgPSBudWxsO1xuICAgIH1cblxuICAgIHNwcml0ZS5iYXRjaCA9IG51bGw7XG4gICAgc3ByaXRlLl9fbmV4dCA9IG51bGw7XG4gICAgc3ByaXRlLl9fcHJldiA9IG51bGw7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG59O1xuXG4vKipcbiAqIFNwbGl0cyB0aGUgYmF0Y2ggaW50byB0d28gd2l0aCB0aGUgc3BlY2lmaWVkIHNwcml0ZSBiZWluZyB0aGUgc3RhcnQgb2YgdGhlIG5ldyBiYXRjaC5cbiAqXG4gKiBAbWV0aG9kIHNwbGl0XG4gKiBAcGFyYW0gc3ByaXRlIHtTcHJpdGV9IHRoZSBzcHJpdGUgdGhhdCBpbmRpY2F0ZXMgd2hlcmUgdGhlIGJhdGNoIHNob3VsZCBiZSBzcGxpdFxuICogQHJldHVybiB7V2ViR0xCYXRjaH0gdGhlIG5ldyBiYXRjaFxuICovXG5wcm90by5zcGxpdCA9IGZ1bmN0aW9uIHNwbGl0KHNwcml0ZSlcbntcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcblxuICAgIHZhciBiYXRjaCA9IG5ldyBXZWJHTEJhdGNoKHRoaXMuZ2wpO1xuICAgIGJhdGNoLmluaXQoc3ByaXRlKTtcbiAgICBiYXRjaC50ZXh0dXJlID0gdGhpcy50ZXh0dXJlO1xuICAgIGJhdGNoLnRhaWwgPSB0aGlzLnRhaWw7XG5cbiAgICB0aGlzLnRhaWwgPSBzcHJpdGUuX19wcmV2O1xuICAgIHRoaXMudGFpbC5fX25leHQgPSBudWxsO1xuXG4gICAgc3ByaXRlLl9fcHJldiA9IG51bGw7XG4gICAgLy8gcmV0dXJuIGEgc3BsaXRlIGJhdGNoIVxuXG4gICAgLy8gVE9ETyB0aGlzIHNpemUgaXMgd3JvbmchXG4gICAgLy8gbmVlZCB0byByZWNhbGN1bGF0ZSA6LyBwcm9ibGVtIHdpdGggYSBsaW5rZWQgbGlzdCFcbiAgICAvLyB1bmxlc3MgaXQgZ2V0cyBjYWxjdWxhdGVkIGluIHRoZSBcImNsZWFuXCI/XG5cbiAgICAvLyBuZWVkIHRvIGxvb3AgdGhyb3VnaCBpdGVtcyBhcyB0aGVyZSBpcyBubyB3YXkgdG8ga25vdyB0aGUgbGVuZ3RoIG9uIGEgbGlua2VkIGxpc3QgOi9cbiAgICB2YXIgdGVtcFNpemUgPSAwO1xuICAgIHdoaWxlKHNwcml0ZSlcbiAgICB7XG4gICAgICAgIHRlbXBTaXplKys7XG4gICAgICAgIHNwcml0ZS5iYXRjaCA9IGJhdGNoO1xuICAgICAgICBzcHJpdGUgPSBzcHJpdGUuX19uZXh0O1xuICAgIH1cblxuICAgIGJhdGNoLnNpemUgPSB0ZW1wU2l6ZTtcbiAgICB0aGlzLnNpemUgLT0gdGVtcFNpemU7XG5cbiAgICByZXR1cm4gYmF0Y2g7XG59O1xuXG4vKipcbiAqIE1lcmdlcyB0d28gYmF0Y2hzIHRvZ2V0aGVyXG4gKlxuICogQG1ldGhvZCBtZXJnZVxuICogQHBhcmFtIGJhdGNoIHtXZWJHTEJhdGNofSB0aGUgYmF0Y2ggdGhhdCB3aWxsIGJlIG1lcmdlZFxuICovXG5wcm90by5tZXJnZSA9IGZ1bmN0aW9uIG1lcmdlKGJhdGNoKVxue1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuXG4gICAgdGhpcy50YWlsLl9fbmV4dCA9IGJhdGNoLmhlYWQ7XG4gICAgYmF0Y2guaGVhZC5fX3ByZXYgPSB0aGlzLnRhaWw7XG5cbiAgICB0aGlzLnNpemUgKz0gYmF0Y2guc2l6ZTtcblxuICAgIHRoaXMudGFpbCA9IGJhdGNoLnRhaWw7XG5cbiAgICB2YXIgc3ByaXRlID0gYmF0Y2guaGVhZDtcbiAgICB3aGlsZShzcHJpdGUpXG4gICAge1xuICAgICAgICBzcHJpdGUuYmF0Y2ggPSB0aGlzO1xuICAgICAgICBzcHJpdGUgPSBzcHJpdGUuX19uZXh0O1xuICAgIH1cbn07XG5cbi8qKlxuICogR3Jvd3MgdGhlIHNpemUgb2YgdGhlIGJhdGNoLiBBcyB0aGUgZWxlbWVudHMgaW4gdGhlIGJhdGNoIGNhbm5vdCBoYXZlIGEgZHluYW1pYyBzaXplIHRoaXNcbiAqIGZ1bmN0aW9uIGlzIHVzZWQgdG8gaW5jcmVhc2UgdGhlIHNpemUgb2YgdGhlIGJhdGNoLiBJdCBhbHNvIGNyZWF0ZXMgYSBsaXR0bGUgZXh0cmEgcm9vbSBzb1xuICogdGhhdCB0aGUgYmF0Y2ggZG9lcyBub3QgbmVlZCB0byBiZSByZXNpemVkIGV2ZXJ5IHRpbWUgYSBzcHJpdGUgaXMgYWRkZWRcbiAqXG4gKiBAbWV0aG9kIGdyb3dCYXRjaFxuICovXG5wcm90by5ncm93QmF0Y2ggPSBmdW5jdGlvbiBncm93QmF0Y2goKVxue1xuICAgIHZhciBnbCA9IHRoaXMuZ2w7XG4gICAgaWYoIHRoaXMuc2l6ZSA9PT0gMSlcbiAgICB7XG4gICAgICAgIHRoaXMuZHluYW1pY1NpemUgPSAxO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0aGlzLmR5bmFtaWNTaXplID0gdGhpcy5zaXplICogMS41O1xuICAgIH1cblxuICAgIC8vIGdyb3cgdmVydHNcbiAgICB0aGlzLnZlcnRpY2llcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5keW5hbWljU2l6ZSAqIDgpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUix0aGlzLnZlcnRpY2llcyAsIGdsLkRZTkFNSUNfRFJBVyk7XG5cbiAgICB0aGlzLnV2cyAgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLmR5bmFtaWNTaXplICogOCApO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnV2QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy51dnMgLCBnbC5EWU5BTUlDX0RSQVcpO1xuXG4gICAgdGhpcy5kaXJ0eVVWUyA9IHRydWU7XG5cbiAgICB0aGlzLmNvbG9ycyAgPSBuZXcgRmxvYXQzMkFycmF5KCB0aGlzLmR5bmFtaWNTaXplICogNCApO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLmNvbG9yQnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy5jb2xvcnMgLCBnbC5EWU5BTUlDX0RSQVcpO1xuXG4gICAgdGhpcy5kaXJ0eUNvbG9ycyA9IHRydWU7XG5cbiAgICB0aGlzLmluZGljZXMgPSBuZXcgVWludDE2QXJyYXkodGhpcy5keW5hbWljU2l6ZSAqIDYpO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmluZGljZXMubGVuZ3RoLzY7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgaW5kZXgyID0gaSAqIDY7XG4gICAgICAgIHZhciBpbmRleDMgPSBpICogNDtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDBdID0gaW5kZXgzICsgMDtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDFdID0gaW5kZXgzICsgMTtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDJdID0gaW5kZXgzICsgMjtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDNdID0gaW5kZXgzICsgMDtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDRdID0gaW5kZXgzICsgMjtcbiAgICAgICAgdGhpcy5pbmRpY2VzW2luZGV4MiArIDVdID0gaW5kZXgzICsgMztcbiAgICB9XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCB0aGlzLmluZGljZXMsIGdsLlNUQVRJQ19EUkFXKTtcbn07XG5cbi8qKlxuICogUmVmcmVzaCdzIGFsbCB0aGUgZGF0YSBpbiB0aGUgYmF0Y2ggYW5kIHN5bmMncyBpdCB3aXRoIHRoZSB3ZWJHTCBidWZmZXJzXG4gKlxuICogQG1ldGhvZCByZWZyZXNoXG4gKi9cbnByb3RvLnJlZnJlc2ggPSBmdW5jdGlvbiByZWZyZXNoKClcbntcbiAgICBpZiAodGhpcy5keW5hbWljU2l6ZSA8IHRoaXMuc2l6ZSlcbiAgICB7XG4gICAgICAgIHRoaXMuZ3Jvd0JhdGNoKCk7XG4gICAgfVxuXG4gICAgdmFyIGluZGV4UnVuID0gMDtcbiAgICB2YXIgaW5kZXgsIGNvbG9ySW5kZXg7XG5cbiAgICB2YXIgZGlzcGxheU9iamVjdCA9IHRoaXMuaGVhZDtcblxuICAgIHdoaWxlKGRpc3BsYXlPYmplY3QpXG4gICAge1xuICAgICAgICBpbmRleCA9IGluZGV4UnVuICogODtcblxuICAgICAgICB2YXIgdGV4dHVyZSA9IGRpc3BsYXlPYmplY3QudGV4dHVyZTtcblxuICAgICAgICB2YXIgZnJhbWUgPSB0ZXh0dXJlLmZyYW1lO1xuICAgICAgICB2YXIgdHcgPSB0ZXh0dXJlLmJhc2VUZXh0dXJlLndpZHRoO1xuICAgICAgICB2YXIgdGggPSB0ZXh0dXJlLmJhc2VUZXh0dXJlLmhlaWdodDtcblxuICAgICAgICB0aGlzLnV2c1tpbmRleCArIDBdID0gZnJhbWUueCAvIHR3O1xuICAgICAgICB0aGlzLnV2c1tpbmRleCArMV0gPSBmcmFtZS55IC8gdGg7XG5cbiAgICAgICAgdGhpcy51dnNbaW5kZXggKzJdID0gKGZyYW1lLnggKyBmcmFtZS53aWR0aCkgLyB0dztcbiAgICAgICAgdGhpcy51dnNbaW5kZXggKzNdID0gZnJhbWUueSAvIHRoO1xuXG4gICAgICAgIHRoaXMudXZzW2luZGV4ICs0XSA9IChmcmFtZS54ICsgZnJhbWUud2lkdGgpIC8gdHc7XG4gICAgICAgIHRoaXMudXZzW2luZGV4ICs1XSA9IChmcmFtZS55ICsgZnJhbWUuaGVpZ2h0KSAvIHRoO1xuXG4gICAgICAgIHRoaXMudXZzW2luZGV4ICs2XSA9IGZyYW1lLnggLyB0dztcbiAgICAgICAgdGhpcy51dnNbaW5kZXggKzddID0gKGZyYW1lLnkgKyBmcmFtZS5oZWlnaHQpIC8gdGg7XG5cbiAgICAgICAgZGlzcGxheU9iamVjdC51cGRhdGVGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIGNvbG9ySW5kZXggPSBpbmRleFJ1biAqIDQ7XG4gICAgICAgIHRoaXMuY29sb3JzW2NvbG9ySW5kZXhdID0gdGhpcy5jb2xvcnNbY29sb3JJbmRleCArIDFdID0gdGhpcy5jb2xvcnNbY29sb3JJbmRleCArIDJdID0gdGhpcy5jb2xvcnNbY29sb3JJbmRleCArIDNdID0gZGlzcGxheU9iamVjdC53b3JsZEFscGhhO1xuXG4gICAgICAgIGRpc3BsYXlPYmplY3QgPSBkaXNwbGF5T2JqZWN0Ll9fbmV4dDtcblxuICAgICAgICBpbmRleFJ1bisrO1xuICAgIH1cblxuICAgIHRoaXMuZGlydHlVVlMgPSB0cnVlO1xuICAgIHRoaXMuZGlydHlDb2xvcnMgPSB0cnVlO1xufTtcblxuLyoqXG4gKiBVcGRhdGVzIGFsbCB0aGUgcmVsZXZhbnQgZ2VvbWV0cnkgYW5kIHVwbG9hZHMgdGhlIGRhdGEgdG8gdGhlIEdQVVxuICpcbiAqIEBtZXRob2QgdXBkYXRlXG4gKi9cbnByb3RvLnVwZGF0ZSA9IGZ1bmN0aW9uIHVwZGF0ZSgpXG57XG4gICAgdmFyIHdvcmxkVHJhbnNmb3JtLCB3aWR0aCwgaGVpZ2h0LCBhWCwgYVksIHcwLCB3MSwgaDAsIGgxLCBpbmRleDtcblxuICAgIHZhciBhLCBiLCBjLCBkLCB0eCwgdHk7XG5cbiAgICB2YXIgaW5kZXhSdW4gPSAwO1xuXG4gICAgdmFyIGRpc3BsYXlPYmplY3QgPSB0aGlzLmhlYWQ7XG4gICAgdmFyIHZlcnRpY2llcyA9IHRoaXMudmVydGljaWVzO1xuICAgIHZhciB1dnMgPSB0aGlzLnV2cztcbiAgICB2YXIgY29sb3JzID0gdGhpcy5jb2xvcnM7XG5cbiAgICB3aGlsZShkaXNwbGF5T2JqZWN0KVxuICAgIHtcbiAgICAgICAgaWYoZGlzcGxheU9iamVjdC52Y291bnQgPT09IGdsb2JhbHMudmlzaWJsZUNvdW50KVxuICAgICAgICB7XG4gICAgICAgICAgICB3aWR0aCA9IGRpc3BsYXlPYmplY3QudGV4dHVyZS5mcmFtZS53aWR0aDtcbiAgICAgICAgICAgIGhlaWdodCA9IGRpc3BsYXlPYmplY3QudGV4dHVyZS5mcmFtZS5oZWlnaHQ7XG5cbiAgICAgICAgICAgIC8vIFRPRE8gdHJpbT8/XG4gICAgICAgICAgICBhWCA9IGRpc3BsYXlPYmplY3QuYW5jaG9yLng7Ly8gLSBkaXNwbGF5T2JqZWN0LnRleHR1cmUudHJpbS54XG4gICAgICAgICAgICBhWSA9IGRpc3BsYXlPYmplY3QuYW5jaG9yLnk7IC8vLSBkaXNwbGF5T2JqZWN0LnRleHR1cmUudHJpbS55XG4gICAgICAgICAgICB3MCA9IHdpZHRoICogKDEtYVgpO1xuICAgICAgICAgICAgdzEgPSB3aWR0aCAqIC1hWDtcblxuICAgICAgICAgICAgaDAgPSBoZWlnaHQgKiAoMS1hWSk7XG4gICAgICAgICAgICBoMSA9IGhlaWdodCAqIC1hWTtcblxuICAgICAgICAgICAgaW5kZXggPSBpbmRleFJ1biAqIDg7XG5cbiAgICAgICAgICAgIHdvcmxkVHJhbnNmb3JtID0gZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybTtcblxuICAgICAgICAgICAgYSA9IHdvcmxkVHJhbnNmb3JtWzBdO1xuICAgICAgICAgICAgYiA9IHdvcmxkVHJhbnNmb3JtWzNdO1xuICAgICAgICAgICAgYyA9IHdvcmxkVHJhbnNmb3JtWzFdO1xuICAgICAgICAgICAgZCA9IHdvcmxkVHJhbnNmb3JtWzRdO1xuICAgICAgICAgICAgdHggPSB3b3JsZFRyYW5zZm9ybVsyXTtcbiAgICAgICAgICAgIHR5ID0gd29ybGRUcmFuc2Zvcm1bNV07XG5cbiAgICAgICAgICAgIHZlcnRpY2llc1tpbmRleCArIDAgXSA9IGEgKiB3MSArIGMgKiBoMSArIHR4O1xuICAgICAgICAgICAgdmVydGljaWVzW2luZGV4ICsgMSBdID0gZCAqIGgxICsgYiAqIHcxICsgdHk7XG5cbiAgICAgICAgICAgIHZlcnRpY2llc1tpbmRleCArIDIgXSA9IGEgKiB3MCArIGMgKiBoMSArIHR4O1xuICAgICAgICAgICAgdmVydGljaWVzW2luZGV4ICsgMyBdID0gZCAqIGgxICsgYiAqIHcwICsgdHk7XG5cbiAgICAgICAgICAgIHZlcnRpY2llc1tpbmRleCArIDQgXSA9IGEgKiB3MCArIGMgKiBoMCArIHR4O1xuICAgICAgICAgICAgdmVydGljaWVzW2luZGV4ICsgNSBdID0gZCAqIGgwICsgYiAqIHcwICsgdHk7XG5cbiAgICAgICAgICAgIHZlcnRpY2llc1tpbmRleCArIDZdID0gIGEgKiB3MSArIGMgKiBoMCArIHR4O1xuICAgICAgICAgICAgdmVydGljaWVzW2luZGV4ICsgN10gPSAgZCAqIGgwICsgYiAqIHcxICsgdHk7XG5cbiAgICAgICAgICAgIGlmKGRpc3BsYXlPYmplY3QudXBkYXRlRnJhbWUgfHwgZGlzcGxheU9iamVjdC50ZXh0dXJlLnVwZGF0ZUZyYW1lKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlydHlVVlMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgdmFyIHRleHR1cmUgPSBkaXNwbGF5T2JqZWN0LnRleHR1cmU7XG5cbiAgICAgICAgICAgICAgICB2YXIgZnJhbWUgPSB0ZXh0dXJlLmZyYW1lO1xuICAgICAgICAgICAgICAgIHZhciB0dyA9IHRleHR1cmUuYmFzZVRleHR1cmUud2lkdGg7XG4gICAgICAgICAgICAgICAgdmFyIHRoID0gdGV4dHVyZS5iYXNlVGV4dHVyZS5oZWlnaHQ7XG5cbiAgICAgICAgICAgICAgICB1dnNbaW5kZXggKyAwXSA9IGZyYW1lLnggLyB0dztcbiAgICAgICAgICAgICAgICB1dnNbaW5kZXggKzFdID0gZnJhbWUueSAvIHRoO1xuXG4gICAgICAgICAgICAgICAgdXZzW2luZGV4ICsyXSA9IChmcmFtZS54ICsgZnJhbWUud2lkdGgpIC8gdHc7XG4gICAgICAgICAgICAgICAgdXZzW2luZGV4ICszXSA9IGZyYW1lLnkgLyB0aDtcblxuICAgICAgICAgICAgICAgIHV2c1tpbmRleCArNF0gPSAoZnJhbWUueCArIGZyYW1lLndpZHRoKSAvIHR3O1xuICAgICAgICAgICAgICAgIHV2c1tpbmRleCArNV0gPSAoZnJhbWUueSArIGZyYW1lLmhlaWdodCkgLyB0aDtcblxuICAgICAgICAgICAgICAgIHV2c1tpbmRleCArNl0gPSBmcmFtZS54IC8gdHc7XG4gICAgICAgICAgICAgICAgdXZzW2luZGV4ICs3XSA9IChmcmFtZS55ICsgZnJhbWUuaGVpZ2h0KSAvIHRoO1xuXG4gICAgICAgICAgICAgICAgZGlzcGxheU9iamVjdC51cGRhdGVGcmFtZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUT0RPIHRoaXMgcHJvYmFibHkgY291bGQgZG8gd2l0aCBzb21lIG9wdGltaXNhdGlvbi4uLi5cbiAgICAgICAgICAgIGlmKGRpc3BsYXlPYmplY3QuY2FjaGVBbHBoYSAhPT0gZGlzcGxheU9iamVjdC53b3JsZEFscGhhKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRpc3BsYXlPYmplY3QuY2FjaGVBbHBoYSA9IGRpc3BsYXlPYmplY3Qud29ybGRBbHBoYTtcblxuICAgICAgICAgICAgICAgIHZhciBjb2xvckluZGV4ID0gaW5kZXhSdW4gKiA0O1xuICAgICAgICAgICAgICAgIGNvbG9yc1tjb2xvckluZGV4XSA9IGNvbG9yc1tjb2xvckluZGV4ICsgMV0gPSBjb2xvcnNbY29sb3JJbmRleCArIDJdID0gY29sb3JzW2NvbG9ySW5kZXggKyAzXSA9IGRpc3BsYXlPYmplY3Qud29ybGRBbHBoYTtcbiAgICAgICAgICAgICAgICB0aGlzLmRpcnR5Q29sb3JzID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIGluZGV4ID0gaW5kZXhSdW4gKiA4O1xuXG4gICAgICAgICAgICB2ZXJ0aWNpZXNbaW5kZXggKyAwIF0gPSB2ZXJ0aWNpZXNbaW5kZXggKyAxIF0gPSB2ZXJ0aWNpZXNbaW5kZXggKyAyIF0gPSB2ZXJ0aWNpZXNbaW5kZXggKyAzIF0gPSB2ZXJ0aWNpZXNbaW5kZXggKyA0IF0gPSB2ZXJ0aWNpZXNbaW5kZXggKyA1IF0gPSB2ZXJ0aWNpZXNbaW5kZXggKyA2XSA9ICB2ZXJ0aWNpZXNbaW5kZXggKyA3XSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpbmRleFJ1bisrO1xuICAgICAgICBkaXNwbGF5T2JqZWN0ID0gZGlzcGxheU9iamVjdC5fX25leHQ7XG4gICAgfVxufTtcblxuLyoqXG4gKiBEcmF3cyB0aGUgYmF0Y2ggdG8gdGhlIGZyYW1lIGJ1ZmZlclxuICpcbiAqIEBtZXRob2QgcmVuZGVyXG4gKi9cbnByb3RvLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcihzdGFydCwgZW5kKVxue1xuICAgIHN0YXJ0ID0gc3RhcnQgfHwgMDtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikgZW5kID0gdGhpcy5zaXplO1xuXG4gICAgaWYodGhpcy5kaXJ0eSlcbiAgICB7XG4gICAgICAgIHRoaXMucmVmcmVzaCgpO1xuICAgICAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnNpemUpIHJldHVybjtcblxuICAgIHRoaXMudXBkYXRlKCk7XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIC8vVE9ETyBvcHRpbWl6ZSB0aGlzIVxuXG4gICAgdmFyIHNoYWRlclByb2dyYW0gPSBnbG9iYWxzLmRlZmF1bHRTaGFkZXI7XG5cbiAgICAvL2dsLnVzZVByb2dyYW0oc2hhZGVyUHJvZ3JhbSk7XG5cbiAgICAvLyB1cGRhdGUgdGhlIHZlcnRzLi5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICAgIC8vIG9rLi5cbiAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdGhpcy52ZXJ0aWNpZXMpO1xuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyUHJvZ3JhbS5hVmVydGV4UG9zaXRpb24sIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG4gICAgLy8gdXBkYXRlIHRoZSB1dnNcbiAgICAvL3ZhciBpc0RlZmF1bHQgPSAoc2hhZGVyUHJvZ3JhbSA9PSBnbG9iYWxzLnNoYWRlclByb2dyYW0pXG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy51dkJ1ZmZlcik7XG5cbiAgICBpZih0aGlzLmRpcnR5VVZTKVxuICAgIHtcbiAgICAgICAgdGhpcy5kaXJ0eVVWUyA9IGZhbHNlO1xuICAgICAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgIDAsIHRoaXMudXZzKTtcbiAgICB9XG5cbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlclByb2dyYW0uYVRleHR1cmVDb29yZCwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgIGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTApO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRoaXMudGV4dHVyZS5fZ2xUZXh0dXJlKTtcblxuICAgIC8vIHVwZGF0ZSBjb2xvciFcbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy5jb2xvckJ1ZmZlcik7XG5cbiAgICBpZih0aGlzLmRpcnR5Q29sb3JzKVxuICAgIHtcbiAgICAgICAgdGhpcy5kaXJ0eUNvbG9ycyA9IGZhbHNlO1xuICAgICAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdGhpcy5jb2xvcnMpO1xuICAgIH1cblxuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyUHJvZ3JhbS5jb2xvckF0dHJpYnV0ZSwgMSwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcbiAgICAvLyBkb250IG5lZWQgdG8gdXBsb2FkIVxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHRoaXMuaW5kZXhCdWZmZXIpO1xuXG4gICAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0O1xuXG4gICAgLy8gRFJBVyBUSEFUIHRoaXMhXG4gICAgZ2wuZHJhd0VsZW1lbnRzKGdsLlRSSUFOR0xFUywgbGVuICogNiwgZ2wuVU5TSUdORURfU0hPUlQsIHN0YXJ0ICogMiAqIDYgKTtcbn07XG5cbi8qKlxuICogSW50ZXJuYWwgV2ViR0xCYXRjaCBwb29sXG4gKlxuICogQHByaXZhdGVcbiAqL1xudmFyIGJhdGNoZXMgPSBbXTtcblxuLyoqXG4gKiBDYWxsIHdoZW4gcmVzdG9yaW5nIGEgbG9zdCBjb250ZXh0XG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCByZXN0b3JlQmF0Y2hlc1xuICogQHJldHVybiB2b2lkXG4gKi9cbldlYkdMQmF0Y2gucmVzdG9yZUJhdGNoZXMgPSBmdW5jdGlvbiByZXN0b3JlQmF0Y2hlcyhnbClcbntcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGJhdGNoZXMubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgIHtcbiAgICAgICAgYmF0Y2hlc1tpXS5yZXN0b3JlTG9zdENvbnRleHQoZ2wpO1xuICAgIH1cbn07XG5cbi8qKlxuICogR2V0cyBhIG5ldyBXZWJHTEJhdGNoIGZyb20gdGhlIHBvb2xcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGdldEJhdGNoXG4gKiBAcmV0dXJuIHtXZWJHTEJhdGNofVxuICovXG5XZWJHTEJhdGNoLmdldEJhdGNoID0gZnVuY3Rpb24gZ2V0QmF0Y2goKVxue1xuICAgIGlmICghYmF0Y2hlcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJHTEJhdGNoKGdsb2JhbHMuZ2wpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBiYXRjaGVzLnBvcCgpO1xuICAgIH1cbn07XG5cbi8qKlxuICogUHV0cyBhIGJhdGNoIGJhY2sgaW50byB0aGUgcG9vbFxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZXRob2QgcmV0dXJuQmF0Y2hcbiAqIEBwYXJhbSBiYXRjaCB7V2ViR0xCYXRjaH0gVGhlIGJhdGNoIHRvIHJldHVyblxuICovXG5XZWJHTEJhdGNoLnJldHVybkJhdGNoID0gZnVuY3Rpb24gcmV0dXJuQmF0Y2goYmF0Y2gpXG57XG4gICAgYmF0Y2guY2xlYW4oKTtcbiAgICBiYXRjaGVzLnB1c2goYmF0Y2gpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBXZWJHTEJhdGNoO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xudmFyIFNwcml0ZSA9IHJlcXVpcmUoJy4uLy4uL2Rpc3BsYXkvU3ByaXRlJyk7XG52YXIgR3JhcGhpY3MgPSByZXF1aXJlKCcuLi8uLi9wcmltaXRpdmVzL0dyYXBoaWNzJyk7XG52YXIgUGl4aVNoYWRlciA9IHJlcXVpcmUoJy4vUGl4aVNoYWRlcicpO1xuXG5mdW5jdGlvbiBGaWx0ZXJUZXh0dXJlKHdpZHRoLCBoZWlnaHQpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIC8vIG5leHQgdGltZSB0byBjcmVhdGUgYSBmcmFtZSBidWZmZXIgYW5kIHRleHR1cmVcbiAgICB0aGlzLmZyYW1lQnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcbiAgICB0aGlzLnRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG5cbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCAgdGhpcy50ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZnJhbWVidWZmZXIgKTtcblxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5mcmFtZUJ1ZmZlciApO1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgdGhpcy50ZXh0dXJlLCAwKTtcblxuICAgIHRoaXMucmVzaXplKHdpZHRoLCBoZWlnaHQpO1xufVxuXG5GaWx0ZXJUZXh0dXJlLnByb3RvdHlwZS5yZXNpemUgPSBmdW5jdGlvbiByZXNpemUod2lkdGgsIGhlaWdodClcbntcbiAgICBpZih0aGlzLndpZHRoID09PSB3aWR0aCAmJiB0aGlzLmhlaWdodCA9PT0gaGVpZ2h0KSByZXR1cm47XG5cbiAgICB0aGlzLndpZHRoID0gd2lkdGg7XG4gICAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgIHRoaXMudGV4dHVyZSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAgd2lkdGgsIGhlaWdodCwgMCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgbnVsbCk7XG5cbn07XG5cbmZ1bmN0aW9uIFdlYkdMRmlsdGVyTWFuYWdlcih0cmFuc3BhcmVudClcbntcbiAgICB0aGlzLnRyYW5zcGFyZW50ID0gdHJhbnNwYXJlbnQ7XG5cbiAgICB0aGlzLmZpbHRlclN0YWNrID0gW107XG4gICAgdGhpcy50ZXh0dXJlUG9vbCA9IFtdO1xuXG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuXG4gICAgdGhpcy5pbml0U2hhZGVyQnVmZmVycygpO1xufVxuXG52YXIgcHJvdG8gPSBXZWJHTEZpbHRlck1hbmFnZXIucHJvdG90eXBlO1xuXG4vLyBBUElcblxucHJvdG8uYmVnaW4gPSBmdW5jdGlvbiBiZWdpbihwcm9qZWN0aW9uLCBidWZmZXIpXG57XG4gICAgdGhpcy53aWR0aCA9IHByb2plY3Rpb24ueCAqIDI7XG4gICAgdGhpcy5oZWlnaHQgPSAtcHJvamVjdGlvbi55ICogMjtcbiAgICB0aGlzLmJ1ZmZlciA9IGJ1ZmZlcjtcbn07XG5cbnByb3RvLnB1c2hGaWx0ZXIgPSBmdW5jdGlvbiBwdXNoRmlsdGVyKGZpbHRlckJsb2NrKVxue1xuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG5cbiAgICAvLyBmaWx0ZXIgcHJvZ3JhbVxuICAgIC8vIE9QVElNSVNBVElPTiAtIHRoZSBmaXJzdCBmaWx0ZXIgaXMgZnJlZSBpZiBpdHMgYSBzaW1wbGUgY29sb3IgY2hhbmdlP1xuICAgIHRoaXMuZmlsdGVyU3RhY2sucHVzaChmaWx0ZXJCbG9jayk7XG5cbiAgICB2YXIgZmlsdGVyID0gZmlsdGVyQmxvY2suZmlsdGVyUGFzc2VzWzBdO1xuXG4gICAgdGhpcy5vZmZzZXRYICs9IGZpbHRlckJsb2NrLnRhcmdldC5maWx0ZXJBcmVhLng7XG4gICAgdGhpcy5vZmZzZXRZICs9IGZpbHRlckJsb2NrLnRhcmdldC5maWx0ZXJBcmVhLnk7XG5cbiAgICB2YXIgdGV4dHVyZSA9IHRoaXMudGV4dHVyZVBvb2wucG9wKCk7XG4gICAgaWYoIXRleHR1cmUpXG4gICAge1xuICAgICAgICB0ZXh0dXJlID0gbmV3IEZpbHRlclRleHR1cmUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICB0ZXh0dXJlLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgfVxuXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgIHRleHR1cmUudGV4dHVyZSk7XG5cbiAgICB0aGlzLmdldEJvdW5kcyhmaWx0ZXJCbG9jay50YXJnZXQpO1xuXG4gICAgLy8gYWRkcGFkZGluZz9cbiAgICAvL2Rpc3BsYXlPYmplY3QuZmlsdGVyQXJlYS54XG5cbiAgICB2YXIgZmlsdGVyQXJlYSA9IGZpbHRlckJsb2NrLnRhcmdldC5maWx0ZXJBcmVhO1xuXG4gICAgdmFyIHBhZGlkbmcgPSBmaWx0ZXIucGFkZGluZztcbiAgICBmaWx0ZXJBcmVhLnggLT0gcGFkaWRuZztcbiAgICBmaWx0ZXJBcmVhLnkgLT0gcGFkaWRuZztcbiAgICBmaWx0ZXJBcmVhLndpZHRoICs9IHBhZGlkbmcgKiAyO1xuICAgIGZpbHRlckFyZWEuaGVpZ2h0ICs9IHBhZGlkbmcgKiAyO1xuXG4gICAgLy8gY2FwIGZpbHRlciB0byBzY3JlZW4gc2l6ZS4uXG4gICAgaWYoZmlsdGVyQXJlYS54IDwgMClmaWx0ZXJBcmVhLnggPSAwO1xuICAgIGlmKGZpbHRlckFyZWEud2lkdGggPiB0aGlzLndpZHRoKWZpbHRlckFyZWEud2lkdGggPSB0aGlzLndpZHRoO1xuICAgIGlmKGZpbHRlckFyZWEueSA8IDApZmlsdGVyQXJlYS55ID0gMDtcbiAgICBpZihmaWx0ZXJBcmVhLmhlaWdodCA+IHRoaXMuaGVpZ2h0KWZpbHRlckFyZWEuaGVpZ2h0ID0gdGhpcy5oZWlnaHQ7XG5cbiAgICAvL2dsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgIGZpbHRlckFyZWEud2lkdGgsIGZpbHRlckFyZWEuaGVpZ2h0LCAwLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRleHR1cmUuZnJhbWVCdWZmZXIpO1xuXG4gICAgLy9jb25zb2xlLmxvZyhmaWx0ZXJBcmVhKVxuICAgIC8vIHNldCB2aWV3IHBvcnRcbiAgICBnbC52aWV3cG9ydCgwLCAwLCBmaWx0ZXJBcmVhLndpZHRoLCBmaWx0ZXJBcmVhLmhlaWdodCk7XG5cbiAgICAvLyBUT0RPIG5lZWQgdG8gcmVtb3ZlIHRoZXNlIGdsb2JhbCBlbGVtZW50cy4uXG4gICAgZ2xvYmFscy5wcm9qZWN0aW9uLnggPSBmaWx0ZXJBcmVhLndpZHRoLzI7XG4gICAgZ2xvYmFscy5wcm9qZWN0aW9uLnkgPSAtZmlsdGVyQXJlYS5oZWlnaHQvMjtcblxuICAgIGdsb2JhbHMub2Zmc2V0LnggPSAtZmlsdGVyQXJlYS54O1xuICAgIGdsb2JhbHMub2Zmc2V0LnkgPSAtZmlsdGVyQXJlYS55O1xuXG4gICAgLy9jb25zb2xlLmxvZyhnbG9iYWxzLmRlZmF1bHRTaGFkZXIucHJvamVjdGlvblZlY3RvcilcbiAgICAvLyB1cGRhdGUgcHJvamVjdGlvblxuICAgIGdsLnVuaWZvcm0yZihnbG9iYWxzLmRlZmF1bHRTaGFkZXIucHJvamVjdGlvblZlY3RvciwgZmlsdGVyQXJlYS53aWR0aC8yLCAtZmlsdGVyQXJlYS5oZWlnaHQvMik7XG4gICAgZ2wudW5pZm9ybTJmKGdsb2JhbHMuZGVmYXVsdFNoYWRlci5vZmZzZXRWZWN0b3IsIC1maWx0ZXJBcmVhLngsIC1maWx0ZXJBcmVhLnkpO1xuICAgIC8vZ2xvYmFscy5wcmltaXRpdmVQcm9ncmFtXG5cbiAgICBnbC5jb2xvck1hc2sodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgZ2wuY2xlYXJDb2xvcigwLDAsMCwgMCk7XG4gICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG5cbiAgICAvL2ZpbHRlci50ZXh0dXJlID0gdGV4dHVyZTtcbiAgICBmaWx0ZXJCbG9jay5fZ2xGaWx0ZXJUZXh0dXJlID0gdGV4dHVyZTtcblxuICAgIC8vY29uc29sZS5sb2coXCJQVVNIXCIpXG59O1xuXG5cbnByb3RvLnBvcEZpbHRlciA9IGZ1bmN0aW9uIHBvcEZpbHRlcigpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcbiAgICB2YXIgZmlsdGVyQmxvY2sgPSB0aGlzLmZpbHRlclN0YWNrLnBvcCgpO1xuICAgIHZhciBmaWx0ZXJBcmVhID0gZmlsdGVyQmxvY2sudGFyZ2V0LmZpbHRlckFyZWE7XG4gICAgdmFyIHRleHR1cmUgPSBmaWx0ZXJCbG9jay5fZ2xGaWx0ZXJUZXh0dXJlO1xuXG4gICAgaWYoZmlsdGVyQmxvY2suZmlsdGVyUGFzc2VzLmxlbmd0aCA+IDEpXG4gICAge1xuICAgICAgICBnbC52aWV3cG9ydCgwLCAwLCBmaWx0ZXJBcmVhLndpZHRoLCBmaWx0ZXJBcmVhLmhlaWdodCk7XG5cbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGV4QnVmZmVyKTtcblxuICAgICAgICB0aGlzLnZlcnRleEFycmF5WzBdID0gMDtcbiAgICAgICAgdGhpcy52ZXJ0ZXhBcnJheVsxXSA9IGZpbHRlckFyZWEuaGVpZ2h0O1xuXG4gICAgICAgIHRoaXMudmVydGV4QXJyYXlbMl0gPSBmaWx0ZXJBcmVhLndpZHRoO1xuICAgICAgICB0aGlzLnZlcnRleEFycmF5WzNdID0gZmlsdGVyQXJlYS5oZWlnaHQ7XG5cbiAgICAgICAgdGhpcy52ZXJ0ZXhBcnJheVs0XSA9IDA7XG4gICAgICAgIHRoaXMudmVydGV4QXJyYXlbNV0gPSAwO1xuXG4gICAgICAgIHRoaXMudmVydGV4QXJyYXlbNl0gPSBmaWx0ZXJBcmVhLndpZHRoO1xuICAgICAgICB0aGlzLnZlcnRleEFycmF5WzddID0gMDtcblxuICAgICAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdGhpcy52ZXJ0ZXhBcnJheSk7XG5cbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudXZCdWZmZXIpO1xuICAgICAgICAvLyBubm93IHNldCB0aGUgdXZzLi5cbiAgICAgICAgdGhpcy51dkFycmF5WzJdID0gZmlsdGVyQXJlYS53aWR0aC90aGlzLndpZHRoO1xuICAgICAgICB0aGlzLnV2QXJyYXlbNV0gPSBmaWx0ZXJBcmVhLmhlaWdodC90aGlzLmhlaWdodDtcbiAgICAgICAgdGhpcy51dkFycmF5WzZdID0gZmlsdGVyQXJlYS53aWR0aC90aGlzLndpZHRoO1xuICAgICAgICB0aGlzLnV2QXJyYXlbN10gPSBmaWx0ZXJBcmVhLmhlaWdodC90aGlzLmhlaWdodDtcblxuICAgICAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdGhpcy51dkFycmF5KTtcblxuICAgICAgICB2YXIgaW5wdXRUZXh0dXJlID0gdGV4dHVyZTtcbiAgICAgICAgdmFyIG91dHB1dFRleHR1cmUgPSB0aGlzLnRleHR1cmVQb29sLnBvcCgpO1xuICAgICAgICBpZighb3V0cHV0VGV4dHVyZSlvdXRwdXRUZXh0dXJlID0gbmV3IEZpbHRlclRleHR1cmUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXG4gICAgICAgIC8vIG5lZWQgdG8gY2xlYXIgdGhpcyBGQk8gYXMgaXQgbWF5IGhhdmUgc29tZSBsZWZ0IG92ZXIgZWxlbWVudHMgZnJvbSBhIHBydmlvdXMgZmlsdGVyLlxuICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG91dHB1dFRleHR1cmUuZnJhbWVCdWZmZXIgKTtcbiAgICAgICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG5cbiAgICAgICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWx0ZXJCbG9jay5maWx0ZXJQYXNzZXMubGVuZ3RoLTE7IGkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgdmFyIGZpbHRlclBhc3MgPSBmaWx0ZXJCbG9jay5maWx0ZXJQYXNzZXNbaV07XG5cbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgb3V0cHV0VGV4dHVyZS5mcmFtZUJ1ZmZlciApO1xuXG4gICAgICAgICAgICAvLyBzZXQgdGV4dHVyZVxuICAgICAgICAgICAgZ2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCk7XG4gICAgICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBpbnB1dFRleHR1cmUudGV4dHVyZSk7XG5cbiAgICAgICAgICAgIC8vIGRyYXcgdGV4dHVyZS4uXG4gICAgICAgICAgICAvL2ZpbHRlclBhc3MuYXBwbHlGaWx0ZXJQYXNzKGZpbHRlckFyZWEud2lkdGgsIGZpbHRlckFyZWEuaGVpZ2h0KTtcbiAgICAgICAgICAgIHRoaXMuYXBwbHlGaWx0ZXJQYXNzKGZpbHRlclBhc3MsIGZpbHRlckFyZWEsIGZpbHRlckFyZWEud2lkdGgsIGZpbHRlckFyZWEuaGVpZ2h0KTtcblxuICAgICAgICAgICAgLy8gc3dhcCB0aGUgdGV4dHVyZXMuLlxuICAgICAgICAgICAgdmFyIHRlbXAgPSBpbnB1dFRleHR1cmU7XG4gICAgICAgICAgICBpbnB1dFRleHR1cmUgPSBvdXRwdXRUZXh0dXJlO1xuICAgICAgICAgICAgb3V0cHV0VGV4dHVyZSA9IHRlbXA7XG4gICAgICAgIH1cblxuICAgICAgICBnbC5lbmFibGUoZ2wuQkxFTkQpO1xuXG4gICAgICAgIHRleHR1cmUgPSBpbnB1dFRleHR1cmU7XG4gICAgICAgIHRoaXMudGV4dHVyZVBvb2wucHVzaChvdXRwdXRUZXh0dXJlKTtcbiAgICB9XG5cbiAgICB2YXIgZmlsdGVyID0gZmlsdGVyQmxvY2suZmlsdGVyUGFzc2VzW2ZpbHRlckJsb2NrLmZpbHRlclBhc3Nlcy5sZW5ndGgtMV07XG5cbiAgICB0aGlzLm9mZnNldFggLT0gZmlsdGVyQXJlYS54O1xuICAgIHRoaXMub2Zmc2V0WSAtPSBmaWx0ZXJBcmVhLnk7XG5cblxuICAgIHZhciBzaXplWCA9IHRoaXMud2lkdGg7XG4gICAgdmFyIHNpemVZID0gdGhpcy5oZWlnaHQ7XG5cbiAgICB2YXIgb2Zmc2V0WCA9IDA7XG4gICAgdmFyIG9mZnNldFkgPSAwO1xuXG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuYnVmZmVyO1xuXG4gICAgLy8gdGltZSB0byByZW5kZXIgdGhlIGZpbHRlcnMgdGV4dHVyZSB0byB0aGUgcHJldmlvdXMgc2NlbmVcbiAgICBpZih0aGlzLmZpbHRlclN0YWNrLmxlbmd0aCA9PT0gMClcbiAgICB7XG4gICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0aGlzLnRyYW5zcGFyZW50KTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdmFyIGN1cnJlbnRGaWx0ZXIgPSB0aGlzLmZpbHRlclN0YWNrW3RoaXMuZmlsdGVyU3RhY2subGVuZ3RoLTFdO1xuICAgICAgICBmaWx0ZXJBcmVhID0gY3VycmVudEZpbHRlci50YXJnZXQuZmlsdGVyQXJlYTtcblxuICAgICAgICBzaXplWCA9IGZpbHRlckFyZWEud2lkdGg7XG4gICAgICAgIHNpemVZID0gZmlsdGVyQXJlYS5oZWlnaHQ7XG5cbiAgICAgICAgb2Zmc2V0WCA9IGZpbHRlckFyZWEueDtcbiAgICAgICAgb2Zmc2V0WSA9IGZpbHRlckFyZWEueTtcblxuICAgICAgICBidWZmZXIgPSAgY3VycmVudEZpbHRlci5fZ2xGaWx0ZXJUZXh0dXJlLmZyYW1lQnVmZmVyO1xuICAgIH1cblxuXG5cbiAgICAvLyBUT0RPIG5lZWQgdG8gcmVtb3ZlIHRoZXNlIGdsb2JhbCBlbGVtZW50cy4uXG4gICAgZ2xvYmFscy5wcm9qZWN0aW9uLnggPSBzaXplWC8yO1xuICAgIGdsb2JhbHMucHJvamVjdGlvbi55ID0gLXNpemVZLzI7XG5cbiAgICBnbG9iYWxzLm9mZnNldC54ID0gb2Zmc2V0WDtcbiAgICBnbG9iYWxzLm9mZnNldC55ID0gb2Zmc2V0WTtcblxuICAgIGZpbHRlckFyZWEgPSBmaWx0ZXJCbG9jay50YXJnZXQuZmlsdGVyQXJlYTtcblxuICAgIHZhciB4ID0gZmlsdGVyQXJlYS54LW9mZnNldFg7XG4gICAgdmFyIHkgPSBmaWx0ZXJBcmVhLnktb2Zmc2V0WTtcblxuICAgIC8vIHVwZGF0ZSB0aGUgYnVmZmVycy4uXG4gICAgLy8gbWFrZSBzdXJlIHRvIGZsaXAgdGhlIHkhXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGV4QnVmZmVyKTtcblxuICAgIHRoaXMudmVydGV4QXJyYXlbMF0gPSB4O1xuICAgIHRoaXMudmVydGV4QXJyYXlbMV0gPSB5ICsgZmlsdGVyQXJlYS5oZWlnaHQ7XG5cbiAgICB0aGlzLnZlcnRleEFycmF5WzJdID0geCArIGZpbHRlckFyZWEud2lkdGg7XG4gICAgdGhpcy52ZXJ0ZXhBcnJheVszXSA9IHkgKyBmaWx0ZXJBcmVhLmhlaWdodDtcblxuICAgIHRoaXMudmVydGV4QXJyYXlbNF0gPSB4O1xuICAgIHRoaXMudmVydGV4QXJyYXlbNV0gPSB5O1xuXG4gICAgdGhpcy52ZXJ0ZXhBcnJheVs2XSA9IHggKyBmaWx0ZXJBcmVhLndpZHRoO1xuICAgIHRoaXMudmVydGV4QXJyYXlbN10gPSB5O1xuXG4gICAgZ2wuYnVmZmVyU3ViRGF0YShnbC5BUlJBWV9CVUZGRVIsIDAsIHRoaXMudmVydGV4QXJyYXkpO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudXZCdWZmZXIpO1xuXG4gICAgdGhpcy51dkFycmF5WzJdID0gZmlsdGVyQXJlYS53aWR0aC90aGlzLndpZHRoO1xuICAgIHRoaXMudXZBcnJheVs1XSA9IGZpbHRlckFyZWEuaGVpZ2h0L3RoaXMuaGVpZ2h0O1xuICAgIHRoaXMudXZBcnJheVs2XSA9IGZpbHRlckFyZWEud2lkdGgvdGhpcy53aWR0aDtcbiAgICB0aGlzLnV2QXJyYXlbN10gPSBmaWx0ZXJBcmVhLmhlaWdodC90aGlzLmhlaWdodDtcblxuICAgIGdsLmJ1ZmZlclN1YkRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAwLCB0aGlzLnV2QXJyYXkpO1xuXG4gICAgZ2wudmlld3BvcnQoMCwgMCwgc2l6ZVgsIHNpemVZKTtcbiAgICAvLyBiaW5kIHRoZSBidWZmZXJcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGJ1ZmZlciApO1xuXG4gICAgLy8gc2V0IHRleHR1cmVcbiAgICBnbC5hY3RpdmVUZXh0dXJlKGdsLlRFWFRVUkUwKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlLnRleHR1cmUpO1xuXG4gICAgLy8gYXBwbHkhXG4gICAgLy9maWx0ZXIuYXBwbHlGaWx0ZXJQYXNzKHNpemVYLCBzaXplWSk7XG4gICAgdGhpcy5hcHBseUZpbHRlclBhc3MoZmlsdGVyLCBmaWx0ZXJBcmVhLCBzaXplWCwgc2l6ZVkpO1xuXG4gICAgLy8gbm93IHJlc3RvcmUgdGhlIHJlZ3VsYXIgc2hhZGVyLi5cbiAgICBnbC51c2VQcm9ncmFtKGdsb2JhbHMuZGVmYXVsdFNoYWRlci5wcm9ncmFtKTtcbiAgICBnbC51bmlmb3JtMmYoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLnByb2plY3Rpb25WZWN0b3IsIHNpemVYLzIsIC1zaXplWS8yKTtcbiAgICBnbC51bmlmb3JtMmYoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLm9mZnNldFZlY3RvciwgLW9mZnNldFgsIC1vZmZzZXRZKTtcblxuICAgIC8vIHJldHVybiB0aGUgdGV4dHVyZSB0byB0aGUgcG9vbFxuICAgIHRoaXMudGV4dHVyZVBvb2wucHVzaCh0ZXh0dXJlKTtcbiAgICBmaWx0ZXJCbG9jay5fZ2xGaWx0ZXJUZXh0dXJlID0gbnVsbDtcbn07XG5cbnByb3RvLmFwcGx5RmlsdGVyUGFzcyA9IGZ1bmN0aW9uIGFwcGx5RmlsdGVyUGFzcyhmaWx0ZXIsIGZpbHRlckFyZWEsIHdpZHRoLCBoZWlnaHQpXG57XG4gICAgLy8gdXNlIHByb2dyYW1cbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuICAgIHZhciBzaGFkZXIgPSBmaWx0ZXIuc2hhZGVyO1xuXG4gICAgaWYoIXNoYWRlcilcbiAgICB7XG4gICAgICAgIHNoYWRlciA9IG5ldyBQaXhpU2hhZGVyKCk7XG5cbiAgICAgICAgc2hhZGVyLmZyYWdtZW50U3JjID0gZmlsdGVyLmZyYWdtZW50U3JjO1xuICAgICAgICBzaGFkZXIudW5pZm9ybXMgPSBmaWx0ZXIudW5pZm9ybXM7XG4gICAgICAgIHNoYWRlci5pbml0KCk7XG5cbiAgICAgICAgZmlsdGVyLnNoYWRlciA9IHNoYWRlcjtcbiAgICB9XG5cbiAgICAvLyBzZXQgdGhlIHNoYWRlclxuICAgIGdsLnVzZVByb2dyYW0oc2hhZGVyLnByb2dyYW0pO1xuXG4gICAgZ2wudW5pZm9ybTJmKHNoYWRlci5wcm9qZWN0aW9uVmVjdG9yLCB3aWR0aC8yLCAtaGVpZ2h0LzIpO1xuICAgIGdsLnVuaWZvcm0yZihzaGFkZXIub2Zmc2V0VmVjdG9yLCAwLDApO1xuXG4gICAgaWYoZmlsdGVyLnVuaWZvcm1zLmRpbWVuc2lvbnMpXG4gICAge1xuICAgICAgICAvL2NvbnNvbGUubG9nKGZpbHRlci51bmlmb3Jtcy5kaW1lbnNpb25zKVxuICAgICAgICBmaWx0ZXIudW5pZm9ybXMuZGltZW5zaW9ucy52YWx1ZVswXSA9IHRoaXMud2lkdGg7Ly93aWR0aDtcbiAgICAgICAgZmlsdGVyLnVuaWZvcm1zLmRpbWVuc2lvbnMudmFsdWVbMV0gPSB0aGlzLmhlaWdodDsvL2hlaWdodDtcbiAgICAgICAgZmlsdGVyLnVuaWZvcm1zLmRpbWVuc2lvbnMudmFsdWVbMl0gPSB0aGlzLnZlcnRleEFycmF5WzBdO1xuICAgICAgICBmaWx0ZXIudW5pZm9ybXMuZGltZW5zaW9ucy52YWx1ZVszXSA9IHRoaXMudmVydGV4QXJyYXlbNV07Ly9maWx0ZXJBcmVhLmhlaWdodDtcbiAgICAvLyAgY29uc29sZS5sb2codGhpcy52ZXJ0ZXhBcnJheVs1XSlcbiAgICB9XG5cbiAgICBzaGFkZXIuc3luY1VuaWZvcm1zKCk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyLmFWZXJ0ZXhQb3NpdGlvbiwgMiwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnV2QnVmZmVyKTtcbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlci5hVGV4dHVyZUNvb3JkLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgdGhpcy5pbmRleEJ1ZmZlcik7XG5cbiAgICAvLyBkcmF3IHRoZSBmaWx0ZXIuLi5cbiAgICBnbC5kcmF3RWxlbWVudHMoZ2wuVFJJQU5HTEVTLCA2LCBnbC5VTlNJR05FRF9TSE9SVCwgMCApO1xufTtcblxucHJvdG8uaW5pdFNoYWRlckJ1ZmZlcnMgPSBmdW5jdGlvbiBpbml0U2hhZGVyQnVmZmVycygpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIC8vIGNyZWF0ZSBzb21lIGJ1ZmZlcnNcbiAgICB0aGlzLnZlcnRleEJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHRoaXMudXZCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmluZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG5cbiAgICAvLyBiaW5kIGFuZCB1cGxvYWQgdGhlIHZlcnRleHMuLlxuICAgIC8vIGtlZXAgYSByZWZmZXJhbmNlIHRvIHRoZSB2ZXJ0ZXhGbG9hdERhdGEuLlxuICAgIHRoaXMudmVydGV4QXJyYXkgPSBuZXcgRmxvYXQzMkFycmF5KFswLjAsIDAuMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMS4wLCAwLjAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAuMCwgMS4wLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLjAsIDEuMF0pO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGV4QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKFxuICAgIGdsLkFSUkFZX0JVRkZFUixcbiAgICB0aGlzLnZlcnRleEFycmF5LFxuICAgIGdsLlNUQVRJQ19EUkFXKTtcblxuXG4gICAgLy8gYmluZCBhbmQgdXBsb2FkIHRoZSB1diBidWZmZXJcbiAgICB0aGlzLnV2QXJyYXkgPSBuZXcgRmxvYXQzMkFycmF5KFswLjAsIDAuMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLjAsIDAuMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLjAsIDEuMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLjAsIDEuMF0pO1xuXG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudXZCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoXG4gICAgZ2wuQVJSQVlfQlVGRkVSLFxuICAgIHRoaXMudXZBcnJheSxcbiAgICBnbC5TVEFUSUNfRFJBVyk7XG5cbiAgICAvLyBiaW5kIGFuZCB1cGxvYWQgdGhlIGluZGV4XG4gICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgdGhpcy5pbmRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShcbiAgICBnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUixcbiAgICBuZXcgVWludDE2QXJyYXkoWzAsIDEsIDIsIDEsIDMsIDJdKSxcbiAgICBnbC5TVEFUSUNfRFJBVyk7XG59O1xuXG5wcm90by5nZXRCb3VuZHMgPSBmdW5jdGlvbiBnZXRCb3VuZHMoZGlzcGxheU9iamVjdClcbntcbiAgICAvLyB0aW1lIHRvIGdldCB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGUgb2JqZWN0IVxuICAgIHZhciB3b3JsZFRyYW5zZm9ybSwgd2lkdGgsIGhlaWdodCwgYVgsIGFZLCB3MCwgdzEsIGgwLCBoMSwgZG9UZXN0O1xuICAgIHZhciBhLCBiLCBjLCBkLCB0eCwgdHksIHgxLCB4MiwgeDMsIHg0LCB5MSwgeTIsIHkzLCB5NDtcblxuICAgIHZhciB0ZW1wT2JqZWN0ID0gZGlzcGxheU9iamVjdC5maXJzdDtcbiAgICB2YXIgdGVzdE9iamVjdCA9IGRpc3BsYXlPYmplY3QubGFzdC5faU5leHQ7XG5cbiAgICB2YXIgbWF4WCA9IC1JbmZpbml0eTtcbiAgICB2YXIgbWF4WSA9IC1JbmZpbml0eTtcblxuICAgIHZhciBtaW5YID0gSW5maW5pdHk7XG4gICAgdmFyIG1pblkgPSBJbmZpbml0eTtcblxuICAgIGRvXG4gICAge1xuICAgICAgICAvLyBUT0RPIGNhbiBiZSBvcHRpbWl6ZWQhIC0gd2hhdCBpZiB0aGVyZSBpcyBubyBzY2FsZSAvIHJvdGF0aW9uP1xuXG4gICAgICAgIGlmKHRlbXBPYmplY3QudmlzaWJsZSlcbiAgICAgICAge1xuICAgICAgICAgICAgaWYodGVtcE9iamVjdCBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHRlbXBPYmplY3QudGV4dHVyZS5mcmFtZS53aWR0aDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSB0ZW1wT2JqZWN0LnRleHR1cmUuZnJhbWUuaGVpZ2h0O1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETyB0cmltPz9cbiAgICAgICAgICAgICAgICBhWCA9IHRlbXBPYmplY3QuYW5jaG9yLng7XG4gICAgICAgICAgICAgICAgYVkgPSB0ZW1wT2JqZWN0LmFuY2hvci55O1xuICAgICAgICAgICAgICAgIHcwID0gd2lkdGggKiAoMS1hWCk7XG4gICAgICAgICAgICAgICAgdzEgPSB3aWR0aCAqIC1hWDtcblxuICAgICAgICAgICAgICAgIGgwID0gaGVpZ2h0ICogKDEtYVkpO1xuICAgICAgICAgICAgICAgIGgxID0gaGVpZ2h0ICogLWFZO1xuXG4gICAgICAgICAgICAgICAgZG9UZXN0ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYodGVtcE9iamVjdCBpbnN0YW5jZW9mIEdyYXBoaWNzKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRlbXBPYmplY3QudXBkYXRlRmlsdGVyQm91bmRzKCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgYm91bmRzID0gdGVtcE9iamVjdC5ib3VuZHM7XG5cbiAgICAgICAgICAgICAgICB3aWR0aCA9IGJvdW5kcy53aWR0aDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSBib3VuZHMuaGVpZ2h0O1xuXG4gICAgICAgICAgICAgICAgdzAgPSBib3VuZHMueDtcbiAgICAgICAgICAgICAgICB3MSA9IGJvdW5kcy54ICsgYm91bmRzLndpZHRoO1xuXG4gICAgICAgICAgICAgICAgaDAgPSBib3VuZHMueTtcbiAgICAgICAgICAgICAgICBoMSA9IGJvdW5kcy55ICsgYm91bmRzLmhlaWdodDtcblxuICAgICAgICAgICAgICAgIGRvVGVzdCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZihkb1Rlc3QpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHdvcmxkVHJhbnNmb3JtID0gdGVtcE9iamVjdC53b3JsZFRyYW5zZm9ybTtcblxuICAgICAgICAgICAgYSA9IHdvcmxkVHJhbnNmb3JtWzBdO1xuICAgICAgICAgICAgYiA9IHdvcmxkVHJhbnNmb3JtWzNdO1xuICAgICAgICAgICAgYyA9IHdvcmxkVHJhbnNmb3JtWzFdO1xuICAgICAgICAgICAgZCA9IHdvcmxkVHJhbnNmb3JtWzRdO1xuICAgICAgICAgICAgdHggPSB3b3JsZFRyYW5zZm9ybVsyXTtcbiAgICAgICAgICAgIHR5ID0gd29ybGRUcmFuc2Zvcm1bNV07XG5cbiAgICAgICAgICAgIHgxID0gYSAqIHcxICsgYyAqIGgxICsgdHg7XG4gICAgICAgICAgICB5MSA9IGQgKiBoMSArIGIgKiB3MSArIHR5O1xuXG4gICAgICAgICAgICB4MiA9IGEgKiB3MCArIGMgKiBoMSArIHR4O1xuICAgICAgICAgICAgeTIgPSBkICogaDEgKyBiICogdzAgKyB0eTtcblxuICAgICAgICAgICAgeDMgPSBhICogdzAgKyBjICogaDAgKyB0eDtcbiAgICAgICAgICAgIHkzID0gZCAqIGgwICsgYiAqIHcwICsgdHk7XG5cbiAgICAgICAgICAgIHg0ID0gIGEgKiB3MSArIGMgKiBoMCArIHR4O1xuICAgICAgICAgICAgeTQgPSAgZCAqIGgwICsgYiAqIHcxICsgdHk7XG5cbiAgICAgICAgICAgIG1pblggPSB4MSA8IG1pblggPyB4MSA6IG1pblg7XG4gICAgICAgICAgICBtaW5YID0geDIgPCBtaW5YID8geDIgOiBtaW5YO1xuICAgICAgICAgICAgbWluWCA9IHgzIDwgbWluWCA/IHgzIDogbWluWDtcbiAgICAgICAgICAgIG1pblggPSB4NCA8IG1pblggPyB4NCA6IG1pblg7XG5cbiAgICAgICAgICAgIG1pblkgPSB5MSA8IG1pblkgPyB5MSA6IG1pblk7XG4gICAgICAgICAgICBtaW5ZID0geTIgPCBtaW5ZID8geTIgOiBtaW5ZO1xuICAgICAgICAgICAgbWluWSA9IHkzIDwgbWluWSA/IHkzIDogbWluWTtcbiAgICAgICAgICAgIG1pblkgPSB5NCA8IG1pblkgPyB5NCA6IG1pblk7XG5cbiAgICAgICAgICAgIG1heFggPSB4MSA+IG1heFggPyB4MSA6IG1heFg7XG4gICAgICAgICAgICBtYXhYID0geDIgPiBtYXhYID8geDIgOiBtYXhYO1xuICAgICAgICAgICAgbWF4WCA9IHgzID4gbWF4WCA/IHgzIDogbWF4WDtcbiAgICAgICAgICAgIG1heFggPSB4NCA+IG1heFggPyB4NCA6IG1heFg7XG5cbiAgICAgICAgICAgIG1heFkgPSB5MSA+IG1heFkgPyB5MSA6IG1heFk7XG4gICAgICAgICAgICBtYXhZID0geTIgPiBtYXhZID8geTIgOiBtYXhZO1xuICAgICAgICAgICAgbWF4WSA9IHkzID4gbWF4WSA/IHkzIDogbWF4WTtcbiAgICAgICAgICAgIG1heFkgPSB5NCA+IG1heFkgPyB5NCA6IG1heFk7XG4gICAgICAgIH1cblxuICAgICAgICBkb1Rlc3QgPSBmYWxzZTtcbiAgICAgICAgdGVtcE9iamVjdCA9IHRlbXBPYmplY3QuX2lOZXh0O1xuXG4gICAgfVxuICAgIHdoaWxlKHRlbXBPYmplY3QgIT09IHRlc3RPYmplY3QpO1xuXG4gICAgLy8gbWF4aW11bSBib3VuZHMgaXMgdGhlIHNpemUgb2YgdGhlIHNjcmVlbi4uXG4gICAgLy9taW5YID0gbWluWCA+IDAgPyBtaW5YIDogMDtcbiAgICAvL21pblkgPSBtaW5ZID4gMCA/IG1pblkgOiAwO1xuXG4gICAgZGlzcGxheU9iamVjdC5maWx0ZXJBcmVhLnggPSBtaW5YO1xuICAgIGRpc3BsYXlPYmplY3QuZmlsdGVyQXJlYS55ID0gbWluWTtcblxuLy8gIGNvbnNvbGUubG9nKG1heFgrIFwiIDogXCIgKyBtaW5YKVxuICAgIGRpc3BsYXlPYmplY3QuZmlsdGVyQXJlYS53aWR0aCA9IG1heFggLSBtaW5YO1xuICAgIGRpc3BsYXlPYmplY3QuZmlsdGVyQXJlYS5oZWlnaHQgPSBtYXhZIC0gbWluWTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2ViR0xGaWx0ZXJNYW5hZ2VyO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xudmFyIHNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKTtcbnZhciB3ZWJnbEdyYXBoaWNzID0gcmVxdWlyZSgnLi9ncmFwaGljcycpO1xudmFyIFdlYkdMQmF0Y2ggPSByZXF1aXJlKCcuL1dlYkdMQmF0Y2gnKTtcbnZhciBXZWJHTEZpbHRlck1hbmFnZXIgPSByZXF1aXJlKCcuL1dlYkdMRmlsdGVyTWFuYWdlcicpO1xudmFyIG1hdDMgPSByZXF1aXJlKCcuLi8uLi9nZW9tL21hdHJpeCcpLm1hdDM7XG5cbnZhciBCYXNlVGV4dHVyZSA9IHJlcXVpcmUoJy4uLy4uL3RleHR1cmVzL0Jhc2VUZXh0dXJlJyk7XG5cbnZhciBUaWxpbmdTcHJpdGUgPSByZXF1aXJlKCcuLi8uLi9leHRyYXMvVGlsaW5nU3ByaXRlJyk7XG52YXIgU3RyaXAgPSByZXF1aXJlKCcuLi8uLi9leHRyYXMvU3RyaXAnKTtcbnZhciBHcmFwaGljcyA9IHJlcXVpcmUoJy4uLy4uL3ByaW1pdGl2ZXMvR3JhcGhpY3MnKTtcbnZhciBGaWx0ZXJCbG9jayA9IHJlcXVpcmUoJy4uLy4uL2ZpbHRlcnMvRmlsdGVyQmxvY2snKTtcbnZhciBTcHJpdGUgPSByZXF1aXJlKCcuLi8uLi9kaXNwbGF5L1Nwcml0ZScpO1xudmFyIEN1c3RvbVJlbmRlcmFibGUgPSByZXF1aXJlKCcuLi8uLi9leHRyYXMvQ3VzdG9tUmVuZGVyYWJsZScpO1xuXG4vKipcbiAqIEEgV2ViR0xCYXRjaCBFbmFibGVzIGEgZ3JvdXAgb2Ygc3ByaXRlcyB0byBiZSBkcmF3biB1c2luZyB0aGUgc2FtZSBzZXR0aW5ncy5cbiAqIGlmIGEgZ3JvdXAgb2Ygc3ByaXRlcyBhbGwgaGF2ZSB0aGUgc2FtZSBiYXNlVGV4dHVyZSBhbmQgYmxlbmRNb2RlIHRoZW4gdGhleSBjYW4gYmVcbiAqIGdyb3VwZWQgaW50byBhIGJhdGNoLiBBbGwgdGhlIHNwcml0ZXMgaW4gYSBiYXRjaCBjYW4gdGhlbiBiZSBkcmF3biBpbiBvbmUgZ28gYnkgdGhlXG4gKiBHUFUgd2hpY2ggaXMgaHVnZWx5IGVmZmljaWVudC4gQUxMIHNwcml0ZXMgaW4gdGhlIHdlYkdMIHJlbmRlcmVyIGFyZSBhZGRlZCB0byBhIGJhdGNoXG4gKiBldmVuIGlmIHRoZSBiYXRjaCBvbmx5IGNvbnRhaW5zIG9uZSBzcHJpdGUuIEJhdGNoaW5nIGlzIGhhbmRsZWQgYXV0b21hdGljYWxseSBieSB0aGVcbiAqIHdlYkdMIHJlbmRlcmVyLiBBIGdvb2QgdGlwIGlzOiB0aGUgc21hbGxlciB0aGUgbnVtYmVyIG9mIGJhdGNocyB0aGVyZSBhcmUsIHRoZSBmYXN0ZXJcbiAqIHRoZSB3ZWJHTCByZW5kZXJlciB3aWxsIHJ1bi5cbiAqXG4gKiBAY2xhc3MgV2ViR0xCYXRjaFxuICogQGNvbnRydWN0b3JcbiAqIEBwYXJhbSBnbCB7V2ViR0xDb250ZXh0fSBBbiBpbnN0YW5jZSBvZiB0aGUgd2ViR0wgY29udGV4dFxuICovXG5mdW5jdGlvbiBXZWJHTFJlbmRlckdyb3VwKGdsLCB0cmFuc3BhcmVudClcbntcbiAgICB0aGlzLmdsID0gZ2w7XG4gICAgdGhpcy5yb290ID0gbnVsbDtcblxuICAgIHRoaXMuYmFja2dyb3VuZENvbG9yID0gdW5kZWZpbmVkO1xuICAgIHRoaXMudHJhbnNwYXJlbnQgPSB0cmFuc3BhcmVudCA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHRyYW5zcGFyZW50O1xuXG4gICAgdGhpcy5iYXRjaHMgPSBbXTtcbiAgICB0aGlzLnRvUmVtb3ZlID0gW107XG4gICAgLy9jb25zb2xlLmxvZyh0aGlzLnRyYW5zcGFyZW50KTtcbiAgICB0aGlzLmZpbHRlck1hbmFnZXIgPSBuZXcgV2ViR0xGaWx0ZXJNYW5hZ2VyKHRoaXMudHJhbnNwYXJlbnQpO1xufVxuXG52YXIgcHJvdG8gPSBXZWJHTFJlbmRlckdyb3VwLnByb3RvdHlwZTtcblxuLyoqXG4gKiBBZGQgYSBkaXNwbGF5IG9iamVjdCB0byB0aGUgd2ViZ2wgcmVuZGVyZXJcbiAqXG4gKiBAbWV0aG9kIHNldFJlbmRlcmFibGVcbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uc2V0UmVuZGVyYWJsZSA9IGZ1bmN0aW9uIHNldFJlbmRlcmFibGUoZGlzcGxheU9iamVjdClcbntcbiAgICAvLyBoYXMgdGhpcyBjaGFuZ2VkPz9cbiAgICBpZih0aGlzLnJvb3QpdGhpcy5yZW1vdmVEaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4odGhpcy5yb290KTtcblxuICAgIGRpc3BsYXlPYmplY3Qud29ybGRWaXNpYmxlID0gZGlzcGxheU9iamVjdC52aXNpYmxlO1xuXG4gICAgLy8gc29vb29vbyAvL1xuICAgIC8vIHRvIGNoZWNrIGlmIGFueSBiYXRjaHMgZXhpc3QgYWxyZWFkeT8/XG5cbiAgICAvLyBUT0RPIHdoYXQgaWYgaXRzIGFscmVhZHkgaGFzIGFuIG9iamVjdD8gc2hvdWxkIHJlbW92ZSBpdFxuICAgIHRoaXMucm9vdCA9IGRpc3BsYXlPYmplY3Q7XG4gICAgdGhpcy5hZGREaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4oZGlzcGxheU9iamVjdCk7XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgdGhlIHN0YWdlIHRvIGl0cyB3ZWJnbCB2aWV3XG4gKlxuICogQG1ldGhvZCByZW5kZXJcbiAqIEBwYXJhbSBwcm9qZWN0aW9uIHtPYmplY3R9XG4gKi9cbnByb3RvLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcihwcm9qZWN0aW9uLCBidWZmZXIpXG57XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIFdlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZXMoZ2wpO1xuXG4gICAgZ2wudW5pZm9ybTJmKGdsb2JhbHMuZGVmYXVsdFNoYWRlci5wcm9qZWN0aW9uVmVjdG9yLCBwcm9qZWN0aW9uLngsIHByb2plY3Rpb24ueSk7XG5cbiAgICB0aGlzLmZpbHRlck1hbmFnZXIuYmVnaW4ocHJvamVjdGlvbiwgYnVmZmVyKTtcblxuXG4gICAgZ2wuYmxlbmRGdW5jKGdsLk9ORSwgZ2wuT05FX01JTlVTX1NSQ19BTFBIQSk7XG4gICAgLy8gd2lsbCByZW5kZXIgYWxsIHRoZSBlbGVtZW50cyBpbiB0aGUgZ3JvdXBcbiAgICB2YXIgcmVuZGVyYWJsZTtcblxuICAgIGZvciAodmFyIGk9MDsgaSA8IHRoaXMuYmF0Y2hzLmxlbmd0aDsgaSsrKVxuICAgIHtcblxuICAgICAgICByZW5kZXJhYmxlID0gdGhpcy5iYXRjaHNbaV07XG4gICAgICAgIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBXZWJHTEJhdGNoKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmJhdGNoc1tpXS5yZW5kZXIoKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVuZGVyIHNwZWNpYWxcbiAgICAgICAgdGhpcy5yZW5kZXJTcGVjaWFsKHJlbmRlcmFibGUsIHByb2plY3Rpb24pO1xuICAgIH1cbn07XG5cbi8qKlxuICogUmVuZGVycyB0aGUgc3RhZ2UgdG8gaXRzIHdlYmdsIHZpZXdcbiAqXG4gKiBAbWV0aG9kIGhhbmRsZUZpbHRlclxuICogQHBhcmFtIGZpbHRlciB7RmlsdGVyQmxvY2t9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5oYW5kbGVGaWx0ZXIgPSBmdW5jdGlvbiBoYW5kbGVGaWx0ZXIoKS8qKGZpbHRlciwgcHJvamVjdGlvbikqL1xue1xuXG59O1xuXG4vKipcbiAqIFJlbmRlcnMgYSBzcGVjaWZpYyBkaXNwbGF5T2JqZWN0XG4gKlxuICogQG1ldGhvZCByZW5kZXJTcGVjaWZpY1xuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcGFyYW0gcHJvamVjdGlvbiB7T2JqZWN0fVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyU3BlY2lmaWMgPSBmdW5jdGlvbiByZW5kZXJTcGVjaWZpYyhkaXNwbGF5T2JqZWN0LCBwcm9qZWN0aW9uLCBidWZmZXIpXG57XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIFdlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZXMoZ2wpO1xuXG4gICAgZ2wudW5pZm9ybTJmKGdsb2JhbHMuZGVmYXVsdFNoYWRlci5wcm9qZWN0aW9uVmVjdG9yLCBwcm9qZWN0aW9uLngsIHByb2plY3Rpb24ueSk7XG5cbiAgICB0aGlzLmZpbHRlck1hbmFnZXIuYmVnaW4ocHJvamVjdGlvbiwgYnVmZmVyKTtcblxuICAgIC8vIHRvIGRvIVxuICAgIC8vIHJlbmRlciBwYXJ0IG9mIHRoZSBzY2VuZS4uLlxuXG4gICAgdmFyIHN0YXJ0SW5kZXg7XG4gICAgdmFyIHN0YXJ0QmF0Y2hJbmRleDtcblxuICAgIHZhciBlbmRJbmRleDtcbiAgICB2YXIgZW5kQmF0Y2hJbmRleDtcbiAgICB2YXIgZW5kQmF0Y2g7XG5cbiAgICB2YXIgaGVhZDtcblxuICAgIC8qXG4gICAgICogIExPT0sgRk9SIFRIRSBORVhUIFNQUklURVxuICAgICAqICBUaGlzIHBhcnQgbG9va3MgZm9yIHRoZSBjbG9zZXN0IG5leHQgc3ByaXRlIHRoYXQgY2FuIGdvIGludG8gYSBiYXRjaFxuICAgICAqICBpdCBrZWVwcyBsb29raW5nIHVudGlsIGl0IGZpbmRzIGEgc3ByaXRlIG9yIGdldHMgdG8gdGhlIGVuZCBvZiB0aGUgZGlzcGxheVxuICAgICAqICBzY2VuZSBncmFwaFxuICAgICAqL1xuICAgIHZhciBuZXh0UmVuZGVyYWJsZSA9IGRpc3BsYXlPYmplY3QuZmlyc3Q7XG4gICAgd2hpbGUobmV4dFJlbmRlcmFibGUuX2lOZXh0KVxuICAgIHtcbiAgICAgICAgaWYobmV4dFJlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBuZXh0UmVuZGVyYWJsZS5fX3JlbmRlckdyb3VwKWJyZWFrO1xuICAgICAgICBuZXh0UmVuZGVyYWJsZSA9IG5leHRSZW5kZXJhYmxlLl9pTmV4dDtcbiAgICB9XG4gICAgdmFyIHN0YXJ0QmF0Y2ggPSBuZXh0UmVuZGVyYWJsZS5iYXRjaDtcblxuICAgIGlmKG5leHRSZW5kZXJhYmxlIGluc3RhbmNlb2YgU3ByaXRlKVxuICAgIHtcbiAgICAgICAgc3RhcnRCYXRjaCA9IG5leHRSZW5kZXJhYmxlLmJhdGNoO1xuXG4gICAgICAgIGhlYWQgPSBzdGFydEJhdGNoLmhlYWQ7XG5cbiAgICAgICAgLy8gb2sgbm93IHdlIGhhdmUgdGhlIGJhdGNoLi4gbmVlZCB0byBmaW5kIHRoZSBzdGFydCBpbmRleCFcbiAgICAgICAgaWYoaGVhZCA9PT0gbmV4dFJlbmRlcmFibGUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHN0YXJ0SW5kZXggPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhcnRJbmRleCA9IDE7XG5cbiAgICAgICAgICAgIHdoaWxlKGhlYWQuX19uZXh0ICE9PSBuZXh0UmVuZGVyYWJsZSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBzdGFydEluZGV4Kys7XG4gICAgICAgICAgICAgICAgaGVhZCA9IGhlYWQuX19uZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHN0YXJ0QmF0Y2ggPSBuZXh0UmVuZGVyYWJsZTtcbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIExBU1QgcmVuZGVyYWJsZSBvYmplY3RcbiAgICB2YXIgbGFzdFJlbmRlcmFibGUgPSBkaXNwbGF5T2JqZWN0Lmxhc3Q7XG4gICAgd2hpbGUobGFzdFJlbmRlcmFibGUuX2lQcmV2KVxuICAgIHtcbiAgICAgICAgaWYobGFzdFJlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBsYXN0UmVuZGVyYWJsZS5fX3JlbmRlckdyb3VwKWJyZWFrO1xuICAgICAgICBsYXN0UmVuZGVyYWJsZSA9IGxhc3RSZW5kZXJhYmxlLl9pTmV4dDtcbiAgICB9XG5cbiAgICBpZihsYXN0UmVuZGVyYWJsZSBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICB7XG4gICAgICAgIGVuZEJhdGNoID0gbGFzdFJlbmRlcmFibGUuYmF0Y2g7XG5cbiAgICAgICAgaGVhZCA9IGVuZEJhdGNoLmhlYWQ7XG5cbiAgICAgICAgaWYoaGVhZCA9PT0gbGFzdFJlbmRlcmFibGUpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGVuZEluZGV4ID0gMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIGVuZEluZGV4ID0gMTtcblxuICAgICAgICAgICAgd2hpbGUoaGVhZC5fX25leHQgIT09IGxhc3RSZW5kZXJhYmxlKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGVuZEluZGV4Kys7XG4gICAgICAgICAgICAgICAgaGVhZCA9IGhlYWQuX19uZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIGVuZEJhdGNoID0gbGFzdFJlbmRlcmFibGU7XG4gICAgfVxuXG4gICAgLy8gVE9ETyAtIG5lZWQgdG8gZm9sZCB0aGlzIHVwIGEgYml0IVxuXG4gICAgaWYoc3RhcnRCYXRjaCA9PT0gZW5kQmF0Y2gpXG4gICAge1xuICAgICAgICBpZihzdGFydEJhdGNoIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhcnRCYXRjaC5yZW5kZXIoc3RhcnRJbmRleCwgZW5kSW5kZXgrMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclNwZWNpYWwoc3RhcnRCYXRjaCwgcHJvamVjdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIG5vdyB3ZSBoYXZlIGZpcnN0IGFuZCBsYXN0IVxuICAgIHN0YXJ0QmF0Y2hJbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2Yoc3RhcnRCYXRjaCk7XG4gICAgZW5kQmF0Y2hJbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoZW5kQmF0Y2gpO1xuXG4gICAgLy8gRE8gdGhlIGZpcnN0IGJhdGNoXG4gICAgaWYoc3RhcnRCYXRjaCBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpXG4gICAge1xuICAgICAgICBzdGFydEJhdGNoLnJlbmRlcihzdGFydEluZGV4KTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5yZW5kZXJTcGVjaWFsKHN0YXJ0QmF0Y2gsIHByb2plY3Rpb24pO1xuICAgIH1cblxuICAgIC8vIERPIHRoZSBtaWRkbGUgYmF0Y2hzLi5cbiAgICB2YXIgcmVuZGVyYWJsZTtcbiAgICBmb3IgKHZhciBpID0gc3RhcnRCYXRjaEluZGV4KzE7IGkgPCBlbmRCYXRjaEluZGV4OyBpKyspXG4gICAge1xuICAgICAgICByZW5kZXJhYmxlID0gdGhpcy5iYXRjaHNbaV07XG5cbiAgICAgICAgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuYmF0Y2hzW2ldLnJlbmRlcigpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJTcGVjaWFsKHJlbmRlcmFibGUsIHByb2plY3Rpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gRE8gdGhlIGxhc3QgYmF0Y2guLlxuICAgIGlmKGVuZEJhdGNoIGluc3RhbmNlb2YgV2ViR0xCYXRjaClcbiAgICB7XG4gICAgICAgIGVuZEJhdGNoLnJlbmRlcigwLCBlbmRJbmRleCsxKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5yZW5kZXJTcGVjaWFsKGVuZEJhdGNoLCBwcm9qZWN0aW9uKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgYSBzcGVjaWZpYyByZW5kZXJhYmxlXG4gKlxuICogQG1ldGhvZCByZW5kZXJTcGVjaWFsXG4gKiBAcGFyYW0gcmVuZGVyYWJsZSB7RGlzcGxheU9iamVjdH1cbiAqIEBwYXJhbSBwcm9qZWN0aW9uIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJTcGVjaWFsID0gZnVuY3Rpb24gcmVuZGVyU3BlY2lhbChyZW5kZXJhYmxlLCBwcm9qZWN0aW9uKVxue1xuICAgIHZhciB3b3JsZFZpc2libGUgPSByZW5kZXJhYmxlLnZjb3VudCA9PT0gZ2xvYmFscy52aXNpYmxlQ291bnQ7XG5cbiAgICBpZihyZW5kZXJhYmxlIGluc3RhbmNlb2YgVGlsaW5nU3ByaXRlKVxuICAgIHtcbiAgICAgICAgaWYod29ybGRWaXNpYmxlKXRoaXMucmVuZGVyVGlsaW5nU3ByaXRlKHJlbmRlcmFibGUsIHByb2plY3Rpb24pO1xuICAgIH1cbiAgICBlbHNlIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBTdHJpcClcbiAgICB7XG4gICAgICAgIGlmKHdvcmxkVmlzaWJsZSl0aGlzLnJlbmRlclN0cmlwKHJlbmRlcmFibGUsIHByb2plY3Rpb24pO1xuICAgIH1cbiAgICBlbHNlIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBDdXN0b21SZW5kZXJhYmxlKVxuICAgIHtcbiAgICAgICAgaWYod29ybGRWaXNpYmxlKSByZW5kZXJhYmxlLnJlbmRlcldlYkdMKHRoaXMsIHByb2plY3Rpb24pO1xuICAgIH1cbiAgICBlbHNlIGlmKHJlbmRlcmFibGUgaW5zdGFuY2VvZiBHcmFwaGljcylcbiAgICB7XG4gICAgICAgIGlmKHdvcmxkVmlzaWJsZSAmJiByZW5kZXJhYmxlLnJlbmRlcmFibGUpIHdlYmdsR3JhcGhpY3MucmVuZGVyR3JhcGhpY3MocmVuZGVyYWJsZSwgcHJvamVjdGlvbik7XG4gICAgfVxuICAgIGVsc2UgaWYocmVuZGVyYWJsZSBpbnN0YW5jZW9mIEZpbHRlckJsb2NrKVxuICAgIHtcbiAgICAgICAgdGhpcy5oYW5kbGVGaWx0ZXJCbG9jayhyZW5kZXJhYmxlLCBwcm9qZWN0aW9uKTtcbiAgICB9XG59O1xuXG52YXIgbWFza1N0YWNrID0gW107XG5cbnByb3RvLmhhbmRsZUZpbHRlckJsb2NrID0gZnVuY3Rpb24gaGFuZGxlRmlsdGVyQmxvY2soZmlsdGVyQmxvY2ssIHByb2plY3Rpb24pXG57XG4gICAgLypcbiAgICAgKiBmb3Igbm93IG9ubHkgbWFza3MgYXJlIHN1cHBvcnRlZC4uXG4gICAgICovXG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIGlmKGZpbHRlckJsb2NrLm9wZW4pXG4gICAge1xuICAgICAgICBpZihmaWx0ZXJCbG9jay5kYXRhIGluc3RhbmNlb2YgQXJyYXkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuZmlsdGVyTWFuYWdlci5wdXNoRmlsdGVyKGZpbHRlckJsb2NrKTtcbiAgICAgICAgICAgIC8vIG9rIHNvLi5cblxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgbWFza1N0YWNrLnB1c2goZmlsdGVyQmxvY2spO1xuXG4gICAgICAgICAgICBnbC5lbmFibGUoZ2wuU1RFTkNJTF9URVNUKTtcblxuICAgICAgICAgICAgZ2wuY29sb3JNYXNrKGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblxuICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuQUxXQVlTLDEsMSk7XG4gICAgICAgICAgICBnbC5zdGVuY2lsT3AoZ2wuS0VFUCxnbC5LRUVQLGdsLklOQ1IpO1xuXG4gICAgICAgICAgICB3ZWJnbEdyYXBoaWNzLnJlbmRlckdyYXBoaWNzKGZpbHRlckJsb2NrLmRhdGEsIHByb2plY3Rpb24pO1xuXG4gICAgICAgICAgICBnbC5jb2xvck1hc2sodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuYyhnbC5OT1RFUVVBTCwwLG1hc2tTdGFjay5sZW5ndGgpO1xuICAgICAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsZ2wuS0VFUCxnbC5LRUVQKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBpZihmaWx0ZXJCbG9jay5kYXRhIGluc3RhbmNlb2YgQXJyYXkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuZmlsdGVyTWFuYWdlci5wb3BGaWx0ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHZhciBtYXNrRGF0YSA9IG1hc2tTdGFjay5wb3AoZmlsdGVyQmxvY2spO1xuXG4gICAgICAgICAgICBpZihtYXNrRGF0YSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBnbC5jb2xvck1hc2soZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXG4gICAgICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuQUxXQVlTLDEsMSk7XG4gICAgICAgICAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsZ2wuS0VFUCxnbC5ERUNSKTtcblxuICAgICAgICAgICAgICAgIHdlYmdsR3JhcGhpY3MucmVuZGVyR3JhcGhpY3MobWFza0RhdGEuZGF0YSwgcHJvamVjdGlvbik7XG5cbiAgICAgICAgICAgICAgICBnbC5jb2xvck1hc2sodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuTk9URVFVQUwsMCxtYXNrU3RhY2subGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBnbC5zdGVuY2lsT3AoZ2wuS0VFUCxnbC5LRUVQLGdsLktFRVApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBnbC5kaXNhYmxlKGdsLlNURU5DSUxfVEVTVCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgYSB3ZWJnbCB0ZXh0dXJlXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUZXh0dXJlXG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnVwZGF0ZVRleHR1cmUgPSBmdW5jdGlvbiB1cGRhdGVUZXh0dXJlKGRpc3BsYXlPYmplY3QpXG57XG5cbiAgICAvLyBUT0RPIGRlZmluaXRlbHkgY2FuIG9wdGltc2UgdGhpcyBmdW5jdGlvbi4uXG5cbiAgICB0aGlzLnJlbW92ZU9iamVjdChkaXNwbGF5T2JqZWN0KTtcblxuICAgIC8qXG4gICAgICogIExPT0sgRk9SIFRIRSBQUkVWSU9VUyBSRU5ERVJBQkxFXG4gICAgICogIFRoaXMgcGFydCBsb29rcyBmb3IgdGhlIGNsb3Nlc3QgcHJldmlvdXMgc3ByaXRlIHRoYXQgY2FuIGdvIGludG8gYSBiYXRjaFxuICAgICAqICBJdCBrZWVwcyBnb2luZyBiYWNrIHVudGlsIGl0IGZpbmRzIGEgc3ByaXRlIG9yIHRoZSBzdGFnZVxuICAgICAqL1xuICAgIHZhciBwcmV2aW91c1JlbmRlcmFibGUgPSBkaXNwbGF5T2JqZWN0LmZpcnN0O1xuICAgIHdoaWxlKHByZXZpb3VzUmVuZGVyYWJsZSAhPT0gdGhpcy5yb290KVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNSZW5kZXJhYmxlID0gcHJldmlvdXNSZW5kZXJhYmxlLl9pUHJldjtcbiAgICAgICAgaWYocHJldmlvdXNSZW5kZXJhYmxlLnJlbmRlcmFibGUgJiYgcHJldmlvdXNSZW5kZXJhYmxlLl9fcmVuZGVyR3JvdXApYnJlYWs7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiAgTE9PSyBGT1IgVEhFIE5FWFQgU1BSSVRFXG4gICAgICogIFRoaXMgcGFydCBsb29rcyBmb3IgdGhlIGNsb3Nlc3QgbmV4dCBzcHJpdGUgdGhhdCBjYW4gZ28gaW50byBhIGJhdGNoXG4gICAgICogIGl0IGtlZXBzIGxvb2tpbmcgdW50aWwgaXQgZmluZHMgYSBzcHJpdGUgb3IgZ2V0cyB0byB0aGUgZW5kIG9mIHRoZSBkaXNwbGF5XG4gICAgICogIHNjZW5lIGdyYXBoXG4gICAgICovXG4gICAgdmFyIG5leHRSZW5kZXJhYmxlID0gZGlzcGxheU9iamVjdC5sYXN0O1xuICAgIHdoaWxlKG5leHRSZW5kZXJhYmxlLl9pTmV4dClcbiAgICB7XG4gICAgICAgIG5leHRSZW5kZXJhYmxlID0gbmV4dFJlbmRlcmFibGUuX2lOZXh0O1xuICAgICAgICBpZihuZXh0UmVuZGVyYWJsZS5yZW5kZXJhYmxlICYmIG5leHRSZW5kZXJhYmxlLl9fcmVuZGVyR3JvdXApYnJlYWs7XG4gICAgfVxuXG4gICAgdGhpcy5pbnNlcnRPYmplY3QoZGlzcGxheU9iamVjdCwgcHJldmlvdXNSZW5kZXJhYmxlLCBuZXh0UmVuZGVyYWJsZSk7XG59O1xuXG4vKipcbiAqIEFkZHMgZmlsdGVyIGJsb2Nrc1xuICpcbiAqIEBtZXRob2QgYWRkRmlsdGVyQmxvY2tzXG4gKiBAcGFyYW0gc3RhcnQge0ZpbHRlckJsb2NrfVxuICogQHBhcmFtIGVuZCB7RmlsdGVyQmxvY2t9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5hZGRGaWx0ZXJCbG9ja3MgPSBmdW5jdGlvbiBhZGRGaWx0ZXJCbG9ja3Moc3RhcnQsIGVuZClcbntcbiAgICBzdGFydC5fX3JlbmRlckdyb3VwID0gdGhpcztcbiAgICBlbmQuX19yZW5kZXJHcm91cCA9IHRoaXM7XG4gICAgLypcbiAgICAgKiAgTE9PSyBGT1IgVEhFIFBSRVZJT1VTIFJFTkRFUkFCTEVcbiAgICAgKiAgVGhpcyBwYXJ0IGxvb2tzIGZvciB0aGUgY2xvc2VzdCBwcmV2aW91cyBzcHJpdGUgdGhhdCBjYW4gZ28gaW50byBhIGJhdGNoXG4gICAgICogIEl0IGtlZXBzIGdvaW5nIGJhY2sgdW50aWwgaXQgZmluZHMgYSBzcHJpdGUgb3IgdGhlIHN0YWdlXG4gICAgICovXG4gICAgdmFyIHByZXZpb3VzUmVuZGVyYWJsZSA9IHN0YXJ0O1xuICAgIHdoaWxlKHByZXZpb3VzUmVuZGVyYWJsZSAhPT0gdGhpcy5yb290LmZpcnN0KVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNSZW5kZXJhYmxlID0gcHJldmlvdXNSZW5kZXJhYmxlLl9pUHJldjtcbiAgICAgICAgaWYocHJldmlvdXNSZW5kZXJhYmxlLnJlbmRlcmFibGUgJiYgcHJldmlvdXNSZW5kZXJhYmxlLl9fcmVuZGVyR3JvdXApYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuaW5zZXJ0QWZ0ZXIoc3RhcnQsIHByZXZpb3VzUmVuZGVyYWJsZSk7XG5cbiAgICAvKlxuICAgICAqICBMT09LIEZPUiBUSEUgTkVYVCBTUFJJVEVcbiAgICAgKiAgVGhpcyBwYXJ0IGxvb2tzIGZvciB0aGUgY2xvc2VzdCBuZXh0IHNwcml0ZSB0aGF0IGNhbiBnbyBpbnRvIGEgYmF0Y2hcbiAgICAgKiAgaXQga2VlcHMgbG9va2luZyB1bnRpbCBpdCBmaW5kcyBhIHNwcml0ZSBvciBnZXRzIHRvIHRoZSBlbmQgb2YgdGhlIGRpc3BsYXlcbiAgICAgKiAgc2NlbmUgZ3JhcGhcbiAgICAgKi9cbiAgICB2YXIgcHJldmlvdXNSZW5kZXJhYmxlMiA9IGVuZDtcbiAgICB3aGlsZShwcmV2aW91c1JlbmRlcmFibGUyICE9PSB0aGlzLnJvb3QuZmlyc3QpXG4gICAge1xuICAgICAgICBwcmV2aW91c1JlbmRlcmFibGUyID0gcHJldmlvdXNSZW5kZXJhYmxlMi5faVByZXY7XG4gICAgICAgIGlmKHByZXZpb3VzUmVuZGVyYWJsZTIucmVuZGVyYWJsZSAmJiBwcmV2aW91c1JlbmRlcmFibGUyLl9fcmVuZGVyR3JvdXApYnJlYWs7XG4gICAgfVxuICAgIHRoaXMuaW5zZXJ0QWZ0ZXIoZW5kLCBwcmV2aW91c1JlbmRlcmFibGUyKTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGZpbHRlciBibG9ja3NcbiAqXG4gKiBAbWV0aG9kIHJlbW92ZUZpbHRlckJsb2Nrc1xuICogQHBhcmFtIHN0YXJ0IHtGaWx0ZXJCbG9ja31cbiAqIEBwYXJhbSBlbmQge0ZpbHRlckJsb2NrfVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVtb3ZlRmlsdGVyQmxvY2tzID0gZnVuY3Rpb24gcmVtb3ZlRmlsdGVyQmxvY2tzKHN0YXJ0LCBlbmQpXG57XG4gICAgdGhpcy5yZW1vdmVPYmplY3Qoc3RhcnQpO1xuICAgIHRoaXMucmVtb3ZlT2JqZWN0KGVuZCk7XG59O1xuXG4vKipcbiAqIEFkZHMgYSBkaXNwbGF5IG9iamVjdCBhbmQgY2hpbGRyZW4gdG8gdGhlIHdlYmdsIGNvbnRleHRcbiAqXG4gKiBAbWV0aG9kIGFkZERpc3BsYXlPYmplY3RBbmRDaGlsZHJlblxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5hZGREaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4gPSBmdW5jdGlvbiBhZGREaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4oZGlzcGxheU9iamVjdClcbntcbiAgICBpZihkaXNwbGF5T2JqZWN0Ll9fcmVuZGVyR3JvdXApZGlzcGxheU9iamVjdC5fX3JlbmRlckdyb3VwLnJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlbihkaXNwbGF5T2JqZWN0KTtcblxuICAgIC8qXG4gICAgICogIExPT0sgRk9SIFRIRSBQUkVWSU9VUyBSRU5ERVJBQkxFXG4gICAgICogIFRoaXMgcGFydCBsb29rcyBmb3IgdGhlIGNsb3Nlc3QgcHJldmlvdXMgc3ByaXRlIHRoYXQgY2FuIGdvIGludG8gYSBiYXRjaFxuICAgICAqICBJdCBrZWVwcyBnb2luZyBiYWNrIHVudGlsIGl0IGZpbmRzIGEgc3ByaXRlIG9yIHRoZSBzdGFnZVxuICAgICAqL1xuXG4gICAgdmFyIHByZXZpb3VzUmVuZGVyYWJsZSA9IGRpc3BsYXlPYmplY3QuZmlyc3Q7XG4gICAgd2hpbGUocHJldmlvdXNSZW5kZXJhYmxlICE9PSB0aGlzLnJvb3QuZmlyc3QpXG4gICAge1xuICAgICAgICBwcmV2aW91c1JlbmRlcmFibGUgPSBwcmV2aW91c1JlbmRlcmFibGUuX2lQcmV2O1xuICAgICAgICBpZihwcmV2aW91c1JlbmRlcmFibGUucmVuZGVyYWJsZSAmJiBwcmV2aW91c1JlbmRlcmFibGUuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG5cbiAgICAvKlxuICAgICAqICBMT09LIEZPUiBUSEUgTkVYVCBTUFJJVEVcbiAgICAgKiAgVGhpcyBwYXJ0IGxvb2tzIGZvciB0aGUgY2xvc2VzdCBuZXh0IHNwcml0ZSB0aGF0IGNhbiBnbyBpbnRvIGEgYmF0Y2hcbiAgICAgKiAgaXQga2VlcHMgbG9va2luZyB1bnRpbCBpdCBmaW5kcyBhIHNwcml0ZSBvciBnZXRzIHRvIHRoZSBlbmQgb2YgdGhlIGRpc3BsYXlcbiAgICAgKiAgc2NlbmUgZ3JhcGhcbiAgICAgKi9cbiAgICB2YXIgbmV4dFJlbmRlcmFibGUgPSBkaXNwbGF5T2JqZWN0Lmxhc3Q7XG4gICAgd2hpbGUobmV4dFJlbmRlcmFibGUuX2lOZXh0KVxuICAgIHtcbiAgICAgICAgbmV4dFJlbmRlcmFibGUgPSBuZXh0UmVuZGVyYWJsZS5faU5leHQ7XG4gICAgICAgIGlmKG5leHRSZW5kZXJhYmxlLnJlbmRlcmFibGUgJiYgbmV4dFJlbmRlcmFibGUuX19yZW5kZXJHcm91cClicmVhaztcbiAgICB9XG5cbiAgICAvLyBvbmUgdGhlIGRpc3BsYXkgb2JqZWN0IGhpdHMgdGhpcy4gd2UgY2FuIGJyZWFrIHRoZSBsb29wXG5cbiAgICB2YXIgdGVtcE9iamVjdCA9IGRpc3BsYXlPYmplY3QuZmlyc3Q7XG4gICAgdmFyIHRlc3RPYmplY3QgPSBkaXNwbGF5T2JqZWN0Lmxhc3QuX2lOZXh0O1xuXG4gICAgZG9cbiAgICB7XG4gICAgICAgIHRlbXBPYmplY3QuX19yZW5kZXJHcm91cCA9IHRoaXM7XG5cbiAgICAgICAgaWYodGVtcE9iamVjdC5yZW5kZXJhYmxlKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0T2JqZWN0KHRlbXBPYmplY3QsIHByZXZpb3VzUmVuZGVyYWJsZSwgbmV4dFJlbmRlcmFibGUpO1xuICAgICAgICAgICAgcHJldmlvdXNSZW5kZXJhYmxlID0gdGVtcE9iamVjdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRlbXBPYmplY3QgPSB0ZW1wT2JqZWN0Ll9pTmV4dDtcbiAgICB9XG4gICAgd2hpbGUodGVtcE9iamVjdCAhPT0gdGVzdE9iamVjdCk7XG59O1xuXG4vKipcbiAqIFJlbW92ZXMgYSBkaXNwbGF5IG9iamVjdCBhbmQgY2hpbGRyZW4gdG8gdGhlIHdlYmdsIGNvbnRleHRcbiAqXG4gKiBAbWV0aG9kIHJlbW92ZURpc3BsYXlPYmplY3RBbmRDaGlsZHJlblxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW1vdmVEaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4gPSBmdW5jdGlvbiByZW1vdmVEaXNwbGF5T2JqZWN0QW5kQ2hpbGRyZW4oZGlzcGxheU9iamVjdClcbntcbiAgICBpZihkaXNwbGF5T2JqZWN0Ll9fcmVuZGVyR3JvdXAgIT09IHRoaXMpIHJldHVybjtcblxuICAgIGRvXG4gICAge1xuICAgICAgICBkaXNwbGF5T2JqZWN0Ll9fcmVuZGVyR3JvdXAgPSBudWxsO1xuICAgICAgICBpZihkaXNwbGF5T2JqZWN0LnJlbmRlcmFibGUpdGhpcy5yZW1vdmVPYmplY3QoZGlzcGxheU9iamVjdCk7XG4gICAgICAgIGRpc3BsYXlPYmplY3QgPSBkaXNwbGF5T2JqZWN0Ll9pTmV4dDtcbiAgICB9XG4gICAgd2hpbGUoZGlzcGxheU9iamVjdCk7XG59O1xuXG4vKipcbiAqIEluc2VydHMgYSBkaXNwbGF5T2JqZWN0IGludG8gdGhlIGxpbmtlZCBsaXN0XG4gKlxuICogQG1ldGhvZCBpbnNlcnRPYmplY3RcbiAqIEBwYXJhbSBkaXNwbGF5T2JqZWN0IHtEaXNwbGF5T2JqZWN0fVxuICogQHBhcmFtIHByZXZpb3VzT2JqZWN0IHtEaXNwbGF5T2JqZWN0fVxuICogQHBhcmFtIG5leHRPYmplY3Qge0Rpc3BsYXlPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5pbnNlcnRPYmplY3QgPSBmdW5jdGlvbiBpbnNlcnRPYmplY3QoZGlzcGxheU9iamVjdCwgcHJldmlvdXNPYmplY3QsIG5leHRPYmplY3QpXG57XG4gICAgLy8gd2hpbGUgbG9vcGluZyBiZWxvdyBUSEUgT0JKRUNUIE1BWSBOT1QgSEFWRSBCRUVOIEFEREVEXG4gICAgdmFyIHByZXZpb3VzU3ByaXRlID0gcHJldmlvdXNPYmplY3QsXG4gICAgICAgIG5leHRTcHJpdGUgPSBuZXh0T2JqZWN0LFxuICAgICAgICBiYXRjaCwgaW5kZXg7XG5cbiAgICAvKlxuICAgICAqIHNvIG5vdyB3ZSBoYXZlIHRoZSBuZXh0IHJlbmRlcmFibGUgYW5kIHRoZSBwcmV2aW91cyByZW5kZXJhYmxlXG4gICAgICpcbiAgICAgKi9cbiAgICBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3ByaXRlKVxuICAgIHtcbiAgICAgICAgdmFyIHByZXZpb3VzQmF0Y2gsIG5leHRCYXRjaDtcblxuICAgICAgICBpZihwcmV2aW91c1Nwcml0ZSBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgcHJldmlvdXNCYXRjaCA9IHByZXZpb3VzU3ByaXRlLmJhdGNoO1xuICAgICAgICAgICAgaWYocHJldmlvdXNCYXRjaClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZihwcmV2aW91c0JhdGNoLnRleHR1cmUgPT09IGRpc3BsYXlPYmplY3QudGV4dHVyZS5iYXNlVGV4dHVyZSAmJiBwcmV2aW91c0JhdGNoLmJsZW5kTW9kZSA9PT0gZGlzcGxheU9iamVjdC5ibGVuZE1vZGUpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBwcmV2aW91c0JhdGNoLmluc2VydEFmdGVyKGRpc3BsYXlPYmplY3QsIHByZXZpb3VzU3ByaXRlKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIFRPRE8gcmV3b3JkIVxuICAgICAgICAgICAgcHJldmlvdXNCYXRjaCA9IHByZXZpb3VzU3ByaXRlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYobmV4dFNwcml0ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgaWYobmV4dFNwcml0ZSBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuZXh0QmF0Y2ggPSBuZXh0U3ByaXRlLmJhdGNoO1xuXG4gICAgICAgICAgICAgICAgLy9iYXRjaCBtYXkgbm90IGV4aXN0IGlmIGl0ZW0gd2FzIGFkZGVkIHRvIHRoZSBkaXNwbGF5IGxpc3QgYnV0IG5vdCB0byB0aGUgd2ViR0xcbiAgICAgICAgICAgICAgICBpZihuZXh0QmF0Y2gpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBpZihuZXh0QmF0Y2gudGV4dHVyZSA9PT0gZGlzcGxheU9iamVjdC50ZXh0dXJlLmJhc2VUZXh0dXJlICYmIG5leHRCYXRjaC5ibGVuZE1vZGUgPT09IGRpc3BsYXlPYmplY3QuYmxlbmRNb2RlKVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0QmF0Y2guaW5zZXJ0QmVmb3JlKGRpc3BsYXlPYmplY3QsIG5leHRTcHJpdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYobmV4dEJhdGNoID09PSBwcmV2aW91c0JhdGNoKVxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRIRVJFIElTIEEgU1BMSVQgSU4gVEhJUyBCQVRDSCEgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3BsaXRCYXRjaCA9IHByZXZpb3VzQmF0Y2guc3BsaXQobmV4dFNwcml0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ09PTCFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgaXQgYmFjayBpbnRvIHRoZSBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICogT09QUyFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKiBzZWVtcyB0aGUgbmV3IHNwcml0ZSBpcyBpbiB0aGUgbWlkZGxlIG9mIGEgYmF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKiBsZXRzIHNwbGl0IGl0Li5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYXRjaCA9IFdlYkdMQmF0Y2guZ2V0QmF0Y2goKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ID0gdGhpcy5iYXRjaHMuaW5kZXhPZiggcHJldmlvdXNCYXRjaCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhdGNoLmluaXQoZGlzcGxheU9iamVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iYXRjaHMuc3BsaWNlKGluZGV4ICsgMSwgMCwgYmF0Y2gsIHNwbGl0QmF0Y2gpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIFRPRE8gcmUtd29yZCFcblxuICAgICAgICAgICAgICAgIG5leHRCYXRjaCA9IG5leHRTcHJpdGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKlxuICAgICAgICAgKiBsb29rcyBsaWtlIGl0IGRvZXMgbm90IGJlbG9uZyB0byBhbnkgYmF0Y2ghXG4gICAgICAgICAqIGJ1dCBpcyBhbHNvIG5vdCBpbnRlcnNlY3Rpbmcgb25lLi5cbiAgICAgICAgICogdGltZSB0byBjcmVhdGUgYW5ldyBvbmUhXG4gICAgICAgICAqL1xuXG4gICAgICAgIGJhdGNoID0gV2ViR0xCYXRjaC5nZXRCYXRjaCgpO1xuICAgICAgICBiYXRjaC5pbml0KGRpc3BsYXlPYmplY3QpO1xuXG4gICAgICAgIGlmKHByZXZpb3VzQmF0Y2gpIC8vIGlmIHRoaXMgaXMgaW52YWxpZCBpdCBtZWFuc1xuICAgICAgICB7XG4gICAgICAgICAgICBpbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoIHByZXZpb3VzQmF0Y2ggKTtcbiAgICAgICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCArIDEsIDAsIGJhdGNoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuYmF0Y2hzLnB1c2goYmF0Y2gpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBlbHNlIGlmKGRpc3BsYXlPYmplY3QgaW5zdGFuY2VvZiBUaWxpbmdTcHJpdGUpXG4gICAge1xuXG4gICAgICAgIC8vIGFkZCB0byBhIGJhdGNoISFcbiAgICAgICAgdGhpcy5pbml0VGlsaW5nU3ByaXRlKGRpc3BsYXlPYmplY3QpO1xuICAgIC8vICB0aGlzLmJhdGNocy5wdXNoKGRpc3BsYXlPYmplY3QpO1xuXG4gICAgfVxuICAgIGVsc2UgaWYoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIFN0cmlwKVxuICAgIHtcbiAgICAgICAgLy8gYWRkIHRvIGEgYmF0Y2ghIVxuICAgICAgICB0aGlzLmluaXRTdHJpcChkaXNwbGF5T2JqZWN0KTtcbiAgICAvLyAgdGhpcy5iYXRjaHMucHVzaChkaXNwbGF5T2JqZWN0KTtcbiAgICB9XG4gICAgLypcbiAgICBlbHNlIGlmKGRpc3BsYXlPYmplY3QpLy8gaW5zdGFuY2VvZiBHcmFwaGljcylcbiAgICB7XG4gICAgICAgIC8vZGlzcGxheU9iamVjdC5pbml0V2ViR0wodGhpcyk7XG5cbiAgICAgICAgLy8gYWRkIHRvIGEgYmF0Y2ghIVxuICAgICAgICAvL3RoaXMuaW5pdFN0cmlwKGRpc3BsYXlPYmplY3QpO1xuICAgICAgICAvL3RoaXMuYmF0Y2hzLnB1c2goZGlzcGxheU9iamVjdCk7XG4gICAgfVxuICAgICovXG5cbiAgICB0aGlzLmluc2VydEFmdGVyKGRpc3BsYXlPYmplY3QsIHByZXZpb3VzU3ByaXRlKTtcblxuICAgIC8vIGluc2VydCBhbmQgU1BMSVQhXG59O1xuXG4vKipcbiAqIEluc2VydHMgYSBkaXNwbGF5T2JqZWN0IGludG8gdGhlIGxpbmtlZCBsaXN0XG4gKlxuICogQG1ldGhvZCBpbnNlcnRBZnRlclxuICogQHBhcmFtIGl0ZW0ge0Rpc3BsYXlPYmplY3R9XG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gVGhlIG9iamVjdCB0byBpbnNlcnRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmluc2VydEFmdGVyID0gZnVuY3Rpb24gaW5zZXJ0QWZ0ZXIoaXRlbSwgZGlzcGxheU9iamVjdClcbntcbiAgICB2YXIgcHJldmlvdXNCYXRjaCwgc3BsaXRCYXRjaCwgaW5kZXg7XG5cbiAgICBpZihkaXNwbGF5T2JqZWN0IGluc3RhbmNlb2YgU3ByaXRlKVxuICAgIHtcbiAgICAgICAgcHJldmlvdXNCYXRjaCA9IGRpc3BsYXlPYmplY3QuYmF0Y2g7XG5cbiAgICAgICAgaWYocHJldmlvdXNCYXRjaClcbiAgICAgICAge1xuICAgICAgICAgICAgLy8gc28gdGhpcyBvYmplY3QgaXMgaW4gYSBiYXRjaCFcblxuICAgICAgICAgICAgLy8gaXMgaXQgbm90PyBuZWVkIHRvIHNwbGl0IHRoZSBiYXRjaFxuICAgICAgICAgICAgaWYocHJldmlvdXNCYXRjaC50YWlsID09PSBkaXNwbGF5T2JqZWN0KVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIGlzIGl0IHRhaWw/IGluc2VydCBpbiB0byBiYXRjaHNcbiAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoIHByZXZpb3VzQmF0Y2ggKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXgrMSwgMCwgaXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETyBNT0RJRlkgQUREIC8gUkVNT1ZFIENISUxEIFRPIEFDQ09VTlQgRk9SIEZJTFRFUlMgKGFsc28gZ2V0IHByZXYgYW5kIG5leHQpIC8vXG5cbiAgICAgICAgICAgICAgICAvLyBUSEVSRSBJUyBBIFNQTElUIElOIFRISVMgQkFUQ0ghIC8vXG4gICAgICAgICAgICAgICAgc3BsaXRCYXRjaCA9IHByZXZpb3VzQmF0Y2guc3BsaXQoZGlzcGxheU9iamVjdC5fX25leHQpO1xuXG4gICAgICAgICAgICAgICAgLy8gQ09PTCFcbiAgICAgICAgICAgICAgICAvLyBhZGQgaXQgYmFjayBpbnRvIHRoZSBhcnJheVxuICAgICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgICogT09QUyFcbiAgICAgICAgICAgICAgICAgKiBzZWVtcyB0aGUgbmV3IHNwcml0ZSBpcyBpbiB0aGUgbWlkZGxlIG9mIGEgYmF0Y2hcbiAgICAgICAgICAgICAgICAgKiBsZXRzIHNwbGl0IGl0Li5cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBpbmRleCA9IHRoaXMuYmF0Y2hzLmluZGV4T2YoIHByZXZpb3VzQmF0Y2ggKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXgrMSwgMCwgaXRlbSwgc3BsaXRCYXRjaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmJhdGNocy5wdXNoKGl0ZW0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIGluZGV4ID0gdGhpcy5iYXRjaHMuaW5kZXhPZiggZGlzcGxheU9iamVjdCApO1xuICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXgrMSwgMCwgaXRlbSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBSZW1vdmVzIGEgZGlzcGxheU9iamVjdCBmcm9tIHRoZSBsaW5rZWQgbGlzdFxuICpcbiAqIEBtZXRob2QgcmVtb3ZlT2JqZWN0XG4gKiBAcGFyYW0gZGlzcGxheU9iamVjdCB7RGlzcGxheU9iamVjdH0gVGhlIG9iamVjdCB0byByZW1vdmVcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbW92ZU9iamVjdCA9IGZ1bmN0aW9uIHJlbW92ZU9iamVjdChkaXNwbGF5T2JqZWN0KVxue1xuICAgIC8vIGxvb3AgdGhyb3VnaCBjaGlsZHJlbi4uXG4gICAgLy8gZGlzcGxheSBvYmplY3QgLy9cblxuICAgIC8vIGFkZCBhIGNoaWxkIGZyb20gdGhlIHJlbmRlciBncm91cC4uXG4gICAgLy8gcmVtb3ZlIGl0IGFuZCBhbGwgaXRzIGNoaWxkcmVuIVxuICAgIC8vZGlzcGxheU9iamVjdC5jYWNoZVZpc2libGUgPSBmYWxzZTsvL2Rpc3BsYXlPYmplY3QudmlzaWJsZTtcblxuICAgIC8qXG4gICAgICogcmVtb3ZpbmcgaXMgYSBsb3QgcXVpY2tlci4uXG4gICAgICpcbiAgICAgKi9cbiAgICB2YXIgYmF0Y2hUb1JlbW92ZSwgaW5kZXg7XG5cbiAgICBpZiAoZGlzcGxheU9iamVjdCBpbnN0YW5jZW9mIFNwcml0ZSlcbiAgICB7XG4gICAgICAgIC8vIHNob3VsZCBhbHdheXMgaGF2ZSBhIGJhdGNoIVxuICAgICAgICB2YXIgYmF0Y2ggPSBkaXNwbGF5T2JqZWN0LmJhdGNoO1xuICAgICAgICBpZighYmF0Y2gpcmV0dXJuOyAvLyB0aGlzIG1lYW5zIHRoZSBkaXNwbGF5IGxpc3QgaGFzIGJlZW4gYWx0ZXJlZCBiZWZyZSByZW5kZXJpbmdcblxuICAgICAgICBiYXRjaC5yZW1vdmUoZGlzcGxheU9iamVjdCk7XG5cbiAgICAgICAgaWYgKCFiYXRjaC5zaXplKVxuICAgICAgICB7XG4gICAgICAgICAgICBiYXRjaFRvUmVtb3ZlID0gYmF0Y2g7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgYmF0Y2hUb1JlbW92ZSA9IGRpc3BsYXlPYmplY3Q7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBMb29rcyBsaWtlIHRoZXJlIGlzIHNvbXRoaW5nIHRoYXQgbmVlZHMgcmVtb3ZpbmchXG4gICAgICovXG4gICAgaWYoYmF0Y2hUb1JlbW92ZSlcbiAgICB7XG4gICAgICAgIGluZGV4ID0gdGhpcy5iYXRjaHMuaW5kZXhPZiggYmF0Y2hUb1JlbW92ZSApO1xuICAgICAgICBpZihpbmRleCA9PT0gLTEpcmV0dXJuOy8vIHRoaXMgbWVhbnMgaXQgd2FzIGFkZGVkIHRoZW4gcmVtb3ZlZCBiZWZvcmUgcmVuZGVyZWRcblxuICAgICAgICAvLyBvayBzby4uIGNoZWNrIHRvIHNlZSBpZiB5b3UgYWRqYWNlbnQgYmF0Y2hzIHNob3VsZCBiZSBqb2luZWQuXG4gICAgICAgIC8vIFRPRE8gbWF5IG9wdGltaXNlP1xuICAgICAgICBpZihpbmRleCA9PT0gMCB8fCBpbmRleCA9PT0gdGhpcy5iYXRjaHMubGVuZ3RoLTEpXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIHdoYSAtIGV2YSEganVzdCBnZXQgb2YgdGhlIGVtcHR5IGJhdGNoIVxuICAgICAgICAgICAgdGhpcy5iYXRjaHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIGlmKGJhdGNoVG9SZW1vdmUgaW5zdGFuY2VvZiBXZWJHTEJhdGNoKVdlYkdMQmF0Y2gucmV0dXJuQmF0Y2goYmF0Y2hUb1JlbW92ZSk7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuYmF0Y2hzW2luZGV4LTFdIGluc3RhbmNlb2YgV2ViR0xCYXRjaCAmJiB0aGlzLmJhdGNoc1tpbmRleCsxXSBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKHRoaXMuYmF0Y2hzW2luZGV4LTFdLnRleHR1cmUgPT09IHRoaXMuYmF0Y2hzW2luZGV4KzFdLnRleHR1cmUgJiYgdGhpcy5iYXRjaHNbaW5kZXgtMV0uYmxlbmRNb2RlID09PSB0aGlzLmJhdGNoc1tpbmRleCsxXS5ibGVuZE1vZGUpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhcIk1FUkdFXCIpXG4gICAgICAgICAgICAgICAgdGhpcy5iYXRjaHNbaW5kZXgtMV0ubWVyZ2UodGhpcy5iYXRjaHNbaW5kZXgrMV0pO1xuXG4gICAgICAgICAgICAgICAgaWYoYmF0Y2hUb1JlbW92ZSBpbnN0YW5jZW9mIFdlYkdMQmF0Y2gpV2ViR0xCYXRjaC5yZXR1cm5CYXRjaChiYXRjaFRvUmVtb3ZlKTtcbiAgICAgICAgICAgICAgICBXZWJHTEJhdGNoLnJldHVybkJhdGNoKHRoaXMuYmF0Y2hzW2luZGV4KzFdKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJhdGNocy5zcGxpY2UoaW5kZXgsIDIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYmF0Y2hzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGlmKGJhdGNoVG9SZW1vdmUgaW5zdGFuY2VvZiBXZWJHTEJhdGNoKVdlYkdMQmF0Y2gucmV0dXJuQmF0Y2goYmF0Y2hUb1JlbW92ZSk7XG4gICAgfVxufTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyBhIHRpbGluZyBzcHJpdGVcbiAqXG4gKiBAbWV0aG9kIGluaXRUaWxpbmdTcHJpdGVcbiAqIEBwYXJhbSBzcHJpdGUge1RpbGluZ1Nwcml0ZX0gVGhlIHRpbGluZyBzcHJpdGUgdG8gaW5pdGlhbGl6ZVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uaW5pdFRpbGluZ1Nwcml0ZSA9IGZ1bmN0aW9uIGluaXRUaWxpbmdTcHJpdGUoc3ByaXRlKVxue1xuICAgIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgICAvLyBtYWtlIHRoZSB0ZXh0dXJlIHRpbGFibGUuLlxuXG4gICAgc3ByaXRlLnZlcnRpY2llcyA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcHJpdGUud2lkdGgsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcHJpdGUud2lkdGgsICBzcHJpdGUuaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAgc3ByaXRlLmhlaWdodF0pO1xuXG4gICAgc3ByaXRlLnV2cyA9IG5ldyBGbG9hdDMyQXJyYXkoWzAsIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMSwgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDFdKTtcblxuICAgIHNwcml0ZS5jb2xvcnMgPSBuZXcgRmxvYXQzMkFycmF5KFsxLDEsMSwxXSk7XG5cbiAgICBzcHJpdGUuaW5kaWNlcyA9ICBuZXcgVWludDE2QXJyYXkoWzAsIDEsIDMsMl0pOyAvLywgMl0pO1xuXG4gICAgc3ByaXRlLl92ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICBzcHJpdGUuX2luZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgc3ByaXRlLl91dkJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgIHNwcml0ZS5fY29sb3JCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzcHJpdGUuX3ZlcnRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIHNwcml0ZS52ZXJ0aWNpZXMsIGdsLlNUQVRJQ19EUkFXKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzcHJpdGUuX3V2QnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgIHNwcml0ZS51dnMsIGdsLkRZTkFNSUNfRFJBVyk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3ByaXRlLl9jb2xvckJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIHNwcml0ZS5jb2xvcnMsIGdsLlNUQVRJQ19EUkFXKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHNwcml0ZS5faW5kZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHNwcml0ZS5pbmRpY2VzLCBnbC5TVEFUSUNfRFJBVyk7XG5cbi8vICAgIHJldHVybiAoICh4ID4gMCkgJiYgKCh4ICYgKHggLSAxKSkgPT0gMCkgKTtcblxuICAgIGlmKHNwcml0ZS50ZXh0dXJlLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUpXG4gICAge1xuICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlKTtcbiAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuUkVQRUFUKTtcbiAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuUkVQRUFUKTtcbiAgICAgICAgc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUuX3Bvd2VyT2YyID0gdHJ1ZTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUuX3Bvd2VyT2YyID0gdHJ1ZTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFJlbmRlcnMgYSBTdHJpcFxuICpcbiAqIEBtZXRob2QgcmVuZGVyU3RyaXBcbiAqIEBwYXJhbSBzdHJpcCB7U3RyaXB9IFRoZSBzdHJpcCB0byByZW5kZXJcbiAqIEBwYXJhbSBwcm9qZWN0aW9uIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5yZW5kZXJTdHJpcCA9IGZ1bmN0aW9uIHJlbmRlclN0cmlwKHN0cmlwLCBwcm9qZWN0aW9uKVxue1xuICAgIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgICBzaGFkZXJzLmFjdGl2YXRlU3RyaXBTaGFkZXIoKTtcblxuICAgIHZhciBzaGFkZXIgPSBnbG9iYWxzLnN0cmlwU2hhZGVyO1xuXG4gICAgdmFyIG0gPSBtYXQzLmNsb25lKHN0cmlwLndvcmxkVHJhbnNmb3JtKTtcblxuICAgIG1hdDMudHJhbnNwb3NlKG0pO1xuXG4gICAgLy8gc2V0IHRoZSBtYXRyaXggdHJhbnNmb3JtIGZvciB0aGVcbiAgICBnbC51bmlmb3JtTWF0cml4M2Z2KHNoYWRlci50cmFuc2xhdGlvbk1hdHJpeCwgZmFsc2UsIG0pO1xuICAgIGdsLnVuaWZvcm0yZihzaGFkZXIucHJvamVjdGlvblZlY3RvciwgcHJvamVjdGlvbi54LCBwcm9qZWN0aW9uLnkpO1xuICAgIGdsLnVuaWZvcm0yZihzaGFkZXIub2Zmc2V0VmVjdG9yLCAtZ2xvYmFscy5vZmZzZXQueCwgLWdsb2JhbHMub2Zmc2V0LnkpO1xuXG4gICAgZ2wudW5pZm9ybTFmKHNoYWRlci5hbHBoYSwgc3RyaXAud29ybGRBbHBoYSk7XG5cbiAgICAvKlxuICAgIGlmKHN0cmlwLmJsZW5kTW9kZSA9PSBibGVuZE1vZGVzLk5PUk1BTClcbiAgICB7XG4gICAgICAgIGdsLmJsZW5kRnVuYyhnbC5PTkUsIGdsLk9ORV9NSU5VU19TUkNfQUxQSEEpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5PTkVfTUlOVVNfU1JDX0NPTE9SKTtcbiAgICB9XG4gICAgKi9cblxuXG4gICAgaWYoIXN0cmlwLmRpcnR5KVxuICAgIHtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl92ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICBnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgc3RyaXAudmVydGljaWVzKTtcbiAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXIuYVZlcnRleFBvc2l0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgdXZzXG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fdXZCdWZmZXIpO1xuICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlci5hVGV4dHVyZUNvb3JkLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgICAgIGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTApO1xuICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBzdHJpcC50ZXh0dXJlLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUpO1xuXG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fY29sb3JCdWZmZXIpO1xuICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHNoYWRlci5jb2xvckF0dHJpYnV0ZSwgMSwgZ2wuRkxPQVQsIGZhbHNlLCAwLCAwKTtcblxuICAgICAgICAvLyBkb250IG5lZWQgdG8gdXBsb2FkIVxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBzdHJpcC5faW5kZXhCdWZmZXIpO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgICBzdHJpcC5kaXJ0eSA9IGZhbHNlO1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAuX3ZlcnRleEJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC52ZXJ0aWNpZXMsIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXIuYVZlcnRleFBvc2l0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgdXZzXG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fdXZCdWZmZXIpO1xuICAgICAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAudXZzLCBnbC5TVEFUSUNfRFJBVyk7XG4gICAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoc2hhZGVyLmFUZXh0dXJlQ29vcmQsIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgZ2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCk7XG4gICAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHN0cmlwLnRleHR1cmUuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSk7XG5cbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLl9jb2xvckJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5jb2xvcnMsIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihzaGFkZXIuY29sb3JBdHRyaWJ1dGUsIDEsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgICAgICAgLy8gZG9udCBuZWVkIHRvIHVwbG9hZCFcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc3RyaXAuX2luZGV4QnVmZmVyKTtcbiAgICAgICAgZ2wuYnVmZmVyRGF0YShnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc3RyaXAuaW5kaWNlcywgZ2wuU1RBVElDX0RSQVcpO1xuXG4gICAgfVxuXG4gICAgZ2wuZHJhd0VsZW1lbnRzKGdsLlRSSUFOR0xFX1NUUklQLCBzdHJpcC5pbmRpY2VzLmxlbmd0aCwgZ2wuVU5TSUdORURfU0hPUlQsIDApO1xuXG4gICAgc2hhZGVycy5kZWFjdGl2YXRlU3RyaXBTaGFkZXIoKTtcbn07XG5cbi8qKlxuICogUmVuZGVycyBhIFRpbGluZ1Nwcml0ZVxuICpcbiAqIEBtZXRob2QgcmVuZGVyVGlsaW5nU3ByaXRlXG4gKiBAcGFyYW0gc3ByaXRlIHtUaWxpbmdTcHJpdGV9IFRoZSB0aWxpbmcgc3ByaXRlIHRvIHJlbmRlclxuICogQHBhcmFtIHByb2plY3Rpb25NYXRyaXgge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLnJlbmRlclRpbGluZ1Nwcml0ZSA9IGZ1bmN0aW9uIHJlbmRlclRpbGluZ1Nwcml0ZShzcHJpdGUsIHByb2plY3Rpb25NYXRyaXgpXG57XG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIHZhciB0aWxlUG9zaXRpb24gPSBzcHJpdGUudGlsZVBvc2l0aW9uO1xuICAgIHZhciB0aWxlU2NhbGUgPSBzcHJpdGUudGlsZVNjYWxlO1xuXG4gICAgdmFyIG9mZnNldFggPSAgdGlsZVBvc2l0aW9uLngvc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUud2lkdGg7XG4gICAgdmFyIG9mZnNldFkgPSAgdGlsZVBvc2l0aW9uLnkvc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUuaGVpZ2h0O1xuXG4gICAgdmFyIHNjYWxlWCA9ICAoc3ByaXRlLndpZHRoIC8gc3ByaXRlLnRleHR1cmUuYmFzZVRleHR1cmUud2lkdGgpICAvIHRpbGVTY2FsZS54O1xuICAgIHZhciBzY2FsZVkgPSAgKHNwcml0ZS5oZWlnaHQgLyBzcHJpdGUudGV4dHVyZS5iYXNlVGV4dHVyZS5oZWlnaHQpIC8gdGlsZVNjYWxlLnk7XG5cbiAgICBzcHJpdGUudXZzWzBdID0gMCAtIG9mZnNldFg7XG4gICAgc3ByaXRlLnV2c1sxXSA9IDAgLSBvZmZzZXRZO1xuXG4gICAgc3ByaXRlLnV2c1syXSA9ICgxICogc2NhbGVYKSAgLW9mZnNldFg7XG4gICAgc3ByaXRlLnV2c1szXSA9IDAgLSBvZmZzZXRZO1xuXG4gICAgc3ByaXRlLnV2c1s0XSA9ICgxICpzY2FsZVgpIC0gb2Zmc2V0WDtcbiAgICBzcHJpdGUudXZzWzVdID0gKDEgKnNjYWxlWSkgLSBvZmZzZXRZO1xuXG4gICAgc3ByaXRlLnV2c1s2XSA9IDAgLSBvZmZzZXRYO1xuICAgIHNwcml0ZS51dnNbN10gPSAoMSAqc2NhbGVZKSAtIG9mZnNldFk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3ByaXRlLl91dkJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyU3ViRGF0YShnbC5BUlJBWV9CVUZGRVIsIDAsIHNwcml0ZS51dnMpO1xuXG4gICAgdGhpcy5yZW5kZXJTdHJpcChzcHJpdGUsIHByb2plY3Rpb25NYXRyaXgpO1xufTtcblxuLyoqXG4gKiBJbml0aWFsaXplcyBhIHN0cmlwIHRvIGJlIHJlbmRlcmVkXG4gKlxuICogQG1ldGhvZCBpbml0U3RyaXBcbiAqIEBwYXJhbSBzdHJpcCB7U3RyaXB9IFRoZSBzdHJpcCB0byBpbml0aWFsaXplXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5pbml0U3RyaXAgPSBmdW5jdGlvbiBpbml0U3RyaXAoc3RyaXApXG57XG4gICAgLy8gYnVpbGQgdGhlIHN0cmlwIVxuICAgIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgICBzdHJpcC5fdmVydGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgc3RyaXAuX2luZGV4QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgc3RyaXAuX3V2QnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgc3RyaXAuX2NvbG9yQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAuX3ZlcnRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIHN0cmlwLnZlcnRpY2llcywgZ2wuRFlOQU1JQ19EUkFXKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBzdHJpcC5fdXZCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAgc3RyaXAudXZzLCBnbC5TVEFUSUNfRFJBVyk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAuX2NvbG9yQnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgc3RyaXAuY29sb3JzLCBnbC5TVEFUSUNfRFJBVyk7XG5cblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHN0cmlwLl9pbmRleEJ1ZmZlcik7XG4gICAgZ2wuYnVmZmVyRGF0YShnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgc3RyaXAuaW5kaWNlcywgZ2wuU1RBVElDX0RSQVcpO1xufTtcblxuLyoqXG4gKiBVcGRhdGVzIGEgbG9hZGVkIHdlYmdsIHRleHR1cmVcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHVwZGF0ZVRleHR1cmVcbiAqIEBwYXJhbSBnbCB7V2ViR0xDb250ZXh0fSBBbiBpbnN0YW5jZSBvZiB0aGUgd2ViR0wgY29udGV4dFxuICogQHBhcmFtIHRleHR1cmUge1RleHR1cmV9IFRoZSB0ZXh0dXJlIHRvIHVwZGF0ZVxuICovXG5XZWJHTFJlbmRlckdyb3VwLnVwZGF0ZVRleHR1cmUgPSBmdW5jdGlvbiB1cGRhdGVUZXh0dXJlKGdsLCB0ZXh0dXJlKVxue1xuICAgIC8vVE9ETyBicmVhayB0aGlzIG91dCBpbnRvIGEgdGV4dHVyZSBtYW5hZ2VyLi4uXG4gICAgaWYoIXRleHR1cmUuX2dsVGV4dHVyZSlcbiAgICB7XG4gICAgICAgIHRleHR1cmUuX2dsVGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICB9XG5cbiAgICBpZih0ZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRleHR1cmUuX2dsVGV4dHVyZSk7XG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgdHJ1ZSk7XG5cbiAgICAgICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCB0ZXh0dXJlLnNvdXJjZSk7XG4gICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCB0ZXh0dXJlLnNjYWxlTW9kZSA9PT0gQmFzZVRleHR1cmUuU0NBTEVfTU9ERS5MSU5FQVIgPyBnbC5MSU5FQVIgOiBnbC5ORUFSRVNUKTtcbiAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIHRleHR1cmUuc2NhbGVNb2RlID09PSBCYXNlVGV4dHVyZS5TQ0FMRV9NT0RFLkxJTkVBUiA/IGdsLkxJTkVBUiA6IGdsLk5FQVJFU1QpO1xuXG4gICAgICAgIC8vIHJlZ3VsZXIuLi5cblxuICAgICAgICBpZighdGV4dHVyZS5fcG93ZXJPZjIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICB7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5SRVBFQVQpO1xuICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuUkVQRUFUKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuICAgIH1cbn07XG5cbi8qKlxuICogRGVzdHJveXMgYSBsb2FkZWQgd2ViZ2wgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgZGVzdHJveVRleHR1cmVcbiAqIEBwYXJhbSBnbCB7V2ViR0xDb250ZXh0fSBBbiBpbnN0YW5jZSBvZiB0aGUgd2ViR0wgY29udGV4dFxuICogQHBhcmFtIHRleHR1cmUge1RleHR1cmV9IFRoZSB0ZXh0dXJlIHRvIHVwZGF0ZVxuICovXG5XZWJHTFJlbmRlckdyb3VwLmRlc3Ryb3lUZXh0dXJlID0gZnVuY3Rpb24gZGVzdHJveVRleHR1cmUoZ2wsIHRleHR1cmUpXG57XG4gICAgLy9UT0RPIGJyZWFrIHRoaXMgb3V0IGludG8gYSB0ZXh0dXJlIG1hbmFnZXIuLi5cbiAgICBpZih0ZXh0dXJlLl9nbFRleHR1cmUpXG4gICAge1xuICAgICAgICB0ZXh0dXJlLl9nbFRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgICAgIGdsLmRlbGV0ZVRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZS5fZ2xUZXh0dXJlKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGhlIHRleHR1cmVzIGxvYWRlZCBpbnRvIHRoaXMgd2ViZ2wgcmVuZGVyZXJcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIHVwZGF0ZVRleHR1cmVzXG4gKiBAcGFyYW0gZ2wge1dlYkdMQ29udGV4dH0gQW4gaW5zdGFuY2Ugb2YgdGhlIHdlYkdMIGNvbnRleHRcbiAqL1xuV2ViR0xSZW5kZXJHcm91cC51cGRhdGVUZXh0dXJlcyA9IGZ1bmN0aW9uIHVwZGF0ZVRleHR1cmVzKGdsKVxue1xuICAgIC8vVE9ETyBicmVhayB0aGlzIG91dCBpbnRvIGEgdGV4dHVyZSBtYW5hZ2VyLi4uXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBnbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgICAgICBXZWJHTFJlbmRlckdyb3VwLnVwZGF0ZVRleHR1cmUoZ2wsIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZVtpXSk7XG4gICAgZm9yIChpID0gMCwgbCA9IGdsb2JhbHMudGV4dHVyZXNUb0Rlc3Ryb3kubGVuZ3RoOyBpIDwgbDsgaSsrKVxuICAgICAgICBXZWJHTFJlbmRlckdyb3VwLmRlc3Ryb3lUZXh0dXJlKGdsLCBnbG9iYWxzLnRleHR1cmVzVG9EZXN0cm95W2ldKTtcbiAgICBnbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUgPSBbXTtcbiAgICBnbG9iYWxzLnRleHR1cmVzVG9EZXN0cm95ID0gW107XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkdMUmVuZGVyR3JvdXA7XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwbGF0Zm9ybSA9IHJlcXVpcmUoJy4uLy4uL3BsYXRmb3JtJyk7XG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uLy4uL2NvcmUvZ2xvYmFscycpO1xudmFyIHNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKTtcblxudmFyIFdlYkdMQmF0Y2ggPSByZXF1aXJlKCcuL1dlYkdMQmF0Y2gnKTtcbnZhciBXZWJHTFJlbmRlckdyb3VwID0gcmVxdWlyZSgnLi9XZWJHTFJlbmRlckdyb3VwJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi8uLi9nZW9tL1BvaW50Jyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uLy4uL3RleHR1cmVzL1RleHR1cmUnKTtcblxuLyoqXG4gKiB0aGUgV2ViR0xSZW5kZXJlciBpcyBkcmF3cyB0aGUgc3RhZ2UgYW5kIGFsbCBpdHMgY29udGVudCBvbnRvIGEgd2ViR0wgZW5hYmxlZCBjYW52YXMuIFRoaXMgcmVuZGVyZXJcbiAqIHNob3VsZCBiZSB1c2VkIGZvciBicm93c2VycyBzdXBwb3J0IHdlYkdMLiBUaGlzIFJlbmRlciB3b3JrcyBieSBhdXRvbWF0aWNhbGx5IG1hbmFnaW5nIHdlYkdMQmF0Y2hzLlxuICogU28gbm8gbmVlZCBmb3IgU3ByaXRlIEJhdGNoJ3Mgb3IgU3ByaXRlIENsb3VkJ3NcbiAqIERvbnQgZm9yZ2V0IHRvIGFkZCB0aGUgdmlldyB0byB5b3VyIERPTSBvciB5b3Ugd2lsbCBub3Qgc2VlIGFueXRoaW5nIDopXG4gKlxuICogQGNsYXNzIFdlYkdMUmVuZGVyZXJcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHdpZHRoPTAge051bWJlcn0gdGhlIHdpZHRoIG9mIHRoZSBjYW52YXMgdmlld1xuICogQHBhcmFtIGhlaWdodD0wIHtOdW1iZXJ9IHRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyB2aWV3XG4gKiBAcGFyYW0gdmlldyB7Q2FudmFzfSB0aGUgY2FudmFzIHRvIHVzZSBhcyBhIHZpZXcsIG9wdGlvbmFsXG4gKiBAcGFyYW0gdHJhbnNwYXJlbnQ9ZmFsc2Uge0Jvb2xlYW59IHRoZSB0cmFuc3BhcmVuY3kgb2YgdGhlIHJlbmRlciB2aWV3LCBkZWZhdWx0IGZhbHNlXG4gKiBAcGFyYW0gYW50aWFsaWFzPWZhbHNlIHtCb29sZWFufSBzZXRzIGFudGlhbGlhcyAob25seSBhcHBsaWNhYmxlIGluIGNocm9tZSBhdCB0aGUgbW9tZW50KVxuICpcbiAqL1xuZnVuY3Rpb24gV2ViR0xSZW5kZXJlcih3aWR0aCwgaGVpZ2h0LCB2aWV3LCB0cmFuc3BhcmVudCwgYW50aWFsaWFzKVxue1xuICAgIHZhciBnbDtcblxuICAgIHRoaXMudHJhbnNwYXJlbnQgPSAhIXRyYW5zcGFyZW50O1xuXG4gICAgdGhpcy53aWR0aCA9IHdpZHRoIHx8IDgwMDtcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodCB8fCA2MDA7XG5cbiAgICB0aGlzLnZpZXcgPSB2aWV3IHx8IHBsYXRmb3JtLmNyZWF0ZUNhbnZhcygpO1xuICAgIHRoaXMudmlldy53aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgdGhpcy52aWV3LmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgLy8gZGVhbCB3aXRoIGxvc2luZyBjb250ZXh0Li5cbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHRoaXMudmlldy5hZGRFdmVudExpc3RlbmVyKCd3ZWJnbGNvbnRleHRsb3N0JywgZnVuY3Rpb24oZXZlbnQpIHsgc2NvcGUuaGFuZGxlQ29udGV4dExvc3QoZXZlbnQpOyB9LCBmYWxzZSk7XG4gICAgdGhpcy52aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmdsY29udGV4dHJlc3RvcmVkJywgZnVuY3Rpb24oZXZlbnQpIHsgc2NvcGUuaGFuZGxlQ29udGV4dFJlc3RvcmVkKGV2ZW50KTsgfSwgZmFsc2UpO1xuXG4gICAgdGhpcy5iYXRjaHMgPSBbXTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBhbHBoYTogdGhpcy50cmFuc3BhcmVudCxcbiAgICAgICAgYW50aWFsaWFzOiEhYW50aWFsaWFzLCAvLyBTUEVFRCBVUD8/XG4gICAgICAgIHByZW11bHRpcGxpZWRBbHBoYTpmYWxzZSxcbiAgICAgICAgc3RlbmNpbDp0cnVlXG4gICAgfTtcblxuICAgIC8vIGRvIGEgY2F0Y2guLiBvbmx5IDEgd2ViR0wgcmVuZGVyZXIuLlxuICAgIC8vdHJ5ICdleHBlcmltZW50YWwtd2ViZ2wnXG4gICAgdHJ5IHtcbiAgICAgICAgZ2wgPSB0aGlzLnZpZXcuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJywgIG9wdGlvbnMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy90cnkgJ3dlYmdsJ1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZ2wgPSB0aGlzLnZpZXcuZ2V0Q29udGV4dCgnd2ViZ2wnLCAgb3B0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGUyKSB7XG4gICAgICAgICAgICAvLyBmYWlsLCBub3QgYWJsZSB0byBnZXQgYSBjb250ZXh0XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJyBUaGlzIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB3ZWJHTC4gVHJ5IHVzaW5nIHRoZSBjYW52YXMgcmVuZGVyZXInICsgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gVE9ETyByZW1vdmUgdGhpcyBnbG9iYWwuLlxuICAgIHRoaXMuZ2wgPSBnbG9iYWxzLmdsID0gZ2w7XG5cbiAgICBzaGFkZXJzLmluaXREZWZhdWx0U2hhZGVycygpO1xuXG4gICAgZ2wudXNlUHJvZ3JhbShnbG9iYWxzLmRlZmF1bHRTaGFkZXIucHJvZ3JhbSk7XG5cbiAgICB0aGlzLmJhdGNoID0gbmV3IFdlYkdMQmF0Y2goZ2wpO1xuICAgIGdsLmRpc2FibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgZ2wuZGlzYWJsZShnbC5DVUxMX0ZBQ0UpO1xuXG4gICAgZ2wuZW5hYmxlKGdsLkJMRU5EKTtcbiAgICBnbC5jb2xvck1hc2sodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdGhpcy50cmFuc3BhcmVudCk7XG5cbiAgICAvLyBUT0RPIHJlbW92ZSB0aGVzZSBnbG9iYWxzLi5cbiAgICB0aGlzLnByb2plY3Rpb24gPSBnbG9iYWxzLnByb2plY3Rpb24gPSBuZXcgUG9pbnQoNDAwLCAzMDApO1xuICAgIHRoaXMub2Zmc2V0ID0gZ2xvYmFscy5vZmZzZXQgPSBuZXcgUG9pbnQoMCwgMCk7XG5cbiAgICB0aGlzLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgdGhpcy5jb250ZXh0TG9zdCA9IGZhbHNlO1xuXG4gICAgdGhpcy5zdGFnZVJlbmRlckdyb3VwID0gbmV3IFdlYkdMUmVuZGVyR3JvdXAodGhpcy5nbCwgdGhpcy50cmFuc3BhcmVudCk7XG59XG5cbnZhciBwcm90byA9IFdlYkdMUmVuZGVyZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIFJlbmRlcnMgdGhlIHN0YWdlIHRvIGl0cyB3ZWJHTCB2aWV3XG4gKlxuICogQG1ldGhvZCByZW5kZXJcbiAqIEBwYXJhbSBzdGFnZSB7U3RhZ2V9IHRoZSBTdGFnZSBlbGVtZW50IHRvIGJlIHJlbmRlcmVkXG4gKi9cbnByb3RvLnJlbmRlciA9IGZ1bmN0aW9uIHJlbmRlcihzdGFnZSlcbntcbiAgICBpZih0aGlzLmNvbnRleHRMb3N0KXJldHVybjtcblxuXG4gICAgLy8gaWYgcmVuZGVyaW5nIGEgbmV3IHN0YWdlIGNsZWFyIHRoZSBiYXRjaHMuLlxuICAgIGlmKHRoaXMuX19zdGFnZSAhPT0gc3RhZ2UpXG4gICAge1xuICAgICAgICAvLyBUT0RPIG1ha2UgdGhpcyB3b3JrXG4gICAgICAgIC8vIGRvbnQgdGhpbmsgdGhpcyBpcyBuZWVkZWQgYW55IG1vcmU/XG4gICAgICAgIHRoaXMuX19zdGFnZSA9IHN0YWdlO1xuICAgICAgICB0aGlzLnN0YWdlUmVuZGVyR3JvdXAuc2V0UmVuZGVyYWJsZShzdGFnZSk7XG4gICAgfVxuXG4gICAgdmFyIGdsID0gdGhpcy5nbDtcblxuICAgIC8vIHVwZGF0ZSBhbnkgdGV4dHVyZXNcbiAgICBXZWJHTFJlbmRlckdyb3VwLnVwZGF0ZVRleHR1cmVzKGdsKTtcblxuICAgIC8vIHVwZGF0ZSB0aGUgc2NlbmUgZ3JhcGhcbiAgICBnbG9iYWxzLnZpc2libGVDb3VudCsrO1xuICAgIHN0YWdlLnVwZGF0ZVRyYW5zZm9ybSgpO1xuXG4gICAgLy8gLS0gRG9lcyB0aGlzIG5lZWQgdG8gYmUgc2V0IGV2ZXJ5IGZyYW1lPyAtLSAvL1xuICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0aGlzLnRyYW5zcGFyZW50KTtcbiAgICBnbC52aWV3cG9ydCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG51bGwpO1xuXG4gICAgZ2wuY2xlYXJDb2xvcihzdGFnZS5iYWNrZ3JvdW5kQ29sb3JTcGxpdFswXSxzdGFnZS5iYWNrZ3JvdW5kQ29sb3JTcGxpdFsxXSxzdGFnZS5iYWNrZ3JvdW5kQ29sb3JTcGxpdFsyXSwgIXRoaXMudHJhbnNwYXJlbnQpO1xuICAgIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQpO1xuXG4gICAgLy8gSEFDSyBUTyBURVNUXG5cbiAgICB0aGlzLnN0YWdlUmVuZGVyR3JvdXAuYmFja2dyb3VuZENvbG9yID0gc3RhZ2UuYmFja2dyb3VuZENvbG9yU3BsaXQ7XG5cbiAgICB0aGlzLnByb2plY3Rpb24ueCA9ICB0aGlzLndpZHRoLzI7XG4gICAgdGhpcy5wcm9qZWN0aW9uLnkgPSAgLXRoaXMuaGVpZ2h0LzI7XG5cbiAgICB0aGlzLnN0YWdlUmVuZGVyR3JvdXAucmVuZGVyKHRoaXMucHJvamVjdGlvbik7XG5cbiAgICAvLyBpbnRlcmFjdGlvblxuICAgIC8vIHJ1biBpbnRlcmFjdGlvbiFcbiAgICBpZihzdGFnZS5pbnRlcmFjdGl2ZSlcbiAgICB7XG4gICAgICAgIC8vbmVlZCB0byBhZGQgc29tZSBldmVudHMhXG4gICAgICAgIGlmKCFzdGFnZS5faW50ZXJhY3RpdmVFdmVudHNBZGRlZClcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhZ2UuX2ludGVyYWN0aXZlRXZlbnRzQWRkZWQgPSB0cnVlO1xuICAgICAgICAgICAgc3RhZ2UuaW50ZXJhY3Rpb25NYW5hZ2VyLnNldFRhcmdldCh0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGFmdGVyIHJlbmRlcmluZyBsZXRzIGNvbmZpcm0gYWxsIGZyYW1lcyB0aGF0IGhhdmUgYmVlbiB1b2RhdGVkLi5cbiAgICBpZihUZXh0dXJlLmZyYW1lVXBkYXRlcy5sZW5ndGggPiAwKVxuICAgIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBUZXh0dXJlLmZyYW1lVXBkYXRlcy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIFRleHR1cmUuZnJhbWVVcGRhdGVzW2ldLnVwZGF0ZUZyYW1lID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBUZXh0dXJlLmZyYW1lVXBkYXRlcyA9IFtdO1xuICAgIH1cbn07XG5cbi8qKlxuICogcmVzaXplcyB0aGUgd2ViR0wgdmlldyB0byB0aGUgc3BlY2lmaWVkIHdpZHRoIGFuZCBoZWlnaHRcbiAqXG4gKiBAbWV0aG9kIHJlc2l6ZVxuICogQHBhcmFtIHdpZHRoIHtOdW1iZXJ9IHRoZSBuZXcgd2lkdGggb2YgdGhlIHdlYkdMIHZpZXdcbiAqIEBwYXJhbSBoZWlnaHQge051bWJlcn0gdGhlIG5ldyBoZWlnaHQgb2YgdGhlIHdlYkdMIHZpZXdcbiAqL1xucHJvdG8ucmVzaXplID0gZnVuY3Rpb24gcmVzaXplKHdpZHRoLCBoZWlnaHQpXG57XG4gICAgdGhpcy53aWR0aCA9IHdpZHRoO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgdGhpcy52aWV3LndpZHRoID0gd2lkdGg7XG4gICAgdGhpcy52aWV3LmhlaWdodCA9IGhlaWdodDtcblxuICAgIHRoaXMuZ2wudmlld3BvcnQoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXG4gICAgLy92YXIgcHJvamVjdGlvbk1hdHJpeCA9IHRoaXMucHJvamVjdGlvbk1hdHJpeDtcblxuICAgIHRoaXMucHJvamVjdGlvbi54ID0gIHRoaXMud2lkdGgvMjtcbiAgICB0aGlzLnByb2plY3Rpb24ueSA9ICAtdGhpcy5oZWlnaHQvMjtcblxuLy8gIHByb2plY3Rpb25NYXRyaXhbMF0gPSAyL3RoaXMud2lkdGg7XG4vLyAgcHJvamVjdGlvbk1hdHJpeFs1XSA9IC0yL3RoaXMuaGVpZ2h0O1xuLy8gIHByb2plY3Rpb25NYXRyaXhbMTJdID0gLTE7XG4vLyAgcHJvamVjdGlvbk1hdHJpeFsxM10gPSAxO1xufTtcblxuLyoqXG4gKiBIYW5kbGVzIGEgbG9zdCB3ZWJnbCBjb250ZXh0XG4gKlxuICogQG1ldGhvZCBoYW5kbGVDb250ZXh0TG9zdFxuICogQHBhcmFtIGV2ZW50IHtFdmVudH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmhhbmRsZUNvbnRleHRMb3N0ID0gZnVuY3Rpb24gaGFuZGxlQ29udGV4dExvc3QoZXZlbnQpXG57XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB0aGlzLmNvbnRleHRMb3N0ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogSGFuZGxlcyBhIHJlc3RvcmVkIHdlYmdsIGNvbnRleHRcbiAqXG4gKiBAbWV0aG9kIGhhbmRsZUNvbnRleHRSZXN0b3JlZFxuICogQHBhcmFtIGV2ZW50IHtFdmVudH1cbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmhhbmRsZUNvbnRleHRSZXN0b3JlZCA9IGZ1bmN0aW9uIGhhbmRsZUNvbnRleHRSZXN0b3JlZCgpLyooZXZlbnQpKi9cbntcbiAgICB2YXIgZ2wgPSB0aGlzLmdsID0gdGhpcy52aWV3LmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcsICB7XG4gICAgICAgIGFscGhhOiB0cnVlXG4gICAgfSk7XG5cbiAgICB0aGlzLmluaXRTaGFkZXJzKCk7XG5cbiAgICBmb3IodmFyIGtleSBpbiBUZXh0dXJlLmNhY2hlKVxuICAgIHtcbiAgICAgICAgdmFyIHRleHR1cmUgPSBUZXh0dXJlLmNhY2hlW2tleV0uYmFzZVRleHR1cmU7XG4gICAgICAgIHRleHR1cmUuX2dsVGV4dHVyZSA9IG51bGw7XG4gICAgICAgIFdlYkdMUmVuZGVyR3JvdXAudXBkYXRlVGV4dHVyZShnbCwgdGV4dHVyZSk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmJhdGNocy5sZW5ndGg7IGkgPCBsOyBpKyspXG4gICAge1xuICAgICAgICB0aGlzLmJhdGNoc1tpXS5yZXN0b3JlTG9zdENvbnRleHQoZ2wpO1xuICAgICAgICB0aGlzLmJhdGNoc1tpXS5kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgV2ViR0xCYXRjaC5yZXN0b3JlQmF0Y2hlcyhnbCk7XG5cbiAgICB0aGlzLmNvbnRleHRMb3N0ID0gZmFsc2U7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkdMUmVuZGVyZXI7XG4iLCIvKipcbiAqIEBhdXRob3IgRHIuIEtpYml0eiA8aW5mb0BkcmtpYml0ei5jb20+XG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vLi4vcGxhdGZvcm0nKTtcblxuZXhwb3J0cy5zaGFkZXIgPSBmdW5jdGlvbiBjb21waWxlU2hhZGVyKGdsLCBzaGFkZXJTcmMsIHNoYWRlclR5cGUpXG57XG4gICAgdmFyIHNyYyA9IHNoYWRlclNyYy5qb2luKCdcXG4nKTtcbiAgICB2YXIgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKHNoYWRlclR5cGUpO1xuICAgIGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNyYyk7XG4gICAgZ2wuY29tcGlsZVNoYWRlcihzaGFkZXIpO1xuXG4gICAgaWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykpIHtcbiAgICAgICAgaWYgKHBsYXRmb3JtLmNvbnNvbGUpIHBsYXRmb3JtLmNvbnNvbGUuZXJyb3IoZ2wuZ2V0U2hhZGVySW5mb0xvZyhzaGFkZXIpKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNoYWRlcjtcbn07XG5cbmV4cG9ydHMucHJvZ3JhbSA9IGZ1bmN0aW9uIGNvbXBpbGVQcm9ncmFtKGdsLCB2ZXJ0ZXhTcmMsIGZyYWdtZW50U3JjKVxue1xuICAgIHZhciBmcmFnbWVudFNoYWRlciA9IGV4cG9ydHMuc2hhZGVyKGdsLCBmcmFnbWVudFNyYywgZ2wuRlJBR01FTlRfU0hBREVSKTtcbiAgICB2YXIgdmVydGV4U2hhZGVyID0gZXhwb3J0cy5zaGFkZXIoZ2wsIHZlcnRleFNyYywgZ2wuVkVSVEVYX1NIQURFUik7XG5cbiAgICB2YXIgc2hhZGVyUHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcblxuICAgIGdsLmF0dGFjaFNoYWRlcihzaGFkZXJQcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpO1xuICAgIGdsLmF0dGFjaFNoYWRlcihzaGFkZXJQcm9ncmFtLCBmcmFnbWVudFNoYWRlcik7XG4gICAgZ2wubGlua1Byb2dyYW0oc2hhZGVyUHJvZ3JhbSk7XG5cbiAgICBpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIoc2hhZGVyUHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpKSB7XG4gICAgICAgIGlmIChwbGF0Zm9ybS5jb25zb2xlKSBwbGF0Zm9ybS5jb25zb2xlLmVycm9yKCdDb3VsZCBub3QgaW5pdGlhbGlzZSBzaGFkZXJzJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBzaGFkZXJQcm9ncmFtO1xufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHNoYWRlcnMgPSByZXF1aXJlKCcuL3NoYWRlcnMnKTtcbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgbWF0MyA9IHJlcXVpcmUoJy4uLy4uL2dlb20vbWF0cml4JykubWF0MztcbnZhciBoZXgycmdiID0gcmVxdWlyZSgnLi4vLi4vdXRpbHMvY29sb3InKS5oZXgycmdiO1xudmFyIHRyaWFuZ3VsYXRlID0gcmVxdWlyZSgnLi4vLi4vdXRpbHMvUG9seWsnKS50cmlhbmd1bGF0ZTtcblxudmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vLi4vZ2VvbS9Qb2ludCcpO1xudmFyIEdyYXBoaWNzID0gcmVxdWlyZSgnLi4vLi4vcHJpbWl0aXZlcy9HcmFwaGljcycpO1xuXG4vKipcbiAqIEEgc2V0IG9mIGZ1bmN0aW9ucyB1c2VkIGJ5IHRoZSB3ZWJHTCByZW5kZXJlciB0byBkcmF3IHRoZSBwcmltaXRpdmUgZ3JhcGhpY3MgZGF0YVxuICpcbiAqIEBtb2R1bGUgcmVuZGVyZXJzL3dlYmdsL2dyYXBoaWNzXG4gKi9cblxuLyoqXG4gKiBSZW5kZXJzIHRoZSBncmFwaGljcyBvYmplY3RcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCByZW5kZXJHcmFwaGljc1xuICogQHBhcmFtIGdyYXBoaWNzIHtHcmFwaGljc31cbiAqIEBwYXJhbSBwcm9qZWN0aW9uIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMucmVuZGVyR3JhcGhpY3MgPSBmdW5jdGlvbiByZW5kZXJHcmFwaGljcyhncmFwaGljcywgcHJvamVjdGlvbilcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgaWYoIWdyYXBoaWNzLl93ZWJHTClncmFwaGljcy5fd2ViR0wgPSB7cG9pbnRzOltdLCBpbmRpY2VzOltdLCBsYXN0SW5kZXg6MCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXI6Z2wuY3JlYXRlQnVmZmVyKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhCdWZmZXI6Z2wuY3JlYXRlQnVmZmVyKCl9O1xuXG4gICAgaWYoZ3JhcGhpY3MuZGlydHkpXG4gICAge1xuICAgICAgICBncmFwaGljcy5kaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIGlmKGdyYXBoaWNzLmNsZWFyRGlydHkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGdyYXBoaWNzLmNsZWFyRGlydHkgPSBmYWxzZTtcblxuICAgICAgICAgICAgZ3JhcGhpY3MuX3dlYkdMLmxhc3RJbmRleCA9IDA7XG4gICAgICAgICAgICBncmFwaGljcy5fd2ViR0wucG9pbnRzID0gW107XG4gICAgICAgICAgICBncmFwaGljcy5fd2ViR0wuaW5kaWNlcyA9IFtdO1xuXG4gICAgICAgIH1cblxuICAgICAgICBleHBvcnRzLnVwZGF0ZUdyYXBoaWNzKGdyYXBoaWNzKTtcbiAgICB9XG5cbiAgICBzaGFkZXJzLmFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyKCk7XG5cbiAgICAvLyBUaGlzICBjb3VsZCBiZSBzcGVlZGVkIHVwIGZvIHN1cmUhXG4gICAgdmFyIG0gPSBtYXQzLmNsb25lKGdyYXBoaWNzLndvcmxkVHJhbnNmb3JtKTtcblxuICAgIG1hdDMudHJhbnNwb3NlKG0pO1xuXG4gICAgLy8gc2V0IHRoZSBtYXRyaXggdHJhbnNmb3JtIGZvciB0aGVcbiAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBKTtcblxuICAgIGdsLnVuaWZvcm1NYXRyaXgzZnYoZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIudHJhbnNsYXRpb25NYXRyaXgsIGZhbHNlLCBtKTtcblxuICAgIGdsLnVuaWZvcm0yZihnbG9iYWxzLnByaW1pdGl2ZVNoYWRlci5wcm9qZWN0aW9uVmVjdG9yLCBwcm9qZWN0aW9uLngsIC1wcm9qZWN0aW9uLnkpO1xuICAgIGdsLnVuaWZvcm0yZihnbG9iYWxzLnByaW1pdGl2ZVNoYWRlci5vZmZzZXRWZWN0b3IsIC1nbG9iYWxzLm9mZnNldC54LCAtZ2xvYmFscy5vZmZzZXQueSk7XG5cbiAgICBnbC51bmlmb3JtMWYoZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIuYWxwaGEsIGdyYXBoaWNzLndvcmxkQWxwaGEpO1xuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBncmFwaGljcy5fd2ViR0wuYnVmZmVyKTtcblxuICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIoZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIuYVZlcnRleFBvc2l0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDQgKiA2LCAwKTtcbiAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGdsb2JhbHMucHJpbWl0aXZlU2hhZGVyLmNvbG9yQXR0cmlidXRlLCA0LCBnbC5GTE9BVCwgZmFsc2UsNCAqIDYsIDIgKiA0KTtcblxuICAgIC8vIHNldCB0aGUgaW5kZXggYnVmZmVyIVxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIGdyYXBoaWNzLl93ZWJHTC5pbmRleEJ1ZmZlcik7XG5cblxuICAgIGdsLmRyYXdFbGVtZW50cyhnbC5UUklBTkdMRV9TVFJJUCwgIGdyYXBoaWNzLl93ZWJHTC5pbmRpY2VzLmxlbmd0aCwgZ2wuVU5TSUdORURfU0hPUlQsIDAgKTtcblxuICAgIHNoYWRlcnMuZGVhY3RpdmF0ZVByaW1pdGl2ZVNoYWRlcigpO1xuXG4gICAgLy8gcmV0dXJuIHRvIGRlZmF1bHQgc2hhZGVyLi4uXG4vLyAgc2hhZGVycy5hY3RpdmF0ZVNoYWRlcihnbG9iYWxzLmRlZmF1bHRTaGFkZXIpO1xufTtcblxuLyoqXG4gKiBVcGRhdGVzIHRoZSBncmFwaGljcyBvYmplY3RcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCB1cGRhdGVHcmFwaGljc1xuICogQHBhcmFtIGdyYXBoaWNzIHtHcmFwaGljc31cbiAqL1xuZXhwb3J0cy51cGRhdGVHcmFwaGljcyA9IGZ1bmN0aW9uIHVwZGF0ZUdyYXBoaWNzKGdyYXBoaWNzKVxue1xuICAgIGZvciAodmFyIGkgPSBncmFwaGljcy5fd2ViR0wubGFzdEluZGV4OyBpIDwgZ3JhcGhpY3MuZ3JhcGhpY3NEYXRhLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGRhdGEgPSBncmFwaGljcy5ncmFwaGljc0RhdGFbaV07XG5cbiAgICAgICAgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5QT0xZKVxuICAgICAgICB7XG4gICAgICAgICAgICBpZihkYXRhLmZpbGwpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWYoZGF0YS5wb2ludHMubGVuZ3RoPjMpXG4gICAgICAgICAgICAgICAgICAgIGV4cG9ydHMuYnVpbGRQb2x5KGRhdGEsIGdyYXBoaWNzLl93ZWJHTCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGRhdGEubGluZVdpZHRoID4gMClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBleHBvcnRzLmJ1aWxkTGluZShkYXRhLCBncmFwaGljcy5fd2ViR0wpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoZGF0YS50eXBlID09PSBHcmFwaGljcy5SRUNUKVxuICAgICAgICB7XG4gICAgICAgICAgICBleHBvcnRzLmJ1aWxkUmVjdGFuZ2xlKGRhdGEsIGdyYXBoaWNzLl93ZWJHTCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihkYXRhLnR5cGUgPT09IEdyYXBoaWNzLkNJUkMgfHwgZGF0YS50eXBlID09PSBHcmFwaGljcy5FTElQKTtcbiAgICAgICAge1xuICAgICAgICAgICAgZXhwb3J0cy5idWlsZENpcmNsZShkYXRhLCBncmFwaGljcy5fd2ViR0wpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ3JhcGhpY3MuX3dlYkdMLmxhc3RJbmRleCA9IGdyYXBoaWNzLmdyYXBoaWNzRGF0YS5sZW5ndGg7XG5cbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuXG4gICAgZ3JhcGhpY3MuX3dlYkdMLmdsUG9pbnRzID0gbmV3IEZsb2F0MzJBcnJheShncmFwaGljcy5fd2ViR0wucG9pbnRzKTtcblxuICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBncmFwaGljcy5fd2ViR0wuYnVmZmVyKTtcbiAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgZ3JhcGhpY3MuX3dlYkdMLmdsUG9pbnRzLCBnbC5TVEFUSUNfRFJBVyk7XG5cbiAgICBncmFwaGljcy5fd2ViR0wuZ2xJbmRpY2llcyA9IG5ldyBVaW50MTZBcnJheShncmFwaGljcy5fd2ViR0wuaW5kaWNlcyk7XG5cbiAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBncmFwaGljcy5fd2ViR0wuaW5kZXhCdWZmZXIpO1xuICAgIGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIGdyYXBoaWNzLl93ZWJHTC5nbEluZGljaWVzLCBnbC5TVEFUSUNfRFJBVyk7XG59O1xuXG4vKipcbiAqIEJ1aWxkcyBhIHJlY3RhbmdsZSB0byBkcmF3XG4gKlxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqIEBtZXRob2QgYnVpbGRSZWN0YW5nbGVcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gd2ViR0xEYXRhIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYnVpbGRSZWN0YW5nbGUgPSBmdW5jdGlvbiBidWlsZFJlY3RhbmdsZShncmFwaGljc0RhdGEsIHdlYkdMRGF0YSlcbntcbiAgICAvLyAtLS0gLy9cbiAgICAvLyBuZWVkIHRvIGNvbnZlcnQgcG9pbnRzIHRvIGEgbmljZSByZWd1bGFyIGRhdGFcbiAgICAvL1xuICAgIHZhciByZWN0RGF0YSA9IGdyYXBoaWNzRGF0YS5wb2ludHM7XG4gICAgdmFyIHggPSByZWN0RGF0YVswXTtcbiAgICB2YXIgeSA9IHJlY3REYXRhWzFdO1xuICAgIHZhciB3aWR0aCA9IHJlY3REYXRhWzJdO1xuICAgIHZhciBoZWlnaHQgPSByZWN0RGF0YVszXTtcblxuXG4gICAgaWYoZ3JhcGhpY3NEYXRhLmZpbGwpXG4gICAge1xuICAgICAgICB2YXIgY29sb3IgPSBoZXgycmdiKGdyYXBoaWNzRGF0YS5maWxsQ29sb3IpO1xuICAgICAgICB2YXIgYWxwaGEgPSBncmFwaGljc0RhdGEuZmlsbEFscGhhO1xuXG4gICAgICAgIHZhciByID0gY29sb3JbMF0gKiBhbHBoYTtcbiAgICAgICAgdmFyIGcgPSBjb2xvclsxXSAqIGFscGhhO1xuICAgICAgICB2YXIgYiA9IGNvbG9yWzJdICogYWxwaGE7XG5cbiAgICAgICAgdmFyIHZlcnRzID0gd2ViR0xEYXRhLnBvaW50cztcbiAgICAgICAgdmFyIGluZGljZXMgPSB3ZWJHTERhdGEuaW5kaWNlcztcblxuICAgICAgICB2YXIgdmVydFBvcyA9IHZlcnRzLmxlbmd0aC82O1xuXG4gICAgICAgIC8vIHN0YXJ0XG4gICAgICAgIHZlcnRzLnB1c2goeCwgeSk7XG4gICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgIHZlcnRzLnB1c2goeCArIHdpZHRoLCB5KTtcbiAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgdmVydHMucHVzaCh4ICwgeSArIGhlaWdodCk7XG4gICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgIHZlcnRzLnB1c2goeCArIHdpZHRoLCB5ICsgaGVpZ2h0KTtcbiAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgLy8gaW5zZXJ0IDIgZGVhZCB0cmlhbmdsZXMuLlxuICAgICAgICBpbmRpY2VzLnB1c2godmVydFBvcywgdmVydFBvcywgdmVydFBvcysxLCB2ZXJ0UG9zKzIsIHZlcnRQb3MrMywgdmVydFBvcyszKTtcbiAgICB9XG5cbiAgICBpZihncmFwaGljc0RhdGEubGluZVdpZHRoKVxuICAgIHtcbiAgICAgICAgZ3JhcGhpY3NEYXRhLnBvaW50cyA9IFt4LCB5LFxuICAgICAgICAgICAgICAgICAgeCArIHdpZHRoLCB5LFxuICAgICAgICAgICAgICAgICAgeCArIHdpZHRoLCB5ICsgaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgeCwgeSArIGhlaWdodCxcbiAgICAgICAgICAgICAgICAgIHgsIHldO1xuXG4gICAgICAgIGV4cG9ydHMuYnVpbGRMaW5lKGdyYXBoaWNzRGF0YSwgd2ViR0xEYXRhKTtcbiAgICB9XG59O1xuXG4vKipcbiAqIEJ1aWxkcyBhIGNpcmNsZSB0byBkcmF3XG4gKlxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqIEBtZXRob2QgYnVpbGRDaXJjbGVcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gd2ViR0xEYXRhIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYnVpbGRDaXJjbGUgPSBmdW5jdGlvbiBidWlsZENpcmNsZShncmFwaGljc0RhdGEsIHdlYkdMRGF0YSlcbntcbiAgICAvLyAtLS0gLy9cbiAgICAvLyBuZWVkIHRvIGNvbnZlcnQgcG9pbnRzIHRvIGEgbmljZSByZWd1bGFyIGRhdGFcbiAgICAvL1xuICAgIHZhciByZWN0RGF0YSA9IGdyYXBoaWNzRGF0YS5wb2ludHM7XG4gICAgdmFyIHggPSByZWN0RGF0YVswXTtcbiAgICB2YXIgeSA9IHJlY3REYXRhWzFdO1xuICAgIHZhciB3aWR0aCA9IHJlY3REYXRhWzJdO1xuICAgIHZhciBoZWlnaHQgPSByZWN0RGF0YVszXTtcblxuICAgIHZhciB0b3RhbFNlZ3MgPSA0MDtcbiAgICB2YXIgc2VnID0gKE1hdGguUEkgKiAyKSAvIHRvdGFsU2VncyA7XG5cbiAgICB2YXIgaSA9IDA7XG5cbiAgICBpZihncmFwaGljc0RhdGEuZmlsbClcbiAgICB7XG4gICAgICAgIHZhciBjb2xvciA9IGhleDJyZ2IoZ3JhcGhpY3NEYXRhLmZpbGxDb2xvcik7XG4gICAgICAgIHZhciBhbHBoYSA9IGdyYXBoaWNzRGF0YS5maWxsQWxwaGE7XG5cbiAgICAgICAgdmFyIHIgPSBjb2xvclswXSAqIGFscGhhO1xuICAgICAgICB2YXIgZyA9IGNvbG9yWzFdICogYWxwaGE7XG4gICAgICAgIHZhciBiID0gY29sb3JbMl0gKiBhbHBoYTtcblxuICAgICAgICB2YXIgdmVydHMgPSB3ZWJHTERhdGEucG9pbnRzO1xuICAgICAgICB2YXIgaW5kaWNlcyA9IHdlYkdMRGF0YS5pbmRpY2VzO1xuXG4gICAgICAgIHZhciB2ZWNQb3MgPSB2ZXJ0cy5sZW5ndGgvNjtcblxuICAgICAgICBpbmRpY2VzLnB1c2godmVjUG9zKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdG90YWxTZWdzICsgMSA7IGkrKylcbiAgICAgICAge1xuICAgICAgICAgICAgdmVydHMucHVzaCh4LHksIHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgdmVydHMucHVzaCh4ICsgTWF0aC5zaW4oc2VnICogaSkgKiB3aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgeSArIE1hdGguY29zKHNlZyAqIGkpICogaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICByLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgICAgIGluZGljZXMucHVzaCh2ZWNQb3MrKywgdmVjUG9zKyspO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5kaWNlcy5wdXNoKHZlY1Bvcy0xKTtcbiAgICB9XG5cbiAgICBpZihncmFwaGljc0RhdGEubGluZVdpZHRoKVxuICAgIHtcbiAgICAgICAgZ3JhcGhpY3NEYXRhLnBvaW50cyA9IFtdO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB0b3RhbFNlZ3MgKyAxOyBpKyspXG4gICAgICAgIHtcbiAgICAgICAgICAgIGdyYXBoaWNzRGF0YS5wb2ludHMucHVzaCh4ICsgTWF0aC5zaW4oc2VnICogaSkgKiB3aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB5ICsgTWF0aC5jb3Moc2VnICogaSkgKiBoZWlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhwb3J0cy5idWlsZExpbmUoZ3JhcGhpY3NEYXRhLCB3ZWJHTERhdGEpO1xuICAgIH1cbn07XG5cbi8qKlxuICogQnVpbGRzIGEgbGluZSB0byBkcmF3XG4gKlxuICogQHN0YXRpY1xuICogQHByaXZhdGVcbiAqIEBtZXRob2QgYnVpbGRMaW5lXG4gKiBAcGFyYW0gZ3JhcGhpY3Mge0dyYXBoaWNzfVxuICogQHBhcmFtIHdlYkdMRGF0YSB7T2JqZWN0fVxuICovXG5leHBvcnRzLmJ1aWxkTGluZSA9IGZ1bmN0aW9uIGJ1aWxkTGluZShncmFwaGljc0RhdGEsIHdlYkdMRGF0YSlcbntcbiAgICAvLyBUT0RPIE9QVElNSVNFIVxuICAgIHZhciBpID0gMDtcblxuICAgIHZhciBwb2ludHMgPSBncmFwaGljc0RhdGEucG9pbnRzO1xuICAgIGlmKHBvaW50cy5sZW5ndGggPT09IDApcmV0dXJuO1xuXG4gICAgLy8gaWYgdGhlIGxpbmUgd2lkdGggaXMgYW4gb2RkIG51bWJlciBhZGQgMC41IHRvIGFsaWduIHRvIGEgd2hvbGUgcGl4ZWxcbiAgICBpZihncmFwaGljc0RhdGEubGluZVdpZHRoJTIpXG4gICAge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBwb2ludHNbaV0gKz0gMC41O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZ2V0IGZpcnN0IGFuZCBsYXN0IHBvaW50Li4gZmlndXJlIG91dCB0aGUgbWlkZGxlIVxuICAgIHZhciBmaXJzdFBvaW50ID0gbmV3IFBvaW50KCBwb2ludHNbMF0sIHBvaW50c1sxXSApO1xuICAgIHZhciBsYXN0UG9pbnQgPSBuZXcgUG9pbnQoIHBvaW50c1twb2ludHMubGVuZ3RoIC0gMl0sIHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV0gKTtcblxuICAgIC8vIGlmIHRoZSBmaXJzdCBwb2ludCBpcyB0aGUgbGFzdCBwb2ludCAtIGdvb25hIGhhdmUgaXNzdWVzIDopXG4gICAgaWYoZmlyc3RQb2ludC54ID09PSBsYXN0UG9pbnQueCAmJiBmaXJzdFBvaW50LnkgPT09IGxhc3RQb2ludC55KVxuICAgIHtcbiAgICAgICAgcG9pbnRzLnBvcCgpO1xuICAgICAgICBwb2ludHMucG9wKCk7XG5cbiAgICAgICAgbGFzdFBvaW50ID0gbmV3IFBvaW50KCBwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDJdLCBwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdICk7XG5cbiAgICAgICAgdmFyIG1pZFBvaW50WCA9IGxhc3RQb2ludC54ICsgKGZpcnN0UG9pbnQueCAtIGxhc3RQb2ludC54KSAqMC41O1xuICAgICAgICB2YXIgbWlkUG9pbnRZID0gbGFzdFBvaW50LnkgKyAoZmlyc3RQb2ludC55IC0gbGFzdFBvaW50LnkpICowLjU7XG5cbiAgICAgICAgcG9pbnRzLnVuc2hpZnQobWlkUG9pbnRYLCBtaWRQb2ludFkpO1xuICAgICAgICBwb2ludHMucHVzaChtaWRQb2ludFgsIG1pZFBvaW50WSk7XG4gICAgfVxuXG4gICAgdmFyIHZlcnRzID0gd2ViR0xEYXRhLnBvaW50cztcbiAgICB2YXIgaW5kaWNlcyA9IHdlYkdMRGF0YS5pbmRpY2VzO1xuICAgIHZhciBsZW5ndGggPSBwb2ludHMubGVuZ3RoIC8gMjtcbiAgICB2YXIgaW5kZXhDb3VudCA9IHBvaW50cy5sZW5ndGg7XG4gICAgdmFyIGluZGV4U3RhcnQgPSB2ZXJ0cy5sZW5ndGgvNjtcblxuICAgIC8vIERSQVcgdGhlIExpbmVcbiAgICB2YXIgd2lkdGggPSBncmFwaGljc0RhdGEubGluZVdpZHRoIC8gMjtcblxuICAgIC8vIHNvcnQgY29sb3JcbiAgICB2YXIgY29sb3IgPSBoZXgycmdiKGdyYXBoaWNzRGF0YS5saW5lQ29sb3IpO1xuICAgIHZhciBhbHBoYSA9IGdyYXBoaWNzRGF0YS5saW5lQWxwaGE7XG4gICAgdmFyIHIgPSBjb2xvclswXSAqIGFscGhhO1xuICAgIHZhciBnID0gY29sb3JbMV0gKiBhbHBoYTtcbiAgICB2YXIgYiA9IGNvbG9yWzJdICogYWxwaGE7XG5cbiAgICB2YXIgcHgsIHB5LCBwMXgsIHAxeSwgcDJ4LCBwMnksIHAzeCwgcDN5O1xuICAgIHZhciBwZXJweCwgcGVycHksIHBlcnAyeCwgcGVycDJ5LCBwZXJwM3gsIHBlcnAzeTtcbiAgICB2YXIgYTEsIGIxLCBjMSwgYTIsIGIyLCBjMjtcbiAgICB2YXIgZGVub20sIHBkaXN0LCBkaXN0O1xuXG4gICAgcDF4ID0gcG9pbnRzWzBdO1xuICAgIHAxeSA9IHBvaW50c1sxXTtcblxuICAgIHAyeCA9IHBvaW50c1syXTtcbiAgICBwMnkgPSBwb2ludHNbM107XG5cbiAgICBwZXJweCA9IC0ocDF5IC0gcDJ5KTtcbiAgICBwZXJweSA9ICBwMXggLSBwMng7XG5cbiAgICBkaXN0ID0gTWF0aC5zcXJ0KHBlcnB4KnBlcnB4ICsgcGVycHkqcGVycHkpO1xuXG4gICAgcGVycHggLz0gZGlzdDtcbiAgICBwZXJweSAvPSBkaXN0O1xuICAgIHBlcnB4ICo9IHdpZHRoO1xuICAgIHBlcnB5ICo9IHdpZHRoO1xuXG4gICAgLy8gc3RhcnRcbiAgICB2ZXJ0cy5wdXNoKHAxeCAtIHBlcnB4ICwgcDF5IC0gcGVycHksXG4gICAgICAgICAgICAgICAgciwgZywgYiwgYWxwaGEpO1xuXG4gICAgdmVydHMucHVzaChwMXggKyBwZXJweCAsIHAxeSArIHBlcnB5LFxuICAgICAgICAgICAgICAgIHIsIGcsIGIsIGFscGhhKTtcblxuICAgIGZvciAoaSA9IDE7IGkgPCBsZW5ndGgtMTsgaSsrKVxuICAgIHtcbiAgICAgICAgcDF4ID0gcG9pbnRzWyhpLTEpKjJdO1xuICAgICAgICBwMXkgPSBwb2ludHNbKGktMSkqMiArIDFdO1xuXG4gICAgICAgIHAyeCA9IHBvaW50c1soaSkqMl07XG4gICAgICAgIHAyeSA9IHBvaW50c1soaSkqMiArIDFdO1xuXG4gICAgICAgIHAzeCA9IHBvaW50c1soaSsxKSoyXTtcbiAgICAgICAgcDN5ID0gcG9pbnRzWyhpKzEpKjIgKyAxXTtcblxuICAgICAgICBwZXJweCA9IC0ocDF5IC0gcDJ5KTtcbiAgICAgICAgcGVycHkgPSBwMXggLSBwMng7XG5cbiAgICAgICAgZGlzdCA9IE1hdGguc3FydChwZXJweCpwZXJweCArIHBlcnB5KnBlcnB5KTtcbiAgICAgICAgcGVycHggLz0gZGlzdDtcbiAgICAgICAgcGVycHkgLz0gZGlzdDtcbiAgICAgICAgcGVycHggKj0gd2lkdGg7XG4gICAgICAgIHBlcnB5ICo9IHdpZHRoO1xuXG4gICAgICAgIHBlcnAyeCA9IC0ocDJ5IC0gcDN5KTtcbiAgICAgICAgcGVycDJ5ID0gcDJ4IC0gcDN4O1xuXG4gICAgICAgIGRpc3QgPSBNYXRoLnNxcnQocGVycDJ4KnBlcnAyeCArIHBlcnAyeSpwZXJwMnkpO1xuICAgICAgICBwZXJwMnggLz0gZGlzdDtcbiAgICAgICAgcGVycDJ5IC89IGRpc3Q7XG4gICAgICAgIHBlcnAyeCAqPSB3aWR0aDtcbiAgICAgICAgcGVycDJ5ICo9IHdpZHRoO1xuXG4gICAgICAgIGExID0gKC1wZXJweSArIHAxeSkgLSAoLXBlcnB5ICsgcDJ5KTtcbiAgICAgICAgYjEgPSAoLXBlcnB4ICsgcDJ4KSAtICgtcGVycHggKyBwMXgpO1xuICAgICAgICBjMSA9ICgtcGVycHggKyBwMXgpICogKC1wZXJweSArIHAyeSkgLSAoLXBlcnB4ICsgcDJ4KSAqICgtcGVycHkgKyBwMXkpO1xuICAgICAgICBhMiA9ICgtcGVycDJ5ICsgcDN5KSAtICgtcGVycDJ5ICsgcDJ5KTtcbiAgICAgICAgYjIgPSAoLXBlcnAyeCArIHAyeCkgLSAoLXBlcnAyeCArIHAzeCk7XG4gICAgICAgIGMyID0gKC1wZXJwMnggKyBwM3gpICogKC1wZXJwMnkgKyBwMnkpIC0gKC1wZXJwMnggKyBwMngpICogKC1wZXJwMnkgKyBwM3kpO1xuXG4gICAgICAgIGRlbm9tID0gYTEqYjIgLSBhMipiMTtcblxuICAgICAgICBpZihNYXRoLmFicyhkZW5vbSkgPCAwLjEgKVxuICAgICAgICB7XG5cbiAgICAgICAgICAgIGRlbm9tKz0xMC4xO1xuICAgICAgICAgICAgdmVydHMucHVzaChwMnggLSBwZXJweCAsIHAyeSAtIHBlcnB5LFxuICAgICAgICAgICAgICAgIHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgdmVydHMucHVzaChwMnggKyBwZXJweCAsIHAyeSArIHBlcnB5LFxuICAgICAgICAgICAgICAgIHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBweCA9IChiMSpjMiAtIGIyKmMxKS9kZW5vbTtcbiAgICAgICAgcHkgPSAoYTIqYzEgLSBhMSpjMikvZGVub207XG5cblxuICAgICAgICBwZGlzdCA9IChweCAtcDJ4KSAqIChweCAtcDJ4KSArIChweSAtcDJ5KSArIChweSAtcDJ5KTtcblxuXG4gICAgICAgIGlmKHBkaXN0ID4gMTQwICogMTQwKVxuICAgICAgICB7XG4gICAgICAgICAgICBwZXJwM3ggPSBwZXJweCAtIHBlcnAyeDtcbiAgICAgICAgICAgIHBlcnAzeSA9IHBlcnB5IC0gcGVycDJ5O1xuXG4gICAgICAgICAgICBkaXN0ID0gTWF0aC5zcXJ0KHBlcnAzeCpwZXJwM3ggKyBwZXJwM3kqcGVycDN5KTtcbiAgICAgICAgICAgIHBlcnAzeCAvPSBkaXN0O1xuICAgICAgICAgICAgcGVycDN5IC89IGRpc3Q7XG4gICAgICAgICAgICBwZXJwM3ggKj0gd2lkdGg7XG4gICAgICAgICAgICBwZXJwM3kgKj0gd2lkdGg7XG5cbiAgICAgICAgICAgIHZlcnRzLnB1c2gocDJ4IC0gcGVycDN4LCBwMnkgLXBlcnAzeSk7XG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHIsIGcsIGIsIGFscGhhKTtcblxuICAgICAgICAgICAgdmVydHMucHVzaChwMnggKyBwZXJwM3gsIHAyeSArcGVycDN5KTtcbiAgICAgICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHAyeCAtIHBlcnAzeCwgcDJ5IC1wZXJwM3kpO1xuICAgICAgICAgICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICAgICAgICAgIGluZGV4Q291bnQrKztcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgIHtcblxuICAgICAgICAgICAgdmVydHMucHVzaChweCAsIHB5KTtcbiAgICAgICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgICAgICAgICB2ZXJ0cy5wdXNoKHAyeCAtIChweC1wMngpLCBwMnkgLSAocHkgLSBwMnkpKTtcbiAgICAgICAgICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcDF4ID0gcG9pbnRzWyhsZW5ndGgtMikqMl07XG4gICAgcDF5ID0gcG9pbnRzWyhsZW5ndGgtMikqMiArIDFdO1xuXG4gICAgcDJ4ID0gcG9pbnRzWyhsZW5ndGgtMSkqMl07XG4gICAgcDJ5ID0gcG9pbnRzWyhsZW5ndGgtMSkqMiArIDFdO1xuXG4gICAgcGVycHggPSAtKHAxeSAtIHAyeSk7XG4gICAgcGVycHkgPSBwMXggLSBwMng7XG5cbiAgICBkaXN0ID0gTWF0aC5zcXJ0KHBlcnB4KnBlcnB4ICsgcGVycHkqcGVycHkpO1xuICAgIHBlcnB4IC89IGRpc3Q7XG4gICAgcGVycHkgLz0gZGlzdDtcbiAgICBwZXJweCAqPSB3aWR0aDtcbiAgICBwZXJweSAqPSB3aWR0aDtcblxuICAgIHZlcnRzLnB1c2gocDJ4IC0gcGVycHggLCBwMnkgLSBwZXJweSk7XG4gICAgdmVydHMucHVzaChyLCBnLCBiLCBhbHBoYSk7XG5cbiAgICB2ZXJ0cy5wdXNoKHAyeCArIHBlcnB4ICwgcDJ5ICsgcGVycHkpO1xuICAgIHZlcnRzLnB1c2gociwgZywgYiwgYWxwaGEpO1xuXG4gICAgaW5kaWNlcy5wdXNoKGluZGV4U3RhcnQpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGluZGV4Q291bnQ7IGkrKylcbiAgICB7XG4gICAgICAgIGluZGljZXMucHVzaChpbmRleFN0YXJ0KyspO1xuICAgIH1cblxuICAgIGluZGljZXMucHVzaChpbmRleFN0YXJ0LTEpO1xufTtcblxuLyoqXG4gKiBCdWlsZHMgYSBwb2x5Z29uIHRvIGRyYXdcbiAqXG4gKiBAc3RhdGljXG4gKiBAcHJpdmF0ZVxuICogQG1ldGhvZCBidWlsZFBvbHlcbiAqIEBwYXJhbSBncmFwaGljcyB7R3JhcGhpY3N9XG4gKiBAcGFyYW0gd2ViR0xEYXRhIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYnVpbGRQb2x5ID0gZnVuY3Rpb24gYnVpbGRQb2x5KGdyYXBoaWNzRGF0YSwgd2ViR0xEYXRhKVxue1xuICAgIHZhciBwb2ludHMgPSBncmFwaGljc0RhdGEucG9pbnRzO1xuICAgIGlmKHBvaW50cy5sZW5ndGggPCA2KXJldHVybjtcblxuICAgIC8vIGdldCBmaXJzdCBhbmQgbGFzdCBwb2ludC4uIGZpZ3VyZSBvdXQgdGhlIG1pZGRsZSFcbiAgICB2YXIgdmVydHMgPSB3ZWJHTERhdGEucG9pbnRzO1xuICAgIHZhciBpbmRpY2VzID0gd2ViR0xEYXRhLmluZGljZXM7XG5cbiAgICB2YXIgbGVuZ3RoID0gcG9pbnRzLmxlbmd0aCAvIDI7XG5cbiAgICAvLyBzb3J0IGNvbG9yXG4gICAgdmFyIGNvbG9yID0gaGV4MnJnYihncmFwaGljc0RhdGEuZmlsbENvbG9yKTtcbiAgICB2YXIgYWxwaGEgPSBncmFwaGljc0RhdGEuZmlsbEFscGhhO1xuICAgIHZhciByID0gY29sb3JbMF0gKiBhbHBoYTtcbiAgICB2YXIgZyA9IGNvbG9yWzFdICogYWxwaGE7XG4gICAgdmFyIGIgPSBjb2xvclsyXSAqIGFscGhhO1xuXG4gICAgdmFyIHRyaWFuZ2xlcyA9IHRyaWFuZ3VsYXRlKHBvaW50cyk7XG5cbiAgICB2YXIgdmVydFBvcyA9IHZlcnRzLmxlbmd0aCAvIDY7XG5cbiAgICB2YXIgaSA9IDA7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJpYW5nbGVzLmxlbmd0aDsgaSs9MylcbiAgICB7XG4gICAgICAgIGluZGljZXMucHVzaCh0cmlhbmdsZXNbaV0gKyB2ZXJ0UG9zKTtcbiAgICAgICAgaW5kaWNlcy5wdXNoKHRyaWFuZ2xlc1tpXSArIHZlcnRQb3MpO1xuICAgICAgICBpbmRpY2VzLnB1c2godHJpYW5nbGVzW2krMV0gKyB2ZXJ0UG9zKTtcbiAgICAgICAgaW5kaWNlcy5wdXNoKHRyaWFuZ2xlc1tpKzJdICt2ZXJ0UG9zKTtcbiAgICAgICAgaW5kaWNlcy5wdXNoKHRyaWFuZ2xlc1tpKzJdICsgdmVydFBvcyk7XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmVydHMucHVzaChwb2ludHNbaSAqIDJdLCBwb2ludHNbaSAqIDIgKyAxXSxcbiAgICAgICAgICAgICAgICAgICByLCBnLCBiLCBhbHBoYSk7XG4gICAgfVxufTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGdsb2JhbHMgPSByZXF1aXJlKCcuLi8uLi9jb3JlL2dsb2JhbHMnKTtcbnZhciBQcmltaXRpdmVTaGFkZXIgPSByZXF1aXJlKCcuL1ByaW1pdGl2ZVNoYWRlcicpO1xudmFyIFN0cmlwU2hhZGVyID0gcmVxdWlyZSgnLi9TdHJpcFNoYWRlcicpO1xudmFyIFBpeGlTaGFkZXIgPSByZXF1aXJlKCcuL1BpeGlTaGFkZXInKTtcblxuZXhwb3J0cy5pbml0RGVmYXVsdFNoYWRlcnMgPSBmdW5jdGlvbiBpbml0RGVmYXVsdFNoYWRlcnMoKVxue1xuICAgIGdsb2JhbHMucHJpbWl0aXZlU2hhZGVyID0gbmV3IFByaW1pdGl2ZVNoYWRlcigpO1xuICAgIGdsb2JhbHMucHJpbWl0aXZlU2hhZGVyLmluaXQoKTtcblxuICAgIGdsb2JhbHMuc3RyaXBTaGFkZXIgPSBuZXcgU3RyaXBTaGFkZXIoKTtcbiAgICBnbG9iYWxzLnN0cmlwU2hhZGVyLmluaXQoKTtcblxuICAgIGdsb2JhbHMuZGVmYXVsdFNoYWRlciA9IG5ldyBQaXhpU2hhZGVyKCk7XG4gICAgZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmluaXQoKTtcblxuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG4gICAgdmFyIHNoYWRlclByb2dyYW0gPSBnbG9iYWxzLmRlZmF1bHRTaGFkZXIucHJvZ3JhbTtcblxuICAgIGdsLnVzZVByb2dyYW0oc2hhZGVyUHJvZ3JhbSk7XG5cbiAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShnbG9iYWxzLmRlZmF1bHRTaGFkZXIuYVZlcnRleFBvc2l0aW9uKTtcbiAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShnbG9iYWxzLmRlZmF1bHRTaGFkZXIuY29sb3JBdHRyaWJ1dGUpO1xuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMuZGVmYXVsdFNoYWRlci5hVGV4dHVyZUNvb3JkKTtcbn07XG5cbmV4cG9ydHMuYWN0aXZhdGVQcmltaXRpdmVTaGFkZXIgPSBmdW5jdGlvbiBhY3RpdmF0ZVByaW1pdGl2ZVNoYWRlcigpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIGdsLnVzZVByb2dyYW0oZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIucHJvZ3JhbSk7XG5cbiAgICBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmFWZXJ0ZXhQb3NpdGlvbik7XG4gICAgZ2wuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMuZGVmYXVsdFNoYWRlci5jb2xvckF0dHJpYnV0ZSk7XG4gICAgZ2wuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMuZGVmYXVsdFNoYWRlci5hVGV4dHVyZUNvb3JkKTtcblxuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMucHJpbWl0aXZlU2hhZGVyLmFWZXJ0ZXhQb3NpdGlvbik7XG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5wcmltaXRpdmVTaGFkZXIuY29sb3JBdHRyaWJ1dGUpO1xufTtcblxuZXhwb3J0cy5kZWFjdGl2YXRlUHJpbWl0aXZlU2hhZGVyID0gZnVuY3Rpb24gZGVhY3RpdmF0ZVByaW1pdGl2ZVNoYWRlcigpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIGdsLnVzZVByb2dyYW0oZ2xvYmFscy5kZWZhdWx0U2hhZGVyLnByb2dyYW0pO1xuXG4gICAgZ2wuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMucHJpbWl0aXZlU2hhZGVyLmFWZXJ0ZXhQb3NpdGlvbik7XG4gICAgZ2wuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMucHJpbWl0aXZlU2hhZGVyLmNvbG9yQXR0cmlidXRlKTtcblxuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMuZGVmYXVsdFNoYWRlci5hVmVydGV4UG9zaXRpb24pO1xuICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMuZGVmYXVsdFNoYWRlci5jb2xvckF0dHJpYnV0ZSk7XG4gICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmFUZXh0dXJlQ29vcmQpO1xufTtcblxuZXhwb3J0cy5hY3RpdmF0ZVN0cmlwU2hhZGVyID0gZnVuY3Rpb24gYWN0aXZhdGVTdHJpcFNoYWRlcigpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIGdsLnVzZVByb2dyYW0oZ2xvYmFscy5zdHJpcFNoYWRlci5wcm9ncmFtKTtcbiAvLyBnbC5kaXNhYmxlVmVydGV4QXR0cmliQXJyYXkoZ2xvYmFscy5kZWZhdWx0U2hhZGVyLmFUZXh0dXJlQ29vcmQpO1xufTtcblxuZXhwb3J0cy5kZWFjdGl2YXRlU3RyaXBTaGFkZXIgPSBmdW5jdGlvbiBkZWFjdGl2YXRlU3RyaXBTaGFkZXIoKVxue1xuICAgIHZhciBnbCA9IGdsb2JhbHMuZ2w7XG5cbiAgICBnbC51c2VQcm9ncmFtKGdsb2JhbHMuZGVmYXVsdFNoYWRlci5wcm9ncmFtKTtcbiAgICAvL2dsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGdsb2JhbHMuZGVmYXVsdFNoYWRlci5hVGV4dHVyZUNvb3JkKTtcbn07XG4iLCIvKipcbiAqIEBhdXRob3IgTWF0IEdyb3ZlcyBodHRwOi8vbWF0Z3JvdmVzLmNvbS8gQERvb3JtYXQyM1xuICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBEaXNwbGF5T2JqZWN0Q29udGFpbmVyID0gcmVxdWlyZSgnLi4vZGlzcGxheS9EaXNwbGF5T2JqZWN0Q29udGFpbmVyJyk7XG52YXIgU3ByaXRlID0gcmVxdWlyZSgnLi4vZGlzcGxheS9TcHJpdGUnKTtcbnZhciBQb2ludCA9IHJlcXVpcmUoJy4uL2dlb20vUG9pbnQnKTtcblxuLyoqXG4gKiBBIFRleHQgT2JqZWN0IHdpbGwgY3JlYXRlIGEgbGluZShzKSBvZiB0ZXh0IHVzaW5nIGJpdG1hcCBmb250LiBUbyBzcGxpdCBhIGxpbmUgeW91IGNhbiB1c2UgJ1xcbicsICdcXHInIG9yICdcXHJcXG4nXG4gKiBZb3UgY2FuIGdlbmVyYXRlIHRoZSBmbnQgZmlsZXMgdXNpbmdcbiAqIGh0dHA6Ly93d3cuYW5nZWxjb2RlLmNvbS9wcm9kdWN0cy9ibWZvbnQvIGZvciB3aW5kb3dzIG9yXG4gKiBodHRwOi8vd3d3LmJtZ2x5cGguY29tLyBmb3IgbWFjLlxuICpcbiAqIEBjbGFzcyBCaXRtYXBUZXh0XG4gKiBAZXh0ZW5kcyBEaXNwbGF5T2JqZWN0Q29udGFpbmVyXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB0ZXh0IHtTdHJpbmd9IFRoZSBjb3B5IHRoYXQgeW91IHdvdWxkIGxpa2UgdGhlIHRleHQgdG8gZGlzcGxheVxuICogQHBhcmFtIHN0eWxlIHtPYmplY3R9IFRoZSBzdHlsZSBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0gc3R5bGUuZm9udCB7U3RyaW5nfSBUaGUgc2l6ZSAob3B0aW9uYWwpIGFuZCBiaXRtYXAgZm9udCBpZCAocmVxdWlyZWQpIGVxICdBcmlhbCcgb3IgJzIwcHggQXJpYWwnIChtdXN0IGhhdmUgbG9hZGVkIHByZXZpb3VzbHkpXG4gKiBAcGFyYW0gW3N0eWxlLmFsaWduPSdsZWZ0J10ge1N0cmluZ30gQW4gYWxpZ25tZW50IG9mIHRoZSBtdWx0aWxpbmUgdGV4dCAoJ2xlZnQnLCAnY2VudGVyJyBvciAncmlnaHQnKVxuICovXG5mdW5jdGlvbiBCaXRtYXBUZXh0KHRleHQsIHN0eWxlKVxue1xuICAgIERpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMuc2V0VGV4dCh0ZXh0KTtcbiAgICB0aGlzLnNldFN0eWxlKHN0eWxlKTtcbiAgICB0aGlzLnVwZGF0ZVRleHQoKTtcbiAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IEJpdG1hcFRleHQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShEaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IEJpdG1hcFRleHR9XG59KTtcblxuLyoqXG4gKiBTZXQgdGhlIGNvcHkgZm9yIHRoZSB0ZXh0IG9iamVjdFxuICpcbiAqIEBtZXRob2Qgc2V0VGV4dFxuICogQHBhcmFtIHRleHQge1N0cmluZ30gVGhlIGNvcHkgdGhhdCB5b3Ugd291bGQgbGlrZSB0aGUgdGV4dCB0byBkaXNwbGF5XG4gKi9cbnByb3RvLnNldFRleHQgPSBmdW5jdGlvbiBzZXRUZXh0KHRleHQpXG57XG4gICAgdGhpcy50ZXh0ID0gdGV4dCB8fCAnICc7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG59O1xuXG4vKipcbiAqIFNldCB0aGUgc3R5bGUgb2YgdGhlIHRleHRcbiAqXG4gKiBAbWV0aG9kIHNldFN0eWxlXG4gKiBAcGFyYW0gc3R5bGUge09iamVjdH0gVGhlIHN0eWxlIHBhcmFtZXRlcnNcbiAqIEBwYXJhbSBzdHlsZS5mb250IHtTdHJpbmd9IFRoZSBzaXplIChvcHRpb25hbCkgYW5kIGJpdG1hcCBmb250IGlkIChyZXF1aXJlZCkgZXEgJ0FyaWFsJyBvciAnMjBweCBBcmlhbCcgKG11c3QgaGF2ZSBsb2FkZWQgcHJldmlvdXNseSlcbiAqIEBwYXJhbSBbc3R5bGUuYWxpZ249J2xlZnQnXSB7U3RyaW5nfSBBbiBhbGlnbm1lbnQgb2YgdGhlIG11bHRpbGluZSB0ZXh0ICgnbGVmdCcsICdjZW50ZXInIG9yICdyaWdodCcpXG4gKi9cbnByb3RvLnNldFN0eWxlID0gZnVuY3Rpb24gc2V0U3R5bGUoc3R5bGUpXG57XG4gICAgc3R5bGUgPSBzdHlsZSB8fCB7fTtcbiAgICBzdHlsZS5hbGlnbiA9IHN0eWxlLmFsaWduIHx8ICdsZWZ0JztcbiAgICB0aGlzLnN0eWxlID0gc3R5bGU7XG5cbiAgICB2YXIgZm9udCA9IHN0eWxlLmZvbnQuc3BsaXQoJyAnKTtcbiAgICB0aGlzLmZvbnROYW1lID0gZm9udFtmb250Lmxlbmd0aCAtIDFdO1xuICAgIHRoaXMuZm9udFNpemUgPSBmb250Lmxlbmd0aCA+PSAyID8gcGFyc2VJbnQoZm9udFtmb250Lmxlbmd0aCAtIDJdLCAxMCkgOiBCaXRtYXBUZXh0LmZvbnRzW3RoaXMuZm9udE5hbWVdLnNpemU7XG5cbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogUmVuZGVycyB0ZXh0XG4gKlxuICogQG1ldGhvZCB1cGRhdGVUZXh0XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUZXh0ID0gZnVuY3Rpb24gdXBkYXRlVGV4dCgpXG57XG4gICAgdmFyIGRhdGEgPSBCaXRtYXBUZXh0LmZvbnRzW3RoaXMuZm9udE5hbWVdO1xuICAgIHZhciBwb3MgPSBuZXcgUG9pbnQoKTtcbiAgICB2YXIgcHJldkNoYXJDb2RlID0gbnVsbDtcbiAgICB2YXIgY2hhcnMgPSBbXTtcbiAgICB2YXIgbWF4TGluZVdpZHRoID0gMDtcbiAgICB2YXIgbGluZVdpZHRocyA9IFtdO1xuICAgIHZhciBsaW5lID0gMDtcbiAgICB2YXIgc2NhbGUgPSB0aGlzLmZvbnRTaXplIC8gZGF0YS5zaXplO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLnRleHQubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgY2hhckNvZGUgPSB0aGlzLnRleHQuY2hhckNvZGVBdChpKTtcbiAgICAgICAgaWYoLyg/OlxcclxcbnxcXHJ8XFxuKS8udGVzdCh0aGlzLnRleHQuY2hhckF0KGkpKSlcbiAgICAgICAge1xuICAgICAgICAgICAgbGluZVdpZHRocy5wdXNoKHBvcy54KTtcbiAgICAgICAgICAgIG1heExpbmVXaWR0aCA9IE1hdGgubWF4KG1heExpbmVXaWR0aCwgcG9zLngpO1xuICAgICAgICAgICAgbGluZSsrO1xuXG4gICAgICAgICAgICBwb3MueCA9IDA7XG4gICAgICAgICAgICBwb3MueSArPSBkYXRhLmxpbmVIZWlnaHQ7XG4gICAgICAgICAgICBwcmV2Q2hhckNvZGUgPSBudWxsO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2hhckRhdGEgPSBkYXRhLmNoYXJzW2NoYXJDb2RlXTtcbiAgICAgICAgaWYoIWNoYXJEYXRhKSBjb250aW51ZTtcblxuICAgICAgICBpZihwcmV2Q2hhckNvZGUgJiYgY2hhckRhdGFbcHJldkNoYXJDb2RlXSlcbiAgICAgICAge1xuICAgICAgICAgICAgcG9zLnggKz0gY2hhckRhdGEua2VybmluZ1twcmV2Q2hhckNvZGVdO1xuICAgICAgICB9XG4gICAgICAgIGNoYXJzLnB1c2goe3RleHR1cmU6Y2hhckRhdGEudGV4dHVyZSwgbGluZTogbGluZSwgY2hhckNvZGU6IGNoYXJDb2RlLCBwb3NpdGlvbjogbmV3IFBvaW50KHBvcy54ICsgY2hhckRhdGEueE9mZnNldCwgcG9zLnkgKyBjaGFyRGF0YS55T2Zmc2V0KX0pO1xuICAgICAgICBwb3MueCArPSBjaGFyRGF0YS54QWR2YW5jZTtcblxuICAgICAgICBwcmV2Q2hhckNvZGUgPSBjaGFyQ29kZTtcbiAgICB9XG5cbiAgICBsaW5lV2lkdGhzLnB1c2gocG9zLngpO1xuICAgIG1heExpbmVXaWR0aCA9IE1hdGgubWF4KG1heExpbmVXaWR0aCwgcG9zLngpO1xuXG4gICAgdmFyIGxpbmVBbGlnbk9mZnNldHMgPSBbXTtcbiAgICBmb3IoaSA9IDA7IGkgPD0gbGluZTsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGFsaWduT2Zmc2V0ID0gMDtcbiAgICAgICAgaWYodGhpcy5zdHlsZS5hbGlnbiA9PT0gJ3JpZ2h0JylcbiAgICAgICAge1xuICAgICAgICAgICAgYWxpZ25PZmZzZXQgPSBtYXhMaW5lV2lkdGggLSBsaW5lV2lkdGhzW2ldO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYodGhpcy5zdHlsZS5hbGlnbiA9PT0gJ2NlbnRlcicpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGFsaWduT2Zmc2V0ID0gKG1heExpbmVXaWR0aCAtIGxpbmVXaWR0aHNbaV0pIC8gMjtcbiAgICAgICAgfVxuICAgICAgICBsaW5lQWxpZ25PZmZzZXRzLnB1c2goYWxpZ25PZmZzZXQpO1xuICAgIH1cblxuICAgIGZvcihpID0gMDsgaSA8IGNoYXJzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgICAgdmFyIGMgPSBuZXcgU3ByaXRlKGNoYXJzW2ldLnRleHR1cmUpOyAvL1Nwcml0ZS5mcm9tRnJhbWUoY2hhcnNbaV0uY2hhckNvZGUpO1xuICAgICAgICBjLnBvc2l0aW9uLnggPSAoY2hhcnNbaV0ucG9zaXRpb24ueCArIGxpbmVBbGlnbk9mZnNldHNbY2hhcnNbaV0ubGluZV0pICogc2NhbGU7XG4gICAgICAgIGMucG9zaXRpb24ueSA9IGNoYXJzW2ldLnBvc2l0aW9uLnkgKiBzY2FsZTtcbiAgICAgICAgYy5zY2FsZS54ID0gYy5zY2FsZS55ID0gc2NhbGU7XG4gICAgICAgIHRoaXMuYWRkQ2hpbGQoYyk7XG4gICAgfVxuXG4gICAgdGhpcy53aWR0aCA9IG1heExpbmVXaWR0aCAqIHNjYWxlO1xuICAgIHRoaXMuaGVpZ2h0ID0gKHBvcy55ICsgZGF0YS5saW5lSGVpZ2h0KSAqIHNjYWxlO1xufTtcblxuLyoqXG4gKiBVcGRhdGVzIHRoZSB0cmFuc2ZvciBvZiB0aGlzIG9iamVjdFxuICpcbiAqIEBtZXRob2QgdXBkYXRlVHJhbnNmb3JtXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUcmFuc2Zvcm0gPSBmdW5jdGlvbiB1cGRhdGVUcmFuc2Zvcm0oKVxue1xuICAgIGlmKHRoaXMuZGlydHkpXG4gICAge1xuICAgICAgICB3aGlsZSh0aGlzLmNoaWxkcmVuLmxlbmd0aCA+IDApXG4gICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQ2hpbGQodGhpcy5nZXRDaGlsZEF0KDApKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVwZGF0ZVRleHQoKTtcblxuICAgICAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgRGlzcGxheU9iamVjdENvbnRhaW5lci5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyk7XG59O1xuXG5CaXRtYXBUZXh0LmZvbnRzID0ge307XG5cbm1vZHVsZS5leHBvcnRzID0gQml0bWFwVGV4dDtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vcGxhdGZvcm0nKTtcbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi9nZW9tL1BvaW50Jyk7XG52YXIgU3ByaXRlID0gcmVxdWlyZSgnLi4vZGlzcGxheS9TcHJpdGUnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vdGV4dHVyZXMvVGV4dHVyZScpO1xuXG4vKipcbiAqIEEgVGV4dCBPYmplY3Qgd2lsbCBjcmVhdGUgYSBsaW5lKHMpIG9mIHRleHQgdG8gc3BsaXQgYSBsaW5lIHlvdSBjYW4gdXNlICdcXG4nXG4gKlxuICogQGNsYXNzIFRleHRcbiAqIEBleHRlbmRzIFNwcml0ZVxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdGV4dCB7U3RyaW5nfSBUaGUgY29weSB0aGF0IHlvdSB3b3VsZCBsaWtlIHRoZSB0ZXh0IHRvIGRpc3BsYXlcbiAqIEBwYXJhbSBbc3R5bGVdIHtPYmplY3R9IFRoZSBzdHlsZSBwYXJhbWV0ZXJzXG4gKiBAcGFyYW0gW3N0eWxlLmZvbnRdIHtTdHJpbmd9IGRlZmF1bHQgJ2JvbGQgMjBwdCBBcmlhbCcgVGhlIHN0eWxlIGFuZCBzaXplIG9mIHRoZSBmb250XG4gKiBAcGFyYW0gW3N0eWxlLmZpbGw9J2JsYWNrJ10ge09iamVjdH0gQSBjYW52YXMgZmlsbHN0eWxlIHRoYXQgd2lsbCBiZSB1c2VkIG9uIHRoZSB0ZXh0IGVnICdyZWQnLCAnIzAwRkYwMCdcbiAqIEBwYXJhbSBbc3R5bGUuYWxpZ249J2xlZnQnXSB7U3RyaW5nfSBBbiBhbGlnbm1lbnQgb2YgdGhlIG11bHRpbGluZSB0ZXh0ICgnbGVmdCcsICdjZW50ZXInIG9yICdyaWdodCcpXG4gKiBAcGFyYW0gW3N0eWxlLnN0cm9rZV0ge1N0cmluZ30gQSBjYW52YXMgZmlsbHN0eWxlIHRoYXQgd2lsbCBiZSB1c2VkIG9uIHRoZSB0ZXh0IHN0cm9rZSBlZyAnYmx1ZScsICcjRkNGRjAwJ1xuICogQHBhcmFtIFtzdHlsZS5zdHJva2VUaGlja25lc3M9MF0ge051bWJlcn0gQSBudW1iZXIgdGhhdCByZXByZXNlbnRzIHRoZSB0aGlja25lc3Mgb2YgdGhlIHN0cm9rZS4gRGVmYXVsdCBpcyAwIChubyBzdHJva2UpXG4gKiBAcGFyYW0gW3N0eWxlLndvcmRXcmFwPWZhbHNlXSB7Qm9vbGVhbn0gSW5kaWNhdGVzIGlmIHdvcmQgd3JhcCBzaG91bGQgYmUgdXNlZFxuICogQHBhcmFtIFtzdHlsZS53b3JkV3JhcFdpZHRoPTEwMF0ge051bWJlcn0gVGhlIHdpZHRoIGF0IHdoaWNoIHRleHQgd2lsbCB3cmFwXG4gKi9cbmZ1bmN0aW9uIFRleHQodGV4dCwgc3R5bGUpXG57XG4gICAgdGhpcy5jYW52YXMgPSBwbGF0Zm9ybS5jcmVhdGVDYW52YXMoKTtcbiAgICB0aGlzLmNvbnRleHQgPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIFNwcml0ZS5jYWxsKHRoaXMsIFRleHR1cmUuZnJvbUNhbnZhcyh0aGlzLmNhbnZhcykpO1xuXG4gICAgdGhpcy5zZXRUZXh0KHRleHQpO1xuICAgIHRoaXMuc2V0U3R5bGUoc3R5bGUpO1xuXG4gICAgdGhpcy51cGRhdGVUZXh0KCk7XG4gICAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xufVxuXG52YXIgcHJvdG8gPSBUZXh0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3ByaXRlLnByb3RvdHlwZSwge1xuICAgIGNvbnN0cnVjdG9yOiB7dmFsdWU6IFRleHR9XG59KTtcblxuLyoqXG4gKiBTZXQgdGhlIHN0eWxlIG9mIHRoZSB0ZXh0XG4gKlxuICogQG1ldGhvZCBzZXRTdHlsZVxuICogQHBhcmFtIFtzdHlsZV0ge09iamVjdH0gVGhlIHN0eWxlIHBhcmFtZXRlcnNcbiAqIEBwYXJhbSBbc3R5bGUuZm9udD0nYm9sZCAyMHB0IEFyaWFsJ10ge1N0cmluZ30gVGhlIHN0eWxlIGFuZCBzaXplIG9mIHRoZSBmb250XG4gKiBAcGFyYW0gW3N0eWxlLmZpbGw9J2JsYWNrJ10ge09iamVjdH0gQSBjYW52YXMgZmlsbHN0eWxlIHRoYXQgd2lsbCBiZSB1c2VkIG9uIHRoZSB0ZXh0IGVnICdyZWQnLCAnIzAwRkYwMCdcbiAqIEBwYXJhbSBbc3R5bGUuYWxpZ249J2xlZnQnXSB7U3RyaW5nfSBBbiBhbGlnbm1lbnQgb2YgdGhlIG11bHRpbGluZSB0ZXh0ICgnbGVmdCcsICdjZW50ZXInIG9yICdyaWdodCcpXG4gKiBAcGFyYW0gW3N0eWxlLnN0cm9rZT0nYmxhY2snXSB7U3RyaW5nfSBBIGNhbnZhcyBmaWxsc3R5bGUgdGhhdCB3aWxsIGJlIHVzZWQgb24gdGhlIHRleHQgc3Ryb2tlIGVnICdibHVlJywgJyNGQ0ZGMDAnXG4gKiBAcGFyYW0gW3N0eWxlLnN0cm9rZVRoaWNrbmVzcz0wXSB7TnVtYmVyfSBBIG51bWJlciB0aGF0IHJlcHJlc2VudHMgdGhlIHRoaWNrbmVzcyBvZiB0aGUgc3Ryb2tlLiBEZWZhdWx0IGlzIDAgKG5vIHN0cm9rZSlcbiAqIEBwYXJhbSBbc3R5bGUud29yZFdyYXA9ZmFsc2VdIHtCb29sZWFufSBJbmRpY2F0ZXMgaWYgd29yZCB3cmFwIHNob3VsZCBiZSB1c2VkXG4gKiBAcGFyYW0gW3N0eWxlLndvcmRXcmFwV2lkdGg9MTAwXSB7TnVtYmVyfSBUaGUgd2lkdGggYXQgd2hpY2ggdGV4dCB3aWxsIHdyYXBcbiAqL1xucHJvdG8uc2V0U3R5bGUgPSBmdW5jdGlvbiBzZXRTdHlsZShzdHlsZSlcbntcbiAgICBzdHlsZSA9IHN0eWxlIHx8IHt9O1xuICAgIHN0eWxlLmZvbnQgPSBzdHlsZS5mb250IHx8ICdib2xkIDIwcHQgQXJpYWwnO1xuICAgIHN0eWxlLmZpbGwgPSBzdHlsZS5maWxsIHx8ICdibGFjayc7XG4gICAgc3R5bGUuYWxpZ24gPSBzdHlsZS5hbGlnbiB8fCAnbGVmdCc7XG4gICAgc3R5bGUuc3Ryb2tlID0gc3R5bGUuc3Ryb2tlIHx8ICdibGFjayc7IC8vcHJvdmlkZSBhIGRlZmF1bHQsIHNlZTogaHR0cHM6Ly9naXRodWIuY29tL0dvb2RCb3lEaWdpdGFsL3BpeGkuanMvaXNzdWVzLzEzNlxuICAgIHN0eWxlLnN0cm9rZVRoaWNrbmVzcyA9IHN0eWxlLnN0cm9rZVRoaWNrbmVzcyB8fCAwO1xuICAgIHN0eWxlLndvcmRXcmFwID0gc3R5bGUud29yZFdyYXAgfHwgZmFsc2U7XG4gICAgc3R5bGUud29yZFdyYXBXaWR0aCA9IHN0eWxlLndvcmRXcmFwV2lkdGggfHwgMTAwO1xuICAgIHRoaXMuc3R5bGUgPSBzdHlsZTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogU2V0IHRoZSBjb3B5IGZvciB0aGUgdGV4dCBvYmplY3QuIFRvIHNwbGl0IGEgbGluZSB5b3UgY2FuIHVzZSAnXFxuJ1xuICpcbiAqIEBtZXRob2Qgc2V0VGV4dFxuICogQHBhcmFtIHtTdHJpbmd9IHRleHQgVGhlIGNvcHkgdGhhdCB5b3Ugd291bGQgbGlrZSB0aGUgdGV4dCB0byBkaXNwbGF5XG4gKi9cbnByb3RvLnNldFRleHQgPSBmdW5jdGlvbiBzZXRUZXh0KHRleHQpXG57XG4gICAgdGhpcy50ZXh0ID0gdGV4dC50b1N0cmluZygpIHx8ICcgJztcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cbi8qKlxuICogUmVuZGVycyB0ZXh0XG4gKlxuICogQG1ldGhvZCB1cGRhdGVUZXh0XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUZXh0ID0gZnVuY3Rpb24gdXBkYXRlVGV4dCgpXG57XG4gICAgdGhpcy5jb250ZXh0LmZvbnQgPSB0aGlzLnN0eWxlLmZvbnQ7XG5cbiAgICB2YXIgb3V0cHV0VGV4dCA9IHRoaXMudGV4dDtcblxuICAgIC8vIHdvcmQgd3JhcFxuICAgIC8vIHByZXNlcnZlIG9yaWdpbmFsIHRleHRcbiAgICBpZih0aGlzLnN0eWxlLndvcmRXcmFwKW91dHB1dFRleHQgPSB0aGlzLndvcmRXcmFwKHRoaXMudGV4dCk7XG5cbiAgICAvL3NwbGl0IHRleHQgaW50byBsaW5lc1xuICAgIHZhciBsaW5lcyA9IG91dHB1dFRleHQuc3BsaXQoLyg/OlxcclxcbnxcXHJ8XFxuKS8pO1xuXG4gICAgLy9jYWxjdWxhdGUgdGV4dCB3aWR0aFxuICAgIHZhciBsaW5lV2lkdGhzID0gW107XG4gICAgdmFyIG1heExpbmVXaWR0aCA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICAgIHZhciBsaW5lV2lkdGggPSB0aGlzLmNvbnRleHQubWVhc3VyZVRleHQobGluZXNbaV0pLndpZHRoO1xuICAgICAgICBsaW5lV2lkdGhzW2ldID0gbGluZVdpZHRoO1xuICAgICAgICBtYXhMaW5lV2lkdGggPSBNYXRoLm1heChtYXhMaW5lV2lkdGgsIGxpbmVXaWR0aCk7XG4gICAgfVxuICAgIHRoaXMuY2FudmFzLndpZHRoID0gbWF4TGluZVdpZHRoICsgdGhpcy5zdHlsZS5zdHJva2VUaGlja25lc3M7XG5cbiAgICAvL2NhbGN1bGF0ZSB0ZXh0IGhlaWdodFxuICAgIHZhciBsaW5lSGVpZ2h0ID0gdGhpcy5kZXRlcm1pbmVGb250SGVpZ2h0KCdmb250OiAnICsgdGhpcy5zdHlsZS5mb250ICArICc7JykgKyB0aGlzLnN0eWxlLnN0cm9rZVRoaWNrbmVzcztcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSBsaW5lSGVpZ2h0ICogbGluZXMubGVuZ3RoO1xuXG4gICAgLy9zZXQgY2FudmFzIHRleHQgc3R5bGVzXG4gICAgdGhpcy5jb250ZXh0LmZpbGxTdHlsZSA9IHRoaXMuc3R5bGUuZmlsbDtcbiAgICB0aGlzLmNvbnRleHQuZm9udCA9IHRoaXMuc3R5bGUuZm9udDtcblxuICAgIHRoaXMuY29udGV4dC5zdHJva2VTdHlsZSA9IHRoaXMuc3R5bGUuc3Ryb2tlO1xuICAgIHRoaXMuY29udGV4dC5saW5lV2lkdGggPSB0aGlzLnN0eWxlLnN0cm9rZVRoaWNrbmVzcztcblxuICAgIHRoaXMuY29udGV4dC50ZXh0QmFzZWxpbmUgPSAndG9wJztcblxuICAgIC8vZHJhdyBsaW5lcyBsaW5lIGJ5IGxpbmVcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgbGluZVBvc2l0aW9uID0gbmV3IFBvaW50KHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzIC8gMiwgdGhpcy5zdHlsZS5zdHJva2VUaGlja25lc3MgLyAyICsgaSAqIGxpbmVIZWlnaHQpO1xuXG4gICAgICAgIGlmKHRoaXMuc3R5bGUuYWxpZ24gPT09ICdyaWdodCcpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGxpbmVQb3NpdGlvbi54ICs9IG1heExpbmVXaWR0aCAtIGxpbmVXaWR0aHNbaV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZih0aGlzLnN0eWxlLmFsaWduID09PSAnY2VudGVyJylcbiAgICAgICAge1xuICAgICAgICAgICAgbGluZVBvc2l0aW9uLnggKz0gKG1heExpbmVXaWR0aCAtIGxpbmVXaWR0aHNbaV0pIC8gMjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuc3R5bGUuc3Ryb2tlICYmIHRoaXMuc3R5bGUuc3Ryb2tlVGhpY2tuZXNzKVxuICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQuc3Ryb2tlVGV4dChsaW5lc1tpXSwgbGluZVBvc2l0aW9uLngsIGxpbmVQb3NpdGlvbi55KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRoaXMuc3R5bGUuZmlsbClcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmZpbGxUZXh0KGxpbmVzW2ldLCBsaW5lUG9zaXRpb24ueCwgbGluZVBvc2l0aW9uLnkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVUZXh0dXJlKCk7XG59O1xuXG4vKipcbiAqIFVwZGF0ZXMgdGV4dHVyZSBzaXplIGJhc2VkIG9uIGNhbnZhcyBzaXplXG4gKlxuICogQG1ldGhvZCB1cGRhdGVUZXh0dXJlXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUZXh0dXJlID0gZnVuY3Rpb24gdXBkYXRlVGV4dHVyZSgpXG57XG4gICAgdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLndpZHRoID0gdGhpcy5jYW52YXMud2lkdGg7XG4gICAgdGhpcy50ZXh0dXJlLmJhc2VUZXh0dXJlLmhlaWdodCA9IHRoaXMuY2FudmFzLmhlaWdodDtcbiAgICB0aGlzLnRleHR1cmUuZnJhbWUud2lkdGggPSB0aGlzLmNhbnZhcy53aWR0aDtcbiAgICB0aGlzLnRleHR1cmUuZnJhbWUuaGVpZ2h0ID0gdGhpcy5jYW52YXMuaGVpZ2h0O1xuXG4gICAgdGhpcy5fd2lkdGggPSB0aGlzLmNhbnZhcy53aWR0aDtcbiAgICB0aGlzLl9oZWlnaHQgPSB0aGlzLmNhbnZhcy5oZWlnaHQ7XG5cbiAgICBnbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUucHVzaCh0aGlzLnRleHR1cmUuYmFzZVRleHR1cmUpO1xufTtcblxuLyoqXG4gKiBVcGRhdGVzIHRoZSB0cmFuc2ZvciBvZiB0aGlzIG9iamVjdFxuICpcbiAqIEBtZXRob2QgdXBkYXRlVHJhbnNmb3JtXG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by51cGRhdGVUcmFuc2Zvcm0gPSBmdW5jdGlvbiB1cGRhdGVUcmFuc2Zvcm0oKVxue1xuICAgIGlmKHRoaXMuZGlydHkpXG4gICAge1xuICAgICAgICB0aGlzLnVwZGF0ZVRleHQoKTtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIFNwcml0ZS5wcm90b3R5cGUudXBkYXRlVHJhbnNmb3JtLmNhbGwodGhpcyk7XG59O1xuXG4vKlxuICogaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3VzZXJzLzM0NDQxL2VsbGlzYmJlblxuICogZ3JlYXQgc29sdXRpb24gdG8gdGhlIHByb2JsZW0hXG4gKlxuICogQG1ldGhvZCBkZXRlcm1pbmVGb250SGVpZ2h0XG4gKiBAcGFyYW0gZm9udFN0eWxlIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG5wcm90by5kZXRlcm1pbmVGb250SGVpZ2h0ID0gZnVuY3Rpb24gZGV0ZXJtaW5lRm9udEhlaWdodChmb250U3R5bGUpXG57XG4gICAgLy8gYnVpbGQgYSBsaXR0bGUgcmVmZXJlbmNlIGRpY3Rpb25hcnkgc28gaWYgdGhlIGZvbnQgc3R5bGUgaGFzIGJlZW4gdXNlZCByZXR1cm4gYVxuICAgIC8vIGNhY2hlZCB2ZXJzaW9uLi4uXG4gICAgdmFyIHJlc3VsdCA9IFRleHQuaGVpZ2h0Q2FjaGVbZm9udFN0eWxlXTtcblxuICAgIGlmKCFyZXN1bHQpXG4gICAge1xuICAgICAgICB2YXIgYm9keSA9IHBsYXRmb3JtLmRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdib2R5JylbMF07XG4gICAgICAgIHZhciBkdW1teSA9IHBsYXRmb3JtLmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB2YXIgZHVtbXlUZXh0ID0gcGxhdGZvcm0uZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJ00nKTtcbiAgICAgICAgZHVtbXkuYXBwZW5kQ2hpbGQoZHVtbXlUZXh0KTtcbiAgICAgICAgZHVtbXkuc2V0QXR0cmlidXRlKCdzdHlsZScsIGZvbnRTdHlsZSArICc7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDowJyk7XG4gICAgICAgIGJvZHkuYXBwZW5kQ2hpbGQoZHVtbXkpO1xuXG4gICAgICAgIHJlc3VsdCA9IGR1bW15Lm9mZnNldEhlaWdodDtcbiAgICAgICAgVGV4dC5oZWlnaHRDYWNoZVtmb250U3R5bGVdID0gcmVzdWx0O1xuXG4gICAgICAgIGJvZHkucmVtb3ZlQ2hpbGQoZHVtbXkpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vKipcbiAqIEFwcGxpZXMgbmV3bGluZXMgdG8gYSBzdHJpbmcgdG8gaGF2ZSBpdCBvcHRpbWFsbHkgZml0IGludG8gdGhlIGhvcml6b250YWxcbiAqIGJvdW5kcyBzZXQgYnkgdGhlIFRleHQgb2JqZWN0J3Mgd29yZFdyYXBXaWR0aCBwcm9wZXJ0eS5cbiAqXG4gKiBAbWV0aG9kIHdvcmRXcmFwXG4gKiBAcGFyYW0gdGV4dCB7U3RyaW5nfVxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ud29yZFdyYXAgPSBmdW5jdGlvbiB3b3JkV3JhcCh0ZXh0KVxue1xuICAgIC8vIEdyZWVkeSB3cmFwcGluZyBhbGdvcml0aG0gdGhhdCB3aWxsIHdyYXAgd29yZHMgYXMgdGhlIGxpbmUgZ3Jvd3MgbG9uZ2VyXG4gICAgLy8gdGhhbiBpdHMgaG9yaXpvbnRhbCBib3VuZHMuXG4gICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgIHZhciBsaW5lcyA9IHRleHQuc3BsaXQoJ1xcbicpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgICB2YXIgc3BhY2VMZWZ0ID0gdGhpcy5zdHlsZS53b3JkV3JhcFdpZHRoO1xuICAgICAgICB2YXIgd29yZHMgPSBsaW5lc1tpXS5zcGxpdCgnICcpO1xuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHdvcmRzLmxlbmd0aDsgaisrKVxuICAgICAgICB7XG4gICAgICAgICAgICB2YXIgd29yZFdpZHRoID0gdGhpcy5jb250ZXh0Lm1lYXN1cmVUZXh0KHdvcmRzW2pdKS53aWR0aDtcbiAgICAgICAgICAgIHZhciB3b3JkV2lkdGhXaXRoU3BhY2UgPSB3b3JkV2lkdGggKyB0aGlzLmNvbnRleHQubWVhc3VyZVRleHQoJyAnKS53aWR0aDtcbiAgICAgICAgICAgIGlmKHdvcmRXaWR0aFdpdGhTcGFjZSA+IHNwYWNlTGVmdClcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBTa2lwIHByaW50aW5nIHRoZSBuZXdsaW5lIGlmIGl0J3MgdGhlIGZpcnN0IHdvcmQgb2YgdGhlIGxpbmUgdGhhdCBpc1xuICAgICAgICAgICAgICAgIC8vIGdyZWF0ZXIgdGhhbiB0aGUgd29yZCB3cmFwIHdpZHRoLlxuICAgICAgICAgICAgICAgIGlmKGogPiAwKVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9ICdcXG4nO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gd29yZHNbal0gKyAnICc7XG4gICAgICAgICAgICAgICAgc3BhY2VMZWZ0ID0gdGhpcy5zdHlsZS53b3JkV3JhcFdpZHRoIC0gd29yZFdpZHRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHNwYWNlTGVmdCAtPSB3b3JkV2lkdGhXaXRoU3BhY2U7XG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IHdvcmRzW2pdICsgJyAnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCArPSAnXFxuJztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8qKlxuICogRGVzdHJveXMgdGhpcyB0ZXh0IG9iamVjdFxuICpcbiAqIEBtZXRob2QgZGVzdHJveVxuICogQHBhcmFtIGRlc3Ryb3lUZXh0dXJlIHtCb29sZWFufVxuICovXG5wcm90by5kZXN0cm95ID0gZnVuY3Rpb24gZGVzdHJveShkZXN0cm95VGV4dHVyZSlcbntcbiAgICBpZihkZXN0cm95VGV4dHVyZSlcbiAgICB7XG4gICAgICAgIHRoaXMudGV4dHVyZS5kZXN0cm95KCk7XG4gICAgfVxuXG59O1xuXG5UZXh0LmhlaWdodENhY2hlID0ge307XG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dDtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vcGxhdGZvcm0nKTtcbnZhciBnbG9iYWxzID0gcmVxdWlyZSgnLi4vY29yZS9nbG9iYWxzJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcbnZhciBiYXNlVGV4dHVyZUNhY2hlID0ge307XG5cbi8qKlxuICogQSB0ZXh0dXJlIHN0b3JlcyB0aGUgaW5mb3JtYXRpb24gdGhhdCByZXByZXNlbnRzIGFuIGltYWdlLiBBbGwgdGV4dHVyZXMgaGF2ZSBhIGJhc2UgdGV4dHVyZVxuICpcbiAqIEBjbGFzcyBCYXNlVGV4dHVyZVxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHNvdXJjZSB7U3RyaW5nfSB0aGUgc291cmNlIG9iamVjdCAoaW1hZ2Ugb3IgY2FudmFzKVxuICovXG5mdW5jdGlvbiBCYXNlVGV4dHVyZShzb3VyY2UsIHNjYWxlTW9kZSlcbntcbiAgICBFdmVudFRhcmdldC5jYWxsKHRoaXMpO1xuXG4gICAgLyoqXG4gICAgICogW3JlYWQtb25seV0gVGhlIHdpZHRoIG9mIHRoZSBiYXNlIHRleHR1cmUgc2V0IHdoZW4gdGhlIGltYWdlIGhhcyBsb2FkZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB3aWR0aFxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMud2lkdGggPSAxMDA7XG5cbiAgICAvKipcbiAgICAgKiBbcmVhZC1vbmx5XSBUaGUgaGVpZ2h0IG9mIHRoZSBiYXNlIHRleHR1cmUgc2V0IHdoZW4gdGhlIGltYWdlIGhhcyBsb2FkZWRcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBoZWlnaHRcbiAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgKiBAcmVhZE9ubHlcbiAgICAgKi9cbiAgICB0aGlzLmhlaWdodCA9IDEwMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzY2FsZSBtb2RlIHRvIGFwcGx5IHdoZW4gc2NhbGluZyB0aGlzIHRleHR1cmVcbiAgICAgKiBAcHJvcGVydHkgc2NhbGVNb2RlXG4gICAgICogQHR5cGUgUElYSS5CYXNlVGV4dHVyZS5TQ0FMRV9NT0RFXG4gICAgICogQGRlZmF1bHQgUElYSS5CYXNlVGV4dHVyZS5TQ0FMRV9NT0RFLkxJTkVBUlxuICAgICAqL1xuICAgIHRoaXMuc2NhbGVNb2RlID0gc2NhbGVNb2RlIHx8IEJhc2VUZXh0dXJlLlNDQUxFX01PREUuREVGQVVMVDtcblxuICAgIC8qKlxuICAgICAqIFtyZWFkLW9ubHldIERlc2NyaWJlcyBpZiB0aGUgYmFzZSB0ZXh0dXJlIGhhcyBsb2FkZWQgb3Igbm90XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgaGFzTG9hZGVkXG4gICAgICogQHR5cGUgQm9vbGVhblxuICAgICAqIEByZWFkT25seVxuICAgICAqL1xuICAgIHRoaXMuaGFzTG9hZGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc291cmNlIHRoYXQgaXMgbG9hZGVkIHRvIGNyZWF0ZSB0aGUgdGV4dHVyZVxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHNvdXJjZVxuICAgICAqIEB0eXBlIEltYWdlXG4gICAgICovXG4gICAgdGhpcy5zb3VyY2UgPSBzb3VyY2U7XG5cbiAgICBpZighc291cmNlKXJldHVybjtcblxuICAgIGlmKCdjb21wbGV0ZScgaW4gdGhpcy5zb3VyY2UpXG4gICAge1xuICAgICAgICBpZih0aGlzLnNvdXJjZS5jb21wbGV0ZSlcbiAgICAgICAge1xuICAgICAgICAgICAgdGhpcy5oYXNMb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMuc291cmNlLndpZHRoO1xuICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLnNvdXJjZS5oZWlnaHQ7XG5cbiAgICAgICAgICAgIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZS5wdXNoKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuXG4gICAgICAgICAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICBzY29wZS5oYXNMb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNjb3BlLndpZHRoID0gc2NvcGUuc291cmNlLndpZHRoO1xuICAgICAgICAgICAgICAgIHNjb3BlLmhlaWdodCA9IHNjb3BlLnNvdXJjZS5oZWlnaHQ7XG5cbiAgICAgICAgICAgICAgICAvLyBhZGQgaXQgdG8gc29tZXdoZXJlLi4uXG4gICAgICAgICAgICAgICAgZ2xvYmFscy50ZXh0dXJlc1RvVXBkYXRlLnB1c2goc2NvcGUpO1xuICAgICAgICAgICAgICAgIHNjb3BlLmRpc3BhdGNoRXZlbnQoIHsgdHlwZTogJ2xvYWRlZCcsIGNvbnRlbnQ6IHNjb3BlIH0gKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvL3RoaXMuaW1hZ2Uuc3JjID0gaW1hZ2VVcmw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdGhpcy5oYXNMb2FkZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLndpZHRoID0gdGhpcy5zb3VyY2Uud2lkdGg7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5zb3VyY2UuaGVpZ2h0O1xuXG4gICAgICAgIGdsb2JhbHMudGV4dHVyZXNUb1VwZGF0ZS5wdXNoKHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuaW1hZ2VVcmwgPSBudWxsO1xuICAgIHRoaXMuX3Bvd2VyT2YyID0gZmFsc2U7XG59XG5cbnZhciBwcm90byA9IEJhc2VUZXh0dXJlLnByb3RvdHlwZTtcblxuLyoqXG4gKiBEZXN0cm95cyB0aGlzIGJhc2UgdGV4dHVyZVxuICpcbiAqIEBtZXRob2QgZGVzdHJveVxuICovXG5wcm90by5kZXN0cm95ID0gZnVuY3Rpb24gZGVzdHJveSgpXG57XG4gICAgaWYodGhpcy5zb3VyY2Uuc3JjKVxuICAgIHtcbiAgICAgICAgaWYgKHRoaXMuaW1hZ2VVcmwgaW4gYmFzZVRleHR1cmVDYWNoZSlcbiAgICAgICAgICAgIGRlbGV0ZSBiYXNlVGV4dHVyZUNhY2hlW3RoaXMuaW1hZ2VVcmxdO1xuICAgICAgICB0aGlzLmltYWdlVXJsID0gbnVsbDtcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3JjID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuICAgIGdsb2JhbHMudGV4dHVyZXNUb0Rlc3Ryb3kucHVzaCh0aGlzKTtcbn07XG5cbi8qKlxuICpcbiAqXG4gKiBAbWV0aG9kIGRlc3Ryb3lcbiAqL1xucHJvdG8udXBkYXRlU291cmNlSW1hZ2UgPSBmdW5jdGlvbiB1cGRhdGVTb3VyY2VJbWFnZShuZXdTcmMpXG57XG4gICAgdGhpcy5oYXNMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnNvdXJjZS5zcmMgPSBudWxsO1xuICAgIHRoaXMuc291cmNlLnNyYyA9IG5ld1NyYztcbn07XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGJhc2UgdGV4dHVyZSBiYXNlZCBvbiBhbiBpbWFnZSB1cmxcbiAqIElmIHRoZSBpbWFnZSBpcyBub3QgaW4gdGhlIGJhc2UgdGV4dHVyZSBjYWNoZSBpdCB3aWxsIGJlICBjcmVhdGVkIGFuZCBsb2FkZWRcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGZyb21JbWFnZVxuICogQHBhcmFtIGltYWdlVXJsIHtTdHJpbmd9IFRoZSBpbWFnZSB1cmwgb2YgdGhlIHRleHR1cmVcbiAqIEByZXR1cm4gQmFzZVRleHR1cmVcbiAqL1xuQmFzZVRleHR1cmUuZnJvbUltYWdlID0gZnVuY3Rpb24gZnJvbUltYWdlKGltYWdlVXJsLCBjcm9zc29yaWdpbiwgc2NhbGVNb2RlKVxue1xuICAgIHZhciBiYXNlVGV4dHVyZSA9IGJhc2VUZXh0dXJlQ2FjaGVbaW1hZ2VVcmxdO1xuICAgIGlmKCFiYXNlVGV4dHVyZSlcbiAgICB7XG4gICAgICAgIHZhciBpbWFnZSA9IG5ldyBwbGF0Zm9ybS5jcmVhdGVJbWFnZSgpO1xuICAgICAgICBpZiAoY3Jvc3NvcmlnaW4pXG4gICAgICAgIHtcbiAgICAgICAgICAgIGltYWdlLmNyb3NzT3JpZ2luID0gJyc7XG4gICAgICAgIH1cbiAgICAgICAgaW1hZ2Uuc3JjID0gaW1hZ2VVcmw7XG4gICAgICAgIGJhc2VUZXh0dXJlID0gbmV3IEJhc2VUZXh0dXJlKGltYWdlLCBzY2FsZU1vZGUpO1xuICAgICAgICBiYXNlVGV4dHVyZS5pbWFnZVVybCA9IGltYWdlVXJsO1xuICAgICAgICBiYXNlVGV4dHVyZUNhY2hlW2ltYWdlVXJsXSA9IGJhc2VUZXh0dXJlO1xuICAgIH1cblxuICAgIHJldHVybiBiYXNlVGV4dHVyZTtcbn07XG5cbkJhc2VUZXh0dXJlLlNDQUxFX01PREUgPSB7XG4gICAgREVGQVVMVDogMCwgLy9kZWZhdWx0IHRvIExJTkVBUlxuICAgIExJTkVBUjogMCxcbiAgICBORUFSRVNUOiAxXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VUZXh0dXJlO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZ2xvYmFscyA9IHJlcXVpcmUoJy4uL2NvcmUvZ2xvYmFscycpO1xudmFyIG1hdDMgPSByZXF1aXJlKCcuLi9nZW9tL21hdHJpeCcpLm1hdDM7XG5cbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi9UZXh0dXJlJyk7XG52YXIgQmFzZVRleHR1cmUgPSByZXF1aXJlKCcuL0Jhc2VUZXh0dXJlJyk7XG52YXIgUG9pbnQgPSByZXF1aXJlKCcuLi9nZW9tL1BvaW50Jyk7XG52YXIgUmVjdGFuZ2xlID0gcmVxdWlyZSgnLi4vZ2VvbS9SZWN0YW5nbGUnKTtcbnZhciBFdmVudFRhcmdldCA9IHJlcXVpcmUoJy4uL2V2ZW50cy9FdmVudFRhcmdldCcpO1xudmFyIENhbnZhc1JlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXJzL2NhbnZhcy9DYW52YXNSZW5kZXJlcicpO1xudmFyIFdlYkdMUmVuZGVyR3JvdXAgPSByZXF1aXJlKCcuLi9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xSZW5kZXJHcm91cCcpO1xuXG4vKipcbiBBIFJlbmRlclRleHR1cmUgaXMgYSBzcGVjaWFsIHRleHR1cmUgdGhhdCBhbGxvd3MgYW55IHBpeGkgZGlzcGxheU9iamVjdCB0byBiZSByZW5kZXJlZCB0byBpdC5cblxuIF9fSGludF9fOiBBbGwgRGlzcGxheU9iamVjdHMgKGV4bXBsLiBTcHJpdGVzKSB0aGF0IHJlbmRlcnMgb24gUmVuZGVyVGV4dHVyZSBzaG91bGQgYmUgcHJlbG9hZGVkLlxuIE90aGVyd2lzZSBibGFjayByZWN0YW5nbGVzIHdpbGwgYmUgZHJhd24gaW5zdGVhZC5cblxuIFJlbmRlclRleHR1cmUgdGFrZXMgc25hcHNob3Qgb2YgRGlzcGxheU9iamVjdCBwYXNzZWQgdG8gcmVuZGVyIG1ldGhvZC4gSWYgRGlzcGxheU9iamVjdCBpcyBwYXNzZWQgdG8gcmVuZGVyIG1ldGhvZCwgcG9zaXRpb24gYW5kIHJvdGF0aW9uIG9mIGl0IHdpbGwgYmUgaWdub3JlZC4gRm9yIGV4YW1wbGU6XG5cbiAgICB2YXIgcmVuZGVyVGV4dHVyZSA9IG5ldyBSZW5kZXJUZXh0dXJlKDgwMCwgNjAwKTtcbiAgICB2YXIgc3ByaXRlID0gU3ByaXRlLmZyb21JbWFnZShcInNwaW5PYmpfMDEucG5nXCIpO1xuICAgIHNwcml0ZS5wb3NpdGlvbi54ID0gODAwLzI7XG4gICAgc3ByaXRlLnBvc2l0aW9uLnkgPSA2MDAvMjtcbiAgICBzcHJpdGUuYW5jaG9yLnggPSAwLjU7XG4gICAgc3ByaXRlLmFuY2hvci55ID0gMC41O1xuICAgIHJlbmRlclRleHR1cmUucmVuZGVyKHNwcml0ZSk7XG5cbiBTcHJpdGUgaW4gdGhpcyBjYXNlIHdpbGwgYmUgcmVuZGVyZWQgdG8gMCwwIHBvc2l0aW9uLiBUbyByZW5kZXIgdGhpcyBzcHJpdGUgYXQgY2VudGVyIERpc3BsYXlPYmplY3RDb250YWluZXIgc2hvdWxkIGJlIHVzZWQ6XG5cbiAgICB2YXIgZG9jID0gbmV3IERpc3BsYXlPYmplY3RDb250YWluZXIoKTtcbiAgICBkb2MuYWRkQ2hpbGQoc3ByaXRlKTtcbiAgICByZW5kZXJUZXh0dXJlLnJlbmRlcihkb2MpOyAgLy8gUmVuZGVycyB0byBjZW50ZXIgb2YgcmVuZGVyVGV4dHVyZVxuXG4gQGNsYXNzIFJlbmRlclRleHR1cmVcbiBAZXh0ZW5kcyBUZXh0dXJlXG4gQGNvbnN0cnVjdG9yXG4gQHBhcmFtIHdpZHRoIHtOdW1iZXJ9IFRoZSB3aWR0aCBvZiB0aGUgcmVuZGVyIHRleHR1cmVcbiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9IFRoZSBoZWlnaHQgb2YgdGhlIHJlbmRlciB0ZXh0dXJlXG4gKi9cbmZ1bmN0aW9uIFJlbmRlclRleHR1cmUod2lkdGgsIGhlaWdodClcbntcbiAgICBFdmVudFRhcmdldC5jYWxsKCB0aGlzICk7XG5cbiAgICB0aGlzLndpZHRoID0gd2lkdGggfHwgMTAwO1xuICAgIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0IHx8IDEwMDtcblxuICAgIHRoaXMuaWRlbnRpdHlNYXRyaXggPSBtYXQzLmNyZWF0ZSgpO1xuXG4gICAgdGhpcy5mcmFtZSA9IG5ldyBSZWN0YW5nbGUoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXG4gICAgaWYoZ2xvYmFscy5nbClcbiAgICB7XG4gICAgICAgIHRoaXMuaW5pdFdlYkdMKCk7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIHRoaXMuaW5pdENhbnZhcygpO1xuICAgIH1cbn1cblxudmFyIHByb3RvID0gUmVuZGVyVGV4dHVyZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFRleHR1cmUucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHt2YWx1ZTogUmVuZGVyVGV4dHVyZX1cbn0pO1xuXG4vKipcbiAqIEluaXRpYWxpemVzIHRoZSB3ZWJnbCBkYXRhIGZvciB0aGlzIHRleHR1cmVcbiAqXG4gKiBAbWV0aG9kIGluaXRXZWJHTFxuICogQHByaXZhdGVcbiAqL1xucHJvdG8uaW5pdFdlYkdMID0gZnVuY3Rpb24gaW5pdFdlYkdMKClcbntcbiAgICB2YXIgZ2wgPSBnbG9iYWxzLmdsO1xuICAgIHRoaXMuZ2xGcmFtZWJ1ZmZlciA9IGdsLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG5cbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuZ2xGcmFtZWJ1ZmZlciApO1xuXG4gICAgdGhpcy5nbEZyYW1lYnVmZmVyLndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLmdsRnJhbWVidWZmZXIuaGVpZ2h0ID0gdGhpcy5oZWlnaHQ7XG5cbiAgICB0aGlzLmJhc2VUZXh0dXJlID0gbmV3IEJhc2VUZXh0dXJlKCk7XG5cbiAgICB0aGlzLmJhc2VUZXh0dXJlLndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLmJhc2VUZXh0dXJlLmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgdGhpcy5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRoaXMuYmFzZVRleHR1cmUuX2dsVGV4dHVyZSk7XG5cbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsICB0aGlzLndpZHRoLCAgdGhpcy5oZWlnaHQsIDAsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIG51bGwpO1xuXG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLkxJTkVBUik7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLkxJTkVBUik7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cbiAgICB0aGlzLmJhc2VUZXh0dXJlLmlzUmVuZGVyID0gdHJ1ZTtcblxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5nbEZyYW1lYnVmZmVyICk7XG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCB0aGlzLmJhc2VUZXh0dXJlLl9nbFRleHR1cmUsIDApO1xuXG4gICAgLy8gY3JlYXRlIGEgcHJvamVjdGlvbiBtYXRyaXguLlxuICAgIHRoaXMucHJvamVjdGlvbiA9IG5ldyBQb2ludCh0aGlzLndpZHRoLzIgLCAtdGhpcy5oZWlnaHQvMik7XG5cbiAgICAvLyBzZXQgdGhlIGNvcnJlY3QgcmVuZGVyIGZ1bmN0aW9uLi5cbiAgICB0aGlzLnJlbmRlciA9IHRoaXMucmVuZGVyV2ViR0w7XG59O1xuXG5wcm90by5yZXNpemUgPSBmdW5jdGlvbiByZXNpemUod2lkdGgsIGhlaWdodClcbntcblxuICAgIHRoaXMud2lkdGggPSB3aWR0aDtcbiAgICB0aGlzLmhlaWdodCA9IGhlaWdodDtcblxuICAgIGlmKGdsb2JhbHMuZ2wpXG4gICAge1xuICAgICAgICB0aGlzLnByb2plY3Rpb24ueCA9IHRoaXMud2lkdGggLyAyO1xuICAgICAgICB0aGlzLnByb2plY3Rpb24ueSA9IC10aGlzLmhlaWdodCAvIDI7XG5cbiAgICAgICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcbiAgICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGhpcy5iYXNlVGV4dHVyZS5fZ2xUZXh0dXJlKTtcbiAgICAgICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAgdGhpcy53aWR0aCwgIHRoaXMuaGVpZ2h0LCAwLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcblxuICAgICAgICB0aGlzLmZyYW1lLndpZHRoID0gdGhpcy53aWR0aDtcbiAgICAgICAgdGhpcy5mcmFtZS5oZWlnaHQgPSB0aGlzLmhlaWdodDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5yZXNpemUodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuICAgIH1cbn07XG5cbi8qKlxuICogSW5pdGlhbGl6ZXMgdGhlIGNhbnZhcyBkYXRhIGZvciB0aGlzIHRleHR1cmVcbiAqXG4gKiBAbWV0aG9kIGluaXRDYW52YXNcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLmluaXRDYW52YXMgPSBmdW5jdGlvbiBpbml0Q2FudmFzKClcbntcbiAgICB0aGlzLnJlbmRlcmVyID0gbmV3IENhbnZhc1JlbmRlcmVyKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0LCBudWxsLCAwKTtcblxuICAgIHRoaXMuYmFzZVRleHR1cmUgPSBuZXcgQmFzZVRleHR1cmUodGhpcy5yZW5kZXJlci52aWV3KTtcbiAgICB0aGlzLmZyYW1lID0gbmV3IFJlY3RhbmdsZSgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cbiAgICB0aGlzLnJlbmRlciA9IHRoaXMucmVuZGVyQ2FudmFzO1xufTtcblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgZHJhdyB0aGUgZGlzcGxheSBvYmplY3QgdG8gdGhlIHRleHR1cmUuXG4gKlxuICogQG1ldGhvZCByZW5kZXJXZWJHTFxuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9IFRoZSBkaXNwbGF5IG9iamVjdCB0byByZW5kZXIgdGhpcyB0ZXh0dXJlIG9uXG4gKiBAcGFyYW0gY2xlYXIge0Jvb2xlYW59IElmIHRydWUgdGhlIHRleHR1cmUgd2lsbCBiZSBjbGVhcmVkIGJlZm9yZSB0aGUgZGlzcGxheU9iamVjdCBpcyBkcmF3blxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyV2ViR0wgPSBmdW5jdGlvbiByZW5kZXJXZWJHTChkaXNwbGF5T2JqZWN0LCBwb3NpdGlvbiwgY2xlYXIpXG57XG4gICAgdmFyIGdsID0gZ2xvYmFscy5nbDtcblxuICAgIC8vIGVuYWJsZSB0aGUgYWxwaGEgY29sb3IgbWFzay4uXG4gICAgZ2wuY29sb3JNYXNrKHRydWUsIHRydWUsIHRydWUsIHRydWUpO1xuXG4gICAgZ2wudmlld3BvcnQoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuXG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmdsRnJhbWVidWZmZXIgKTtcblxuICAgIGlmKGNsZWFyKVxuICAgIHtcbiAgICAgICAgZ2wuY2xlYXJDb2xvcigwLDAsMCwgMCk7XG4gICAgICAgIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQpO1xuICAgIH1cblxuICAgIC8vIFRISVMgV0lMTCBNRVNTIFdJVEggSElUIFRFU1RJTkchXG4gICAgdmFyIGNoaWxkcmVuID0gZGlzcGxheU9iamVjdC5jaGlsZHJlbjtcblxuICAgIC8vVE9ETyAtPyBjcmVhdGUgYSBuZXcgb25lPz8/IGRvbnQgdGhpbmsgc28hXG4gICAgdmFyIG9yaWdpbmFsV29ybGRUcmFuc2Zvcm0gPSBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtO1xuICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm0gPSBtYXQzLmNyZWF0ZSgpOy8vc3RoaXMuaWRlbnRpdHlNYXRyaXg7XG4gICAgLy8gbW9kaWZ5IHRvIGZsaXAuLi5cbiAgICBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtWzRdID0gLTE7XG4gICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybVs1XSA9IHRoaXMucHJvamVjdGlvbi55ICogLTI7XG5cbiAgICBpZihwb3NpdGlvbilcbiAgICB7XG4gICAgICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm1bMl0gPSBwb3NpdGlvbi54O1xuICAgICAgICBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtWzVdIC09IHBvc2l0aW9uLnk7XG4gICAgfVxuXG4gICAgZ2xvYmFscy52aXNpYmxlQ291bnQrKztcbiAgICBkaXNwbGF5T2JqZWN0LnZjb3VudCA9IGdsb2JhbHMudmlzaWJsZUNvdW50O1xuXG4gICAgZm9yKHZhciBpPTAsaj1jaGlsZHJlbi5sZW5ndGg7IGk8ajsgaSsrKVxuICAgIHtcbiAgICAgICAgY2hpbGRyZW5baV0udXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgdmFyIHJlbmRlckdyb3VwID0gZGlzcGxheU9iamVjdC5fX3JlbmRlckdyb3VwO1xuXG4gICAgaWYocmVuZGVyR3JvdXApXG4gICAge1xuICAgICAgICBpZihkaXNwbGF5T2JqZWN0ID09PSByZW5kZXJHcm91cC5yb290KVxuICAgICAgICB7XG4gICAgICAgICAgICByZW5kZXJHcm91cC5yZW5kZXIodGhpcy5wcm9qZWN0aW9uLCB0aGlzLmdsRnJhbWVidWZmZXIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAge1xuICAgICAgICAgICAgcmVuZGVyR3JvdXAucmVuZGVyU3BlY2lmaWMoZGlzcGxheU9iamVjdCwgdGhpcy5wcm9qZWN0aW9uLCB0aGlzLmdsRnJhbWVidWZmZXIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICAgIGlmKCF0aGlzLnJlbmRlckdyb3VwKXRoaXMucmVuZGVyR3JvdXAgPSBuZXcgV2ViR0xSZW5kZXJHcm91cChnbCk7XG4gICAgICAgIHRoaXMucmVuZGVyR3JvdXAuc2V0UmVuZGVyYWJsZShkaXNwbGF5T2JqZWN0KTtcbiAgICAgICAgdGhpcy5yZW5kZXJHcm91cC5yZW5kZXIodGhpcy5wcm9qZWN0aW9uLCB0aGlzLmdsRnJhbWVidWZmZXIpO1xuICAgIH1cblxuICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm0gPSBvcmlnaW5hbFdvcmxkVHJhbnNmb3JtO1xufTtcblxuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBkcmF3IHRoZSBkaXNwbGF5IG9iamVjdCB0byB0aGUgdGV4dHVyZS5cbiAqXG4gKiBAbWV0aG9kIHJlbmRlckNhbnZhc1xuICogQHBhcmFtIGRpc3BsYXlPYmplY3Qge0Rpc3BsYXlPYmplY3R9IFRoZSBkaXNwbGF5IG9iamVjdCB0byByZW5kZXIgdGhpcyB0ZXh0dXJlIG9uXG4gKiBAcGFyYW0gY2xlYXIge0Jvb2xlYW59IElmIHRydWUgdGhlIHRleHR1cmUgd2lsbCBiZSBjbGVhcmVkIGJlZm9yZSB0aGUgZGlzcGxheU9iamVjdCBpcyBkcmF3blxuICogQHByaXZhdGVcbiAqL1xucHJvdG8ucmVuZGVyQ2FudmFzID0gZnVuY3Rpb24gcmVuZGVyQ2FudmFzKGRpc3BsYXlPYmplY3QsIHBvc2l0aW9uLCBjbGVhcilcbntcbiAgICB2YXIgY2hpbGRyZW4gPSBkaXNwbGF5T2JqZWN0LmNoaWxkcmVuO1xuXG4gICAgZGlzcGxheU9iamVjdC53b3JsZFRyYW5zZm9ybSA9IG1hdDMuY3JlYXRlKCk7XG5cbiAgICBpZihwb3NpdGlvbilcbiAgICB7XG4gICAgICAgIGRpc3BsYXlPYmplY3Qud29ybGRUcmFuc2Zvcm1bMl0gPSBwb3NpdGlvbi54O1xuICAgICAgICBkaXNwbGF5T2JqZWN0LndvcmxkVHJhbnNmb3JtWzVdID0gcG9zaXRpb24ueTtcbiAgICB9XG5cblxuICAgIGZvcih2YXIgaSA9IDAsIGogPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBqOyBpKyspXG4gICAge1xuICAgICAgICBjaGlsZHJlbltpXS51cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBpZihjbGVhcikgdGhpcy5yZW5kZXJlci5jb250ZXh0LmNsZWFyUmVjdCgwLDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuICAgIHRoaXMucmVuZGVyZXIucmVuZGVyRGlzcGxheU9iamVjdChkaXNwbGF5T2JqZWN0KTtcblxuICAgIHRoaXMucmVuZGVyZXIuY29udGV4dC5zZXRUcmFuc2Zvcm0oMSwwLDAsMSwwLDApO1xuXG4gICAgLy9nbG9iYWxzLnRleHR1cmVzVG9VcGRhdGUucHVzaCh0aGlzLmJhc2VUZXh0dXJlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVuZGVyVGV4dHVyZTtcbiIsIi8qKlxuICogQGF1dGhvciBNYXQgR3JvdmVzIGh0dHA6Ly9tYXRncm92ZXMuY29tLyBARG9vcm1hdDIzXG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIEJhc2VUZXh0dXJlID0gcmVxdWlyZSgnLi9CYXNlVGV4dHVyZScpO1xudmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vZ2VvbS9Qb2ludCcpO1xudmFyIFJlY3RhbmdsZSA9IHJlcXVpcmUoJy4uL2dlb20vUmVjdGFuZ2xlJyk7XG52YXIgRXZlbnRUYXJnZXQgPSByZXF1aXJlKCcuLi9ldmVudHMvRXZlbnRUYXJnZXQnKTtcblxuLyoqXG4gKiBBIHRleHR1cmUgc3RvcmVzIHRoZSBpbmZvcm1hdGlvbiB0aGF0IHJlcHJlc2VudHMgYW4gaW1hZ2Ugb3IgcGFydCBvZiBhbiBpbWFnZS4gSXQgY2Fubm90IGJlIGFkZGVkXG4gKiB0byB0aGUgZGlzcGxheSBsaXN0IGRpcmVjdGx5LiBUbyBkbyB0aGlzIHVzZSBTcHJpdGUuIElmIG5vIGZyYW1lIGlzIHByb3ZpZGVkIHRoZW4gdGhlIHdob2xlIGltYWdlIGlzIHVzZWRcbiAqXG4gKiBAY2xhc3MgVGV4dHVyZVxuICogQHVzZXMgRXZlbnRUYXJnZXRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIGJhc2VUZXh0dXJlIHtCYXNlVGV4dHVyZX0gVGhlIGJhc2UgdGV4dHVyZSBzb3VyY2UgdG8gY3JlYXRlIHRoZSB0ZXh0dXJlIGZyb21cbiAqIEBwYXJhbSBmcmFtZSB7UmVjdGFuZ2xlfSBUaGUgcmVjdGFuZ2xlIGZyYW1lIG9mIHRoZSB0ZXh0dXJlIHRvIHNob3dcbiAqL1xuZnVuY3Rpb24gVGV4dHVyZShiYXNlVGV4dHVyZSwgZnJhbWUpXG57XG4gICAgRXZlbnRUYXJnZXQuY2FsbCggdGhpcyApO1xuXG4gICAgaWYoIWZyYW1lKVxuICAgIHtcbiAgICAgICAgdGhpcy5ub0ZyYW1lID0gdHJ1ZTtcbiAgICAgICAgZnJhbWUgPSBuZXcgUmVjdGFuZ2xlKDAsMCwxLDEpO1xuICAgIH1cblxuICAgIGlmKGJhc2VUZXh0dXJlIGluc3RhbmNlb2YgVGV4dHVyZSlcbiAgICAgICAgYmFzZVRleHR1cmUgPSBiYXNlVGV4dHVyZS5iYXNlVGV4dHVyZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBiYXNlIHRleHR1cmUgb2YgdGhpcyB0ZXh0dXJlXG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgYmFzZVRleHR1cmVcbiAgICAgKiBAdHlwZSBCYXNlVGV4dHVyZVxuICAgICAqL1xuICAgIHRoaXMuYmFzZVRleHR1cmUgPSBiYXNlVGV4dHVyZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmcmFtZSBzcGVjaWZpZXMgdGhlIHJlZ2lvbiBvZiB0aGUgYmFzZSB0ZXh0dXJlIHRoYXQgdGhpcyB0ZXh0dXJlIHVzZXNcbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSBmcmFtZVxuICAgICAqIEB0eXBlIFJlY3RhbmdsZVxuICAgICAqL1xuICAgIHRoaXMuZnJhbWUgPSBmcmFtZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0cmltIHBvaW50XG4gICAgICpcbiAgICAgKiBAcHJvcGVydHkgdHJpbVxuICAgICAqIEB0eXBlIFBvaW50XG4gICAgICovXG4gICAgdGhpcy50cmltID0gbmV3IFBvaW50KCk7XG5cbiAgICB0aGlzLnNjb3BlID0gdGhpcztcblxuICAgIGlmKGJhc2VUZXh0dXJlLmhhc0xvYWRlZClcbiAgICB7XG4gICAgICAgIGlmKHRoaXMubm9GcmFtZSlmcmFtZSA9IG5ldyBSZWN0YW5nbGUoMCwwLCBiYXNlVGV4dHVyZS53aWR0aCwgYmFzZVRleHR1cmUuaGVpZ2h0KTtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhmcmFtZSlcblxuICAgICAgICB0aGlzLnNldEZyYW1lKGZyYW1lKTtcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgICAgdmFyIHNjb3BlID0gdGhpcztcbiAgICAgICAgYmFzZVRleHR1cmUuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkJywgZnVuY3Rpb24oKXsgc2NvcGUub25CYXNlVGV4dHVyZUxvYWRlZCgpOyB9KTtcbiAgICB9XG59XG5cbnZhciBwcm90byA9IFRleHR1cmUucHJvdG90eXBlO1xuXG4vKipcbiAqIENhbGxlZCB3aGVuIHRoZSBiYXNlIHRleHR1cmUgaXMgbG9hZGVkXG4gKlxuICogQG1ldGhvZCBvbkJhc2VUZXh0dXJlTG9hZGVkXG4gKiBAcGFyYW0gZXZlbnRcbiAqIEBwcml2YXRlXG4gKi9cbnByb3RvLm9uQmFzZVRleHR1cmVMb2FkZWQgPSBmdW5jdGlvbiBvbkJhc2VUZXh0dXJlTG9hZGVkKCkvKihldmVudCkqL1xue1xuICAgIHZhciBiYXNlVGV4dHVyZSA9IHRoaXMuYmFzZVRleHR1cmU7XG4gICAgYmFzZVRleHR1cmUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2xvYWRlZCcsIHRoaXMub25Mb2FkZWQgKTtcblxuICAgIGlmKHRoaXMubm9GcmFtZSl0aGlzLmZyYW1lID0gbmV3IFJlY3RhbmdsZSgwLDAsIGJhc2VUZXh0dXJlLndpZHRoLCBiYXNlVGV4dHVyZS5oZWlnaHQpO1xuICAgIHRoaXMubm9GcmFtZSA9IGZhbHNlO1xuICAgIHRoaXMud2lkdGggPSB0aGlzLmZyYW1lLndpZHRoO1xuICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5mcmFtZS5oZWlnaHQ7XG5cbiAgICB0aGlzLnNjb3BlLmRpc3BhdGNoRXZlbnQoIHsgdHlwZTogJ3VwZGF0ZScsIGNvbnRlbnQ6IHRoaXMgfSApO1xufTtcblxuLyoqXG4gKiBEZXN0cm95cyB0aGlzIHRleHR1cmVcbiAqXG4gKiBAbWV0aG9kIGRlc3Ryb3lcbiAqIEBwYXJhbSBkZXN0cm95QmFzZSB7Qm9vbGVhbn0gV2hldGhlciB0byBkZXN0cm95IHRoZSBiYXNlIHRleHR1cmUgYXMgd2VsbFxuICovXG5wcm90by5kZXN0cm95ID0gZnVuY3Rpb24gZGVzdHJveShkZXN0cm95QmFzZSlcbntcbiAgICBpZihkZXN0cm95QmFzZSkgdGhpcy5iYXNlVGV4dHVyZS5kZXN0cm95KCk7XG59O1xuXG4vKipcbiAqIFNwZWNpZmllcyB0aGUgcmVjdGFuZ2xlIHJlZ2lvbiBvZiB0aGUgYmFzZVRleHR1cmVcbiAqXG4gKiBAbWV0aG9kIHNldEZyYW1lXG4gKiBAcGFyYW0gZnJhbWUge1JlY3RhbmdsZX0gVGhlIGZyYW1lIG9mIHRoZSB0ZXh0dXJlIHRvIHNldCBpdCB0b1xuICovXG5wcm90by5zZXRGcmFtZSA9IGZ1bmN0aW9uIHNldEZyYW1lKGZyYW1lKVxue1xuICAgIHRoaXMuZnJhbWUgPSBmcmFtZTtcbiAgICB0aGlzLndpZHRoID0gZnJhbWUud2lkdGg7XG4gICAgdGhpcy5oZWlnaHQgPSBmcmFtZS5oZWlnaHQ7XG5cbiAgICBpZihmcmFtZS54ICsgZnJhbWUud2lkdGggPiB0aGlzLmJhc2VUZXh0dXJlLndpZHRoIHx8IGZyYW1lLnkgKyBmcmFtZS5oZWlnaHQgPiB0aGlzLmJhc2VUZXh0dXJlLmhlaWdodClcbiAgICB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGV4dHVyZSBFcnJvcjogZnJhbWUgZG9lcyBub3QgZml0IGluc2lkZSB0aGUgYmFzZSBUZXh0dXJlIGRpbWVuc2lvbnMgJyArIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlRnJhbWUgPSB0cnVlO1xuXG4gICAgVGV4dHVyZS5mcmFtZVVwZGF0ZXMucHVzaCh0aGlzKTtcbiAgICAvL3RoaXMuZGlzcGF0Y2hFdmVudCggeyB0eXBlOiAndXBkYXRlJywgY29udGVudDogdGhpcyB9ICk7XG59O1xuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSB0ZXh0dXJlIGJhc2VkIG9uIGFuIGltYWdlIHVybFxuICogSWYgdGhlIGltYWdlIGlzIG5vdCBpbiB0aGUgdGV4dHVyZSBjYWNoZSBpdCB3aWxsIGJlICBjcmVhdGVkIGFuZCBsb2FkZWRcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGZyb21JbWFnZVxuICogQHBhcmFtIGltYWdlVXJsIHtTdHJpbmd9IFRoZSBpbWFnZSB1cmwgb2YgdGhlIHRleHR1cmVcbiAqIEBwYXJhbSBjcm9zc29yaWdpbiB7Qm9vbGVhbn0gV2hldGhlciByZXF1ZXN0cyBzaG91bGQgYmUgdHJlYXRlZCBhcyBjcm9zc29yaWdpblxuICogQHJldHVybiBUZXh0dXJlXG4gKi9cblRleHR1cmUuZnJvbUltYWdlID0gZnVuY3Rpb24gZnJvbUltYWdlKGltYWdlVXJsLCBjcm9zc29yaWdpbiwgc2NhbGVNb2RlKVxue1xuICAgIHZhciB0ZXh0dXJlID0gVGV4dHVyZS5jYWNoZVtpbWFnZVVybF07XG5cbiAgICBpZighdGV4dHVyZSlcbiAgICB7XG4gICAgICAgIHRleHR1cmUgPSBuZXcgVGV4dHVyZShCYXNlVGV4dHVyZS5mcm9tSW1hZ2UoaW1hZ2VVcmwsIGNyb3Nzb3JpZ2luLCBzY2FsZU1vZGUpKTtcbiAgICAgICAgVGV4dHVyZS5jYWNoZVtpbWFnZVVybF0gPSB0ZXh0dXJlO1xuICAgIH1cblxuICAgIHJldHVybiB0ZXh0dXJlO1xufTtcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgdGV4dHVyZSBiYXNlZCBvbiBhIGZyYW1lIGlkXG4gKiBJZiB0aGUgZnJhbWUgaWQgaXMgbm90IGluIHRoZSB0ZXh0dXJlIGNhY2hlIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCBmcm9tRnJhbWVcbiAqIEBwYXJhbSBmcmFtZUlkIHtTdHJpbmd9IFRoZSBmcmFtZSBpZCBvZiB0aGUgdGV4dHVyZVxuICogQHJldHVybiBUZXh0dXJlXG4gKi9cblRleHR1cmUuZnJvbUZyYW1lID0gZnVuY3Rpb24gZnJvbUZyYW1lKGZyYW1lSWQpXG57XG4gICAgdmFyIHRleHR1cmUgPSBUZXh0dXJlLmNhY2hlW2ZyYW1lSWRdO1xuICAgIGlmKCF0ZXh0dXJlKSB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBmcmFtZUlkIFwiJyArIGZyYW1lSWQgKyAnXCIgZG9lcyBub3QgZXhpc3QgaW4gdGhlIHRleHR1cmUgY2FjaGUgJyArIHRoaXMpO1xuICAgIHJldHVybiB0ZXh0dXJlO1xufTtcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgdGV4dHVyZSBiYXNlZCBvbiBhIGNhbnZhcyBlbGVtZW50XG4gKiBJZiB0aGUgY2FudmFzIGlzIG5vdCBpbiB0aGUgdGV4dHVyZSBjYWNoZSBpdCB3aWxsIGJlICBjcmVhdGVkIGFuZCBsb2FkZWRcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWV0aG9kIGZyb21DYW52YXNcbiAqIEBwYXJhbSBjYW52YXMge0NhbnZhc30gVGhlIGNhbnZhcyBlbGVtZW50IHNvdXJjZSBvZiB0aGUgdGV4dHVyZVxuICogQHJldHVybiBUZXh0dXJlXG4gKi9cblRleHR1cmUuZnJvbUNhbnZhcyA9IGZ1bmN0aW9uIGZyb21DYW52YXMoY2FudmFzLCBzY2FsZU1vZGUpXG57XG4gICAgdmFyIGJhc2VUZXh0dXJlID0gbmV3IEJhc2VUZXh0dXJlKGNhbnZhcywgc2NhbGVNb2RlKTtcbiAgICByZXR1cm4gbmV3IFRleHR1cmUoYmFzZVRleHR1cmUpO1xufTtcblxuXG4vKipcbiAqIEFkZHMgYSB0ZXh0dXJlIHRvIHRoZSB0ZXh0dXJlQ2FjaGUuXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCBhZGRUZXh0dXJlVG9DYWNoZVxuICogQHBhcmFtIHRleHR1cmUge1RleHR1cmV9XG4gKiBAcGFyYW0gaWQge1N0cmluZ30gdGhlIGlkIHRoYXQgdGhlIHRleHR1cmUgd2lsbCBiZSBzdG9yZWQgYWdhaW5zdC5cbiAqL1xuVGV4dHVyZS5hZGRUZXh0dXJlVG9DYWNoZSA9IGZ1bmN0aW9uIGFkZFRleHR1cmVUb0NhY2hlKHRleHR1cmUsIGlkKVxue1xuICAgIFRleHR1cmUuY2FjaGVbaWRdID0gdGV4dHVyZTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGEgdGV4dHVyZSBmcm9tIHRoZSB0ZXh0dXJlQ2FjaGUuXG4gKlxuICogQHN0YXRpY1xuICogQG1ldGhvZCByZW1vdmVUZXh0dXJlRnJvbUNhY2hlXG4gKiBAcGFyYW0gaWQge1N0cmluZ30gdGhlIGlkIG9mIHRoZSB0ZXh0dXJlIHRvIGJlIHJlbW92ZWRcbiAqIEByZXR1cm4ge1RleHR1cmV9IHRoZSB0ZXh0dXJlIHRoYXQgd2FzIHJlbW92ZWRcbiAqL1xuVGV4dHVyZS5yZW1vdmVUZXh0dXJlRnJvbUNhY2hlID0gZnVuY3Rpb24gcmVtb3ZlVGV4dHVyZUZyb21DYWNoZShpZClcbntcbiAgICB2YXIgdGV4dHVyZSA9IFRleHR1cmUuY2FjaGVbaWRdO1xuICAgIFRleHR1cmUuY2FjaGVbaWRdID0gbnVsbDtcbiAgICByZXR1cm4gdGV4dHVyZTtcbn07XG5cblRleHR1cmUuY2FjaGUgPSB7fTtcbi8vIHRoaXMgaXMgbW9yZSBmb3Igd2ViR0wuLiBpdCBjb250YWlucyB1cGRhdGVkIGZyYW1lcy4uXG5UZXh0dXJlLmZyYW1lVXBkYXRlcyA9IFtdO1xuVGV4dHVyZS5TQ0FMRV9NT0RFID0gQmFzZVRleHR1cmUuU0NBTEVfTU9ERTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0dXJlO1xuIiwiLypcbiAgICBQb2x5SyBsaWJyYXJ5XG4gICAgdXJsOiBodHRwOi8vcG9seWsuaXZhbmsubmV0XG4gICAgUmVsZWFzZWQgdW5kZXIgTUlUIGxpY2VuY2UuXG5cbiAgICBDb3B5cmlnaHQgKGMpIDIwMTIgSXZhbiBLdWNraXJcblxuICAgIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uXG4gICAgb2J0YWluaW5nIGEgY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb25cbiAgICBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXRcbiAgICByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSxcbiAgICBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxuICAgIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZVxuICAgIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nXG4gICAgY29uZGl0aW9uczpcblxuICAgIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlXG4gICAgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG5cbiAgICBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELFxuICAgIEVYUFJFU1MgT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFU1xuICAgIE9GIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EXG4gICAgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFRcbiAgICBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSxcbiAgICBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkdcbiAgICBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SXG4gICAgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4gICAgVGhpcyBpcyBhbiBhbWF6aW5nIGxpYiFcblxuICAgIHNsaWdodGx5IG1vZGlmaWVkIGJ5IG1hdCBncm92ZXMgKG1hdGdyb3Zlcy5jb20pO1xuKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHBsYXRmb3JtID0gcmVxdWlyZSgnLi4vcGxhdGZvcm0nKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYSBwb2ludCBpcyB3aXRoaW4gYSB0cmlhbmdsZVxuICpcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIHBvaW50SW5UcmlhbmdsZShweCwgcHksIGF4LCBheSwgYngsIGJ5LCBjeCwgY3kpXG57XG4gICAgdmFyIHYweCA9IGN4LWF4O1xuICAgIHZhciB2MHkgPSBjeS1heTtcbiAgICB2YXIgdjF4ID0gYngtYXg7XG4gICAgdmFyIHYxeSA9IGJ5LWF5O1xuICAgIHZhciB2MnggPSBweC1heDtcbiAgICB2YXIgdjJ5ID0gcHktYXk7XG5cbiAgICB2YXIgZG90MDAgPSB2MHgqdjB4K3YweSp2MHk7XG4gICAgdmFyIGRvdDAxID0gdjB4KnYxeCt2MHkqdjF5O1xuICAgIHZhciBkb3QwMiA9IHYweCp2MngrdjB5KnYyeTtcbiAgICB2YXIgZG90MTEgPSB2MXgqdjF4K3YxeSp2MXk7XG4gICAgdmFyIGRvdDEyID0gdjF4KnYyeCt2MXkqdjJ5O1xuXG4gICAgdmFyIGludkRlbm9tID0gMSAvIChkb3QwMCAqIGRvdDExIC0gZG90MDEgKiBkb3QwMSk7XG4gICAgdmFyIHUgPSAoZG90MTEgKiBkb3QwMiAtIGRvdDAxICogZG90MTIpICogaW52RGVub207XG4gICAgdmFyIHYgPSAoZG90MDAgKiBkb3QxMiAtIGRvdDAxICogZG90MDIpICogaW52RGVub207XG5cbiAgICAvLyBDaGVjayBpZiBwb2ludCBpcyBpbiB0cmlhbmdsZVxuICAgIHJldHVybiAodSA+PSAwKSAmJiAodiA+PSAwKSAmJiAodSArIHYgPCAxKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYSBzaGFwZSBpcyBjb252ZXhcbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBjb252ZXgoYXgsIGF5LCBieCwgYnksIGN4LCBjeSwgc2lnbilcbntcbiAgICByZXR1cm4gKChheS1ieSkqKGN4LWJ4KSArIChieC1heCkqKGN5LWJ5KSA+PSAwKSA9PT0gc2lnbjtcbn1cblxuLyoqXG4gKiBUcmlhbmd1bGF0ZXMgc2hhcGVzIGZvciB3ZWJHTCBncmFwaGljIGZpbGxzXG4gKlxuICogQG5hbWVzcGFjZSBQb2x5S1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmV4cG9ydHMudHJpYW5ndWxhdGUgPSBmdW5jdGlvbihwKVxue1xuICAgIHZhciBzaWduID0gdHJ1ZTtcblxuICAgIHZhciBuID0gcC5sZW5ndGggPj4gMTtcbiAgICBpZihuIDwgMykgcmV0dXJuIFtdO1xuXG4gICAgdmFyIHRncyA9IFtdO1xuICAgIHZhciBhdmwgPSBbXTtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgbjsgaSsrKSBhdmwucHVzaChpKTtcblxuICAgIGkgPSAwO1xuICAgIHZhciBhbCA9IG47XG4gICAgd2hpbGUoYWwgPiAzKVxuICAgIHtcbiAgICAgICAgdmFyIGkwID0gYXZsWyhpKzApJWFsXTtcbiAgICAgICAgdmFyIGkxID0gYXZsWyhpKzEpJWFsXTtcbiAgICAgICAgdmFyIGkyID0gYXZsWyhpKzIpJWFsXTtcblxuICAgICAgICB2YXIgYXggPSBwWzIqaTBdLCAgYXkgPSBwWzIqaTArMV07XG4gICAgICAgIHZhciBieCA9IHBbMippMV0sICBieSA9IHBbMippMSsxXTtcbiAgICAgICAgdmFyIGN4ID0gcFsyKmkyXSwgIGN5ID0gcFsyKmkyKzFdO1xuXG4gICAgICAgIHZhciBlYXJGb3VuZCA9IGZhbHNlO1xuICAgICAgICBpZihjb252ZXgoYXgsIGF5LCBieCwgYnksIGN4LCBjeSwgc2lnbikpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGVhckZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIGZvcih2YXIgaiA9IDA7IGogPCBhbDsgaisrKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHZhciB2aSA9IGF2bFtqXTtcbiAgICAgICAgICAgICAgICBpZih2aSA9PT0gaTAgfHwgdmkgPT09IGkxIHx8IHZpID09PSBpMikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZihwb2ludEluVHJpYW5nbGUocFsyKnZpXSwgcFsyKnZpKzFdLCBheCwgYXksIGJ4LCBieSwgY3gsIGN5KSkge1xuICAgICAgICAgICAgICAgICAgICBlYXJGb3VuZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZihlYXJGb3VuZClcbiAgICAgICAge1xuICAgICAgICAgICAgdGdzLnB1c2goaTAsIGkxLCBpMik7XG4gICAgICAgICAgICBhdmwuc3BsaWNlKChpKzEpJWFsLCAxKTtcbiAgICAgICAgICAgIGFsLS07XG4gICAgICAgICAgICBpID0gMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKGkrKyA+IDMqYWwpXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gZmxpcCBmbGlwIHJldmVyc2UgaXQhXG4gICAgICAgICAgICAvLyByZXNldCFcbiAgICAgICAgICAgIGlmKHNpZ24pXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGdzID0gW107XG4gICAgICAgICAgICAgICAgYXZsID0gW107XG4gICAgICAgICAgICAgICAgZm9yKGkgPSAwOyBpIDwgbjsgaSsrKSBhdmwucHVzaChpKTtcblxuICAgICAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICAgICAgICAgIGFsID0gbjtcblxuICAgICAgICAgICAgICAgIHNpZ24gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybS5jb25zb2xlLndhcm4oJ1BJWEkgV2FybmluZzogc2hhcGUgdG9vIGNvbXBsZXggdG8gZmlsbCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRncy5wdXNoKGF2bFswXSwgYXZsWzFdLCBhdmxbMl0pO1xuICAgIHJldHVybiB0Z3M7XG59O1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcGxhdGZvcm0gPSByZXF1aXJlKCcuLi9wbGF0Zm9ybScpO1xudmFyIENhbnZhc1JlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXJzL2NhbnZhcy9DYW52YXNSZW5kZXJlcicpO1xudmFyIFdlYkdMUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xSZW5kZXJlcicpO1xuXG4vKipcbiAqIFRoaXMgaGVscGVyIGZ1bmN0aW9uIHdpbGwgYXV0b21hdGljYWxseSBkZXRlY3Qgd2hpY2ggcmVuZGVyZXIgeW91IHNob3VsZCBiZSB1c2luZy5cbiAqIFdlYkdMIGlzIHRoZSBwcmVmZXJyZWQgcmVuZGVyZXIgYXMgaXQgaXMgYSBsb3QgZmFzdGVzdC4gSWYgd2ViR0wgaXMgbm90IHN1cHBvcnRlZCBieVxuICogdGhlIGJyb3dzZXIgdGhlbiB0aGlzIGZ1bmN0aW9uIHdpbGwgcmV0dXJuIGEgY2FudmFzIHJlbmRlcmVyXG4gKlxuICogQG1ldGhvZCBhdXRvRGV0ZWN0UmVuZGVyZXJcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB3aWR0aCB7TnVtYmVyfSB0aGUgd2lkdGggb2YgdGhlIHJlbmRlcmVycyB2aWV3XG4gKiBAcGFyYW0gaGVpZ2h0IHtOdW1iZXJ9IHRoZSBoZWlnaHQgb2YgdGhlIHJlbmRlcmVycyB2aWV3XG4gKiBAcGFyYW0gdmlldyB7Q2FudmFzfSB0aGUgY2FudmFzIHRvIHVzZSBhcyBhIHZpZXcsIG9wdGlvbmFsXG4gKiBAcGFyYW0gdHJhbnNwYXJlbnQ9ZmFsc2Uge0Jvb2xlYW59IHRoZSB0cmFuc3BhcmVuY3kgb2YgdGhlIHJlbmRlciB2aWV3LCBkZWZhdWx0IGZhbHNlXG4gKiBAcGFyYW0gYW50aWFsaWFzPWZhbHNlIHtCb29sZWFufSBzZXRzIGFudGlhbGlhcyAob25seSBhcHBsaWNhYmxlIGluIHdlYkdMIGNocm9tZSBhdCB0aGUgbW9tZW50KVxuICpcbiAqIGFudGlhbGlhc1xuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGF1dG9EZXRlY3RSZW5kZXJlcih3aWR0aCwgaGVpZ2h0LCB2aWV3LCB0cmFuc3BhcmVudCwgYW50aWFsaWFzKVxue1xuICAgIGlmKCF3aWR0aCl3aWR0aCA9IDgwMDtcbiAgICBpZighaGVpZ2h0KWhlaWdodCA9IDYwMDtcblxuICAgIC8vIEJPUlJPV0VEIGZyb20gTXIgRG9vYiAobXJkb29iLmNvbSlcbiAgICB2YXIgd2ViZ2wgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGNhbnZhcyA9IHBsYXRmb3JtLmNyZWF0ZUNhbnZhcygpO1xuICAgICAgICAgICAgcmV0dXJuICEhIHBsYXRmb3JtLndpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQgJiYgKGNhbnZhcy5nZXRDb250ZXh0KCd3ZWJnbCcpIHx8IGNhbnZhcy5nZXRDb250ZXh0KCdleHBlcmltZW50YWwtd2ViZ2wnKSk7XG4gICAgICAgIH0gY2F0Y2goIGUgKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9KCkpO1xuXG4gICAgaWYod2ViZ2wgJiYgcGxhdGZvcm0ubmF2aWdhdG9yKVxuICAgIHtcbiAgICAgICAgdmFyIGllID0gIChwbGF0Zm9ybS5uYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZigndHJpZGVudCcpICE9PSAtMSk7XG4gICAgICAgIHdlYmdsID0gIWllO1xuICAgIH1cblxuICAgIC8vY29uc29sZS5sb2cod2ViZ2wpO1xuICAgIGlmKCB3ZWJnbCApXG4gICAge1xuICAgICAgICByZXR1cm4gbmV3IFdlYkdMUmVuZGVyZXIod2lkdGgsIGhlaWdodCwgdmlldywgdHJhbnNwYXJlbnQsIGFudGlhbGlhcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBDYW52YXNSZW5kZXJlcih3aWR0aCwgaGVpZ2h0LCB2aWV3LCB0cmFuc3BhcmVudCk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENvbnZlcnRzIGEgaGV4IGNvbG9yIG51bWJlciB0byBhbiBbUiwgRywgQl0gYXJyYXlcbiAqXG4gKiBAcGFyYW0gaGV4IHtOdW1iZXJ9XG4gKi9cbmV4cG9ydHMuaGV4MnJnYiA9IGZ1bmN0aW9uIGhleDJyZ2IoaGV4KVxue1xuICAgIHJldHVybiBbKGhleCA+PiAxNiAmIDB4RkYpIC8gMjU1LCAoIGhleCA+PiA4ICYgMHhGRikgLyAyNTUsIChoZXggJiAweEZGKS8gMjU1XTtcbn07XG4iLCJ2YXIgZ2xvYmFsPXR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fTsvLyBodHRwOi8vcGF1bGlyaXNoLmNvbS8yMDExL3JlcXVlc3RhbmltYXRpb25mcmFtZS1mb3Itc21hcnQtYW5pbWF0aW5nL1xuLy8gaHR0cDovL215Lm9wZXJhLmNvbS9lbW9sbGVyL2Jsb2cvMjAxMS8xMi8yMC9yZXF1ZXN0YW5pbWF0aW9uZnJhbWUtZm9yLXNtYXJ0LWVyLWFuaW1hdGluZ1xuXG4vLyByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgcG9seWZpbGwgYnkgRXJpayBNw7ZsbGVyLiBmaXhlcyBmcm9tIFBhdWwgSXJpc2ggYW5kIFRpbm8gWmlqZGVsXG5cbi8vIE1JVCBsaWNlbnNlXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLyoqXG4gICAgICogQSBwb2x5ZmlsbCBmb3IgcmVxdWVzdEFuaW1hdGlvbkZyYW1lXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIHJlcXVlc3RBbmltYXRpb25GcmFtZVxuICAgICAqL1xuICAgIC8qKlxuICAgICAqIEEgcG9seWZpbGwgZm9yIGNhbmNlbEFuaW1hdGlvbkZyYW1lXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGNhbmNlbEFuaW1hdGlvbkZyYW1lXG4gICAgICovXG4gICAgdmFyIGxhc3RUaW1lID0gMDtcbiAgICB2YXIgdmVuZG9ycyA9IFsnbXMnLCAnbW96JywgJ3dlYmtpdCcsICdvJ107XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHZlbmRvcnMubGVuZ3RoICYmICFnbG9iYWwucmVxdWVzdEFuaW1hdGlvbkZyYW1lOyArK2kpIHtcbiAgICAgICAgZ2xvYmFsLnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGdsb2JhbFt2ZW5kb3JzW2ldICsgJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuICAgICAgICBnbG9iYWwuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBnbG9iYWxbdmVuZG9yc1tpXSArICdDYW5jZWxBbmltYXRpb25GcmFtZSddIHx8XG4gICAgICAgICAgICBnbG9iYWxbdmVuZG9yc1tpXSArICdDYW5jZWxSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcbiAgICB9XG5cbiAgICBpZiAoIWdsb2JhbC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcbiAgICAgICAgZ2xvYmFsLnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB2YXIgY3VyclRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgICAgIHZhciB0aW1lVG9DYWxsID0gTWF0aC5tYXgoMCwgMTYgLSAoY3VyclRpbWUgLSBsYXN0VGltZSkpO1xuICAgICAgICAgICAgdmFyIGlkID0gZ2xvYmFsLnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGNhbGxiYWNrKGN1cnJUaW1lICsgdGltZVRvQ2FsbCk7IH0sIHRpbWVUb0NhbGwpO1xuICAgICAgICAgICAgbGFzdFRpbWUgPSBjdXJyVGltZSArIHRpbWVUb0NhbGw7XG4gICAgICAgICAgICByZXR1cm4gaWQ7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKCFnbG9iYWwuY2FuY2VsQW5pbWF0aW9uRnJhbWUpIHtcbiAgICAgICAgZ2xvYmFsLmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgICAgIGdsb2JhbC5jbGVhclRpbWVvdXQoaWQpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBnbG9iYWwucmVxdWVzdEFuaW1hdGlvbkZyYW1lO1xuXG59KCkpO1xuIiwiLyoqXG4gKiBAYXV0aG9yIE1hdCBHcm92ZXMgaHR0cDovL21hdGdyb3Zlcy5jb20vIEBEb29ybWF0MjNcbiAqIGJhc2VkIG9uIHBpeGkgaW1wYWN0IHNwaW5lIGltcGxlbWVudGF0aW9uIG1hZGUgYnkgRWVtZWxpIEtlbG9rb3JwaSAoQGVrZWxva29ycGkpIGh0dHBzOi8vZ2l0aHViLmNvbS9la2Vsb2tvcnBpXG4gKlxuICogQXdlc29tZSBKUyBydW4gdGltZSBwcm92aWRlZCBieSBFc290ZXJpY1NvZnR3YXJlXG4gKiBodHRwczovL2dpdGh1Yi5jb20vRXNvdGVyaWNTb2Z0d2FyZS9zcGluZS1ydW50aW1lc1xuICpcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG4vKlxuICogQXdlc29tZSBKUyBydW4gdGltZSBwcm92aWRlZCBieSBFc290ZXJpY1NvZnR3YXJlXG4gKlxuICogaHR0cHM6Ly9naXRodWIuY29tL0Vzb3RlcmljU29mdHdhcmUvc3BpbmUtcnVudGltZXNcbiAqXG4gKi9cblxudmFyIHNwaW5lID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuc3BpbmUuQm9uZURhdGEgPSBmdW5jdGlvbiAobmFtZSwgcGFyZW50KSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbn07XG5zcGluZS5Cb25lRGF0YS5wcm90b3R5cGUgPSB7XG4gICAgbGVuZ3RoOiAwLFxuICAgIHg6IDAsIHk6IDAsXG4gICAgcm90YXRpb246IDAsXG4gICAgc2NhbGVYOiAxLCBzY2FsZVk6IDFcbn07XG5cbnNwaW5lLlNsb3REYXRhID0gZnVuY3Rpb24gKG5hbWUsIGJvbmVEYXRhKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmJvbmVEYXRhID0gYm9uZURhdGE7XG59O1xuc3BpbmUuU2xvdERhdGEucHJvdG90eXBlID0ge1xuICAgIHI6IDEsIGc6IDEsIGI6IDEsIGE6IDEsXG4gICAgYXR0YWNobWVudE5hbWU6IG51bGxcbn07XG5cbnNwaW5lLkJvbmUgPSBmdW5jdGlvbiAoYm9uZURhdGEsIHBhcmVudCkge1xuICAgIHRoaXMuZGF0YSA9IGJvbmVEYXRhO1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgIHRoaXMuc2V0VG9TZXR1cFBvc2UoKTtcbn07XG5zcGluZS5Cb25lLnlEb3duID0gZmFsc2U7XG5zcGluZS5Cb25lLnByb3RvdHlwZSA9IHtcbiAgICB4OiAwLCB5OiAwLFxuICAgIHJvdGF0aW9uOiAwLFxuICAgIHNjYWxlWDogMSwgc2NhbGVZOiAxLFxuICAgIG0wMDogMCwgbTAxOiAwLCB3b3JsZFg6IDAsIC8vIGEgYiB4XG4gICAgbTEwOiAwLCBtMTE6IDAsIHdvcmxkWTogMCwgLy8gYyBkIHlcbiAgICB3b3JsZFJvdGF0aW9uOiAwLFxuICAgIHdvcmxkU2NhbGVYOiAxLCB3b3JsZFNjYWxlWTogMSxcbiAgICB1cGRhdGVXb3JsZFRyYW5zZm9ybTogZnVuY3Rpb24gKGZsaXBYLCBmbGlwWSkge1xuICAgICAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQ7XG4gICAgICAgIGlmIChwYXJlbnQgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy53b3JsZFggPSB0aGlzLnggKiBwYXJlbnQubTAwICsgdGhpcy55ICogcGFyZW50Lm0wMSArIHBhcmVudC53b3JsZFg7XG4gICAgICAgICAgICB0aGlzLndvcmxkWSA9IHRoaXMueCAqIHBhcmVudC5tMTAgKyB0aGlzLnkgKiBwYXJlbnQubTExICsgcGFyZW50LndvcmxkWTtcbiAgICAgICAgICAgIHRoaXMud29ybGRTY2FsZVggPSBwYXJlbnQud29ybGRTY2FsZVggKiB0aGlzLnNjYWxlWDtcbiAgICAgICAgICAgIHRoaXMud29ybGRTY2FsZVkgPSBwYXJlbnQud29ybGRTY2FsZVkgKiB0aGlzLnNjYWxlWTtcbiAgICAgICAgICAgIHRoaXMud29ybGRSb3RhdGlvbiA9IHBhcmVudC53b3JsZFJvdGF0aW9uICsgdGhpcy5yb3RhdGlvbjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMud29ybGRYID0gdGhpcy54O1xuICAgICAgICAgICAgdGhpcy53b3JsZFkgPSB0aGlzLnk7XG4gICAgICAgICAgICB0aGlzLndvcmxkU2NhbGVYID0gdGhpcy5zY2FsZVg7XG4gICAgICAgICAgICB0aGlzLndvcmxkU2NhbGVZID0gdGhpcy5zY2FsZVk7XG4gICAgICAgICAgICB0aGlzLndvcmxkUm90YXRpb24gPSB0aGlzLnJvdGF0aW9uO1xuICAgICAgICB9XG4gICAgICAgIHZhciByYWRpYW5zID0gdGhpcy53b3JsZFJvdGF0aW9uICogTWF0aC5QSSAvIDE4MDtcbiAgICAgICAgdmFyIGNvcyA9IE1hdGguY29zKHJhZGlhbnMpO1xuICAgICAgICB2YXIgc2luID0gTWF0aC5zaW4ocmFkaWFucyk7XG4gICAgICAgIHRoaXMubTAwID0gY29zICogdGhpcy53b3JsZFNjYWxlWDtcbiAgICAgICAgdGhpcy5tMTAgPSBzaW4gKiB0aGlzLndvcmxkU2NhbGVYO1xuICAgICAgICB0aGlzLm0wMSA9IC1zaW4gKiB0aGlzLndvcmxkU2NhbGVZO1xuICAgICAgICB0aGlzLm0xMSA9IGNvcyAqIHRoaXMud29ybGRTY2FsZVk7XG4gICAgICAgIGlmIChmbGlwWCkge1xuICAgICAgICAgICAgdGhpcy5tMDAgPSAtdGhpcy5tMDA7XG4gICAgICAgICAgICB0aGlzLm0wMSA9IC10aGlzLm0wMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxpcFkpIHtcbiAgICAgICAgICAgIHRoaXMubTEwID0gLXRoaXMubTEwO1xuICAgICAgICAgICAgdGhpcy5tMTEgPSAtdGhpcy5tMTE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNwaW5lLkJvbmUueURvd24pIHtcbiAgICAgICAgICAgIHRoaXMubTEwID0gLXRoaXMubTEwO1xuICAgICAgICAgICAgdGhpcy5tMTEgPSAtdGhpcy5tMTE7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNldFRvU2V0dXBQb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkYXRhID0gdGhpcy5kYXRhO1xuICAgICAgICB0aGlzLnggPSBkYXRhLng7XG4gICAgICAgIHRoaXMueSA9IGRhdGEueTtcbiAgICAgICAgdGhpcy5yb3RhdGlvbiA9IGRhdGEucm90YXRpb247XG4gICAgICAgIHRoaXMuc2NhbGVYID0gZGF0YS5zY2FsZVg7XG4gICAgICAgIHRoaXMuc2NhbGVZID0gZGF0YS5zY2FsZVk7XG4gICAgfVxufTtcblxuc3BpbmUuU2xvdCA9IGZ1bmN0aW9uIChzbG90RGF0YSwgc2tlbGV0b24sIGJvbmUpIHtcbiAgICB0aGlzLmRhdGEgPSBzbG90RGF0YTtcbiAgICB0aGlzLnNrZWxldG9uID0gc2tlbGV0b247XG4gICAgdGhpcy5ib25lID0gYm9uZTtcbiAgICB0aGlzLnNldFRvU2V0dXBQb3NlKCk7XG59O1xuc3BpbmUuU2xvdC5wcm90b3R5cGUgPSB7XG4gICAgcjogMSwgZzogMSwgYjogMSwgYTogMSxcbiAgICBfYXR0YWNobWVudFRpbWU6IDAsXG4gICAgYXR0YWNobWVudDogbnVsbCxcbiAgICBzZXRBdHRhY2htZW50OiBmdW5jdGlvbiAoYXR0YWNobWVudCkge1xuICAgICAgICB0aGlzLmF0dGFjaG1lbnQgPSBhdHRhY2htZW50O1xuICAgICAgICB0aGlzLl9hdHRhY2htZW50VGltZSA9IHRoaXMuc2tlbGV0b24udGltZTtcbiAgICB9LFxuICAgIHNldEF0dGFjaG1lbnRUaW1lOiBmdW5jdGlvbiAodGltZSkge1xuICAgICAgICB0aGlzLl9hdHRhY2htZW50VGltZSA9IHRoaXMuc2tlbGV0b24udGltZSAtIHRpbWU7XG4gICAgfSxcbiAgICBnZXRBdHRhY2htZW50VGltZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5za2VsZXRvbi50aW1lIC0gdGhpcy5fYXR0YWNobWVudFRpbWU7XG4gICAgfSxcbiAgICBzZXRUb1NldHVwUG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICAgICAgdGhpcy5yID0gZGF0YS5yO1xuICAgICAgICB0aGlzLmcgPSBkYXRhLmc7XG4gICAgICAgIHRoaXMuYiA9IGRhdGEuYjtcbiAgICAgICAgdGhpcy5hID0gZGF0YS5hO1xuXG4gICAgICAgIHZhciBzbG90RGF0YXMgPSB0aGlzLnNrZWxldG9uLmRhdGEuc2xvdHM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2xvdERhdGFzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgaWYgKHNsb3REYXRhc1tpXSA9PSBkYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRBdHRhY2htZW50KCFkYXRhLmF0dGFjaG1lbnROYW1lID8gbnVsbCA6IHRoaXMuc2tlbGV0b24uZ2V0QXR0YWNobWVudEJ5U2xvdEluZGV4KGksIGRhdGEuYXR0YWNobWVudE5hbWUpKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnNwaW5lLlNraW4gPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5hdHRhY2htZW50cyA9IHt9O1xufTtcbnNwaW5lLlNraW4ucHJvdG90eXBlID0ge1xuICAgIGFkZEF0dGFjaG1lbnQ6IGZ1bmN0aW9uIChzbG90SW5kZXgsIG5hbWUsIGF0dGFjaG1lbnQpIHtcbiAgICAgICAgdGhpcy5hdHRhY2htZW50c1tzbG90SW5kZXggKyBcIjpcIiArIG5hbWVdID0gYXR0YWNobWVudDtcbiAgICB9LFxuICAgIGdldEF0dGFjaG1lbnQ6IGZ1bmN0aW9uIChzbG90SW5kZXgsIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNobWVudHNbc2xvdEluZGV4ICsgXCI6XCIgKyBuYW1lXTtcbiAgICB9LFxuICAgIF9hdHRhY2hBbGw6IGZ1bmN0aW9uIChza2VsZXRvbiwgb2xkU2tpbikge1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gb2xkU2tpbi5hdHRhY2htZW50cykge1xuICAgICAgICAgICAgdmFyIGNvbG9uID0ga2V5LmluZGV4T2YoXCI6XCIpO1xuICAgICAgICAgICAgdmFyIHNsb3RJbmRleCA9IHBhcnNlSW50KGtleS5zdWJzdHJpbmcoMCwgY29sb24pLCAxMCk7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IGtleS5zdWJzdHJpbmcoY29sb24gKyAxKTtcbiAgICAgICAgICAgIHZhciBzbG90ID0gc2tlbGV0b24uc2xvdHNbc2xvdEluZGV4XTtcbiAgICAgICAgICAgIGlmIChzbG90LmF0dGFjaG1lbnQgJiYgc2xvdC5hdHRhY2htZW50Lm5hbWUgPT0gbmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBhdHRhY2htZW50ID0gdGhpcy5nZXRBdHRhY2htZW50KHNsb3RJbmRleCwgbmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKGF0dGFjaG1lbnQpIHNsb3Quc2V0QXR0YWNobWVudChhdHRhY2htZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnNwaW5lLkFuaW1hdGlvbiA9IGZ1bmN0aW9uIChuYW1lLCB0aW1lbGluZXMsIGR1cmF0aW9uKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnRpbWVsaW5lcyA9IHRpbWVsaW5lcztcbiAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG59O1xuc3BpbmUuQW5pbWF0aW9uLnByb3RvdHlwZSA9IHtcbiAgICBhcHBseTogZnVuY3Rpb24gKHNrZWxldG9uLCB0aW1lLCBsb29wKSB7XG4gICAgICAgIGlmIChsb29wICYmIHRoaXMuZHVyYXRpb24pIHRpbWUgJT0gdGhpcy5kdXJhdGlvbjtcbiAgICAgICAgdmFyIHRpbWVsaW5lcyA9IHRoaXMudGltZWxpbmVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHRpbWVsaW5lcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICB0aW1lbGluZXNbaV0uYXBwbHkoc2tlbGV0b24sIHRpbWUsIDEpO1xuICAgIH0sXG4gICAgbWl4OiBmdW5jdGlvbiAoc2tlbGV0b24sIHRpbWUsIGxvb3AsIGFscGhhKSB7XG4gICAgICAgIGlmIChsb29wICYmIHRoaXMuZHVyYXRpb24pIHRpbWUgJT0gdGhpcy5kdXJhdGlvbjtcbiAgICAgICAgdmFyIHRpbWVsaW5lcyA9IHRoaXMudGltZWxpbmVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHRpbWVsaW5lcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICB0aW1lbGluZXNbaV0uYXBwbHkoc2tlbGV0b24sIHRpbWUsIGFscGhhKTtcbiAgICB9XG59O1xuXG5zcGluZS5iaW5hcnlTZWFyY2ggPSBmdW5jdGlvbiAodmFsdWVzLCB0YXJnZXQsIHN0ZXApIHtcbiAgICB2YXIgbG93ID0gMDtcbiAgICB2YXIgaGlnaCA9IE1hdGguZmxvb3IodmFsdWVzLmxlbmd0aCAvIHN0ZXApIC0gMjtcbiAgICBpZiAoIWhpZ2gpIHJldHVybiBzdGVwO1xuICAgIHZhciBjdXJyZW50ID0gaGlnaCA+Pj4gMTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBpZiAodmFsdWVzWyhjdXJyZW50ICsgMSkgKiBzdGVwXSA8PSB0YXJnZXQpXG4gICAgICAgICAgICBsb3cgPSBjdXJyZW50ICsgMTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgaGlnaCA9IGN1cnJlbnQ7XG4gICAgICAgIGlmIChsb3cgPT0gaGlnaCkgcmV0dXJuIChsb3cgKyAxKSAqIHN0ZXA7XG4gICAgICAgIGN1cnJlbnQgPSAobG93ICsgaGlnaCkgPj4+IDE7XG4gICAgfVxufTtcbnNwaW5lLmxpbmVhclNlYXJjaCA9IGZ1bmN0aW9uICh2YWx1ZXMsIHRhcmdldCwgc3RlcCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsYXN0ID0gdmFsdWVzLmxlbmd0aCAtIHN0ZXA7IGkgPD0gbGFzdDsgaSArPSBzdGVwKVxuICAgICAgICBpZiAodmFsdWVzW2ldID4gdGFyZ2V0KSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG59O1xuXG5zcGluZS5DdXJ2ZXMgPSBmdW5jdGlvbiAoZnJhbWVDb3VudCkge1xuICAgIHRoaXMuY3VydmVzID0gW107IC8vIGRmeCwgZGZ5LCBkZGZ4LCBkZGZ5LCBkZGRmeCwgZGRkZnksIC4uLlxuICAgIHRoaXMuY3VydmVzLmxlbmd0aCA9IChmcmFtZUNvdW50IC0gMSkgKiA2O1xufTtcbnNwaW5lLkN1cnZlcy5wcm90b3R5cGUgPSB7XG4gICAgc2V0TGluZWFyOiBmdW5jdGlvbiAoZnJhbWVJbmRleCkge1xuICAgICAgICB0aGlzLmN1cnZlc1tmcmFtZUluZGV4ICogNl0gPSAwLypMSU5FQVIqLztcbiAgICB9LFxuICAgIHNldFN0ZXBwZWQ6IGZ1bmN0aW9uIChmcmFtZUluZGV4KSB7XG4gICAgICAgIHRoaXMuY3VydmVzW2ZyYW1lSW5kZXggKiA2XSA9IC0xLypTVEVQUEVEKi87XG4gICAgfSxcbiAgICAvKiogU2V0cyB0aGUgY29udHJvbCBoYW5kbGUgcG9zaXRpb25zIGZvciBhbiBpbnRlcnBvbGF0aW9uIGJlemllciBjdXJ2ZSB1c2VkIHRvIHRyYW5zaXRpb24gZnJvbSB0aGlzIGtleWZyYW1lIHRvIHRoZSBuZXh0LlxuICAgICAqIGN4MSBhbmQgY3gyIGFyZSBmcm9tIDAgdG8gMSwgcmVwcmVzZW50aW5nIHRoZSBwZXJjZW50IG9mIHRpbWUgYmV0d2VlbiB0aGUgdHdvIGtleWZyYW1lcy4gY3kxIGFuZCBjeTIgYXJlIHRoZSBwZXJjZW50IG9mXG4gICAgICogdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUga2V5ZnJhbWUncyB2YWx1ZXMuICovXG4gICAgc2V0Q3VydmU6IGZ1bmN0aW9uIChmcmFtZUluZGV4LCBjeDEsIGN5MSwgY3gyLCBjeTIpIHtcbiAgICAgICAgdmFyIHN1YmRpdl9zdGVwID0gMSAvIDEwLypCRVpJRVJfU0VHTUVOVFMqLztcbiAgICAgICAgdmFyIHN1YmRpdl9zdGVwMiA9IHN1YmRpdl9zdGVwICogc3ViZGl2X3N0ZXA7XG4gICAgICAgIHZhciBzdWJkaXZfc3RlcDMgPSBzdWJkaXZfc3RlcDIgKiBzdWJkaXZfc3RlcDtcbiAgICAgICAgdmFyIHByZTEgPSAzICogc3ViZGl2X3N0ZXA7XG4gICAgICAgIHZhciBwcmUyID0gMyAqIHN1YmRpdl9zdGVwMjtcbiAgICAgICAgdmFyIHByZTQgPSA2ICogc3ViZGl2X3N0ZXAyO1xuICAgICAgICB2YXIgcHJlNSA9IDYgKiBzdWJkaXZfc3RlcDM7XG4gICAgICAgIHZhciB0bXAxeCA9IC1jeDEgKiAyICsgY3gyO1xuICAgICAgICB2YXIgdG1wMXkgPSAtY3kxICogMiArIGN5MjtcbiAgICAgICAgdmFyIHRtcDJ4ID0gKGN4MSAtIGN4MikgKiAzICsgMTtcbiAgICAgICAgdmFyIHRtcDJ5ID0gKGN5MSAtIGN5MikgKiAzICsgMTtcbiAgICAgICAgdmFyIGkgPSBmcmFtZUluZGV4ICogNjtcbiAgICAgICAgdmFyIGN1cnZlcyA9IHRoaXMuY3VydmVzO1xuICAgICAgICBjdXJ2ZXNbaV0gPSBjeDEgKiBwcmUxICsgdG1wMXggKiBwcmUyICsgdG1wMnggKiBzdWJkaXZfc3RlcDM7XG4gICAgICAgIGN1cnZlc1tpICsgMV0gPSBjeTEgKiBwcmUxICsgdG1wMXkgKiBwcmUyICsgdG1wMnkgKiBzdWJkaXZfc3RlcDM7XG4gICAgICAgIGN1cnZlc1tpICsgMl0gPSB0bXAxeCAqIHByZTQgKyB0bXAyeCAqIHByZTU7XG4gICAgICAgIGN1cnZlc1tpICsgM10gPSB0bXAxeSAqIHByZTQgKyB0bXAyeSAqIHByZTU7XG4gICAgICAgIGN1cnZlc1tpICsgNF0gPSB0bXAyeCAqIHByZTU7XG4gICAgICAgIGN1cnZlc1tpICsgNV0gPSB0bXAyeSAqIHByZTU7XG4gICAgfSxcbiAgICBnZXRDdXJ2ZVBlcmNlbnQ6IGZ1bmN0aW9uIChmcmFtZUluZGV4LCBwZXJjZW50KSB7XG4gICAgICAgIHBlcmNlbnQgPSBwZXJjZW50IDwgMCA/IDAgOiAocGVyY2VudCA+IDEgPyAxIDogcGVyY2VudCk7XG4gICAgICAgIHZhciBjdXJ2ZUluZGV4ID0gZnJhbWVJbmRleCAqIDY7XG4gICAgICAgIHZhciBjdXJ2ZXMgPSB0aGlzLmN1cnZlcztcbiAgICAgICAgdmFyIGRmeCA9IGN1cnZlc1tjdXJ2ZUluZGV4XTtcbiAgICAgICAgaWYgKCFkZngvKkxJTkVBUiovKSByZXR1cm4gcGVyY2VudDtcbiAgICAgICAgaWYgKGRmeCA9PSAtMS8qU1RFUFBFRCovKSByZXR1cm4gMDtcbiAgICAgICAgdmFyIGRmeSA9IGN1cnZlc1tjdXJ2ZUluZGV4ICsgMV07XG4gICAgICAgIHZhciBkZGZ4ID0gY3VydmVzW2N1cnZlSW5kZXggKyAyXTtcbiAgICAgICAgdmFyIGRkZnkgPSBjdXJ2ZXNbY3VydmVJbmRleCArIDNdO1xuICAgICAgICB2YXIgZGRkZnggPSBjdXJ2ZXNbY3VydmVJbmRleCArIDRdO1xuICAgICAgICB2YXIgZGRkZnkgPSBjdXJ2ZXNbY3VydmVJbmRleCArIDVdO1xuICAgICAgICB2YXIgeCA9IGRmeCwgeSA9IGRmeTtcbiAgICAgICAgdmFyIGkgPSAxMC8qQkVaSUVSX1NFR01FTlRTKi8gLSAyO1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgaWYgKHggPj0gcGVyY2VudCkge1xuICAgICAgICAgICAgICAgIHZhciBsYXN0WCA9IHggLSBkZng7XG4gICAgICAgICAgICAgICAgdmFyIGxhc3RZID0geSAtIGRmeTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbGFzdFkgKyAoeSAtIGxhc3RZKSAqIChwZXJjZW50IC0gbGFzdFgpIC8gKHggLSBsYXN0WCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWkpIGJyZWFrO1xuICAgICAgICAgICAgaS0tO1xuICAgICAgICAgICAgZGZ4ICs9IGRkZng7XG4gICAgICAgICAgICBkZnkgKz0gZGRmeTtcbiAgICAgICAgICAgIGRkZnggKz0gZGRkZng7XG4gICAgICAgICAgICBkZGZ5ICs9IGRkZGZ5O1xuICAgICAgICAgICAgeCArPSBkZng7XG4gICAgICAgICAgICB5ICs9IGRmeTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geSArICgxIC0geSkgKiAocGVyY2VudCAtIHgpIC8gKDEgLSB4KTsgLy8gTGFzdCBwb2ludCBpcyAxLDEuXG4gICAgfVxufTtcblxuc3BpbmUuUm90YXRlVGltZWxpbmUgPSBmdW5jdGlvbiAoZnJhbWVDb3VudCkge1xuICAgIHRoaXMuY3VydmVzID0gbmV3IHNwaW5lLkN1cnZlcyhmcmFtZUNvdW50KTtcbiAgICB0aGlzLmZyYW1lcyA9IFtdOyAvLyB0aW1lLCBhbmdsZSwgLi4uXG4gICAgdGhpcy5mcmFtZXMubGVuZ3RoID0gZnJhbWVDb3VudCAqIDI7XG59O1xuc3BpbmUuUm90YXRlVGltZWxpbmUucHJvdG90eXBlID0ge1xuICAgIGJvbmVJbmRleDogMCxcbiAgICBnZXRGcmFtZUNvdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZyYW1lcy5sZW5ndGggLyAyO1xuICAgIH0sXG4gICAgc2V0RnJhbWU6IGZ1bmN0aW9uIChmcmFtZUluZGV4LCB0aW1lLCBhbmdsZSkge1xuICAgICAgICBmcmFtZUluZGV4ICo9IDI7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXhdID0gdGltZTtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDFdID0gYW5nbGU7XG4gICAgfSxcbiAgICBhcHBseTogZnVuY3Rpb24gKHNrZWxldG9uLCB0aW1lLCBhbHBoYSkge1xuICAgICAgICB2YXIgZnJhbWVzID0gdGhpcy5mcmFtZXMsXG4gICAgICAgICAgICBhbW91bnQ7XG5cbiAgICAgICAgaWYgKHRpbWUgPCBmcmFtZXNbMF0pIHJldHVybjsgLy8gVGltZSBpcyBiZWZvcmUgZmlyc3QgZnJhbWUuXG5cbiAgICAgICAgdmFyIGJvbmUgPSBza2VsZXRvbi5ib25lc1t0aGlzLmJvbmVJbmRleF07XG5cbiAgICAgICAgaWYgKHRpbWUgPj0gZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAyXSkgeyAvLyBUaW1lIGlzIGFmdGVyIGxhc3QgZnJhbWUuXG4gICAgICAgICAgICBhbW91bnQgPSBib25lLmRhdGEucm90YXRpb24gKyBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDFdIC0gYm9uZS5yb3RhdGlvbjtcbiAgICAgICAgICAgIHdoaWxlIChhbW91bnQgPiAxODApXG4gICAgICAgICAgICAgICAgYW1vdW50IC09IDM2MDtcbiAgICAgICAgICAgIHdoaWxlIChhbW91bnQgPCAtMTgwKVxuICAgICAgICAgICAgICAgIGFtb3VudCArPSAzNjA7XG4gICAgICAgICAgICBib25lLnJvdGF0aW9uICs9IGFtb3VudCAqIGFscGhhO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW50ZXJwb2xhdGUgYmV0d2VlbiB0aGUgbGFzdCBmcmFtZSBhbmQgdGhlIGN1cnJlbnQgZnJhbWUuXG4gICAgICAgIHZhciBmcmFtZUluZGV4ID0gc3BpbmUuYmluYXJ5U2VhcmNoKGZyYW1lcywgdGltZSwgMik7XG4gICAgICAgIHZhciBsYXN0RnJhbWVWYWx1ZSA9IGZyYW1lc1tmcmFtZUluZGV4IC0gMV07XG4gICAgICAgIHZhciBmcmFtZVRpbWUgPSBmcmFtZXNbZnJhbWVJbmRleF07XG4gICAgICAgIHZhciBwZXJjZW50ID0gMSAtICh0aW1lIC0gZnJhbWVUaW1lKSAvIChmcmFtZXNbZnJhbWVJbmRleCAtIDIvKkxBU1RfRlJBTUVfVElNRSovXSAtIGZyYW1lVGltZSk7XG4gICAgICAgIHBlcmNlbnQgPSB0aGlzLmN1cnZlcy5nZXRDdXJ2ZVBlcmNlbnQoZnJhbWVJbmRleCAvIDIgLSAxLCBwZXJjZW50KTtcblxuICAgICAgICBhbW91bnQgPSBmcmFtZXNbZnJhbWVJbmRleCArIDEvKkZSQU1FX1ZBTFVFKi9dIC0gbGFzdEZyYW1lVmFsdWU7XG4gICAgICAgIHdoaWxlIChhbW91bnQgPiAxODApXG4gICAgICAgICAgICBhbW91bnQgLT0gMzYwO1xuICAgICAgICB3aGlsZSAoYW1vdW50IDwgLTE4MClcbiAgICAgICAgICAgIGFtb3VudCArPSAzNjA7XG4gICAgICAgIGFtb3VudCA9IGJvbmUuZGF0YS5yb3RhdGlvbiArIChsYXN0RnJhbWVWYWx1ZSArIGFtb3VudCAqIHBlcmNlbnQpIC0gYm9uZS5yb3RhdGlvbjtcbiAgICAgICAgd2hpbGUgKGFtb3VudCA+IDE4MClcbiAgICAgICAgICAgIGFtb3VudCAtPSAzNjA7XG4gICAgICAgIHdoaWxlIChhbW91bnQgPCAtMTgwKVxuICAgICAgICAgICAgYW1vdW50ICs9IDM2MDtcbiAgICAgICAgYm9uZS5yb3RhdGlvbiArPSBhbW91bnQgKiBhbHBoYTtcbiAgICB9XG59O1xuXG5zcGluZS5UcmFuc2xhdGVUaW1lbGluZSA9IGZ1bmN0aW9uIChmcmFtZUNvdW50KSB7XG4gICAgdGhpcy5jdXJ2ZXMgPSBuZXcgc3BpbmUuQ3VydmVzKGZyYW1lQ291bnQpO1xuICAgIHRoaXMuZnJhbWVzID0gW107IC8vIHRpbWUsIHgsIHksIC4uLlxuICAgIHRoaXMuZnJhbWVzLmxlbmd0aCA9IGZyYW1lQ291bnQgKiAzO1xufTtcbnNwaW5lLlRyYW5zbGF0ZVRpbWVsaW5lLnByb3RvdHlwZSA9IHtcbiAgICBib25lSW5kZXg6IDAsXG4gICAgZ2V0RnJhbWVDb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcmFtZXMubGVuZ3RoIC8gMztcbiAgICB9LFxuICAgIHNldEZyYW1lOiBmdW5jdGlvbiAoZnJhbWVJbmRleCwgdGltZSwgeCwgeSkge1xuICAgICAgICBmcmFtZUluZGV4ICo9IDM7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXhdID0gdGltZTtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDFdID0geDtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDJdID0geTtcbiAgICB9LFxuICAgIGFwcGx5OiBmdW5jdGlvbiAoc2tlbGV0b24sIHRpbWUsIGFscGhhKSB7XG4gICAgICAgIHZhciBmcmFtZXMgPSB0aGlzLmZyYW1lcztcbiAgICAgICAgaWYgKHRpbWUgPCBmcmFtZXNbMF0pIHJldHVybjsgLy8gVGltZSBpcyBiZWZvcmUgZmlyc3QgZnJhbWUuXG5cbiAgICAgICAgdmFyIGJvbmUgPSBza2VsZXRvbi5ib25lc1t0aGlzLmJvbmVJbmRleF07XG5cbiAgICAgICAgaWYgKHRpbWUgPj0gZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAzXSkgeyAvLyBUaW1lIGlzIGFmdGVyIGxhc3QgZnJhbWUuXG4gICAgICAgICAgICBib25lLnggKz0gKGJvbmUuZGF0YS54ICsgZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAyXSAtIGJvbmUueCkgKiBhbHBoYTtcbiAgICAgICAgICAgIGJvbmUueSArPSAoYm9uZS5kYXRhLnkgKyBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDFdIC0gYm9uZS55KSAqIGFscGhhO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW50ZXJwb2xhdGUgYmV0d2VlbiB0aGUgbGFzdCBmcmFtZSBhbmQgdGhlIGN1cnJlbnQgZnJhbWUuXG4gICAgICAgIHZhciBmcmFtZUluZGV4ID0gc3BpbmUuYmluYXJ5U2VhcmNoKGZyYW1lcywgdGltZSwgMyk7XG4gICAgICAgIHZhciBsYXN0RnJhbWVYID0gZnJhbWVzW2ZyYW1lSW5kZXggLSAyXTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZVkgPSBmcmFtZXNbZnJhbWVJbmRleCAtIDFdO1xuICAgICAgICB2YXIgZnJhbWVUaW1lID0gZnJhbWVzW2ZyYW1lSW5kZXhdO1xuICAgICAgICB2YXIgcGVyY2VudCA9IDEgLSAodGltZSAtIGZyYW1lVGltZSkgLyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAtMy8qTEFTVF9GUkFNRV9USU1FKi9dIC0gZnJhbWVUaW1lKTtcbiAgICAgICAgcGVyY2VudCA9IHRoaXMuY3VydmVzLmdldEN1cnZlUGVyY2VudChmcmFtZUluZGV4IC8gMyAtIDEsIHBlcmNlbnQpO1xuXG4gICAgICAgIGJvbmUueCArPSAoYm9uZS5kYXRhLnggKyBsYXN0RnJhbWVYICsgKGZyYW1lc1tmcmFtZUluZGV4ICsgMS8qRlJBTUVfWCovXSAtIGxhc3RGcmFtZVgpICogcGVyY2VudCAtIGJvbmUueCkgKiBhbHBoYTtcbiAgICAgICAgYm9uZS55ICs9IChib25lLmRhdGEueSArIGxhc3RGcmFtZVkgKyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAyLypGUkFNRV9ZKi9dIC0gbGFzdEZyYW1lWSkgKiBwZXJjZW50IC0gYm9uZS55KSAqIGFscGhhO1xuICAgIH1cbn07XG5cbnNwaW5lLlNjYWxlVGltZWxpbmUgPSBmdW5jdGlvbiAoZnJhbWVDb3VudCkge1xuICAgIHRoaXMuY3VydmVzID0gbmV3IHNwaW5lLkN1cnZlcyhmcmFtZUNvdW50KTtcbiAgICB0aGlzLmZyYW1lcyA9IFtdOyAvLyB0aW1lLCB4LCB5LCAuLi5cbiAgICB0aGlzLmZyYW1lcy5sZW5ndGggPSBmcmFtZUNvdW50ICogMztcbn07XG5zcGluZS5TY2FsZVRpbWVsaW5lLnByb3RvdHlwZSA9IHtcbiAgICBib25lSW5kZXg6IDAsXG4gICAgZ2V0RnJhbWVDb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5mcmFtZXMubGVuZ3RoIC8gMztcbiAgICB9LFxuICAgIHNldEZyYW1lOiBmdW5jdGlvbiAoZnJhbWVJbmRleCwgdGltZSwgeCwgeSkge1xuICAgICAgICBmcmFtZUluZGV4ICo9IDM7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXhdID0gdGltZTtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDFdID0geDtcbiAgICAgICAgdGhpcy5mcmFtZXNbZnJhbWVJbmRleCArIDJdID0geTtcbiAgICB9LFxuICAgIGFwcGx5OiBmdW5jdGlvbiAoc2tlbGV0b24sIHRpbWUsIGFscGhhKSB7XG4gICAgICAgIHZhciBmcmFtZXMgPSB0aGlzLmZyYW1lcztcbiAgICAgICAgaWYgKHRpbWUgPCBmcmFtZXNbMF0pIHJldHVybjsgLy8gVGltZSBpcyBiZWZvcmUgZmlyc3QgZnJhbWUuXG5cbiAgICAgICAgdmFyIGJvbmUgPSBza2VsZXRvbi5ib25lc1t0aGlzLmJvbmVJbmRleF07XG5cbiAgICAgICAgaWYgKHRpbWUgPj0gZnJhbWVzW2ZyYW1lcy5sZW5ndGggLSAzXSkgeyAvLyBUaW1lIGlzIGFmdGVyIGxhc3QgZnJhbWUuXG4gICAgICAgICAgICBib25lLnNjYWxlWCArPSAoYm9uZS5kYXRhLnNjYWxlWCAtIDEgKyBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDJdIC0gYm9uZS5zY2FsZVgpICogYWxwaGE7XG4gICAgICAgICAgICBib25lLnNjYWxlWSArPSAoYm9uZS5kYXRhLnNjYWxlWSAtIDEgKyBmcmFtZXNbZnJhbWVzLmxlbmd0aCAtIDFdIC0gYm9uZS5zY2FsZVkpICogYWxwaGE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbnRlcnBvbGF0ZSBiZXR3ZWVuIHRoZSBsYXN0IGZyYW1lIGFuZCB0aGUgY3VycmVudCBmcmFtZS5cbiAgICAgICAgdmFyIGZyYW1lSW5kZXggPSBzcGluZS5iaW5hcnlTZWFyY2goZnJhbWVzLCB0aW1lLCAzKTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZVggPSBmcmFtZXNbZnJhbWVJbmRleCAtIDJdO1xuICAgICAgICB2YXIgbGFzdEZyYW1lWSA9IGZyYW1lc1tmcmFtZUluZGV4IC0gMV07XG4gICAgICAgIHZhciBmcmFtZVRpbWUgPSBmcmFtZXNbZnJhbWVJbmRleF07XG4gICAgICAgIHZhciBwZXJjZW50ID0gMSAtICh0aW1lIC0gZnJhbWVUaW1lKSAvIChmcmFtZXNbZnJhbWVJbmRleCArIC0zLypMQVNUX0ZSQU1FX1RJTUUqL10gLSBmcmFtZVRpbWUpO1xuICAgICAgICBwZXJjZW50ID0gdGhpcy5jdXJ2ZXMuZ2V0Q3VydmVQZXJjZW50KGZyYW1lSW5kZXggLyAzIC0gMSwgcGVyY2VudCk7XG5cbiAgICAgICAgYm9uZS5zY2FsZVggKz0gKGJvbmUuZGF0YS5zY2FsZVggLSAxICsgbGFzdEZyYW1lWCArIChmcmFtZXNbZnJhbWVJbmRleCArIDEvKkZSQU1FX1gqL10gLSBsYXN0RnJhbWVYKSAqIHBlcmNlbnQgLSBib25lLnNjYWxlWCkgKiBhbHBoYTtcbiAgICAgICAgYm9uZS5zY2FsZVkgKz0gKGJvbmUuZGF0YS5zY2FsZVkgLSAxICsgbGFzdEZyYW1lWSArIChmcmFtZXNbZnJhbWVJbmRleCArIDIvKkZSQU1FX1kqL10gLSBsYXN0RnJhbWVZKSAqIHBlcmNlbnQgLSBib25lLnNjYWxlWSkgKiBhbHBoYTtcbiAgICB9XG59O1xuXG5zcGluZS5Db2xvclRpbWVsaW5lID0gZnVuY3Rpb24gKGZyYW1lQ291bnQpIHtcbiAgICB0aGlzLmN1cnZlcyA9IG5ldyBzcGluZS5DdXJ2ZXMoZnJhbWVDb3VudCk7XG4gICAgdGhpcy5mcmFtZXMgPSBbXTsgLy8gdGltZSwgciwgZywgYiwgYSwgLi4uXG4gICAgdGhpcy5mcmFtZXMubGVuZ3RoID0gZnJhbWVDb3VudCAqIDU7XG59O1xuc3BpbmUuQ29sb3JUaW1lbGluZS5wcm90b3R5cGUgPSB7XG4gICAgc2xvdEluZGV4OiAwLFxuICAgIGdldEZyYW1lQ291bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZnJhbWVzLmxlbmd0aCAvIDI7XG4gICAgfSxcbiAgICBzZXRGcmFtZTogZnVuY3Rpb24gKGZyYW1lSW5kZXgsIHRpbWUsIHIsIGcsIGIsIGEpIHtcbiAgICAgICAgZnJhbWVJbmRleCAqPSA1O1xuICAgICAgICB0aGlzLmZyYW1lc1tmcmFtZUluZGV4XSA9IHRpbWU7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyAxXSA9IHI7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyAyXSA9IGc7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyAzXSA9IGI7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXggKyA0XSA9IGE7XG4gICAgfSxcbiAgICBhcHBseTogZnVuY3Rpb24gKHNrZWxldG9uLCB0aW1lLCBhbHBoYSkge1xuICAgICAgICB2YXIgZnJhbWVzID0gdGhpcy5mcmFtZXM7XG4gICAgICAgIGlmICh0aW1lIDwgZnJhbWVzWzBdKSByZXR1cm47IC8vIFRpbWUgaXMgYmVmb3JlIGZpcnN0IGZyYW1lLlxuXG4gICAgICAgIHZhciBzbG90ID0gc2tlbGV0b24uc2xvdHNbdGhpcy5zbG90SW5kZXhdO1xuXG4gICAgICAgIGlmICh0aW1lID49IGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gNV0pIHsgLy8gVGltZSBpcyBhZnRlciBsYXN0IGZyYW1lLlxuICAgICAgICAgICAgdmFyIGkgPSBmcmFtZXMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgIHNsb3QuciA9IGZyYW1lc1tpIC0gM107XG4gICAgICAgICAgICBzbG90LmcgPSBmcmFtZXNbaSAtIDJdO1xuICAgICAgICAgICAgc2xvdC5iID0gZnJhbWVzW2kgLSAxXTtcbiAgICAgICAgICAgIHNsb3QuYSA9IGZyYW1lc1tpXTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEludGVycG9sYXRlIGJldHdlZW4gdGhlIGxhc3QgZnJhbWUgYW5kIHRoZSBjdXJyZW50IGZyYW1lLlxuICAgICAgICB2YXIgZnJhbWVJbmRleCA9IHNwaW5lLmJpbmFyeVNlYXJjaChmcmFtZXMsIHRpbWUsIDUpO1xuICAgICAgICB2YXIgbGFzdEZyYW1lUiA9IGZyYW1lc1tmcmFtZUluZGV4IC0gNF07XG4gICAgICAgIHZhciBsYXN0RnJhbWVHID0gZnJhbWVzW2ZyYW1lSW5kZXggLSAzXTtcbiAgICAgICAgdmFyIGxhc3RGcmFtZUIgPSBmcmFtZXNbZnJhbWVJbmRleCAtIDJdO1xuICAgICAgICB2YXIgbGFzdEZyYW1lQSA9IGZyYW1lc1tmcmFtZUluZGV4IC0gMV07XG4gICAgICAgIHZhciBmcmFtZVRpbWUgPSBmcmFtZXNbZnJhbWVJbmRleF07XG4gICAgICAgIHZhciBwZXJjZW50ID0gMSAtICh0aW1lIC0gZnJhbWVUaW1lKSAvIChmcmFtZXNbZnJhbWVJbmRleCAtIDUvKkxBU1RfRlJBTUVfVElNRSovXSAtIGZyYW1lVGltZSk7XG4gICAgICAgIHBlcmNlbnQgPSB0aGlzLmN1cnZlcy5nZXRDdXJ2ZVBlcmNlbnQoZnJhbWVJbmRleCAvIDUgLSAxLCBwZXJjZW50KTtcblxuICAgICAgICB2YXIgciA9IGxhc3RGcmFtZVIgKyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAxLypGUkFNRV9SKi9dIC0gbGFzdEZyYW1lUikgKiBwZXJjZW50O1xuICAgICAgICB2YXIgZyA9IGxhc3RGcmFtZUcgKyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAyLypGUkFNRV9HKi9dIC0gbGFzdEZyYW1lRykgKiBwZXJjZW50O1xuICAgICAgICB2YXIgYiA9IGxhc3RGcmFtZUIgKyAoZnJhbWVzW2ZyYW1lSW5kZXggKyAzLypGUkFNRV9CKi9dIC0gbGFzdEZyYW1lQikgKiBwZXJjZW50O1xuICAgICAgICB2YXIgYSA9IGxhc3RGcmFtZUEgKyAoZnJhbWVzW2ZyYW1lSW5kZXggKyA0LypGUkFNRV9BKi9dIC0gbGFzdEZyYW1lQSkgKiBwZXJjZW50O1xuICAgICAgICBpZiAoYWxwaGEgPCAxKSB7XG4gICAgICAgICAgICBzbG90LnIgKz0gKHIgLSBzbG90LnIpICogYWxwaGE7XG4gICAgICAgICAgICBzbG90LmcgKz0gKGcgLSBzbG90LmcpICogYWxwaGE7XG4gICAgICAgICAgICBzbG90LmIgKz0gKGIgLSBzbG90LmIpICogYWxwaGE7XG4gICAgICAgICAgICBzbG90LmEgKz0gKGEgLSBzbG90LmEpICogYWxwaGE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzbG90LnIgPSByO1xuICAgICAgICAgICAgc2xvdC5nID0gZztcbiAgICAgICAgICAgIHNsb3QuYiA9IGI7XG4gICAgICAgICAgICBzbG90LmEgPSBhO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuc3BpbmUuQXR0YWNobWVudFRpbWVsaW5lID0gZnVuY3Rpb24gKGZyYW1lQ291bnQpIHtcbiAgICB0aGlzLmN1cnZlcyA9IG5ldyBzcGluZS5DdXJ2ZXMoZnJhbWVDb3VudCk7XG4gICAgdGhpcy5mcmFtZXMgPSBbXTsgLy8gdGltZSwgLi4uXG4gICAgdGhpcy5mcmFtZXMubGVuZ3RoID0gZnJhbWVDb3VudDtcbiAgICB0aGlzLmF0dGFjaG1lbnROYW1lcyA9IFtdOyAvLyB0aW1lLCAuLi5cbiAgICB0aGlzLmF0dGFjaG1lbnROYW1lcy5sZW5ndGggPSBmcmFtZUNvdW50O1xufTtcbnNwaW5lLkF0dGFjaG1lbnRUaW1lbGluZS5wcm90b3R5cGUgPSB7XG4gICAgc2xvdEluZGV4OiAwLFxuICAgIGdldEZyYW1lQ291bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZyYW1lcy5sZW5ndGg7XG4gICAgfSxcbiAgICBzZXRGcmFtZTogZnVuY3Rpb24gKGZyYW1lSW5kZXgsIHRpbWUsIGF0dGFjaG1lbnROYW1lKSB7XG4gICAgICAgIHRoaXMuZnJhbWVzW2ZyYW1lSW5kZXhdID0gdGltZTtcbiAgICAgICAgdGhpcy5hdHRhY2htZW50TmFtZXNbZnJhbWVJbmRleF0gPSBhdHRhY2htZW50TmFtZTtcbiAgICB9LFxuICAgIGFwcGx5OiBmdW5jdGlvbiAoc2tlbGV0b24sIHRpbWUsIGFscGhhKSB7XG4gICAgICAgIHZhciBmcmFtZXMgPSB0aGlzLmZyYW1lcztcbiAgICAgICAgaWYgKHRpbWUgPCBmcmFtZXNbMF0pIHJldHVybjsgLy8gVGltZSBpcyBiZWZvcmUgZmlyc3QgZnJhbWUuXG5cbiAgICAgICAgdmFyIGZyYW1lSW5kZXg7XG4gICAgICAgIGlmICh0aW1lID49IGZyYW1lc1tmcmFtZXMubGVuZ3RoIC0gMV0pIC8vIFRpbWUgaXMgYWZ0ZXIgbGFzdCBmcmFtZS5cbiAgICAgICAgICAgIGZyYW1lSW5kZXggPSBmcmFtZXMubGVuZ3RoIC0gMTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgZnJhbWVJbmRleCA9IHNwaW5lLmJpbmFyeVNlYXJjaChmcmFtZXMsIHRpbWUsIDEpIC0gMTtcblxuICAgICAgICB2YXIgYXR0YWNobWVudE5hbWUgPSB0aGlzLmF0dGFjaG1lbnROYW1lc1tmcmFtZUluZGV4XTtcbiAgICAgICAgc2tlbGV0b24uc2xvdHNbdGhpcy5zbG90SW5kZXhdLnNldEF0dGFjaG1lbnQoIWF0dGFjaG1lbnROYW1lID8gbnVsbCA6IHNrZWxldG9uLmdldEF0dGFjaG1lbnRCeVNsb3RJbmRleCh0aGlzLnNsb3RJbmRleCwgYXR0YWNobWVudE5hbWUpKTtcbiAgICB9XG59O1xuXG5zcGluZS5Ta2VsZXRvbkRhdGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5ib25lcyA9IFtdO1xuICAgIHRoaXMuc2xvdHMgPSBbXTtcbiAgICB0aGlzLnNraW5zID0gW107XG4gICAgdGhpcy5hbmltYXRpb25zID0gW107XG59O1xuc3BpbmUuU2tlbGV0b25EYXRhLnByb3RvdHlwZSA9IHtcbiAgICBkZWZhdWx0U2tpbjogbnVsbCxcbiAgICAvKiogQHJldHVybiBNYXkgYmUgbnVsbC4gKi9cbiAgICBmaW5kQm9uZTogZnVuY3Rpb24gKGJvbmVOYW1lKSB7XG4gICAgICAgIHZhciBib25lcyA9IHRoaXMuYm9uZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYm9uZXMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKGJvbmVzW2ldLm5hbWUgPT0gYm9uZU5hbWUpIHJldHVybiBib25lc1tpXTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiAtMSBpZiB0aGUgYm9uZSB3YXMgbm90IGZvdW5kLiAqL1xuICAgIGZpbmRCb25lSW5kZXg6IGZ1bmN0aW9uIChib25lTmFtZSkge1xuICAgICAgICB2YXIgYm9uZXMgPSB0aGlzLmJvbmVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGJvbmVzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChib25lc1tpXS5uYW1lID09IGJvbmVOYW1lKSByZXR1cm4gaTtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gTWF5IGJlIG51bGwuICovXG4gICAgZmluZFNsb3Q6IGZ1bmN0aW9uIChzbG90TmFtZSkge1xuICAgICAgICB2YXIgc2xvdHMgPSB0aGlzLnNsb3RzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNsb3RzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgaWYgKHNsb3RzW2ldLm5hbWUgPT0gc2xvdE5hbWUpIHJldHVybiBzbG90c1tpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIC0xIGlmIHRoZSBib25lIHdhcyBub3QgZm91bmQuICovXG4gICAgZmluZFNsb3RJbmRleDogZnVuY3Rpb24gKHNsb3ROYW1lKSB7XG4gICAgICAgIHZhciBzbG90cyA9IHRoaXMuc2xvdHM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2xvdHMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKHNsb3RzW2ldLm5hbWUgPT0gc2xvdE5hbWUpIHJldHVybiBpO1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiBNYXkgYmUgbnVsbC4gKi9cbiAgICBmaW5kU2tpbjogZnVuY3Rpb24gKHNraW5OYW1lKSB7XG4gICAgICAgIHZhciBza2lucyA9IHRoaXMuc2tpbnM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2tpbnMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKHNraW5zW2ldLm5hbWUgPT0gc2tpbk5hbWUpIHJldHVybiBza2luc1tpXTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiBNYXkgYmUgbnVsbC4gKi9cbiAgICBmaW5kQW5pbWF0aW9uOiBmdW5jdGlvbiAoYW5pbWF0aW9uTmFtZSkge1xuICAgICAgICB2YXIgYW5pbWF0aW9ucyA9IHRoaXMuYW5pbWF0aW9ucztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBhbmltYXRpb25zLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChhbmltYXRpb25zW2ldLm5hbWUgPT0gYW5pbWF0aW9uTmFtZSkgcmV0dXJuIGFuaW1hdGlvbnNbaV07XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn07XG5cbnNwaW5lLlNrZWxldG9uID0gZnVuY3Rpb24gKHNrZWxldG9uRGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IHNrZWxldG9uRGF0YTtcblxuICAgIHRoaXMuYm9uZXMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNrZWxldG9uRGF0YS5ib25lcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIGJvbmVEYXRhID0gc2tlbGV0b25EYXRhLmJvbmVzW2ldO1xuICAgICAgICB2YXIgcGFyZW50ID0gIWJvbmVEYXRhLnBhcmVudCA/IG51bGwgOiB0aGlzLmJvbmVzW3NrZWxldG9uRGF0YS5ib25lcy5pbmRleE9mKGJvbmVEYXRhLnBhcmVudCldO1xuICAgICAgICB0aGlzLmJvbmVzLnB1c2gobmV3IHNwaW5lLkJvbmUoYm9uZURhdGEsIHBhcmVudCkpO1xuICAgIH1cblxuICAgIHRoaXMuc2xvdHMgPSBbXTtcbiAgICB0aGlzLmRyYXdPcmRlciA9IFtdO1xuICAgIGZvciAoaSA9IDAsIG4gPSBza2VsZXRvbkRhdGEuc2xvdHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgIHZhciBzbG90RGF0YSA9IHNrZWxldG9uRGF0YS5zbG90c1tpXTtcbiAgICAgICAgdmFyIGJvbmUgPSB0aGlzLmJvbmVzW3NrZWxldG9uRGF0YS5ib25lcy5pbmRleE9mKHNsb3REYXRhLmJvbmVEYXRhKV07XG4gICAgICAgIHZhciBzbG90ID0gbmV3IHNwaW5lLlNsb3Qoc2xvdERhdGEsIHRoaXMsIGJvbmUpO1xuICAgICAgICB0aGlzLnNsb3RzLnB1c2goc2xvdCk7XG4gICAgICAgIHRoaXMuZHJhd09yZGVyLnB1c2goc2xvdCk7XG4gICAgfVxufTtcbnNwaW5lLlNrZWxldG9uLnByb3RvdHlwZSA9IHtcbiAgICB4OiAwLCB5OiAwLFxuICAgIHNraW46IG51bGwsXG4gICAgcjogMSwgZzogMSwgYjogMSwgYTogMSxcbiAgICB0aW1lOiAwLFxuICAgIGZsaXBYOiBmYWxzZSwgZmxpcFk6IGZhbHNlLFxuICAgIC8qKiBVcGRhdGVzIHRoZSB3b3JsZCB0cmFuc2Zvcm0gZm9yIGVhY2ggYm9uZS4gKi9cbiAgICB1cGRhdGVXb3JsZFRyYW5zZm9ybTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxpcFggPSB0aGlzLmZsaXBYO1xuICAgICAgICB2YXIgZmxpcFkgPSB0aGlzLmZsaXBZO1xuICAgICAgICB2YXIgYm9uZXMgPSB0aGlzLmJvbmVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGJvbmVzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGJvbmVzW2ldLnVwZGF0ZVdvcmxkVHJhbnNmb3JtKGZsaXBYLCBmbGlwWSk7XG4gICAgfSxcbiAgICAvKiogU2V0cyB0aGUgYm9uZXMgYW5kIHNsb3RzIHRvIHRoZWlyIHNldHVwIHBvc2UgdmFsdWVzLiAqL1xuICAgIHNldFRvU2V0dXBQb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc2V0Qm9uZXNUb1NldHVwUG9zZSgpO1xuICAgICAgICB0aGlzLnNldFNsb3RzVG9TZXR1cFBvc2UoKTtcbiAgICB9LFxuICAgIHNldEJvbmVzVG9TZXR1cFBvc2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGJvbmVzID0gdGhpcy5ib25lcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSBib25lcy5sZW5ndGg7IGkgPCBuOyBpKyspXG4gICAgICAgICAgICBib25lc1tpXS5zZXRUb1NldHVwUG9zZSgpO1xuICAgIH0sXG4gICAgc2V0U2xvdHNUb1NldHVwUG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2xvdHMgPSB0aGlzLnNsb3RzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNsb3RzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIHNsb3RzW2ldLnNldFRvU2V0dXBQb3NlKGkpO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gTWF5IHJldHVybiBudWxsLiAqL1xuICAgIGdldFJvb3RCb25lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJvbmVzLmxlbmd0aCA/IHRoaXMuYm9uZXNbMF0gOiBudWxsO1xuICAgIH0sXG4gICAgLyoqIEByZXR1cm4gTWF5IGJlIG51bGwuICovXG4gICAgZmluZEJvbmU6IGZ1bmN0aW9uIChib25lTmFtZSkge1xuICAgICAgICB2YXIgYm9uZXMgPSB0aGlzLmJvbmVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGJvbmVzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChib25lc1tpXS5kYXRhLm5hbWUgPT0gYm9uZU5hbWUpIHJldHVybiBib25lc1tpXTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiAtMSBpZiB0aGUgYm9uZSB3YXMgbm90IGZvdW5kLiAqL1xuICAgIGZpbmRCb25lSW5kZXg6IGZ1bmN0aW9uIChib25lTmFtZSkge1xuICAgICAgICB2YXIgYm9uZXMgPSB0aGlzLmJvbmVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGJvbmVzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChib25lc1tpXS5kYXRhLm5hbWUgPT0gYm9uZU5hbWUpIHJldHVybiBpO1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiBNYXkgYmUgbnVsbC4gKi9cbiAgICBmaW5kU2xvdDogZnVuY3Rpb24gKHNsb3ROYW1lKSB7XG4gICAgICAgIHZhciBzbG90cyA9IHRoaXMuc2xvdHM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2xvdHMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKHNsb3RzW2ldLmRhdGEubmFtZSA9PSBzbG90TmFtZSkgcmV0dXJuIHNsb3RzW2ldO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIC8qKiBAcmV0dXJuIC0xIGlmIHRoZSBib25lIHdhcyBub3QgZm91bmQuICovXG4gICAgZmluZFNsb3RJbmRleDogZnVuY3Rpb24gKHNsb3ROYW1lKSB7XG4gICAgICAgIHZhciBzbG90cyA9IHRoaXMuc2xvdHM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gc2xvdHMubGVuZ3RoOyBpIDwgbjsgaSsrKVxuICAgICAgICAgICAgaWYgKHNsb3RzW2ldLmRhdGEubmFtZSA9PSBzbG90TmFtZSkgcmV0dXJuIGk7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9LFxuICAgIHNldFNraW5CeU5hbWU6IGZ1bmN0aW9uIChza2luTmFtZSkge1xuICAgICAgICB2YXIgc2tpbiA9IHRoaXMuZGF0YS5maW5kU2tpbihza2luTmFtZSk7XG4gICAgICAgIGlmICghc2tpbikgdGhyb3cgXCJTa2luIG5vdCBmb3VuZDogXCIgKyBza2luTmFtZTtcbiAgICAgICAgdGhpcy5zZXRTa2luKHNraW4pO1xuICAgIH0sXG4gICAgLyoqIFNldHMgdGhlIHNraW4gdXNlZCB0byBsb29rIHVwIGF0dGFjaG1lbnRzIG5vdCBmb3VuZCBpbiB0aGUge0BsaW5rIFNrZWxldG9uRGF0YSNnZXREZWZhdWx0U2tpbigpIGRlZmF1bHQgc2tpbn0uIEF0dGFjaG1lbnRzXG4gICAgICogZnJvbSB0aGUgbmV3IHNraW4gYXJlIGF0dGFjaGVkIGlmIHRoZSBjb3JyZXNwb25kaW5nIGF0dGFjaG1lbnQgZnJvbSB0aGUgb2xkIHNraW4gd2FzIGF0dGFjaGVkLlxuICAgICAqIEBwYXJhbSBuZXdTa2luIE1heSBiZSBudWxsLiAqL1xuICAgIHNldFNraW46IGZ1bmN0aW9uIChuZXdTa2luKSB7XG4gICAgICAgIGlmICh0aGlzLnNraW4gJiYgbmV3U2tpbikgbmV3U2tpbi5fYXR0YWNoQWxsKHRoaXMsIHRoaXMuc2tpbik7XG4gICAgICAgIHRoaXMuc2tpbiA9IG5ld1NraW47XG4gICAgfSxcbiAgICAvKiogQHJldHVybiBNYXkgYmUgbnVsbC4gKi9cbiAgICBnZXRBdHRhY2htZW50QnlTbG90TmFtZTogZnVuY3Rpb24gKHNsb3ROYW1lLCBhdHRhY2htZW50TmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRBdHRhY2htZW50QnlTbG90SW5kZXgodGhpcy5kYXRhLmZpbmRTbG90SW5kZXgoc2xvdE5hbWUpLCBhdHRhY2htZW50TmFtZSk7XG4gICAgfSxcbiAgICAvKiogQHJldHVybiBNYXkgYmUgbnVsbC4gKi9cbiAgICBnZXRBdHRhY2htZW50QnlTbG90SW5kZXg6IGZ1bmN0aW9uIChzbG90SW5kZXgsIGF0dGFjaG1lbnROYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLnNraW4pIHtcbiAgICAgICAgICAgIHZhciBhdHRhY2htZW50ID0gdGhpcy5za2luLmdldEF0dGFjaG1lbnQoc2xvdEluZGV4LCBhdHRhY2htZW50TmFtZSk7XG4gICAgICAgICAgICBpZiAoYXR0YWNobWVudCkgcmV0dXJuIGF0dGFjaG1lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZGF0YS5kZWZhdWx0U2tpbikgcmV0dXJuIHRoaXMuZGF0YS5kZWZhdWx0U2tpbi5nZXRBdHRhY2htZW50KHNsb3RJbmRleCwgYXR0YWNobWVudE5hbWUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIC8qKiBAcGFyYW0gYXR0YWNobWVudE5hbWUgTWF5IGJlIG51bGwuICovXG4gICAgc2V0QXR0YWNobWVudDogZnVuY3Rpb24gKHNsb3ROYW1lLCBhdHRhY2htZW50TmFtZSkge1xuICAgICAgICB2YXIgc2xvdHMgPSB0aGlzLnNsb3RzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHNsb3RzLnNpemU7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBzbG90ID0gc2xvdHNbaV07XG4gICAgICAgICAgICBpZiAoc2xvdC5kYXRhLm5hbWUgPT0gc2xvdE5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXR0YWNobWVudCA9IG51bGw7XG4gICAgICAgICAgICAgICAgaWYgKGF0dGFjaG1lbnROYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnQgPSB0aGlzLmdldEF0dGFjaG1lbnQoaSwgYXR0YWNobWVudE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0YWNobWVudCA9PSBudWxsKSB0aHJvdyBcIkF0dGFjaG1lbnQgbm90IGZvdW5kOiBcIiArIGF0dGFjaG1lbnROYW1lICsgXCIsIGZvciBzbG90OiBcIiArIHNsb3ROYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzbG90LnNldEF0dGFjaG1lbnQoYXR0YWNobWVudCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRocm93IFwiU2xvdCBub3QgZm91bmQ6IFwiICsgc2xvdE5hbWU7XG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkZWx0YSkge1xuICAgICAgICB0aGlzLnRpbWUgKz0gZGVsdGE7XG4gICAgfVxufTtcblxuc3BpbmUuQXR0YWNobWVudFR5cGUgPSB7XG4gICAgcmVnaW9uOiAwXG59O1xuXG5zcGluZS5SZWdpb25BdHRhY2htZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMub2Zmc2V0ID0gW107XG4gICAgdGhpcy5vZmZzZXQubGVuZ3RoID0gODtcbiAgICB0aGlzLnV2cyA9IFtdO1xuICAgIHRoaXMudXZzLmxlbmd0aCA9IDg7XG59O1xuc3BpbmUuUmVnaW9uQXR0YWNobWVudC5wcm90b3R5cGUgPSB7XG4gICAgeDogMCwgeTogMCxcbiAgICByb3RhdGlvbjogMCxcbiAgICBzY2FsZVg6IDEsIHNjYWxlWTogMSxcbiAgICB3aWR0aDogMCwgaGVpZ2h0OiAwLFxuICAgIHJlbmRlcmVyT2JqZWN0OiBudWxsLFxuICAgIHJlZ2lvbk9mZnNldFg6IDAsIHJlZ2lvbk9mZnNldFk6IDAsXG4gICAgcmVnaW9uV2lkdGg6IDAsIHJlZ2lvbkhlaWdodDogMCxcbiAgICByZWdpb25PcmlnaW5hbFdpZHRoOiAwLCByZWdpb25PcmlnaW5hbEhlaWdodDogMCxcbiAgICBzZXRVVnM6IGZ1bmN0aW9uICh1LCB2LCB1MiwgdjIsIHJvdGF0ZSkge1xuICAgICAgICB2YXIgdXZzID0gdGhpcy51dnM7XG4gICAgICAgIGlmIChyb3RhdGUpIHtcbiAgICAgICAgICAgIHV2c1syLypYMiovXSA9IHU7XG4gICAgICAgICAgICB1dnNbMy8qWTIqL10gPSB2MjtcbiAgICAgICAgICAgIHV2c1s0LypYMyovXSA9IHU7XG4gICAgICAgICAgICB1dnNbNS8qWTMqL10gPSB2O1xuICAgICAgICAgICAgdXZzWzYvKlg0Ki9dID0gdTI7XG4gICAgICAgICAgICB1dnNbNy8qWTQqL10gPSB2O1xuICAgICAgICAgICAgdXZzWzAvKlgxKi9dID0gdTI7XG4gICAgICAgICAgICB1dnNbMS8qWTEqL10gPSB2MjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHV2c1swLypYMSovXSA9IHU7XG4gICAgICAgICAgICB1dnNbMS8qWTEqL10gPSB2MjtcbiAgICAgICAgICAgIHV2c1syLypYMiovXSA9IHU7XG4gICAgICAgICAgICB1dnNbMy8qWTIqL10gPSB2O1xuICAgICAgICAgICAgdXZzWzQvKlgzKi9dID0gdTI7XG4gICAgICAgICAgICB1dnNbNS8qWTMqL10gPSB2O1xuICAgICAgICAgICAgdXZzWzYvKlg0Ki9dID0gdTI7XG4gICAgICAgICAgICB1dnNbNy8qWTQqL10gPSB2MjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgdXBkYXRlT2Zmc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciByZWdpb25TY2FsZVggPSB0aGlzLndpZHRoIC8gdGhpcy5yZWdpb25PcmlnaW5hbFdpZHRoICogdGhpcy5zY2FsZVg7XG4gICAgICAgIHZhciByZWdpb25TY2FsZVkgPSB0aGlzLmhlaWdodCAvIHRoaXMucmVnaW9uT3JpZ2luYWxIZWlnaHQgKiB0aGlzLnNjYWxlWTtcbiAgICAgICAgdmFyIGxvY2FsWCA9IC10aGlzLndpZHRoIC8gMiAqIHRoaXMuc2NhbGVYICsgdGhpcy5yZWdpb25PZmZzZXRYICogcmVnaW9uU2NhbGVYO1xuICAgICAgICB2YXIgbG9jYWxZID0gLXRoaXMuaGVpZ2h0IC8gMiAqIHRoaXMuc2NhbGVZICsgdGhpcy5yZWdpb25PZmZzZXRZICogcmVnaW9uU2NhbGVZO1xuICAgICAgICB2YXIgbG9jYWxYMiA9IGxvY2FsWCArIHRoaXMucmVnaW9uV2lkdGggKiByZWdpb25TY2FsZVg7XG4gICAgICAgIHZhciBsb2NhbFkyID0gbG9jYWxZICsgdGhpcy5yZWdpb25IZWlnaHQgKiByZWdpb25TY2FsZVk7XG4gICAgICAgIHZhciByYWRpYW5zID0gdGhpcy5yb3RhdGlvbiAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIHZhciBjb3MgPSBNYXRoLmNvcyhyYWRpYW5zKTtcbiAgICAgICAgdmFyIHNpbiA9IE1hdGguc2luKHJhZGlhbnMpO1xuICAgICAgICB2YXIgbG9jYWxYQ29zID0gbG9jYWxYICogY29zICsgdGhpcy54O1xuICAgICAgICB2YXIgbG9jYWxYU2luID0gbG9jYWxYICogc2luO1xuICAgICAgICB2YXIgbG9jYWxZQ29zID0gbG9jYWxZICogY29zICsgdGhpcy55O1xuICAgICAgICB2YXIgbG9jYWxZU2luID0gbG9jYWxZICogc2luO1xuICAgICAgICB2YXIgbG9jYWxYMkNvcyA9IGxvY2FsWDIgKiBjb3MgKyB0aGlzLng7XG4gICAgICAgIHZhciBsb2NhbFgyU2luID0gbG9jYWxYMiAqIHNpbjtcbiAgICAgICAgdmFyIGxvY2FsWTJDb3MgPSBsb2NhbFkyICogY29zICsgdGhpcy55O1xuICAgICAgICB2YXIgbG9jYWxZMlNpbiA9IGxvY2FsWTIgKiBzaW47XG4gICAgICAgIHZhciBvZmZzZXQgPSB0aGlzLm9mZnNldDtcbiAgICAgICAgb2Zmc2V0WzAvKlgxKi9dID0gbG9jYWxYQ29zIC0gbG9jYWxZU2luO1xuICAgICAgICBvZmZzZXRbMS8qWTEqL10gPSBsb2NhbFlDb3MgKyBsb2NhbFhTaW47XG4gICAgICAgIG9mZnNldFsyLypYMiovXSA9IGxvY2FsWENvcyAtIGxvY2FsWTJTaW47XG4gICAgICAgIG9mZnNldFszLypZMiovXSA9IGxvY2FsWTJDb3MgKyBsb2NhbFhTaW47XG4gICAgICAgIG9mZnNldFs0LypYMyovXSA9IGxvY2FsWDJDb3MgLSBsb2NhbFkyU2luO1xuICAgICAgICBvZmZzZXRbNS8qWTMqL10gPSBsb2NhbFkyQ29zICsgbG9jYWxYMlNpbjtcbiAgICAgICAgb2Zmc2V0WzYvKlg0Ki9dID0gbG9jYWxYMkNvcyAtIGxvY2FsWVNpbjtcbiAgICAgICAgb2Zmc2V0WzcvKlk0Ki9dID0gbG9jYWxZQ29zICsgbG9jYWxYMlNpbjtcbiAgICB9LFxuICAgIGNvbXB1dGVWZXJ0aWNlczogZnVuY3Rpb24gKHgsIHksIGJvbmUsIHZlcnRpY2VzKSB7XG4gICAgICAgIHggKz0gYm9uZS53b3JsZFg7XG4gICAgICAgIHkgKz0gYm9uZS53b3JsZFk7XG4gICAgICAgIHZhciBtMDAgPSBib25lLm0wMDtcbiAgICAgICAgdmFyIG0wMSA9IGJvbmUubTAxO1xuICAgICAgICB2YXIgbTEwID0gYm9uZS5tMTA7XG4gICAgICAgIHZhciBtMTEgPSBib25lLm0xMTtcbiAgICAgICAgdmFyIG9mZnNldCA9IHRoaXMub2Zmc2V0O1xuICAgICAgICB2ZXJ0aWNlc1swLypYMSovXSA9IG9mZnNldFswLypYMSovXSAqIG0wMCArIG9mZnNldFsxLypZMSovXSAqIG0wMSArIHg7XG4gICAgICAgIHZlcnRpY2VzWzEvKlkxKi9dID0gb2Zmc2V0WzAvKlgxKi9dICogbTEwICsgb2Zmc2V0WzEvKlkxKi9dICogbTExICsgeTtcbiAgICAgICAgdmVydGljZXNbMi8qWDIqL10gPSBvZmZzZXRbMi8qWDIqL10gKiBtMDAgKyBvZmZzZXRbMy8qWTIqL10gKiBtMDEgKyB4O1xuICAgICAgICB2ZXJ0aWNlc1szLypZMiovXSA9IG9mZnNldFsyLypYMiovXSAqIG0xMCArIG9mZnNldFszLypZMiovXSAqIG0xMSArIHk7XG4gICAgICAgIHZlcnRpY2VzWzQvKlgzKi9dID0gb2Zmc2V0WzQvKlgzKi9dICogbTAwICsgb2Zmc2V0WzUvKlgzKi9dICogbTAxICsgeDtcbiAgICAgICAgdmVydGljZXNbNS8qWDMqL10gPSBvZmZzZXRbNC8qWDMqL10gKiBtMTAgKyBvZmZzZXRbNS8qWDMqL10gKiBtMTEgKyB5O1xuICAgICAgICB2ZXJ0aWNlc1s2LypYNCovXSA9IG9mZnNldFs2LypYNCovXSAqIG0wMCArIG9mZnNldFs3LypZNCovXSAqIG0wMSArIHg7XG4gICAgICAgIHZlcnRpY2VzWzcvKlk0Ki9dID0gb2Zmc2V0WzYvKlg0Ki9dICogbTEwICsgb2Zmc2V0WzcvKlk0Ki9dICogbTExICsgeTtcbiAgICB9XG59XG5cbnNwaW5lLkFuaW1hdGlvblN0YXRlRGF0YSA9IGZ1bmN0aW9uIChza2VsZXRvbkRhdGEpIHtcbiAgICB0aGlzLnNrZWxldG9uRGF0YSA9IHNrZWxldG9uRGF0YTtcbiAgICB0aGlzLmFuaW1hdGlvblRvTWl4VGltZSA9IHt9O1xufTtcbnNwaW5lLkFuaW1hdGlvblN0YXRlRGF0YS5wcm90b3R5cGUgPSB7XG4gICAgICAgIGRlZmF1bHRNaXg6IDAsXG4gICAgc2V0TWl4QnlOYW1lOiBmdW5jdGlvbiAoZnJvbU5hbWUsIHRvTmFtZSwgZHVyYXRpb24pIHtcbiAgICAgICAgdmFyIGZyb20gPSB0aGlzLnNrZWxldG9uRGF0YS5maW5kQW5pbWF0aW9uKGZyb21OYW1lKTtcbiAgICAgICAgaWYgKCFmcm9tKSB0aHJvdyBcIkFuaW1hdGlvbiBub3QgZm91bmQ6IFwiICsgZnJvbU5hbWU7XG4gICAgICAgIHZhciB0byA9IHRoaXMuc2tlbGV0b25EYXRhLmZpbmRBbmltYXRpb24odG9OYW1lKTtcbiAgICAgICAgaWYgKCF0bykgdGhyb3cgXCJBbmltYXRpb24gbm90IGZvdW5kOiBcIiArIHRvTmFtZTtcbiAgICAgICAgdGhpcy5zZXRNaXgoZnJvbSwgdG8sIGR1cmF0aW9uKTtcbiAgICB9LFxuICAgIHNldE1peDogZnVuY3Rpb24gKGZyb20sIHRvLCBkdXJhdGlvbikge1xuICAgICAgICB0aGlzLmFuaW1hdGlvblRvTWl4VGltZVtmcm9tLm5hbWUgKyBcIjpcIiArIHRvLm5hbWVdID0gZHVyYXRpb247XG4gICAgfSxcbiAgICBnZXRNaXg6IGZ1bmN0aW9uIChmcm9tLCB0bykge1xuICAgICAgICB2YXIgdGltZSA9IHRoaXMuYW5pbWF0aW9uVG9NaXhUaW1lW2Zyb20ubmFtZSArIFwiOlwiICsgdG8ubmFtZV07XG4gICAgICAgICAgICByZXR1cm4gdGltZSA/IHRpbWUgOiB0aGlzLmRlZmF1bHRNaXg7XG4gICAgfVxufTtcblxuc3BpbmUuQW5pbWF0aW9uU3RhdGUgPSBmdW5jdGlvbiAoc3RhdGVEYXRhKSB7XG4gICAgdGhpcy5kYXRhID0gc3RhdGVEYXRhO1xuICAgIHRoaXMucXVldWUgPSBbXTtcbn07XG5zcGluZS5BbmltYXRpb25TdGF0ZS5wcm90b3R5cGUgPSB7XG4gICAgY3VycmVudDogbnVsbCxcbiAgICBwcmV2aW91czogbnVsbCxcbiAgICBjdXJyZW50VGltZTogMCxcbiAgICBwcmV2aW91c1RpbWU6IDAsXG4gICAgY3VycmVudExvb3A6IGZhbHNlLFxuICAgIHByZXZpb3VzTG9vcDogZmFsc2UsXG4gICAgbWl4VGltZTogMCxcbiAgICBtaXhEdXJhdGlvbjogMCxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkZWx0YSkge1xuICAgICAgICB0aGlzLmN1cnJlbnRUaW1lICs9IGRlbHRhO1xuICAgICAgICB0aGlzLnByZXZpb3VzVGltZSArPSBkZWx0YTtcbiAgICAgICAgdGhpcy5taXhUaW1lICs9IGRlbHRhO1xuXG4gICAgICAgIGlmICh0aGlzLnF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHZhciBlbnRyeSA9IHRoaXMucXVldWVbMF07XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50VGltZSA+PSBlbnRyeS5kZWxheSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldEFuaW1hdGlvbihlbnRyeS5hbmltYXRpb24sIGVudHJ5Lmxvb3ApO1xuICAgICAgICAgICAgICAgIHRoaXMucXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgYXBwbHk6IGZ1bmN0aW9uIChza2VsZXRvbikge1xuICAgICAgICBpZiAoIXRoaXMuY3VycmVudCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5wcmV2aW91cykge1xuICAgICAgICAgICAgdGhpcy5wcmV2aW91cy5hcHBseShza2VsZXRvbiwgdGhpcy5wcmV2aW91c1RpbWUsIHRoaXMucHJldmlvdXNMb29wKTtcbiAgICAgICAgICAgIHZhciBhbHBoYSA9IHRoaXMubWl4VGltZSAvIHRoaXMubWl4RHVyYXRpb247XG4gICAgICAgICAgICBpZiAoYWxwaGEgPj0gMSkge1xuICAgICAgICAgICAgICAgIGFscGhhID0gMTtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VycmVudC5taXgoc2tlbGV0b24sIHRoaXMuY3VycmVudFRpbWUsIHRoaXMuY3VycmVudExvb3AsIGFscGhhKTtcbiAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnQuYXBwbHkoc2tlbGV0b24sIHRoaXMuY3VycmVudFRpbWUsIHRoaXMuY3VycmVudExvb3ApO1xuICAgIH0sXG4gICAgY2xlYXJBbmltYXRpb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5wcmV2aW91cyA9IG51bGw7XG4gICAgICAgIHRoaXMuY3VycmVudCA9IG51bGw7XG4gICAgICAgIHRoaXMucXVldWUubGVuZ3RoID0gMDtcbiAgICB9LFxuICAgIF9zZXRBbmltYXRpb246IGZ1bmN0aW9uIChhbmltYXRpb24sIGxvb3ApIHtcbiAgICAgICAgdGhpcy5wcmV2aW91cyA9IG51bGw7XG4gICAgICAgIGlmIChhbmltYXRpb24gJiYgdGhpcy5jdXJyZW50KSB7XG4gICAgICAgICAgICB0aGlzLm1peER1cmF0aW9uID0gdGhpcy5kYXRhLmdldE1peCh0aGlzLmN1cnJlbnQsIGFuaW1hdGlvbik7XG4gICAgICAgICAgICBpZiAodGhpcy5taXhEdXJhdGlvbiA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1peFRpbWUgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXMgPSB0aGlzLmN1cnJlbnQ7XG4gICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c1RpbWUgPSB0aGlzLmN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXNMb29wID0gdGhpcy5jdXJyZW50TG9vcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmN1cnJlbnQgPSBhbmltYXRpb247XG4gICAgICAgIHRoaXMuY3VycmVudExvb3AgPSBsb29wO1xuICAgICAgICB0aGlzLmN1cnJlbnRUaW1lID0gMDtcbiAgICB9LFxuICAgIC8qKiBAc2VlICNzZXRBbmltYXRpb24oQW5pbWF0aW9uLCBCb29sZWFuKSAqL1xuICAgIHNldEFuaW1hdGlvbkJ5TmFtZTogZnVuY3Rpb24gKGFuaW1hdGlvbk5hbWUsIGxvb3ApIHtcbiAgICAgICAgdmFyIGFuaW1hdGlvbiA9IHRoaXMuZGF0YS5za2VsZXRvbkRhdGEuZmluZEFuaW1hdGlvbihhbmltYXRpb25OYW1lKTtcbiAgICAgICAgaWYgKCFhbmltYXRpb24pIHRocm93IFwiQW5pbWF0aW9uIG5vdCBmb3VuZDogXCIgKyBhbmltYXRpb25OYW1lO1xuICAgICAgICB0aGlzLnNldEFuaW1hdGlvbihhbmltYXRpb24sIGxvb3ApO1xuICAgIH0sXG4gICAgLyoqIFNldCB0aGUgY3VycmVudCBhbmltYXRpb24uIEFueSBxdWV1ZWQgYW5pbWF0aW9ucyBhcmUgY2xlYXJlZCBhbmQgdGhlIGN1cnJlbnQgYW5pbWF0aW9uIHRpbWUgaXMgc2V0IHRvIDAuXG4gICAgICogQHBhcmFtIGFuaW1hdGlvbiBNYXkgYmUgbnVsbC4gKi9cbiAgICBzZXRBbmltYXRpb246IGZ1bmN0aW9uIChhbmltYXRpb24sIGxvb3ApIHtcbiAgICAgICAgdGhpcy5xdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9zZXRBbmltYXRpb24oYW5pbWF0aW9uLCBsb29wKTtcbiAgICB9LFxuICAgIC8qKiBAc2VlICNhZGRBbmltYXRpb24oQW5pbWF0aW9uLCBCb29sZWFuLCBOdW1iZXIpICovXG4gICAgYWRkQW5pbWF0aW9uQnlOYW1lOiBmdW5jdGlvbiAoYW5pbWF0aW9uTmFtZSwgbG9vcCwgZGVsYXkpIHtcbiAgICAgICAgdmFyIGFuaW1hdGlvbiA9IHRoaXMuZGF0YS5za2VsZXRvbkRhdGEuZmluZEFuaW1hdGlvbihhbmltYXRpb25OYW1lKTtcbiAgICAgICAgaWYgKCFhbmltYXRpb24pIHRocm93IFwiQW5pbWF0aW9uIG5vdCBmb3VuZDogXCIgKyBhbmltYXRpb25OYW1lO1xuICAgICAgICB0aGlzLmFkZEFuaW1hdGlvbihhbmltYXRpb24sIGxvb3AsIGRlbGF5KTtcbiAgICB9LFxuICAgIC8qKiBBZGRzIGFuIGFuaW1hdGlvbiB0byBiZSBwbGF5ZWQgZGVsYXkgc2Vjb25kcyBhZnRlciB0aGUgY3VycmVudCBvciBsYXN0IHF1ZXVlZCBhbmltYXRpb24uXG4gICAgICogQHBhcmFtIGRlbGF5IE1heSBiZSA8PSAwIHRvIHVzZSBkdXJhdGlvbiBvZiBwcmV2aW91cyBhbmltYXRpb24gbWludXMgYW55IG1peCBkdXJhdGlvbiBwbHVzIHRoZSBuZWdhdGl2ZSBkZWxheS4gKi9cbiAgICBhZGRBbmltYXRpb246IGZ1bmN0aW9uIChhbmltYXRpb24sIGxvb3AsIGRlbGF5KSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHt9O1xuICAgICAgICBlbnRyeS5hbmltYXRpb24gPSBhbmltYXRpb247XG4gICAgICAgIGVudHJ5Lmxvb3AgPSBsb29wO1xuXG4gICAgICAgIGlmICghZGVsYXkgfHwgZGVsYXkgPD0gMCkge1xuICAgICAgICAgICAgdmFyIHByZXZpb3VzQW5pbWF0aW9uID0gdGhpcy5xdWV1ZS5sZW5ndGggPyB0aGlzLnF1ZXVlW3RoaXMucXVldWUubGVuZ3RoIC0gMV0uYW5pbWF0aW9uIDogdGhpcy5jdXJyZW50O1xuICAgICAgICAgICAgaWYgKHByZXZpb3VzQW5pbWF0aW9uICE9IG51bGwpXG4gICAgICAgICAgICAgICAgZGVsYXkgPSBwcmV2aW91c0FuaW1hdGlvbi5kdXJhdGlvbiAtIHRoaXMuZGF0YS5nZXRNaXgocHJldmlvdXNBbmltYXRpb24sIGFuaW1hdGlvbikgKyAoZGVsYXkgfHwgMCk7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgZGVsYXkgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVudHJ5LmRlbGF5ID0gZGVsYXk7XG5cbiAgICAgICAgdGhpcy5xdWV1ZS5wdXNoKGVudHJ5KTtcbiAgICB9LFxuICAgIC8qKiBSZXR1cm5zIHRydWUgaWYgbm8gYW5pbWF0aW9uIGlzIHNldCBvciBpZiB0aGUgY3VycmVudCB0aW1lIGlzIGdyZWF0ZXIgdGhhbiB0aGUgYW5pbWF0aW9uIGR1cmF0aW9uLCByZWdhcmRsZXNzIG9mIGxvb3BpbmcuICovXG4gICAgaXNDb21wbGV0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gIXRoaXMuY3VycmVudCB8fCB0aGlzLmN1cnJlbnRUaW1lID49IHRoaXMuY3VycmVudC5kdXJhdGlvbjtcbiAgICB9XG59O1xuXG5zcGluZS5Ta2VsZXRvbkpzb24gPSBmdW5jdGlvbiAoYXR0YWNobWVudExvYWRlcikge1xuICAgIHRoaXMuYXR0YWNobWVudExvYWRlciA9IGF0dGFjaG1lbnRMb2FkZXI7XG59O1xuc3BpbmUuU2tlbGV0b25Kc29uLnByb3RvdHlwZSA9IHtcbiAgICBzY2FsZTogMSxcbiAgICByZWFkU2tlbGV0b25EYXRhOiBmdW5jdGlvbiAocm9vdCkge1xuICAgICAgICAvKmpzaGludCAtVzA2OSovXG4gICAgICAgIHZhciBza2VsZXRvbkRhdGEgPSBuZXcgc3BpbmUuU2tlbGV0b25EYXRhKCksXG4gICAgICAgICAgICBib25lRGF0YTtcblxuICAgICAgICAvLyBCb25lcy5cbiAgICAgICAgdmFyIGJvbmVzID0gcm9vdFtcImJvbmVzXCJdO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGJvbmVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgdmFyIGJvbmVNYXAgPSBib25lc1tpXTtcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBudWxsO1xuICAgICAgICAgICAgaWYgKGJvbmVNYXBbXCJwYXJlbnRcIl0pIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQgPSBza2VsZXRvbkRhdGEuZmluZEJvbmUoYm9uZU1hcFtcInBhcmVudFwiXSk7XG4gICAgICAgICAgICAgICAgaWYgKCFwYXJlbnQpIHRocm93IFwiUGFyZW50IGJvbmUgbm90IGZvdW5kOiBcIiArIGJvbmVNYXBbXCJwYXJlbnRcIl07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib25lRGF0YSA9IG5ldyBzcGluZS5Cb25lRGF0YShib25lTWFwW1wibmFtZVwiXSwgcGFyZW50KTtcbiAgICAgICAgICAgIGJvbmVEYXRhLmxlbmd0aCA9IChib25lTWFwW1wibGVuZ3RoXCJdIHx8IDApICogdGhpcy5zY2FsZTtcbiAgICAgICAgICAgIGJvbmVEYXRhLnggPSAoYm9uZU1hcFtcInhcIl0gfHwgMCkgKiB0aGlzLnNjYWxlO1xuICAgICAgICAgICAgYm9uZURhdGEueSA9IChib25lTWFwW1wieVwiXSB8fCAwKSAqIHRoaXMuc2NhbGU7XG4gICAgICAgICAgICBib25lRGF0YS5yb3RhdGlvbiA9IChib25lTWFwW1wicm90YXRpb25cIl0gfHwgMCk7XG4gICAgICAgICAgICBib25lRGF0YS5zY2FsZVggPSBib25lTWFwW1wic2NhbGVYXCJdIHx8IDE7XG4gICAgICAgICAgICBib25lRGF0YS5zY2FsZVkgPSBib25lTWFwW1wic2NhbGVZXCJdIHx8IDE7XG4gICAgICAgICAgICBza2VsZXRvbkRhdGEuYm9uZXMucHVzaChib25lRGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTbG90cy5cbiAgICAgICAgdmFyIHNsb3RzID0gcm9vdFtcInNsb3RzXCJdO1xuICAgICAgICBmb3IgKGkgPSAwLCBuID0gc2xvdHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgc2xvdE1hcCA9IHNsb3RzW2ldO1xuICAgICAgICAgICAgYm9uZURhdGEgPSBza2VsZXRvbkRhdGEuZmluZEJvbmUoc2xvdE1hcFtcImJvbmVcIl0pO1xuICAgICAgICAgICAgaWYgKCFib25lRGF0YSkgdGhyb3cgXCJTbG90IGJvbmUgbm90IGZvdW5kOiBcIiArIHNsb3RNYXBbXCJib25lXCJdO1xuICAgICAgICAgICAgdmFyIHNsb3REYXRhID0gbmV3IHNwaW5lLlNsb3REYXRhKHNsb3RNYXBbXCJuYW1lXCJdLCBib25lRGF0YSk7XG5cbiAgICAgICAgICAgIHZhciBjb2xvciA9IHNsb3RNYXBbXCJjb2xvclwiXTtcbiAgICAgICAgICAgIGlmIChjb2xvcikge1xuICAgICAgICAgICAgICAgIHNsb3REYXRhLnIgPSBzcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvcihjb2xvciwgMCk7XG4gICAgICAgICAgICAgICAgc2xvdERhdGEuZyA9IHNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yKGNvbG9yLCAxKTtcbiAgICAgICAgICAgICAgICBzbG90RGF0YS5iID0gc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IoY29sb3IsIDIpO1xuICAgICAgICAgICAgICAgIHNsb3REYXRhLmEgPSBzcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvcihjb2xvciwgMyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNsb3REYXRhLmF0dGFjaG1lbnROYW1lID0gc2xvdE1hcFtcImF0dGFjaG1lbnRcIl07XG5cbiAgICAgICAgICAgIHNrZWxldG9uRGF0YS5zbG90cy5wdXNoKHNsb3REYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNraW5zLlxuICAgICAgICB2YXIgc2tpbnMgPSByb290W1wic2tpbnNcIl07XG4gICAgICAgIGZvciAodmFyIHNraW5OYW1lIGluIHNraW5zKSB7XG4gICAgICAgICAgICBpZiAoIXNraW5zLmhhc093blByb3BlcnR5KHNraW5OYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICB2YXIgc2tpbk1hcCA9IHNraW5zW3NraW5OYW1lXTtcbiAgICAgICAgICAgIHZhciBza2luID0gbmV3IHNwaW5lLlNraW4oc2tpbk5hbWUpO1xuICAgICAgICAgICAgZm9yICh2YXIgc2xvdE5hbWUgaW4gc2tpbk1hcCkge1xuICAgICAgICAgICAgICAgIGlmICghc2tpbk1hcC5oYXNPd25Qcm9wZXJ0eShzbG90TmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIHZhciBzbG90SW5kZXggPSBza2VsZXRvbkRhdGEuZmluZFNsb3RJbmRleChzbG90TmFtZSk7XG4gICAgICAgICAgICAgICAgdmFyIHNsb3RFbnRyeSA9IHNraW5NYXBbc2xvdE5hbWVdO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGF0dGFjaG1lbnROYW1lIGluIHNsb3RFbnRyeSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXNsb3RFbnRyeS5oYXNPd25Qcm9wZXJ0eShhdHRhY2htZW50TmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYXR0YWNobWVudCA9IHRoaXMucmVhZEF0dGFjaG1lbnQoc2tpbiwgYXR0YWNobWVudE5hbWUsIHNsb3RFbnRyeVthdHRhY2htZW50TmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0YWNobWVudCAhPSBudWxsKSBza2luLmFkZEF0dGFjaG1lbnQoc2xvdEluZGV4LCBhdHRhY2htZW50TmFtZSwgYXR0YWNobWVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2tlbGV0b25EYXRhLnNraW5zLnB1c2goc2tpbik7XG4gICAgICAgICAgICBpZiAoc2tpbi5uYW1lID09IFwiZGVmYXVsdFwiKSBza2VsZXRvbkRhdGEuZGVmYXVsdFNraW4gPSBza2luO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQW5pbWF0aW9ucy5cbiAgICAgICAgdmFyIGFuaW1hdGlvbnMgPSByb290W1wiYW5pbWF0aW9uc1wiXTtcbiAgICAgICAgZm9yICh2YXIgYW5pbWF0aW9uTmFtZSBpbiBhbmltYXRpb25zKSB7XG4gICAgICAgICAgICBpZiAoIWFuaW1hdGlvbnMuaGFzT3duUHJvcGVydHkoYW5pbWF0aW9uTmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpcy5yZWFkQW5pbWF0aW9uKGFuaW1hdGlvbk5hbWUsIGFuaW1hdGlvbnNbYW5pbWF0aW9uTmFtZV0sIHNrZWxldG9uRGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2tlbGV0b25EYXRhO1xuICAgIH0sXG4gICAgcmVhZEF0dGFjaG1lbnQ6IGZ1bmN0aW9uIChza2luLCBuYW1lLCBtYXApIHtcbiAgICAgICAgLypqc2hpbnQgLVcwNjkqL1xuICAgICAgICBuYW1lID0gbWFwW1wibmFtZVwiXSB8fCBuYW1lO1xuXG4gICAgICAgIHZhciB0eXBlID0gc3BpbmUuQXR0YWNobWVudFR5cGVbbWFwW1widHlwZVwiXSB8fCBcInJlZ2lvblwiXTtcblxuICAgICAgICBpZiAodHlwZSA9PSBzcGluZS5BdHRhY2htZW50VHlwZS5yZWdpb24pIHtcbiAgICAgICAgICAgIHZhciBhdHRhY2htZW50ID0gbmV3IHNwaW5lLlJlZ2lvbkF0dGFjaG1lbnQoKTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQueCA9IChtYXBbXCJ4XCJdIHx8IDApICogdGhpcy5zY2FsZTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQueSA9IChtYXBbXCJ5XCJdIHx8IDApICogdGhpcy5zY2FsZTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQuc2NhbGVYID0gbWFwW1wic2NhbGVYXCJdIHx8IDE7XG4gICAgICAgICAgICBhdHRhY2htZW50LnNjYWxlWSA9IG1hcFtcInNjYWxlWVwiXSB8fCAxO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yb3RhdGlvbiA9IG1hcFtcInJvdGF0aW9uXCJdIHx8IDA7XG4gICAgICAgICAgICBhdHRhY2htZW50LndpZHRoID0gKG1hcFtcIndpZHRoXCJdIHx8IDMyKSAqIHRoaXMuc2NhbGU7XG4gICAgICAgICAgICBhdHRhY2htZW50LmhlaWdodCA9IChtYXBbXCJoZWlnaHRcIl0gfHwgMzIpICogdGhpcy5zY2FsZTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQudXBkYXRlT2Zmc2V0KCk7XG5cbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QgPSB7fTtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3QubmFtZSA9IG5hbWU7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0LnNjYWxlID0ge307XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0LnNjYWxlLnggPSBhdHRhY2htZW50LnNjYWxlWDtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVuZGVyZXJPYmplY3Quc2NhbGUueSA9IGF0dGFjaG1lbnQuc2NhbGVZO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZW5kZXJlck9iamVjdC5yb3RhdGlvbiA9IC1hdHRhY2htZW50LnJvdGF0aW9uICogTWF0aC5QSSAvIDE4MDtcbiAgICAgICAgICAgIHJldHVybiBhdHRhY2htZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgICAgIHRocm93IFwiVW5rbm93biBhdHRhY2htZW50IHR5cGU6IFwiICsgdHlwZTtcbiAgICB9LFxuXG4gICAgcmVhZEFuaW1hdGlvbjogZnVuY3Rpb24gKG5hbWUsIG1hcCwgc2tlbGV0b25EYXRhKSB7XG4gICAgICAgIC8qanNoaW50IC1XMDY5Ki9cbiAgICAgICAgdmFyIHRpbWVsaW5lcyA9IFtdO1xuICAgICAgICB2YXIgZHVyYXRpb24gPSAwO1xuICAgICAgICB2YXIgZnJhbWVJbmRleCwgdGltZWxpbmUsIHRpbWVsaW5lTmFtZSwgdmFsdWVNYXAsIHZhbHVlcyxcbiAgICAgICAgICAgIGksIG47XG5cbiAgICAgICAgdmFyIGJvbmVzID0gbWFwW1wiYm9uZXNcIl07XG4gICAgICAgIGZvciAodmFyIGJvbmVOYW1lIGluIGJvbmVzKSB7XG4gICAgICAgICAgICBpZiAoIWJvbmVzLmhhc093blByb3BlcnR5KGJvbmVOYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICB2YXIgYm9uZUluZGV4ID0gc2tlbGV0b25EYXRhLmZpbmRCb25lSW5kZXgoYm9uZU5hbWUpO1xuICAgICAgICAgICAgaWYgKGJvbmVJbmRleCA9PSAtMSkgdGhyb3cgXCJCb25lIG5vdCBmb3VuZDogXCIgKyBib25lTmFtZTtcbiAgICAgICAgICAgIHZhciBib25lTWFwID0gYm9uZXNbYm9uZU5hbWVdO1xuXG4gICAgICAgICAgICBmb3IgKHRpbWVsaW5lTmFtZSBpbiBib25lTWFwKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFib25lTWFwLmhhc093blByb3BlcnR5KHRpbWVsaW5lTmFtZSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IGJvbmVNYXBbdGltZWxpbmVOYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAodGltZWxpbmVOYW1lID09IFwicm90YXRlXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUgPSBuZXcgc3BpbmUuUm90YXRlVGltZWxpbmUodmFsdWVzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lLmJvbmVJbmRleCA9IGJvbmVJbmRleDtcblxuICAgICAgICAgICAgICAgICAgICBmcmFtZUluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMCwgbiA9IHZhbHVlcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlTWFwID0gdmFsdWVzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUuc2V0RnJhbWUoZnJhbWVJbmRleCwgdmFsdWVNYXBbXCJ0aW1lXCJdLCB2YWx1ZU1hcFtcImFuZ2xlXCJdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwaW5lLlNrZWxldG9uSnNvbi5yZWFkQ3VydmUodGltZWxpbmUsIGZyYW1lSW5kZXgsIHZhbHVlTWFwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZXMucHVzaCh0aW1lbGluZSk7XG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uID0gTWF0aC5tYXgoZHVyYXRpb24sIHRpbWVsaW5lLmZyYW1lc1t0aW1lbGluZS5nZXRGcmFtZUNvdW50KCkgKiAyIC0gMl0pO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aW1lbGluZU5hbWUgPT0gXCJ0cmFuc2xhdGVcIiB8fCB0aW1lbGluZU5hbWUgPT0gXCJzY2FsZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0aW1lbGluZVNjYWxlID0gMTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRpbWVsaW5lTmFtZSA9PSBcInNjYWxlXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lbGluZSA9IG5ldyBzcGluZS5TY2FsZVRpbWVsaW5lKHZhbHVlcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lID0gbmV3IHNwaW5lLlRyYW5zbGF0ZVRpbWVsaW5lKHZhbHVlcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZWxpbmVTY2FsZSA9IHRoaXMuc2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUuYm9uZUluZGV4ID0gYm9uZUluZGV4O1xuXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lSW5kZXggPSAwO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBuID0gdmFsdWVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVNYXAgPSB2YWx1ZXNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgeCA9ICh2YWx1ZU1hcFtcInhcIl0gfHwgMCkgKiB0aW1lbGluZVNjYWxlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHkgPSAodmFsdWVNYXBbXCJ5XCJdIHx8IDApICogdGltZWxpbmVTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lLnNldEZyYW1lKGZyYW1lSW5kZXgsIHZhbHVlTWFwW1widGltZVwiXSwgeCwgeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGluZS5Ta2VsZXRvbkpzb24ucmVhZEN1cnZlKHRpbWVsaW5lLCBmcmFtZUluZGV4LCB2YWx1ZU1hcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmVzLnB1c2godGltZWxpbmUpO1xuICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbiA9IE1hdGgubWF4KGR1cmF0aW9uLCB0aW1lbGluZS5mcmFtZXNbdGltZWxpbmUuZ2V0RnJhbWVDb3VudCgpICogMyAtIDNdKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgdGltZWxpbmUgdHlwZSBmb3IgYSBib25lOiBcIiArIHRpbWVsaW5lTmFtZSArIFwiIChcIiArIGJvbmVOYW1lICsgXCIpXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHNsb3RzID0gbWFwW1wic2xvdHNcIl07XG4gICAgICAgIGZvciAodmFyIHNsb3ROYW1lIGluIHNsb3RzKSB7XG4gICAgICAgICAgICBpZiAoIXNsb3RzLmhhc093blByb3BlcnR5KHNsb3ROYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICB2YXIgc2xvdE1hcCA9IHNsb3RzW3Nsb3ROYW1lXTtcbiAgICAgICAgICAgIHZhciBzbG90SW5kZXggPSBza2VsZXRvbkRhdGEuZmluZFNsb3RJbmRleChzbG90TmFtZSk7XG5cbiAgICAgICAgICAgIGZvciAodGltZWxpbmVOYW1lIGluIHNsb3RNYXApIHtcbiAgICAgICAgICAgICAgICBpZiAoIXNsb3RNYXAuaGFzT3duUHJvcGVydHkodGltZWxpbmVOYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gc2xvdE1hcFt0aW1lbGluZU5hbWVdO1xuICAgICAgICAgICAgICAgIGlmICh0aW1lbGluZU5hbWUgPT0gXCJjb2xvclwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lID0gbmV3IHNwaW5lLkNvbG9yVGltZWxpbmUodmFsdWVzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lLnNsb3RJbmRleCA9IHNsb3RJbmRleDtcblxuICAgICAgICAgICAgICAgICAgICBmcmFtZUluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMCwgbiA9IHZhbHVlcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlTWFwID0gdmFsdWVzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbG9yID0gdmFsdWVNYXBbXCJjb2xvclwiXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByID0gc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IoY29sb3IsIDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGcgPSBzcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvcihjb2xvciwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYiA9IHNwaW5lLlNrZWxldG9uSnNvbi50b0NvbG9yKGNvbG9yLCAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhID0gc3BpbmUuU2tlbGV0b25Kc29uLnRvQ29sb3IoY29sb3IsIDMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUuc2V0RnJhbWUoZnJhbWVJbmRleCwgdmFsdWVNYXBbXCJ0aW1lXCJdLCByLCBnLCBiLCBhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwaW5lLlNrZWxldG9uSnNvbi5yZWFkQ3VydmUodGltZWxpbmUsIGZyYW1lSW5kZXgsIHZhbHVlTWFwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZXMucHVzaCh0aW1lbGluZSk7XG4gICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uID0gTWF0aC5tYXgoZHVyYXRpb24sIHRpbWVsaW5lLmZyYW1lc1t0aW1lbGluZS5nZXRGcmFtZUNvdW50KCkgKiA1IC0gNV0pO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aW1lbGluZU5hbWUgPT0gXCJhdHRhY2htZW50XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZWxpbmUgPSBuZXcgc3BpbmUuQXR0YWNobWVudFRpbWVsaW5lKHZhbHVlcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICB0aW1lbGluZS5zbG90SW5kZXggPSBzbG90SW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgZnJhbWVJbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDAsIG4gPSB2YWx1ZXMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZU1hcCA9IHZhbHVlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lLnNldEZyYW1lKGZyYW1lSW5kZXgrKywgdmFsdWVNYXBbXCJ0aW1lXCJdLCB2YWx1ZU1hcFtcIm5hbWVcIl0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lcy5wdXNoKHRpbWVsaW5lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uID0gTWF0aC5tYXgoZHVyYXRpb24sIHRpbWVsaW5lLmZyYW1lc1t0aW1lbGluZS5nZXRGcmFtZUNvdW50KCkgLSAxXSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgXCJJbnZhbGlkIHRpbWVsaW5lIHR5cGUgZm9yIGEgc2xvdDogXCIgKyB0aW1lbGluZU5hbWUgKyBcIiAoXCIgKyBzbG90TmFtZSArIFwiKVwiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNrZWxldG9uRGF0YS5hbmltYXRpb25zLnB1c2gobmV3IHNwaW5lLkFuaW1hdGlvbihuYW1lLCB0aW1lbGluZXMsIGR1cmF0aW9uKSk7XG4gICAgfVxufTtcbnNwaW5lLlNrZWxldG9uSnNvbi5yZWFkQ3VydmUgPSBmdW5jdGlvbiAodGltZWxpbmUsIGZyYW1lSW5kZXgsIHZhbHVlTWFwKSB7XG4gICAgLypqc2hpbnQgLVcwNjkqL1xuICAgIHZhciBjdXJ2ZSA9IHZhbHVlTWFwW1wiY3VydmVcIl07XG4gICAgaWYgKCFjdXJ2ZSkgcmV0dXJuO1xuICAgIGlmIChjdXJ2ZSA9PSBcInN0ZXBwZWRcIilcbiAgICAgICAgdGltZWxpbmUuY3VydmVzLnNldFN0ZXBwZWQoZnJhbWVJbmRleCk7XG4gICAgZWxzZSBpZiAoY3VydmUgaW5zdGFuY2VvZiBBcnJheSlcbiAgICAgICAgdGltZWxpbmUuY3VydmVzLnNldEN1cnZlKGZyYW1lSW5kZXgsIGN1cnZlWzBdLCBjdXJ2ZVsxXSwgY3VydmVbMl0sIGN1cnZlWzNdKTtcbn07XG5zcGluZS5Ta2VsZXRvbkpzb24udG9Db2xvciA9IGZ1bmN0aW9uIChoZXhTdHJpbmcsIGNvbG9ySW5kZXgpIHtcbiAgICBpZiAoaGV4U3RyaW5nLmxlbmd0aCAhPSA4KSB0aHJvdyBcIkNvbG9yIGhleGlkZWNpbWFsIGxlbmd0aCBtdXN0IGJlIDgsIHJlY2lldmVkOiBcIiArIGhleFN0cmluZztcbiAgICByZXR1cm4gcGFyc2VJbnQoaGV4U3RyaW5nLnN1YnN0cmluZyhjb2xvckluZGV4ICogMiwgMiksIDE2KSAvIDI1NTtcbn07XG5cbnNwaW5lLkF0bGFzID0gZnVuY3Rpb24gKGF0bGFzVGV4dCwgdGV4dHVyZUxvYWRlcikge1xuICAgIHRoaXMudGV4dHVyZUxvYWRlciA9IHRleHR1cmVMb2FkZXI7XG4gICAgdGhpcy5wYWdlcyA9IFtdO1xuICAgIHRoaXMucmVnaW9ucyA9IFtdO1xuXG4gICAgdmFyIHJlYWRlciA9IG5ldyBzcGluZS5BdGxhc1JlYWRlcihhdGxhc1RleHQpO1xuICAgIHZhciB0dXBsZSA9IFtdO1xuICAgIHR1cGxlLmxlbmd0aCA9IDQ7XG4gICAgdmFyIHBhZ2UgPSBudWxsO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHZhciBsaW5lID0gcmVhZGVyLnJlYWRMaW5lKCk7XG4gICAgICAgIGlmIChsaW5lID09IG51bGwpIGJyZWFrO1xuICAgICAgICBsaW5lID0gcmVhZGVyLnRyaW0obGluZSk7XG4gICAgICAgIGlmICghbGluZS5sZW5ndGgpXG4gICAgICAgICAgICBwYWdlID0gbnVsbDtcbiAgICAgICAgZWxzZSBpZiAoIXBhZ2UpIHtcbiAgICAgICAgICAgIHBhZ2UgPSBuZXcgc3BpbmUuQXRsYXNQYWdlKCk7XG4gICAgICAgICAgICBwYWdlLm5hbWUgPSBsaW5lO1xuXG4gICAgICAgICAgICBwYWdlLmZvcm1hdCA9IHNwaW5lLkF0bGFzLkZvcm1hdFtyZWFkZXIucmVhZFZhbHVlKCldO1xuXG4gICAgICAgICAgICByZWFkZXIucmVhZFR1cGxlKHR1cGxlKTtcbiAgICAgICAgICAgIHBhZ2UubWluRmlsdGVyID0gc3BpbmUuQXRsYXMuVGV4dHVyZUZpbHRlclt0dXBsZVswXV07XG4gICAgICAgICAgICBwYWdlLm1hZ0ZpbHRlciA9IHNwaW5lLkF0bGFzLlRleHR1cmVGaWx0ZXJbdHVwbGVbMV1dO1xuXG4gICAgICAgICAgICB2YXIgZGlyZWN0aW9uID0gcmVhZGVyLnJlYWRWYWx1ZSgpO1xuICAgICAgICAgICAgcGFnZS51V3JhcCA9IHNwaW5lLkF0bGFzLlRleHR1cmVXcmFwLmNsYW1wVG9FZGdlO1xuICAgICAgICAgICAgcGFnZS52V3JhcCA9IHNwaW5lLkF0bGFzLlRleHR1cmVXcmFwLmNsYW1wVG9FZGdlO1xuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbiA9PSBcInhcIilcbiAgICAgICAgICAgICAgICBwYWdlLnVXcmFwID0gc3BpbmUuQXRsYXMuVGV4dHVyZVdyYXAucmVwZWF0O1xuICAgICAgICAgICAgZWxzZSBpZiAoZGlyZWN0aW9uID09IFwieVwiKVxuICAgICAgICAgICAgICAgIHBhZ2UudldyYXAgPSBzcGluZS5BdGxhcy5UZXh0dXJlV3JhcC5yZXBlYXQ7XG4gICAgICAgICAgICBlbHNlIGlmIChkaXJlY3Rpb24gPT0gXCJ4eVwiKVxuICAgICAgICAgICAgICAgIHBhZ2UudVdyYXAgPSBwYWdlLnZXcmFwID0gc3BpbmUuQXRsYXMuVGV4dHVyZVdyYXAucmVwZWF0O1xuXG4gICAgICAgICAgICB0ZXh0dXJlTG9hZGVyLmxvYWQocGFnZSwgbGluZSk7XG5cbiAgICAgICAgICAgIHRoaXMucGFnZXMucHVzaChwYWdlKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJlZ2lvbiA9IG5ldyBzcGluZS5BdGxhc1JlZ2lvbigpO1xuICAgICAgICAgICAgcmVnaW9uLm5hbWUgPSBsaW5lO1xuICAgICAgICAgICAgcmVnaW9uLnBhZ2UgPSBwYWdlO1xuXG4gICAgICAgICAgICByZWdpb24ucm90YXRlID0gcmVhZGVyLnJlYWRWYWx1ZSgpID09IFwidHJ1ZVwiO1xuXG4gICAgICAgICAgICByZWFkZXIucmVhZFR1cGxlKHR1cGxlKTtcbiAgICAgICAgICAgIHZhciB4ID0gcGFyc2VJbnQodHVwbGVbMF0sIDEwKTtcbiAgICAgICAgICAgIHZhciB5ID0gcGFyc2VJbnQodHVwbGVbMV0sIDEwKTtcblxuICAgICAgICAgICAgcmVhZGVyLnJlYWRUdXBsZSh0dXBsZSk7XG4gICAgICAgICAgICB2YXIgd2lkdGggPSBwYXJzZUludCh0dXBsZVswXSwgMTApO1xuICAgICAgICAgICAgdmFyIGhlaWdodCA9IHBhcnNlSW50KHR1cGxlWzFdLCAxMCk7XG5cbiAgICAgICAgICAgIHJlZ2lvbi51ID0geCAvIHBhZ2Uud2lkdGg7XG4gICAgICAgICAgICByZWdpb24udiA9IHkgLyBwYWdlLmhlaWdodDtcbiAgICAgICAgICAgIGlmIChyZWdpb24ucm90YXRlKSB7XG4gICAgICAgICAgICAgICAgcmVnaW9uLnUyID0gKHggKyBoZWlnaHQpIC8gcGFnZS53aWR0aDtcbiAgICAgICAgICAgICAgICByZWdpb24udjIgPSAoeSArIHdpZHRoKSAvIHBhZ2UuaGVpZ2h0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWdpb24udTIgPSAoeCArIHdpZHRoKSAvIHBhZ2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgcmVnaW9uLnYyID0gKHkgKyBoZWlnaHQpIC8gcGFnZS5oZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWdpb24ueCA9IHg7XG4gICAgICAgICAgICByZWdpb24ueSA9IHk7XG4gICAgICAgICAgICByZWdpb24ud2lkdGggPSBNYXRoLmFicyh3aWR0aCk7XG4gICAgICAgICAgICByZWdpb24uaGVpZ2h0ID0gTWF0aC5hYnMoaGVpZ2h0KTtcblxuICAgICAgICAgICAgaWYgKHJlYWRlci5yZWFkVHVwbGUodHVwbGUpID09IDQpIHsgLy8gc3BsaXQgaXMgb3B0aW9uYWxcbiAgICAgICAgICAgICAgICByZWdpb24uc3BsaXRzID0gW3BhcnNlSW50KHR1cGxlWzBdLCAxMCksIHBhcnNlSW50KHR1cGxlWzFdLCAxMCksIHBhcnNlSW50KHR1cGxlWzJdLCAxMCksIHBhcnNlSW50KHR1cGxlWzNdLCAxMCldO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlYWRlci5yZWFkVHVwbGUodHVwbGUpID09IDQpIHsgLy8gcGFkIGlzIG9wdGlvbmFsLCBidXQgb25seSBwcmVzZW50IHdpdGggc3BsaXRzXG4gICAgICAgICAgICAgICAgICAgIHJlZ2lvbi5wYWRzID0gW3BhcnNlSW50KHR1cGxlWzBdLCAxMCksIHBhcnNlSW50KHR1cGxlWzFdLCAxMCksIHBhcnNlSW50KHR1cGxlWzJdLCAxMCksIHBhcnNlSW50KHR1cGxlWzNdLCAxMCldO1xuXG4gICAgICAgICAgICAgICAgICAgIHJlYWRlci5yZWFkVHVwbGUodHVwbGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVnaW9uLm9yaWdpbmFsV2lkdGggPSBwYXJzZUludCh0dXBsZVswXSwgMTApO1xuICAgICAgICAgICAgcmVnaW9uLm9yaWdpbmFsSGVpZ2h0ID0gcGFyc2VJbnQodHVwbGVbMV0sIDEwKTtcblxuICAgICAgICAgICAgcmVhZGVyLnJlYWRUdXBsZSh0dXBsZSk7XG4gICAgICAgICAgICByZWdpb24ub2Zmc2V0WCA9IHBhcnNlSW50KHR1cGxlWzBdLCAxMCk7XG4gICAgICAgICAgICByZWdpb24ub2Zmc2V0WSA9IHBhcnNlSW50KHR1cGxlWzFdLCAxMCk7XG5cbiAgICAgICAgICAgIHJlZ2lvbi5pbmRleCA9IHBhcnNlSW50KHJlYWRlci5yZWFkVmFsdWUoKSwgMTApO1xuXG4gICAgICAgICAgICB0aGlzLnJlZ2lvbnMucHVzaChyZWdpb24pO1xuICAgICAgICB9XG4gICAgfVxufTtcbnNwaW5lLkF0bGFzLnByb3RvdHlwZSA9IHtcbiAgICBmaW5kUmVnaW9uOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICB2YXIgcmVnaW9ucyA9IHRoaXMucmVnaW9ucztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSByZWdpb25zLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIGlmIChyZWdpb25zW2ldLm5hbWUgPT0gbmFtZSkgcmV0dXJuIHJlZ2lvbnNbaV07XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgZGlzcG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcGFnZXMgPSB0aGlzLnBhZ2VzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IHBhZ2VzLmxlbmd0aDsgaSA8IG47IGkrKylcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZUxvYWRlci51bmxvYWQocGFnZXNbaV0ucmVuZGVyZXJPYmplY3QpO1xuICAgIH0sXG4gICAgdXBkYXRlVVZzOiBmdW5jdGlvbiAocGFnZSkge1xuICAgICAgICB2YXIgcmVnaW9ucyA9IHRoaXMucmVnaW9ucztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIG4gPSByZWdpb25zLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgICAgICAgdmFyIHJlZ2lvbiA9IHJlZ2lvbnNbaV07XG4gICAgICAgICAgICBpZiAocmVnaW9uLnBhZ2UgIT0gcGFnZSkgY29udGludWU7XG4gICAgICAgICAgICByZWdpb24udSA9IHJlZ2lvbi54IC8gcGFnZS53aWR0aDtcbiAgICAgICAgICAgIHJlZ2lvbi52ID0gcmVnaW9uLnkgLyBwYWdlLmhlaWdodDtcbiAgICAgICAgICAgIGlmIChyZWdpb24ucm90YXRlKSB7XG4gICAgICAgICAgICAgICAgcmVnaW9uLnUyID0gKHJlZ2lvbi54ICsgcmVnaW9uLmhlaWdodCkgLyBwYWdlLndpZHRoO1xuICAgICAgICAgICAgICAgIHJlZ2lvbi52MiA9IChyZWdpb24ueSArIHJlZ2lvbi53aWR0aCkgLyBwYWdlLmhlaWdodDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVnaW9uLnUyID0gKHJlZ2lvbi54ICsgcmVnaW9uLndpZHRoKSAvIHBhZ2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgcmVnaW9uLnYyID0gKHJlZ2lvbi55ICsgcmVnaW9uLmhlaWdodCkgLyBwYWdlLmhlaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnNwaW5lLkF0bGFzLkZvcm1hdCA9IHtcbiAgICBhbHBoYTogMCxcbiAgICBpbnRlbnNpdHk6IDEsXG4gICAgbHVtaW5hbmNlQWxwaGE6IDIsXG4gICAgcmdiNTY1OiAzLFxuICAgIHJnYmE0NDQ0OiA0LFxuICAgIHJnYjg4ODogNSxcbiAgICByZ2JhODg4ODogNlxufTtcblxuc3BpbmUuQXRsYXMuVGV4dHVyZUZpbHRlciA9IHtcbiAgICBuZWFyZXN0OiAwLFxuICAgIGxpbmVhcjogMSxcbiAgICBtaXBNYXA6IDIsXG4gICAgbWlwTWFwTmVhcmVzdE5lYXJlc3Q6IDMsXG4gICAgbWlwTWFwTGluZWFyTmVhcmVzdDogNCxcbiAgICBtaXBNYXBOZWFyZXN0TGluZWFyOiA1LFxuICAgIG1pcE1hcExpbmVhckxpbmVhcjogNlxufTtcblxuc3BpbmUuQXRsYXMuVGV4dHVyZVdyYXAgPSB7XG4gICAgbWlycm9yZWRSZXBlYXQ6IDAsXG4gICAgY2xhbXBUb0VkZ2U6IDEsXG4gICAgcmVwZWF0OiAyXG59O1xuXG5zcGluZS5BdGxhc1BhZ2UgPSBmdW5jdGlvbiAoKSB7fTtcbnNwaW5lLkF0bGFzUGFnZS5wcm90b3R5cGUgPSB7XG4gICAgbmFtZTogbnVsbCxcbiAgICBmb3JtYXQ6IG51bGwsXG4gICAgbWluRmlsdGVyOiBudWxsLFxuICAgIG1hZ0ZpbHRlcjogbnVsbCxcbiAgICB1V3JhcDogbnVsbCxcbiAgICB2V3JhcDogbnVsbCxcbiAgICByZW5kZXJlck9iamVjdDogbnVsbCxcbiAgICB3aWR0aDogMCxcbiAgICBoZWlnaHQ6IDBcbn07XG5cbnNwaW5lLkF0bGFzUmVnaW9uID0gZnVuY3Rpb24gKCkge307XG5zcGluZS5BdGxhc1JlZ2lvbi5wcm90b3R5cGUgPSB7XG4gICAgcGFnZTogbnVsbCxcbiAgICBuYW1lOiBudWxsLFxuICAgIHg6IDAsIHk6IDAsXG4gICAgd2lkdGg6IDAsIGhlaWdodDogMCxcbiAgICB1OiAwLCB2OiAwLCB1MjogMCwgdjI6IDAsXG4gICAgb2Zmc2V0WDogMCwgb2Zmc2V0WTogMCxcbiAgICBvcmlnaW5hbFdpZHRoOiAwLCBvcmlnaW5hbEhlaWdodDogMCxcbiAgICBpbmRleDogMCxcbiAgICByb3RhdGU6IGZhbHNlLFxuICAgIHNwbGl0czogbnVsbCxcbiAgICBwYWRzOiBudWxsLFxufTtcblxuc3BpbmUuQXRsYXNSZWFkZXIgPSBmdW5jdGlvbiAodGV4dCkge1xuICAgIHRoaXMubGluZXMgPSB0ZXh0LnNwbGl0KC9cXHJcXG58XFxyfFxcbi8pO1xufTtcbnNwaW5lLkF0bGFzUmVhZGVyLnByb3RvdHlwZSA9IHtcbiAgICBpbmRleDogMCxcbiAgICB0cmltOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLnJlcGxhY2UoL15cXHMrfFxccyskL2csIFwiXCIpO1xuICAgIH0sXG4gICAgcmVhZExpbmU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5kZXggPj0gdGhpcy5saW5lcy5sZW5ndGgpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gdGhpcy5saW5lc1t0aGlzLmluZGV4KytdO1xuICAgIH0sXG4gICAgcmVhZFZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBsaW5lID0gdGhpcy5yZWFkTGluZSgpO1xuICAgICAgICB2YXIgY29sb24gPSBsaW5lLmluZGV4T2YoXCI6XCIpO1xuICAgICAgICBpZiAoY29sb24gPT0gLTEpIHRocm93IFwiSW52YWxpZCBsaW5lOiBcIiArIGxpbmU7XG4gICAgICAgIHJldHVybiB0aGlzLnRyaW0obGluZS5zdWJzdHJpbmcoY29sb24gKyAxKSk7XG4gICAgfSxcbiAgICAvKiogUmV0dXJucyB0aGUgbnVtYmVyIG9mIHR1cGxlIHZhbHVlcyByZWFkICgyIG9yIDQpLiAqL1xuICAgIHJlYWRUdXBsZTogZnVuY3Rpb24gKHR1cGxlKSB7XG4gICAgICAgIHZhciBsaW5lID0gdGhpcy5yZWFkTGluZSgpO1xuICAgICAgICB2YXIgY29sb24gPSBsaW5lLmluZGV4T2YoXCI6XCIpO1xuICAgICAgICBpZiAoY29sb24gPT0gLTEpIHRocm93IFwiSW52YWxpZCBsaW5lOiBcIiArIGxpbmU7XG4gICAgICAgIHZhciBpID0gMCwgbGFzdE1hdGNoPSBjb2xvbiArIDE7XG4gICAgICAgIGZvciAoOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY29tbWEgPSBsaW5lLmluZGV4T2YoXCIsXCIsIGxhc3RNYXRjaCk7XG4gICAgICAgICAgICBpZiAoY29tbWEgPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWkpIHRocm93IFwiSW52YWxpZCBsaW5lOiBcIiArIGxpbmU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0dXBsZVtpXSA9IHRoaXMudHJpbShsaW5lLnN1YnN0cihsYXN0TWF0Y2gsIGNvbW1hIC0gbGFzdE1hdGNoKSk7XG4gICAgICAgICAgICBsYXN0TWF0Y2ggPSBjb21tYSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgdHVwbGVbaV0gPSB0aGlzLnRyaW0obGluZS5zdWJzdHJpbmcobGFzdE1hdGNoKSk7XG4gICAgICAgIHJldHVybiBpICsgMTtcbiAgICB9XG59XG5cbnNwaW5lLkF0bGFzQXR0YWNobWVudExvYWRlciA9IGZ1bmN0aW9uIChhdGxhcykge1xuICAgIHRoaXMuYXRsYXMgPSBhdGxhcztcbn1cbnNwaW5lLkF0bGFzQXR0YWNobWVudExvYWRlci5wcm90b3R5cGUgPSB7XG4gICAgbmV3QXR0YWNobWVudDogZnVuY3Rpb24gKHNraW4sIHR5cGUsIG5hbWUpIHtcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2Ugc3BpbmUuQXR0YWNobWVudFR5cGUucmVnaW9uOlxuICAgICAgICAgICAgdmFyIHJlZ2lvbiA9IHRoaXMuYXRsYXMuZmluZFJlZ2lvbihuYW1lKTtcbiAgICAgICAgICAgIGlmICghcmVnaW9uKSB0aHJvdyBcIlJlZ2lvbiBub3QgZm91bmQgaW4gYXRsYXM6IFwiICsgbmFtZSArIFwiIChcIiArIHR5cGUgKyBcIilcIjtcbiAgICAgICAgICAgIHZhciBhdHRhY2htZW50ID0gbmV3IHNwaW5lLlJlZ2lvbkF0dGFjaG1lbnQobmFtZSk7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlbmRlcmVyT2JqZWN0ID0gcmVnaW9uO1xuICAgICAgICAgICAgYXR0YWNobWVudC5zZXRVVnMocmVnaW9uLnUsIHJlZ2lvbi52LCByZWdpb24udTIsIHJlZ2lvbi52MiwgcmVnaW9uLnJvdGF0ZSk7XG4gICAgICAgICAgICBhdHRhY2htZW50LnJlZ2lvbk9mZnNldFggPSByZWdpb24ub2Zmc2V0WDtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVnaW9uT2Zmc2V0WSA9IHJlZ2lvbi5vZmZzZXRZO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZWdpb25XaWR0aCA9IHJlZ2lvbi53aWR0aDtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVnaW9uSGVpZ2h0ID0gcmVnaW9uLmhlaWdodDtcbiAgICAgICAgICAgIGF0dGFjaG1lbnQucmVnaW9uT3JpZ2luYWxXaWR0aCA9IHJlZ2lvbi5vcmlnaW5hbFdpZHRoO1xuICAgICAgICAgICAgYXR0YWNobWVudC5yZWdpb25PcmlnaW5hbEhlaWdodCA9IHJlZ2lvbi5vcmlnaW5hbEhlaWdodDtcbiAgICAgICAgICAgIHJldHVybiBhdHRhY2htZW50O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IFwiVW5rbm93biBhdHRhY2htZW50IHR5cGU6IFwiICsgdHlwZTtcbiAgICB9XG59XG5cbnNwaW5lLkJvbmUueURvd24gPSB0cnVlO1xuIiwidmFyIGdsb2JhbD10eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge307Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFRISVMgTU9EVUxFIElTIENPUElFRCBUTyBUSEUgQlVJTEQgRElSRUNUT1JZXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gV2hpY2ggaXMgd2hlcmUgdGhlICdwaXhpJyBwYWNrYWdlIHNob3VsZFxuLy8gaGF2ZSBhbHNvIGJlZW4gaW5zdGFsbGVkLlxuXG4vLyBUaGVzZSBnbG9iYWxzIGFyZSBzaGltcyB0byBtaW1pYyB0aGUgUGl4aSBBUEkuXG4vLyBUaGV5IGFyZSBvbmx5IGF2YWlsYWJsZSB3aGVuIHVzaW5nIHRoZSBidW5kbGVzXG4vLyBtYWRlIHdpdGggdGhpcyBtb2R1bGUuXG5cbmdsb2JhbC5QSVhJID0gcmVxdWlyZSgncGl4aScpO1xuZ2xvYmFsLnJlcXVlc3RBbmltRnJhbWUgPSByZXF1aXJlKCdwaXhpL3V0aWxzL3JhZicpO1xuIl19
