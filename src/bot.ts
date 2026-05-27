import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Collection,
  EmbedBuilder,
  GatewayIntentBits,
  GuildMember,
  Interaction,
  Message,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import * as dotenv from "dotenv";
import { checkToxicity } from "./services/geminiService";
import { loadJSON, saveJSON } from "./utils/dataHandler";

dotenv.config();

interface GuildConfig {
  logChannel?: string;
  welcomeChannel?: string;
  ticketCategory?: string;
}
interface Config {
  [guildId: string]: GuildConfig;
}
interface Warnings {
  [userId: string]: number;
}

const PREFIX = "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

let config: Config = loadJSON("./data/config.json", {});
let warnings: Warnings = loadJSON("./data/warnings.json", {});

// --- ১. স্ল্যাশ কমান্ড রেজিস্ট্রেশন ---
const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("REGIX বটের সব কমান্ডের তালিকা দেখুন"),

  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("বটের বিভিন্ন চ্যানেল সেটআপ করুন")
    .addChannelOption((option) =>
      option
        .setName("log")
        .setDescription("মডারেশন লগ চ্যানেল")
        .setRequired(false),
    )
    .addChannelOption((option) =>
      option
        .setName("welcome")
        .setDescription("স্বাগতম জানানোর চ্যানেল")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ticket-setup")
    .setDescription("টিকেট সিস্টেম প্যানেল তৈরি করুন")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("যে চ্যানেলে বাটন থাকবে")
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName("category")
        .setDescription("টিকেট ক্যাটাগরি")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("nukeuser")
    .setDescription(
      "একটি নির্দিষ্ট ইউজারের পাঠানো অল-টাইম সব মেসেজ সব চ্যাট থেকে ডিলিট করুন",
    )
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("যে ইউজারের সব মেসেজ ডিলিট করতে চান")
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
      console.log(`✅ ${client.user.tag} অনলাইনে রেডি আছে!`);
    }
  } catch (error) {
    console.error(error);
  }
});

// --- ২. অল-টাইম মেসেজ ডিলিট করার ফিক্সড কোর ফাংশন (Nuke All Chats) ---
async function nukeAllUserMessages(
  guild: any,
  targetUserId: string,
  outputChannel: TextChannel,
) {
  try {
    await outputChannel.send(
      `🧹 <@${targetUserId}> এর অল-টাইম মেসেজ খোঁজা এবং সমস্ত চ্যাট থেকে ডিলিট করার প্রক্রিয়া শুরু হচ্ছে...`,
    );

    // ফিক্স: কেবল ক্যাশ নয়, সার্ভারের সব চ্যানেল এপিআই থেকে সরাসরি ফেচ করা হলো
    const channels = await guild.channels.fetch();
    const textChannels = channels.filter(
      (c: any) => c && c.type === ChannelType.GuildText,
    );

    let totalDeleted = 0;

    for (const [_, channel] of textChannels) {
      const textChannel = channel as TextChannel;
      let lastMessageId: string | undefined = undefined;
      let fetching = true;

      while (fetching) {
        const options: { limit: number; before?: string } = { limit: 100 };
        if (lastMessageId) options.before = lastMessageId;

        const messages: Collection<string, Message> = await textChannel.messages
          .fetch(options)
          .catch(() => new Collection());
        if (messages.size === 0) {
          fetching = false;
          break;
        }

        const userMessages = messages.filter(
          (m) => m.author.id === targetUserId,
        );

        for (const [_, msg] of userMessages) {
          await msg.delete().catch(() => {});
          totalDeleted++;
          await new Promise((resolve) => setTimeout(resolve, 300)); // রেট লিমিট প্রটেকশন ডিলে
        }

        lastMessageId = messages.last()?.id;
        if (messages.size < 100) fetching = false;
      }
    }
    await outputChannel.send(
      `✅ সফলভাবে সম্পন্ন হয়েছে! <@${targetUserId}> এর মোট **${totalDeleted}** টি মেসেজ সমস্ত চ্যাট থেকে মুছে ফেলা হয়েছে।`,
    );
  } catch (error) {
    console.error("Nuke Function Error:", error);
  }
}

// --- ৩. হেল্প কমান্ড রেসপন্স ম্যানেজার ---
async function handleHelpCommand(channel: TextChannel) {
  const helpEmbed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("🛡️ REGIX মাল্টি-ফাংশনাল হাইব্রিড গাইড")
    .setDescription(
      `স্ল্যাশ (\`/\`) অথবা প্রিফিক্স (\`${PREFIX}\`) উভয়ভাবেই কমান্ড রান করা যাবে।\n\n**কমান্ডসমূহ:**\n🔹 \`help\` - বটের গাইডলাইন\n🔹 \`setup\` - লগ ও ওয়েলকাম চ্যানেল সেটআপ\n🔹 \`ticket-setup\` - সাপোর্ট টিকেট প্যানেল\n🔹 \`nukeuser <@user>\` - ইউজারের অল-টাইম সব মেসেজ ডিলিট`,
    );

  await channel.send({ embeds: [helpEmbed] });
}

// --- ৪. স্ল্যাশ কমান্ড ও বাটন ইন্টারঅ্যাকশন হ্যান্ডলার ---
client.on("interactionCreate", async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName, guildId, guild, channel } = interaction;
    if (!guildId || !guild || !channel || !channel.isTextBased()) return;
    const txtChannel = channel as TextChannel;

    if (commandName === "help") {
      await interaction.deferReply({ ephemeral: true });
      await handleHelpCommand(txtChannel);
      await interaction.editReply("✅ হেল্প মেনু পাঠানো হয়েছে।");
    }

    if (commandName === "setup") {
      const logChan = interaction.options.getChannel("log");
      const welChan = interaction.options.getChannel("welcome");
      if (!config[guildId]) config[guildId] = {};
      if (logChan) config[guildId].logChannel = logChan.id;
      if (welChan) config[guildId].welcomeChannel = welChan.id;
      saveJSON("./data/config.json", config);
      await interaction.reply("✅ কনফিগারেশন সফলভাবে আপডেট করা হয়েছে!");
    }

    if (commandName === "ticket-setup") {
      const targetChannel = interaction.options.getChannel(
        "channel",
      ) as TextChannel;
      const category = interaction.options.getChannel("category");
      if (!category)
        return interaction.reply({
          content: "❌ একটি বৈধ ক্যাটাগরি সিলেক্ট করুন",
          ephemeral: true,
        });

      if (!config[guildId]) config[guildId] = {};
      config[guildId].ticketCategory = category.id;
      saveJSON("./data/config.json", config);

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("📩 সাপোর্ট টিকেট প্যানেল")
        .setDescription(
          "আপনার যদি কোনো সাহায্য বা অভিযোগ থাকে, তবে নিচের বাটনে ক্লিক করে একটি সাপোর্ট টিকেট ওপেন করুন। আমাদের টিম দ্রুত যোগাযোগ করবে।",
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("টিকেট ওপেন করুন")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("✉️"),
      );

      await targetChannel.send({ embeds: [embed], components: [row] });
      await interaction.reply({
        content: "✅ টিকেট প্যানেল সফলভাবে তৈরি হয়েছে!",
        ephemeral: true,
      });
    }

    if (commandName === "nukeuser") {
      const targetUser = interaction.options.getUser("target");
      if (!targetUser) return interaction.reply("❌ ইউজার পাওয়া যায়নি।");
      await interaction.reply({
        content:
          "⏳ অল-টাইম মেসেজ ডিলিট করার অ্যাকশন ব্যাকগ্রাউন্ডে প্রসেস করা হচ্ছে...",
        ephemeral: true,
      });
      await nukeAllUserMessages(guild, targetUser.id, txtChannel);
    }
  }

  // 📩 টিকেট বাটন ইন্টারঅ্যাকশন ফিক্স
  if (interaction.isButton() && interaction.customId === "create_ticket") {
    const { guild, user } = interaction;
    if (!guild) return;
    await interaction.deferReply({ ephemeral: true });

    const parentId = config[guild.id]?.ticketCategory;

    // ফিক্স: চ্যানেল তৈরি এবং রিড হিস্ট্রি পারমিশন অ্যাড করা হলো
    const ticketChannel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: ChannelType.GuildText,
      parent: parentId || undefined,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory, // নতুন অ্যাড করা হলো
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setColor("#00ffcc")
      .setTitle("🎟️ সাপোর্ট টিকেট ওপেন হয়েছে")
      .setDescription(
        `হ্যালো <@${user.id}>, আমাদের সাপোর্ট টিমে আপনাকে স্বাগতম। আপনার সমস্যাটি এখানে বিস্তারিত লিখুন। স্টাফ মেম্বাররা দ্রুতই আপনার সাথে যোগাযোগ করবে।`,
      )
      .setTimestamp();

    await ticketChannel.send({
      content: `${user} | <@&${guild.roles.highest.id}>`,
      embeds: [ticketEmbed],
    });
    await interaction.editReply({
      content: `✅ আপনার টিকেট চ্যানেল তৈরি হয়েছে: ${ticketChannel}`,
    });
  }
});

// --- ৫. মেসেজ ইভেন্ট (Prefix, AI Filter & Spam Protection) ---
client.on("messageCreate", async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  const channel = message.channel as TextChannel;

  // 🛡️ স্প্যাম প্রটেকশন লেয়ার
  if (message.attachments.size >= 4) {
    await message.delete().catch(() => {});
    await channel.send(
      `⚠️ <@${message.author.id}>, একসাথে অতিরিক্ত ফাইল আপলোড করা স্প্যামিংয়ের আওতাভুক্ত। অনুগ্রহ করে বিরত থাকুন।`,
    );
    return;
  }

  // প্রিফিক্স কমান্ড হ্যান্ডলিং
  if (message.content.startsWith(PREFIX)) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === "help") {
      await handleHelpCommand(channel);
      return;
    }

    if (command === "nukeuser") {
      if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
        await message.reply(
          "❌ এই কমান্ডটি ব্যবহার করার জন্য আপনার Admin পারমিশন নেই।",
        );
        return;
      }
      const targetMember = message.mentions.members?.first();
      if (!targetMember) {
        await message.reply(
          "❌ অনুগ্রহ করে কোনো ইউজারকে মেনশন করুন। (উদা: !nukeuser @username)",
        );
        return;
      }
      await nukeAllUserMessages(message.guild, targetMember.id, channel);
      return;
    }
  }

  // 🤖 Gemini AI টক্সিসিটি ও ব্যাড-ওয়ার্ড ফিল্টার
  const cleanText = message.content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
  const badWords: string[] = loadJSON("./data/badWords.json", ["fuck", "shit"]);
  let isToxic = badWords.some((word) => cleanText.includes(word));

  if (!isToxic) {
    isToxic = await checkToxicity(message.content);
  }

  if (!isToxic) return;

  // খারাপ কন্টেন্ট ডিটেকশন অ্যাকশন
  await message.delete().catch(() => {});
  const userId = message.author.id;
  warnings[userId] = (warnings[userId] || 0) + 1;
  saveJSON("./data/warnings.json", warnings);
  const currentWarnings = warnings[userId];

  const logChannelId = config[message.guild.id]?.logChannel;
  if (logChannelId) {
    const logChannel = message.guild.channels.cache.get(
      logChannelId,
    ) as TextChannel;
    logChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("🚫 অশালীন ভাষা শনাক্ত!")
          .addFields(
            { name: "ইউজার", value: `<@${userId}>`, inline: true },
            {
              name: "সতর্কতা কাউন্ট",
              value: `${currentWarnings}/5`,
              inline: true,
            },
            { name: "মেসেজ সামগ্রী", value: message.content },
          )
          .setTimestamp(),
      ],
    });
  }

  try {
    if (currentWarnings === 4) {
      await message.member?.timeout(
        3600000,
        "টক্সিক ভাষা ব্যবহারের চূড়ান্ত সতর্কবার্তা।",
      );
      await message.author.send(
        `⚠️ **REGIX মডারেশন:** আপনাকে ১ ঘণ্টার জন্য মিউট করা হয়েছে। এটি আপনার **৪/৫** নম্বর সতর্কতা।`,
      );
    } else if (currentWarnings >= 5) {
      await message.member?.ban({
        reason: "বারবার সতর্ক করার পরেও অশালীন ভাষা ব্যবহার করা।",
      });
      await message.author.send(
        "🚫 **REGIX মডারেশন:** নিয়ম ভঙ্গ করে ৫ বার গালি দেওয়ার কারণে আপনাকে সার্ভার থেকে স্থায়ীভাবে **Ban** করা হয়েছে।",
      );
      delete warnings[userId];
      saveJSON("./data/warnings.json", warnings);
    } else {
      await message.author.send(
        `⚠️ **REGIX মডারেশন:** সার্ভারে অশালীন ভাষা ব্যবহার করা নিষেধ। আপনার সতর্কতা কাউন্ট: **${currentWarnings}/5**।`,
      );
    }
  } catch (err) {
    console.error("Error executing rule moderation action:", err);
  }
});

// --- ৬. মেম্বার জয়েনিং ইভেন্ট ---
client.on("guildMemberAdd", async (member: GuildMember) => {
  const welcomeChannelId = config[member.guild.id]?.welcomeChannel;
  if (!welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(
    welcomeChannelId,
  ) as TextChannel;
  if (!channel) return;

  const welcomeEmbed = new EmbedBuilder()
    .setColor("#00ff66")
    .setTitle(`👋 স্বাগতম, ${member.user.username}!`)
    .setDescription(`আমাদের **${member.guild.name}** সার্ভারে আপনাকে স্বাগতম।`)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields({
      name: "মেম্বার পজিশন",
      value: `${member.guild.memberCount} তম সদস্য`,
    })
    .setTimestamp();

  channel.send({ content: `স্বাগতম <@${member.id}>!`, embeds: [welcomeEmbed] });
});

client.login(process.env.TOKEN);
