import { PrismaClient } from "@prisma/client";

// ভেরিয়েবল বা পাথ ছাড়াই একদম ডিফল্ট ও ক্লিন ইনিশিয়ালাইজেশন
export const db = new PrismaClient();
// অ্যাপ্লিকেশন বন্ধ হওয়ার সময় ডাটাবেস কানেকশন ক্লোজ করার জন্য
