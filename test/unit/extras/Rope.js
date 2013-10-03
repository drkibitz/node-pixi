describe('extras/Rope', function () {
    'use strict';

    var Rope = PIXI.Rope;
    var Texture = PIXI.Texture;
    var Point = PIXI.Point;

    it('Module exists', function () {
        expect(Rope).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var texture = Texture.fromImage('/base/test/textures/bunny.png');
        var obj = new Rope(texture, [new Point(), new Point(5, 10), new Point(10, 20)]);

        pixitest.extras.Strip.confirmNew(obj);

        expect(obj).to.be.an.instanceof(Rope);
        expect(obj).to.respondTo('refresh');
        expect(obj).to.respondTo('updateTransform');
        expect(obj).to.respondTo('setTexture');

        // TODO: Test properties
    });
});
