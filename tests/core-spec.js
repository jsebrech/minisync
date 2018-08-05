// @ts-ignore
describe('minisync core', function() {

    let minisync;

    // @ts-ignore
    beforeAll(function(done) {
        // @ts-ignore
        require(['minisync'], function(m) {
            minisync = m;
            done();
        });
    });

    // @ts-ignore
    describe('uid', function() {

        // @ts-ignore
        it('should be unique a thousand times', function() {
            var uids = [];
            var uid = null;
            for (var i = 0; i < 1000; i++) {
                uid = minisync.createID();
                // @ts-ignore
                expect(uids.indexOf(uid)).toEqual(-1);
                uids.push(uid);
            }
        });

        // @ts-ignore
        it('should be an 8 char string', function() {
            var uid = minisync.createID();
            // @ts-ignore
            expect(typeof uid).toEqual('string');
            // @ts-ignore
            expect(uid.length).toEqual(8);
        });

        // @ts-ignore
        it('should also generate a 16 char string', function() {
            var uid = minisync._private.createLongID();
            // @ts-ignore
            expect(typeof uid).toEqual('string');
            // @ts-ignore
            expect(uid.length).toEqual(16);
        });

    });

    // @ts-ignore
    describe('version', function() {

        // @ts-ignore
        it('should generate an initial version', function() {
            var version = minisync._private.nextVersion();
            // @ts-ignore
            expect(typeof version).toEqual('string');
            // @ts-ignore
            expect(version.length).toEqual(1);
        });

        // @ts-ignore
        it('should be different after incrementing', function() {
            var previous = [];
            var version = '';
            for (var i = 0; i < 100; i++) {
                version = minisync._private.nextVersion(version);
                // @ts-ignore
                expect(previous.indexOf(version)).toEqual(-1);
                previous.push(version);
            }
        });

        // @ts-ignore
        it('should be larger after incrementing', function() {
            var previous = '';
            for (var i = 0; i < 100; i++) {
                var version = minisync._private.nextVersion(previous, 5);
                // @ts-ignore
                expect(version).toBeGreaterThan(previous);
                previous = version;
            }
        });

        // @ts-ignore
        it('should pad to the right length', function() {
            // @ts-ignore
            expect(minisync._private.nextVersion('').length).toEqual(1);
            // @ts-ignore
            expect(minisync._private.nextVersion('', 1).length).toEqual(1);
            // @ts-ignore
            expect(minisync._private.nextVersion('A', 1).length).toEqual(1);
            // @ts-ignore
            expect(minisync._private.nextVersion('AA', 5).length).toEqual(5);
            // @ts-ignore
            expect(minisync._private.nextVersion('AA', 100).length).toEqual(100);
        });

        // @ts-ignore
        it('should sort correctly after padding', function() {
            var a = minisync._private.nextVersion('a', 5);
            var bb = minisync._private.nextVersion('bb', 5);
            // @ts-ignore
            expect(bb).toBeGreaterThan(a);
        });

    });

    // @ts-ignore
    describe('object handling', function() {
        // @ts-ignore
        it('should initialize properly', function() {
            var data = { foo: 'bar' };
            var o = minisync.from(data);
            // @ts-ignore
            expect(typeof o).toEqual('object');
            // @ts-ignore
            expect(o.getData).not.toBeUndefined();
            var oData = o.getData();
            // @ts-ignore
            expect(typeof oData).toEqual('object');
            // @ts-ignore
            expect(oData.foo).toEqual('bar');
            // @ts-ignore
            expect(o.getID()).not.toBeNull();
            // @ts-ignore
            expect(typeof o.getTimeStamp()).toEqual('string');
            // @ts-ignore
            expect(o.getTimeStamp().length).toEqual(14);
        });

        // @ts-ignore
        it('should return properties', function() {
            var data = { foo: 'bar', baz: { 'foo': 'quu' } };
            var o = minisync.from(data);
            // @ts-ignore
            expect(o.get('foo')).toEqual('bar');
            // @ts-ignore
            expect(o.get('baz').get).not.toBeNull();
            // @ts-ignore
            expect(o.get('baz').get('foo')).toEqual('quu');
        });

        // @ts-ignore
        it('should update properties', function() {
            var data = { foo: 'bar' };
            var o = minisync.from(data);
            var oldVersion = o.getDocVersion();
            o.set('foo', 'baz');
            // @ts-ignore
            expect(data.foo).toEqual('baz');
            // @ts-ignore
            expect(data._s).not.toBeNull();
            // @ts-ignore
            expect(data._s.u).not.toBeNull();
            // @ts-ignore
            expect(o.getDocVersion()).not.toEqual(oldVersion);
            oldVersion = o.getDocVersion();
            o.set('quu', 'qux');
            // @ts-ignore
            expect(data.quu).toEqual('qux');
            // @ts-ignore
            expect(o.getDocVersion()).not.toEqual(oldVersion);
        });

        // @ts-ignore
        it('should return a raw data object', function() {
            var o = minisync.from({foo: 'bar'});
            o.set('bar', 'baz');
            o.set('baz', { foo: 'bar' });
            var data = o.getData();
            // @ts-ignore
            expect(typeof data).toEqual('object');
            // @ts-ignore
            expect(data._s).toBeUndefined();
            // @ts-ignore
            expect(data.foo).toEqual('bar');
            // @ts-ignore
            expect(data.bar).toEqual('baz');
            // @ts-ignore
            expect(typeof data.baz).toEqual('object');
            // @ts-ignore
            expect(data.baz._s).toBeUndefined();
            // @ts-ignore
            expect(data.baz.foo).toEqual('bar');
        });

        // @ts-ignore
        it('should have smart get and set syntax', function() {
            var data = { foo: 'bar', baz: { 'foo': 'quu' } };
            var o = minisync.from(data);
            // @ts-ignore
            expect(o.get('baz.foo')).toEqual('quu');
            o.set('baz.foo', {test: 'bingo'});
            // @ts-ignore
            expect(data.baz.foo.test).toEqual('bingo');
            // @ts-ignore
            expect(o.get('baz.foo.test')).toEqual('bingo');
        });

        // @ts-ignore
        it('should update properties in child objects', function() {
            var data = { child: { foo: 'bar' }};
            var o = minisync.from(data);
            var oldVersion = o.getVersion(); // version for master object
            var oldDocVersion = o.getDocVersion(); // version for document
            var oldChildVersion = o.get('child').getVersion(); // version for child object
            o.get('child').set('foo', 'baz');
            // @ts-ignore
            expect(data.child.foo).toEqual('baz');
            // @ts-ignore
            expect(o.getVersion()).toEqual(oldVersion);
            // @ts-ignore
            expect(o.getDocVersion()).not.toEqual(oldDocVersion);
            // @ts-ignore
            expect(o.get('child').getVersion()).not.toEqual(oldChildVersion);
        });

        // @ts-ignore
        it('should handle removed objects', function() {
            var o = minisync.from({foo: { bar: { baz: 'quu' } }});
            o.get('foo').get('bar').remove();
            var d = o.getData();
            // @ts-ignore
            expect(typeof d).toEqual('object');
            // @ts-ignore
            expect(typeof d.foo).toEqual('object');
            // @ts-ignore
            expect(d.foo.bar).toBeUndefined();
        });

        // @ts-ignore
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
            // @ts-ignore
            expect(changes).toBeNull();
            o.set('key2.key4.key5', 'changed');
            changes = o.getChangesSince(o.getDocVersion());
            // @ts-ignore
            expect(changes).toBeNull();
            changes = o.getChangesSince(initialVersion);
            // @ts-ignore
            expect(changes).not.toBeNull();
            // @ts-ignore
            expect(changes.key1).toBeUndefined();
            // @ts-ignore
            expect(changes.key2).not.toBeUndefined();
            // @ts-ignore
            expect(changes.key2.key3).toBeUndefined();
            // @ts-ignore
            expect(changes.key2.key4).not.toBeUndefined();
            // @ts-ignore
            expect(changes.key2.key4.key5).toEqual('changed');
            // @ts-ignore
            expect(changes.key2.key4.key6).toBeUndefined();
            // @ts-ignore
            expect(changes.key2.key4.key7).toEqual('bar');
        });
    });

    // @ts-ignore
    describe('array handling', function() {
        // @ts-ignore
        it('should support get() and set()', function() {
            var a = minisync.from({a: []}).get('a');
            a.set(0, 'foo');
            a.set(2, 'bar');
            var data = a.getData();
            // @ts-ignore
            expect(isArray(data)).toBeTruthy();
            // @ts-ignore
            expect(data.length).toEqual(3);
            // @ts-ignore
            expect(data[0]).toEqual('foo');
            // @ts-ignore
            expect(data[2]).toEqual('bar');
            // @ts-ignore
            expect(a.get(0)).toEqual('foo');
            // @ts-ignore
            expect(a.get('0')).toEqual('foo');
            // @ts-ignore
            expect(a.get('2')).toEqual('bar');
        });

        // @ts-ignore
        it('should support nested get() and set()', function() {
            var o = minisync.from({foo: [null, 'bar']});
            // @ts-ignore
            expect(o.get('foo[1]')).toEqual('bar');
            o.set('foo[1]', 'baz');
            // @ts-ignore
            expect(isArray(o.get('foo').getData())).toBeTruthy();
            // @ts-ignore
            expect(o.get('foo').get(1)).toEqual('baz');
            // @ts-ignore
            expect(o.get('foo[1]')).toEqual('baz');
            o.set('foo[1]', ['test']);
            o.set('foo[1][2]', 'bar');
            // @ts-ignore
            expect(o.get('foo[1][2]')).toEqual('bar');
            var data = o.get('foo[1]').getData();
            // @ts-ignore
            expect(isArray(data)).toBeTruthy();
            // @ts-ignore
            expect(data.length).toEqual(3);
            // @ts-ignore
            expect(data[2]).toEqual('bar');
            o.get('foo').set('[1][2]', 'baz');
            // @ts-ignore
            expect(o.get('foo[1][2]')).toEqual('baz');
        });

        // @ts-ignore
        it('should return raw data', function() {
            var o = minisync.from({ test: ['bar', {foo: 'bar'}]});
            var data = o.getData().test;
            // @ts-ignore
            expect(isArray(data)).toBeTruthy();
            // @ts-ignore
            expect(data.length).toEqual(2);
            // @ts-ignore
            expect(data._s).toBeUndefined();
            // @ts-ignore
            expect(data[0]).toEqual('bar');
            // @ts-ignore
            expect(typeof data[1]).toEqual('object');
            // @ts-ignore
            expect(data[1].foo).toEqual('bar');
            // @ts-ignore
            expect(data[1]._s).toBeUndefined();
        });

        // @ts-ignore
        it('should keep track of removed items', function() {
            var data = minisync.from({ v: [{foo: 'bar'}, {bar: 'baz'}]}).get('v');
            // @ts-ignore
            expect(data.getData().length).toEqual(2);
            var itemID = data.get(0).getID();
            var updatedAt = data.getState().u;
            data.removeAt(0);
            // @ts-ignore
            expect(data.getData().length).toEqual(1);
            // @ts-ignore
            expect(data.getState().u).not.toEqual(updatedAt);
            // @ts-ignore
            expect(isArray(data.getRemoved())).toBeTruthy();
            // @ts-ignore
            expect(data.getRemoved().length).toEqual(1);
            // @ts-ignore
            expect(data.getRemoved()[0].id).toEqual(itemID);
        });

        // @ts-ignore
        it('should implement concat', function() {
            var v = minisync.from({v: ['one', 'two']}).get('v');
            // @ts-ignore
            expect(v.concat).not.toBeUndefined();
            var a = v.concat(['three']);
            // @ts-ignore
            expect(isArray(a)).toBeTruthy();
            // @ts-ignore
            expect(a.length).toEqual(3);
            // @ts-ignore
            expect(a[2]).toEqual('three');
        });

        // @ts-ignore
        it('should implement forEach', function() {
            if (Array.prototype.forEach) {
                var a = minisync.from({a: ['foo', 'bar', {foo: 'bar'}]}).get('a');
                var count = 0;
                a.forEach(function(value, index, arr) {
                    count++;
                    switch (index) {
                        // @ts-ignore
                        case 0: expect(value).toEqual('foo'); break;
                        // @ts-ignore
                        case 1: expect(value).toEqual('bar'); break;
                        case 2:
                            // @ts-ignore
                            expect(typeof value).toEqual('object');
                            // @ts-ignore
                            expect(value.get('foo')).toEqual('bar');
                            break;
                        default:
                            break;
                    }
                    // @ts-ignore
                    expect(arr).not.toBeNull();
                    // @ts-ignore
                    expect(arr.length).toEqual(3);
                });
                // @ts-ignore
                expect(count).toEqual(3);
            }
        });

        // @ts-ignore
        it('should implement indexOf', function() {
            var orig = ['one', 'two', { key: 'three'}, 'four'];
            var a = minisync.from({test: orig}).get('test');
            // @ts-ignore
            expect(a.indexOf).not.toBeUndefined();
            for (var i = 0; i < orig.length; i++) {
                // @ts-ignore
                expect(a.indexOf(orig[i])).toEqual(i);
            }
            var obj = a.get(2);
            // @ts-ignore
            expect(a.indexOf(obj)).toEqual(2);
        });

        // @ts-ignore
        it('should implement pop', function() {
            var a = minisync.from({v: ['one', {foo: 'bar'}, {foo: 'baz'}]}).get('v');
            var item = a.pop();
            // @ts-ignore
            expect(a.getData().length).toEqual(2);
            // @ts-ignore
            expect(item).not.toBeNull();
            // @ts-ignore
            expect(item.foo).toEqual('baz');
        });

        // @ts-ignore
        it('should implement push', function() {
            var a = minisync.from({v: []}).get('v');
            a.push('foo', 'bar');
            // @ts-ignore
            expect(a.getData().length).toEqual(2);
            // @ts-ignore
            expect(a.get(0)).toEqual('foo');
            // @ts-ignore
            expect(a.get(1)).toEqual('bar');
        });

        // @ts-ignore
        it('should implement reverse', function() {
            var a = minisync.from({v: [1, 2, 3]}).get('v');
            // @ts-ignore
            expect(a.reverse().join('')).toEqual('321');
        });

        // @ts-ignore
        it('should implement shift', function() {
            var a = minisync.from({v: [{ foo: 'bar'}, 2, 3]}).get('v');
            // @ts-ignore
            expect(a.getData().length).toEqual(3);
            var v = a.shift();
            // @ts-ignore
            expect(a.getData().length).toEqual(2);
            // @ts-ignore
            expect(a.join('')).toEqual('23');
            // @ts-ignore
            expect(typeof v).toEqual('object');
            // @ts-ignore
            expect(v.foo).toEqual('bar');
        });

        // @ts-ignore
        it('should implement splice', function() {
            var a = minisync.from({v: [1, 2, {foo: 3}, 4, 5]}).get('v');
            var res = a.splice(2, 2, 3, {bar: 4});
            // @ts-ignore
            expect(isArray(res)).toBeTruthy();
            // @ts-ignore
            expect(res.length).toEqual(2);
            // @ts-ignore
            expect(typeof res[0]).toEqual('object');
            // @ts-ignore
            expect(res[0].foo).toEqual(3);
            // @ts-ignore
            expect(res[1]).toEqual(4);
            // @ts-ignore
            expect(a.get(2)).toEqual(3);
            // @ts-ignore
            expect(typeof a.get(3)).toEqual('object');
            // @ts-ignore
            expect(a.get('[3].bar')).toEqual(4);
        });

        // @ts-ignore
        it('should implement unshift', function() {
            var a = minisync.from({v: [2]}).get('v');
            // @ts-ignore
            expect(a.unshift(1)).toEqual(2);
            // @ts-ignore
            expect(a.join(',')).toEqual('1,2');
        });

        // @ts-ignore
        it('should implement sort', function() {
            var a = minisync.from({v: [1, {v: 2}, -1]}).get('v');
            var sorted = a.sort();
            // @ts-ignore
            expect(sorted[0]).toEqual(-1);
            // @ts-ignore
            expect(sorted[1]).toEqual(1);
            // @ts-ignore
            expect(typeof sorted[2]).toEqual('object');
            sorted = a.sort(function(first, second) {
                first = first.v || first;
                second = second.v || second;
                if (String(first) < String(second)) return 1;
                if (String(first) > String(second)) return -1;
                return 0;
            });
            // @ts-ignore
            expect(typeof sorted[0]).toEqual('object');
            // @ts-ignore
            expect(sorted[1]).toEqual(1);
            // @ts-ignore
            expect(sorted[2]).toEqual(-1);
        });
    });

    // @ts-ignore
    describe('dateToString', function() {
        // @ts-ignore
        it('should output a valid date string', function() {
            var date = new Date();
            date.setUTCFullYear(2011);
            date.setUTCMonth(11);
            date.setUTCDate(19);
            date.setUTCHours(22);
            date.setUTCMinutes(15);
            date.setUTCSeconds(0);
            var dateStr = minisync._private.dateToString(date);
            // @ts-ignore
            expect(dateStr).toEqual('20111219221500');
        });
    });

});
