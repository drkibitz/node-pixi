describe('display/DisplayObjectContainer', function () {
    'use strict';

    var DisplayObjectContainer = PIXI.DisplayObjectContainer;

    it('Module exists', function () {
        expect(DisplayObjectContainer).to.be.a('function');
    });

    it('Confirm new instance', function () {
        var obj = new DisplayObjectContainer();

        pixitest.display.DisplayObjectContainer.confirmNew(obj);
        expect(obj).to.have.property('hitArea', null);
        expect(obj).to.have.property('interactive', false);
        expect(obj).to.have.property('renderable', false);
        expect(obj).to.have.property('stage', null);
    });
});
