describe('minisync', function() {

    function isArray(v) {
        return Object.prototype.toString.call(v) === '[object Array]';
    }

    describe('uid', function() {

        it('should be unique a thousand times', function() {
            var uids = [], uid = null;
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
            var o = minisync(data);
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
            var o = minisync(data);
            expect(o.get('foo')).toEqual('bar');
            expect(o.get('baz').get).not.toBeNull();
            expect(o.get('baz').get('foo')).toEqual('quu');
        });

        it('should update properties', function() {
            var data = { foo: 'bar' };
            var o = minisync(data);
            var oldVersion = o.getDocVersion();
            o.set('foo', 'baz');
            expect(data.foo).toEqual('baz');
            expect(data._s).not.toBeNull();
            expect(data._s.u).not.toBeNull();
            expect(o.getDocVersion()).not.toEqual(oldVersion);
            oldVersion = o.getDocVersion();
            o.set('quu', 'qux');
            expect(data['quu']).toEqual('qux');
            expect(o.getDocVersion()).not.toEqual(oldVersion);
        });

        it('should return a raw data object', function() {
            var o = minisync({foo: 'bar'});
            o.set('bar', 'baz');
            o.set('baz', { foo: 'bar' });
            var data = o.getData();
            expect(typeof data).toEqual('object');
            expect(data['_s']).toBeUndefined();
            expect(data.foo).toEqual('bar');
            expect(data.bar).toEqual('baz');
            expect(typeof data.baz).toEqual('object');
            expect(data.baz['_s']).toBeUndefined();
            expect(data.baz.foo).toEqual('bar');
        });

        it('should have smart get and set syntax', function() {
            var data = { foo: 'bar', baz: { 'foo': 'quu' } };
            var o = minisync(data);
            expect(o.get('baz.foo')).toEqual('quu');
            o.set('baz.foo', {test: 'bingo'});
            expect(data.baz.foo.test).toEqual('bingo');
            expect(o.get('baz.foo.test')).toEqual('bingo');
        });

        it('should update properties in child objects', function() {
            var data = { child: { foo: 'bar' }};
            var o = minisync(data);
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
            var o = minisync({foo: { bar: { baz: 'quu' } }});
            o.get('foo').get('bar').remove();
            var d = o.getData();
            expect(typeof d).toEqual('object');
            expect(typeof d.foo).toEqual('object');
            expect(d.foo['bar']).toBeUndefined();
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
            var o = minisync(data);
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
            var a = minisync({a: []}).get('a');
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
            var o = minisync({foo: [null, 'bar']});
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
            var o = minisync({ test: ['bar', {foo: 'bar'}]});
            var data = o.getData().test;
            expect(isArray(data)).toBeTruthy();
            expect(data.length).toEqual(2);
            expect(data['_s']).toBeUndefined();
            expect(data[0]).toEqual('bar');
            expect(typeof data[1]).toEqual('object');
            expect(data[1].foo).toEqual('bar');
            expect(data[1]['_s']).toBeUndefined();
        });

        it('should keep track of removed items', function() {
            var data = minisync({ v: [{foo: 'bar'},{bar:'baz'}]}).get('v');
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
            var v = minisync({v: ['one', 'two']}).get('v');
            expect(v.concat).not.toBeUndefined();
            var a = v.concat(['three']);
            expect(isArray(a)).toBeTruthy();
            expect(a.length).toEqual(3);
            expect(a[2]).toEqual('three');
        });

        it('should implement forEach', function() {
            if (Array.prototype.forEach) {
                var a = minisync({a: ['foo', 'bar', {foo: 'bar'}]}).get('a');
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
                    }
                    expect(arr).not.toBeNull();
                    expect(arr.length).toEqual(3);
                });
                expect(count).toEqual(3);
            }
        });

        it('should implement indexOf', function() {
            var orig = ['one', 'two', { key: 'three'}, 'four'];
            var a = minisync({test: orig}).get('test');
            expect(a.indexOf).not.toBeUndefined();
            for (var i = 0; i < orig.length; i++) {
                expect(a.indexOf(orig[i])).toEqual(i);
            }
            var obj = a.get(2);
            expect(a.indexOf(obj)).toEqual(2);
        });

        it('should implement pop', function() {
            var a = minisync({v: ['one', {foo: 'bar'}, {foo: 'baz'}]}).get('v');
            var item = a.pop();
            expect(a.getData().length).toEqual(2);
            expect(item).not.toBeNull();
            expect(item.foo).toEqual('baz');
        });

        it('should implement push', function() {
            var a = minisync({v: []}).get('v');
            a.push('foo', 'bar');
            expect(a.getData().length).toEqual(2);
            expect(a.get(0)).toEqual('foo');
            expect(a.get(1)).toEqual('bar');
        });

        it('should implement reverse', function() {
            var a = minisync({v: [1, 2, 3]}).get('v');
            expect(a.reverse().join('')).toEqual('321');
        });

        it('should implement shift', function() {
            var a = minisync({v: [{ foo: 'bar'}, 2, 3]}).get('v');
            expect(a.getData().length).toEqual(3);
            var v = a.shift();
            expect(a.getData().length).toEqual(2);
            expect(a.join('')).toEqual('23');
            expect(typeof v).toEqual('object');
            expect(v.foo).toEqual('bar');
        });

        it('should implement splice', function() {
            var a = minisync({v: [1, 2, {foo: 3}, 4, 5]}).get('v');
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
            var a = minisync({v: [2]}).get('v');
            expect(a.unshift(1)).toEqual(2);
            expect(a.join(',')).toEqual('1,2');
        });

    });

    describe('client interaction', function() {

        var compareObjects = function(obj1, obj2) {
            for (var key in obj1) {
                if (key === '_s') continue;
                if (obj1.hasOwnProperty(key)) {
                    expect(typeof obj1[key]).toEqual(typeof obj2[key]);
                    if (typeof obj1[key] === 'object') {
                        expect(isArray(obj1[key])).toEqual(isArray(obj2[key]));
                        compareObjects(obj1[key], obj2[key]);
                    } else {
                        expect(obj1[key]).toEqual(obj2[key]);
                    }
                }
            }
        };

        it('should have a unique client id', function() {
            var c1 = minisync({foo: 'bar'});
            var c2 = minisync({foo: 'bar'});
            var id1 = c1.getClientID();
            expect(id1).not.toBeNull();
            expect(typeof id1).toEqual('string');
            expect(id1.length).toEqual(16);
            expect(id1).toEqual(c1.getClientID());
            expect(c1).not.toEqual(c2.getClientID());
        });

        it('should obtain changes', function() {
            var o = minisync({foo: 'bar'});
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

        it('should merge changes for objects', function() {
            // initial sync
            var client1 = minisync({foo: 1, bar: 1});
            var client2 = minisync();
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
            var client1 = minisync({foo: 1, bar: 1});
            var client2 = minisync();
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
            var client1 = minisync({foo: 1});
            var client2 = minisync(client1.getChanges());
            var client3 = minisync(client2.getChanges());
            compareObjects(client1.data, client3.data);
            expect(client3.getChanges(client1.getClientID()).changes).toBeNull();

            client3.set('foo', 2);
            client1.mergeChanges(client3.getChanges(client1.getClientID()));
            compareObjects(client1.data, client3.data);
        });

        // TODO: re-enable array synchronization tests
/*        describe('array synchronization', function() {
            it('should synchronize primitive values', function() {
                var c1 = minisync({a: ['test', 123, false]});
                var c2 = minisync({});
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
                var c1 = minisync({a: [{foo: 'bar'}, {foo: 'baz'}]});
                var c2 = minisync(c1.getChanges());
                compareObjects(c1.data, c2.data);
                // make sure they're fully synchronized
                c1.mergeChanges(c2.getChanges());
                // this doesn't update the array, but should still sync
                c2.set('a[1].foo', {nested: true});
                c1.mergeChanges(c2.getChanges());
                compareObjects(c1.data, c2.data);
            });
        });*/
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

});
