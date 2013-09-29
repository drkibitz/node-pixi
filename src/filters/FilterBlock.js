/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
'use strict';

function FilterBlock(mask)
{
    this.graphics = mask;
    this.visible = true;
    this.renderable = true;
}

module.exports = FilterBlock;
