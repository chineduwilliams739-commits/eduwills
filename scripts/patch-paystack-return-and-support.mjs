import fs from 'node:fs';

const activation = 'app/dashboard/activation/page.tsx';
const source = fs.readFileSync(activation, 'utf8');

// The activation page now owns its Paystack return handling and payment configuration.
// Do not restore an older generated page during every deployment: doing so silently
// replaced the live implementation and was the reason fixes kept disappearing.
if (source.includes('PAYMENT_CONFIG_URL') && source.includes('/paystack/initialize')) {
  console.log('Modern Paystack activation implementation detected; no legacy patch applied.');
  process.exit(0);
}

console.log('Legacy activation implementation detected. No destructive rewrite will be performed.');
