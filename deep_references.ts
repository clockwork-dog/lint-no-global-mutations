export function collectDeepReferences(obj: unknown, refs = new Set<unknown>()) {
    if (typeof obj === "object" && obj !== null) {
        refs.add(obj);

        if (Array.isArray(obj)) {
            obj.forEach((child) => {
                if (!refs.has(child)) {
                    collectDeepReferences(child, refs);
                }
            });
        } else {
            Object.values(obj).forEach((child) => {
                if (!refs.has(child)) {
                    collectDeepReferences(child, refs);
                }
            });
        }
    }
    return refs;
}
