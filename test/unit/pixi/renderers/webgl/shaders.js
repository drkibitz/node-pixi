describe('renderers/webgl/shaders', function () {
    'use strict';

    var expect = chai.expect;
    var pixi = PIXI;

    it('Module members exist', function () {
        expect(pixi).to.have.property('shaderProgram');
        expect(pixi).to.have.property('primitiveProgram');
        expect(pixi).to.have.property('stripShaderProgram');

        expect(pixi).to.respondTo('initPrimitiveShader');
        expect(pixi).to.respondTo('initDefaultShader');
        expect(pixi).to.respondTo('initDefaultStripShader');
        expect(pixi).to.respondTo('activateDefaultShader');
        expect(pixi).to.respondTo('activatePrimitiveShader');
    });
});
