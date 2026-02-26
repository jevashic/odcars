import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export default function PublicLayout({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className={`flex-1 ${className}`}>{children}</main>
      <Footer />
    </div>
  );
}
