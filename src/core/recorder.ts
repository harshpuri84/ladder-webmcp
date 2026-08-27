/**
 * Scope, by design: this recorder sees writes at depth 2 (entity.id.field) and the
 * structural writes at depth 1 and depth 0 (replacing a whole record or a whole entity).
 * It cannot see a mutation *inside* a nested object one level past that — a write like
 * `db.rows.A.meta.limit = 999` reaches `meta` without ever passing a trap that could record
 * it. So it refuses that write instead of performing it: everything read at depth 2 that is
 * itself an object is handed back as a read-only view, which passes every read through
 * untouched and throws on any write, naming the full path. The guarantee this module makes —
 * every write is either previewed and approved, or refused — therefore holds either way.
 * Record fields that are primitives or are replaced wholesale (`db.rows.A.meta = { limit: 999 }`)
 * are seen and guarded normally. A store that needs *recorded* writes below that depth is
 * still out of scope for this recorder as it stands; it just fails loudly there rather than
 * succeeding silently.
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

/**
 * Strips the read-only views handed out below depth 2 out of a value on its way into the
 * store, at any depth. Without this, an ordinary wholesale replacement assembled from values
 * read back out of the store — `s.meta = { ...s.meta, tags: s.meta.tags.map(f) }` — would
 * plant live proxies in real state, and the next `structuredClone` of that state (every
 * preview and every commit starts with one) would throw DataCloneError.
 *
 * A container is rebuilt only when it actually holds a view, so a value written back
 * unchanged keeps its identity and still compares equal to what is already there.
 */
function inert<T>(v: T): T {
  const target = raw(v) as unknown;
  if (!target || typeof target !== 'object') return target as T;
  // One of ours: its target is real store data, which never contains a view.
  if (target !== (v as unknown)) return target as T;
  if (Array.isArray(target)) {
    const out = target.map(item => inert(item));
    return (out.some((item, i) => item !== target[i]) ? out : target) as T;
  }
  // Anything with a prototype of its own (a class instance, a Date, a Map) is left alone
  // rather than flattened into a plain object.
  if (Object.getPrototypeOf(target) !== Object.prototype) return target as T;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(target as Record<string, unknown>)) {
    const next = inert(val);
    if (next !== val) changed = true;
    out[k] = next;
  }
  return (changed ? out : target) as T;
}

function refuse(path: string[], prop: string | symbol): never {
  const full = [...path, String(prop)].join('.');
  throw new Error(
    `write below the recorded depth refused: ${full}. This recorder records writes at ` +
    `depth 2 (entity.id.field), so a mutation inside a nested object field is never ` +
    `previewed, never approved and never rolled back — it is refused rather than applied ` +
    `unseen. Replace the whole field instead: ${path.slice(0, 3).join('.')} = { ... }.`,
  );
}

/**
 * A read-only view of an object living below the recorded depth. Reads pass straight through
 * (nested objects come back as views of their own, so the refusal reaches all the way down);
 * every write throws. It answers to RAW like the recording proxy does, so a view read out and
 * written straight back is unwrapped rather than stored.
 */
function readOnlyBelow<T extends object>(target: T, path: string[]): T {
  return new Proxy(target, {
    get(t, prop, recv) {
      if (prop === RAW) return t;
      const v = Reflect.get(t, prop, recv);
      if (typeof prop === 'symbol') return v;
      if (v && typeof v === 'object') return readOnlyBelow(v as object, [...path, String(prop)]);
      return v;
    },
    set(_t, prop) { refuse(path, prop); },
    deleteProperty(_t, prop) { refuse(path, prop); },
    defineProperty(_t, prop) { refuse(path, prop); },
  }) as T;
}

export function recordingProxy<T extends object>(root: T, hooks: RecorderHooks, path: string[] = []): T {
  return new Proxy(root, {
    get(target, prop, recv) {
      if (prop === RAW) return target;
      const v = Reflect.get(target, prop, recv);
      if (typeof prop === 'symbol') return v;
      if (v && typeof v === 'object') {
        return path.length < 2
          ? recordingProxy(v as object, hooks, [...path, String(prop)])
          : readOnlyBelow(v as object, [...path, String(prop)]);
      }
      return v;
    },
    set(target, prop, value, recv) {
      if (typeof prop === 'symbol' || path.length > 2) {
        return Reflect.set(target, prop, value, recv);
      }
      const { entity, id, field } = locate(path, String(prop));
      const next = inert(value);
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
