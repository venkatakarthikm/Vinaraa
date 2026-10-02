export function getActiveTab(pathname: string, stateFrom?: string): 'home' | 'search' | 'library' | 'stats' {
  if (pathname.startsWith('/search')) return 'search';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/stats')) return 'stats';
  if (pathname.startsWith('/album') || pathname.startsWith('/playlist') || pathname.startsWith('/artist') || pathname.startsWith('/profile') || pathname.startsWith('/settings') || pathname.startsWith('/downloads')) {
    return (stateFrom as any) || 'home';
  }
  return 'home';
}
