#!/usr/bin/env node
const dir = process.argv[2];
if (!dir) {
  throw new Error('请指定文件夹路径');
}
const fs = require('fs');
const parser = require('./src/parser');
const vueTemplateCompiler = require('vue-template-compiler');
const transformer = require('./src/transformer');
const generator = require('./src/generator');

const content = fs.readFileSync(dir, 'utf-8');
const sfc = vueTemplateCompiler.parseComponent(content);
const {template, styles, script} = sfc;
const sourceFile = parser(script.content);
const newAst = transformer(sourceFile);
const getAttrStr = function(attrs) {
  return Object.keys(attrs).map(key => `${key}="${attrs[key]}"`).join(' ')
}
const style = styles[0]
const templateContent = template.content ? `<template ${getAttrStr(template.attrs)}>${template.content}</template>`  : ''
const styleContent = style.content ? `<style ${getAttrStr(style.attrs)}>${style.content}</style>` : ''
const scriptContent = `<script ${getAttrStr(script.attrs)}>\n${generator(newAst)}\n</script>`
fs.writeFileSync(dir, `${templateContent}\n${scriptContent}\n${styleContent}`)
