import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// v7 omitted the JSX expression closer before the header.
g=g.replace(/<\/section><header/g,'</section>}<header');

// Force normal horizontal text flow.
g=g.replace(/(<textarea\b[^>]*aria-label="Write a message"[^>]*)\sstyle=\{\{[^}]*\}\}/g,'$1');
if(g.includes('aria-label="Write a message"') && !g.includes("style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}")){
  g=g.replace(/(<textarea\b[^>]*aria-label="Write a message"[^>]*)>/g,"$1 style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}>");
}

// Remove duplicate MESSAGE CONTROL cards by deleting the complete enclosing <section> of
// every occurrence after the first. The first card remains the single canonical control.
function removeDuplicateControlCards(source){
  const marker='MESSAGE CONTROL';
  const first=source.indexOf(marker);
  if(first<0)return source;
  while(true){
    const second=source.indexOf(marker,first+marker.length);
    if(second<0)break;
    const start=source.lastIndexOf('<section',second);
    if(start<0)throw new Error('MESSAGE_CONTROL_PARENT_NOT_FOUND');
    const tokenRe=/<\/?section\b[^>]*>/g;
    tokenRe.lastIndex= start;
    let depth=0,end=-1,m;
    while((m=tokenRe.exec(source))){
      if(m.index<start)continue;
      if(m[0][1]==='/') depth--; else depth++;
      if(depth===0){end=m.index+m[0].length;break;}
    }
    if(end<0)throw new Error('MESSAGE_CONTROL_SECTION_UNBALANCED');
    source=source.slice(0,start)+source.slice(end);
  }
  return source;
}

g=removeDuplicateControlCards(g);

if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes("style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}"))throw new Error('GROUP_COMPOSER_HORIZONTAL_FLOW_MISSING');
if(!g.includes('MEMBERS'))throw new Error('GROUP_MEMBERS_VIEW_MISSING');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('DUPLICATE_MESSAGE_CONTROL_CARD');
if(/<\/section><header/.test(g))throw new Error('GROUP_INFO_JSX_CLOSER_MISSING');

fs.writeFileSync(group,g);
console.log('Community UI v8 JSX repair, horizontal composer hardening, inline MEMBERS validation, and duplicate lock-card cleanup passed.');
