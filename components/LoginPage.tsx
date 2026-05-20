import React, { useState } from 'react';
import { MailIcon, LockIcon } from './icons/AuthIcons';
import { UserCircleIcon as UserPlusIcon } from './icons/UserCircleIcon';

type AuthMode = 'login' | 'register';

interface LoginPageProps {
    onLogin: (email: string, password: string) => Promise<string>;
    onRegister: (name: string, email: string, password: string) => Promise<string>;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onRegister }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);
    
    // Login state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register state
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
        if (result !== 'success') {
            setError(result);
        }
        setIsLoading(false);
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (regPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
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
        // Don't clear success message when switching back to login after registration
        if(newMode !== 'login') setSuccessMessage('');
        setLoginEmail('');
        setLoginPassword('');
        setRegName('');
        setRegEmail('');
        setRegPassword('');
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-center space-x-3 mb-6">
                    <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-7 h-7">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800">
                        CRM Assistant
                    </h1>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
                    {mode === 'login' ? (
                        <>
                            <h2 className="text-2xl font-semibold text-center text-slate-700 mb-2">
                                Welcome Back!
                            </h2>
                            <p className="text-center text-slate-500 mb-6">
                                Sign in to continue.
                            </p>
                            <form onSubmit={handleLoginSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="login-email" className="sr-only">Email</label>
                                    <div className="relative"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><MailIcon /></div>
                                        <input type="email" id="login-email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" placeholder="Email Address"/>
                                    </div>
                                </div>
                                <div>
                                     <label htmlFor="login-password-2" className="sr-only">Password</label>
                                    <div className="relative"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><LockIcon /></div>
                                        <input type="password" id="login-password-2" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" placeholder="Password"/>
                                    </div>
                                </div>
                                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                                {successMessage && <p className="text-sm text-green-600 text-center bg-green-50 p-3 rounded-md">{successMessage}</p>}
                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-slate-400">
                                    {isLoading ? 'Signing In...' : 'Sign In'}
                                </button>
                            </form>
                            <p className="text-sm text-center text-slate-500 mt-6">
                                Don't have an account?{' '}
                                <button onClick={() => switchMode('register')} className="font-semibold text-blue-600 hover:underline">Sign Up</button>
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-semibold text-center text-slate-700 mb-2">
                                Create Account
                            </h2>
                            <p className="text-center text-slate-500 mb-6">
                                Get started as a Sales Executive.
                            </p>
                             <form onSubmit={handleRegisterSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="reg-name" className="sr-only">Full Name</label>
                                    <div className="relative"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><UserPlusIcon /></div>
                                        <input type="text" id="reg-name" value={regName} onChange={e => setRegName(e.target.value)} required className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" placeholder="Full Name"/>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="reg-email" className="sr-only">Email</label>
                                    <div className="relative"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><MailIcon /></div>
                                        <input type="email" id="reg-email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" placeholder="Email Address"/>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="reg-password-2" className="sr-only">Password</label>
                                    <div className="relative"><div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><LockIcon /></div>
                                        <input type="password" id="reg-password-2" value={regPassword} onChange={e => setRegPassword(e.target.value)} required className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" placeholder="Password"/>
                                    </div>
                                </div>
                                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-slate-400">
                                    {isLoading ? 'Creating...' : 'Create Account'}
                                </button>
                            </form>
                            <p className="text-sm text-center text-slate-500 mt-6">
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