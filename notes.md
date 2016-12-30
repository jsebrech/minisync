Working Notes
=============

Merging JSON data
-----------------

for each client the following document versions are tracked:

- last received: remote version that was last received and merged
- last sent: local version that was last sent
- last ack'd: local version that was last acknowledged as received and merged
    last ack'd <= last sent

changes object (for JSON objects):
(sent only if local object was changed after last ack'd version)

    { _s: {
        id: ..., // unique id for this item
        u: ..., // updated at version
        r: ...  // removed at version
        t: timestamp // timestamp of update / remove
      },
      // only for primitive values or changed hierarchies
      key: primitive value | changes object,
      ...
    }


Syncing JSON objects involves:

    sync(local, remote) =
      - for each remote.key
        - if (remote.key is primitive)
          - if (remote version is newer than last received version)
            - if (local version is older than last ack'd version) // no conflict
                 or (remote timestamp is newer than local timestamp) // conflict, newest wins
              // all primitive keys are copied
              - copy remote.key to local.key
        - if (remote.key is object or array)
          - if (remote.key is removed)
            - if (local.key's version is older than last ack'd version) // no conflict
                 or (remote.key timestamp is newer than local.key timestamp) // conflict, newest wins
              - delete local.key
          - else // remote.key not removed
            - sync(local.key, remote.key)

array changes object (for JSON arrays):

    { _s: {
        id: ...,
        a: boolean, // true for an array object
        t: string, // timestamp of last change
        u: ..., r: ...
      },
      // value = primitive value or changes object
      // all values are represented, though the changes object can be sparse
      v: [ value, value, value, ... ]
    }

Syncing JSON arrays involves (if the array should be synced):

    sync(local, remote) =
      for every local value object in the array
        if it is also in the remote
          sync(local value, remote value)
      if (remote array version is newer than last received version)
        create value ranges:
          if the shared value objects appear in the same order
            for each local value in the array
              if it's a value object, if it also exists in the remote array
                close the previous values range, start a new values range
          otherwise (sorting of local or remote was changed)
            1 value range: entire array
          values range = corresponding start and end indexes in local and remote
        for each values range: merge value ranges
          create a temporary array (= temp)
            // if the remote version is newer
            if (local version is older than last ack'd version) // no conflict
            or (remote timestamp is newer than local timestamp) // conflict, newest wins
              copy all primitives from remote to temp
            otherwise // remote is not newer
              copy all primitives from local to temp
            for every value object (or array) inside the local range
              if not in the remote range
              and if its version is newer than the last ack'd version,
                add it to the end of temp
            for every value object (or array) inside the remote range
              if it is not in the local range
              and it is not in the list of removed local values,
              and if its version is newer than the last received version
                add it to the end of temp
          replace the inner values of the local range with temp

The values ranges have these attributes:

- For Start and End
    - Start is a value object or null for the array start
    - End is a value object or null for the array end
    - Start and End occur both in the local and remote data.
      Therefore they are shared boundary markers in the local and remote arrays
-  For the values between Start and End
    - Can be primitive values or value objects
    - For same order ranges
      - The value objects between Start and End do not exist in both local and remote data.

Scenario's:

- Local value is primitive
    - Local Array is older than remote (last ack'd or timestamp)
      --> remove
    - Local Array is newer than remote
      --> keep
- Local value is value object
    - Local value is in remote
      --> will be boundary
      --> keep
    - Local value is not in remote
        - Local value is newer than last ack'd
          --> keep
        - Local value is older than last ack'd
          --> remove
- Remote value is primitive
    - Local Array is older than remote (last ack'd or timestamp)
      --> keep
    - Local Array is newer than remote
      --> discard
- Remote value is value object
    - Remote value is in local
      --> will be boundary
      --> keep
    - Remote value is not in local
        - Remote value version is older than last received
          --> was removed locally
          --> discard
        - Remote value version is newer than last received
          - if in list of locally removed values
            --> discard
          - otherwise
            --> keep

The ordering of values inside the array:

- The relative ordering of value objects that exist in local and remote is maintained
- Inside a values range (between shared value objects)
    - The relative ordering of primitive values is maintained
    - The relative ordering of value objects is maintained
    - The relative ordering of primitive values and value objects is not maintained
        - First come the primitive values
        - Then the local value objects (or arrays)
        - Then the remote value objects (or arrays)

Alternate approach to interval merging (handles sorting elegantly):

    sync(local, remote) =
      for every local value object in the array
        if it is also in the remote
          sync(local value, remote value)
      if (remote array version is newer than last received version)
        create intervals
          for every shared value object in local, create interval:
            local interval = all local values starting at object up to and not including next shared object (or array end)
            remote interval = all remote values starting at object up to and not including next shared object (or array end)
          add beginning intervals
        // if the remote array version is newer
        if (local version is older than last ack'd version) // no conflict
        or (remote timestamp is newer than local timestamp) // conflict, newest wins
          sort intervals according to remote order
        for each interval
          create a temporary array (= temp)
          // if the remote array version is newer
          if (local version is older than last ack'd version) // no conflict
          or (remote timestamp is newer than local timestamp) // conflict, newest wins
            for every value object inside the local range
              if it is the shared object
              or if its version is newer than the last ack'd version
                add it to temp
            for every value in the remote range
              if it is a primitive
                add it to temp
              if it is a value object
                if it is not in the local range
                and it is not in the list of removed local values,
                and if its version is newer than the last received version
                  add it to temp
          otherwise // remote is not newer
            for every value object inside the local range
              if it is a primitive
                add it to temp
              if it is a value object
                if it is the shared object
                or if its version is newer than the last ack'd version
                  add it to temp
            for every value in the remote range
                if it is not in the local range
                and it is not in the list of removed local values,
                and if its version is newer than the last received version
                  add it to temp
          replace the interval by temp

JSON syncing API
----------------

    var o = minisync.from(someobject); // someobject must be object or array
    o.getChangesSince(version);
    o.getChangesFor(clientid); // clientid is optional when sending to new clients
    o.mergeChanges(data, clientid); // clientid is optional
    o.getData(); // gets raw data inside this object
    o.getClientID(); // unique id of this client for this document

    // for objects
    o.set('property', value); // set any type as value
    o.get('property'); // returns minisync object
    o.get('property').get('otherproperty'); // cascades down object hierarchy

    // for arrays:
    o = minisync.from([]);
    o.set(0, 'foo').set(1, 'bar'); // o.getData() == ['foo', 'bar']
    o = minisync.from({ foo: [] });
    o.set('foo[1]', 'bar'); // o.getData() == { foo: [null, 'bar'] }
    o.push(object);
    o.splice(...);
    // ... other array functions ...

Internal State
--------------

Document: 

    {
      data: {
        _s: {
          // id of this client
          clientID: '...',
          // id of this document
          id: '...',
          // state of other clients
          remote: [{
            clientID: '...',
            lastAcknowledged: '...',
            lastReceived: '...'
          }],
          // timestamp of last change
          t: '...',
          // direct props on this object last updated in this document version
          u: '...',
          // current document version
          v: '...'  
        },
        ...
      }
    }

Object (nested):

    {
      _s: {
        id: '...',
        t, u, v
      },
      foo: 'bar',
      ...
    }

Array (nested): 

    [
       0, 1, 2, ...
       _s: {
         id: '...',
         t, u, ri
       }
    ]

Storage and P2P
===============

Storage Scenario
----------------

Peers:
- Alice / device A
- Alice / device B
- Bob / device A
- Bob / device C

Documents:
- Alice document 1 stored on dropbox account Alice1, locally on device A and B
- Alice document 2 stored locally on device A
- Bob document 1 stored on dropbox account Bob1, locally on device A and C
- Bob document 3 stored on dropbox account Bob2, locally on device C

Localstorage device A:
- document1/alice
- document2/alice
- document1/bob

Localstorage device B:
- document1/alice

Localstorage device C:
- document1/bob
- document3/bob

Dropbox Alice1:
- document1/deviceA
- document1/deviceB

Dropbox Bob1:
- document1/deviceA
- document1/deviceC

Dropbox Bob2:
- document3/deviceC

Ideas:
- When downloading document to device for the first time, generate client id and associate with local copy.
- When storing document (local or cloud), store as documentid/clientid
- When downloading updates, fetch updates from documentid/* in cloud storage account (= all my copies), 
  and from ClientState.url for every known client (= all known copies)
- There is no identity associated with a document, only a client id per device, and a set of storage locations.

P2P backend strategy
--------------------

**Single user, multiple clients**

All clients sync to their own folder and subscribe to each other's folders.
A client is linked to one or more storage accounts, and uploads to its own folder in that account.
Syncing is segmented to minimize upload size.
Index files allow detecting changes with minimal bandwidth use.

ClientState.url = URL of index file for a client, string
Points to an index file that points to the other files.

Index file contents (json):
- latest: string = latest version
- clientId: string = unique id of the client that owns this file (generated)
- clientName: string = label for this client (user-editable)
- part[version]: string = url of part file
- part...: string = url of successive part files

Part file:
- File name = part + first version in file
- Contains a range of versions.
- Only the latest file is written to, and only to append new versions.
- A new file is started every 500 KB

To download remote changes
1. For every client:
  a. Check index file and compare with local ClientState.lastReceived
  b. If newer, download all parts with versions we need
  c. Merge the parts in order
2. Repeat for new clients (from merge) until all clients are merged

To upload changes, for every linked cloud storage account:
1. Determine the client folder to write to (based on unique client id)
2. Write the necessary parts files
3. Write an updated index file

Linked storage account:
- 1 folder per document, containing:
- 1 folder per client named "client{client id}" (with index file and part files)
- use dropbox http api: https://www.dropbox.com/developers/documentation/http/documentation

Storing locally (indexeddb with localstorage fallback):
- Keep entire document (all changes)
- Store as minisync-[document id]-[client id]
