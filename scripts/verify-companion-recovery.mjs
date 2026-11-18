import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output=process.env.TEST_ARTIFACT_DIR || 'artifacts/companion-recovery';await mkdir(output,{recursive:true});
const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const origin=`http://127.0.0.1:${port}`, result={checks:[],errors:[],mode:'isolated browser with actual development proxy and HTTP pairing; explicitly controlled WebSocket delivery/error/short-TTL fixtures for recovery'};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<160;i++){const x=await fn();if(x)return x;await pause(50);}throw new Error('Fixture event timeout');}
const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',ALLOWED_ORIGINS:origin},stdio:['ignore','pipe','pipe']});
let backend='',stdout='',vite,browser;
child.stdout.on('data',data=>{stdout+=data;backend=stdout.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]||'';});
try{
 await until(()=>backend);
 vite=await createServer({configFile:'vite.config.ts',envDir:false,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true,proxy:{'/room':{target:backend.replace('http:','ws:'),ws:true},'/api/agents':{target:backend}}}});await vite.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>result.errors.push(e.message));
 let mode='pass',held=[],clientRoute,inviteRequests=0;
 await page.routeWebSocket('**/room',ws=>{
  clientRoute=ws;const server=ws.connectToServer();
  ws.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='agent-invite'){inviteRequests++;if(mode==='error'){ws.send(JSON.stringify({type:'error',message:'Please slow down',requestId:m.requestId}));return;}}server.send(raw);});
  server.onMessage(raw=>{const m=JSON.parse(String(raw));if(m.type==='agent-invite'){if(mode==='hold'){held.push(m);return;}if(mode==='short')m.expiresAt=Date.now()+1000;}ws.send(JSON.stringify(m));});
 });
 await page.goto(origin+'/?room=recovery-test');await page.waitForFunction(()=>window.__beaververse,{timeout:30000});
 await page.locator('#name').fill('Recovery fixture');await page.locator('#enter').click();await page.waitForFunction(()=>window.__beaververse.snapshot().connected);
 await page.locator('#community-button').click();await page.locator('[data-community-tab=agent]').click();
 const instruction=page.locator('#agent-instruction'),create=page.locator('#create-invite');
 await create.click();await instruction.waitFor({state:'visible'});
 const line=await instruction.inputValue();assert.ok(line.includes(origin+'/api/agents'),'instruction points to development proxy');
 const paired=await fetch(origin+'/api/agents/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:line.match(/code: ([A-Za-z0-9_-]{43})/)[1]})});
 assert.equal(paired.status,201);const grant=await paired.json();assert.deepEqual(grant.scopes,['observe','wave']);
 await page.waitForFunction(()=>document.querySelector('#agent-state').textContent.includes('joined'));
 assert.equal(await instruction.inputValue(),'');await page.locator('#revoke-agent').click();
 await page.waitForFunction(()=>document.querySelector('#agent-state').textContent.includes('revoked'));
 assert.equal((await fetch(origin+'/api/agents/state',{headers:{Authorization:`Bearer ${grant.token}`}})).status,401);
 result.checks.push('actual same-origin Vite proxy invitation, default observe/wave grant, HTTP pairing and revocation');

 await pause(1100);await create.click();await instruction.waitFor({state:'visible'});
 mode='hold';const priorRequests=inviteRequests;await create.click();await until(()=>held.length===1);
 assert.equal(await instruction.inputValue(),'');assert.equal(await instruction.isHidden(),true);assert.equal(await create.isDisabled(),true);
 await page.evaluate(()=>document.querySelector('#create-invite').click());assert.equal(inviteRequests,priorRequests+1,'duplicate click blocked');
 await page.waitForFunction(()=>document.querySelector('#agent-state').textContent.includes('No invitation response'),{timeout:7000});
 assert.equal(await create.isEnabled(),true);
 await create.click();await until(()=>held.length===2);
 const old=held[0],fresh=held[1];clientRoute.send(JSON.stringify(old));await pause(120);
 assert.equal(await instruction.isHidden(),true,'late old reply cannot satisfy a new request');assert.equal(await create.isDisabled(),true);
 clientRoute.send(JSON.stringify(fresh));await instruction.waitFor({state:'visible'});assert.ok((await instruction.inputValue()).includes(fresh.code));
 result.checks.push('replacement scrubs old code; duplicate Create blocked; 5s missing-response recovery; late reply cannot revive or satisfy newer request');

 mode='error';await create.click();await page.waitForFunction(()=>document.querySelector('#agent-state').textContent.includes('not confirmed'));
 assert.equal(await instruction.inputValue(),'');assert.equal(await create.isEnabled(),true);await page.screenshot({path:`${output}/rate-recovery.png`});
 mode='short';await pause(1100);await create.click();await instruction.waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#agent-state').textContent.includes('Invitation expired'));
 assert.equal(await instruction.inputValue(),'');assert.equal(await instruction.isHidden(),true);assert.equal(await page.locator('#copy-invite').isDisabled(),true);
 result.checks.push('correlated error gives a retry path; controlled short-TTL delivery expires and removes the displayed credential');

 mode='hold';held=[];await create.click();await until(()=>held.length===1);clientRoute.close({code:1008,reason:'Synthetic disconnect'});
 await page.waitForFunction(()=>!window.__beaververse.snapshot().connected);assert.equal(await instruction.inputValue(),'');assert.equal(await create.isEnabled(),true);
 await page.locator('#revoke-agent').click();assert.match(await page.locator('#agent-state').innerText(),/Cannot confirm revocation while offline/);
 await page.screenshot({path:`${output}/offline-recovery.png`});
 result.checks.push('disconnect cancels pending invitation; offline revoke reports uncertainty instead of hanging or claiming success');
 assert.deepEqual(result.errors,[]);result.result='PASS';
}catch(error){result.result='FAIL';result.failure=String(error.stack).replace(/[A-Za-z0-9_-]{43}/g,'[redacted]');throw error;}
finally{await browser?.close();await vite?.close();child.kill();await writeFile(`${output}/verification.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
