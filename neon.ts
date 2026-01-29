
import { neon } from '@neondatabase/serverless';

// Cleaned up connection string: removed -pooler and channel_binding for better browser compatibility via HTTP
const DATABASE_URL = 'postgresql://neondb_owner:npg_J8QlGLHc7fjv@ep-rapid-hall-aebmrm4k.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

export const sql = neon(DATABASE_URL);

// Helper to initialize tables if they don't exist
export const initTables = async () => {
  try {
    // We execute these as separate calls to ensure compatibility with the HTTP driver's query limits
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
    console.log('Neon tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Neon tables:', error);
    // Throw error to be caught by the App bootstrap
    throw error;
  }
};
