export function globalAccessTracker<T extends object>(
    schemaObj: T,
    map: Map<unknown, Array<string | symbol>>,
    path: Array<string | symbol> = [],
    objectCache: WeakMap<WeakKey, object> = new WeakMap(),
    unfrozenCache: WeakMap<WeakKey, object> = new WeakMap(),
): T {
    if (Object.isFrozen(schemaObj)) {
        if (unfrozenCache.has(schemaObj)) {
            schemaObj = unfrozenCache.get(schemaObj) as T;
        } else {
            const unfrozenObject = Array.isArray(schemaObj)
                ? [...schemaObj] as T
                : { ...schemaObj };
            unfrozenCache.set(schemaObj, unfrozenObject);
            schemaObj = unfrozenObject;
        }
    }

    if (objectCache.has(schemaObj)) {
        const cachedProxy = objectCache.get(schemaObj) as any;
        return cachedProxy;
    }

    const proxy = new Proxy(
        schemaObj,
        {
            get(target, property, receiver) {
                const value = Reflect.get(target, property, receiver);
                if (typeof value === "object" && value !== null) {
                    return globalAccessTracker(
                        value,
                        map,
                        [...path, property],
                        objectCache,
                        unfrozenCache,
                    );
                } else {
                    return value;
                }
            },
        },
    );

    map.set(schemaObj, path);
    map.set(proxy, path);
    objectCache.set(schemaObj, proxy);
    objectCache.set(proxy, proxy);

    return proxy;
}
