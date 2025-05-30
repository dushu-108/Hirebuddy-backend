// In backend/controllers/resumeController.js
import { unlinkSync } from "fs";
import parsePDF from "../utils/pdfParser.js";
import { extractSkills, predictJobRole } from '../services/geminiSkillExtractor.js';
import { matchJobsWithAI } from "../services/geminiJobMatcher.js";

export async function handleResumeUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const filePath = req.file.path;
    
    try {
      // Extract text from PDF
      const resumeText = await parsePDF(filePath);
      
      // Extract skills and basic info
      const { skills, experience } = await extractSkills(resumeText);
      
      // Get AI-matched jobs
      const matchedJobs = await matchJobsWithAI(skills);

      // Clean up the uploaded file
      unlinkSync(filePath);

      res.json({
        success: true,
        data: {
          extractedSkills: skills,
          experience,
          matchedJobs: matchedJobs || []
        }
      });

    } catch (error) {
      // Clean up file in case of error
      if (filePath) {
        try { unlinkSync(filePath); } catch (e) { /* Ignore cleanup errors */ }
      }
      throw error;
    }

  } catch (error) {
    console.error('Resume processing error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process resume',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}