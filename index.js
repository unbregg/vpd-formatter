const ts = require('typescript');
const vueTemplateCompiler = require('vue-template-compiler');
const fs = require('fs');
const visitor = require('./src/visitor');

const content = fs.readFileSync('./data/test01.vue', 'utf-8');
const sfc = vueTemplateCompiler.parseComponent(content);
const jsContent = sfc.script.content;
const sourceFile = ts.createSourceFile(
  '',
  jsContent,
  ts.ScriptTarget.ES2015,
  true
);
const lifecycleHooks = [
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
];
const supportedPropNames = [
  'props',
  'data',
  'computed',
  'methods',
  'watch',
  ...lifecycleHooks,
];

ts.forEachChild(sourceFile, (node) => {
  const componentDecorator = findComponentDecorator(node);
  if (componentDecorator) {
    const supportedProps = extractSupportedProps(componentDecorator);
    const properties = getPropsFromComponentDecorator(componentDecorator);
    transform(node, supportedProps);
    if (properties.length === 0) {
      componentDecorator.expression = ts.createIdentifier('Component');
    }
  }
});
const printer = ts.createPrinter();
console.log(printer.printFile(sourceFile));

// 找到Component装饰器
function findComponentDecorator(node) {
  if (ts.isClassDeclaration(node)) {
    const { decorators } = node;
    return decorators.find((node) => {
      const { expression } = node;
      if (ts.isCallExpression(expression)) {
        return expression.expression.text === 'Component';
      }
      return false;
    });
  }
}

function extractSupportedProps(componentDecorator) {
  const supportedProps = [];
  const reserveProps = [];
  const properties = getPropsFromComponentDecorator(componentDecorator);
  properties.forEach((prop) => {
    if (supportedPropNames.includes(prop.name.text)) {
      supportedProps.push(prop);
    } else {
      reserveProps.push(prop);
    }
  });
  componentDecorator.expression.arguments[0].properties = reserveProps;
  return supportedProps;
}

function getPropsFromComponentDecorator(componentDecorator) {
  return componentDecorator.expression.arguments[0].properties;
}

function transform(classDeclaration, supportedProps) {
  const { members } = classDeclaration;
  supportedProps.forEach((prop) => {
    const propName = prop.name.text;
    const newNode = visitor[propName]
      ? visitor[propName](prop, classDeclaration)
      : visitor.default(prop, classDeclaration);
    if (newNode) {
      members.push(newNode);
    }
  });
}
