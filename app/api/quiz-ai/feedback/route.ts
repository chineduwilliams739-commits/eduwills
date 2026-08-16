import {NextRequest,NextResponse} from 'next/server';

export async function POST(req:NextRequest){
  try{
    const b=await req.json();
    const percentage=Math.max(0,Math.min(100,Number(b.percentage)||0));
    const books=Array.isArray(b.books)?b.books.map((x:any)=>`${x.title} by ${x.author}`).join('; '):'';
    const prompt=`You are EDUWILLS. Give brief encouraging post-test feedback based only on the score. Score: ${percentage}%. Books: ${books}. Mention a likely strength and, only when appropriate, a weakness to review. Do not invent details about the learner's exact mistakes. 2-3 sentences, plain text only.`;
    const r=await fetch('https://text.pollinations.ai/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],model:'openai'})});
    if(!r.ok)throw new Error('AI feedback unavailable');
    return NextResponse.json({feedback:(await r.text()).trim()});
  }catch(e:any){return NextResponse.json({error:e?.message||'AI feedback unavailable.'},{status:500})}
}
