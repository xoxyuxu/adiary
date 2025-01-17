#-----------------------------------------------------------------------------
# InformationモジュールのHTML生成ルーチン
#-----------------------------------------------------------------------------
sub {
	my $self = shift;
	my $name = shift;
	my $id   = $self->plugin_name_id($name);
	my $set  = $self->load_plgset($name);

#-----------------------------------------------------------------------------
# モジュールのデータ
#-----------------------------------------------------------------------------
	my %modules;
	my $title  = $set->{title} || 'Information';
	my $hidden = $set->{title_hidden} ? ' display-none' : '';

	$modules{_header} = <<HTML;
<!--Information=========================================-->
<div class="hatena-module" id="$id" data-module-name="$name">
<div class="hatena-moduletitle$hidden">$title</div>
<div class="hatena-modulebody">
<ul class="hatena-section">
HTML

	$modules{_footer} = <<'HTML';
</ul>
</div> <!-- hatena-modulebody -->
</div> <!-- hatena-module -->
HTML

	$modules{description} = <<'HTML';
	<li class="description"><@s.description_txt></li>
HTML
	$modules{'artlist-link'} = <<'HTML';
	<li class="to-artlist"><a href="<@v.myself>?artlist">記事一覧</a></li>
HTML
	$modules{'comlist-link'} = <<'HTML';
	<li class="to-comlist"><a href="<@v.myself>?comlist" rel="nofollow">コメント一覧</a></li>
HTML
	$modules{'artcomlist-link'} = <<'HTML';
	<li class="to-artlist to-comlist"><a href="<@v.myself>?artlist" target="_blank">記事一覧</a> / <a href="<@v.myself>?comlist" target="_blank">コメント一覧</a></li>
HTML
	$modules{'print-link'} = <<'HTML';
	<li class="to-print"><a href="<@v.myself2><@esc(v.pinfo)>?<@if(v.query0,  #'<@v.query0>&amp;')><@make_query_amp()>&amp;_theme=satsuki2/_print" rel="nofollow">印刷用の表示</a></li>
HTML
	$modules{'print-link_blank'} = <<'HTML';
	<li class="to-print"><a href="<@v.myself2><@esc(v.pinfo)>?<@if(v.query0,  #'<@v.query0>&amp;')><@esc(make_query())>&amp;_theme=satsuki2/_print" rel="nofollow" target="_blank">印刷用の表示</a></li>
HTML
	$modules{bcounter} = <<'HTML';
	<li class="bcounter icons"><a class="bcounter" href="http://b.hatena.ne.jp/entrylist?url=<@v.server_url><@v.myself>"><img alt="はてブカウンタ" src="http://b.hatena.ne.jp/bc/<#val>/<@v.server_url><@v.myself>" class="bcounter"></a></li>
HTML
	$modules{bicon} = <<'HTML';
	<li class="http-bookmark icons"><a class="http-bookmark" href="http://b.hatena.ne.jp/entry/<@v.server_url><@v.myself>"><img src="http://b.st-hatena.com/entry/image/<@v.server_url><@v.myself>" alt="はてブ数"></a></li>
HTML
	$modules{rssicon} = <<'HTML';
	<li class="rss-icon icons">
	<@ifexec(s.rss_files, begin)>
	<a href="<@Basepath><@v.blogpub_dir><@v.load_rss_files()#0>">
	<$end>
	<img alt="RSS" src="<@Basepath><@v.pubdist_dir>rss-icon.png">
	<@if(s.rss_files, '</a>')></li>
HTML
	$modules{free_txt} = $modules{freebr_txt} =<<'HTML';
	<li class="free-text"><#val></li>
HTML

	my $ele = $set->{elements} ? $set->{elements} : <<'DEFAULT';
description
artlist-link
print-link
DEFAULT
	my @elements = split("\n", $ele);
	unshift(@elements, '_header');
	push   (@elements, '_footer');

	my $html='';
	foreach(@elements) {
		my $key = $_;
		my $val = '';
		if ($_ =~ /^([\w\-]*),(.*)$/s) {
			$key = $1;
			$val = $2;
		}
		my $mod = $modules{$key};
		if (!$mod) { next; }

		# 保存
		$mod =~ s/<#val>/$val/g;
		$html .= $mod;
	}

	return $html;
}

