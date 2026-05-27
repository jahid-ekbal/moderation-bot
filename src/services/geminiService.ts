import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const checkToxicity = async (text: string): Promise<boolean> => {
  if (!text.trim()) return false;

  try {
    // এখানে সচল এবং সঠিক মডেল "gemini-2.0-flash" সেট করা হয়েছে
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Analyze the following text for severe profanity, toxicity, highly offensive behavior, cyberbullying, or explicit slurs in English, Bengali, or Banglish language. 
    Respond with exactly one word: "true" if it contains bad words/toxicity, and "false" if it is clean.
    
    Text to analyze: "${text}"`;

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const resultText = response.response.text()?.trim().toLowerCase();

    return resultText ? resultText.includes("true") : false;
  } catch (error: any) {
    // কোটা লিমিট বা ৪২৯ এরর আসলে বট ক্র্যাশ না করে সেফলি স্কিপ করবে
    if (error?.status === 429) {
      console.warn(
        "⚠️ Gemini API Rate limit reached. Skipping AI check for this message.",
      );
    } else {
      console.error("Gemini AI API Error:", error);
    }
    return false;
  }
};
