const ts = require('typescript');
const camelize = require('camelize');
const lodash = require('lodash');

const vuexHelpers = ['mapState', 'mapGetters', 'mapMutations', 'mapActions'];
const vuexHelperMap = {
  [vuexHelpers[0]]: 'State',
  [vuexHelpers[1]]: 'Getter',
  [vuexHelpers[2]]: 'Mutation',
  [vuexHelpers[3]]: 'Action',
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

function genModuleHelper(moduleName, type, name, aliasName) {
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

function genGetAccessor(name, block) {
  return ts.createGetAccessor(
    undefined,
    undefined,
    ts.createIdentifier(name),
    [],
    undefined,
    block
  );
}

function genSetAccessor(name, block) {
  return ts.createSetAccessor(
    undefined,
    undefined,
    ts.createIdentifier(name),
    [],
    block
  );
}

module.exports = function (classDeclaration, sourceFile) {
  const moduleStoreMap = {};
  // 转换后的节点都会放在这
  const memberNodes = [];
  const forEachNodes = (nodes, callback) => {
    [...nodes].forEach((node, index) => {
      const addMember = function(node) {
        memberNodes.push(node);
        lodash.pullAt(nodes, index);
      }
      callback(node, index, addMember);
    })
  }
  return {
    // props() {},
    // data() {},
    computed(node) {
      const {properties} = node.initializer;
      // 遍历 computed 下的所有属性
      forEachNodes(properties, (propNode, index, addMember) => {
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
                  addMember(
                    genModuleHelper(
                      moduleName,
                      vuexHelperMap[vuexHelperName],
                      ele.text
                    )
                  );
                });
              }
              if (ts.isObjectLiteralExpression(mapNode)) {
                mapNode.properties.forEach((ele) => {
                  addMember(
                    genModuleHelper(
                      moduleName,
                      vuexHelperMap[vuexHelperName],
                      ele.name.text,
                      ele.initializer.text
                    )
                  );
                });
              }
            } else {
              // 非module
            }
          }
        }
        if (ts.isMethodDeclaration(propNode)) {
          addMember(
            genGetAccessor(propNode.name.text, propNode.body)
          );
        }
        if (ts.isPropertyAssignment(propNode)) {
          const name = propNode.name.text;
          const properties = propNode.initializer.properties;
          properties.forEach((node) => {
            if (node.name.text === 'get') {
              addMember(genGetAccessor(name, node.body));
            } else {
              addMember(
                genSetAccessor(name, node.body)
              );
            }
          });
        }
        // throw new Error('computed 存在不支持的用法，解析失败');
      });
    },
    // methods() {},
    // watch() {},
    // mixins() {},
    default (node) {
      return node;
    },
  };
}