import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let source = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    '                  <label className="mt-4 block text-sm font-black">\n                  Save to slot',
    '                  <div className="mt-4 block text-sm font-black">\n                  Save to slot',
  ],
  [
    '                </label>\n\n                <button\n                  disabled={\n                    saving ||',
    '                </div>\n\n                <button\n                  disabled={\n                    saving ||',
  ],
  [
    '          <label className="mt-6 block text-sm font-black">\n            Select book/s',
    '          <div className="mt-6 block text-sm font-black">\n            Select book/s',
  ],
  [
    '          </label>\n\n          <div className="mt-6 grid gap-5 sm:grid-cols-3">',
    '          </div>\n\n          <div className="mt-6 grid gap-5 sm:grid-cols-3">',
  ],
  [
    '            <label className="text-sm font-black">\n              Questions',
    '            <div className="text-sm font-black">\n              Questions',
  ],
  [
    '            </label>\n\n            {/* Duration */}',
    '            </div>\n\n            {/* Duration */}',
  ],
  [
    '            <label className="text-sm font-black">\n              Duration',
    '            <div className="text-sm font-black">\n              Duration',
  ],
  [
    '            </label>\n\n            {/* Difficulty */}',
    '            </div>\n\n            {/* Difficulty */}',
  ],
  [
    '            <label className="text-sm font-black">\n              Difficulty',
    '            <div className="text-sm font-black">\n              Difficulty',
  ],
  [
    '            </label>\n          </div>\n\n          <label className="mt-5 block text-sm font-black">',
    '            </div>\n          </div>\n\n          <div className="mt-5 block text-sm font-black">',
  ],
  [
    '          </label>\n\n          <button\n            type="button"\n            onClick={startQuiz}',
    '          </div>\n\n          <button\n            type="button"\n            onClick={startQuiz}',
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    throw new Error(`Quiz Studio control patch could not find expected source fragment: ${from.slice(0, 80)}`);
  }
  source = source.replace(from, to);
}

fs.writeFileSync(path, source);
console.log('Quiz Studio interactive-control patch applied: interactive dropdowns and book selectors are no longer nested inside <label> elements.');