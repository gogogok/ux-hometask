'use client';

import * as Slider from '@radix-ui/react-slider';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  Droplets,
  Heart,
  LogOut,
  Quote,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const EMOTIONS = [
  { id: 'joy', name: 'Радость', color: '#F5D873', initial: 72 },
  { id: 'calm', name: 'Спокойствие', color: '#9AAA70', initial: 48 },
  { id: 'excitement', name: 'Предвкушение', color: '#84A7DC', initial: 34 },
  { id: 'sadness', name: 'Грусть', color: '#DCC9BF', initial: 18 },
  { id: 'anxiety', name: 'Беспокойство', color: '#A9AEDB', initial: 22 },
  { id: 'irritation', name: 'Раздражение', color: '#E58E79', initial: 8 },
] as const;

const QUOTES = [
  'Тебе не нужно спешить, чтобы всё равно двигаться вперёд.',
  'Маленькая забота о себе сегодня — уже важное действие.',
  'Чувства приходят волнами. Ты — не волна, ты — целое море.',
  'Можно быть в процессе и всё равно гордиться собой.',
  'Иногда самый смелый шаг — дать себе немного тишины.',
  'У тебя есть право на день без великих достижений.',
] as const;

const EMOTION_REFLECTIONS: Record<EmotionId, string> = {
  joy: 'Свет внутри не требует причины — позволь ему остаться.',
  calm: 'В тишине становится слышно то, что действительно важно.',
  excitement: 'Будущее уже касается тебя — оставь ему место развернуться.',
  sadness: 'Грусть напоминает о том, что было по-настоящему дорого.',
  anxiety: 'Тревога смотрит в будущее; вернись туда, где стоят твои ноги.',
  irritation: 'Раздражение часто указывает на границу, которую пора заметить.',
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const STORAGE_KEYS = {
  users: 'tiho:users',
  session: 'tiho:session',
  emotions: 'tiho:emotions',
  quotes: 'tiho:quotes',
} as const;

type EmotionId = (typeof EMOTIONS)[number]['id'];
type EmotionValues = Record<EmotionId, number>;
type Screen = 'emotions' | 'quotes' | 'calendar';

type UserProfile = {
  id: string;
  name: string;
  createdAt: string;
};

type EmotionEntry = {
  id: number;
  userId: string;
  createdAt: string;
  note: string;
  values: EmotionValues;
};

type QuoteEntry = {
  id: number;
  userId: string;
  createdAt: string;
  quote: string;
  reflection: string;
};

type DayRecord = {
  key: string;
  emotion?: EmotionEntry;
  quote?: QuoteEntry;
};

const INITIAL_VALUES = Object.fromEntries(
  EMOTIONS.map((emotion) => [emotion.id, emotion.initial]),
) as EmotionValues;

const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', options ?? {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

const toDayKey = (input: Date | string) => {
  const date = typeof input === 'string' ? new Date(input) : input;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromDayKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T;
  } catch {
    return fallback;
  }
};

const claimLegacyEntries = <T extends { userId: string }>(entries: T[], userId: string) =>
  entries.map((entry) => entry.userId ? entry : { ...entry, userId });

const upsertDailyEntry = <T extends { createdAt: string; userId: string }>(entry: T, entries: T[]) => {
  const otherUsers = entries.filter((item) => item.userId !== entry.userId);
  const currentUserEntries = [
    entry,
    ...entries.filter((item) =>
      item.userId === entry.userId
      && toDayKey(item.createdAt) !== toDayKey(entry.createdAt)),
  ]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 370);

  return [...otherUsers, ...currentUserEntries]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('emotions');
  const [values, setValues] = useState<EmotionValues>(INITIAL_VALUES);
  const [note, setNote] = useState('');
  const [emotionEntries, setEmotionEntries] = useState<EmotionEntry[]>([]);
  const [quoteEntries, setQuoteEntries] = useState<QuoteEntry[]>([]);
  const [quoteIndex, setQuoteIndex] = useState(() => new Date().getDate() % QUOTES.length);
  const [reflection, setReflection] = useState('');
  const [notice, setNotice] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);

  const restoreToday = (
    userId: string,
    savedEmotions: EmotionEntry[],
    savedQuotes: QuoteEntry[],
  ) => {
    const todayKey = toDayKey(new Date());
    const todayEmotion = savedEmotions
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .find((entry) => toDayKey(entry.createdAt) === todayKey);
    const todayQuote = savedQuotes
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .find((entry) => toDayKey(entry.createdAt) === todayKey);

    setValues(todayEmotion?.values ?? INITIAL_VALUES);
    setNote(todayEmotion?.note ?? '');
    setReflection(todayQuote?.reflection ?? '');
    const savedQuoteIndex = todayQuote
      ? QUOTES.indexOf(todayQuote.quote as (typeof QUOTES)[number])
      : -1;
    setQuoteIndex(savedQuoteIndex >= 0 ? savedQuoteIndex : new Date().getDate() % QUOTES.length);
  };

  useEffect(() => {
    const savedUsers = readStorage<UserProfile[]>(STORAGE_KEYS.users, []);
    const savedSession = readStorage<{ userId: string } | null>(STORAGE_KEYS.session, null);
    let savedEmotions = readStorage<EmotionEntry[]>(STORAGE_KEYS.emotions, []);
    let savedQuotes = readStorage<QuoteEntry[]>(STORAGE_KEYS.quotes, []);
    const sessionUser = savedUsers.find((user) => user.id === savedSession?.userId) ?? null;

    if (sessionUser) {
      savedEmotions = claimLegacyEntries(savedEmotions, sessionUser.id);
      savedQuotes = claimLegacyEntries(savedQuotes, sessionUser.id);
      localStorage.setItem(STORAGE_KEYS.emotions, JSON.stringify(savedEmotions));
      localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(savedQuotes));
    }

    const emotionsToRestore = savedEmotions;
    const quotesToRestore = savedQuotes;
    const timeout = window.setTimeout(() => {
      setEmotionEntries(emotionsToRestore);
      setQuoteEntries(quotesToRestore);
      setActiveUser(sessionUser);
      if (sessionUser) restoreToday(sessionUser.id, emotionsToRestore, quotesToRestore);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const login = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const users = readStorage<UserProfile[]>(STORAGE_KEYS.users, []);
    let user = users.find((item) => item.name.toLocaleLowerCase('ru-RU') === cleanName.toLocaleLowerCase('ru-RU'));
    if (!user) {
      user = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: cleanName,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([...users, user]));
    }

    const migratedEmotions = claimLegacyEntries(emotionEntries, user.id);
    const migratedQuotes = claimLegacyEntries(quoteEntries, user.id);
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ userId: user.id }));
    localStorage.setItem(STORAGE_KEYS.emotions, JSON.stringify(migratedEmotions));
    localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(migratedQuotes));
    setEmotionEntries(migratedEmotions);
    setQuoteEntries(migratedQuotes);
    setActiveUser(user);
    restoreToday(user.id, migratedEmotions, migratedQuotes);
    setScreen('emotions');
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.session);
    setActiveUser(null);
    setValues(INITIAL_VALUES);
    setNote('');
    setReflection('');
    setScreen('emotions');
  };

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const { fill, leaders } = useMemo(() => {
    const amount = Object.values(values).reduce((sum, value) => sum + value, 0);
    const strongestValue = Math.max(...Object.values(values));
    return {
      fill: Math.min(88, Math.round(amount / 4.1)),
      leaders: amount === 0
        ? []
        : EMOTIONS.filter((emotion) => values[emotion.id] === strongestValue),
    };
  }, [values]);

  const currentEmotionEntries = useMemo(
    () => emotionEntries.filter((entry) => entry.userId === activeUser?.id),
    [activeUser, emotionEntries],
  );
  const currentQuoteEntries = useMemo(
    () => quoteEntries.filter((entry) => entry.userId === activeUser?.id),
    [activeUser, quoteEntries],
  );

  const records = useMemo(() => {
    const result = new Map<string, DayRecord>();
    [...currentEmotionEntries]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .forEach((entry) => {
      const key = toDayKey(entry.createdAt);
      if (!result.get(key)?.emotion) {
        result.set(key, { ...result.get(key), key, emotion: entry });
      }
    });
    [...currentQuoteEntries]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .forEach((entry) => {
      const key = toDayKey(entry.createdAt);
      if (!result.get(key)?.quote) {
        result.set(key, { ...result.get(key), key, quote: entry });
      }
    });
    return result;
  }, [currentEmotionEntries, currentQuoteEntries]);

  const saveEmotion = () => {
    if (!activeUser) return;
    const entry: EmotionEntry = {
      id: Date.now(),
      userId: activeUser.id,
      createdAt: new Date().toISOString(),
      note: note.trim(),
      values,
    };
    const next = upsertDailyEntry(entry, emotionEntries);
    setEmotionEntries(next);
    localStorage.setItem(STORAGE_KEYS.emotions, JSON.stringify(next));
    setNotice('Колба за сегодня сохранена в календаре');
  };

  const findTodayQuote = () => [...currentQuoteEntries]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .find((entry) => toDayKey(entry.createdAt) === toDayKey(new Date()));

  const saveQuoteOnly = () => {
    if (!activeUser) return;
    const currentQuote = QUOTES[quoteIndex];
    const existing = findTodayQuote();
    const entry: QuoteEntry = {
      id: existing?.id ?? Date.now(),
      userId: activeUser.id,
      createdAt: new Date().toISOString(),
      quote: currentQuote,
      reflection: existing?.quote === currentQuote ? existing.reflection : '',
    };
    const next = upsertDailyEntry(entry, quoteEntries);
    setQuoteEntries(next);
    localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(next));
    setNotice('Цитата сохранена в календаре');
  };

  const saveQuoteComment = () => {
    if (!reflection.trim()) return;
    const existing = findTodayQuote();
    const currentQuote = QUOTES[quoteIndex];
    if (!existing || existing.quote !== currentQuote) {
      setNotice('Сначала сохрани эту цитату');
      return;
    }
    const entry: QuoteEntry = {
      ...existing,
      createdAt: new Date().toISOString(),
      reflection: reflection.trim(),
    };
    const next = upsertDailyEntry(entry, quoteEntries);
    setQuoteEntries(next);
    localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(next));
    setNotice('Комментарий сохранён в календаре');
  };

  const showNextQuote = () => {
    setQuoteIndex((index) => {
      const nextIndex = (index + 1) % QUOTES.length;
      const existing = findTodayQuote();
      setReflection(existing?.quote === QUOTES[nextIndex] ? existing.reflection : '');
      return nextIndex;
    });
  };

  const openCalendar = () => setScreen('calendar');

  if (!hydrated) {
    return (
      <main className="auth-shell">
        <div className="auth-loading" role="status">Открываем дневник…</div>
      </main>
    );
  }

  if (!activeUser) {
    return <AuthScreen onLogin={login} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setScreen('emotions')} aria-label="Дневник эмоций — на главную">
          <span className="brand-mark"><Droplets size={19} strokeWidth={2.2} /></span>
          <span>Дневник эмоций</span>
        </button>
        <nav className="main-nav" aria-label="Разделы дневника">
          <button
            className={`nav-item ${screen === 'emotions' ? 'active' : ''}`}
            type="button"
            onClick={() => setScreen('emotions')}
          >
            <Heart size={18} /> Эмоции
          </button>
          <button
            className={`nav-item ${screen === 'quotes' ? 'active' : ''}`}
            type="button"
            onClick={() => setScreen('quotes')}
          >
            <Quote size={18} /> Цитаты
          </button>
          <button
            className={`nav-item ${screen === 'calendar' ? 'active' : ''}`}
            type="button"
            onClick={openCalendar}
          >
            <CalendarDays size={18} /> Календарь
          </button>
        </nav>
        <div className="profile-summary">
          <span className="avatar" aria-hidden="true">{activeUser.name.slice(0, 1).toLocaleUpperCase('ru-RU')}</span>
          <span className="profile-name">{activeUser.name}</span>
          <button className="logout-button" type="button" onClick={logout} aria-label="Выйти из дневника">
            <LogOut size={17} />
            <span>Выйти</span>
          </button>
        </div>
      </header>

      {screen === 'emotions' && (
        <EmotionScreen
          values={values}
          setValues={setValues}
          note={note}
          setNote={setNote}
          fill={fill}
          leaders={leaders}
          entries={currentEmotionEntries}
          hydrated={hydrated}
          onSave={saveEmotion}
          onOpenCalendar={openCalendar}
        />
      )}

      {screen === 'quotes' && (
        <QuoteScreen
          quote={QUOTES[quoteIndex]}
          reflection={reflection}
          setReflection={setReflection}
          todayRecord={records.get(toDayKey(new Date()))}
          hydrated={hydrated}
          onNext={showNextQuote}
          onSaveQuote={saveQuoteOnly}
          onSaveComment={saveQuoteComment}
        />
      )}

      {screen === 'calendar' && (
        <CalendarScreen records={records} hydrated={hydrated} />
      )}

      {notice && (
        <div className="toast" role="status">
          <Check size={17} /> {notice}
        </div>
      )}
    </main>
  );
}

function AuthScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState('');

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark"><Droplets size={20} strokeWidth={2.2} /></span>
          <span>Дневник эмоций</span>
        </div>
        <div className="auth-icon"><UserRound size={27} /></div>
        <p className="eyebrow">Личный дневник в этом браузере</p>
        <h1 id="auth-title">Как к тебе обращаться?</h1>
        <p className="auth-intro">
          Имя нужно только для локального профиля. Пароль, регистрация и передача данных не используются.
        </p>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(name);
          }}
        >
          <label className="field-label" htmlFor="profile-name">Имя</label>
          <input
            id="profile-name"
            className="name-input"
            value={name}
            maxLength={40}
            autoComplete="username"
            autoFocus
            placeholder="Например, Даша"
            onChange={(event) => setName(event.target.value)}
          />
          <button className="save-button auth-submit" type="submit" disabled={!name.trim()}>
            Войти в дневник
          </button>
        </form>
        <p className="privacy-note">Профиль и записи сохраняются только на этом устройстве</p>
      </section>
    </main>
  );
}

function EmotionScreen({
  values,
  setValues,
  note,
  setNote,
  fill,
  leaders,
  entries,
  hydrated,
  onSave,
  onOpenCalendar,
}: {
  values: EmotionValues;
  setValues: React.Dispatch<React.SetStateAction<EmotionValues>>;
  note: string;
  setNote: (value: string) => void;
  fill: number;
  leaders: Array<(typeof EMOTIONS)[number]>;
  entries: EmotionEntry[];
  hydrated: boolean;
  onSave: () => void;
  onOpenCalendar: () => void;
}) {
  return (
    <section className="workspace">
      <article className="editor-card">
        <p className="eyebrow">{formatDate(new Date())}</p>
        <h1>Что ты чувствуешь<br />прямо сейчас?</h1>
        <p className="intro">Не ищи одно точное слово. Добавь столько чувств, сколько нужно.</p>

        <div className="emotion-list">
          {EMOTIONS.map((emotion) => (
            <div className="emotion-row" key={emotion.id}>
              <div className="emotion-label">
                <span className="emotion-dot" style={{ background: emotion.color }} />
                <span>{emotion.name}</span>
                <strong>{values[emotion.id]}%</strong>
              </div>
              <Slider.Root
                className="slider-root"
                value={[values[emotion.id]]}
                min={0}
                max={100}
                step={1}
                aria-label={emotion.name}
                onValueChange={([value]) =>
                  setValues((current) => ({ ...current, [emotion.id]: value }))
                }
              >
                <Slider.Track className="slider-track">
                  <Slider.Range className="slider-range" style={{ background: emotion.color }} />
                </Slider.Track>
                <Slider.Thumb className="slider-thumb" style={{ background: emotion.color }} />
              </Slider.Root>
            </div>
          ))}
        </div>

        <label className="field-label" htmlFor="emotion-note">Что повлияло на это состояние?</label>
        <textarea
          id="emotion-note"
          className="journal-input compact"
          value={note}
          maxLength={240}
          placeholder="Можно оставить пару слов — это необязательно"
          onChange={(event) => setNote(event.target.value)}
        />
      </article>

      <aside className="result-card">
        <div className="result-heading">
          <div>
            <p className="eyebrow">Твой эмоциональный состав</p>
            <h2>{fill}% наполненности</h2>
          </div>
        </div>

        <EmotionVessel values={values} variant="main" />

        <div className="dominant-note">
          <span className="emotion-dot" style={{ background: leaders[0]?.color ?? '#DCC9BF' }} />
          <p aria-live="polite">
            <strong>
              {leaders.length === 0
                ? 'Сосуд пока пуст.'
                : leaders.length === 1
                  ? `Сильнее всего — ${leaders[0].name.toLowerCase()}.`
                  : 'Несколько чувств одинаково сильны.'}
            </strong>
            <br />
            {leaders.length > 1
              ? 'Внутри может звучать несколько истин одновременно.'
              : leaders.length === 1
                ? EMOTION_REFLECTIONS[leaders[0].id]
                : 'Пустота тоже может быть состоянием — дай ей немного пространства.'}
          </p>
        </div>

        <button className="save-button" type="button" onClick={onSave}>Сохранить колбу за сегодня</button>
        <p className="privacy-note">Запись появится в календаре и останется в этом браузере</p>

        {hydrated && entries.length > 0 && (
          <button className="calendar-shortcut" type="button" onClick={onOpenCalendar}>
            <CalendarDays size={16} /> Открыть календарь
          </button>
        )}
      </aside>
    </section>
  );
}

function QuoteScreen({
  quote,
  reflection,
  setReflection,
  todayRecord,
  hydrated,
  onNext,
  onSaveQuote,
  onSaveComment,
}: {
  quote: string;
  reflection: string;
  setReflection: (value: string) => void;
  todayRecord?: DayRecord;
  hydrated: boolean;
  onNext: () => void;
  onSaveQuote: () => void;
  onSaveComment: () => void;
}) {
  const isQuoteSaved = todayRecord?.quote?.quote === quote;

  return (
    <section className="quote-workspace">
      <article className="quote-card">
        <div className="quote-topline">
          <span className="quote-icon"><Quote size={22} /></span>
          <p className="eyebrow">Мысль на сегодня</p>
        </div>
        <blockquote>«{quote}»</blockquote>
        <div className="quote-card-actions">
          <button className="soft-button" type="button" onClick={onNext}>
            <RefreshCw size={16} /> Другая мысль
          </button>
          <button className="quote-save-button" type="button" onClick={onSaveQuote}>
            {isQuoteSaved ? <Check size={17} /> : <Bookmark size={17} />}
            {isQuoteSaved ? 'Цитата сохранена' : 'Сохранить цитату'}
          </button>
        </div>
        <div className="quote-orbit orbit-one" />
        <div className="quote-orbit orbit-two" />
      </article>

      <article className="reflection-card">
        <div>
          <p className="eyebrow">Комментарий к цитате</p>
          <h2>Что откликается?</h2>
          <p className="intro">Запиши, что эта мысль значит именно для тебя.</p>
        </div>
        <textarea
          className="journal-input"
          value={reflection}
          maxLength={500}
          placeholder="Эта мысль напомнила мне…"
          onChange={(event) => setReflection(event.target.value)}
        />
        <div className="input-footer">
          <span>{reflection.length}/500</span>
          <button
            className="save-button inline"
            type="button"
            onClick={onSaveComment}
            disabled={!reflection.trim()}
          >
            <Bookmark size={17} /> Сохранить комментарий
          </button>
        </div>
      </article>

      <aside className="day-preview-card">
        <div className="saved-heading">
          <div>
            <p className="eyebrow">Сегодня в календаре</p>
            <h2>{formatDate(new Date(), { day: 'numeric', month: 'long' })}</h2>
          </div>
        </div>

        {!hydrated || !todayRecord ? (
          <div className="empty-state small">
            <CalendarDays size={24} />
            <p>Сохранённые сегодня колба и цитата появятся здесь.</p>
          </div>
        ) : (
          <div className="today-preview">
            <EmotionVessel values={todayRecord.emotion?.values} variant="mini" />
            <div>
              <strong>{todayRecord.emotion ? 'Колба сохранена' : 'Колба пока не сохранена'}</strong>
              <p>{todayRecord.quote ? `«${todayRecord.quote.quote}»` : 'Цитата пока не сохранена'}</p>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}

function CalendarScreen({ records, hydrated }: { records: Map<string, DayRecord>; hydrated: boolean }) {
  const today = new Date();
  const todayKey = toDayKey(today);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index - mondayOffset + 1),
    );
  }, [month]);

  const selectedRecord = records.get(selectedKey);
  const selectedDate = fromDayKey(selectedKey);
  const changeMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedKey(toDayKey(next));
  };

  return (
    <section className="calendar-workspace">
      <article className="calendar-card">
        <div className="calendar-heading">
          <div>
            <p className="eyebrow">Архив состояний</p>
            <h1>{formatDate(month, { month: 'long', year: 'numeric' })}</h1>
          </div>
          <div className="month-controls">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Предыдущий месяц"><ArrowLeft size={18} /></button>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Следующий месяц"><ArrowRight size={18} /></button>
          </div>
        </div>

        <div className="weekday-row" aria-hidden="true">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-grid" aria-label="Календарь дневника">
          {days.map((date) => {
            const key = toDayKey(date);
            const record = records.get(key);
            const isOutside = date.getMonth() !== month.getMonth();
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <button
                className={`calendar-day ${isOutside ? 'outside' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                type="button"
                key={key}
                onClick={() => setSelectedKey(key)}
                aria-label={`${formatDate(date, { day: 'numeric', month: 'long' })}${record ? ', есть запись' : ', без записи'}`}
              >
                <time dateTime={key}>{date.getDate()}</time>
                <EmotionVessel values={record?.emotion?.values} variant="mini" />
                {record?.quote && <span className="quote-marker" title="Есть цитата"><Quote size={10} /></span>}
              </button>
            );
          })}
        </div>
      </article>

      <aside className="calendar-detail">
        <div className="detail-heading">
          <p className="eyebrow">Выбранный день</p>
          <h2>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        </div>

        {!hydrated || !selectedRecord ? (
          <div className="calendar-empty-detail">
            <div className="empty-mini-vessel" />
            <h3>В этот день пока нет записи</h3>
            <p>Сохрани колбу в разделе «Эмоции» и мысль в разделе «Цитаты».</p>
          </div>
        ) : (
          <div className="day-detail-content">
            <EmotionVessel values={selectedRecord.emotion?.values} variant="detail" />

            <div className="detail-section">
              <span className="detail-label"><Heart size={14} /> Комментарий к состоянию</span>
              <p>{selectedRecord.emotion?.note || 'Комментарий не добавлен'}</p>
            </div>

            <div className="detail-quote">
              <Quote size={19} />
              <blockquote>
                {selectedRecord.quote
                  ? `«${selectedRecord.quote.quote}»`
                  : 'Цитата в этот день не сохранена'}
              </blockquote>
            </div>

            <div className="detail-section">
              <span className="detail-label"><Bookmark size={14} /> Комментарий к цитате</span>
              <p>{selectedRecord.quote?.reflection || 'Комментарий не добавлен'}</p>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}

function EmotionVessel({ values, variant }: { values?: EmotionValues; variant: 'main' | 'mini' | 'detail' }) {
  const total = values
    ? Object.values(values).reduce((sum, value) => sum + value, 0)
    : 0;
  const fill = Math.min(88, Math.round(total / 4.1));

  return (
    <div className={`vessel-wrap vessel-wrap--${variant}`} aria-label={values ? `Колба наполнена на ${fill}%` : 'Пустая колба'}>
      <div className={`vessel vessel--${variant}`}>
        {variant !== 'mini' && <div className="vessel-shine" />}
        <div className="liquid-stack" style={{ height: `${fill}%` }}>
          {values && EMOTIONS.filter((emotion) => values[emotion.id] > 0).map((emotion) => (
            <span
              key={emotion.id}
              style={{
                background: emotion.color,
                flexGrow: values[emotion.id] / Math.max(total, 1),
              }}
            />
          ))}
        </div>
      </div>
      {variant !== 'mini' && <span className="vessel-shadow" />}
    </div>
  );
}
