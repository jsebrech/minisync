describe('minisync', function() {

    function isArray(v) {
        return Object.prototype.toString.call(v) === '[object Array]';
    }

    describe('uid', function() {

        it('should be unique a thousand times', function() {
            var uids = [];
            var uid = null;
            for (var i = 0; i < 1000; i++) {
                uid = minisync.createID();
                expect(uids.indexOf(uid)).toEqual(-1);
                uids.push(uid);
            }
        });

        it('should be an 8 char string', function() {
            var uid = minisync.createID();
            expect(typeof uid).toEqual('string');
            expect(uid.length).toEqual(8);
        });

        it('should also generate a 16 char string', function() {
            var uid = minisync._private.createLongID();
            expect(typeof uid).toEqual('string');
            expect(uid.length).toEqual(16);
        });

    });

    describe('version', function() {

        it('should generate an initial version', function() {
            var version = minisync._private.nextVersion();
            expect(typeof version).toEqual('string');
            expect(version.length).toEqual(1);
        });

        it('should be different after incrementing', function() {
            var previous = [];
            var version = '';
            for (var i = 0; i < 100; i++) {
                version = minisync._private.nextVersion(version);
                expect(previous.indexOf(version)).toEqual(-1);
                previous.push(version);
            }
        });

        it('should be larger after incrementing', function() {
            var previous = '';
            for (var i = 0; i < 100; i++) {
                var version = minisync._private.nextVersion(previous, 5);
                expect(version).toBeGreaterThan(previous);
                previous = version;
            }
        });

        it('should pad to the right length', function() {
            expect(minisync._private.nextVersion('').length).toEqual(1);
            expect(minisync._private.nextVersion('', 1).length).toEqual(1);
            expect(minisync._private.nextVersion('A', 1).length).toEqual(1);
            expect(minisync._private.nextVersion('AA', 5).length).toEqual(5);
            expect(minisync._private.nextVersion('AA', 100).length).toEqual(100);
        });

        it('should sort correctly after padding', function() {
            var a = minisync._private.nextVersion('a', 5);
            var bb = minisync._private.nextVersion('bb', 5);
            expect(bb).toBeGreaterThan(a);
        });

    });

    describe('object handling', function() {
        it('should initialize properly', function() {
            var data = { foo: 'bar' };
            var o = minisync.from(data);
            expect(typeof o).toEqual('object');
            expect(o.getData).not.toBeUndefined();
            var oData = o.getData();
            expect(typeof oData).toEqual('object');
            expect(oData.foo).toEqual('bar');
            expect(o.getID()).not.toBeNull();
            expect(typeof o.getTimeStamp()).toEqual('string');
            expect(o.getTimeStamp().length).toEqual(14);
        });

        it('should return properties', function() {
            var data = { foo: 'bar', baz: { 'foo': 'quu' } };
            var o = minisync.from(data);
            expect(o.get('foo')).toEqual('bar');
            expect(o.get('baz').get).not.toBeNull();
            expect(o.get('baz').get('foo')).toEqual('quu');
        });

        it('should update properties', function() {
            var data = { foo: 'bar' };
            var o = minisync.from(data);
            var oldVersion = o.getDocVersion();
            o.set('foo', 'baz');
            expect(data.foo).toEqual('baz');
            expect(data._s).not.toBeNull();
            expect(data._s.u).not.toBeNull();
            expect(o.getDocVersion()).not.toEqual(oldVersion);
            oldVersion = o.getDocVersion();
            o.set('quu', 'qux');
            expect(data.quu).toEqual('qux');
            expect(o.getDocVersion()).not.toEqual(oldVersion);
        });

        it('should return a raw data object', function() {
            var o = minisync.from({foo: 'bar'});
            o.set('bar', 'baz');
            o.set('baz', { foo: 'bar' });
            var data = o.getData();
            expect(typeof data).toEqual('object');
            expect(data._s).toBeUndefined();
            expect(data.foo).toEqual('bar');
            expect(data.bar).toEqual('baz');
            expect(typeof data.baz).toEqual('object');
            expect(data.baz._s).toBeUndefined();
            expect(data.baz.foo).toEqual('bar');
        });

        it('should have smart get and set syntax', function() {
            var data = { foo: 'bar', baz: { 'foo': 'quu' } };
            var o = minisync.from(data);
            expect(o.get('baz.foo')).toEqual('quu');
            o.set('baz.foo', {test: 'bingo'});
            expect(data.baz.foo.test).toEqual('bingo');
            expect(o.get('baz.foo.test')).toEqual('bingo');
        });

        it('should update properties in child objects', function() {
            var data = { child: { foo: 'bar' }};
            var o = minisync.from(data);
            var oldVersion = o.getVersion(); // version for master object
            var oldDocVersion = o.getDocVersion(); // version for document
            var oldChildVersion = o.get('child').getVersion(); // version for child object
            o.get('child').set('foo', 'baz');
            expect(data.child.foo).toEqual('baz');
            expect(o.getVersion()).toEqual(oldVersion);
            expect(o.getDocVersion()).not.toEqual(oldDocVersion);
            expect(o.get('child').getVersion()).not.toEqual(oldChildVersion);
        });

        it('should handle removed objects', function() {
            var o = minisync.from({foo: { bar: { baz: 'quu' } }});
            o.get('foo').get('bar').remove();
            var d = o.getData();
            expect(typeof d).toEqual('object');
            expect(typeof d.foo).toEqual('object');
            expect(d.foo.bar).toBeUndefined();
        });

        it('should know what changed', function() {
            var data = {
                key1: 'foo',
                key2: {
                    key3: 'foo',
                    key4: {
                        key5: 'foo',
                        key6: {
                            key8: 'foo'
                        },
                        key7: 'bar'
                    }
                }
            };
            var o = minisync.from(data);
            var initialVersion = o.getDocVersion();
            var changes = o.getChangesSince(initialVersion);
            expect(changes).toBeNull();
            o.set('key2.key4.key5', 'changed');
            changes = o.getChangesSince(o.getDocVersion());
            expect(changes).toBeNull();
            changes = o.getChangesSince(initialVersion);
            expect(changes).not.toBeNull();
            expect(changes.key1).toBeUndefined();
            expect(changes.key2).not.toBeUndefined();
            expect(changes.key2.key3).toBeUndefined();
            expect(changes.key2.key4).not.toBeUndefined();
            expect(changes.key2.key4.key5).toEqual('changed');
            expect(changes.key2.key4.key6).toBeUndefined();
            expect(changes.key2.key4.key7).toEqual('bar');
        });
    });

    describe('array handling', function() {
        it('should support get() and set()', function() {
            var a = minisync.from({a: []}).get('a');
            a.set(0, 'foo');
            a.set(2, 'bar');
            var data = a.getData();
            expect(isArray(data)).toBeTruthy();
            expect(data.length).toEqual(3);
            expect(data[0]).toEqual('foo');
            expect(data[2]).toEqual('bar');
            expect(a.get(0)).toEqual('foo');
            expect(a.get('0')).toEqual('foo');
            expect(a.get('2')).toEqual('bar');
        });

        it('should support nested get() and set()', function() {
            var o = minisync.from({foo: [null, 'bar']});
            expect(o.get('foo[1]')).toEqual('bar');
            o.set('foo[1]', 'baz');
            expect(isArray(o.get('foo').getData())).toBeTruthy();
            expect(o.get('foo').get(1)).toEqual('baz');
            expect(o.get('foo[1]')).toEqual('baz');
            o.set('foo[1]', ['test']);
            o.set('foo[1][2]', 'bar');
            expect(o.get('foo[1][2]')).toEqual('bar');
            var data = o.get('foo[1]').getData();
            expect(isArray(data)).toBeTruthy();
            expect(data.length).toEqual(3);
            expect(data[2]).toEqual('bar');
            o.get('foo').set('[1][2]', 'baz');
            expect(o.get('foo[1][2]')).toEqual('baz');
        });

        it('should return raw data', function() {
            var o = minisync.from({ test: ['bar', {foo: 'bar'}]});
            var data = o.getData().test;
            expect(isArray(data)).toBeTruthy();
            expect(data.length).toEqual(2);
            expect(data._s).toBeUndefined();
            expect(data[0]).toEqual('bar');
            expect(typeof data[1]).toEqual('object');
            expect(data[1].foo).toEqual('bar');
            expect(data[1]._s).toBeUndefined();
        });

        it('should keep track of removed items', function() {
            var data = minisync.from({ v: [{foo: 'bar'}, {bar: 'baz'}]}).get('v');
            expect(data.getData().length).toEqual(2);
            var itemID = data.get(0).getID();
            var updatedAt = data.getState().u;
            data.removeAt(0);
            expect(data.getData().length).toEqual(1);
            expect(data.getState().u).not.toEqual(updatedAt);
            expect(isArray(data.getRemoved())).toBeTruthy();
            expect(data.getRemoved().length).toEqual(1);
            expect(data.getRemoved()[0].id).toEqual(itemID);
        });

        it('should implement concat', function() {
            var v = minisync.from({v: ['one', 'two']}).get('v');
            expect(v.concat).not.toBeUndefined();
            var a = v.concat(['three']);
            expect(isArray(a)).toBeTruthy();
            expect(a.length).toEqual(3);
            expect(a[2]).toEqual('three');
        });

        it('should implement forEach', function() {
            if (Array.prototype.forEach) {
                var a = minisync.from({a: ['foo', 'bar', {foo: 'bar'}]}).get('a');
                var count = 0;
                a.forEach(function(value, index, arr) {
                    count++;
                    switch (index) {
                        case 0: expect(value).toEqual('foo'); break;
                        case 1: expect(value).toEqual('bar'); break;
                        case 2:
                            expect(typeof value).toEqual('object');
                            expect(value.get('foo')).toEqual('bar');
                            break;
                        default:
                            break;
                    }
                    expect(arr).not.toBeNull();
                    expect(arr.length).toEqual(3);
                });
                expect(count).toEqual(3);
            }
        });

        it('should implement indexOf', function() {
            var orig = ['one', 'two', { key: 'three'}, 'four'];
            var a = minisync.from({test: orig}).get('test');
            expect(a.indexOf).not.toBeUndefined();
            for (var i = 0; i < orig.length; i++) {
                expect(a.indexOf(orig[i])).toEqual(i);
            }
            var obj = a.get(2);
            expect(a.indexOf(obj)).toEqual(2);
        });

        it('should implement pop', function() {
            var a = minisync.from({v: ['one', {foo: 'bar'}, {foo: 'baz'}]}).get('v');
            var item = a.pop();
            expect(a.getData().length).toEqual(2);
            expect(item).not.toBeNull();
            expect(item.foo).toEqual('baz');
        });

        it('should implement push', function() {
            var a = minisync.from({v: []}).get('v');
            a.push('foo', 'bar');
            expect(a.getData().length).toEqual(2);
            expect(a.get(0)).toEqual('foo');
            expect(a.get(1)).toEqual('bar');
        });

        it('should implement reverse', function() {
            var a = minisync.from({v: [1, 2, 3]}).get('v');
            expect(a.reverse().join('')).toEqual('321');
        });

        it('should implement shift', function() {
            var a = minisync.from({v: [{ foo: 'bar'}, 2, 3]}).get('v');
            expect(a.getData().length).toEqual(3);
            var v = a.shift();
            expect(a.getData().length).toEqual(2);
            expect(a.join('')).toEqual('23');
            expect(typeof v).toEqual('object');
            expect(v.foo).toEqual('bar');
        });

        it('should implement splice', function() {
            var a = minisync.from({v: [1, 2, {foo: 3}, 4, 5]}).get('v');
            var res = a.splice(2, 2, 3, {bar: 4});
            expect(isArray(res)).toBeTruthy();
            expect(res.length).toEqual(2);
            expect(typeof res[0]).toEqual('object');
            expect(res[0].foo).toEqual(3);
            expect(res[1]).toEqual(4);
            expect(a.get(2)).toEqual(3);
            expect(typeof a.get(3)).toEqual('object');
            expect(a.get('[3].bar')).toEqual(4);
        });

        it('should implement unshift', function() {
            var a = minisync.from({v: [2]}).get('v');
            expect(a.unshift(1)).toEqual(2);
            expect(a.join(',')).toEqual('1,2');
        });

        it('should implement sort', function() {
            var a = minisync.from({v: [1, {v: 2}, -1]}).get('v');
            var sorted = a.sort();
            expect(sorted[0]).toEqual(-1);
            expect(sorted[1]).toEqual(1);
            expect(typeof sorted[2]).toEqual('object');
            sorted = a.sort(function(first, second) {
                first = first.v || first;
                second = second.v || second;
                if (String(first) < String(second)) return 1;
                if (String(first) > String(second)) return -1;
                return 0;
            });
            expect(typeof sorted[0]).toEqual('object');
            expect(sorted[1]).toEqual(1);
            expect(sorted[2]).toEqual(-1);
        });

    });

    var compareObjects = function(obj1, obj2, includeS, path) {
        for (var key in obj1) {
            if (!includeS && (key === '_s')) continue;
            if (obj1.hasOwnProperty(key)) {
                var testing = (path || '') + '[' + key + ']';
                expect(typeof obj1[key]).toEqual(typeof obj2[key]);
                if (typeof obj1[key] === 'object') {
                    expect(isArray(obj1[key])).toEqual(isArray(obj2[key]));
                    compareObjects(obj1[key], obj2[key], includeS, testing);
                } else {
                    expect(obj1[key]).toEqual(obj2[key]);
                }
            }
        }
    };

    describe('client interaction', function() {

        it('should have a unique client id', function() {
            var c1 = minisync.from({foo: 'bar'});
            var c2 = minisync.from({foo: 'bar'});
            var id1 = c1.getClientID();
            expect(id1).not.toBeNull();
            expect(typeof id1).toEqual('string');
            expect(id1.length).toEqual(16);
            expect(id1).toEqual(c1.getClientID());
            expect(c1).not.toEqual(c2.getClientID());
        });

        it('should obtain changes', function() {
            var o = minisync.from({foo: 'bar'});
            var changes = o.getChanges('client1');
            expect(changes).not.toBeNull();
            expect(changes.sentBy).toEqual(o.getClientID());
            expect(changes.fromVersion).toEqual(o.getDocVersion());
            expect(changes.changes).not.toBeNull();
            expect(changes.changes.foo).toEqual('bar');
            o.set('foo', 'baz');
            changes = o.getChanges('client1');
            expect(changes).not.toBeNull();
            expect(changes.sentBy).toEqual(o.getClientID());
            expect(changes.fromVersion).toEqual(o.getDocVersion());
            expect(changes.changes).not.toBeNull();
            expect(changes.changes.foo).toEqual('baz');
        });

        it('should initialize from a changes object', function() {
            var c1 = minisync.from({foo: {bar: {baz: 42}}});
            var c2 = minisync.from(c1.getChanges());
            compareObjects(c1.data, c2.data);
        });

        it('should merge changes for objects', function() {
            // initial sync
            var client1 = minisync.from({foo: 1, bar: 1});
            var client2 = minisync.from();
            client2.mergeChanges(client1.getChanges(client2.getClientID()));
            compareObjects(client1.data, client2.data);
            // replacing non-object value with object value
            client2.set('bar', { baz: 'test' });
            client1.mergeChanges(client2.getChanges(client1.getClientID()));
            compareObjects(client1.data, client2.data);
            // updating only a nested property
            client2.get('bar').set('baz', 'changed');
            client1.mergeChanges(client2.getChanges(client1.getClientID()));
            compareObjects(client2.data, client1.data);
            // one more sync to make client2 realize client1 got all the updates
            client2.mergeChanges(client1.getChanges(client2.getClientID()));
            compareObjects(client1.data, client2.data);
            expect(client1.getChanges(client2.getClientID()).changes).toBeNull();
            expect(client2.getChanges(client1.getClientID()).changes).toBeNull();
        });

        it('should merge changes without knowing client id', function() {
            // initial sync
            var client1 = minisync.from({foo: 1, bar: 1});
            var client2 = minisync.from();
            client2.mergeChanges(client1.getChanges());
            compareObjects(client1.data, client2.data);
            // replacing non-object value with object value
            client2.set('bar', { baz: 'test' });
            client1.mergeChanges(client2.getChanges());
            compareObjects(client1.data, client2.data);
            // updating only a nested property
            client2.get('bar').set('baz', 'changed');
            client1.mergeChanges(client2.getChanges());
            compareObjects(client2.data, client1.data);
            // one more sync to make client2 realize client1 got all the updates
            client2.mergeChanges(client1.getChanges());
            compareObjects(client1.data, client2.data);
            // are they really synchronized?
            expect(client1.getChanges(client2.getClientID()).changes).toBeNull();
            expect(client2.getChanges(client1.getClientID()).changes).toBeNull();
        });

        it('should merge client states across 3 clients', function() {
            var client1 = minisync.from({foo: 1});
            var client2 = minisync.from(client1.getChanges());
            var client3 = minisync.from(client2.getChanges());
            compareObjects(client1.data, client3.data);
            expect(client3.getChanges(client1.getClientID()).changes).toBeNull();

            client3.set('foo', 2);
            client1.mergeChanges(client3.getChanges(client1.getClientID()));
            compareObjects(client1.data, client3.data);
        });

        it('should merge removed objects', function() {
            var client1 = minisync.from({foo: {o: 1}, bar: {o: 2}});
            var client2 = minisync.from(client1.getChanges());
            compareObjects(client1.data, client2.data);
            client1.get('bar').remove();
            client2.mergeChanges(client1.getChanges());
            expect(client2.get('bar')).toBeNull();
        });

        it('should implement the example from the readme', function() {
            var alice = minisync.from({ foo: 'initial state goes here' });
            // this client is known as 'alice'
            alice.setClientID('alice');
            // make changes
            alice.set('foo', {bar: ['baz']});
            alice.set('foo.bar[1]', 'quu');
            // get a changes object that contains everything (can be sent to any client)
            var changes = JSON.parse(JSON.stringify(alice.getChanges()));

            // create document initially from master changes object received from alice
            var bob = minisync.from(changes);
            // this client is known as bob
            bob.setClientID('bob');
            // make a change
            bob.get('foo.bar').push('foo you too');
            // make delta object for alice
            var bobsdelta = JSON.stringify(bob.getChanges('alice'));

            alice = minisync.restore(changes);
            // receive changes from bob
            alice.mergeChanges(JSON.parse(bobsdelta));

            // should be identical at this point
            compareObjects(alice.data, bob.data);

            // make a change
            alice.set('foo.bar', []);
            // get a changes object for bob (delta containing only changes new to bob)
            var alicesdelta = JSON.stringify(alice.getChanges('bob'));

            // merge delta changes from alice
            bob.mergeChanges(JSON.parse(alicesdelta));

            // should be identical again
            compareObjects(alice.data, bob.data);
        });

        describe('array synchronization', function() {
            it('should initialize from a changes object', function() {
                var c1 = minisync.from({a: [{o: 1}, {o: 2}, {o: 3}]});
                var c2 = minisync.from(c1.getChanges());
                compareObjects(c1.data, c2.data);
            });

            it('should merge intervals', function() {
                var a = minisync.from({a: [{foo: 'bar'}, 'test', {foo: 'baz'}]}).get('a');
                var id1 = a.get(0).getID();
                var id2 = a.get(2).getID();
                a.mergeInterval({after: id1, before: id2, values: ['test2', 'test3']});
                expect(a.length()).toEqual(4);
                expect(a.get(1)).toEqual('test2');
                expect(a.get(2)).toEqual('test3');
            });

            it('should extract intervals', function() {
                var c1 = minisync.from({a: [{o: 1}, {o: 2}, {o: 3}]});
                var c2 = minisync.from(c1.getChanges());
                c1.get('a').splice(2, 0, 3, 4);
                c1.get('a').splice(1, 0, 1, 2);
                c1.get('a').push(5);
                // c1 = {a: [{o:1},1,2,{o:2},3,4,{o:3},5]}
                // note that empty intervals are not merged,
                // so there is no interval before the first object
                var expectedIntervals = [
                    {after: c2.get('a[0]').getID(), before: c2.get('a[1]').getID(), values: [1, 2]},
                    {after: c2.get('a[1]').getID(), before: c2.get('a[2]').getID(), values: [3, 4]},
                    {after: c2.get('a[2]').getID(), before: null, values: [5]}
                ];
                var expectedIntervalIndex = 0;
                spyOn(minisync._private.SyncableArray.prototype, 'mergeInterval').andCallFake(
                    function(interval) {
                        var expectedInterval = expectedIntervals[expectedIntervalIndex++];
                        compareObjects(interval, expectedInterval);
                    }
                );
                c2.mergeChanges(c1.getChanges());
                expect(expectedIntervalIndex).toEqual(3);
            });

            it('should synchronize primitive values', function() {
                var c1 = minisync.from({a: ['test', 123, false]});
                var c2 = minisync.from({});
                c2.mergeChanges(c1.getChanges());
                compareObjects(c1.data, c2.data);
                c2.set('a[1]', 321);
                c2.mergeChanges(c1.getChanges());
                expect(c2.get('a[1]')).toEqual(321);
                c2.get('a').pop();
                c1.mergeChanges(c2.getChanges());
                compareObjects(c1.data, c2.data);
            });

            it('should synchronize object values', function() {
                var c1 = minisync.from({a: [{foo: 'bar'}, {foo: 'baz'}]});
                var c2 = minisync.from(c1.getChanges());
                compareObjects(c1.data, c2.data);
                // make sure they're fully synchronized
                c1.mergeChanges(c2.getChanges());
                // this doesn't update the array, but should still sync
                c2.set('a[1].foo', {nested: true});
                c1.mergeChanges(c2.getChanges());
                compareObjects(c1.data, c2.data);
            });

            it('should keep new local object values', function() {
                var c1 = minisync.from({ a: [{o: 1}, {o: 2}]});
                var c2 = minisync.from(c1.getChanges());
                c1.set('a[1].o', 3);
                c1.get('a').splice(1, 0, 5);
                c2.get('a').splice(1, 0, {l: 1});
                c2.mergeChanges(c1.getChanges());
                expect(c2.get('a').length()).toEqual(4);
                expect(c2.get('a[0].o')).toEqual(1);
                expect(c2.get('a[1]')).toEqual(5);
                expect(c2.get('a[2].l')).toEqual(1);
                expect(c2.get('a[3].o')).toEqual(3);
            });

            it('should synchronize in both directions', function() {
                var c1 = minisync.from({ a: [{o: 1}, {o: 2}]});
                var c2 = minisync.from(c1.getChanges());
                var a1 = c1.get('a');
                a1.splice(1, 0, {r: 1});
                a1.push({r: 2});
                var a2 = c2.get('a');
                a2.splice(1, 0, {l: 1});
                a2.unshift({l: 2});
                c2.mergeChanges(c1.getChanges());
                // c2.a = [{l:2},{o:1},{r:1},{l:1},{o:2},{r:2}]
                expect(c2.get('a').length()).toEqual(6);
                expect(c2.get('a[0].l')).toEqual(2);
                expect(c2.get('a[1].o')).toEqual(1);
                expect(c2.get('a[2].r')).toEqual(1);
                expect(c2.get('a[3].l')).toEqual(1);
                expect(c2.get('a[4].o')).toEqual(2);
                expect(c2.get('a[5].r')).toEqual(2);
                c1.mergeChanges(c2.getChanges());
                compareObjects(c1.getData(), c2.getData());
            });

            it('should merge removed objects', function() {
                var c1 = minisync.from({a: [{o: 1}, {o: 2}, {o: 3}]});
                var c2 = minisync.from(c1.getChanges());
                c1.get('a').splice(1, 1);
                c2.mergeChanges(c1.getChanges());
                expect(c2.get('a').length()).toEqual(2);
                expect(c2.get('a[0].o')).toEqual(1);
                expect(c2.get('a[1].o')).toEqual(3);
            });
        });

    });

    describe('dateToString', function() {
        it('should output a valid date string', function() {
            var date = new Date();
            date.setUTCFullYear(2011);
            date.setUTCMonth(11);
            date.setUTCDate(19);
            date.setUTCHours(22);
            date.setUTCMinutes(15);
            date.setUTCSeconds(0);
            var dateStr = minisync._private.dateToString(date);
            expect(dateStr).toEqual('20111219221500');
        });
    });

    describe('persistence', function() {
        it('should persist and restore', function() {
            var o1 = minisync.from({
                foo: 'bar',
                baz: [
                    'quu',
                    { qux: 'xyzzy'}
                ]
            });
            // create a remote client state
            o1.getChanges("alice");
            var s = JSON.parse(JSON.stringify(o1.getChanges()));
            var o2 = minisync.restore(s);
            // o1 and o2 should be identical
            expect(o2.getClientID()).toEqual(o1.getClientID());
            expect(o2.getDocVersion()).toEqual(o1.getDocVersion());
            compareObjects(o1.data, o2.data, true);
        });
    });

    describe('proxy', function() {
        it('should synchronize after nested changes', function() {
            var o1 = minisync.from({
                foo: 'bar',
                bar: [ 'quu', {
                    'baz': 'qux'
                }]
            });
            // does it look right?
            var p = o1.getProxy();
            expect(p.foo).toEqual('bar');
            expect(isArray(p.bar)).toBeTruthy();
            expect(p.bar.length).toEqual(2);
            expect(p.bar[0]).toEqual('quu');
            expect(typeof p.bar[1]).toEqual('object');
            expect(p.bar[1].baz).toEqual('qux');
            // change it, sync it, and check it looks fine
            p.foo = 'a';
            p.bar[0] = 'b';
            p.bar[1].baz = 'c';
            p.quu = 'd';
            var c2 = minisync.from(o1.getChanges());
            compareObjects(c2.getData(), {
                'foo': 'a',
                'bar': ['b', {
                    baz: 'c'
                }],
                'quu': 'd'
            });
            delete p.quu;
            c2.mergeChanges(o1.getChanges());
            expect(c2.getData().quu).toBeUndefined();
        });
    });
});
