'use strict';
const assert=require('node:assert/strict');const {parseDS4Controls}=require('../input-core.js');
for(const [id,size,offset]of [[1,63,0],[0x11,77,2]]){
 const v=new DataView(new ArrayBuffer(size));[128,128,255,0].forEach((n,i)=>v.setUint8(offset+i,n));v.setUint8(offset+4,0x22);v.setUint8(offset+5,0x91);v.setUint8(offset+6,3);v.setUint8(offset+7,255);v.setUint8(offset+8,128);const p=parseDS4Controls(id,v);
 assert.deepEqual(p.axes,[0,0,1,-1]);for(const i of [0,4,6,8,11,15,16,17])assert.equal(p.buttons[i].value,1,'expected button '+i);assert.equal(p.buttons[12].value,0);assert.equal(p.buttons[7].value,128/255);assert.equal(p.buttons[1].value,0);
}
assert.equal(parseDS4Controls(1,new DataView(new ArrayBuffer(9))),null);console.log('PASS: USB and Bluetooth direct PS4 buttons, hat, triggers and sticks');
