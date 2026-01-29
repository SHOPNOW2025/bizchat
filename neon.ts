
import { neon } from '@neondatabase/serverless';

/**
 * رابط الاتصال بقاعدة بيانات Neon المأخوذ من الصورة المقدمة.
 * يتم استخدامه كقيمة افتراضية إذا لم يتم تعيين متغير بيئة.
 */
const DEFAULT_DATABASE_URL = 'postgresql://neondb_owner:npg_J8QlGLHc7fjv@ep-rapid-hall-aebmrm4k-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || DEFAULT_DATABASE_URL;

/**
 * تهيئة كائن الاتصال بـ Neon.
 */
export const sql = neon(DATABASE_URL);

/**
 * دالة لتهيئة الجداول الأساسية (Users و Profiles) لضمان عمل المنصة بشكل صحيح.
 */
export const initTables = async () => {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL');
  }
  
  try {
    // إنشاء جدول المستخدمين (حسابات أصحاب الأعمال)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        phone TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        id TEXT NOT NULL,
        business_id TEXT NOT NULL
      )
    `;
    
    // إنشاء جدول الملفات الشخصية للمنشآت
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
    console.log('Neon database initialized successfully with the provided connection.');
  } catch (error) {
    console.error('Failed to initialize Neon tables:', error);
    throw error;
  }
};
