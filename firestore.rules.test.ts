/**
 * Adversarial Security Test Runner Specification for Firestore Rules
 * Verifies that all "Dirty Dozen" payloads defined in security_spec.md
 * are rejected with PERMISSION_DENIED.
 */

export interface SimulatedRuleContext {
  auth: {
    uid: string;
    token: {
      email?: string;
      email_verified?: boolean;
    };
  } | null;
  requestTimeIso: string;
  existingData?: Record<string, unknown> | null;
  incomingData?: Record<string, unknown> | null;
}

export const DIRTY_DOZEN_TEST_CASES = [
  {
    id: 1,
    name: 'Identity Spoofing on Order Create',
    path: '/orders/NK-1001',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Storefront',
    path: '/storefront/main',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Admin Spoof',
    path: '/storefront/main',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'PII Blanket Read Attack on Orders',
    path: '/orders/NK-1024',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'ID Poisoning via Oversized Path Variable',
    path: '/orders/' + 'A'.repeat(200) + '$$$',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Value Poisoning on Status Enum',
    path: '/orders/NK-1001',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Terminal State Mutation After Delivered',
    path: '/orders/NK-1001',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field (ownerId / createdAt) Mutation',
    path: '/orders/NK-1001',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Temporal Integrity Timestamp Forgery',
    path: '/orders/NK-1001',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Self-Assigned Admin Privilege Escalation',
    path: '/admins/user_evil',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unbounded String Denial-of-Wallet',
    path: '/orders/NK-1001',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Non-Admin Storefront Rate Tampering',
    path: '/storefront/main',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
] as const;
