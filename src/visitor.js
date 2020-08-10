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

module.exports = function (classDeclaration) {
  const sourceFile = classDeclaration.getSourceFile();
  const moduleStoreMap = {};
  // 转换后的节点都会放在这
  const memberNodes = [];
  const forEachNodes = (nodes, callback) => {
    let deletableNodes = [];
    [...nodes].forEach((node, index) => {
      const addMember = function (member) {
        memberNodes.push(member);
        deletableNodes.push(node);
      };
      callback(node, index, addMember);
    });
    lodash.pullAll(nodes, deletableNodes);
    deletableNodes = null;
  };
  return {
    props(node) {
      const TYPE_NAMES = [
        'String',
        'Number',
        'Boolean',
        'Array',
        'Object',
        'Date',
        'Function',
        'Symbol',
      ];
      const { properties } = node.initializer;
      if (ts.isArrayLiteralExpression(node.initializer)) {
      }
      forEachNodes(properties, (propNode, index, addMember) => {
        const { initialzier } = propNode;
        if (
          ts.isIdentifier(initialzier) &&
          TYPE_NAMES.includes(initialzier.text)
        ) {
        }
        if (ts.isArrayLiteralExpression(initialzier)) {
        }
        if (ts.isObjectLiteralExpression(initialzier)) {
        }
      });
    },
    data(node) {
      if (ts.isMethodDeclaration(node)) {
        const { statements } = node.body;
        if (
          statements.length === 1 &&
          ts.isReturnStatement(statements[0]) &&
          ts.isObjectLiteralExpression(statements[0].expression)
        ) {
          forEachNodes(
            statements[0].expression.properties,
            (propNode, index, addMember) => {}
          );
        }
      }
    },
    computed(node) {
      const genGetAccessor = function (name, block) {
        return ts.createGetAccessor(
          undefined,
          undefined,
          ts.createIdentifier(name),
          [],
          undefined,
          block
        );
      };

      const genSetAccessor = function (name, block) {
        return ts.createSetAccessor(
          undefined,
          undefined,
          ts.createIdentifier(name),
          [],
          block
        );
      };
      const { properties } = node.initializer;
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
          addMember(genGetAccessor(propNode.name.text, propNode.body));
        }
        if (ts.isPropertyAssignment(propNode)) {
          const name = propNode.name.text;
          const properties = propNode.initializer.properties;
          properties.forEach((node) => {
            const text = node.name.text;
            if (text === 'get') {
              addMember(genGetAccessor(name, node.body));
            } else if (text === 'set') {
              addMember(genSetAccessor(name, node.body));
            }
          });
        }
        // throw new Error('computed 存在不支持的用法，解析失败');
      });
    },
    // methods() {},
    // watch() {},
    // mixins() {},
    default(node) {
      return node;
    },
  };
};
