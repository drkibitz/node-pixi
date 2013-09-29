describe('geom/Point', function () {
    'use strict';

    var Point = PIXI.Point;

    it('Module exists', function () {
        expect(Point).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var obj = new Point();
        pixitest.geom.Point.confirm(obj, 0, 0);
    });
});
