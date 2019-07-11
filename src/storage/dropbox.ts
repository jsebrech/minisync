import { Dropbox } from "dropbox";
import { FileData, FileHandle, RemoteStore } from "./types";

export class DropboxStore implements RemoteStore {

    /**
     * Instantiate a dropbox-backed store
     * @param dropbox An instance of the Dropbox Javascript SDK's Dropbox class
     * @param rootFolder The root folder inside of which all paths for store operations are located.
     * @param response A handle to the Response class (for nodejs environments)
     */
    constructor(
        readonly dropbox: Dropbox,
        readonly rootFolder: string = "minisync",
        readonly response?: typeof Response) { }

    public putFile(file: FileData): Promise<boolean> {
        return this.dropbox.filesUpload({
            path: this.pathToString(file.path) + file.fileName,
            contents: file.contents,
            mode: { ".tag": "overwrite" }
        }).then((s: any) => true);
    }

    public getFile(file: FileHandle): Promise<FileData> {
        return this.dropbox.filesDownload({
            path: this.pathToString(file.path) + file.fileName
        }).then((f: DropboxTypes.files.FileMetadata) => {
            return this.dataFromFileMeta(f);
        }).then((t: string) => {
            return {
                path: file.path,
                fileName: file.fileName,
                contents: t
            };
        }).catch((err) => {
            // not found
            if (err && err.status === 409) {
                return null;
            } else throw err;
        });
    }

    public listFiles(path: string[]): Promise<FileHandle[]> {
        const handle = (
            res: DropboxTypes.files.ListFolderResult,
            list?: DropboxTypes.files.FileMetadataReference[]
        ): Promise<DropboxTypes.files.FileMetadataReference[]> => {
            if (res.has_more) {
                return this.dropbox.filesListFolderContinue({ cursor: res.cursor }).then(handle);
            } else {
                return Promise.resolve(
                    [].concat(res.entries.filter((f) => f[".tag"] === "file"), list)
                );
            }
        };
        return this.dropbox.filesListFolder({ path: this.pathToString(path) })
            .then(handle)
            .then((files: DropboxTypes.files.FileMetadataReference[]) => {
                return files.map((f) => ({ path, fileName: f.name }));
            });
    }

    /** Create a public URL for a file */
    public publishFile(file: FileHandle): Promise<string> {
        return this.dropbox.sharingCreateSharedLink({
            path: this.pathToString(file.path) + file.fileName
        }).then((meta) => meta.url);
    }

    /** Detects whether the given URL can be downloaded by this store */
    public canDownloadUrl(url: string): boolean {
        return /^https:\/\/www\.dropbox\.com/.test(url);
    }

    /** Downloads the given URL and returns the enclosed data */
    public downloadUrl(url: string): Promise<string> {
        return this.dropbox.sharingGetSharedLinkFile({ url }).then(
            (res: DropboxTypes.sharing.SharedLinkMetadataReference) => {
                return this.dataFromFileMeta(res);
            });
    }

    /**
     * Convert ["some", "path"] to "/<rootFolder>/some/path/"
     * @param path Array to convert
     */
    private pathToString(path: string[]) {
        return [].concat(["", this.rootFolder], path, [""]).join("/").replace(/(\/)+/g, "/");
    }

    /**
     * Extract the file contents from a dropbox API response
     * @param file The file's metadata
     */
    private dataFromFileMeta(
        file: DropboxTypes.files.FileMetadata | DropboxTypes.sharing.SharedFileMetadata | any
    ): Promise<string> {
        // in node it returns a fileBinary
        if (file.fileBinary) {
            return Promise.resolve(file.fileBinary);
        // in browser it returns a fileBlob
        } else if (file.fileBlob) {
            const responseImpl = this.response || Response;
            return (new responseImpl((file as any).fileBlob as Blob)).text();
        } else {
            return Promise.reject(new Error("no fileBinary or fileBlob in response"));
        }
    }

}
