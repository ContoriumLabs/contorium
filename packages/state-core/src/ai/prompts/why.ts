export function buildWhyPrompt(input: {
  question: string;
  decision?: string;
  reason?: string;
  date?: string;
  events?: string[];
  adrs?: string[];
}): string {
  const lines = [
    'Explain WHY this project decision was made, in clear natural language (2–4 sentences).',
    'Use ONLY the facts below. Do not invent details.',
    '',
    `User question: ${input.question}`,
  ];
  if (input.decision) {
    lines.push(`Decision: ${input.decision}`);
  }
  if (input.reason) {
    lines.push(`Recorded reason: ${input.reason}`);
  }
  if (input.date) {
    lines.push(`Date: ${input.date}`);
  }
  if (input.adrs?.length) {
    lines.push('', 'Related ADRs:', ...input.adrs.map((a) => `- ${a}`));
  }
  if (input.events?.length) {
    lines.push('', 'Related events:', ...input.events.map((e) => `- ${e}`));
  }
  return lines.join('\n');
}
