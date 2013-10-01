[![Build Status](https://secure.travis-ci.org/drkibitz/node-pixi.png)](http://travis-ci.org/drkibitz/node-pixi)
[![NPM version](https://badge.fury.io/js/pixi.png)](http://badge.fury.io/js/pixi)

# Node Pixi Renderer

This is a fork of [Pixi.JS](https://github.com/GoodBoyDigital/pixi.js) mainly for use with [browserify](http://browserify.org/), but has also went in a slightly different direction in terms of programming style.

As of version 0.0.1, this is the first iteration and matches the public Pixi.JS API, but now modular with browserify. In later versions, the public API and architecture are subject to change and may no longer match Pixi.JS.

*Basically, I am open to MAJOR refactors if they are appropriate, and it might even be completely rewritten in TypeScript in the future (not there yet). Also in the future, the goals may differ from Pixi.JS. I may streamline things and standardize only on WebGL, and maybe sooner rather than later (Saying goodbye to context 2d).*

### Pixi.JS JavaScript 2D Renderer

The aim of this project is to provide a fast lightweight 2D library that works across all devices. The Pixi renderer allows everyone to enjoy the power of hardware acceleration without prior knowledge of [WebGL](http://en.wikipedia.org/wiki/WebGL). Also its fast.

- [Pixi.JS README](https://github.com/GoodBoyDigital/pixi.js/blob/master/README.md)
- [Pixi.JS Documentation](http://www.goodboydigital.com/pixijs/docs/)
- [Pixi.JS forum](http://www.html5gamedevs.com/forum/15-pixijs/)
- [Pixi.JS Tutorials and other helpful bits](https://github.com/GoodBoyDigital/pixi.js/wiki/Resources)

This content is released under the (http://opensource.org/licenses/MIT) MIT License.

## Examples

- [Basics](http://drkibitz.github.io/node-pixi/example/1-basics/)
- [SpriteSheet](http://drkibitz.github.io/node-pixi/example/2-sprite-sheet/)
- [MovieClip](http://drkibitz.github.io/node-pixi/example/3-movie-clip/)
- [Balls](http://drkibitz.github.io/node-pixi/example/4-balls/)
- [Morph](http://drkibitz.github.io/node-pixi/example/5-morph/)
- [Interactivity](http://drkibitz.github.io/node-pixi/example/6-interactivity/)
- [Transparent Background](http://drkibitz.github.io/node-pixi/example/7-transparent-background/)
- [Dragging](http://drkibitz.github.io/node-pixi/example/8-dragging/)
- [Tiling Texture](http://drkibitz.github.io/node-pixi/example/9-tiling-texture/)
- [Text](http://drkibitz.github.io/node-pixi/example/10-text/)
- [RenderTexture](http://drkibitz.github.io/node-pixi/example/11-render-texture/)
- [Spine](http://drkibitz.github.io/node-pixi/example/12-spine/)
- [Graphics](http://drkibitz.github.io/node-pixi/example/13-graphics/)
- [Masking](http://drkibitz.github.io/node-pixi/example/14-masking/)

## Install

node-pixi can be installed with [Node](http://nodejs.org/) and [NPM](https://npmjs.org/).

```shell
npm install pixi
```

## Usage

### Basic

Once installed as a `node_module`, it can now be used in node and with browserify.

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

## Build

node-pixi can be compiled with [Grunt](http://gruntjs.com/). If you don't already have this, go install [Node](http://nodejs.org/) and [NPM](https://npmjs.org/) then install the [Grunt Command Line](http://gruntjs.com/getting-started).
```shell
npm install -g grunt-cli
```

Get the source:
```shell
git clone https://github.com/drkibitz/node-pixi.git
```

It's important to clone the source, and not assume that the source is the same is what is published to NPM. The package on NPM is and should be considered a distributed release only, and is not compatible with the build process outlined here. To avoid any confusion about this, the published package.json has NO `devDependencies`, while the `devDependencies` of the source package.json remain.

[![devDependency Status](https://david-dm.org/drkibitz/node-pixi/dev-status.png)](https://david-dm.org/drkibitz/node-pixi#info=devDependencies)

The source repository is a valid NPM package with the same name of the distributed NPM package. Meaning it can also be installed with NPM, and directly from Github. There are a few ways to define a URL to do this between NPM and Github, just read [npm-faq](https://npmjs.org/doc/faq.html). I would recommend the following example, which runs very fast. I tend to prefer installing from Github tarballs rather than the Git protocol to avoiding transferring the history. This is a *significantly faster* installation:
```shell
npm install https://github.com/drkibitz/node-pixi/archive/master.tar.gz
```

Now with your repository cloned, install the previously mentioned `devDependencies` using NPM:
```shell
cd path/to/clone/
npm install
```

If the install was successful, you should now be able to build node-pixi with Grunt. Within your clone, run the default Grunt task:
```
grunt
```

The default task will lint the source, browserify the source to `bin/pixi.js`, lint the bundle, run tests, and finally minify the bundle at `bin/pixi.min.js`. It also copies the minified bundle to the the example directories which are a part of the **gh-pages** branch.

You should run a dev server to view the examples in the **gh-pages** branch, one is also provided as a task:
```
grunt connect
```

Please see take a look at this project's `Gruntfile.js` for more information on tasks, and task configuration.

## Contribute

Want to contribute to node-pixi? Just make a pull request or a suggestion on [Github](https://github.com/drkibitz/node-pixi/issues). Please make sure you write tests, and run them before committing changes.

If you followed the steps in the **Build from Source** section, then you can now run the tests locally:
```
grunt test
```

- The test suite uses the [karma-runner](http://karma-runner.github.io/0.10/index.html)
- The test suite expects Firefox to be installed (This can be configured in `test/karma.conf.js`)
- Tests are run for every [Travis CI](https://travis-ci.org/) build

## Coming Soon

- **node-pixi goals**
- **node-pixi roadmap**
- **node-pixi documentation**
- **either update wiki, or remove it**
- **complete unit tests, and working functional tests**
