(() => {
  'use strict';
  const VERSION = '19.0';
  const KEY = '__courseHelper19';
  if (window[KEY]) { window[KEY].show(); return; }
  // Refresh is recommended when replacing older builds. Stop known old timers.
  if (typeof window.__chPCStop === 'function') {
    try { window.__chPCStop(); } catch (error) { console.warn('Old helper cleanup:', error); }
  }
  const host = document.createElement('div');
  host.id = 'course-helper-v19';
  host.style.cssText = 'all:initial!important;position:fixed!important;top:16px!important;right:16px!important;z-index:2147483647!important;display:block!important;';
  const root = host.attachShadow({mode:'open'});
  function make(tag, text, parent = root) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    parent.appendChild(el);
    return el;
  }
  const style = make('style');
  style.textContent = ':host{color-scheme:dark}*{box-sizing:border-box}.panel{width:330px;max-width:90vw;background:#142234;color:#f4f7fc;border:1px solid #66839c;border-radius:14px;box-shadow:0 8px 30px #0006;font:14px/1.5 system-ui;padding:14px}header{display:flex;align-items:center;gap:8px;cursor:move;touch-action:none}strong{flex:1}button,select{font:inherit;color:#fff;background:#293d52;border:1px solid #6d8ca8;border-radius:8px;padding:8px;cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #8de3d5}button.primary{background:#166c60}p{margin:10px 0}nav{display:flex;gap:7px;flex-wrap:wrap}small{display:block;color:#b8cbdc}details{margin-top:10px}textarea{width:100%;height:150px;background:#0c1725;color:#fff}label{display:block;margin:10px 0}input{accent-color:#64dcc5}#status{padding:10px;background:#223449;border-radius:8px}#read{max-height:140px;overflow:auto;white-space:pre-wrap}';
  const panel = make('section'); panel.className = 'panel'; panel.setAttribute('aria-label','Course Helper');
  const header = make('header', '', panel);
  make('strong', 'Course Helper ' + VERSION, header);
  const minimize = make('button','−',header); minimize.setAttribute('aria-label','Minimize');
  const closeButton = make('button','×',header); closeButton.setAttribute('aria-label','Close helper');
  const body = make('div','',panel);
  const statusEl = make('p','Ready. Click Start auto when the lesson is open.',body); statusEl.id='status'; statusEl.setAttribute('role','status');
  const controls = make('nav','',body);
  const start = make('button','Start auto',controls); start.className='primary';
  const pauseButton = make('button','Pause',controls);
  const nextButton = make('button','Next once',controls);
  const infoLabel = make('label','',body);
  const infoToggle = make('input','',infoLabel); infoToggle.type='checkbox'; infoToggle.checked=true;
  infoLabel.appendChild(document.createTextNode(' Open information pop-ups automatically'));
  const speedLabel = make('label','Narration speed ',body);
  const speedSelect = make('select','',speedLabel); speedSelect.setAttribute('aria-label','Narration speed');
  for (const value of [1,1.5,2,3]) { const o=make('option',value+'×',speedSelect);o.value=String(value); }
  const secondary = make('nav','',body);
  const teachClose = make('button','Teach pop-up X',secondary);
  const reportButton = make('button','Show diagnostics',secondary);
  const readout = make('p','',body);readout.id='read';
  const reportBox = make('textarea','',body);reportBox.hidden=true;reportBox.readOnly=true;reportBox.setAttribute('aria-label','Diagnostic report');
  make('small','Auto pauses at questions and unfamiliar interactions. Pause or Escape stops it.',body);
  (document.body || document.documentElement).appendChild(host);

  const state = {running:false,timer:null,doc:null,phase:'idle',deadline:0,signature:'',visited:new Set(),info:null,pending:null,closeIds:new Set(['62CBQWEhsiU']),teachOff:null,documents:0,blockedFrames:0,checks:0,last:'Ready',failure:'',logs:[],closed:false};
  const POLL=1000;
  function tell(text) { state.last=text; if(statusEl.textContent!==text)statusEl.textContent=text; }
  function log(text) {state.logs.push(text);if(state.logs.length>12)state.logs.shift();}
  function pause(message='Paused. No background checks.') {
    state.running=false;clearTimeout(state.timer);state.timer=null;
    if(state.teachOff)state.teachOff();
    start.textContent='Start auto';tell(message);
  }
  function visible(el) {
    if(!el || !el.isConnected || !el.getClientRects().length)return false;
    const w=el.ownerDocument.defaultView;if(!w)return false;
    for(let node=el,depth=0;node && depth<24;node=node.parentElement,depth++){
      if(node.hidden)return false;
      const css=w.getComputedStyle(node);
      if(css.display==='none'||css.visibility==='hidden'||css.visibility==='collapse'||css.opacity==='0')return false;
    }
    return true;
  }
  function disabled(el){return !el || !!el.disabled || el.hasAttribute('disabled') || el.getAttribute('aria-disabled')==='true' || !!el.closest('.disabled,.is-disabled,.cs-disabled,[aria-disabled="true"]');}
  function name(el){return (el.getAttribute('aria-label')||el.getAttribute('data-acc-text')||el.getAttribute('title')||el.textContent||'').trim().slice(0,140);}
  function nextIn(doc){
    const exact=doc.getElementById('next');if(exact && visible(exact))return exact;
    const items=doc.querySelectorAll('button,[role="button"],a[aria-label]');
    for(let i=0;i<Math.min(items.length,120);i++)if(/^(next|next slide|continue)(?:\s*[▶►→]|\s*\([^)]*\))?$/i.test(name(items[i]))&&visible(items[i]))return items[i];
    return null;
  }
  function connect(){
    const queue=[{doc:document,depth:0}],seen=new Set();let selected=null;
    state.documents=0;state.blockedFrames=0;
    while(queue.length && seen.size<12){
      const item=queue.shift(),doc=item.doc;if(!doc||seen.has(doc))continue;seen.add(doc);state.documents++;
      if(nextIn(doc))selected=doc;
      if(item.depth>=3)continue;
      const frames=doc.querySelectorAll('iframe,frame');
      for(let i=0;i<Math.min(frames.length,12);i++){
        if(!visible(frames[i]))continue;
        try{const d=frames[i].contentDocument;if(d)queue.push({doc:d,depth:item.depth+1});else state.blockedFrames++;}catch{state.blockedFrames++;}
      }
    }
    state.doc=selected;
    if(!selected){pause(state.blockedFrames?'The lesson is in a protected frame. Select the lesson frame in the Console dropdown and run this code there.':'Course Next button not found. Open a lesson, then click Start auto again.');return false;}
    return true;
  }
  function model(id){
    if(!state.doc)return null;
    const nodes=state.doc.querySelectorAll('[data-model-id="'+id.replace(/[^\w-]/g,'')+'"]');
    for(const el of nodes)if(el.classList.contains('slide-object-stategroup')&&visible(el))return el;
    for(const el of nodes)if(visible(el))return el;
    const acc=state.doc.getElementById('acc-'+id);return visible(acc)?acc:null;
  }
  function interact(el){
    if(!visible(el)||disabled(el))return false;
    const w=el.ownerDocument.defaultView;
    let target=el;
    if(el.matches('[data-model-id]')){
      // Dispatch on the actual rendered shape, with normal bubbling to its group.
      const shape=el.querySelector('.eventable');if(shape)target=shape;
    }
    target.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,view:w}));return true;
  }
  function slideKey(){
    const d=state.doc;const pieces=[];
    const slides=d.querySelectorAll('[data-slide-id],.slide-object-stategroup[data-model-id],.slide-object-textbox[data-model-id]');
    for(let i=0;i<Math.min(slides.length,100)&&pieces.length<16;i++)if(visible(slides[i]))pieces.push(slides[i].getAttribute('data-slide-id')||slides[i].getAttribute('data-model-id'));
    const txt=d.querySelectorAll('.slide-object-textbox,.slide-object-text,.slide-title,[data-slide-number]');
    for(let i=0;i<Math.min(txt.length,60);i++){
      const t=(txt[i].textContent||'').trim();if(visible(txt[i])&&(/^\d+\s*\/\s*\d+$/.test(t)||pieces.length<2))pieces.push(t.slice(0,180));
    }
    if(!pieces.length){const main=d.querySelector('main,[role="main"],.slide');if(main)pieces.push((main.textContent||'').slice(0,500));}
    return pieces.join('|');
  }
  function quiz(){
    const items=state.doc.querySelectorAll('input[type="radio"],[role="radio"],input[type="checkbox"],[role="checkbox"],button,[role="button"]');
    for(let i=0;i<Math.min(items.length,160);i++){
      const el=items[i];if(!visible(el))continue;
      if(el.matches('input[type="radio"],[role="radio"],input[type="checkbox"],[role="checkbox"]') || /^(submit(?: answer)?|check answer|try again)$/i.test(name(el)))return true;
    }return false;
  }
  function popupClose(){
    for(const id of state.closeIds){const el=model(id);if(el)return el;}
    const els=state.doc.querySelectorAll('[data-acc-text],button,[role="button"]');
    for(let i=0;i<Math.min(els.length,180);i++)if(/^(close(?:\s+(?:popup|pop-up|dialog|layer))?|[×✕✖])$/i.test(name(els[i]))&&visible(els[i]))return els[i];
    return null;
  }
  function infoButtons(){
    const out=new Map(), els=state.doc.querySelectorAll('[data-acc-text]');
    for(let i=0;i<Math.min(els.length,180);i++){
      const el=els[i];if(!/^(click\s*icon|info(?:rmation)?(?:\s*icon)?)(?:\s+\d+)?$/i.test(el.getAttribute('data-acc-text').trim())||!visible(el))continue;
      const group=el.closest('.slide-object-stategroup[data-model-id]')||el.closest('[data-model-id]');
      if(group&&visible(group))out.set(group.getAttribute('data-model-id'),group);
    }
    // The supplied slide contains eleven explicitly identified information buttons.
    const known=['5Yf4v0ZEHzB','60IE5Judeh1','6iTVaNjoxjp','5bYJcTGpH9B','6qlRbDy2a3S','5gNe0ZiHI6a','5YT3xfkofN0','5aywoV9m4Fk','5lhh9PFHrxy','6nW3CBlmFjW','6IMFvZXbiYL'];
    if(!out.size && known.every(id=>model(id)))for(const id of known)out.set(id,model(id));
    return [...out.keys()];
  }
  function lessonText(){
    const chunks=new Set(),els=state.doc.querySelectorAll('.slide-object-textbox,.slide-object-text,[role="dialog"] p,main p');
    for(let i=0;i<Math.min(els.length,80);i++)if(visible(els[i])){const t=(els[i].textContent||'').trim().slice(0,1200);if(t)chunks.add(t);}
    return [...chunks].join('\n\n').slice(0,12000);
  }
  function timeline(){
    const els=state.doc.querySelectorAll('[role="slider"],[role="progressbar"],input[type="range"]');
    for(let i=0;i<Math.min(els.length,16);i++){
      const el=els[i];const n=el.id+' '+name(el)+' '+el.className;
      if(!/seek|timeline|progress|scrub/i.test(n)||/volume/i.test(n)||!visible(el))continue;
      const now=el.getAttribute('aria-valuenow')??(el.tagName==='INPUT'?el.value:null);
      const max=el.getAttribute('aria-valuemax')??(el.tagName==='INPUT'?el.max:null);
      if(now!==null&&max!==null&&Number(max)>0)return {known:true,done:Number(now)>=Number(max)-Math.max(.01,Number(max)*.001),value:now,max};
    }return {known:false,done:false};
  }
  function mediaPlaying(){
    const tracks=state.doc.querySelectorAll('audio,video');let playing=false;
    for(let i=0;i<Math.min(tracks.length,12);i++){
      const m=tracks[i];if(!m.paused&&!m.ended){playing=true;try{if(m.playbackRate!==Number(speedSelect.value))m.playbackRate=Number(speedSelect.value);}catch{}}
    }return playing;
  }
  function readPopup(){
    const text=lessonText();readout.textContent=text;
    state.deadline=Date.now()+Math.max(6000,Math.min(120000,text.split(/\s+/).filter(Boolean).length/300*60000));
    state.phase='reading';tell('Reading information. Auto will close it after the reading time.');
  }
  function resetSlide(){state.visited.clear();state.info=null;state.pending=null;state.phase='ready';state.signature=slideKey();readout.textContent='';}
  function step(){
    if(!state.doc.defaultView || !state.doc.documentElement.isConnected){pause('The lesson frame changed. Click Start auto to reconnect.');return;}
    if(quiz()){pause('Question detected. Answer it yourself, then restart Auto.');return;}
    if(state.phase==='navigation'){
      const after=slideKey();
      if(after && after!==state.signature){log('Slide change confirmed');resetSlide();tell('Next slide confirmed.');return;}
      if(Date.now()>state.deadline){pause('Next was clicked, but no slide change was confirmed. Show diagnostics to see the course state.');}
      else tell('Waiting for the next slide to appear…');return;
    }
    const x=popupClose();
    if(state.phase==='opening'){
      if(x){readPopup();return;}
      if(Date.now()>state.deadline)pause('Pop-up or its X was not recognised. Open it manually, use Teach pop-up X, then restart Auto.');
      return;
    }
    if(state.phase==='reading'){
      if(!x){state.visited.add(state.pending);state.pending=null;state.phase='ready';return;}
      if(Date.now()<state.deadline){tell('Reading information: '+Math.ceil((state.deadline-Date.now())/1000)+' seconds remaining.');return;}
      interact(x);state.phase='closing';state.deadline=Date.now()+8000;log('Pop-up X clicked');return;
    }
    if(state.phase==='closing'){
      if(!x){state.visited.add(state.pending);state.pending=null;state.phase='ready';return;}
      if(Date.now()>state.deadline)pause('The pop-up did not close. Teach pop-up X and try again.');return;
    }
    if(x){if(infoToggle.checked)readPopup();else tell('Close the information pop-up to continue.');return;}
    const key=slideKey();if(key && key!==state.signature)resetSlide();
    if(infoToggle.checked){
      if(!state.info)state.info=infoButtons();
      const id=state.info.find(item=>!state.visited.has(item));
      if(id){const el=model(id);if(!el){state.visited.add(id);return;}
        state.pending=id;state.phase='opening';state.deadline=Date.now()+8000;interact(el);log('Information button clicked');tell('Opening information '+(state.visited.size+1)+' of '+state.info.length+'…');return;}
    }
    const time=timeline();const playing=mediaPlaying();
    if(time.known&&!time.done){tell('Waiting for the course timeline: '+time.value+' / '+time.max);return;}
    if(!time.known&&playing){tell('Waiting for narration to finish.');return;}
    const next=nextIn(state.doc);
    if(!next||disabled(next)){tell('Waiting for the course Next button to unlock. Complete any unfamiliar activity.');return;}
    state.signature=slideKey();interact(next);state.phase='navigation';state.deadline=Date.now()+12000;log('Next clicked');tell('Next clicked. Checking for a slide change…');
  }
  function tick(){
    state.timer=null;if(!state.running||state.closed)return;
    state.checks++;
    const t=performance.now();
    try{step();}catch(error){state.failure=String(error);pause('Stopped after an error. Show diagnostics for details.');}
    const elapsed=performance.now()-t;
    if(elapsed>250){log('Slow check: '+Math.round(elapsed)+' ms');pause('Paused because the course took too long to inspect. Show diagnostics.');}
    if(state.running)state.timer=setTimeout(tick,POLL);
  }
  start.onclick=()=>{
    if(state.running)return;if(state.teachOff)state.teachOff();
    try{if(!connect())return;resetSlide();state.running=true;start.textContent='Auto running';tell('Connected. Auto starts in one second.');state.timer=setTimeout(tick,POLL);}catch(error){state.failure=String(error);pause('Could not connect. Show diagnostics.');}
  };
  pauseButton.onclick=()=>pause();
  nextButton.onclick=()=>{pause();if(!connect())return;if(quiz()){tell('Question detected. Complete it manually.');return;}const n=nextIn(state.doc);if(disabled(n))tell('The course has locked Next.');else{interact(n);tell('Course Next clicked once.');}};
  teachClose.onclick=()=>{
    pause();if(!connect())return;
    const doc=state.doc;
    const listener=e=>{
      if(e.composedPath().includes(host))return;
      const el=e.target.closest('[data-model-id],[id^="acc-"]');
      const id=el?.getAttribute('data-model-id')||el?.id.replace(/^acc-/,'');
      if(!id){tell('Click the course pop-up X itself.');return;}
      state.closeIds.add(id);log('Close control learned');state.teachOff();tell('X learned for this session. Click Start auto.');
    };
    state.teachOff=()=>{doc.removeEventListener('click',listener,true);state.teachOff=null;};
    doc.addEventListener('click',listener,true);tell('With the pop-up open, click its small X now.');
  };
  reportButton.onclick=()=>{
    const was=state.running, previous=state.last;pause('Paused for diagnostics.');
    const data={version:VERSION,wasRunning:was,phase:state.phase,previousStatus:previous,documents:state.documents,blockedFrames:state.blockedFrames,checks:state.checks,error:state.failure,log:state.logs};
    try{if(state.doc){const n=nextIn(state.doc);data.next=n?{id:n.id,label:name(n),disabled:disabled(n)}:null;data.timeline=timeline();data.informationButtons=state.info?.length||0;data.visited=state.visited.size;}}catch(error){data.inspectionError=String(error);}
    reportBox.hidden=false;reportBox.value=JSON.stringify(data,null,2);reportBox.focus();reportBox.select();tell('Report selected. Press Ctrl+C to copy it.');
  };
  let drag=null;
  header.onpointerdown=e=>{if(e.target.tagName==='BUTTON')return;const r=host.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};header.setPointerCapture(e.pointerId);};
  header.onpointermove=e=>{if(!drag)return;host.style.setProperty('right','auto','important');host.style.setProperty('left',Math.max(0,e.clientX-drag.x)+'px','important');host.style.setProperty('top',Math.max(0,e.clientY-drag.y)+'px','important');};
  header.onpointerup=header.onpointercancel=()=>{drag=null;};
  minimize.onclick=()=>{body.hidden=!body.hidden;minimize.textContent=body.hidden?'+':'−';};
  const keydown=e=>{if(e.key==='Escape')pause();};document.addEventListener('keydown',keydown,true);
  function cleanup(){pause();state.closed=true;document.removeEventListener('keydown',keydown,true);host.remove();delete window[KEY];if(window.__chPCStop===cleanup)delete window.__chPCStop;}
  closeButton.onclick=cleanup;
  window[KEY]={show(){body.hidden=false;tell(state.running?'Auto is already running.':'Already installed. Click Start auto.');},stop:cleanup};
  window.__chPCStop=cleanup;
  console.info('Course Helper '+VERSION+' installed paused.');
})();
