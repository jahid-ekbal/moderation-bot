document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("access_token");

  // ১. ডাটাবেস থেকে লাইভ সংখ্যাগুলো লোড করা
  try {
    const statsRes = await fetch("/api/dashboard/stats");
    const stats = await statsRes.json();
    document.getElementById("guildCount").innerText = stats.totalGuilds;
    document.getElementById("warningCount").innerText = stats.totalWarnings;
  } catch (err) {
    console.error("Failed to load server stats.");
  }

  // ২. যদি ইউজার ডিসকর্ড দিয়ে লগইন করে থাকে
  if (accessToken) {
    // ইউআরএল ক্লিন রাখা
    window.history.replaceState({}, document.title, "/");

    // ডিসকর্ড এপিআই থেকে ইউজার প্রোফাইল ডেটা নেওয়া
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await userRes.json();

    if (user.id) {
      // ড্যাশবোর্ডে ইউজারের নাম এবং প্রোফাইল পিকচার আপডেট
      document.getElementById("welcomeMessage").innerText =
        `🔥 Glad to see you here, ${user.username}! Secure access granted.`;

      const avatarUrl =
        user.avatar ?
          `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

      document.getElementById("userProfile").innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px; width: 100%;">
                    <img src="${avatarUrl}" alt="Avatar" style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid #00f2fe;">
                    <div>
                        <h4 style="font-size: 0.95rem;">${user.username}</h4>
                        <span style="font-size: 0.75rem; color: #00f2fe; font-weight: bold;"><i class="fa-solid fa-crown"></i> CEO / Admin</span>
                    </div>
                </div>
            `;
    }
  }
});
