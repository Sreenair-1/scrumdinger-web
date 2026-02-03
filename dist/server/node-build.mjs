import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import * as express from "express";
import express__default from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
let supabase = null;
let supabaseAdmin = null;
function initializeClient() {
  if (supabase && supabaseAdmin) return;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const supabaseAdminKey = process.env.SUPABASE_ADMIN_KEY;
  if (!supabaseUrl || !supabaseKey || !supabaseAdminKey) {
    throw new Error("❌ Missing SUPABASE environment variables.");
  }
  supabase = createClient(supabaseUrl, supabaseKey);
  supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}
const api = {
  getScrums: async () => {
    initializeClient();
    const { data, error } = await supabase.from("scrums").select("*");
    if (error) {
      console.error("Supabase Error fetching scrums:", error);
      throw error;
    }
    return data;
  },
  createScrum: async (scrumData) => {
    initializeClient();
    const { data, error } = await supabase.from("scrums").insert([scrumData]).select();
    if (error) {
      console.error("Supabase Error creating scrum:", error);
      throw error;
    }
    return data[0];
  },
  getUsers: async () => {
    initializeClient();
    const { data, error } = await supabase.from("users").select("*");
    if (error) {
      console.error("Supabase Error fetching users:", error);
      throw error;
    }
    return data;
  },
  createUser: async (userData) => {
    initializeClient();
    const { data, error } = await supabase.from("users").insert([userData]).select();
    if (error) {
      console.error("Supabase Error creating user:", error);
      throw error;
    }
    return data[0];
  },
  signUpUser: async (email, password) => {
    initializeClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    if (error) {
      console.error("Supabase SignUp Error:", error);
      throw error;
    }
    return data;
  },
  signInUser: async (email, password) => {
    initializeClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      console.error("Supabase SignIn Error:", error);
      throw error;
    }
    return data;
  },
  getUserFromToken: async (token) => {
    initializeClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.error("Supabase GetUser Error:", error);
      throw error;
    }
    return data;
  },
  userExists: async (email) => {
    initializeClient();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      email
    });
    if (error) {
      console.error("Supabase Admin listUsers error:", error);
      throw error;
    }
    if (data.users.length === 0) {
      return false;
    }
    const exists = data.users.some((user) => user.email && user.email.toLowerCase() === email.toLowerCase());
    return exists;
  }
};
const handleGetScrums = async (req, res) => {
  try {
    const scrums = await api.getScrums();
    res.status(200).json({ scrums });
  } catch (err) {
    console.error("Error handling getScrums:", err.message);
    res.status(500).json({ error: "Failed to retrieve scrum data." });
  }
};
const handlePostScrum = async (req, res) => {
  try {
    const scrumData = req.body;
    const newScrum = await api.createScrum(scrumData);
    res.status(201).json(newScrum);
  } catch (err) {
    console.error("Error handling postScrum:", err.message);
    res.status(500).json({ error: "Failed to create new scrum." });
  }
};
const handleSignUp = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required for sign-up." });
    }
    const data = await api.signUpUser(email, password);
    if (data.user && !data.session) {
      return res.status(202).json({
        message: "Account created. Please check your email to confirm registration."
      });
    }
    res.status(201).json(data);
  } catch (err) {
    console.error("Error handling sign-up:", err.message);
    res.status(400).json({ error: err.message });
  }
};
const handleSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required for sign-in." });
    }
    const data = await api.signInUser(email, password);
    if (!data.session) {
      return res.status(401).json({ error: "Invalid credentials or user not confirmed." });
    }
    res.status(200).json(data);
  } catch (err) {
    console.error("Error handling sign-in:", err.message);
    res.status(401).json({ error: err.message });
  }
};
const handleLoginOrRegister = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const userExists = await api.userExists(email);
    let sessionData;
    if (userExists) {
      try {
        sessionData = await api.signInUser(email, password);
      } catch (e) {
        return res.status(401).json({ error: e.message || "Invalid credentials." });
      }
    } else {
      try {
        sessionData = await api.signUpUser(email, password);
        if (sessionData.user && !sessionData.session) {
          return res.status(202).json({
            message: "Account created! Please check your email to log in.",
            requiresConfirmation: true
          });
        }
      } catch (e) {
        return res.status(400).json({ error: e.message || "Registration failed." });
      }
    }
    return res.status(200).json(sessionData);
  } catch (err) {
    console.error("FATAL Server Error in Login/Register:", err.message);
    res.status(500).json({ error: "An unexpected server error occurred." });
  }
};
dotenv.config({ path: ".env.secret" });
dotenv.config({ path: ".env.public", override: false });
function createServer() {
  const app2 = express__default();
  app2.use(cors());
  app2.use(express__default.json());
  app2.use(express__default.urlencoded({ extended: true }));
  app2.get("/api/scrums", handleGetScrums);
  app2.post("/api/scrums", handlePostScrum);
  app2.post("/api/auth/signup", handleSignUp);
  app2.post("/api/auth/signin", handleSignIn);
  app2.post("/api/auth/login-or-register", handleLoginOrRegister);
  return app2;
}
const app = createServer();
const port = process.env.PORT || 3e3;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../spa");
app.use(express.static(distPath));
app.get("/:path*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});
app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
//# sourceMappingURL=node-build.mjs.map
