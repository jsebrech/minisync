import { FileData, FileHandle, Store } from "./types";

declare var openDatabase: any;

const objectStore1 = "files";

interface IndexedDBFileWrapper {
    name: string;
    path: string;
    file: FileData;
}

function request2promise<T>(req: IDBRequest, tr: IDBTransaction = null): Promise<T> {
    let result: T;
    return new Promise((resolve, reject) => {
        req.onerror = (e: any) => {
            // prevent global error throw https://bugzilla.mozilla.org/show_bug.cgi?id=872873
            if (typeof e.preventDefault === "function") e.preventDefault();
            reject(e.target.error);
        };
        req.onsuccess = (e: any) => {
            result = e.target.result;
            if (!tr) resolve(result);
        };
        if (tr) tr.oncomplete = () => resolve(result);
    });
}

export class IndexedDBStore implements Store {

    /**
     * Return a handle to the indexeddb factory object
     */
    private static getIDB(): IDBFactory {
        try {
            if (typeof indexedDB !== "undefined") return indexedDB;
        } catch (e) { /* ignore */ }
        return undefined;
    }

    /**
     * Return true if indexeddb can be used on this machine
     * @see https://github.com/localForage/localForage/blob/master/src/utils/isIndexedDBValid.js
     */
    private static canUseIDB(): boolean {
        if (!this.getIDB()) return false;

        // IE mobile advertises itself as safari, test for openDatabase to check for real safari
        const isSafari = typeof openDatabase !== "undefined" &&
            /(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent) &&
            !/Chrome/.test(navigator.userAgent) &&
            !/BlackBerry/.test(navigator.platform);

        const hasFetch = typeof fetch === "function" &&
            fetch.toString().indexOf("[native code") !== -1;

        // Safari <10.1 has many IDB issues
        // 10.1 shipped with fetch, use to detect it
        return (!isSafari || hasFetch) &&
            // some outdated implementations of IDB that appear on Samsung
            // and HTC Android devices <4.4 are missing IDBKeyRange
            typeof IDBKeyRange !== "undefined";
    }

    private db: IDBDatabase;

    /** database with name prefix will be used */
    constructor(readonly prefix: string = "minisync") {
        if (!IndexedDBStore.canUseIDB()) throw new Error("IndexedDB not supported here");
    }

    public getFile(file: FileHandle): Promise<FileData> {
        return this.openDB().then((db) => {
            return request2promise(db.transaction(objectStore1)
                .objectStore(objectStore1)
                .get(this.handleToKey(file))
            ).then((s: IndexedDBFileWrapper) => s.file);
        });
    }

    public putFile(file: FileData): Promise<boolean> {
        return this.openDB().then((db) => {
            return request2promise(db.transaction(objectStore1, "readwrite")
                .objectStore(objectStore1)
                .put({
                    name: file.fileName,
                    path: file.path.join("/"),
                    file
                }, this.handleToKey(file))
            ).then((s: any) => true);
        });
    }

    public listFiles(path: string[]): Promise<FileHandle[]> {
        return this.openDB().then((db) => {
            return db.transaction(objectStore1)
                .objectStore(objectStore1)
                .index("path");
        }).then((index: IDBIndex) => {
            return new Promise<FileHandle[]>((resolve, reject) => {
                const pathStr = path.join("/");
                const results: FileHandle[] = [];
                const req = index.openKeyCursor(IDBKeyRange.only(pathStr));
                req.onsuccess = (e: any) => {
                    const cursor: any = e.target.result;
                    if (cursor) {
                        results.push({
                            path,
                            fileName: cursor.key.substr(pathStr.length + 1)
                        });
                        // will fire onsuccess again for next match
                        cursor.continue();
                    } else {
                        // no more entries, search is done
                        resolve(results);
                    }
                };
                req.onerror = (e: any) => {
                    resolve(results);
                };
            });
        });
    }

    public openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
            } else {
                // initial db version is 1, request upgrade to version 2 to create the object store
                const req = IndexedDBStore.getIDB().open(this.prefix, 1);
                req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
                    if (e.newVersion === 1) {
                        const db = req.result;
                        const store = db.createObjectStore(objectStore1);
                        store.createIndex("path", "path", { unique: false });
                    }
                };
                req.onsuccess = (e: any) => {
                    this.db = e.target.result;
                    resolve(this.db);
                };
                req.onerror = (e: any) => {
                    reject(e);
                };
            }
        });
    }

    // Convert a FileHandle to an IndexedDB store key.
    private handleToKey(handle: FileHandle): string {
        return handle.path.join("/") + "/" + handle.fileName;
    }

}
