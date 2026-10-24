const assert=require('node:assert/strict');
const core=require('../editor-core.js');
const width=7,height=5,mask=new Uint8ClampedArray(width*height*4),data=new Uint8ClampedArray(width*height*4);
for(let y=1;y<4;y++)for(let x=1;x<6;x++){mask[(y*width+x)*4+3]=255;if(x===3){data[(y*width+x)*4]=20;data[(y*width+x)*4+3]=255}}
assert.equal(core.flood(data,mask,width,height,1,2,[255,0,0,255]),6,'fill must stop at existing painted boundary and shell outline');
assert.equal(data[(2*width+4)*4+3],0,'other side of boundary remains untouched');
assert.equal(data[3],0,'outside shell remains untouched');
assert.equal(core.flood(data,mask,width,height,0,0,[0,0,255,255]),0);
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const valid=core.validate({pair:{image:png,baseWhite:true,colors:{a:{normal:'#aabbcc',pressed:'#112233'},all:{normal:'url(javascript:bad)'},malicious:{normal:'#000000'}}},pro:{image:'data:image/svg+xml,<script>bad</script>',colors:{b:{normal:'#ffffff'}}},evil:{image:png}});
assert.equal(valid.pair.image,png);assert.equal(valid.pair.baseWhite,true);assert.deepEqual(valid.pair.colors,{a:{normal:'#aabbcc',pressed:'#112233'}});assert.equal(valid.pro.image,'');assert.equal(valid.evil,undefined);
assert.equal(core.png('data:image/png;base64,PHN2Zz4='),false);
console.log('PASS: bucket respects shell and painted boundaries; design validation preserves safe data and rejects executable/non-PNG/unknown fields');
