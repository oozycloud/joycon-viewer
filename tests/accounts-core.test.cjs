const assert=require('node:assert/strict');
const {create,snapshot}=require('../accounts-core.js');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
let local={design:'local'},writes=[],events=[],applyCalls=0;
const service={loadState:async id=>({config:{design:'cloud-'+id}}),saveState:async(owner,config)=>writes.push({owner,config})};
const core=create({service,snapshot:()=>({...local}),apply:async c=>{applyCalls++;local={...c};core.changed()},status:s=>events.push(s),delay:5});
await core.connect({id:'A'});core.changed();await wait(10);assert.equal(writes.length,0,'sign-in must not overwrite either side before explicit choice');
await core.chooseRemote();assert.equal(local.design,'cloud-A');assert.equal(writes.length,0,'loading cloud must not trigger a save echo');
local.design='edited-A';core.changed();await wait(20);assert.equal(writes.at(-1).owner,'A');assert.equal(writes.at(-1).config.design,'edited-A');
await core.connect({id:'B'});local.design='old-browser-A';core.changed();await wait(10);assert.equal(writes.length,1,'new account must require a new explicit choice');await core.chooseRemote();assert.equal(local.design,'cloud-B');
local.design='B-new';core.changed();core.disconnect();await wait(15);assert.equal(writes.length,1,'sign-out cancels queued autosave');
let release;local={design:'A-inflight'};const inflight=create({service:{loadState:async()=>null,saveState:(owner,config)=>{writes.push({owner,config});return new Promise(r=>release=r)}},snapshot:()=>({...local}),apply:async()=>{},status:s=>events.push(s),delay:5});await inflight.connect({id:'A'});const pending=inflight.chooseLocal();await wait(0);await inflight.connect({id:'B'});release();await pending;assert.equal(inflight.getState().owner,'B');assert.equal(inflight.getState().enabled,false,'stale completion cannot enable autosave for another account');
let fail=true;events=[];const retry=create({service:{loadState:async()=>null,saveState:async()=>{if(fail)throw Error('offline')}},snapshot:()=>({design:'offline-edit'}),apply:async()=>{},status:s=>events.push(s)});await retry.connect({id:'C'});await retry.chooseLocal();assert.equal(events.at(-1).kind,'unsynced');assert.notEqual(retry.getState().saved,retry.getState().dirty);fail=false;await retry.retry();assert.equal(events.at(-1).kind,'synced');
const safe=snapshot({design:'yes',password:'never',relayUrl:'secret',room:'local'},v=>({design:v.design,relayUrl:v.relayUrl,room:v.room}));assert.deepEqual(safe,{design:'yes'});
console.log('PASS (mock service): explicit first-login choice, no load echo, owner-switch/in-flight isolation, sign-out timer cancellation, honest unsynced retry, credential/transport-free snapshot');
})().catch(e=>{console.error(e);process.exitCode=1});
