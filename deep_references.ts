export const pathToString = (path: Array<string | symbol>): string => {
    return path.map((segment) => {
        if (String(segment).match(/^\w+$/)) {
            return `.${String(segment)}`;
        } else {
            return `["${String(segment)}"]`;
        }
    }).join("").replace(/^\./, "");
};

export function collectDeepReferences(
    obj: unknown,
    refs = new Map<unknown, Array<string | symbol>>(),
    path: Array<string | symbol> = [],
) {
    if (typeof obj === "object" && obj !== null) {
        refs.set(obj, path);

        if (Array.isArray(obj)) {
            obj.forEach((child, index) => {
                if (!refs.has(child)) {
                    collectDeepReferences(child, refs, [
                        ...path,
                        String(index),
                    ]);
                }
            });
        } else {
            Object.entries(obj).forEach(([key, child]) => {
                if (!refs.has(child)) {
                    collectDeepReferences(child, refs, [...path, key]);
                }
            });
        }
    }
    return refs;
}
