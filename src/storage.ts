interface FileHandle {
    path: string[];
    fileName: string;
}
interface FileData extends FileHandle {
    contents: string;
}

export interface StoragePlugin {
    putFile(file: FileData): Promise<boolean>;
    getFile(file: FileHandle): Promise<FileData>;
    getFiles(files: FileHandle[]): Promise<FileData[]>;
    listFiles(path: string[]): Promise<FileHandle[]>;
}

export class LocalStoragePlugin implements StoragePlugin {
    constructor(readonly prefix: string = "minisync") { }

    public getFile(file: FileHandle): Promise<FileData> {
        return new Promise((resolve, reject) => {
            const stored = window.localStorage.getItem(this.prefix + "//" + this.encode(file));
            if (stored === null) {
                reject(new Error("No such file: " + this.encode(file)));
            } else {
                resolve({
                    path: file.path,
                    fileName: file.fileName,
                    contents: stored
                } as FileData);
            }
        });
    }

    public putFile(file: FileData): Promise<boolean> {
        return new Promise((resolve, reject) => {
            window.localStorage.setItem(this.prefix + "//" + this.encode(file), file.contents);
            resolve(true);
        });
    }

    public getFiles(files: FileHandle[]): Promise<FileData[]> {
        return Promise.all(files.map(this.getFile, this));
    }

    public listFiles(path: string[]): Promise<FileHandle[]> {
        const internalPath = this.prefix + "//" + path.join("/") + "/";
        return Promise.resolve(
            this.allKeys().filter((key) => {
                return key.indexOf(internalPath) === 0;
            }).map((key: string): FileHandle => {
                return {
                    path,
                    fileName: key.substr(internalPath.length)
                } as FileHandle;
            })
        );
    }

    private allKeys(): string[] {
        const result = [];
        for ( let i = 0, len = localStorage.length; i < len; ++i ) {
            result.push(localStorage.key(i));
        }
        return result;
    }

    private encode(what: FileHandle|string): string {
        if (typeof what === "object") {
            return this.encode(
                (what as FileHandle).path.join("/") + "/" + (what as FileHandle).fileName
            );
        } else return what;
    }
}

export class Storage {
    constructor(
        /** the namespace inside of which documents are stored */
        readonly namespace: string = "minisync",
        /** The storage plugin used for saving local copies of the document */
        readonly localStore: StoragePlugin = new LocalStoragePlugin(namespace)
    ) {}
}

// TODO: save/restore document from localStore
// TODO: implement dropbox plugin
// TODO: publish/subscribe document from remoteStore
