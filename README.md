# ১. রিপোজিটরি ক্লোন করুন

git clone [https://github.com/jahid-ekbal/moderation-bot.git](https://github.com/jahid-ekbal/moderation-bot.git)
cd moderation-bot

# ২. বানের মাধ্যমে ডিপেন্ডেন্সি ইনস্টল করুন

bun install

# ৩. রুট ডিরেক্টরিতে .env ফাইল তৈরি করে কনফিগার করুন (নিচের গাইড দেখুন)

# ৪. ডাটাবেস মাইগ্রেশন রান এবং প্রিজমা ক্লায়েন্ট জেনারেট করুন

bunx prisma migrate dev --name init
bunx prisma generate

# ৫. হট-রিলোড সহ ডেভেলপমেন্ট মোডে রান করুন

bun --watch src/bot.ts

# গ্লোবালি PM2 প্রসেস ম্যানেজার ইনস্টল করুন

bun add -g pm2

# বটের প্রসেসটি ব্যাকগ্রাউন্ডে স্টার্ট করুন

pm2 start src/bot.ts --name "regix-ai-bot" --interpreter bun

# ড্যাশবোর্ড সার্ভারটি ব্যাকগ্রাউন্ডে স্টার্ট করুন

pm2 start src/server.ts --name "regix-dashboard" --interpreter bun

# সার্ভার রিবুট বা ক্র্যাশ হলেও যেন অটোমেটিক স্টার্ট হয় তা সেট করুন

pm2 save
pm2 startup

# Discord Configuration

DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here

# AI Service Engine

GEMINI_API_KEY=your_google_gemini_api_key_here

# Database Infrastructure

DATABASE_URL="file:./dev.db"

# Server Port Configuration

PORT=3000

{
"en": ["badword1", "badword2"],
"bn": ["গালি১", "গালি২"]
}

# 🤖 REGIX AI — Next-Gen Discord Automation Engine

<div align="center">

![REGIX AI Header](https://capsule-render.vercel.app/api?type=waving&color=auto&height=220&section=header&text=REGIX%20AI&fontSize=70&animation=fadeIn&theme=dark)

[![Bun Version](https://img.shields.io/badge/Bun-v1.3%2B-black?style=for-the-badge&logo=bun&logoColor=f9f1e7)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

🛸 **REGIX AI** হচ্ছে একটি আল্ট্রা-ফাস্ট, হাই-পারফরম্যান্স ডিসকর্ড মডারেশন এবং অটোমেশন ইঞ্জিন। আধুনিক এবং দ্রুত বর্ধনশীল গেমিং ও টেক কমিউনিটিগুলোর নিরাপত্তা নিশ্ছিদ্র করতে এবং ব্যাকএন্ড ব্যাকগ্রাউন্ড অটোমেশনকে একটি চমৎকার ফ্রস্টেড-গ্লাস ওয়েব ইন্টারফেসের সাথে যুক্ত করার জন্য এটি **Bun Runtime**, **TypeScript**, এবং **Prisma ORM** ব্যবহার করে স্ক্র্যাচ থেকে তৈরি করা হয়েছে।

---

📊 **Repository Views Counter**  
![Views](https://komarev.com/ghpvc/?username=jahid-ekbal&repo=moderation-bot&color=blueviolet&style=flat-square)

</div>

---

## 🚀 মূল ফীচারসমূহ (Key Features)

- 🤖 **AI-Powered Toxicity Filter:** চ্যাটে অশালীন, ক্ষতিকর বা গালাগালিযুক্ত ভাষা রিয়াল-টাইমে ডিটেক্ট ও ডিলিট করতে এটি যুগপৎভাবে **Google Gemini API** এবং একটি হাই-স্পীড লোকাল JSON ফিল্টারিং মেথড প্রসেস করে।
- ⚠️ **Progressive Warning System:** ইউজারদের অপরাধ ট্র্যাক করে ডাটাবেসে সেভ রাখে এবং রুলস ভায়োলেশনের ওপর ভিত্তি করে ধাপে ধাপে শাস্তির মাত্রা বৃদ্ধি করে (`সতর্কবার্তা` ➔ `১ ঘণ্টার মিউট` ➔ `স্থায়ী ব্যান`)।
- 🔄 **Message Tracking & Recovery:** চ্যানেলে ডিলিট হওয়া সর্বশেষ টেক্সট মেসেজটি সরাসরি SQLite ডাটাবেসে বাফারিং ট্র্যাকিংয়ে থাকে। শুধুমাত্র সার্ভার অনার বা অথরাইজড অ্যাডমিনরা `/restore` স্ল্যাশ কমান্ড দিয়ে তা রিস্টোর করতে পারেন।
- 🧹 **Historical User Nuke:** কোনো ক্ষতিকর রেইডার বা স্প্যামারের পাঠানো আজীবনের সমস্ত চ্যাট হিস্ট্রি এক ক্লিকে পুরো সার্ভারের সব চ্যানেল থেকে মুছে ফেলার জন্য রয়েছে আল্ট্রা-ফাস্ট `/nukeuser` কমান্ড।
- 📩 **Structured Support Tickets:** মেম্বারদের প্রফেশনাল সাপোর্ট দিতে বাটন-ভিত্তিক অ্যাডভান্সড টিকেট সিস্টেম, যা ক্লিক করার সাথে সাথে ডাইনামিকালি নতুন চ্যানেল ক্রিয়েট করে ক্যাটাগরি ও রোল পারমিশন সেট করে নেয়।
- 💎 **Glassmorphism Web Dashboard:** ফ্রন্টএন্ডে রিয়েল-টাইম ডাটাবেস স্ট্যাটাস, বটের আপটাইম এবং মেম্বার লগ দেখানোর জন্য মেটিরিয়াল ডিজাইন গ্রিড ও ফ্রস্টেড-গ্লাস থিমের ড্যাশবোর্ড, যা সম্পূর্ণ **Discord OAuth2 Authentication** দ্বারা সুরক্ষিত।
- 🔒 **Hardened Global Security Gate:** কঠোর সিকিউরিটি মেকানিজম। শুধুমাত্র মূল **Server Owners** এবং এনভায়রনমেন্টে হোয়াইটলিস্ট করা গ্লোবাল ডেভেলপার আইডিরাই বটের সুপার-অ্যাডমিন স্ল্যাশ অ্যাকশনগুলো এক্সিকিউট করতে পারবে।

---

## 🛠️ টেক স্ট্যাক ও আর্কিটেকচার (Tech Stack)

- **Runtime Engine:** [Bun v1.3+](https://bun.sh) (Node.js এর চেয়ে ২০ গুণ দ্রুততম এক্সিকিউশন স্পীড)
- **Language:** TypeScript (Strict Type-Safety & Compile-time error handling)
- **Database & ORM:** SQLite Database with [Prisma ORM](https://www.prisma.io/)
- **API Frameworks:** Discord.js v14+ & Bun's Native HTTP Server (`Bun.serve`)
- **UI/UX Layer:** HTML5, CSS3 (Custom Glassmorphic Fluid & Neon Glow Effects), Vanilla JavaScript

---

## 📂 প্রজেক্ট স্ট্রাকচার (Project Structure)

```text
📂 moderation-bot/
├── 📂 .github/workflows/
│   └── 📄 deploy.yml          # GitHub Actions স্বয়ংক্রিয় CI/CD পাইপলাইন
├── 📂 data/
│   └── 📄 badWords.json       # বহুভাষিক ব্যাড-ওয়ার্ড ডেটাসেট (1000+ এন্ট্রি)
├── 📂 prisma/
│   ├── 📄 dev.db              # SQLite প্রোডাকশন ডাটাবেস ফাইল
│   └── 📄 schema.prisma       # প্রিজমা রিলেশনাল ডাটা স্কিমা
├── 📂 public/                 # ড্যাশবোর্ডের ফ্রন্টএন্ড স্ট্যাটিক এসেটস
│   ├── 📄 index.html
│   ├── 📄 style.css
│   └── 📄 app.js
├── 📂 src/
│   ├── 📂 services/
│   │   └── 📄 geminiService.ts # Gemini AI টক্সিসিটি ডিটেকশন লেয়ার
│   ├── 📂 utils/
│   │   └── 📄 db.ts           # প্রিজমা ডাটাবেস ক্লায়েন্ট ইনিশিয়ালাইজার
│   ├── 📄 bot.ts              # মূল ডিসকর্ড গেটওয়ে ক্লায়েন্ট ফাইল
│   └── 📄 server.ts           # OAuth2 API ও ড্যাশবোর্ড ব্যাকএন্ড ইঞ্জিন
├── 📄 package.json            # স্ক্রিপ্ট ও ডিপেন্ডেন্সি ম্যাপিং ফাইল
└── 📄 tsconfig.json           # টাইপস্ক্রিপ্ট কম্পাইলার অপ্টিমাইজেশন কনফিগ

```

# ১. রিপোজিটরি ক্লোন করুন

git clone [https://github.com/jahid-ekbal/moderation-bot.git](https://github.com/jahid-ekbal/moderation-bot.git)
cd moderation-bot

# ২. বানের মাধ্যমে ডিপেন্ডেন্সি ইনস্টল করুন

bun install

# ৩. রুট ডিরেক্টরিতে .env ফাইল তৈরি করে কনফিগার করুন (নিচের গাইড দেখুন)

# ৪. ডাটাবেস মাইগ্রেশন রান এবং প্রিজমা ক্লায়েন্ট জেনারেট করুন

bunx prisma migrate dev --name init
bunx prisma generate

# ৫. হট-রিলোড সহ ডেভেলপমেন্ট মোডে রান করুন

bun --watch src/bot.ts

# গ্লোবালি PM2 প্রসেস ম্যানেজার ইনস্টল করুন

bun add -g pm2

# বটের প্রসেসটি ব্যাকগ্রাউন্ডে স্টার্ট করুন

pm2 start src/bot.ts --name "regix-ai-bot" --interpreter bun

# ড্যাশবোর্ড সার্ভারটি ব্যাকগ্রাউন্ডে স্টার্ট করুন

pm2 start src/server.ts --name "regix-dashboard" --interpreter bun

# সার্ভার রিবুট বা ক্র্যাশ হলেও যেন অটোমেটিক স্টার্ট হয় তা সেট করুন

pm2 save
pm2 startup

# Discord Configuration

DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here

# AI Service Engine

GEMINI_API_KEY=your_google_gemini_api_key_here

# Database Infrastructure

DATABASE_URL="file:./dev.db"

# Server Port Configuration

PORT=3000

{
"en": ["badword1", "badword2"],
"bn": ["গালি১", "গালি২"]
}
