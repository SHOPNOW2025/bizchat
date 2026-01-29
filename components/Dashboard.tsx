
import React, { useState } from 'react';
import { User, DashboardTab, Product, BusinessProfile } from '../types';
import { sql } from '../neon';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Package, 
  Palette, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  ExternalLink,
  Copy,
  TrendingUp,
  Users,
  Save
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface DashboardProps {
  user: User;
  setUser: (user: User) => void;
  onLogout: () => void;
}

const STATS_DATA = [
  { name: 'السبت', views: 400, chats: 240 },
  { name: 'الأحد', views: 300, chats: 139 },
  { name: 'الاثنين', views: 200, chats: 980 },
  { name: 'الثلاثاء', views: 278, chats: 390 },
  { name: 'الأربعاء', views: 189, chats: 480 },
  { name: 'الخميس', views: 239, chats: 380 },
  { name: 'الجمعة', views: 349, chats: 430 },
];

const Dashboard: React.FC<DashboardProps> = ({ user, setUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.OVERVIEW);
  const [isSaving, setIsSaving] = useState(false);
  const profile = user.businessProfile;

  const saveToNeon = async (updatedProfile: BusinessProfile) => {
    setIsSaving(true);
    try {
      await sql`
        UPDATE profiles SET
          name = ${updatedProfile.name},
          owner_name = ${updatedProfile.ownerName},
          phone = ${updatedProfile.phone},
          logo = ${updatedProfile.logo},
          social_links = ${JSON.stringify(updatedProfile.socialLinks)},
          products = ${JSON.stringify(updatedProfile.products)},
          currency = ${updatedProfile.currency},
          return_policy = ${updatedProfile.returnPolicy},
          delivery_policy = ${updatedProfile.deliveryPolicy}
        WHERE id = ${profile.id}
      `;
      
      const updatedUser = { ...user, businessProfile: updatedProfile };
      setUser(updatedUser);
      localStorage.setItem('bazchat_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error("Error saving data to Neon", e);
    } finally {
      setIsSaving(false);
    }
  };

  const updateProfileLocal = (updates: Partial<BusinessProfile>) => {
    const updated = { ...profile, ...updates };
    saveToNeon(updated);
  };

  const addProduct = () => {
    const newProduct: Product = {
      id: Date.now().toString(),
      name: 'منتج جديد',
      price: 0,
      description: 'وصف المنتج هنا',
      image: 'https://picsum.photos/200/200'
    };
    updateProfileLocal({ products: [...profile.products, newProduct] });
  };

  const removeProduct = (id: string) => {
    updateProfileLocal({ products: profile.products.filter(p => p.id !== id) });
  };

  const copyChatLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/chat/${profile.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('تم نسخ رابط صفحة الدردشة بنجاح!');
    });
  };

  const openPreview = () => {
    window.open(`${window.location.origin}${window.location.pathname}#/chat/${profile.id}`, '_blank');
  };

  const renderContent = () => {
    switch (activeTab) {
      case DashboardTab.OVERVIEW:
        return (
          <div className="space-y-6 pb-20 lg:pb-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Users size={18} className="text-blue-500" />} label="زوار الصفحة" value="1,284" sub="+12%" />
              <StatCard icon={<MessageSquare size={18} className="text-green-500" />} label="محادثات" value="456" sub="+5%" />
              <StatCard icon={<Package size={18} className="text-orange-500" />} label="نقرات" value="892" sub="+18%" />
              <StatCard icon={<TrendingUp size={18} className="text-purple-500" />} label="تحويل" value="3.2%" sub="-0.5%" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-md font-bold mb-4">نشاط المحادثات</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={STATS_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 10}} />
                      <YAxis tick={{fontSize: 10}} />
                      <Tooltip />
                      <Bar dataKey="chats" fill="#00D1FF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-md font-bold mb-4">عدد الزيارات</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={STATS_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 10}} />
                      <YAxis tick={{fontSize: 10}} />
                      <Tooltip />
                      <Line type="monotone" dataKey="views" stroke="#0D2B4D" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );

      case DashboardTab.MESSAGES:
        return (
          <div className="bg-white rounded-3xl shadow-sm border min-h-[400px] flex flex-col items-center justify-center text-center p-8 pb-24 lg:pb-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد محادثات حالياً</h3>
            <p className="text-sm text-gray-500 max-w-xs">بمجرد أن يبدأ العملاء بمراسلتك عبر رابطك المخصص، ستظهر جميع الرسائل هنا.</p>
          </div>
        );

      case DashboardTab.CATALOG:
        return (
          <div className="space-y-6 pb-24 lg:pb-8">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">إدارة المنتجات</h3>
              <button onClick={addProduct} className="bg-[#00D1FF] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 text-sm shadow-lg">
                <Plus size={18} /> إضافة منتج
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.products.map(product => (
                <div key={product.id} className="bg-white rounded-3xl p-3 shadow-sm border border-gray-100 group relative">
                  <div className="aspect-square rounded-2xl overflow-hidden mb-3">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                  <input type="text" value={product.name} onBlur={(e) => {
                    const newProducts = profile.products.map(p => p.id === product.id ? {...p, name: e.target.value} : p);
                    updateProfileLocal({ products: newProducts });
                  }} className="w-full font-bold text-sm mb-1 outline-none focus:text-[#00D1FF] bg-transparent" />
                  <button onClick={() => removeProduct(product.id)} className="absolute top-5 left-5 p-2 bg-red-50 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return <div className="p-8 bg-white rounded-3xl shadow-sm border">قريباً...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <aside className="w-72 bg-[#0D2B4D] text-white fixed h-full hidden lg:flex flex-col p-8 z-40">
        <div className="flex items-center gap-3 mb-12 px-2">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Logo" className="h-10" />
          <span className="text-xl font-extrabold tracking-tight">بازشات</span>
        </div>
        <nav className="flex-1 space-y-3">
          <NavItem active={activeTab === DashboardTab.OVERVIEW} onClick={() => setActiveTab(DashboardTab.OVERVIEW)} icon={<LayoutDashboard size={20} />} label="نظرة عامة" />
          <NavItem active={activeTab === DashboardTab.MESSAGES} onClick={() => setActiveTab(DashboardTab.MESSAGES)} icon={<MessageSquare size={20} />} label="المحادثات" />
          <NavItem active={activeTab === DashboardTab.CATALOG} onClick={() => setActiveTab(DashboardTab.CATALOG)} icon={<Package size={20} />} label="المنتجات" />
          <NavItem active={activeTab === DashboardTab.CUSTOMIZE} onClick={() => setActiveTab(DashboardTab.CUSTOMIZE)} icon={<Palette size={20} />} label="تخصيص الصفحة" />
          <NavItem active={activeTab === DashboardTab.SETTINGS} onClick={() => setActiveTab(DashboardTab.SETTINGS)} icon={<Settings size={20} />} label="الإعدادات" />
        </nav>
        <button onClick={onLogout} className="mt-auto flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-2xl transition-colors font-bold">
          <LogOut size={20} /> تسجيل الخروج
        </button>
      </aside>

      <main className="flex-1 lg:mr-72 p-6 md:p-10 lg:p-12">
        <header className="hidden lg:flex flex-row items-center justify-between gap-4 mb-12">
          <div>
            <div className="flex items-center gap-2">
               <h2 className="text-4xl font-extrabold text-[#0D2B4D]">مرحباً، {profile.ownerName}</h2>
               {isSaving && <Save size={20} className="text-[#00D1FF] animate-spin" />}
            </div>
            <p className="text-gray-500 mt-2 font-medium">لوحة التحكم الخاصة بمتجر {profile.name}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={copyChatLink} className="bg-white border-2 border-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-sm">
              <Copy size={20} /> نسخ الرابط
            </button>
            <button onClick={openPreview} className="bg-[#00D1FF] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl">
              <ExternalLink size={20} /> معاينة
            </button>
          </div>
        </header>
        {renderContent()}
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center p-3 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <MobileNavItem active={activeTab === DashboardTab.OVERVIEW} onClick={() => setActiveTab(DashboardTab.OVERVIEW)} icon={<LayoutDashboard size={22} />} label="الرئيسية" />
        <MobileNavItem active={activeTab === DashboardTab.MESSAGES} onClick={() => setActiveTab(DashboardTab.MESSAGES)} icon={<MessageSquare size={22} />} label="الرسائل" />
        <MobileNavItem active={activeTab === DashboardTab.CATALOG} onClick={() => setActiveTab(DashboardTab.CATALOG)} icon={<Package size={22} />} label="المنتجات" />
        <MobileNavItem active={activeTab === DashboardTab.CUSTOMIZE} onClick={() => setActiveTab(DashboardTab.CUSTOMIZE)} icon={<Palette size={22} />} label="الهوية" />
        <MobileNavItem active={activeTab === DashboardTab.SETTINGS} onClick={() => setActiveTab(DashboardTab.SETTINGS)} icon={<Settings size={22} />} label="الإعدادات" />
      </nav>
    </div>
  );
};

const NavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all ${
      active ? 'bg-[#00D1FF] text-white shadow-xl shadow-cyan-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}>
    {icon} {label}
  </button>
);

const MobileNavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#00D1FF]' : 'text-gray-400'}`}>
    {icon} <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
);

const StatCard: React.FC<{icon: React.ReactNode, label: string, value: string, sub: string}> = ({ icon, label, value, sub }) => (
  <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
    <div className="flex items-center gap-2 mb-3">
      <div className="p-2 bg-gray-50 rounded-xl">{icon}</div>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{label}</span>
    </div>
    <div>
      <div className="text-xl font-extrabold text-[#0D2B4D] mb-0.5">{value}</div>
      <div className={`text-[10px] font-bold ${sub.includes('+') ? 'text-green-500' : 'text-red-500'}`}>{sub}</div>
    </div>
  </div>
);

export default Dashboard;
