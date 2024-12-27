import dotenv from 'dotenv';
dotenv.config();

import { Hono } from 'hono';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { handle } from 'hono/aws-lambda'

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

const BASE_URL = process.env.LAMBDA_BASE_URL

async function processPullRequest(owner: string, repo: string, commit: string): Promise<string> {
  try {
    console.log('Processing pull request for commit:', commit);
    const { diff, files } = await (async () => {
      const response = await octokit.repos.getCommit({
        owner,
        repo,
        ref: commit,
      });

      console.log(response.data)
      const files = response.data.files?.map(file => file.filename) || [];
      const diff = response.data.files
        ?.map(file => `File: ${file.filename}\n${file.patch || ''}`)
        .join('\n\n') || '';

      return { diff, files };
    })();

    const review = await (async () => {
      const prompt = `Please review the following code changes and provide a detailed review:
      
      Files changed: ${files.join(', ')}
      
      Diff:
      ${diff}
      
      
For this review, please:
1. Analyze code quality, readability, and potential bugs
2. Check for security issues and best practices
3. Suggest performance improvements
4. Review naming conventions and code style
5. Identify test coverage gaps

Format your response as follows:
- Critical Issues: List any major problems that must be fixed
- Suggestions: Less urgent improvements that would enhance the code
- Positive Aspects: What was done well
- Specific Code Feedback: Line-by-line comments where relevant

Please be thorough but practical in your recommendations, focusing on the most impactful changes first.`;
      console.log(prompt)
      const completion = await openai.chat.completions.create({
        model: "deepseek/deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      });
      console.log(completion.choices[0].message.content)
      return completion.choices[0].message.content || 'No review generated';
    })();

    console.log(review)

    // Post review as a comment
    await octokit.repos.createCommitComment({
      owner,
      repo,
      commit_sha: commit,
      body: review,
    });

    return 'Review submitted successfully';
  } catch (error) {
    console.error('Error processing pull request:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
}

const app = new Hono();

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

function timeout(ms: number) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms));
}


app.post('/', async (c) => {
  try {
    const payload = await c.req.json();
    const [owner, repo] = payload.repository.full_name.split('/');

    const response = await Promise.race([
      fetch(`${BASE_URL}/review?owner=${owner}&repo=${repo}&payload=${payload.after}`),
      // timeout because of github webhook timeout
      timeout(1500)
    ]);

    console.log(response);
    console.log('Review submitted successfully');
    return c.json({ 
      status: 'success',
    }, 200);
  } catch (error) {
    console.error('Error:', error);
    return c.json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});


app.get('/review', async (c) => {
  console.log("review endpoint hit")
  const owner = c.req.query('owner') ;
  const repo = c.req.query('repo');
  const payload = c.req.query('payload');
  if(!owner || !repo || !payload) {
    return c.json({ 
      status: 'error',
      message: 'Missing owner, repo, or payload'
    }, 400);
  }
  await processPullRequest(owner, repo, payload);
  return c.json({ 
    status: 'success',
  }, 200);
});

export const handler = handle(app)

