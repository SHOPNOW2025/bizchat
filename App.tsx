
import React, { useState, useEffect } from 'react';
import { AppView, User, BusinessProfile } from './types';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import PublicChatPage from './components/PublicChatPage';
import { sql, initTables } from './neon';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initTables();
        
        const handleHashChange = async () => {
          const hash = window.location.hash;
          if (hash.startsWith('#/chat/')) {
            const identifier = hash.split('/')[2];
            await loadPublicProfile(identifier);
            setView(AppView.PUBLIC_CHAT);
          } else if (hash === '#/dashboard' && user) {
            setView(AppView.DASHBOARD);
          } else if (hash === '#/login') {
            setView(AppView.LOGIN);
          } else if (hash === '#/signup') {
            setView(AppView.SIGNUP);
          } else {
            setView(AppView.LANDING);
          }
        };

        window.addEventListener('hashchange', handleHashChange);
        
        const savedUser = localStorage.getItem('bazchat_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
        
        await handleHashChange();
        setLoading(false);
      } catch (e) {
        console.error("Bootstrap failed", e);
        setError("فشل الاتصال بقاعدة البيانات. يرجى التحقق من اتصال الإنترنت أو إعدادات Neon.");
        setLoading(false);
      }
    };

    bootstrap();

    return () => {
      window.removeEventListener('hashchange', () => {});
    };
  }, [user]);

  const loadPublicProfile = async (identifier: string) => {
    try {
      // البحث باستخدام الـ ID أو الـ Slug
      const rows = await sql`SELECT * FROM profiles WHERE id = ${identifier} OR slug = ${identifier}`;
      if (rows.length > 0) {
        const p = rows[0];
        setPublicProfile({
          id: p.id,
          slug: p.slug || p.id,
          name: p.name,
          ownerName: p.owner_name,
          description: p.description,
          metaDescription: p.meta_description,
          phone: p.phone,
          countryCode: p.country_code,
          logo: p.logo,
          socialLinks: p.social_links || {},
          products: p.products || [],
          currency: p.currency,
          returnPolicy: p.return_policy,
          deliveryPolicy: p.delivery_policy
        });
      } else {
        setPublicProfile(null);
      }
    } catch (e) {
      console.error("Error loading profile from Neon", e);
    }
  };

  const handleAuthSuccess = (userData: User) => {
    setUser(userData);
    localStorage.setItem('bazchat_user', JSON.stringify(userData));
    window.location.hash = '#/dashboard';
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('bazchat_user');
    window.location.hash = '#/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" className="h-20 animate-pulse" alt="Logo" />
          <p className="text-[#0D2B4D] font-bold">جاري الاتصال بقاعدة البيانات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md">
          <div className="text-red-500 mb-4 text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">خطأ في الاتصال</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-[#00D1FF] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#00B8E0] transition-all"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (view) {
      case AppView.LANDING:
        return <LandingPage onNavigate={(v) => window.location.hash = v === AppView.LOGIN ? '#/login' : '#/signup'} />;
      case AppView.LOGIN:
        return <Auth type="login" onAuth={handleAuthSuccess} onToggle={() => window.location.hash = '#/signup'} />;
      case AppView.SIGNUP:
        return <Auth type="signup" onAuth={handleAuthSuccess} onToggle={() => window.location.hash = '#/login'} />;
      case AppView.DASHBOARD:
        return user ? <Dashboard user={user} setUser={setUser} onLogout={handleLogout} /> : <Auth type="login" onAuth={handleAuthSuccess} onToggle={() => window.location.hash = '#/signup'} />;
      case AppView.PUBLIC_CHAT:
        return publicProfile ? <PublicChatPage profile={publicProfile} /> : <div className="p-10 text-center">الصفحة غير موجودة</div>;
      default:
        return <LandingPage onNavigate={(v) => window.location.hash = v === AppView.LOGIN ? '#/login' : '#/signup'} />;
    }
  };

  return (
    <div className="min-h-screen">
      {renderView()}
    </div>
  );
};

export default App;
