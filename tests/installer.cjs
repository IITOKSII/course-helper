const {JSDOM}=require('jsdom');const fs=require('fs'),assert=require('node:assert/strict');
const d=new JSDOM(fs.readFileSync('Course-Helper-Install.html','utf8'),{runScripts:'dangerously'});
const doc=d.window.document,field=doc.getElementById('source');
assert.equal(field.value,fs.readFileSync('course-helper.js','utf8'));
doc.getElementById('copy').click();assert.equal(field.selectionEnd,field.value.length);assert(doc.getElementById('status').textContent.includes('Ctrl+C'));
doc.execCommand=()=>true;doc.getElementById('copy').click();assert(doc.getElementById('status').textContent.includes('Copied'));
doc.getElementById('select').click();assert.equal(field.selectionStart,0);
console.log('PASS installer exact source, clipboard success, manual copy fallback, and selection');d.window.close();
