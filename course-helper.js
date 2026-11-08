(() => {
  'use strict';
  const VERSION = '19.6';
  const KEY = '__courseHelper19';
  if (window[KEY]) { window[KEY].stop(); }
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
  const recommendButton = make('button','Recommend answer',controls);
  const infoLabel = make('label','',body);
  const infoToggle = make('input','',infoLabel); infoToggle.type='checkbox'; infoToggle.checked=true;
  infoLabel.appendChild(document.createTextNode(' Open information pop-ups automatically'));
  const speedLabel = make('label','Narration speed ',body);
  const speedSelect = make('select','',speedLabel); speedSelect.setAttribute('aria-label','Narration speed');
  for (const value of [1,1.5,2,3]) { const o=make('option',value+'×',speedSelect);o.value=String(value); }
  const secondary = make('nav','',body);
  const teachClose = make('button','Teach pop-up X',secondary);
  const teachNext = make('button','Teach pop-up Next',secondary);
  const reportButton = make('button','Show diagnostics',secondary);
  const readout = make('p','',body);readout.id='read';
  const recommendation = make('p','Click a question or answer on the course, then choose Recommend answer.',body);
  recommendation.style.cssText='white-space:pre-wrap;padding:8px;border:1px solid #66839c;border-radius:8px';
  const reportBox = make('textarea','',body);reportBox.hidden=true;reportBox.readOnly=true;reportBox.setAttribute('aria-label','Diagnostic report');
  make('small','Auto pauses at questions and unfamiliar interactions. Pause or Escape stops it.',body);
  (document.body || document.documentElement).appendChild(host);

  const state = {running:false,timer:null,doc:null,phase:'idle',deadline:0,signature:'',visited:new Set(),info:null,pending:null,pendingBefore:null,interactionMode:null,infoDetected:0,infoOpened:0,infoCompleted:0,popupNextIds:new Set(),closeIds:new Set(['62CBQWEhsiU']),teachOff:null,documents:0,blockedFrames:0,checks:0,last:'Ready',failure:'',logs:[],closed:false,selectedQuestion:null,selectionListener:null,selectionDocs:new Set()};
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
    for(const doc of seen)attachQuestionListener(doc);
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
    const roots=d.querySelectorAll('[data-slide-id]');
    for(const el of roots)if(visible(el))return el.getAttribute('data-slide-id');
    const slide=d.querySelector('.slide-container .slide,main .slide,.slide[data-id]');
    if(slide&&visible(slide)&&(slide.id||slide.getAttribute('data-id')))return slide.id||slide.getAttribute('data-id');
    const slides=d.querySelectorAll('.slide-object-textbox[data-model-id]');
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
    const out=new Map();
    const selector='[data-acc-text],[aria-label],[title],button,[role="button"],.slide-object-stategroup[data-model-id]';
    const els=state.doc.querySelectorAll(selector);
    const infoLabel=/\b(?:click\s*icon|info(?:rmation)?(?:\s*icon)?|learn\s*more|more\s*info(?:rmation)?|read\s*more|details?|help)\b/i;
    for(let i=0;i<Math.min(els.length,400);i++){
      const el=els[i];if(!visible(el))continue;
      const labels=[el.getAttribute('data-acc-text'),el.getAttribute('aria-label'),el.getAttribute('title'),el.textContent].filter(Boolean).map(v=>v.trim()).filter(Boolean);
      if(!labels.some(v=>v.length<=100&&infoLabel.test(v)))continue;
      if(el.matches('.slide-object-textbox,.slide-object-text'))continue;
      const group=el.closest('.slide-object-stategroup[data-model-id]')||el.closest('[data-model-id]')||(el.matches('[data-model-id]')?el:null);
      const id=group?.getAttribute('data-model-id');
      if(id&&visible(group)&&!out.has(id))out.set(id,group);
    }
    const known=['5Yf4v0ZEHzB','60IE5Judeh1','6iTVaNjoxjp','5bYJcTGpH9B','6qlRbDy2a3S','5gNe0ZiHI6a','5YT3xfkofN0','5aywoV9m4Fk','5lhh9PFHrxy','6nW3CBlmFjW','6IMFvZXbiYL'];
    for(const id of known){const el=model(id);if(el&&!out.has(id))out.set(id,el);}
    state.infoDetected=out.size;
    return [...out.keys()];
  }

  // Recommendations are local, evidence-based hints, not AI-generated answers.
  function questionSelection(event){
    if(event.composedPath?.().includes(host))return;
    const target=event.target?.nodeType===1?event.target:event.target?.parentElement;
    if(!target)return;
    const container=target.closest('fieldset,[role="group"],[role="radiogroup"],.question,.quiz-question,.assessment-question,[data-question-id],form')||target.closest('label')?.parentElement||target;
    const text=(container.innerText||container.textContent||'').trim();
    if(text || target.matches('input,button,[role="radio"],[role="checkbox"],label')){
      state.selectedQuestion={target,container};
      recommendation.textContent='Selection captured. Click Recommend answer to inspect this question.';
    }
  }
  function attachQuestionListener(doc=document){
    if(state.selectionDocs.has(doc))return;
    if(!state.selectionListener)state.selectionListener=e=>questionSelection(e);
    doc.addEventListener('click',state.selectionListener,true);
    state.selectionDocs.add(doc);
  }
  function answerCandidates(container){
    const result=[],seen=new Set();
    const controls=container.querySelectorAll('input[type="radio"],input[type="checkbox"],[role="radio"],[role="checkbox"]');
    for(const control of controls){
      const label=control.labels?.[0]||control.closest('label')||control.closest('[role="option"]')||control.parentElement;
      const txt=(label?.innerText||label?.textContent||control.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ');
      if(txt && !seen.has(txt)){result.push(txt);seen.add(txt);}
    }
    if(!result.length){
      for(const label of container.querySelectorAll('label,[role="option"]')){
        const txt=(label.innerText||label.textContent||'').trim().replace(/\s+/g,' ');
        if(txt && !seen.has(txt)){result.push(txt);seen.add(txt);}
      }
    }
    return result.slice(0,20);
  }
  function recommendAnswer(){
    const selection=state.selectedQuestion;
    if(!selection?.target?.isConnected){
      recommendation.textContent='Click the question or an answer box first, then try again.';
      return;
    }
    const doc=selection.target.ownerDocument;
    let container=selection.container;
    let options=answerCandidates(container);
    for(let parent=container.parentElement,depth=0;options.length<2&&parent&&depth<5;parent=parent.parentElement,depth++){
      const found=answerCandidates(parent);
      if(found.length>=2){container=parent;options=found;break;}
    }
    const question=(container.innerText||container.textContent||'').trim().slice(0,1500);
    const evidence=[...doc.querySelectorAll('.slide-object-textbox,.slide-object-text,main p,article p')]
      .filter(el=>visible(el)&&!container.contains(el))
      .map(el=>(el.innerText||el.textContent||'').trim()).filter(Boolean).join(' ').slice(0,20000);
    if(options.length<2){
      recommendation.textContent='Question captured, but I cannot reliably identify its answer options. Try clicking directly on a multiple-choice answer.';
      return;
    }
    const tokens=t=>new Set((t.toLowerCase().match(/[a-z]{4,}/g)||[]).filter(w=>!['that','this','with','from','have','which','what','when','where','would','should','could','there','their','about','your','they','them','true','false'].includes(w)));
    const context=tokens(evidence);
    const scored=options.map(option=>{
      const words=[...tokens(option)];
      return {option,score:words.filter(w=>context.has(w)).length,words:words.length};
    }).sort((a,b)=>b.score-a.score);
    const top=scored[0],runner=scored[1];
    if(!evidence || top.score<2 || top.score===runner.score){
      recommendation.textContent='Question: '+question.slice(0,500)+'\n\nOptions: '+options.join(' | ')+'\n\nNo reliable recommendation: the available lesson text does not clearly distinguish these answers.';
    }else{
      recommendation.textContent='Possible answer (low confidence): '+top.option+'\n\nReason: this option shares '+top.score+' key terms with the visible lesson material. Check the actual meaning before submitting; matching words does not prove correctness.';
    }
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


  function popupScope(){
    const scopes=state.doc.querySelectorAll('[role="dialog"],[aria-modal="true"],.slide-layer,.layer-container');
    return [...scopes].reverse().find(el=>visible(el))||null;
  }
  function popupNext(){
    for(const id of state.popupNextIds){const el=model(id);if(el&&!disabled(el)&&el!==nextIn(state.doc))return el;}
    const scope=popupScope();
    const candidates=(scope||state.doc).querySelectorAll('button,[role="button"],[data-acc-text],[aria-label]');
    const courseNext=nextIn(state.doc);
    for(const el of candidates){
      if(!visible(el)||disabled(el)||el===courseNext||el.id==='next'||el.contains(courseNext)||courseNext?.contains(el))continue;
      if(/^(next(?:\s+(?:page|step|slide))?|continue|forward|right(?:\s+arrow)?|[▶►→›❯])$/i.test(name(el))){
        const target=el.closest('.slide-object-stategroup[data-model-id]')||el;
        // Outside an identified dialog, only authored slide objects qualify.
        if(scope||target.hasAttribute('data-model-id'))return target;
      }
    }
    return null;
  }
  function popupPageKey(){
    const scope=popupScope();
    return scope?(scope.innerText||scope.textContent||'').trim():lessonText();
  }
  function interactionSnapshot(){
    const el=state.pending?model(state.pending):null;
    return {text:lessonText(),control:el?[el.getAttribute('aria-expanded'),el.getAttribute('aria-selected'),el.getAttribute('aria-pressed'),el.getAttribute('data-state'),el.className].join('|'):null};
  }
  function completeInformation(){
    if(state.pending&&!state.visited.has(state.pending)){state.visited.add(state.pending);state.infoCompleted++;}
    state.pending=null;state.pendingBefore=null;state.interactionMode=null;
    state.phase='ready';state.signature=slideKey();
  }
  function readPopup(mode='popup'){
    const text=lessonText();readout.textContent=text;
    state.deadline=Date.now()+Math.max(6000,Math.min(120000,text.split(/\s+/).filter(Boolean).length/300*60000));
    state.interactionMode=mode;state.phase='reading';tell(mode==='inline'?'Reading revealed information. No close button required.':'Reading information. Auto will close it after the reading time.');
  }
  function resetSlide(newSlide=false){if(newSlide){state.visited.clear();state.info=null;state.infoDetected=0;state.infoOpened=0;state.infoCompleted=0;}state.pending=null;state.pendingBefore=null;state.interactionMode=null;state.phase='ready';state.signature=slideKey();readout.textContent='';}
  function step(){
    if(!state.doc.defaultView || !state.doc.documentElement.isConnected){pause('The lesson frame changed. Click Start auto to reconnect.');return;}
    if(state.phase==='ready'&&!popupClose()){const key=slideKey();if(key&&state.signature&&key!==state.signature)resetSlide(true);}
    if(quiz()){pause('Question detected. Answer it yourself, then restart Auto.');return;}
    if(state.phase==='navigation'){
      const after=slideKey();
      if(after && after!==state.signature){log('Slide change confirmed');resetSlide(true);tell('Next slide confirmed.');return;}
      if(Date.now()>state.deadline){pause('Next was clicked, but no slide change was confirmed. Show diagnostics to see the course state.');}
      else tell('Waiting for the next slide to appear…');return;
    }
    const x=popupClose();
    if(state.phase==='opening'){
      if(x||popupNext()){readPopup('pages');return;}
      const current=interactionSnapshot(),before=state.pendingBefore;
      if(before&&(current.text!==before.text||current.control!==before.control)){
        log('Information revealed without X: '+state.pending);readPopup('inline');return;
      }
      if(Date.now()>state.deadline)pause('No visible response was detected for this information button. Open it manually, then show diagnostics.');
      return;
    }
    if(state.phase==='popup-navigation'){
      const after=popupPageKey();
      if(after!==state.popupPageBefore||popupClose()){
        log('Pop-up page changed');readPopup('pages');return;
      }
      if(Date.now()>state.deadline)pause('The pop-up Next was clicked, but its next page was not detected. Show diagnostics.');
      return;
    }
    if(state.phase==='reading'){
      const pageNext=popupNext();
      if(state.interactionMode==='pages'||pageNext){
        state.interactionMode='pages';
        if(Date.now()<state.deadline){tell('Reading pop-up page: '+Math.ceil((state.deadline-Date.now())/1000)+' seconds remaining.');return;}
        if(pageNext){
          state.popupPageCount=(state.popupPageCount||0)+1;
          if(state.popupPageCount>50){pause('Pop-up navigation limit reached. Show diagnostics.');return;}
          state.popupPageBefore=popupPageKey();
          if(!interact(pageNext)){pause('Pop-up Next could not be clicked.');return;}
          state.phase='popup-navigation';state.deadline=Date.now()+12000;log('Pop-up Next clicked');return;
        }
        if(x){interact(x);state.phase='closing';state.deadline=Date.now()+8000;log('Pop-up X clicked');return;}
        pause('Waiting for a pop-up Next or close control. Show diagnostics if neither is recognised.');return;
      }
      if(state.interactionMode==='inline'){
        if(x){readPopup();return;}
        if(Date.now()<state.deadline){tell('Reading revealed information: '+Math.ceil((state.deadline-Date.now())/1000)+' seconds remaining.');return;}
        completeInformation();log('Information completed without X');return;
      }
      if(!x){completeInformation();return;}
      if(Date.now()<state.deadline){tell('Reading information: '+Math.ceil((state.deadline-Date.now())/1000)+' seconds remaining.');return;}
      interact(x);state.phase='closing';state.deadline=Date.now()+8000;log('Pop-up X clicked');return;
    }
    if(state.phase==='closing'){
      if(!x){completeInformation();return;}
      if(Date.now()>state.deadline)pause('The pop-up did not close. Teach pop-up X and try again.');return;
    }
    if(x){if(infoToggle.checked)readPopup();else tell('Close the information pop-up to continue.');return;}
    const key=slideKey();if(key && !state.signature)state.signature=key;
    if(infoToggle.checked){
      state.info=infoButtons();
      const id=state.info.find(item=>!state.visited.has(item)&&!disabled(model(item)));
      if(id){const el=model(id);if(!el)return;
        state.popupPageCount=0;state.pending=id;state.pendingBefore=interactionSnapshot();state.interactionMode=null;state.phase='opening';state.deadline=Date.now()+8000;if(interact(el)){state.infoOpened++;log('Information button clicked: '+id);tell('Opening information '+state.infoOpened+' of '+state.info.length+'…');}else{state.pending=null;state.phase='ready';tell('Waiting for information button to become enabled.');}return;}
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
    try{if(!connect())return;if(!state.signature){state.signature=slideKey();state.phase='ready';}state.running=true;start.textContent='Auto running';tell('Connected. Auto starts in one second.');state.timer=setTimeout(tick,POLL);}catch(error){state.failure=String(error);pause('Could not connect. Show diagnostics.');}
  };
  pauseButton.onclick=()=>pause();
  recommendButton.onclick=()=>{pause();if(!state.selectedQuestion)connect();recommendAnswer();};
  nextButton.onclick=()=>{pause();if(!connect())return;if(quiz()){tell('Question detected. Complete it manually.');return;}const n=nextIn(state.doc);if(disabled(n))tell('The course has locked Next.');else{state.signature=slideKey();interact(n);state.phase='navigation';state.deadline=Date.now()+12000;tell('Course Next clicked once.');}};
  teachNext.onclick=()=>{
    pause();if(!connect())return;
    const doc=state.doc;
    const listener=e=>{
      if(e.composedPath().includes(host))return;
      const target=e.composedPath().find(node=>node?.nodeType===1&&node.closest?.('[data-model-id],[id^="acc-"]'));
      const el=target?.closest('[data-model-id],[id^="acc-"]');
      const id=el?.getAttribute('data-model-id')||el?.id.replace(/^acc-/,'');
      const courseNext=nextIn(doc);
      if(!id||el===courseNext||courseNext?.contains(el)){tell('Click the arrow inside the pop-up.');return;}
      state.popupNextIds.add(id);state.teachOff();
      // The teaching click advances the page; read that page when Auto resumes.
      readPopup('pages');log('Pop-up Next learned: '+id);
      tell('Pop-up Next learned. Click Start auto.');
    };
    state.teachOff=()=>{doc.removeEventListener('click',listener,true);state.teachOff=null;};
    doc.addEventListener('click',listener,true);tell('Click the Next arrow inside the open pop-up now.');
  };
  teachClose.onclick=()=>{
    pause();if(!connect())return;
    const doc=state.doc;
    const listener=e=>{
      if(e.composedPath().includes(host))return;
      const target=e.composedPath().find(node=>node?.nodeType===1&&node.closest?.('[data-model-id],[id^="acc-"]'));
      const el=target?.closest('[data-model-id],[id^="acc-"]');
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
    try{if(state.doc){const n=nextIn(state.doc);data.next=n?{id:n.id,label:name(n),disabled:disabled(n)}:null;data.timeline=timeline();data.informationButtons=state.info?.length||0;data.informationDetected=state.infoDetected;data.informationOpened=state.infoOpened;data.informationCompleted=state.infoCompleted;data.visited=state.visited.size;data.popupNext=popupNext()?name(popupNext()):null;data.popupScope=!!popupScope();data.popupControls=[...(popupScope()||state.doc).querySelectorAll('button,[role="button"],[data-acc-text],[aria-label],.slide-object-stategroup[data-model-id]')].filter(visible).slice(0,50).map(el=>({id:el.getAttribute('data-model-id')||el.id,label:name(el),disabled:disabled(el)}));data.popupPages=state.popupPageCount||0;data.pending=state.pending;data.interactionMode=state.interactionMode;data.closeControl=popupClose()?name(popupClose()):null;data.buttons=infoButtons().map(id=>({id,label:name(model(id)),visited:state.visited.has(id)}));}}catch(error){data.inspectionError=String(error);}
    reportBox.hidden=false;reportBox.value=JSON.stringify(data,null,2);reportBox.focus();reportBox.select();tell('Report selected. Press Ctrl+C to copy it.');
  };
  let drag=null;
  header.onpointerdown=e=>{if(e.target.tagName==='BUTTON')return;const r=host.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};header.setPointerCapture(e.pointerId);};
  header.onpointermove=e=>{if(!drag)return;host.style.setProperty('right','auto','important');host.style.setProperty('left',Math.max(0,e.clientX-drag.x)+'px','important');host.style.setProperty('top',Math.max(0,e.clientY-drag.y)+'px','important');};
  header.onpointerup=header.onpointercancel=()=>{drag=null;};
  minimize.onclick=()=>{body.hidden=!body.hidden;minimize.textContent=body.hidden?'+':'−';};
  const keydown=e=>{if(e.key==='Escape')pause();};document.addEventListener('keydown',keydown,true);
  attachQuestionListener();
  function cleanup(){pause();for(const doc of state.selectionDocs)doc.removeEventListener('click',state.selectionListener,true);state.selectionDocs.clear();state.closed=true;document.removeEventListener('keydown',keydown,true);host.remove();delete window[KEY];if(window.__chPCStop===cleanup)delete window.__chPCStop;}
  closeButton.onclick=cleanup;
  window[KEY]={show(){body.hidden=false;tell(state.running?'Auto is already running.':'Already installed. Click Start auto.');},stop:cleanup};
  window.__chPCStop=cleanup;
  console.info('Course Helper '+VERSION+' installed paused.');
})();
