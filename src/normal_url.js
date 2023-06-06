/**
 * Module dependencies.
 */
const regulex = require('regulex');
// eslint-disable-next-line import/no-unresolved
const { isUri } = require('valid-url');

/**
 * Import Utilities
 */
// import { isValidHttpUrl } from '../helpers/common.js';

const prependHttp = (url, opts) => {
	if (typeof url !== 'string') throw new TypeError(`Expected \`url\` to be of type \`string\`, got \`${typeof url}\``);

	url = url.trim();
	opts = { https: false, ...opts };

	if (/^\.*\/|^(?!localhost)\w+:/.test(url)) return url;
	return url.replace(/^(?!(?:\w+:)?\/\/)/, opts.https ? 'https://' : 'http://');
};

const isSubdomainUrl = url => {
	// eslint-disable-next-line no-useless-escape
	const regex = /(?:http[s]*\:\/\/)*(.*?)\.(?=[^\/]*\..{2,5})/i;
	return regex.test(url);
};

/**
 * Convert regex url to normal url
 * @param {*} domain parent domain for regex url
 * @param {*} urlRegex regex url string
 * @returns
 */
exports.getNormalUrl = (params)=> {
	try {
		const { domain, urlRegex } = params;
		const { parse: parseRegex } = regulex;

		let normalUrl = urlRegex;

		const re = new RegExp(normalUrl).source;
		const parsedRegex = parseRegex(re);
		const urls = [];
		let url = '';

		parsedRegex.tree.forEach((tree, index) => {
			switch (tree.type) {
				case 'choice':
					{
						const branchResult = tree.branches.reduce((branchResult, branch) => {
							const result = branch.reduce((result, ele) => {
								if (ele.type === 'exact') {
									result.push(ele.chars);
								} else if (ele.type === 'group') {
									if (ele.sub[0] && ele.sub[0].type === 'exact') result.push(ele.sub[0].chars);
									else if (ele.sub[0] && ele.sub[0].type === 'choice') {
										if (ele.sub[0] && ele.sub[0].branches && ele.sub[0].branches[0][0].type === 'exact') result.push(ele.sub[0].branches[0][0].chars);
									}
								}

								return result;
							}, []);

							if (result.length) branchResult.push(result.join(''));

							return branchResult;
						}, []);

						urls.push(...branchResult);
					}
					break;
				case 'exact':
					if (index === 0 && tree.chars.includes('www')) {
						tree.chars = prependHttp(tree.chars);
					}
					url += tree.chars;
					break;
				case 'dot':
					if (!tree.raw.includes('*') || !tree.raw.includes('.*')) {
						url += tree.raw;
					}
					break;
				case 'group':
					tree.sub.forEach(tree => {
						switch (tree.type) {
							case 'choice':
								{
									const branchResult = tree.branches.reduce((branchResult, branch) => {
										const result = branch.reduce((result, ele) => {
											if (ele.type === 'exact') {
												result.push(ele.chars);
											} else if (ele.type === 'group') {
												if (ele.sub[0] && ele.sub[0].type === 'exact') result.push(ele.sub[0].chars);
												else if (ele.sub[0] && ele.sub[0].type === 'choice') {
													if (ele.sub[0] && ele.sub[0].branches && ele.sub[0].branches[0][0].type === 'exact') {
														result.push(ele.sub[0].branches[0][0].chars);
													}
												}
											}
											return result;
										}, []);

										if (result.length) branchResult.push(result.join(''));
										return branchResult;
									}, []);

									urls.push(...branchResult);
								}
								break;
							case 'exact':
								if (index === 0 && tree.chars.includes('www')) {
									tree.chars = prependHttp(tree.chars);
								}
								url += tree.chars;
								break;
							case 'dot':
								if (!tree.raw.includes('*') || !tree.raw.includes('.*')) {
									url += tree.raw;
								}
								break;
							// skip default case
						}
					});
					break;
				// skip default case
			}
		});

		if (url) urls.push(url);
		normalUrl = urls.filter(url => isUri(url))[0] || null;

		if (urls.length > 1) {
			normalUrl = urls.filter(url => isUri(url))[0] || null;
		} else {
			[normalUrl] = urls;
		}

		if (!normalUrl) return urlRegex;

		/* Remove utm parameters */
		if (normalUrl.includes('utm_')) {
			normalUrl = normalUrl.slice(0, normalUrl.indexOf('utm_'));
		}

		if (normalUrl.charAt(normalUrl.length - 1) === '/') {
			normalUrl = normalUrl.slice(0, normalUrl.length - 1);
		}

		const isNormalUrlHasDomainUrl = domain.includes(prependHttp(normalUrl)) || domain.includes(prependHttp(normalUrl, { https: true })) || domain.includes(normalUrl);
		const isDomainUrlHasNormalUrl = prependHttp(normalUrl).includes(domain) || prependHttp(normalUrl, { https: true }).includes(domain) || normalUrl.includes(domain);

		if (!isUri(normalUrl) && !isNormalUrlHasDomainUrl && !isDomainUrlHasNormalUrl) {
			normalUrl = domain.replace(/\/$|$/, '/') + normalUrl.replace(/^\/|\/$/g, '');
		}

		if (!normalUrl) return false;

		const sliceTo = normalUrl.includes('https') ? 8 : 7;
		const main = normalUrl.slice(0, sliceTo);
		const remain = normalUrl.slice(main.length, normalUrl.length).replaceAll(/\/{2,20}/gi, '/');
		let result = main + remain;

		const isSubdomainString = isSubdomainUrl(result);

		if (!isSubdomainString) {
			result = `${result.slice(0, result.indexOf('//') + 2)}www.${result.slice(result.indexOf('//') + 2, result.length)}`;
		}

		return result;
	} catch (error) {
		console.log(error)
		return false;
	}
};



