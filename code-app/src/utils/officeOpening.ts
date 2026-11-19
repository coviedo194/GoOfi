export type OfficeOpeningStatus = 'empty' | 'covered' | 'uncovered' | 'unknown';

export function getOfficeOpeningPermissions(
  users: ReadonlyArray<{ systemuserid: string; ovg_permisodeaperturadeoficina?: boolean | null }>,
): Map<string, boolean> {
  return new Map(users.map(user => [
    user.systemuserid,
    user.ovg_permisodeaperturadeoficina === true,
  ]));
}

export function getOfficeOpeningStatus(
  notices: ReadonlyArray<{ _owninguser_value?: string }>,
  permissions: ReadonlyMap<string, boolean>,
): OfficeOpeningStatus {
  if (notices.length === 0) return 'empty';
  if (notices.some(notice => permissions.get(notice._owninguser_value ?? '') === true)) {
    return 'covered';
  }
  if (notices.some(notice => !permissions.has(notice._owninguser_value ?? ''))) {
    return 'unknown';
  }
  return 'uncovered';
}
