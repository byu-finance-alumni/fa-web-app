import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Browser-side Supabase client. Use in Client Components for auth flows
// (sign in/out, session). Do NOT use to read alumni data — that goes through
// the FastAPI backend (see CLAUDE.md → API Usage).
export const createClient = () => createBrowserClient(supabaseUrl!, supabaseKey!);
