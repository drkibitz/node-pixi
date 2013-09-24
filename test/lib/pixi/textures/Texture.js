
function pixi_textures_Texture_confirmNew(obj, done) {
    var expect = chai.expect;

    function confirmFrameDone() {
        pixi_core_Rectangle_confirm(obj.frame, 0, 0, obj.baseTexture.width, obj.baseTexture.height);

        expect(obj).to.have.property('width', obj.baseTexture.width);
        expect(obj).to.have.property('height', obj.baseTexture.height);
        done();
    }

    expect(obj).to.be.an.instanceof(PIXI.Texture);
    pixi_utils_EventTarget_like(obj);

    expect(obj).to.have.property('baseTexture')
        .and.to.be.an.instanceof(PIXI.BaseTexture);

    expect(obj).to.have.property('scope', obj);

    expect(obj).to.have.property('trim');
    pixi_core_Point_confirm(obj.trim, 0, 0);

    expect(obj).to.have.property('frame');
    if (obj.baseTexture.hasLoaded) {
        confirmFrameDone();
    } else {
        pixi_core_Rectangle_confirm(obj.frame, 0, 0, 1, 1);
        obj.addEventListener('update', confirmFrameDone);
    }
}
