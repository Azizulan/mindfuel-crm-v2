import { GoogleGenAI } from "@google/genai";
import { Customer } from "../types";

const generateSalesScript = async (customer: Customer): Promise<string> => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("API key not found.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const systemInstruction = "You are an expert tele-sales agent for a healthy snacks brand in Bangladesh. Your task is to generate highly persuasive and personalized sales scripts in Bengali (Bangla). Your tone must be very friendly, warm, and natural, like talking to a friend, but still professional. Avoid overly formal or robotic language. The goal is to build a relationship and achieve a high conversion rate.";

    const userPrompt = `
      Please generate a highly persuasive and personalized sales script in Bengali for a follow-up call to a customer named ${customer.name}.

      Customer Information:
      - Last Purchase Date: ${new Date(customer.lastPurchaseDate).toLocaleDateString()}
      - Total Purchases: ${customer.purchaseCount}
      - Known Purchased Products: ${customer.purchaseHistory}
      ${customer.address ? `- Address: ${customer.address}` : ''}

      The script must be in Bengali and have three distinct parts with Bengali headings. Follow these instructions carefully to make it effective:

      ১. **শুরু (Opening):**
         - Greet them warmly using their name (e.g., "আসসালামু আলাইকুম, ${customer.name} ভাই/আপা").
         - Immediately mention their last purchased product ("${customer.purchaseHistory.split(',')[0]}") to show you remember them.
         - Ask how their experience was with the product in a friendly way. This builds rapport.

      ২. **অফার (Offer):**
         - Smoothly transition from their previous purchase to a new, complementary product suggestion. For example, if they bought peanut butter, suggest granola or muesli.
         - Highlight 1-2 key benefits of the new product that are highly appealing. Focus on health, taste, or convenience.
         - Create a compelling, limited-time offer. For example, mention a special discount for returning customers or a combo offer that is only valid for a short period. This creates urgency.

      ৩. **সমাপ্তি (Closing):**
         - If they are interested, clearly explain the next steps to place an order.
         - If they are not interested, be very polite. Thank them for their time and for being a valued customer. Mention that you hope they will consider your products in the future.
         - End the call on a positive and friendly note to maintain a good relationship.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userPrompt,
        config: {
          systemInstruction,
        },
    });

    return response.text || "স্ক্রিপ্ট তৈরিতে কোনো টেক্সট পাওয়া যায়নি।";
  } catch (error) {
    console.error("Error generating sales script:", error);
    return "স্ক্রিপ্ট তৈরিতে একটি ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন। আপনার Gemini API কী সঠিকভাবে কনফিগার করা আছে কিনা তা নিশ্চিত করুন।";
  }
};

export default generateSalesScript;
