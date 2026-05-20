
import React from 'react';

export const ClipboardIcon: React.FC<{className?: string}> = ({className = 'w-5 h-5'}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 2.25a2.25 2.25 0 01-2.25 2.25h-3a2.25 2.25 0 01-2.25-2.25m7.332 0c.055.194.084.4.084.612v1.512a2.25 2.25 0 01-2.25 2.25h-3a2.25 2.25 0 01-2.25-2.25V6.5c0-.212.03-.418.084-.612m7.332 0c.046-.171.07-.348.07-.53a2.25 2.25 0 00-2.25-2.25h-3a2.25 2.25 0 00-2.25 2.25c0 .182.024.359.07.53m7.332 0a2.25 2.25 0 012.25 2.25v13.5a2.25 2.25 0 01-2.25 2.25h-10.5a2.25 2.25 0 01-2.25-2.25V5.25a2.25 2.25 0 012.25-2.25h10.5a2.25 2.25 0 012.25 2.25z" />
    </svg>
);
