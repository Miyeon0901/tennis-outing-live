import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {rpcChecks,requiredRpcs,assertProbe} from './db-contract.mjs'

test('missing voting RPC blocks deployment instead of treating 404 as a valid rejection',()=>{
  assert.throws(()=>assertProbe('set_fashion_votes',404,{code:'PGRST202'},rpcChecks.set_fashion_votes),/DB 검사 실패/)
})
test('missing execute permission blocks deployment',()=>{
  assert.throws(()=>assertProbe('set_fashion_votes',403,{code:'42501'},rpcChecks.set_fashion_votes),/DB 검사 실패/)
})
test('the expected business rejection proves the public voting RPC is callable',()=>{
  assert.doesNotThrow(()=>assertProbe('set_fashion_votes',400,{code:'P0001',message:'활성 참가자만 투표할 수 있습니다.'},rpcChecks.set_fashion_votes))
  assert.throws(()=>assertProbe('set_fashion_votes',200,null,rpcChecks.set_fashion_votes),/DB 검사 실패/)
})
test('new or dynamically named RPCs cannot silently bypass the deployment check',()=>{
  assert.throws(()=>requiredRpcs("client.rpc('new_function', {})"),/등록되지 않은/)
  assert.throws(()=>requiredRpcs('client.rpc(functionName, {})'),/동적 RPC/)
  assert.deepEqual(requiredRpcs("client.rpc('set_fashion_votes', {});client.rpc(\"set_fashion_votes\", {})"),['set_fashion_votes'])
})
test('read-only authentication probes reject an unexpectedly authenticated response',()=>{
  assert.doesNotThrow(()=>assertProbe('verify_admin_pin',200,false,rpcChecks.verify_admin_pin))
  assert.throws(()=>assertProbe('verify_admin_pin',200,true,rpcChecks.verify_admin_pin),/DB 검사 실패/)
})
test('probe inputs cannot name a real match, voter or administrator credential',()=>{
  for(const rule of Object.values(rpcChecks))for(const [key,value] of Object.entries(rule.args)){
    if(['p_match_id','p_voter_id','p_admin_token','p_pin'].includes(key))assert.equal(value,null)
    if(Array.isArray(value))assert.deepEqual(value,[])
  }
})
test('a hosted build without DB configuration fails rather than skipping the gate',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),temp=mkdtempSync(path.join(tmpdir(),'tennis-db-gate-'))
  try{
    mkdirSync(path.join(temp,'scripts'));mkdirSync(path.join(temp,'src'))
    for(const file of ['check-db.mjs','db-contract.mjs'])copyFileSync(path.join(root,'scripts',file),path.join(temp,'scripts',file))
    writeFileSync(path.join(temp,'src','hook.ts'),"client.rpc('set_fashion_votes', {})")
    symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir')
    const result=spawnSync(process.execPath,[path.join(temp,'scripts','check-db.mjs'),'--build'],{env:{VERCEL:'1'},encoding:'utf8'})
    assert.equal(result.status,1)
    assert.match(result.stderr,/Supabase URL\/public key/)
  }finally{rmSync(temp,{recursive:true,force:true})}
})
