import { describe, expect, it } from 'vitest'
import { capabilitiesFor } from './permissions'

describe('capabilitiesFor (UI only — enforcement is in RLS)', () => {
  it('distinguishes owner, editor and viewer', () => {
    expect(capabilitiesFor('owner')).toEqual({ canEdit: true, canShare: true, canDelete: true })
    expect(capabilitiesFor('editor')).toEqual({ canEdit: true, canShare: false, canDelete: false })
    expect(capabilitiesFor('viewer')).toEqual({ canEdit: false, canShare: false, canDelete: false })
  })
})
