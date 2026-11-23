import {readFile,readdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {rpcChecks,tableColumns,assertProbe,requiredRpcs} from './db-contract.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const args=process.argv.slice(2)
const isBuild=args.includes('--build')
const siteAt=args.indexOf('--site')
for(let i=0;i<args.length;i++){
  if(args[i]==='--build')continue
  if(args[i]==='--site'&&args[i+1]&&!args[i+1].startsWith('--')){i++;continue}
  throw new Error('Usage: node scripts/check-db.mjs [--build] [--site https://example.com]')
}

async function sources(dir){
  const entries=await readdir(dir,{withFileTypes:true})
  const files=await Promise.all(entries.map(async e=>e.isDirectory()?sources(path.join(dir,e.name)):/\.(tsx?|jsx?)$/.test(e.name)&&!e.name.includes('.test.')?readFile(path.join(dir,e.name),'utf8'):''))
  return files.join('\n')
}
async function jsonRequest(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)})
  const text=await response.text()
  let body
  try{body=text?JSON.parse(text):null}catch{throw new Error(`DB 검사에서 JSON 대신 잘못된 응답을 받았습니다 (HTTP ${response.status}).`)}
  return {status:response.status,body}
}

async function main(){
  const names=requiredRpcs(await sources(path.join(root,'src')))
  const {loadEnv}=await import('vite')
  const env={...loadEnv('production',root,''),...process.env}
  let url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY
  const explicitSite=siteAt>=0?args[siteAt+1]:null
  if(siteAt>=0&&!explicitSite)throw new Error('--site URL이 필요합니다.')
  if(explicitSite||(!url&&!key&&!isBuild)){
    const site=new URL(explicitSite??'https://tennis-outing-live.vercel.app')
    if(site.protocol!=='https:')throw new Error('검사 대상 사이트는 HTTPS여야 합니다.')
    const response=await fetch(site,{signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw new Error(`검사 대상 사이트 조회 실패: HTTP ${response.status}`)
    const html=await response.text()
    const asset=html.match(/src="(\/assets\/[^"?#]+\.js)"/)
    if(!asset)throw new Error('운영 사이트의 JavaScript 번들을 찾지 못했습니다.')
    const bundle=await fetch(new URL(asset[1],site),{signal:AbortSignal.timeout(15000)})
    if(!bundle.ok)throw new Error(`운영 번들 조회 실패: HTTP ${bundle.status}`)
    const js=await bundle.text()
    url=js.match(/https:\/\/[a-z0-9-]+\.supabase\.co/)?.[0]
    key=js.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]??js.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
  }
  if(!url&&!key&&isBuild&&!env.VERCEL&&!env.CI){
    console.log('DB 검사: 로컬 데모 빌드라 생략합니다. 배포 전 npm run check:db를 반드시 실행하세요.')
    return
  }
  if(!url||!key||url.includes('your-project'))throw new Error('배포 대상 Supabase URL/public key가 없어 DB 검사를 할 수 없습니다.')
  const backend=new URL(url)
  if(backend.protocol!=='https:'||!backend.hostname.endsWith('.supabase.co'))throw new Error('Supabase HTTPS 프로젝트 URL을 확인하세요.')
  const headers={apikey:key,'Content-Type':'application/json'}
  for(const [table,columns] of Object.entries(tableColumns)){
    const result=await jsonRequest(new URL(`/rest/v1/${table}?select=${columns}&limit=0`,backend),{headers})
    if(result.status!==200||!Array.isArray(result.body))throw new Error(`${table}: 필수 컬럼 또는 공개 읽기 권한 검사 실패 (HTTP ${result.status}, ${result.body?.code??'invalid response'}).`)
    console.log(`PASS columns/permissions ${table}`)
  }
  for(const name of names){
    const rule=rpcChecks[name]
    const result=await jsonRequest(new URL(`/rest/v1/rpc/${name}`,backend),{method:'POST',headers,body:JSON.stringify(rule.args)})
    assertProbe(name,result.status,result.body,rule)
    console.log(`PASS RPC/permissions ${name}`)
  }
  console.log(`DB 배포 검사 통과: ${Object.keys(tableColumns).length}개 테이블, ${names.length}개 RPC. 실제 참가자·경기·투표 기록은 변경하지 않았습니다.`)
}
main().catch(error=>{console.error(error instanceof Error?error.message:'DB 검사 실패');process.exitCode=1})
