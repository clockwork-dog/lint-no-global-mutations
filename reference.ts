import { ANY_STRING } from "./util.ts";

export class Reference {
    constructor(possibilities: Iterable<unknown> = []) {
        for (const possibility of possibilities) {
            this._possibilities.push(possibility);
        }
    }

    private _possibilities: unknown[] = [];

    public get(key: string | symbol | number) {
        const possibilities: unknown[] = [];

        for (const poss of this.unwrap()) {
            if (poss instanceof Object && poss !== null) {
                possibilities.push((poss as any)[key]);
                if (ANY_STRING in poss) {
                    possibilities.push((poss as any)[ANY_STRING]);
                }
            }
        }

        return new Reference(possibilities);
    }

    unwrap() {
        return Reference.unwrap(this);
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
