describe('extras/TilingSprite', function () {
    'use strict';

    var TilingSprite = PIXI.TilingSprite;
    var Texture = PIXI.Texture;

    it('Module exists', function () {
        expect(TilingSprite).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var texture = Texture.fromImage('/base/test/textures/bunny.png');
        var obj = new TilingSprite(texture, 6000, 12000);

        pixitest.display.DisplayObjectContainer.confirmNew(obj);

        expect(obj).to.be.an.instanceof(TilingSprite);
        expect(obj).to.respondTo('setTexture');
        expect(obj).to.respondTo('onTextureUpdate');

        // TODO: Test properties
    });
});
