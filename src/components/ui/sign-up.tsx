'use client';
import { cn } from "@/lib/utils";
import React, {
  useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback,
  createContext, Children,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ArrowRight, Mail, User as UserIcon, Lock, Eye, EyeOff, X,
  AlertCircle, PartyPopper, Loader,
} from "lucide-react";
// IMPORTANT: this project ships `motion` (the new package name for framer-motion v11+).
// The /react subpath exposes the same API as framer-motion (motion, AnimatePresence,
// useInView, Variants, Transition).
import { AnimatePresence, motion, useInView, type Variants, type Transition } from "motion/react";

// --- CONFETTI ---
import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from "canvas-confetti";
import confetti from "canvas-confetti";

type Api = { fire: (options?: ConfettiOptions) => void };
export type ConfettiRef = Api | null;
const ConfettiContext = createContext<Api>({} as Api);

const Confetti = forwardRef<ConfettiRef, React.ComponentPropsWithRef<"canvas"> & { options?: ConfettiOptions; globalOptions?: ConfettiGlobalOptions; manualstart?: boolean }>((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = false, ...rest } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);
  const canvasRef = useCallback((node: HTMLCanvasElement) => {
    if (node !== null) {
      if (instanceRef.current) return;
      instanceRef.current = confetti.create(node, { ...globalOptions, resize: true });
    } else if (instanceRef.current) {
      instanceRef.current.reset();
      instanceRef.current = null;
    }
  }, [globalOptions]);
  const fire = useCallback((opts: ConfettiOptions = {}) => instanceRef.current?.({ ...options, ...opts }), [options]);
  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);
  useEffect(() => { if (!manualstart) fire(); }, [manualstart, fire]);
  return <canvas ref={canvasRef} {...rest} />;
});
Confetti.displayName = "Confetti";

// --- TEXT LOOP ANIMATION ---
type TextLoopProps = { children: React.ReactNode[]; className?: string; interval?: number; transition?: Transition; variants?: Variants; onIndexChange?: (index: number) => void; stopOnEnd?: boolean };
export function TextLoop({ children, className, interval = 2, transition = { duration: 0.3 }, variants, onIndexChange, stopOnEnd = false }: TextLoopProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = Children.toArray(children);
  useEffect(() => {
    const intervalMs = interval * 1000;
    const timer = setInterval(() => {
      setCurrentIndex(current => {
        if (stopOnEnd && current === items.length - 1) { clearInterval(timer); return current; }
        const next = (current + 1) % items.length;
        onIndexChange?.(next);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, stopOnEnd]);
  const motionVariants: Variants = {
    initial: { y: 20, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -20, opacity: 0 },
  };
  return (
    <div className={cn('relative inline-block whitespace-nowrap', className)}>
      <AnimatePresence mode='popLayout' initial={false}>
        <motion.div key={currentIndex} initial='initial' animate='animate' exit='exit' transition={transition} variants={variants || motionVariants}>
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- BLUR FADE ---
interface BlurFadeProps { children: React.ReactNode; className?: string; variant?: { hidden: { y: number }; visible: { y: number } }; duration?: number; delay?: number; yOffset?: number; inView?: boolean; inViewMargin?: string; blur?: string }
function BlurFade({ children, className, variant, duration = 0.4, delay = 0, yOffset = 6, inView = true, inViewMargin = "-50px", blur = "6px" }: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin as any });
  const isInView = !inView || inViewResult;
  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = (variant as Variants) || defaultVariants;
  return (
    <motion.div ref={ref} initial="hidden" animate={isInView ? "visible" : "hidden"} exit="hidden" variants={combinedVariants} transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

// --- GLASS BUTTON ---
const glassButtonVariants = cva("relative isolate all-unset cursor-pointer rounded-full transition-all", { variants: { size: { default: "text-base font-medium", sm: "text-sm font-medium", lg: "text-lg font-medium", icon: "h-10 w-10" } }, defaultVariants: { size: "default" } });
const glassButtonTextVariants = cva("glass-button-text relative block select-none tracking-tighter", { variants: { size: { default: "px-6 py-3.5", sm: "px-4 py-2", lg: "px-8 py-4", icon: "flex h-10 w-10 items-center justify-center" } }, defaultVariants: { size: "default" } });
export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof glassButtonVariants> { contentClassName?: string }
const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, onClick, ...props }, ref) => {
    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const button = e.currentTarget.querySelector('button');
      if (button && e.target !== button) button.click();
    };
    return (
      <div className={cn("glass-button-wrap cursor-pointer rounded-full relative", className)} onClick={handleWrapperClick}>
        <button className={cn("glass-button relative z-10", glassButtonVariants({ size }))} ref={ref} onClick={onClick} {...props}>
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
        </button>
        <div className="glass-button-shadow rounded-full pointer-events-none"></div>
      </div>
    );
  }
);
GlassButton.displayName = "GlassButton";

// --- GRADIENT BACKGROUND ---
const GradientBackground = () => (
  <>
    <style>{`@keyframes float1 { 0% { transform: translate(0, 0); } 50% { transform: translate(-10px, 10px); } 100% { transform: translate(0, 0); } } @keyframes float2 { 0% { transform: translate(0, 0); } 50% { transform: translate(10px, -10px); } 100% { transform: translate(0, 0); } }`}</style>
    <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="absolute top-0 left-0 w-full h-full">
      <defs>
        <linearGradient id="rev_grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.8 }} /><stop offset="100%" style={{ stopColor: 'var(--color-chart-3)', stopOpacity: 0.6 }} /></linearGradient>
        <linearGradient id="rev_grad2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{ stopColor: 'var(--color-chart-4)', stopOpacity: 0.9 }} /><stop offset="50%" style={{ stopColor: 'var(--color-secondary)', stopOpacity: 0.7 }} /><stop offset="100%" style={{ stopColor: 'var(--color-chart-1)', stopOpacity: 0.6 }} /></linearGradient>
        <radialGradient id="rev_grad3" cx="50%" cy="50%" r="50%"><stop offset="0%" style={{ stopColor: 'var(--color-destructive)', stopOpacity: 0.8 }} /><stop offset="100%" style={{ stopColor: 'var(--color-chart-5)', stopOpacity: 0.4 }} /></radialGradient>
        <filter id="rev_blur1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="35" /></filter>
        <filter id="rev_blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="25" /></filter>
        <filter id="rev_blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45" /></filter>
      </defs>
      <g style={{ animation: 'float1 20s ease-in-out infinite' }}>
        <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#rev_grad1)" filter="url(#rev_blur1)" transform="rotate(-30 200 500)" />
        <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#rev_grad2)" filter="url(#rev_blur2)" transform="rotate(15 650 225)" />
      </g>
      <g style={{ animation: 'float2 25s ease-in-out infinite' }}>
        <circle cx="650" cy="450" r="150" fill="url(#rev_grad3)" filter="url(#rev_blur3)" opacity="0.7" />
        <ellipse cx="50" cy="150" rx="180" ry="120" fill="var(--color-accent)" filter="url(#rev_blur2)" opacity="0.8" />
      </g>
    </svg>
  </>
);

// --- MAIN COMPONENT ---

type AuthMode = 'login' | 'signup';
type ModalStatus = 'closed' | 'loading' | 'error' | 'success';

interface AuthComponentProps {
  initialMode?: AuthMode;
  onLogin: (email: string, password: string) => Promise<string>;
  onRegister: (name: string, email: string, password: string) => Promise<string>;
}

export const AuthComponent = ({
  initialMode = 'login',
  onLogin,
  onRegister,
}: AuthComponentProps) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [modalStatus, setModalStatus] = useState<ModalStatus>('closed');
  const [modalMessage, setModalMessage] = useState('');
  const [persistentNotice, setPersistentNotice] = useState<string | null>(null);

  const confettiRef = useRef<ConfettiRef>(null);

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = mode === 'signup' ? confirmPassword.length >= 6 : true;

  // Submit is enabled once every visible field is valid.
  const canSubmit = mode === 'login'
    ? isEmailValid && isPasswordValid
    : isNameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid;

  const fireSideCanons = () => {
    const fire = confettiRef.current?.fire;
    if (!fire) return;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    fire({ ...defaults, particleCount: 50, origin: { x: 0, y: 1 }, angle: 60 });
    fire({ ...defaults, particleCount: 50, origin: { x: 1, y: 1 }, angle: 120 });
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setName(''); setPassword(''); setConfirmPassword('');
    setShowPassword(false); setShowConfirmPassword(false);
    // Keep email — convenient if switching mode after a failed attempt.
    if (newMode !== 'login') setPersistentNotice(null);
  };

  const doSubmit = async () => {
    if (modalStatus !== 'closed') return;
    if (!canSubmit) return;
    if (mode === 'signup' && password !== confirmPassword) {
      setModalMessage('Passwords do not match!');
      setModalStatus('error');
      return;
    }
    setModalStatus('loading');
    try {
      const result = mode === 'login'
        ? await onLogin(email.trim(), password)
        : await onRegister(name.trim(), email.trim(), password);

      if (result === 'success') {
        if (mode === 'signup') {
          fireSideCanons();
          setModalMessage('Account created! An administrator will approve your account shortly.');
          setModalStatus('success');
        } else {
          // Login success: parent unmounts us. Show a brief welcome first.
          setModalStatus('success');
          setModalMessage('Welcome back!');
        }
      } else {
        setModalMessage(result || 'Something went wrong.');
        setModalStatus('error');
      }
    } catch (err: any) {
      setModalMessage(err?.message || 'Network error.');
      setModalStatus('error');
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSubmit(); };

  const closeModal = () => {
    const wasSignupSuccess = mode === 'signup' && modalStatus === 'success';
    setModalStatus('closed');
    setModalMessage('');
    if (wasSignupSuccess) {
      setPersistentNotice('Registration successful! Please wait for an administrator to approve your account, then sign in.');
      switchMode('login');
    }
  };

  const heading = mode === 'login'
    ? { title: 'Welcome back', sub: 'Sign in to your CRM account.' }
    : { title: 'Get started', sub: 'Create your CRM account in seconds.' };

  const Modal = () => (
    <AnimatePresence>
      {modalStatus !== 'closed' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-card/90 border-4 border-border rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4 mx-2">
            {(modalStatus === 'error' || modalStatus === 'success') && (
              <button onClick={closeModal} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
            {modalStatus === 'error' && (
              <>
                <AlertCircle className="w-12 h-12 text-destructive" />
                <p className="text-lg font-medium text-foreground text-center">{modalMessage}</p>
                <GlassButton onClick={closeModal} size="sm" className="mt-4">Try Again</GlassButton>
              </>
            )}
            {modalStatus === 'loading' && (
              <div className="flex flex-col items-center gap-4">
                <Loader className="w-12 h-12 text-primary animate-spin" />
                <p className="text-lg font-medium text-foreground">{mode === 'signup' ? 'Creating your account…' : 'Signing you in…'}</p>
              </div>
            )}
            {modalStatus === 'success' && (
              <div className="flex flex-col items-center gap-4">
                <PartyPopper className="w-12 h-12 text-green-500" />
                <p className="text-lg font-medium text-foreground text-center">{modalMessage}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    // .dark scope so the dark-glass styles apply on this screen even when the
    // app is in light mode — the auth screen is always set against pure black.
    <div className="dark bg-black min-h-screen w-screen flex flex-col">
      {/* Glass styles are in globals.css now — this kept only the password reveal/autofill rules. */}
      <style>{`
        input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none !important; }
        input[type="password"]::-webkit-credentials-auto-fill-button, input[type="password"]::-webkit-strong-password-auto-fill-button { display: none !important; }
      `}</style>

      <Confetti ref={confettiRef} manualstart className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]" />
      <Modal />

      <div className={cn("flex w-full flex-1 h-full items-center justify-center bg-black", "relative overflow-hidden")}>
        {/*
          Contained video orb — floats centered against pure black. No glow,
          no drop shadow — just a clean rounded shape so the only visible
          element is the orb in the video itself.

          Sizing is calibrated to always contain the signup form (4 fields +
          button + heading + mode toggle ≈ 500px tall) with comfortable
          padding on standard breakpoints:
            - 720p (1280×720):  orb = 700×691 → ~95px padding around form
            - 1080p (1920×1080): orb = 700×820 → very generous padding
            - 4K (3840×2160):   orb caps at 720×860 (max cap)
          clamp() height ensures the orb is never shorter than 680px so the
          form is always fully enclosed — even on 720p displays where the
          previous min(78vh, ...) collapsed the orb to 562px.
        */}
        <div
          className="absolute z-0 inset-0 m-auto overflow-hidden rounded-[3rem] pointer-events-none"
          style={{
            width: 'min(86vw, 720px)',
            height: 'clamp(680px, 96vh, 860px)',
          }}
        >
          <video
            src="/login-bg.mp4"
            poster="/login-bg-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="w-full h-full object-cover"
          />
        </div>

        <fieldset disabled={modalStatus !== 'closed'} className="relative z-10 flex flex-col items-center gap-8 w-[360px] max-w-[92vw] mx-auto p-4">
          {/* Heading — SF Pro Display style (or system fallback). */}
          <div className="w-full flex flex-col items-center text-center gap-3">
            <BlurFade delay={0.05} className="w-full">
              <p className="text-ios-display text-4xl sm:text-5xl text-white">
                {heading.title}
              </p>
            </BlurFade>
            <BlurFade delay={0.2}>
              <p className="text-[15px] font-medium text-white/55 max-w-[280px]">{heading.sub}</p>
            </BlurFade>
            {persistentNotice && (
              <BlurFade delay={0.35} className="w-full">
                <p className="text-xs text-foreground/80 glass-chip glass-chip-tint-emerald rounded-2xl px-3 py-2 leading-relaxed">
                  {persistentNotice}
                </p>
              </BlurFade>
            )}
          </div>

          {/*
            Form — all fields rendered together so browser password managers
            and autofill work. autoComplete attributes per WHATWG spec:
              login  → current-password
              signup → new-password
            Each pill renders as a floating glass orb (same treatment as the
            original GlassButton): the .glass-input pill, plus a sibling
            .glass-input-shadow drop-shadow, plus a .glass-input-text-area
            sheen layer for the moving highlight.
          */}
          <form
            onSubmit={handleSubmit}
            method="post"
            className="w-full space-y-4"
            autoComplete="on"
          >
            {/* NAME (signup only) */}
            {mode === 'signup' && (
              <BlurFade delay={0.3} className="w-full">
                <div className="glass-input-wrap w-full">
                  <div className="glass-input py-1.5">
                    <span className="glass-input-text-area"></span>
                    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                      <UserIcon className="h-5 w-5 text-foreground/80" />
                    </div>
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="Full name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="relative z-10 w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none py-2 pr-3"
                    />
                  </div>
                  <div className="glass-input-shadow rounded-full pointer-events-none"></div>
                </div>
              </BlurFade>
            )}

            {/* EMAIL */}
            <BlurFade delay={0.35} className="w-full">
              <div className="glass-input-wrap w-full">
                <div className="glass-input py-1.5">
                  <span className="glass-input-text-area"></span>
                  <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                    <Mail className="h-5 w-5 text-foreground/80" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus={mode === 'login'}
                    className="relative z-10 w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none py-2 pr-3"
                  />
                </div>
                <div className="glass-input-shadow rounded-full pointer-events-none"></div>
              </div>
            </BlurFade>

            {/* PASSWORD */}
            <BlurFade delay={0.4} className="w-full">
              <div className="glass-input-wrap w-full">
                <div className="glass-input py-1.5">
                  <span className="glass-input-text-area"></span>
                  <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                    {password.length === 0 ? (
                      <Lock className="h-5 w-5 text-foreground/80" />
                    ) : (
                      <button
                        type="button"
                        aria-label="Toggle password visibility"
                        onClick={() => setShowPassword(p => !p)}
                        className="text-foreground/80 hover:text-foreground transition-colors p-2 rounded-full"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    )}
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="relative z-10 w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none py-2 pr-3"
                  />
                </div>
                <div className="glass-input-shadow rounded-full pointer-events-none"></div>
              </div>
            </BlurFade>

            {/* CONFIRM PASSWORD (signup only) */}
            {mode === 'signup' && (
              <BlurFade delay={0.45} className="w-full">
                <div className="glass-input-wrap w-full">
                  <div className="glass-input py-1.5">
                    <span className="glass-input-text-area"></span>
                    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                      {confirmPassword.length === 0 ? (
                        <Lock className="h-5 w-5 text-foreground/80" />
                      ) : (
                        <button
                          type="button"
                          aria-label="Toggle confirm password visibility"
                          onClick={() => setShowConfirmPassword(p => !p)}
                          className="text-foreground/80 hover:text-foreground transition-colors p-2 rounded-full"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      )}
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirm-password"
                      autoComplete="new-password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="relative z-10 w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none py-2 pr-3"
                    />
                  </div>
                  <div className="glass-input-shadow rounded-full pointer-events-none"></div>
                </div>
              </BlurFade>
            )}

            {/* Submit button — full-width glass pill */}
            <BlurFade delay={0.5} className="w-full pt-2">
              <GlassButton
                type="submit"
                size="default"
                aria-label={mode === 'login' ? 'Sign in' : 'Create account'}
                className="w-full"
                contentClassName={cn(
                  'flex items-center justify-center gap-2 font-semibold',
                  !canSubmit && 'opacity-50'
                )}
              >
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-4 h-4" />
              </GlassButton>
            </BlurFade>
          </form>

          {/* Mode toggle — sits below the form */}
          <p className="text-sm text-muted-foreground text-center">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-foreground hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </fieldset>
      </div>
    </div>
  );
};

export default AuthComponent;
