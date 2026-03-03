import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY")!;

    // 1. Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;

    // Check caller is admin in internal_users
    const { data: caller, error: callerErr } = await anonClient
      .from("internal_users")
      .select("role")
      .eq("auth_user_id", callerId)
      .eq("is_active", true)
      .maybeSingle();

    if (callerErr || !caller || caller.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse body
    const { email, password, full_name, role, branch_id, is_active } = await req.json();

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Create auth user with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUserId = authData.user.id;

    // 4. Insert into internal_users
    const { data: internalUser, error: insertErr } = await adminClient
      .from("internal_users")
      .insert({
        auth_user_id: authUserId,
        email,
        full_name,
        role,
        branch_id: branch_id || null,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (insertErr) {
      // Attempt to clean up auth user
      await adminClient.auth.admin.deleteUser(authUserId);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Audit log
    await adminClient.from("audit_log").insert({
      performed_by: callerId,
      action: "insert",
      table_name: "internal_users",
      record_id: internalUser.id,
      old_data: null,
      new_data: internalUser,
    });

    return new Response(JSON.stringify({ user: internalUser }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
