
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

  const loadPublicProfile = async (id: string) => {
    try {
      const rows = await sql`SELECT * FROM profiles WHERE id = ${id}`;
      if (rows && rows.length > 0) {
        const p = rows[0];
        setPublicProfile({
          id: p.id,
          name: p.name,
          ownerName: p.owner_name,
          phone: p.phone,
          countryCode: p.country_code,
          logo: p.logo,
          socialLinks: p.social_links || {},
          products: p.products || [],
          currency: p.currency,
          returnPolicy: p.return_policy,
          deliveryPolicy: p.delivery_policy
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Profile load error:", e);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const startApp = async () => {
      try {
        setLoading(true);
        
        // محاولة تهيئة قاعدة البيانات - إذا فشلت نتجاهل الخطأ إذا كانت الجداول موجودة بالفعل
        try {
          await initTables();
        } catch (dbErr) {
          console.warn("DB init notice:", dbErr);
        }

        const savedUser = localStorage.getItem('bazchat_user');
        if (savedUser && isMounted) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            localStorage.removeItem('bazchat_user');
          }
        }

        const handleRoute = async () => {
          if (!isMounted) return;
          const hash = window.location.hash;
          if (hash.startsWith('#/chat/')) {
            const profileId = hash.split('/')[2];
            const found = await loadPublicProfile(profileId);
            if (found && isMounted) setView(AppView.PUBLIC_CHAT);
            else if (isMounted) setView(AppView.LANDING);
          } else if (hash === '#/dashboard') {
            setView(AppView.DASHBOARD);
          } else if (hash === '#/login') {
            setView(AppView.LOGIN);
          } else if (hash === '#/signup') {
            setView(AppView.SIGNUP);
          } else {
            setView(AppView.LANDING);
          }
        };

        window.addEventListener('hashchange', handleRoute);
        await handleRoute();

        if (isMounted) setLoading(false);
      } catch (e) {
        console.error("Initialization error:", e);
        if (isMounted) {
          setError("فشل في تحميل التطبيق. يرجى التحقق من اتصال الإنترنت.");
          setLoading(false);
        }
      }
    };

    startApp();

    return () => {
      isMounted = false;
      window.removeEventListener('hashchange', () => {});
    };
  }, []);

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
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white font-tajawal">
        <div className="relative">
           <img src="https://i.ibb.co/XxVXdyhC/6.png" className="h-20 animate-bounce mb-4" alt="Logo" />
           <div className="absolute -bottom-2 left-0 right-0 h-1 bg-cyan-100 rounded-full overflow-hidden">
             <div className="h-full bg-cyan-500 w-1/2 animate-[loading_1s_infinite]"></div>
           </div>
        </div>
        <p className="text-[#0D2B4D] font-bold mt-4">جاري تحميل بازشات...</p>
        <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-6 text-center font-tajawal">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm border border-red-50">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-black text-[#0D2B4D] mb-2">عذراً، حدث خطأ</h2>
          <p className="text-gray-500 mb-6 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-[#0D2B4D] text-white px-8 py-3 rounded-xl font-bold shadow-lg">إعادة المحاولة</button>
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
        return publicProfile ? <PublicChatPage profile={publicProfile} /> : <LandingPage onNavigate={() => {}} />;
      default:
        return <LandingPage onNavigate={() => {}} />;
    }
  };

  return <div className="min-h-screen">{renderView()}</div>;
};

export default App;
