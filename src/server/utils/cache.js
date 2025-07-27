class Cache {
    constructor() {
        this.cache = new Map();
    }

    async get(key, fetchFn) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const data = await fetchFn();
        this.cache.set(key, data);
        return data;
    }

    set(key, value) {
        this.cache.set(key, value);
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }
}

export const cache = new Cache(); 