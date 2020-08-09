const ts = require('typescript');
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
// 找到Component装饰器
function findComponentDecorator(node) {
    if (ts.isClassDeclaration(node)) {
        const {
            decorators
        } = node;
        return decorators.find((node) => {
            const {
                expression
            } = node;
            if (ts.isCallExpression(expression)) {
                return expression.expression.text === 'Component';
            }
            return false;
        });
    }
}

function filterSupportedProps(componentDecorator) {
    const properties = getPropsFromComponentDecorator(componentDecorator);
    return properties.filter((prop) => supportedPropNames.includes(prop.name.text));
}

function getPropsFromComponentDecorator(componentDecorator) {
    return componentDecorator.expression.arguments[0].properties;
}

function traverseClassDeclaration(classDeclaration, supportedProps) {
    const {
        members
    } = classDeclaration;
    const visitor = require('./visitor')(classDeclaration, classDeclaration.getSourceFile());
    supportedProps.forEach((prop) => {
        const propName = prop.name.text;
        const newNode = visitor[propName] ?
            visitor[propName](prop, classDeclaration) :
            visitor.default(prop, classDeclaration);
        if (newNode) {
            members.push(newNode);
        }
    });
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
}

module.exports = function (sourceFile) {
    sourceFile.statements.forEach((node) => {
        const componentDecorator = findComponentDecorator(node);
        if (componentDecorator) {
            const supportedProps = filterSupportedProps(componentDecorator);
            traverseClassDeclaration(node, supportedProps);
            beautify(sourceFile);
        }
    });
    return sourceFile;
}