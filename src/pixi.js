/**
 * @author Dr. Kibitz <info@drkibitz.com>
 */
global.PIXI = module.exports = (function () {
    'use strict';

    var globals = require('./pixi/core/globals');
    var shaders = require('./pixi/renderers/webgl/shaders');
    var matrix  = require('./pixi/geom/matrix');

    var pixi = Object.create(globals);

    pixi.Point     = require('./pixi/geom/Point');
    pixi.Rectangle = require('./pixi/geom/Rectangle');
    pixi.Polygon   = require('./pixi/geom/Polygon');
    pixi.Circle    = require('./pixi/geom/Circle');
    pixi.Ellipse   = require('./pixi/geom/Ellipse');
    pixi.Matrix    = matrix.Matrix;
    pixi.mat3      = matrix.mat3;
    pixi.mat4      = matrix.mat4;

    pixi.blendModes             = require('./pixi/display/blendModes');
    pixi.DisplayObject          = require('./pixi/display/DisplayObject');
    pixi.DisplayObjectContainer = require('./pixi/display/DisplayObjectContainer');
    pixi.Sprite                 = require('./pixi/display/Sprite');
    pixi.MovieClip              = require('./pixi/display/MovieClip');

    pixi.FilterBlock = require('./pixi/filters/FilterBlock');

    pixi.Text       = require('./pixi/text/Text');
    pixi.BitmapText = require('./pixi/text/BitmapText');

    pixi.InteractionManager = require('./pixi/InteractionManager');
    pixi.Stage              = require('./pixi/display/Stage');

    pixi.EventTarget        = require('./pixi/events/EventTarget');

    pixi.autoDetectRenderer = require('./pixi/utils/autoDetectRenderer');
    pixi.PolyK              = require('./pixi/utils/Polyk');

    pixi.WebGLGraphics    = require('./pixi/renderers/webgl/graphics');
    pixi.WebGLRenderer    = require('./pixi/renderers/webgl/WebGLRenderer');
    pixi.WebGLBatch       = require('./pixi/renderers/webgl/WebGLBatch');
    pixi.WebGLRenderGroup = require('./pixi/renderers/webgl/WebGLRenderGroup');
    pixi.CanvasRenderer   = require('./pixi/renderers/canvas/CanvasRenderer');
    pixi.CanvasGraphics   = require('./pixi/renderers/canvas/graphics');

    pixi.Graphics = require('./pixi/primitives/Graphics');

    pixi.Strip            = require('./pixi/extras/Strip');
    pixi.Rope             = require('./pixi/extras/Rope');
    pixi.TilingSprite     = require('./pixi/extras/TilingSprite');
    pixi.Spine            = require('./pixi/extras/Spine');
    pixi.CustomRenderable = require('./pixi/extras/CustomRenderable');

    pixi.BaseTexture   = require('./pixi/textures/BaseTexture');
    pixi.Texture       = require('./pixi/textures/Texture');
    pixi.RenderTexture = require('./pixi/textures/RenderTexture');

    pixi.AssetLoader       = require('./pixi/loaders/AssetLoader');
    pixi.JsonLoader        = require('./pixi/loaders/JsonLoader');
    pixi.SpriteSheetLoader = require('./pixi/loaders/SpriteSheetLoader');
    pixi.ImageLoader       = require('./pixi/loaders/ImageLoader');
    pixi.BitmapFontLoader  = require('./pixi/loaders/BitmapFontLoader');
    pixi.SpineLoader       = require('./pixi/loaders/SpineLoader');

    pixi.initPrimitiveShader     = shaders.initPrimitiveShader;
    pixi.initDefaultShader       = shaders.initDefaultShader;
    pixi.initDefaultStripShader  = shaders.initDefaultStripShader;
    pixi.activateDefaultShader   = shaders.activateDefaultShader;
    pixi.activatePrimitiveShader = shaders.activatePrimitiveShader;

    global.requestAnimFrame = require('./pixi/utils/raf');

    /*
     * DEBUGGING ONLY
     */
    pixi.runList = function runList(item)
    {
        console.log(">>>>>>>>>")
        console.log("_")
        var safe = 0;
        var tmp = item.first;
        console.log(tmp);

        while(tmp._iNext)
        {
            safe++;
            tmp = tmp._iNext;
            console.log(tmp);
        //  console.log(tmp);

            if(safe > 100)
            {
                console.log("BREAK")
                break
            }
        }
    };

    return pixi;

}());
