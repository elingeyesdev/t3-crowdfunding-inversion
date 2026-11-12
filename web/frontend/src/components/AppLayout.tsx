import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

interface AppLayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
  className?: string;
}

export function AppLayout({ children, showFooter = true, className = '' }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F9FAFB] text-gray-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />
      <main className={`flex-1 ${className}`}>
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
