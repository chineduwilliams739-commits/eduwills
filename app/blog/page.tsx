import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Guide & Exam Prep Tips | EDUWILLS',
  description: 'Practical study tips, WAEC, JAMB, NECO and book-learning guidance for Nigerian students.',
  alternates: { canonical: 'https://chineduwilliams739-commits.github.io/eduwills/blog' },
};

const posts = [
  {
    title: 'How to Prepare for JAMB in 30 Days',
    description: 'A practical 30-day routine for combining focused revision, CBT practice and book-based quizzes.',
    sections: ['Start with a diagnostic quiz', 'Build a daily revision timetable', 'Practise under CBT-style time pressure', 'Review mistakes instead of only chasing scores'],
  },
  {
    title: 'WAEC Study Tips: How to Stop Forgetting What You Read',
    description: 'Use active recall, spaced review and question practice to turn reading into durable learning.',
    sections: ['Read in focused blocks', 'Close the book and recall key ideas', 'Turn chapters into questions', 'Revisit difficult material later'],
  },
  {
    title: 'NECO Exam Preparation: A Smarter Revision Plan',
    description: 'Simple ways to organise subjects, identify weak areas and practise consistently before NECO.',
    sections: ['Map your syllabus', 'Prioritise weak topics', 'Mix old and new revision', 'Track your quiz performance'],
  },
  {
    title: 'How to Turn Any Book into a Practice Quiz',
    description: 'A guide to studying novels, textbooks and set books by testing yourself on actual content.',
    sections: ['Choose the exact book', 'Give precise quiz instructions', 'Focus on events, characters and details', 'Use scores to decide what to revise next'],
  },
];

export default function BlogPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontWeight: 700, letterSpacing: 1 }}>EDUWILLS STUDY GUIDE</p>
      <h1 style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', marginBottom: 12 }}>Study smarter for WAEC, JAMB & NECO</h1>
      <p style={{ fontSize: 18, lineHeight: 1.7, maxWidth: 760 }}>Practical study strategies for Nigerian students, from book-based revision to CBT practice and active recall.</p>
      <section style={{ display: 'grid', gap: 20, marginTop: 36 }}>
        {posts.map((post) => (
          <article key={post.title} style={{ border: '1px solid #ddd', borderRadius: 18, padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>{post.title}</h2>
            <p style={{ lineHeight: 1.7 }}>{post.description}</p>
            <ul>{post.sections.map((section) => <li key={section} style={{ marginBottom: 8 }}>{section}</li>)}</ul>
            <p><a href="/eduwills/">Try EDUWILLS quiz practice →</a></p>
          </article>
        ))}
      </section>
    </main>
  );
}
