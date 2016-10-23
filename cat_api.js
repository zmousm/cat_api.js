;

// exported
var CAT, CatIdentityProvider, CatProfile, CatDevice;

(function($){
    // Inheritance: We'll fall back to this instead of a polyfill!
    function createObject(proto) {
	function ctor() { }
	ctor.prototype = proto;
	return new ctor();
    }
    $.getQueryParameters = function (str) {
	var ret = {};
	if (typeof str !== 'string') {
		return ret;
	}
	str = str.trim().replace(/^(\?)/, '');
	if (!str) {
	    return ret;
	}
	str.split('&').forEach(function (param) {
	    var parts = param.replace(/\+/g, ' ').split('=');
	    // Firefox (pre 40) decodes `%3D` to `=`
	    // https://github.com/sindresorhus/query-string/pull/37
	    var key = parts.shift();
	    var val = parts.length > 0 ? parts.join('=') : undefined;
	    key = decodeURIComponent(key);
	    // missing `=` should be `null`:
	    // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
	    val = val === undefined ? null : decodeURIComponent(val);
	    if (ret[key] === undefined) {
		ret[key] = val;
	    } else if (Array.isArray(ret[key])) {
		ret[key].push(val);
	    } else {
		ret[key] = [ret[key], val];
	    }
	});
	return ret;
    }
    $.getQueryString = function (obj) {
	return obj ? Object.keys(obj).sort().map(function (key) {
	    var val = obj[key];
	    if (val === undefined) {
		return '';
	    }
	    if (val === null) {
		return encodeURIComponent(key);
	    }
	    if (Array.isArray(val)) {
		var result = [];
		val.slice().forEach(function (val2) {
		    if (val2 === undefined) {
			return;
		    }
		    if (val2 === null) {
			result.push(encode(key, opts));
		    } else {
			result.push(encode(key, opts) + '=' + encode(val2, opts));
		    }
		});
		return result.join('&');
	    }
	    return encodeURIComponent(key) + '=' + encodeURIComponent(val);
	}).filter(function (x) {
	    return x.length > 0;
	}).join('&') : '';
    }

    CAT = function(options) {
	var cat_eduroam_org_api = 'https://cat.eduroam.org/user/API.php';
	this._defaults = {
	    apiBase: cat_eduroam_org_api,
	    apiBaseD: cat_eduroam_org_api,
	    lang: 'en'
	}
        this.options = $.extend( {}, this._defaults, options);
	this._cache = {};
    }
    CAT.prototype.getApiBase = function(direct) {
    	return direct === true ?
	    this.options.apiBaseD : this.options.apiBase;
    }
    CAT.prototype.getLang = function() {
	return this.options.lang;
    }
    CAT.prototype.setLang = function(lang) {
	this.options.lang = lang;
    }
    CAT.prototype.query = function(qro) {
	if (!'action' in qro) {
	    // throw something?
	    return null;
	}
	if (!('lang' in qro)) {
	    qro.lang = this.getLang();
	}

	var dtype = 'json';
	var ep = qro.action == 'downloadInstaller' ?
	    this.options.apiBaseD : this.options.apiBase;
	var directUri = [ep, $.getQueryString(qro)].join('?');

	switch (qro.action) {
	case 'downloadInstaller':
	    // console.log("wlh", directUri);
	    window.location.href = directUri;
	    return $.Deferred()
		.resolve(directUri)
		.promise();
	    break;
	case 'sendLogo':
	    // console.log('imgSrc', directUri);
	    // delete dtype;
	    return $.Deferred()
		.resolve($('<img>').attr('src', directUri))
		.promise();
	    break;
	case 'deviceInfo':
	    dtype = 'html';
	    // fallthrough
	default:
	    return $.ajax({
		dataType: dtype,
		url: ep,
		data: qro
	    });
	}
    }
    CAT.prototype._qry0args = function(act) {
	if (!act) {
	    // throw something?
	    return null;
	}
	var $cat = this;
	if (act in this._cache) {
	    // return a (resolved) promise for consistency
	    return $.Deferred()
		.resolve(this._cache[act])
		.promise();
	} else {
	    var qro = {
		action: act,
		lang: undefined
	    }
	    var cb = function(ret) {
		// console.log('cb0 this:', this);
		// console.log('cb0 args:', arguments);
		if (!!arguments[1] &&
		    arguments[1] != 'success') {
		    return null;
		}
		if (!!this.dataType &&
		    this.dataType == 'json') {
		    if (!('status' in ret) || ret.status != 1 || !'data' in ret) {
			$cat._cache[act] = null;
			return null;
		    }
		    if (!!ret.tou) {
			$cat._tou = ret.tou;
		    }
		    $cat._cache[act] = ret.data;
		    return ret.data;
		} else {
		    return null;
		}
	    }
	    return this.query(qro)
		.then(cb, cb);
	}
    }
    CAT.prototype._qry1args = function(act, lang) {
	if (!act) {
	    // throw something?
	    return null;
	}
	if (typeof lang === 'undefined') {
	    lang = this.getLang();
	}
	var $cat = this;
	if (act in this._cache &&
	    lang in this._cache[act]) {
	    // return a (resolved) promise for consistency
	    return $.Deferred()
		.resolve(this._cache[act][lang])
		.promise();
	} else {
	    var qro = {
		action: act
	    }
	    if (lang !== this.getLang()) {
		qro.lang = lang;
	    }
	    var cb = function(ret) {
		// console.log('cb1 this:', this);
		// console.log('cb1 args:', arguments);
		if (!!arguments[1] &&
		    arguments[1] != 'success') {
		    return null;
		}
		if (!(act in $cat._cache)) {
		    $cat._cache[act] = {};
		}
		if (!!this.dataType &&
		    this.dataType == 'json') {
		    // listAllIdentityProviders returns just an array
		    if (ret instanceof Array) {
			$cat._cache[act][lang] = ret;
			return ret;
		    }
		    if (!('status' in ret) || ret.status != 1 || !'data' in ret) {
			$cat._cache[act][lang] = null;
			return null;
		    }
		    if (!!ret.tou) {
			$cat._tou = ret.tou;
		    }
		    $cat._cache[act][lang] = ret.data;
		    return ret.data;
		// }
		// else if (typeof ret === 'string' ||
		// 	 ret instanceof $) {
		//     $cat._cache[act][idval][lang] = ret;
		//     return ret;
		} else {
		    return null;
		}
	    }
	    return this.query(qro)
		.then(cb, cb);
	}
    }
    CAT.prototype._qry2args = function(act, idname, idval, lang) {
	if (!act || !idname || !idval) {
	    // throw something?
	    return null;
	}
	if (typeof lang === 'undefined') {
	    lang = this.getLang();
	}
	var $cat = this;
	if (act in this._cache &&
	    idval in this._cache[act] &&
	    lang in this._cache[act][idval]) {
	    // return a (resolved) promise for consistency
	    return $.Deferred()
		.resolve(this._cache[act][idval][lang])
		.promise();
	} else {
	    var qro = {
		action: act
	    }
	    if (lang !== this.getLang()) {
		qro.lang = lang;
	    }
	    qro[idname] = idval;
	    var cb = function(ret) {
		// console.log('cb2 this:', this);
		// console.log('cb2 args:', arguments);
		if (!!arguments[1] &&
		    arguments[1] != 'success') {
		    return null;
		}
		if (!(act in $cat._cache)) {
		    $cat._cache[act] = {};
		}
		if (!(idval in $cat._cache[act])) {
		    $cat._cache[act][idval] = {};
		}
		if (!!this.dataType &&
		    this.dataType == 'json') {
		    if (!('status' in ret) || ret.status != 1 || !'data' in ret) {
			$cat._cache[act][idval][lang] = null;
			return null;
		    }
		    if (!!ret.tou) {
			$cat._tou = ret.tou;
		    }
		    $cat._cache[act][idval][lang] = ret.data;
		    return ret.data;
		}
		else if (typeof ret === 'string' ||
			 ret instanceof $) {
		    $cat._cache[act][idval][lang] = ret;
		    return ret;
		} else {
		    return null;
		}
	    }
	    return this.query(qro)
		.then(cb, cb);
	}
    }
    CAT.prototype._qry3args = function(act, id1name, id1val, id2name, id2val, lang) {
	if (!act || !id1name || !id1val || !id2name || !id2val) {
	    // throw something?
	    return null;
	}
	if (typeof lang === 'undefined') {
	    lang = this.getLang();
	}
	var $cat = this;
	if (act in this._cache &&
	    id1val in this._cache[act] &&
	    id2val in this._cache[act][id1val] &&
	    lang in this._cache[act][id1val][id2val]) {
	    // return a (resolved) promise for consistency
	    return $.Deferred()
		.resolve(this._cache[act][id1val][id2val][lang])
		.promise();
	} else {
	    var qro = {
		action: act
	    }
	    if (lang !== this.getLang()) {
		qro.lang = lang;
	    }
	    qro[id1name] = id1val;
	    qro[id2name] = id2val;
	    var cb = function(ret) {
		// console.log('cb3 args:', arguments);
		if (!!arguments[1] &&
		    arguments[1] != 'success') {
		    return null;
		}
		if (!(act in $cat._cache)) {
		    $cat._cache[act] = {};
		}
		if (!(id1val in $cat._cache[act])) {
		    $cat._cache[act][id1val] = {};
		}
		if (!(id2val in $cat._cache[act][id1val])) {
		    $cat._cache[act][id1val][id2val] = {};
		}
		if (!!this.dataType &&
		    this.dataType == 'json') {
		    if (!('status' in ret) || ret.status != 1 || !'data' in ret) {
			$cat._cache[act][id1val][id2val][lang] = null;
			return null;
		    }
		    if (!!ret.tou) {
			$cat._tou = ret.tou;
		    }
		    $cat._cache[act][id1val][id2val][lang] = ret.data;
		    return ret.data;
		}
		else if (typeof ret === 'string' ||
			 ret instanceof $) {
		    $cat._cache[act][id1val][id2val][lang] = ret;
		    return ret;
		} else {
		    return null;
		}
	    }
	    return this.query(qro)
		.then(cb, cb);
	}
    }

    CAT.prototype.listLanguages = function() {
	return this._qry0args('listLanguages');
    }
    CAT.prototype.listAllIdentityProviders = function(lang) {
	return this._qry1args('listAllIdentityProviders', lang);
    }
    CAT.prototype.listIdentityProviders = function(idpid, lang) {
	return this._qry2args('listIdentityProviders', 'id', idpid, lang);
    }
    CAT.prototype.listProfiles = function(countryid, lang) {
	return this._qry2args('listProfiles', 'id', countryid, lang);
    }
    CAT.prototype.profileAttributes = function(profid, lang) {
	return this._qry2args('profileAttributes', 'id', profid, lang);
    }
    CAT.prototype.listDevices = function(profid, lang) {
	return this._qry2args('listDevices', 'id', profid, lang);
    }
    CAT.prototype.generateInstaller = function(profid, osid, lang) {
	return this._qry3args('generateInstaller', 'profile', profid, 'id', osid, lang);
    }
    CAT.prototype.downloadInstaller = function(profid, osid, lang) {
	var $cat = this;
	var d = $.Deferred();
	var cb = function(ret) {
	    if (!!ret && 'link' in ret) {
		var qs = ret.link.replace(/^.*\?/, '');
		return $cat.query($.getQueryParameters(qs))
		    .done(function(ret) {
			d.resolve(ret);
		    });
	    } else {
		d.fail(ret);
	    }
	}
	this.generateInstaller.apply(this, arguments)
	    .then(cb, cb);
	return d.promise();
    }
    CAT.prototype.deviceInfo = function(profid, osid, lang) {
	return this._qry3args('deviceInfo', 'profile', profid, 'id', osid, lang);
    }
    CAT.prototype.sendLogo = function(idpid, lang) {
	return this._qry2args('sendLogo', 'id', idpid, lang);
    }
})(jQuery);
