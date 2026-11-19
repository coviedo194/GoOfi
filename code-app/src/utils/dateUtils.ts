/**
 * Utilidades para manejo de fechas en GoOfi
 * 
 * La app trabaja con semanas laborales (Lunes a Viernes).
 * Estas funciones ayudan a calcular rangos de fechas y formatear días.
 */

/**
 * Obtiene el lunes de la semana que contiene la fecha dada.
 * Si la fecha es sábado o domingo, retorna el lunes de esa misma semana.
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // getDay() retorna: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
  // Necesitamos restar días para llegar al lunes
  const diff = day === 0 ? -6 : 1 - day; // Si es domingo, retroceder 6 días
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Genera un array con los 5 días laborales (Lun-Vie) de una semana.
 * @param monday - El lunes de la semana
 * @returns Array de 5 fechas [Lun, Mar, Mié, Jue, Vie]
 */
export function getWeekDays(monday: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * Formatea una fecha como "Lun 23" (día de semana abreviado + número)
 */
export function formatDayShort(date: Date): string {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return `${dayNames[date.getDay()]} ${date.getDate()}`;
}

/**
 * Formatea el rango de la semana como "23 - 27 Jun 2026"
 */
export function formatWeekRange(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  const startDay = monday.getDate();
  const endDay = friday.getDate();
  const month = monthNames[friday.getMonth()];
  const year = friday.getFullYear();
  
  // Si el mes cambia entre lunes y viernes, mostrar ambos meses
  if (monday.getMonth() !== friday.getMonth()) {
    const startMonth = monthNames[monday.getMonth()];
    return `${startDay} ${startMonth} - ${endDay} ${month} ${year}`;
  }
  
  return `${startDay} - ${endDay} ${month} ${year}`;
}

/**
 * Compara si dos fechas son el mismo día (ignorando la hora)
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Formatea una fecha en formato ISO (YYYY-MM-DD) para usar en queries.
 * Usa la fecha LOCAL, no UTC, para evitar desfases de timezone.
 */
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
