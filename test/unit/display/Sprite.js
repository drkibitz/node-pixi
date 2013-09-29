describe('display/Sprite', function () {
    'use strict';

    var Sprite = PIXI.Sprite;
    var Texture = PIXI.Texture;

    it('Module exists', function () {
        expect(Sprite).to.be.a('function');
    });

    it('Members exist',  function () {
        expect(Sprite).itself.to.respondTo('fromImage');
        expect(Sprite).itself.to.respondTo('fromFrame');
    });

    it('Confirm new instance', function (done) {
        var texture = Texture.fromImage('/base/test/textures/SpriteSheet-Aliens.png');
        var obj = new Sprite(texture);

        pixitest.display.Sprite.confirmNew(obj, done);
    });
});
