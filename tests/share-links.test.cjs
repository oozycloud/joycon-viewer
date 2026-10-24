const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const {webcrypto}=require('node:crypto');
const shares=require('../share-links.js');
(async()=>{
 const png='data:image/png;base64,'+'A'.repeat(65000);const source={layout:'auto',designs:{pair:{image:png,colors:{}},pro:{image:'unused'}},partAssets:{pair:{parts:{}},pro:{parts:{bad:'unused'}}},primary:'3',secondary:'2',leftColor:'#123456'};
 const snap=shares.snapshot(source,'pair');assert.equal(snap.designs.pair.image,png);assert.deepEqual(Object.keys(snap.designs),['pair']);assert.deepEqual(Object.keys(snap.partAssets),['pair']);assert(!('primary'in snap));assert.equal(source.designs.pro.image,'unused');
 const store=new Map();let writes=0;global.crypto=webcrypto;global.VIEWER_AUTH_CONFIG={url:'https://example.supabase.co',publishableKey:'public'};global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};global.ViewerAccounts={createShare:async config=>{writes++;assert.equal(config.designs.pair.image,png);return 'a'.repeat(64)}};
 const token=await shares.create(snap);assert.equal(await shares.create(snap),token);assert.equal(writes,1,'identical content reuses cached readonly capability');
 global.fetch=async(url,options)=>{assert.equal(JSON.parse(options.body).share_token,token);assert(!('Authorization'in options.headers));return {ok:true,json:async()=>JSON.parse(JSON.stringify(snap))}};
 assert.equal((await shares.read(token)).designs.pair.image,png);await assert.rejects(()=>shares.read('not-a-token'),/malformed/);global.fetch=async()=>({ok:true,json:async()=>null});await assert.rejects(()=>shares.read(token),/unavailable/);
 let appended=0;const nodes={status:{},'empty-hint':{style:{},setAttribute(){}}};const context={URLSearchParams,window:{addEventListener(){}},location:{search:'?overlay=1',hash:'#share='+token},document:{body:{classList:{add(){}},append(){appended++}},getElementById:id=>nodes[id],createElement:()=>({})},ViewerShares:{read:async()=>snap},ControllerDesignCore:{validate:x=>x},ControllerPackCore:{validate:x=>x}};
 await vm.runInNewContext(fs.readFileSync(require.resolve('../share-loader.js'),'utf8'),context);assert.equal(context.window.__VIEWER_GUEST_SHARE,true);assert.equal(context.window.__VIEWER_SHARE_CONFIG.designs.pair.image,png);assert.equal(appended,1);
 appended=0;context.ViewerShares.read=async()=>{throw Error('Unavailable fixture')};await vm.runInNewContext(fs.readFileSync(require.resolve('../share-loader.js'),'utf8'),context);assert.equal(appended,0,'failed snapshot never boots private/default app');assert.equal(nodes['empty-hint'].textContent,'Unavailable fixture');
 console.log('Share links: large exact roundtrip, pruning, dedup, capability validation, guest boot and fail-closed fixtures passed.');
})().catch(e=>{console.error(e);process.exitCode=1});

