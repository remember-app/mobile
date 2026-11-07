import { useState } from 'react';

import { i18n, locale } from '@/ui/i18n';
import { Calendar } from '@/ui/kit/calendar';
import { dayKey } from '@/ui/kit/calendar-grid';

const WEEKDAYS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

function monthLabel(month: Date): string {
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(month);
}

function dayLabel(day: Date): string {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(day);
}

type Props = {
  from: Date | null;
  to: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
};

export function EventDates({ from, to, onChange }: Props) {
  const [month, setMonth] = useState(() => {
    const base = from ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const pick = (day: Date) => {
    if (!from || to || dayKey(day) <= dayKey(from)) {
      onChange(day, null);
      return;
    }
    onChange(from, day);
  };

  return (
    <Calendar
      month={month}
      onMonth={setMonth}
      from={from}
      to={to}
      onPick={pick}
      weekdays={WEEKDAYS[i18n.language === 'ru' ? 'ru' : 'en']}
      monthLabel={monthLabel(month)}
      prevLabel={i18n.t('common.prevMonth')}
      nextLabel={i18n.t('common.nextMonth')}
      dayLabel={dayLabel}
    />
  );
}
