const fs = require('fs');
const parser = require('./src/parser');
const transformer = require('./src/transformer');
const generator = require('./src/generator');

const content = fs.readFileSync('./data/test01.vue', 'utf-8');
const sourceFile = parser(content);
const newAst = transformer(sourceFile);
console.log(generator(newAst));
