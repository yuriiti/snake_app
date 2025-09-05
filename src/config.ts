// Public config for remote integrations
// You can override via Vite env: VITE_EDGE_LEADERBOARD_URL
export const EDGE_LEADERBOARD_URL: string = `${
  import.meta.env.VITE_SUPABASE_URL
}/functions/v1/telegram-leaderboard`;
