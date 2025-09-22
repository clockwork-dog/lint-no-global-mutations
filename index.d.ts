declare global {
    interface Array<T> {
        filter(
            fn: typeof Boolean,
        ): Array<Exclude<T, null | undefined | 0 | "" | false>>;
    }
}

export {};
