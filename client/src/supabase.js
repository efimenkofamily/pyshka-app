import { createClient } from '@supabase/supabase-js';

const SB_URL = "https://hblqhusypxuoioultjfz.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibHFodXN5cHh1b2lvdWx0amZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTcyNDcsImV4cCI6MjA5MjUzMzI0N30.KzHgvO8x6X0MOC742Vm-gXggMnYdnms5bnSzInO9OOY";

export const supabase = createClient(SB_URL, SB_KEY);