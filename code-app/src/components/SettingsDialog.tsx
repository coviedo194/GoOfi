import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Dropdown,
  Option,
  Text,
  Spinner,
  MessageBar,
  MessageBarBody,
  Tooltip,
} from '@fluentui/react-components';
import { DismissRegular, QuestionCircleRegular } from '@fluentui/react-icons';
import type { Ovg_oficinaparagofs } from '../generated/models/Ovg_oficinaparagofsModel';
import { Ovg_oficinaparagofsService } from '../generated/services/Ovg_oficinaparagofsService';
import { SystemusersService } from '../generated/services/SystemusersService';
import './SettingsDialog.css';

interface SettingsDialogProps {
  /** Si el diálogo está abierto */
  open: boolean;
  /** ID del usuario actual (necesario para actualizar sus preferencias) */
  currentUserId: string | null;
  /** Oficina actual del usuario (puede ser null si no tiene) */
  currentOfficeId: string | null;
  /** Días seleccionados actualmente para avisos automáticos (1=Lun … 5=Vie) */
  currentDias: number[];
  /** Callback al cerrar */
  onClose: () => void;
  /** Callback tras guardar exitosamente (devuelve la nueva oficina y los nuevos días) */
  onSaved: (newOfficeId: string | null, newDias: number[]) => void;
}

/** Catálogo de días (el orden coincide con el OptionSet de Dataverse) */
const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
];

const NO_OFFICE_OPTION = '__no-office__';

/**
 * SettingsDialog - Modal de configuración del usuario
 *
 * Permite modificar:
 * - Oficina: oficina a la que el usuario va (lookup en systemuser)
 * - Días para avisos automáticos: multiselect en systemuser
 *
 * Persistencia: autoguarda al cambiar cada dropdown (sin botón "Guardar").
 * En caso de error se revierte
 * el cambio local y se muestra un MessageBar.
 */
export function SettingsDialog({
  open,
  currentUserId,
  currentOfficeId,
  currentDias,
  onClose,
  onSaved,
}: SettingsDialogProps) {
  // Lista de oficinas para el dropdown
  const [oficinas, setOficinas] = useState<Ovg_oficinaparagofs[]>([]);
  const [loadingOficinas, setLoadingOficinas] = useState(false);
  // Estado controlado por el usuario en el diálogo
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(currentOfficeId);
  const [selectedDias, setSelectedDias] = useState<number[]>(currentDias);
  // Snapshot al abrir el diálogo: usado para revertir en caso de error
  const [initialOfficeId, setInitialOfficeId] = useState<string | null>(currentOfficeId);
  const [initialDias, setInitialDias] = useState<number[]>(currentDias);
  // Estado de guardado (puede ser 'office' | 'dias' | null)
  const [saving, setSaving] = useState<'office' | 'dias' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, recargar oficinas y sincronizar estado con los valores actuales
  useEffect(() => {
    if (!open) return;

    setError(null);
    setSelectedOfficeId(currentOfficeId);
    setSelectedDias(currentDias);
    setInitialOfficeId(currentOfficeId);
    setInitialDias(currentDias);

    async function loadOficinas() {
      setLoadingOficinas(true);
      try {
        const result = await Ovg_oficinaparagofsService.getAll({
          filter: 'statecode eq 0',
          select: ['ovg_oficinaparagofid', 'ovg_nombre'],
        });
        setOficinas(result.data || []);
      } catch (err) {
        console.error('Error cargando oficinas:', err);
        setError('No se pudieron cargar las oficinas disponibles');
      } finally {
        setLoadingOficinas(false);
      }
    }
    void loadOficinas();
  }, [open, currentOfficeId, currentDias]);

  // Persiste el cambio de oficina en systemuser
  const persistOffice = async (newOfficeId: string | null) => {
    if (!currentUserId) return;
    setSaving('office');
    setError(null);
    try {
      // Asignar y vaciar el lookup se hace con el bind de la propiedad de navegación
      // (null desasocia). _ovg_oficinaparagof_value es de solo lectura.
      const payload: Record<string, unknown> = {
        'ovg_oficinaparagof@odata.bind': newOfficeId
          ? `/ovg_oficinaparagofs(${newOfficeId})`
          : null,
      };
      await SystemusersService.update(
        currentUserId,
        payload as unknown as Parameters<typeof SystemusersService.update>[1]
      );
      setInitialOfficeId(newOfficeId);
      onSaved(newOfficeId, selectedDias);
    } catch (err) {
      console.error('Error guardando oficina:', err);
      setError('No se pudo guardar la oficina. Inténtalo de nuevo.');
      // Revertir al último valor confirmado en servidor
      setSelectedOfficeId(initialOfficeId);
    } finally {
      setSaving(null);
    }
  };

  // Persiste el cambio de días para avisos automáticos en systemuser
  const persistDias = async (newDias: number[]) => {
    if (!currentUserId) return;
    setSaving('dias');
    setError(null);
    try {
      const payload = { ovg_diasparaavisosautomaticosengof: newDias };
      const result = await SystemusersService.update(
        currentUserId,
        payload as unknown as Parameters<typeof SystemusersService.update>[1]
      );
      if (result.data) {
        setInitialDias(newDias);
        onSaved(selectedOfficeId, newDias);
      }
    } catch (err) {
      console.error('Error guardando días:', err);
      setError('No se pudieron guardar los días. Inténtalo de nuevo.');
      setSelectedDias(initialDias);
    } finally {
      setSaving(null);
    }
  };

  const handleOfficeChange = (value: string) => {
    const newOfficeId = value === NO_OFFICE_OPTION ? null : value || null;
    setSelectedOfficeId(newOfficeId);
    void persistOffice(newOfficeId);
  };

  const handleDiasChange = (selected: string[]) => {
    // Fluent UI devuelve strings; convertimos a números para emparejar con el modelo
    const newDias = selected.map(s => Number(s)).filter(n => !Number.isNaN(n));
    setSelectedDias(newDias);
    void persistDias(newDias);
  };

  const oficinaSeleccionada = selectedOfficeId
    ? oficinas.find(o => o.ovg_oficinaparagofid === selectedOfficeId)?.ovg_nombre ?? ''
    : '';

  // Para el multiselect: mostramos los días seleccionados en el orden del catálogo
  const diasValue = DIAS_SEMANA
    .filter(d => selectedDias.includes(d.value))
    .map(d => d.label)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={(_e, data) => !data.open && onClose()}>
      <DialogSurface className="settings-surface">
        <DialogBody>
          <DialogTitle
            action={
              <button
                type="button"
                className="settings-close-button"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <DismissRegular />
              </button>
            }
          >
            <Text size={500} weight="semibold" className="settings-title">
              Configuraciones
            </Text>
          </DialogTitle>

          <DialogContent className="settings-content">
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}

            {saving && (
              <div className="settings-saving">
                <Spinner size="tiny" />
                <Text size={100}>
                  {saving === 'office' ? 'Guardando oficina…' : 'Guardando días…'}
                </Text>
              </div>
            )}

            <div className="settings-row">
              <div className="settings-label-line">
                <label htmlFor="settings-office" className="settings-label">
                  Oficina <span className="settings-required">*</span>
                </label>
                <Tooltip
                  content="Seleccionar una oficina es obligatorio para usar la app. Al elegirla, recibirás un resumen diario de quién irá a esa oficina y de los eventos, si están habilitados. Si ya no quieres usar la app ni recibir estos avisos, selecciona «Ninguna»."
                  relationship="description"
                >
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<QuestionCircleRegular />}
                    aria-label="Información sobre la oficina"
                    className="settings-help-button"
                  />
                </Tooltip>
              </div>
              {loadingOficinas ? (
                <Spinner size="small" label="Cargando oficinas…" />
              ) : (
                <Dropdown
                  id="settings-office"
                  placeholder="Selecciona una oficina"
                  value={oficinaSeleccionada}
                  onOptionSelect={(_e, data) => {
                    if (data.optionValue !== undefined) {
                      handleOfficeChange(data.optionValue);
                    }
                  }}
                  disabled={saving === 'office'}
                >
                  <Option value={NO_OFFICE_OPTION}>
                    Ninguna (dejar de recibir notificaciones)
                  </Option>
                  {oficinas.map(o => (
                    <Option key={o.ovg_oficinaparagofid} value={o.ovg_oficinaparagofid}>
                      {o.ovg_nombre}
                    </Option>
                  ))}
                </Dropdown>
              )}
            </div>

            <div className="settings-row">
              <div className="settings-label-line">
                <label htmlFor="settings-dias" className="settings-label">
                  Días para avisos automáticos
                </label>
                <Tooltip
                  content="Es opcional. El flujo se ejecuta a las 03:00 en días laborables y crea avisos para las fechas de los próximos 7 días que coincidan con los días seleccionados (entre 1 y 7 días de antelación)."
                  relationship="description"
                >
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<QuestionCircleRegular />}
                    aria-label="Información sobre los avisos automáticos"
                    className="settings-help-button"
                  />
                </Tooltip>
              </div>
              <Dropdown
                id="settings-dias"
                multiselect
                placeholder="Selecciona días"
                value={diasValue}
                selectedOptions={selectedDias.map(String)}
                onOptionSelect={(_e, data) => {
                  if (data.selectedOptions) {
                    handleDiasChange(data.selectedOptions);
                  }
                }}
                disabled={saving === 'dias'}
              >
                {DIAS_SEMANA.map(d => (
                  <Option key={d.value} value={String(d.value)}>
                    {d.label}
                  </Option>
                ))}
              </Dropdown>
            </div>
          </DialogContent>

          <DialogActions>
            <Tooltip
              content={`${import.meta.env.DEV ? 'Desarrollo local iniciado' : 'Compilación'}: ${new Date(__BUILD_TIME__).toLocaleString('es-ES')} · Commit: ${__GIT_SHA__}`}
              relationship="description"
            >
              <Text size={100} className="settings-version" tabIndex={0}>
                v{__APP_VERSION__}
              </Text>
            </Tooltip>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}