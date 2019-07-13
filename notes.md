Working Notes
=============

P2P backend strategy
--------------------

### Single user, multiple clients

All clients sync to their own folder and subscribe to each other's folders.
A client is linked to one or more storage accounts, and uploads to its own folder in that account.
Syncing is segmented to minimize upload size.
Index files allow detecting changes with minimal bandwidth use.

ClientState.url = URL of client index file, string.
Points to an index file that points to the other files.

### Files

Types of files:
- `document-XXX/` folder: the folder in the store that a document is kept in
  - `client-YYY/` folder: the folder that a specific client's version of that document is kept in
    - `client-index.json` file: for a client of a specific Document, keeps track of the version 
      as well as where to find the parts files containing the Document's data.
    - `partZZZ.json` file(s): the actual document as exported by a specific client, split into chunks
  - `master-index.json` file: for a user, keeps track of all clients of a document, their own and       those by others. Points to client index files for each client.

`client-index.json` file contents:
- `latest`: string = latest version
- `master`: string = master index file url
- `updated`: string = timestamp of last update
- `clientId`: string = unique id of the client that owns this file (generated)
- `clientName`: string = label for this client (user-editable)
- `part000001`: string = url of part file
- `part...`: string = url of successive part files

`partZZZ.json` file:
- File name = part + first version in file
- Contains a range of versions.
- Only the latest file is written to, and only to append new versions.
- A new file is started every 500 KB

`master-index.json` file:
- `label`: the user-visible string to label this peer to other peers
- `clients[client id]`: information about this user's clients
  - `url`: points to index file
  - `version`: string = latest version
- `peers[client id]`: information about other peers
  - `url`: points to master-index file
  - `label`: last label downloaded from their master-index.json
- `latestUpdate`: 
  - `client`: string = client id

### Syncing (single user)

To download remote changes (from our clients)
1. Download our master index file to get updated list of our clients
2. For every client from master index file, download changes
    - Check client index file and compare with local ClientState.lastReceived
    - If newer, download all parts with versions we need
    - Merge the parts in order
3. Sync remote users (see below)

To upload changes, for every linked cloud storage account:
  1. Write the necessary parts files
  2. Write an updated client index file
  3. Fetch the master index file
  4. Update master index with all necessary info, write it

> A conflict can occur during writing of the master-index. When using a storage API that does not prevent this, 
> the syncing will still work but may not be aware of some clients until those sync again.

> If after a while there are many old client folders, a purge operation can be run to discard ones that haven't been
> updated in a long time. Those clients can still sync again, but it would mean they have to reupload everything.

### Storing (single user)

Store locally in the same format as remotely. See file structure above.
Or use something more compact.

Sync local state to the remote linked storage account.

For multiple storage accounts, see gotcha's below.

### Multiple users

First download (from remote user):
1. Alice shares url of master index to bob
2. Bob syncs changes for that source
    - Download master index file
    - Bob checks latestUpdate, downloads that client's changes and merges them
3. Bob performs sync with other remote users

Publish to remote users:
1. Extract the list of master index url's from the known clientstates
2. For every unique master index url, download changes
3. Bob uploads the synchronized document to his linked storage account
4. Bob shares his master index file url back to Alice (and other remote users)

Next syncs:
1. Bob redownloads the master index file
2. Bob syncs the changes for every client he previously downloaded from
3. Bob syncs changes from the latestUpdate client from the master index file
4. Bob publishes his changes to his linked storage account

### Gotcha's

**How to revoke access to a shared document to a specific peer**

Intuitive, but wrong: piggy-back on store permission (e.g. dropbox permissions)

  Will not work because the revoked peer may get updates via indirect channels if other peers do not also revoke them.

Answer: not possible, fork the document into a new one that is not shared with the *revoked* user, then remove the original document.

**How to migrate a document from one store to another**

Strategy 1: fork the document and publish to the new store

  Take the current state of the document and construct a new one from that, with new version history.
  
  > Caveat: cannot publish a document to multiple stores at the same time.

Strategy 2: publish the document to two stores as the same client

  Run the saveRemote routine on two stores.

  > Caveat: risk of out of sync stores, makes it impossible to disambiguate conflicts (since the same client id is used with both stores)

Strategy 3: publish the document to two stores as different clients

  - Have two client id's, and two Document instances in memory.
  - Merge changes between the Document instances.
  - Publish each document to its own remote store.

  Store lastReceived in later synced stores so remote clients on update resolution can detect the earlier synced stores as a duplicate of the later synced accounts. Don't store lastReceived in earlier synced accounts for later ones, because there is no guarantee the syncing will complete.

  > Caveat: increases syncing effort because this creates more peers to sync with.

P2P implementation notes
------------------------

IndexedDB compat check:
https://github.com/localForage/localForage/blob/master/src/utils/isIndexedDBValid.js

Todo
----

- implement `storage.saveRemote` / `storage.mergeRemote`, make it work with a mock storage provider
- implement `minisync.fromUrl` to start a new local document from a remote minisync document
  - what if it already exists locally? should have a way of obtaining the document id only and checking
  - what if it already exists in a remote store? how to avoid conflicts if users recreate the document on a new device?
- implement `document.downloadChanges` to connect to other remote clients and download their changes
