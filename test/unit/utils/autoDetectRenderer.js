describe('utils/autoDetectRenderer', function () {
    'use strict';

    var autoDetectRenderer = PIXI.autoDetectRenderer;

    it('Module exists', function () {
        expect(autoDetectRenderer).to.be.a('function');
    });
});
