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
