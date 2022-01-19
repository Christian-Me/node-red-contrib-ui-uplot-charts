import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import {uglify} from 'rollup-plugin-uglify';
import pkg from './package.json';

export default (() => {
	return pkg.tools.map(plugin => {
		return {
			input: `src/${plugin}.js`,
			output: {
				name: plugin,
				file: `./resources/${plugin}.min.js`,
				format: 'umd'
			},
			plugins: [
				resolve(), // so Rollup can find `ms`
				commonjs(), // so Rollup can convert `ms` to an ES module
                //uglify()
			]
		}
	});
});