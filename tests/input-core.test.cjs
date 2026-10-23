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

const {accelAngles,motionDirection}=require('../input-core.js');
const neutral=accelAngles([0,0,1]);
for(const [accel,expected,label]of [[[0,-.5,1],0,'up'],[[-.5,0,1],90,'right'],[[0,.5,1],180,'down'],[[.5,0,1],-90,'left'],[[-.5,-.5,1],45,'up right'],[[.5,.5,1],-135,'down left']]){const d=motionDirection(accel,neutral);assert.equal(d.active,true,label+' appears');assert.ok(Math.abs(d.angle-expected)<.0001,label+' correct direction')}
assert.equal(motionDirection([0,0,1],neutral).active,false,'neutral hidden');assert.equal(motionDirection([-.02,0,1],neutral).active,false,'small tilt below three degrees hidden');const shifted=[-.5,.4,1];assert.equal(motionDirection(shifted,accelAngles(shifted)).active,false,'recenter defines new neutral');console.log('PASS: motion arrow up/down/left/right/diagonals, neutral threshold, recenter');
