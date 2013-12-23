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
