
import { neon } from '@neondatabase/serverless';

/**
 * رابط الاتصال بقاعدة بيانات Neon.
 * تم وضع الرابط الذي قدمته كقيمة افتراضية لضمان عمل التطبيق مباشرة.
 */
const DEFAULT_DATABASE_URL = 'postgresql://neondb_owner:npg_J8QlGLHc7fjv@ep-rapid-hall-aebmrm4k-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

// دالة لجلب متغير البيئة بشكل آمن في المتصفح
const getEnv = (key: string): string | undefined => {
  try {
    // محاولة الوصول لـ process.env (تعمل في بعض البيئات مثل Vite أو عبر Polyfills)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {
    // تجنب الانهيار في حال عدم وجود الكائن
  }
  return undefined;
};

const DATABASE_URL = getEnv('DATABASE_URL') || getEnv('NETLIFY_DATABASE_URL') || DEFAULT_DATABASE_URL;

/**
 * تهيئة كائن الاتصال. 
 * نستخدم "proxy" أو "lazy initialization" إذا كان ذلك ممكناً، 
 * ولكن هنا سنقوم بالتهيئة المباشرة مع التأكد من وجود الرابط.
 */
export const sql = neon(DATABASE_URL);

export const initTables = async () => {
  try {
    // جدول المستخدمين
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        phone TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        id TEXT NOT NULL,
        business_id TEXT NOT NULL
      )
    `;
    
    // جدول الملفات الشخصية
    await sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_name TEXT,
        phone TEXT,
        country_code TEXT,
        logo TEXT,
        social_links JSONB,
        products JSONB,
        currency TEXT,
        return_policy TEXT,
        delivery_policy TEXT
      )
    `;

    // جدول الرسائل
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Neon Database Initialized Successfully');
  } catch (error) {
    console.error('Neon Init Error:', error);
    // لا نقوم بعمل throw هنا للسماح لـ App.tsx بالتعامل مع الخطأ وعرض واجهة مستخدم
    throw error;
  }
};
