# AI-Powered WoD Section Generation

## Overview

AI-powered section generation for WoD creation. When a user writes a description (5+ characters), a sparkles icon appears next to the description textarea. Clicking it sends the description to an API endpoint that uses Vercel AI SDK + OpenRouter (google/gemini-3-flash-preview) to generate structured workout sections with timer configs.

## Data Flow

```
User types description (5+ chars)
    ↓
Sparkles icon becomes visible/enabled
    ↓
User clicks sparkles icon
    ↓
Confirmation dialog (if sections exist): "Replace existing sections?"
    ↓
POST /api/wods/generate-sections { description }
    ↓
Server calls OpenRouter via AI SDK
    ↓
AI returns structured sections (type, name, content, timerConfig)
    ↓
Client replaces sections array, UI updates
```

## UI Design

### Description Textarea Enhancement

The existing description textarea gets a wrapper with the sparkles icon positioned at the bottom-right corner:

```
┌─────────────────────────────────────────┐
│ Add a brief description of the workout..│
│                                         │
│                                         │
│                                    ✨   │  ← sparkles icon (only visible when 5+ chars)
└─────────────────────────────────────────┘
  0/500 characters
```

### Icon States

- **Hidden**: Description < 5 characters
- **Visible/Idle**: Description >= 5 chars, icon uses sparkles.png image
- **Loading**: Icon replaced with spinner, slightly grayed out
- **Disabled**: During form submission or while generating

### Confirmation Dialog

When sections already exist, show a simple confirm dialog:
> "This will replace your existing X section(s). Continue?"
> [Cancel] [Generate]

### Error Handling

Toast notification at top of screen for API errors (e.g., "Failed to generate sections. Please try again.")

## API Design

### Endpoint

`POST /api/wods/generate-sections`

### Request

```typescript
{ description: string }
```

### Response

```typescript
{
  sections: Array<{
    type: 'warmup' | 'skill' | 'wod' | 'cooldown' | 'stretches' | 'custom';
    name: string;
    content: string;
    timerConfig: {
      type: 'amrap' | 'fortime' | 'emom' | 'tabata';
      duration?: number;      // seconds
      rounds?: number;
      workTime?: number;      // for tabata
      restTime?: number;      // for tabata
    } | null;
  }>
}
```

## Dependencies

### NPM Packages

- `ai` (Vercel AI SDK)
- `@ai-sdk/openai` (OpenAI-compatible provider, works with OpenRouter)

### Environment Variables

- `OPENROUTER_API_KEY` - stored in `.env`, added to `.env.example` as placeholder

## Implementation Files

### Files to Create

1. `src/routes/api/wods/generate-sections/+server.ts` - API endpoint
2. `src/lib/services/ai.ts` - AI SDK configuration and helper functions

### Files to Modify

1. `src/routes/(app)/workouts/new/+page.svelte` - Add sparkles icon, loading state, confirmation dialog
2. `.env.example` - Add `OPENROUTER_API_KEY` placeholder
3. `package.json` - Add dependencies via `bun add`

## Error Handling & Edge Cases

### API Error Handling

- Network failure → Toast: "Failed to generate sections. Please try again."
- Invalid API key → Toast: "AI service configuration error. Contact support."
- Rate limiting → Toast: "Too many requests. Please wait a moment."
- Malformed AI response → Retry once internally, then show generic error toast

### Edge Cases

- User clicks generate while already generating → Button disabled, no action
- User navigates away during generation → Request continues but result discarded
- AI returns empty sections array → Toast: "Couldn't generate sections from this description. Try adding more detail."
- Description changed while generating → Use original description that triggered the request

### Validation

- Server-side: Validate description is string with 5+ characters
- Client-side: Icon only visible when description.length >= 5

### Security

- API key never exposed to client
- Input sanitized before sending to AI
