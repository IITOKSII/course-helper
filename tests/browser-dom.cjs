const {JSDOM}=require('jsdom');
const fs=require('fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('course-helper.js','utf8');
function setup(html=''){
 const dom=new JSDOM('<!doctype html><body>'+html+'</body>',{url:'https://lesson.example/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;let now=1000,id=0,timers=new Map(),queries=0;
 function rect(){return [{x:0,y:0,left:0,top:0,width:40,height:40,right:40,bottom:40}];}
 w.Element.prototype.getClientRects=rect;
 w.Date.now=()=>now;
 w.setTimeout=(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id};w.clearTimeout=id=>timers.delete(id);
 const original=d.querySelectorAll.bind(d);d.querySelectorAll=(...args)=>{queries++;return original(...args)};
 const run=()=>w.eval(source);run();
 const root=()=>d.getElementById('course-helper-v19')?.shadowRoot;
 const button=text=>[...root().querySelectorAll('button')].find(e=>e.textContent===text);
 const status=()=>root().querySelector('#status').textContent;
 const advance=ms=>{const end=now+ms;let loops=0;while(true){const job=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!job||job[1].at>end)break;timers.delete(job[0]);now=job[1].at;job[1].fn();if(++loops>5000)throw Error('timer loop');}now=end;};
 return {w,d,dom,root,button,status,advance,run,get timers(){return timers.size},get queries(){return queries},frame(html,parent=d){const f=parent.createElement('iframe');parent.body.append(f);f.contentWindow.Element.prototype.getClientRects=rect;f.contentDocument.body.innerHTML=html;return f.contentDocument;},close(){dom.window.close()}};
}
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name)}
test('startup performs zero document scans or scheduled checks; repeat install is single instance',()=>{const t=setup();assert.equal(t.queries,0);assert.equal(t.timers,0);t.run();assert.equal(t.d.querySelectorAll('#course-helper-v19').length,1);assert.equal(t.timers,0);t.close()});
test('nested lesson frame found; course slide actually changes after timeline completes',()=>{
 const t=setup();const outer=t.frame('');const d=t.frame('<main>Slide one</main><input id="seek" type="range" min="0" max="100" value="0"><button id="next" disabled>Next</button>',outer);
 let clicks=0;d.getElementById('next').onclick=()=>{clicks++;d.querySelector('main').textContent='Slide two';d.getElementById('next').disabled=true};
 t.button('Start auto').click();t.advance(90000);assert.equal(clicks,0);assert(t.status().includes('timeline'));assert.equal(t.timers,1);
 d.getElementById('seek').value='100';d.getElementById('next').disabled=false;t.advance(2000);assert.equal(clicks,1);assert(t.status().includes('confirmed'));t.button('Pause').click();assert.equal(t.timers,0);t.close();
});
test('two information pop-ups open, wait, close, then Next; no quiz answers submitted',()=>{
 const t=setup('<main id="lesson">Information lesson</main><div id="items"></div><div id="popup" data-model-id="62CBQWEhsiU" style="display:none"><button class="eventable">X</button></div><button id="next" disabled>Next</button>');
 const d=t.d,events=[];for(const id of ['one','two']){const g=d.createElement('div');g.className='slide-object-stategroup';g.dataset.modelId=id;g.innerHTML='<span data-acc-text="click icon 1" class="eventable">Info</span>';g.onclick=()=>{events.push('open '+id);d.getElementById('popup').style.display='block'};d.getElementById('items').append(g)}
 d.getElementById('popup').onclick=()=>{events.push('close');d.getElementById('popup').style.display='none';if(events.filter(e=>e==='close').length===2)d.getElementById('next').disabled=false};
 d.getElementById('next').onclick=()=>{events.push('next');d.getElementById('items').remove();d.getElementById('lesson').textContent='Next lesson';d.getElementById('next').disabled=true};
 t.button('Start auto').click();t.advance(40000);assert.deepEqual(events,['open one','close','open two','close','next']);t.button('Pause').click();t.close();
});
test('visible quiz pauses even when a preceding radio is hidden',()=>{const t=setup('<input type="radio" hidden><input type="radio"><button id="next">Next</button>');let click=0;t.d.getElementById('next').onclick=()=>click++;t.button('Start auto').click();t.advance(2000);assert.equal(click,0);assert.equal(t.timers,0);assert(t.status().includes('Question'));t.close()});
test('failed navigation clicks once and pauses instead of endlessly clicking',()=>{const t=setup('<main>Unchanging slide</main><button id="next">Next</button>');let click=0;t.d.getElementById('next').onclick=()=>click++;t.button('Start auto').click();t.advance(30000);assert.equal(click,1);assert.equal(t.timers,0);assert(t.status().includes('no slide change'));t.close()});
test('repeated Start schedules only one timer, Escape pauses, Close cleans up',()=>{const t=setup('<button id="next" disabled>Next</button>');t.button('Start auto').click();t.button('Auto running').click();assert.equal(t.timers,1);t.d.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(t.timers,0);t.button('×').click();assert.equal(t.root(),undefined);assert.equal(t.w.__courseHelper19,undefined);t.close()});
test('protected frame explains where installation must run',()=>{const t=setup();const f=t.d.createElement('iframe');t.d.body.append(f);Object.defineProperty(f,'contentDocument',{get:()=>null});t.button('Start auto').click();assert(t.status().includes('protected frame'));assert.equal(t.timers,0);t.close()});
test('different X can be taught, closed, and reused without copying console markup',()=>{
 const t=setup('<main>Lesson</main><div data-model-id="custom-x" id="popup"><button>X</button></div><button id="next" disabled>Next</button>');let closes=0;const p=t.d.getElementById('popup');p.onclick=()=>{closes++;p.style.display='none'};
 t.button('Teach pop-up X').click();p.querySelector('button').click();assert.equal(closes,1);assert(t.status().includes('learned'));p.style.display='block';t.button('Start auto').click();t.advance(10000);assert.equal(closes,2);t.button('Pause').click();t.close();
});
test('diagnostics has prior failure, no lesson content or URLs',()=>{const t=setup();t.button('Start auto').click();const prior=t.status();t.button('Show diagnostics').click();const r=JSON.parse(t.root().querySelector('textarea').value);assert.equal(r.previousStatus,prior);assert.equal(r.version,'19.0');assert(!JSON.stringify(r).includes('https:'));t.close()});
console.log(count+' DOM integration tests passed. These are jsdom tests, not live LMS/browser rendering tests.');
