describe('primitives/Graphics', function () {
    'use strict';

    var Graphics = PIXI.Graphics;

    it('Module exists', function () {
        expect(Graphics).to.be.a('function');

        expect(Graphics).itself.to.have.property('POLY', 0);
        expect(Graphics).itself.to.have.property('RECT', 1);
        expect(Graphics).itself.to.have.property('CIRC', 2);
        expect(Graphics).itself.to.have.property('ELIP', 3);
    });

    it('Confirm new instance', function () {
        var obj = new Graphics();

        pixitest.display.DisplayObjectContainer.confirmNew(obj);

        expect(obj).to.be.an.instanceof(Graphics);
        expect(obj).to.respondTo('lineStyle');
        expect(obj).to.respondTo('lineStyle');
        expect(obj).to.respondTo('moveTo');
        expect(obj).to.respondTo('lineTo');
        expect(obj).to.respondTo('beginFill');
        expect(obj).to.respondTo('endFill');
        expect(obj).to.respondTo('drawRect');
        expect(obj).to.respondTo('drawCircle');
        expect(obj).to.respondTo('drawElipse');
        expect(obj).to.respondTo('clear');

        expect(obj).to.have.property('renderable', true);
        expect(obj).to.have.property('fillAlpha', 1);
        expect(obj).to.have.property('lineWidth', 0);
        expect(obj).to.have.property('lineColor', 'black');
        expect(obj).to.have.deep.property('graphicsData.length', 0);
        expect(obj).to.have.deep.property('currentPath.points.length', 0);
    });
});
