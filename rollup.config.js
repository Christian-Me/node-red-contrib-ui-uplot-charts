import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import pkg from './package.json';

export default (() => {
	return pkg.plugins.map(plugin => {
		return {
			input: `src/${plugin}.js`,
			output: {
				name: plugin,
				file: `./lib/js/${plugin}.umd.js`,
				format: 'umd'
			},
			plugins: [
				resolve(), // so Rollup can find `ms`
				commonjs() // so Rollup can convert `ms` to an ES module
			]
		}
	});
});