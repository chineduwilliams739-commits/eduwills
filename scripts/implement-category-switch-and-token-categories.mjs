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

// Keep the authoritative category model in sync with the four EDUWILLS categories.
if (admin.includes("const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary'] as const;")) {
  admin = admin.replace(
    "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary'] as const;",
    "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;"
  );
}
if (admin.includes("const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;")) {
  // issueCategories is intentionally derived from CATEGORIES so token issuance cannot drift.
  if (!admin.includes('const issueCategories = [...CATEGORIES];')) {
    admin = admin.replace(
      "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;",
      "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;\nconst issueCategories = [...CATEGORIES];"
    );
  }
}

if (admin.includes("if (['senior', 'senior secondary', 'senior secondary school', 'sss'].includes(v)) return 'Senior Secondary';") && !admin.includes("return 'Book Learner';")) {
  admin = admin.replace(
    "if (['senior', 'senior secondary', 'senior secondary school', 'sss'].includes(v)) return 'Senior Secondary';",
    "if (['senior', 'senior secondary', 'senior secondary school', 'sss'].includes(v)) return 'Senior Secondary';\n  if (['book', 'books', 'book learner', 'booklearner'].includes(v)) return 'Book Learner';"
  );
}

if (!admin.includes("'Book Learner'")) {
  throw new Error('Book Learner category is missing from the Admin category model');
}

// Validate the current Admin implementation semantically. Older repairs expected
// the token document to contain `categories: selectedCategories`, but the current
// implementation normalizes the selected values first and writes `categories` from
// that validated array. Both forms are category-aware; the latter is safer.
const adminChecks = [
  ['CATEGORIES', 'Admin category definitions missing'],
  ['selectedCategories', 'Admin selected category state missing'],
  ['saveCategories', 'Admin category assignment handler missing'],
  ['tokenCategories', 'Admin token category selection missing'],
  ['createToken', 'WilliToken generator missing'],
  ['categories', 'WilliToken category field missing'],
  ['setDoc(doc(db, \'williTokens\'', 'WilliToken generator storage missing'],
  ['revokeToken', 'WilliToken revoke control missing'],
];
for (const [needle, message] of adminChecks) {
  if (!admin.includes(needle)) throw new Error(message);
}

// The generated token must explicitly receive the validated category array.
const hasValidatedTokenCategories = /const categories\s*=\s*\[\.\.\.new Set\(tokenCategories/.test(admin) && /categories,/.test(admin);
if (!hasValidatedTokenCategories) throw new Error('Category-aware WilliToken linkage is missing');

fs.writeFileSync(adminPath, admin);
console.log('EDUWILLS category switching and category-aware Admin WilliToken assignment verified and upgraded for Book Learner.');
