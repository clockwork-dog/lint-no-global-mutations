import { ANY_STRING } from "./util.ts";

export type Primitive = boolean | number | string;
export type PossiblePrimitive = Array<Primitive>;
export type PossibleObj = {
    [key: string]: Array<
        Primitive | PossibleArray | PossibleObj
    >;
} & {
    [ANY_STRING]?: Array<
        Primitive | PossibleArray | PossibleObj
    >;
};

export type PossibleArray = Array<Primitive | PossibleObj | PossibleArray>;

const isPrimitive = (x: unknown): x is Primitive => {
    switch (typeof x) {
        case "boolean":
        case "number":
        case "string":
            return true;
        default:
            return false;
    }
};
export type ReferenceMap = Map<PossibleArray | PossibleObj, unknown>;
export function objectToPossibleReferences(
    x: unknown,
    map: ReferenceMap = new Map(),
): [PossibleArray, ReferenceMap] {
    if (isPrimitive(x)) {
        return [[x], map];
    }

    if (Array.isArray(x)) {
        const mapped = x.flatMap((elem) =>
            objectToPossibleReferences(elem, map)[0]
        ) as PossibleArray;
        map.set(mapped, x);
        return [[mapped], map];
    }

    if (typeof x === "object" && x !== null) {
        const mappedObj: PossibleObj = Object.fromEntries(
            Object.entries(x).map((
                [key, value],
            ) => [key, objectToPossibleReferences(value, map)[0]]),
        );
        // Symbols are not enumerated
        if (ANY_STRING in x) {
            mappedObj[ANY_STRING] = objectToPossibleReferences(
                x[ANY_STRING],
                map,
            )[0];
        }
        map.set(mappedObj, x);
        return [[mappedObj], map];
    }

    throw new Error();
}
