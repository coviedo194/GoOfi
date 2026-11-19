import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Text,
  Badge,
  Spinner,
  Divider,
  Switch,
} from '@fluentui/react-components';
import {
  ClockRegular,
  PersonRegular,
  LocationRegular,
  CalendarRegular,
  PeopleRegular,
  DeleteRegular,
  EditRegular,
} from '@fluentui/react-icons';
import type { Ovg_eventoparagofs } from '../generated/models/Ovg_eventoparagofsModel';
import type { Ovg_asistentedeeventoparagofs } from '../generated/models/Ovg_asistentedeeventoparagofsModel';
import './EventDetailDialog.css';

interface EventDetailDialogProps {
  /** Evento seleccionado (null = diálogo cerrado) */
  evento: Ovg_eventoparagofs | null;
  /** Si el diálogo está abierto */
  open: boolean;
  /** Lista de asistentes del evento */
  asistentes: Ovg_asistentedeeventoparagofs[];
  /** Mapa de ID de usuario -> nombre completo */
  userNames: Map<string, string>;
  /** Nombre de la oficina (si está disponible) */
  oficinaNombre: string | undefined;
  /** ID del usuario actual */
  currentUserId: string | null;
  /** Si está eliminando el evento */
  deleting: boolean;
  /** Si está cambiando la asistencia del usuario actual */
  togglingAttendance: boolean;
  /** Callback al cerrar */
  onClose: () => void;
  /** Callback al confirmar eliminación */
  onDelete: (eventoId: string) => void;
  /** Callback al pulsar "Editar" (sólo se muestra si el usuario es organizador) */
  onEdit?: (evento: Ovg_eventoparagofs) => void;
  /** Callback al pulsar el switch de "Asistir" del usuario actual */
  onToggleAttendance: () => void;
}

/**
 * Formatea una hora a partir de un string ISO
 */
function formatHora(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formatea una fecha/hora completa en formato legible
 */
function formatFechaCompleta(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const dia = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return dia.charAt(0).toUpperCase() + dia.slice(1);
}

/**
 * Calcula la duración en minutos entre dos fechas
 */
function calcularDuracionMinutos(inicio: string, fin: string | undefined): number | null {
  if (!fin) return null;
  const diffMs = new Date(fin).getTime() - new Date(inicio).getTime();
  return Math.round(diffMs / 60000);
}

/**
 * Formatea una duración en minutos a "Xh Ym"
 */
function formatDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * EventDetailDialog - Modal con la información completa de un evento
 *
 * Muestra: asunto, descripción (rich text), fecha/hora inicio y fin,
 * duración, oficina, organizador y lista de asistentes confirmados.
 * Permite eliminar el evento si el usuario actual es el organizador.
 */
export function EventDetailDialog({
  evento,
  open,
  asistentes,
  userNames,
  oficinaNombre,
  currentUserId,
  deleting,
  togglingAttendance,
  onClose,
  onDelete,
  onEdit,
  onToggleAttendance,
}: EventDetailDialogProps) {
  if (!evento) return null;

  const duracionMin = calcularDuracionMinutos(evento.ovg_fecha, evento.ovg_fechahasta);
  const isOrganizador = evento._owninguser_value === currentUserId;
  const organizadorNombre = userNames.get(evento._owninguser_value || '') || 'Sin organizador';

  // Determinar si el usuario actual ya está apuntado a este evento
  const estoyApuntado = !!currentUserId && asistentes.some(
    a => a._owninguser_value === currentUserId
  );

  return (
    <Dialog open={open} onOpenChange={(_e, data) => !data.open && onClose()}>
      <DialogSurface className="event-detail-surface">
        <DialogBody>
          <DialogTitle>
            <div className="event-detail-title">
              <Text size={500} weight="semibold">
                {evento.ovg_asunto}
              </Text>
              {isOrganizador && (
                <Badge appearance="tint" color="brand" size="small">
                  Organizador
                </Badge>
              )}
            </div>
          </DialogTitle>

          <DialogContent className="event-detail-content">
            {/* Metadatos del evento */}
            <div className="event-detail-meta">
              {/* Fecha */}
              <div className="event-detail-meta-row">
                <CalendarRegular />
                <div className="event-detail-meta-text">
                  <Text size={200} weight="semibold">
                    {formatFechaCompleta(evento.ovg_fecha)}
                  </Text>
                </div>
              </div>

              {/* Hora */}
              <div className="event-detail-meta-row">
                <ClockRegular />
                <div className="event-detail-meta-text">
                  <Text size={200}>
                    {formatHora(evento.ovg_fecha)}
                    {evento.ovg_fechahasta && ` - ${formatHora(evento.ovg_fechahasta)}`}
                  </Text>
                  {duracionMin !== null && duracionMin > 0 && (
                    <Badge appearance="outline" size="small">
                      {formatDuracion(duracionMin)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Oficina */}
              <div className="event-detail-meta-row">
                <LocationRegular />
                <div className="event-detail-meta-text">
                  <Text size={200}>{oficinaNombre || 'Oficina no especificada'}</Text>
                </div>
              </div>

              {/* Organizador */}
              <div className="event-detail-meta-row">
                <PersonRegular />
                <div className="event-detail-meta-text">
                  <Text size={200}>
                    Organiza: <Text weight="semibold">{organizadorNombre}</Text>
                  </Text>
                </div>
              </div>
            </div>

            <Divider />

            {/* Descripción */}
            <div className="event-detail-section">
              <Text size={300} weight="semibold" className="event-detail-section-title">
                Descripción
              </Text>
              {evento.ovg_descripcion ? (
                <div
                  className="event-detail-description"
                  // El contenido viene de Dataverse rich text (sanitizado en servidor)
                  dangerouslySetInnerHTML={{ __html: evento.ovg_descripcion }}
                />
              ) : (
                <Text size={200} className="event-detail-empty">
                  Sin descripción
                </Text>
              )}
            </div>

            <Divider />

            {/* Asistentes */}
            <div className="event-detail-section">
              <div className="event-detail-attendees-header">
                <PeopleRegular />
                <Text size={300} weight="semibold">
                  Asistentes confirmados
                </Text>
                <Badge appearance="tint" color="informative" size="small">
                  {asistentes.length}
                </Badge>
              </div>

              {/* Toggle de mi asistencia */}
              {currentUserId && (
                <div className="event-detail-my-attendance">
                  <Switch
                    checked={estoyApuntado}
                    disabled={togglingAttendance || deleting}
                    onChange={onToggleAttendance}
                    label={
                      togglingAttendance
                        ? 'Guardando...'
                        : estoyApuntado
                          ? 'Asistirás a este evento'
                          : 'Apuntarme a este evento'
                    }
                  />
                </div>
              )}

              {deleting ? (
                <div className="event-detail-loading">
                  <Spinner size="small" />
                </div>
              ) : asistentes.length === 0 ? (
                <Text size={200} className="event-detail-empty">
                  Aún no hay asistentes confirmados
                </Text>
              ) : (
                <div className="event-detail-attendees-list">
                  {asistentes.map(asistente => (
                    <div key={asistente.ovg_asistentedeeventoparagofid} className="event-detail-attendee">
                      <PersonRegular />
                      <Text size={200}>
                        {userNames.get(asistente._owninguser_value || '') ||
                          asistente.ovg_identificador ||
                          'Usuario'}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>

          <DialogActions>
            {isOrganizador && (
              <Button
                appearance="subtle"
                icon={<DeleteRegular />}
                onClick={() => onDelete(evento.ovg_eventoparagofid)}
                disabled={deleting}
              >
                Eliminar evento
              </Button>
            )}
            {isOrganizador && onEdit && (
              <Button
                appearance="subtle"
                icon={<EditRegular />}
                onClick={() => onEdit(evento)}
                disabled={deleting}
              >
                Editar
              </Button>
            )}
            <Button appearance="primary" onClick={onClose}>
              Cerrar
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}