import { describe, expect, it } from 'vitest';
import {
  DRAFTS_STORAGE_KEY,
  MAX_DRAFTS,
  MAX_STORED_CHARS,
  deleteDraft,
  getDraft,
  listDrafts,
  saveDraft,
  type DraftStorage,
} from './drafts';

class FakeStorage implements DraftStorage {
  data = new Map<string, string>();
  failGet: Error | null = null;
  failSet: Error | null = null;
  getItem(key: string): string | null {
    if (this.failGet) throw this.failGet;
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failSet) throw this.failSet;
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const quotaError = () => Object.assign(new Error('full'), { name: 'QuotaExceededError' });
const fixedNow = (iso: string) => () => new Date(iso);
const input = {
  title: 'Team Friday',
  startsAtLocal: '2026-10-23T15:00',
  timeZone: 'Europe/London',
  durationMinutes: 45,
  expectedParticipants: 20,
  meetingUrl: '',
  activities: [{ slug: 'trivia-rush', minutes: 12 }],
};

describe('drafts storage', () => {
  it('lists nothing from an empty store', () => {
    expect(listDrafts(new FakeStorage())).toEqual({ ok: true, items: [] });
  });

  it('saves a new draft with id and updatedAt and lists it back', () => {
    const storage = new FakeStorage();
    const saved = saveDraft(input, {
      storage,
      newId: () => 'id-1',
      now: fixedNow('2026-10-01T10:00:00.000Z'),
    });
    expect(saved).toEqual({
      ok: true,
      draft: { ...input, id: 'id-1', updatedAt: '2026-10-01T10:00:00.000Z' },
    });
    const stored = JSON.parse(storage.data.get(DRAFTS_STORAGE_KEY) ?? '{}') as { version: number };
    expect(stored.version).toBe(1);
    const list = listDrafts(storage);
    expect(list).toMatchObject({ ok: true, items: [{ kind: 'draft', draft: { id: 'id-1' } }] });
  });

  it('updates in place by id without duplicating', () => {
    const storage = new FakeStorage();
    saveDraft(input, { storage, newId: () => 'a', now: fixedNow('2026-10-01T10:00:00.000Z') });
    saveDraft(
      { ...input, title: 'Renamed' },
      { storage, id: 'a', now: fixedNow('2026-10-02T10:00:00.000Z') },
    );
    const list = listDrafts(storage);
    expect(list.ok && list.items).toHaveLength(1);
    expect(getDraft('a', storage)).toMatchObject({
      ok: true,
      item: { kind: 'draft', draft: { title: 'Renamed', updatedAt: '2026-10-02T10:00:00.000Z' } },
    });
  });

  it('accepts partial drafts', () => {
    const storage = new FakeStorage();
    const saved = saveDraft({ title: 'Half done' }, { storage, newId: () => 'p' });
    expect(saved.ok).toBe(true);
    expect(listDrafts(storage)).toMatchObject({ ok: true, items: [{ kind: 'draft' }] });
  });

  it('getDraft returns null item for an unknown id', () => {
    expect(getDraft('missing', new FakeStorage())).toEqual({ ok: true, item: null });
  });

  it('deletes only the requested draft', () => {
    const storage = new FakeStorage();
    saveDraft(input, { storage, newId: () => 'a' });
    saveDraft(input, { storage, newId: () => 'b' });
    expect(deleteDraft('a', storage)).toEqual({ ok: true });
    const list = listDrafts(storage);
    expect(list.ok && list.items.map((i) => (i.kind === 'draft' ? i.draft.id : i.id))).toEqual([
      'b',
    ]);
  });

  it('flags one corrupt entry without breaking the others, and can delete it', () => {
    const storage = new FakeStorage();
    saveDraft(input, { storage, newId: () => 'good' });
    const envelope = JSON.parse(storage.data.get(DRAFTS_STORAGE_KEY) ?? '') as {
      drafts: unknown[];
    };
    envelope.drafts.push({ id: 'bad', updatedAt: 'yesterday', title: 42 }, 'junk', null);
    storage.data.set(DRAFTS_STORAGE_KEY, JSON.stringify(envelope));

    const list = listDrafts(storage);
    expect(list.ok && list.items.map((i) => i.kind)).toEqual([
      'draft',
      'corrupt',
      'corrupt',
      'corrupt',
    ]);
    expect(list.ok && list.items[1]).toEqual({ kind: 'corrupt', id: 'bad' });

    expect(deleteDraft('bad', storage)).toEqual({ ok: true });
    expect(deleteDraft('corrupt-1', storage)).toEqual({ ok: true });
    const after = listDrafts(storage);
    expect(after.ok && after.items.map((i) => i.kind)).toEqual(['draft', 'corrupt']);
  });

  it('reports a corrupt envelope (bad JSON, wrong version, wrong shape)', () => {
    const storage = new FakeStorage();
    for (const value of [
      '{nope',
      JSON.stringify({ version: 2, drafts: [] }),
      JSON.stringify([1]),
    ]) {
      storage.data.set(DRAFTS_STORAGE_KEY, value);
      expect(listDrafts(storage)).toEqual({ ok: false, reason: 'corrupt' });
    }
  });

  it('replaces an unreadable envelope on save', () => {
    const storage = new FakeStorage();
    storage.data.set(DRAFTS_STORAGE_KEY, '{nope');
    expect(saveDraft(input, { storage, newId: () => 'fresh' }).ok).toBe(true);
    expect(listDrafts(storage)).toMatchObject({ ok: true, items: [{ kind: 'draft' }] });
  });

  it('reports unavailable when storage is null or throws on read', () => {
    expect(listDrafts(null)).toEqual({ ok: false, reason: 'unavailable' });
    const storage = new FakeStorage();
    storage.failGet = new Error('SecurityError');
    expect(listDrafts(storage)).toEqual({ ok: false, reason: 'unavailable' });
    expect(saveDraft(input, { storage })).toEqual({ ok: false, reason: 'unavailable' });
    expect(saveDraft(input, { storage: null })).toEqual({ ok: false, reason: 'unavailable' });
    expect(deleteDraft('x', storage)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports quota errors on save and delete without losing the stored data', () => {
    const storage = new FakeStorage();
    saveDraft(input, { storage, newId: () => 'a' });
    storage.failSet = quotaError();
    expect(saveDraft(input, { storage, newId: () => 'b' })).toEqual({ ok: false, reason: 'quota' });
    expect(deleteDraft('a', storage)).toEqual({ ok: false, reason: 'quota' });
    storage.failSet = null;
    const list = listDrafts(storage);
    expect(list.ok && list.items).toHaveLength(1);
  });

  it('reports other write failures as unavailable', () => {
    const storage = new FakeStorage();
    storage.failSet = new Error('SecurityError');
    expect(saveDraft(input, { storage })).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('never lets a non-https meeting URL survive a load (javascript:, data:, http:)', () => {
    const storage = new FakeStorage();
    saveDraft(input, { storage, newId: () => 'a' });
    const envelope = JSON.parse(storage.data.get(DRAFTS_STORAGE_KEY) ?? '') as {
      drafts: Array<Record<string, unknown>>;
    };
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'http://example.com',
      'not a url',
    ]) {
      envelope.drafts[0] = { ...(envelope.drafts[0] ?? {}), meetingUrl: bad };
      storage.data.set(DRAFTS_STORAGE_KEY, JSON.stringify(envelope));
      const got = getDraft('a', storage);
      expect(got.ok && got.item?.kind === 'draft' && got.item.draft.meetingUrl, bad).toBe('');
    }
    envelope.drafts[0] = {
      ...(envelope.drafts[0] ?? {}),
      meetingUrl: 'https://meet.example.com/x',
    };
    storage.data.set(DRAFTS_STORAGE_KEY, JSON.stringify(envelope));
    const ok = getDraft('a', storage);
    expect(ok.ok && ok.item?.kind === 'draft' && ok.item.draft.meetingUrl).toBe(
      'https://meet.example.com/x',
    );
  });

  it('clamps over-long title and URL on read', () => {
    const storage = new FakeStorage();
    saveDraft(input, { storage, newId: () => 'a' });
    const envelope = JSON.parse(storage.data.get(DRAFTS_STORAGE_KEY) ?? '') as {
      drafts: Array<Record<string, unknown>>;
    };
    envelope.drafts[0] = {
      ...(envelope.drafts[0] ?? {}),
      title: 'x'.repeat(500),
      meetingUrl: 'https://a.example.com/' + 'y'.repeat(5000),
    };
    storage.data.set(DRAFTS_STORAGE_KEY, JSON.stringify(envelope));
    const got = getDraft('a', storage);
    const draft = got.ok && got.item?.kind === 'draft' ? got.item.draft : null;
    expect(draft?.title?.length).toBe(80);
    expect(draft?.meetingUrl?.length).toBeLessThanOrEqual(2048);
  });

  it('treats oversized stored text as a storage error and replaces it on save', () => {
    const storage = new FakeStorage();
    storage.data.set(DRAFTS_STORAGE_KEY, 'x'.repeat(MAX_STORED_CHARS + 1));
    expect(listDrafts(storage)).toEqual({ ok: false, reason: 'too_large' });
    expect(saveDraft(input, { storage, newId: () => 'fresh' }).ok).toBe(true);
    expect(listDrafts(storage)).toMatchObject({ ok: true, items: [{ kind: 'draft' }] });
  });

  it('caps the draft count: reads at most 50 and refuses a 51st', () => {
    const storage = new FakeStorage();
    for (let i = 0; i < MAX_DRAFTS; i++) {
      expect(saveDraft(input, { storage, newId: () => `d${i}` }).ok).toBe(true);
    }
    expect(saveDraft(input, { storage, newId: () => 'extra' })).toEqual({
      ok: false,
      reason: 'limit',
    });
    // updating an existing one is still fine
    expect(saveDraft(input, { storage, id: 'd3' }).ok).toBe(true);
    const envelope = JSON.parse(storage.data.get(DRAFTS_STORAGE_KEY) ?? '') as {
      drafts: unknown[];
    };
    envelope.drafts.push(
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `z${i}`,
        updatedAt: '2026-01-01T00:00:00.000Z',
      })),
    );
    storage.data.set(DRAFTS_STORAGE_KEY, JSON.stringify(envelope));
    const list = listDrafts(storage);
    expect(list.ok && list.items.length).toBe(MAX_DRAFTS);
  });

  it('rejects activity lists longer than the contract maximum as corrupt', () => {
    const storage = new FakeStorage();
    const many = Array.from({ length: 9 }, (_, i) => ({ slug: `a${i}`, minutes: 5 }));
    storage.data.set(
      DRAFTS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        drafts: [{ id: 'x', updatedAt: '2026-01-01T00:00:00.000Z', activities: many }],
      }),
    );
    expect(listDrafts(storage)).toEqual({ ok: true, items: [{ kind: 'corrupt', id: 'x' }] });
  });
});
