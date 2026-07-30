import { describe, expect, test } from 'bun:test'
import {
  isPinnedPermissionTarget,
  isTrustedPermissionReply,
  parsePermissionReply,
} from './permission-routing'

describe('permission reply parsing', () => {
  test('requires the request token instead of guessing from pending state', () => {
    expect(parsePermissionReply('yes')).toBeNull()
    expect(parsePermissionReply('no')).toBeNull()
    expect(parsePermissionReply('yes abcde')).toEqual({
      requestId: 'abcde',
      behavior: 'allow',
    })
    expect(parsePermissionReply('NO FGHİJ')).toBeNull()
    expect(parsePermissionReply('no fghij')).toEqual({
      requestId: 'fghij',
      behavior: 'deny',
    })
  })

  test('keeps consecutive replies bound to their explicit request IDs', () => {
    expect(parsePermissionReply('yes abcde')?.requestId).toBe('abcde')
    expect(parsePermissionReply('yes fghij')?.requestId).toBe('fghij')
  })
})

describe('pinned permission route', () => {
  test('requires a one-to-one DM containing the configured owner handle', () => {
    const configured = {
      chatGuid: 'iMessage;-;+15551234567',
      chatStyle: 45,
      participantHandles: ['+15551234567'],
      permissionChat: 'iMessage;-;+15551234567',
      permissionOwner: '+15551234567',
    }
    expect(isPinnedPermissionTarget(configured)).toBeTrue()
    expect(isPinnedPermissionTarget({ ...configured, chatStyle: 43 })).toBeFalse()
    expect(isPinnedPermissionTarget({
      ...configured,
      participantHandles: ['friend@icloud.com'],
    })).toBeFalse()
    expect(isPinnedPermissionTarget({
      ...configured,
      permissionOwner: undefined,
    })).toBeFalse()
  })

  test('does not grant an allowlisted non-owner permission authority', () => {
    const configured = {
      isSelfChat: false,
      isGroup: false,
      service: 'iMessage',
      chatGuid: 'iMessage;-;+15551234567',
      senderHandle: 'friend@icloud.com',
      permissionChat: 'iMessage;-;+15551234567',
      permissionOwner: '+15551234567',
    }
    expect(isTrustedPermissionReply(configured)).toBeFalse()
    expect(isTrustedPermissionReply({
      ...configured,
      senderHandle: '+15551234567',
    })).toBeTrue()
    expect(isTrustedPermissionReply({
      ...configured,
      isGroup: true,
      senderHandle: '+15551234567',
    })).toBeFalse()
    expect(isTrustedPermissionReply({
      ...configured,
      service: 'SMS',
      senderHandle: '+15551234567',
    })).toBeFalse()
  })
})
