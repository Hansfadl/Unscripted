import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { useToast } from '../../components/ToastProvider';

export function AdminLoginPage() {
  const { user, isAdmin, authReady, signInWithGoogle, signOutAdmin } = useFirebase();
  const { pushToast } = useToast();
  const location = useLocation();
  const [signingIn, setSigningIn] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from || '/admin/dashboard';

  if (authReady && user && isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await signInWithGoogle();
      if (result.isAdmin) {
        pushToast('success', 'Welcome back', `Signed in as ${result.user.email}`);
      } else {
        pushToast(
          'error',
          'Access denied',
          `${result.user.email || 'This account'} is not authorized for UNSCRIPTED admin access.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Sign-In failed.';
      pushToast('error', 'Authentication error', message);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F1E9] text-[#171717] flex flex-col justify-between p-6 sm:p-10">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight">
          UNSCRIPTED
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[#171717]/70 hover:text-[#171717]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Public Site
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto bg-white border border-[#171717] p-8 sm:p-10">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#171717]/60 mb-4">
          <ShieldCheck className="w-4 h-4 text-[#171717]" />
          <span>Internal Administration</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Studio Admin Portal
        </h1>
        <p className="mt-3 text-sm text-[#171717]/70 leading-relaxed">
          Sign in with your authorized Google account to manage UNSCRIPTED bookings, portfolio stories, service packages, customers, and settings.
        </p>

        {user && !isAdmin && (
          <div className="mt-6 p-4 bg-[#FF5A55]/10 border border-[#FF5A55] text-xs space-y-3">
            <div className="flex items-start gap-2 text-[#171717]">
              <ShieldAlert className="w-4 h-4 text-[#FF5A55] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unauthorized Account</p>
                <p className="mt-1 text-[#171717]/75">
                  Signed in as <span className="font-mono">{user.email}</span>, which does not have admin privileges.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOutAdmin()}
              className="px-3 py-1.5 bg-[#171717] text-white font-semibold text-xs cursor-pointer"
            >
              Sign Out & Switch Account
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={signingIn || !authReady}
          className="mt-8 w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-[#171717] text-white text-sm font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] disabled:opacity-50 transition-colors cursor-pointer"
        >
          {signingIn ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <span>Continue with Google</span>
          )}
        </button>
      </div>

      <div className="max-w-7xl w-full mx-auto text-center text-xs text-[#171717]/55 font-mono">
        UNSCRIPTED · Authorized Studio Admins Only
      </div>
    </div>
  );
}
