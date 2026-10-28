import { buildUndoPayload, splitRelations } from './undo-payload.util';

const none = { scalars: null, relations: {} };
const row = (scalars: Record<string, unknown>, relations = {}) => ({ scalars, relations });

describe('buildUndoPayload', () => {
  it('undoes a create by deleting the row', () => {
    const payload = buildUndoPayload('reminder', 'created', none, row({ uuid: 'r1', title: 'a' }));
    expect(payload).toEqual({ kind: 'delete' });
  });

  it('undoes a delete by keeping the full row, including id-less columns and relations', () => {
    const before = row(
      { uuid: 'r1', title: 'a', remind_at: new Date('2030-01-01T00:00:00Z') },
      { assignees: [{ user_uuid: 'u1' }] },
    );
    const payload = buildUndoPayload('reminder', 'deleted', before, none);
    expect(payload?.kind).toBe('restore');
    expect(payload?.snapshot).toMatchObject({ uuid: 'r1', remind_at: '2030-01-01T00:00:00.000Z' });
    expect(payload?.relations).toEqual({ assignees: [{ user_uuid: 'u1' }] });
  });

  it('undoes an edit with only the changed columns and what they became', () => {
    const payload = buildUndoPayload(
      'reminder',
      'updated',
      row({ uuid: 'r1', title: 'a', notes: 'n', updated_at: 1 }),
      row({ uuid: 'r1', title: 'b', notes: 'n', updated_at: 2 }),
    );
    expect(payload).toEqual({ kind: 'revert', values: { title: 'a' }, expected: { title: 'b' } });
  });

  it('skips an edit that changed nothing', () => {
    const same = row({ uuid: 'r1', title: 'a' });
    expect(buildUndoPayload('reminder', 'updated', same, same)).toBeUndefined();
  });

  it('skips actions with outside effects and entities holding credentials', () => {
    expect(buildUndoPayload('outreach_message', 'sent', row({ a: 1 }), row({ a: 2 }))).toBeUndefined();
    expect(buildUndoPayload('api_key', 'deleted', row({ a: 1 }), none)).toBeUndefined();
  });

  it('skips snapshots too large to keep in the log', () => {
    const big = row({ uuid: 'r1', body: 'x'.repeat(200_000) });
    expect(buildUndoPayload('message_template', 'deleted', big, none)).toBeUndefined();
  });
});

describe('splitRelations', () => {
  it('moves configured relation keys out of the scalar columns', () => {
    const { scalars, relations } = splitRelations('reminder', { uuid: 'r1', assignees: [] });
    expect(scalars).toEqual({ uuid: 'r1' });
    expect(relations).toEqual({ assignees: [] });
  });
});
