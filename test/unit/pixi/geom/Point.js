describe('pixi/geom/Point', function () {
    'use strict';

    var expect = chai.expect;
    var Point = PIXI.Point;

    it('Module exists', function () {
        expect(Point).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var obj = new Point();
        pixi_geom_Point_confirm(obj, 0, 0);
    });
});
