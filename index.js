const filepath = process.argv[2];
if (!filepath) {
  throw new Error('请指定文件夹路径');
}
const fs = require('fs');
const parser = require('./src/parser');
const vueTemplateCompiler = require('vue-template-compiler');
const transformer = require('./src/transformer');
const generator = require('./src/generator');

const content = fs.readFileSync(filepath, 'utf-8');
const sfc = vueTemplateCompiler.parseComponent(content);
const context = {
  filepath,
  sfc,
}
const sourceFile = parser(sfc.script.content);
const newAst = transformer(sourceFile);
const result = generator(newAst, context);
fs.writeFileSync(filepath, result);
