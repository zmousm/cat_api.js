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
	    lang: 'en',
	    redirectDownload: true
	}
        this.options = $.extend( {}, this._defaults, options);
	this._cache = {};
    }
    CAT.prototype.apiBase = function(direct, newApiBase) {
	if (typeof newApiBase !== 'undefined') {
	    if (direct === true) {
		this.options.apiBaseD = newApiBase;
	    } else {
		this.options.apiBase = newApiBase;
	    }
	}
    	return direct === true ?
	    this.options.apiBaseD : this.options.apiBase;
    }
    CAT.prototype.lang = function(newLang) {
	if (typeof newLang !== 'undefined') {
	    this.options.lang = newLang;
	}
	return this.options.lang;
    }
    CAT.prototype.downloadRedirect = function(newRedirectDownload) {
	if (typeof newRedirectDownload !== 'undefined') {
	    this.options.redirectDownload = newRedirectDownload;
	}
	return this.options.redirectDownload;
    }

    CAT.prototype.query = function(qro) {
	if (!'action' in qro) {
	    // throw something?
	    return null;
	}
	if (!('lang' in qro)) {
	    qro.lang = this.lang();
	}

	var dtype = 'json';
	var ep = qro.action == 'downloadInstaller' &&
	    this.options.redirectDownload === true ?
	    this.options.apiBaseD : this.options.apiBase;
	var directUri = [ep, $.getQueryString(qro)].join('?');

	switch (qro.action) {
	case 'downloadInstaller':
	    // console.log("wlh", directUri);
	    window.location.href = directUri;
	    return $.when().then(function(){
		return directUri;
	    });
	    break;
	case 'sendLogo':
	    // console.log('imgSrc', directUri);
	    // delete dtype;
	    return $.when().then(function(){
		return $('<img>').attr('src', directUri);
	    });
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
	    return $.when().then(function(){
		return $cat._cache[act];
	    });
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
	    lang = this.lang();
	}
	var $cat = this;
	if (act in this._cache &&
	    lang in this._cache[act]) {
	    // return a (resolved) promise for consistency
	    return $.when().then(function(){
		return $cat._cache[act][lang];
	    });
	} else {
	    var qro = {
		action: act
	    }
	    if (lang !== this.lang()) {
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
	if (!act ||
	    !idname ||
	    (typeof !idval === 'undefined')) {
	    // throw something?
	    return null;
	}
	if (typeof lang === 'undefined') {
	    lang = this.lang();
	}
	var $cat = this;
	if (act in this._cache &&
	    idval in this._cache[act] &&
	    lang in this._cache[act][idval]) {
	    // return a (resolved) promise for consistency
	    return $.when().then(function() {
		return $cat._cache[act][idval][lang];
	    });
	} else {
	    var qro = {
		action: act
	    }
	    if (lang !== this.lang()) {
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
	if (!act ||
	    !id1name ||
	    (typeof !id1val === 'undefined') ||
	    !id2name ||
	    (typeof id2val === 'undefined')) {
	    // throw something?
	    return null;
	}
	if (typeof lang === 'undefined') {
	    lang = this.lang();
	}
	var $cat = this;
	if (act in this._cache &&
	    id1val in this._cache[act] &&
	    id2val in this._cache[act][id1val] &&
	    lang in this._cache[act][id1val][id2val]) {
	    // return a (resolved) promise for consistency
	    return $.when().then(function() {
		return $cat._cache[act][id1val][id2val][lang];
	    });
	} else {
	    var qro = {
		action: act
	    }
	    if (lang !== this.lang()) {
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
    CAT.prototype.listAllIdentityProvidersByID = function(lang) {
	var act = 'listAllIdentityProvidersByID';
	if (typeof lang === 'undefined') {
	    lang = this.lang();
	}
	var $cat = this;
	var d = new $.Deferred();
	if (act in this._cache &&
	    lang in this._cache[act]) {
	    // use a (resolved) promise for consistency
	    d.resolve(this._cache[act][lang]);
	} else {
	    var cb = function(ret) {
		// console.log('cbID this:', this);
		// console.log('cbID args:', arguments);
		if (ret instanceof Array) {
		    if (!(act in $cat._cache)) {
			$cat._cache[act] = {};
		    }
		    if (!(lang in $cat._cache[act])) {
			$cat._cache[act][lang] = {};
		    }
		    for (var idx = 0; idx < ret.length; idx++) {
			if ('entityID' in ret[idx]) {
			    $cat._cache[act][lang][ret[idx].entityID] = ret[idx];
			}
		    }
		    d.resolve($cat._cache[act][lang]);
		} else {
		    d.fail(null); // not sure!
		}
	    }
	    this.listAllIdentityProviders.apply(this, arguments)
		.then(cb, cb);
	}
	return d.promise();
    }
    CAT.prototype.listIdentityProviders = function(countryid, lang) {
	return this._qry2args('listIdentityProviders', 'id', countryid, lang);
    }
    CAT.prototype.listProfiles = function(idpid, lang, sort) {
	sort = sort ? 1 : 0;
	return this._qry3args('listProfiles', 'id', idpid, 'sort', sort, lang);
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
	var cb = function(ret) {
	    if (!!ret && 'link' in ret) {
		var qs = ret.link.replace(/^.*\?/, '');
		return $cat.query($.getQueryParameters(qs))
		    .done(function(ret) {
			return ret;
		    });
	    } else {
		return ret;
	    }
	}
	return $.when(
	    this.generateInstaller.apply(this, arguments)
	).then(cb, cb);
    }
    CAT.prototype.deviceInfo = function(profid, osid, lang) {
	return this._qry3args('deviceInfo', 'profile', profid, 'id', osid, lang);
    }
    CAT.prototype.sendLogo = function(idpid, lang) {
	return this._qry2args('sendLogo', 'id', idpid, lang);
    }

    CatIdentityProvider = function(cat, id, lang) {
	this.cat = cat;
	this.id = id;
	this.lang = lang;
    }
    CatIdentityProvider.prototype.getRaw = function() {
	var $idp = this;
	var cb = function (ret) {
	    if (!!ret && $idp.id in ret) {
		return ret[$idp.id];
	    } else {
		return null;
	    }
	}
	return $.when(
	    this.cat.listAllIdentityProvidersByID(this.lang)
	).then(cb, cb);
    }
    CatIdentityProvider.prototype.getEntityID = function() {
	var cb = function(ret) {
	    if (!!ret && 'entityID' in ret) {
		return ret.entityID;
	    } else {
		return null;
	    }
	}
	return $.when(this.getRaw()).then(cb, cb);
    }
    CatIdentityProvider.prototype.getCountry = function() {
	var $idp = this;
	var cb = function(ret) {
	    if (!!ret && 'country' in ret) {
		$idp.country = ret.country;
		return ret.country;
	    } else {
		return null;
	    }
	}
	return $.when(this.getRaw()).then(cb, cb);
    }
    CatIdentityProvider.prototype.getIconID = function() {
	var cb = function(ret) {
	    if (!!ret && 'icon' in ret) {
		return ret.icon;
	    } else {
		return null;
	    }
	}
	return $.when(this.getRaw()).then(cb, cb);
    }
    CatIdentityProvider.prototype.getTitle = function() {
	var $idp = this;
	var cb = function(ret) {
	    if (!!ret && 'title' in ret) {
		$idp.title = ret.title;
		return ret.title;
	    } else {
		return null;
	    }
	}
	return $.when(this.getRaw()).then(cb, cb);
    }
    CatIdentityProvider.prototype.getGeo = function() {
	var $idp = this;
	var cb = function(ret) {
	    if (!!ret && 'geo' in ret) {
		$idp.geo = [];
		ret.geo.forEach(function(cur, idx) {
		    $idp.geo.push({
			lat: parseFloat(cur.lat),
			lon: parseFloat(cur.lon)
		    });
		});
		return $idp.geo;
	    } else {
		return null;
	    }
	}
	return $.when(this.getRaw()).then(cb, cb);
    }
    CatIdentityProvider.prototype.getDistanceFrom = function(lat, lon) {
	function deg2rad (deg) {
	    return deg * ((1 / 180) * Math.PI);
	}
	var $idp = this;
	var cb = function(ret) {
	    if (ret instanceof Array) {
		var res = [];
		ret.forEach(function(cur, idx) {
		    var lat2 = deg2rad(cur.lat);
		    var lat1 = deg2rad(lat);
		    var lon2 = deg2rad(cur.lon);
		    var lon1 = deg2rad(lon);
		    res.push(
			Math.acos(
			    (Math.sin(lat1) * Math.sin(lat2)) +
				(Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1))
			) * 6371
		    );
		});
		return res;
	    } else {
		return [Infinity];
	    }
	}
	return $.when(this.getGeo()).then(cb, cb);
    }

})(jQuery);
