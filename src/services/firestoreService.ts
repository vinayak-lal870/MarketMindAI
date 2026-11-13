import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { SEED_SHARED_PLAYBOOKS } from '../data/seedData.ts';
import type {
  AnonymizedPlaybookDraft,
  BusinessDna,
  DecisionStatus,
  LanguageCode,
  OutcomeLedgerEntry,
  SharedPlaybook,
} from '../types.ts';

const DNA_DOC_ID = 'primary';

function clampNumber(val: number, min: number, max: number): number {
  const num = Number.isFinite(val) ? val : min;
  return Math.min(max, Math.max(min, num));
}

function sanitizeText(val: string | undefined, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

export async function ensureUserAccount(
  user: User,
  preferredLanguage: LanguageCode
): Promise<void> {
  if (!user.emailVerified) return;
  const userRef = doc(db, 'users', user.uid);
  const path = `users/${user.uid}`;
  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: sanitizeText(user.displayName || user.email?.split('@')[0] || 'Founder', 120),
        preferredLanguage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserPreferredLanguage(
  user: User,
  preferredLanguage: LanguageCode
): Promise<void> {
  if (!user.emailVerified) return;
  const userRef = doc(db, 'users', user.uid);
  const path = `users/${user.uid}`;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await updateDoc(userRef, {
        preferredLanguage,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeBusinessDna(
  uid: string,
  onData: (dna: BusinessDna | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/business_dna/${DNA_DOC_ID}`;
  const ref = doc(db, 'users', uid, 'business_dna', DNA_DOC_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as BusinessDna);
      } else {
        onData(null);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function saveBusinessDna(
  uid: string,
  dna: Omit<BusinessDna, 'ownerId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `users/${uid}/business_dna/${DNA_DOC_ID}`;
  const ref = doc(db, 'users', uid, 'business_dna', DNA_DOC_ID);
  try {
    const existingSnap = await getDoc(ref);
    const sanitizedFields = {
      brandName: sanitizeText(dna.brandName, 120) || 'My Brand',
      category: sanitizeText(dna.category, 100) || 'D2C Consumer Brand',
      productDescription: sanitizeText(dna.productDescription, 1200) || 'Core product offering',
      targetAudience: sanitizeText(dna.targetAudience, 600) || 'Indian urban & Tier-2 buyers',
      aovInr: clampNumber(dna.aovInr, 1, 10000000),
      grossMarginPct: clampNumber(dna.grossMarginPct, 1, 99),
      monthlyAdBudgetInr: clampNumber(dna.monthlyAdBudgetInr, 0, 100000000),
      competitorOne: sanitizeText(dna.competitorOne, 120),
      competitorTwo: sanitizeText(dna.competitorTwo, 120),
      preferredLanguage: dna.preferredLanguage,
      updatedAt: serverTimestamp(),
    };

    if (existingSnap.exists()) {
      await updateDoc(ref, sanitizedFields);
    } else {
      await setDoc(ref, {
        ownerId: uid,
        ...sanitizedFields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeOutcomeLedger(
  uid: string,
  onData: (entries: OutcomeLedgerEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/outcome_ledger`;
  const q = query(
    collection(db, 'users', uid, 'outcome_ledger'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: OutcomeLedgerEntry[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<OutcomeLedgerEntry, 'id'>),
        id: d.id,
      }));
      list.sort((a, b) => {
        const ta = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        const tb = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function addOutcomeLedgerEntry(
  uid: string,
  entry: Omit<OutcomeLedgerEntry, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${uid}/outcome_ledger/${id}`;
  const ref = doc(db, 'users', uid, 'outcome_ledger', id);
  try {
    await setDoc(ref, {
      ownerId: uid,
      title: sanitizeText(entry.title, 180) || 'Growth Decision',
      sourceType: entry.sourceType,
      angleCategory: sanitizeText(entry.angleCategory, 80),
      hypothesis: sanitizeText(entry.hypothesis, 1500) || 'Strategic growth hypothesis',
      actionPlan: sanitizeText(entry.actionPlan, 1500),
      status: entry.status,
      howImplemented: sanitizeText(entry.howImplemented, 2000),
      actualResult: sanitizeText(entry.actualResult, 300),
      sharedAnonymously: false,
      publishedPlaybookId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOutcomeLedgerProgress(
  uid: string,
  entryId: string,
  status: DecisionStatus,
  actionPlan: string
): Promise<void> {
  const path = `users/${uid}/outcome_ledger/${entryId}`;
  const ref = doc(db, 'users', uid, 'outcome_ledger', entryId);
  try {
    await updateDoc(ref, {
      status,
      actionPlan: sanitizeText(actionPlan, 1500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recordOutcomeAndOptionallyPublish(
  uid: string,
  entryId: string,
  params: {
    howImplemented: string;
    actualResult: string;
    shareAnonymously: boolean;
    anonymizedDraft?: AnonymizedPlaybookDraft;
  }
): Promise<string> {
  const entryPath = `users/${uid}/outcome_ledger/${entryId}`;
  const entryRef = doc(db, 'users', uid, 'outcome_ledger', entryId);

  try {
    const batch = writeBatch(db);
    let publishedPlaybookId = '';

    if (params.shareAnonymously && params.anonymizedDraft) {
      publishedPlaybookId = `pb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const pbRef = doc(db, 'shared_playbooks', publishedPlaybookId);
      const cleanSteps = params.anonymizedDraft.implementationSteps
        .slice(0, 6)
        .map((s) => sanitizeText(s, 300))
        .filter(Boolean);

      batch.set(pbRef, {
        authorUid: uid,
        isAnonymized: true,
        category: sanitizeText(params.anonymizedDraft.category, 100) || 'D2C Consumer Brand',
        priceTier: params.anonymizedDraft.priceTier,
        strategySummary: sanitizeText(params.anonymizedDraft.strategySummary, 450),
        implementationSteps:
          cleanSteps.length > 0
            ? cleanSteps
            : [sanitizeText(params.howImplemented, 300) || 'Executed growth experiment'],
        verifiedResult: sanitizeText(params.anonymizedDraft.verifiedResult, 180),
        channel: sanitizeText(params.anonymizedDraft.channel, 100) || 'D2C Direct',
        createdAt: serverTimestamp(),
      });
    }

    batch.update(entryRef, {
      status: 'Succeeded',
      howImplemented: sanitizeText(params.howImplemented, 2000),
      actualResult: sanitizeText(params.actualResult, 300),
      sharedAnonymously: params.shareAnonymously,
      publishedPlaybookId,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return publishedPlaybookId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, entryPath);
  }
}

export async function deleteOutcomeLedgerEntry(uid: string, entryId: string): Promise<void> {
  const path = `users/${uid}/outcome_ledger/${entryId}`;
  const ref = doc(db, 'users', uid, 'outcome_ledger', entryId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeSharedPlaybooks(
  onData: (playbooks: SharedPlaybook[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'shared_playbooks';
  const q = query(
    collection(db, 'shared_playbooks'),
    where('isAnonymized', '==', true)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SharedPlaybook[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<SharedPlaybook, 'id'>),
        id: d.id,
      }));
      items.sort((a, b) => {
        const ta = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        const tb = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e as Error);
      }
    }
  );
}

export async function seedSharedPlaybooksIfEmpty(user: User): Promise<void> {
  if (!user.emailVerified) return;
  const path = 'shared_playbooks';
  try {
    const q = query(
      collection(db, 'shared_playbooks'),
      where('isAnonymized', '==', true)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const batch = writeBatch(db);
    for (const seed of SEED_SHARED_PLAYBOOKS) {
      const ref = doc(db, 'shared_playbooks', seed.id);
      batch.set(ref, {
        authorUid: user.uid,
        isAnonymized: true,
        category: seed.category,
        priceTier: seed.priceTier,
        strategySummary: seed.strategySummary,
        implementationSteps: seed.implementationSteps,
        verifiedResult: seed.verifiedResult,
        channel: seed.channel,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    // Non-fatal if another concurrent user seeded simultaneously, but still log structured info
    console.warn('Shared playbooks seed notice:', error);
  }
}
