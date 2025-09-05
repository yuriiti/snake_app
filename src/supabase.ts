import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function getLeaderboard(
  levelKey: string
): Promise<Database["public"]["Views"]["public_leaderboard"]["Row"][] | null> {
  const results = await supabase
    .from("public_leaderboard")
    .select("*")
    .eq("level_key", levelKey)
    .limit(10);

  return results.data;
}
