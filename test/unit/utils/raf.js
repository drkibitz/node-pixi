describe('Utils', function () {
    'use strict';

    it('requestAnimationFrame exists', function () {
        expect(typeof requestAnimationFrame).to.equal('function');
    });

    it('cancelAnimationFrame exists', function () {
        expect(typeof cancelAnimationFrame).to.equal('function');
    });

    it('requestAnimFrame exists', function () {
        expect(typeof requestAnimFrame).to.equal('function');
    });
});
