//############################################################################
// アルバム用JavaScript
//							(C)2014 nabe@abk
//############################################################################
//[TAB=8]  require jQuery
//
//tree.json
//	name	フォルダ名	ex) yyy/
//	key	フォルダパス	ex) xxx/yyy/
//	date	UTC
//	count	全ファイル数（サブフォルダ含む）
//
//view.json
//	name	ファイル名
//	size	ファイルサイズ
//	date	UTC
//	isImg	画像ファイルか？ true/false
//
'use strict';
var DialogWidth;	// adiary.jsの参照

$( function(){
	var tree = $('#album-folder-tree');
	var view = $('#album-folder-view');
	var selfiles = $('#selected-files')

	// 表示設定
	var all_select = $('#all-select');
	var thumb_size = $('#thumb-maxsize');
	var view_type  = $('#view-type');
	var sort_type  = $('#sort-type');
	var sort_rev   = $('#sort-rev');
	var folder_icon= $('#folder-icon-change');
	var is_thumbview;

	// ツリー関連
	var path = $('#image-path').text();
	var cur_files;
	var cur_folder;
	var cur_node;
	var cur_folder_rel;	// cur_folder == '/' のとき空文字

	// ファイルアップロード関連
	var upform   = $secure('#upload-form');
	var iframe   = $('#form-response');
	var message  = $('#upload-messages');
	var upfolder = $('#upload-folder');
	var upreset  = $('#upload-reset');
	var filesdiv = $('#file-elements');
	var inputs   = filesdiv.find('input');

	// Drag&Drop関連
	var dnd_body = $('#body');
	var dnd_div  = $('#dnd-files');
	var upfiles  = [];

	var isMac = /Mac/.test(navigator.platform);
	var isIE8 = ('IE'.substr(-1) === 'IE');
	if (isIE8) thumb_size.prop('disabled', true);
	if (isIE8) $('#auto-upload-box').hide();

	var isSphone = $('#sp-alubm').length;

//////////////////////////////////////////////////////////////////////////////
// ●初期化処理
//////////////////////////////////////////////////////////////////////////////
tree.dynatree({
	autoFocus: false,
	persist: true,
	cookieId: 'album:' + Vmyself,
	minExpandLevel: 2,
	imagePath: $('#icon-path').text(),

	initAjax: { url: tree.data('url') },
	onPostInit: function(isReloading, isError) {
		if (isError) {
			error_msg('#msg-load-error');
			return;
		}

		// ロードしたデータの加工
		var rootNode = tree.dynatree("getRoot");
		rootNode.visit(function(node){
			var data = node.data;
			data.name     = tag_decode(data.name || '');
			data.key      = tag_decode(data.key);
			data.title    = get_title(data);
			data.expand   = true;
			data.isFolder = true;
			
/*			$(node.span).on("mydbltap", function(evt) {
				edit_node(node);
			});
*/		});
		var rnodes = rootNode.getChildren();
		if (!rnodes) return;	// エラー回避
		var root = rnodes[1];
		root.data.fix = true;

		// ゴミ箱の設定
		if (rnodes[2].data.name === '.trashbox/') {
			var data = rnodes[2].data;
			data.name  = $('#msg-trashbox').text();
			data.title = get_title(data);
			data.name  = '.trashbox/';
			data.fix   = true;
			data.icon  = 'trashbox.png';
		} 

		// 選択中のノード
		var sel = tree.dynatree("getActiveNode");
		if (!sel) {
			root.activate();
			sel = root;
		}

		// レンダリング
		rootNode.render();
		open_folder(sel, isReloading);
	},
	onActivate: function(node) {
		open_folder(node);
	},
	// ノードの編集
	onClick: function(node, event) {
		if( event.shiftKey ) edit_node(node);
		return true;
	},
	onDblClick: function(node, event) {
		edit_node(node);
		return false;
	},
	onKeydown: function(node, event) {
		switch( event.which ) {
			case 113: // [F2]
				edit_node(node);
				return false;
			case 13: // [enter]
				if( isMac ) edit_node(node);
				return false;
		}
	},

	//----------------------------------------------------
	// Drag & Drop
	//----------------------------------------------------
	dnd: {
		onDragStart: function(node) {
			if (node.data.fix) return false;
			logMsg("tree.onDragStart(%o)", node);
			return true;	// Return false to cancel dragging of node.
		},
		autoExpandMS: 400,
		preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.
		onDragEnter: function(node, srcNode) {
			
			
			return true;
		},
		onDragOver: function(node, srcNode, hitMode) {
			if (hitMode==='before' || hitMode==='after') return false;
			if(node.isDescendantOf(srcNode)) return false;
			if(node.data.isroot) return false;
			if (!srcNode) return true;

			// 現在のディレクトリ内への移動
			var src_par = srcNode.getParent();
			if (src_par && src_par.data.key === node.data.key) return false;

			return true;
		},
		onDrop: drop_to_tree
	}

});

function get_title(data) {
	// tag_esc in adiary.js
	return tag_esc(data.name) + (data.count==0 ? '' : ' (' + data.count + ')');
}

//############################################################################
// ■フォルダツリー関連
//############################################################################
//////////////////////////////////////////////////////////////////////////////
// ●画像ファイルのドラッグ指定
//////////////////////////////////////////////////////////////////////////////
var visible_on_stop;
var img_draggable_option = {
	connectToDynatree: true,
	zIndex: 100,
	opacity: 	isIE8 ? null : 0.7,
	opacity_text:	isIE8 ? null : 0.95,	// filename-view
	delay:   	isIE8 ? null : 200,
	cursorAt: { top: -5, left:-5 },
	//----------------------------------------
	// ドラッグ中の画像要素
	//----------------------------------------
	helper: function(evt,ui){
		// 開始要素が選択されてない時、選択する
		var obj = $(evt.target);
		if (!is_thumbview && !obj.hasClass('fileline')) obj = obj.parents('.fileline');
		if (!obj.hasClass('selected')) {
			obj.addClass('selected')
			update_selected_files();
		};
		// 選択中の画像すべて
		var div = $('<div>');
		if (is_thumbview) {
			// アイコンビューのとき
			var imgs = view.find('.selected').clone();
			imgs.removeClass('selected');
			imgs.css( {'max-width': 60, 'max-height': 60 });
			div.css('max-width', 320);
			imgs.css({
				padding: 1,
				border: 'none',
				visibility: 'visible'
			});
			div.append(imgs);
		} else {
			// ファイル名ビューのとき
			var files = view.find('.selected');
			for(var i=0; i<files.length; i++) {
				var span = $('<span>').text( $(files[i]).data('title') );
				div.append( span );
			}
			div.attr('id', 'album-dnd-name-view');
			div.css('visibility', 'visible');
		}
		return div;
	},
	//----------------------------------------------------------------
	// ドラッグ開始イベント
	//----------------------------------------------------------------
	start: function(evt,ui) {
		var imgs = view.find('.selected').parent();
		imgs.css('visibility', 'hidden');
		visible_on_stop = true;
	},
	//----------------------------------------------------------------
	// ドラッグ終了イベント
	//----------------------------------------------------------------
	stop: function(evt,ui) {
		if (!visible_on_stop) return;
		var imgs = view.find('.selected').parent();
		imgs.css('visibility', 'visible');
	},

	//----------------------------------------------------------------
	// ドラッグ終了時、「戻る」アニメーションの判定
	//----------------------------------------------------------------
	// trueを返すと、戻るアニメーションが表示される（ドロップ失敗）
	revert: function(obj){
		if(typeof obj === "boolean") {
			// jQuery上で処理される drop可能/不可能対象の時
			return !obj;
		}

		// dynatreeへのドロップの場合 obj が渡される
		var helper = $.ui.ddmanager && $.ui.ddmanager.current && $.ui.ddmanager.current.helper;
		var isRejected = helper && helper.hasClass("dynatree-drop-reject");
		return isRejected;
	}
};

//////////////////////////////////////////////////////////////////////////////
// ●フォルダ名の編集
//////////////////////////////////////////////////////////////////////////////
function edit_node( node ) {
	if (node.data.fix) return;	// root and ゴミ箱

	var ctree = node.tree;
	ctree.$widget.unbind();			// ツリーのバインドを外す
	var name = node.data.name;
	name = name.substr(0, name.length-1);	// 201201/ to 201201

	// ノードの選択中表示を解除する
	var span = $(node.span);
	span.removeClass('dynatree-active');

	// タイトルを <input> 要素に置き換える
	var inp = $('<input>').attr({
		type:  'text',
		value: name
	});
	// aタグ内にinputを入れると不可思議な動作をするので、
	// 変わりの span box を作り置き換える。
	var item = span.find( ".dynatree-title" );	// aタグ
	var box = $('<span>');
	box.addClass( item.attr('class') );
	box.append( inp );
	item.replaceWith( box );

	// Focus <input> and bind keyboard handler
	inp.focus();
	inp.select();
	inp.keydown(function(evt){
		var obj = $(evt.target);
		switch( evt.which ) {
			case 27: // [esc]
				obj.blur();
				break;
			case 13: // [enter]
				rename_folder(obj, node, inp.val());
				break;
		}
	});
	//-------------------------------------------
	// ○ツリーのクリック
	//-------------------------------------------
	var tree_click = function(evt){
		if (inp[0] == evt.target) return;
		inp.blur();
	};
	tree.click(tree_click);

	//-------------------------------------------
	// ○フォーカスが離れた（編集終了）
	//-------------------------------------------
	inp.blur(function(evt){
		tree.unbind('click', tree_click);
		node.setTitle( node.data.title );
		ctree.$widget.bind();
		node.data.rename = false;
		node.focus();
		if (evt && evt.which == 13 && node.data.key != cur_node.data.key)
			node.activate();
	});
}

//-------------------------------------------
// ○リネームの実行
//-------------------------------------------
function rename_folder(obj, node, name) {
	if (name.rsubstr(1) != '/') name += '/';
	if (name == '' || node.data.name === name) {
		obj.blur();	// 変更なし
		return;
	};
	node.data.rename = true;

	ajax_submit({
		action: 'rename_folder',
		data: {
			folder: node.getParent().data.key,
			old:    node.data.name,
			name:   name
		},
		success: function(data) {
			if (data.ret !== 0) {
				obj.blur();
				// blur()してから呼び出さないとキー入力がbindされない
				error_msg('#msg-fail-rename-folder');
				return;
			}
			node.data.name  = name;
			node.data.title = get_title( node.data );
			set_keydata(node.getParent().data.key, node);

			if (cur_node.data.key === node.data.key) set_current_folder(node);
			node.data.rename = false;
			obj.blur();
		},
		error: function() {
			node.data.rename = false;
			obj.blur();
			error_msg('#msg-fail-rename-folder');
		}
	});
}

//////////////////////////////////////////////////////////////////////////////
// ●リロードボタン
//////////////////////////////////////////////////////////////////////////////
function tree_reload() {
	tree.dynatree('getTree').reload();
}

$('#album-reload').click( function(){
	ajax_submit({
		action: 'refresh',
		success: function(data) {
			if (data.ret !== 0) return error_msg('#msg-fail-reload');
			tree_reload();
		},
		error: function() {
			error_msg('#msg-fail-reload');
		}
	});
});

//////////////////////////////////////////////////////////////////////////////
// ●フォルダ作成ボタン
//////////////////////////////////////////////////////////////////////////////
$('#album-new-folder').click( function(){
	var node = cur_node;
	var ary  = node.getChildren();
	var name = "new-folder";
	if (ary) {
		// フォルダ名の重複防止
		var h = {};
		for(var i=0; i<ary.length; i++) {
			var dir = ary[i].data.name;
			dir = dir.substr(0, dir.length-1);
			h[dir] = true;
		}
		if (h[name]) {
			// new-folder.2 .3 .4 ...
			for(var i=2; i<1000; i++) {
				var n = name + '.' + i;
				if (h[n]) continue;
				name = n;
				break;
			}
		}
	}
	// フォルダの作成
	ajax_submit({
		action: 'create_folder',
		data: {
			folder: cur_folder,
			name:   name
		},
		success: function(data) {
			if (data.ret !== 0) return error_msg('#msg-fail-create');
			name += '/';
			console.log(name);
			var create = node.addChild({
			        isFolder: true,
				title: name,
				name:  name
			});
			create.data.key   = cur_folder + name;
			create.data.count = 0;
			create.data.title = get_title( create.data );

			// 名前変更モード
			node.expand();
			edit_node(create);
		},
		error: function() {
			error_msg('#msg-fail-create');
		}
	});
});

//////////////////////////////////////////////////////////////////////////////
// ●ゴミ箱空ボタン
//////////////////////////////////////////////////////////////////////////////
$('#album-clear-trashbox').click( function(){
	// 確認メッセージ
	my_confirm('#msg-confirm-trash', clear_trashbox);

  function clear_trashbox(flag) {
	if (!flag) return;
	ajax_submit({
		action: 'clear_trashbox',
		success: function(data) {
			if (data.ret !== 0) error_msg('#msg-fail-clear-trash');
			tree_reload();
		},
		error: function() {
			error_msg('#msg-fail-clear-trash');
			tree_reload();
		}
	});
  }
});

//////////////////////////////////////////////////////////////////////////////
// ●フォルダの移動
//////////////////////////////////////////////////////////////////////////////
function drop_to_tree(node, srcNode, hitMode, ui, draggable) {
	// フォルダの中へのドロップのみ有効
	if (hitMode !== "over") return false;

	// ファイルのドロップ？
	if (!srcNode) return drop_files_to_tree(node, srcNode, hitMode, ui, draggable);

	// フォルダの移動
	move_folder(node, srcNode);
}

function move_folder(node, srcNode) {
	var from = srcNode.getParent().data.key;
	var to   = node.data.key;
	if (to.indexOf(cur_folder) == 0) return false;	// 自分自身やその子へは移動できない
	if (from == to) return false;			// 今あるフォルダと同じ場所へは移動できない

	ajax_submit({
		action: 'move_files',
		data: {
			from: from,
			to:   to,
			file_ary: [ chop_slash(srcNode.data.name) ]
		},
		success: function(data) {
			if (data.ret !== 0) error_msg('#msg-fail-mv-folder', {files: data.files});
			srcNode.move(node, 'over');
			tree_reload();
		},
		error: function() {
			error_msg('#msg-fail-mv-folder');
		}
	});
	return true;
}

//////////////////////////////////////////////////////////////////////////////
// ●ファイルの移動
//////////////////////////////////////////////////////////////////////////////
function drop_files_to_tree(node, srcNode, hitMode, ui, draggable) {
	// 移動処理
	if (! move_files(node.data.key)) return false;

	// 元アイコンは非表示のままにする
	visible_on_stop = false;
	return true;
}

function move_files(to_folder) {
	if (to_folder === cur_folder) return false;

	var files = load_selected_files();
	if (!files) return false;

	ajax_submit({
		action: 'move_files',
		data: {
			from: cur_folder,
			to:   to_folder,
			file_ary: files
		},
		success: function(data) {
			for(var i in data.files) {
				data.files[i] = data.files[i].replace(/\.#[\d\-]+/g, '');
			}
			if (data.ret !== 0) error_msg('#msg-fail-mv-files', {files: data.files});
			tree_reload();
		},
		error: function() {
			error_msg('#msg-fail-mv-files');
			// ファイルを再表示
			var imgs = view.find('.selected').parent();
			imgs.css('visibility', 'visible');
		}
	});
	return true;
}


//////////////////////////////////////////////////////////////////////////////
// ●選択ファイルの一覧の更新
//////////////////////////////////////////////////////////////////////////////
function update_selected_files() {
	var imgs = view.find('.selected');
	if (!imgs.length) all_select.prop('checked', false);
	if (imgs.length == cur_files.length) all_select.prop('checked', true);

	selfiles.empty();
	for(var i=0; i<imgs.length; i++) {
		var name = $(imgs[i]).data('title');
		var li = $('<li>').text( name );
		li.data('name', name);
		li.dblclick(function(evt){ edit_file_name($(evt.target)); });
		selfiles.append(li);
	}
	var bool = (imgs.length == 0);
	$('#paste-form [data-select]').prop('disabled', bool);
}

//----------------------------------------------------------------------------
// ファイル名の編集
//----------------------------------------------------------------------------
function edit_file_name(li) {
	var inp = $('<input>').attr({
		type:  'text',
		value: li.data('name')
	}).addClass('w100p');
	li.empty();
	li.append( inp );

	inp.focus();
	inp.select();
	inp.keydown(function(evt){
		var obj = $(evt.target);
		switch( evt.which ) {
			case 27: // [esc]
				obj.blur();
				break;
			case 13: // [enter]
				if (li.data('name') == inp.val()) {
					obj.blur();
					break;
				}
				rename_file(inp, li, inp.val());
				break;
		}
	});
	//-------------------------------------------
	// ○フォーカスが離れた（編集終了）
	//-------------------------------------------
	inp.blur(function(evt){
		li.text( li.data('name') );
	});
	
}

//----------------------------------------------------------------------------
// ファイル名の変更
//----------------------------------------------------------------------------
function rename_file(obj, li, new_name) {
	ajax_submit({
		action: 'rename_file',
		data: {
			folder: cur_folder,
			old:    li.data('name'),
			name:   new_name,
			size:	$('#thumbnail-size').val()
		},
		success: function(data) {
			if (data.ret !== 0) return error_msg('#msg-fail-rename-file');
			var old = li.data('name');
			li.data('name', new_name);
			obj.blur();

			// ファイル名の変更を記録する
			for(var i in cur_files) {
				var x = cur_files[i].name;
				if (cur_files[i].name != old) continue;
				cur_files[i].name = new_name;
				break;
			}

			// 選択済情報を保持する
			var lis = selfiles.find('li');
			var files = {};
			for(var i=0; i<lis.length; i++) {
				files[ $(lis[i]).data('name') ] = true;
			}
			update_view(true, files);
		},
		error: function() {
			error_msg('#msg-fail-rename-file');
			obj.blur();
		}
	});
}

//////////////////////////////////////////////////////////////////////////////
// ●サブルーチン
//////////////////////////////////////////////////////////////////////////////
// tree操作時のエラー表示
function error_msg(id, h) {
	if (h && h.files)
		h.f = '<ul class="small"><li>' + h.files.join("</li><li>") + '</li></ul>';
	show_error({id:id, hash:h});
}

// 末尾の / を除去
function chop_slash(str) {
	if (str.rsubstr(1) != '/') return str;
	return str.substr(0, str.length-1);
}

// keyの設定
function set_keydata(folder, node) {
	folder = folder + node.data.name;
	var cur = (node.data.key === cur_node.data.key);
	node.data.key = folder;
	if (cur) set_current_folder(node);

	var list = node.getChildren();
	if (!list) return;

	for(var i=0; i<list.length; i++)
		set_keydata(folder, list[i]);
};

//############################################################################
// ■メインビュー関連
//############################################################################
//////////////////////////////////////////////////////////////////////////////
// ●フォルダを開く
//////////////////////////////////////////////////////////////////////////////
function open_folder(node, isReloading) {
	if (!isReloading) {
		message.hide();
		all_select.prop('checked', false);
	}
	if (node.data.rename) return;	// リネーム中は何もしない

	// フォルダ移動ボタン（スマホ表示）
	{
		var dir = node.data.key;
		$('#album-move-folder').prop('disabled',
			dir == '/' || dir == '.trashbox/'
		);
	}
	ajax_submit({
  		data: {	folder: node.data.key },
		action: 'load_image_files',
		success: function(data) {
			// 数値→文字列（数字だけのファイル名対策）
			for(var i in data) {
				if (typeof(data[i].name) == "string") continue;
				data[i].name = data[i].name.toString();
			}
			// データsave
			cur_files = data;
			set_current_folder(node);
			// jpegあり？
			var jpeg;
			for(var i in cur_files) {
				var file = cur_files[i].name;
				if (! file.match(/\.jpe?g$/i)) continue;
				jpeg = true;
				break;
			}
			$('#select-exifjpeg').prop('disabled', !jpeg);
			if (data.length==0)	// ファイルがひとつもない
				all_select.prop('checked', false);

			// viewの更新
			update_view();
		},
		error: function() {
			$('#current-folder').text( '(load failed!)' );
			error_msg('#msg-load-error');
			cur_files = [];
			set_current_folder(node);
			update_view();
		}
	});
}

function set_current_folder(node) {
	cur_folder = node.data.key;
	cur_node   = node;
	upfolder.val( cur_folder );
	cur_folder_rel = (cur_folder == '/') ? '' : cur_folder;

	var icon = $('#folder-icon');
	icon.empty();
	icon.removeClass('dynatree-icon');

	var title = node.data.key;
	if (title.substr(0,9) == '.trashbox') {
		title = $('#msg-trashbox').text() + title.substr(9);
		icon.append(
			$('<img>').attr('src', $('#icon-path').text() + 'trashbox.png' )
		);
	} else {
		icon.addClass('dynatree-icon');
	}
	$('#current-folder').text( title );
}

//////////////////////////////////////////////////////////////////////////////
// ●ajaxデータ送信
//////////////////////////////////////////////////////////////////////////////
function ajax_submit(opt) {
	var data = opt.data || {};
	data.action = $('#action-base').val() + opt.action;
	data.csrf_check_key = $('#csrf-key').val();

	folder_icon.attr('class', 'dynatree-statusnode-wait');	// Loding.gif
	$.ajax(Vmyself + '?etc/ajax_dummy', {
		method: 'POST',
		data: data,
		dataType: opt.type || 'json',
		error: function(data) {
			if (opt.error) opt.error(data);
			console.log('[ajax_submit()] http post fail');
		},
		success: function(data) {
			if (opt.success) opt.success(data);
			console.log('[ajax_submit()] http post success');
		},
		complete : function() {
			folder_icon.attr('class', 'dynatree-ico-ef');
		},
		traditional: true
	});
	return true;
}

//////////////////////////////////////////////////////////////////////////////
// ●全選択
//////////////////////////////////////////////////////////////////////////////
all_select.change( function(){ all_select_change() } );

function all_select_change(init) {
	var stat = all_select.is(":checked");
	var imgs = is_thumbview ? view.find('img') : view.find('.fileline');
	for(var i=0; i<imgs.length; i++) {
		var obj = $(imgs[i]);
		if (stat) {
			obj.addClass('selected');
			continue;
		}
		if (!init) obj.removeClass('selected');
	}
	update_selected_files();
}

//////////////////////////////////////////////////////////////////////////////
// ●表示形式変更
//////////////////////////////////////////////////////////////////////////////
view_type.change( view_change );
sort_type.change( view_change );
sort_rev.change ( view_change );
function view_change() {
	// 選択済情報を保持する
	var imgs = view.find('.selected');
	var files = {};
	for(var i=0; i<imgs.length; i++) {
		files[ $(imgs[i]).data('title') ] = true;
	}
	update_view(false, files);
}


//////////////////////////////////////////////////////////////////////////////
// ●ビューのアップデート
//////////////////////////////////////////////////////////////////////////////
function update_view(flag, selected) {
	var thumbq = cur_node.data.thumb_remake;
	if (flag) {
		// サムネイルの強制更新
		thumbq = thumbq ? thumbq+1 : 1;
		cur_node.data.thumb_remake = thumbq;
	}
	thumbq = thumbq ? ('?' + thumbq) : '' ;

	// 選択済みファイルのハッシュ
	selected = selected ? selected : {};

	// ソート処理
	{
		var type = sort_type.val();
		var func = sort_rev.val() != 0
			? function(a,b) { return (a[type] < b[type]) ?  1 : -1; }
			: function(a,b) { return (a[type] < b[type]) ? -1 :  1; };
		cur_files.sort( func );
	}

	view.empty();
	var fspath = path + cur_folder_rel;
	if (view_type.val() != 'name')
	  for(var i in cur_files) {
		// サムネイルビュー
		is_thumbview = true;
		view.removeClass('name-view');
		view.addClass('thumb-view');
		var file = cur_files[i];
		var link = $('<a>', {
			href: encode_link( fspath + file.name )
		});
		if (file.isImg) {
			link.attr({
				'data-lightbox': 'roadtrip',
				'data-title': file.name
			});
		}
		var img  = $('<img>', {
			src: encode_link( fspath + '.thumbnail/' + file.name + '.jpg' + thumbq ),
			title: file.name,
			'data-title': file.name,
			'data-isimg': file.isImg ? 1 : 0
		});
		img.click( img_click );
		img.dblclick( img_dblclick );
		img.on('mydbltap', img_dblclick );	// ダブルタップ
		img.data('isimg', file.isImg);

		if (selected[file.name]) img.addClass('selected');
		link.append(img);
		view.append(link);

		// for Drag&Drop
		img.draggable( img_draggable_option );
	} else {
	  for(var i in cur_files) {
		// ファイル名ビュー
		is_thumbview = false;
		view.removeClass('thumb-view');
		view.addClass('name-view');
		var file = cur_files[i];
		var link = $('<a>', {
			href: encode_link( fspath + file.name )
		});
		if (file.isImg) {
			link.attr({
				'data-lightbox': 'roadtrip',
				'data-title': file.name,
			});
		}
		var span = $('<span>').addClass('fileline').data({
			title: file.name,
			isimg: file.isImg ? 1 : 0
		});
		// ファイル名
		var fname = $('<span>').text( file.name );
		fname.addClass('js-popup-img').data('img-url', encode_link( fspath + '.thumbnail/' + file.name + '.jpg' + thumbq) );
		span.append( $('<span>').addClass('filename').append( fname ) );
		// 日付
		var date = new Date( file.date*1000 );
		var tms  = date.toLocaleString().replace(/\b(\d[\/: ])/g, "0$1");
		span.append( $('<span>').addClass('filedate').text( tms ) );
		// サイズ
		span.append( $('<span>').addClass('filesize').text( size_format(file.size) ) );

		// 追加
		span.click( img_click );
		span.data('href', link.attr('href') );	// for CTRL + click
		span.dblclick( img_dblclick );
		span.data('isimg', file.isImg);

		if (selected[file.name]) span.addClass('selected');
		link.append(span);
		view.append(link);

		// for Drag&Drop
		span.draggable( img_draggable_option );
		span.draggable( { opacity: img_draggable_option.opacity_text } );
	  }
	}
	// file not found.
	if (cur_files.length == 0) {
		var div = $('<div>').addClass('file-not-found');
		div.text('(File not found)')
		view.append( div );
	}

	//-----------------------------------------------
	// 画像のクリック
	//-----------------------------------------------
	var dbl_click;
	var stop_prop;
	var prev_sel;
	function img_click(evt) {
		var obj = $(evt.target);
		if (!is_thumbview && !obj.hasClass('fileline')) obj = obj.parents('.fileline');
		if (dbl_click) {
			dbl_click = false;
			return;
		}

		if (evt.ctrlKey) {
			if (evt.shiftKey) return true;	// ブラウザデフォルト

			// download させる
			evt.stopPropagation();
			evt.preventDefault()
			var file = obj.data('href') || obj.parent('a').attr('href');
			var dl = $('<a>').attr({
				href: file,
				download: obj.data('title')
			});
			var e = document.createEvent('MouseEvent');
			e.initEvent("click", true, false);
			dl[0].dispatchEvent( e ); 
			return;
		}

		// 選択処理
		evt.stopPropagation();
		evt.preventDefault()
		if (prev_sel && evt.shiftKey && prev_sel[0] != obj[0]) {
			var sel = obj[0];
			var ary = [];
			// 前方範囲選択
			var objs = prev_sel.parent().prevAll().children();
			var find = -1;
			for(var i=0; i<objs.length; i++) {
				if (objs[i] != sel) continue;
				find=i;
				break;
			}
			for(var i=0; i<=find; i++) ary.push(objs[i]);
			// 後方範囲選択
			var objs = prev_sel.parent().nextAll().children();
			var find = -1;
			for(var i=0; i<objs.length; i++) {
				if (objs[i] != sel) continue;
				find=i;
				break;
			}
			for(var i=0; i<=find; i++) ary.push(objs[i]);

			// 選択・非選択操作
			for(var i=0; i<ary.length; i++) {
				if (prev_sel.hasClass('selected'))
					$(ary[i]).addClass('selected');
				else
					$(ary[i]).removeClass('selected');
			}
		} else {
			prev_sel = obj;
			if (obj.hasClass('selected'))
				obj.removeClass('selected');
			else
				obj.addClass('selected');
		}
		update_selected_files();
	}

	//-----------------------------------------------
	// 画像のダブルクリック
	//-----------------------------------------------
	function img_dblclick(evt) {
		var obj = $(evt.target);
		if (!obj.data('isimg')) return;
		if (!is_thumbview && !obj.hasClass('fileline')) obj = obj.parents('.fileline');
		dbl_click = true;
		obj.click();
	}
	
	// 選択ファイル情報更新
	update_selected_files();
}

//////////////////////////////////////////////////////////////////////////////
// ●サムネイル最大サイズの変更
//////////////////////////////////////////////////////////////////////////////
thumb_size.change( thumb_size_change )
if (thumb_size.val() != 120) thumb_size_change();

var apeend_style;
function thumb_size_change() {
	var size = Number( thumb_size.val() );
	if (size<20 || 600<size) return;
	if (IE8) return;

	if (apeend_style) apeend_style.remove();
	apeend_style = $('<style>').text(
		'#album-folder-view img {'
		+ 'max-width:  ' + size + 'px;'
		+ 'max-height: ' + size + 'px;'
		+ '}'
	);
	$('head').append(apeend_style);
}

//////////////////////////////////////////////////////////////////////////////
// ●記事に貼り付け
//////////////////////////////////////////////////////////////////////////////
var paste_form = $secure('#paste-form');
paste_form.submit(function(){
	// エラー時送信しない為
	if ($('#paste-txt').val() == '') return false;
	return true;
});

$('#paste-thumbnail').click( paste_button );
$('#paste-original' ).click( paste_button );

function paste_button(evt) {
	var sel = view.find('.selected');
	if (!sel.length) return false;

	var obj = $(evt.target);
	var filetag = paste_form.data('tag');
	var imgtag  = obj.data('tag');
	var exiftag;
	if ($('#paste-to-exif').prop('checked')) exiftag = paste_form.data('exif-tag');

	var ary=[];
	for(var i=0; i<sel.length; i++) {
		var img = $(sel[i]);
		var tag = img.data('isimg') ? imgtag : filetag;

		var name = img.data('title').toString();	// 数字のみのファイル名対策
		var reg  = name.match(/\.(\w+)$/);
		var ext  = reg ? reg[1] : '';
		var rep  = {
			d: esc_satsuki_tag(cur_folder_rel),
			e: esc_satsuki_tag(ext),
			f: esc_satsuki_tag(name),
			c: ''
		};
		if (exiftag && img.data('isimg') && name.match(/\.jpe?g$/i)) {
			rep.c = exiftag.replace(/%([def])/g, function($0,$1){ return rep[$1] });
		}
		tag = tag.replace(/%([cdef])/g, function($0,$1){ return rep[$1] });
		ary.push(tag);
	}
	var text= ary.join( evt.ctrlKey ? " \\\n" : "\n" )

	if (window.opener) {
		// 子ウィンドウとして開かれていたら
		window.opener.insert_image(text);
		window.close();
		return false;
	}
	$('#paste-txt').val(text);
	paste_form.submit();

	return false;
}

//////////////////////////////////////////////////////////////////////////////
// ●その他の操作（セレクトボックス or 独立ボタン）
//////////////////////////////////////////////////////////////////////////////
$('#remake-thumbnail').click( remake_thumbnail );
$('#select-exifjpeg') .click( select_exifjpeg  );
$('#album-move-files').click( album_move_files );

$('#album-actions').change( function(evt){
	var obj = $(evt.target);
	var val = obj.val();
	if (!val) return;
	obj.val('');

	if (val == 'remake-thumbnail') remake_thumbnail(evt);
	if (val == 'remove-exifjpeg')  remove_exifjpeg(evt);
	if (val == 'select-exifjpeg')  select_exifjpeg(evt);
	if (val == 'album-move-files') album_move_files(evt);
});

//////////////////////////////////////////////////////////////////////////////
// ●サムネイルの再生成
//////////////////////////////////////////////////////////////////////////////
function remake_thumbnail(){
	var div = $('#remake-thumbnail-dialog');
	var buttons = {};
	var sel = $('#dialog-thumbnail-size');
	var val = $('#thumbnail-size').val();
	sel.val( val );
	if (sel.val() != val) {
		var opt = $('<option>').attr('value', val);
		opt.text( sel.data('format').replace('%v', val) );
		sel.append(opt);
		sel.val( val );
	}

	var ok_func = do_remake_thumbnail;
	album_dialog(div, ok_func);
}

function do_remake_thumbnail(){
	var files = load_selected_files();
	if (!files) return false;

	ajax_submit({
		action: 'remake_thumbnail',
		data: {
			folder: cur_folder,
			file_ary: files,
			del_exif: 0,
			size: $('#dialog-thumbnail-size').val()
		},
		success: function(data) {
			if (data.ret !== 0) {
				// ファイル名が不正など
				error_msg('#msg-fail-remake');
				return;
			}
			var node = cur_node;
			// view更新
			update_view(true);
		},
		error: function() {
			// 通常起きない
			error_msg('#msg-fail-remake');
		}
	});
}

//////////////////////////////////////////////////////////////////////////////
// ●exifファイルの検索
//////////////////////////////////////////////////////////////////////////////
function select_exifjpeg(){
	ajax_submit({
		action: 'load_exif_files',
		data: { folder: cur_folder },
		success: function(data) {
			if (!data in Array)   return error_msg('#msg-load-exif-error');
			if (data.length == 0) return show_dialog('#msg-exif-notfound');

			// exifファイルを選択
			var files = {};
			for(var i in data) {
				files[ data[i] ] = true;
			}
			update_view(false, files);
		},
		error: function() {
			error_msg('#msg-load-exif-error');
		}
	});
}

//////////////////////////////////////////////////////////////////////////////
// ●Exifの削除
//////////////////////////////////////////////////////////////////////////////
function remove_exifjpeg(){
	var files = load_selected_files();
	if (!files) return false;

	ajax_submit({
		action: 'remove_exifjpeg',
		data: {
			folder: cur_folder,
			file_ary: files
		},
		success: function(data) {
			if (data.ret !== 0) {
				error_msg('#msg-remove-exif-error');
				return;
			}
			view.find('.selected').removeClass('selected');
			update_selected_files();
		},
		error: function() {
			// 通常起きない
			error_msg('#msg-remove-exif-error');
		}
	});
}

//////////////////////////////////////////////////////////////////////////////
// ●ファイルの移動
//////////////////////////////////////////////////////////////////////////////
function album_move_files() {
	folder_select_dialog( move_files );
}

//////////////////////////////////////////////////////////////////////////////
// ●選択中ファイル一覧の取得
//////////////////////////////////////////////////////////////////////////////
function load_selected_files() {
	var sel = view.find('.selected');
	if (!sel.length) return false;

	var files = [];
	for(var i=0; i<sel.length; i++) {
		files.push( $(sel[i]).data('title') );
	}
	return files;
}

//############################################################################
// ■ファイルアップロード関連
//############################################################################
//////////////////////////////////////////////////////////////////////////////
// ●ドラッグ＆ドロップ
//////////////////////////////////////////////////////////////////////////////
dnd_body.on('dragover', function(evt) {
	return false;
});
dnd_body.on("drop", function(evt) {
	if (!evt.originalEvent.dataTransfer) return;

	evt.stopPropagation();
	evt.preventDefault();
	var dnd_files = evt.originalEvent.dataTransfer.files;
	if (!dnd_files) return;
	if (!FormData)  return;

	for(var i=0; i<dnd_files.length; i++)
		upfiles.push( dnd_files[i] );
	update_upfiles();

	// 自動アップロード。スマホの時hidden要素のため。
	var auto = $('#auto-upload');
	if (auto.attr('type') == 'checkbox') {
		if (auto.prop('checked')) upform.submit();
	} else {
		if (auto.val()) upform.submit();
	}
});

function update_upfiles() {
	dnd_div.empty();
	for(var i=0; i<upfiles.length; i++) {
		if (!upfiles[i]) next;
		var fs  = size_format(upfiles[i].size);
		var div = $('<div>').text(
			upfiles[i].name + ' (' + fs + ')'
		);
		// 削除アイコン
		var del = $('<span>').addClass('ui-icon ui-icon-close');
		del.data('num', i);
		del.click(function(evt){
			var obj = $(evt.target);
			var num = obj.data('num');
			upfiles[num] = null;
			obj.parent().remove();
		});
		div.append(del);
		dnd_div.append(div);
	}
}

//////////////////////////////////////////////////////////////////////////////
// ●<input type=file> が変更された
//////////////////////////////////////////////////////////////////////////////
function input_change() {
	var flag = true;
	inputs.each(function(num, obj){
		if ($(obj).val() == '') flag=false;
	});
	if (!flag) return;
	apeend_input_file();
}
//-----------------------------
// 新しい要素の追加
//-----------------------------
function apeend_input_file() {
	if (inputs.length > 99) return;
	var inp = $('<input>', {
		type: 'file',
		name: 'file' + inputs.length + '_ary',
		multiple: 'multiple'
	}).change(input_change);
	filesdiv.append( inp );

	// 要素リスト更新
	inputs = filesdiv.find('input');
}

inputs.change( input_change );
input_change();

//////////////////////////////////////////////////////////////////////////////
// ●ファイルアップロード : submit
//////////////////////////////////////////////////////////////////////////////
upform.submit(function(){
	// ファイルがセットされているか確認
	var flag = upfiles.length;	// upfiles = DnDでのファイル
	inputs.each(function(num, obj){
		if ($(obj).val() != '') flag=true;
	});
	if (!flag) return false;

	// ajaxで処理
	if (window.FormData) return ajax_upload();

	// submit処理
	iframe.unbind();
	iframe.on('load', function(){
		upload_post_process( iframe.contents().text() );
	});
	message.html('<div class="message uploading">' + $('#uploading-msg').text() + '</div>');
	message.show();
	return true;
});

function upload_post_process(text) {
	upform_reset();	// フォームリセット
	var ary = text.split(/[\r\n]/);		// \r for IE8
	var ret = ary.shift();
	var reg = ret.match(/^ret=\d*/);
	if (reg) {
		ret = reg[0];
		message.html( ary.join("\n") );
		message.delay_show();
	}

	// ファイル選択を初期化する
	filesdiv.empty();
	apeend_input_file();

	// アルバムツリーのリロード
	tree_reload();
}

//////////////////////////////////////////////////////////////////////////////
// ●ajaxでファイルアップロード 
//////////////////////////////////////////////////////////////////////////////
function ajax_upload() {
	var fd = new FormData( upform[0] );
	for(var i=0; i<upfiles.length; i++) {
		if (!upfiles[i]) continue;
		fd.append('file_ary', upfiles[i]);
	}
	// for IE bug。これをしないとフォームからのみファイルupしたとき失敗する
	fd.append('dummy', 'dummy');

	// submit処理
	$.ajax(upform.attr('action'), {
		method: 'POST',
		contentType: false,
		processData: false,
		data: fd,
		dataType: 'text',
		error: function(xhr) {
			console.log('[ajax_upload()] http post fail');
			upload_post_process( xhr.responseText );
		},
		success: function(data) {
			console.log('[ajax_upload()] http post success');
			upload_post_process(data);
		}
	});

	upform_reset();
	message.html('<div class="message uploading">' + $('#uploading-msg').text() + '</div>');
	message.show();
	return false;
}

//////////////////////////////////////////////////////////////////////////////
// ●アップロードフォームのリセット
//////////////////////////////////////////////////////////////////////////////
function upform_reset(){
	message.hide();
	upfiles = [];
	update_upfiles();
}
upreset.click( upform_reset );

//////////////////////////////////////////////////////////////////////////////
// ●リンクのエンコード
//////////////////////////////////////////////////////////////////////////////
function encode_link(str){
	return str.replace(/#/g, "%23");
}

//############################################################################
// ■スマホ関連処理
//############################################################################
// スマホ用のDnDエミュレーション
view.dndEmulation();
//////////////////////////////////////////////////////////////////////////////
// ●フォルダの移動
//////////////////////////////////////////////////////////////////////////////
$('#album-move-folder').click(function(){
	folder_select_dialog(function(folder){
		var node = tree.dynatree("getTree").getNodeByKey(folder);
		if (!node) return false;

		return move_folder(node, cur_node);
	});
});

//////////////////////////////////////////////////////////////////////////////
// ●移動先フォルダ選択メニュー
//////////////////////////////////////////////////////////////////////////////
function folder_select_dialog(callback) {
	var div = $('#move-dialog');
	var buttons = {};

	div.empty();
	var dtree = $('<div>').addClass('album-folder-tree');
	dtree.dynatree({
		clickFolderMode: 1,	// activate only
		imagePath: $('#icon-path').text(),
		children: tree.dynatree("getTree").toDict()
	});
	div.append( dtree );

	var ok_func = function(){
		var node = dtree.dynatree("getActiveNode");
		if (!node || !node.data) return;
		var folder = node.data.key;
		if (folder == '') return;

		// callback
		if (!callback(folder)) {
			error_msg('#msg-illegal-folder');
			return;
		}
		div.dialog('close');
	};
	album_dialog(div, ok_func);
}

//############################################################################
// ●アルバム用ダイアログの表示ルーチン
//############################################################################
function album_dialog(div, ok_func) {
	var buttons = {};
	buttons[ div.data('ok') ] = function(){
		ok_func();
		div.dialog('close');
	}
	buttons[ div.data('cancel') ] = function(){
		div.dialog('close');
	};
	div.dialog({
		modal: true,
		minWidth:  240,
		minHeight: 100,
		title: div.data('title'),
		buttons: buttons
	});
}

//############################################################################
});
