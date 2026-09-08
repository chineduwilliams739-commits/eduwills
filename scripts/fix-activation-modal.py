from pathlib import Path

p=Path('app/dashboard/activation/page.tsx')
s=p.read_text()
if "import ActivationSuccessModal from '@/components/ActivationSuccessModal';" not in s:
    marker="import { auth, db } from '@/lib/firebase';"
    if marker not in s: raise SystemExit('activation import marker missing')
    s=s.replace(marker, marker+"\nimport ActivationSuccessModal from '@/components/ActivationSuccessModal';",1)
start=s.find('  {paymentSuccess&&<div className="fixed inset-0 z-[90]')
if start<0:
    raise SystemExit('broken success modal marker not found')
end_marker='</div></div></div>}'
end=s.find(end_marker,start)
if end<0:
    raise SystemExit('broken success modal closing marker not found')
end += len(end_marker)
replacement='  {paymentSuccess&&<ActivationSuccessModal success={paymentSuccess} copied={copied} onCopy={copyCode} onClose={()=>setPaymentSuccess(null)}/>}'
s=s[:start]+replacement+s[end:]
p.write_text(s)
print('Activation success modal extracted and repaired.')
