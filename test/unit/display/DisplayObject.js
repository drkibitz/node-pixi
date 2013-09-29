describe('display/DisplayObject', function () {
    'use strict';

    var DisplayObject = PIXI.DisplayObject;

    it('Module exists', function () {
        expect(DisplayObject).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var obj = new DisplayObject();

        pixitest.display.DisplayObject.confirmNew(obj);
        expect(obj).to.have.property('hitArea', null);
        expect(obj).to.have.property('interactive', false);
        expect(obj).to.have.property('renderable', false);
        expect(obj).to.have.property('stage', null);
    });
});
