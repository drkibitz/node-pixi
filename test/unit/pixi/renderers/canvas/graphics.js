describe('renders/canvas/graphics', function () {
    'use strict';

    var expect = chai.expect;
    var canvasGraphics = PIXI.CanvasGraphics;

    it('Module exists', function () {
        expect(canvasGraphics).to.be.an('object');
    });

    it('Members exist', function () {
        expect(canvasGraphics).to.respondTo('renderGraphics');
        expect(canvasGraphics).to.respondTo('renderGraphicsMask');
    });
});
