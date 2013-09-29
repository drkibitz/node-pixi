describe('geom/Rectangle', function () {
    'use strict';

    var Rectangle = PIXI.Rectangle;

    it('Module exists', function () {
        expect(Rectangle).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var rect = new Rectangle();
        pixitest.geom.Rectangle.confirm(rect, 0, 0, 0, 0);
    });
});
