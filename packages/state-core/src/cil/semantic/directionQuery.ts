/** Story / narrative identity — route to Story engine, not PIK. */
export function isStoryIdentityQuery(question: string): boolean {
  const q = question.toLowerCase().trim();
  return (
    /^what(?:'s| is)\s+(?:this|the)\s+project\??$/.test(q) ||
    /^(?:tell me (?:about )?|describe )(?:this|the) project/.test(q) ||
    /^what is this project about/.test(q)
  );
}

/** Direction / goal questions — PIK must dominate reasoning. */
export function isDirectionQuery(question: string): boolean {
  const q = question.toLowerCase().trim();
  if (!q || isStoryIdentityQuery(question)) {
    return false;
  }
  return (
    /core direction|project direction|where (are we|is (this )?project) going|primary goal|project goal|main goal|project identity|why does this project exist|what are we building|north star|mission|vision|偏离|核心方向|项目目标|我们在做什么/.test(
      q,
    ) || /^what is the (core direction|main goal|primary goal|mission|vision)\b/.test(q)
  );
}

/** Drift / alignment questions. */
export function isDriftQuery(question: string): boolean {
  const q = question.toLowerCase();
  return /drift|off.?track|aligned|alignment|偏离目标|是否偏离/.test(q);
}

/** Extract entity topic from "What is MCP?" / "What is the auth module?" */
export function extractWhatIsEntityTopic(question: string): string | undefined {
  const m = question.trim().match(/^what(?:'s| is)\s+(?:the\s+)?(.+?)\??$/i);
  if (!m) {
    return undefined;
  }
  const topic = m[1]!.trim();
  if (!topic || topic.length < 2) {
    return undefined;
  }
  if (/^(this|the)\s+project$/i.test(topic)) {
    return undefined;
  }
  if (/^(happened|next|going on|wrong|up)$/i.test(topic)) {
    return undefined;
  }
  return topic;
}
