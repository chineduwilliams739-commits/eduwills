import fs from 'node:fs';

const adminPath = 'app/admin/page.tsx';
let admin = fs.readFileSync(adminPath, 'utf8');

const activeFn = /function isUserActive\(user: User, tokens: WilliToken\[\]\): boolean \{[\s\S]*?\n\}/;
if (!activeFn.test(admin)) {
  throw new Error('Admin isUserActive function not found');
}

admin = admin.replace(activeFn, `function isUserActive(user: User, tokens: WilliToken[]): boolean {
  const uid = user.uid || user.id;
  return tokens.some(token => {
    const owner = token.userId || token.uid;
    const expiry = expiryDate(token);
    return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > Date.now();
  });
}`);

fs.writeFileSync(adminPath, admin);
console.log('WilliToken-first Admin status repair applied without modifying dashboard layout.');
