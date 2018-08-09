import { FileData, FileHandle, Store } from "./core";

export class DropboxStore implements Store {
    // TODO: write me

    public putFile(file: FileData): Promise<boolean> {
        return null;
    }

    public getFile(file: FileHandle): Promise<FileData> {
        return null;
    }

    public getFiles(files: FileHandle[]): Promise<FileData[]> {
        return null;
    }

    public listFiles(path: string[]): Promise<FileHandle[]> {
        return null;
    }

}
