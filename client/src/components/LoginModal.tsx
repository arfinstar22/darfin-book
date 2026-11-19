import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Bookmark,
  Heart,
  BookOpen,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ChevronRight,
  Info,
  Trash2,
} from 'lucide-react';
import {
  loginWithGoogleApi,
  getAuthConfigApi,
  getGoogleAuthUrlApi,
} from '../api.js';
import type { UserProfile } from '../types.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'save' | 'favorite' | 'bookmark' | 'general';
  onLoginSuccess: (user: UserProfile, token: string) => void;
}

interface StoredDeviceAccount {
  email: string;
  name: string;
  picture?: string;
  lastUsed?: string;
}

const STORAGE_KEY = 'darfin_device_accounts';

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  reason = 'general',
  onLoginSuccess,
}) => {
  const [deviceAccounts, setDeviceAccounts] = useState<StoredDeviceAccount[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email entry for manual/direct Gmail sign in
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showDirectEmail, setShowDirectEmail] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  // Google OAuth / GIS status
  const [hasGoogleOAuth, setHasGoogleOAuth] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Load only accounts that this specific device/browser has logged into previously
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDeviceAccounts(parsed);
        }
      } else {
        setDeviceAccounts([]);
      }
    } catch {
      setDeviceAccounts([]);
    }
  }, [isOpen]);

  // Check backend Google OAuth config & initialize GIS SDK if client ID exists
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    getAuthConfigApi().then((cfg) => {
      if (!isMounted) return;
      setHasGoogleOAuth(Boolean(cfg.hasGoogleOAuth && cfg.googleClientId));
      setGoogleClientId(cfg.googleClientId || '');

      // Initialize Google Identity Services (GIS) if client ID is configured
      if (cfg.googleClientId) {
        const googleObj = (window as any).google;
        if (googleObj?.accounts?.id && googleBtnContainerRef.current) {
          try {
            googleObj.accounts.id.initialize({
              client_id: cfg.googleClientId,
              callback: async (res: any) => {
                if (res?.credential) {
                  setIsLoading(true);
                  setError(null);
                  try {
                    const authRes = await loginWithGoogleApi({ credential: res.credential });
                    saveAccountToDevice(authRes.user);
                    onLoginSuccess(authRes.user, authRes.token);
                    onClose();
                  } catch (err: any) {
                    setError(err.message || 'Gagal masuk dengan Google');
                  } finally {
                    setIsLoading(false);
                  }
                }
              },
              auto_select: false,
              cancel_on_tap_outside: true,
            });

            googleBtnContainerRef.current.innerHTML = '';
            googleObj.accounts.id.renderButton(googleBtnContainerRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 320,
            });

            // Trigger Google One Tap account chooser popup
            googleObj.accounts.id.prompt();
          } catch (e) {
            console.warn('GIS initialization error:', e);
          }
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const saveAccountToDevice = (user: UserProfile) => {
    try {
      const updated = deviceAccounts.filter(
        (a) => a.email.toLowerCase() !== user.email.toLowerCase()
      );
      const newAcc: StoredDeviceAccount = {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        picture:
          user.avatarUrl ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`,
        lastUsed: new Date().toISOString(),
      };
      const newList = [newAcc, ...updated];
      setDeviceAccounts(newList);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // Ignore storage errors
    }
  };

  const removeAccountFromDevice = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deviceAccounts.filter(
      (a) => a.email.toLowerCase() !== email.toLowerCase()
    );
    setDeviceAccounts(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  if (!isOpen) return null;

  const getReasonInfo = () => {
    switch (reason) {
      case 'save':
        return {
          title: 'Simpan ke Rak Buku',
          desc: 'Masuk dengan akun Google Anda untuk menyimpan buku ini ke koleksi pribadi.',
          icon: Bookmark,
        };
      case 'favorite':
        return {
          title: 'Tambah ke Buku Favorit',
          desc: 'Masuk dengan akun Google Anda untuk menandai buku kesukaan Anda.',
          icon: Heart,
        };
      case 'bookmark':
        return {
          title: 'Tandai Halaman Baca',
          desc: 'Masuk dengan akun Google Anda untuk menyimpan penanda dan progres membaca.',
          icon: BookOpen,
        };
      default:
        return {
          title: 'Masuk dengan Akun Google',
          desc: 'Sinkronkan rak buku, favorit, dan pembatas bacaan Anda di semua perangkat.',
          icon: Sparkles,
        };
    }
  };

  const reasonInfo = getReasonInfo();
  const ReasonIcon = reasonInfo.icon;

  // Handle clicking the primary Google OAuth button
  const handleGoogleOAuthClick = async () => {
    setIsLoading(true);
    setError(null);

    // 1. Try Google Identity Services OAuth2 Token Popup (Client-side, NO client_secret required!)
    const googleObj = (window as any).google;
    if (googleClientId && googleObj?.accounts?.oauth2) {
      try {
        const tokenClient = googleObj.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setIsLoading(false);
              setError('Login Google dibatalkan atau terjadi kesalahan.');
              return;
            }
            if (tokenResponse.access_token) {
              setIsLoading(true);
              setError(null);
              try {
                // Fetch verified profile from Google's userinfo API
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const profile = await userInfoRes.json();
                if (profile.email) {
                  const authRes = await loginWithGoogleApi({
                    email: profile.email,
                    name: profile.name,
                    picture: profile.picture,
                    googleId: profile.sub,
                  });
                  saveAccountToDevice(authRes.user);
                  onLoginSuccess(authRes.user, authRes.token);
                  onClose();
                } else {
                  setError('Gagal membaca data profil dari akun Google Anda.');
                }
              } catch (err: any) {
                setError(err.message || 'Gagal masuk dengan Google');
              } finally {
                setIsLoading(false);
              }
            }
          },
        });

        setIsLoading(false);
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (e) {
        console.warn('initTokenClient error, falling back to server redirect:', e);
      }
    }

    // 2. Fallback to server redirect flow
    try {
      const res = await getGoogleAuthUrlApi();
      if (res.configured && res.url) {
        window.location.href = res.url;
        return;
      }

      setShowDirectEmail(true);
      setError(
        'Server belum mengonfigurasi GOOGLE_CLIENT_ID. Silakan gunakan form Gmail di bawah ini.'
      );
    } catch (err: unknown) {
      setError((err as Error).message || 'Gagal memulai autentikasi Google');
    } finally {
      setIsLoading(false);
    }
  };

  // Direct login with email (for any user)
  const handleDirectEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Masukkan alamat email Gmail yang valid (contoh: nama@gmail.com)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await loginWithGoogleApi({
        email,
        name: nameInput.trim() || undefined,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameInput || email)}`,
      });

      saveAccountToDevice(res.user);
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Gagal masuk dengan akun Google');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-click login for an account previously used on this machine
  const handleSelectStoredAccount = async (account: StoredDeviceAccount) => {
    setSelectedEmail(account.email);
    setIsLoading(true);
    setError(null);

    try {
      const res = await loginWithGoogleApi({
        email: account.email,
        name: account.name,
        picture: account.picture,
      });

      saveAccountToDevice(res.user);
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Gagal masuk dengan akun ini');
    } finally {
      setIsLoading(false);
      setSelectedEmail(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 shadow-2xl transition-all">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800 dark:text-slate-400 transition"
          title="Tutup dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 shadow-xs mb-3">
            <ReasonIcon className="h-7 w-7" />
          </div>

          <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-white">
            {reasonInfo.title}
          </h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-slate-400 max-w-xs leading-relaxed">
            {reasonInfo.desc}
          </p>
        </div>

        {/* Public Access Reassurance Note */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-teal-100 dark:border-teal-900/50 bg-teal-50/70 dark:bg-teal-950/30 p-2.5 text-xs text-teal-800 dark:text-teal-300">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
          <span>
            <strong>Membaca 100% bebas tanpa login.</strong> Akun hanya diperlukan saat Anda ingin menyimpan rak, favorit, atau pembatas buku.
          </span>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Previous Device Accounts (If any exist on this specific browser) */}
        {deviceAccounts.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-stone-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              Akun di Perangkat Ini
            </p>
            <div className="divide-y divide-stone-100 dark:divide-slate-800/80 rounded-2xl border border-[#E8E5DF] dark:border-slate-800 overflow-hidden bg-stone-50/50 dark:bg-slate-900/50">
              {deviceAccounts.map((acc) => {
                const isThisLoading = isLoading && selectedEmail === acc.email;
                return (
                  <div
                    key={acc.email}
                    onClick={() => handleSelectStoredAccount(acc)}
                    className="group flex w-full items-center justify-between p-3 text-left cursor-pointer transition hover:bg-stone-100/80 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={acc.picture}
                        alt={acc.name}
                        className="h-9 w-9 rounded-full border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-stone-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                          {acc.name}
                        </p>
                        <p className="truncate text-[11px] text-stone-500 dark:text-slate-400">
                          {acc.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isThisLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                      ) : (
                        <span className="rounded-full bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 group-hover:bg-teal-600 group-hover:text-white transition">
                          Masuk
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => removeAccountFromDevice(acc.email, e)}
                        className="p-1 text-stone-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition"
                        title="Hapus dari riwayat perangkat ini"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary Action: Official Google Sign-In */}
        <div className="mt-5 space-y-3">
          {/* If Google Identity Services iframe is loaded */}
          {googleClientId && (
            <div className="flex justify-center">
              <div ref={googleBtnContainerRef}></div>
            </div>
          )}

          {/* Official Google OAuth Direct Button */}
          <button
            type="button"
            onClick={handleGoogleOAuthClick}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-xs font-bold text-stone-800 dark:text-white shadow-xs hover:bg-stone-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Lanjutkan dengan Akun Google</span>
          </button>

          {/* Toggle Direct Gmail Form */}
          {!showDirectEmail ? (
            <button
              type="button"
              onClick={() => setShowDirectEmail(true)}
              className="w-full text-center text-xs text-stone-500 hover:text-stone-700 dark:text-slate-400 dark:hover:text-slate-200 transition py-1"
            >
              Atau ketik alamat Gmail Anda manual
            </button>
          ) : (
            <form onSubmit={handleDirectEmailSubmit} className="mt-3 space-y-2.5 rounded-2xl bg-stone-50 dark:bg-slate-900/60 border border-stone-200 dark:border-slate-800 p-3.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                  Masuk dengan Alamat Gmail:
                </span>
                <button
                  type="button"
                  onClick={() => setShowDirectEmail(false)}
                  className="text-[11px] text-stone-400 hover:text-stone-600 dark:text-slate-500"
                >
                  Tutup
                </button>
              </div>

              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="nama.anda@gmail.com"
                required
                className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />

              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Nama Lengkap (Opsional)"
                className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <span>Masuk Sekarang</span>
                )}
              </button>
            </form>
          )}

          {/* Collapsible Info: Cara mengaktifkan Google OAuth resmi */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowConfigHelp(!showConfigHelp)}
              className="flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-slate-500 hover:text-stone-600 dark:hover:text-slate-400 transition mx-auto"
            >
              <Info className="h-3 w-3" />
              <span>Cara agar pop-up Google akun otomatis aktif?</span>
            </button>

            {showConfigHelp && (
              <div className="mt-2 rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-900 p-3 text-[11px] leading-relaxed text-stone-600 dark:text-slate-400 animate-in fade-in">
                <p className="font-semibold text-stone-800 dark:text-slate-200 mb-1">
                  Pengaturan Google Cloud Console (2 Menit):
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Buka <strong>console.cloud.google.com/apis/credentials</strong></li>
                  <li>Buat <strong>OAuth client ID</strong> (Web Application).</li>
                  <li>Isi Authorized JavaScript origin: <code className="rounded bg-stone-200 dark:bg-slate-800 px-1">https://darfin-book.onrender.com</code></li>
                  <li>Isi Authorized redirect URI: <code className="rounded bg-stone-200 dark:bg-slate-800 px-1">https://darfin-book.onrender.com/api/v1/auth/google/callback</code></li>
                  <li>Salin <strong>Client ID</strong> &amp; <strong>Client Secret</strong> ke Environment Variables Render: <code className="rounded bg-stone-200 dark:bg-slate-800 px-1">GOOGLE_CLIENT_ID</code></li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer Dismiss */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-stone-400 hover:text-stone-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
          >
            Lanjut membaca gratis tanpa login
          </button>
        </div>
      </div>
    </div>
  );
};