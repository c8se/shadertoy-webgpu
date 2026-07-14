import { babel } from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { readFileSync } from 'fs'

const raw = () => {
  return {
    name: 'raw',
    load(id) {
      if (id.endsWith('?raw')) {
        const content = readFileSync(id.replace('?raw', '')).toString('utf-8')
        return `export default \`${content.replace(/`/g, '\\`')}\``
      }
    }
  }
}

export default {
  input: 'src/index.tsx',
  output: {
    file: 'dist/index.js',
    format: 'es'
  },
  external: ['solid-js', '@solidjs/web', 'solid-webgpu'],
  plugins: [
    nodeResolve({
      extensions: ['.js', '.ts', '.tsx']
    }),
    raw(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts', '.tsx'],
      presets: ['@babel/preset-typescript', 'babel-preset-solid']
    })
  ]
}
