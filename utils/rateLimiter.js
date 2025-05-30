import { RateLimiterMemory } from 'rate-limiter-flexible';

// Configure rate limiter with 15 requests per minute (as per Gemini API free tier)
const rateLimiter = new RateLimiterMemory({
    points: 15, // Number of points
    duration: 60, // Per second
    blockDuration: 60 // Block for 1 minute if limit is exceeded
});

export const withRateLimit = async (fn, ...args) => {
    try {
        await rateLimiter.consume('gemini-api');
        return await fn(...args);
    } catch (rejRes) {
        if (rejRes instanceof Error) throw rejRes;
        console.log(`Rate limit exceeded. Waiting ${rejRes.msBeforeNext}ms before retrying...`);
        await new Promise(resolve => setTimeout(resolve, rejRes.msBeforeNext));
        return await fn(...args);
    }
};
