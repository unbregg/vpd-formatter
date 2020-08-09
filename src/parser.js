const ts = require('typescript');
const vueTemplateCompiler = require('vue-template-compiler');

module.exports = function (content) {
    const sfc = vueTemplateCompiler.parseComponent(content);
    const jsContent = sfc.script.content;
    return ts.createSourceFile(
        '',
        jsContent,
        ts.ScriptTarget.ES2015,
        true
    );
}