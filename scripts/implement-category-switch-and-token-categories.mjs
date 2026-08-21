import fs from 'node:fs';

const personalPath = 'app/dashboard/personal/page.tsx';
const adminPath = 'app/admin/page.tsx';

const personal = fs.readFileSync(personalPath, 'utf8');
let admin = fs.readFileSync(adminPath, 'utf8');

const personalChecks = [
  ['activeCategory', 'Personal active category implementation missing'],
  ['switchCategory', 'Personal category switch handler missing'],
  ['Switch EDUWILLS category', 'Personal category switch UI missing'],
];
for (const [needle, message] of personalChecks) {
  if (!personal.includes(needle)) throw new Error(message);
}

// The Admin page is already on the newer selectedCategories/saveCategories
// implementation. Upgrade its category list in-place rather than searching
// for the obsolete generator block used by the first version of this repair.
if (admin.includes("const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary'] as const;")) {
  admin = admin.replace(
    "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary'] as const;",
    "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;"
  );
}
if (admin.includes("if (['senior', 'senior secondary', 'senior secondary school', 'sss'].includes(v)) return 'Senior Secondary';")) {
  admin = admin.replace(
    "if (['senior', 'senior secondary', 'senior secondary school', 'sss'].includes(v)) return 'Senior Secondary';",
    "if (['senior', 'senior secondary', 'senior secondary school', 'sss'].includes(v)) return 'Senior Secondary';\n  if (['book', 'books', 'book learner', 'book learner'].includes(v)) return 'Book Learner';"
  );
}
if (!admin.includes("'Book Learner'")) {
  throw new Error('Book Learner category is missing from the Admin category model');
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

fs.writeFileSync(adminPath, admin);
console.log('EDUWILLS category switching and category-aware Admin WilliToken assignment verified and upgraded for Book Learner.');
