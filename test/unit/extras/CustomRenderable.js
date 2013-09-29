describe('extras/CustomRenderable', function () {
    'use strict';

    var CustomRenderable = PIXI.CustomRenderable;

    it('Module exists', function () {
        expect(CustomRenderable).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var obj = new CustomRenderable();

        pixitest.display.DisplayObject.confirmNew(obj);

        expect(obj).to.be.an.instanceof(CustomRenderable);
        expect(obj).to.respondTo('renderCanvas');
        expect(obj).to.respondTo('initWebGL');
        expect(obj).to.respondTo('renderWebGL');
    });
});
