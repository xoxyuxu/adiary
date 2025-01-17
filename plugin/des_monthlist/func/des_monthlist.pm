#-----------------------------------------------------------------------------
# 月別の記事一覧モジュール
#-----------------------------------------------------------------------------
sub {
	my $self = shift;
	my $name = shift;
	my $ROBJ = $self->{ROBJ};
	my $DB   = $self->{DB};
	my $blogid = $self->{blogid};

	my $blog_only = $self->load_plgset($name, 'blog_only');
	my $h = {
		flag     => { enable => 1 },
		cols     => [ 'yyyymmdd' ]
	};
	if ($blog_only) {
		$h->{match} = { priority => 0 };
	}
	my $ary = $DB->select("${blogid}_art", $h);

	my %yyyymm;
	foreach(@$ary) {
		$yyyymm{ substr($_->{yyyymmdd},0,6) }++;
	}
	my @yyyymm = sort {$b <=> $a} keys(%yyyymm);
	@yyyymm = map {
		{yyyymm => $_,
		 year => substr($_,0,4),
		 mon  => substr($_,4,2),
		 count => $yyyymm{$_} }
	} @yyyymm;

	# スケルトンの実行
	$self->update_plgset($name, 'html', $ROBJ->call_and_chain('_format/month_list', $name, \@yyyymm));
	return 0;
}

