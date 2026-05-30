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
import fs from "fs";
import { checkToxicity } from "./services/geminiService";
import { db } from "./utils/db"; // প্রিজমা ডাটাবেস ক্লায়েন্ট

dotenv.config();

const PREFIX = "!";
// .env থেকে অনুমোদিত গ্লোবাল ইউজারদের লিস্ট অ্যারে আকারে নেওয়া
const ALLOWED_USERS = process.env.ALLOWED_USERS?.split(",") || [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// লোকাল ব্যাড-ওয়ার্ড ফাইল লোড করার মেথড
const loadBadWords = (): string[] => {
  try {
    if (fs.existsSync("./data/badWords.json")) {
      const data = fs.readFileSync("./data/badWords.json", "utf8").trim();
      return data ? JSON.parse(data) : ["fuck", "shit"];
    }
  } catch (e) {
    console.error("Error loading badWords JSON:", e);
  }
  return ["fuck", "shit"];
};

const badWords = loadBadWords();

// --- ১. স্ল্যাশ কমান্ড রেজিস্ট্রেশন (অ্যারে) ---
const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("REGIX বটের সব কমান্ডের তালিকা দেখুন"),

  new SlashCommandBuilder()
    .setName("restore")
    .setDescription(
      "চ্যানেলে ডিলিট হওয়া সর্বশেষ মেসেজটি রিস্টোর বা পুনরুদ্ধার করুন",
    ),

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
    ),

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
    ),

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
    ),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN as string);

client.once("ready", async () => {
  try {
    if (client.user) {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commands,
      });
      console.log(
        `✅ ${client.user.tag} প্রিজমা ও কঠোর সিকিউরিটি মোডে রেডি আছে!`,
      );
    }
  } catch (error) {
    console.error(error);
  }
});

// --- ২. অল-টাইম মেসেজ ডিলিট করার কোর ফাংশন (Nuke All Chats) ---
async function nukeAllUserMessages(
  guild: any,
  targetUserId: string,
  outputChannel: TextChannel,
) {
  try {
    await outputChannel.send(
      `🧹 <@${targetUserId}> এর অল-টাইম মেসেজ খোঁজা এবং সমস্ত চ্যাট থেকে ডিলিট করার প্রক্রিয়া শুরু হচ্ছে...`,
    );

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
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        lastMessageId = messages.last()?.id;
        if (messages.size < 100) fetching = false;
      }
    }
    await outputChannel.send(
      `✅ সফলভাবে সম্পন্ন হয়েছে! <@${targetUserId}> এর মোট **${totalDeleted}** টি মেসেজ সমস্ত চ্যাট থেকে মুছে ফেলা হয়েছে।`,
    );
  } catch (error) {
    console.error("Nuke Function Error:", error);
  }
}

// --- ৩. হেল্প কমান্ড রেসপন্স ম্যানেজার ---
async function handleHelpCommand(channel: TextChannel) {
  const helpEmbed = new EmbedBuilder()
    .setColor("#00f2fe")
    .setTitle("🛡️ REGIX মাল্টি-ফাংশনাল ডাটাবেস হাইব্রিড গাইড")
    .setDescription(
      `স্ল্যাশ (\`/\`) অথবা প্রিফিক্স (\`${PREFIX}\`) উভয়ভাবেই কমান্ড রান করা যাবে।\n\n**কমান্ডসমূহ:**\n🔹 \`help\` - বটের গাইডলাইন\n🔹 \`restore\` - ডিলিট হওয়া লাস্ট মেসেজ রিস্টোর\n🔹 \`setup\` - লগ ও ওয়েলকাম চ্যানেল সেটআপ\n🔹 \`ticket-setup\` - সাপোর্ট টিকেট প্যানেল\n🔹 \`nukeuser <@user>\` - ইউজারের অল-টাইম সব মেসেজ ডিলিট`,
    );

  await channel.send({ embeds: [helpEmbed] });
}

// --- ৪. স্ল্যাশ কমান্ড ও বাটন ইন্টারঅ্যাকশন হ্যান্ডলার (Merged & Protected) ---
client.on("interactionCreate", async (interaction: Interaction) => {
  // 💻 ক) স্ল্যাশ কমান্ড হ্যান্ডলিং এবং এক্সেস গেট
  if (interaction.isChatInputCommand()) {
    const { commandName, guildId, guild, channel } = interaction;
    if (!guildId || !guild || !channel || !channel.isTextBased()) return;
    const txtChannel = channel as TextChannel;

    const userId = interaction.user.id;
    const isServerOwner = guild.ownerId === userId;
    const isWhitelistedUser = ALLOWED_USERS.includes(userId);

    // 🚨 কঠোর সিকিউরিটি গেট: অনার বা নির্দিষ্ট ইউজার না হলে কমান্ড ব্লক
    if (!isServerOwner && !isWhitelistedUser) {
      return interaction.reply({
        content:
          "❌ **Access Denied:** You are not authorized to use REGIX AI actions. This bot is strictly reserved for Server Owners and authorized specific users.",
        ephemeral: true,
      });
    }

    // help কমান্ড
    if (commandName === "help") {
      await interaction.deferReply({ ephemeral: true });
      await handleHelpCommand(txtChannel);
      await interaction.editReply("✅ হেল্প মেনু পাঠানো হয়েছে।");
    }

    // restore কমান্ড
    if (commandName === "restore") {
      await interaction.deferReply({ ephemeral: true });
      try {
        const lastDeleted = await db.deletedMessage.findFirst({
          where: { channelId: interaction.channelId },
          orderBy: { createdAt: "desc" },
        });

        if (!lastDeleted) {
          return interaction.editReply(
            "No recently deleted messages found in this channel.",
          );
        }

        const embed = new EmbedBuilder()
          .setTitle("🔄 Restored Deleted Message")
          .setDescription(lastDeleted.content)
          .setColor("#00f2fe")
          .addFields(
            {
              name: "Sent By",
              value: `<@${lastDeleted.authorId}> (${lastDeleted.authorTag})`,
              inline: true,
            },
            {
              name: "Channel",
              value: `<#${lastDeleted.channelId}>`,
              inline: true,
            },
          )
          .setTimestamp(lastDeleted.createdAt);

        await txtChannel.send({ embeds: [embed] });
        await db.deletedMessage.delete({ where: { id: lastDeleted.id } });
        await interaction.editReply(
          "Successfully restored the last deleted message.",
        );
      } catch (error) {
        console.error(error);
        await interaction.editReply(
          "An error occurred while restoring the message.",
        );
      }
    }

    // setup কমান্ড
    if (commandName === "setup") {
      const logChan = interaction.options.getChannel("log");
      const welChan = interaction.options.getChannel("welcome");

      await db.guildConfig.upsert({
        where: { guildId },
        update: {
          ...(logChan && { logChannel: logChan.id }),
          ...(welChan && { welcomeChannel: welChan.id }),
        },
        create: {
          guildId,
          logChannel: logChan?.id || null,
          welcomeChannel: welChan?.id || null,
        },
      });

      await interaction.reply(
        "✅ ডাটাবেসে কনফিগারেশন সফলভাবে আপডেট করা হয়েছে!",
      );
    }

    // ticket-setup কমান্ড
    if (commandName === "ticket-setup") {
      const targetChannel = interaction.options.getChannel(
        "channel",
      ) as TextChannel;
      const category = interaction.options.getChannel("category");
      if (!category) {
        return interaction.reply({
          content: "❌ একটি বৈধ ক্যাটাগরি সিলেক্ট করুন",
          ephemeral: true,
        });
      }

      await db.guildConfig.upsert({
        where: { guildId },
        update: { ticketCategory: category.id },
        create: { guildId, ticketCategory: category.id },
      });

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
        content: "✅ টিকেট প্যানেল ডাটাবেস ট্র্যাকিং সহ তৈরি হয়েছে!",
        ephemeral: true,
      });
    }

    // nukeuser কমান্ড
    if (commandName === "nukeuser") {
      const targetUser = interaction.options.getUser("target");
      if (!targetUser) return interaction.reply("❌ ইউজার পাওয়া যায়নি।");
      await interaction.reply({
        content:
          "⏳ অল-টাইম মেসেজ ডিলিট করার অ্যাকশন ব্যাকগ্রাউন্ডে প্রসেস করা হচ্ছে...",
        ephemeral: true,
      });
      await nukeAllUserMessages(guild, targetUser.id, txtChannel);
    }
  }

  // 📩 খ) টিকেট বাটন ইন্টারঅ্যাকশন (সদস্যদের জন্য উম্মুক্ত রাখতে গেটের বাইরে রাখা হয়েছে)
  if (interaction.isButton() && interaction.customId === "create_ticket") {
    const { guild, user } = interaction;
    if (!guild) return;
    await interaction.deferReply({ ephemeral: true });

    const guildConfig = await db.guildConfig.findUnique({
      where: { guildId: guild.id },
    });
    const parentId = guildConfig?.ticketCategory;

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
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setColor("#00ffcc")
      .setTitle("🎟️ সাপোর্ট টিকেট ওপেন হয়েছে")
      .setDescription(
        `হ্যালো <@${user.id}>, আমাদের সাপোর্ট টিমে আপনাকে স্বাগতম। আপনার সমস্যাটি এখানে বিস্তারিত লিখুন।`,
      )
      .setTimestamp();

    await ticketChannel.send({
      content: `${user} | <@&${guild.roles.highest.id}>`,
      embeds: [ticketEmbed],
    });
    await interaction.editReply({
      content: `✅ আপনার টিকেট চ্যানেল তৈরি হয়েছে: ${ticketChannel}`,
    });
  }
});

// --- ৫. মেসেজ ইভেন্ট (Prefix, AI Filter, DB Warning System & Authorizations) ---
client.on("messageCreate", async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  const channel = message.channel as TextChannel;
  const guildId = message.guild.id;

  // 🛡️ স্প্যাম প্রটেকশন লেয়ার
  if (message.attachments.size >= 4) {
    await message.delete().catch(() => {});
    await channel.send(
      `⚠️ <@${message.author.id}>, একসাথে অতিরিক্ত ফাইল আপলোড করা স্প্যামিংয়ের আওতাভুক্ত। অনুগ্রহ করে বিরত থাকুন।`,
    );
    return;
  }

  // প্রিফিক্স কমান্ড হ্যান্ডলিং
  if (message.content.startsWith(PREFIX)) {
    const userId = message.author.id;
    const isServerOwner = message.guild.ownerId === userId;
    const isWhitelistedUser = ALLOWED_USERS.includes(userId);

    // 🚨 প্রিফিক্স কমান্ড সিকিউরিটি চেক
    if (!isServerOwner && !isWhitelistedUser) {
      return message
        .reply(
          "❌ **Access Denied:** You are not authorized to use REGIX AI actions.",
        )
        .catch(() => {});
    }

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === "help") {
      await handleHelpCommand(channel);
      return;
    }

    if (command === "nukeuser") {
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

  // 🤖 Gemini AI টক্সিসিটি ও ব্যাড-ওয়ার্ড ফিল্টার
  const cleanText = message.content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
  let isToxic = badWords.some((word) => cleanText.includes(word));

  if (!isToxic) {
    isToxic = await checkToxicity(message.content);
  }

  if (!isToxic) return;

  // খারাপ কন্টেন্ট ডিটেকশন অ্যাকশন
  await message.delete().catch(() => {});
  const userId = message.author.id;

  const userWarning = await db.userWarning.upsert({
    where: { userId_guildId: { userId, guildId } },
    update: { count: { increment: 1 } },
    create: { userId, guildId, count: 1 },
  });

  const currentWarnings = userWarning.count;
  const guildConfig = await db.guildConfig.findUnique({ where: { guildId } });

  if (guildConfig?.logChannel) {
    const logChannel = message.guild.channels.cache.get(
      guildConfig.logChannel,
    ) as TextChannel;
    logChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("🚫 অশালীন ভাষা শনাক্ত (ডাটাবেস ট্রাঞ্জেকশন)")
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
        "টক্সিক ভাষা ব্যবহারের চূড়ান্ত সতর্কবার্তা।",
      );
      await message.author
        .send(
          `⚠️ **REGIX মডারেশন:** আপনাকে ১ ঘণ্টার জন্য মিউট করা হয়েছে। এটি আপনার **৪/৫** নম্বর সতর্কতা।`,
        )
        .catch(() => {});
    } else if (currentWarnings >= 5) {
      await message.member?.ban({
        reason: "বারবার সতর্ক করার পরেও অশালীন ভাষা ব্যবহার করা।",
      });
      await message.author
        .send(
          "🚫 **REGIX মডারেশন:** নিয়ম ভঙ্গ করে ৫ বার গালি দেওয়ার কারণে আপনাকে সার্ভার থেকে স্থায়ীভাবে **Ban** করা হয়েছে Bound.",
        )
        .catch(() => {});

      await db.userWarning
        .delete({ where: { userId_guildId: { userId, guildId } } })
        .catch(() => {});
    } else {
      await message.author
        .send(
          `⚠️ **REGIX মডারেশন:** সার্ভারে অশালীন ভাষা ব্যবহার করা নিষেধ। আপনার সতর্কতা কাউন্ট: **${currentWarnings}/5**।`,
        )
        .catch(() => {});
    }
  } catch (err) {
    console.error("Error executing moderation action:", err);
  }
});

// --- ৬. মেসেজ ডিলিট ট্র্যাকিং ইভেন্ট (ডাটাবেস লগার) ---
client.on("messageDelete", async (message) => {
  if (message.partial || message.author?.bot || !message.content) return;

  try {
    await db.deletedMessage.create({
      data: {
        content: message.content,
        authorId: message.author.id,
        authorTag: message.author.tag,
        channelId: message.channel.id,
        guildId: message.guildId || "",
      },
    });
  } catch (error) {
    console.error("Error saving deleted message:", error);
  }
});

// --- ৭. মেম্বার জয়েনিং ইভেন্ট ---
client.on("guildMemberAdd", async (member: GuildMember) => {
  const guildConfig = await db.guildConfig.findUnique({
    where: { guildId: member.guild.id },
  });
  const welcomeChannelId = guildConfig?.welcomeChannel;
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
