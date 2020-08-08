const ts = require('typescript');
const camelize = require('camelize');

const vuexHelpers = ['mapState', 'mapGetter', 'mapMutations', 'mapActions'];
const vuexHelperMap = {
  mapState: 'State',
  mapGetter: 'Getter',
  mapMutations: 'Mutation',
  mapActions: 'Action',
};
/**
 * store 是否是 module
 */
function isModule(callExpression) {
  const args = callExpression.arguments;

  return args.length === 2;
}

function normalizeModuleName(name) {
  if (camelize(name) === name) {
    return name;
  }
  return camelize(name.replace(/\//g, '_').toLocaleLowerCase());
}

function genModuleStore(moduleName, modulePath) {
  return ts.createVariableDeclarationList(
    [
      ts.createVariableDeclaration(
        ts.createIdentifier(moduleName),
        undefined,
        ts.createCall(ts.createIdentifier('namespace'), undefined, [
          ts.createStringLiteral(modulePath),
        ])
      ),
    ],
    ts.NodeFlags.Const
  );
}

function genImportNamespace() {
  return ts.createImportDeclaration(
    undefined,
    undefined,
    ts.createImportClause(
      undefined,
      ts.createNamedImports([
        ts.createImportSpecifier(undefined, ts.createIdentifier('namespace')),
      ]),
      false
    ),
    ts.createStringLiteral('vuex-class')
  );
}

function genModuleProp(moduleName, type, name, aliasName) {
  return ts.createProperty(
    [
      ts.createDecorator(
        ts.createCall(
          ts.createPropertyAccess(
            ts.createIdentifier(moduleName),
            ts.createIdentifier(type)
          ),
          undefined,
          [ts.createStringLiteral(name)]
        )
      ),
    ],
    undefined,
    ts.createIdentifier(aliasName || name),
    undefined,
    ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
    undefined
  );
}

function genAccessor(name, block, type) {
  const createAccessor =
    type === 'set' ? ts.createSetAccessor : ts.createGetAccessor;
  return createAccessor(
    undefined,
    undefined,
    ts.createIdentifier(name),
    [],
    undefined,
    block
  );
}

const moduleStoreMap = {};

module.exports = {
  // props() {},
  // data() {},
  computed(node, classDeclaration) {
    const sourceFile = node.getSourceFile();
    // 遍历 computed 下的所有属性
    node.initializer.properties.forEach((propNode) => {
      // 形如 ...mapState('store',[])
      if (ts.isSpreadAssignment(propNode)) {
        const callExpression = propNode.expression;
        if (
          ts.isCallExpression(callExpression) &&
          vuexHelpers.includes(callExpression.expression.text)
        ) {
          const vuexHelperName = callExpression.expression.text;
          const args = callExpression.arguments;
          if (isModule(callExpression)) {
            const modulePath = args[0].text;
            const mapNode = args[1];
            const moduleName = normalizeModuleName(modulePath);
            // 如果还没有moduleStore，则在开始引入 namespace
            if (!Object.keys(moduleStoreMap).length) {
              sourceFile.statements.unshift(genImportNamespace());
            }
            if (!moduleStoreMap[moduleName]) {
              sourceFile.statements.unshift(
                genModuleStore(moduleName, modulePath)
              );
              moduleStoreMap[moduleName] = true;
            }
            if (ts.isArrayLiteralExpression(mapNode)) {
              mapNode.elements.forEach((ele) => {
                classDeclaration.members.unshift(
                  genModuleProp(
                    moduleName,
                    vuexHelperMap[vuexHelperName],
                    ele.text
                  )
                );
              });
            }
            if (ts.isObjectLiteralExpression(mapNode)) {
              mapNode.properties.forEach((ele) => {
                classDeclaration.members.unshift(
                  genModuleProp(
                    moduleName,
                    vuexHelperMap[vuexHelperName],
                    ele.name.text,
                    ele.initializer.text
                  )
                );
              });
            }
          }
        }
      }
      if (ts.isMethodDeclaration(propNode)) {
        classDeclaration.members.unshift(
          genAccessor(propNode.name.text, propNode.body)
        );
      }
      if (ts.isPropertyAssignment(propNode)) {
        const name = propNode.name.text;
        const properties = propNode.initializer.properties;
        properties.forEach((node) => {
          if (node.name.text === 'get') {
            classDeclaration.members.unshift(genAccessor(name, node.body));
          } else {
            classDeclaration.members.unshift(
              genAccessor(name, node.body, 'set')
            );
          }
        });
      }
      // throw new Error('computed 存在不支持的用法，解析失败');
    });
  },
  // methods() {},
  // watch() {},
  default(node) {
    return node;
  },
};
