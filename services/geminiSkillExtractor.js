import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { withRateLimit } from "../utils/rateLimiter.js";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('Missing Gemini API key! Make sure GEMINI_API_KEY is set in your .env file');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const cache = new Map();

const extractFromGemini = async (prompt, cacheKey, parseFunction) => {
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    try {
        console.log('Sending request to Gemini with prompt:', prompt.substring(0, 200) + '...'); // Log first 200 chars
        const result = await withRateLimit(() => model.generateContent(prompt));
        const response = result.response;
        console.log('Received Gemini response');
        
        const text = await withRateLimit(() => response.text());
        console.log('Gemini response text:', text.substring(0, 200) + '...'); // Log first 200 chars
        
        const resultData = await parseFunction(text);
        cache.set(cacheKey, resultData);
        return resultData;
    } catch (err) {
        console.error('Gemini API Error Details:', {
            message: err.message,
            stack: err.stack,
            code: err.code,
            status: err.status
        });
        throw new Error('Failed to process with Gemini AI: ' + err.message);
    }
};

export const extractSkills = async (resumeText) => {
    const prompt = `
Given the following resume content, extract a list of relevant professional skills. 
Return a JSON object with:
- skills: array of technical skills and tools
- experience: years of experience as a number
- education: highest education level

Resume:
${resumeText.substring(0, 10000)}`;

    const parseResponse = (text) => {
        try {
            const jsonMatch = text.match(/```json\s*([^`]+)```/s);
            const jsonString = jsonMatch ? jsonMatch[1].trim() : text.trim();
            const result = JSON.parse(jsonString);
            
            // Ensure we have at least the skills array
            if (!result.skills || !Array.isArray(result.skills)) {
                throw new Error('Invalid skills format');
            }
            
            return {
                skills: result.skills,
                experience: result.experience || 0,
                education: result.education || 'Not specified'
            };
        } catch (parseErr) {
            console.error("Failed to parse Gemini response:", parseErr);
            return {
                skills: [],
                experience: 0,
                education: 'Not specified'
            };
        }
    };

    return extractFromGemini(prompt, `skills_${resumeText.hashCode()}`, parseResponse);
};

export const predictJobRole = async (resumeText, skills, experience) => {
    const prompt = `
Based on the following resume content, skills, and experience, predict the most suitable job role.
Return a JSON object with:
- predictedRole: most suitable job title
- confidence: high/medium/low
- reason: brief explanation

Resume Summary:
${resumeText.substring(0, 5000)}

Skills: ${skills.join(', ')}
Experience: ${experience} years`;

    const parseResponse = (text) => {
        try {
            const jsonMatch = text.match(/```json\s*([^`]+)```/s);
            const jsonString = jsonMatch ? jsonMatch[1].trim() : text.trim();
            const result = JSON.parse(jsonString);
            
            // Default values if fields are missing
            return {
                predictedRole: result.predictedRole || 'Professional',
                confidence: result.confidence || 'medium',
                reason: result.reason || 'Based on skills and experience'
            };
        } catch (parseErr) {
            console.error("Failed to parse job role prediction:", parseErr);
            return {
                predictedRole: 'Professional',
                confidence: 'low',
                reason: 'Default role based on general skills'
            };
        }
    };

    return extractFromGemini(prompt, `role_${resumeText.hashCode()}`, parseResponse);
};

// Add hash function to String prototype for caching
String.prototype.hashCode = function() {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
        const char = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
};