export const pathToString = (path: string[]): string => {
    return path.map((segment) => {
        if (segment.match(/^\w+$/)) {
            return `.${segment}`;
        } else {
            return `["${segment}"]`;
        }
    }).join("").replace(/^\./, "");
};

export function collectDeepReferences(
    obj: unknown,
    refs = new Map<unknown, string>(),
    path: string[] = [],
) {
    if (typeof obj === "object" && obj !== null) {
        refs.set(obj, pathToString(path));

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
