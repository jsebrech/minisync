// @ts-nocheck
describe("minisync storage", function() {

    let storage, minisync;

    beforeAll(function(done) {
        require(['storage/index', 'minisync'], function(s, m) {
            storage = s;
            minisync = m;
            done();
        });
    });

    describe("localStorage", function() {

        let store;

        beforeAll(function() {
            store = new storage.LocalStorageStore("test");
        });

        beforeEach(function() {
            window.localStorage.clear();
        });

        it("should load a file", function(done) {
            window.localStorage.setItem("test//path/file", "foo");
            store.getFile({ path: ["path"], fileName: "file"}).then(function(result) {
                expect(typeof result).toEqual("object");
                expect(typeof result.path).toEqual("object");
                expect(result.path[0]).toEqual("path");
                expect(result.fileName).toEqual("file");
                expect(result.contents).toEqual("foo");
                done();
            })
        });

        it("should save a file", function(done) {
            store.putFile({ 
                path: ["path"], 
                fileName: "file2", 
                contents: "bar"
            }).then(function(result) {
                expect(result).toEqual(true);
                expect(window.localStorage.getItem("test//path/file2")).toEqual("bar");
                done();
            })
        });

        it("should load several files", function(done) {
            window.localStorage.setItem("test//path/file1", "foo");
            window.localStorage.setItem("test//path/file2", "foo");
            var data = [
                {path: ["path"], fileName: "file1"},
                {path: ["path"], fileName: "file2"}
            ];
            store.getFiles(data).then(function(result) {
                data[0].contents = data[1].contents = "foo";
                expect(typeof result).toEqual("object");
                expect(result).toEqual(data);
                done();
            });
        });

        it("should save and restore a document", function(done) {
            var original = minisync.from({v: [1, 2, {foo: "bar"}, 4, 5]});
            storage.save(original, store).then(function (documentID) {
                return storage.restore(documentID, store);
            }).then(function(restored) {
                compareObjects(original.data, restored.data);
                expect(original.getClientID()).toEqual(restored.getClientID());
                done();
            }).catch(function(reason) {
                fail(reason);
            });
        });
    });

    describe("IndexedDB", function() {

        let store;

        beforeAll(function() {
            store = new storage.IndexedDBStore("test");
        });

        beforeEach(function(done) {
            // clear database
            store.openDB().then((db) => {
                db.transaction("files", "readwrite").objectStore("files").clear().onsuccess = function() {
                    done();
                }
            });
        });

        function putFile(path, file, contents) {
            return store.openDB().then((db) => 
                db.transaction("files", "readwrite").objectStore("files").put({
                    name: file,
                    path: path,
                    file: { path: [path], fileName: file, contents }
                }, path + "/" + file)
            )
        }

        it("should load a file", function(done) {
            putFile("path", "file", "foo").then((req) => {
                req.onsuccess = function() {
                    store.getFile({ path: ["path"], fileName: "file"}).then(function(result) {
                        expect(typeof result).toEqual("object");
                        expect(typeof result.path).toEqual("object");
                        expect(result.path[0]).toEqual("path");
                        expect(result.fileName).toEqual("file");
                        expect(result.contents).toEqual("foo");
                        done();
                    })
                };    
            });
        });

        it("should save a file", function(done) {
            store.putFile({ 
                path: ["path"], 
                fileName: "file2", 
                contents: "bar"
            }).then(function(result) {
                expect(result).toEqual(true);
                store.openDB().then((db) => {
                    let req = db.transaction("files").objectStore("files").get("path/file2");
                    req.onsuccess = (e) => {
                        expect(typeof e).toEqual("object");
                        expect(typeof e.target).toEqual("object");
                        expect(typeof e.target.result).toEqual("object");
                        expect(typeof e.target.result.file).toEqual("object");
                        expect(e.target.result.name).toEqual("file2");
                        expect(e.target.result.path).toEqual("path");
                        expect(e.target.result.file.path[0]).toEqual("path");
                        expect(e.target.result.file.fileName).toEqual("file2");
                        expect(e.target.result.file.contents).toEqual("bar");
                        done();
                    }
                })
            })
        });

        it("should load several files", function(done) {
            Promise.all([
                putFile("path", "file1", "foo"),
                putFile("path", "file2", "foo")
            ]).then((reqs) => {
                reqs[1].onsuccess = function() {
                    var data = [
                        {path: ["path"], fileName: "file1"},
                        {path: ["path"], fileName: "file2"}
                    ];
                    store.getFiles(data).then(function(result) {
                        data[0].contents = data[1].contents = "foo";
                        expect(typeof result).toEqual("object");
                        expect(result).toEqual(data);
                        done();
                    });      
                }
            });
        });

        it("should save and restore a document", function(done) {
            var original = minisync.from({v: [1, 2, {foo: "bar"}, 4, 5]});
            storage.save(original, store).then(function (documentID) {
                return storage.restore(documentID, store);
            }).then(function(restored) {
                compareObjects(original.data, restored.data);
                expect(original.getClientID()).toEqual(restored.getClientID());
                done();
            }).catch(function(reason) {
                fail(reason);
            });
        });

    });

});
