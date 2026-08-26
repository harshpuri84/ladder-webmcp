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

export function recordingProxy<T extends object>(root: T, hooks: RecorderHooks, path: string[] = []): T {
  return new Proxy(root, {
    get(target, prop, recv) {
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
      const before = Reflect.get(target, prop, recv);
      if (before === value) return true;
      if (hooks.guard?.({ entity, id, field }) === 'skip') return true;
      hooks.onWrite({ entity, id, field, before, after: value, group: groupKey(entity, id) });
      return Reflect.set(target, prop, value, recv);
    },
    deleteProperty(target, prop) {
      if (typeof prop === 'symbol' || path.length > 2) return Reflect.deleteProperty(target, prop);
      if (!(prop in target)) return true;
      const { entity, id, field } = locate(path, String(prop));
      const before = Reflect.get(target, prop);
      if (hooks.guard?.({ entity, id, field }) === 'skip') return true;
      hooks.onWrite({ entity, id, field, before, after: undefined, group: groupKey(entity, id) });
      return Reflect.deleteProperty(target, prop);
    },
  }) as T;
}
