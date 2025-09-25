export const pathToString = (path: Array<string | Symbol>): string => {
    return path.map((segment) => {
        if (String(segment).match(/^\w+$/)) {
            return `.${segment}`;
        } else {
            return `["${segment}"]`;
        }
    }).join("").replace(/^\./, "");
};

export function collectDeepReferences(
    obj: unknown,
    refs = new Map<unknown, Array<string | Symbol>>(),
    path: Array<string | Symbol> = [],
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
