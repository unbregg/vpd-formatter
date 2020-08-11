const ts = require('typescript');

module.exports = function (jsContent) {
    return ts.createSourceFile(
        '',
        jsContent,
        ts.ScriptTarget.ES2015,
        true
    );
}