import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Settings, Sparkles, Play, CircleAlert, X } from 'lucide-react';
import { recommendations, music } from '@/api/endpoints';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { usePlayerStore } from '@/store/player';
import { MediaCard } from '@/components/MediaCard';
import Chip from '@/components/Chip';
import { Skeleton, MediaCardSkeleton } from '@/components/Skeleton';
import { formatPlayerSong } from '@/utils/song';
import { getMediaImage } from '@/utils/image';
import { Sheet } from '@/components/SheetHost';
import Button from '@/components/Button';

function getGreetingText(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setQueue = usePlayerStore((s) => s.setQueue);

  // States
  const [feedRails, setFeedRails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activePopup, setActivePopup] = useState<any>(null);

  // First name calculation (§2.1)
  const firstName = user?.name?.trim().split(/\s+/)[0] || null;

  // Load active home popup once on mount
  useEffect(() => {
    apiClient<any>('/music/home/popup')
      .then((res: any) => {
        if (res?.popup) setActivePopup(res.popup);
      })
      .catch(() => {});
  }, []);

  const loadHomeData = async (lang = 'All') => {
    setLoading(true);
    setError(false);

    try {
      const languageCode = lang === 'All' ? undefined : lang.toLowerCase();
      const [feedRes] = await Promise.allSettled([
        recommendations.feed(),
        music.modules(languageCode),
      ]);

      if (feedRes.status === 'fulfilled' && feedRes.value?.rails) {
        setFeedRails(feedRes.value.rails);
      }
    } catch (_e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData(selectedLanguage);
  }, [selectedLanguage]);

  const handlePlayRail = (rail: any) => {
    const songs = (rail?.items || []).filter((i: any) => i.type === 'song').map(formatPlayerSong);
    if (songs.length) {
      setQueue(songs, 0, 'home_rail', rail?.key, rail?.title);
      navigate('/player');
    }
  };

  const userLanguages = user?.preferences?.languages || ['Hindi', 'Telugu', 'Tamil'];
  const languageOptions = ['All', ...userLanguages];

  // Carousel banners from first 3 feed rails
  const bannerRails = feedRails.slice(0, 3);

  return (
    <div className="relative w-full h-full bg-bg">
      {/* Scrollable Container */}
      <div className="absolute inset-0 overflow-y-auto overscroll-contain pb-[var(--bottom-chrome)]">
        {/* Top Bar (Sticky, Safe area padded) */}
        <header
          className="flex items-center justify-between px-5 sticky top-0 z-20 bg-transparent transition-colors duration-200"
          style={{ paddingTop: 'calc(var(--sat) + 12px)', paddingBottom: '8px' }}
        >
          {/* Avatar (44x44) */}
          <button
            onClick={() => navigate('/profile')}
            className="w-[44px] h-[44px] rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center text-on-primary font-bold t-h3 shadow-sm flex-shrink-0"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              (user?.name || 'U')[0].toUpperCase()
            )}
          </button>

          {/* Greeting Block */}
          <div className="flex-1 px-3 min-w-0">
            <p className="t-cap text-[12px] text-muted leading-tight">{getGreetingText()}</p>
            {firstName ? (
              <h2 className="t-h2 text-[18px] font-bold text-text truncate leading-tight">
                {firstName}
              </h2>
            ) : (
              <Skeleton width={96} height={18} radius={9} className="mt-1" />
            )}
          </div>

          {/* Right Icon Buttons (Bell & Settings) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setNotificationsOpen(true)}
              className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
              aria-label="Notifications"
            >
              <Bell size={20} />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Content Width Centered */}
        <main className="w-full max-w-[480px] mx-auto flex flex-col gap-6 pt-2">
          {/* Banner Carousel (Portrait Cards 4:5 ratio) */}
          <section className="px-5 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-text">
              <Sparkles size={18} className="text-primary" />
              <h2 className="t-h2 text-[20px] font-bold text-text">Made for you</h2>
            </div>

            {loading ? (
              <div className="flex gap-3 overflow-x-hidden">
                <Skeleton width={180} height={225} radius={24} />
                <Skeleton width={180} height={225} radius={24} />
                <Skeleton width={180} height={225} radius={24} />
              </div>
            ) : bannerRails.length > 0 ? (
              <div className="flex gap-3.5 overflow-x-auto snap-x no-scrollbar">
                {bannerRails.map((rail, idx) => {
                  const coverImage = getMediaImage(rail.items?.[0] || rail);
                  return (
                    <div
                      key={rail.key || idx}
                      className="relative min-w-[180px] w-[180px] h-[225px] rounded-[24px] overflow-hidden flex-shrink-0 snap-start shadow-md cursor-pointer group"
                      onClick={() => navigate(`/list/${rail.key}`)}
                    >
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt={rail.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-surface-2 flex items-center justify-center text-muted">🎵</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                      <div className="relative z-10 p-4 h-full flex flex-col justify-between items-start">
                        <span className="t-micro text-[10px] font-bold uppercase tracking-wider bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded-full text-white/90">
                          Mix
                        </span>

                        <div className="w-full flex flex-col gap-2">
                          <div>
                            <h3 className="t-h3 text-[15px] font-bold text-white line-clamp-2 leading-tight">
                              {rail.title}
                            </h3>
                            {rail.subtitle && (
                              <p className="t-cap text-[11px] text-white/70 truncate mt-0.5">
                                {rail.subtitle}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayRail(rail);
                            }}
                            className="h-[36px] w-full rounded-full bg-primary text-on-primary flex items-center justify-center gap-1.5 t-cap text-[12px] font-bold shadow-md active:scale-95 transition-transform"
                          >
                            <Play size={14} fill="currentColor" />
                            <span>Play</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>

          {/* Language Chips (h 36) */}
          <section className="px-5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {languageOptions.map((lang) => (
                <Chip
                  key={lang}
                  label={lang}
                  selected={selectedLanguage === lang}
                  onClick={() => setSelectedLanguage(lang)}
                />
              ))}
            </div>
          </section>

          {/* Dynamic Feed Rails */}
          {loading ? (
            <div className="px-5 flex flex-col gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex flex-col gap-3">
                  <Skeleton width={160} height={20} radius={8} />
                  <div className="flex gap-3 overflow-x-hidden">
                    <MediaCardSkeleton />
                    <MediaCardSkeleton />
                    <MediaCardSkeleton />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-5 py-12 flex flex-col items-center text-center gap-3">
              <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-danger">
                <CircleAlert size={32} />
              </div>
              <h2 className="t-h2 text-[20px] font-bold text-text">Couldn't load your music</h2>
              <p className="t-cap text-[13px] text-muted">Please check your connection and try again.</p>
              <Button size="sm" onClick={() => loadHomeData(selectedLanguage)}>
                Retry
              </Button>
            </div>
          ) : (
            feedRails.map((rail) => (
              <section key={rail.key || rail.title} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-5">
                  <h2 className="t-h2 text-[20px] font-bold text-text">{rail.title}</h2>
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/list/${rail.key}`)}
                    className="t-cap text-[13px] text-muted hover:text-text px-2"
                  >
                    See all
                  </Button>
                </div>

                <div className="flex gap-3 overflow-x-auto px-5 no-scrollbar">
                  {(rail.items || []).map((item: any) => (
                    <MediaCard
                      key={item.id}
                      id={item.id}
                      title={item.name || item.title}
                      subtitle={item.artist || item.subtitle}
                      image={item.image}
                      type={item.type || 'album'}
                      matchPercent={item.matchPercent}
                      onClick={() => {
                        if (item.type === 'song') {
                          setQueue([formatPlayerSong(item)], 0, 'home', item.id, item.name);
                          navigate('/player');
                        } else {
                          navigate(`/${item.type || 'album'}/${item.id}`);
                        }
                      }}
                      onPlayClick={() => {
                        setQueue([formatPlayerSong(item)], 0, 'home', item.id, item.name);
                        navigate('/player');
                      }}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>

      {/* Notifications Bottom Sheet (§9.9) */}
      <Sheet
        id="notifications-sheet"
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title="Notifications"
      >
        <div className="flex flex-col items-center text-center py-10 gap-3">
          <div className="w-[72px] h-[72px] rounded-full bg-surface-2 flex items-center justify-center text-muted">
            <Bell size={32} />
          </div>
          <h2 className="t-h2 text-[20px] font-bold text-text">You're all caught up</h2>
          <p className="t-cap text-[13px] text-muted max-w-[280px]">
            New releases from artists you follow will show up here.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setNotificationsOpen(false);
              navigate('/settings#notifications');
            }}
            className="mt-4"
          >
            Notification settings
          </Button>
        </div>
      </Sheet>

      {/* Active Home Popup Modal */}
      {activePopup && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-[92vw] max-h-[60vh] bg-surface surface-glass rounded-[28px] border border-line p-5 shadow-2xl flex flex-col overflow-hidden">
            <button
              onClick={() => setActivePopup(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-2 text-text flex items-center justify-center z-10"
              aria-label="Close popup"
            >
              <X size={18} />
            </button>

            <div
              className="flex-1 overflow-y-auto overscroll-contain pr-1 text-text"
              onClick={(e) => {
                const target = (e.target as HTMLElement).closest('[data-vinaraa-action]');
                if (target) {
                  const action = target.getAttribute('data-vinaraa-action');
                  const id = target.getAttribute('data-vinaraa-id');
                  if (action === 'open-album' && id) {
                    setActivePopup(null);
                    navigate(`/album/${id}`);
                  } else if (action === 'open-artist' && id) {
                    setActivePopup(null);
                    navigate(`/artist/${id}`);
                  } else if (action === 'play-song' && id) {
                    setActivePopup(null);
                    music.song(id).then((s: any) => {
                      setQueue([formatPlayerSong(s)], 0, 'home_popup', id, 'Popup');
                      navigate('/player');
                    }).catch(() => {});
                  }
                }
              }}
              dangerouslySetInnerHTML={{ __html: activePopup.html }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
