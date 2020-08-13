const ts = require('typescript');
const traverser = require('./traverser');
const lodash = require('lodash');

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
const supportedDecoratorNames = ['Watch', 'Prop'];

// 找到Component装饰器
function findComponentDecorator(node) {
  if (ts.isClassDeclaration(node)) {
    const { decorators } = node;
    return decorators.find((node) => {
      const { expression } = node;
      if (ts.isCallExpression(expression)) {
        return expression.expression.text === 'Component';
      }
      return null;
    });
  }
}

function filterSupportedProps(componentDecorator) {
  const properties = getPropsFromComponentDecorator(componentDecorator);
  return properties.filter((prop) =>
    supportedPropNames.includes(prop.name.text)
  );
}

function getPropsFromComponentDecorator(componentDecorator) {
  return componentDecorator.expression.arguments[0].properties;
}

function genImport(names) {
  return ts.createImportDeclaration(
    undefined,
    undefined,
    ts.createImportClause(
      undefined,
      ts.createNamedImports(
        names.map((name) =>
          ts.createImportSpecifier(undefined, ts.createIdentifier(name))
        )
      ),
      false
    ),
    ts.createStringLiteral('vue-property-decorator')
  );
}

function insertImportDeclaration(sourceFile, node, index) {
  const l = index === -1 ? 0 : 1;
  sourceFile.statements.splice(index === -1 ? 1 : index, l, node);
}

/**
 * 1、
 * 将 @Component({}) 变为 @Component
 * 2、
 * 或者将
 * @Comonent({
 *   components: {componentName},
 *   computed: {},
 *   // ...restSupportedProps
 * })
 * 变为
 * @Component({
 *   components: {compnentName}
 * })
 * @param {SourceFile} sourceFile
 */
function beautify(sourceFile) {
  const names = {
    Component: true,
  };
  const { statements } = sourceFile;
  for(let i = 0, l = statements.length; i< l;i++){
    const node = statements[0]
  }
  statements.forEach((node) => {
    const componentDecorator = findComponentDecorator(node);
    if (componentDecorator) {
      const properties = getPropsFromComponentDecorator(componentDecorator);
      const deletableNodes = [];

      [...properties].forEach((prop, index) => {
        if (ts.isPropertyAssignment(prop)) {
          if (prop.initializer.properties.length === 0) {
            deletableNodes.push(prop)
          }
        }
      })
      lodash.pullAll(properties, deletableNodes);
    }
    if (ts.isClassDeclaration(node)) {
      const { decorators } = node;
      // 找到被 Component 装饰器所在的 class
      if (
        decorators.some((node) => {
          const { expression } = node;
          if (ts.isCallExpression(expression)) {
            return expression.expression.text === 'Component';
          }
          return false;
        })
      ) {
        // 找到所有支持的装饰器名称
        node.members.forEach((item) => {
          const decoratorName =
            item.decorators && item.decorators[0].expression.expression.text;
          if (supportedDecoratorNames.includes(decoratorName)) {
            names[decoratorName] = true;
          }
        });
      }
    }
  });
  // 找到vue-class-component的位置
  const vueClassComponentIndex = statements.findIndex(
    // import './store' 这种写法没有importClause
    // import {aa,bb} from 'xx' 这种写法没有 importClause.name
    (item) =>
      ts.isImportDeclaration(item) &&
      item.importClause &&
      item.importClause.name &&
      item.importClause.name.text === 'Component' &&
      item.moduleSpecifier.text === 'vue-class-component'
  );
  if (vueClassComponentIndex !== -1) {
    statements.splice(vueClassComponentIndex, 1);
  }
  const vuePropertyDecoratorIndex = statements.findIndex(
    (item) =>
      item.moduleSpecifier.text === 'vue-property-decorator'
  )
  // 将原有的 vue-property-decorator 替换为新的
  insertImportDeclaration(sourceFile, genImport(Object.keys(names)), vuePropertyDecoratorIndex);

}

module.exports = function (sourceFile) {
  sourceFile.statements.forEach((node) => {
    const componentDecorator = findComponentDecorator(node);
    if (componentDecorator) {
      const supportedProps = filterSupportedProps(componentDecorator);
      traverser(node, supportedProps);
      beautify(sourceFile);
    }
  });
  return sourceFile;
};
