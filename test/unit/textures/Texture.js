describe('textures/Texture', function () {
    'use strict';

    var Texture = PIXI.Texture;

    it('Module exists', function () {
        expect(Texture).to.be.a('function');
    });

    it('Members exist',  function () {
        expect(Texture).itself.to.respondTo('fromImage');
        expect(Texture).itself.to.respondTo('fromFrame');
        expect(Texture).itself.to.respondTo('fromCanvas');
        expect(Texture).itself.to.respondTo('addTextureToCache');
        expect(Texture).itself.to.respondTo('removeTextureFromCache');

        expect(Texture).itself.to.have.property('cache').and.to.be.an('object');
        expect(Texture).itself.to.have.deep.property('frameUpdates.length', 0);
    });

    it('Confirm new instance', function (done) {
        var texture = Texture.fromImage('/base/test/textures/bunny.png');
        pixitest.textures.Texture.confirmNew(texture, done);
    });
});
