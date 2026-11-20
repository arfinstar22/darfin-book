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
  Trash2,
  Mail,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import {
  loginWithGoogleApi,
  getAuthConfigApi,
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

  // Google OAuth Client ID & SDK
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Manual fallback toggle
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');

  // Load accounts previously logged into on this device
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

  // Load Google Auth configuration & initialize Google Identity Services
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    getAuthConfigApi().then((cfg) => {
      if (!isMounted) return;
      const cid = cfg.googleClientId || '';
      setGoogleClientId(cid);

      if (cid) {
        const googleObj = (window as any).google;
        if (googleObj?.accounts?.id) {
          try {
            googleObj.accounts.id.initialize({
              client_id: cid,
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

            if (googleBtnContainerRef.current) {
              googleBtnContainerRef.current.innerHTML = '';
              const btnWidth = Math.min(320, Math.max(220, window.innerWidth - 64));
              googleObj.accounts.id.renderButton(googleBtnContainerRef.current, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: btnWidth,
              });
            }

            // Trigger Google One Tap account chooser popup
            googleObj.accounts.id.prompt();
          } catch (e) {
            console.warn('Google Identity Services initialization warning:', e);
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
      // Ignore
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
          desc: 'Pilih akun Google Anda untuk menyimpan buku ini ke koleksi pribadi.',
          icon: Bookmark,
        };
      case 'favorite':
        return {
          title: 'Tambah ke Buku Favorit',
          desc: 'Pilih akun Google Anda untuk menandai buku kesukaan Anda.',
          icon: Heart,
        };
      case 'bookmark':
        return {
          title: 'Tandai Halaman Baca',
          desc: 'Pilih akun Google Anda untuk menyimpan penanda dan progres membaca.',
          icon: BookOpen,
        };
      default:
        return {
          title: 'Masuk dengan Akun Google',
          desc: 'Pilih akun Google untuk menyinkronkan rak buku, favorit, dan pembatas bacaan di cloud.',
          icon: Sparkles,
        };
    }
  };

  const reasonInfo = getReasonInfo();
  const ReasonIcon = reasonInfo.icon;

  // Primary: Official Google Sign-In with Account Chooser (No Client Secret Required!)
  const handlePrimaryGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    const googleObj = (window as any).google;
    const cid = googleClientId || '922505812682-kmk334il5k1pvvq1bsgch63099oo33k4.apps.googleusercontent.com';

    if (googleObj?.accounts?.oauth2) {
      try {
        const tokenClient = googleObj.accounts.oauth2.initTokenClient({
          client_id: cid,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setIsLoading(false);
              setError('Login Google dibatalkan atau terjadi kesalahan.');
              return;
            }
            if (tokenResponse.access_token) {
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
                  setError('Gagal membaca profil dari akun Google Anda.');
                }
              } catch (err: any) {
                setError(err.message || 'Gagal masuk dengan Google');
              } finally {
                setIsLoading(false);
              }
            }
          },
        });

        // Opens Google account picker popup (handled in-app by MainActivity on Android)
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (e: any) {
        console.warn('initTokenClient error:', e);
      }
    }

    // Fallback: If Google SDK is still loading or offline, show manual Gmail form
    setIsLoading(false);
    setShowManualForm(true);
    setError('Memuat modul Google SDK... Silakan gunakan form Gmail di bawah atau coba ketuk tombol lagi.');
  };

  // Quick 1-click login for an account previously used on this device
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
      setError((err as Error).message || 'Gagal masuk dengan akun ini.');
    } finally {
      setIsLoading(false);
      setSelectedEmail(null);
    }
  };

  // Fallback manual submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let email = manualEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@')) email = `${email}@gmail.com`;

    setIsLoading(true);
    setError(null);
    try {
      const res = await loginWithGoogleApi({
        email,
        name: manualName.trim() || undefined,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(manualName || email)}`,
      });
      saveAccountToDevice(res.user);
      onLoginSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal masuk');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E8E5DF] dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 sm:p-6 shadow-2xl transition-all">
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
            <strong>Membaca 100% bebas tanpa login.</strong> Akun hanya digunakan untuk menyimpan rak, favorit, dan pembatas halaman Anda di cloud.
          </span>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Previous Device Accounts (1-Tap instant login) */}
        {deviceAccounts.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-stone-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              Pilih Akun Tersimpan di Perangkat Ini
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
                        <span className="flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 group-hover:bg-teal-600 group-hover:text-white transition">
                          <span>Masuk</span>
                          <ArrowRight className="h-3 w-3" />
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

        {/* PRIMARY ACTION: Official Google Sign-In */}
        <div className="mt-5 space-y-3">
          {/* GIS rendered button container (if initialized) */}
          <div ref={googleBtnContainerRef} className="flex justify-center empty:hidden"></div>

          {/* Official Large Google Button */}
          <button
            type="button"
            onClick={handlePrimaryGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 text-xs font-bold text-stone-800 dark:text-white shadow-xs hover:bg-stone-50 dark:hover:bg-slate-700 active:scale-[0.99] transition disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
            <span>Pilih Akun Google (Google Sign-In)</span>
          </button>

          {/* Collapsible Alternative Manual Form (Only if desired) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex items-center justify-center gap-1 text-[11px] text-stone-500 dark:text-slate-400 hover:text-stone-700 dark:hover:text-slate-200 transition mx-auto py-1"
            >
              <span>Atau ketik alamat Gmail manual</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showManualForm ? 'rotate-180' : ''}`} />
            </button>

            {showManualForm && (
              <form onSubmit={handleManualSubmit} className="mt-3 space-y-2.5 rounded-2xl bg-stone-50 dark:bg-slate-900/60 border border-stone-200 dark:border-slate-800 p-3.5 animate-in fade-in">
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="nama.anda@gmail.com"
                  required
                  className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-teal-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Nama Lengkap (Opsional)"
                  className="w-full rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-teal-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition"
                >
                  Masuk Manual
                </button>
              </form>
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
