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
    function flipObject(orig) {
	var key, flip = {};
	for (key in orig) {
            if (orig.hasOwnProperty(key)) {
		flip[orig[key]] = key;
            }
	}
	return flip;
    }
    // copied (simplified) from:
    // https://github.com/sindresorhus/query-string
    function getQueryParameters(str) {
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
    function getQueryString(obj) {
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

    // ***** CAT API *****
    var API_TRANSLATIONS = {
	2: {
	    listLanguages:
	    {
		to: {},
		from:
		{
		    id: 'lang'
		}
	    },
	    listCountries:
	    {
		to: {},
		from:
		{
		    id: 'federation'
		}
	    },
	    listIdentityProviders:
	    {
		to:
		{
		    id: 'federation'
		},
		from:
		{
		    id: 'idp'
		}
	    },
	    listAllIdentityProviders:
	    {
		to: {},
		from:
		{
		    id: 'idp'
		}
	    },
	    orderIdentityProviders:
	    {
		to:
		{
		    id: 'federation'
		},
		from:
		{
		    id: 'idp'
		}
	    },
	    listProfiles:
	    {
		to:
		{
		    id: 'idp'
		},
		from:
		{
		    id: 'profile'
		}
	    },
	    listDevices:
	    {
		to:
		{
		    id: 'profile'
		},
		from:
		{
		    id: 'device'
		}
	    },
	    generateInstaller:
	    {
		to:
		{
		    id: 'device'
		},
		from: {}
	    },
	    downloadInstaller:
	    {
		to:
		{
		    id: 'device'
		},
		from: {}
	    },
	    profileAttributes:
	    {
		to:
		{
		    id: 'profile'
		},
		// nested devices obj
		from:
		{
		    id: 'device'
		}
	    },
	    sendLogo:
	    {
		to:
		{
		    id: 'idp'
		},
		from: {}
	    },
	    deviceInfo:
	    {
		to:
		{
		    id: 'device'
		},
		from: {}
	    },
	    detectOS:
	    {
		to: {},
		from:
		{
		    id: 'device'
		}
	    }
	}
    }
    CAT = function(options) {
	var cat_eduroam_org_api = 'https://cat.eduroam.org/user/API.php';
	this._defaults = {
	    apiBase: cat_eduroam_org_api,
	    apiBaseD: cat_eduroam_org_api,
	    lang: 'en',
	    redirectDownload: true,
	    api_version: 1
	}
        this.options = $.extend( {}, this._defaults, options);
	this._cache = {};
	this._xhrcache = {};
    }
    CAT.prototype.API_TRANSLATIONS = API_TRANSLATIONS;
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
    CAT.prototype.apiVersionGetTranslations = function(act, direction, reverse) {
	var param_translations = this.API_TRANSLATIONS,
	    api_version = this.options.api_version;
	if ((api_version in param_translations) &&
	    !!act && (act in param_translations[api_version]) &&
	    !!direction && (direction in param_translations[api_version][act])) {
	    return reverse ?
		flipObject(param_translations[api_version][act][direction]) :
		param_translations[api_version][act][direction];
	} else {
	    return {};
	}
    }
    CAT.prototype.apiVersionGetTranslated = function(obj, act, direction, reverse) {
	var args = Array.prototype.slice.call(arguments, 1),
	    translations = this.apiVersionGetTranslations.apply(this, args),
	    obj_keys = Object.keys(obj),
	    obj_translated;
	if (obj instanceof Array) {
	    obj_translated = [];
	} else {
	    obj_translated = {};
	}
	for (var key in obj_keys) {
	    key = obj_keys[key];
	    // skip hasOwnProperty check on Arrays?
	    if (!(obj instanceof Array) &&
		!obj.hasOwnProperty(key)) {
		continue;
	    }
	    if (obj_translated[key] instanceof Object) {
		obj_translated[key] = this.apiVersionGetTranslated
		    .apply(this, [obj_translated[key]].concat(args));
	    } else {
		obj_translated[key] = obj[key];
	    }
	    if (!(obj instanceof Array) &&
		(key in translations)) {
		obj_translated[translations[key]] = obj_translated[key];
		delete obj_translated[key];
	    }
	}
	return obj_translated;
    }
    CAT.prototype.query = function(qro) {
	if (!('action' in qro)) {
	    // throw something?
	    return null;
	}
	if (!('lang' in qro)) {
	    qro.lang = this.lang();
	}

	if (this.options.api_version !== 1) {
	    qro.api_version = this.options.api_version;
	    qro = this.apiVersionGetTranslated(qro, qro.action, 'to');
	}
	var dtype = 'json';
	var ep = qro.action.startsWith('downloadInstaller') &&
	    this.options.redirectDownload === true ?
	    this.options.apiBaseD : this.options.apiBase;
	var directUri = [ep, getQueryString(qro)].join('?');

	switch (qro.action) {
	case 'downloadInstallerUri':
	    qro.action = qro.action.replace(/Uri$/, '');
	    directUri = [ep, getQueryString(qro)].join('?');
	    return $.when().then(function(){
		return directUri;
	    });
	    break;
	case 'downloadInstaller':
	    // console.log("wlh", directUri);
	    window.location.href = directUri;
	    return $.when().then(function(){
		return directUri;
	    });
	    break;
	case 'sendLogoUri':
	    qro.action = qro.action.replace(/Uri$/, '');
	    directUri = [ep, getQueryString(qro)].join('?');
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
	    if (directUri in this._xhrcache) {
		return this._xhrcache[directUri];
	    } else {
		this._xhrcache[directUri] = $.ajax({
		    dataType: dtype,
		    url: ep,
		    data: qro,
		    beforeSend: function(jqxhr) {
			jqxhr._cat_ep = ep;
			jqxhr._cat_qro = qro;
		    }
		});
		return this._xhrcache[directUri];
	    }
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
		    if (!('status' in ret) || ret.status != 1 || !('data' in ret)) {
			$cat._cache[act] = null;
			return null;
		    }
		    if (!!ret.tou) {
			$cat._tou = ret.tou;
		    }
		    var data = ret.data;
		    var jqxhr = !!arguments[2] ? arguments[2] : {};
		    if ($cat.options.api_version !== 1 &&
			!!jqxhr._cat_qro && !!jqxhr._cat_qro.action) {
			data = $cat.apiVersionGetTranslated(data, jqxhr._cat_qro.action, 'from', true);
		    }
		    $cat._cache[act] = data;
		    return data;
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
	if ((act in this._cache) &&
	    (lang in this._cache[act])) {
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
		    if (!('status' in ret) || ret.status != 1 || !('data' in ret)) {
			$cat._cache[act][lang] = null;
			return null;
		    }
		    if (!!ret.tou) {
			$cat._tou = ret.tou;
		    }
		    var data = ret.data;
		    var jqxhr = !!arguments[2] ? arguments[2] : {};
		    if ($cat.options.api_version !== 1 &&
			!!jqxhr._cat_qro && !!jqxhr._cat_qro.action) {
			data = $cat.apiVersionGetTranslated(data, jqxhr._cat_qro.action, 'from', true);
		    }
		    $cat._cache[act][lang] = data;
		    return data;
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
	if ((act in this._cache) &&
	    (idval in this._cache[act]) &&
	    (lang in this._cache[act][idval])) {
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
		    if (!('status' in ret) || ret.status != 1 || !('data' in ret)) {
			$cat._cache[act][idval][lang] = null;
			return null;
		    }
		    if (!!ret.tou) {
			$cat._tou = ret.tou;
		    }
		    var data = ret.data;
		    var jqxhr = !!arguments[2] ? arguments[2] : {};
		    if ($cat.options.api_version !== 1 &&
			!!jqxhr._cat_qro && !!jqxhr._cat_qro.action) {
			data = $cat.apiVersionGetTranslated(data, jqxhr._cat_qro.action, 'from', true);
		    }
		    $cat._cache[act][idval][lang] = data;
		    return data;
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
	if ((act in this._cache) &&
	    (id1val in this._cache[act]) &&
	    (id2val in this._cache[act][id1val]) &&
	    (lang in this._cache[act][id1val][id2val])) {
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
		    if (!('status' in ret) || ret.status != 1 || !('data' in ret)) {
			$cat._cache[act][id1val][id2val][lang] = null;
			return null;
		    }
		    if (!!ret.tou) {
			$cat._tou = ret.tou;
		    }
		    var data = ret.data;
		    var jqxhr = !!arguments[2] ? arguments[2] : {};
		    if ($cat.options.api_version !== 1 &&
			!!jqxhr._cat_qro && !!jqxhr._cat_qro.action) {
			data = $cat.apiVersionGetTranslated(data, jqxhr._cat_qro.action, 'from', true);
		    }
		    $cat._cache[act][id1val][id2val][lang] = data;
		    return data;
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
    CAT.prototype._getIdentityProvidersByID = function() {
	// console.log('_getIdentityProvidersByID arguments:', arguments);
	var args = Array.prototype.slice.call(arguments),
	    act = args.shift(),
	    _act = act + 'ByID',
	    countryid;
	// console.log('_getIdentityProvidersByID args:', args, act);
	var langIdx = 0;
	switch (act) {
	case 'listAllIdentityProviders':
	    break;
	case 'listIdentityProviders':
	    countryid = args[0];
	    langIdx += 1;
	    break;
	default:
	    // throw something?
	    return null
	}
	var lang = (langIdx in args) ? args[langIdx] : undefined;
	if (typeof lang === 'undefined') {
	    lang = this.lang();
	}
	var $cat = this;
	var d = new $.Deferred();
	if ((_act in this._cache) &&
	    (lang in this._cache[_act])) {
	    // use a (resolved) promise for consistency
	    d.resolve(this._cache[_act][lang]);
	} else {
	    var cb = function(ret) {
		// console.log('cbID this:', this);
		// console.log('cbID args:', arguments);
		if (ret instanceof Array) {
		    if (!(_act in $cat._cache)) {
			$cat._cache[_act] = {};
		    }
		    switch (act) {
		    case 'listAllIdentityProviders':
			if (!(lang in $cat._cache[_act])) {
			    $cat._cache[_act][lang] = {};
			}
			for (var idx = 0; idx < ret.length; idx++) {
			    // console.log('ret[' + idx + ']:', ret[idx]);
			    if ('entityID' in ret[idx]) {
				$cat._cache[_act][lang][ret[idx].entityID] = ret[idx];
			    }
			}
			d.resolve($cat._cache[_act][lang]);
			break;
		    case 'listIdentityProviders':
			if (typeof countryid === 'undefined') {
			    d.fail(null) // not sure!
			    break;
			}
			if (!(countryid in $cat._cache[_act])) {
			    $cat._cache[_act][countryid] = {};
			}
			if (!(lang in $cat._cache[_act][countryid])) {
			    $cat._cache[_act][countryid][lang] = {};
			}
			for (var idx = 0; idx < ret.length; idx++) {
			    // console.log('ret[' + idx + ']:', ret[idx]);
			    if ('id' in ret[idx]) {
				$cat._cache[_act][countryid][lang][ret[idx].id] = ret[idx];
			    }
			}
			d.resolve($cat._cache[_act][countryid][lang]);
			break;
		    }
		} else {
		    d.fail(null); // not sure!
		}
	    }
	    this[act].apply(this, args)
		.then(cb, cb);
	}
	return d.promise();
    }
    CAT.prototype.listAllIdentityProviders = function(lang) {
	return this._qry1args('listAllIdentityProviders', lang);
    }
    CAT.prototype.listAllIdentityProvidersByID = function(lang) {
	var args = Array.prototype.slice.call(arguments);
	args.unshift('listAllIdentityProviders');
	return this._getIdentityProvidersByID.apply(this, args);
    }
    CAT.prototype.listIdentityProviders = function(countryid, lang) {
	return this._qry2args('listIdentityProviders', 'id', countryid, lang);
    }
    CAT.prototype.listIdentityProvidersByID = function(countryid, lang) {
	var args = Array.prototype.slice.call(arguments);
	args.unshift('listIdentityProviders');
	return this._getIdentityProvidersByID.apply(this, args);
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
    CAT.prototype.downloadInstaller = function(profid, osid, lang, dryrun) {
	var $cat = this;
	var cb = function(ret) {
	    if (!!ret && ('link' in ret)) {
		var qs = ret.link.replace(/^.*\?/, ''),
		    qro = getQueryParameters(qs);
		if (dryrun) {
		    qro.action += 'Uri';
		}
		return $cat.query(qro)
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
    CAT.prototype.sendLogo = function(idpid, lang, dryrun) {
	var act = 'sendLogo';
	if (!!dryrun) {
	    act += 'Uri';
	}
	return this._qry2args(act, 'id', idpid, lang);
    }

    // ***** CAT Identity Provider *****
    CatIdentityProvider = function(cat, id, lang) {
	this.cat = cat;
	this.id = id;
	this.lang = lang;
    }
    CatIdentityProvider.prototype.getRaw = function() {
	var $idp = this;
	var cb = function (ret) {
	    if (!!ret && ($idp.id in ret)) {
		return ret[$idp.id];
	    } else {
		return null;
	    }
	}
	return $.when(
	    this.cat.listAllIdentityProvidersByID(this.lang)
	).then(cb, cb);
    }
    CatIdentityProvider.prototype._getProp = function(rawFunc, prop) {
	var cb = function(ret) {
	    // console.log('getProp args:', arguments);
	    if (typeof prop === 'undefined') {
		return null;
	    }
	    if (!!ret &&
		(prop in ret)) {
		return ret[prop];
	    } else {
		return null;
	    }
	}
	return $.when(
	    rawFunc.call(this)
	).then(cb, cb);
    }
    CatIdentityProvider.prototype.getEntityID = function() {
	return this._getProp(this.getRaw, 'entityID');
    }
    CatIdentityProvider.prototype.getCountry = function() {
	return this._getProp(this.getRaw, 'country');
    }
    CatIdentityProvider.prototype.getIconID = function() {
	return this._getProp(this.getRaw, 'icon');
    }
    CatIdentityProvider.prototype.getIconURL = function() {
	var $idp = this;
	var cb = function(ret) {
	    if (ret != null &&
		parseInt(ret)) {
		return $idp.cat.sendLogo(ret, this.lang, true);
	    }
	    return ret;
	}
	return $.when(
	    this._getProp(this.getRaw, 'icon')
	).then(cb, cb);
    }
    CatIdentityProvider.prototype.getTitle = function() {
	return this._getProp(this.getRaw, 'title');
    }
    CatIdentityProvider.prototype.getDisplay = function() {
	return this._getProp(this.getRaw, 'title');
    }
    CatIdentityProvider.prototype.getGeo = function() {
	var cb = function(ret) {
	    if (ret instanceof Array) {
		var geo = [];
		ret.forEach(function(cur, idx) {
		    var coord = {
			lat: parseFloat(cur.lat),
			lon: parseFloat(cur.lon)
		    }
		    // necessary hack because CAT apparently may return duplicate coords!
		    if (geo.find(function(cur) {
			return (JSON.stringify(cur) === JSON.stringify(coord));
		    }) === undefined) {
			geo.push(coord);
		    }
		});
		return geo;
	    } else {
		return null;
	    }
	}
	return $.when(
	    this._getProp(this.getRaw, 'geo')
	).then(cb, cb);
    }
    CatIdentityProvider.prototype.getDistanceFrom = function(lat, lon) {
	function deg2rad (deg) {
	    return deg * ((1 / 180) * Math.PI);
	}
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
    CatIdentityProvider.prototype.getProfiles = function() {
	// consider caching these objects
	return CatProfile.getProfilesByIdPEntityID(this.cat, this.id, this.lang);
    }
    CatIdentityProvider.prototype.hasSearchMatch = function(search) {
	if (typeof search !== 'string') {
	    return false;
	}
	var keywords = search.toLowerCase().trim().split(/[\s,]+/);
	var cb = function(ret) {
	    if (!!!ret) {
		return false;
	    }
	    return keywords.reduce(function(carry, item) {
		// console.log('reduce:', carry, item, (!item || ret.toLowerCase().indexOf(item) !== -1));
		return carry && (!item || ret.toLowerCase().indexOf(item) !== -1);
	    }, true);
	}
	return $.when(
	    this.getTitle()
	).then(cb, cb);
    }

    // ***** CAT Profile *****
    CatProfile = function(cat, idpid, profid, lang) {
	this.cat = cat;
	this.idp = idpid;
	this.id = profid;
	this.lang = lang;
    }
    // not an instance method!
    CatProfile.getProfilesByIdPEntityID = function(cat, idpid, lang) {
	var cb = function(ret) {
	    // console.log('prof.getProfilesByIdPID ret', ret);
	    if (ret instanceof Array) {
		var profiles = {};
		for (var idx=0; idx < ret.length; idx++) {
		    if (!!ret[idx] && ('id' in ret[idx]) && parseInt(ret[idx].id)) {
			profiles[ret[idx].id] = new CatProfile(cat, idpid, ret[idx].id, lang);
		    }
		}
		return profiles;
	    } else {
		return null;
	    }
	}
	return $.when(
	    cat.listProfiles(idpid, lang)
	).then(cb, cb);
    }
    // PHP (wrong?): getRawAttributes()
    CatProfile.prototype.getRaw = function() {
	var $prof = this;
	var cb = function (ret) {
	    // console.log('prof.getRaw ret', ret);
	    if (ret instanceof Array) {
		return ret.find(function(cur, idx) {
		    return !!cur && parseInt(cur.id) === $prof.id;
		});
	    } else {
		return null;
	    }
	}
	return $.when(
	    this.cat.listProfiles(this.idp, this.lang)
	).then(cb, cb);
    }
    // PHP (wrong?): getRaw()
    CatProfile.prototype.getRawAttributes = function() {
	return this.cat.profileAttributes(this.id, this.lang);
    }
    // not an instance method!
    CatProfile.getRawDevicesByProfileID = function(cat, profid, lang) {
	// simulated 'this' obj, having only what _getProp() and getRawAttributes() access
	var fake_this = { cat: cat,
			  id: profid,
			  lang: lang }
	return CatProfile.prototype._getProp.call(fake_this,
						  CatProfile.prototype.getRawAttributes,
						  'devices');
    }
    CatProfile.prototype._getProp = function(rawFunc, prop) {
	var cb = function(ret) {
	    // console.log('getProp args:', arguments);
	    if (typeof prop === 'undefined') {
		return null;
	    }
	    if (!!ret &&
		(prop in ret)) {
		return ret[prop];
	    } else {
		return null;
	    }
	}
	return $.when(
	    rawFunc.call(this)
	).then(cb, cb);
    }
    CatProfile.prototype.getProfileID = function() {
	return this.id;
    }
    CatProfile.prototype.getIdpID = function() {
	return this.idp;
    }
    CatProfile.prototype.getDisplay = function() {
	var idpObj = this.getIdentityProvider();
	var cb = function(prof_display, idp_display) {
	    if (prof_display) {
		return prof_display;
	    } else if (idp_display) {
		return idp_display;
	    } else {
		return null;
	    }
	}
	return $.when(
	    this._getProp(this.getRaw, 'display'),
	    idpObj.getDisplay()
	).then(cb, cb);
    }
    /*
     * omitting #hasLogo() and #getIdentityProviderName() because these
     * belong in the IdentityProvider class.
     */
    CatProfile.prototype.getLocalEmail = function() {
	return this._getProp(this.getRawAttributes, 'local_email');
    }
    CatProfile.prototype.getLocalPhone = function() {
	return this._getProp(this.getRawAttributes, 'local_phone');
    }
    CatProfile.prototype.getLocalUrl = function() {
	return this._getProp(this.getRawAttributes, 'local_url');
    }
    CatProfile.prototype.getDescription = function() {
	return this._getProp(this.getRawAttributes, 'description');
    }
    CatProfile.prototype.getDevices = function() {
	// consider caching these objects
	var $prof = this;
	var cb = function(ret) {
	    if (ret instanceof Array) {
		var devices = {};
		ret.forEach(function(cur, idx) {
		    // console.log('cur.id', cur.id,
		    // 		'!!cur.redirect', !!cur.redirect,
		    // 		'("status" in cur)', ('status' in cur),
		    // 		'cur.status >= 0', (cur.status >= 0),
		    // 		'("options" in cur)', ('options' in cur),
		    // 		'(!("options" in cur) || !!!cur.options.hidden)',
		    // 		(!("options" in cur) || !!!cur.options.hidden),
		    // 		'final',
		    // 		((!!cur.redirect ||
		    // 		  (('status' in cur) &&
		    // 		   (cur.status >= 0))) &&
		    // 		 (!("options" in cur) || !!!cur.options.hidden)));
		    if ((!!cur.redirect ||
			 (('status' in cur) &&
			  (cur.status >= 0))) &&
			(!("options" in cur) || !!!cur.options.hidden)) {
			devices[cur.id] = new CatDevice($prof.cat,
							$prof.idp,
							$prof.id,
							cur.id,
							$prof.lang);
		    }
		});
		return devices;
	    } else {
		return null;
	    }
	}
	return $.when(
	    this._getProp(this.getRawAttributes, 'devices')
	).then(cb, cb);
    }
    CatProfile.prototype.hasSupport = function() {
	var cb = function(local_email,
			  local_phone,
			  local_url) {
	    // console.log('hasSupport args:', arguments);
	    return !!local_email ||
		!!local_phone ||
		!!local_url;
	}
	return $.when(
	    this.getLocalEmail(),
	    this.getLocalPhone(),
	    this.getLocalUrl()
	).then(cb, cb);
    }
    CatProfile.prototype.getIdentityProvider = function() {
	return new CatIdentityProvider(this.cat, this.idp, this.lang);
    }
    CatProfile.prototype.isRedirect = function() {
	var cb = function(ret) {
	    var deferreds = [];
	    for (var devid in ret) {
		deferreds.push(ret[devid].isProfileRedirect());
	    }
	    var cb = function() {
		var args = Array.prototype.slice.call(arguments);
		// Return value: true if the callback function returns
		// a truthy value for any array element; otherwise,
		// false.
		return args.some(function(cur) {
		    return cur;
		});
	    }
	    return $.when.apply($, deferreds)
		.then(cb, cb);
	}
	return $.when(
	    this.getDevices()
	).then(cb, cb);
    }

    // ***** CAT Device *****
    var USER_AGENTS = {
	'vista': [/Windows NT 6[._]0/],
	'w7': [/Windows NT 6[._]1/],
	'w8': [/Windows NT 6[._][23]/],
	'w10': [/Windows NT 10[._]/, /Windows NT 1[1-9]/, /Windows NT [2-9][0-9]/],
	'mobileconfig-56': [/\((iPad|iPhone|iPod);.*OS [56]_/],
	'mobileconfig': [/\((iPad|iPhone|iPod);.*OS [7-9]/, /\((iPad|iPhone|iPod);.*OS [1-9][0-9]/],
	'apple_lion': [/Mac OS X 10[._]7/],
	'apple_m_lion': [/Mac OS X 10[._]8/],
	'apple_mav': [/Mac OS X 10[._]9/],
	'apple_yos': [/Mac OS X 10[._]10/],
	'apple_el_cap': [/Mac OS X 10[._]11/],
	'apple_sierra': [/Mac OS X 10[._]1[2-9]/, /Mac OS X 10[._][2-9][0-9]/],
	'linux': [/Linux(?!.*Android)/],
	'chromeos': [/CrOS/],
	'android43': [/Android 4[._]3/],
	'android_kitkat': [/Android 4[._][4-9]/],
	'android_lollipop': [/Android 5[._][0-9]/],
	'android_marshmallow': [/Android 6[._][0-9]/],
	'android_nougat': [/Android [7-9]/, /Android [1-9][0-9]/],
	'android_legacy': [/Android/],
	'__undefined__': [ new RegExp('') ],
    }
    var DEVICE_GROUPS = {
	'Windows': [/^w[0-9]/, /^vista$/],
	'Apple': [/^apple/, /^mobileconfig/],
	'Android': [/^android/],
	'Other': [ new RegExp('') ],
    }
    CatDevice = function(cat, idpid, profid, devid, lang) {
	this.cat = cat;
	this.idp = idpid;
	this.profid = profid;
	this.id = devid;
	this.lang = lang;
    }
    CatDevice.prototype.USER_AGENTS = USER_AGENTS;
    CatDevice.prototype.DEVICE_GROUPS = DEVICE_GROUPS;
    // not an instance method!
    CatDevice.loadDevices = function(cat, idpid, profid, lang) {
	var cb = function(devices_augmented,
			  devices) {
	    // console.log('loadDevices.cb args:', arguments);
	    var devs_array,
		devs_obj = {};
	    if (devices_augmented instanceof Array &&
		devices_augmented.length) {
		devs_array = devices_augmented;
	    }
	    else if (devices instanceof Array &&
		     devices.length) {
		devs_array = devices;
	    } else {
		return null;
	    }
	    for (var idx = 0; idx < devs_array.length; idx++) {
		if ('id' in devs_array[idx]) {
		    devs_obj[devs_array[idx].id] = devs_array[idx];
		}
	    }
	    return devs_obj;
	}
	return $.when(
	    CatProfile.getRawDevicesByProfileID(cat, profid, lang),
	    cat.listDevices(profid, lang)
	).then(cb, cb);
    }
    // not an instance method!
    CatDevice.groupDevices = function(devices) {
	var result = {},
	    k;
	for (k in CatDevice.prototype.DEVICE_GROUPS) {
	    result[k] = [];
	}
	var _devices = [],
	    deferreds = [];
	for (var idx=0; idx < devices.length; idx++) {
	    if (!('getStatus' in devices[idx]) ||
		!('getGroup' in devices[idx])) {
		continue;
	    }
	    _devices.push(devices[idx]);
	    deferreds.push(devices[idx].getStatus());
	}
	var cb = function() {
	    var args = Array.prototype.slice.call(arguments);
	    // console.log('cb groupDevices:', args);
	    for (var idx=0; idx < _devices.length; idx++) {
		var group = _devices[idx].getGroup(),
		    status = args[idx];
		// console.log('dev, status, group', _devices[idx], status, group);
		if (status != 0) {
		    continue;
		}
		if (group != null) {
		    result[group].push(_devices[idx]);
		}
	    }
	    for (k in result) {
		if (!result[k].length) {
		    delete result[k];
		}
	    }
	    return result;
	}
	return $.when.apply($, deferreds)
	    .then(cb, cb);
    }
    // not an instance method!
    CatDevice.guessDeviceID = function(userAgent, deviceIDs) {
	var UAs = CatDevice.prototype.USER_AGENTS;
	deviceIDs = deviceIDs instanceof Array ? deviceIDs : Object.keys(UAs);
	for (var idx=0; idx < deviceIDs.length; idx++) {
	    var device_patterns = UAs[deviceIDs[idx]] instanceof Array ?
		UAs[deviceIDs[idx]] : [];
	    for (var regex in device_patterns) {
		if (device_patterns[regex].test(userAgent)) {
		    return deviceIDs[idx];
		}
	    }
	}
	return null;
    }
    CatDevice.prototype.getDeviceID = function() {
	return this.id;
    }
    CatDevice.prototype.getProfileID = function() {
	return this.profid;
    }
    // CatProfile.prototype.getIdpID = function() {
    // 	return this.idp;
    // }
    CatDevice.prototype.getRaw = function() {
	var $dev = this;
	var cb = function(ret) {
	    // console.log('getRaw.cb args:', arguments, $dev.id);
	    if (!!ret &&
		($dev.id in ret)) {
		return ret[$dev.id];
	    } else {
		return null;
	    }
	}
	return $.when(
	    CatDevice.loadDevices(this.cat, this.idp, this.profid, this.lang)
	).then(cb, cb);
    }
    CatDevice.prototype._getProp = function(rawFunc, prop) {
	var cb = function(ret) {
	    // console.log('getProp args:', arguments);
	    if (typeof prop === 'undefined') {
		return null;
	    }
	    if (!!ret &&
		(prop in ret)) {
		return ret[prop];
	    } else {
		return null;
	    }
	}
	return $.when(
	    rawFunc.call(this)
	).then(cb, cb);
    }
    CatDevice.prototype.getDisplay = function() {
	var cb = function(is_profileredirect,
			  device_display) {
	    // console.log('getDisplay args:', arguments);
	    if (is_profileredirect) {
		return 'External';
	    }
	    return device_display;
	}
	return $.when(
	    this.isProfileRedirect(),
	    this._getProp(this.getRaw, 'display')
	).then(cb, cb);
    }
    CatDevice.prototype.getStatus = function() {
	return this._getProp(this.getRaw, 'status');
    }
    CatDevice.prototype.getRedirect = function() {
	return this._getProp(this.getRaw, 'redirect');
    }
    CatDevice.prototype.getEapCustomText = function() {
	return this._getProp(this.getRaw, 'eap_customtext');
    }
    CatDevice.prototype.getDeviceCustomText = function() {
	return this._getProp(this.getRaw, 'device_customtext');
    }
    CatDevice.prototype.getMessage = function() {
	return this._getProp(this.getRaw, 'message');
    }
    CatDevice.prototype.getDeviceInfo = function() {
	var cb = function(is_redirect,
			  cat_deviceinfo) {
	    // console.log('getDeviceInfo args:', arguments);
	    if (is_redirect) {
		// Seems like CAT doesn't answer this one on redirects...
		return null;
	    }
	    return cat_deviceinfo;
	}
	return $.when(
	    this.isRedirect(),
	    this.cat.deviceInfo(this.profid, this.id, this.lang)
	).then(cb, cb);
    }
    CatDevice.prototype.getDownloadLink = function() {
	var cb = function(device_redirect,
			  download_uri) {
	    // console.log('getDownloadLink args:', arguments);
	    if (!!device_redirect) {
		// Seems like CAT doesn't answer this one on redirects...
		return null;
	    }
	    return device_redirect || download_uri;
	}
	return $.when(
	    this.getRedirect(),
	    this.cat.downloadInstaller(this.profid, this.id, this.lang, true)
	).then(cb, cb);
    }
    CatDevice.prototype.isRedirect = function() {
	var cb = function(ret) {
	    // console.log('isRedirect done args:', arguments);
	    return !!ret;
	}
	return this._getProp(this.getRaw, 'redirect')
	    .then(cb, cb);
    }
    CatDevice.prototype.isProfileRedirect = function() {
	var $dev = this;
	var cb = function(device_redirect,
			  device_display) {
	    // '0' is the fake device-id returned by profileAttributes
	    // for a profile-induced redirect -> we do need to match it
	    // '__undefined__' is our fake device-id for the last
	    // resort match in USER_AGENTS -> not sure if we need it here...
	    return ($dev.id == '__undefined__' ||
		    $dev.id === '0') && !!!device_display && device_redirect;
	}
	return $.when(
	    this.getRedirect(),
	    this._getProp(this.getRaw, 'display')
	).then(cb, cb);
    }
    CatDevice.prototype.getGroup = function() {
	var dev_groups = this.DEVICE_GROUPS;
	for (var group in dev_groups) {
	    var device_patterns = dev_groups[group] instanceof Array ?
		dev_groups[group] : [];
	    for (var regex in device_patterns) {
		if (device_patterns[regex].test(this.getDeviceID())) {
		    return group;
		}
	    }
	}
	// failsafe?
	return 'Other';
    }
})(jQuery);
