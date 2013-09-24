[![Build Status](https://secure.travis-ci.org/drkibitz/node-pixi.png)](http://travis-ci.org/drkibitz/node-pixi)
[![NPM version](https://badge.fury.io/js/pixi.png)](http://badge.fury.io/js/pixi)

# Node Pixi Renderer

This is a fork of [Pixi.JS](https://github.com/GoodBoyDigital/pixi.js) mainly for use with [browserify](http://browserify.org/), but has also went in a slightly different direction in terms of programming style. *Basically, I am open to MAJOR refactors if they are appropriate, and it might even be completely rewritten in TypeScript in the future (not there yet). Also in the future the goals may differ from Pixi.JS. I may streamline things and standardize only on WebGL, and sooner rather than later (Saying goodbye to the 2d context).*

### Pixi.JS JavaScript 2D Renderer

The aim of this project is to provide a fast lightweight 2D library that works across all devices. The Pixi renderer allows everyone to enjoy the power of hardware acceleration without prior knowledge of [WebGL](http://en.wikipedia.org/wiki/WebGL). Also its fast.

- [Pixi.JS README](https://github.com/GoodBoyDigital/pixi.js/blob/master/README.md)
- [Pixi.JS Documentation](http://www.goodboydigital.com/pixijs/docs/)
- [Pixi.JS forum](http://www.html5gamedevs.com/forum/15-pixijs/)
- [Pixi.JS Tutorials and other helpful bits](https://github.com/GoodBoyDigital/pixi.js/wiki/Resources)

This content is released under the (http://opensource.org/licenses/MIT) MIT License.

## Install

node-pixi can be installed with [Node](http://nodejs.org/) and [NPM](https://npmjs.org/).

```shell
npm install pixi
```

## Usage

### Basic

Once installed as a `node_module`, it can now be used with browserify as follows:

Example main.js:
```javascript
// Require pixi module
var pixi = require('pixi');

// You can use either WebGLRenderer or CanvasRenderer
var renderer = pixi.WebGLRenderer(800, 600);
document.body.appendChild(renderer.view);

var stage = new pixi.Stage();
var bunnyTexture = pixi.Texture.fromImage("bunny.png");
var bunny = new pixi.Sprite(bunnyTexture);

bunny.position.x = 400;
bunny.position.y = 300;
bunny.scale.x = 2;
bunny.scale.y = 2;

stage.addChild(bunny);

requestAnimationFrame(animate);

function animate() {
	bunny.rotation += 0.01;

	renderer.render(stage);

	requestAnimationFrame(animate);
}
```

### Alternative

You can completely bypass requiring the main `pixi` module, and go directly for the submodules. This is more verbose than it should be right now, but will get better in the future. Doing this makes sure you only require what you need when you need it.

Example main.js:
```javascript
// Require modules
var Sprite = require('pixi/src/pixi/display/Sprite');
var Stage = require('pixi/src/pixi/display/Stage');
var Texture = require('pixi/src/pixi/textures/Texture');
var WebGLRenderer = require('pixi/src/pixi/renderers/webgl/WebGLRenderer');

var renderer = WebGLRenderer(800, 600);
document.body.appendChild(renderer.view);

var stage = new Stage();
// ... etc ...
```

## Coming Soon

- **node-pixi goals**
- **node-pixi roadmap**
- **node-pixi documentation**
- **either update wiki, or remove it**
- **complete unit tests, and working functional tests**

## Build from Source

node-pixi can be compiled with [Grunt](http://gruntjs.com/). If you don't already have this, go install [Node](http://nodejs.org/) and [NPM](https://npmjs.org/) then install the [Grunt Command Line](http://gruntjs.com/getting-started).
```shell
npm install -g grunt-cli
```

Get the source:
```shell
git clone https://github.com/drkibitz/node-pixi.git
```

Then, in the folder where you have downloaded the source, install the devDependencies using npm:
```shell
npm install
```

Then build:
```
grunt
```

This will lint the source, browserify the source to `bin/pixi.js`, lint the compiled file, run tests, and finally create a minified version at `bin/pixi.min.js`. It also copies the minified version to the all the example directories.

You may run a dev server to see the examples, one is provided as a task here:
```
grunt connect
```

## Contribute

Want to contribute to node-pixi? Just make a pull request or a suggestion on [Github](https://github.com/drkibitz/node-pixi/issues). Please make sure you write tests, and run them before committing changes.

If you followed the steps in the **Build from Source** section, then you can run the tests locally:
```
grunt test
```

- The test suite uses the [karma-runner](http://karma-runner.github.io/0.10/index.html)
- Tests are run for every [Travis CI](https://travis-ci.org/) build
