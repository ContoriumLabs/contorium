export function buildStoryPrompt(ruleMarkdown: string): string {
  return [
    'Rewrite the following project story as a cohesive narrative for a developer joining the project.',
    'Keep all factual content. Use markdown headings. Do not add fictional milestones.',
    '',
    ruleMarkdown,
  ].join('\n');
}

export function buildEssencePrompt(ruleMarkdown: string): string {
  return [
    'Compress the following project essence into a tighter summary (~200–400 words).',
    'Preserve decisions, focus, and risks. Markdown output.',
    '',
    ruleMarkdown,
  ].join('\n');
}

export function buildDnaPrompt(ruleText: string): string {
  return [
    'Turn this project DNA fingerprint into a concise identity paragraph for AI handoff.',
    'Keep architecture, memory model, interaction layer, state model, and goal accurate.',
    '',
    ruleText,
  ].join('\n');
}

export function buildAskEnhancePrompt(input: {
  question: string;
  ruleAnswer: string;
  facts?: string[];
}): string {
  const lines = [
    'Improve this Contorium answer for clarity while preserving all facts.',
    '2–5 sentences. No new decisions or file names.',
    '',
    `Question: ${input.question}`,
    `Rule-based answer: ${input.ruleAnswer}`,
  ];
  if (input.facts?.length) {
    lines.push('', 'Supporting facts:', ...input.facts.map((f) => `- ${f}`));
  }
  return lines.join('\n');
}
