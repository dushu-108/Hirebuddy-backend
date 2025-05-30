import Job from "../models/job.js";
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

const SKILL_CATEGORIES = {
    IT: [
        'javascript', 'python', 'java', 'node.js', 'react', 'angular', 'vue', 'sql', 'aws', 'azure',
        'docker', 'kubernetes', 'devops', 'cloud', 'database', 'full stack', 'backend', 'frontend',
        'software', 'developer', 'engineer', 'programming', 'coding', 'tech', 'technology'
    ],
    Engineering: [
        'civil', 'mechanical', 'electrical', 'structural', 'mechanics', 'materials', 'drafting',
        'cad', 'autocad', 'solidworks', 'revit', 'engineer', 'engineering', 'design', 'construction',
        'mechanical', 'electrical', 'civil'
    ],
    Science: [
        'biology', 'chemistry', 'physics', 'research', 'laboratory', 'lab', 'microbiology',
        'genetics', 'biochemistry', 'pharmaceutical', 'science', 'scientist', 'researcher',
        'laboratory', 'lab'
    ],
    Finance: [
        'finance', 'accounting', 'financial', 'banking', 'investment', 'analyst', 'financial analyst',
        'accountant', 'cpa', 'tax', 'audit'
    ],
    Healthcare: [
        'nurse', 'doctor', 'medical', 'healthcare', 'hospital', 'clinical', 'pharmacy', 'pharmacist',
        'physician', 'health', 'care'
    ],
    Education: [
        'teacher', 'education', 'professor', 'instructor', 'teaching', 'school', 'university',
        'education', 'training', 'tutor'
    ],
    Marketing: [
        'marketing', 'advertising', 'sales', 'promotion', 'digital marketing', 'content', 'social media',
        'brand', 'strategy', 'market'
    ],
    Operations: [
        'operations', 'logistics', 'supply chain', 'management', 'operations manager',
        'logistics coordinator', 'supply chain analyst'
    ],
    Legal: [
        'law', 'legal', 'attorney', 'lawyer', 'paralegal', 'legal assistant', 'litigation',
        'compliance', 'contract'
    ]
};

// Determine the most relevant category based on skills
const determineJobCategory = (skills) => {
    const skillCounts = {};
    
    // Count how many skills match each category
    Object.entries(SKILL_CATEGORIES).forEach(([category, categorySkills]) => {
        skillCounts[category] = skills.filter(skill => 
            categorySkills.some(catSkill => 
                skill.toLowerCase().includes(catSkill.toLowerCase())
            )
        ).length;
    });
    
    // Find the category with the most matching skills
    return Object.entries(skillCounts)
        .reduce((max, [category, count]) => 
            count > max[1] ? [category, count] : max
        )[0] || 'Other';
};

// Cache for job analyses
const jobAnalysisCache = new Map();

// Analyze job relevance using AI
const analyzeJobRelevance = async (resumeSkills, jobDescription) => {
    // Create a cache key based on skills and job description
    const cacheKey = `${JSON.stringify(resumeSkills)}_${jobDescription}`;
    
    // Check cache first
    if (jobAnalysisCache.has(cacheKey)) {
        return jobAnalysisCache.get(cacheKey);
    }

    // First do a quick keyword match to avoid unnecessary API calls
    const prelimMatch = resumeSkills.some(skill => 
        jobDescription.toLowerCase().includes(skill.toLowerCase())
    );
    
    if (!prelimMatch) {
        return { score: 0, reason: "No direct skill matches found" };
    }

    // Create a prompt with multiple jobs at once
    const prompt = `
    Analyze the relevance of these jobs to the candidate's skills. 
    
    Skills: ${JSON.stringify(resumeSkills)}
    
    Job Description:
    ${jobDescription}
    
    Consider:
    1. Direct skill matches
    2. Related skills and technologies
    3. Industry relevance
    4. Experience level requirements

    For each job, respond with a score from 0 to 100 (0 = not relevant, 100 = highly relevant) and a brief explanation.
    Format: {"score": X, "reason": "Brief explanation"}
    `;

    try {
        const result = await withRateLimit(() => model.generateContent(prompt));
        const response = result.response;
        const text = await withRateLimit(() => response.text());
        
        try {
            const analysis = JSON.parse(text);
            // Cache the result
            jobAnalysisCache.set(cacheKey, analysis);
            return analysis;
        } catch (err) {
            console.error("Failed to parse AI response:", err);
            return { score: 0, reason: "Failed to analyze relevance" };
        }
    } catch (error) {
        console.error("Error analyzing job relevance:", error);
        return { score: 0, reason: "Failed to analyze relevance" };
    } finally {
        // Clear old cache entries after 24 hours
        const now = Date.now();
        jobAnalysisCache.forEach((value, key) => {
            if (now - jobAnalysisCache.get(key).timestamp > 24 * 60 * 60 * 1000) {
                jobAnalysisCache.delete(key);
            }
        });
    }
};

export const matchJobsWithAI = async (resumeSkills) => {
    try {
        const mostRelevantCategory = determineJobCategory(resumeSkills);
        
        const jobs = await Job.find({});
        
        const categoryFilteredJobs = jobs.filter(job => {
            const jobDesc = job.job_description.toLowerCase();
            return SKILL_CATEGORIES[mostRelevantCategory].some(keyword => 
                jobDesc.includes(keyword)
            );
        });

        // Local skill matching - score jobs based on direct skill matches
        const locallyMatchedJobs = categoryFilteredJobs.map(job => {
            const jobDesc = job.job_description.toLowerCase();
            const matches = resumeSkills.filter(skill => 
                jobDesc.includes(skill.toLowerCase())
            );
            
            // Calculate a basic score based on number of matches
            const score = matches.length * 20; // Each match = 20 points
            const reason = matches.length > 0 
                ? `Direct matches found: ${matches.join(', ')}`
                : "No direct skill matches found";
            
            return {
                job,
                relevance: score,
                reason,
                isLocalMatch: true
            };
        });

        // Filter out jobs with no local matches
        const filteredJobs = locallyMatchedJobs.filter(job => job.relevance > 0);

        // If we have enough good local matches (score >= 60), return them
        const goodLocalMatches = filteredJobs.filter(job => job.relevance >= 60);
        if (goodLocalMatches.length > 0) {
            return goodLocalMatches
                .map(analysis => ({
                    ...analysis.job,
                    relevance: analysis.relevance,
                    reason: analysis.reason
                }))
                .sort((a, b) => b.relevance - a.relevance);
        }

        // Batch the remaining jobs that need AI analysis
        const BATCH_SIZE = 5;
        const jobsNeedingAI = filteredJobs.map(job => job.job);
        const jobGroups = [];
        for (let i = 0; i < jobsNeedingAI.length; i += BATCH_SIZE) {
            jobGroups.push(jobsNeedingAI.slice(i, i + BATCH_SIZE));
        }

        // Process each batch
        const allAnalyses = [];
        for (const jobGroup of jobGroups) {
            // Create a combined prompt for all jobs in this batch
            const prompt = `
            Analyze the relevance of these jobs to the candidate's skills.
            
            Skills: ${JSON.stringify(resumeSkills)}
            
            Jobs:
            ${jobGroup.map(job => `- ${job.job_description}`).join('\n')}
            
            Consider:
            1. Direct skill matches
            2. Related skills and technologies
            3. Industry relevance
            4. Experience level requirements

            For each job, respond with a score from 0 to 100 (0 = not relevant, 100 = highly relevant) and a brief explanation.
            Format: ["{\"score\": X, \"reason\": \"Brief explanation\"}", "{\"score\": Y, \"reason\": \"Brief explanation\"}"]
            `;

            try {
                const result = await withRateLimit(() => model.generateContent(prompt));
                const response = result.response;
                const text = await withRateLimit(() => response.text());

                // Parse the batch response
                try {
                    const analyses = JSON.parse(text);
                    if (Array.isArray(analyses)) {
                        // Match analyses with jobs
                        for (let i = 0; i < analyses.length; i++) {
                            allAnalyses.push({
                                job: jobGroup[i],
                                relevance: analyses[i].score,
                                reason: analyses[i].reason
                            });
                        }
                    }
                } catch (err) {
                    console.error("Failed to parse batch response:", err);
                    // If parsing fails, fall back to individual analysis
                    for (const job of jobGroup) {
                        const analysis = await analyzeJobRelevance(resumeSkills, job.job_description);
                        allAnalyses.push({
                            job,
                            relevance: analysis.score,
                            reason: analysis.reason
                        });
                    }
                }
            } catch (error) {
                console.error("Error analyzing batch:", error);
                // If batch fails, fall back to individual analysis
                for (const job of jobGroup) {
                    const analysis = await analyzeJobRelevance(resumeSkills, job.job_description);
                    allAnalyses.push({
                        job,
                        relevance: analysis.score,
                        reason: analysis.reason
                    });
                }
            }
        }

        // Filter and sort jobs
        return allAnalyses
            .filter(analysis => analysis.relevance >= 50)
            .map(analysis => ({
                ...analysis.job,
                relevance: analysis.relevance,
                reason: analysis.reason
            }))
            .sort((a, b) => b.relevance - a.relevance);

    } catch (error) {
        console.error('Error matching jobs:', error);
        return [];
    }
};

