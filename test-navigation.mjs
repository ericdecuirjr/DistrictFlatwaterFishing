/* Static integration guards for navigation changes (no app data accessed). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const app=readFileSync('app.js','utf8');
const phase=readFileSync('phase3.js','utf8');
const css=readFileSync('styles.css','utf8');
const nav=html.match(/<nav id="app-bottom-nav"[\s\S]*?<\/nav>/)?.[0];
assert.ok(nav,'Fixed bottom nav must exist');
const destinations=['log','gallery','analytics','map','more'];
assert.equal((nav.match(/class="bottom-nav-item/g)||[]).length,5,'Exactly five main items');
for(const name of destinations){
 assert.ok(nav.includes('id="tab-'+name+'"'),'Missing main navigation '+name);
 assert.ok(nav.includes('data-tab="'+name+'"'),'Missing destination '+name);
}
for(const name of ['settings','diagnostics']){
 assert.ok(html.includes('id="screen-'+name+'"'));
 assert.ok(html.includes('data-tab="'+name+'"'),'More hub must link to '+name);
}
assert.ok(html.includes('id="screen-more"'));
assert.ok(!html.includes('class="tabs"'),'Remove old scrolling top menu');
assert.ok(app.includes("document.querySelectorAll('main > .screen')"));
assert.ok(app.includes("'df-tab-change'"));
assert.ok(app.includes("['settings','diagnostics'].includes(requested)?'more':requested"));
assert.ok(phase.includes("document.addEventListener('df-tab-change'"));
assert.ok(!phase.includes("nav.append(addTab("),'No duplicate phase navigation');
assert.ok(css.includes('position:fixed;bottom:0'));
assert.ok(css.includes('safe-area-inset-bottom'));
assert.ok(css.includes('body{padding-bottom:calc(var(--df-nav-height)'));
console.log('Bottom navigation destination and wiring checks passed');
