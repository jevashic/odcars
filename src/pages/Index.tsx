import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [status, setStatus] = useState<string>("Checking connection...");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Attempt a simple health check by querying auth
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatus("❌ Connection error");
          setDetail(error.message);
        } else {
          setStatus("✅ Connected to Supabase");
          setDetail(
            data.session
              ? `Authenticated as ${data.session.user.email}`
              : "No active session (anonymous)"
          );
        }
      } catch (err: any) {
        setStatus("❌ Connection failed");
        setDetail(err.message ?? String(err));
      }
    };

    checkConnection();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <h1 className="mb-4 text-4xl font-bold">{status}</h1>
        <p className="text-xl text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
};

export default Index;
