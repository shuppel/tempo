import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

console.log('API Key available:', !!process.env.ANTHROPIC_API_KEY);

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json();

    if (action === 'refineTask') {
      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 150,
        messages: [{
          role: "user",
          content: `Refine this task description to be clear and actionable. Extract a title and optional description. Estimate difficulty on a scale of 1-100:
          
          ${data.taskInput}
          
          Respond in JSON format:
          {
            "title": "Brief, clear title",
            "description": "Detailed description if needed",
            "difficulty": number (1-100)
          }`
        }]
      });

      try {
        const content = message.content[0].type === 'text' ? message.content[0].text : null;
        if (!content) {
          throw new Error('No text content in AI response');
        }
        // Validate that we got valid JSON
        JSON.parse(content);
        return NextResponse.json({ content });
      } catch (parseError) {
        console.error('Invalid JSON response from Claude:', message.content);
        return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 });
      }
    }

    if (action === 'organizeTasks') {
      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Organize these tasks into logical groups for efficient completion. Consider task relationships and dependencies:
          
          ${JSON.stringify(data.tasks)}
          
          Respond with JSON array of groups:
          [{
            "id": "unique-id",
            "tasks": ["task-id-1", "task-id-2"],
            "name": "Group name"
          }]`
        }]
      });

      try {
        const content = message.content[0].type === 'text' ? message.content[0].text : null;
        if (!content) {
          throw new Error('No text content in AI response');
        }
        // Validate that we got valid JSON
        JSON.parse(content);
        return NextResponse.json({ content });
      } catch (parseError) {
        console.error('Invalid JSON response from Claude:', message.content);
        return NextResponse.json({ error: 'Invalid response format from AI' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('API Error:', error);
    
    // Check for rate limiting errors from Anthropic
    if (error instanceof Error && 
        (error.message.includes('429') || 
         error.message.includes('529') || 
         error.message.includes('rate limit') ||
         error.message.includes('overloaded'))) {
      console.warn('Rate limit error from Anthropic API detected');
      return NextResponse.json({
        error: 'Service temporarily overloaded. Please try again in a few moments.',
        code: 'RATE_LIMITED',
        details: error.message
      }, { status: 429 });
    }
    
    if (error instanceof Error && error.message.includes('authentication')) {
      return NextResponse.json({ error: 'API authentication failed. Please check API key configuration.' }, { status: 401 });
    }
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 