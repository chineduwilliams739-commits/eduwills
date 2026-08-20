import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const file = 'app/dashboard/quiz/page.tsx';
const knownGoodCommit = '593e26999fbabd52121578eb92bd4833d4166145';

try {
  const restored = execFileSync('git', ['show', `${knownGoodCommit}:${file}`], { encoding: 'utf8' });
  if (!restored.includes('generateQuiz') || !restored.includes('generationStatus') || !restored.includes('exitConfirm') || !restored.includes('setIdx')) {
    throw new Error('Known-good Quiz Studio source failed safety checks.');
  }
  fs.writeFileSync(file, restored);
  console.log(`Restored ${file} from known-good Quiz Studio commit ${knownGoodCommit}.`);
} catch (error) {
  console.error('Could not restore the known-good Quiz Studio source.', error);
  process.exit(1);
}
