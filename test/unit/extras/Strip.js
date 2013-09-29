describe('extras/Strip', function () {
    'use strict';

    var Strip = PIXI.Strip;
    var Texture = PIXI.Texture;

    it('Module exists', function () {
        expect(Strip).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var texture = Texture.fromImage('/base/test/textures/bunny.png');
        var obj = new Strip(texture, 20, 10000);

        pixitest.extras.Strip.confirmNew(obj);
    });
});
