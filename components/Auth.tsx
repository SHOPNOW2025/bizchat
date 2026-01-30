
import React, { useState } from 'react';
import { User, BusinessProfile } from '../types';
import { sql } from '../neon';

interface AuthProps {
  type: 'login' | 'signup';
  onAuth: (user: User) => void;
  onToggle: () => void;
}

const COUNTRIES = [
  { code: 'SA', name: 'السعودية', prefix: '+966' },
  { code: 'AE', name: 'الإمارات', prefix: '+971' },
  { code: 'KW', name: 'الكويت', prefix: '+965' },
  { code: 'EG', name: 'مصر', prefix: '+20' },
  { code: 'JO', name: 'الأردن', prefix: '+962' },
];

const Auth: React.FC<AuthProps> = ({ type, onAuth, onToggle }) => {
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Added slug generation helper function to handle unique business URLs
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `shop-${Math.random().toString(36).substr(2, 5)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const fullPhone = `${country.prefix}${phone}`;
    
    try {
      if (type === 'signup') {
        const existingUsers = await sql`SELECT * FROM users WHERE phone = ${fullPhone}`;
        
        if (existingUsers.length > 0) {
          setError('رقم الهاتف مسجل بالفعل');
          setLoading(false);
          return;
        }

        const userId = `u_${Date.now()}`;
        const bizId = `biz_${Math.random().toString(36).substr(2, 9)}`;
        const initialSlug = generateSlug(fullName); // Generate the initial slug
        
        // Fix: Added missing aiEnabled and aiBusinessInfo properties
        const initialProfile: BusinessProfile = {
          id: bizId,
          slug: initialSlug,
          name: fullName || 'متجري الجديد',
          ownerName: fullName,
          phone: fullPhone,
          countryCode: country.code,
          logo: 'https://i.ibb.co/XxVXdyhC/6.png',
          socialLinks: {},
          products: [],
          faqs: [],
          currency: country.code === 'SA' ? 'SAR' : 'USD',
          returnPolicy: 'الاسترجاع متاح خلال 14 يوماً من تاريخ الشراء.',
          deliveryPolicy: 'التوصيل خلال 48 ساعة.',
          aiEnabled: false,
          aiBusinessInfo: ''
        };

        // Save User
        await sql`
          INSERT INTO users (phone, password, id, business_id)
          VALUES (${fullPhone}, ${password}, ${userId}, ${bizId})
        `;

        // Save Profile with unique slug handling
        try {
          await sql`
            INSERT INTO profiles (
              id, slug, name, owner_name, phone, country_code, logo, social_links, products, currency, return_policy, delivery_policy, ai_enabled, ai_business_info
            ) VALUES (
              ${bizId}, ${initialSlug}, ${initialProfile.name}, ${initialProfile.ownerName}, ${fullPhone}, ${country.code}, 
              ${initialProfile.logo}, ${JSON.stringify(initialProfile.socialLinks)}, ${JSON.stringify(initialProfile.products)},
              ${initialProfile.currency}, ${initialProfile.returnPolicy}, ${initialProfile.deliveryPolicy}, false, ''
            )
          `;
        } catch (slugError) {
          // If slug exists, append random suffix to ensure uniqueness
          const finalSlug = `${initialSlug}-${Math.random().toString(36).substr(2, 3)}`;
          await sql`
            INSERT INTO profiles (
              id, slug, name, owner_name, phone, country_code, logo, social_links, products, currency, return_policy, delivery_policy, ai_enabled, ai_business_info
            ) VALUES (
              ${bizId}, ${finalSlug}, ${initialProfile.name}, ${initialProfile.ownerName}, ${fullPhone}, ${country.code}, 
              ${initialProfile.logo}, ${JSON.stringify(initialProfile.socialLinks)}, ${JSON.stringify(initialProfile.products)},
              ${initialProfile.currency}, ${initialProfile.returnPolicy}, ${initialProfile.deliveryPolicy}, false, ''
            )
          `;
          initialProfile.slug = finalSlug;
        }
        
        onAuth({ id: userId, phone: fullPhone, businessProfile: initialProfile });
      } else {
        const rows = await sql`SELECT * FROM users WHERE phone = ${fullPhone} AND password = ${password}`;
        
        if (rows.length === 0) {
          setError('رقم الهاتف أو كلمة المرور غير صحيحة');
        } else {
          const u = rows[0];
          const profRows = await sql`SELECT * FROM profiles WHERE id = ${u.business_id}`;
          const p = profRows[0];
          
          // Fix: Added missing aiEnabled and aiBusinessInfo properties
          const profile: BusinessProfile = {
            id: p.id,
            slug: p.slug || p.id,
            name: p.name,
            ownerName: p.owner_name,
            phone: p.phone,
            countryCode: p.country_code,
            logo: p.logo,
            socialLinks: p.social_links || {},
            products: p.products || [],
            faqs: p.faqs || [],
            currency: p.currency,
            returnPolicy: p.return_policy,
            deliveryPolicy: p.delivery_policy,
            aiEnabled: !!p.ai_enabled,
            aiBusinessInfo: p.ai_business_info || ''
          };

          onAuth({ id: u.id, phone: u.phone, businessProfile: profile });
        }
      }
    } catch (e) {
      console.error(e);
      setError('حدث خطأ أثناء الاتصال بقاعدة البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
        <div className="text-center mb-10">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Logo" className="h-16 mx-auto mb-4" />
          <h2 className="text-3xl font-extrabold text-[#0D2B4D]">
            {type === 'login' ? 'مرحباً بعودتك' : 'ابدأ مع بازشات'}
          </h2>
          <p className="text-gray-500 mt-2">أدخل بياناتك للمتابعة</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 animate-bounce">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {type === 'signup' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الاسم الكامل / اسم المنشأة</label>
              <input 
                type="text" 
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00D1FF] outline-none transition-all"
                placeholder="مثلاً: متجر السعادة"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف</label>
            <div className="flex gap-2">
              <select 
                className="px-3 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none"
                value={country.code}
                onChange={(e) => setCountry(COUNTRIES.find(c => c.code === e.target.value) || COUNTRIES[0])}
              >
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.prefix} {c.code}</option>)}
              </select>
              <input 
                type="tel" 
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00D1FF] outline-none transition-all"
                placeholder="5XXXXXXXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#00D1FF] outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#0D2B4D] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-black transition-all disabled:opacity-50"
          >
            {loading ? 'جاري التحميل...' : (type === 'login' ? 'دخول' : 'إنشاء حساب')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-600">
            {type === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
            <button 
              onClick={onToggle}
              className="text-[#00D1FF] font-bold mr-2 hover:underline"
            >
              {type === 'login' ? 'سجل الآن' : 'سجل دخولك'}
            </button>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t text-center">
          <button 
            onClick={() => window.location.hash = '#/'}
            className="text-gray-400 hover:text-gray-600 font-medium"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
