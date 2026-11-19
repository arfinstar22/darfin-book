import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Bookmark, Heart, BookOpen, AlertCircle, Loader2, Check, UserPlus, ShieldCheck } from 'lucide-react';
import { loginWithGoogleApi, getAuthConfigApi } from '../api.js';
import type { UserProfile } from '../types.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'save' | 'favorite' | 'bookmark' | 'general';
  onLoginSuccess: (user: UserProfile, token: string) => void;
}

interface StoredGoogleAccount {
  email: string;
  name: string;
  picture?: string;
  lastUsed?: string;
}

const STORAGE_KEY = 'darfin_google_accounts';

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  reason = 'general',
  onLoginSuccess,
}) => {
  const [accounts, setAccounts] = useState<StoredGoogleAccount[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Load known Google accounts from local storage + default primary
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let list: StoredGoogleAccount[] = raw ? JSON.parse(raw) : [];

      // If list is empty, pre-populate with user's verified Gmail account
      if (!list || list.length === 0) {
        list = [
          {
            name: 'Tuan Darfin',
            email: 'darfinstar22@gmail.com',
            picture: 'https://api.dicebear.com/7.x/initials/svg?seed=Tuan%20Darfin',
            lastUsed: new Date().toISOString(),
          },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
      setAccounts(list);
    } catch {
      setAccounts([
        {
          name: 'Tuan Darfin',
          email: 'darfinstar22@gmail.com',
          picture: 'https://api.dicebear.com/7.x/initials/svg?seed=Tuan%20Darfin',
        },
      ]);
    }
  }, [isOpen]);

  // Fetch auth config & initialize Google Identity Services SDK if client ID exists
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    getAuthConfigApi().then((cfg) => {
      if (!isMounted) return;
      if (cfg.googleClientId) {
        setGoogleClientId(cfg.googleClientId);

        // If window.google is ready, initialize GIS
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
                    saveAccountToList(authRes.user);
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
              text: 'signin_with',
              shape: 'pill',
              logo_alignment: 'left',
              width: 320,
            });

            // Trigger Google One Tap / Account Chooser prompt
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

  const saveAccountToList = (user: UserProfile) => {
    try {
      const updated = accounts.filter((a) => a.email.toLowerCase() !== user.email.toLowerCase());
      const newAcc: StoredGoogleAccount = {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        picture: user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`,
        lastUsed: new Date().toISOString(),
      };
      const newList = [newAcc, ...updated];
      setAccounts(newList);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // Ignore storage errors
    }
  };

  if (!isOpen) return null;

  const getReasonInfo = () => {
    switch (reason) {
      case 'save':
        return {
          title: 'Simpan ke Rak Buku',
          desc: 'Pilih akun Google Anda untuk menyimpan buku ini ke rak bacaan pribadi.',
          icon: Bookmark,
        };
      case 'favorite':
        return {
          title: 'Tambah ke Buku Favorit',
          desc: 'Pilih akun Google Anda untuk menandai koleksi buku kesukaan Anda.',
          icon: Heart,
        };
      case 'bookmark':
        return {
          title: 'Tandai Halaman Baca',
          desc: 'Pilih akun Google Anda untuk menyimpan pembatas halaman dan progres membaca.',
          icon: BookOpen,
        };
      default:
        return {
          title: 'Pilih Akun Google',
          desc: 'Lanjutkan ke DARFIN BOOK dengan akun Google Anda.',
          icon: Sparkles,
        };
    }
  };

  const reasonInfo = getReasonInfo();
  const ReasonIcon = reasonInfo.icon;

  // Direct 1-Click login with a chosen Google account
  const handleSelectAccount = async (account: StoredGoogleAccount) => {
    setSelectedEmail(account.email);
    setIsLoading(true);
    setError(null);

    try {
      const res = await loginWithGoogleApi({
        email: account.email,
        name: account.name,
        picture: account.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(account.name)}`,
      });

      saveAccountToList(res.user);
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Gagal masuk dengan akun Google');
    } finally {
      setIsLoading(false);
      setSelectedEmail(null);
    }
  };

  // Add another Google account
  const handleAddNewAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = customEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Masukkan alamat Gmail yang valid (contoh: nama@gmail.com)');
      return;
    }

    const name = customName.trim() || email.split('@')[0];
    const newAcc: StoredGoogleAccount = {
      email,
      name,
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    };

    await handleSelectAccount(newAcc);
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

        {/* Google / DARFIN Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-50 dark:bg-slate-800/80 border border-[#E8E5DF] dark:border-slate-700 shadow-xs mb-3">
            {/* Google Logo SVG */}
            <svg className="h-7 w-7" viewBox="0 0 24 24">
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
          </div>

          <h3 className="text-xl font-bold text-[#1A1A1A] dark:text-white">
            Pilih akun Google
          </h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
            untuk melanjutkan ke <span className="font-semibold text-stone-800 dark:text-slate-200">DARFIN BOOK</span>
          </p>
        </div>

        {/* Public Access Reassurance Note */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-teal-100 dark:border-teal-900/50 bg-teal-50/70 dark:bg-teal-950/30 p-2.5 text-xs text-teal-800 dark:text-teal-300">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
          <span>
            <strong>Membaca 100% bebas tanpa login.</strong> Akun hanya digunakan untuk menyimpan rak, favorit, dan pembatas buku Anda.
          </span>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Container for Official GIS button if configured */}
        {googleClientId && (
          <div className="mt-4 flex justify-center">
            <div ref={googleBtnContainerRef}></div>
          </div>
        )}

        {/* Google Account Chooser List */}
        <div className="mt-4 divide-y divide-stone-100 dark:divide-slate-800/80 rounded-2xl border border-[#E8E5DF] dark:border-slate-800 overflow-hidden bg-stone-50/50 dark:bg-slate-900/50">
          {accounts.map((acc) => {
            const isThisLoading = isLoading && selectedEmail === acc.email;
            return (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleSelectAccount(acc)}
                disabled={isLoading}
                className="group flex w-full items-center justify-between p-3.5 text-left transition hover:bg-stone-100/80 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <img
                      src={acc.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(acc.name)}`}
                      alt={acc.name}
                      className="h-10 w-10 rounded-full border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 object-cover shadow-2xs"
                    />
                    <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-2xs">
                      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24">
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
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                      {acc.name}
                    </p>
                    <p className="truncate text-xs text-stone-500 dark:text-slate-400">
                      {acc.email}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  {isThisLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-teal-600 dark:text-teal-400" />
                  ) : (
                    <span className="rounded-full bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 group-hover:bg-teal-600 group-hover:text-white transition">
                      Pilih
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Use another account option */}
          {!showAddAccount ? (
            <button
              type="button"
              onClick={() => setShowAddAccount(true)}
              disabled={isLoading}
              className="flex w-full items-center gap-3.5 p-3.5 text-left text-xs font-semibold text-stone-600 dark:text-slate-300 hover:bg-stone-100/80 dark:hover:bg-slate-800 transition"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-500 dark:text-slate-400">
                <UserPlus className="h-4 w-4" />
              </div>
              <span>Gunakan akun Google lain</span>
            </button>
          ) : (
            <div className="p-3.5 bg-white dark:bg-slate-850 animate-in fade-in">
              <div className="mb-2 text-xs font-semibold text-stone-800 dark:text-slate-200">
                Masukkan Akun Gmail Lain:
              </div>
              <div className="space-y-2">
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Nama Lengkap (Opsional)"
                  className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAddNewAccount()}
                    disabled={isLoading || !customEmail.includes('@')}
                    className="flex-1 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {isLoading ? 'Menghubungkan...' : 'Lanjutkan Masuk'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddAccount(false)}
                    className="rounded-xl border border-stone-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-stone-500 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800 transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info & Dismiss */}
        <p className="mt-4 text-center text-[11px] text-stone-400 dark:text-slate-500 leading-relaxed">
          Google akan membagikan nama, email, dan foto profil Anda dengan DARFIN BOOK untuk menyimpan rak bacaan.
        </p>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-stone-500 hover:text-stone-800 dark:text-slate-400 dark:hover:text-white font-medium transition"
          >
            Lanjut membaca gratis tanpa login
          </button>
        </div>
      </div>
    </div>
  );
};