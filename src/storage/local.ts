import {Document} from "../document";
import * as minisync from "../minisync";
import {ObjectID} from "../types";
import {FileData, Store} from "./types";

/** Syncing documents to device-local stores */
export class LocalSync {

    constructor(
        private store: Store
    ) { }

    /**
     * Save a document to a local store
     * @param document Document to aave
     * @param store The store to save to
     * @return The document's ID (to restore from)
     */
    public saveLocal(document: Document): Promise<ObjectID> {
        return this.store.putFile({
            path: ["documents"],
            fileName: document.getID() + ".json",
            contents: JSON.stringify(document.getChanges())
        }).then((handle) => {
            if (!handle) throw new Error("Unexpected error saving document");
            return document.getID();
        });
    }

    /**
     * Restore a document from a local store
     * @param id The document id to restore
     * @param store The store to restore from
     * @return The restored document
     */
    public restoreLocal(id: ObjectID): Promise<Document> {
        return this.store.getFile({
            path: ["documents"],
            fileName: id + ".json"
        }).then((data: FileData) => {
            return minisync.restore(JSON.parse(data.contents));
        });
    }
}
