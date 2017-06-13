describe("minisync storage", function() {

    let storage;

    beforeAll(function(done) {
        require(['storage'], function(s) {
            storage = s;
            done();
        });
    });

    describe("localStorage", function() {

        let plugin;

        beforeAll(function() {
            plugin = new storage.LocalStoragePlugin("test");
        });

        beforeEach(function() {
            window.localStorage.clear();
        });

        it("should load a file", function(done) {
            window.localStorage.setItem("test//path/file", "foo");
            plugin.getFile({ path: ["path"], fileName: "file"}).then(function(result) {
                expect(typeof result).toEqual("object");
                expect(typeof result.path).toEqual("object");
                expect(result.path[0]).toEqual("path");
                expect(result.fileName).toEqual("file");
                expect(result.contents).toEqual("foo");
                done();
            })
        });

        it("should save a file", function(done) {
            plugin.putFile({ 
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
            plugin.getFiles(data).then(function(result) {
                data[0].contents = data[1].contents = "foo";
                expect(typeof result).toEqual("object");
                expect(result).toEqual(data);
                done();
            });
        });
    });

});
