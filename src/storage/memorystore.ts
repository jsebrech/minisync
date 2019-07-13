import { FileData, FileHandle, RemoteStore } from "./types";

const DATA_URI_PREFIX = "data:text/plain;base64,";

/**
 * Memory-based store mostly useful for testing.
 */
export class MemoryStore implements RemoteStore {
    constructor(readonly files: any = {}) { }

    public getFile(file: FileHandle): Promise<FileData> {
        return new Promise((resolve, reject) => {
            const stored = this.valueAtPath([].concat(file.path, [file.fileName]));
            if ((stored === null) || (stored === undefined)) {
                // not found
                resolve(null);
            } else {
                resolve({
                    path: file.path,
                    fileName: file.fileName,
                    contents: stored
                } as FileData);
            }
        });
    }

    public putFile(file: FileData): Promise<FileHandle> {
        return new Promise((resolve, reject) => {
            let folder = this.files;
            for (const part of file.path) {
                if (!folder[part]) folder[part] = {};
                folder = folder[part];
            }
            folder[file.fileName] = file.contents;
            resolve({
                path: file.path,
                fileName: file.fileName
            });
        });
    }

    public listFiles(path: string[]): Promise<FileHandle[]> {
        const result = [];
        const folder = this.valueAtPath(path);
        if (folder) {
            for (const key in folder) {
                if (typeof folder[key] !== "object") {
                    result.push({
                        path,
                        fileName: key
                    });
                }
            }
        }
        return Promise.resolve(result);
    }

    public publishFile(file: FileHandle): Promise<string> {
        return this.getFile(file).then((data) =>
            DATA_URI_PREFIX + btoa(data.contents)
        );
    }

    public canDownloadUrl(url: string): boolean {
        return /^data\:text/.test(url);
    }

    public downloadUrl(url: string): Promise<string> {
        return Promise.resolve(atob(url.substring(DATA_URI_PREFIX.length)));
    }

    private valueAtPath(path: string[]): any {
        let result = this.files;
        for (const part of path) {
            if (result) {
                result = result[part];
            } else return null;
        }
        return result;
    }

}
