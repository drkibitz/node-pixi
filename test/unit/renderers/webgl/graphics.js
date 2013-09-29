describe('renderers/wegbl/graphics', function () {
    'use strict';

    var webglGraphics = PIXI.WebGLGraphics;

    it('Module exists', function () {
        expect(webglGraphics).to.be.an('object');
    });

    it('Members exist', function () {
        expect(webglGraphics).to.respondTo('renderGraphics');
        expect(webglGraphics).to.respondTo('updateGraphics');
        expect(webglGraphics).to.respondTo('buildRectangle');
        expect(webglGraphics).to.respondTo('buildCircle');
        expect(webglGraphics).to.respondTo('buildLine');
        expect(webglGraphics).to.respondTo('buildPoly');
    });
});
