describe("minisync p2p", function() {

    function isArray(v) {
        return Object.prototype.toString.call(v) === '[object Array]';
    }

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
