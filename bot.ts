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
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// ইন্টারফেস ডিফাইন করা (Type Safety এর জন্য)
interface Config {
  [guildId: string]: {
    logChannel: string;
  };
}

interface Warnings {
  [userId: string]: number;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // এটি ব্যবহারের জন্যই পোর্টালে সেটিংস অন করতে হয়
  ],
});

// ডেটা লোড করা
const badWords: string[] = JSON.parse(
  fs.readFileSync("./badWords.json", "utf8"),
);
let config: Config =
  fs.existsSync("./config.json") ?
    JSON.parse(fs.readFileSync("./config.json", "utf8"))
  : {};
let warnings: Warnings =
  fs.existsSync("./warnings.json") ?
    JSON.parse(fs.readFileSync("./warnings.json", "utf8"))
  : {};

// হেল্পার ফাংশন: সেভ করা
const saveFile = (path: string, data: object): void =>
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
        .setDescription("লগ পাঠানোর জন্য চ্যানেলটি সিলেক্ট করুন")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN as string);

client.once("ready", async () => {
  try {
    if (client.user) {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commands,
      });
      console.log(`${client.user.tag} অনলাইনে আছে এবং কমান্ড লোড হয়েছে!`);
    }
  } catch (error) {
    console.error(error);
  }
});

// ইন্টারঅ্যাকশন হ্যান্ডলার
client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "help") {
    const helpEmbed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("🛡️ Moderation Bot Help")
      .setDescription(
        "এই বটটি স্বয়ংক্রিয়ভাবে গালিগালাজ শনাক্ত করে এবং ডিলিট করে।",
      )
      .addFields(
        { name: "/help", value: "কমান্ডের তালিকা দেখাবে।" },
        {
          name: "/setup",
          value: "অ্যাডমিনদের জন্য লগ চ্যানেল সেট করার কমান্ড।",
        },
      );
    await interaction.reply({ embeds: [helpEmbed] });
  }

  if (commandName === "setup") {
    const channel = interaction.options.getChannel("channel") as TextChannel;
    if (!interaction.guildId) return;

    config[interaction.guildId] = { logChannel: channel.id };
    saveFile("./config.json", config);
    await interaction.reply(`✅ সফলভাবে লগ চ্যানেল সেট করা হয়েছে: ${channel}`);
  }
});

// মেসেজ মনিটরিং
client.on("messageCreate", async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  // টেক্সট নরমালাইজ করা
  const cleanText = message.content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/(.)\1+/g, "$1");

  const hasBadWord = badWords.some((word) => cleanText.includes(word));

  if (!hasBadWord) return;

  // ডিলিট এবং ওয়ার্নিং লজিক
  await message.delete().catch(() => {});

  const userId = message.author.id;
  warnings[userId] = (warnings[userId] || 0) + 1;
  saveFile("./warnings.json", warnings);

  // লগ পাঠানো
  const logChannelId = config[message.guild.id]?.logChannel;
  if (logChannelId) {
    const logChannel = message.guild.channels.cache.get(
      logChannelId,
    ) as TextChannel;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("🚫 Bad Word Detected")
        .addFields(
          {
            name: "User",
            value: `${message.author.tag} (${message.author.id})`,
            inline: true,
          },
          {
            name: "Warning Count",
            value: `${warnings[userId]}/3`,
            inline: true,
          },
          { name: "Content", value: message.content },
        )
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }
  }

  // ইউজারকে মেসেজ এবং পানিশমেন্ট
  try {
    await message.author.send(
      `⚠️ আপনাকে সতর্ক করা হচ্ছে! (${warnings[userId]}/3): অশালীন ভাষা ব্যবহার করবেন না।`,
    );

    if (warnings[userId] === 2) {
      await message.member?.timeout(
        60 * 60 * 1000,
        "গালি ব্যবহারের জন্য ১ ঘণ্টা মিউট।",
      );
    } else if (warnings[userId] >= 3) {
      await message.member?.ban({
        reason: "বারবার গালি ব্যবহারের জন্য ব্যান।",
      });
    }
  } catch (e) {
    console.log("ইউজারকে ডিএম পাঠানো সম্ভব হয়নি।");
  }
});

client.login(process.env.TOKEN);
