import { db } from "./utils/db";

const PORT = 3000;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.DASHBOARD_URL}/api/auth/callback`;

Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    // 💡 এখানে 'req' এর পাশে ': Request' যোগ করা হয়েছে
    const url = new URL(req.url);

    // ১. ফ্রন্টএন্ড স্ট্যাটিক ফাইল সার্ভ করা
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file("./public/index.html"), {
        headers: { "Content-Type": "text/html" },
      });
    }
    if (url.pathname === "/style.css") {
      return new Response(Bun.file("./public/style.css"), {
        headers: { "Content-Type": "text/css" },
      });
    }
    if (url.pathname === "/app.js") {
      return new Response(Bun.file("./public/app.js"), {
        headers: { "Content-Type": "text/javascript" },
      });
    }

    // ২. ডিসকর্ড লগইন রিডাইরেক্ট রুট
    if (url.pathname === "/api/auth/login") {
      const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify+guilds`;
      return Response.redirect(discordAuthUrl);
    }

    // ৩. ওঅথ২ ও অথেন্টিকেশন কলব্যাক
    if (url.pathname === "/api/auth/callback") {
      const code = url.searchParams.get("code");
      if (!code)
        return new Response("Authorization code missing", { status: 400 });

      // ডিসকর্ড থেকে টোকেন এক্সচেঞ্জ
      const tokenResponse = await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",
          body: new URLSearchParams({
            client_id: CLIENT_ID!,
            client_secret: CLIENT_SECRET!,
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
          }),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );

      const tokens = await tokenResponse.json();
      if (tokens.error)
        return new Response(JSON.stringify(tokens), { status: 400 });

      // ড্যাশবোর্ডে টোকেন সহ রিডাইরেক্ট (সুরক্ষার জন্য রিয়াল অ্যাপে সেশন/কুকি ব্যবহার করা হয়)
      return Response.redirect(`/?access_token=${tokens.access_token}`);
    }

    // ৪. লাইভ ডাটাবেস স্ট্যাটাস এপিআই রুট
    if (url.pathname === "/api/dashboard/stats") {
      try {
        const totalGuilds = await db.guildConfig.count();
        const totalWarnings = await db.userWarning.count();

        return new Response(JSON.stringify({ totalGuilds, totalWarnings }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        return new Response("Database Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🌐 REGIX Dashboard is live on ${process.env.DASHBOARD_URL}`);
