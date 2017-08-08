function isArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
}

function compareObjects (obj1, obj2, includeS, path) {
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
