# UI Enhancement Notes: AI CV Upload Form Visibility

## Current State
The "Upload CV untuk AI Screening" form is located after the main application form in `/applications/new/page.tsx` (lines 364-515). It's visually separated but uses:
- Violet color scheme
- n8n badge
- Clear title and description
- Drag-and-drop interface

## Issue
Users need to scroll past the main application form to see this additional form, which can be confusing as it appears to be a separate feature rather than an additional step in the same workflow.

## Proposed Enhancements

### 1. Visual Integration
- Add a subtle connector/transition element between the two forms
- Use a shared color palette across both forms
- Add a "Form Lengkap" or "Langkah Selanjutnya" indicator
- Include small visual cues that connect the two sections

### 2. Text-Based Cues
- Add a brief explanatory text at the top of the CV upload form
- Use clear language: "Sebagai tambahan dari form lamaran di atas, silakan upload CV untuk screening otomatis oleh AI"
- Add a small "Opsional" or "Disarankan" indicator

### 3. Progress Indicators
- Show a multi-step progress indicator
- Highlight that this is step 2 of the application process
- Use checkmarks or numbered indicators

### 4. Placement Considerations
- Consider placing the CV upload form BEFORE or immediately after the main form
- Use consistent spacing and visual hierarchy
- Ensure the form feels like part of the same workflow

### 5. Additional UI Elements
- Add a "Info" icon with tooltip explaining the benefits of AI screening
- Include a small help text about what happens after upload
- Show preview of what the AI screening will provide

## Design Principles
- Maintain existing color scheme (violet for AI features)
- Keep consistency with other forms in the application
- Ensure mobile responsiveness
- Follow the existing component patterns
- Add minimal friction to the user journey