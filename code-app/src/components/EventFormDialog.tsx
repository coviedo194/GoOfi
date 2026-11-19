import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Text,
  Input,
  Textarea,
  Field,
  Spinner,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { SaveRegular, DismissRegular } from '@fluentui/react-icons';
import type { Ovg_eventoparagofs, Ovg_eventoparagofsBase } from '../generated/models/Ovg_eventoparagofsModel';
import { Ovg_eventoparagofsService } from '../generated/services/Ovg_eventoparagofsService';
import { toISODateString } from '../utils/dateUtils';
import './EventFormDialog.css';

interface EventFormDialogProps {
  /** Si está abierto */
  open: boolean;
  /** Si true, es modo edición; si false, es creación */
  isEdit: boolean;
  /** Evento a editar (sólo en modo edición) */
  evento: Ovg_eventoparagofs | null;
  /** ID de oficina del usuario (preseleccionada al crear) */
  defaultOfficeId: string | null;
  /** Fecha preseleccionada (al pulsar "+" en un día concreto) */
  preSelectedDate?: Date;
  /** Callback al cerrar */
  onClose: () => void;
  /** Callback tras guardar exitosamente (devuelve el evento creado/actualizado) */
  onSaved: (evento: Ovg_eventoparagofs) => void;
}

/**
 * Convierte un string ISO (con hora) a formato "YYYY-MM-DDTHH:mm" para inputs datetime-local
 */
function isoToDateTimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/**
 * Convierte un valor de input datetime-local a string ISO
 */
function dateTimeLocalToIso(value: string): string {
  if (!value) return '';
  return new Date(value).toISOString();
}

function addOneHour(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  date.setHours(date.getHours() + 1);
  return date.toISOString();
}

/**
 * Valida el formulario y devuelve el mensaje de error o null si es válido
 */
function validar(form: FormState): string | null {
  if (!form.ovg_asunto.trim()) return 'El asunto es obligatorio';
  if (!form.ovg_fecha) return 'La fecha/hora de inicio es obligatoria';
  if (!form._ovg_oficina_value) return 'Debes seleccionar una oficina';
  if (new Date(form.ovg_fecha).getMinutes() % 15 !== 0) {
    return 'La hora de inicio debe avanzar en intervalos de 15 minutos';
  }
  if (form.ovg_fechahasta) {
    const inicio = new Date(form.ovg_fecha).getTime();
    const fin = new Date(form.ovg_fechahasta).getTime();
    if (fin <= inicio) return 'La hora de fin debe ser posterior a la de inicio';
    if (new Date(form.ovg_fechahasta).getMinutes() % 15 !== 0) {
      return 'La hora de fin debe avanzar en intervalos de 15 minutos';
    }
  }
  return null;
}

interface FormState {
  ovg_asunto: string;
  ovg_descripcion: string;
  _ovg_oficina_value: string;
  ovg_fecha: string;
  ovg_fechahasta: string;
}

/**
 * Estado inicial del formulario
 */
function getInitialState(
  evento: Ovg_eventoparagofs | null,
  defaultOfficeId: string | null,
  preSelectedDate?: Date
): FormState {
  if (evento) {
    return {
      ovg_asunto: evento.ovg_asunto || '',
      ovg_descripcion: evento.ovg_descripcion || '',
      _ovg_oficina_value: evento._ovg_oficina_value || '',
      ovg_fecha: evento.ovg_fecha || '',
      ovg_fechahasta: evento.ovg_fechahasta || '',
    };
  }
  const startDate = preSelectedDate ? defaultStartForDate(preSelectedDate) : '';
  return {
    ovg_asunto: '',
    ovg_descripcion: '',
    _ovg_oficina_value: defaultOfficeId || '',
    ovg_fecha: startDate,
    ovg_fechahasta: addOneHour(startDate),
  };
}

/**
 * Genera un ISO con hora de inicio por defecto (08:00 local) para una fecha
 */
function defaultStartForDate(date: Date): string {
  const d = new Date(date);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

/**
 * EventFormDialog - Formulario para crear o editar un evento
 *
 * Campos:
 * - Asunto (texto, obligatorio)
 * - Descripción (textarea, opcional)
 * - Oficina del usuario (asignada automáticamente)
 * - Fecha/hora inicio (datetime-local, obligatorio)
 * - Fecha/hora fin (datetime-local, opcional)
 *
 * Reglas:
 * - La fecha de fin debe ser posterior a la de inicio
 * - Al crear, Dataverse asigna automáticamente al usuario actual como owner
 */
export function EventFormDialog({
  open,
  isEdit,
  evento,
  defaultOfficeId,
  preSelectedDate,
  onClose,
  onSaved,
}: EventFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(evento, defaultOfficeId, preSelectedDate));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const endTimeManuallyEdited = useRef(false);

  // Resetea el formulario cuando se abre
  useEffect(() => {
    if (!open) return;

    setError(null);
    setForm(getInitialState(evento, defaultOfficeId, preSelectedDate));
    endTimeManuallyEdited.current = false;
  }, [open, evento, defaultOfficeId, preSelectedDate]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleStartChange = (value: string) => {
    const start = dateTimeLocalToIso(value);
    setForm(prev => ({
      ...prev,
      ovg_fecha: start,
      ovg_fechahasta: !isEdit && !endTimeManuallyEdited.current
        ? addOneHour(start)
        : prev.ovg_fechahasta,
    }));
    setError(null);
  };

  const handleSubmit = async () => {
    const validationError = validar(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // La oficina se toma de la configuración del usuario y no se edita en este formulario.
      const payload: Partial<Ovg_eventoparagofsBase> & Record<string, unknown> = {
        ovg_asunto: form.ovg_asunto.trim(),
        ovg_descripcion: form.ovg_descripcion || undefined,
        'ovg_oficina@odata.bind': `/ovg_oficinaparagofs(${form._ovg_oficina_value})`,
        ovg_fecha: form.ovg_fecha,
        ovg_fechahasta: form.ovg_fechahasta || undefined,
      };

      if (isEdit && evento) {
        const result = await Ovg_eventoparagofsService.update(evento.ovg_eventoparagofid, payload);
        if (!result.data) throw new Error('Dataverse no devolvió el evento actualizado');
        onSaved(result.data);
      } else {
        // Dataverse asigna el propietario según el usuario autenticado.
        const result = await Ovg_eventoparagofsService.create(
          payload as Omit<Ovg_eventoparagofsBase, 'ovg_eventoparagofid'>
        );
        if (!result.data) throw new Error('Dataverse no devolvió el evento creado');
        onSaved(result.data);
      }
    } catch (err) {
      console.error('Error guardando evento:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  const startInputValue = isoToDateTimeLocal(form.ovg_fecha);
  const endInputValue = isoToDateTimeLocal(form.ovg_fechahasta);

  return (
    <Dialog open={open} onOpenChange={(_e, data) => !data.open && onClose()}>
      <DialogSurface className="event-form-surface">
        <DialogBody>
          <DialogTitle>
            <Text size={500} weight="semibold">
              {isEdit ? 'Editar evento' : 'Nuevo evento'}
            </Text>
          </DialogTitle>

          <DialogContent className="event-form-content">
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}

            <Field label="Asunto" required>
              <Input
                value={form.ovg_asunto}
                onChange={(_e, data) => handleChange('ovg_asunto', data.value)}
                placeholder="Ej: Reunión de equipo, Festejo de cumpleaños..."
                disabled={saving}
              />
            </Field>

            <Field label="Descripción">
              <Textarea
                value={form.ovg_descripcion}
                onChange={(_e, data) => handleChange('ovg_descripcion', data.value)}
                placeholder="Detalles, agenda, participantes..."
                rows={4}
                disabled={saving}
              />
            </Field>

            <div className="event-form-row">
              <Field label="Inicio" required>
                <Input
                  type="datetime-local"
                  step={900}
                  value={startInputValue}
                  onChange={(_e, data) => handleStartChange(data.value)}
                  disabled={saving}
                />
              </Field>

              <Field label="Fin (opcional)" hint="Si se deja vacío, el evento no tiene hora de fin">
                <Input
                  type="datetime-local"
                  step={900}
                  value={endInputValue}
                  onChange={(_e, data) => {
                    endTimeManuallyEdited.current = true;
                    handleChange('ovg_fechahasta', dateTimeLocalToIso(data.value));
                  }}
                  disabled={saving}
                />
              </Field>
            </div>
          </DialogContent>

          <DialogActions>
            <Button
              appearance="subtle"
              icon={<DismissRegular />}
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              appearance="primary"
              icon={saving ? <Spinner size="tiny" /> : <SaveRegular />}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear evento'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// Helper para uso externo: convierte un Date a formato de input datetime-local
export function getDefaultStartForDate(date: Date): string {
  const d = new Date(date);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

// Re-exportamos para quien quiera crear eventos a partir de una fecha
export { toISODateString };