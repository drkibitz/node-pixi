describe('pixi/display/blendModes', function () {
    'use strict';

    var expect = chai.expect;
    var blendModes = PIXI.blendModes;

    it('Module exists', function () {
        expect(blendModes).to.be.an('object');
    });

    it('Members exist', function () {
        expect(blendModes).to.have.property('NORMAL', 0);
        expect(blendModes).to.have.property('SCREEN', 1);
    });
});
