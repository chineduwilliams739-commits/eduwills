import {NextRequest,NextResponse} from 'next/server';

export async function POST(req:NextRequest){
  try{
    const b=await req.json();
    const question=String(b.question||'').trim();
    const learner=String(b.learnerAnswer||'').trim();
    const correct=String(b.correctAnswer||'').trim();
    const books=Array.isArray(b.book)?b.book.map((x:any)=>`${x.title} by ${x.author}`).join('; '):'';
    if(!question||!correct)return NextResponse.json({error:'Missing quiz information.'},{status:400});
    const prompt=`You are EDUWILLS, a concise educational tutor. Explain why a learner's answer to this book quiz question was incorrect. Books: ${books}. Question: ${question}. Learner answer: ${learner||'No answer'}. Correct answer: ${correct}. Give 2-4 clear sentences. Do not start a conversation, ask questions, invent quotations, or claim unsupported book facts. Focus only on the mistake and what evidence/concept the learner should review. Return plain text only.`;
    const r=await fetch('https://text.pollinations.ai/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],model:'openai'})});
    if(!r.ok)throw new Error('AI explanation unavailable');
    return NextResponse.json({explanation:(await r.text()).trim()});
  }catch(e:any){return NextResponse.json({error:e?.message||'AI explanation unavailable.'},{status:500})}
}
