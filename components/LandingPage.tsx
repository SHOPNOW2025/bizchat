
import React from 'react';
import { AppView } from '../types';
import { MessageCircle, ShoppingBag, ShieldCheck, TrendingUp, Users, Globe } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (view: AppView) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-2">
              <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Bazchat Logo" className="h-12 w-auto" />
              <span className="text-2xl font-extrabold text-[#0D2B4D] tracking-tight">بازشات</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">المميزات</a>
              <a href="#stats" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">إحصائيات</a>
              <button 
                onClick={() => onNavigate(AppView.LOGIN)}
                className="bg-gray-100 text-gray-800 px-6 py-2 rounded-full font-semibold hover:bg-gray-200 transition-all"
              >
                تسجيل الدخول
              </button>
              <button 
                onClick={() => onNavigate(AppView.SIGNUP)}
                className="bg-[#00D1FF] text-white px-8 py-2.5 rounded-full font-bold shadow-lg shadow-cyan-500/30 hover:bg-[#00B8E0] transition-all transform hover:-translate-y-0.5"
              >
                ابدأ مجاناً
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-[#0D2B4D] mb-6 leading-tight">
            حول عملائك إلى <span className="text-[#00D1FF]">عشاق لعلامتك</span> عبر الدردشة
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            أنشئ صفحة دردشة مخصصة لعملك، اعرض منتجاتك، وتواصل مع عملائك بشكل مباشر واحترافي في مكان واحد.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={() => onNavigate(AppView.SIGNUP)}
              className="bg-[#00D1FF] text-white px-10 py-4 rounded-full text-xl font-bold shadow-xl shadow-cyan-500/40 hover:scale-105 transition-transform"
            >
              أنشئ حسابك الآن
            </button>
            <button className="bg-white border-2 border-gray-200 text-gray-700 px-10 py-4 rounded-full text-xl font-bold hover:bg-gray-50 transition-colors">
              مشاهدة ديمو
            </button>
          </div>
          <div className="mt-16 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
            <img src="https://i.ibb.co/Q7pT6bqt/image.png" alt="Bazchat Dashboard Preview" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-20 bg-[#0D2B4D] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-extrabold text-[#00D1FF] mb-2">+15,000</div>
              <p className="text-gray-300 font-medium">منشأة مسجلة</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-extrabold text-[#00D1FF] mb-2">+1M</div>
              <p className="text-gray-300 font-medium">رسالة يومياً</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-extrabold text-[#00D1FF] mb-2">99.9%</div>
              <p className="text-gray-300 font-medium">وقت التشغيل</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-extrabold text-[#00D1FF] mb-2">24/7</div>
              <p className="text-gray-300 font-medium">دعم فني</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#0D2B4D] mb-4">كل ما تحتاجه لنمو عملك</h2>
            <p className="text-gray-600">أدوات متكاملة مصممة خصيصاً لأصحاب الأعمال الحرة والمنشآت الصغيرة والمتوسطة</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<MessageCircle size={32} className="text-[#00D1FF]" />}
              title="رابط دردشة مخصص"
              desc="احصل على رابط خاص (bazchat.com/your-brand) لترسله لعملائك مباشرة."
            />
            <FeatureCard 
              icon={<ShoppingBag size={32} className="text-[#00D1FF]" />}
              title="كتالوج منتجات مدمج"
              desc="اعرض منتجاتك داخل صفحة الدردشة ليتمكن العميل من تصفحها وطلبها أثناء الحديث."
            />
            <FeatureCard 
              icon={<TrendingUp size={32} className="text-[#00D1FF]" />}
              title="لوحة تحكم ذكية"
              desc="تابع إحصائيات زوارك، رسائل عملائك، وأداء منتجاتك من مكان واحد."
            />
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="py-12 border-t text-center">
        <div className="flex justify-center items-center gap-2 mb-6">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Bazchat Logo" className="h-10" />
          <span className="text-xl font-bold">بازشات</span>
        </div>
        <p className="text-gray-500 mb-6">© 2024 بازشات. جميع الحقوق محفوظة.</p>
        <div className="flex justify-center gap-6">
          <a href="#" className="text-gray-400 hover:text-blue-500">تويتر</a>
          <a href="#" className="text-gray-400 hover:text-pink-500">إنستقرام</a>
          <a href="#" className="text-gray-400 hover:text-blue-700">لينكد إن</a>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{icon: React.ReactNode, title: string, desc: string}> = ({ icon, title, desc }) => (
  <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-shadow border border-gray-100">
    <div className="mb-6">{icon}</div>
    <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
    <p className="text-gray-600 leading-relaxed">{desc}</p>
  </div>
);

export default LandingPage;
