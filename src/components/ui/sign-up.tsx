'use client';
import { cn } from "@/lib/utils";
import React, {
  useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback,
  createContext, Children,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ArrowRight, Mail, User as UserIcon, Lock, Eye, EyeOff, ArrowLeft, X,
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

const DefaultLogo = () => (
  <div className="bg-blue-600 text-white rounded-md p-1.5">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  </div>
);

// --- MAIN COMPONENT ---

type AuthMode = 'login' | 'signup';
type AuthStep = 'name' | 'email' | 'password' | 'confirmPassword';
type ModalStatus = 'closed' | 'loading' | 'error' | 'success';

interface AuthComponentProps {
  logo?: React.ReactNode;
  brandName?: string;
  initialMode?: AuthMode;
  onLogin: (email: string, password: string) => Promise<string>;
  onRegister: (name: string, email: string, password: string) => Promise<string>;
}

export const AuthComponent = ({
  logo = <DefaultLogo />,
  brandName = "MINDFUEL CRM",
  initialMode = 'login',
  onLogin,
  onRegister,
}: AuthComponentProps) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [authStep, setAuthStep] = useState<AuthStep>(initialMode === 'signup' ? 'name' : 'email');

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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = confirmPassword.length >= 6;

  const fireSideCanons = () => {
    const fire = confettiRef.current?.fire;
    if (!fire) return;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
    fire({ ...defaults, particleCount: 50, origin: { x: 0, y: 1 }, angle: 60 });
    fire({ ...defaults, particleCount: 50, origin: { x: 1, y: 1 }, angle: 120 });
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setAuthStep(newMode === 'signup' ? 'name' : 'email');
    setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setShowPassword(false); setShowConfirmPassword(false);
    if (newMode !== 'login') setPersistentNotice(null);
  };

  const goNextStep = () => {
    if (authStep === 'name' && isNameValid) setAuthStep('email');
    else if (authStep === 'email' && isEmailValid) setAuthStep('password');
    else if (authStep === 'password' && isPasswordValid) {
      if (mode === 'signup') setAuthStep('confirmPassword');
      else doSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); goNextStep(); }
  };

  const handleGoBack = () => {
    if (authStep === 'confirmPassword') { setAuthStep('password'); setConfirmPassword(''); }
    else if (authStep === 'password') setAuthStep('email');
    else if (authStep === 'email' && mode === 'signup') setAuthStep('name');
  };

  const doSubmit = async () => {
    if (modalStatus !== 'closed') return;
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setModalMessage('Passwords do not match!');
        setModalStatus('error');
        return;
      }
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
          // Login success: the parent unmounts us. Show a brief success first.
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

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') doSubmit();
    else if (authStep === 'confirmPassword') doSubmit();
  };

  const closeModal = () => {
    const wasSignupSuccess = mode === 'signup' && modalStatus === 'success';
    setModalStatus('closed');
    setModalMessage('');
    if (wasSignupSuccess) {
      setPersistentNotice('Registration successful! Please wait for an administrator to approve your account, then sign in.');
      switchMode('login');
    }
  };

  useEffect(() => {
    if (authStep === 'name') setTimeout(() => nameInputRef.current?.focus(), 400);
    else if (authStep === 'password') setTimeout(() => passwordInputRef.current?.focus(), 400);
    else if (authStep === 'confirmPassword') setTimeout(() => confirmPasswordInputRef.current?.focus(), 400);
  }, [authStep]);

  // ── Heading per (mode, step) ──
  const heading = (() => {
    if (mode === 'signup') {
      if (authStep === 'name') return { title: "Let's get started", sub: 'First, tell us your name.' };
      if (authStep === 'email') return { title: 'Your email', sub: 'Use a work email if possible.' };
      if (authStep === 'password') return { title: 'Create your password', sub: 'At least 6 characters.' };
      return { title: 'One last step', sub: 'Confirm your password to continue.' };
    }
    if (authStep === 'email') return { title: 'Welcome back', sub: 'Sign in to your CRM account.' };
    return { title: 'Enter your password', sub: 'We never store it in plain text.' };
  })();

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
    <div className="bg-background min-h-screen w-screen flex flex-col">
      <style>{`
        input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none !important; }
        input[type="password"]::-webkit-credentials-auto-fill-button, input[type="password"]::-webkit-strong-password-auto-fill-button { display: none !important; }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active { -webkit-box-shadow: 0 0 0 30px transparent inset !important; -webkit-text-fill-color: var(--foreground) !important; background-color: transparent !important; background-clip: content-box !important; transition: background-color 5000s ease-in-out 0s !important; color: var(--foreground) !important; caret-color: var(--foreground) !important; }
        @property --angle-1 { syntax: "<angle>"; inherits: false; initial-value: -75deg; }
        @property --angle-2 { syntax: "<angle>"; inherits: false; initial-value: -45deg; }
        .glass-button-wrap { --anim-time: 400ms; --anim-ease: cubic-bezier(0.25, 1, 0.5, 1); --border-width: clamp(1px, 0.0625em, 4px); position: relative; z-index: 2; transform-style: preserve-3d; transition: transform var(--anim-time) var(--anim-ease); }
        .glass-button-wrap:has(.glass-button:active) { transform: rotateX(25deg); }
        .glass-button-shadow { --shadow-cutoff-fix: 2em; position: absolute; width: calc(100% + var(--shadow-cutoff-fix)); height: calc(100% + var(--shadow-cutoff-fix)); top: calc(0% - var(--shadow-cutoff-fix) / 2); left: calc(0% - var(--shadow-cutoff-fix) / 2); filter: blur(clamp(2px, 0.125em, 12px)); transition: filter var(--anim-time) var(--anim-ease); pointer-events: none; z-index: 0; }
        .glass-button-shadow::after { content: ""; position: absolute; inset: 0; border-radius: 9999px; background: linear-gradient(180deg, oklch(from var(--foreground) l c h / 20%), oklch(from var(--foreground) l c h / 10%)); width: calc(100% - var(--shadow-cutoff-fix) - 0.25em); height: calc(100% - var(--shadow-cutoff-fix) - 0.25em); top: calc(var(--shadow-cutoff-fix) - 0.5em); left: calc(var(--shadow-cutoff-fix) - 0.875em); padding: 0.125em; box-sizing: border-box; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease); opacity: 1; }
        .glass-button { -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all var(--anim-time) var(--anim-ease); background: linear-gradient(-75deg, oklch(from var(--background) l c h / 5%), oklch(from var(--background) l c h / 20%), oklch(from var(--background) l c h / 5%)); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.25em 0.125em -0.125em oklch(from var(--foreground) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background) l c h / 20%), 0 0 0 0 oklch(from var(--background) l c h); }
        .glass-button:hover { transform: scale(0.975); backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background) l c h / 50%), 0 0 0 0 oklch(from var(--background) l c h); }
        .glass-button-text { color: oklch(from var(--foreground) l c h / 90%); text-shadow: 0em 0.25em 0.05em oklch(from var(--foreground) l c h / 10%); transition: all var(--anim-time) var(--anim-ease); }
        .glass-button:hover .glass-button-text { text-shadow: 0.025em 0.025em 0.025em oklch(from var(--foreground) l c h / 12%); }
        .glass-button-text::after { content: ""; display: block; position: absolute; width: calc(100% - var(--border-width)); height: calc(100% - var(--border-width)); top: calc(0% + var(--border-width) / 2); left: calc(0% + var(--border-width) / 2); box-sizing: border-box; border-radius: 9999px; overflow: clip; background: linear-gradient(var(--angle-2), transparent 0%, oklch(from var(--background) l c h / 50%) 40% 50%, transparent 55%); z-index: 3; mix-blend-mode: screen; pointer-events: none; background-size: 200% 200%; background-position: 0% 50%; transition: background-position calc(var(--anim-time) * 1.25) var(--anim-ease), --angle-2 calc(var(--anim-time) * 1.25) var(--anim-ease); }
        .glass-button:hover .glass-button-text::after { background-position: 25% 50%; }
        .glass-button:active .glass-button-text::after { background-position: 50% 15%; --angle-2: -15deg; }
        .glass-button::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + var(--border-width)); height: calc(100% + var(--border-width)); top: calc(0% - var(--border-width) / 2); left: calc(0% - var(--border-width) / 2); padding: var(--border-width); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, oklch(from var(--foreground) l c h / 50%) 0%, transparent 5% 40%, oklch(from var(--foreground) l c h / 50%) 50%, transparent 60% 95%, oklch(from var(--foreground) l c h / 50%) 100%), linear-gradient(180deg, oklch(from var(--background) l c h / 50%), oklch(from var(--background) l c h / 50%)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all var(--anim-time) var(--anim-ease), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(var(--border-width) / 2) oklch(from var(--background) l c h / 50%); pointer-events: none; }
        .glass-button:hover::after { --angle-1: -125deg; }
        .glass-button:active::after { --angle-1: -75deg; }
        .glass-input-wrap { position: relative; z-index: 2; transform-style: preserve-3d; border-radius: 9999px; }
        .glass-input { display: flex; position: relative; width: 100%; align-items: center; gap: 0.5rem; border-radius: 9999px; padding: 0.25rem; -webkit-tap-highlight-color: transparent; backdrop-filter: blur(clamp(1px, 0.125em, 4px)); transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1); background: linear-gradient(-75deg, oklch(from var(--background) l c h / 5%), oklch(from var(--background) l c h / 20%), oklch(from var(--background) l c h / 5%)); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.25em 0.125em -0.125em oklch(from var(--foreground) l c h / 20%), 0 0 0.1em 0.25em inset oklch(from var(--background) l c h / 20%), 0 0 0 0 oklch(from var(--background) l c h); }
        .glass-input-wrap:focus-within .glass-input { backdrop-filter: blur(0.01em); box-shadow: inset 0 0.125em 0.125em oklch(from var(--foreground) l c h / 5%), inset 0 -0.125em 0.125em oklch(from var(--background) l c h / 50%), 0 0.15em 0.05em -0.1em oklch(from var(--foreground) l c h / 25%), 0 0 0.05em 0.1em inset oklch(from var(--background) l c h / 50%), 0 0 0 0 oklch(from var(--background) l c h); }
        .glass-input::after { content: ""; position: absolute; z-index: 1; inset: 0; border-radius: 9999px; width: calc(100% + clamp(1px, 0.0625em, 4px)); height: calc(100% + clamp(1px, 0.0625em, 4px)); top: calc(0% - clamp(1px, 0.0625em, 4px) / 2); left: calc(0% - clamp(1px, 0.0625em, 4px) / 2); padding: clamp(1px, 0.0625em, 4px); box-sizing: border-box; background: conic-gradient(from var(--angle-1) at 50% 50%, oklch(from var(--foreground) l c h / 50%) 0%, transparent 5% 40%, oklch(from var(--foreground) l c h / 50%) 50%, transparent 60% 95%, oklch(from var(--foreground) l c h / 50%) 100%), linear-gradient(180deg, oklch(from var(--background) l c h / 50%), oklch(from var(--background) l c h / 50%)); mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1), --angle-1 500ms ease; box-shadow: inset 0 0 0 calc(clamp(1px, 0.0625em, 4px) / 2) oklch(from var(--background) l c h / 50%); pointer-events: none; }
        .glass-input-wrap:focus-within .glass-input::after { --angle-1: -125deg; }
      `}</style>

      <Confetti ref={confettiRef} manualstart className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]" />
      <Modal />

      {/* Brand chip */}
      <div className={cn("fixed top-4 left-4 z-20 flex items-center gap-2", "md:left-1/2 md:-translate-x-1/2")}>
        {logo}
        <h1 className="text-base font-bold text-foreground">{brandName}</h1>
      </div>

      <div className={cn("flex w-full flex-1 h-full items-center justify-center bg-card", "relative overflow-hidden")}>
        <div className="absolute inset-0 z-0"><GradientBackground /></div>

        <fieldset disabled={modalStatus !== 'closed'} className="relative z-10 flex flex-col items-center gap-8 w-[320px] mx-auto p-4">
          {/* Heading */}
          <div className="w-full flex flex-col items-center text-center gap-3">
            <BlurFade delay={0.1} className="w-full">
              <p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-foreground whitespace-nowrap">
                {heading.title}
              </p>
            </BlurFade>
            <BlurFade delay={0.25}>
              <p className="text-sm font-medium text-muted-foreground">{heading.sub}</p>
            </BlurFade>
            {persistentNotice && (
              <BlurFade delay={0.4} className="w-full">
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 leading-relaxed">
                  {persistentNotice}
                </p>
              </BlurFade>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleFinalSubmit} className="w-[320px] space-y-6">
            {/* NAME field (signup only) */}
            <AnimatePresence>
              {mode === 'signup' && authStep === 'name' && (
                <BlurFade key="name-field" className="w-full">
                  <div className="glass-input-wrap w-full"><div className="glass-input">
                    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                      <UserIcon className="h-5 w-5 text-foreground/80" />
                    </div>
                    <input
                      ref={nameInputRef}
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                    />
                    <div className={cn("relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isNameValid ? "w-10 pr-1" : "w-0")}>
                      <GlassButton type="button" onClick={goNextStep} size="icon" aria-label="Next" contentClassName="text-foreground/80 hover:text-foreground">
                        <ArrowRight className="w-5 h-5" />
                      </GlassButton>
                    </div>
                  </div></div>
                </BlurFade>
              )}
            </AnimatePresence>

            {/* EMAIL field */}
            <AnimatePresence>
              {authStep === 'email' && (
                <BlurFade key="email-field" className="w-full">
                  <div className="relative w-full">
                    <div className="glass-input-wrap w-full"><div className="glass-input">
                      <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                        <Mail className="h-5 w-5 text-foreground/80" />
                      </div>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                      />
                      <div className={cn("relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isEmailValid ? "w-10 pr-1" : "w-0")}>
                        <GlassButton type="button" onClick={goNextStep} size="icon" aria-label="Continue" contentClassName="text-foreground/80 hover:text-foreground">
                          <ArrowRight className="w-5 h-5" />
                        </GlassButton>
                      </div>
                    </div></div>
                  </div>
                </BlurFade>
              )}
            </AnimatePresence>

            {/* PASSWORD field */}
            <AnimatePresence>
              {authStep === 'password' && (
                <BlurFade key="password-field" className="w-full">
                  <div className="glass-input-wrap w-full"><div className="glass-input">
                    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                      {isPasswordValid ? (
                        <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword(!showPassword)} className="text-foreground/80 hover:text-foreground transition-colors p-2 rounded-full">
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      ) : <Lock className="h-5 w-5 text-foreground/80" />}
                    </div>
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                    />
                    <div className={cn("relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isPasswordValid ? "w-10 pr-1" : "w-0")}>
                      <GlassButton type="button" onClick={goNextStep} size="icon" aria-label={mode === 'signup' ? 'Next' : 'Sign in'} contentClassName="text-foreground/80 hover:text-foreground">
                        <ArrowRight className="w-5 h-5" />
                      </GlassButton>
                    </div>
                  </div></div>
                  <BlurFade inView delay={0.2}>
                    <button type="button" onClick={handleGoBack} className="mt-4 flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
                      <ArrowLeft className="w-4 h-4" /> Go back
                    </button>
                  </BlurFade>
                </BlurFade>
              )}
            </AnimatePresence>

            {/* CONFIRM PASSWORD field (signup only) */}
            <AnimatePresence>
              {mode === 'signup' && authStep === 'confirmPassword' && (
                <BlurFade key="confirm-password-field" className="w-full">
                  <div className="glass-input-wrap w-full"><div className="glass-input">
                    <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                      {isConfirmPasswordValid ? (
                        <button type="button" aria-label="Toggle confirm password visibility" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-foreground/80 hover:text-foreground transition-colors p-2 rounded-full">
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      ) : <Lock className="h-5 w-5 text-foreground/80" />}
                    </div>
                    <input
                      ref={confirmPasswordInputRef}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none"
                    />
                    <div className={cn("relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out", isConfirmPasswordValid ? "w-10 pr-1" : "w-0")}>
                      <GlassButton type="submit" size="icon" aria-label="Create account" contentClassName="text-foreground/80 hover:text-foreground">
                        <ArrowRight className="w-5 h-5" />
                      </GlassButton>
                    </div>
                  </div></div>
                  <BlurFade inView delay={0.2}>
                    <button type="button" onClick={handleGoBack} className="mt-4 flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
                      <ArrowLeft className="w-4 h-4" /> Go back
                    </button>
                  </BlurFade>
                </BlurFade>
              )}
            </AnimatePresence>
          </form>

          {/* Mode toggle */}
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
