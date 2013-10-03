describe('geom/matrix', function () {
    'use strict';

    var mat3 = PIXI.mat3;
    var mat4 = PIXI.mat4;
    var Matrix = PIXI.Matrix;

    it('Ensure determineMatrixArrayType works', function () {
        expect(Matrix).to.be.a('function');
    });

    it('mat3 exists', function () {
        expect(mat3).to.be.an('object');
    });

    it('Confirm new mat3 matrix', function () {
        var matrix = new mat3.create();
        pixitest.geom.matrix.confirmNewMat3(matrix);
    });

    it('mat3 exists', function () {
        expect(mat4).to.be.an('object');
    });

    it('Confirm new mat4 matrix', function () {
        var matrix = new mat4.create();
        pixitest.geom.matrix.confirmNewMat4(matrix);
    });
});
