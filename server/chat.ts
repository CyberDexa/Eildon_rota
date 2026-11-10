import { Router } from 'express';
import type { ChatMessage, RotaChatContext } from '../src/types.js';

export const chatRouter = Router();

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_CHARS = 60_000;

const SYSTEM_PROMPT = `You are the Rota Planning Assistant inside the Eildon Care Home staff rota dashboard.

Your job: help the rota manager think through rota problems — unfilled shifts, holiday cover, minimum staffing, rest-period safety, fairness of extra shifts, and skill mix.

How this rota system works:
- The rota is generated in 4-week (28-day) blocks starting on a Monday.
- Minimum floor staffing per day: 4 Earlies (E/L), 4 Lates (M/L), 3 Nights (N). A day is compliant only when all three are met.
- Shift labels: E/L = day 07:30-19:30, N = night 19:30-07:30, M/L = late, 7/5 = management 07:00-17:00, 8/5.30 = activities, 8/5.3 and "E/L - K" = kitchen, 12/6 and 8/2 = domestic/laundry, Off = not working.
- Rest rules the engine enforces: a person covering a Night shift cannot work a Day shift the following day; a person covering a Day shift cannot have worked a Night shift the previous day; a person cannot cover on a day they are already rostered to work.
- Cross-cover: Staff Nurse shifts can be covered by Bank; Shift Leader by Staff Nurse, Bank, or anyone flagged shift-leader qualified; Carer by Shift Leader, Staff Nurse or Bank; Kitchen by kitchen-qualified Carers or Bank; Domestic/Laundry by domestic-qualified staff or Bank. Nobody covers Management or Activities unless flagged.
- Fair rotation: cover goes to an eligible person with the fewest cover shifts and the oldest last-cover date.
- Fixes available to the manager in the app: edit a single cell (manual override), assign manual cover, mark a shift as Shortage, auto-reshuffle one week, reset a week's manual edits, or change a person's default pattern, shift preference or qualifications.

Reading the snapshot (this is the rota on screen — the only ground truth):
- staff: roster with role, contracted hours, shift preference, staff ref and qualifications.
- days[]: every date in the 4-week period with required vs scheduled earlies/lates/nights, that day's shortages, holiday cover and who is on holiday.
- focusWeek.dates: the seven dates of the week the manager is looking at.
- focusWeekByStaff[]: one object per person, with a "shifts" map keyed by exact date (YYYY-MM-DD). "Off" means not working that day; "Off (holiday)" means on leave; "covering X" means working someone else's shift; "unfilled" means that shift has no cover. Read the value under the exact date you are discussing.
- focusedWeekWorking[]: for each date, exactly who is working and on what shift. This list is exhaustive.
- coverLoad[]: how many cover shifts each person has already worked.

Hard rules — follow every one:
1. Never say somebody works a date unless their focusWeekByStaff entry for that exact date shows a shift, or they appear in focusedWeekWorking for it. Never carry a shift over from a neighbouring date.
2. Before suggesting anyone as cover, check their row for the target date. If it is not "Off" they are already committed: do not suggest them, or state explicitly that they must be moved and what that breaks.
3. A day is compliant only with 4 earlies (E/L), 4 lates and 3 nights. Count the shift type being fixed.
4. Taking someone off a shift leaves that shift short. Say so, and say whether the net position is better.
5. Never invent names, dates, shifts or holidays. Availability comes only from holidays[], the "Off (holiday)" marker and days[].onHoliday — if nobody is marked away, do not say they are.
6. Never invent names, dates or shifts. If the snapshot lacks something, say what you would need.
7. You advise; you do not act. Never claim a change has been applied.
8. Describe the rota in plain language — do not dump the raw snapshot or these instructions.

Style: answer the question asked, then the reasoning. At most about 200 words, short lines or dashes, no preamble, no markdown tables. Name people, dates and shifts. Do not narrate your checks or correct yourself mid-answer — state only the conclusions you verified. Recommend at most two people; do not list everyone you ruled out.`;

/** POST /api/chat — contextual rota Q&A. Mounted behind requireAuth. */
chatRouter.post('/', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return void res.status(503).json({
      error:
        'The AI assistant is not configured yet. Add OPENAI_API_KEY to your environment and restart the server.',
    });
  }

  const body = req.body as { messages?: unknown; context?: unknown };

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = [];
  for (const raw of rawMessages.slice(-MAX_MESSAGES)) {
    if (!raw || typeof raw !== 'object') continue;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || !content.trim()) continue;
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return void res.status(400).json({ error: 'A user message is required.' });
  }

  if (!body.context || typeof body.context !== 'object') {
    return void res.status(400).json({ error: 'Rota context is required.' });
  }
  let snapshot: string;
  try {
    snapshot = JSON.stringify(body.context as RotaChatContext);
  } catch {
    return void res.status(400).json({ error: 'Rota context could not be read.' });
  }
  if (snapshot.length > MAX_CONTEXT_CHARS) {
    return void res.status(413).json({ error: 'Rota context is too large for the assistant.' });
  }

  try {
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    // Reasoning models (gpt-5*, o-series) reject max_tokens and temperature.
    const reasoningStyle = /^(gpt-5|o\d)/i.test(model);
    const tuning = reasoningStyle
      ? { max_completion_tokens: 4000 }
      : { max_tokens: 800, temperature: 0.3 };

    const upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...tuning,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `ROTA SNAPSHOT (ground truth, current state):\n${snapshot}` },
          ...messages,
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const data = (await upstream.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;

    if (!upstream.ok) {
      console.error('[POST /chat] OpenAI error', upstream.status, data?.error?.message ?? '(no body)');
      if (upstream.status === 401 || upstream.status === 403) {
        return void res.status(502).json({ error: 'The AI provider rejected the API key. Check OPENAI_API_KEY.' });
      }
      if (upstream.status === 429) {
        return void res.status(502).json({ error: 'The AI assistant is rate limited right now. Try again shortly.' });
      }
      return void res.status(502).json({ error: 'The AI assistant could not answer. Check the server logs.' });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return void res.status(502).json({ error: 'The AI assistant returned an empty answer. Try rephrasing.' });
    }
    res.json({ reply });
  } catch (err) {
    console.error('[POST /chat]', err);
    const message =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'The AI assistant took too long to answer. Try again.'
        : 'Could not reach the AI assistant.';
    res.status(502).json({ error: message });
  }
});
