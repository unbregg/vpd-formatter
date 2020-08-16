const ts = require('typescript');

module.exports = function(ast, {sfc}) {
    const { template, styles, script } = sfc;
    const printer = ts.createPrinter();
    const getAttrStr = function(attrs) {
      return Object.keys(attrs).map(key => attrs[key] === true ? key : `${key}="${attrs[key]}"`).join(' ');
    }
    const templateContent = template.content ? `<template ${getAttrStr(template.attrs)}>${template.content}</template>`  : '';
    const styleContent = styles.map(style => {
        return style.content ? `<style ${getAttrStr(style.attrs)}>${style.content}</style>` : '';
    }).join('\n');
    const scriptContent = `<script ${getAttrStr(script.attrs)}>\n${printer.printFile(ast)}\n</script>`;
    return `${templateContent}\n${scriptContent}\n${styleContent}`;
}