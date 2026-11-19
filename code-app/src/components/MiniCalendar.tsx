import { useState, useMemo } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Button,
  Text,
} from '@fluentui/react-components';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  CalendarRegular,
} from '@fluentui/react-icons';
import { getMonday, isSameDay } from '../utils/dateUtils';
import './MiniCalendar.css';

interface MiniCalendarProps {
  /** Fecha destacada (la semana seleccionada actualmente) */
  currentMonday: Date;
  /** Callback al seleccionar una fecha (navega a la semana que la contiene) */
  onSelectDate: (date: Date) => void;
  /** Etiqueta del botón disparador (ej. "12/01/2026 - 16/01/2026") */
  label?: string;
}

/**
 * MiniCalendar - Popover con un mini calendario mensual para navegar entre semanas.
 *
 * - Abre al hacer clic en el botón de calendario del header
 * - Permite cambiar mes con flechas
 * - Al pulsar un día, cierra el popover y navega a esa semana
 */
export function MiniCalendar({ currentMonday, onSelectDate, label }: MiniCalendarProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(currentMonday));

  // Cuando cambia currentMonday y el popover está cerrado, sincronizamos el mes visible
  const visibleMonth = useMemo(() => {
    if (viewMonth.getFullYear() !== currentMonday.getFullYear() ||
        viewMonth.getMonth() !== currentMonday.getMonth()) {
      return new Date(currentMonday);
    }
    return viewMonth;
  }, [viewMonth, currentMonday]);

  const monthLabel = useMemo(() => {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${monthNames[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;
  }, [visibleMonth]);

  // Días del mes (incluyendo días de meses adyacentes para completar la grilla)
  const calendarDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const last = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);

    // getDay: 0=Dom, 1=Lun, ..., 6=Sáb. Queremos Lun=0, ..., Dom=6
    const firstDayIndex = (first.getDay() + 6) % 7;
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Días del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(first);
      d.setDate(first.getDate() - (i + 1));
      days.push({ date: d, isCurrentMonth: false });
    }

    // Días del mes actual
    for (let i = 1; i <= last.getDate(); i++) {
      days.push({
        date: new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), i),
        isCurrentMonth: true,
      });
    }

    // Días del mes siguiente hasta completar 6 filas (42 días)
    while (days.length < 42) {
      const last_day = days[days.length - 1].date;
      const d = new Date(last_day);
      d.setDate(last_day.getDate() + 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [visibleMonth]);

  const goPrevMonth = () => {
    setViewMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setViewMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1));
  };

  const handleDayClick = (date: Date) => {
    onSelectDate(getMonday(date));
    setOpen(false);
  };

  const today = new Date();

  return (
    <Popover
      open={open}
      onOpenChange={(_e, data) => setOpen(data.open)}
      positioning="below"
    >
      <PopoverTrigger>
        <Button
          icon={<CalendarRegular />}
          appearance="subtle"
          aria-label="Ir a fecha específica"
          title="Ir a fecha específica"
          className="week-range-trigger"
        >
          {label && <span className="week-range-trigger-label">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className="mini-calendar-surface">
        <div className="mini-calendar-header">
          <Button
            icon={<ChevronLeftRegular />}
            appearance="subtle"
            size="small"
            onClick={goPrevMonth}
            aria-label="Mes anterior"
          />
          <Text weight="semibold" className="mini-calendar-title">{monthLabel}</Text>
          <Button
            icon={<ChevronRightRegular />}
            appearance="subtle"
            size="small"
            onClick={goNextMonth}
            aria-label="Mes siguiente"
          />
        </div>

        <div className="mini-calendar-grid">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={i} className="mini-calendar-weekday">{d}</div>
          ))}
          {calendarDays.map(({ date, isCurrentMonth }, idx) => {
            const isToday = isSameDay(date, today);
            return (
              <button
                key={idx}
                type="button"
                className={
                  `mini-calendar-day ${isCurrentMonth ? '' : 'mini-calendar-day-out'} ` +
                  `${isToday ? 'mini-calendar-day-today' : ''}`
                }
                onClick={() => handleDayClick(date)}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mini-calendar-footer">
          <Button
            appearance="subtle"
            size="small"
            onClick={() => {
              onSelectDate(getMonday(today));
              setOpen(false);
            }}
          >
            Ir a hoy
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  );
}