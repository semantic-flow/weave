// this file was borrowed from Lume

const reactElement = Symbol.for("react.element");
const objectConstructor = {}.constructor;

/** TypeScript helper to create optional properties recursively */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
}
  : T;

/** Check if the argument passed is a plain object */
export function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null &&
    obj.constructor === objectConstructor &&
    // @ts-ignore: Check if the argument passed is a React element
    obj["$$typeof"] !== reactElement &&
    // @ts-ignore: Check if the argument passed is a Page.data object
    obj !== obj.page?.data;
}

/**
 * Merge two objects recursively.
 * It's used to merge user options with default options.
 */
export function merge<Type>(
  defaults: Type,
  user?: Type,
): Required<Type> {
  const merged = { ...defaults };

  if (!user) {
    return merged as unknown as Required<Type>;
  }

  for (const [key, value] of Object.entries(user)) {
    if (value === undefined) {
      continue;
    }

    // @ts-ignore: No index signature with a parameter of type 'string' was found on type 'unknown'
    if (isPlainObject(merged[key]) && isPlainObject(value)) {
      // @ts-ignore: Type 'string' cannot be used to index type 'Type'
      merged[key] = merge(merged[key], value);
      continue;
    }

    // @ts-ignore: Type 'string' cannot be used to index type 'Type'
    merged[key] = value;
  }

  return merged as unknown as Required<Type>;
}

/**
 * Merge two objects recursively.
 * It's like merge() but it mutates the first value.
 */
export function assign<Type>(
  target: Type,
  override?: Type,
) {
  if (!override) {
    return;
  }

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }

    // @ts-ignore: No index signature with a parameter of type 'string' was found on type 'unknown'
    if (isPlainObject(target[key]) && isPlainObject(value)) {
      // @ts-ignore: Type 'string' cannot be used to index type 'Type'
      target[key] = { ...target[key] };
      // @ts-ignore: Type 'string' cannot be used to index type 'Type'
      assign(target[key], value);
      continue;
    }

    // @ts-ignore: Type 'string' cannot be used to index type 'Type'
    target[key] = value;
  }
}
