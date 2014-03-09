Minisync
========

A library for P2P synchronization of JSON data objects

**Not usable yet, will update when it's ready**

Capabilities
------------

- Any javascript object that is JSON-compatible can be synchronized
- Any number of clients can 'share' an object
- Lock-free algorithm, many clients can edit the same object in parallel
- Eventually consistent state between all clients
- No server other than for communication between clients
- Communication protocol is JSON itself, can be sent over any JSON-capable channel
- No "line of sight" between clients, synchronization can occur through e-mail
- Differential updates, only changes are sent

Limitations
-----------

This is experimental code and therefore likely to break between versions,
causing data loss across all clients when a new minisync version is deployed!

Also:

- Data can only be changed through the minisync() api.
- Only an object can be synchronized, but the object can have arbitrary nested properties.
- Conflicting changes are resolved through "last one wins" principle.
- Synchronizes at the level of objects and arrays (see below for details).

Usage
-----

TODO (check the unit tests for now)

Theory of operation: two participants
-------------------------------------

Assume two clients: Alice and Bob

They each have a copy of the object. The object is locally versioned.
Each property of that object which it iself also an object (or array) is locally versioned as well.
This means that for a nested JSON structure, each object or array in the nesting
has its own version. The top-level object is called a document, and it has a
document version.

Alice and Bob each keep this data about each other at the document level:

- last received: the **remote** document version that was last received from the other
- last confirmed send: the **local** document version that was last acknowledged by the other as being received

Note yet again that the version is local on each side,
so a direct comparison of versions is not possible.

Alice however knows what changes to send to Bob,
these are all the local values newer than the 'last confirmed send',
which is everything that Bob hasn't confirmed to Alice as being received by him.

**Step 1: Alice sends all objects from the document newer than 'last confirmed send' to Bob**

She also sends him the 'last received', aka the version in Bob's versioning scheme that he last sent her.

**Step 2: Bob receives the update from Alice, and...**

- He updates the 'last confirmed send' from Alice to the 'last received' alice acknowledged to him
- He updates each local value with the one from Alice's changes, if...
    - The value's version in Alice's versioning scheme is newer than 'last received'
    - The local value doesn't have a UTC timestamp newer than Alice's value

Note that the timestamp is only needed for resolving conflicting changes on both sides.
Accurate timekeeping is not an absolute necessity for the algorithm,
it just improves its behavior by ensuring older data never overwrites newer data.

While doing this, the local object version increases.
Bob is smart enough to update the 'last confirmed send' to match the new document version
if Alice already had the latest version from Bob, to prevent an infinite loop of updates
being sent around.

Of course, now Alice needs to be told what Bob received.

**Step 3: Bob sends a changes object to Alice in the same way that Alice sent one to Bob**

**Step 4: Alice synchronizes the changes object in the same way that Bob did before**

The result is that Alice and Bob now agree on the content of the object.

Theory of operation: 3 participants
-----------------------------------

Alice and Bob have exchanged a document.

Bob exchanges the document with Charlie, and sends along the information he has on Alice.

Now Charlie knows these things:

- The document, as agreed between Alice and Bob, possibly with additional changes by Bob
- The version of Bob that was last confirmed by Alice as received by her
- The version of Bob that was last sent to Charlie
- The version of Alice that she last sent to Bob
- The version of Alice last received by Charlie, as this matches the version last received by Bob.

When Alice sends changes to Charlie, Charlie now is smart enough to ignore
all values older than the version of Alice that he last received (through Bob).

Charlie may also know if his own local version was last confirmed by Alice, if:

- The version of Charlie last confirmed by Bob is Charlie's current version
- The version of Bob last confirmed by Alice is Bob's current version

The first time Charlie sends changes to Alice, he will either send everything,
if he couldn't confirm that his own location version matched the last confirmed version by Alice,
or he will send only his own local changes, if he did confirm it before making changes himself.

In the worst case scenario, when Charlie syncs to Alice for the first time
and Alice does not know Charlie exists before this sync because Bob didn't tell her,
Charlie will send Alice everything he has and Alice will have to
perform conflict handling based on timestamps because she cannot ignore
any subset of Charlie's versions. In this case (and only in this case) older data
may overwrite newer data if Alice or Charlie have an inaccurate clock.
