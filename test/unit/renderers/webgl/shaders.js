describe('renderers/webgl/shaders', function () {
    'use strict';

    var pixi = PIXI;

    it('Module members exist', function () {
        expect(pixi).to.have.property('primitiveShader');
        expect(pixi).to.have.property('stripShader');
        expect(pixi).to.have.property('defaultShader');

        expect(pixi).to.respondTo('initDefaultShaders');
        expect(pixi).to.respondTo('activatePrimitiveShader');
        expect(pixi).to.respondTo('deactivatePrimitiveShader');
        expect(pixi).to.respondTo('activateStripShader');
        expect(pixi).to.respondTo('deactivateStripShader');
    });
});
