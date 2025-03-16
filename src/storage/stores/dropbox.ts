import { Dropbox, DropboxResponse, files, sharing } from "dropbox";
import { FileData, FileHandle, RemoteFileHandle, RemoteStore } from "../types";

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

    public putFile(file: FileData): Promise<RemoteFileHandle> {
        return this.dropbox.filesUpload({
            path: this.pathToString(file.path) + file.fileName,
            contents: file.contents,
            mode: { ".tag": "overwrite" }
        }).then(async () => {
            return {
                path: file.path,
                fileName: file.fileName,
                url: await this.publishFile(file)
            };
        });
    }

    public getFile(file: FileHandle): Promise<FileData|null> {
        return this.dropbox.filesDownload({
            path: this.pathToString(file.path) + file.fileName
        }).then((f: DropboxResponse<files.FileMetadata>) => {
            return this.dataFromFileMeta(f.result);
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
            response: DropboxResponse<files.ListFolderResult>,
            list?: files.FileMetadataReference[]
        ): Promise<files.FileMetadataReference[]> => {
            const { result } = response;
            if (result.has_more) {
                return this.dropbox.filesListFolderContinue({ cursor: result.cursor }).then(handle);
            } else {
                return Promise.resolve(
                    result.entries.filter((f) => f[".tag"] === "file").concat(list || [])
                );
            }
        };
        return this.dropbox.filesListFolder({ path: this.pathToString(path) })
            .then(handle)
            .then((files: files.FileMetadataReference[]) => {
                return files.map((f) => ({ path, fileName: f.name }));
            });
    }

    /** Detects whether the given URL can be downloaded by this store */
    public canDownloadUrl(url: string): Promise<boolean> {
        if (/^https:\/\/www\.dropbox\.com/.test(url)) {
            return this.dropbox.sharingGetSharedLinkMetadata({ url }).then(
                (response: DropboxResponse<sharing.SharedLinkMetadataReference>) => {
                    return !!response.result;
                }
            ).catch((e) => false);
        } else return Promise.resolve(false);
    }

    /** Downloads the given URL and returns the enclosed data */
    public downloadUrl(url: string): Promise<string> {
        return this.dropbox.sharingGetSharedLinkFile({ url }).then(
            (response: DropboxResponse<sharing.SharedLinkMetadataReference>) => {
                return this.dataFromFileMeta(response.result);
            });
    }

    /** Create a public URL for a file */
    private publishFile(file: FileHandle): Promise<string> {
        return this.dropbox.sharingCreateSharedLink({
            path: this.pathToString(file.path) + file.fileName
        }).then((response) => response.result.url);
    }

    /**
     * Convert ["some", "path"] to "/<rootFolder>/some/path/"
     * @param path Array to convert
     */
    private pathToString(path: string[]) {
        return ["", this.rootFolder, ...path, ""].join("/").replace(/(\/)+/g, "/");
    }

    /**
     * Extract the file contents from a dropbox API response
     * @param file The file's metadata
     */
    private dataFromFileMeta(
        file: files.FileMetadata | sharing.SharedFileMetadata | any
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
