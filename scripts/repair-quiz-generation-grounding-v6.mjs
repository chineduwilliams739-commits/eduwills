// Compatibility shim: the deploy workflow and the v5 Book Learner script
// already invoke this file. Keep the entry point stable while delegating to the
// syntax-safe v7 repair.
await import('./repair-quiz-generation-v7.mjs');
console.log('Quiz generation grounding v6 compatibility shim completed.');
