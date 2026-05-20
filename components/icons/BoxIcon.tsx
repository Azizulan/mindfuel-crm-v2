import React from 'react';

export const BoxIcon: React.FC<{className?: string}> = ({className = 'w-6 h-6'}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0v10l-8 4m0-14l-8 4m8 4v10l8-4m-8-4l-8-4-8 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10l8 4" />
    </svg>
);
