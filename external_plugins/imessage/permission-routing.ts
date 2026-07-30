export type PermissionBehavior = 'allow' | 'deny'

export type PermissionReply = {
  requestId: string
  behavior: PermissionBehavior
}

// Permission replies must carry the five-letter request token. A bare reply
// cannot be safely correlated with a prompt when requests or deliveries
// overlap, so it is deliberately treated as ordinary conversation.
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i

export function parsePermissionReply(text: string): PermissionReply | null {
  const match = PERMISSION_REPLY_RE.exec(text)
  if (!match) return null
  return {
    requestId: match[2]!.toLowerCase(),
    behavior: match[1]!.toLowerCase().startsWith('y') ? 'allow' : 'deny',
  }
}

export function normalizePermissionHandle(handle: string): string {
  return handle.trim().toLowerCase()
}

type PinnedTargetInput = {
  chatGuid: string
  chatStyle: number | null
  participantHandles: string[]
  permissionChat?: string
  permissionOwner?: string
}

export function isPinnedPermissionTarget(input: PinnedTargetInput): boolean {
  if (!input.permissionChat || !input.permissionOwner) return false
  if (input.chatGuid !== input.permissionChat || input.chatStyle !== 45) return false
  const owner = normalizePermissionHandle(input.permissionOwner)
  return input.participantHandles.some(handle => normalizePermissionHandle(handle) === owner)
}

type TrustedReplyInput = {
  isSelfChat: boolean
  isGroup: boolean
  service: string | null
  chatGuid: string
  senderHandle: string
  permissionChat?: string
  permissionOwner?: string
}

export function isTrustedPermissionReply(input: TrustedReplyInput): boolean {
  // SMS sender IDs are spoofable, even when the channel is explicitly opted
  // into SMS delivery. Permission authority remains iMessage-only.
  if (input.service !== 'iMessage') return false
  if (input.isSelfChat) return true
  if (input.isGroup || !input.permissionChat || !input.permissionOwner) return false
  return input.chatGuid === input.permissionChat &&
    normalizePermissionHandle(input.senderHandle) ===
      normalizePermissionHandle(input.permissionOwner)
}
