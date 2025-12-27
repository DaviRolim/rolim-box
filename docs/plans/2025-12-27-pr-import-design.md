# PR Import from Image - Design Document

## Overview

Allow users to import Personal Records from screenshots of other fitness apps using LLM-powered image analysis. The system extracts exercise names and PR values from images, fuzzy-matches them to existing exercises in the database, and provides a review interface before importing.

## User Flow

### Entry Point
"Import" button on the PR page header.

### Step 1 - Upload
- User clicks "Import" button
- Modal opens with a dropzone/file input
- User selects or drags an image (PNG, JPG, WEBP, max 5MB)
- Image preview shown after selection

### Step 2 - Processing
- Loading state: "Analyzing your PRs..."
- Server sends image to Gemini Vision API with exercise list for fuzzy matching
- LLM returns structured data: matched PRs, unmatched exercises

### Step 3 - Review
- Editable list of matched PRs (exercise name, value, unit)
- Conflicts highlighted (existing PR differs from imported)
- Skipped/unmatched exercises shown as notification
- User can: edit values, toggle include/exclude, resolve conflicts

### Step 4 - Confirm
- User clicks "Import X PRs"
- Bulk insert to database
- Success toast, modal closes, PR page refreshes

## Technical Architecture

### New API Endpoint: `POST /api/prs/import`

**Request:**
- Multipart form with image file
- Server validates file type and size (max ~5MB)

**Processing:**
1. Fetch all exercises from database (id, name, category, measurementType)
2. Send to Gemini Vision API with prompt containing:
   - The image
   - List of valid exercises with their IDs and measurement types
   - Instructions to extract PRs, fuzzy match to exercises, detect units
3. Gemini returns JSON with matched/unmatched exercises
4. Server enriches response with conflict detection (compares against user's existing PRs)
5. Returns structured data to client

**Response:**
```json
{
  "matched": [
    {
      "exerciseId": "abc123",
      "exerciseName": "Back Squat",
      "originalText": "Back Squat - 225 lbs",
      "value": 102058,
      "confidence": "high"
    }
  ],
  "unmatched": ["Turkish Get-Up", "Pistol Squat"],
  "conflicts": [
    {
      "exerciseId": "abc123",
      "exerciseName": "Back Squat",
      "currentValue": 100000,
      "importedValue": 102058
    }
  ]
}
```

### New API Endpoint: `POST /api/prs/bulk`

**Request:**
```json
{
  "prs": [
    { "exerciseId": "abc123", "value": 102058 },
    { "exerciseId": "def456", "value": 300 }
  ]
}
```

**Processing:**
- Accepts array of PRs to create/update
- Uses transaction for atomicity
- All PRs get today's date
- Returns success/failure count

## LLM Prompt Design

**System Context:**
```
You are a fitness data extraction assistant. Extract personal records (PRs) from the provided image and match them to the given exercise database.
```

**Prompt:**
```
Extract all personal records from this image. For each PR found:
1. Identify the exercise name exactly as shown
2. Match it to the closest exercise from the database below (fuzzy match)
3. Extract the numeric value and detect the unit (kg, lbs, seconds, minutes, reps, meters, miles)
4. Convert to base units: weight→grams, time→seconds, distance→centimeters, reps→count

Exercise Database:
[{ id, name, measurementType }, ...]

Return JSON:
{
  "matched": [{
    "exerciseId": "...",
    "originalText": "Back Squat - 225 lbs",
    "value": 102058,
    "confidence": "high|medium|low"
  }],
  "unmatched": ["exercise names that couldn't be matched"]
}

Rules:
- Only match if confident (>70% similarity)
- Weight: kg→×1000, lbs→×453.592
- Time: parse MM:SS or HH:MM:SS formats
- If unit unclear, infer from measurementType
```

## UI Components

### ImportPRModal.svelte

Multi-step modal with three states:

**Upload State:**
- Dropzone with dashed border, upload icon
- "Drop image or click to upload"
- Accepts: PNG, JPG, WEBP (max 5MB)
- Image preview thumbnail after selection
- "Analyze" button to proceed

**Processing State:**
- Spinner/loading animation
- "Analyzing your PRs..." message

**Review State:**
- Header: "Found X PRs" + "Y skipped" badge if any
- Scrollable list of matched PRs, each row:
  - Checkbox (include/exclude)
  - Exercise name (read-only)
  - Editable value input
  - Unit label (kg/lbs/etc based on user preference)
  - Conflict indicator if exists (shows current vs imported)
- Expandable section: "X exercises couldn't be matched" with list
- Footer: "Cancel" and "Import X PRs" buttons

**Styling:** Follows existing modal patterns (PRModal, ConfirmModal) - dark theme, accent colors, consistent spacing.

## Error Handling

### Image Upload Errors
- Invalid file type → "Please upload a PNG, JPG, or WEBP image"
- File too large (>5MB) → "Image must be smaller than 5MB"
- Upload fails → "Failed to upload image. Please try again."

### LLM Processing Errors
- API timeout/failure → "Couldn't analyze image. Please try again."
- No PRs found → "No personal records found in this image. Make sure the image clearly shows exercise names and values."
- All exercises unmatched → Show unmatched list with guidance

### Import Errors
- Partial failure → "Imported X of Y PRs. Some failed to save."
- Complete failure → "Import failed. Please try again."

### Validation in Review
- Empty/invalid value → Highlight field, disable import button until fixed
- Negative numbers → "Value must be positive"

## Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Image parsing | Generic extraction | Supports multiple source apps |
| Exercise matching | LLM fuzzy matching | Handles name variations gracefully |
| API location | Server-side | Keeps API keys secure, allows rate limiting |
| Unmatched exercises | Skip with notification | Transparent without blocking import |
| Unit handling | LLM auto-detection | Seamless UX, handles mixed units |
| Conflicts | User decides in review | PRs are personal, user should control |
| UI entry point | Button on PR page | Direct access where PRs are managed |
| Date for imports | Today's date | Simple, user can edit later if needed |
| Review screen | Editable list | Allows correction of LLM errors |

## Files to Create/Modify

**New files:**
- `src/routes/api/prs/import/+server.ts` - Image analysis endpoint
- `src/routes/api/prs/bulk/+server.ts` - Bulk import endpoint
- `src/routes/(app)/prs/ImportPRModal.svelte` - Multi-step modal

**Modified files:**
- `src/routes/(app)/prs/+page.svelte` - Add Import button
