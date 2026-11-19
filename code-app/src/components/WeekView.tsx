import { useState, useEffect } from 'react';
import {
  Button,
  Spinner,
  Switch,
  Badge,
  Card,
  CardHeader,
  Text,
  Tooltip,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  PersonRegular,
  ClockRegular,
  ArrowSyncRegular,
  AddRegular,
  EditRegular,
  SettingsRegular,
  LockClosedRegular,
  LockOpenRegular,
  WarningRegular,
} from '@fluentui/react-icons';
import { getMonday, getWeekDays, formatDayShort, formatWeekRange, isSameDay, toISODateString } from '../utils/dateUtils';
import type { Ovg_avisodegofs, Ovg_avisodegofsBase } from '../generated/models/Ovg_avisodegofsModel';
import type { Ovg_eventoparagofs } from '../generated/models/Ovg_eventoparagofsModel';
import type { Ovg_asistentedeeventoparagofs, Ovg_asistentedeeventoparagofsBase } from '../generated/models/Ovg_asistentedeeventoparagofsModel';
import { Ovg_avisodegofsService } from '../generated/services/Ovg_avisodegofsService';
import { Ovg_eventoparagofsService } from '../generated/services/Ovg_eventoparagofsService';
import { Ovg_asistentedeeventoparagofsService } from '../generated/services/Ovg_asistentedeeventoparagofsService';
import { SystemusersService } from '../generated/services/SystemusersService';
import { WhoAmIService } from '../generated/services/WhoAmIService';
import { getContext } from '@microsoft/power-apps/app';
import { Ovg_oficinaparagofsService } from '../generated/services/Ovg_oficinaparagofsService';
import { EventDetailDialog } from './EventDetailDialog';
import { EventFormDialog } from './EventFormDialog';
import { MiniCalendar } from './MiniCalendar';
import { ThemeMenu } from './ThemeMenu';
import type { ThemePreference } from '../hooks/useThemePreference';
import { SettingsDialog } from './SettingsDialog';
import { canViewOfficeOpening } from '../services/officeOpeningService';
import { getOfficeOpeningPermissions, getOfficeOpeningStatus } from '../utils/officeOpening';
import './WeekView.css';

/**
 * Obtiene el systemuserid del usuario actual sin depender de un único mecanismo:
 * 1) contexto del host (`user.systemUserId`), 2) WhoAmI, 3) búsqueda por objectId de Entra ID.
 */
async function resolveCurrentSystemUserId(): Promise<string> {
  let objectId: string | undefined;
  try {
    const ctx = await getContext();
    if (ctx.user.systemUserId) return ctx.user.systemUserId;
    objectId = ctx.user.objectId;
  } catch {
    // Seguir con los demás mecanismos
  }

  try {
    const result = await WhoAmIService.WhoAmI();
    const userId = result.data?.UserId;
    if (typeof userId === 'string' && userId) return userId;
  } catch {
    // Seguir con la búsqueda por objectId
  }

  if (objectId) {
    const users = await SystemusersService.getAll({
      filter: `azureactivedirectoryobjectid eq ${objectId}`,
      select: ['systemuserid'],
      top: 1,
    });
    const userId = users.data?.[0]?.systemuserid;
    if (userId) return userId;
  }

  throw new Error('Dataverse no devolvió el ID del usuario actual');
}

/**
 * WeekView - Componente principal que muestra la vista semanal
 * 
 * Muestra 5 columnas (Lun-Vie) con:
 * - Navegación para cambiar de semana
 * - Indicador del día actual
 * - Eventos del día con asistentes
 * - Lista de personas que van a la oficina
 */
interface WeekViewProps {
  themePreference: ThemePreference;
  isDarkTheme: boolean;
  onThemePreferenceChange: (value: ThemePreference) => void;
}

export function WeekView({ themePreference, isDarkTheme, onThemePreferenceChange }: WeekViewProps) {
  const appHeaderTitleBrand = 'GoOfi';
  const appHeaderTitleTagline = '- Nos vemos allí!';

  // Estado: el lunes de la semana que estamos viendo
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  
  // Estados para datos de Dataverse
  const [avisos, setAvisos] = useState<Ovg_avisodegofs[]>([]);
  const [eventos, setEventos] = useState<Ovg_eventoparagofs[]>([]);
  const [asistentes, setAsistentes] = useState<Ovg_asistentedeeventoparagofs[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userOfficeId, setUserOfficeId] = useState<string | null>(null);
  const [officeSetupStatus, setOfficeSetupStatus] = useState<
    'loading' | 'no-offices' | 'office-required' | 'ready' | 'error'
  >('loading');
  const [availableOfficeCount, setAvailableOfficeCount] = useState(0);
  const [setupPromptDismissed, setSetupPromptDismissed] = useState(false);
  const [initializationRetryCount, setInitializationRetryCount] = useState(0);
  const [weekDataRetryCount, setWeekDataRetryCount] = useState(0);
  // Bandera de la oficina del usuario: indica si permite crear/gestionar eventos.
  // Default true cuando no se puede leer el flag de una oficina configurada.
  const [officePermiteEventos, setOfficePermiteEventos] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // ID del día que se está guardando
  // Mapa de ID de oficina -> nombre
  const [officeNames, setOfficeNames] = useState<Map<string, string>>(new Map());
  // Evento seleccionado para ver detalle
  const [selectedEvent, setSelectedEvent] = useState<Ovg_eventoparagofs | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  // IDs de eventos en los que el usuario está cambiando su asistencia
  const [togglingAttendance, setTogglingAttendance] = useState<Set<string>>(new Set());
  // Formulario de creación/edición de evento
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<Ovg_eventoparagofs | null>(null);
  const [preSelectedDate, setPreSelectedDate] = useState<Date | undefined>(undefined);
  // Mapa de ID de usuario -> nombre completo
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [showOfficeOpening, setShowOfficeOpening] = useState(false);
  const [openingAccessError, setOpeningAccessError] = useState<string | null>(null);
  const [openingPermissions, setOpeningPermissions] = useState<Map<string, boolean>>(new Map());
  // Días configurados por el usuario para avisos automáticos (1=Lun … 5=Vie)
  const [userDiasAvisosAuto, setUserDiasAvisosAuto] = useState<number[]>([]);
  // Modal de Configuraciones (oficina + días)
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Calculamos los 5 días de la semana
  const weekDays = getWeekDays(currentMonday);
  const today = new Date();

  // Cargar usuario actual al montar el componente
  useEffect(() => {
    async function loadCurrentUser() {
      setError(null);
      setLoading(true);
      setOfficeSetupStatus('loading');
      setShowOfficeOpening(false);
      setOpeningAccessError(null);
      try {
        const userId = await resolveCurrentSystemUserId();
        setCurrentUserId(userId);

        const userResult = await SystemusersService.get(userId, {
          select: ['systemuserid', 'fullname', '_ovg_oficinaparagof_value', 'ovg_diasparaavisosautomaticosengof'],
        });
        const officesResult = await Ovg_oficinaparagofsService.getAll({
          filter: 'statecode eq 0',
          select: ['ovg_oficinaparagofid', 'ovg_nombre'],
        });
        if (!userResult.data) {
          throw new Error('No se pudieron cargar las preferencias del usuario');
        }

        const offices = officesResult.data || [];
        const officeId = (userResult.data as unknown as Record<string, unknown>)['_ovg_oficinaparagof_value'] as string | null;
        setAvailableOfficeCount(offices.length);
        setUserOfficeId(officeId || null);

        if (officeId) {
          console.log('Oficina del usuario:', officeId);
          try {
            const officeResult = await Ovg_oficinaparagofsService.get(officeId, {
              select: ['ovg_oficinaparagofid', 'ovg_permiteeventos'],
            });
            const rawFlag = (officeResult.data as unknown as Record<string, unknown>)['ovg_permiteeventos'];
            const permite = rawFlag === true || rawFlag === 1;
            setOfficePermiteEventos(permite);
            console.log('Oficina permite eventos:', permite);
          } catch (flagErr) {
            console.warn('No se pudo cargar ovg_permiteeventos, asumiendo true:', flagErr);
            setOfficePermiteEventos(true);
          }
        }

        const rawDias = (userResult.data as unknown as Record<string, unknown>)['ovg_diasparaavisosautomaticosengof'];
        if (Array.isArray(rawDias)) {
          const diasNorm = rawDias
            .map(d => Number(d))
            .filter(d => !Number.isNaN(d));
          setUserDiasAvisosAuto(diasNorm);
          console.log('Días para avisos automáticos:', diasNorm);
        }

        try {
          setShowOfficeOpening(await canViewOfficeOpening(userId));
        } catch (accessError) {
          console.error('Error al comprobar el acceso a los indicadores de apertura:', accessError);
          setOpeningAccessError('No se pudo comprobar tu permiso de apertura ni tu rol GOF-Administradores. Los indicadores de apertura están ocultos.');
        }

        setOfficeSetupStatus(
          officeId ? 'ready' : offices.length > 0 ? 'office-required' : 'no-offices'
        );
      } catch (err) {
        console.error('Error al obtener usuario:', err);
        const detail = err instanceof Error ? err.message : String(err);
        setError(`No se pudo comprobar la configuración de oficina. Inténtalo de nuevo. (${detail})`);
        setOfficeSetupStatus('error');
        setLoading(false);
      }
    }
    loadCurrentUser();
  }, [initializationRetryCount]);

  // Cargar datos cuando cambie la semana
  useEffect(() => {
    let cancelled = false;
    async function loadWeekData() {
      if (officeSetupStatus === 'loading') {
        setLoading(true);
        return;
      }

      if (!currentUserId || officeSetupStatus !== 'ready' || !userOfficeId) {
        setAvisos([]);
        setEventos([]);
        setAsistentes([]);
        setUserNames(new Map());
        setOfficeNames(new Map());
        setOpeningPermissions(new Map());
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const friday = new Date(currentMonday);
        friday.setDate(currentMonday.getDate() + 4);
        
        const startDate = toISODateString(currentMonday);
        const endDate = toISODateString(friday);
        
        console.log('Cargando semana:', startDate, 'a', endDate);

        // Los datos de uso siempre se filtran por la oficina confirmada del usuario.
        const officeFilter = `_ovg_oficina_value eq ${userOfficeId}`;

        // Cargar avisos de la semana (ovg_fecha es DateOnly)
        const avisosFilter = [
          `ovg_fecha ge ${startDate}`,
          `ovg_fecha le ${endDate}`,
          'statecode eq 0',
          officeFilter,
        ].filter(Boolean).join(' and ');
        const avisosResult = await Ovg_avisodegofsService.getAll({
          filter: avisosFilter,
        });
        if (!avisosResult.data) {
          throw new Error('Dataverse no devolvió los avisos de la semana');
        }
        console.log('Avisos cargados:', avisosResult.data?.length);

        // Cargar eventos de la semana (ovg_fecha es DateTime)
        // Sólo si la oficina del usuario permite eventos
        let eventosData: Ovg_eventoparagofs[] = [];
        let asistentesData: Ovg_asistentedeeventoparagofs[] = [];
        if (officePermiteEventos) {
          const eventosFilter = [
            `Microsoft.Dynamics.CRM.OnOrAfter(PropertyName='ovg_fecha',PropertyValue='${startDate}')`,
            `Microsoft.Dynamics.CRM.OnOrBefore(PropertyName='ovg_fecha',PropertyValue='${endDate}')`,
            'statecode eq 0',
            officeFilter,
          ].filter(Boolean).join(' and ');
          const eventosResult = await Ovg_eventoparagofsService.getAll({
            filter: eventosFilter,
          });
          eventosData = eventosResult.data || [];
          console.log('Eventos cargados:', eventosData.length);

          // Cargar asistentes (si hay eventos)
          if (eventosData.length > 0) {
            const eventIds = eventosData.map(e => e.ovg_eventoparagofid);
            const asistentesResult = await Ovg_asistentedeeventoparagofsService.getAll({
              filter: `statecode eq 0`,
            });
            // Filtrar solo asistentes de eventos de esta semana
            asistentesData = (asistentesResult.data || []).filter(a =>
              eventIds.includes(a._ovg_evento_value || '')
            );
            console.log('Asistentes cargados:', asistentesData.length);
          }
        } else {
          console.log('Eventos desactivados por ovg_permiteeventos=0; saltando query');
        }
        
        // Recolectar IDs de usuarios únicos (propietarios de avisos y eventos)
        const userIds = new Set<string>();
        (avisosResult.data || []).forEach(a => {
          if (a._owninguser_value) userIds.add(a._owninguser_value);
        });
        eventosData.forEach(e => {
          if (e._owninguser_value) userIds.add(e._owninguser_value);
        });
        if (showOfficeOpening) userIds.add(currentUserId);
        // Recolectar IDs de oficinas únicas (para resolver nombres en el detalle)
        const officeIds = new Set<string>();
        eventosData.forEach(e => {
          if (e._ovg_oficina_value) officeIds.add(e._ovg_oficina_value);
        });

        // Cargar nombres de usuarios si hay IDs
        const namesMap = new Map<string, string>();
        let permissionsMap = new Map<string, boolean>();
        if (userIds.size > 0) {
          const userIdsArray = Array.from(userIds);
          // Construir filtro OData para obtener usuarios por ID
          const userFilter = userIdsArray.map(id => `systemuserid eq ${id}`).join(' or ');
          const usersResult = await SystemusersService.getAll({
            filter: userFilter,
            select: [
              'systemuserid',
              'fullname',
              ...(showOfficeOpening ? ['ovg_permisodeaperturadeoficina'] : []),
            ],
          });
          if (!usersResult.data) {
            throw new Error('Dataverse no devolvió los datos de las personas de la semana');
          }
          console.log('Usuarios cargados:', usersResult.data?.length);
          (usersResult.data || []).forEach(u => {
            if (u.systemuserid && u.fullname) {
              namesMap.set(u.systemuserid, u.fullname);
            }
          });
          if (showOfficeOpening) {
            permissionsMap = getOfficeOpeningPermissions(usersResult.data);
          }
        }

        // Resolver nombres de oficinas
        const officesMap = new Map<string, string>();
        if (officeIds.size > 0) {
          const officeIdsArray = Array.from(officeIds);
          const officesResult = await Ovg_oficinaparagofsService.getAll({
            filter: officeIdsArray.map(id => `ovg_oficinaparagofid eq ${id}`).join(' or '),
            select: ['ovg_oficinaparagofid', 'ovg_nombre'],
          });
          (officesResult.data || []).forEach(o => {
            if (o.ovg_oficinaparagofid && o.ovg_nombre) {
              officesMap.set(o.ovg_oficinaparagofid, o.ovg_nombre);
            }
          });
        }
        if (!cancelled) {
          setAvisos(avisosResult.data || []);
          setEventos(eventosData);
          setAsistentes(asistentesData);
          setUserNames(namesMap);
          setOpeningPermissions(permissionsMap);
          setOfficeNames(officesMap);
        }
      } catch (err) {
        console.error('Error cargando datos:', err);
        if (!cancelled) setError('Error al cargar datos de Dataverse');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    loadWeekData();
    return () => { cancelled = true; };
  }, [currentMonday, currentUserId, officePermiteEventos, officeSetupStatus, userOfficeId, weekDataRetryCount, showOfficeOpening]);

  // Navegación entre semanas
  const goToPreviousWeek = () => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(newMonday);
  };

  const goToNextWeek = () => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(newMonday);
  };

  const goToToday = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Formatea la fecha actual como "Hoy, 2 Ago" para el botón de "Hoy"
  const formatTodayShort = () => {
    const t = new Date();
    const day = t.getDate();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${monthNames[t.getMonth()]}`;
  };

  // Filtra avisos para un día específico
  const getAvisosDelDia = (date: Date): Ovg_avisodegofs[] => {
    const dateStr = toISODateString(date);
    return avisos.filter(a => a.ovg_fecha === dateStr);
  };

  // Filtra eventos para un día específico
  const getEventosDelDia = (date: Date): Ovg_eventoparagofs[] => {
    const dateStr = toISODateString(date);
    return eventos.filter(e => {
      const eventoDate = e.ovg_fecha.split('T')[0];
      return eventoDate === dateStr;
    });
  };

  // Obtiene asistentes de un evento
  const getAsistentesEvento = (eventoId: string): Ovg_asistentedeeventoparagofs[] => {
    return asistentes.filter(a => a._ovg_evento_value === eventoId);
  };

  // Verifica si el usuario actual va a la oficina un día
  const usuarioVaEseDia = (date: Date): boolean => {
    if (!currentUserId) return false;
    const avisosDelDia = getAvisosDelDia(date);
    return avisosDelDia.some(a => a._owninguser_value === currentUserId);
  };

  // Obtiene el nombre de un usuario por su ID
  const getUserName = (userId: string | undefined): string => {
    if (!userId) return 'Usuario';
    return userNames.get(userId) || 'Usuario';
  };

  // Toggle para crear/eliminar aviso del usuario actual
  const toggleAviso = async (date: Date) => {
    if (!currentUserId || !userOfficeId) {
      console.error('Falta userId o officeId');
      return;
    }
    
    const dateStr = toISODateString(date);
    setSaving(dateStr);
    
    try {
      const miAviso = avisos.find(
        a => a._owninguser_value === currentUserId && a.ovg_fecha === dateStr
      );
      
      if (miAviso) {
        // Eliminar aviso existente
        await Ovg_avisodegofsService.delete(miAviso.ovg_avisodegofid);
        setAvisos(prev => prev.filter(a => a.ovg_avisodegofid !== miAviso.ovg_avisodegofid));
        console.log('Aviso eliminado');
      } else {
        // Crear nuevo aviso
        const newAviso = {
          ovg_fecha: dateStr,
          'ovg_oficina@odata.bind': `/ovg_oficinaparagofs(${userOfficeId})`,
          ovg_creadomedianteregla: false,
        };
        
        const result = await Ovg_avisodegofsService.create(newAviso as unknown as Omit<Ovg_avisodegofsBase, 'ovg_avisodegofid'>);
        
        if (result.data) {
          // Agregar a la lista local con el ID del usuario
          const createdAviso = {
            ...result.data,
            _owninguser_value: currentUserId,
          };
          setAvisos(prev => [...prev, createdAviso]);
          
          // Asegurar que el nombre del usuario está en el mapa
          if (!userNames.has(currentUserId)) {
            const userResult = await SystemusersService.get(currentUserId, {
              select: ['systemuserid', 'fullname'],
            });
            if (userResult.data?.fullname) {
              setUserNames(prev => new Map(prev).set(currentUserId, userResult.data!.fullname!));
            }
          }
          console.log('Aviso creado:', result.data.ovg_avisodegofid);
        }
      }
    } catch (err) {
      console.error('Error al toggle aviso:', err);
    } finally {
      setSaving(null);
    }
  };

  // Formatea la hora de un evento
  const formatHora = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  // Abre el modal de detalle con el evento seleccionado
  const openEventDetail = (evento: Ovg_eventoparagofs) => {
    setSelectedEvent(evento);
    setDetailDialogOpen(true);
  };

  // Cierra el modal de detalle
  const closeEventDetail = () => {
    setDetailDialogOpen(false);
    setSelectedEvent(null);
  };

  // Abre el formulario en modo creación con la fecha del lunes de la semana actual
  const openCreateEventForm = (date?: Date) => {
    setEditingEvent(null);
    setFormMode('create');
    setPreSelectedDate(date);
    setFormDialogOpen(true);
  };

  // Abre el formulario en modo edición con el evento seleccionado
  const openEditEventForm = (evento: Ovg_eventoparagofs) => {
    setEditingEvent(evento);
    setFormMode('edit');
    setFormDialogOpen(true);
  };

  // Cierra el formulario
  const closeEventForm = () => {
    setFormDialogOpen(false);
    setEditingEvent(null);
  };

  // Maneja el guardado exitoso del formulario (crear o editar)
  const handleEventSaved = (eventoGuardado: Ovg_eventoparagofs) => {
    if (formMode === 'edit') {
      setEventos(prev =>
        prev.map(e =>
          e.ovg_eventoparagofid === eventoGuardado.ovg_eventoparagofid ? eventoGuardado : e
        )
      );
      setSelectedEvent(eventoGuardado);
    } else {
      // Asegurar que tiene el _owninguser_value para que el filtro "mi evento" funcione
      const enriched: Ovg_eventoparagofs = currentUserId
        ? { ...eventoGuardado, _owninguser_value: currentUserId }
        : eventoGuardado;
      setEventos(prev => [...prev, enriched]);
    }

    // Refrescar nombres de oficinas para el modal de detalle
    const officeId = eventoGuardado._ovg_oficina_value;
    if (officeId && !officeNames.has(officeId)) {
      // Si no tenemos el nombre, lo añadimos con un fallback
      setOfficeNames(prev => {
        const next = new Map(prev);
        if (!next.has(officeId)) {
          next.set(officeId, 'Oficina');
        }
        return next;
      });
      // Recargar oficinas en background para resolver el nombre real
      void refreshOfficeName(officeId);
    }

    closeEventForm();
    // Recargar datos de la semana para tener la lista de oficinas actualizada también
    // (el nombre se habrá cargado al renderizar el modal)
  };

  // Refresca el nombre de una oficina específica
  const refreshOfficeName = async (officeId: string) => {
    try {
      const result = await Ovg_oficinaparagofsService.get(officeId, {
        select: ['ovg_oficinaparagofid', 'ovg_nombre'],
      });
      if (result.data?.ovg_nombre) {
        setOfficeNames(prev => {
          const next = new Map(prev);
          next.set(officeId, result.data!.ovg_nombre!);
          return next;
        });
      }
    } catch (err) {
      console.error('Error refrescando nombre de oficina:', err);
    }
  };

  // Elimina el evento seleccionado (sólo el organizador puede)
  const deleteSelectedEvent = async (eventoId: string) => {
    setDeletingEvent(true);
    try {
      await Ovg_eventoparagofsService.delete(eventoId);
      setEventos(prev => prev.filter(e => e.ovg_eventoparagofid !== eventoId));
      setAsistentes(prev => prev.filter(a => a._ovg_evento_value !== eventoId));
      closeEventDetail();
      console.log('Evento eliminado:', eventoId);
    } catch (err) {
      console.error('Error al eliminar evento:', err);
    } finally {
      setDeletingEvent(false);
    }
  };

  // Apunta o cancela la asistencia del usuario actual al evento indicado
  const toggleAsistenciaEvento = async (eventoId: string) => {
    if (!currentUserId) return;

    setTogglingAttendance(prev => new Set(prev).add(eventoId));
    try {
      const miAsistencia = asistentes.find(
        a => a._ovg_evento_value === eventoId && a._owninguser_value === currentUserId
      );

      if (miAsistencia) {
        // Cancelar asistencia existente
        await Ovg_asistentedeeventoparagofsService.delete(miAsistencia.ovg_asistentedeeventoparagofid);
        setAsistentes(prev =>
          prev.filter(a => a.ovg_asistentedeeventoparagofid !== miAsistencia.ovg_asistentedeeventoparagofid)
        );
        console.log('Asistencia cancelada:', miAsistencia.ovg_asistentedeeventoparagofid);
      } else {
        // Crear nueva asistencia
        const payload = {
          'ovg_evento@odata.bind': `/ovg_eventoparagofs(${eventoId})`,
          ovg_identificador: userNames.get(currentUserId) || 'Usuario',
        };
        const result = await Ovg_asistentedeeventoparagofsService.create(
          payload as unknown as Omit<Ovg_asistentedeeventoparagofsBase, 'ovg_asistentedeeventoparagofid'>
        );

        if (result.data) {
          const enrichedAttendee: Ovg_asistentedeeventoparagofs = {
            ...result.data,
            _ovg_evento_value: eventoId,
            _owninguser_value: currentUserId,
          };
          setAsistentes(prev => [...prev, enrichedAttendee]);
          console.log('Apuntado al evento:', result.data.ovg_asistentedeeventoparagofid);
        }
      }
    } catch (err) {
      console.error('Error al cambiar asistencia:', err);
    } finally {
      setTogglingAttendance(prev => {
        const next = new Set(prev);
        next.delete(eventoId);
        return next;
      });
    }
  };

  // Wrapper para el modal de detalle (opera sobre el evento seleccionado)
  const toggleSelectedEventAttendance = () => {
    if (selectedEvent) {
      void toggleAsistenciaEvento(selectedEvent.ovg_eventoparagofid);
    }
  };

  // Maneja el guardado de las preferencias en el modal de Configuraciones.
  // Si cambia la oficina, recargamos el flag ovg_permiteeventos para no romper
  // la visibilidad de la sección de Eventos; loadWeekData se re-ejecutará por
  // sí solo gracias a la dependencia userOfficeId del useEffect.
  const handleSettingsSaved = async (
    newOfficeId: string | null,
    newDias: number[]
  ) => {
    setUserDiasAvisosAuto(newDias);
    setOfficeSetupStatus(
      newOfficeId ? 'ready' : availableOfficeCount > 0 ? 'office-required' : 'no-offices'
    );
    if (newOfficeId !== userOfficeId) {
      setUserOfficeId(newOfficeId);
      if (newOfficeId) {
        // Recargar el flag ovg_permiteeventos de la nueva oficina
        try {
          const officeResult = await Ovg_oficinaparagofsService.get(newOfficeId, {
            select: ['ovg_oficinaparagofid', 'ovg_permiteeventos'],
          });
          const rawFlag = (officeResult.data as unknown as Record<string, unknown>)['ovg_permiteeventos'];
          const permite = rawFlag === true || rawFlag === 1;
          setOfficePermiteEventos(permite);
        } catch (flagErr) {
          console.warn('No se pudo recargar ovg_permiteeventos:', flagErr);
          setOfficePermiteEventos(true);
        }
      } else {
        // Sin oficina asignada: mantenemos la UX por defecto (eventos visibles)
        setOfficePermiteEventos(true);
      }
    }
  };

  // Mostrar estado de carga. Con Configuraciones abierto no desmontamos el árbol,
  // para no destruir el diálogo mientras se guarda la oficina.
  if (loading && !settingsOpen) {
    return (
      <div className="week-view">
        <header className="week-header">
          <Text size={500} className="app-title">
            <Text weight="bold" className="app-title-brand">{appHeaderTitleBrand}</Text>
            <Text weight="regular" className="app-title-tagline">{appHeaderTitleTagline}</Text>
          </Text>
        </header>
        <div className="loading-container">
          <Spinner
            size="large"
            label={officeSetupStatus === 'loading' ? 'Comprobando tu oficina...' : 'Buscando quiénes irán a la ofi...'}
          />
        </div>
      </div>
    );
  }

  // Mostrar error
  if (error) {
    return (
      <div className="week-view">
        <header className="week-header">
          <Text size={500} className="app-title">
            <Text weight="bold" className="app-title-brand">{appHeaderTitleBrand}</Text>
            <Text weight="regular" className="app-title-tagline">{appHeaderTitleTagline}</Text>
          </Text>
        </header>
        <div className="error-container">
          <Text>{error}</Text>
          <Button
            appearance="primary"
            onClick={() => {
              if (officeSetupStatus === 'error') {
                setInitializationRetryCount(count => count + 1);
              } else {
                setWeekDataRetryCount(count => count + 1);
              }
            }}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="week-view">
      {/* Header con navegación */}
      <header className="week-header">
        <div className="week-header-left">
          <div className="week-navigation">
            <Button
              icon={<ChevronLeftRegular />}
              appearance="subtle"
              onClick={goToPreviousWeek}
              title="Semana anterior"
            />
            <MiniCalendar
              currentMonday={currentMonday}
              onSelectDate={(date) => setCurrentMonday(date)}
              label={formatWeekRange(currentMonday)}
            />
            <Button
              icon={<ChevronRightRegular />}
              appearance="subtle"
              onClick={goToNextWeek}
              title="Semana siguiente"
            />
            <Button
              appearance="subtle"
              onClick={goToToday}
              aria-label="Ir a hoy"
              className="today-button"
            >
              Hoy, {formatTodayShort()}
            </Button>
          </div>
        </div>

        <Text size={500} className="app-title">
          <Text weight="bold" className="app-title-brand">{appHeaderTitleBrand}</Text>
          <Text weight="regular" className="app-title-tagline">{appHeaderTitleTagline}</Text>
        </Text>

        <div className="week-header-right">
          <ThemeMenu
            preference={themePreference}
            isDark={isDarkTheme}
            onChange={onThemePreferenceChange}
            className="settings-button"
          />
          <Button
            icon={<SettingsRegular />}
            appearance="subtle"
            onClick={() => setSettingsOpen(true)}
            title="Configuraciones"
            aria-label="Abrir configuraciones"
            className="settings-button"
          />
        </div>
      </header>

      {openingAccessError && (
        <MessageBar intent="warning">
          <MessageBarBody>
            {openingAccessError}{' '}
            <Button appearance="transparent" size="small" onClick={() => setInitializationRetryCount(count => count + 1)}>
              Reintentar comprobación
            </Button>
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Grid de días */}
      <div className="days-grid">
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          const eventosDelDia = getEventosDelDia(day);
          const avisosDelDia = getAvisosDelDia(day);
          const yoVoy = usuarioVaEseDia(day);
          const openingStatus = getOfficeOpeningStatus(avisosDelDia, openingPermissions);
          
          return (
            <div 
              key={day.toISOString()} 
              className={`day-column ${isToday ? 'is-today' : ''}`}
            >
              <div className="day-header">
                <Text weight="semibold" className="day-name">{formatDayShort(day)}</Text>
                {isToday && <Badge appearance="filled" color="brand">Hoy</Badge>}
                {showOfficeOpening && openingStatus !== 'covered' && (
                  <Badge
                    appearance="tint"
                    color={openingStatus === 'uncovered' ? 'danger' : 'warning'}
                    icon={openingStatus === 'uncovered' ? <LockClosedRegular /> : <WarningRegular />}
                    className="day-opening-status"
                  >
                    {openingStatus === 'empty'
                      ? 'Sin asistentes'
                      : openingStatus === 'uncovered'
                        ? 'Nadie puede abrir'
                        : 'Apertura sin confirmar'}
                  </Badge>
                )}
              </div>
              
              <div className="day-content">
                {/* Sección de eventos (sólo si la oficina del usuario permite eventos) */}
                {officePermiteEventos && (
                  <div className="events-section">
                    <div className="events-section-header">
                      <Text size={200} weight="semibold" className="events-section-title">
                        Eventos ({eventosDelDia.length})
                      </Text>
                      <Tooltip content="Crear evento en este día" relationship="label">
                        <Button
                          icon={<AddRegular />}
                          appearance="subtle"
                          size="small"
                          onClick={() => openCreateEventForm(day)}
                          disabled={!userOfficeId}
                          aria-label={`Nuevo evento el ${formatDayShort(day)}`}
                          className="day-add-event-button"
                        />
                      </Tooltip>
                    </div>
                    {eventosDelDia.length === 0 ? (
                    <Text size={200} className="empty-message">Sin eventos</Text>
                  ) : (
                    eventosDelDia.map(evento => {
                      const eventoId = evento.ovg_eventoparagofid;
                      const asistentesEvento = getAsistentesEvento(eventoId);
                      const yoAsisto = !!currentUserId && asistentesEvento.some(
                        a => a._owninguser_value === currentUserId
                      );
                      const soyOrganizador = !!currentUserId && evento._owninguser_value === currentUserId;
                      return (
                        <Card
                          key={eventoId}
                          className="event-card event-card-clickable"
                          size="small"
                          onClick={() => openEventDetail(evento)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openEventDetail(evento);
                            }
                          }}
                        >
                          <CardHeader
                            header={
                              <Text weight="semibold" size={200}>
                                {evento.ovg_asunto}
                              </Text>
                            }
                            description={
                              <div className="event-meta">
                                <span className="event-meta-item">
                                  <ClockRegular />
                                  <Text size={100}>{formatHora(evento.ovg_fecha)}</Text>
                                </span>
                                <span className="event-meta-item">
                                  <PersonRegular />
                                  <Text size={100}>{getUserName(evento._owninguser_value)}</Text>
                                </span>
                                {asistentesEvento.length > 0 && (
                                  <Badge appearance="tint" size="small">
                                    👥 {asistentesEvento.length}
                                  </Badge>
                                )}
                              </div>
                            }
                          />
                          <div
                            className="event-attendance-row"
                            // Evita que el click del switch abra el modal
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={yoAsisto}
                              disabled={togglingAttendance.has(eventoId) || !currentUserId}
                              onChange={() => toggleAsistenciaEvento(eventoId)}
                              label={
                                <Text size={100}>Asistir</Text>
                              }
                            />
                            {soyOrganizador && (
                              <Tooltip content="Ver detalle del evento" relationship="label">
                                <Button
                                  icon={<EditRegular />}
                                  appearance="subtle"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEventDetail(evento);
                                  }}
                                  aria-label="Ver detalle del evento"
                                  className="event-edit-button"
                                />
                              </Tooltip>
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
                )}

                {/* Separador (sólo si hay sección de eventos encima) */}
                {officePermiteEventos && <hr className="section-divider" />}

                {/* Sección de avisos: quién va */}
                <div className="notices-section">
                  {/* Título sólo cuando la sección de Eventos está visible (arriba).
                      Si no, el título se siente repetitivo como único elemento. */}
                  {officePermiteEventos && (
                    <div className="notices-header">
                      <Text size={200} weight="semibold" className="notices-section-title">
                        Personas que van a la Ofi ({avisosDelDia.length})
                      </Text>
                    </div>
                  )}

                  {/* Mi aviso (toggle) */}
                  <div className="my-notice">
                    <Switch
                      checked={yoVoy}
                      disabled={saving === toISODateString(day) || !userOfficeId}
                      onChange={() => toggleAviso(day)}
                      label={
                        saving === toISODateString(day)
                          ? 'Guardando…'
                          : yoVoy
                            ? 'Voy'
                            : 'Asistir'
                      }
                    />
                    {showOfficeOpening && yoVoy && currentUserId && openingPermissions.get(currentUserId) === true && (
                      <Tooltip content="Puedes abrir la oficina" relationship="description">
                        <span className="opening-key" role="img" aria-label="Puedes abrir la oficina" tabIndex={0}>
                          <LockOpenRegular aria-hidden="true" />
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  
                  {/* Lista de otros que van */}
                  <div className="attendees-list">
                    {avisosDelDia
                      .filter(a => a._owninguser_value !== currentUserId)
                      .map(aviso => (
                        <div key={aviso.ovg_avisodegofid} className="attendee">
                          <span className="attendee-name">
                            <PersonRegular />
                            <Text size={200}>{getUserName(aviso._owninguser_value)}</Text>
                            {showOfficeOpening && openingPermissions.get(aviso._owninguser_value ?? '') === true && (
                              <Tooltip content="Puede abrir la oficina" relationship="description">
                                <span className="opening-key" role="img" aria-label="Puede abrir la oficina" tabIndex={0}>
                                  <LockOpenRegular aria-hidden="true" />
                                </span>
                              </Tooltip>
                            )}
                          </span>
                          {aviso.ovg_creadomedianteregla && (
                            <Tooltip content="Aviso automático" relationship="label">
                              <Badge appearance="outline" size="small" icon={<ArrowSyncRegular />} />
                            </Tooltip>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de detalle del evento seleccionado */}
      <EventDetailDialog
        evento={selectedEvent}
        open={detailDialogOpen}
        asistentes={selectedEvent ? getAsistentesEvento(selectedEvent.ovg_eventoparagofid) : []}
        userNames={userNames}
        oficinaNombre={
          selectedEvent?._ovg_oficina_value
            ? officeNames.get(selectedEvent._ovg_oficina_value)
            : undefined
        }
        currentUserId={currentUserId}
        deleting={deletingEvent}
        togglingAttendance={togglingAttendance.size > 0}
        onClose={closeEventDetail}
        onDelete={deleteSelectedEvent}
        onEdit={openEditEventForm}
        onToggleAttendance={toggleSelectedEventAttendance}
      />

      {/* Modal de formulario (crear/editar) */}
      <EventFormDialog
        open={formDialogOpen}
        isEdit={formMode === 'edit'}
        evento={editingEvent}
        defaultOfficeId={userOfficeId}
        preSelectedDate={preSelectedDate}
        onClose={closeEventForm}
        onSaved={handleEventSaved}
      />

      {/* Modal de Configuraciones (oficina + días de avisos automáticos) */}
      <SettingsDialog
        open={settingsOpen}
        currentUserId={currentUserId}
        currentOfficeId={userOfficeId}
        currentDias={userDiasAvisosAuto}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
      />

      <Dialog
        open={
          officeSetupStatus !== 'loading' &&
          officeSetupStatus !== 'ready' &&
          !settingsOpen &&
          !setupPromptDismissed
        }
        onOpenChange={(_event, data) => {
          if (!data.open && officeSetupStatus !== 'office-required') {
            setSetupPromptDismissed(true);
          }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {officeSetupStatus === 'no-offices'
                ? 'Todavía no hay oficinas disponibles'
                : 'Configura tu oficina para empezar'}
            </DialogTitle>
            <DialogContent>
              {officeSetupStatus === 'no-offices' ? (
                <p><Text>
                  Aún no hay oficinas creadas o disponibles en GoOfi. Contacta con el administrador
                  para que configure una y puedas empezar a utilizar la aplicación.
                </Text></p>
              ) : (
                <>
                  <p><Text>
                    No tienes una oficina configurada. Selecciona la tuya en Configuraciones para
                    empezar a utilizar GoOfi.
                  </Text></p>
                  <p><Text>
                    Al fijarla, recibirás un resumen diario sobre las personas que irán a esa
                    oficina y, si la funcionalidad está habilitada, sobre sus eventos. Si dejas de
                    usar la aplicación o no quieres recibir más notificaciones, vacía la oficina
                    seleccionada en Configuraciones.
                  </Text></p>
                </>
              )}
            </DialogContent>
            <DialogActions>
              {officeSetupStatus === 'office-required' ? (
                <Button appearance="primary" onClick={() => setSettingsOpen(true)}>
                  Configurar mi oficina
                </Button>
              ) : (
                <Button
                  appearance="primary"
                  onClick={() => setSetupPromptDismissed(true)}
                >
                  Entendido
                </Button>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
