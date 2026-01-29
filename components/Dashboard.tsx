
import React, { useState, useEffect } from 'react';
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
  CheckCircle,
  Clock,
  Menu,
  X as CloseIcon,
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
      alert("فشل في حفظ البيانات في PostgreSQL");
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
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('حدث خطأ أثناء النسخ، يرجى المحاولة يدوياً: ' + url);
    });
  };

  const openPreview = () => {
    window.open(`${window.location.origin}${window.location.pathname}#/chat/${profile.id}`, '_blank');
  };

  const renderContent = () => {
    switch (activeTab) {
      case DashboardTab.OVERVIEW:
        return (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20 lg:pb-0">
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
                      <XAxis dataKey="name" tick={{fontSize: 12}} />
                      <YAxis tick={{fontSize: 12}} />
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
                      <XAxis dataKey="name" tick={{fontSize: 12}} />
                      <YAxis tick={{fontSize: 12}} />
                      <Tooltip />
                      <Line type="monotone" dataKey="views" stroke="#0D2B4D" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-md font-bold mb-4">آخر النشاطات</h3>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <MessageSquare size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-xs">عميل جديد بدأ محادثة</p>
                        <p className="text-[10px] text-gray-500">منذ 10 دقائق</p>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-[#00D1FF]">رد الآن</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case DashboardTab.MESSAGES:
        return (
          <div className="bg-white rounded-3xl shadow-sm border min-h-[400px] flex flex-col items-center justify-center text-center p-8 animate-in slide-in-from-bottom-4 pb-24 lg:pb-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">لا يوجد محادثات حالياً</h3>
            <p className="text-sm text-gray-500 max-w-xs">بمجرد أن يبدأ العملاء بمراسلتك عبر رابطك المخصص، ستظهر جميع الرسائل هنا.</p>
          </div>
        );

      case DashboardTab.CATALOG:
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 pb-24 lg:pb-8">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">إدارة المنتجات</h3>
              <button 
                onClick={addProduct}
                disabled={isSaving}
                className="bg-[#00D1FF] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-[#00B8E0] transition-all text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                <Plus size={18} />
                إضافة منتج
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.products.map(product => (
                <div key={product.id} className="bg-white rounded-3xl p-3 shadow-sm border border-gray-100 group relative">
                  <div className="aspect-square rounded-2xl overflow-hidden mb-3">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                  <input 
                    type="text" 
                    value={product.name}
                    onBlur={(e) => {
                      const newProducts = profile.products.map(p => p.id === product.id ? {...p, name: e.target.value} : p);
                      updateProfileLocal({ products: newProducts });
                    }}
                    className="w-full font-bold text-sm mb-1 outline-none focus:text-[#00D1FF] bg-transparent"
                  />
                  <div className="flex items-center gap-1 mb-2">
                    <input 
                      type="number" 
                      value={product.price}
                      onBlur={(e) => {
                        const newProducts = profile.products.map(p => p.id === product.id ? {...p, price: Number(e.target.value)} : p);
                        updateProfileLocal({ products: newProducts });
                      }}
                      className="w-16 font-bold text-[#00D1FF] outline-none text-sm bg-transparent"
                    />
                    <span className="text-[10px] text-gray-500">{profile.currency}</span>
                  </div>
                  <textarea 
                    defaultValue={product.description}
                    onBlur={(e) => {
                      const newProducts = profile.products.map(p => p.id === product.id ? {...p, description: e.target.value} : p);
                      updateProfileLocal({ products: newProducts });
                    }}
                    className="w-full text-xs text-gray-500 bg-transparent resize-none outline-none"
                    rows={2}
                  />
                  <button 
                    onClick={() => removeProduct(product.id)}
                    className="absolute top-5 left-5 p-2 bg-red-50 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case DashboardTab.CUSTOMIZE:
        return (
          <div className="max-w-3xl space-y-6 animate-in slide-in-from-bottom-4 pb-24 lg:pb-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold mb-6">تخصيص الهوية</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">شعار المتجر</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#00D1FF]/20 p-1">
                      <img src={profile.logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
                    </div>
                    <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors">تغيير الصورة</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">اسم المتجر</label>
                  <input 
                    type="text" 
                    defaultValue={profile.name}
                    onBlur={(e) => updateProfileLocal({ name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00D1FF] outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">رقم الهاتف للاتصال</label>
                  <input 
                    type="tel" 
                    defaultValue={profile.phone}
                    onBlur={(e) => updateProfileLocal({ phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00D1FF] outline-none text-sm"
                  />
                </div>
                <div className="pt-4 border-t">
                  <h4 className="font-bold text-sm mb-4">روابط التواصل</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">إنستقرام</label>
                      <input 
                        type="text" 
                        placeholder="https://instagram.com/user"
                        defaultValue={profile.socialLinks.instagram}
                        onBlur={(e) => updateProfileLocal({ socialLinks: { ...profile.socialLinks, instagram: e.target.value } })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-[#00D1FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1 uppercase font-bold">واتساب</label>
                      <input 
                        type="text" 
                        placeholder="https://wa.me/..."
                        defaultValue={profile.socialLinks.whatsapp}
                        onBlur={(e) => updateProfileLocal({ socialLinks: { ...profile.socialLinks, whatsapp: e.target.value } })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:ring-2 focus:ring-[#00D1FF]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case DashboardTab.SETTINGS:
        return (
          <div className="max-w-3xl space-y-6 animate-in slide-in-from-bottom-4 pb-24 lg:pb-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold mb-6">إعدادات المتجر</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">العملة</label>
                  <select 
                    value={profile.currency}
                    onChange={(e) => updateProfileLocal({ currency: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00D1FF] outline-none bg-gray-50 text-sm"
                  >
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="AED">درهم إماراتي (AED)</option>
                    <option value="KWD">دينار كويتي (KWD)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="EGP">جنيه مصري (EGP)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">سياسة الارجاع</label>
                  <textarea 
                    defaultValue={profile.returnPolicy}
                    onBlur={(e) => updateProfileLocal({ returnPolicy: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00D1FF] outline-none resize-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">سياسة التوصيل</label>
                  <textarea 
                    defaultValue={profile.deliveryPolicy}
                    onBlur={(e) => updateProfileLocal({ deliveryPolicy: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00D1FF] outline-none resize-none text-sm"
                  />
                </div>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full lg:hidden bg-red-50 text-red-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              تسجيل الخروج من الحساب
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
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

        <button 
          onClick={onLogout}
          className="mt-auto flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-2xl transition-colors font-bold"
        >
          <LogOut size={20} />
          تسجيل الخروج
        </button>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Logo" className="h-8" />
          <span className="font-extrabold text-[#0D2B4D]">بازشات</span>
        </div>
        <div className="flex gap-3">
          <button onClick={copyChatLink} className="p-2 bg-gray-100 rounded-lg text-gray-600"><Copy size={18} /></button>
          <button onClick={openPreview} className="p-2 bg-[#00D1FF] rounded-lg text-white"><ExternalLink size={18} /></button>
        </div>
      </div>

      {/* Main Content Area */}
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
            <button 
              onClick={copyChatLink}
              className="bg-white border-2 border-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              <Copy size={20} />
              نسخ رابط الدردشة
            </button>
            <button 
              onClick={openPreview}
              className="bg-[#00D1FF] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <ExternalLink size={20} />
              معاينة الصفحة
            </button>
          </div>
        </header>

        {/* Mobile quick actions info */}
        <div className="lg:hidden mb-6 flex items-center justify-between">
           <div>
             <h2 className="text-2xl font-extrabold text-[#0D2B4D]">لوحة التحكم</h2>
             <p className="text-gray-500 text-sm">أهلاً بك في متجرك الإلكتروني</p>
           </div>
           {isSaving && <Save size={20} className="text-[#00D1FF] animate-spin" />}
        </div>

        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
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
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all ${
      active ? 'bg-[#00D1FF] text-white shadow-xl shadow-cyan-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

const MobileNavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#00D1FF]' : 'text-gray-400'}`}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
  </button>
);

const StatCard: React.FC<{icon: React.ReactNode, label: string, value: string, sub: string}> = ({ icon, label, value, sub }) => (
  <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
    <div className="flex items-center gap-2 mb-3">
      <div className="p-2 bg-gray-50 rounded-xl">{icon}</div>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight whitespace-nowrap">{label}</span>
    </div>
    <div>
      <div className="text-xl font-extrabold text-[#0D2B4D] mb-0.5">{value}</div>
      <div className={`text-[10px] font-bold ${sub.includes('+') ? 'text-green-500' : 'text-red-500'}`}>{sub}</div>
    </div>
  </div>
);

export default Dashboard;
