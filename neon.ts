
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_J8QlGLHc7fjv@ep-rapid-hall-aebmrm4k.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

export const sql = neon(DATABASE_URL);

export const initTables = async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        phone TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        id TEXT NOT NULL,
        business_id TEXT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        name TEXT NOT NULL,
        owner_name TEXT,
        description TEXT,
        meta_description TEXT,
        phone TEXT,
        country_code TEXT,
        logo TEXT,
        location_url TEXT,
        social_links JSONB,
        products JSONB,
        faqs JSONB DEFAULT '[]',
        currency TEXT,
        return_policy TEXT,
        delivery_policy TEXT,
        ai_enabled BOOLEAN DEFAULT FALSE,
        ai_business_info TEXT
      )
    `;

    // Migration updates to ensure columns exist
    try { await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT FALSE`; } catch (e) {}
    try { await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_business_info TEXT`; } catch (e) {}
    
    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        last_text TEXT,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        is_ai BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try { await sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT FALSE`; } catch (e) {}

    await sql`
      CREATE TABLE IF NOT EXISTS voice_calls (
        session_id TEXT PRIMARY KEY,
        call_id TEXT,
        status TEXT DEFAULT 'idle',
        caller_role TEXT,
        offer JSONB,
        answer JSONB,
        caller_candidates JSONB DEFAULT '[]',
        receiver_candidates JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Neon tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Neon tables:', error);
    throw error;
  }
};
