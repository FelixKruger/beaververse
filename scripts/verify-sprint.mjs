import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const url=process.env.TEST_URL||'http://127.0.0.1:8798';
const out=process.env.TEST_ARTIFACT_DIR||'artifacts/sprint';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const result={url,errors:[],checks:[],result:'FAIL'};
const snapshot=p=>p.evaluate(()=>window.__beaververse.snapshot());
async function probe(mode){
 const context=await browser.newContext({viewport:{width:1280,height:800}});const p=await context.newPage();p.on('pageerror',e=>result.errors.push(e.message));
 await p.goto(url+'/?room=sprint-check');await p.waitForFunction(()=>window.__beaververse);await p.locator('#name').fill(mode);await p.locator('#enter').click();await p.waitForFunction(()=>window.__beaververse.snapshot().connected);
 await p.locator('#world').focus();if(mode!=='walk')await p.keyboard.down('ShiftLeft');if(mode==='released')await p.keyboard.up('ShiftLeft');
 const before=(await snapshot(p)).position;const start=Date.now();await p.keyboard.down('KeyD');await p.waitForTimeout(800);await p.keyboard.up('KeyD');const end=(await snapshot(p)).position;const velocity=Math.hypot(end.x-before.x,end.z-before.z)/((Date.now()-start)/1000);
 await p.keyboard.up('ShiftLeft');await p.waitForTimeout(700);
 await p.locator('#chat-toggle').click();const typing=(await snapshot(p)).position;await p.keyboard.down('ShiftLeft');await p.keyboard.type('WASD');await p.keyboard.up('ShiftLeft');await p.waitForTimeout(200);assert.deepEqual((await snapshot(p)).position,typing,'typing cannot sprint');await p.locator('#close-chat').click();
 await p.locator('#world').focus();await p.keyboard.down('ShiftLeft');await p.keyboard.down('KeyD');await p.waitForTimeout(150);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));const stopped=(await snapshot(p)).position;await p.waitForTimeout(700);assert.deepEqual((await snapshot(p)).position,stopped,'blur clears movement and run modifier');await p.keyboard.up('KeyD');await p.keyboard.up('ShiftLeft');
 await context.close();return velocity;
}
try{
 result.walk=await probe('walk');result.run=await probe('run');result.released=await probe('released');
 assert.ok(result.run/result.walk>1.15,'Left Shift increases actual travel speed');assert.ok(Math.abs(result.released/result.walk-1)<.2,'release restores walk speed');assert.deepEqual(result.errors,[]);
 result.checks=['Left Shift increases travel','release restores walk','chat typing does not move','blur clears keys'];result.result='PASS';
}catch(e){result.failure=e.stack;throw e;}finally{await browser.close();await writeFile(out+'/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
