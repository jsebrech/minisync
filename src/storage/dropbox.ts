import { Dropbox } from "dropbox";
import { FileData, FileHandle, Store } from "./core";

export class DropboxStore implements Store {

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
        }).then((f: any) => { // DropboxTypes.files.FileMetadata
            // in node it returns a fileBinary
            if (f.fileBinary) {
                return f.fileBinary;
            // in browser it returns a fileBlob
            } else if (f.fileBlob) {
                const responseImpl = this.response || Response;
                return (new responseImpl((f as any).fileBlob as Blob)).text();
            } else {
                throw new Error("no fileBinary or fileBlob in response");
            }
        }).then((t: string) => {
            return {
                path: file.path,
                fileName: file.fileName,
                contents: t
            };
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

    /**
     * Convert ["some", "path"] to "/<rootFolder>/some/path/"
     * @param path Array to convert
     */
    private pathToString(path: string[]) {
        return [].concat(["", this.rootFolder], path, [""]).join("/").replace(/(\/)+/g, "/");
    }

}
