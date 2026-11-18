import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import snapshot from '../src/content/shared-nav.json' with { type: 'json' }
import { createSiteNavigation, navigationText, validateSharedNavigation } from '../src/lib/shared-navigation.js'
import { syncSharedNavigation } from '../scripts/sync-shared-nav.js'

test('a new source service automatically appears in both menus and footer with real URLs', () => {
  const data = structuredClone(snapshot)
  const item = { label: { ru: 'Проверка новой услуги', kk: '' }, href: 'https://nexcel.kz/new-service' }
  data.nav.push(item);data.footer.columns[0].links.push(item)
  const model = createSiteNavigation(data)
  assert.ok(model.servicePages.includes(item.href))
  assert.equal(model.links[item.href],item.href)
  assert.equal(model.label(item.href,'ru'),item.label.ru)
  assert.equal(model.label(item.href,'kz',undefined,true),item.label.ru)
  assert.ok(model.servicePages.includes('websites'))
  assert.ok(model.servicePages.includes('photo'))
  assert.deepEqual(model.footerCompanyPages,['about','news','templates','partners','faq'])
})

test('source labels override old Russian labels; existing KZ is retained until kk is supplied', () => {
  assert.equal(navigationText({ru:'Новая подпись',kk:''},'ru','Старая подпись'),'Новая подпись')
  assert.equal(navigationText({ru:'Новая подпись',kk:''},'kz','Бар аударма'),'Бар аударма')
  assert.equal(navigationText({ru:'Новая подпись',kk:'Жаңа аударма'},'kz','Бар аударма'),'Жаңа аударма')
  assert.equal(navigationText({ru:'Новая услуга',kk:''},'kz'),'Новая услуга')
})

test('invalid versions, unsafe links, missing labels and duplicate entries fail before publication', () => {
  for (const mutate of [data=>{data.version=2}, data=>{data.nav[0].href='javascript:alert(1)'}, data=>{delete data.nav[0].label.kk},
    data=>{data.nav.push(data.nav[0])},data=>{data.footer.legal={text:'invalid'}}]) {
    const data=structuredClone(snapshot);mutate(data);assert.throws(()=>validateSharedNavigation(data))
  }
})

async function files(t) {
  const directory=await mkdtemp(join(tmpdir(),'nexcel-shared-nav-'))
  const snapshotFile=join(directory,'nav.json'),logoFile=join(directory,'logo.json')
  t.after(async()=>{for(const file of [snapshotFile,logoFile])await unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error});await rmdir(directory)})
  return {snapshot:snapshotFile,logoSnapshot:logoFile}
}

test('build sync only downloads public JSON/logo and keeps offline use explicit', async t => {
  const target=await files(t),calls=[]
  const result=await syncSharedNavigation({...target,request:async(url,options)=>{
    calls.push({url,options})
    if(calls.length===1)return {ok:true,json:async()=>snapshot}
    return {ok:true,headers:new Headers({'content-type':'image/svg+xml'}),arrayBuffer:async()=>Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')}
  }})
  assert.equal(result.offline,false)
  assert.equal(calls.length,2)
  assert.ok(calls.every(({options})=>!options.method&&!options.body))
  assert.ok(calls[0].url.startsWith('https://nexcel.kz/shared/nav.json?build='))
  assert.deepEqual(JSON.parse(await readFile(target.snapshot,'utf8')),snapshot)
  const offline=await syncSharedNavigation({...target,offline:true,request:()=>assert.fail('Offline build must not fetch')})
  assert.equal(offline.offline,true)
})

test('invalid remote JSON never overwrites the saved navigation and does not silently fall back', async t => {
  const target=await files(t)
  await writeFile(target.snapshot,JSON.stringify(snapshot))
  await assert.rejects(()=>syncSharedNavigation({...target,request:async()=>({ok:true,json:async()=>({version:2})})}),/структура/)
  assert.deepEqual(JSON.parse(await readFile(target.snapshot,'utf8')),snapshot)
})
