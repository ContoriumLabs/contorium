import {
  extractWhatIsEntityTopic,
  isDirectionQuery,
  isDriftQuery,
  isStoryIdentityQuery,
} from './semantic/directionQuery.js';
import type { CilIntent, HistoryRange } from './types.js';

export interface RoutedQuery {
  intent: CilIntent;
  topic?: string;
  range?: HistoryRange;
  perspective?: 'historical' | 'retrospective';
  raw: string;
}

function extractEntityTopic(question: string, q: string): string | undefined {
  const fromWhatIs = extractWhatIsEntityTopic(question);
  if (fromWhatIs) {
    return fromWhatIs;
  }
  if (/tell me (everything )?about|everything related to|related to|what links to/.test(q)) {
    return q
      .replace(/tell me (everything )?about\s+/i, '')
      .replace(/everything related to\s+/i, '')
      .replace(/related to\s+/i, '')
      .replace(/what links to\s+/i, '')
      .replace(/\?$/, '')
      .trim();
  }
  return undefined;
}

/** Map natural language → structured CIL intent (Query Router). */
export function routeQuery(question: string): RoutedQuery {
  const q = question.toLowerCase().trim();
  const raw = question.trim();

  if (/what should i do next|what next|next action|next step/.test(q)) {
    return { intent: 'action', raw };
  }

  if (
    /state on|project on|snapshot on|what was.*on \d{4}|decisions existed on|focus on \d{4}/.test(q) ||
    (/\d{4}-\d{2}-\d{2}/.test(q) && /on|before|after|at/.test(q))
  ) {
    const dateMatch = q.match(/\d{4}-\d{2}-\d{2}/);
    const retrospective =
      /what do we know now about|know now about|retrospective|in hindsight|looking back now/.test(q);
    return {
      intent: 'time_travel',
      topic: dateMatch?.[0],
      perspective: retrospective ? 'retrospective' : 'historical',
      raw,
    };
  }

  if (
    /what was (the )?state|state at a time|state at time|project state at|snapshot at|time travel|on what date|what was focus on/.test(
      q,
    ) &&
    !/\d{4}-\d{2}-\d{2}/.test(q)
  ) {
    return { intent: 'time_travel', raw };
  }

  if (isStoryIdentityQuery(question)) {
    return { intent: 'story', raw };
  }

  if (isDirectionQuery(question) || isDriftQuery(question)) {
    return { intent: 'direction', raw };
  }

  if (
    /healthy|health status|project health|is (the |this )?project (ok|well|healthy)|cognitive health|health score/.test(
      q,
    )
  ) {
    return { intent: 'state', topic: 'health', raw };
  }

  const entityTopic = extractEntityTopic(question, q);
  if (entityTopic) {
    return { intent: 'entity', topic: entityTopic, raw };
  }

  if (/^why not\b|why wasn't|why isn't/.test(q)) {
    const topic = q.replace(/^why\s+(not|wasn't|isn't)\s+/i, '').replace(/\?$/, '').trim();
    return { intent: 'decision', topic: topic || undefined, raw };
  }

  if (/^why\b|why was|why does|decision|adr|unresolved decision/.test(q)) {
    const topic = q
      .replace(/^why\s+(was|does|did|is)\s+/i, '')
      .replace(/.*decision\s+/i, '')
      .replace(/\?$/, '')
      .trim();
    return { intent: 'decision', topic: topic || undefined, raw };
  }

  if (/what happened|recent|this week|today|yesterday|history|module history|what changed this week/.test(q)) {
    let range: HistoryRange = 'last_7_days';
    if (q.includes('today')) {
      range = 'today';
    } else if (q.includes('yesterday')) {
      range = 'yesterday';
    } else if (q.includes('30 day') || q.includes('month')) {
      range = 'last_30_days';
    }
    return { intent: 'history', range, raw };
  }

  if (/state on|project state|current focus|what matters|focus now/.test(q)) {
    const dateMatch = q.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      return { intent: 'time_travel', topic: dateMatch[0], raw };
    }
    return { intent: 'state', raw };
  }

  if (/tell me this project|project story|describe project|story|essence|evolved through/.test(q)) {
    return { intent: 'story', raw };
  }

  if (/replay|how this project evolved|evolution replay/.test(q)) {
    return { intent: 'history', topic: 'replay', raw };
  }

  if (/blast radius|impact|what breaks|affects|what changed|who modified|modified/.test(q)) {
    const topic = q
      .replace(/what changed in\s+/i, '')
      .replace(/who modified\s+/i, '')
      .replace(/.*impact\s+/i, '')
      .replace(/blast radius\s+/i, '')
      .replace(/\?$/, '')
      .trim();
    return { intent: 'debug', topic: topic || undefined, raw };
  }

  if (/journey|evolution|roadmap/.test(q)) {
    return { intent: 'debug', topic: 'journey', raw };
  }

  return { intent: 'history', range: 'last_7_days', raw };
}
