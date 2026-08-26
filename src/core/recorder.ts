/**
 * Scope, by design: this recorder sees writes at depth 2 (entity.id.field) and the
 * structural writes at depth 1 and depth 0 (replacing a whole record or a whole entity).
 * It does not see, and cannot guard, a mutation inside a nested object one level past that
 * — a write like `db.rows.A.meta.limit = 999` reaches `meta` unrecorded, because nothing
 * traps property writes past depth 2. The guarantee this module makes — every write is
 * either previewed and approved, or refused — holds for stores whose record fields are
 * primitives or are replaced wholesale (`db.rows.A.meta = { limit: 999 }` is seen and
 * guarded normally). It does not hold for mutating inside a nested object field. A store
 * that needs guarded writes below that depth is out of scope for this recorder as it
 * stands, not silently supported.
 */
import type { RecorderHooks } from './types';
import { groupKey } from './types';

/**
 * Where a write landed. A set at depth 2 is an ordinary field write. A set at depth 1
 * replaces a whole record, and at depth 0 a whole entity — both are structural changes a
 * human must still see and approve, so they get a `*` in the slot they do not fill.
 */
function locate(path: string[], prop: string): { entity: string; id: string; field: string } {
  if (path.length === 2) return { entity: path[0], id: path[1], field: prop };
  if (path.length === 1) return { entity: path[0], id: prop, field: '*' };
  return { entity: prop, id: '*', field: '*' };
}

const RAW = Symbol('ladder.raw');

/** Returns the underlying object for a proxy this module created; anything else unchanged. */
function raw<T>(v: T): T {
  return (v && typeof v === 'object' && (v as Record<symbol, unknown>)[RAW] as T) || v;
}

export function recordingProxy<T extends object>(root: T, hooks: RecorderHooks, path: string[] = []): T {
  return new Proxy(root, {
    get(target, prop, recv) {
      if (prop === RAW) return target;
      const v = Reflect.get(target, prop, recv);
      if (typeof prop === 'symbol') return v;
      if (v && typeof v === 'object' && path.length < 2) {
        return recordingProxy(v as object, hooks, [...path, String(prop)]);
      }
      return v;
    },
    set(target, prop, value, recv) {
      if (typeof prop === 'symbol' || path.length > 2) {
        return Reflect.set(target, prop, value, recv);
      }
      const { entity, id, field } = locate(path, String(prop));
      const next = raw(value);
      const before = Reflect.get(target, prop, recv);
      if (before === next) return true;
      if (hooks.guard?.({ entity, id, field, after: next }) === 'skip') return true;
      hooks.onWrite({ entity, id, field, before, after: next, group: groupKey(entity, id) });
      return Reflect.set(target, prop, next, recv);
    },
    deleteProperty(target, prop) {
      if (typeof prop === 'symbol' || path.length > 2) return Reflect.deleteProperty(target, prop);
      if (!(prop in target)) return true;
      const { entity, id, field } = locate(path, String(prop));
      const before = Reflect.get(target, prop);
      if (hooks.guard?.({ entity, id, field, after: undefined }) === 'skip') return true;
      hooks.onWrite({ entity, id, field, before, after: undefined, group: groupKey(entity, id) });
      return Reflect.deleteProperty(target, prop);
    },
  }) as T;
}
