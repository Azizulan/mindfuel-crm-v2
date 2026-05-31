import React from 'react';
import AuthComponent from './ui/sign-up';

interface LoginPageProps {
    onLogin: (email: string, password: string) => Promise<string>;
    onRegister: (name: string, email: string, password: string) => Promise<string>;
}

// Thin adapter: keeps the existing prop contract from App.tsx while delegating
// the actual UI to the shadcn-style AuthComponent in components/ui/sign-up.
const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onRegister }) => (
    <AuthComponent
        onLogin={onLogin}
        onRegister={onRegister}
    />
);

export default LoginPage;
