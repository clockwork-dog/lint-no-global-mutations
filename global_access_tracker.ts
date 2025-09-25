export function globalAccessTracker<T extends object>(
    schemaObj: T,
    map: Map<unknown, Array<string | symbol>>,
    path: Array<string | symbol> = [],
): T {
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

    return proxy;
}
