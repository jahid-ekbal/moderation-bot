import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Interaction,
  Message,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ইন্টারফেস ডিফাইন করা
interface Config {
  [guildId: string]: { logChannel: string };
}
interface Warnings {
  [userId: string]: number;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// নিরাপদভাবে ডেটা লোড করার ফাংশন (JSON EOF এরর সমাধান করবে)
const loadJSON = <T>(path: string, defaultValue: T): T => {
  try {
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(path, "utf8").trim();
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const badWords: string[] = loadJSON("./badWords.json", ["fuck", "shit"]);
let config: Config = loadJSON("./config.json", {});
let warnings: Warnings = loadJSON("./warnings.json", {});

const saveFile = (path: string, data: object) =>
  fs.writeFileSync(path, JSON.stringify(data, null, 2));

// স্ল্যাশ কমান্ড রেজিস্ট্রেশন
const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("বটের সব কমান্ডের তালিকা দেখুন"),
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("লগ চ্যানেল সেটআপ করুন")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("যে চ্যানেলে রিপোর্ট পাঠাতে চান")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN as string);

client.once("ready", async () => {
  try {
    if (client.user) {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commands,
      });
      console.log(`✅ ${client.user.tag} অনলাইনে আছে!`);
    }
  } catch (error) {
    console.error(error);
  }
});

// কমান্ড হ্যান্ডলার
client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "help") {
    const helpEmbed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("🛡️ REGIX মডারেশন হেল্প")
      .setDescription(
        "আমি স্বয়ংক্রিয়ভাবে গালি শনাক্ত করি এবং লগ চ্যানেলে রিপোর্ট পাঠাই।\n\n**কমান্ডসমূহ:**\n`/setup` - লগ চ্যানেল সেট করুন\n`/help` - এই মেসেজটি দেখুন",
      );
    await interaction.reply({ embeds: [helpEmbed] });
  }

  if (interaction.commandName === "setup") {
    const channel = interaction.options.getChannel("channel") as TextChannel;
    config[interaction.guildId!] = { logChannel: channel.id };
    saveFile("./config.json", config);
    await interaction.reply(
      `✅ সফল! এখন থেকে সব রিপোর্ট ${channel} চ্যানেলে পাঠানো হবে।`,
    );
  }
});

// মেসেজ মনিটরিং এবং রিপোর্টিং
client.on("messageCreate", async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  const cleanText = message.content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/(.)\1+/g, "$1");
  const hasBadWord = badWords.some((word) => cleanText.includes(word));

  if (!hasBadWord) return;

  // ১. মেসেজ ডিলিট
  await message.delete().catch(() => {});

  // ২. ওয়ার্নিং আপডেট
  const userId = message.author.id;
  warnings[userId] = (warnings[userId] || 0) + 1;
  saveFile("./warnings.json", warnings);

  // ৩. টেক্সট চ্যানেলে রিপোর্ট/লগ পাঠানো
  const logChannelId = config[message.guild.id]?.logChannel;
  if (logChannelId) {
    const logChannel = message.guild.channels.cache.get(
      logChannelId,
    ) as TextChannel;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("🚫 গালি শনাক্ত হয়েছে!")
        .addFields(
          {
            name: "ইউজার",
            value: `${message.author.tag} (<@${userId}>)`,
            inline: true,
          },
          { name: "ওয়ার্নিং", value: `${warnings[userId]}/3`, inline: true },
          { name: "মেসেজ", value: message.content },
        )
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }
  }

  // ৪. ইউজারকে শাস্তি
  try {
    if (warnings[userId] === 2) {
      await message.member?.timeout(3600000, "গালি দেওয়ার জন্য ১ ঘণ্টা মিউট।");
      await message.author.send("⚠️ আপনাকে ১ ঘণ্টার জন্য মিউট করা হয়েছে।");
    } else if (warnings[userId] >= 3) {
      await message.member?.ban({ reason: "বারবার গালি দেওয়া।" });
      await message.author.send("🚫 আপনাকে সার্ভার থেকে ব্যান করা হয়েছে।");
    } else {
      await message.author.send(
        `⚠️ সতর্কবার্তা (${warnings[userId]}/3): অশালীন ভাষা ব্যবহার করবেন না।`,
      );
    }
  } catch (e) {}
});

client.login(process.env.TOKEN);
