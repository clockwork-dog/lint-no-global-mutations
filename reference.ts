import { getAllProperties } from "./get_possible_references.ts";
import { ANY_STRING, isInteger } from "./util.ts";

export class Reference {
    constructor(possibilities: Iterable<unknown> = []) {
        for (const possibility of possibilities) {
            this._possibilities.add(possibility);
        }
    }

    private _possibilities: Set<unknown> = new Set();

    get() {
        return Reference.unwrap(this);
    }

    public getKey(key: string | symbol | number) {
        const possibilities: unknown[] = [];
        for (const poss of this.get()) {
            if (poss instanceof Object) {
                if (Array.isArray(poss) && isInteger(key)) {
                    possibilities.push(...poss);
                } else if (key === ANY_STRING) {
                    for (const prop of getAllProperties(poss)) {
                        try {
                            possibilities.push((poss as any)[prop]);
                        } catch (_e) {
                            // strict mode throws when accessing Function.callee/caller/arguments
                        }
                    }
                } else {
                    possibilities.push((poss as any)[key]);
                    if (ANY_STRING in poss) {
                        possibilities.push((poss as any)[ANY_STRING]);
                    }
                }
            }
        }

        return new Reference(possibilities);
    }

    set(value: unknown) {
        const possibilities = this.get();
        this._possibilities = new Set([...possibilities, value]);
    }
    public setKey(key: string | symbol | number, value: unknown) {
        const possibilities: Set<unknown> = new Set();
        for (const poss of this.get()) {
            if (Array.isArray(poss)) {
                poss.push(value);
            } else if (typeof poss === "object" && poss !== null) {
                (poss as any)[key] = new Reference([
                    (poss as any)[key],
                    value,
                ]);
            }
            possibilities.add(poss);
        }
        this._possibilities = possibilities;
    }

    private static unwrap(value: unknown): unknown[] {
        const possibilities = [];
        if (value instanceof Reference) {
            value._possibilities.forEach((p) =>
                possibilities.push(...Reference.unwrap(p))
            );
        } else {
            possibilities.push(value);
        }
        return possibilities;
    }
}
