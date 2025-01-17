//############################################################################
// adiary 汎用 JavaScript
//							(C)2014 nabe@abk
//############################################################################
//[TAB=8]  require jQuery
'use strict';
var DialogWidth = 640;
var DefaultShowSpeed = 300;
var ButtonHelpDelay = 1000;
var TouchDnDTime  = 600;
var DoubleTapTime = 400;
var PopupOffsetX  = 15;
var PopupOffsetY  = 10;
var IE8=false;	// IE8以下
var IE9=false;	// IE9以下
var SP;		// adiary内部がスマホモード
var Storage;
var SettedBrowserClass;

// in Frame.html
var Vmyself;
var Vmyself2;
var ScriptDir;
var PubdistDir;
var SpecialQuery;
var _gaq;
//////////////////////////////////////////////////////////////////////////////
//●初期化処理
//////////////////////////////////////////////////////////////////////////////
$(function(){
	if (Vmyself) Storage=load_PrefixStorage( Vmyself );
	if (!SettedBrowserClass) set_browser_class_into_body();

	// Google Analytics
	if (_gaq) {
		var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
		ga.src = ('https:' == document.location.protocol ? 'https://' : 'http://') + 'stats.g.doubleclick.net/dc.js';
		var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
	}
});

//////////////////////////////////////////////////////////////////////////////
//●RSSからの参照リンクURLの細工を消す
//////////////////////////////////////////////////////////////////////////////
{
	var x = window.location.toString();
	if (x.indexOf('#rss-tm') > 0) {
		window.location = x.replace(/#rss-tm\d*/,'');
	}
}

//////////////////////////////////////////////////////////////////////////////
//●for IE8
//////////////////////////////////////////////////////////////////////////////
if (!('console' in window)) {
	window.console = {};
	var func = function(x){return x};
	window.console.log   = func;
	window.console.warn  = func;
	window.console.error = func;
}
// IE8ではsubstr(-1)が効かない
String.prototype.rsubstr = function(n) {
	return this.substr(this.length-n, n);
}
if (!Array.isArray) Array.isArray = function (vArg) {
	return Object.prototype.toString.call(vArg) === "[object Array]";  
}
if (!String.prototype.trim) String.prototype.trim = function(){
	return this.toString().replace(/^\s+|\s+$/g, '');
}
// IE で repeat が使えない
if (!String.repeat) String.prototype.repeat = function(num){
	var str='';
	var x = this.toString();
	for(var i=0; i<num; i++) str += x;
	return str;
}

//////////////////////////////////////////////////////////////////////////////
//●<body>にCSSのためのブラウザクラスを設定
//////////////////////////////////////////////////////////////////////////////
// この関数は、いち早く設定するためにHTMLから直接呼び出す
function set_browser_class_into_body() {
	SettedBrowserClass=true;

	var x = [];
	var ua = navigator.userAgent;

	     if (ua.indexOf('Chrome') != -1) x.push('GC');
	else if (ua.indexOf('WebKit') != -1) x.push('GC');
	else if (ua.indexOf('Opera')  != -1) x.push('Op');
	else if (ua.indexOf('Gecko')  != -1) x.push('Fx');

	var m = ua.match(/MSIE (\d+)/);
	var n = ua.match(/Trident\/\d+.*rv:(\d+)/);
	if (n) { x = []; m = n; }		// IE11
	if (m) x.push('IE', 'IE' + m[1]);
	  else x.push('NotIE');
	if (m && m[1]<9)  IE8=true;
	if (m && m[1]<10) IE9=true;

	// スマホ
	     if (ua.indexOf('Android') != -1) x.push('android');
	else if (ua.indexOf('iPhone')  != -1) x.push('iphone');
	else if (ua.indexOf('iPad')    != -1) x.push('iphone');
	else if (ua.indexOf('BlackBerry')    != -1) x.push('berry');
	else if (ua.indexOf('Windows Phone') != -1) x.push('wp');

	// windows
	if (ua.indexOf('Windows') != -1) $('html').addClass('win');

	// adiary内部のスマホモード検出
	var body = $('#body');
	if (body.hasClass('sp')) {
		SP = 1;
		DialogWidth = 320;
	}

	// bodyにクラス設定する
	body.addClass( x.join(' ') );
}

//////////////////////////////////////////////////////////////////////////////
//●特殊Queryの処理
//////////////////////////////////////////////////////////////////////////////
$(function(){
  if (SpecialQuery) {
	$('#body').find('a').each( function(idx,dom){
		var obj = $(dom);
		var url = obj.attr('href');
		if (! url) return;
		if (url.indexOf(Vmyself)!=0) return;
		if (url.match(/\?[\w\/]+$/)) return;	// 管理画面では解除する
		if (url.match(/\?(.+&)?_\w+=/)) return;	// すでに特殊Queryがある

		var ma =  url.match(/^(.*?)(\?.*?)?(#.*)?$/);
		if (!ma) return;
		url = ma[1] + (ma[2] ? ma[2] : '?') + SpecialQuery + (ma[3] ? ma[3] : '');
		obj.attr('href', url);
	});
  }
});

//############################################################################
//■jQuery拡張
//############################################################################
$.fn.extend({
//////////////////////////////////////////////////////////////////////////////
//●[jQuery] ディレイ付showとhide
//////////////////////////////////////////////////////////////////////////////
delay_show: function(){
	var args = Array.prototype.slice.call(arguments);
	args[0] = (args[0] == undefined) ? DefaultShowSpeed : args[0];
	return $.fn.show.apply(this, args);
},
delay_hide: function(){
	var args = Array.prototype.slice.call(arguments);
	args[0] = (args[0] == undefined) ? DefaultShowSpeed : args[0];
	return $.fn.hide.apply(this, args);
},
//////////////////////////////////////////////////////////////////////////////
//●[jQuery] 自分自身と子要素から探す / 同じセレクタでは１度しか見つからない
//////////////////////////////////////////////////////////////////////////////
findx: function(sel){
	var x = $.fn.filter.apply(this, arguments);
	var y = $.fn.find.apply  (this, arguments);
	x = x.add(y);
	// 重複処理の防止
	var r = [];
	sel = '-f-' + sel;
	for(var i=0; i<x.length; i++) {
		var obj = $(x[i]);
		if (obj.parents('.js-hook-stop').length || obj.hasClass('js-hook-stop')) continue;
		if (obj.data(sel)) continue;
		obj.data(sel, true);
		r.push(x[i]);
	}
	return $(r);
},
//////////////////////////////////////////////////////////////////////////////
//●[jQuery] スマホでDnDをエミュレーションする
//////////////////////////////////////////////////////////////////////////////
dndEmulation: function(opt){
	var self = this[0];
	if (!self) return;

	opt = opt || {};

	// mouseイベント作成
	function make_mouse_event(name, evt, touch) {
		var e = $.Event(name);
		e.altKey   = evt.altKey;
		e.metaKey  = evt.metaKey;
		e.ctrlKey  = evt.ctrlKey;
		e.shiftKey = evt.shiftKey;
		e.clientX = touch.clientX;
		e.clientY = touch.clientY;
		e.screenX = touch.screenX;
		e.screenY = touch.screenY;
		e.pageX   = touch.pageX;
		e.pageY   = touch.pageY;
		e.which   = 1;
		return e;
	}
	// 自分自身を含めた親要素をすべて取得
	function get_par_elements(dom) {
		var ary  = [];
		while(dom) {
			ary.push( dom );
			if (dom == self) break;
			dom = dom.parentNode;
		}
		return ary;
	}

	// クロージャ変数
	var prev;
	var flag;
	var timer;
	var orig_touch;

	// mousedownエミュレーション
	this.bind('touchstart', function(_evt){
		var evt = _evt.originalEvent;
		prev = evt.target;
		orig_touch = evt.touches[0];
		var e = make_mouse_event('mousedown', evt, evt.touches[0]);
		$( prev ).trigger(e);
		
		// ある程度時間が経過しないときは処理を無効化する。
		flag  = false;
		timer = setTimeout(function(){
			timer = false;
			flag  = true;
		}, TouchDnDTime)
	});

	// mouseupエミュレーション
	this.bind('touchend', function(_evt){
		var evt = _evt.originalEvent;
		if (timer) clearTimeout(timer);
		timer = false;
		var e = make_mouse_event('mouseup', evt, evt.changedTouches[0]);
		$( evt.target ).trigger(e);
	});

	// ドラッグエミュレーション
	this.bind('touchmove', function(_evt){
		var evt = _evt.originalEvent;

		// 一定時間立たなければ、処理を開始しない
		if (!flag) return;

		var touch = evt.changedTouches[0];
		var dom   = document.elementFromPoint(touch.clientX, touch.clientY);
		var enter = get_par_elements(dom);

		// マウス移動イベント
		var e = make_mouse_event('mousemove', evt, touch);
		$(enter).trigger(e);

		// opt.leave が指定されてないか
		// 要素移動がなければこれで終了
		evt.preventDefault();
		if (!opt.leave || dom == prev) return;

		// 要素移動があれば leave と enter イベント生成
		var leave = get_par_elements(prev);

		// 重複要素を除去
		while(leave.length && enter.length
		   && leave[leave.length -1] == enter[enter.length -1]) {
			leave.pop();
			enter.pop();
		}

		// イベント発火。発火順 >>leave,out,enter,over
		var e_leave = make_mouse_event('mouseleave', evt, touch);
		var e_out   = make_mouse_event('mouseout',   evt, touch);
		var e_enter = make_mouse_event('mouseenter', evt, touch);
		var e_over  = make_mouse_event('mouseover',  evt, touch);
		$(leave).trigger( e_leave );
		$(prev) .trigger( e_out   );
		$(enter).trigger( e_enter );
		$(dom)  .trigger( e_over  );

		// 新しい要素を保存
		prev=dom;
	});
},
//////////////////////////////////////////////////////////////////////////////
});
//////////////////////////////////////////////////////////////////////////////
//●[jQuery] ダブルタップイベント
//////////////////////////////////////////////////////////////////////////////
$.event.special.mydbltap = {
	setup: function(){
		var flag;
		var mouse;
		$(this).on('click', function(){
			if (flag) {
				flag = false;
				// タッチイベントが起きてない時は
				// マウスダブルクリックの可能性があるので発火しない
				if (mouse) return;
				return $(this).trigger('mydbltap');
			}
			flag  = true;
			mouse = true;
			setTimeout( function(){ flag = false; }, DoubleTapTime);
		});
		$(this).on('touchstart', function(){
			mouse = false;
		});
	}
};

//////////////////////////////////////////////////////////////////////////////
//●[jQuery] find でのエラーを無視する
//////////////////////////////////////////////////////////////////////////////
function myfind(sel) {
	try {
		return $(document).find(sel);
	} catch(e) {
		console.log(e);
	}
	return $('#--not-found-');
};

//////////////////////////////////////////////////////////////////////////////
//●[jQuery] $() でXSS対策
//////////////////////////////////////////////////////////////////////////////
{
	var init_orig = $.fn.init;
	$.fn.init = function(sel,cont) {
		if (typeof sel === "string" && sel.match(/<.*?[\W]on\w+\s*=/i))
			throw 'Security error by adiary.js : ' + sel;
		return  new init_orig(sel,cont);
	};
}

//############################################################################
// ■CSSへの機能提供ライブラリ
//############################################################################
var css_initial_functions = [];
//////////////////////////////////////////////////////////////////////////////
// ●CSSから値を取得する
//////////////////////////////////////////////////////////////////////////////
function get_value_from_css(id, attr) {
	var span = $('<span>').attr('id', id).css('display', 'none');
	$('#body').append(span);
	if (attr) {
		attr = span.css(attr);
		span.remove();
		return attr;
	}
	var size = span.css('min-width');	// 1pxの時のみ有効
	var str  = span.css('font-family');
	span.remove();
	if (str == null || size != '1px') return '';
	str = str.replace(/["']/g, '');
	return str || size;
}

//////////////////////////////////////////////////////////////////////////////
//●sidebarのHTML位置変更
//////////////////////////////////////////////////////////////////////////////
css_initial_functions.push(function(){
	var flag = get_value_from_css('sidebar-move-to-before-main');
	if (SP || !flag) return;

	// 入れ替え
	var sidebar = $('#sidebar');
	sidebar.insertBefore( 'div.main:first-child' );
});


css_initial_functions.push(function(){
	var flag = get_value_from_css('side-b-move-to-footer');
	if (SP || !flag) return;

	// 入れ替え
	$('#footer').prepend( $('#side-b').addClass('js-auto-width') );
});

//////////////////////////////////////////////////////////////////////////////
//●dropdown-menuの位置変更
//////////////////////////////////////////////////////////////////////////////
css_initial_functions.push(function(){
	var flag = get_value_from_css('dropdown-menu-move-to-after-header-div');
	if (SP || !flag) return;

	// 入れ替え
	var header = $('#header');
	var ddmenu = header.find('.dropdown-menu');
	header.append( ddmenu );
});



//////////////////////////////////////////////////////////////////////////////
//●ui-iconの自動ロード
//////////////////////////////////////////////////////////////////////////////
css_initial_functions.push(function(){
	var vals = [0, 0x40, 0x80, 0xC0, 0xff];
	var color = get_value_from_css('ui-icon-autoload', 'background-color');
	if (!color || color == 'transparent') return;
	color = color.replace(/#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/, "#$1$1$2$2$3$3");	// for IE8
	if (color.match(/\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0/)) return;

	var ma = color.match(/#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})/);
	var cols = [];
	if (ma) {	// IE8 is #0000ff
		cols[0] = parseInt('0x' + ma[1]);
		cols[1] = parseInt('0x' + ma[2]);
		cols[2] = parseInt('0x' + ma[3]);
	} else {
		// rgb( 0, 0, 255 )
		var ma = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
		if (!ma) return;
		cols[0] = ma[1];
		cols[1] = ma[2];
		cols[2] = ma[3];
	}
	// 用意されているアイコンからもっとも近い色を選択
	var file='';
	for(var i=0; i<3; i++) {
		var c = cols[i];
		var diff=255;
		var near;
		for(var j=0; j<vals.length; j++) {
			var d = Math.abs(vals[j] - c);
			if (d>diff) continue;
			near = vals[j];
			diff = d;
		}
		file += (near<16 ? '0' : '') + near.toString(16);
	}
	// アイコンのロード
	var css = '.ui-icon, .art-nav a:before, .art-nav a:after { background-image: '
		+ 'url("' + PubdistDir + 'ui-icon/' + file + '.png") }';
	var style = $('<style>').attr('type','text/css');
	$('head').append(style);
	if (IE8)
		style[0].styleSheet.cssText = css;
	else
		style.html(css);

});

//////////////////////////////////////////////////////////////////////////////
//●syntax highlight機能の自動ロード
//////////////////////////////////////////////////////////////////////////////
var alt_SyntaxHighlight = false;
var syntax_highlight_css = 'adiary';
function load_SyntaxHighlight() {}	// 互換性のためのダミー

$(function(){
	var codes = $('pre.syntax-highlight');
	if (!codes.length) return;
	if (alt_SyntaxHighlight) return alt_SyntaxHighlight();
	if (IE8) return;	// Not work, for IE8

	$.getScript(ScriptDir + 'highlight.pack.js', function(){
		$('pre.syntax-highlight').each(function(i, block) {
			hljs.highlightBlock(block);
		});
	});
	var style = $('<link>').attr({
		type: "text/css",
		rel: "stylesheet",
		id: 'syntaxhighlight-theme'
	});
	$("head").prepend(style);
});

css_initial_functions.push(function(){
	var css = get_value_from_css('syntax-highlight-theme') || syntax_highlight_css;
	css = css.replace(/\.css$/, '').replace(/[^\w\-]/g, '');
	$('#syntaxhighlight-theme').attr('href', PubdistDir + 'highlight-js/'+ css +'.css');
});

//////////////////////////////////////////////////////////////////////////////
//●MathJaxの自動ロード
//////////////////////////////////////////////////////////////////////////////
var MathJaxURL = 'https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML';
$(function(){
	var mj_span = $('span.math');
	var mj_div  = $('div.math');
	if (!mj_span.length && !mj_div.length) return;

	window.MathJax = {
		TeX: { equationNumbers: {autoNumber: "AMS"} },
		tex2jax: {
			inlineMath: [],
			DisplayMath: [],
			processEnvironments: false,
			processRefs: false
		},
		extensions: ['jsMath2jax.js']
	};
	$.getScript( MathJaxURL );
});

//////////////////////////////////////////////////////////////////////////////
//●viewport の上書き
//////////////////////////////////////////////////////////////////////////////
css_initial_functions.push(function(){
	var val = get_value_from_css('viewport-setting');
	if (!val) return;
	$('#viewport').attr('content', val);
});

//////////////////////////////////////////////////////////////////////////////
//●CSSによる設定を反映
//////////////////////////////////////////////////////////////////////////////
function css_inital() {
	for(var i=0; i<css_initial_functions.length; i++)
		(css_initial_functions[i])();
}
$(function(){ css_inital() });

//############################################################################
//■初期化処理
//############################################################################
var initfunc = [];
function adiary_init(R) {
	for(var i=0; i<initfunc.length; i++)
		initfunc[i](R);
}

var jquery_hook_stop = false;
$(function(){
	var body = $('#body');
	body.append( $('<div>').attr('id', 'popup-image') );
	body.append( $('<div>').attr('id', 'popup-help').addClass('adiary-popup')  );
	body.append( $('<div>').attr('id', 'popup-com') .addClass('adiary-popup')  );
	adiary_init(body);

	//////////////////////////////////////////////////////////////////////
	//●自動でadiary初期化ルーチンが走るようにjQueryに細工する
	//////////////////////////////////////////////////////////////////////
	function hook_function(obj, args) {
		var R = $('<div>');
		for(var i=0; i<args.length; i++) {
			if (!args[i] instanceof jQuery) continue;
			if (typeof args[i] === 'string') continue;
			if (!('findx' in args[i])) continue;
			// hook ok
			adiary_init(args[i]);
		}
	}

	var hooking = false;
	var hooks = ['append', 'prepend', 'before', 'after', 'html', 'replaceWith'];
	function hook(name) {
		var func = $.fn[name];
		$.fn[name] = function() {	// closure
			if (jquery_hook_stop || hooking || this.attr('id') !== 'body' && !this.parents('#body').length)
				return func.apply(this, arguments);
			// hook処理
			hooking = true;
			var r = func.apply(this, arguments);
			// html かつ string の特別処理
			if (name === 'html' && arguments.length === 1 && typeof arguments[0] === 'string') {
				adiary_init(this);
			} else {
				hook_function(this, arguments);
			}
			hooking = false;
			return r;
		}
	}
	for(var i=0; i<hooks.length; i++) {
		hook(hooks[i]);
	}
});

//////////////////////////////////////////////////////////////////////////////
//●画像・ヘルプ・コメントのポップアップ
//////////////////////////////////////////////////////////////////////////////
function easy_popup(evt) {
	var obj = $(evt.target);
	var div = evt.data.div;
	var func= evt.data.func;
	var do_popup = function(evt) {
		if (div.is(":animated")) return;
		func(obj, div);
	  	div.css("left", (SP ? 0 : (evt.pageX +PopupOffsetX)));
	  	div.css("top" ,            evt.pageY +PopupOffsetY);
		div.delay_show();
	};

	var delay = obj.data('delay') != null ? obj.data('delay') : DefaultShowSpeed;
	delay = evt.data.delay != null ? evt.data.delay : delay;

	if (!delay) return do_popup(evt);
	obj.data('timer', setTimeout(function(){ do_popup(evt) }, delay));
}
function easy_popup_out(evt) {
	var obj = $(evt.target);
	var div = evt.data.div;
	if (obj.data('timer')) {
		clearTimeout( obj.data('timer') );
		obj.data('timer', null);
	}
	div.hide();
}

initfunc.push( function(R){
	var popup_img  = $('#popup-image');
	var popup_com  = $('#popup-com');
	var popup_help = $('#popup-help');
	var imgs  = R.findx(".js-popup-img");
	var coms  = R.findx(".js-popup-com");
	var helps = R.findx(".help[data-help]");
	var bhelps= R.findx(".btn-help[data-help]");

	imgs.mouseenter( {func: function(obj,div){
		var img = $('<img>');
		img.attr('src', obj.data('img-url'));
		img.addClass('popup-image');
		div.empty();
		div.append( img );
	}, div: popup_img}, easy_popup);

	coms.mouseenter( {func: function(obj,div){
		var num = obj.data('target');
		if (num == '' || num == 0) return div.empty();
		var com = $secure('#c' + num);
		if (!com.length) return div.empty();
		div.html( com.html() );
	}, div: popup_com}, easy_popup);

	var helpfunc = function(obj,div){
		var text = tag_esc_br( obj.data("help") );
		div.html( text );
	};
	 helps.mouseenter( {func: helpfunc, div: popup_help}, easy_popup);
	bhelps.mouseenter( {func: helpfunc, div: popup_help}, easy_popup);
	if (!SP) bhelps.data('delay', ButtonHelpDelay);	// 長めのディレイ。スマホ除く

	imgs  .mouseleave({div: popup_img }, easy_popup_out);
	coms  .mouseleave({div: popup_com }, easy_popup_out);
	helps .mouseleave({div: popup_help}, easy_popup_out);
	bhelps.mouseleave({div: popup_help}, easy_popup_out);
});

//////////////////////////////////////////////////////////////////////////////
//●詳細情報ダイアログの表示
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
  var prev;
  R.findx('.js-info[data-info], .js-info[data-url]').click( function(evt){
	if (evt.target == prev) return;	// 連続クリック防止
	prev=evt.target;

	var obj = $(evt.target);
	var div = $('<div>');
	var div2= $('<div>');	// 直接 div にクラスを設定すると表示が崩れる
	var text;
	div.attr('title', obj.data("title") || "Infomataion" );
	div2.addClass(obj.data("class"));
	div.empty();
	div.append(div2);
	if (obj.data('info')) {
		var text = tag_esc_br( obj.data("info") );
		div2.html( text );
		div.dialog({ width: DialogWidth, close: close_func });
		return;
	}
	var url = obj.data("url");
	div2.load( url, function(){
		div.dialog({ width: DialogWidth, height: 320, close: close_func });
	});
  })
  function close_func(){
	prev = null;
  }
});

//////////////////////////////////////////////////////////////////////////////
//●フォーム要素の全チェック
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
  R.findx('input.js-checked').click( function(evt){
	var obj = $(evt.target);
	var target = obj.data( 'target' );
	myfind(target).prop("checked", obj.is(":checked"));
  })
});

//////////////////////////////////////////////////////////////////////////////
//●IE8/9でのみ有効/無効にする
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	if (!IE9) R.findx('.js-ie9').hide(0);
	if (!IE8) R.findx('.js-ie8').hide(0);
	if ( IE9) R.findx('.js-not-ie9').hide(0);
	if ( IE8) R.findx('.js-not-ie8').hide(0);
});

//////////////////////////////////////////////////////////////////////////////
//●フォーム操作による、enable/disableの自動変更
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	var objs = R.findx('input.js-enable, input.js-disable');
	function btn_evt(evt, init) {
		var btn = $(evt.target);
		var form = myfind( btn.data('target') );

		var flag;
		var type=btn.attr('type').toLowerCase();
		if (type == 'checkbox')
			flag = btn.prop("checked");
		else if (type == 'radio') {
			if (! btn.prop("checked")) return;
			flag = btn.data("state");
		} else
			flag = ! (btn.val() + '').match(/^\s*$/);

		// disabled設定
		flag = flag ? 1 : (init ? 0 : -1);
		var disable = btn.hasClass('js-disable');
		for(var i=0; i<form.length; i++) {
			var obj = $(form[i]);
			var c = parseInt(obj.data('_jsdisable_c'));
			if (isNaN(c)) c=0;
			c += flag;
			obj.data('_jsdisable_c', c);
			obj.prop('disabled', c ? disable : !disable);
		}
	}
	objs.change( btn_evt );
	objs.each(function(idx,ele){ btn_evt({target: ele}, 1) });
});


//////////////////////////////////////////////////////////////////////////////
//●複数チェックボックスフォーム、全選択、submitチェック
//////////////////////////////////////////////////////////////////////////////
var confrim_button;
initfunc.push( function(R){
  R.findx('input.js-form-check, button.js-form-check').click( function(evt){
	var obj = $(evt.target);
	confrim_button = obj;
	var form = obj.parents('form.js-form-check');
	if (!form.length) return;
	form.data('confirm', obj.data('confirm') );
	form.data('focus',   obj.data('focus')   );
  })
});

initfunc.push( function(R){
  var confirmed;
  R.findx('form.js-form-check').submit( function(evt){
	var form = $(evt.target);
	var target = form.data('target');	// 配列
	var c = false;
	if (target) {
		c = myfind( target + ":checked" ).length;
		if (!c) return false;	// ひとつもチェックされてない
	}

	// 確認メッセージがある？
	var confirm = form.data('confirm');
	if (!confirm) return true;
  	if (confirmed) { confirmed=false; return true; }

	// 確認ダイアログ
	if (c) confirm = confirm.replace("%c", c);
	var btn = confrim_button;
	confrim_button = false;
	my_confirm({
		html: confirm,
		focus: form.data('focus')
	}, function(flag) {
		if (!flag) return;
		confirmed = true;
		if (btn) return btn.click();
		form.submit();
	});
	return false;
  })
});

//////////////////////////////////////////////////////////////////////////////
//●フォーム値の保存	※表示、非表示よりも前に処理すること
//////////////////////////////////////////////////////////////////////////////
var opt_dummy_value = "\e\f\e\f\b\n";
initfunc.push( function(R) {
	R.findx('input.js-save, select.js-save').each( function(idx, dom) {
		var obj = $(dom);
		var id  = obj.attr("id");
		if (!id) return;
		var type = obj.attr('type');
		if (type && type.toLowerCase() == 'checkbox') {
			obj.change( function(evt){
				var obj = $(evt.target);
				Storage.set(id, obj.prop('checked') ? 1 : 0);
			});
			if ( Storage.defined(id) )
				obj.prop('checked', Storage.get(id) != 0 );
			return;
		}
		obj.change( function(evt){
			var obj = $(evt.target);
			if (obj.val() == opt_dummy_value) return;
			Storage.set(id, obj.val());
		});
		var val = Storage.get(id);
		if (! val) return;
		if (dom.tagName != 'SELECT') return obj.val( val );

		// selectで記録されいてる値がない時は追加する
		set_or_append_option( obj, val );
	});
});
function set_or_append_option(sel, val) {
	sel.val( val );
	if (sel.val() == val) return;

	var format = sel.data('format') || '%v';
	var text = format.replace(/%v/g, val);
	var opt  = $('<option>').attr('value', val).text( text );
	sel.append( opt );
	sel.val( val );
	sel.change();
}

//////////////////////////////////////////////////////////////////////////////
//●select boxに選択肢追加（コンボボックス）
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R) {
	function append_form(evt) {
		var obj  = $(evt.target);
		var val  = obj.val();
		if (val != opt_dummy_value) return obj.data('default', val);
		obj.val( obj.data('default') );

		var tar  = $( obj.data('target') );
		var form = { title: tar.data('title') };
		form.elements = [{
			type: '*',
			html: tar
		}];
		tar.find('input').attr('name', 'data');
		form.callback = function(h){
			var data = h.data;
			if (data == '') {
				obj.val( opt_dummy_value );
				return obj.change();
			}
			set_or_append_option( obj, data );
		};
		form_dialog(form);
	}
	R.findx('select.js-combo').each( function(idx, dom) {
		var obj = $(dom);
		var opt = $('<option>').attr('value',opt_dummy_value).text( $('#ajs-other').text() );
		obj.append( opt );
		obj.data('default', obj.val());
		obj.change( append_form );
	});
});

//////////////////////////////////////////////////////////////////////////////
//●フォーム操作、クリック操作による表示・非表示の変更
//////////////////////////////////////////////////////////////////////////////
// 一般要素 + input type="checkbox", type="button"
// (例)
// <input type="button" value="ボタン" class="js-switch" data-target="xxx"
//  data-switch-speed="500" data-hide-val="表示する" data-show-val="非表示にする">
initfunc.push( function(R){
	function display_toggle(btn, init) {
		if (btn[0].tagName == 'A') return false;	// リンククリックは無視
		var type = btn[0].tagName == 'INPUT' && btn.attr('type').toLowerCase();
		var id = btn.data('target');
		if (!id) {
			// 子要素のクリックを拾うための処理
			btn = find_parent(btn, function(par){ return par.attr("data-target") });
			if (!btn) return;
			id = btn.data('target');
		}
		var target = myfind(id);
		if (!target.length || !target.is) return false;
		var speed  = btn.data('switch-speed');
		speed = (speed === undefined) ? DefaultShowSpeed : parseInt(speed);
		speed = init ? 0 : speed;

		// スイッチの状態を保存する
		var storage = btn.data('save') ? Storage : false;

		// 変更後の状態取得
		var flag;
		if (init && storage && storage.defined(id)) {
			flag = storage.getInt(id) ? true : false;
			if (type == 'checkbox' || type == 'radio') btn.prop("checked", flag);
		} else if (type == 'checkbox' || type == 'radio') {
			flag = btn.prop("checked");
		} else {
			flag = init ? !target.is(':hidden') : target.is(':hidden');
		}

		// 変更後の状態を設定
		speed = IE8 ? undefined : speed;
		if (flag) {
			btn.addClass('sw-show');
			btn.removeClass('sw-hide');
			if (init) target.show();
			     else target.show(speed);
			if (storage) storage.set(id, '1');

		} else {
			btn.addClass('sw-hide');
			btn.removeClass('sw-show');
			if (init) target.hide();
			     else target.hide(speed);
			if (storage) storage.set(id, '0');
		}
		if (type == 'button') {
			var val = flag ? btn.data('show-val') : btn.data('hide-val');
			if (val != undefined) btn.val( val );
		}

		if (init) {
			var dom = btn[0];
			if (dom.tagName == 'INPUT' || dom.tagName == 'BUTTON') return true;
			var span = $('<span>');
			span.addClass('ui-icon switch-icon');
			if (IE8) span.css('display', 'inline-block');
			btn.prepend(span);
		}
		return true;
	}
	R.findx('.js-switch').each( function(idx,ele) {
		var obj = $(ele);
		var f = display_toggle(obj, true);	// initalize
		if (f) obj.click( function(evt){ display_toggle($(evt.target), false) } );
	} );
});

//////////////////////////////////////////////////////////////////////////////
//●input[type="text"]などで enter による submit 停止
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('input.no-enter-submit, form.no-enter-submit input').keypress( function(ev){
		if (ev.which === 13) return false;
		return true;
	});
});

//////////////////////////////////////////////////////////////////////////////
//●色選択ボックスを表示。 ※input[type=text] のリサイズより先に行うこと
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	var load_picker;
	var cp = R.findx('input.color-picker');
	if (!cp.length) return;

	cp.each(function(i,dom){
		var obj = $(dom);
		var box = $('<span>').addClass('colorbox');
		obj.before(box);
		var col = obj.val();
		if (col.match(/^#[\dA-Fa-f]{6}$/))
			box.css('background-color', col);
	});
	var initfunc = function(){
		cp.each(function(idx,dom){
			var obj = $(dom);
			obj.ColorPicker({
				onSubmit: function(hsb, hex, rgb, _el) {
					var el = $(_el);
					el.val('#' + hex);
					el.ColorPickerHide();
					var prev = el.prev();
					if (! prev.hasClass('colorbox')) return;
					prev.css('background-color', '#' + hex);
					obj.change();
				},
				onChange: function(hsb, hex, rgb) {
					var prev = obj.prev();
					if (! prev.hasClass('colorbox')) return;
					prev.css('background-color', '#' + hex);
					var func = obj.data('onChange');
					if (func) func(hsb, hex, rgb);
				}
			});
			$('.colorpicker').draggable({
				cancel: ".colorpicker_color, .colorpicker_hue, .colorpicker_submit, input, span"
			});
			obj.ColorPickerSetColor( obj.val() );
		});
		cp.on('keyup', function(evt){
			$(evt.target).ColorPickerSetColor(evt.target.value);
		});
		cp.on('keydown', function(evt){
			if (evt.keyCode != 27) return;
			$(evt.target).ColorPickerHide();
		});
	};

	if (cp.ColorPicker) return initfunc();

	// color pickerのロード
	var dir = ScriptDir + 'colorpicker/';
	prepend_css_file(dir + 'css/colorpicker.css');
	$.getScript(dir + "colorpicker.js", initfunc);
});

//////////////////////////////////////////////////////////////////////////////
//●input[type="text"], input[type="password"]の自由リサイズ
//////////////////////////////////////////////////////////////////////////////
// IE9でもまともに動かないけど無視^^;;;
initfunc.push( function(R){
	R.findx('input').each( function(idx,dom){
		if (dom.type != 'text'
		 && dom.type != 'search'
		 && dom.type != 'tel'
		 && dom.type != 'url'
		 && dom.type != 'email'
		 && dom.type != 'password'
		) return;
		set_input_resize($(dom));
	} )

function set_input_resize(obj, flag) {
	if (obj.parents('.color-picker, .colorpicker').length) return;

	// 非表示要素は最初にhoverされた時に処理する
	if (!flag && obj.is(":hidden")) {
		var func = function(){
			obj.off('mouseenter', func);
			set_input_resize(obj, 1);
		};
		obj.on('mouseenter', func);
		return;
	}

	// テーマ側でのリサイズ機能の無効化手段なので必ず先に処理すること
	var span = $('<span>').addClass('resize-parts');
	if(span.css('display') == 'none') return;

	// 基準位置とする親オブジェクト探し
	var par = find_parent(obj, function(par){
		return par.css('display') == 'table-cell' || par.css('display') == 'block'
	});
	if (!par) return;
	if(par.css('display') == 'table-cell') {
		// テーブルセルの場合は、セル全体をdiv要素の中に移動する
		var cell  = par;
		var child = cell.contents();
		par = $('<div>').css('position', 'relative');
		child.each( function(idx,dom) {
			$(dom).detach();
			par.append(dom);
		});
		cell.append(par);
	} else {
		par.css('position', 'relative');
	}

	par.append(span);
	// append してからでないと span.width() が決まらないブラウザがある
	span.css("left", obj.position().left +  obj.outerWidth() - span.width());
	span.css("top",  obj.position().top );
	span.css("height", obj.outerHeight() );

	// 最小幅算出
	var width = obj.width();
	var min_width = parseInt(span.css("z-index")) % 1000;
	if (min_width < 16) min_width=16;
	if (min_width > width) min_width=width;
	span.mousedown( function(evt){ evt_mousedown(evt, obj, min_width) });
}

function evt_mousedown(evt, obj, min_width) {
	if (!obj.parents('.ui-dialog-content').length
	  && obj.parents('.ui-draggable, .ui-sortable-handle').length) return;

	var span = $(evt.target);
	var body = $('#body');
	span.data('drag-X', evt.pageX);
	span.data("obj-width", obj.width() );
	span.data("span-left", span.css('left') );

	var evt_mousemove = function(evt) {
		var offset = evt.pageX - parseInt(span.data('drag-X'));
		var width  = parseInt(span.data('obj-width')) + offset;
		if (width<min_width) {
			width  = min_width;
			offset = min_width - parseInt(span.data('obj-width'));
		}
		// 幅設定
		obj.width(width);
		span.css("left", parseInt(span.data('span-left')) + offset);
	};
	var evt_mouseup = function(evt) {
		body.unbind('mousemove', evt_mousemove);
		body.unbind('mouseup',   evt_mouseup);
	}

	// イベント登録
	body.mousemove( evt_mousemove );
	body.mouseup  ( evt_mouseup );
}
///
});

//////////////////////////////////////////////////////////////////////////////
//●input, textareaのフォーカスクラス設定  ※リサイズ設定より後に行うこと
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('form input, form textarea').each( function(idx,dom){
		if (dom.tagName != 'TEXTAREA'
		 && dom.type != 'text'
		 && dom.type != 'search'
		 && dom.type != 'tel'
		 && dom.type != 'url'
		 && dom.type != 'email'
		 && dom.type != 'password'
		) return;

		var obj = $(dom);
		// firefoxでなぜかうまく動かないバグ
		var par = find_parent(obj, function(par){ return par.css('display') == 'table-cell' });
		if (!par) return;

		obj.focus( function() {
			par.addClass('focus');
		});
		obj.blur ( function() {
			par.removeClass('focus');
		});
	} )
});

//////////////////////////////////////////////////////////////////////////////
//●INPUT type="radio", type="checkbox" のラベル関連付け（直後のlabel要素）
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('input[type="checkbox"],input[type="radio"]').each( function(idx,dom) {
		var obj = $(dom);
		var label = obj.next();
		if (!label.length || label[0].tagName != 'LABEL' || label.attr('for')) return;

		var id = obj.attr("id");
		if (!id) {
			var flag;
			for(var i=0; i<100; i++) {
				id = 'js-generate-id-' + Math.floor( Math.random()*0x80000000 );
				if (! $('#' + id).length ) {
					flag=true;
					break;
				}
			}
			if (!flag) return;
			obj.attr('id', id);
		}
		// labelに設定
		label.attr('for', id);
	});
///
});

//////////////////////////////////////////////////////////////////////////////
//●textareaでのタブ入力
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('textarea').keypress( function(evt){
		var obj = $(evt.target);
		if (obj.prop('readonly') || obj.prop('disabled')) return;
		if (evt.keyCode != 9) return;

		evt.preventDefault();
		insert_to_textarea(evt.target, "\t");
	});
});

//////////////////////////////////////////////////////////////////////////////
//●なんでもsubmitボタン
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('.js-submit').click( function(evt){
		var form = $(evt.target).parents('form');
		$(form[0]).submit();
	});
});


//////////////////////////////////////////////////////////////////////////////
//●タブ機能
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	var obj = R.findx('.jqueryui-tabs');
	if (!obj.length) return;
	obj.tabs();
});

//////////////////////////////////////////////////////////////////////////////
//●accordion機能
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	var obj = R.findx('.jqueryui-accordion');
	if (!obj.length) return;
	obj.accordion({
		heightStyle: "content"
	});
});

//////////////////////////////////////////////////////////////////////////////
//●FormDataが使用できないブラウザで、ファイルアップ部分を無効にする
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	if (window.FormData) return;
	R.findx('.js-fileup').prop('disabled', true);
});

//////////////////////////////////////////////////////////////////////////////
//●要素の位置を変更する
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('[data-move]').each(function(idx,dom) {
		var obj = $(dom);
		obj.detach();
		var target = myfind(obj.data('move'));
		var type   = obj.data('move-type');
		     if (type == 'prepend') target.prepend(obj);
		else if (type == 'append')  target.append (obj);
		else if (type == 'before')  target.before(obj);
					else target.after(obj);
	});
});

//////////////////////////////////////////////////////////////////////////////
//●bodyにクラスを追加する
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('[data-body-class]').each(function(idx,dom) {
		var cls = $(dom).data('body-class');
		$('#body').addClass(cls);
	});
});

//////////////////////////////////////////////////////////////////////////////
//●スマホ用の処理。hover代わり
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	var ary = R.findx('.js-alt-hover li ul').parent();
	ary.addClass('node');
	ary = ary.children('a');
	ary.click(function(evt) {
		var obj = $(evt.target).parent();
		if (obj.hasClass('open')) {
			obj.removeClass('open');
			obj.find('.open').removeClass('open')
		} else
			obj.addClass('open');
		// リンクを飛ぶ処理をキャンセル
		evt.preventDefault();
	});
	ary.dblclick(function(evt) {
		location.href = $(evt.target).attr('href');
	});
	// タブルタップでリンクを開く
	R.findx('.js-alt-hover li a').on('mydbltap', function(evt) {
		location.href = $(evt.target).attr('href');
	});
});

//////////////////////////////////////////////////////////////////////////////
//●スマホ用のDnDエミュレーション登録
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('.treebox').dndEmulation();
});


//////////////////////////////////////////////////////////////////////////////
//●コメント欄の加工。 >>14 等をリンクに変更する。スペースを&ensp;に置換
//////////////////////////////////////////////////////////////////////////////
$( function(){
	var popup=$('#popup-com');
	$('#com div.comment-text').each(function(idx,dom) {
		var obj  = $(dom);
		var text = obj.html();

		// TAB to SPACE
		var safe = 999;
		while(safe-- && 0 <= text.indexOf("\t"))
			text = text.replace(/(^|<br>)(.*?)\t/g, function(all, m1, m2){
				var len=0;
				for(var i=0; i<m2.length; i++)
					len += (0x7f < m2.charCodeAt(i)) ? 2 : 1;
				var tab = 4 - (len & 3);
				return m1 + m2 + ' '.repeat(tab);
			});

		// SPACE to &ensp;
		text = text.replace(/([^\s])(\s\s+)/g, function(all, m1, m2){
			return m1 + '&ensp;'.repeat( m2.length );
		});
		text = text.replace(/(^|<br>)(\s+)/g, function(all, m1, m2){
			return m1 + '&ensp;'.repeat( m2.length );
		});

		// リンクに加工
		text = text.replace(/&gt;&gt;(\d+)/g, function(all, num){
			return '<a href="#c' + num + '">&gt;&gt;' + num + '</a>';
		});
		// 置換
		obj.html(text);

		// popup機能
		obj.find('a').each(function(idx,dom) {
			var link = $(dom);
			link.mouseenter( {div: popup, func: setReplay}, easy_popup);
			link.mouseleave( {div: popup                 }, easy_popup_out);
		});
	});
	function setReplay(obj, div) {
		var num  = obj.attr('href').toString().replace(/[^\d]/g, '');
		var com = $('#c' + num);
		if (!com.length) return div.empty();
		div.html( com.html() );
	}
});

//////////////////////////////////////////////////////////////////////////////
//●ソーシャルボタンの加工
//////////////////////////////////////////////////////////////////////////////
$( function(){
  $('.social-button').each(function(idx,dom) {
	var obj = $(dom);
	var url_orig = obj.data('url') || '';
	if (0<url_orig || !url_orig.match(/^https?:\/\//i)) return;

	var url = encodeURIComponent( url_orig );
	var share = obj.children('a.share');
	var count = obj.children('a.count');

	var share_link = share.attr('href');
	var count_link = count.attr('href');
	if (obj.hasClass('hatena-bookmark') || obj.hasClass('twitter-share')) {
		share_link += url;
		count_link += url_orig.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/^www\./i, '');
	} else {
		share_link += url;
		count_link += url;
	}
	share.attr('href', share_link);
	count.attr('href', count_link);

	///////////////////////////////////////////////////////////////
	// カウンタ値のロード
	///////////////////////////////////////////////////////////////
	count.text('-');
	function load_and_set_counter(obj, url, key) {
		$.ajax({
			url: url,
			dataType: "jsonp",
			success: function(c) {
				if (key && typeof(c) == 'object') c = c[key];
				c = c || 0;
				obj.text(c);
			}
		})
	}

	// 値のロード
	if (obj.hasClass('twitter-share'))
		return; // load_and_set_counter(count, 'http://urls.api.twitter.com/1/urls/count.json?url=' + url, 'count');
	if (obj.hasClass('facebook-share'))
		return load_and_set_counter(count, 'http://graph.facebook.com/?id=' + url, 'shares');
	if (obj.hasClass('hatena-bookmark'))
		return load_and_set_counter(count, 'http://api.b.st-hatena.com/entry.count?url=' + url);

	if (obj.hasClass('pocket-bookmark')) {
		$.ajax({
			dataType: "html",
			url: "http://query.yahooapis.com/v1/public/yql",
			data: {
				q: "SELECT content FROM data.headers WHERE url='http://widgets.getpocket.com/v1/button?v=1&count=horizontal&url=" + url + "'",
				// noncache: new Date().getTime(),
				format: "xml",
				env: "http://datatables.org/alltables.env"
			},
			success: function (xml) {
				var content = $(xml).find('content').text();
				var ma = content.match(/<\w+\s+id\s*=\s*"cnt">(\d+)/i);
 				count.text(ma ? ma[1] : 0);
			}
		});
	}
  });
});

//############################################################################
//////////////////////////////////////////////////////////////////////////////
//●要素の幅を中身を参照して自動設定する
//////////////////////////////////////////////////////////////////////////////
initfunc.push( function(R){
	R.findx('.js-ddmenu-free-item-width').each(function(idx,dom) {
		var ch = $(dom).children('ul').children();
		for(var i=0; i<ch.length; i++) {
			var a = $(ch[i]).children('a');
			a.css('width', 'auto').css('display', 'inline-block');
			var w = a.outerWidth()+2;
			$(ch[i]).width( w ).data('width', w);
			a.css('display', 'block');
		}
	});
	R.findx('.js-auto-width').each(function(idx,dom) {
		var obj = $(dom);
		var ch = obj.children();
		var width = 0;
		for(var i=0; i<ch.length; i++) {
			var li = $(ch[i]);
			width += li.data('width') || li.outerWidth();
		}
		width+=2;	// for IE and GC bug?
		obj.width(width);
	});
});

//############################################################################
// ■スケルトン内部使用ルーチン
//############################################################################
//////////////////////////////////////////////////////////////////////////////
//●セキュリティコードの設定
//////////////////////////////////////////////////////////////////////////////
$(function(){
	var form = $('#comment-form');
	if (!form.length) return;
	var csrf = form.find('[name="csrf_check_key"]');
	if (csrf.length) return;	// secure_id は無用

	var pkey = $('#comment-form-apkey').val() || '';
	var ary  = (form.data('secure') || '').split(',');
	if (!pkey.match(/^\d+$/)) return;
	pkey = pkey & 255;

	var sid = '';
	for(var i=0; i<ary.length-1; i++) {
		if (!ary[i].match(/^\d+$/)) return;
		sid += String.fromCharCode( ary[i] ^ pkey );
	}

	var post = $('#post-comment');
	post.prop('disabled', true);

	// 10key押されるか、10秒経ったら設定
	var cnt=0;
	var tarea = form.find('textarea');
	var enable_func = function(){
		tarea.off('keydown');
		$('#comment-form-sid').val(sid);
		post.prop('disabled', false);
	};
	tarea.on('keydown', function(){
		cnt++;
		if (cnt<10) return;
		enable_func()
	});
	setTimeout(enable_func, 10000);
});
//////////////////////////////////////////////////////////////////////////////
// ●検索条件表示の関連処理
//////////////////////////////////////////////////////////////////////////////
function init_top_search(id, flag) {
	var form = $secure(id);
	var tagdel = $('<span>').addClass('ui-icon ui-icon-close');
	if (!flag) tagdel.click(function(evt){
		var obj = $(evt.target);
		obj.parent().remove();
		form.submit();
	});
	form.find("div.taglist span.tag, div.ctype span.ctype").append(tagdel);

	var ymddel = $('<span>').addClass('ui-icon ui-icon-close');
	if (!flag) ymddel.click(function(evt){
		form.attr('action', form.data('noymd-url'));
		if (!flag) form.submit();
	});

	form.find("div.yyyymm span.yyyymm").append(ymddel);
}

//////////////////////////////////////////////////////////////////////////////
// ●検索ハイライト表示
//////////////////////////////////////////////////////////////////////////////
function word_highlight(id) {
	var ch = $(id).children();
	var words = [];
	for(var i=0; i<ch.length; i++) {
		var w = $(ch[i]).text();
		if (w.length < 1) continue;
		words.push( w.toLowerCase() );
	}

	var target = $("#articles article h2 .title, #articles article div.body div.body-main");
	var h_cnt = 0;
	rec_childnodes(target, words);

// childnodesを再起関数で探索
function rec_childnodes(_nodes, words) {
	// ノードはリアルタイムで書き換わるので、呼び出し時点の状態を保存しておく
	var nodes = [];
	for(var i=0; i<_nodes.length; i++)
		nodes.push(_nodes[i]);
	
	// テキストノードの書き換えループ
	for(var i=0; i<nodes.length; i++) {
		if (nodes[i].nodeType == 3) {
			var text = nodes[i].nodeValue;
			if (text == undefined || text.match(/^[\s\n\r]*$/)) continue;
			do_highlight_string(nodes[i], words);
			h_cnt++; if (h_cnt>999) break; 
			continue;
		}
		if (! nodes[i].hasChildNodes() ) continue;
		rec_childnodes( nodes[i].childNodes, words );	// 再起
	}
}
function do_highlight_string(node, words) {
	var par  = node.parentNode;
	var str  = node.nodeValue;
	var str2 = str.toLowerCase();
	var find = false;
	var d = document;
	while(1) {
		var p=str.length;
		var n=-1;
		for(var i=0; i<words.length; i++) {
			var w = words[i];
			var x = str2.indexOf(w);
			if (x<0 || p<=x) continue;
			p = x;
			n = i;
		}
		if (n<0) break;	// 何も見つからなかった
		// words[n]が位置pに見つかった
		var len = words[n].length;
		var before = d.createTextNode( str.substr(0,p)   );
		var word   = d.createTextNode( str.substr(p,len) );
		var span   = d.createElement('span');
		span.className = "highlight highlight" + n;
		span.appendChild( word );
		if (p) par.insertBefore( before, node );
		par.insertBefore( span, node );

		find = true;
		str  = str.substr ( p + len );
		str2 = str2.substr( p + len );
	}
	if (!find) return ;
	// 残った文字列を追加して、nodeを消す
	if (str.length) {
		var remain = d.createTextNode( str );
		par.insertBefore( remain, node );
	}
	par.removeChild( node );
}
///
}

//////////////////////////////////////////////////////////////////////////////
// ●タグ一覧のロード
//////////////////////////////////////////////////////////////////////////////
function load_taglist(id, func) {
	var sel = $(id);	// セレクトボックス
	var _default = sel.data('default') || '';
	func = func ? func : function(data){
		var r_func = function(ary, head, tab) {
			for(var i=0; i<ary.length; i++) {
				var val = head + ary[i].title;
				var opt = $('<option>').attr('value', val).html( val );
				opt.css('padding-left', tab);
				if ( val == _default ) opt.prop('selected', true);
				sel.append(opt);
				if (ary[i].children)
					r_func( ary[i].children, head+val+'::', tab+8 );
			}
		};
		r_func(data, '', 0);
	};
	$.getJSON( sel.data('url'), func );
}

//////////////////////////////////////////////////////////////////////////////
// ●コンテンツ一覧のロード
//////////////////////////////////////////////////////////////////////////////
function load_contents_list(id) {
	var obj = $(id);
	$.getJSON( obj.data('url'), function(data){
		var _default  = obj.data('default');
		var this_pkey = obj.data('this-pkey');

		var r_func = function(ary, tab) {
			for(var i=0; i<ary.length; i++) {
				var pkey  = ary[i].key;
				if (pkey == this_pkey) continue;
				var title = ary[i].title;
				var opt = $('<option>').attr('value', pkey).html( title );
				opt.data('link_key', ary[i].link_key);
				if (tab) opt.css('padding-left', tab);
				if ( pkey == _default ) opt.prop('selected', true);
				obj.append(opt);
				if (ary[i].children)
					r_func( ary[i].children, tab+8 );
			}
		};
		r_func(data, 0);
	});
}

//////////////////////////////////////////////////////////////////////////////
// ●ユーザーCSSの強制リロード
//////////////////////////////////////////////////////////////////////////////
function reload_user_css() {
	var obj = $('#user-css');
	var url = obj.attr('href');
	if (!obj.length || !url || !url.length) return 1;

	url = url.replace(/\?.*/, '');	// ?より後ろを除去
	url += '?' + Math.random().toString().replace('.', '');
	obj.attr('href', url);
	return 0;
}

//////////////////////////////////////////////////////////////////////////////
//●twitterウィジェットのデザイン変更スクリプト
//////////////////////////////////////////////////////////////////////////////
function twitter_css_fix(css_text, width){
	var try_max = 20;
	var try_msec = 250;
	function callfunc() {
		var r=1;
		if (try_max--<1) return;
		try{
			r = css_fix(css_text, width);
		} catch(e) { ; }
		if (r) setTimeout(callfunc, try_msec);
	}
	setTimeout(callfunc, try_msec);

function css_fix(css_text, width) {
	var iframes = $('iframe');
	var iframe;
	var ch;
	for (var i=0; i<iframes.length; i++) {
		iframe = iframes[i];
		if (iframe.id.substring(0, 15) != 'twitter-widget-') continue;
		if (iframe.className.indexOf('twitter-timeline')<0) continue;
		if (iframes[i].id.substring(0, 15) != 'twitter-widget-') continue;
		var doc = iframe.contentDocument || iframe.document;
		if (!doc || !doc.documentElement) continue;
		var ch = doc.documentElement.children;
		break;
	}
	if (!ch) return -1;
	var head;
	var body;
	for (var i=0; i<ch.length; i++) {
		if (ch[i].nodeName == 'HEAD') head = ch[i];
		if (ch[i].nodeName == 'BODY') body = ch[i];
	}
	if (!head || !body) return -2;
	if (body.innerHTML.length == 0) return -3;

	// delay
	setTimeout(function(){
		var css = $('<style>').attr({
			id: 'add-tw-css',
			type: 'text/css'
		});
		css.html(css_text);
		$(head).append(css);
	
		// 幅調整
		var obj = $(iframe);
		obj.css('min-width', 0);
		if (width > 49) {
			obj.css('width', width + 'px');
		}
	}, try_msec);
};
///
}

//############################################################################
// ■サブルーチン
//############################################################################
//////////////////////////////////////////////////////////////////////////////
// セキュアなオブジェクト取得
//////////////////////////////////////////////////////////////////////////////
function $secure(id) {
	var obj = myfind('[id="' + id.substr(1) + '"]');
	if (obj.length >1) {
		show_error('Security Error!<p>id="' + id + '" is duplicate.</p>');
		return $('#--not-found--');	// 2つ以上発見された
	}
	return obj;
}

//////////////////////////////////////////////////////////////////////////////
// CSSファイルの追加
//////////////////////////////////////////////////////////////////////////////
function prepend_css_file(file) {
	var css = $("<link>")
	css.attr({
		type: "text/css",
		rel: "stylesheet",
		href: file
	});
	$("head").prepend(css);
	return css;
}

//////////////////////////////////////////////////////////////////////////////
// タグ除去
//////////////////////////////////////////////////////////////////////////////
function tag_esc(text) {
	return text
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&apos;')
}
function tag_esc_br(text) {
	return tag_esc(text).replace(/\n|\\n/g,'<br>');
}
function tag_esc_amp(text) {
	return tag_esc( text.replace(/&/g,'&amp;') );
}
function tag_decode(text) {
	return text
	.replace(/&apos;/g, "'")
	.replace(/&quot;/g, '"')
	.replace(/&gt;/g, '>')
	.replace(/&lt;/g, '<')
	.replace(/&#92;/g, "\\")	// for JSON data
}
function tag_decode_amp(text) {
	return tag_decode(text).replace(/&amp;/g,'&');
}

//////////////////////////////////////////////////////////////////////////////
// link_keyのエンコード :: adiary.pmと同一の処理
//////////////////////////////////////////////////////////////////////////////
function link_key_encode(text) {
	if (typeof text != 'string') { return ''; }
	return text.replace(/[^^\w!\(\)\*\-\.\~\/:;=&]/g, function(data) {
		return '%' + ('0' + data.charCodeAt().toString(16)).substr(-2);
	}).replace(/^\//, './/');
}

//////////////////////////////////////////////////////////////////////////////
// 条件にマッチする親要素を最初にみつけるまで探索
//////////////////////////////////////////////////////////////////////////////
function find_parent(obj, filter) {
	for(var i=0; i<999; i++) {
		obj = obj.parent();
		if (!obj.length) return;
		if (!obj[0].tagName) return;
		if (filter(obj)) return obj;
	}
	return;
}

//////////////////////////////////////////////////////////////////////////////
// テキストエリアに文字挿入
//////////////////////////////////////////////////////////////////////////////
function insert_to_textarea(ta, text) {
	var start = ta.selectionStart;	// カーソル位置
	if (start == undefined) {
		// for IE8
		var tmp = document.selection.createRange();
		tmp.text = text;
		return;
	}
	// カーソル移動
	ta.value = ta.value.substring(0, start)	+ text + ta.value.substring(start);
	start += text.length;
	ta.setSelectionRange(start, start);
}

//############################################################################
// ダイアログ関連
//############################################################################
//////////////////////////////////////////////////////////////////////////////
// ●エラーの表示
//////////////////////////////////////////////////////////////////////////////
function show_error(h, _arg) {
	if (typeof(h) === 'string') h = {id: h, html:h, hash:_arg};
	h.dclass = (h.dclass ? h.dclass : '') + ' error-dialog';
	h.default_title = 'ERROR';
	return show_dialog(h);
}
function show_dialog(h, _arg) {
	if (typeof(h) === 'string') h = {id: h, html:h, hash:_arg};
	var obj  = h.id && h.id.substr(0,1) == '#' && $secure( h.id ) || $('<div>');
	var html = obj.html() || h.html;
	if (h.hash) html = html.replace(/%([A-Za-z])/g, function(w,m1){ return h.hash[m1] });
	html = html.replace(/%[A-Za-z]/g, '');

	var div = $('<div>');
	div.html( html );
	div.attr('title', h.title || obj.data('title') || h.default_title || 'Dialog');
	div.dialog({
		modal: true,
		dialogClass: h.dclass,
		buttons: { OK: function(){ div.dialog('close'); } }
	});
	return false;
}

//////////////////////////////////////////////////////////////////////////////
// ●確認ダイアログ
//////////////////////////////////////////////////////////////////////////////
function my_confirm(h, callback) {
	if (typeof(h) === 'string') h = {id: h, html:h };
	var obj  = h.id && h.id.substr(0,1) == '#' && $secure( h.id ) || $('<div>');
	var html = obj.html() || h.html;
	if (h.hash) html = html.replace(/%([A-Za-z])/g, function(w,m1){ return h.hash[m1] });

	callback = callback || h.callback;

	var div = $('<div>');
	div.html( html );
	div.attr('title', h.title || obj.data('title') || $('#ajs-confirm').text());
	var btn = {};
	btn[ h.btn_ok || $('#ajs-ok').text()] = function(){
		div.dialog('close');
		callback(true);
	};
	btn[ h.btn_cancel || $('#ajs-cancel').text()] = function(){
		div.dialog('close');
		callback(false);
	};
	div.dialog({
		modal: true,
		dialogClass: h.class_,
		buttons: btn,
		open: function(){
			div.siblings('.ui-dialog-buttonpane').find('button:eq(1)').focus();
		}
	});
}

//////////////////////////////////////////////////////////////////////////////
// ●テキストエリア入力のダイアログ
//////////////////////////////////////////////////////////////////////////////
function textarea_dialog(dom, func) {
	var obj  = $(dom);
	form_dialog({
		title: obj.data('title'),
		elements: [
			{type: 'p', html: obj.data('msg')},
			{type: 'textarea', name: 'ta'}
		],
		callback: function( h ) { func( h.ta ) }
	});
}

//////////////////////////////////////////////////////////////////////////////
// ●入力のダイアログの表示
//////////////////////////////////////////////////////////////////////////////
function form_dialog(h) {
	var ele = h.elements || { type:'text', name:'str', dclass:'w80p' };
	if (!Array.isArray(ele)) ele = [ ele ];
	var div = $('<div>').attr('id','popup-dialog');

	var form = $('<form>');
	for(var i=0; i<ele.length; i++) {
		var x = ele[i];
		if (!x) continue;
		if (typeof(x) == 'string') {
			var line = $('<div>').html(x);
			form.append( line );
			continue;
		}
		if (x.type == 'p') {
			form.append( $('<p>').html( x.html ) );
			continue;
		}
		if (x.type == 'textarea') {
			var t = $('<textarea>').attr({
				rows: x.rows || 5,
				name: x.name
			}).addClass('w100p');
			if (x.val != '') t.text( x.val );
			form.append( t );
			continue;
		}
		if (x.type == '*') {
			form.append( x.html );
			continue;
		}
		// else
		var inp = $('<input>').attr({
			type: x.type || 'text',
			name: x.name,
			value: x.val
		});
		inp.addClass( x.dclass || 'w80p');
		form.append( inp );
	}
	div.empty();
	div.append( form );

	// ボタンの設定
	var buttons = {};
	var ok_func = buttons[ $('#ajs-ok').text() ] = function(){
		var inputs = div.find('input');
		for(var i=0; i<inputs.length; i++) {
			var obj = inputs[i];
			if (obj.validity && !obj.validity.valid) return; // validation error
		}
		div.dialog( 'close' );
		var ret = {};
		var ary = form.serializeArray();
		for(var i=0; i<ary.length; i++){
			ret[ ary[i].name ] = ary[i].value;
		}
		h.callback( ret );	// callback
	};
	buttons[ $('#ajs-cancel').text() ] = function(){
		div.dialog( 'close' );
		if (h.cancel) h.cancel();
	};
	// Enterキーによる送信防止
	form.on('keypress', 'input', function(evt) {
		if (evt.which === 13) { ok_func(); return false; }
		return true;
	});

	// ダイアログの表示
	div.dialog({
		modal: true,
		width:  DialogWidth,
		minHeight: 100,
		title:   h.title || $('#msg-setting-title').text(),
		buttons: buttons
	});
}

//############################################################################
// ■adiary用 Ajaxライブラリ
//############################################################################
//////////////////////////////////////////////////////////////////////////////
// ●セッションを保持して随時データをロードする
//////////////////////////////////////////////////////////////////////////////
function adiary_session(_btn, opt){
  $(_btn).click( function(evt){
	var btn = $(evt.target);
	var myself = opt.myself || Vmyself;
	var log = myfind(opt.log || btn.data('log-target') || '#session-log');

	var load_session = myself + '?etc/load_session';
	var interval = opt.interval || log.data('interval') || 300;
	var snum;
	log.delay_show();

	if (opt.init) opt.init(evt);

	// セッション初期化
	$.post( load_session, {
			action: 'etc/init_session',
			csrf_check_key: opt.csrf_key || $('#csrf-key').val()
		}, function(data) {
			var reg = data.match(/snum=(\d+)/);
			if (reg) {
				snum = reg[1];
				ajax_session();
			}
		}, 'text'
	);

	// Ajaxセッション開始
	function ajax_session(){
		log_start();
		console.log('[adiary_session()] session start');
		var fd;
		if (opt.load_formdata) fd = opt.load_formdata(btn);
				else   fd = new FormData( opt.form );
		var ctype;
		if (typeof(fd) == 'string') fd += '&snum=' + snum;
		else {
			fd.append('snum', snum);
			ctype = false;
		}
		$.ajax(myself + '?etc/ajax_dummy', {
			method: 'POST',
			contentType: ctype,
			processData: false,
			data: fd,
			dataType: opt.dataType || 'text',
			error: function(data) {
				if (opt.error) opt.error();
				console.log('[adiary_session()] http post fail');
				console.log(data);
				log_stop();
			},
			success: function(data) {
				if (opt.success) opt.success();
				console.log('[adiary_session()] http post success');
				console.log(data);
				log_stop();
			},
			xhr: opt.xhr
		});
	}
	
	/// ログ表示タイマー
	var log_timer;
	function log_start( snum ) {
		btn.prop('disabled', true);
		log.data('snum', snum);
		log_timer = setInterval(log_load, interval);
	}
	function log_stop() {
		if (log_timer) clearInterval(log_timer);
		log_timer = 0;
		log_load();
		btn.prop('disabled', false);
	}
	function log_load() {
		var url = load_session + '&snum=' + snum;
		log.load(url, function(data){
			log.scrollTop( log.prop('scrollHeight') );
		});
	}
  });
};

//############################################################################
// Prefix付DOM Storageライブラリ
//							(C)2010 nabe@abk
//############################################################################
// Under source is MIT License
//
// ・pathを適切に設定することで、同一ドメイン内で住み分けることができる。
// ・ただし紳士協定に過ぎないので過剰な期待は禁物
// is_session  0(default):LocalStorage 1:sessionStorage 2:ワンタイムなobj
//
//（利用可能メソッド） set(), get(), remove(), clear()
//
function load_PrefixStorage(path) {
	var ls = new PrefixStorage(path);
	return ls;	// fail
}
function PrefixStorage(path, is_session) {
	// ローカルストレージのロード
	this.ls = Load_DOMStorage( is_session );

	// プレフィックス
	this.prefix = String(path) + '::';
}

//-------------------------------------------------------------------
// メンバ関数
//-------------------------------------------------------------------
PrefixStorage.prototype.set = function (key,val) {
	this.ls[this.prefix + key] = val;
};
PrefixStorage.prototype.get = function (key) {
	return this.ls[this.prefix + key];
};
PrefixStorage.prototype.getInt = function (key) {
	var v = this.ls[this.prefix + key];
	if (v==undefined) return 0;
	return Number(v);
};
PrefixStorage.prototype.defined = function (key) {
	return (this.ls[this.prefix + key] !== undefined);
};
PrefixStorage.prototype.remove = function(key) {
	this.ls.removeItem(this.prefix + key);
};
PrefixStorage.prototype.allclear = function() {
	this.ls.clear();
};
PrefixStorage.prototype.clear = function(key) {
	var ls = this.ls;
	var pf = this.prefix;
	var len = pf.length;

	if (ls.length != undefined) {
		var ary = new Array();
		for(var i=0; i<ls.length; i++) {
			var k = ls.key(i);
			if (k.substr(0,len) === pf) ary.push(k);
		}
		// forでkey取り出し中には削除しない
		//（理由はDOM Storage仕様書参照のこと）
		for(var i in ary) {
			delete ls[ ary[i] ];
		}
	} else {
		// DOMStorageDummy
		for(var k in ls) {
			if (k.substr(0,len) === pf)
				delete ls[k];
		}
	}
};

//////////////////////////////////////////////////////////////////////////////
// ■ Storageの取得
//////////////////////////////////////////////////////////////////////////////
//(参考資料) http://www.html5.jp/trans/w3c_webstorage.html
function Load_DOMStorage(is_session) {
	var storage;
	// LocalStorage
	try{
		if (typeof(localStorage) != "object" && typeof(globalStorage) == "object") {
			storage = globalStorage[location.host];
		} else {
			storage = localStorage;
		}
	} catch(e) {
		// Cookieが無効のとき
	}
	// 未定義のとき DOM Storage もどきをロード
	if (!storage) {
		storage = new DOMStorageDummy();
	}
	return storage;
}

//////////////////////////////////////////////////////////////////////////////
// ■ sessionStorage 程度の DOM Storage もどき
//////////////////////////////////////////////////////////////////////////////
// length, storageイベントは非対応
//
function DOMStorageDummy() {
	// メンバ関数
	DOMStorageDummy.prototype.setItem = function(key, val) { this[key] = val; };
	DOMStorageDummy.prototype.getItem = function(key) { return this[key]; };
	DOMStorageDummy.prototype.removeItem = function(key) { delete this[key]; };
	DOMStorageDummy.prototype.clear = function() {
		for(var k in this) {
			if(typeof(this[k]) == 'function') continue;
			delete this[k];
		}
	}
}

//############################################################################
// ■その他jsファイル用サブルーチン
//############################################################################
//----------------------------------------------------------------------------
// ●ファイルサイズ等の書式を整える
//----------------------------------------------------------------------------
function size_format(s) {
	function sprintf_3f(n){
		n = n.toString();
		var idx = n.indexOf('.');
		var len = (0<=idx && idx<3) ? 4 : 3;
		return n.substr(0,len);
	}

	if (s > 104857600) {	// 100MB
		s = Math.round(s/1048576);
		s = s.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
		return s + ' MB';
	}
	if (s > 1023487) return sprintf_3f( s/1048576 ) + ' MB';
	if (s >     999) return sprintf_3f( s/1024    ) + ' KB';
	return s + ' Byte';
}

//----------------------------------------------------------------------------
// ●さつきタグ記号のエスケープ
//----------------------------------------------------------------------------
function esc_satsuki_tag(str) {
	return str.replace(/([:\[\]])/g, function(w,m){ return "\\" + m; });
}
function unesc_satsuki_tag(str) {
	return str.replace(/\\([:\[\]])/g, "$1");
}


