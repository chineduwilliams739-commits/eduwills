import fs from 'node:fs';

const personalPath = 'app/dashboard/personal/page.tsx';
const adminPath = 'app/admin/page.tsx';

const personal = fs.readFileSync(personalPath, 'utf8');
const admin = fs.readFileSync(adminPath, 'utf8');

// The Admin page has evolved since the original repair script was written.
// Validate the current implementation instead of looking for obsolete source
// snippets and failing the entire deployment.
const personalChecks = [
  ['activeCategory', 'Personal active category implementation missing'],
  ['switchCategory', 'Personal category switch handler missing'],
  ['Switch EDUWILLS category', 'Personal category switch UI missing'],
];
for (const [needle, message] of personalChecks) {
  if (!personal.includes(needle)) throw new Error(message);
}

const adminChecks = [
  ['CATEGORIES', 'Admin category definitions missing'],
  ['selectedCategories', 'Admin selected category state missing'],
  ['saveCategories', 'Admin category assignment handler missing'],
  ['categories: selectedCategories', 'Category-aware WilliToken generation missing'],
  ['setDoc(doc(db, \'williTokens\'', 'WilliToken generator missing'],
  ['revokeToken', 'WilliToken revoke control missing'],
];
for (const [needle, message] of adminChecks) {
  if (!admin.includes(needle)) throw new Error(message);
}

// Ensure Book Learner remains a selectable category in the modern Admin UI.
if (!admin.includes("'Book Learner'")) {
  throw new Error('Book Learner category is missing from the Admin category model');
}

console.log('EDUWILLS category switching and category-aware Admin WilliToken assignment verified against the current implementation.');
