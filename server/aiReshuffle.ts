import { Router } from 'express';
import type { RotaChatContext } from '../src/types.js';

const router = Router();

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const MAX_SUGGESTIONS = 8;

const SYSTEM_PROMPT = `You are a rota manager's assistant for a UK care home. You are given a JSON snapshot of one week's rota.

Your job: propose cover for days that are below the minimum floor staffing (4 earlies, 4 lates, 3 nights).

Hard rules:
1. Only use people who are listed in "staff" and whose "focusWeekByStaff" entry for the target date is exactly "Off". Never propose someone whose entry says "Off (holiday)", shows a shift, or contains "covering".
2. Match the shift: a day shift (E/L or E/K) needs day-capable care staff (Carer, Shift Leader, Staff Nurse, Bank); a night shift (N) needs night-capable care staff and must respect shiftPreference ("Night" only nights, "Day" never nights).
3. Never propose someone already working that date, and never propose a person twice for the same date. Cover different days rather than piling everyone onto one date: at most one suggestion per short day unless that day is short by more than one person, and at most one day per person while other eligible people remain. Prefer people with fewer existing cover shifts (see coverLoad). When only one person is eligible all week, still return one suggestion for every short day rather than dropping days.
4. Each suggestion must name: date (YYYY-MM-DD), shift (the shift label to cover), absentStaff (whose shift it is, or "" if it is extra cover on top), coverStaff (the exact name from the snapshot), reason (one short sentence, max 25 words).
5. Only propose suggestions that meaningfully help a short day. If no eligible person exists, return no suggestion for that day.
6. Reply with JSON only, in this shape:
{"suggestions":[{"date":"YYYY-MM-DD","shift":"E/L","absentStaff":"Name","coverStaff":"Name","reason":"..."}],"note":"optional one-line summary"}`;

const isString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const CARE_ROLES = ['Staff Nurse', 'Shift Leader', 'Carer', 'Bank'];

function validateContext(context: unknown): context is RotaChatContext {
  if (!context || typeof context !== 'object') return false;
  const candidate = context as Partial<RotaChatContext>;
  return (
    Array.isArray(candidate.staff) &&
    Array.isArray(candidate.days) &&
    Array.isArray(candidate.focusWeekByStaff) &&
    !!candidate.focusWeek &&
    isString(candidate.focusWeek.startDate) &&
    isString(candidate.focusWeek.endDate)
  );
}

interface RawSuggestion {
  date?: unknown;
  shift?: unknown;
  absentStaff?: unknown;
  coverStaff?: unknown;
  reason?: unknown;
}

/**
 * Drops anything the model got wrong: unknown people, dates outside the focus
 * week, people who are not off that day, and duplicates. A suggestion only
 * survives if the snapshot itself supports it.
 */
function validateSuggestions(raw: RawSuggestion[], context: RotaChatContext) {
  const people = new Map(context.staff.map((person) => [person.name, person]));
  const rows = new Map(context.focusWeekByStaff.map((row) => [row.staff, row]));
  const seen = new Set<string>();
  const kept = [];
  const rejected: string[] = [];

  for (const item of raw) {
    if (!isString(item.date) || !isString(item.shift) || !isString(item.coverStaff)) {
      rejected.push('malformed suggestion');
      continue;
    }
    const { date, shift, coverStaff } = item;
    const reason = isString(item.reason) ? item.reason.slice(0, 220) : '';
    const absentStaff = isString(item.absentStaff) ? item.absentStaff : '';

    if (date < context.focusWeek.startDate || date > context.focusWeek.endDate) {
      rejected.push(`${date} outside the focus week`);
      continue;
    }
    if (!people.has(coverStaff)) {
      rejected.push(`${coverStaff} is not on the staff list`);
      continue;
    }
    const row = rows.get(coverStaff);
    if (!row || row.shifts[date] !== 'Off') {
      rejected.push(`${coverStaff} is not off on ${date}`);
      continue;
    }

    const person = people.get(coverStaff)!;
    if (!CARE_ROLES.includes(person.role)) {
      rejected.push(`${coverStaff} is not floor-care staff`);
      continue;
    }
    const wantsNight = shift.trim().toUpperCase() === 'N';
    if (wantsNight && person.shiftPreference === 'Day') {
      rejected.push(`${coverStaff} works day shifts only`);
      continue;
    }
    if (!wantsNight && person.shiftPreference === 'Night') {
      rejected.push(`${coverStaff} works night shifts only`);
      continue;
    }
    const key = `${date}:${coverStaff}`;
    if (seen.has(key)) {
      rejected.push(`${coverStaff} proposed twice on ${date}`);
      continue;
    }
    seen.add(key);
    kept.push({ date, shift, absentStaff, coverStaff, reason });
    if (kept.length >= MAX_SUGGESTIONS) break;
  }

  // Select date by date, so every short day gets a look-in before anyone covers a
  // second day, and spread people across the week.
  const gapFor = (date: string, shift: string) => {
    const day = context.days.find((entry) => entry.date === date);
    if (!day) return 1;
    const wantsNight = shift.trim().toUpperCase() === 'N';
    const gap = wantsNight
      ? day.required.nights - day.scheduled.nights
      : day.required.earlies - day.scheduled.earlies;
    return Math.max(1, gap);
  };

  const byDate = new Map<string, typeof kept>();
  for (const item of kept) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }

  const used = new Set<string>();
  const suggestions: typeof kept = [];
  const unused: typeof kept = [];

  for (const date of [...byDate.keys()].sort()) {
    const list = byDate.get(date)!;
    const cap = gapFor(date, list[0].shift);
    const orderedList = [
      ...list.filter((item) => !used.has(item.coverStaff)),
      ...list.filter((item) => used.has(item.coverStaff)),
    ];
    let filled = 0;
    for (const item of orderedList) {
      if (filled >= cap) {
        unused.push(item);
        continue;
      }
      suggestions.push(item);
      used.add(item.coverStaff);
      filled++;
    }
  }

  suggestions.sort((a, b) => a.date.localeCompare(b.date));
  return { suggestions, rejected, unused };
}

router.post('/suggest', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: 'No OpenAI API key configured. Add OPENAI_API_KEY to .env and restart the server.' });
    return;
  }

  const context = (req.body as { context?: unknown } | undefined)?.context;
  if (!validateContext(context)) {
    res.status(400).json({ error: 'A rota context snapshot is required.' });
    return;
  }

  const shortDays = context.days.filter((day) => {
    if (day.date < context.focusWeek.startDate || day.date > context.focusWeek.endDate) return false;
    return (
      day.scheduled.earlies < day.required.earlies ||
      day.scheduled.lates < day.required.lates ||
      day.scheduled.nights < day.required.nights
    );
  });

  if (shortDays.length === 0) {
    res.json({ suggestions: [], note: 'Every day in this week already meets the minimum floor staffing.' });
    return;
  }

  const payload = JSON.stringify({
    requirements: context.requirements,
    focusWeek: context.focusWeek,
    shortDays: shortDays.map((day) => ({
      date: day.date,
      weekday: day.weekday,
      scheduled: day.scheduled,
      required: day.required,
      unfilled: day.shortages,
    })),
    staff: context.staff,
    coverLoad: context.coverLoad,
    focusWeekByStaff: context.focusWeekByStaff,
    holidays: context.holidays,
  });

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const reasoningStyle = /^(gpt-5|o\d)/i.test(model);
  const tuning = reasoningStyle
    ? { max_completion_tokens: 4000 }
    : { max_tokens: 1200, temperature: 0.2 };

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        ...tuning,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Week: ${context.focusWeek.startDate} to ${context.focusWeek.endDate}\n\n${payload}` },
        ],
      }),
    });

    if (upstream.status === 401 || upstream.status === 403) {
      res.status(502).json({ error: 'OpenAI rejected the API key.' });
      return;
    }
    if (upstream.status === 429) {
      res.status(429).json({ error: 'OpenAI rate limit reached. Try again shortly.' });
      return;
    }
    if (!upstream.ok) {
      res.status(502).json({ error: `OpenAI request failed (${upstream.status}).` });
      return;
    }

    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      res.status(502).json({ error: 'The AI returned an empty answer. Try again.' });
      return;
    }

    let parsed: { suggestions?: RawSuggestion[]; note?: unknown };
    try {
      parsed = JSON.parse(content) as { suggestions?: RawSuggestion[]; note?: unknown };
    } catch {
      res.status(502).json({ error: 'The AI returned something that was not valid JSON. Try again.' });
      return;
    }

    const { suggestions, rejected, unused } = validateSuggestions(parsed.suggestions ?? [], context);
    const spread = unused.length
      ? `${unused.length} further suggestion(s) held back so the same person is not covering every day.`
      : undefined;
    res.json({
      suggestions,
      note: [isString(parsed.note) ? parsed.note : undefined, spread].filter(Boolean).join(' ') || undefined,
      rejected: rejected.slice(0, 6),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'The AI took too long to answer. Try again.' : 'Could not reach OpenAI.',
    });
  }
});

export default router;
