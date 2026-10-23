(function(root){
'use strict';
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function ds4BluetoothOutput(){const report=new Uint8Array(78);report[0]=0x11;report[1]=0xc4;const input=new Uint8Array(75);input[0]=0xa2;input.set(report.subarray(0,74),1);new DataView(report.buffer).setUint32(74,crc32(input),true);return report.subarray(1)}
function parseDS4(reportId,data){let offset;if(reportId===1&&data.byteLength>=63)offset=0;else if(reportId===0x11&&data.byteLength>=77)offset=2;else return null;return {gyro:[12,14,16].map(i=>data.getInt16(offset+i,true)/16.4),accel:[18,20,22].map(i=>data.getInt16(offset+i,true)/8192),transport:offset?'Bluetooth':'USB',nominal:true}}
function separateJoycons(a,b){return !!(a&&b&&a.index!==b.index&&/joy.con/i.test(a.id)&&/joy.con/i.test(b.id))}
function axisSource(a,b,separate){return {right:separate?b:a,x:separate?'prx':'rx',y:separate?'pry':'ry'}}
function filterGyro(gyro,deadzone=1){const threshold=Number.isFinite(Number(deadzone))?Math.max(0,Number(deadzone)):1;return Math.hypot(...gyro)<threshold?[0,0,0]:Array.from(gyro)}
function accelAngles(accel){const [x,y,z]=accel;return {horizontal:Math.atan2(-x,Math.hypot(y,z))*180/Math.PI,vertical:Math.atan2(y,Math.hypot(x,z))*180/Math.PI}}
function motionDirection(accel,neutral,threshold=3){const angles=accelAngles(accel);const horizontal=angles.horizontal-neutral.horizontal,vertical=angles.vertical-neutral.vertical;return {horizontal,vertical,active:Math.hypot(horizontal,vertical)>=threshold,angle:Math.atan2(horizontal,-vertical)*180/Math.PI}}
const api={accelAngles,motionDirection,filterGyro,crc32,ds4BluetoothOutput,parseDS4,separateJoycons,axisSource};if(typeof module==='object'&&module.exports)module.exports=api;root.SignalInput=api;
})(typeof globalThis==='object'?globalThis:this);
