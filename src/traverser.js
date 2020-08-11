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
 * traverser
 * @param {*} classDeclaration
 * @param {*} supportedProps
 */
module.exports = function (classDeclaration, supportedProps) {
  const { members } = classDeclaration;
  const memberNodes = [];
  const visitor = getVisitor(classDeclaration, memberNodes);
  supportedProps.forEach((prop) => {
    const propName = prop.name.text;
    const newNode = visitor[propName]
      ? visitor[propName](prop, classDeclaration)
      : visitor.default(prop, classDeclaration);
    if (newNode) {
      members.push(newNode);
    }
  });
  classDeclaration.members = [...memberNodes, ...classDeclaration.members];
};

function genPropMember(name, initializer) {
  return ts.createProperty(
    undefined,
    undefined,
    ts.createIdentifier(name),
    undefined,
    undefined,
    initializer
  )
}

function insertBeforeClassDeclaration(sourceFile, node) {
  const index = sourceFile.statements.findIndex((item) =>
    ts.isClassDeclaration(item)
  );
  sourceFile.statements.splice(index, 0, node);
}

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

function getVisitor(classDeclaration, memberNodes) {
  const sourceFile = classDeclaration.getSourceFile();
  const moduleStoreMap = {};
  // 转换后的节点都会放在这
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
  /**
   * 主要是为了生成moduleHelper，但也会判断是否需要导入 namespace 等
   * @param {*} propNode 
   * @param {*} addMember 
   */
  function genModule(propNode, addMember) {
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
           insertBeforeClassDeclaration(
             sourceFile,
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
 }
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

      const getTsTypeByVueType = function (vueType) {
        switch (vueType) {
          case 'String':
            return ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
          case 'Number':
            return ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
          case 'Boolean':
            return ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
          case 'Array':
            return ts.createTypeReferenceNode(ts.createIdentifier('Array'), [
              ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
            ]);
          case 'Object':
            return ts.createTypeReferenceNode(
              ts.createIdentifier('Object'),
              undefined
            );
          case 'Date':
            return ts.createTypeReferenceNode(
              ts.createIdentifier('Date'),
              undefined
            );
          case 'Function':
            return ts.createTypeReferenceNode(
              ts.createIdentifier('Function'),
              undefined
            );
          case 'Symbol':
            return ts.createKeywordTypeNode(ts.SyntaxKind.SymbolKeyword);
          default:
            return ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
        }
      };
      const genPropDecorator = function (name, types) {
        let vueType;
        let tsType;
        if (Array.isArray(types)) {
          vueType = ts.createArrayLiteral(
            types.map((type) => ts.createIdentifier(type)),
            false
          );
          tsType = types.map((type) => getTsTypeByVueType(type));
        } else if (typeof types === 'object') {
          const typeNode = types.properties.find(
            (item) => item.name.text === 'type'
          );
          vueType = types;
          tsType = typeNode
            ? ts.isArrayLiteralExpression(typeNode.initializer)
              ? typeNode.initializer.elements.map((item) =>
                  ts.createIdentifier(item.text)
                )
              : [getTsTypeByVueType(typeNode.initializer.text)]
            : [ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)];
        } else if (typeof types === 'string') {
          vueType = types ? ts.createIdentifier(types) : undefined;
          tsType = [getTsTypeByVueType(types)];
        }

        return ts.createProperty(
          [
            ts.createDecorator(
              ts.createCall(
                ts.createIdentifier('Prop'),
                undefined,
                vueType && [vueType]
              )
            ),
          ],
          [ts.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          ts.createIdentifier(name),
          undefined,
          ts.createUnionTypeNode([
            ...tsType,
            ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
          ]),
          undefined
        );
      };
      const { properties } = node.initializer;
      if (ts.isArrayLiteralExpression(node.initializer)) {
        forEachNodes(
          node.initializer.elements,
          (propNode, index, addMember) => {
            addMember(genPropDecorator(propNode.text));
          }
        );
      }
      if (ts.isObjectLiteralExpression(node.initializer)) {
        forEachNodes(properties, (propNode, index, addMember) => {
          const { initializer } = propNode;
          const propName = propNode.name.text;
          if (
            ts.isIdentifier(initializer) &&
            TYPE_NAMES.includes(initializer.text)
          ) {
            addMember(genPropDecorator(propName, initializer.text));
          }
          if (ts.isArrayLiteralExpression(initializer)) {
            addMember(
              genPropDecorator(
                propName,
                initializer.elements.map((item) => item.text)
              )
            );
          }
          if (ts.isObjectLiteralExpression(initializer)) {
            addMember(genPropDecorator(propName, initializer));
          }
        });
      }
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
            (propNode, index, addMember) => {
              // addMember(
              //   ts.createProperty(
              //     undefined,
              //     undefined,
              //     ts.createIdentifier(propNode.name.text),
              //     undefined,
              //     undefined,
              //     ts.createStringLiteral(propNode.initializer.text)
              //   )
              // );
            }
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
        genModule(propNode, addMember)
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
      });
    },
    provide() {},
    inject() {},
    methods(node) {
      const { properties } = node.initializer;
      forEachNodes(properties, (propNode, index, addMember) => {
        if (ts.isMethodDeclaration(propNode) || ts.isPropertyAssignment(propNode)) {
          addMember(propNode)
        }
        if (ts.isPropertyAssignment(propNode)) {}
        if (ts.isSpreadAssignment(propNode)) {
          genModule(propNode, addMember)
        }
      })
    },
    watch() {},
    mixins() {},
    default(node) {
      return node;
    },
  };
}
