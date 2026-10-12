import type { AccessRole } from '../../types/documents'

export interface Capabilities {
  canEdit: boolean
  canShare: boolean
  canDelete: boolean
}

/**
 * UI capabilities for a role. This only decides what controls to show —
 * the database enforces the same rules independently via RLS and grants.
 */
export function capabilitiesFor(role: AccessRole): Capabilities {
  return {
    canEdit: role === 'owner' || role === 'editor',
    canShare: role === 'owner',
    canDelete: role === 'owner',
  }
}

export const ROLE_LABELS: Record<AccessRole, string> = {
  owner: 'Owner',
  editor: 'Can edit',
  viewer: 'Can view',
}
