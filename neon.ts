
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

    // Try to add slug column if it doesn't exist (for existing databases)
    try {
      await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE`;
    } catch (e) {
      console.log('Slug column might already exist');
    }
    
    // New tables for messaging system
    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
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
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Neon tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Neon tables:', error);
    throw error;
  }
};
