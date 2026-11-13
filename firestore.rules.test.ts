/**
 * MarketMind AI — Firestore Security Rules Specification & Verification Matrix
 * Documents the 12 Dirty Dozen adversarial payloads verified against firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  actorUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Cross-Tenant Business DNA Read',
    operation: 'get',
    path: '/users/founderA/business_dna/primary',
    actorUid: 'founderB',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Tenant Outcome Ledger Write',
    operation: 'create',
    path: '/users/founderA/outcome_ledger/dec_01',
    actorUid: 'founderB',
    emailVerified: true,
    payload: { ownerId: 'founderA', title: 'Hijacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Owner Spoofing on Own Path',
    operation: 'create',
    path: '/users/founderA/business_dna/primary',
    actorUid: 'founderA',
    emailVerified: true,
    payload: { ownerId: 'founderB', brandName: 'Spoofed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: '/users/founderA/business_dna/primary',
    actorUid: 'founderA',
    emailVerified: true,
    payload: { ownerId: 'founderA', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unverified Email Write Attempt',
    operation: 'create',
    path: '/users/founderA/business_dna/primary',
    actorUid: 'founderA',
    emailVerified: false,
    payload: { ownerId: 'founderA', brandName: 'Unverified Brand' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/users/founderA/outcome_ledger/dec_01',
    actorUid: 'founderA',
    emailVerified: true,
    payload: { ownerId: 'founderA', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Immutable Field Tampering on Update',
    operation: 'update',
    path: '/users/founderA/business_dna/primary',
    actorUid: 'founderA',
    emailVerified: true,
    payload: { ownerId: 'founderB' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Terminal State Mutation After Anonymized Publish',
    operation: 'update',
    path: '/users/founderA/outcome_ledger/dec_published',
    actorUid: 'founderA',
    emailVerified: true,
    payload: { status: 'Planned' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path Variable ID Poisoning (>128 chars)',
    operation: 'create',
    path: `/users/founderA/outcome_ledger/${'x'.repeat(200)}`,
    actorUid: 'founderA',
    emailVerified: true,
    payload: { ownerId: 'founderA' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Playbook Unbounded Steps Array (>6 items)',
    operation: 'create',
    path: '/shared_playbooks/pb_bad_steps',
    actorUid: 'founderA',
    emailVerified: true,
    payload: {
      authorUid: 'founderA',
      isAnonymized: true,
      implementationSteps: ['1', '2', '3', '4', '5', '6', '7'],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Non-Anonymized Playbook Injection',
    operation: 'create',
    path: '/shared_playbooks/pb_leak',
    actorUid: 'founderA',
    emailVerified: true,
    payload: { authorUid: 'founderA', isAnonymized: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket User Directory Enumeration',
    operation: 'list',
    path: '/users',
    actorUid: 'founderA',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
];
