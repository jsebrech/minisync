Working Notes
=============

P2P backend strategy
--------------------

**Single user, multiple clients**

All clients sync to their own folder and subscribe to each other's folders.
A client is linked to one or more storage accounts, and uploads to its own folder in that account.
Syncing is segmented to minimize upload size.
Index files allow detecting changes with minimal bandwidth use.

ClientState.url = URL of client index file, string
Points to an index file that points to the other files.

*Files*

Types of files:
- `client-index.json` file: for a client of a specific Document, keeps track of the version 
  as well as where to find the parts files containing the Document's data.
- `partXXX.json` file(s): the actual document as exported by a specific client, split into chunks
- `master-index.json` file: for a user, keeps track of all clients of a document, their own and those by others. Points to client index files for each client.

`client-index.json` file contents:
- `latest`: string = latest version
- `master`: string = master index file url
- `updated`: string = timestamp of last update
- `clientId`: string = unique id of the client that owns this file (generated)
- `clientName`: string = label for this client (user-editable)
- `part000001`: string = url of part file
- `part...`: string = url of successive part files

`partXXX.json` file:
- File name = part + first version in file
- Contains a range of versions.
- Only the latest file is written to, and only to append new versions.
- A new file is started every 500 KB

`master-index.json` file:
- `client[client id]`:
  - `url`: points to index file
- `latestUpdate`: 
  - `client`: string = client id
  - `version`: string = client version that was written

*Syncing*

To download remote changes
1. Download our master index file to get updated list of clients
    - This url is cached locally when the document is first downloaded
2. For every client from master index file, download changes
    - Check client index file and compare with local ClientState.lastReceived
    - If newer, download all parts with versions we need
    - Merge the parts in order
3. Sync remote users (see below)

To upload changes, for every linked cloud storage account:
  1. Write the necessary parts files
  2. Write an updated client index file
  3. Fetch the master index file
  4. Update master index with client (if needed) and latestUpdate, write it

*Storing*

Linked storage account:
- 1 folder per document, containing:
- 1 folder per client named "client{client id}" (with index file and part files)
- use dropbox http api: https://www.dropbox.com/developers/documentation/http/documentation
- doesn't need to be folder-based, only url-based

Storing locally (localstorage or indexeddb):
- Keep entire document (all changes)
- Store as minisync/documents/[document id]

IndexedDB compat check:
https://github.com/localForage/localForage/blob/master/src/utils/isIndexedDBValid.js

**Multiple users**

First share:
1. Alice shares url of master index to bob
2. Bob syncs changes for that source
    - Download master index file
    - Bob checks latestUpdate, downloads that client's changes and merges them
3. Bob performs sync with other remote users

Sync with remote users:
  1. Extract the list of master index url's from the known clientstates
  2. For every unique master index url, download changes
  3. Bob uploads the synchronized document to his linked storage account
  4. Bob shares the master index file url back to Alice (and other remote users)

What is needed?
  1. Ability to download url's
  2. Channel for communicating master index url's back and forth (e.g chat, e-mail, ...)

Dropbox API
-----------

https://www.dropbox.com/developers/documentation/http/documentation

**/upload**

Send

      {
          // write to this path
          "path": "/minisync/<document id>/...",
          // always overwrite, even if there's a conflict
          "mode": "overwrite",
          // don't send notification file is changed
          "mute": true
      }

Returns

      {
          "name": "....json",
          "id": "id:a4ayc_80_OEAAAAAAAAAXw",
          "client_modified": "2015-05-12T15:50:38Z",
          "server_modified": "2015-05-12T15:50:38Z",
          "rev": "a1c10ce0dd78",
          "size": 7212,
          "path_lower": "/minisync/.../....json",
          "path_display": "/minisync/.../....json",
          "sharing_info": {
              "read_only": true,
              "parent_shared_folder_id": "84528192421",
              "modified_by": "dbid:AAH4f99T0taONIb-OurWxbNQ6ywGRopQngc"
          },
          "property_groups": [
              {
                  "template_id": "ptid:1a5n2i6d3OYEAAAAAAAAAYa",
                  "fields": [
                      {
                          "name": "Security Policy",
                          "value": "Confidential"
                      }
                  ]
              }
          ],
          "has_explicit_shared_members": false
      }

**/download**

Send

      {
          "path": "/Homework/math/Prime_Numbers.txt"
      }
      or
      {
          "path": "id:a4ayc_80_OEAAAAAAAAAYa"
      }

**/create_folder**

**/list_folder**

**/create_shared_link_with_settings**

Publish a file as a link so it can be downloaded without a dropbox account.

Todo
----

Storage api:
- store files (document id, type, identifier) and obtain private uri
- fetch file (private uri)
- list files (by document id, type) --> to fetch initial list of documents
- publish stored files and obtain public url
- authenticate
- Save/restore document
- Publish/subscribe to remote store
- wraps around core, core is storage-agnostic

Minisync core:
- Restore from series of changes objects
