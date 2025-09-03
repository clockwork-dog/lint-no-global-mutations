export class Reference {
    constructor(possibilities: Iterable<unknown>) {
        for (const possibility of possibilities) {
            this._possibilities.push(possibility);
        }
    }

    private _possibilities: unknown[] = [];

    public get(key: string | symbol | number) {
        const possibilities: unknown[] = [];
        this._possibilities.forEach((poss) => {
            if (poss instanceof Object && poss !== null) {
                possibilities.push((poss as any)[key]);
            }
        });
        return new Reference(possibilities);
    }

    public get possibilities() {
        return [...this._possibilities];
    }
}
