import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Supabase DB 클라이언트.
 * .env.local에 URL·Key가 없으면 null → localStorage 폴백 동작.
 */
export const db = url && key ? createClient(url, key) : null;
