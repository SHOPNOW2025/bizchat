
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
        // محاولة تهيئة قاعدة البيانات
        await initTables();
        
        const handleHashChange = async () => {
          const hash = window.location.hash;
          if (hash.startsWith('#/chat/')) {
            const profileId = hash.split('/')[2];
            await loadPublicProfile(profileId);
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
      } catch (e: any) {
        console.error("Bootstrap failed:", e);
        
        let errorMsg = "فشل الاتصال بقاعدة البيانات. يرجى التحقق من إعدادات DATABASE_URL.";
        if (e.message?.includes('DATABASE_URL')) {
          errorMsg = "رابط قاعدة البيانات (DATABASE_URL) مفقود. يرجى إعداده في لوحة تحكم Vercel/Netlify.";
        }
        
        setError(errorMsg);
        setLoading(false);
      }
    };

    bootstrap();

    return () => {
      window.removeEventListener('hashchange', () => {});
    };
  }, [user]);

  const loadPublicProfile = async (id: string) => {
    try {
      const rows = await sql`SELECT * FROM profiles WHERE id = ${id}`;
      if (rows.length > 0) {
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
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <img src="https://i.ibb.co/XxVXdyhC/6.png" className="h-24 animate-pulse" alt="Logo" />
            <div className="absolute inset-0 bg-cyan-400/20 blur-xl rounded-full animate-ping"></div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[#0D2B4D] font-bold text-lg">بازشات - جاري التحميل</p>
            <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#00D1FF] w-1/2 animate-[loading_1.5s_ease-in-out_infinite]"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-red-50 max-w-md animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
             <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-black text-[#0D2B4D] mb-4">خطأ في الإعدادات</h2>
          <p className="text-gray-500 mb-8 leading-relaxed text-sm">{error}</p>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-[#0D2B4D] text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-navy-900/20 hover:bg-black transition-all"
            >
              إعادة المحاولة
            </button>
            <button 
              onClick={() => window.location.hash = '#/'} 
              className="w-full bg-gray-100 text-gray-600 px-8 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              الرجوع للرئيسية
            </button>
          </div>
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
        return publicProfile ? <PublicChatPage profile={publicProfile} /> : (
          <div className="min-h-screen flex items-center justify-center p-10 text-center">
             <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 max-w-sm">
                <h3 className="text-xl font-bold mb-2">عذراً، الصفحة غير موجودة</h3>
                <p className="text-gray-500 mb-6 text-sm">قد يكون الرابط غير صحيح أو تم إيقاف المتجر.</p>
                <button onClick={() => window.location.hash = '#/'} className="bg-[#00D1FF] text-white px-6 py-2 rounded-xl font-bold">العودة للرئيسية</button>
             </div>
          </div>
        );
      default:
        return <LandingPage onNavigate={(v) => window.location.hash = v === AppView.LOGIN ? '#/login' : '#/signup'} />;
    }
  };

  return (
    <div className="min-h-screen">
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
      {renderView()}
    </div>
  );
};

export default App;
