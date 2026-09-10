import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// v7 generated an inline info section but omitted the JSX expression closer before <header>.
g=g.replace(/<\/section><header/, '</section>}<header');

// Keep the composer explicitly horizontal and left-to-right.
g=g.replace(/(<textarea\\b[^>]*aria-label="Write a message"[^>]*)\sstyle=\{\{[^}]*\}\}/g,'$1');
if(g.includes('aria-label="Write a message"') && !g.includes("style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}")){
  g=g.replace(/(<textarea\\b[^>]*aria-label="Write a message"[^>]*)>/g,"$1 style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}>");
}

// Remove a duplicate MESSAGE CONTROL card while preserving the first one.
function removeDuplicateMessageControl(source){
  const marker='MESSAGE CONTROL';
  let first=source.indexOf(marker);
  if(first<0)return source;
  let second=source.indexOf(marker,first+marker.length);
  while(second>=0){
    const starts=[];
    let p=source.lastIndexOf('<section',second);
    if(p>=0)starts.push({tag:'section',start:p});
    p=source.lastIndexOf('<div',second);
    if(p>=0)starts.push({tag:'div',start:p});
    starts.sort((a,b)=>b.start-a.start);
    let chosen=starts[0];
    if(!chosen)throw new Error('MESSAGE_CONTROL_PARENT_NOT_FOUND');
    const tag=chosen.tag;
    const openRe=new RegExp(`<${tag}\\b[^>]*>`,'g');
    openRe.lastIndex=chosen.start;
    let depth=0,end=-1,m;
    while((m=openRe.exec(source))){
      if(m.index!==chosen.start && m.index>second)break;
      depth++;
      let scan=m.index+m[0].length;
      const closeRe=new RegExp(`</${tag}>`,'g');
      closeRe.lastIndex=scan;
      const nextOpen=source.indexOf(`<${tag}`,scan);
      const nextClose=source.indexOf(`</${tag}>`,scan);
      if(nextClose<0)break;
      if(nextOpen>=0 && nextOpen<nextClose){
        openRe.lastIndex=nextOpen;
        continue;
      }
      depth--;
      if(depth===0){end=nextClose+(`</${tag}>`).length;break;}
      openRe.lastIndex=nextClose+(`</${tag}>`).length;
    }
    if(end<0)break;
    source=source.slice(0,chosen.start)+source.slice(end);
    second=source.indexOf(marker,first+marker.length);
  }
  return source;
}

g=removeDuplicateMessageControl(g);

if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes("style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}"))throw new Error('GROUP_COMPOSER_HORIZONTAL_FLOW_MISSING');
if(!g.includes('MEMBERS'))throw new Error('GROUP_MEMBERS_VIEW_MISSING');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('DUPLICATE_MESSAGE_CONTROL_CARD');
if(/<\/section><header/.test(g))throw new Error('GROUP_INFO_JSX_CLOSER_MISSING');

fs.writeFileSync(group,g);
console.log('Community UI v8 JSX repair, horizontal composer hardening, inline MEMBERS validation, and duplicate lock-card cleanup passed.');
