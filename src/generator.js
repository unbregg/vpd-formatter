const ts = require('typescript');

module.exports = function(ast) {
    const printer = ts.createPrinter();
    return printer.printFile(ast)
}