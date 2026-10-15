import swc from 'unplugin-swc';

/**
 * Nest DI needs `emitDecoratorMetadata`, which Vite's built-in transformer does
 * not emit. SWC compiles TypeScript for tests with legacy decorators + metadata.
 */
export const swcPlugin = swc.vite({
  module: { type: 'es6' },
  jsc: {
    target: 'es2023',
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
  },
});
