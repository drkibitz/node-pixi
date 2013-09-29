/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

var globals = require('./core/globals');
var Point = require('./geom/Point');
var Sprite = require('./display/Sprite');

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
        if (this.target !== null) window.removeEventListener('mouseup', this, true);
    } else if (this.interactionDOMElement === null) {
        this.setTargetDomElement( target.view );
    }

    window.addEventListener('mouseup', this, true);
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


    if (window.navigator.msPointerEnabled) {
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
    this.mouse.originalEvent = event || window.event; //IE uses window.event
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
    this.mouse.originalEvent = event || window.event; //IE uses window.event

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
    this.mouse.originalEvent = event || window.event; //IE uses window.event

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
        touchData.originalEvent =  event || window.event;

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

        touchData.originalEvent =  event || window.event;

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
    //this.mouse.originalEvent = event || window.event; //IE uses window.event
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
                touchData.originalEvent =  event || window.event;
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
