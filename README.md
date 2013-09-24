[![Build Status](https://secure.travis-ci.org/drkibitz/node-pixi.png)](http://travis-ci.org/drkibitz/node-pixi)

Node Pixi Renderer
=============

#### JavaScript 2D Renderer ####

The aim of this project is to provide a fast lightweight 2D library that works
across all devices. The Pixi renderer allows everyone to enjoy the power of
hardware acceleration without prior knowledge of webGL. Also its fast.

If you’re interested in pixi.js then feel free to follow me on twitter
([@doormat23](https://twitter.com/doormat23)) and I will keep you posted!  And
of course check back on [our site](<http://www.goodboydigital.com/blog/>) as
any breakthroughs will be posted up there too!

### Demos ###

- [Run pixi run](<http://www.goodboydigital.com/runpixierun/>)

- [Fight for Everyone](<http://www.theleisuresociety.co.uk/fightforeveryone>)

- [Flash vs HTML](<http://flashvhtml.com>)

- [Bunny Demo](<http://www.goodboydigital.com/pixijs/bunnymark>)

- [Render Texture Demo](<http://www.goodboydigital.com/pixijs/examples/11/>)

- [Primitives Demo](<http://www.goodboydigital.com/pixijs/examples/13/>)

- [Masking Demo](<http://www.goodboydigital.com/pixijs/examples/14/>)

- [Interaction Demo](<http://www.goodboydigital.com/pixijs/examples/6/>)

- [photonstorm Balls Demo](<http://gametest.mobi/pixi/balls/>)

- [photonstorm Morph Demo](<http://gametest.mobi/pixi/morph/>)

Thanks to [@photonstorm](https://twitter.com/photonstorm) for providing those
last 2 examples and allowing us to share the source code :)

### Docs ###

[Documentation can be found here](<http://www.goodboydigital.com/pixijs/docs/>)

### Resources ###

[Tutorials and other helpful bits](<https://github.com/GoodBoyDigital/pixi.js/wiki/Resources>)

[Pixi.js forum](<http://www.html5gamedevs.com/forum/15-pixijs/>)


### Road Map ###

* Create a Typescript definition file for Pixi.js
* Implement Filters (currently being worked on by @GoodBoyDigital)
* Implement Flash animation to pixi
* Update Loader so that it support XHR2 if it is available
* Improve the Documentation of the Project
* Create an Asset Loader Tutorial
* Create a MovieClip Tutorial
* Create a small game Tutorial

### Contribute ###

Want to be part of the pixi.js project? Great! All are welcome! We will get there quicker together :)
Whether you find a bug, have a great feature request or you fancy owning a task from the road map above feel free to get in touch.

### How to build ###

PixiJS is build with Grunt. If you don't already have this, go install Node and NPM then install the Grunt Command Line.

```
$> npm install -g grunt-cli
```

Then, in the folder where you have downloaded the source, install the build dependencies using npm:

```
$> npm install
```

Then build:

```
$> grunt
```

This will create a minified version at bin/pixi.js and a non-minified version at bin/pixi.dev.js.

It also copies the non-minified version to the examples.

### Current features ###

- WebGL renderer (with automatic smart batching allowing for REALLY fast performance)
- Canvas renderer (Fastest in town!)
- Full scene graph
- Super easy to use API (similar to the flash display list API)
- Support for texture atlases
- Asset loader / sprite sheet loader
- Auto-detect which renderer should be used
- Full Mouse and Multi-touch Interaction
- Text
- BitmapFont text
- Multiline Text
- Render Texture
- Spine support
- Primitive Drawing
- Masking

### Coming soon ###

- Filters ( wip : [storm brewing](<http://www.goodboydigital.com/pixijs/storm/>) )


### Coming later ###

- Awesome Post processing effects

### Usage ###

```javascript

	var pixi = require('pixi');
	// You can use either WebGLRenderer or CanvasRenderer
	var renderer = pixi.WebGLRenderer(800, 600);

	document.body.appendChild(renderer.view);

	var stage = new pixi.Stage;

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

This content is released under the (http://opensource.org/licenses/MIT) MIT License.
