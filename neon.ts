
import { neon } from '@neondatabase/serverless';

/**
 * رابط قاعدة البيانات المباشر لضمان العمل في بيئة الإنتاج (Production)
 * دون الحاجة لمتغيرات بيئة قد تسبب أخطاء "process is not defined".
 */
const DB_URL = 'postgresql://neondb_owner:npg_J8QlGLHc7fjv@ep-rapid-hall-aebmrm4k-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

// إنشاء كائن الاتصال
export const sql = neon(DB_URL);

/**
 * دالة تهيئة الجداول - تعمل بصمت لضمان وجود الهيكل الأساسي
 */
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

    console.log('Database system ready');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};
