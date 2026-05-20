import React, { useState } from 'react';

type AuthMode = 'login' | 'register';

interface LoginPageProps {
    onLogin: (email: string, password: string) => Promise<string>;
    onRegister: (name: string, email: string, password: string) => Promise<string>;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onRegister }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);

    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');

    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        const result = await onLogin(loginEmail, loginPassword);
        if (result !== 'success') setError(result);
        setIsLoading(false);
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (regPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
        setIsLoading(true);
        const result = await onRegister(regName, regEmail, regPassword);
        if (result === 'success') {
            setSuccessMessage('Registration successful! Please wait for an administrator to approve your account.');
            switchMode('login');
        } else {
            setError(result);
        }
        setIsLoading(false);
    };

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setError('');
        if (newMode !== 'login') setSuccessMessage('');
        setLoginEmail(''); setLoginPassword('');
        setRegName(''); setRegEmail(''); setRegPassword('');
    };

    const inputClass = "w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm";

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">

                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="white" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-none">CRM Assistant</h1>
                        <p className="text-xs text-gray-400 mt-0.5">Tele-Sales Platform</p>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    {mode === 'login' ? (
                        <>
                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Welcome back</h2>
                                <p className="text-sm text-gray-500 mt-1">Sign in to your account to continue.</p>
                            </div>

                            <form onSubmit={handleLoginSubmit} className="space-y-4">
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                        </svg>
                                    </div>
                                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className={inputClass} placeholder="Email address" />
                                </div>

                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                        </svg>
                                    </div>
                                    <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className={inputClass} placeholder="Password" />
                                </div>

                                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
                                {successMessage && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{successMessage}</p>}

                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all disabled:opacity-60 shadow-sm text-sm mt-2">
                                    {isLoading ? 'Signing in…' : 'Sign In'}
                                </button>
                            </form>

                            <p className="text-sm text-center text-gray-500 mt-6">
                                Don't have an account?{' '}
                                <button onClick={() => switchMode('register')} className="font-semibold text-blue-600 hover:underline">Sign Up</button>
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Create account</h2>
                                <p className="text-sm text-gray-500 mt-1">Get started as a Sales Executive.</p>
                            </div>

                            <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                        </svg>
                                    </div>
                                    <input type="text" value={regName} onChange={e => setRegName(e.target.value)} required className={inputClass} placeholder="Full name" />
                                </div>

                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                        </svg>
                                    </div>
                                    <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required className={inputClass} placeholder="Email address" />
                                </div>

                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                        </svg>
                                    </div>
                                    <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required className={inputClass} placeholder="Password (min. 6 characters)" />
                                </div>

                                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all disabled:opacity-60 shadow-sm text-sm mt-2">
                                    {isLoading ? 'Creating…' : 'Create Account'}
                                </button>
                            </form>

                            <p className="text-sm text-center text-gray-500 mt-6">
                                Already have an account?{' '}
                                <button onClick={() => switchMode('login')} className="font-semibold text-blue-600 hover:underline">Sign In</button>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
