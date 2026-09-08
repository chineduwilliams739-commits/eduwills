import fs from 'node:fs';

const path = 'app/dashboard/activation/page.tsx';
let source = fs.readFileSync(path, 'utf8');
const componentImport = "import ActivationSuccessModal from '@/components/ActivationSuccessModal';";
const importMarker = "import { auth, db } from '@/lib/firebase';";

// Repair the legacy inline success modal by locating its complete balanced <div> tree.
// The previous repair used a fixed closing sequence, which could stop inside nested
// modal content and leave page.tsx syntactically invalid.
const modalStartMarker = '  {paymentSuccess&&<div className="fixed inset-0 z-[90]';
if (source.includes(modalStartMarker) && !source.includes(componentImport)) {
  const start = source.indexOf(modalStartMarker);
  let cursor = start;
  let depth = 0;
  let foundEnd = -1;

  const tagPattern = /<\/?div\b[^>]*>/g;
  tagPattern.lastIndex = start;
  let match;
  while ((match = tagPattern.exec(source)) !== null) {
    const tag = match[0];
    if (tag.startsWith('</')) depth -= 1;
    else if (!tag.endsWith('/>')) depth += 1;
    if (depth === 0) {
      foundEnd = match.index + tag.length;
      break;
    }
    cursor = match.index + tag.length;
  }

  if (foundEnd > start) {
    if (source.includes(importMarker) && !source.includes(componentImport)) {
      source = source.replace(importMarker, `${importMarker}\n${componentImport}`);
    }
    const replacement = '  {paymentSuccess&&<ActivationSuccessModal success={paymentSuccess} copied={copied} onCopy={copyCode} onClose={()=>setPaymentSuccess(null)}/>}';
    source = source.slice(0, start) + replacement + source.slice(foundEnd);
    console.log('Replaced complete legacy activation success modal using balanced JSX scanning.');
  } else {
    console.log('Legacy activation modal detected but no balanced closing div was found; leaving source unchanged.');
  }
}

// If a prior broken repair left the component import but the page still contains the
// old modal marker, remove the complete balanced modal tree as a second safe pass.
if (source.includes(modalStartMarker)) {
  const start = source.indexOf(modalStartMarker);
  let depth = 0;
  let foundEnd = -1;
  const tagPattern = /<\/?div\b[^>]*>/g;
  tagPattern.lastIndex = start;
  let match;
  while ((match = tagPattern.exec(source)) !== null) {
    const tag = match[0];
    if (tag.startsWith('</')) depth -= 1;
    else if (!tag.endsWith('/>')) depth += 1;
    if (depth === 0) {
      foundEnd = match.index + tag.length;
      break;
    }
  }
  if (foundEnd > start) {
    source = source.slice(0, start) + '  {paymentSuccess&&<ActivationSuccessModal success={paymentSuccess} copied={copied} onCopy={copyCode} onClose={()=>setPaymentSuccess(null)}/>}' + source.slice(foundEnd);
    console.log('Completed activation modal cleanup pass.');
  }
}

fs.writeFileSync(path, source);
console.log(source.includes('ActivationSuccessModal') ? 'Modern activation modal verified.' : 'Activation page left unchanged safely.');
