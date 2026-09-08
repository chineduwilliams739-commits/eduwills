import fs from 'node:fs';

const path = 'app/dashboard/activation/page.tsx';
let source = fs.readFileSync(path, 'utf8');

if (source.includes('paymentSuccess&&<div className="fixed inset-0 z-[90]') && !source.includes("@/components/ActivationSuccessModal")) {
  const start = source.indexOf('  {paymentSuccess&&<div className="fixed inset-0 z-[90]');
  const endMarker = '</div></div></div>}';
  const end = source.indexOf(endMarker, start);
  if (start >= 0 && end >= 0) {
    const importMarker = "import { auth, db } from '@/lib/firebase';";
    if (!source.includes("import ActivationSuccessModal from '@/components/ActivationSuccessModal';") && source.includes(importMarker)) {
      source = source.replace(importMarker, `${importMarker}\nimport ActivationSuccessModal from '@/components/ActivationSuccessModal';`, 1);
    }
    source = source.slice(0, start) + '  {paymentSuccess&&<ActivationSuccessModal success={paymentSuccess} copied={copied} onCopy={copyCode} onClose={()=>setPaymentSuccess(null)}/>}' + source.slice(end + endMarker.length);
    console.log('Replaced fragile inline activation success modal with standalone component.');
  }
}

// Idempotent: never fail a Pages build because obsolete legacy activation markers are absent.
fs.writeFileSync(path, source);
console.log(source.includes('ActivationSuccessModal') ? 'Modern activation modal verified.' : 'Activation page left unchanged safely.');
