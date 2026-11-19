import { SystemusersService } from '../generated/services/SystemusersService';

export async function canViewOfficeOpening(userId: string): Promise<boolean> {
  const result = await SystemusersService.getAll({
    select: ['systemuserid'],
    filter: `systemuserid eq ${userId} and (ovg_permisodeaperturadeoficina eq true or systemuserroles_association/any(r:r/name eq 'GOF-Administradores') or teammembership_association/any(t:t/teamroles_association/any(r:r/name eq 'GOF-Administradores')))`,
    top: 1,
  });
  if (!result.data) {
    throw new Error('Dataverse no devolvió el acceso del usuario a los indicadores de apertura');
  }
  return result.data.length > 0;
}
