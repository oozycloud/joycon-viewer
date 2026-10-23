'use strict';
const assert=require('node:assert/strict');
const {parseDS4,crc32,ds4BluetoothOutput,separateJoycons,axisSource}=require('../input-core.js');
function fixture(id,size,base){const d=new DataView(new ArrayBuffer(size));[164,-328,820].forEach((v,i)=>d.setInt16(base+12+i*2,v,true));[8192,-4096,16384].forEach((v,i)=>d.setInt16(base+18+i*2,v,true));return parseDS4(id,d)}
for(const data of [fixture(1,63,0),fixture(0x11,77,2)]){assert.deepEqual(data.gyro,[10,-20,50.00000000000001]);assert.deepEqual(data.accel,[1,-.5,2]);assert.equal(data.nominal,true)}
assert.equal(fixture(1,63,0).transport,'USB');assert.equal(fixture(0x11,77,2).transport,'Bluetooth');
assert.equal(parseDS4(1,new DataView(new ArrayBuffer(9))),null,'minimal BT report has no motion');
assert.equal(parseDS4(0x11,new DataView(new ArrayBuffer(24))),null,'short report rejected');
assert.equal(parseDS4(0x30,new DataView(new ArrayBuffer(80))),null,'other controllers cannot masquerade as DS4');
assert.equal(crc32(Buffer.from('123456789')),0xcbf43926,'standard CRC32 reference vector');
const payload=ds4BluetoothOutput();assert.equal(payload.length,77);assert.equal(payload[0],0xc4);const bytes=new Uint8Array(75);bytes.set([0xa2,0x11]);bytes.set(payload.subarray(0,73),2);assert.equal(new DataView(payload.buffer,payload.byteOffset,payload.byteLength).getUint32(73,true),crc32(bytes),'Bluetooth output CRC includes A2 seed and report ID');
const ps4={index:0,id:'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)',axes:[.2,-.3,.8,-.7]};const extra={index:1,id:'Xbox',axes:[-.9,.9]};assert.equal(separateJoycons(ps4,extra),false);const ps4Route=axisSource(ps4,extra,false);assert.equal(ps4Route.right,ps4);assert.equal(ps4Route.x,'rx');assert.equal(ps4.axes[2],.8);assert.equal(ps4.axes[3],-.7);
const left={index:2,id:'Joy-Con (L)'},right={index:3,id:'Joy-Con (R)'};assert.equal(separateJoycons(left,right),true);assert.deepEqual(axisSource(left,right,true),{right,x:'prx',y:'pry'});assert.equal(separateJoycons(left,left),false);
console.log('PASS: signed USB/BT IMU offsets, minimal rejection, nominal units, CRC, PS4 same-device sticks, separate Joy-Con routing');

const {filterGyro}=require('../input-core.js');
assert.deepEqual(filterGyro([.9,0,0]),[0,0,0],'under default threshold zeros all axes');
assert.deepEqual(filterGyro([1,0,0]),[1,0,0],'at threshold unchanged');
assert.deepEqual(filterGyro([.6,.6,.6]),[.6,.6,.6],'vector magnitude above one keeps every axis despite each axis below one');
assert.deepEqual(filterGyro([-.3,.4,0]),[0,0,0],'under threshold diagonal zeros entire vector');
assert.deepEqual(filterGyro([2,0,0],3),[0,0,0],'custom threshold');
assert.deepEqual(filterGyro([.01,0,0],0),[.01,0,0],'zero disables deadzone without rescaling');
const original=[.3,.4,0];filterGyro(original,1);assert.deepEqual(original,[.3,.4,0],'raw source preserved');
console.log('PASS: Ryujinx vector deadzone below/at threshold, multi-axis magnitude, custom threshold and immutable raw samples');

const {gyroDirections}=require('../input-core.js');
for(const [gyro,name]of [[[2,0,0],'down'],[[-2,0,0],'up'],[[0,2,0],'right'],[[0,-2,0],'left']]){const d=gyroDirections(gyro);assert.equal(d[name],true,name+' signed gyro activates');assert.equal(['up','down','left','right'].filter(k=>d[k]).length,1)}
assert.equal(gyroDirections([.9,0,0]).down,false,'inside threshold inactive');assert.equal(gyroDirections([1,0,0]).down,true,'at threshold active');assert.equal(gyroDirections([0,0,20]).down,false,'roll-only no pointing');assert.equal(gyroDirections([0,0,20]).right,false,'roll-only no yaw');assert.equal(gyroDirections([.8,.8,0]).down,false,'whole vector passes but each pointing axis still below deadzone');assert.equal(gyroDirections([2,2,0]).down&&gyroDirections([2,2,0]).right,true,'diagonal adjacent arrows');assert.equal(gyroDirections([2,2,0],1,true,true).up&&gyroDirections([2,2,0],1,true,true).left,true,'inverted both axes');
for(const sign of [-1,1]){const v=new DataView(new ArrayBuffer(63));v.setInt16(12,sign*164,true);const sample=parseDS4(1,v);const d=gyroDirections(sample.gyro);assert.equal(sign<0?d.up:d.down,true,'USB signed pitch reaches directional render state')}
assert.equal(Object.values(gyroDirections([0,0,0])).filter(v=>v===true).length,0,'rest clears all');console.log('PASS: gyro D-pad signed pitch/yaw, USB down/up fixtures, deadzone, diagonals, roll-only, inversion and rest');

for(const sign of [-1,1]){assert.equal(gyroDirections([59*sign,0,0],60)[sign<0?'up':'down'],false,'large threshold 59 inactive');assert.equal(gyroDirections([60*sign,0,0],60)[sign<0?'up':'down'],true,'large threshold 60 active');assert.equal(gyroDirections([100*sign,0,0],60)[sign<0?'up':'down'],true,'deliberate 100 up/down active')};console.log('PASS: large motion deadzone signed 59 inactive, 60 threshold and 100 active');
