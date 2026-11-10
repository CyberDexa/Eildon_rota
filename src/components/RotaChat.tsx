import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Staff, Holiday, DayRota, CoverRecord, RotaShift, ChatMessage } from '../types';
import { buildRotaChatContext } from '../chatContext';
import * as api from '../api';

interface RotaChatProps {
  staffList: Staff[];
  holidays: Holiday[];
  rota: DayRota[];
  covers: CoverRecord[];
  manualOverrides: Record<string, Record<string, RotaShift>>;
  rotaStartDate: string;
  selectedWeek: number;
}

const SUGGESTIONS = [
  'Where are the biggest staffing gaps in this week?',
  'How can I fill the unfilled shifts without breaking rest rules?',
  'Is anyone being asked to cover unfairly often?',
  'What would fix the weakest day of this rota?',
];

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/**
 * Context-aware rota assistant.
 * The whole visible rota is summarised and sent with each question, so the
 * assistant reasons about real names, dates and shortages rather than generic advice.
 */
export const RotaChat: React.FC<RotaChatProps> = ({
  staffList,
  holidays,
  rota,
  covers,
  manualOverrides,
  rotaStartDate,
  selectedWeek,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const context = useMemo(
    () =>
      buildRotaChatContext({
        staffList,
        holidays,
        rota,
        covers,
        manualOverrides,
        rotaStartDate,
        selectedWeek,
      }),
    [staffList, holidays, rota, covers, manualOverrides, rotaStartDate, selectedWeek]
  );

  const focusDays = useMemo(
    () =>
      context.days.filter(
        (day) => day.date >= context.focusWeek.startDate && day.date <= context.focusWeek.endDate
      ),
    [context]
  );

  const focusShortages = focusDays.reduce((total, day) => total + day.shortages.length, 0);
  const focusGaps = focusDays.filter(
    (day) =>
      day.scheduled.earlies < day.required.earlies ||
      day.scheduled.lates < day.required.lates ||
      day.scheduled.nights < day.required.nights
  ).length;

  // Keep the newest turn in view
  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, sending, open]);

  // Escape closes the panel
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || sending) return;

      const next: ChatMessage[] = [...messages, { role: 'user', content: question }];
      setMessages(next);
      setDraft('');
      setError(null);
      setSending(true);
      try {
        const { reply } = await api.sendChatMessage(next, context);
        setMessages([...next, { role: 'assistant', content: reply }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The assistant could not answer. Try again.');
      } finally {
        setSending(false);
      }
    },
    [messages, sending, context]
  );

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="rota-chat-launcher"
        onClick={() => setOpen(true)}
        aria-label="Open the AI rota assistant"
      >
        <span aria-hidden="true">✨</span> Ask about this rota
        {focusShortages > 0 && <span className="rota-chat-launcher-badge">{focusShortages}</span>}
      </button>
    );
  }

  return (
    <section className="rota-chat-panel" role="dialog" aria-modal="false" aria-label="AI rota assistant">
      <header className="rota-chat-header">
        <div>
          <h3>Rota Assistant</h3>
          <p>
            Reading Week {selectedWeek + 1} ({formatDate(context.focusWeek.startDate)} –{' '}
            {formatDate(context.focusWeek.endDate)})
          </p>
        </div>
        <div className="rota-chat-header-actions">
          {messages.length > 0 && (
            <button
              type="button"
              className="rota-chat-link"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="rota-chat-close"
            onClick={() => setOpen(false)}
            aria-label="Close the AI rota assistant"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="rota-chat-context" aria-label="Context shared with the assistant">
        <span>{staffList.length} staff</span>
        <span>{context.holidays.length} holidays booked</span>
        <span className={focusShortages > 0 ? 'is-warning' : ''}>
          {focusShortages} unfilled shift{focusShortages === 1 ? '' : 's'} this week
        </span>
        <span className={focusGaps > 0 ? 'is-warning' : ''}>
          {focusGaps} day{focusGaps === 1 ? '' : 's'} below minimum
        </span>
      </div>

      <div className="rota-chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="rota-chat-intro">
            <p>
              Ask me to work through a rota problem. I can see this rota&apos;s staff, holidays,
              shortages, cover load and minimum staffing — so you get answers about your actual shifts.
            </p>
            <div className="rota-chat-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  disabled={sending}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`rota-chat-bubble ${message.role}`}>
            {message.content}
          </div>
        ))}

        {sending && (
          <div className="rota-chat-bubble assistant rota-chat-typing">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}

        {error && <div className="rota-chat-error">{error}</div>}
      </div>

      <div className="rota-chat-composer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="e.g. How do I cover Friday's night shift?"
          rows={2}
          disabled={sending}
          aria-label="Ask the rota assistant"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void send(draft)}
          disabled={sending || !draft.trim()}
        >
          {sending ? 'Thinking…' : 'Send'}
        </button>
      </div>
      <p className="rota-chat-footnote">
        Suggestions only — check against home policy and safe staffing before applying.
      </p>
    </section>
  );
};
