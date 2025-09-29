const objectCache = new WeakMap<object, object>();
const unfrozenObjectCache = new WeakMap();

export function globalAccessTracker<T extends object>(
    schemaObj: T,
    map: Map<unknown, Array<string | symbol>>,
    path: Array<string | symbol> = [],
): T {
    if (Object.isFrozen(schemaObj)) {
        if (unfrozenObjectCache.has(schemaObj)) {
            schemaObj = unfrozenObjectCache.get(schemaObj) as T;
        } else {
            const unfrozenObject = Array.isArray(schemaObj)
                ? [...schemaObj] as T
                : { ...schemaObj };
            unfrozenObjectCache.set(schemaObj, unfrozenObject);
            schemaObj = unfrozenObject;
        }
    }

    if (objectCache.has(schemaObj)) {
        return objectCache.get(schemaObj) as T;
    }

    const proxy = new Proxy(schemaObj, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (typeof value === "object" && value !== null) {
                return globalAccessTracker(
                    value,
                    map,
                    [...path, property],
                );
            } else {
                return value;
            }
        },
    });

    map.set(schemaObj, path);
    map.set(proxy, path);
    objectCache.set(schemaObj, proxy);
    objectCache.set(proxy, proxy);

    return proxy;
}
