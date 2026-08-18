# Make external-host AI setup self-documenting

## Problem
The app works in the Lovable preview because `LOVABLE_API_KEY` is injected automatically, but fails on Netlify with "AI is not configured. Missing LOVABLE_API_KEY." Users do not know they must add a `GEMINI_API_KEY` environment variable in Netlify.

## Goal
Make it obvious where and how to add the API key for external hosting, and ensure the deployed app explains the fix in its own error UI.

## Plan

1. **Update README deployment section**
   - Add a "Deploying to Netlify" subsection.
   - List the required environment variable: `GEMINI_API_KEY`.
   - Include the exact Netlify path: Site settings → Environment variables → Add variable.
   - Note that Production (and optionally Deploy Previews / Branch deploys) must have the key.
   - Include the Gemini API key link: https://aistudio.google.com/apikey.

2. **Improve the in-app error message**
   - In `src/lib/gemini-analysis.server.ts`, change the missing-key error to explicitly say:
     "AI is not configured. Add GEMINI_API_KEY to Netlify Site settings → Environment variables and redeploy."
   - Keep the existing fallback behavior (Lovable AI Gateway first, then direct Gemini API).

3. **Add a small setup hint on the analyze page**
   - When the analysis fails with a configuration error, show a one-line hint below the toast:
     "Deploying outside Lovable? Set GEMINI_API_KEY in your hosting provider's environment variables."

## Out of scope
- No Supabase or Lovable Cloud changes.
- No changes to the analysis model or report format.
