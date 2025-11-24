import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://dshscyygljmmgpykskxo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzaHNjeXlnbGptbWdweWtza3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NjY4MDUsImV4cCI6MjA3OTU0MjgwNX0.nlQrDclnwxBwNS4Sv7YFQEj9uUrMZL-AmN2X2NBK7i0";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
